// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Checks the repo's own data files against their shape, and checks that the shape checks
// catch the mistakes they are there for.

import { describe, expect, it } from "vitest";
import scoringJson from "@/config/scoring.json";
import calendarJson from "@/data/calendar.json";
import cropsJson from "@/data/crops.json";
import rotationsJson from "@/data/rotations.json";
import {
	CALENDAR,
	CROP_IDS,
	CROPS,
	calendarProblems,
	cropsProblems,
	INDICATOR_IDS,
	isMonthDay,
	ROTATIONS,
	rotationsProblems,
	SCORING,
	scoringProblems,
} from "@/lib/library";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("the data files as committed", () => {
	it("have the expected shape, with a linked source on every published value", () => {
		expect(cropsProblems(cropsJson)).toEqual([]);
		expect(calendarProblems(calendarJson)).toEqual([]);
		expect(rotationsProblems(rotationsJson)).toEqual([]);
		expect(scoringProblems(scoringJson)).toEqual([]);
	});

	it("hold one entry for each crop id", () => {
		expect(CROPS.map((crop) => crop.id).sort()).toEqual([...CROP_IDS].sort());
		expect(Object.keys(CALENDAR).sort()).toEqual([...CROP_IDS].sort());
	});

	it("hold the six rotations Phase 3 starts with", () => {
		expect(ROTATIONS.map((rotation) => rotation.id)).toEqual([
			"continuous-wheat",
			"wheat-fallow",
			"wheat-sorghum-fallow",
			"wheat-corn-fallow",
			"continuous-corn",
			"corn-soybean",
		]);
	});

	it("only plant crops whose usual dates are on file", () => {
		for (const rotation of ROTATIONS) {
			for (const planting of rotation.plantings) {
				expect(CALENDAR[planting.crop], `${rotation.id}: ${planting.crop}`).not.toBeNull();
			}
		}
	});

	it("say so when a crop value is the tool's own pick", () => {
		// FAO-56 prints sorghum's mid-season coefficient as a range; the tool uses its middle.
		const sorghum = CROPS.find((crop) => crop.id === "grain_sorghum");
		expect(sorghum?.kc?.value.mid).toBe(1.05);
		expect(sorghum?.kc?.assumption).toMatch(/1\.00 to 1\.10/);
		// Nothing is on file for a cover crop yet, and nothing is made up for it.
		const cover = CROPS.find((crop) => crop.id === "cover_crop");
		expect([cover?.kc, cover?.stageDays, cover?.nFixing, cover?.residue]).toEqual([
			null, null, null, null,
		]);
	});

	it("weigh every indicator with exactly one slider", () => {
		const used = Object.values(SCORING.priorityIndicators).flat();
		expect([...used].sort()).toEqual([...INDICATOR_IDS].sort());
	});
});

describe("the shape checks", () => {
	it("reject a published value with no source, or a source with no link", () => {
		const noSource = copy(cropsJson) as unknown as { kc: Record<string, unknown> }[];
		delete noSource[0].kc.source;
		expect(cropsProblems(noSource)).toEqual([
			"crops[0].kc.source: every published value needs a source with a link",
		]);

		const noLink = copy(cropsJson) as unknown as { kc: Record<string, unknown> }[];
		noLink[0].kc.source = "FAO-56, Table 12";
		expect(cropsProblems(noLink)).toHaveLength(1);
	});

	it("accept null for a value that is not sourced yet, and reject an empty assumption", () => {
		const crops = copy(cropsJson) as unknown as { kc: Record<string, unknown> | null }[];
		crops[1].kc = null;
		expect(cropsProblems(crops)).toEqual([]);
		crops[0].kc = { ...(crops[0].kc as Record<string, unknown>), assumption: " " };
		expect(cropsProblems(crops)).toEqual([
			"crops[0].kc.assumption: when present it has to say what the tool chose",
		]);
	});

	it("reject a missing crop, a crop listed twice and a value of the wrong kind", () => {
		const crops = copy(cropsJson) as unknown as Record<string, unknown>[];
		expect(cropsProblems(crops.slice(1))).toContain("crops: no entry for winter_wheat");
		expect(cropsProblems([...crops, crops[0]])).toContain("crops[6].id: listed twice");
		crops[0].residue = { value: "plenty", source: "https://example.org" };
		expect(cropsProblems(crops)[0]).toMatch(/crops\[0\]\.residue\.value/);
	});

	it("reject calendar dates that are not a month and day", () => {
		expect(isMonthDay("09-25")).toBe(true);
		expect(isMonthDay("02-30")).toBe(false);
		expect(isMonthDay("02-29")).toBe(false);
		expect(isMonthDay("9-25")).toBe(false);
		expect(isMonthDay("13-01")).toBe(false);
		const calendar = copy(calendarJson) as unknown as Record<string, { value: Record<string, string> }>;
		calendar.corn.value.plantStart = "April 15";
		expect(calendarProblems(calendar)).toEqual([
			'calendar.corn.value.plantStart: expected a month and day such as "09-25"',
		]);
	});

	it("reject a planting of an unknown crop, a planting outside the cycle and an unsourced claim", () => {
		const rotations = copy(rotationsJson) as unknown as {
			plantings: { crop: string; plantYear: number }[];
			risks: { text: string; source: string }[];
		}[];
		rotations[0].plantings[0].crop = "sunflower";
		rotations[1].plantings[0].plantYear = 3;
		rotations[2].risks[0].source = "K-State";
		const problems = rotationsProblems(rotations);
		expect(problems).toHaveLength(3);
		expect(problems[0]).toMatch(/rotations\[0\]\.plantings\[0\]\.crop/);
		expect(problems[1]).toMatch(/rotations\[1\]\.plantings\[0\]\.plantYear/);
		expect(problems[2]).toMatch(/rotations\[2\]\.risks\[0\]\.source/);
	});

	it("reject a scoring config that weighs an indicator twice or not at all", () => {
		const scoring = copy(scoringJson) as unknown as { priorityIndicators: Record<string, string[]> };
		scoring.priorityIndicators.saveWater = ["waterFit", "marketFit"];
		expect(scoringProblems(scoring)).toEqual([
			"scoring.priorityIndicators: marketFit is listed 2 times, expected once",
		]);
		scoring.priorityIndicators.saveWater = ["waterFit"];
		scoring.priorityIndicators.income = ["heatExposure", "pestBreak"];
		expect(scoringProblems(scoring)).toEqual([
			"scoring.priorityIndicators: marketFit is listed 0 times, expected once",
		]);
	});

	it("reject caps, shares and bands that make no sense", () => {
		const scoring = copy(scoringJson) as unknown as Record<string, unknown>;
		scoring.irrigationNeedCapIn = 0;
		scoring.regionRainBandsIn = [30, 20];
		scoring.fallowEfficiency = { value: 20, source: "https://example.org" };
		expect(scoringProblems(scoring)).toEqual([
			"scoring.irrigationNeedCapIn: expected a number above zero",
			"scoring.regionRainBandsIn: expected two rising numbers of inches",
			"scoring.fallowEfficiency.value: expected a share between 0 and 1",
		]);
	});
});
