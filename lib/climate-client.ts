// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Browser-side loading of climate history. A sample field reads its cached file from
// public/data/samples/, so it never depends on a live service. Any other point goes through
// /api/climate. Every failure becomes an Error with a plain-language message for the panel.

import { climatePoint, isClimateResponse } from "@/lib/climate";
import type { SampleField } from "@/lib/samples";
import type { ClimateResponse } from "@/lib/types";

/**
 * Where the numbers on screen came from:
 * "live" from NASA POWER just now, "sample" from a sample field's cached file, or
 * "sample-fallback" when POWER failed and the route answered with the cached sample.
 */
export type ClimateOrigin = "live" | "sample" | "sample-fallback";

export type LoadedClimate = { climate: ClimateResponse; origin: ClimateOrigin };

// The route gives up on NASA POWER after 15 seconds. This is the browser's own limit on the
// whole request, a little longer, so a stalled connection still ends in a message.
const REQUEST_TIMEOUT_MS = 20_000;

const UNREADABLE = "The climate data arrived in a form this page could not read.";

async function fetchJson(
	url: string,
	signal: AbortSignal,
): Promise<{ response: Response; body: unknown }> {
	let response: Response;
	try {
		response = await fetch(url, {
			signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
			headers: { Accept: "application/json" },
		});
	} catch (error) {
		// The caller cancelled because a newer selection replaced this one.
		if (signal.aborted) throw error;
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		throw new Error(
			timedOut
				? "The climate data took too long to arrive. Try again in a moment."
				: "The climate data could not be reached. Check your connection, then try again.",
		);
	}

	let body: unknown = null;
	try {
		body = await response.json();
	} catch (error) {
		if (signal.aborted) throw error;
		// Not JSON: an error page, for example. Handled below from the status.
	}
	return { response, body };
}

function errorMessageFrom(body: unknown): string | null {
	if (typeof body === "object" && body !== null && "error" in body) {
		const { error } = body;
		if (typeof error === "string" && error.trim() !== "") return error;
	}
	return null;
}

/** Climate history for a sample field, from its cached file. */
export async function loadSampleClimate(
	sample: SampleField,
	signal: AbortSignal,
): Promise<LoadedClimate> {
	const { response, body } = await fetchJson(sample.file, signal);
	if (!response.ok) {
		throw new Error(
			`The cached data for ${sample.name} could not be loaded (HTTP ${response.status}).`,
		);
	}
	const climate =
		typeof body === "object" && body !== null && "climate" in body
			? body.climate
			: null;
	if (!isClimateResponse(climate)) throw new Error(UNREADABLE);
	return { climate, origin: "sample" };
}

/** Climate history for any Kansas point, through /api/climate. */
export async function loadPointClimate(
	lat: number,
	lon: number,
	signal: AbortSignal,
): Promise<LoadedClimate> {
	const point = climatePoint(lat, lon);
	const query = new URLSearchParams({
		lat: String(point.lat),
		lon: String(point.lon),
	});
	const { response, body } = await fetchJson(`/api/climate?${query}`, signal);

	if (!response.ok) {
		throw new Error(
			errorMessageFrom(body) ??
				`The climate service answered with an error (HTTP ${response.status}). Try again in a moment.`,
		);
	}
	if (!isClimateResponse(body)) throw new Error(UNREADABLE);

	const fromCache = response.headers.get("X-Field-Shift-Data") === "cached-sample";
	return { climate: body, origin: fromCache ? "sample-fallback" : "live" };
}
