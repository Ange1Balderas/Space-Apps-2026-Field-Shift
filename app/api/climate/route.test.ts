// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The route is called directly with NASA POWER replaced by a stub, so these tests make no
// network request. The weather is made up (lib/test-fixtures.ts).

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isClimateResponse } from "@/lib/climate";
import { SAMPLE_FIELDS } from "@/lib/samples";
import { makeRisingYears, toPowerBody } from "@/lib/test-fixtures";

const POWER_BODY = toPowerBody(makeRisingYears(1981, 12));
const FINNEY = SAMPLE_FIELDS[0];
const FINNEY_QUERY = `?lat=${FINNEY.lat}&lon=${FINNEY.lon}`;

/** A fresh copy of the route, so every test starts with an empty memory cache. */
async function loadRoute() {
	vi.resetModules();
	const { GET } = await import("@/app/api/climate/route");
	return (query: string) =>
		GET(new NextRequest(`http://localhost/api/climate${query}`));
}

function stubPower(answer: () => Promise<Response>) {
	// Typed with arguments so a test can read the URL the route asked for.
	const power = vi.fn<(...request: unknown[]) => Promise<Response>>(() =>
		answer(),
	);
	vi.stubGlobal("fetch", power);
	return power;
}

const powerOk = () => Promise.resolve(Response.json(POWER_BODY));

beforeEach(() => {
	// Fix the date so "the last full year" is 2025. Only Date is faked.
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("GET /api/climate: input checks", () => {
	it.each([
		"",
		"?lat=38.05",
		"?lat=abc&lon=-100.74",
		"?lat=&lon=-100.74",
	])("answers 400 for %j without calling POWER", async (query) => {
		const power = stubPower(powerOk);
		const get = await loadRoute();
		const response = await get(query);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: expect.any(String) });
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(power).not.toHaveBeenCalled();
	});

	it("answers 400 for a point outside Kansas without calling POWER", async () => {
		const power = stubPower(powerOk);
		const get = await loadRoute();
		const response = await get("?lat=41.2&lon=-100");
		expect(response.status).toBe(400);
		expect((await response.json()).error).toMatch(/outside Kansas/);
		expect(power).not.toHaveBeenCalled();
	});
});

describe("GET /api/climate: live data", () => {
	it("asks POWER for 1981 to the last full year at the rounded point", async () => {
		const power = stubPower(powerOk);
		const get = await loadRoute();
		const response = await get("?lat=37.5041&lon=-98.1162");

		expect(response.status).toBe(200);
		const requested = new URL(String(power.mock.calls[0]?.[0]));
		expect(requested.hostname).toBe("power.larc.nasa.gov");
		expect(requested.searchParams.get("latitude")).toBe("37.5");
		expect(requested.searchParams.get("longitude")).toBe("-98.12");
		expect(requested.searchParams.get("start")).toBe("19810101");
		expect(requested.searchParams.get("end")).toBe("20251231");

		const body = await response.json();
		expect(isClimateResponse(body)).toBe(true);
		expect(body.lat).toBe(37.5);
		expect(body.lon).toBe(-98.12);
		expect(body.years).toHaveLength(12);
		expect(body.fetchedAt).toBe("2026-11-14T12:00:00.000Z");
	});

	it("marks a live answer as cacheable by browsers and the CDN", async () => {
		stubPower(powerOk);
		const get = await loadRoute();
		const response = await get("?lat=37.5&lon=-98.12");
		expect(response.headers.get("X-Field-Shift-Data")).toBe("live");
		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
		);
	});

	it("serves a repeat request for the same rounded point from memory", async () => {
		const power = stubPower(powerOk);
		const get = await loadRoute();
		await get("?lat=37.5041&lon=-98.1162");
		const second = await get("?lat=37.4999&lon=-98.1249");
		expect(second.status).toBe(200);
		expect(power).toHaveBeenCalledTimes(1);
	});
});

describe("GET /api/climate: failures", () => {
	it("answers 502 with a plain message when POWER returns an error", async () => {
		stubPower(() => Promise.resolve(new Response("down", { status: 503 })));
		const get = await loadRoute();
		const response = await get("?lat=37.5&lon=-98.12");
		expect(response.status).toBe(502);
		expect((await response.json()).error).toMatch(/NASA POWER answered with an error/);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	it("answers 504 when POWER does not answer in time", async () => {
		stubPower(() =>
			Promise.reject(new DOMException("timed out", "TimeoutError")),
		);
		const get = await loadRoute();
		const response = await get("?lat=37.5&lon=-98.12");
		expect(response.status).toBe(504);
		expect((await response.json()).error).toMatch(/within 15 seconds/);
	});

	it("answers 502 when POWER cannot be reached or sends something unreadable", async () => {
		stubPower(() => Promise.reject(new TypeError("fetch failed")));
		const get = await loadRoute();
		expect((await get("?lat=37.5&lon=-98.12")).status).toBe(502);

		stubPower(() => Promise.resolve(Response.json({ messages: ["no data"] })));
		const unreadable = await get("?lat=37.6&lon=-98.12");
		expect(unreadable.status).toBe(502);
		expect((await unreadable.json()).error).toMatch(/could not read/);
	});

	it("does not cache a failure: the next request asks POWER again", async () => {
		const power = stubPower(() =>
			Promise.resolve(new Response("down", { status: 503 })),
		);
		const get = await loadRoute();
		expect((await get("?lat=37.5&lon=-98.12")).status).toBe(502);

		power.mockImplementation(powerOk);
		expect((await get("?lat=37.5&lon=-98.12")).status).toBe(200);
		expect(power).toHaveBeenCalledTimes(2);
	});

	it("falls back to the cached sample when POWER fails at a sample field", async () => {
		stubPower(() => Promise.resolve(new Response("down", { status: 503 })));
		const get = await loadRoute();
		const response = await get(FINNEY_QUERY);

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Field-Shift-Data")).toBe("cached-sample");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		const body = await response.json();
		expect(isClimateResponse(body)).toBe(true);
		expect(body.years.length).toBeGreaterThanOrEqual(45);
	});
});

describe("GET /api/climate: mock mode", () => {
	it("serves the cached sample at a sample field and never calls POWER", async () => {
		vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "mock");
		const power = stubPower(powerOk);
		const get = await loadRoute();
		const response = await get(FINNEY_QUERY);

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Field-Shift-Data")).toBe("cached-sample");
		expect(isClimateResponse(await response.json())).toBe(true);
		expect(power).not.toHaveBeenCalled();
	});

	it("answers 404 with a plain message anywhere else, and never calls POWER", async () => {
		vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "mock");
		const power = stubPower(powerOk);
		const get = await loadRoute();
		const response = await get("?lat=37.5&lon=-98.12");

		expect(response.status).toBe(404);
		expect((await response.json()).error).toMatch(/Mock mode/);
		expect(power).not.toHaveBeenCalled();
	});
});
