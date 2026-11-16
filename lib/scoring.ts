// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Scores a rotation for one field on seven indicators, 0 to 100 each, and combines them
// with weights from the farmer's four priorities (SPEC.md, "Rotation library and scoring
// model" and "Formulas", items 3 to 9). It runs in the browser: a slider move only changes
// the weights, so nothing is fetched again.
//
// Published values come from data/ and the constants the tool chose from config/scoring.json
// (lib/library.ts). An indicator whose inputs are missing has no score (null) and is left out
// of the total; nothing is guessed to fill it.
//
// Limits to keep in mind: this is a seasonal water budget on the last ten years' average
// months, not a daily soil-water model; crop water demand is potential demand; one fallow
// efficiency and one usable share of rain stand for all of Kansas.

import { buildCalendar, type RotationCalendar } from "@/lib/calendar";
import { seasonDemand, shareOfMonths } from "@/lib/crop-water";
import { INDICATOR_IDS, type Library, PRIORITIES, SCORING } from "@/lib/library";
import type {
	ClimateResponse,
	Crop,
	CropId,
	IndicatorId,
	Priority,
	Rotation,
	ScoringConfig,
	SoilResponse,
} from "@/lib/types";

// SPEC.md, "Formulas", items 2 and 4: "the 10-year average", "over the last 10 years".
export const RECENT_YEARS = 10;

export type Region = "west" | "central" | "east";

/** What the farmer has told the tool about the farm, and the scenario they are trying. */
export type Constraints = {
	irrigationAvailable: boolean;
	hasNoTillEquipment: boolean;
	/**
	 * The rain scenario (SPEC.md, feature 15, the rainfall half): every month's rain in the
	 * recent average is scaled by this percent change before the water budget. 0, or absent,
	 * is the record as it is. Only water fit changes; the temperature half is not built.
	 */
	rainChangePct?: number;
};

export const DEFAULT_CONSTRAINTS: Constraints = {
	irrigationAvailable: false,
	hasNoTillEquipment: true,
	rainChangePct: 0,
};

/**
 * The rain scenario's range, in percent, from config/scoring.json (SPEC.md: "Rainfall -30% to
 * +10%"). A tool choice, so it is listed with the assumptions on the About tab.
 */
export const RAIN_CHANGE_RANGE = {
	min: SCORING.rainScenario.minPct,
	max: SCORING.rainScenario.maxPct,
	step: SCORING.rainScenario.stepPct,
} as const;

/** The scenario's percent change, clamped to the range; 0 is the record. */
export function rainChangeOf(constraints: Pick<Constraints, "rainChangePct">): number {
	const pct = constraints.rainChangePct ?? 0;
	return Math.min(RAIN_CHANGE_RANGE.max, Math.max(RAIN_CHANGE_RANGE.min, pct));
}

/** The factor the scenario applies to every month's rain: 0.7 for -30, 1 for the record. */
export function rainFactor(constraints: Pick<Constraints, "rainChangePct">): number {
	return 1 + rainChangeOf(constraints) / 100;
}

/** The words for a rain scenario: "20% less rain", "10% more rain", "the rain as recorded". */
export function describeRainChange(pct: number): string {
	if (pct === 0) return "the rain as recorded";
	return `${Math.abs(pct)}% ${pct < 0 ? "less" : "more"} rain`;
}

/** A percent with its sign, with a real minus sign: "−30%", "+10%", "0%". */
export function signedPercent(pct: number): string {
	return pct === 0 ? "0%" : `${pct < 0 ? "−" : "+"}${Math.abs(pct)}%`;
}

/** The four sliders, each 0 to 100. */
export type Priorities = Record<Priority, number>;

export const DEFAULT_PRIORITIES: Priorities = {
	saveWater: 50,
	protectSoil: 50,
	income: 50,
	simplicity: 50,
};

/** The average month over the most recent years on record, January first. */
export type RecentClimate = {
	firstYear: number;
	lastYear: number;
	rainIn: number[];
	et0In: number[];
	hotDays: number[];
};

/**
 * Averages each calendar month over the last `years` years that have monthly figures.
 * Null when the climate answer has no complete set of twelve months.
 */
export function recentClimate(
	climate: Pick<ClimateResponse, "monthlyByYear">,
	years: number = RECENT_YEARS,
): RecentClimate | null {
	const allYears = [...new Set(climate.monthlyByYear.map((row) => row.year))].sort(
		(a, b) => a - b,
	);
	const kept = allYears.slice(-years);
	if (kept.length === 0) return null;
	const rows = climate.monthlyByYear.filter((row) => kept.includes(row.year));
	const mean = (month: number, pick: (row: (typeof rows)[number]) => number) => {
		const values = rows.filter((row) => row.month === month).map(pick);
		return values.length === 0
			? Number.NaN
			: values.reduce((total, value) => total + value, 0) / values.length;
	};
	const monthsOfYear = Array.from({ length: 12 }, (_, index) => index + 1);
	const recent: RecentClimate = {
		firstYear: kept[0],
		lastYear: kept[kept.length - 1],
		rainIn: monthsOfYear.map((month) => mean(month, (row) => row.rainIn)),
		et0In: monthsOfYear.map((month) => mean(month, (row) => row.et0In)),
		hotDays: monthsOfYear.map((month) => mean(month, (row) => row.hotDays)),
	};
	const complete = [...recent.rainIn, ...recent.et0In, ...recent.hotDays].every(
		Number.isFinite,
	);
	return complete ? recent : null;
}

/** Long-term average rain in a year at the point, in inches, or null without twelve monthly normals. */
export function annualRainIn(
	climate: Pick<ClimateResponse, "monthlyNormals">,
): number | null {
	if (climate.monthlyNormals.length !== 12) return null;
	return climate.monthlyNormals.reduce((total, row) => total + row.rainIn, 0);
}

/** West, central or east, from the point's long-term average rain and the band edges in config. */
export function regionFor(
	annualRain: number | null,
	bandsIn: readonly [number, number],
): Region | null {
	if (annualRain === null) return null;
	if (annualRain < bandsIn[0]) return "west";
	return annualRain < bandsIn[1] ? "central" : "east";
}

export type IndicatorResult = {
	/** 0 to 100, or null when the indicator could not be worked out. */
	score: number | null;
	/** One plain sentence: the numbers behind the score, or why there is none. */
	why: string;
};

export type SeasonWater = {
	crop: CropId;
	/** Potential demand over the season, inches. */
	demandIn: number;
	/** Rain that falls while the crop is in the ground, inches. */
	seasonRainIn: number;
	/** The part of that rain counted as usable, inches. */
	effectiveRainIn: number;
	/** Rain on the bare field before planting, inches. */
	bareRainIn: number;
	/** The part of that rain counted as stored in the soil at planting, inches. */
	storedIn: number;
	/** True when the stored amount was limited by what the soil can hold. */
	storedCapped: boolean;
	shortfallIn: number;
};

export type WaterDetail = {
	mode: "dryland" | "irrigated";
	seasons: SeasonWater[];
	/** Inches a year, averaged over the cycle. Set for an irrigated rotation. */
	irrigationNeedIn: number | null;
	/** The rain scenario the seasons' rain was scaled by, in percent; 0 is the record. */
	rainChangePct: number;
};

export type HeatDetail = { crop: CropId; months: number[]; hotDaysPerMonth: number };

export type RotationScore = {
	rotation: Rotation;
	calendar: RotationCalendar;
	indicators: Record<IndicatorId, IndicatorResult>;
	water: WaterDetail | null;
	heat: HeatDetail[];
	/** Whether the library lists the rotation for this field's region. Null when it lists none. */
	typicalHere: boolean | null;
};

export type FieldFacts = {
	climate: ClimateResponse;
	soil: SoilResponse | null;
};

const clamp = (value: number, low: number, high: number) =>
	Math.min(high, Math.max(low, value));

const one = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

function cropOf(library: Pick<Library, "crops">, id: CropId): Crop | undefined {
	return library.crops.find((crop) => crop.id === id);
}

function nameOf(library: Pick<Library, "crops">, id: CropId): string {
	return (cropOf(library, id)?.name ?? id).toLowerCase();
}

/** The distinct crops a rotation plants, in the order they first appear. */
export function distinctCrops(rotation: Pick<Rotation, "plantings">): CropId[] {
	return [...new Set(rotation.plantings.map((planting) => planting.crop))];
}

/** Dryland or irrigated: what the rotation is, or what the farm has when it can be either. */
export function waterMode(
	rotation: Pick<Rotation, "water">,
	constraints: Constraints,
): "dryland" | "irrigated" {
	if (rotation.water === "either") {
		return constraints.irrigationAvailable ? "irrigated" : "dryland";
	}
	return rotation.water;
}

function scoreWater(
	rotation: Rotation,
	calendar: RotationCalendar,
	recent: RecentClimate | null,
	soil: SoilResponse | null,
	library: Library,
	constraints: Constraints,
	knownYears: number,
): { result: IndicatorResult; detail: WaterDetail | null } {
	const { scoring } = library;
	const none = (why: string) => ({ result: { score: null, why }, detail: null });
	if (!recent) return none("No monthly rain and reference ET for this point, so water fit was not worked out.");
	if (!scoring.effectiveRainFraction || !scoring.fallowEfficiency) {
		return none("The usable share of rain or the fallow efficiency is not sourced yet.");
	}
	const mode = waterMode(rotation, constraints);
	const capacity = soil?.availableWaterIn ?? null;
	// The rain scenario scales every month's rain; the record itself is left as it is.
	const factor = rainFactor(constraints);
	const rainIn = factor === 1 ? recent.rainIn : recent.rainIn.map((value) => value * factor);
	const seasons: SeasonWater[] = [];
	const skipped: string[] = [];
	for (const season of calendar.seasons) {
		const crop = cropOf(library, season.crop);
		const demandIn = crop ? seasonDemand(season, crop, recent.et0In) : null;
		if (demandIn === null || demandIn <= 0) {
			skipped.push(nameOf(library, season.crop));
			continue;
		}
		const seasonRainIn = shareOfMonths(season.daysByMonth, rainIn);
		const bareRainIn = shareOfMonths(season.bareDaysBefore, rainIn);
		const banked = bareRainIn * scoring.fallowEfficiency.value;
		const storedCapped = capacity !== null && banked > capacity;
		const storedIn = storedCapped ? capacity : banked;
		const effectiveRainIn = seasonRainIn * scoring.effectiveRainFraction.value;
		seasons.push({
			crop: season.crop,
			demandIn,
			seasonRainIn,
			effectiveRainIn,
			bareRainIn,
			storedIn,
			storedCapped,
			shortfallIn: Math.max(0, demandIn - effectiveRainIn - storedIn),
		});
	}
	if (seasons.length === 0) {
		return none(
			skipped.length > 0
				? `Crop coefficients for ${skipped.join(" and ")} are not sourced yet, so water fit was not worked out.`
				: "No crop of this rotation could be placed in the year, so water fit was not worked out.",
		);
	}
	const left = skipped.length > 0 ? ` Not counted: ${skipped.join(", ")} (not sourced yet).` : "";
	const pct = rainChangeOf(constraints);
	// The "why" names the scenario, so the sentence is never a false claim about the record.
	const period = `${recent.firstYear} to ${recent.lastYear}${pct !== 0 ? ` weather with ${describeRainChange(pct)} (your scenario)` : ""}`;
	// What the rotation would score on rain alone: the share of each crop's potential demand
	// that rain and stored soil water cover, averaged over its crops.
	const onRain =
		seasons.reduce(
			(sum, season) => sum + 100 * (1 - season.shortfallIn / season.demandIn),
			0,
		) / seasons.length;
	const demandPerCrop =
		seasons.reduce((sum, season) => sum + season.demandIn, 0) / seasons.length;
	const coveredPerCrop =
		seasons.reduce((sum, season) => sum + season.demandIn - season.shortfallIn, 0) /
		seasons.length;
	const coverage = `Rain and stored soil water cover about ${Math.round(onRain)} percent of potential crop demand: on average ${one(coveredPerCrop)} of ${one(demandPerCrop)} in per crop, on ${period} weather.`;
	if (mode === "irrigated") {
		const total = seasons.reduce((sum, season) => sum + season.shortfallIn, 0);
		const irrigationNeedIn = total / Math.max(1, knownYears);
		const pumping =
			100 * (1 - clamp(irrigationNeedIn / scoring.irrigationNeedCapIn, 0, 1));
		return {
			result: {
				// Angel's decision of 2026-11-14 (SPEC.md, formula 3): pumping never makes a rotation
				// fit its water better than the same rotation would on rain alone.
				score: Math.min(pumping, onRain),
				why: `Irrigating it would take about ${one(irrigationNeedIn)} in a year, which scores ${Math.round(pumping)} against a cap of ${scoring.irrigationNeedCapIn} in. ${coverage} The score is the lower of the two.${left}`,
			},
			detail: { mode, seasons, irrigationNeedIn, rainChangePct: pct },
		};
	}
	return {
		result: { score: onRain, why: `${coverage}${left}` },
		detail: { mode, seasons, irrigationNeedIn: null, rainChangePct: pct },
	};
}

function scoreHeat(
	calendar: RotationCalendar,
	recent: RecentClimate | null,
	climate: ClimateResponse,
	library: Library,
): { result: IndicatorResult; detail: HeatDetail[] } {
	if (!recent) {
		return {
			result: { score: null, why: "No monthly hot-day counts for this point." },
			detail: [],
		};
	}
	const detail: HeatDetail[] = [];
	const unknown: string[] = [];
	for (const season of calendar.seasons) {
		const months = cropOf(library, season.crop)?.heatSensitiveMonths?.value;
		if (!months) {
			unknown.push(nameOf(library, season.crop));
			continue;
		}
		const hotDaysPerMonth =
			months.reduce((sum, month) => sum + recent.hotDays[month - 1], 0) / months.length;
		detail.push({ crop: season.crop, months, hotDaysPerMonth });
	}
	if (detail.length === 0) {
		return {
			result: {
				score: null,
				why: unknown.length > 0
					? `The heat-sensitive months of ${[...new Set(unknown)].join(" and ")} are not sourced yet.`
					: "No crop of this rotation could be placed in the year.",
			},
			detail,
		};
	}
	const { hotDaysCap, risingTrendPenalty, hotDayF } = library.scoring;
	let score =
		detail.reduce(
			(sum, item) => sum + 100 * (1 - clamp(item.hotDaysPerMonth / hotDaysCap, 0, 1)),
			0,
		) / detail.length;
	const parts = [...new Map(detail.map((item) => [item.crop, item])).values()].map(
		(item) =>
			`${nameOf(library, item.crop)} ${one(item.hotDaysPerMonth)} in ${item.months.map((month) => MONTH_NAMES[month - 1]).join(" and ")}`,
	);
	let why = `Days at or above ${hotDayF}°F in each crop's sensitive month, ${recent.firstYear} to ${recent.lastYear} average: ${parts.join("; ")}.`;
	const trend = climate.trends.hotDays;
	if (trend && trend.label === "likely" && trend.perDecade > 0) {
		score = Math.max(0, score - risingTrendPenalty);
		why += ` Hot days are likely rising here, so ${risingTrendPenalty} points are taken off.`;
	}
	if (unknown.length > 0) {
		why += ` Not counted: ${[...new Set(unknown)].join(", ")} (not sourced yet).`;
	}
	return { result: { score, why }, detail };
}

/** How erodible the field is, 0 to 1: the higher of the water risk and the wind risk. */
export function erosionRisk(
	soil: Pick<SoilResponse, "kFactor" | "slopePct" | "windErodibilityIndex"> | null,
	erosion: ScoringConfig["erosion"],
): { risk: number; water: number | null; wind: number | null } | null {
	if (!soil) return null;
	const water =
		soil.kFactor !== null && soil.slopePct !== null
			? clamp((soil.kFactor * soil.slopePct) / erosion.kTimesSlopeCap, 0, 1)
			: null;
	const wind =
		soil.windErodibilityIndex !== null
			? clamp(soil.windErodibilityIndex / erosion.windIndexCap, 0, 1)
			: null;
	if (water === null && wind === null) return null;
	return { risk: Math.max(water ?? 0, wind ?? 0), water, wind };
}

function scoreSoilProtection(
	calendar: RotationCalendar,
	soil: SoilResponse | null,
	library: Library,
): IndicatorResult {
	if (calendar.bareShare === null) {
		return { score: null, why: "No month of this rotation could be placed in the year." };
	}
	const erosion = erosionRisk(soil, library.scoring.erosion);
	if (!erosion) {
		return {
			score: null,
			why: "The soil survey has no erodibility or slope for this spot, so soil protection was not worked out.",
		};
	}
	const driver =
		(erosion.wind ?? 0) >= (erosion.water ?? 0) ? "wind" : "water";
	return {
		score: 100 * (1 - calendar.bareShare * erosion.risk),
		why: `Bare in ${calendar.bareMonths} of ${calendar.knownMonths} months; erosion risk here is ${Math.round(erosion.risk * 100)} on a scale of 100, set by ${driver}.`,
	};
}

function scoreSoilBuilding(rotation: Rotation, library: Library): IndicatorResult {
	const points = library.scoring.soilBuildingPoints;
	const crops = distinctCrops(rotation)
		.map((id) => cropOf(library, id))
		.filter((crop): crop is Crop => crop !== undefined);
	if (crops.length === 0) return { score: null, why: "No crop to score." };
	const traits: [string, number, boolean][] = [
		["a nitrogen-fixing crop", points.nFixing, crops.some((crop) => crop.nFixing?.value === true)],
		["a high-residue crop", points.highResidue, crops.some((crop) => crop.residue?.value === "high")],
		["a cover crop", points.coverCrop, crops.some((crop) => crop.kind === "cover")],
		["a deep-rooted crop", points.deepRoots, crops.some((crop) => crop.rootDepth?.value === "deep")],
	];
	const present = traits.filter(([, , has]) => has);
	const score = clamp(present.reduce((sum, [, value]) => sum + value, 0), 0, 100);
	const missing = crops
		.filter((crop) => !crop.nFixing || !crop.residue || !crop.rootDepth)
		.map((crop) => crop.name.toLowerCase());
	return {
		score,
		why:
			(present.length > 0
				? `Has ${present.map(([label]) => label).join(", ")}.`
				: "Has none of the four soil-building traits: nitrogen fixing, high residue, a cover crop, deep roots.") +
			(missing.length > 0
				? ` Some traits of ${missing.join(" and ")} are not sourced yet and were not counted.`
				: ""),
	};
}

/** The crops planted in each year of the cycle, by the year they are planted in. */
function cropsByYear(rotation: Pick<Rotation, "cycleYears" | "plantings">): CropId[][] {
	const years: CropId[][] = Array.from({ length: rotation.cycleYears }, () => []);
	for (const planting of rotation.plantings) {
		const list = years[planting.plantYear - 1];
		if (list && !list.includes(planting.crop)) list.push(planting.crop);
	}
	return years;
}

/**
 * Longest run of years in a row in which the same crop is planted, going round the cycle.
 * Infinity when a crop is planted in every year: the run never ends.
 */
export function longestRun(rotation: Pick<Rotation, "cycleYears" | "plantings">): number {
	const years = cropsByYear(rotation);
	let longest = 0;
	for (const crop of distinctCrops(rotation)) {
		const planted = years.map((list) => list.includes(crop));
		if (planted.every(Boolean)) return Number.POSITIVE_INFINITY;
		// Start just after a year without the crop, so a run that wraps round is counted whole.
		const start = planted.indexOf(false);
		let run = 0;
		for (let step = 1; step <= planted.length; step += 1) {
			run = planted[(start + step) % planted.length] ? run + 1 : 0;
			longest = Math.max(longest, run);
		}
	}
	return longest;
}

/**
 * Pest and disease break (SPEC.md, formula 7): rises with the number of distinct crops,
 * falls with the longest run of the same crop. The form is the tool's own:
 * 100 x crops / (crops + 1), divided by the longest run. One crop every year scores 0.
 */
function scorePestBreak(rotation: Rotation): IndicatorResult {
	const crops = distinctCrops(rotation).length;
	if (crops === 0) return { score: null, why: "No crop to score." };
	const run = longestRun(rotation);
	if (!Number.isFinite(run)) {
		return { score: 0, why: "The same crop is planted every year, so pest cycles are never broken." };
	}
	return {
		score: (100 * crops) / (crops + 1) / run,
		why: `${crops} ${crops === 1 ? "crop" : "different crops"}; the same crop is planted at most ${run} ${run === 1 ? "year" : "years"} in a row.`,
	};
}

function scoreMarket(rotation: Rotation, library: Library): IndicatorResult {
	const sold = distinctCrops(rotation)
		.map((id) => cropOf(library, id))
		.filter((crop): crop is Crop => crop !== undefined && crop.kind !== "cover");
	if (sold.length === 0) return { score: null, why: "No crop that is sold." };
	const scores = library.scoring.marketScores;
	const score = sold.reduce((sum, crop) => sum + scores[crop.market], 0) / sold.length;
	const needsBuyer = sold.filter((crop) => crop.market !== "local");
	return {
		score,
		why:
			needsBuyer.length === 0
				? "Every crop can go to a local elevator (a tool assumption)."
				: `${needsBuyer.map((crop) => crop.name).join(" and ")} ${needsBuyer.length === 1 ? "needs" : "need"} a buyer beyond the local elevator (a tool assumption).`,
	};
}

function scoreSimplicity(
	rotation: Rotation,
	library: Library,
	constraints: Constraints,
): IndicatorResult {
	const crops = distinctCrops(rotation).length;
	if (crops === 0) return { score: null, why: "No crop to score." };
	const { perExtraCrop, missingNoTillPenalty } = library.scoring.simplicity;
	const lacksNoTill = rotation.needsNoTill && !constraints.hasNoTillEquipment;
	return {
		score: clamp(100 - perExtraCrop * (crops - 1) - (lacksNoTill ? missingNoTillPenalty : 0), 0, 100),
		why:
			`${crops} ${crops === 1 ? "crop" : "crops"} to manage.` +
			(lacksNoTill ? " It needs no-till equipment the farm does not have." : ""),
	};
}

/**
 * Scores one rotation at one field. `unknownYears` lists years of the cycle whose crop the
 * tool does not know (only the field's own rotation has any); they are left out.
 */
export function scoreRotation(
	rotation: Rotation,
	field: FieldFacts,
	library: Library,
	constraints: Constraints = DEFAULT_CONSTRAINTS,
	unknownYears: readonly number[] = [],
): RotationScore {
	const calendar = buildCalendar(rotation, library, unknownYears);
	const recent = recentClimate(field.climate);
	const knownYears = rotation.cycleYears - unknownYears.length;
	const water = scoreWater(rotation, calendar, recent, field.soil, library, constraints, knownYears);
	const heat = scoreHeat(calendar, recent, field.climate, library);
	const region = regionFor(annualRainIn(field.climate), library.scoring.regionRainBandsIn);
	return {
		rotation,
		calendar,
		indicators: {
			waterFit: water.result,
			heatExposure: heat.result,
			soilProtection: scoreSoilProtection(calendar, field.soil, library),
			soilBuilding: scoreSoilBuilding(rotation, library),
			pestBreak: scorePestBreak(rotation),
			marketFit: scoreMarket(rotation, library),
			simplicity: scoreSimplicity(rotation, library, constraints),
		},
		water: water.detail,
		heat: heat.detail,
		typicalHere:
			rotation.regions.length === 0 || region === null
				? null
				: rotation.regions.includes(region),
	};
}

/**
 * The weight of each indicator. Every indicator belongs to one slider (config), and the
 * indicators of a slider share its value equally, so four equal sliders weigh the four
 * priorities equally. With every slider at zero, all indicators count the same.
 */
export function indicatorWeights(
	priorities: Priorities,
	scoring: Pick<ScoringConfig, "priorityIndicators">,
): Record<IndicatorId, number> {
	const weights = Object.fromEntries(INDICATOR_IDS.map((id) => [id, 0])) as Record<IndicatorId, number>;
	for (const priority of PRIORITIES) {
		const indicators = scoring.priorityIndicators[priority];
		for (const id of indicators) {
			weights[id] = Math.max(0, priorities[priority]) / indicators.length;
		}
	}
	if (INDICATOR_IDS.every((id) => weights[id] === 0)) {
		for (const id of INDICATOR_IDS) weights[id] = 1;
	}
	return weights;
}

/**
 * The weighted score (SPEC.md): the sum of weight times score over the sum of weights,
 * counting only the indicators that have a score. Null when none of the weighted
 * indicators has one.
 */
export function weightedScore(
	indicators: Record<IndicatorId, IndicatorResult>,
	weights: Record<IndicatorId, number>,
): number | null {
	let total = 0;
	let weight = 0;
	for (const id of INDICATOR_IDS) {
		const score = indicators[id].score;
		if (score === null || weights[id] <= 0) continue;
		total += weights[id] * score;
		weight += weights[id];
	}
	return weight === 0 ? null : total / weight;
}

/**
 * A rotation's crop pattern in a form that can be compared: the crops planted each year,
 * reduced to the shortest pattern that repeats and turned to start at its smallest year.
 */
export function cropPattern(rotation: Pick<Rotation, "cycleYears" | "plantings">): string {
	const years = cropsByYear(rotation).map((list) => [...list].sort().join("+"));
	let period = years.length;
	for (let size = 1; size < years.length; size += 1) {
		if (years.length % size !== 0) continue;
		if (years.every((year, index) => year === years[index % size])) {
			period = size;
			break;
		}
	}
	const base = years.slice(0, period);
	const turns = base.map((_, shift) => [...base.slice(shift), ...base.slice(0, shift)].join("|"));
	return turns.sort()[0];
}

export type RankedRotation = RotationScore & {
	/** The weighted score, 0 to 100, or null when nothing could be scored. */
	total: number | null;
};

export type Ranking = {
	region: Region | null;
	/** The field's own rotation, when there is one to score. Always shown, wherever it ranks. */
	existing: RankedRotation | null;
	/**
	 * Library rotations the library lists for this field's part of Kansas, best first. When
	 * the region is not known, every rotation is here.
	 */
	candidates: RankedRotation[];
	/** Library rotations it lists only for other parts of Kansas, best first. Scored, but not suggested. */
	elsewhere: RankedRotation[];
	/** Library rotations left out because they need irrigation the farm does not have. */
	hiddenForIrrigation: Rotation[];
	/** The library rotation with the same crops as the field's own, left out of the candidates. */
	sameAsExisting: Rotation | null;
};

/** Every score the ranking needs, worked out once per field. A slider move reuses it. */
export type FieldScores = {
	region: Region | null;
	existing: RotationScore | null;
	candidates: RotationScore[];
	hiddenForIrrigation: Rotation[];
	sameAsExisting: Rotation | null;
};

export function scoreField(
	field: FieldFacts,
	library: Library,
	constraints: Constraints = DEFAULT_CONSTRAINTS,
	existing: { rotation: Rotation; unknownYears: readonly number[] } | null = null,
): FieldScores {
	const hiddenForIrrigation = library.rotations.filter(
		(rotation) => rotation.water === "irrigated" && !constraints.irrigationAvailable,
	);
	// A library rotation with the field's own crop pattern would only repeat the field's row.
	const ownPattern =
		existing && existing.unknownYears.length === 0 && existing.rotation.plantings.length > 0
			? cropPattern(existing.rotation)
			: null;
	const sameAsExisting =
		library.rotations.find((rotation) => cropPattern(rotation) === ownPattern) ?? null;
	return {
		region: regionFor(annualRainIn(field.climate), library.scoring.regionRainBandsIn),
		existing: existing
			? scoreRotation(existing.rotation, field, library, constraints, existing.unknownYears)
			: null,
		candidates: library.rotations
			.filter((rotation) => !hiddenForIrrigation.includes(rotation) && rotation !== sameAsExisting)
			.map((rotation) => scoreRotation(rotation, field, library, constraints)),
		hiddenForIrrigation,
		sameAsExisting,
	};
}

/** Applies the farmer's priorities to a field's scores and orders the candidates. */
export function rank(
	scores: FieldScores,
	priorities: Priorities,
	scoring: Pick<ScoringConfig, "priorityIndicators">,
): Ranking {
	const weights = indicatorWeights(priorities, scoring);
	const withTotal = (score: RotationScore): RankedRotation => ({
		...score,
		total: weightedScore(score.indicators, weights),
	});
	const ranked = scores.candidates.map(withTotal).sort(
		(a, b) =>
			(b.total ?? -1) - (a.total ?? -1) ||
			a.rotation.name.localeCompare(b.rotation.name),
	);
	return {
		region: scores.region,
		existing: scores.existing ? withTotal(scores.existing) : null,
		// SPEC.md gives each rotation a typical region and decides a field's region from its
		// rainfall. The tool reads that as: suggest what is usual here, and show the rest apart.
		candidates: ranked.filter((item) => item.typicalHere !== false),
		elsewhere: ranked.filter((item) => item.typicalHere === false),
		hiddenForIrrigation: scores.hiddenForIrrigation,
		sameAsExisting: scores.sameAsExisting,
	};
}
