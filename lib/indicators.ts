// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Yearly climate indicators from daily weather. Everything here is metric, the units
// NASA POWER reports. Conversion to inches and °F happens in lib/climate.ts.

import { fToC } from "@/lib/units";

/** One day of weather. `null` marks a value NASA POWER could not supply. */
export type DailyWeather = {
	/** Calendar date as YYYYMMDD, the key NASA POWER uses. */
	date: string;
	/** Daily maximum air temperature at 2 m, °C (POWER `T2M_MAX`). */
	tmaxC: number | null;
	/** Daily minimum air temperature at 2 m, °C (POWER `T2M_MIN`). */
	tminC: number | null;
	/** Daily precipitation, mm (POWER `PRECTOTCORR`). */
	rainMm: number | null;
};

/** One calendar year of indicators, metric. */
export type YearIndicators = {
	year: number;
	hotDays: number;
	seasonRainMm: number;
	meanTempC: number;
};

/** A run of whole months inside one calendar year, both ends included. January is 1. */
export type Season = { firstMonth: number; lastMonth: number };

// Hot day threshold. SPEC.md, "Contracts and formulas" > "Thresholds": "Hot day: daily max at
// or above 95°F. Common crop heat stress threshold; configurable." It is a tool setting, and
// it moves to config/scoring.json (ScoringConfig.hotDayF) when Phase 3 creates that file.
export const HOT_DAY_F = 95;

// TOOL ASSUMPTION, not a published fact. SPEC.md asks for "growing season rain" but does not
// say which months that covers, and no public source for a Kansas definition is stored yet.
// April through September is the default until Angel confirms it. Because it is unconfirmed,
// the interface does not show this indicator in Phase 1; it only travels in the API response.
export const GROWING_SEASON: Season = { firstMonth: 4, lastMonth: 9 };

export function yearOf(date: string): number {
	return Number(date.slice(0, 4));
}

export function monthOf(date: string): number {
	return Number(date.slice(4, 6));
}

export function daysInYear(year: number): number {
	const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	return isLeap ? 366 : 365;
}

/** Days whose maximum temperature is at or above the threshold. Days with no maximum are not counted. */
export function countHotDays(
	days: readonly DailyWeather[],
	thresholdF: number = HOT_DAY_F,
): number {
	// 95°F converts to exactly 35°C, so "at or above" loses nothing to rounding.
	const thresholdC = fToC(thresholdF);
	let count = 0;
	for (const day of days) {
		if (day.tmaxC !== null && day.tmaxC >= thresholdC) count += 1;
	}
	return count;
}

/** Total precipitation, in mm, on days that fall inside the season's months. */
export function sumSeasonRainMm(
	days: readonly DailyWeather[],
	season: Season = GROWING_SEASON,
): number {
	const { firstMonth, lastMonth } = season;
	const isMonth = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12;
	if (!isMonth(firstMonth) || !isMonth(lastMonth) || firstMonth > lastMonth) {
		throw new RangeError(
			"A season runs from a first month to a later month in the same year (1 to 12).",
		);
	}
	let total = 0;
	for (const day of days) {
		const month = monthOf(day.date);
		if (day.rainMm !== null && month >= firstMonth && month <= lastMonth) {
			total += day.rainMm;
		}
	}
	return total;
}

/**
 * Mean temperature in °C, taking each day's mean as the midpoint of its maximum and
 * minimum. Days missing either value are left out. Returns NaN when no day qualifies.
 */
export function meanTempC(days: readonly DailyWeather[]): number {
	let total = 0;
	let count = 0;
	for (const day of days) {
		if (day.tmaxC !== null && day.tminC !== null) {
			total += (day.tmaxC + day.tminC) / 2;
			count += 1;
		}
	}
	return count === 0 ? Number.NaN : total / count;
}

/**
 * Groups daily records by calendar year and computes each year's indicators.
 *
 * A year is used only when every one of its days has a maximum, a minimum and a rainfall
 * value. A year with any gap is listed in `incompleteYears` instead, so a count of hot days
 * or a rain total is never quietly built from part of a year.
 */
export function summarizeYears(
	days: readonly DailyWeather[],
	options: { hotDayF?: number; season?: Season } = {},
): { years: YearIndicators[]; incompleteYears: number[] } {
	const byYear = new Map<number, DailyWeather[]>();
	for (const day of days) {
		const year = yearOf(day.date);
		const list = byYear.get(year);
		if (list) list.push(day);
		else byYear.set(year, [day]);
	}

	const years: YearIndicators[] = [];
	const incompleteYears: number[] = [];
	for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
		const yearDays = byYear.get(year) ?? [];
		const completeDays = yearDays.filter(
			(day) => day.tmaxC !== null && day.tminC !== null && day.rainMm !== null,
		).length;
		if (completeDays !== daysInYear(year)) {
			incompleteYears.push(year);
			continue;
		}
		years.push({
			year,
			hotDays: countHotDays(yearDays, options.hotDayF),
			seasonRainMm: sumSeasonRainMm(yearDays, options.season),
			meanTempC: meanTempC(yearDays),
		});
	}
	return { years, incompleteYears };
}
