// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Yearly climate indicators from daily weather. Everything here is metric, the units
// NASA POWER reports. Conversion to inches and °F happens in lib/climate.ts.

import scoring from "@/config/scoring.json";
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
	// The four inputs below are only used for reference ET (lib/et.ts). They are optional so
	// that a year's completeness, and with it every yearly series and trend, still depends on
	// temperature and rain alone.
	/** Sunlight reaching the surface, MJ per m² per day (POWER `ALLSKY_SFC_SW_DWN`, AG community). */
	solarMj?: number | null;
	/** Dew point at 2 m, °C (POWER `T2MDEW`). */
	dewC?: number | null;
	/** Relative humidity at 2 m, % (POWER `RH2M`). */
	rhPct?: number | null;
	/** Wind speed at 2 m, m/s (POWER `WS2M`). */
	windMs?: number | null;
};

/** One calendar year of indicators, metric. */
export type YearIndicators = {
	year: number;
	hotDays: number;
	seasonRainMm: number;
	meanTempC: number;
	/** Day of the year (1 is 1 January) of the last freeze from January to June, or null if none. */
	lastSpringFreezeDoy: number | null;
	/** Day of the year of the first freeze from July to December, or null if none. */
	firstFallFreezeDoy: number | null;
};

/** One calendar month of one year, metric. */
export type MonthIndicators = {
	year: number;
	month: number;
	rainMm: number;
	hotDays: number;
	meanTmaxC: number;
	meanTminC: number;
	/** Reference ET for the month, mm, or null when any of its days has none. */
	et0Mm: number | null;
};

/** The long-term average for one calendar month, metric. */
export type MonthNormal = {
	month: number;
	rainMm: number;
	meanTmaxC: number;
	meanTminC: number;
	/** Average reference ET over the months that have one, mm, or null when none does. */
	et0Mm: number | null;
};

/** A run of whole months inside one calendar year, both ends included. January is 1. */
export type Season = { firstMonth: number; lastMonth: number };

// Hot day threshold. SPEC.md, "Contracts and formulas" > "Thresholds": "Hot day: daily max at
// or above 95°F. Common crop heat stress threshold; configurable." It is a tool setting, read
// from config/scoring.json (hotDayF) so that it is listed with the other tool assumptions.
export const HOT_DAY_F: number = scoring.hotDayF;

// TOOL ASSUMPTION, not a published fact. SPEC.md asks for "growing season rain", and no public
// source defines the months for Kansas. Angel chose April through September on 2026-11-14
// (SPEC.md, "Decisions made on 2026-11-14"). The months are read from config/scoring.json
// (growingSeasonMonths) so that they are listed with the other tool assumptions. The chart
// of this indicator arrives in Phase 4.
export const GROWING_SEASON: Season = {
	firstMonth: scoring.growingSeasonMonths[0],
	lastMonth: scoring.growingSeasonMonths[1],
};

// Freeze threshold. SPEC.md, "Thresholds": "Freeze day: daily min at or below 32°F".
// The 32°F figure is the threshold in the National Weather Service's definition of a freeze:
// "when the surface air temperature is expected to be 32°F or below over a widespread area
// for a climatologically significant period of time" (glossary, opened 2026-11-14).
// https://forecast.weather.gov/glossary.php?word=freeze
// This tool's rule is simpler than that definition: one day whose minimum, in NASA POWER's
// grid cell, is at or below 32°F counts as a freeze day.
export const FREEZE_F = 32;

// SPEC.md, "Thresholds": the last spring freeze is the last freeze day from January to June,
// and the first fall freeze is the first freeze day from July to December.
const LAST_SPRING_MONTH = 6;

export function yearOf(date: string): number {
	return Number(date.slice(0, 4));
}

/** Day of the year for a YYYYMMDD date: 1 for 1 January, 365 or 366 for 31 December. */
export function dayOfYear(date: string): number {
	const year = yearOf(date);
	const month = monthOf(date);
	const day = Number(date.slice(6, 8));
	return (
		Math.round(
			(Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000,
		) + 1
	);
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

function isFreeze(day: DailyWeather, thresholdC: number): boolean {
	return day.tminC !== null && day.tminC <= thresholdC;
}

/**
 * Day of the year of the last freeze from January to June among the given days, or null
 * when none of them is a freeze. Pass one calendar year of days.
 */
export function lastSpringFreezeDoy(
	days: readonly DailyWeather[],
	thresholdF: number = FREEZE_F,
): number | null {
	const thresholdC = fToC(thresholdF);
	let last: number | null = null;
	for (const day of days) {
		if (monthOf(day.date) > LAST_SPRING_MONTH || !isFreeze(day, thresholdC)) {
			continue;
		}
		const doy = dayOfYear(day.date);
		if (last === null || doy > last) last = doy;
	}
	return last;
}

/**
 * Day of the year of the first freeze from July to December among the given days, or null
 * when none of them is a freeze. Pass one calendar year of days.
 */
export function firstFallFreezeDoy(
	days: readonly DailyWeather[],
	thresholdF: number = FREEZE_F,
): number | null {
	const thresholdC = fToC(thresholdF);
	let first: number | null = null;
	for (const day of days) {
		if (monthOf(day.date) <= LAST_SPRING_MONTH || !isFreeze(day, thresholdC)) {
			continue;
		}
		const doy = dayOfYear(day.date);
		if (first === null || doy < first) first = doy;
	}
	return first;
}

/** Days in a calendar month, with leap years. */
export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Rain, hot days and mean daily high and low for each calendar month, in date order.
 * Like a year, a month is used only when every one of its days has all three values.
 * `et0Mm` gives a day's reference ET (lib/et.ts); a month's total is null unless every one
 * of its days has one.
 */
export function summarizeMonths(
	days: readonly DailyWeather[],
	options: {
		hotDayF?: number;
		et0Mm?: (day: DailyWeather) => number | null;
	} = {},
): MonthIndicators[] {
	const byMonth = new Map<string, DailyWeather[]>();
	for (const day of days) {
		const key = day.date.slice(0, 6);
		const list = byMonth.get(key);
		if (list) list.push(day);
		else byMonth.set(key, [day]);
	}

	const months: MonthIndicators[] = [];
	for (const key of [...byMonth.keys()].sort()) {
		const monthDays = byMonth.get(key) ?? [];
		const year = Number(key.slice(0, 4));
		const month = Number(key.slice(4, 6));
		const complete = monthDays.filter(
			(day) => day.tmaxC !== null && day.tminC !== null && day.rainMm !== null,
		);
		if (complete.length !== daysInMonth(year, month)) continue;
		const sum = (pick: (day: DailyWeather) => number | null) =>
			complete.reduce((total, day) => total + (pick(day) ?? 0), 0);
		let et0Mm: number | null = options.et0Mm ? 0 : null;
		if (options.et0Mm) {
			for (const day of complete) {
				const value = options.et0Mm(day);
				if (value === null || et0Mm === null) {
					et0Mm = null;
					break;
				}
				et0Mm += value;
			}
		}
		months.push({
			year,
			month,
			rainMm: sum((day) => day.rainMm),
			hotDays: countHotDays(complete, options.hotDayF),
			meanTmaxC: sum((day) => day.tmaxC) / complete.length,
			meanTminC: sum((day) => day.tminC) / complete.length,
			et0Mm,
		});
	}
	return months;
}

/**
 * The average of each calendar month across the years given: the monthly climatology.
 * A calendar month with no complete month in the record is left out.
 */
export function monthlyNormals(
	months: readonly MonthIndicators[],
): MonthNormal[] {
	const normals: MonthNormal[] = [];
	for (let month = 1; month <= 12; month += 1) {
		const rows = months.filter((row) => row.month === month);
		if (rows.length === 0) continue;
		const mean = (pick: (row: MonthIndicators) => number) =>
			rows.reduce((total, row) => total + pick(row), 0) / rows.length;
		const et0 = rows.flatMap((row) => (row.et0Mm === null ? [] : [row.et0Mm]));
		normals.push({
			month,
			rainMm: mean((row) => row.rainMm),
			meanTmaxC: mean((row) => row.meanTmaxC),
			meanTminC: mean((row) => row.meanTminC),
			et0Mm:
				et0.length === 0
					? null
					: et0.reduce((total, value) => total + value, 0) / et0.length,
		});
	}
	return normals;
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
			lastSpringFreezeDoy: lastSpringFreezeDoy(yearDays),
			firstFallFreezeDoy: firstFallFreezeDoy(yearDays),
		});
	}
	return { years, incompleteYears };
}
