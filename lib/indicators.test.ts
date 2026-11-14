// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Every expected value below is worked by hand from the definitions in lib/indicators.ts.
// No number here describes real weather.

import { describe, expect, it } from "vitest";
import {
	countHotDays,
	type DailyWeather,
	daysInYear,
	meanTempC,
	monthOf,
	sumSeasonRainMm,
	summarizeYears,
	yearOf,
} from "@/lib/indicators";
import { makeYear } from "@/lib/test-fixtures";

const day = (
	date: string,
	tmaxC: number | null,
	tminC: number | null = 10,
	rainMm: number | null = 0,
): DailyWeather => ({ date, tmaxC, tminC, rainMm });

describe("date helpers", () => {
	it("reads the year and month from a YYYYMMDD key", () => {
		expect(yearOf("19840909")).toBe(1984);
		expect(monthOf("19840909")).toBe(9);
	});

	it("knows leap years, including the century rule", () => {
		expect(daysInYear(1900)).toBe(365);
		expect(daysInYear(2000)).toBe(366);
		expect(daysInYear(2024)).toBe(366);
		expect(daysInYear(2025)).toBe(365);
	});
});

describe("countHotDays", () => {
	it("counts a day at exactly 95°F (35°C) and skips one just under", () => {
		const days = [
			day("20250701", 35),
			day("20250702", 34.99),
			day("20250703", 41.2),
			day("20250704", 20),
		];
		expect(countHotDays(days)).toBe(2);
	});

	it("does not count a day with no maximum temperature", () => {
		expect(countHotDays([day("20250701", null), day("20250702", 36)])).toBe(1);
	});

	it("accepts another threshold in °F", () => {
		// 100°F is 37.78°C.
		const days = [day("20250701", 37.7), day("20250702", 37.8)];
		expect(countHotDays(days, 100)).toBe(1);
	});
});

describe("sumSeasonRainMm", () => {
	it("adds April through September only", () => {
		// One millimetre every day: April to September has 30 + 31 + 30 + 31 + 31 + 30 = 183 days.
		const days = makeYear(2025, { tmaxC: 20, tminC: 10, rainMm: 1 });
		expect(sumSeasonRainMm(days)).toBe(183);
	});

	it("accepts another season", () => {
		// May to July has 31 + 30 + 31 = 92 days.
		const days = makeYear(2025, { tmaxC: 20, tminC: 10, rainMm: 1 });
		expect(sumSeasonRainMm(days, { firstMonth: 5, lastMonth: 7 })).toBe(92);
	});

	it("rejects a season that is not whole months inside one year", () => {
		const days = makeYear(2025, { tmaxC: 20, tminC: 10, rainMm: 1 });
		expect(() => sumSeasonRainMm(days, { firstMonth: 10, lastMonth: 3 })).toThrow(
			RangeError,
		);
		expect(() => sumSeasonRainMm(days, { firstMonth: 0, lastMonth: 5 })).toThrow(
			RangeError,
		);
	});
});

describe("meanTempC", () => {
	it("averages the midpoint of each day's maximum and minimum", () => {
		// Midpoints 15 and 25 average to 20.
		expect(meanTempC([day("20250101", 20, 10), day("20250102", 30, 20)])).toBe(20);
	});

	it("leaves out days missing either value, and returns NaN with nothing to average", () => {
		expect(meanTempC([day("20250101", 20, 10), day("20250102", 30, null)])).toBe(15);
		expect(meanTempC([day("20250101", null, 10)])).toBeNaN();
	});
});

describe("summarizeYears", () => {
	it("computes one row per complete year, in year order", () => {
		const days = [
			...makeYear(2025, { tmaxC: 30, tminC: 10, rainMm: 2 }),
			// 2024 is a leap year. Two July days reach the threshold.
			...makeYear(
				2024,
				{ tmaxC: 20, tminC: 0, rainMm: 1 },
				{ "20240704": { tmaxC: 35 }, "20240705": { tmaxC: 38.5 } },
			),
		];
		const { years, incompleteYears } = summarizeYears(days);
		expect(incompleteYears).toEqual([]);
		expect(years.map((row) => row.year)).toEqual([2024, 2025]);

		expect(years[0].hotDays).toBe(2);
		expect(years[0].seasonRainMm).toBe(183);
		// 364 days with a midpoint of 10, one of 17.5 and one of 19.25, over 366 days.
		expect(years[0].meanTempC).toBeCloseTo((364 * 10 + 17.5 + 19.25) / 366, 10);

		expect(years[1]).toEqual({
			year: 2025,
			hotDays: 0,
			seasonRainMm: 366,
			meanTempC: 20,
		});
	});

	it("sets aside a year with a missing value instead of counting part of it", () => {
		const days = [
			...makeYear(2023, { tmaxC: 36, tminC: 20, rainMm: 0 }),
			...makeYear(
				2024,
				{ tmaxC: 36, tminC: 20, rainMm: 0 },
				{ "20241231": { rainMm: null } },
			),
		];
		const { years, incompleteYears } = summarizeYears(days);
		expect(years.map((row) => row.year)).toEqual([2023]);
		expect(years[0].hotDays).toBe(365);
		expect(incompleteYears).toEqual([2024]);
	});

	it("sets aside a year that stops early", () => {
		const partYear = makeYear(2026, { tmaxC: 36, tminC: 20, rainMm: 0 }).slice(
			0,
			200,
		);
		const { years, incompleteYears } = summarizeYears(partYear);
		expect(years).toEqual([]);
		expect(incompleteYears).toEqual([2026]);
	});

	it("passes the threshold and season through", () => {
		const days = makeYear(2025, { tmaxC: 33, tminC: 10, rainMm: 1 });
		const { years } = summarizeYears(days, {
			hotDayF: 90,
			season: { firstMonth: 6, lastMonth: 8 },
		});
		// 33°C is 91.4°F, above a 90°F threshold on all 365 days. June to August has 92 days.
		expect(years[0].hotDays).toBe(365);
		expect(years[0].seasonRainMm).toBe(92);
	});
});
