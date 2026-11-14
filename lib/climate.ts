// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Builds the /api/climate answer (the ClimateResponse contract in lib/types.ts) from daily
// weather, and checks that a value read from JSON has that shape.
//
// What is filled, and what waits:
//   years[].hotDays, seasonRainIn, meanTempF     filled (Phase 1)
//   years[].lastSpringFreezeDoy, firstFallFreezeDoy   filled (Phase 2); null in a year
//                                                with no freeze in that half of the year
//   monthlyByYear, monthlyNormals                empty until Phase 3: every row needs
//                                                reference ET (`et0In`), which is not
//                                                nullable. The monthly rain and temperature
//                                                functions exist in lib/indicators.ts.
//   trends                                       one entry per yearly series with at
//                                                least 10 values
// Nothing is estimated to fill a gap.

import { type DailyWeather, summarizeYears } from "@/lib/indicators";
import { analyzeTrend } from "@/lib/trends";
import type { ClimateResponse } from "@/lib/types";
import { cToF, mmToIn, roundTo } from "@/lib/units";

/** The yearly series that get a trend. Each name is a field of `years[]`. */
export const TREND_SERIES = [
	"hotDays",
	"seasonRainIn",
	"meanTempF",
	"lastSpringFreezeDoy",
	"firstFallFreezeDoy",
] as const;

export function buildClimateResponse(input: {
	lat: number;
	lon: number;
	elevationM: number;
	days: readonly DailyWeather[];
	fetchedAt: string;
}): ClimateResponse {
	// Indicators are computed in metric and converted once, here, to the contract's units.
	const exactYears = summarizeYears(input.days).years.map((row) => ({
		year: row.year,
		hotDays: row.hotDays,
		seasonRainIn: mmToIn(row.seasonRainMm),
		meanTempF: cToF(row.meanTempC),
		lastSpringFreezeDoy: row.lastSpringFreezeDoy,
		firstFallFreezeDoy: row.firstFallFreezeDoy,
	}));

	// Trends use the unrounded values. Each slope is in the unit of its series per decade:
	// days, inches, °F, or days of the year for the freeze dates. A year with no value for a
	// series (no freeze that spring or fall) is left out of that series, with its real year
	// kept, so the slope is not distorted.
	const trends: ClimateResponse["trends"] = {};
	for (const series of TREND_SERIES) {
		const points: { year: number; value: number }[] = [];
		for (const row of exactYears) {
			const value = row[series];
			if (value !== null) points.push({ year: row.year, value });
		}
		const trend = analyzeTrend(
			points.map((point) => point.year),
			points.map((point) => point.value),
		);
		if (trend) {
			trends[series] = {
				perDecade: roundTo(trend.perDecade, 3),
				linearPerDecade: roundTo(trend.linearPerDecade, 3),
				pValue: roundTo(trend.pValue, 6),
				label: trend.label,
			};
		}
	}

	return {
		lat: input.lat,
		lon: input.lon,
		elevationM: input.elevationM,
		years: exactYears.map((row) => ({
			year: row.year,
			seasonRainIn: roundTo(row.seasonRainIn, 2),
			hotDays: row.hotDays,
			lastSpringFreezeDoy: row.lastSpringFreezeDoy,
			firstFallFreezeDoy: row.firstFallFreezeDoy,
			meanTempF: roundTo(row.meanTempF, 2),
		})),
		monthlyByYear: [],
		monthlyNormals: [],
		trends,
		source: "NASA POWER",
		fetchedAt: input.fetchedAt,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

/**
 * True when a value read from JSON carries everything the interface reads from a
 * ClimateResponse. Used on answers from /api/climate and on the cached sample files.
 */
export function isClimateResponse(value: unknown): value is ClimateResponse {
	if (!isRecord(value)) return false;
	if (value.source !== "NASA POWER" || typeof value.fetchedAt !== "string") {
		return false;
	}
	if (
		!isNumber(value.lat) ||
		!isNumber(value.lon) ||
		!isNumber(value.elevationM)
	) {
		return false;
	}
	if (
		!Array.isArray(value.years) ||
		!Array.isArray(value.monthlyByYear) ||
		!Array.isArray(value.monthlyNormals) ||
		!isRecord(value.trends)
	) {
		return false;
	}
	const yearsOk = value.years.every(
		(row) =>
			isRecord(row) &&
			isNumber(row.year) &&
			isNumber(row.hotDays) &&
			isNumber(row.seasonRainIn) &&
			isNumber(row.meanTempF),
	);
	const trendsOk = Object.values(value.trends).every(
		(trend) =>
			isRecord(trend) &&
			isNumber(trend.perDecade) &&
			isNumber(trend.linearPerDecade) &&
			isNumber(trend.pValue) &&
			(trend.label === "likely" ||
				trend.label === "possible" ||
				trend.label === "none"),
	);
	return yearsOk && trendsOk;
}

// NASA POWER serves one grid cell about half a degree across, so nearby points get the same
// answer. Requests are made at two decimal places (about 1 km), which keeps the cache key and
// the URL the same for clicks that land on the same spot.
export const CLIMATE_COORDINATE_DECIMALS = 2;

/** The point a climate request is made for: the given point at two decimal places. */
export function climatePoint(
	lat: number,
	lon: number,
): { lat: number; lon: number } {
	return {
		lat: roundTo(lat, CLIMATE_COORDINATE_DECIMALS),
		lon: roundTo(lon, CLIMATE_COORDINATE_DECIMALS),
	};
}
