// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// GET /api/climate?lat=&lon=
// Climate history for one Kansas point from NASA POWER, 1981 to the last full year, in the
// ClimateResponse shape (lib/types.ts). lib/climate.ts lists which fields are filled.
// lib/api-route.ts describes the checks, caching, fallback and error answers.

import type { NextRequest } from "next/server";
import { answerForPoint, ONE_DAY_MS } from "@/lib/api-route";
import { buildClimateResponse, climatePoint } from "@/lib/climate";
import { createMemoryCache } from "@/lib/memory-cache";
import { fetchPowerDaily, lastFullYear, POWER_FIRST_YEAR } from "@/lib/power";
import { cachedClimateFor } from "@/lib/sample-data";
import type { ClimateResponse } from "@/lib/types";

// Seconds the platform lets this function run. It must be longer than the 15-second POWER timeout.
export const maxDuration = 30;

// The record for past years does not change from day to day, so a day is a safe lifetime.
// The key includes the last full year, so the series grows by itself each January.
const climateCache = createMemoryCache<ClimateResponse>({
	ttlMs: ONE_DAY_MS,
	maxEntries: 200,
});

export function GET(request: NextRequest): Promise<Response> {
	return answerForPoint(request, {
		name: "api/climate",
		round: climatePoint,
		sample: (point) => cachedClimateFor(point.lat, point.lon),
		load: (point) => {
			const endYear = lastFullYear(new Date());
			return climateCache.get(
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
		},
		failMessage: "The climate history could not be prepared.",
	});
}
