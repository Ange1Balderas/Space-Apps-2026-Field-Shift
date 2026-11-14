// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Every expected value below is worked by hand from the definitions in lib/indicators.ts.
// No number here describes real weather.

import { describe, expect, it } from "vitest";
import {
	countHotDays,
	type DailyWeather,
	dayOfYear,
	daysInMonth,
	daysInYear,
	firstFallFreezeDoy,
	lastSpringFreezeDoy,
	meanTempC,
	monthlyNormals,
	monthOf,
	sumSeasonRainMm,
	summarizeMonths,
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

describe("freeze dates", () => {
	// Lows of 5°C all year, with freezes on 10 January, 12 April (exactly 0°C), 20 October
	// and 5 November 2025. Day numbers: 12 April is 31 + 28 + 31 + 12 = 102, and 20 October
	// is 273 + 20 = 293.
	const year = makeYear(
		2025,
		{ tmaxC: 20, tminC: 5, rainMm: 0 },
		{
			"20250110": { tminC: -2 },
			"20250412": { tminC: 0 },
			"20251020": { tminC: -1 },
			"20251105": { tminC: -3 },
		},
	);

	it("numbers the days of the year from 1, with leap years", () => {
		expect(dayOfYear("20250101")).toBe(1);
		expect(dayOfYear("20250412")).toBe(102);
		expect(dayOfYear("20251231")).toBe(365);
		// 2024 is a leap year: 1 March is day 61, and 31 December is day 366.
		expect(dayOfYear("20240301")).toBe(61);
		expect(dayOfYear("20241231")).toBe(366);
	});

	it("finds the last freeze from January to June, counting a low of exactly 32°F", () => {
		expect(lastSpringFreezeDoy(year)).toBe(102);
	});

	it("finds the first freeze from July to December", () => {
		expect(firstFallFreezeDoy(year)).toBe(293);
	});

	it("splits the year between June and July", () => {
		const edge = makeYear(
			2025,
			{ tmaxC: 20, tminC: 5, rainMm: 0 },
			{ "20250630": { tminC: -1 }, "20250701": { tminC: -1 } },
		);
		expect(lastSpringFreezeDoy(edge)).toBe(181);
		expect(firstFallFreezeDoy(edge)).toBe(182);
	});

	it("returns null when that half of the year has no freeze, or no low to judge by", () => {
		const mild = makeYear(2025, { tmaxC: 20, tminC: 5, rainMm: 0 });
		expect(lastSpringFreezeDoy(mild)).toBeNull();
		expect(firstFallFreezeDoy(mild)).toBeNull();
		const unknown = makeYear(2025, { tmaxC: 20, tminC: null, rainMm: 0 });
		expect(lastSpringFreezeDoy(unknown)).toBeNull();
	});

	it("accepts another threshold in °F", () => {
		// 28°F is -2.22°C, so only the -3°C day in November counts, and 10 January (-2°C) does not.
		expect(lastSpringFreezeDoy(year, 28)).toBeNull();
		expect(firstFallFreezeDoy(year, 28)).toBe(309);
	});

	it("is part of the summary of each year", () => {
		const { years } = summarizeYears(year);
		expect(years[0].lastSpringFreezeDoy).toBe(102);
		expect(years[0].firstFallFreezeDoy).toBe(293);
	});
});

describe("monthly climatology", () => {
	it("knows the length of each month, with leap years", () => {
		expect(daysInMonth(2025, 2)).toBe(28);
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2025, 12)).toBe(31);
	});

	it("totals rain and hot days and averages highs and lows for each month", () => {
		// 1 mm a day, highs of 30°C and lows of 10°C, with two hot days in July.
		const days = makeYear(
			2025,
			{ tmaxC: 30, tminC: 10, rainMm: 1 },
			{ "20250704": { tmaxC: 36 }, "20250705": { tmaxC: 36 } },
		);
		const months = summarizeMonths(days);
		expect(months).toHaveLength(12);
		expect(months[0]).toEqual({
			year: 2025,
			month: 1,
			rainMm: 31,
			hotDays: 0,
			meanTmaxC: 30,
			meanTminC: 10,
			et0Mm: null,
		});
		expect(months[1].rainMm).toBe(28);
		expect(months[6].hotDays).toBe(2);
		// Two days at 36°C among 31: (29 x 30 + 2 x 36) / 31.
		expect(months[6].meanTmaxC).toBeCloseTo((29 * 30 + 2 * 36) / 31, 10);
	});

	it("leaves out a month with a missing day", () => {
		const days = makeYear(
			2025,
			{ tmaxC: 30, tminC: 10, rainMm: 1 },
			{ "20250315": { rainMm: null } },
		);
		expect(summarizeMonths(days).map((row) => row.month)).toEqual([
			1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12,
		]);
	});

	it("averages each calendar month across years", () => {
		// January rain is 31 mm in the first year and 62 mm in the second: the normal is 46.5.
		const months = summarizeMonths([
			...makeYear(2024, { tmaxC: 20, tminC: 0, rainMm: 1 }),
			...makeYear(2025, { tmaxC: 30, tminC: 10, rainMm: 2 }),
		]);
		const normals = monthlyNormals(months);
		expect(normals).toHaveLength(12);
		expect(normals[0]).toEqual({
			month: 1,
			rainMm: 46.5,
			meanTmaxC: 25,
			meanTminC: 5,
			et0Mm: null,
		});
	});

	it("totals reference ET for a month only when every day has one", () => {
		const days = makeYear(2025, { tmaxC: 30, tminC: 10, rainMm: 1 });
		// 2 mm on every day, except that 15 March has none.
		const months = summarizeMonths(days, {
			et0Mm: (day) => (day.date === "20250315" ? null : 2),
		});
		expect(months[0].et0Mm).toBe(62);
		expect(months[1].et0Mm).toBe(56);
		expect(months[2].et0Mm).toBeNull();
	});

	it("averages reference ET over the months that have one", () => {
		// January has 31 mm in 2024, none in 2025 and 93 mm in 2026: the normal is 62 mm.
		const perDay: Record<string, number | null> = { "2024": 1, "2025": null, "2026": 3 };
		const months = summarizeMonths(
			[2024, 2025, 2026].flatMap((year) =>
				makeYear(year, { tmaxC: 30, tminC: 10, rainMm: 1 }),
			),
			{ et0Mm: (day) => perDay[day.date.slice(0, 4)] },
		);
		expect(monthlyNormals(months)[0].et0Mm).toBe(62);
		// With no reference ET at all, the normal has none either.
		const none = summarizeMonths(makeYear(2025, { tmaxC: 30, tminC: 10, rainMm: 1 }));
		expect(monthlyNormals(none)[0].et0Mm).toBeNull();
	});

	it("has no normal for a calendar month that never appears", () => {
		const january = makeYear(2025, { tmaxC: 30, tminC: 10, rainMm: 1 }).slice(0, 31);
		expect(monthlyNormals(summarizeMonths(january)).map((row) => row.month)).toEqual([1]);
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
			// Lows of 10°C all year: no freeze in either half.
			lastSpringFreezeDoy: null,
			firstFallFreezeDoy: null,
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
