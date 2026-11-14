// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The route is called directly with Soil Data Access replaced by a stub, so these tests
// make no network request. The soil row is a real answer saved on 2026-11-14.

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSoilResponse } from "@/lib/contracts";
import { SAMPLE_FIELDS } from "@/lib/samples";

const SDA_ANSWER = {
	Table: [
		["mukey", "muname", "aws0100wta", "slopegradwta", "hydgrp", "wei", "om_r", "kwfact", "texdesc"],
		["1152346", "Satanta loam, 0 to 1 percent slopes", "19.22", "0.9", "C", "56", "2", ".32", "Loam"],
	],
};

/** A fresh copy of the route, so every test starts with an empty memory cache. */
async function loadRoute() {
	vi.resetModules();
	const { GET } = await import("@/app/api/soil/route");
	return (query: string) =>
		GET(new NextRequest(`http://localhost/api/soil${query}`));
}

function stubService(answer: () => Promise<Response>) {
	const service = vi.fn<(...request: unknown[]) => Promise<Response>>(() =>
		answer(),
	);
	vi.stubGlobal("fetch", service);
	return service;
}

const serviceOk = () => Promise.resolve(Response.json(SDA_ANSWER));
const serviceDown = () => Promise.resolve(new Response("down", { status: 500 }));

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("GET /api/soil", () => {
	it("answers 400 for a bad or out-of-state point without calling the service", async () => {
		const service = stubService(serviceOk);
		const get = await loadRoute();
		expect((await get("?lon=-98")).status).toBe(400);
		expect((await get("?lat=35.4&lon=-97.5")).status).toBe(400);
		expect(service).not.toHaveBeenCalled();
	});

	it("posts one query for the point and returns the soil facts", async () => {
		const service = stubService(serviceOk);
		const get = await loadRoute();
		const response = await get("?lat=38.0498&lon=-100.74");

		expect(response.status).toBe(200);
		const [url, init] = service.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://sdmdataaccess.sc.egov.usda.gov/tabular/post.rest");
		expect(init.method).toBe("POST");
		const sent = JSON.parse(String(init.body));
		expect(sent.format).toBe("JSON+COLUMNNAME");
		expect(sent.query).toContain("'point(-100.74000 38.04980)'");

		const body = await response.json();
		expect(isSoilResponse(body)).toBe(true);
		expect(body).toMatchObject({
			mukey: "1152346",
			mapUnitName: "Satanta loam, 0 to 1 percent slopes",
			texture: "Loam",
			// 19.22 cm divided by 2.54 is 7.567 in.
			availableWaterIn: 7.57,
			organicMatterPct: 2,
			kFactor: 0.32,
			windErodibilityIndex: 56,
			slopePct: 0.9,
			hydrologicGroup: "C",
		});
		expect(response.headers.get("X-Field-Shift-Data")).toBe("live");
		expect(response.headers.get("Cache-Control")).toMatch(/s-maxage=86400/);
	});

	it("serves a repeat request for the same point from memory", async () => {
		const service = stubService(serviceOk);
		const get = await loadRoute();
		await get("?lat=38.0498&lon=-100.74");
		expect((await get("?lat=38.049801&lon=-100.740002")).status).toBe(200);
		expect(service).toHaveBeenCalledTimes(1);
	});

	it("answers 404 with a plain message where no soil survey covers the point", async () => {
		stubService(() => Promise.resolve(Response.json({})));
		const get = await loadRoute();
		const response = await get("?lat=38.5&lon=-98.3");
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe(
			"The USDA soil survey has no data at this point.",
		);
	});

	it("answers 502 when the service fails or sends something unreadable, and 504 when it is too slow", async () => {
		stubService(serviceDown);
		const get = await loadRoute();
		const failed = await get("?lat=38.5&lon=-98.3");
		expect(failed.status).toBe(502);
		expect((await failed.json()).error).toMatch(
			/soil survey service answered with an error \(HTTP 500\)/,
		);

		// Soil Data Access reports a bad query as XML, which is not JSON.
		stubService(() => Promise.resolve(new Response("<ServiceException/>")));
		expect((await get("?lat=38.6&lon=-98.3")).status).toBe(502);

		stubService(() =>
			Promise.reject(new DOMException("timed out", "TimeoutError")),
		);
		expect((await get("?lat=38.7&lon=-98.3")).status).toBe(504);
	});

	it("falls back to the cached sample when the service fails at a sample field", async () => {
		stubService(serviceDown);
		const get = await loadRoute();
		for (const sample of SAMPLE_FIELDS) {
			const response = await get(`?lat=${sample.lat}&lon=${sample.lon}`);
			expect(response.status).toBe(200);
			expect(response.headers.get("X-Field-Shift-Data")).toBe("cached-sample");
			expect(isSoilResponse(await response.json())).toBe(true);
		}
	});

	it("in mock mode serves samples only and never calls the service", async () => {
		vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "mock");
		const service = stubService(serviceOk);
		const get = await loadRoute();

		const sample = SAMPLE_FIELDS[0];
		expect((await get(`?lat=${sample.lat}&lon=${sample.lon}`)).status).toBe(200);
		const elsewhere = await get("?lat=38.5&lon=-98.3");
		expect(elsewhere.status).toBe(404);
		expect(service).not.toHaveBeenCalled();
	});
});
