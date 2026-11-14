// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// What the three data routes share (/api/climate, /api/history, /api/soil), so each one
// applies CLAUDE.md rule 4 the same way:
//   - the point is checked before anything is fetched
//   - mock mode serves cached samples only and never calls a live service
//   - a live answer is cached in memory and marked cacheable for the CDN
//   - on failure: the cached sample when the point is a sample field, else a clear error
//
// Answers: 200 with the data, or { "error": "plain-language message" } with
// 400 (bad or out-of-state point), 404 (nothing for this point), 502 (the service failed)
// or 504 (the service timed out).
// The X-Field-Shift-Data header says where a 200 came from: "live" or "cached-sample".

import type { NextRequest } from "next/server";
import { isMockMode } from "@/lib/data-mode";
import { isInKansasBounds } from "@/lib/kansas";
import { UpstreamError } from "@/lib/upstream";

// Browsers keep a live answer for 5 minutes. The CDN keeps it for a day, and may serve it for
// up to a week more while it fetches a fresh copy in the background.
export const LIVE_CACHE_CONTROL =
	"public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type DataOrigin = "live" | "cached-sample";

export function errorResponse(status: number, message: string): Response {
	return Response.json(
		{ error: message },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}

export function dataResponse(body: unknown, origin: DataOrigin): Response {
	return Response.json(body, {
		headers: {
			// Only a live answer is cached downstream. A fallback must not hide the service's recovery.
			"Cache-Control": origin === "live" ? LIVE_CACHE_CONTROL : "no-store",
			"X-Field-Shift-Data": origin,
		},
	});
}

function parseCoordinate(raw: string | null): number | null {
	if (raw === null || raw.trim() === "") return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

/**
 * Answers a GET for one Kansas point.
 *
 * `round` turns the requested point into the point the data is fetched and cached for.
 * `sample` returns the cached answer when that point is a sample field. `load` fetches the
 * live answer; it should cache its own result.
 */
export async function answerForPoint<T>(
	request: NextRequest,
	options: {
		/** Short name for the server log, for example "api/soil". */
		name: string;
		round: (lat: number, lon: number) => { lat: number; lon: number };
		sample: (point: { lat: number; lon: number }) => T | null;
		load: (point: { lat: number; lon: number }) => Promise<T>;
		/** Shown when the failure is not one the service layer explained. */
		failMessage: string;
	},
): Promise<Response> {
	const query = request.nextUrl.searchParams;
	const lat = parseCoordinate(query.get("lat"));
	const lon = parseCoordinate(query.get("lon"));

	if (lat === null || lon === null) {
		return errorResponse(
			400,
			"Give a latitude and a longitude as numbers, for example ?lat=38.05&lon=-100.74.",
		);
	}
	if (!isInKansasBounds(lat, lon)) {
		return errorResponse(
			400,
			"That point is outside Kansas. This tool covers Kansas only.",
		);
	}

	const point = options.round(lat, lon);
	const sample = options.sample(point);

	if (isMockMode()) {
		return sample
			? dataResponse(sample, "cached-sample")
			: errorResponse(
					404,
					"Mock mode only has cached data for the sample fields. Pick a sample field, or start the app with npm run dev for live data.",
				);
	}

	try {
		return dataResponse(await options.load(point), "live");
	} catch (error) {
		console.error(`[${options.name}] request failed:`, error);
		if (sample) return dataResponse(sample, "cached-sample");
		if (error instanceof UpstreamError) {
			if (error.kind === "no-data") return errorResponse(404, error.message);
			return errorResponse(
				error.kind === "timeout" ? 504 : 502,
				`${error.message} Try again in a moment.`,
			);
		}
		return errorResponse(502, `${options.failMessage} Try again in a moment.`);
	}
}
