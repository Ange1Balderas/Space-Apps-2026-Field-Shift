// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// GET /api/climate?lat=&lon=
// Climate history for one Kansas point from NASA POWER, 1981 to the last full year, in the
// ClimateResponse shape (lib/types.ts). lib/climate.ts lists which fields Phase 1 fills.
//
// CLAUDE.md rule 4, applied here:
//   - the browser never calls POWER; it calls this route
//   - 15-second timeout on the POWER request (lib/power.ts)
//   - two caches: memory on the server instance, and the CDN through Cache-Control
//   - on failure: the cached sample when the point is a sample field, else a clear error
//
// Answers: 200 with a ClimateResponse, or { "error": "plain-language message" } with
// 400 (bad or out-of-state point), 404 (mock mode has no data for the point),
// 502 (POWER failed) or 504 (POWER timed out).
// The X-Field-Shift-Data header says where a 200 came from: "live" or "cached-sample".

import type { NextRequest } from "next/server";
import { buildClimateResponse, climatePoint } from "@/lib/climate";
import { isMockMode } from "@/lib/data-mode";
import { isInKansasBounds } from "@/lib/kansas";
import { createMemoryCache } from "@/lib/memory-cache";
import {
	fetchPowerDaily,
	lastFullYear,
	POWER_FIRST_YEAR,
	PowerError,
} from "@/lib/power";
import { cachedClimateFor } from "@/lib/sample-data";
import type { ClimateResponse } from "@/lib/types";

// Seconds the platform lets this function run. It must be longer than the 15-second POWER timeout.
export const maxDuration = 30;

// The record for past years does not change from day to day, so a day is a safe lifetime.
// The key includes the last full year, so the series grows by itself each January.
const DAY_MS = 24 * 60 * 60 * 1000;
const climateCache = createMemoryCache<ClimateResponse>({
	ttlMs: DAY_MS,
	maxEntries: 200,
});

// Browsers keep a live answer for 5 minutes. The CDN keeps it for a day, and may serve it for
// up to a week more while it fetches a fresh copy in the background.
const LIVE_CACHE_CONTROL =
	"public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

function parseCoordinate(raw: string | null): number | null {
	if (raw === null || raw.trim() === "") return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

function errorResponse(status: number, message: string): Response {
	return Response.json(
		{ error: message },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}

function dataResponse(
	climate: ClimateResponse,
	origin: "live" | "cached-sample",
): Response {
	return Response.json(climate, {
		headers: {
			// Only a live answer is cached downstream. A fallback must not hide POWER's recovery.
			"Cache-Control": origin === "live" ? LIVE_CACHE_CONTROL : "no-store",
			"X-Field-Shift-Data": origin,
		},
	});
}

export async function GET(request: NextRequest): Promise<Response> {
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

	const point = climatePoint(lat, lon);
	const sample = cachedClimateFor(point.lat, point.lon);

	if (isMockMode()) {
		return sample
			? dataResponse(sample, "cached-sample")
			: errorResponse(
					404,
					"Mock mode only has cached data for the sample fields. Pick the sample field, or start the app with npm run dev for live data.",
				);
	}

	const endYear = lastFullYear(new Date());
	try {
		const climate = await climateCache.get(
			`${point.lat},${point.lon},${endYear}`,
			async () => {
				const { elevationM, days } = await fetchPowerDaily(
					point,
					POWER_FIRST_YEAR,
					endYear,
				);
				return buildClimateResponse({
					...point,
					elevationM,
					days,
					fetchedAt: new Date().toISOString(),
				});
			},
		);
		return dataResponse(climate, "live");
	} catch (error) {
		console.error("[api/climate] NASA POWER request failed:", error);
		if (sample) return dataResponse(sample, "cached-sample");
		if (error instanceof PowerError) {
			return errorResponse(
				error.kind === "timeout" ? 504 : 502,
				`${error.message} Try again in a moment.`,
			);
		}
		return errorResponse(
			502,
			"The climate history could not be prepared. Try again in a moment.",
		);
	}
}
