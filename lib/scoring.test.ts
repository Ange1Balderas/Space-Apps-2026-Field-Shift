// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Two kinds of test. The first works each formula by hand on a made-up field and a made-up
// crop, so the expected numbers can be checked with a pencil. The second runs the real
// library on the three sample fields and holds the two sanity rules of CLAUDE.md rule 11.

import { describe, expect, it } from "vitest";
import { monthLength } from "@/lib/calendar";
import { existingRotation } from "@/lib/existing-rotation";
import { INDICATOR_IDS, LIBRARY, type Library } from "@/lib/library";
import {
	annualRainIn,
	cropPattern,
	DEFAULT_PRIORITIES,
	erosionRisk,
	indicatorWeights,
	longestRun,
	type Priorities,
	rank,
	recentClimate,
	regionFor,
	scoreField,
	scoreRotation,
	weightedScore,
} from "@/lib/scoring";
import type {
	ClimateResponse,
	Crop,
	CropId,
	HistoryResponse,
	Rotation,
	SoilResponse,
} from "@/lib/types";
import brown from "@/public/data/samples/brown.json";
import finney from "@/public/data/samples/finney.json";
import thomas from "@/public/data/samples/thomas.json";

// ---- A made-up field and library -------------------------------------------------------

const SOURCE = "made up for the test, https://example.org";

/** A crop that uses exactly the reference ET (coefficient 1 all season). */
function crop(id: CropId, extra: Partial<Crop> = {}): Crop {
	return {
		id,
		name: id,
		kind: "summer",
		kc: { value: { ini: 1, mid: 1, end: 1 }, source: SOURCE },
		stageDays: { value: { ini: 10, dev: 10, mid: 10, late: 10 }, source: SOURCE },
		heatSensitiveMonths: { value: [7], source: SOURCE },
		nFixing: { value: false, source: SOURCE },
		residue: { value: "low", source: SOURCE },
		rootDepth: { value: "medium", source: SOURCE },
		market: "local",
		...extra,
	};
}

// In the ground from 1 May to 31 August: 123 days. Bare for the other 242.
const MAY_TO_AUGUST = {
	value: { plantStart: "05-01", plantEnd: "05-01", harvestStart: "09-01", harvestEnd: "09-01" },
	source: SOURCE,
};

const library: Library = {
	crops: [
		crop("corn"),
		crop("soybean", { nFixing: { value: true, source: SOURCE } }),
		crop("grain_sorghum", { residue: { value: "high", source: SOURCE } }),
		crop("alfalfa", { kind: "perennial", market: "regional", rootDepth: { value: "deep", source: SOURCE } }),
		crop("winter_wheat", { heatSensitiveMonths: null }),
		crop("cover_crop", { kind: "cover", kc: null, stageDays: null, heatSensitiveMonths: null }),
	],
	calendar: {
		corn: MAY_TO_AUGUST,
		soybean: MAY_TO_AUGUST,
		grain_sorghum: MAY_TO_AUGUST,
		winter_wheat: MAY_TO_AUGUST,
		alfalfa: null,
		cover_crop: null,
	},
	rotations: [],
	scoring: {
		...LIBRARY.scoring,
		regionRainBandsIn: [20, 30],
		effectiveRainFraction: { value: 0.75, source: SOURCE },
		fallowEfficiency: { value: 0.2, source: SOURCE },
		irrigationNeedCapIn: 24,
		hotDaysCap: 31,
		risingTrendPenalty: 10,
		erosion: { kTimesSlopeCap: 4, windIndexCap: 100 },
		soilBuildingPoints: { nFixing: 25, highResidue: 25, coverCrop: 25, deepRoots: 25 },
		marketScores: { local: 100, regional: 50, contract: 0 },
		simplicity: { perExtraCrop: 20, missingNoTillPenalty: 30 },
	},
};

function rotation(plantings: Rotation["plantings"], extra: Partial<Rotation> = {}): Rotation {
	return {
		id: "test",
		name: "Test rotation",
		cycleYears: Math.max(...plantings.map((planting) => planting.plantYear), 1),
		plantings,
		water: "dryland",
		regions: [],
		needsNoTill: false,
		benefits: [],
		risks: [],
		...extra,
	};
}

/**
 * Twelve years in which every day has 0.1 in of rain and 0.2 in of reference ET, and July
 * has 15.5 hot days. The first two years are ten times wetter, to show that only the last
 * ten are used.
 */
function climate(trends: ClimateResponse["trends"] = {}): ClimateResponse {
	const monthlyByYear: ClimateResponse["monthlyByYear"] = [];
	for (let year = 2014; year <= 2025; year += 1) {
		for (let month = 1; month <= 12; month += 1) {
			monthlyByYear.push({
				year,
				month,
				rainIn: monthLength(month) * (year < 2016 ? 1 : 0.1),
				et0In: monthLength(month) * 0.2,
				hotDays: month === 7 ? 15.5 : 0,
			});
		}
	}
	return {
		lat: 38,
		lon: -99,
		elevationM: 600,
		years: [],
		monthlyByYear,
		monthlyNormals: Array.from({ length: 12 }, (_, index) => ({
			month: index + 1,
			rainIn: 2,
			tmaxF: 70,
			tminF: 45,
			et0In: 5,
		})),
		trends,
		source: "NASA POWER",
		fetchedAt: "2026-11-14T00:00:00.000Z",
	};
}

const soil: SoilResponse = {
	mukey: "1",
	mapUnitName: "Test silt loam",
	texture: "silt loam",
	availableWaterIn: 4,
	organicMatterPct: 2,
	kFactor: 0.4,
	windErodibilityIndex: 48,
	slopePct: 5,
	hydrologicGroup: "B",
	source: "USDA NRCS SSURGO",
};

const field = { climate: climate(), soil };
const cornEveryYear = rotation([{ crop: "corn", plantYear: 1 }]);

// ---- Formulas, by hand -----------------------------------------------------------------

describe("recentClimate, annualRainIn and regionFor", () => {
	it("averages each month over the last ten years on record", () => {
		const recent = recentClimate(climate());
		expect(recent?.firstYear).toBe(2016);
		expect(recent?.lastYear).toBe(2025);
		expect(recent?.rainIn[0]).toBeCloseTo(3.1, 10);
		expect(recent?.et0In[1]).toBeCloseTo(5.6, 10);
		expect(recent?.hotDays[6]).toBe(15.5);
	});

	it("is null without monthly figures, and regions follow the band edges", () => {
		expect(recentClimate({ monthlyByYear: [] })).toBeNull();
		expect(annualRainIn(climate())).toBe(24);
		expect(annualRainIn({ monthlyNormals: [] })).toBeNull();
		expect(regionFor(19.9, [20, 30])).toBe("west");
		expect(regionFor(20, [20, 30])).toBe("central");
		expect(regionFor(30, [20, 30])).toBe("east");
		expect(regionFor(null, [20, 30])).toBeNull();
	});
});

describe("water fit (formula 3)", () => {
	// Demand 123 days x 0.2 = 24.6 in. Season rain 12.3 in, of which 75% = 9.225 in.
	// Rain on the bare field 24.2 in, of which 20% = 4.84 in, limited to the soil's 4 in.
	// Shortfall 24.6 - 9.225 - 4 = 11.375 in.
	it("dryland: 100 x (1 - shortfall / demand)", () => {
		const score = scoreRotation(cornEveryYear, field, library);
		expect(score.indicators.waterFit.score).toBeCloseTo(100 * (1 - 11.375 / 24.6), 8);
		expect(score.water?.mode).toBe("dryland");
		expect(score.water?.seasons[0]).toMatchObject({ storedCapped: true, storedIn: 4 });
		expect(score.water?.seasons[0].demandIn).toBeCloseTo(24.6, 8);
		expect(score.water?.seasons[0].bareRainIn).toBeCloseTo(24.2, 8);
	});

	it("does not cap the stored water when the soil's capacity is unknown", () => {
		const noCapacity = { ...field, soil: { ...soil, availableWaterIn: null } };
		const score = scoreRotation(cornEveryYear, noCapacity, library);
		expect(score.indicators.waterFit.score).toBeCloseTo(100 * (1 - (24.6 - 9.225 - 4.84) / 24.6), 8);
	});

	it("irrigated: falls as the irrigation need rises towards the cap", () => {
		const irrigated = rotation([{ crop: "corn", plantYear: 1 }], { water: "irrigated" });
		const score = scoreRotation(irrigated, field, library);
		expect(score.water?.irrigationNeedIn).toBeCloseTo(11.375, 8);
		expect(score.indicators.waterFit.score).toBeCloseTo(100 * (1 - 11.375 / 24), 8);
	});

	it("a rotation that can be either follows what the farm has", () => {
		const either = rotation([{ crop: "corn", plantYear: 1 }], { water: "either" });
		const dry = scoreRotation(either, field, library, { irrigationAvailable: false, hasNoTillEquipment: true });
		const wet = scoreRotation(either, field, library, { irrigationAvailable: true, hasNoTillEquipment: true });
		expect(dry.water?.mode).toBe("dryland");
		expect(wet.water?.mode).toBe("irrigated");
	});

	it("an irrigated rotation never scores higher than it would on rain alone", () => {
		// Corn every second year. Pumping would take 11.375 in over two years, 5.69 in a year,
		// which scores 76 against the 24 in cap. On rain alone the corn covers 53.8 percent of
		// its demand. The lower of the two is the score, so irrigating changes nothing here.
		const either = rotation([{ crop: "corn", plantYear: 2 }], { water: "either" });
		const dry = scoreRotation(either, field, library, { irrigationAvailable: false, hasNoTillEquipment: true });
		const wet = scoreRotation(either, field, library, { irrigationAvailable: true, hasNoTillEquipment: true });
		expect(wet.water?.irrigationNeedIn).toBeCloseTo(11.375 / 2, 8);
		expect(wet.indicators.waterFit.score).toBeCloseTo(100 * (1 - 11.375 / 24.6), 8);
		expect(wet.indicators.waterFit.score).toBeCloseTo(dry.indicators.waterFit.score ?? Number.NaN, 8);
		expect(wet.indicators.waterFit.why).toMatch(/would take about 5\.7 in a year, which scores 76 .* The score is the lower of the two\./);
		expect(dry.indicators.waterFit.why).toBe(
			"Rain and stored soil water cover about 54 percent of potential crop demand: on average 13.2 of 24.6 in per crop, on 2016 to 2025 weather.",
		);
	});

	it("a fallow year banks more rain, so the shortfall is smaller", () => {
		// Corn every second year: the bare stretch is 242 + 365 days, 60.7 in of rain, 12.14 in
		// at 20%, still limited to the soil's 4 in. With a deeper soil all of it counts.
		const deep = { ...field, soil: { ...soil, availableWaterIn: 20 } };
		const everyYear = scoreRotation(cornEveryYear, deep, library);
		const withFallow = scoreRotation(rotation([{ crop: "corn", plantYear: 2 }]), deep, library);
		expect(withFallow.water?.seasons[0].storedIn).toBeCloseTo(12.14, 8);
		expect(withFallow.indicators.waterFit.score).toBeGreaterThan(everyYear.indicators.waterFit.score ?? 0);
	});

	it("has no score, and says why, when a crop's coefficients are not sourced yet", () => {
		const score = scoreRotation(rotation([{ crop: "alfalfa", plantYear: 1 }]), field, library);
		// The made-up alfalfa has coefficients, so it is scored; the cover crop has none.
		expect(score.indicators.waterFit.score).not.toBeNull();
		const cover = scoreRotation(rotation([{ crop: "cover_crop", plantYear: 1 }]), field, library);
		expect(cover.indicators.waterFit.score).toBeNull();
		expect(cover.indicators.waterFit.why).toMatch(/could be placed/);
	});

	it("has no score without monthly climate, and guesses nothing", () => {
		const bare = { climate: { ...climate(), monthlyByYear: [] }, soil };
		const score = scoreRotation(cornEveryYear, bare, library);
		expect(score.indicators.waterFit.score).toBeNull();
		expect(score.indicators.heatExposure.score).toBeNull();
	});
});

describe("heat and drought exposure (formula 4)", () => {
	it("scales the hot days in the sensitive month against the cap", () => {
		// 15.5 hot days in July against a cap of 31.
		expect(scoreRotation(cornEveryYear, field, library).indicators.heatExposure.score).toBeCloseTo(50, 8);
	});

	it("takes the penalty off only for a likely rising trend", () => {
		const trend = (label: "likely" | "possible" | "none", perDecade: number) =>
			scoreRotation(
				cornEveryYear,
				{ climate: climate({ hotDays: { perDecade, linearPerDecade: perDecade, pValue: 0.01, label } }), soil },
				library,
			).indicators.heatExposure.score;
		expect(trend("likely", 2)).toBeCloseTo(40, 8);
		expect(trend("possible", 2)).toBeCloseTo(50, 8);
		expect(trend("likely", -2)).toBeCloseTo(50, 8);
	});

	it("has no score when no crop's sensitive months are sourced", () => {
		const score = scoreRotation(rotation([{ crop: "winter_wheat", plantYear: 1 }]), field, library);
		expect(score.indicators.heatExposure.score).toBeNull();
		expect(score.indicators.heatExposure.why).toMatch(/not sourced yet/);
	});
});

describe("soil protection (formula 5)", () => {
	it("takes the higher of the water and wind risks", () => {
		expect(erosionRisk(soil, library.scoring.erosion)).toEqual({ risk: 0.5, water: 0.5, wind: 0.48 });
		expect(erosionRisk({ kFactor: 0.4, slopePct: 20, windErodibilityIndex: 250 }, library.scoring.erosion)?.risk).toBe(1);
		expect(erosionRisk({ kFactor: null, slopePct: 5, windErodibilityIndex: 48 }, library.scoring.erosion)).toEqual({ risk: 0.48, water: null, wind: 0.48 });
		expect(erosionRisk({ kFactor: null, slopePct: null, windErodibilityIndex: null }, library.scoring.erosion)).toBeNull();
		expect(erosionRisk(null, library.scoring.erosion)).toBeNull();
	});

	it("is 100 x (1 - bare share x erosion risk)", () => {
		// Bare in 8 of 12 months, risk 0.5.
		const score = scoreRotation(cornEveryYear, field, library);
		expect(score.indicators.soilProtection.score).toBeCloseTo(100 * (1 - (8 / 12) * 0.5), 8);
		const noSoil = scoreRotation(cornEveryYear, { climate: climate(), soil: null }, library);
		expect(noSoil.indicators.soilProtection.score).toBeNull();
	});
});

describe("soil building, pest break, market fit and simplicity (formulas 6 to 9)", () => {
	const score = (plantings: Rotation["plantings"], extra: Partial<Rotation> = {}, hasNoTillEquipment = true) =>
		scoreRotation(rotation(plantings, extra), field, library, { irrigationAvailable: false, hasNoTillEquipment }).indicators;

	it("gives points for each soil-building trait present, once", () => {
		expect(score([{ crop: "corn", plantYear: 1 }]).soilBuilding.score).toBe(0);
		expect(score([{ crop: "corn", plantYear: 1 }, { crop: "soybean", plantYear: 2 }]).soilBuilding.score).toBe(25);
		expect(
			score([
				{ crop: "soybean", plantYear: 1 },
				{ crop: "grain_sorghum", plantYear: 2 },
				{ crop: "alfalfa", plantYear: 3 },
				{ crop: "cover_crop", plantYear: 3 },
			]).soilBuilding.score,
		).toBe(100);
	});

	it("pest break rises with the number of crops and falls with the longest run", () => {
		expect(score([{ crop: "corn", plantYear: 1 }]).pestBreak.score).toBe(0);
		// One crop with a fallow year between: 100 x 1/2.
		expect(score([{ crop: "corn", plantYear: 2 }]).pestBreak.score).toBe(50);
		// Two crops in turn: 100 x 2/3.
		expect(score([{ crop: "corn", plantYear: 1 }, { crop: "soybean", plantYear: 2 }]).pestBreak.score).toBeCloseTo(66.667, 3);
		// Corn, corn, soybean: the run of two halves it.
		expect(
			score([{ crop: "corn", plantYear: 1 }, { crop: "corn", plantYear: 2 }, { crop: "soybean", plantYear: 3 }]).pestBreak.score,
		).toBeCloseTo(33.333, 3);
	});

	it("counts a run that wraps round the end of the cycle", () => {
		const wrapped = rotation([{ crop: "corn", plantYear: 1 }, { crop: "soybean", plantYear: 2 }, { crop: "corn", plantYear: 3 }]);
		expect(longestRun(wrapped)).toBe(2);
		expect(longestRun(cornEveryYear)).toBe(Number.POSITIVE_INFINITY);
	});

	it("market fit averages the crops that are sold", () => {
		expect(score([{ crop: "corn", plantYear: 1 }]).marketFit.score).toBe(100);
		expect(score([{ crop: "corn", plantYear: 1 }, { crop: "alfalfa", plantYear: 2 }]).marketFit.score).toBe(75);
		// A cover crop is not sold, so it does not count.
		expect(score([{ crop: "corn", plantYear: 1 }, { crop: "cover_crop", plantYear: 1 }]).marketFit.score).toBe(100);
	});

	it("simplicity falls with each extra crop and with no-till equipment the farm lacks", () => {
		expect(score([{ crop: "corn", plantYear: 1 }]).simplicity.score).toBe(100);
		expect(score([{ crop: "corn", plantYear: 1 }, { crop: "soybean", plantYear: 2 }]).simplicity.score).toBe(80);
		expect(score([{ crop: "corn", plantYear: 1 }], { needsNoTill: true }, false).simplicity.score).toBe(70);
		expect(score([{ crop: "corn", plantYear: 1 }], { needsNoTill: true }, true).simplicity.score).toBe(100);
	});
});

describe("weights and the weighted score", () => {
	it("shares each slider equally among its indicators", () => {
		const weights = indicatorWeights({ saveWater: 100, protectSoil: 50, income: 30, simplicity: 0 }, library.scoring);
		expect(weights).toEqual({
			waterFit: 100,
			soilProtection: 25,
			soilBuilding: 25,
			heatExposure: 10,
			pestBreak: 10,
			marketFit: 10,
			simplicity: 0,
		});
	});

	it("counts every indicator the same when every slider is at zero", () => {
		const weights = indicatorWeights({ saveWater: 0, protectSoil: 0, income: 0, simplicity: 0 }, library.scoring);
		expect(Object.values(weights)).toEqual(Array(7).fill(1));
	});

	it("is the sum of weight times score over the sum of weights, leaving out what has no score", () => {
		const indicators = Object.fromEntries(
			INDICATOR_IDS.map((id) => [id, { score: null as number | null, why: "" }]),
		) as Parameters<typeof weightedScore>[0];
		indicators.waterFit.score = 40;
		indicators.simplicity.score = 100;
		const weights = indicatorWeights({ saveWater: 100, protectSoil: 50, income: 50, simplicity: 50 }, library.scoring);
		// (100 x 40 + 50 x 100) / 150
		expect(weightedScore(indicators, weights)).toBeCloseTo(60, 10);
		indicators.waterFit.score = null;
		indicators.simplicity.score = null;
		expect(weightedScore(indicators, weights)).toBeNull();
	});
});

describe("cropPattern", () => {
	it("reduces a repeating history to its shortest cycle, wherever it starts", () => {
		const cornSoy = rotation([{ crop: "corn", plantYear: 1 }, { crop: "soybean", plantYear: 2 }]);
		const fourYears = rotation([
			{ crop: "soybean", plantYear: 1 },
			{ crop: "corn", plantYear: 2 },
			{ crop: "soybean", plantYear: 3 },
			{ crop: "corn", plantYear: 4 },
		]);
		expect(cropPattern(fourYears)).toBe(cropPattern(cornSoy));
		expect(cropPattern(cornEveryYear)).not.toBe(cropPattern(cornSoy));
	});
});

// ---- The real library on the three sample fields ---------------------------------------

type Sample = { climate: ClimateResponse; history: HistoryResponse; soil: SoilResponse };
const samples = { finney, thomas, brown } as unknown as Record<string, Sample>;

function fieldScores(sample: Sample, irrigationAvailable: boolean) {
	return scoreField(
		{ climate: sample.climate, soil: sample.soil },
		LIBRARY,
		{ irrigationAvailable, hasNoTillEquipment: true },
		existingRotation(sample.history.years),
	);
}

describe("the three sample fields", () => {
	it.each(Object.keys(samples))("%s gets a ranked list with all seven indicators scored", (name) => {
		const ranking = rank(fieldScores(samples[name], false), DEFAULT_PRIORITIES, LIBRARY.scoring);
		expect(ranking.existing?.total).not.toBeNull();
		const rows = [...ranking.candidates, ...ranking.elsewhere];
		expect(rows.length).toBeGreaterThanOrEqual(4);
		for (const row of [ranking.existing, ...rows]) {
			for (const id of INDICATOR_IDS) {
				expect(row?.indicators[id].score, `${name} ${row?.rotation.id} ${id}`).not.toBeNull();
			}
			expect(row?.total).toBeGreaterThanOrEqual(0);
			expect(row?.total).toBeLessThanOrEqual(100);
		}
		const totals = ranking.candidates.map((row) => row.total ?? 0);
		expect(totals).toEqual([...totals].sort((a, b) => b - a));
	});

	it("puts each sample in its part of Kansas and suggests what is usual there", () => {
		const region = (name: string) => rank(fieldScores(samples[name], false), DEFAULT_PRIORITIES, LIBRARY.scoring);
		expect(region("finney").region).toBe("west");
		expect(region("thomas").region).toBe("west");
		expect(region("brown").region).toBe("east");
		expect(region("finney").candidates.map((row) => row.rotation.id).sort()).toEqual([
			"continuous-wheat", "wheat-corn-fallow", "wheat-fallow", "wheat-sorghum-fallow",
		]);
		expect(region("finney").elsewhere.map((row) => row.rotation.id)).toEqual(["corn-soybean"]);
	});

	it("does not repeat the field's own rotation among the candidates", () => {
		// Finney is corn every year and Brown is corn and soybeans in turn: both are in the library.
		expect(fieldScores(samples.finney, true).sameAsExisting?.id).toBe("continuous-corn");
		expect(fieldScores(samples.brown, false).sameAsExisting?.id).toBe("corn-soybean");
		expect(fieldScores(samples.thomas, false).sameAsExisting).toBeNull();
		const ids = fieldScores(samples.brown, true).candidates.map((score) => score.rotation.id);
		expect(ids).not.toContain("corn-soybean");
	});

	it("hides a rotation that needs irrigation until the farm has it", () => {
		const without = fieldScores(samples.thomas, false);
		expect(without.hiddenForIrrigation.map((item) => item.id)).toEqual(["continuous-corn"]);
		expect(without.candidates.map((score) => score.rotation.id)).not.toContain("continuous-corn");
		expect(fieldScores(samples.thomas, true).candidates.map((score) => score.rotation.id)).toContain("continuous-corn");
	});

	it.each(Object.keys(samples))(
		"switching irrigation on never raises the water fit of the field's own rotation at %s",
		(name) => {
			const off = fieldScores(samples[name], false).existing?.indicators.waterFit.score ?? Number.NaN;
			const on = fieldScores(samples[name], true).existing?.indicators.waterFit.score ?? Number.NaN;
			expect(on).toBeLessThanOrEqual(off);
		},
	);

	it("moving a weight re-orders the list", () => {
		const scores = fieldScores(samples.finney, false);
		const order = (priorities: Priorities) =>
			rank(scores, priorities, LIBRARY.scoring).candidates.map((row) => row.rotation.id);
		const balanced = order(DEFAULT_PRIORITIES);
		const soilFirst = order({ saveWater: 0, protectSoil: 100, income: 0, simplicity: 0 });
		expect(balanced[0]).toBe("wheat-fallow");
		expect(soilFirst[0]).toBe("continuous-wheat");
		expect(soilFirst).not.toEqual(balanced);
	});
});

// CLAUDE.md rule 11. "Never" is checked as a sweep: every sample, the other three sliders
// at 0, 50 and 100, and every rotation the tool scores, suggested or not.
describe("scoring sanity (CLAUDE.md rule 11)", () => {
	const steps = [0, 50, 100];

	it.each(Object.keys(samples))(
		"with save water at maximum, continuous irrigated corn never ranks first at %s",
		(name) => {
			const scores = fieldScores(samples[name], true);
			const cornPattern = cropPattern({ cycleYears: 1, plantings: [{ crop: "corn", plantYear: 1 }] });
			for (const protectSoil of steps) {
				for (const income of steps) {
					for (const simplicity of steps) {
						const ranking = rank(scores, { saveWater: 100, protectSoil, income, simplicity }, LIBRARY.scoring);
						const rows = [ranking.existing, ...ranking.candidates, ...ranking.elsewhere].filter(
							(row): row is NonNullable<typeof row> => row !== null,
						);
						const corn = rows.filter(
							(row) => cropPattern(row.rotation) === cornPattern && row.water?.mode === "irrigated",
						);
						expect(corn.length, `${name}: continuous irrigated corn is scored`).toBeGreaterThan(0);
						const best = Math.max(...rows.map((row) => row.total ?? 0));
						for (const row of corn) {
							expect(
								row.total,
								`${name} soil ${protectSoil} income ${income} simplicity ${simplicity}`,
							).toBeLessThan(best);
						}
					}
				}
			}
		},
	);

	it.each(["finney", "thomas"])(
		"on a dry western field (%s), wheat-fallow beats continuous wheat on water fit",
		(name) => {
			const scores = fieldScores(samples[name], false);
			expect(scores.region).toBe("west");
			const waterFit = (id: string) =>
				scores.candidates.find((score) => score.rotation.id === id)?.indicators.waterFit.score ?? Number.NaN;
			expect(waterFit("wheat-fallow")).toBeGreaterThan(waterFit("continuous-wheat"));
		},
	);
});
