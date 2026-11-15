// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import { climateWindows } from "@/lib/climate-windows";
import type { ClimateResponse } from "@/lib/types";
import brown from "@/public/data/samples/brown.json";
import finney from "@/public/data/samples/finney.json";

type Monthly = ClimateResponse["monthlyByYear"];
type Yearly = ClimateResponse["years"];

/** Ten years in which every month has the given rain, reference ET and hot days. */
function months(pick: (month: number, year: number) => { rainIn: number; et0In: number; hotDays: number }): Monthly {
	const rows: Monthly = [];
	for (let year = 2016; year <= 2025; year += 1) {
		for (let month = 1; month <= 12; month += 1) rows.push({ year, month, ...pick(month, year) });
	}
	return rows;
}

const year = (y: number, spring: number | null, fall: number | null): Yearly[number] => ({
	year: y,
	seasonRainIn: 0,
	hotDays: 0,
	meanTempF: 50,
	lastSpringFreezeDoy: spring,
	firstFallFreezeDoy: fall,
});

describe("climateWindows", () => {
	it("marks a month hot when a hot day occurred there in more than half of the years", () => {
		const windows = climateWindows({
			years: [],
			monthlyByYear: months((month, y) => ({
				rainIn: 1,
				et0In: 1,
				// July is hot every year, August in six years of ten, June in exactly five.
				hotDays: month === 7 ? 3 : month === 8 && y < 2022 ? 1 : month === 6 && y < 2021 ? 9 : 0,
			})),
		});
		expect(windows.hot).toEqual([7, 8]);
		expect(windows.recentYears).toEqual({ first: 2016, last: 2025 });
	});

	it("marks a month dry when reference ET exceeds rain by more than in the average month", () => {
		// The shortfall is 1 in in every month but June to August, where it is 5 in: the
		// average month is 2 in short, so only those three are marked.
		const windows = climateWindows({
			years: [],
			monthlyByYear: months((month) => ({
				rainIn: 2,
				et0In: month >= 6 && month <= 8 ? 7 : 3,
				hotDays: 0,
			})),
		});
		expect(windows.dry).toEqual([6, 7, 8]);
	});

	it("marks the months from the average first fall freeze to the average last spring freeze", () => {
		// Day 106 is 16 April and day 296 is 23 October. A year with no freeze is left out.
		const windows = climateWindows({
			years: [year(2023, 100, 290), year(2024, 112, 302), year(2025, null, null)],
			monthlyByYear: [],
		});
		expect(windows.frost).toEqual([1, 2, 3, 4, 10, 11, 12]);
		// Without monthly figures there is nothing to work the other two out from.
		expect(windows.hot).toEqual([]);
		expect(windows.dry).toEqual([]);
		expect(windows.recentYears).toBeNull();
	});

	it("has no frost window where no year on record had both freezes", () => {
		expect(climateWindows({ years: [year(2025, null, 300)], monthlyByYear: [] }).frost).toEqual([]);
	});

	it("gives sensible windows at the sample fields", () => {
		const west = climateWindows(finney.climate as unknown as ClimateResponse);
		const east = climateWindows(brown.climate as unknown as ClimateResponse);
		// Southwest Kansas is hot through the summer, and frost runs from October to April.
		expect(west.hot).toEqual([6, 7, 8, 9]);
		expect(west.frost).toEqual([1, 2, 3, 4, 10, 11, 12]);
		// The dry window sits in the warm half of the year at both fields.
		for (const windows of [west, east]) {
			expect(windows.dry.length).toBeGreaterThan(0);
			expect(windows.dry.every((month) => month >= 4 && month <= 10)).toBe(true);
		}
	});
});
