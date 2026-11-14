// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Expected values are worked by hand from made-up weather (lib/test-fixtures.ts).

import { describe, expect, it } from "vitest";
import {
	buildClimateResponse,
	climatePoint,
	isClimateResponse,
} from "@/lib/climate";
import { dailyEt0Mm } from "@/lib/et";
import type { DailyWeather } from "@/lib/indicators";
import { makeRisingYears, makeYear } from "@/lib/test-fixtures";
import { mmToIn, roundTo } from "@/lib/units";

const FETCHED_AT = "2026-11-14T18:00:00.000Z";

function build(days: readonly DailyWeather[]) {
	return buildClimateResponse({
		lat: 38.05,
		lon: -100.74,
		elevationM: 858.35,
		days,
		fetchedAt: FETCHED_AT,
	});
}

describe("buildClimateResponse", () => {
	it("converts yearly indicators to inches and °F", () => {
		// 2 mm of rain a day for 183 season days is 366 mm, or 14.41 in.
		// Highs of 30°C and lows of 10°C give a mean of 20°C, or 68°F.
		const climate = build(makeYear(2025, { tmaxC: 30, tminC: 10, rainMm: 2 }));
		expect(climate.years).toEqual([
			{
				year: 2025,
				seasonRainIn: 14.41,
				hotDays: 0,
				lastSpringFreezeDoy: null,
				firstFallFreezeDoy: null,
				meanTempF: 68,
			},
		]);
	});

	it("has no monthly rows for days without the reference ET inputs, and estimates none", () => {
		// The made-up years carry temperature and rain only, like NASA POWER before 1984.
		const climate = build(makeRisingYears(1981, 12));
		expect(climate.years).toHaveLength(12);
		expect(climate.monthlyByYear).toEqual([]);
		expect(climate.monthlyNormals).toEqual([]);
	});

	it("fills twelve months a year, in inches and °F, once the reference ET inputs exist", () => {
		const weather = {
			tmaxC: 30,
			tminC: 10,
			rainMm: 2,
			solarMj: 20,
			dewC: 8,
			rhPct: 50,
			windMs: 2,
		};
		const days = [
			// 1983 has no sunlight value, so it has yearly indicators but no months.
			...makeYear(1983, { ...weather, solarMj: null }),
			...makeYear(1984, weather),
			...makeYear(1985, weather),
		];
		const climate = build(days);
		expect(climate.years.map((row) => row.year)).toEqual([1983, 1984, 1985]);
		expect(climate.monthlyByYear).toHaveLength(24);
		expect(climate.monthlyByYear[0]).toMatchObject({
			year: 1984,
			month: 1,
			// 31 days at 2 mm is 62 mm, or 2.44 in.
			rainIn: 2.44,
			hotDays: 0,
		});
		// The month's reference ET is the sum of its days, converted to inches.
		const site = { latitudeDeg: 38.05, elevationM: 858.35 };
		const january = days
			.filter((day) => day.date.startsWith("198401"))
			.reduce((total, day) => total + (dailyEt0Mm(day, site) ?? Number.NaN), 0);
		expect(climate.monthlyByYear[0].et0In).toBe(roundTo(mmToIn(january), 2));
		expect(climate.monthlyByYear[0].et0In).toBeGreaterThan(0);

		expect(climate.monthlyNormals).toHaveLength(12);
		expect(climate.monthlyNormals[0]).toMatchObject({
			month: 1,
			rainIn: 2.44,
			tmaxF: 86,
			tminF: 50,
		});
		// July needs more water than January under the same weather: the sun is higher.
		expect(climate.monthlyNormals[6].et0In).toBeGreaterThan(
			climate.monthlyNormals[0].et0In,
		);
		expect(isClimateResponse(JSON.parse(JSON.stringify(climate)))).toBe(true);
	});

	it("does not let a gap in the reference ET inputs change the yearly series", () => {
		const base = { tmaxC: 30, tminC: 10, rainMm: 2 };
		const withInputs = { ...base, solarMj: 20, dewC: 8, rhPct: 50, windMs: 2 };
		const plain = build(makeYear(2025, base));
		const full = build(makeYear(2025, withInputs));
		const gappy = build(
			makeYear(2025, withInputs, { "20250704": { solarMj: null, windMs: null } }),
		);
		expect(full.years).toEqual(plain.years);
		expect(gappy.years).toEqual(plain.years);
		// The month with the gap is left out; the other eleven stay.
		expect(gappy.monthlyByYear.map((row) => row.month)).toEqual([
			1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12,
		]);
	});

	it("fills the freeze dates, and leaves them null in a year with no freeze", () => {
		// Lows of 10°C: no freeze, so both dates are null and there is no freeze trend.
		const mild = build(makeRisingYears(1981, 12));
		for (const row of mild.years) {
			expect(row.lastSpringFreezeDoy).toBeNull();
			expect(row.firstFallFreezeDoy).toBeNull();
		}
		expect(mild.trends.lastSpringFreezeDoy).toBeUndefined();

		// A freeze on 12 April (day 102) and 20 October (day 293) of 2025.
		const cold = build(
			makeYear(
				2025,
				{ tmaxC: 20, tminC: 5, rainMm: 0 },
				{ "20250412": { tminC: -1 }, "20251020": { tminC: -1 } },
			),
		);
		expect(cold.years[0].lastSpringFreezeDoy).toBe(102);
		expect(cold.years[0].firstFallFreezeDoy).toBe(293);
	});

	it("gives the freeze dates a trend from the years that have one", () => {
		// Twelve years. The last spring freeze falls one day later each year, starting on
		// 1 April (day 91), except that the third year has no freeze at all.
		const days: DailyWeather[] = [];
		for (let k = 0; k < 12; k += 1) {
			const year = 1981 + k;
			const date = `${year}04${String(1 + k).padStart(2, "0")}`;
			days.push(
				...makeYear(
					year,
					{ tmaxC: 20, tminC: 5, rainMm: 0 },
					k === 2 ? {} : { [date]: { tminC: -1 } },
				),
			);
		}
		const climate = build(days);
		expect(climate.years[2].lastSpringFreezeDoy).toBeNull();
		// One day a year is ten days a decade. Leap years shift the day number by one, so the
		// slope is close to 10, not exactly 10.
		expect(climate.trends.lastSpringFreezeDoy.perDecade).toBeGreaterThan(9.5);
		expect(climate.trends.lastSpringFreezeDoy.perDecade).toBeLessThan(11);
		expect(climate.trends.lastSpringFreezeDoy.label).toBe("likely");
		expect(climate.trends.firstFallFreezeDoy).toBeUndefined();
	});

	it("carries the point, the elevation, the source and the fetch time", () => {
		const climate = build(makeRisingYears(1981, 12));
		expect(climate.lat).toBe(38.05);
		expect(climate.lon).toBe(-100.74);
		expect(climate.elevationM).toBe(858.35);
		expect(climate.source).toBe("NASA POWER");
		expect(climate.fetchedAt).toBe(FETCHED_AT);
		expect(isClimateResponse(climate)).toBe(true);
	});

	it("gives each filled yearly series a trend per decade, in its own unit", () => {
		// Year k has k hot days and k mm of rain a day, so hot days rise by 1 a year (10 a
		// decade) and season rain by 183 mm a year (72.047 in a decade).
		const climate = build(makeRisingYears(1981, 12));
		expect(Object.keys(climate.trends).sort()).toEqual([
			"hotDays",
			"meanTempF",
			"seasonRainIn",
		]);
		expect(climate.trends.hotDays).toMatchObject({
			perDecade: 10,
			linearPerDecade: 10,
			label: "likely",
		});
		expect(climate.trends.seasonRainIn.perDecade).toBeCloseTo(72.047, 3);
	});

	it("gives no trend when fewer than ten complete years are available", () => {
		const climate = build(makeRisingYears(1981, 9));
		expect(climate.years).toHaveLength(9);
		expect(climate.trends).toEqual({});
	});

	it("leaves out a year with missing days", () => {
		const days = [
			...makeYear(2024, { tmaxC: 30, tminC: 10, rainMm: 0 }),
			...makeYear(2025, { tmaxC: 30, tminC: 10, rainMm: 0 }).slice(0, 300),
		];
		expect(build(days).years.map((row) => row.year)).toEqual([2024]);
	});
});

describe("isClimateResponse", () => {
	const valid = build(makeRisingYears(1981, 12));

	it.each([
		["null", null],
		["an error body", { error: "NASA POWER could not be reached." }],
		["another source", { ...valid, source: "somewhere else" }],
		["years that are not a list", { ...valid, years: "none" }],
		["a year row without hot days", { ...valid, years: [{ year: 2025 }] }],
		[
			"a trend with an unknown label",
			{
				...valid,
				trends: { hotDays: { ...valid.trends.hotDays, label: "sure" } },
			},
		],
	])("rejects %s", (_name, value) => {
		expect(isClimateResponse(value)).toBe(false);
	});
});

describe("climatePoint", () => {
	it("rounds a point to two decimal places", () => {
		expect(climatePoint(38.0498, -100.7399674)).toEqual({
			lat: 38.05,
			lon: -100.74,
		});
	});
});
