// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// GET /api/history?lat=&lon=
// The last 8 years of crops at one Kansas point, from the USDA NASS Cropland Data Layer, in
// the HistoryResponse shape (lib/types.ts). lib/cropland.ts says which USDA service is used
// and why. lib/api-route.ts describes the checks, caching, fallback and error answers.

import type { NextRequest } from "next/server";
import { answerForPoint, ONE_DAY_MS } from "@/lib/api-route";
import { fetchCropHistory } from "@/lib/cropland";
import { fieldPoint } from "@/lib/kansas";
import { createMemoryCache } from "@/lib/memory-cache";
import { cachedHistoryFor } from "@/lib/sample-data";
import type { HistoryResponse } from "@/lib/types";

// Seconds the platform lets this function run. It must be longer than the 15-second timeout.
export const maxDuration = 30;

// A new CDL year is published about once a year, so a day is a safe lifetime.
const historyCache = createMemoryCache<HistoryResponse>({
	ttlMs: ONE_DAY_MS,
	maxEntries: 500,
});

export function GET(request: NextRequest): Promise<Response> {
	return answerForPoint(request, {
		name: "api/history",
		round: fieldPoint,
		sample: (point) => cachedHistoryFor(point.lat, point.lon),
		load: (point) =>
			historyCache.get(`${point.lat},${point.lon}`, () =>
				fetchCropHistory(point),
			),
		failMessage: "The crop history could not be prepared.",
	});
}
