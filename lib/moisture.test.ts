// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import { SCORING } from "@/lib/library";
import {
	describeMoisture,
	formatMoisture,
	formatMonth,
	isCountyMoisture,
	moistureLabel,
	nearNormalZ,
	recordSpan,
} from "@/lib/moisture";
import type { CountyMoisture } from "@/lib/types";

const latest: NonNullable<CountyMoisture["latest"]> = {
	year: 2026,
	month: 10,
	mean: 0.171,
	days: 9,
	normalMean: 0.214,
	normalStd: 0.03,
	normalYears: 11,
	z: -1.43,
};

const county: CountyMoisture = {
	fips: "20055",
	county: "Finney",
	source: "NASA SMAP",
	product: "SPL3SMP_E.006",
	layer: "Soil_Moisture_Retrieval_Data_AM_soil_moisture",
	firstDate: "2015-03-31",
	lastDate: "2026-11-14",
	qualityRule: "AM reading, recommended quality",
	months: [
		{ year: 2015, month: 10, mean: 0.2, days: 8 },
		{ year: 2026, month: 10, mean: 0.171, days: 9 },
	],
	latest,
	builtAt: "2026-11-15T20:00:00Z",
};

describe("moistureLabel", () => {
	it("uses the sourced cut-off from config/scoring.json", () => {
		expect(SCORING.soilMoisture.nearNormalZ?.value).toBe(0.43);
		expect(nearNormalZ()).toBe(0.43);
	});

	it("labels beyond the cut-off as wetter or drier, and within it as about normal", () => {
		expect(moistureLabel(1, 0.43)).toBe("wetter");
		expect(moistureLabel(-1, 0.43)).toBe("drier");
		expect(moistureLabel(0.43, 0.43)).toBe("normal");
		expect(moistureLabel(-0.43, 0.43)).toBe("normal");
		expect(moistureLabel(0, 0.43)).toBe("normal");
	});

	it("gives no label without a z-score or without a cut-off", () => {
		expect(moistureLabel(null, 0.43)).toBeNull();
		expect(moistureLabel(1, null)).toBeNull();
	});
});

describe("the words", () => {
	it("writes a volume fraction as a percent by volume, and a month with its year", () => {
		expect(formatMoisture(0.171)).toBe("17% water by volume");
		expect(formatMonth(2026, 10)).toBe("October 2026");
	});

	it("describes the month against the other years", () => {
		expect(describeMoisture(latest)).toBe(
			"October 2026 averaged 17% water by volume in the top layer of soil, from 9 readings. The usual October here is 21%, over the 11 other years on record.",
		);
	});

	it("says when there are too few years for a z-score, and when there is nothing to compare", () => {
		expect(describeMoisture({ ...latest, normalYears: 2, z: null })).toContain(
			"too few years",
		);
		expect(
			describeMoisture({ ...latest, normalMean: null, normalStd: null, normalYears: 0, z: null }),
		).toContain("No other year has this month on record");
	});

	it("spans the record by year", () => {
		expect(recordSpan(county)).toEqual({ from: 2015, to: 2026, years: 2 });
		expect(recordSpan({ months: [] })).toBeNull();
	});
});

describe("isCountyMoisture", () => {
	it("accepts the committed shape, with or without a latest month", () => {
		expect(isCountyMoisture(county)).toBe(true);
		expect(isCountyMoisture({ ...county, latest: null })).toBe(true);
	});

	it("refuses another source, a bad date or a month out of range", () => {
		expect(isCountyMoisture({ ...county, source: "NASA POWER" })).toBe(false);
		expect(isCountyMoisture({ ...county, lastDate: "14/11/2026" })).toBe(false);
		expect(
			isCountyMoisture({ ...county, months: [{ year: 2026, month: 13, mean: 0.2, days: 3 }] }),
		).toBe(false);
		expect(isCountyMoisture({ ...county, latest: { ...latest, z: "low" } })).toBe(false);
	});
});
