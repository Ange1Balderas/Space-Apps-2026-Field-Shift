// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Hand-worked cases on a made-up crop: coefficients 0.3, 1.2 and 0.6, and four stages of
// 10 days each. They test the shape of the curve, not any published crop value.

import { describe, expect, it } from "vitest";
import { monthLength } from "@/lib/calendar";
import { cropCoefficient, seasonDemand, shareOfMonths } from "@/lib/crop-water";

const crop = {
	kc: { value: { ini: 0.3, mid: 1.2, end: 0.6 }, source: "made up for the test" },
	stageDays: { value: { ini: 10, dev: 10, mid: 10, late: 10 }, source: "made up for the test" },
};

describe("cropCoefficient", () => {
	it("is flat in the initial and mid-season stages and straight in between", () => {
		expect(cropCoefficient(crop, 0, 40)).toBe(0.3);
		expect(cropCoefficient(crop, 9, 40)).toBe(0.3);
		// Day 10 stands at 10.5 days: one twentieth of the way from 0.3 to 1.2.
		expect(cropCoefficient(crop, 10, 40)).toBeCloseTo(0.345, 10);
		expect(cropCoefficient(crop, 19, 40)).toBeCloseTo(1.155, 10);
		expect(cropCoefficient(crop, 25, 40)).toBe(1.2);
		// The last day stands at 39.5 days: nineteen twentieths of the way from 1.2 to 0.6.
		expect(cropCoefficient(crop, 39, 40)).toBeCloseTo(0.63, 10);
	});

	it("stretches the four stages in proportion to fill a longer season", () => {
		expect(cropCoefficient(crop, 19, 80)).toBe(0.3);
		expect(cropCoefficient(crop, 50, 80)).toBe(1.2);
		expect(cropCoefficient(crop, 79, 80)).toBeCloseTo(1.2 - 0.6 * (19.5 / 20), 10);
	});

	it("is null when the coefficients or stage lengths are not sourced yet", () => {
		expect(cropCoefficient({ kc: null, stageDays: crop.stageDays }, 0, 40)).toBeNull();
		expect(cropCoefficient({ kc: crop.kc, stageDays: null }, 0, 40)).toBeNull();
	});
});

describe("seasonDemand", () => {
	// Reference ET of 0.1 a day in every month.
	const et0 = Array.from({ length: 12 }, (_, index) => monthLength(index + 1) * 0.1);

	it("adds up reference ET times the coefficient over the season", () => {
		// Coefficients add up to 3 + 7.5 + 12 + 9 = 31.5 over the 40 days.
		expect(seasonDemand({ startDay: 0, lengthDays: 40 }, crop, et0)).toBeCloseTo(3.15, 10);
	});

	it("gives each day an equal share of its month, and follows a season into the next year", () => {
		// Start on 22 December (day 355): 10 days in December and 30 in January.
		const uneven = [...et0];
		uneven[11] = 31 * 0.2;
		const coefficients = Array.from({ length: 40 }, (_, day) => cropCoefficient(crop, day, 40) ?? 0);
		const expected =
			coefficients.slice(0, 10).reduce((sum, value) => sum + value * 0.2, 0) +
			coefficients.slice(10).reduce((sum, value) => sum + value * 0.1, 0);
		expect(seasonDemand({ startDay: 355, lengthDays: 40 }, crop, uneven)).toBeCloseTo(expected, 10);
	});

	it("is null when the crop's coefficients are not sourced yet", () => {
		expect(seasonDemand({ startDay: 0, lengthDays: 40 }, { kc: null, stageDays: null }, et0)).toBeNull();
	});
});

describe("shareOfMonths", () => {
	it("takes the part of each month's total that falls on the listed days", () => {
		const rain = [3.1, 2.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		expect(shareOfMonths([{ month: 1, days: 31 }, { month: 2, days: 14 }], rain)).toBeCloseTo(4.5, 10);
	});
});
