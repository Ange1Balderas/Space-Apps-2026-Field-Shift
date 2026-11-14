// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Expected values are worked by hand from made-up weather (lib/test-fixtures.ts).

import { describe, expect, it } from "vitest";
import {
	buildClimateResponse,
	climatePoint,
	isClimateResponse,
} from "@/lib/climate";
import type { DailyWeather } from "@/lib/indicators";
import { makeRisingYears, makeYear } from "@/lib/test-fixtures";

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

	it("leaves the fields that later phases fill empty, without estimates", () => {
		const climate = build(makeRisingYears(1981, 12));
		expect(climate.monthlyByYear).toEqual([]);
		expect(climate.monthlyNormals).toEqual([]);
		for (const row of climate.years) {
			expect(row.lastSpringFreezeDoy).toBeNull();
			expect(row.firstFallFreezeDoy).toBeNull();
		}
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
