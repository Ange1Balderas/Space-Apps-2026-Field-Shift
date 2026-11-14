// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// GET /api/soil?lat=&lon=
// Soil at one Kansas point from USDA NRCS SSURGO, through Soil Data Access, in the
// SoilResponse shape (lib/types.ts). lib/soil.ts holds the query and the meaning of each
// column. lib/api-route.ts describes the checks, caching, fallback and error answers.

import type { NextRequest } from "next/server";
import { answerForPoint, ONE_DAY_MS } from "@/lib/api-route";
import { fieldPoint } from "@/lib/kansas";
import { createMemoryCache } from "@/lib/memory-cache";
import { cachedSoilFor } from "@/lib/sample-data";
import { fetchSoil } from "@/lib/soil";
import type { SoilResponse } from "@/lib/types";

// Seconds the platform lets this function run. It must be longer than the 15-second timeout.
export const maxDuration = 30;

// Soil survey data is refreshed about once a year, so a day is a safe lifetime.
const soilCache = createMemoryCache<SoilResponse>({
	ttlMs: ONE_DAY_MS,
	maxEntries: 500,
});

export function GET(request: NextRequest): Promise<Response> {
	return answerForPoint(request, {
		name: "api/soil",
		round: fieldPoint,
		sample: (point) => cachedSoilFor(point.lat, point.lon),
		load: (point) =>
			soilCache.get(`${point.lat},${point.lon}`, () => fetchSoil(point)),
		failMessage: "The soil facts could not be prepared.",
	});
}
