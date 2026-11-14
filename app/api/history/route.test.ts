// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The route is called directly with USDA's CDL service replaced by a stub, so these tests
// make no network request. The crop values are made up.

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isHistoryResponse } from "@/lib/contracts";
import { SAMPLE_FIELDS } from "@/lib/samples";

/** An identify answer: one class value per year from 2014 to 2025, newest first. */
function identifyBody(values: string[]): unknown {
	return {
		properties: { Values: values },
		catalogItems: {
			features: values.map((_, index) => ({
				attributes: { Year: 2025 - index },
			})),
		},
	};
}

// Newest first: 2025 is corn, 2024 soybeans, and so on back to 2014.
const TWELVE_YEARS = ["1", "5", "1", "5", "1", "5", "1", "5", "24", "61", "24", "176"];

/** A fresh copy of the route, so every test starts with an empty memory cache. */
async function loadRoute() {
	vi.resetModules();
	const { GET } = await import("@/app/api/history/route");
	return (query: string) =>
		GET(new NextRequest(`http://localhost/api/history${query}`));
}

function stubService(answer: () => Promise<Response>) {
	const service = vi.fn<(...request: unknown[]) => Promise<Response>>(() =>
		answer(),
	);
	vi.stubGlobal("fetch", service);
	return service;
}

const serviceOk = () => Promise.resolve(Response.json(identifyBody(TWELVE_YEARS)));
const serviceDown = () => Promise.resolve(new Response("down", { status: 503 }));

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("GET /api/history", () => {
	it("answers 400 for a bad or out-of-state point without calling the service", async () => {
		const service = stubService(serviceOk);
		const get = await loadRoute();
		expect((await get("?lat=abc&lon=-98")).status).toBe(400);
		const outside = await get("?lat=41.2&lon=-100");
		expect(outside.status).toBe(400);
		expect((await outside.json()).error).toMatch(/outside Kansas/);
		expect(service).not.toHaveBeenCalled();
	});

	it("returns the newest 8 years at the point, oldest first, and marks them cacheable", async () => {
		const service = stubService(serviceOk);
		const get = await loadRoute();
		const response = await get("?lat=38.5123449&lon=-98.3210051");

		expect(response.status).toBe(200);
		const asked = new URL(String(service.mock.calls[0]?.[0]));
		expect(asked.hostname).toBe("pdi.scinet.usda.gov");
		// Five decimal places: a crop pixel is 30 m across, so the point is not coarsened.
		expect(JSON.parse(asked.searchParams.get("geometry") ?? "")).toMatchObject({
			x: -98.32101,
			y: 38.51234,
		});

		const body = await response.json();
		expect(isHistoryResponse(body)).toBe(true);
		expect(body.years.map((row: { year: number }) => row.year)).toEqual([
			2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
		]);
		expect(body.years[7]).toEqual({ year: 2025, cdlCode: 1, crop: "Corn" });
		expect(body.source).toBe("USDA NASS Cropland Data Layer");
		expect(response.headers.get("X-Field-Shift-Data")).toBe("live");
		expect(response.headers.get("Cache-Control")).toMatch(/s-maxage=86400/);
	});

	it("serves a repeat request for the same point from memory", async () => {
		const service = stubService(serviceOk);
		const get = await loadRoute();
		await get("?lat=38.51234&lon=-98.32101");
		expect((await get("?lat=38.512341&lon=-98.321009")).status).toBe(200);
		expect(service).toHaveBeenCalledTimes(1);
	});

	it("answers 404 with a plain message where the layer has no crop record", async () => {
		stubService(() =>
			Promise.resolve(Response.json(identifyBody(["NoData", "NoData"]))),
		);
		const get = await loadRoute();
		const response = await get("?lat=38.5&lon=-98.3");
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe(
			"The Cropland Data Layer has no crop record at this point.",
		);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	it("answers 502 when the service fails, and 504 when it is too slow", async () => {
		stubService(serviceDown);
		const get = await loadRoute();
		const failed = await get("?lat=38.5&lon=-98.3");
		expect(failed.status).toBe(502);
		expect((await failed.json()).error).toMatch(
			/Cropland Data Layer service answered with an error \(HTTP 503\)/,
		);

		stubService(() =>
			Promise.reject(new DOMException("timed out", "TimeoutError")),
		);
		const slow = await get("?lat=38.6&lon=-98.3");
		expect(slow.status).toBe(504);
		expect((await slow.json()).error).toMatch(/within 15 seconds/);
	});

	it("answers 502 for an error the service reports inside a 200 answer", async () => {
		stubService(() =>
			Promise.resolve(Response.json({ error: { code: 500, message: "boom" } })),
		);
		const get = await loadRoute();
		expect((await get("?lat=38.5&lon=-98.3")).status).toBe(502);
	});

	it("falls back to the cached sample when the service fails at a sample field", async () => {
		stubService(serviceDown);
		const get = await loadRoute();
		for (const sample of SAMPLE_FIELDS) {
			const response = await get(`?lat=${sample.lat}&lon=${sample.lon}`);
			expect(response.status).toBe(200);
			expect(response.headers.get("X-Field-Shift-Data")).toBe("cached-sample");
			expect(response.headers.get("Cache-Control")).toBe("no-store");
			const body = await response.json();
			expect(isHistoryResponse(body)).toBe(true);
			expect(body.years).toHaveLength(8);
		}
	});

	it("in mock mode serves samples only and never calls the service", async () => {
		vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "mock");
		const service = stubService(serviceOk);
		const get = await loadRoute();

		const sample = SAMPLE_FIELDS[0];
		const cached = await get(`?lat=${sample.lat}&lon=${sample.lon}`);
		expect(cached.status).toBe(200);
		expect(cached.headers.get("X-Field-Shift-Data")).toBe("cached-sample");

		const elsewhere = await get("?lat=38.5&lon=-98.3");
		expect(elsewhere.status).toBe(404);
		expect((await elsewhere.json()).error).toMatch(/Mock mode/);
		expect(service).not.toHaveBeenCalled();
	});
});
