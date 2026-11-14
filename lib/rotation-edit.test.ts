// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import {
	CROP_CHOICE_CODES,
	cropChoices,
	cropLabel,
	rotationYears,
} from "@/lib/rotation-edit";
import type { HistoryResponse } from "@/lib/types";

const HISTORY: HistoryResponse = {
	years: [
		{ year: 2023, cdlCode: 24, crop: "Winter Wheat" },
		{ year: 2024, cdlCode: 61, crop: "Fallow/Idle Cropland" },
		{ year: 2025, cdlCode: 6, crop: "Sunflower" },
	],
	source: "USDA NASS Cropland Data Layer",
};

describe("cropLabel", () => {
	it("uses USDA's class name, shortened only where it would not fit a chip", () => {
		expect(cropLabel(1)).toBe("Corn");
		expect(cropLabel(24)).toBe("Winter Wheat");
		expect(cropLabel(61)).toBe("Fallow");
		expect(cropLabel(26)).toBe("Wheat then soybeans");
		expect(cropLabel(176)).toBe("Grass or pasture");
	});

	it("still names a code that is not in USDA's table", () => {
		expect(cropLabel(7)).toBe("Class 7");
	});
});

describe("rotationYears", () => {
	it("shows the detected crops when nothing was changed", () => {
		expect(rotationYears(HISTORY, {}, 2026)).toEqual([
			{ year: 2023, cdlCode: 24, edited: false, detectedCode: 24 },
			{ year: 2024, cdlCode: 61, edited: false, detectedCode: 61 },
			{ year: 2025, cdlCode: 6, edited: false, detectedCode: 6 },
		]);
	});

	it("lays the farmer's corrections over the detected crops and marks them", () => {
		const rows = rotationYears(HISTORY, { 2024: 4 }, 2026);
		expect(rows[1]).toEqual({
			year: 2024,
			cdlCode: 4,
			edited: true,
			detectedCode: 61,
		});
		expect(rows[0].edited).toBe(false);
	});

	it("does not mark a year whose correction equals the detected crop", () => {
		expect(rotationYears(HISTORY, { 2023: 24 }, 2026)[0].edited).toBe(false);
	});

	it("offers the 8 years before this one, empty, when there is no crop history", () => {
		const rows = rotationYears(null, { 2021: 1 }, 2026);
		expect(rows.map((row) => row.year)).toEqual([
			2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
		]);
		expect(rows[0]).toEqual({
			year: 2018,
			cdlCode: null,
			edited: false,
			detectedCode: null,
		});
		expect(rows[3]).toEqual({
			year: 2021,
			cdlCode: 1,
			edited: true,
			detectedCode: null,
		});
	});
});

describe("cropChoices", () => {
	it("offers the standard list", () => {
		expect(cropChoices(24)).toEqual([...CROP_CHOICE_CODES]);
		expect(cropChoices(null)).toEqual([...CROP_CHOICE_CODES]);
	});

	it("adds the detected class when it is not in the list, so it can be shown and chosen again", () => {
		expect(cropChoices(6)).toEqual([6, ...CROP_CHOICE_CODES]);
	});
});
