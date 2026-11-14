// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The browser-side loader, run with `fetch` replaced by a stub. Every way a request can go
// wrong must end in a plain-language Error for the panel, never in a blank screen.

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClimateResponse } from "@/lib/climate";
import {
	loadClimate,
	loadHistory,
	loadSampleField,
	loadSoil,
} from "@/lib/field-client";
import { SAMPLE_FIELDS } from "@/lib/samples";
import { makeRisingYears } from "@/lib/test-fixtures";
import type { HistoryResponse, SoilResponse } from "@/lib/types";

const CLIMATE = buildClimateResponse({
	lat: 38.33,
	lon: -97.32,
	elevationM: 430,
	days: makeRisingYears(1981, 12),
	fetchedAt: "2026-11-14T18:00:00.000Z",
});
const HISTORY: HistoryResponse = {
	years: [
		{ year: 2024, cdlCode: 1, crop: "Corn" },
		{ year: 2025, cdlCode: 5, crop: "Soybeans" },
	],
	source: "USDA NASS Cropland Data Layer",
};
const SOIL: SoilResponse = {
	mukey: "1152346",
	mapUnitName: "Satanta loam, 0 to 1 percent slopes",
	texture: "Loam",
	availableWaterIn: 7.57,
	organicMatterPct: 2,
	kFactor: 0.32,
	windErodibilityIndex: 56,
	slopePct: 0.9,
	hydrologicGroup: "C",
	source: "USDA NRCS SSURGO",
};
const FINNEY = SAMPLE_FIELDS[0];

type FetchStub = (url: unknown, init?: RequestInit) => Promise<Response>;

function stubFetch(answer: FetchStub) {
	const stub = vi.fn<FetchStub>(answer);
	vi.stubGlobal("fetch", stub);
	return stub;
}

/** A request that never answers, and rejects the way fetch does when it is aborted. */
const hangingFetch: FetchStub = (_url, init) =>
	new Promise<Response>((_resolve, reject) => {
		const abort = () => reject(new DOMException("aborted", "AbortError"));
		if (init?.signal?.aborted) abort();
		else init?.signal?.addEventListener("abort", abort);
	});

const live = () => new AbortController().signal;

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("loadSampleField", () => {
	it("reads all three facts from the sample's cached file", async () => {
		const fetchStub = stubFetch(async () =>
			Response.json({ id: "finney", climate: CLIMATE, history: HISTORY, soil: SOIL }),
		);
		const loaded = await loadSampleField(FINNEY, live());
		expect(fetchStub.mock.calls[0]?.[0]).toBe("/data/samples/finney.json");
		expect(loaded).toEqual({ climate: CLIMATE, history: HISTORY, soil: SOIL });
	});

	it("explains a missing file", async () => {
		stubFetch(async () => new Response("Not found", { status: 404 }));
		await expect(loadSampleField(FINNEY, live())).rejects.toThrow(
			"The cached data for Finney County could not be loaded (HTTP 404).",
		);
	});

	it("rejects a file that lacks one of the three facts", async () => {
		stubFetch(async () =>
			Response.json({ id: "finney", climate: CLIMATE, history: HISTORY, soil: null }),
		);
		await expect(loadSampleField(FINNEY, live())).rejects.toThrow(
			/could not read/,
		);
	});
});

describe("loading a clicked point", () => {
	it("asks the climate route at two decimal places", async () => {
		const fetchStub = stubFetch(async () =>
			Response.json(CLIMATE, { headers: { "X-Field-Shift-Data": "live" } }),
		);
		const loaded = await loadClimate(38.3271, -97.3249, live());
		expect(fetchStub.mock.calls[0]?.[0]).toBe(
			"/api/climate?lat=38.33&lon=-97.32",
		);
		expect(loaded).toEqual({ data: CLIMATE, origin: "live" });
	});

	it("asks the crop history and soil routes at five decimal places", async () => {
		const fetchStub = stubFetch(async (url) =>
			Response.json(String(url).startsWith("/api/history") ? HISTORY : SOIL),
		);
		const history = await loadHistory(38.3271449, -97.3249051, live());
		const soil = await loadSoil(38.3271449, -97.3249051, live());
		expect(fetchStub.mock.calls.map((call) => call[0])).toEqual([
			"/api/history?lat=38.32714&lon=-97.32491",
			"/api/soil?lat=38.32714&lon=-97.32491",
		]);
		expect(history.data).toEqual(HISTORY);
		expect(soil.data).toEqual(SOIL);
	});

	it("reports when a route answered with the cached sample", async () => {
		stubFetch(async () =>
			Response.json(HISTORY, {
				headers: { "X-Field-Shift-Data": "cached-sample" },
			}),
		);
		expect((await loadHistory(38.05, -100.74, live())).origin).toBe(
			"sample-fallback",
		);
	});

	it("passes on the route's own error message", async () => {
		stubFetch(async () =>
			Response.json(
				{ error: "The USDA soil survey has no data at this point." },
				{ status: 404 },
			),
		);
		await expect(loadSoil(38, -98, live())).rejects.toThrow(
			"The USDA soil survey has no data at this point.",
		);
	});

	it("explains an error answer that is not JSON", async () => {
		stubFetch(
			async () => new Response("<html>Bad gateway</html>", { status: 502 }),
		);
		await expect(loadHistory(38, -98, live())).rejects.toThrow(
			"The crop history service answered with an error (HTTP 502). Try again in a moment.",
		);
	});

	it("rejects a 200 answer of the wrong shape, for each fact", async () => {
		stubFetch(async () => Response.json({ years: "soon" }));
		await expect(loadClimate(38, -98, live())).rejects.toThrow(/could not read/);
		await expect(loadHistory(38, -98, live())).rejects.toThrow(/could not read/);
		await expect(loadSoil(38, -98, live())).rejects.toThrow(/could not read/);

		stubFetch(async () => new Response("<html>Hello</html>"));
		await expect(loadClimate(38, -98, live())).rejects.toThrow(/could not read/);
	});

	it("explains a network failure", async () => {
		stubFetch(async () => {
			throw new TypeError("Failed to fetch");
		});
		await expect(loadClimate(38, -98, live())).rejects.toThrow(
			/could not be reached\. Check your connection/,
		);
	});

	it("gives up with a message after 20 seconds", async () => {
		vi.useFakeTimers();
		stubFetch(hangingFetch);
		const outcome = expect(loadSoil(38, -98, live())).rejects.toThrow(
			/took too long/,
		);
		await vi.advanceTimersByTimeAsync(20_000);
		await outcome;
	});

	it("stays quiet when the caller cancels, so a newer selection can take over", async () => {
		stubFetch(hangingFetch);
		const caller = new AbortController();
		const pending = loadHistory(38, -98, caller.signal);
		caller.abort();
		// The abort itself comes back, not a message meant for the panel.
		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
	});
});
