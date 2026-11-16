// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Browser-side loading of a field's three facts: climate history, crop history and soil.
// A sample field reads its cached file from public/data/samples/, so it never depends on a
// live service. Any other point goes through the app's own routes, one request per fact, so
// one slow or failed service does not hold up or break the others. Every failure becomes an
// Error with a plain-language message for the panel.

import { climatePoint, isClimateResponse } from "@/lib/climate";
import { isHistoryResponse, isSoilResponse } from "@/lib/contracts";
import { type County, countyAt, loadCounties } from "@/lib/counties";
import { fieldPoint } from "@/lib/kansas";
import { isCountyMoisture } from "@/lib/moisture";
import type { SampleField } from "@/lib/samples";
import type {
	ClimateResponse,
	CountyMoisture,
	HistoryResponse,
	SoilResponse,
} from "@/lib/types";

/**
 * Where the numbers on screen came from:
 * "live" from the source just now, "sample" from a sample field's cached file,
 * "sample-fallback" when the source failed and the route answered with the cached sample, or
 * "prepared" from a file built in advance (the county soil moisture).
 */
export type DataOrigin = "live" | "sample" | "sample-fallback" | "prepared";

/** The county's soil moisture record, or why there is none to show. */
export type MoistureResult =
	| { kind: "county"; county: County; data: CountyMoisture }
	/** The point is in no county outline: outside the state line, inside the rectangle. */
	| { kind: "no-county" }
	/** The county has no file yet: its SMAP data has not been built. */
	| { kind: "no-record"; county: County };

export type Loaded<T> = { data: T; origin: DataOrigin };

export type SampleFieldData = {
	climate: ClimateResponse;
	history: HistoryResponse;
	soil: SoilResponse;
};

// The routes give up on their source after 15 seconds. This is the browser's own limit on
// the whole request, a little longer, so a stalled connection still ends in a message.
const REQUEST_TIMEOUT_MS = 20_000;

const TOO_SLOW = "The data took too long to arrive. Try again in a moment.";

async function fetchJson(
	url: string,
	signal: AbortSignal,
): Promise<{ response: Response; body: unknown }> {
	// One controller ends the request for either reason: the caller cancelled, or the time
	// ran out. It is built by hand because AbortSignal.any is missing from browsers older
	// than early 2024 (Safari before 17.4), and the sample fields must work there too.
	const request = new AbortController();
	let timedOut = false;
	const cancel = () => request.abort();
	if (signal.aborted) cancel();
	else signal.addEventListener("abort", cancel, { once: true });
	const timer = setTimeout(() => {
		timedOut = true;
		request.abort();
	}, REQUEST_TIMEOUT_MS);

	try {
		let response: Response;
		try {
			response = await fetch(url, {
				signal: request.signal,
				headers: { Accept: "application/json" },
			});
		} catch (error) {
			// The caller cancelled because a newer selection replaced this one.
			if (signal.aborted) throw error;
			throw new Error(
				timedOut
					? TOO_SLOW
					: "The data could not be reached. Check your connection, then try again.",
			);
		}

		let body: unknown = null;
		try {
			body = await response.json();
		} catch (error) {
			if (signal.aborted) throw error;
			if (timedOut) throw new Error(TOO_SLOW);
			// Not JSON: an error page, for example. Handled by the caller from the status.
		}
		return { response, body };
	} finally {
		clearTimeout(timer);
		signal.removeEventListener("abort", cancel);
	}
}

/** Settles with the promise, or rejects as soon as the signal is aborted, whichever is first. */
export function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	if (signal.aborted) return Promise.reject(signal.reason ?? new Error("aborted"));
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(signal.reason ?? new Error("aborted"));
		signal.addEventListener("abort", onAbort, { once: true });
		promise.then(resolve, reject).finally(() => {
			signal.removeEventListener("abort", onAbort);
		});
	});
}

function errorMessageFrom(body: unknown): string | null {
	if (typeof body === "object" && body !== null && "error" in body) {
		const { error } = body;
		if (typeof error === "string" && error.trim() !== "") return error;
	}
	return null;
}

/** All three facts for a sample field, from its cached file. */
export async function loadSampleField(
	sample: SampleField,
	signal: AbortSignal,
): Promise<SampleFieldData> {
	const { response, body } = await fetchJson(sample.file, signal);
	if (!response.ok) {
		throw new Error(
			`The cached data for ${sample.name} could not be loaded (HTTP ${response.status}).`,
		);
	}
	const file = typeof body === "object" && body !== null ? body : {};
	const climate = "climate" in file ? file.climate : null;
	const history = "history" in file ? file.history : null;
	const soil = "soil" in file ? file.soil : null;
	if (
		!isClimateResponse(climate) ||
		!isHistoryResponse(history) ||
		!isSoilResponse(soil)
	) {
		throw new Error(
			`The cached data for ${sample.name} arrived in a form this page could not read.`,
		);
	}
	return { climate, history, soil };
}

async function loadFromRoute<T>(
	path: string,
	point: { lat: number; lon: number },
	isExpected: (body: unknown) => body is T,
	what: string,
	signal: AbortSignal,
): Promise<Loaded<T>> {
	const query = new URLSearchParams({
		lat: String(point.lat),
		lon: String(point.lon),
	});
	const { response, body } = await fetchJson(`${path}?${query}`, signal);

	if (!response.ok) {
		throw new Error(
			errorMessageFrom(body) ??
				`The ${what} service answered with an error (HTTP ${response.status}). Try again in a moment.`,
		);
	}
	if (!isExpected(body)) {
		throw new Error(`The ${what} arrived in a form this page could not read.`);
	}
	const fromCache =
		response.headers.get("X-Field-Shift-Data") === "cached-sample";
	return { data: body, origin: fromCache ? "sample-fallback" : "live" };
}

/** Climate history for any Kansas point, through /api/climate. */
export function loadClimate(
	lat: number,
	lon: number,
	signal: AbortSignal,
): Promise<Loaded<ClimateResponse>> {
	return loadFromRoute(
		"/api/climate",
		climatePoint(lat, lon),
		isClimateResponse,
		"climate history",
		signal,
	);
}

/** The last 8 years of crops at any Kansas point, through /api/history. */
export function loadHistory(
	lat: number,
	lon: number,
	signal: AbortSignal,
): Promise<Loaded<HistoryResponse>> {
	return loadFromRoute(
		"/api/history",
		fieldPoint(lat, lon),
		isHistoryResponse,
		"crop history",
		signal,
	);
}

/**
 * The soil moisture record of the county a point is in, from the files built in advance
 * (public/data/counties.geojson and public/data/counties/{fips}.json). Static files, so no
 * route and no live service: the county outlines are fetched once and shared.
 */
export async function loadMoisture(
	lat: number,
	lon: number,
	signal: AbortSignal,
): Promise<Loaded<MoistureResult>> {
	// The outlines are shared by every selection, so their request is not tied to this
	// selection's signal: a first click cancelled by a second must not fail the second. Each
	// caller waits for the shared promise only as long as its own signal allows.
	const shared = loadCounties(async (url) => {
		const { response, body } = await fetchJson(url, new AbortController().signal);
		if (!response.ok) {
			throw new Error(`The county outlines could not be loaded (HTTP ${response.status}).`);
		}
		return body;
	});
	const counties = await untilAborted(shared, signal);
	const county = countyAt(lat, lon, counties);
	if (!county) return { data: { kind: "no-county" }, origin: "prepared" };

	const { response, body } = await fetchJson(`/data/counties/${county.fips}.json`, signal);
	if (response.status === 404) {
		return { data: { kind: "no-record", county }, origin: "prepared" };
	}
	if (!response.ok) {
		throw new Error(
			`The soil moisture record for ${county.name} could not be loaded (HTTP ${response.status}).`,
		);
	}
	if (!isCountyMoisture(body)) {
		throw new Error(
			`The soil moisture record for ${county.name} arrived in a form this page could not read.`,
		);
	}
	return { data: { kind: "county", county, data: body }, origin: "prepared" };
}

/** Soil facts at any Kansas point, through /api/soil. */
export function loadSoil(
	lat: number,
	lon: number,
	signal: AbortSignal,
): Promise<Loaded<SoilResponse>> {
	return loadFromRoute(
		"/api/soil",
		fieldPoint(lat, lon),
		isSoilResponse,
		"soil facts",
		signal,
	);
}
