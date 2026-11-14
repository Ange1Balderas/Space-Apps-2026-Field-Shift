// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The browser-side loader, run with `fetch` replaced by a stub. Every way a request can go
// wrong must end in a plain-language Error for the panel, never in a blank screen.

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClimateResponse } from "@/lib/climate";
import { loadPointClimate, loadSampleClimate } from "@/lib/climate-client";
import { SAMPLE_FIELDS } from "@/lib/samples";
import { makeRisingYears } from "@/lib/test-fixtures";

const CLIMATE = buildClimateResponse({
	lat: 38.33,
	lon: -97.32,
	elevationM: 430,
	days: makeRisingYears(1981, 12),
	fetchedAt: "2026-11-14T18:00:00.000Z",
});
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

describe("loadSampleClimate", () => {
	it("reads the climate from the sample's cached file", async () => {
		const fetchStub = stubFetch(async () =>
			Response.json({ id: "finney", climate: CLIMATE }),
		);
		const loaded = await loadSampleClimate(FINNEY, live());
		expect(fetchStub.mock.calls[0]?.[0]).toBe("/data/samples/finney.json");
		expect(loaded).toEqual({ climate: CLIMATE, origin: "sample" });
	});

	it("explains a missing file", async () => {
		stubFetch(async () => new Response("Not found", { status: 404 }));
		await expect(loadSampleClimate(FINNEY, live())).rejects.toThrow(
			"The cached data for Finney County could not be loaded (HTTP 404).",
		);
	});

	it("rejects a file without a usable climate block", async () => {
		stubFetch(async () => Response.json({ id: "finney", climate: null }));
		await expect(loadSampleClimate(FINNEY, live())).rejects.toThrow(
			/could not read/,
		);
	});
});

describe("loadPointClimate", () => {
	it("asks the route for the point at two decimal places", async () => {
		const fetchStub = stubFetch(async () =>
			Response.json(CLIMATE, { headers: { "X-Field-Shift-Data": "live" } }),
		);
		const loaded = await loadPointClimate(38.3271, -97.3249, live());
		expect(fetchStub.mock.calls[0]?.[0]).toBe(
			"/api/climate?lat=38.33&lon=-97.32",
		);
		expect(loaded).toEqual({ climate: CLIMATE, origin: "live" });
	});

	it("reports when the route answered with the cached sample", async () => {
		stubFetch(async () =>
			Response.json(CLIMATE, {
				headers: { "X-Field-Shift-Data": "cached-sample" },
			}),
		);
		const loaded = await loadPointClimate(38.05, -100.74, live());
		expect(loaded.origin).toBe("sample-fallback");
	});

	it("passes on the route's own error message", async () => {
		stubFetch(async () =>
			Response.json(
				{ error: "NASA POWER could not be reached. Try again in a moment." },
				{ status: 502 },
			),
		);
		await expect(loadPointClimate(38, -98, live())).rejects.toThrow(
			"NASA POWER could not be reached. Try again in a moment.",
		);
	});

	it("explains an error answer that is not JSON", async () => {
		stubFetch(
			async () => new Response("<html>Bad gateway</html>", { status: 502 }),
		);
		await expect(loadPointClimate(38, -98, live())).rejects.toThrow(
			"The climate service answered with an error (HTTP 502). Try again in a moment.",
		);
	});

	it("rejects a 200 answer that is not climate data", async () => {
		stubFetch(async () => new Response("<html>Hello</html>"));
		await expect(loadPointClimate(38, -98, live())).rejects.toThrow(
			/could not read/,
		);

		stubFetch(async () => Response.json({ years: "soon" }));
		await expect(loadPointClimate(38, -98, live())).rejects.toThrow(
			/could not read/,
		);
	});

	it("explains a network failure", async () => {
		stubFetch(async () => {
			throw new TypeError("Failed to fetch");
		});
		await expect(loadPointClimate(38, -98, live())).rejects.toThrow(
			/could not be reached\. Check your connection/,
		);
	});

	it("gives up with a message after 20 seconds", async () => {
		vi.useFakeTimers();
		stubFetch(hangingFetch);
		const outcome = expect(loadPointClimate(38, -98, live())).rejects.toThrow(
			/took too long/,
		);
		await vi.advanceTimersByTimeAsync(20_000);
		await outcome;
	});

	it("stays quiet when the caller cancels, so a newer selection can take over", async () => {
		stubFetch(hangingFetch);
		const caller = new AbortController();
		const pending = loadPointClimate(38, -98, caller.signal);
		caller.abort();
		// The abort itself comes back, not a message meant for the panel.
		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
	});
});
