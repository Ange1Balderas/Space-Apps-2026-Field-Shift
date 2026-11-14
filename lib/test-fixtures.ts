// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Made-up weather for the unit tests. Nothing here describes a real place, and no app code
// imports this file.

import { type DailyWeather, daysInYear } from "@/lib/indicators";

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Every day of one calendar year, with the same weather each day unless `overrides` says otherwise. */
export function makeYear(
	year: number,
	daily: Omit<DailyWeather, "date">,
	overrides: Record<string, Partial<DailyWeather>> = {},
): DailyWeather[] {
	const days: DailyWeather[] = [];
	for (let month = 1; month <= 12; month += 1) {
		const length =
			month === 2 && daysInYear(year) === 366 ? 29 : DAYS_IN_MONTH[month - 1];
		for (let day = 1; day <= length; day += 1) {
			const date = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
			days.push({ date, ...daily, ...overrides[date] });
		}
	}
	return days;
}

/**
 * Whole years of weather in which year number k (counting from zero) has k hot days in July
 * and k millimetres of rain on every day, so each yearly series rises steadily.
 */
export function makeRisingYears(
	firstYear: number,
	count: number,
): DailyWeather[] {
	const days: DailyWeather[] = [];
	for (let k = 0; k < count; k += 1) {
		const year = firstYear + k;
		const overrides: Record<string, Partial<DailyWeather>> = {};
		for (let day = 1; day <= k; day += 1) {
			overrides[`${year}07${String(day).padStart(2, "0")}`] = { tmaxC: 36 };
		}
		days.push(
			...makeYear(year, { tmaxC: 20, tminC: 10, rainMm: k }, overrides),
		);
	}
	return days;
}

/** The same days in the JSON shape the NASA POWER daily point API answers with. */
export function toPowerBody(
	days: readonly DailyWeather[],
	elevationM = 500,
): unknown {
	const fill = -999;
	const column = (pick: (day: DailyWeather) => number | null) =>
		Object.fromEntries(days.map((day) => [day.date, pick(day) ?? fill]));
	return {
		type: "Feature",
		geometry: { type: "Point", coordinates: [-98, 38, elevationM] },
		properties: {
			parameter: {
				T2M_MAX: column((day) => day.tmaxC),
				T2M_MIN: column((day) => day.tminC),
				PRECTOTCORR: column((day) => day.rainMm),
				ALLSKY_SFC_SW_DWN: column((day) => day.solarMj ?? null),
				T2MDEW: column((day) => day.dewC ?? null),
				RH2M: column((day) => day.rhPct ?? null),
				WS2M: column((day) => day.windMs ?? null),
			},
		},
		header: { fill_value: fill },
	};
}
