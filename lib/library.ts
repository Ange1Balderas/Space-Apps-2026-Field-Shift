// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The rotation library and the tool's assumptions, read from the repo's own files:
//   data/crops.json       what is published about each crop (lib/types.ts, Crop)
//   data/calendar.json    usual Kansas planting and harvest dates (CropCalendar)
//   data/rotations.json   the rotations that are compared (Rotation)
//   config/scoring.json   constants the tool chose, shown as tool assumptions (ScoringConfig)
// data/README.md says where each value comes from.
//
// SPEC.md asks for "JSON schemas ... with a source field on every published value". The
// checks below are that schema, written as TypeScript: each returns a list of problems in
// plain words, and an empty list means the file is sound. They run when this module loads,
// so a broken file stops the build and the tests, not a farmer's screen.

import scoringJson from "@/config/scoring.json";
import calendarJson from "@/data/calendar.json";
import cropsJson from "@/data/crops.json";
import rotationsJson from "@/data/rotations.json";
import type {
	Crop,
	CropCalendar,
	CropId,
	IndicatorId,
	Priority,
	Rotation,
	ScoringConfig,
} from "@/lib/types";

export const CROP_IDS: readonly CropId[] = [
	"winter_wheat",
	"corn",
	"grain_sorghum",
	"soybean",
	"alfalfa",
	"cover_crop",
];

export const INDICATOR_IDS: readonly IndicatorId[] = [
	"waterFit",
	"heatExposure",
	"soilProtection",
	"soilBuilding",
	"pestBreak",
	"marketFit",
	"simplicity",
];

export const PRIORITIES: readonly Priority[] = [
	"saveWater",
	"protectSoil",
	"income",
	"simplicity",
];

const REGIONS = ["west", "central", "east"];

type Problems = string[];
type Check = (value: unknown, where: string) => Problems;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isText = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

/** A source has to point somewhere a reader can open. */
const hasLink = (value: unknown): boolean =>
	isText(value) && /https?:\/\/\S+/.test(value);

const oneOf =
	(allowed: readonly unknown[], what: string): Check =>
	(value, where) =>
		allowed.includes(value)
			? []
			: [`${where}: expected ${what}, found ${JSON.stringify(value)}`];

const numbers =
	(keys: readonly string[]): Check =>
	(value, where) => {
		if (!isRecord(value)) return [`${where}: expected an object`];
		return keys.flatMap((key) =>
			isNumber(value[key]) ? [] : [`${where}.${key}: expected a number`],
		);
	};

/**
 * `null` (not sourced yet), or a value with a source that carries a link. An `assumption`,
 * when present, has to say something.
 */
function sourced(check: Check): Check {
	return (value, where) => {
		if (value === null) return [];
		if (!isRecord(value)) {
			return [`${where}: expected null or { value, source }`];
		}
		const problems = check(value.value, `${where}.value`);
		if (!hasLink(value.source)) {
			problems.push(`${where}.source: every published value needs a source with a link`);
		}
		if (value.assumption !== undefined && !isText(value.assumption)) {
			problems.push(`${where}.assumption: when present it has to say what the tool chose`);
		}
		return problems;
	};
}

const months: Check = (value, where) =>
	Array.isArray(value) &&
	value.length > 0 &&
	value.every((month) => Number.isInteger(month) && month >= 1 && month <= 12)
		? []
		: [`${where}: expected a list of months, 1 to 12`];

const flag: Check = (value, where) =>
	typeof value === "boolean" ? [] : [`${where}: expected true or false`];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A month and day such as "09-25". 29 February is not accepted: the calendar year has 365 days. */
export function isMonthDay(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{2}-\d{2}$/.test(value)) return false;
	const month = Number(value.slice(0, 2));
	const day = Number(value.slice(3, 5));
	return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

const dates: Check = (value, where) => {
	if (!isRecord(value)) return [`${where}: expected an object`];
	return ["plantStart", "plantEnd", "harvestStart", "harvestEnd"].flatMap((key) =>
		isMonthDay(value[key])
			? []
			: [`${where}.${key}: expected a month and day such as "09-25"`],
	);
};

const cited: Check = (value, where) => {
	if (!Array.isArray(value)) return [`${where}: expected a list`];
	return value.flatMap((item, index) => {
		const at = `${where}[${index}]`;
		if (!isRecord(item)) return [`${at}: expected { text, source }`];
		return [
			...(isText(item.text) ? [] : [`${at}.text: expected a sentence`]),
			...(hasLink(item.source)
				? []
				: [`${at}.source: every claim needs a source with a link`]),
		];
	});
};

export function cropsProblems(value: unknown): Problems {
	if (!Array.isArray(value)) return ["crops: expected a list"];
	const problems: Problems = [];
	const seen = new Set<unknown>();
	value.forEach((crop, index) => {
		const at = `crops[${index}]`;
		if (!isRecord(crop)) {
			problems.push(`${at}: expected an object`);
			return;
		}
		problems.push(
			...oneOf(CROP_IDS, "a crop id")(crop.id, `${at}.id`),
			...(isText(crop.name) ? [] : [`${at}.name: expected a name`]),
			...oneOf(["summer", "winter", "perennial", "cover"], "a kind")(crop.kind, `${at}.kind`),
			...sourced(numbers(["ini", "mid", "end"]))(crop.kc, `${at}.kc`),
			...sourced(numbers(["ini", "dev", "mid", "late"]))(crop.stageDays, `${at}.stageDays`),
			...sourced(months)(crop.heatSensitiveMonths, `${at}.heatSensitiveMonths`),
			...sourced(flag)(crop.nFixing, `${at}.nFixing`),
			...sourced(oneOf(["low", "medium", "high"], "low, medium or high"))(crop.residue, `${at}.residue`),
			...sourced(oneOf(["shallow", "medium", "deep"], "shallow, medium or deep"))(crop.rootDepth, `${at}.rootDepth`),
			...oneOf(["local", "regional", "contract"], "a market")(crop.market, `${at}.market`),
		);
		if (seen.has(crop.id)) problems.push(`${at}.id: listed twice`);
		seen.add(crop.id);
	});
	for (const id of CROP_IDS) {
		if (!seen.has(id)) problems.push(`crops: no entry for ${id}`);
	}
	return problems;
}

export function calendarProblems(value: unknown): Problems {
	if (!isRecord(value)) return ["calendar: expected an object"];
	const problems = CROP_IDS.flatMap((id) =>
		id in value
			? sourced(dates)(value[id], `calendar.${id}`)
			: [`calendar: no entry for ${id}`],
	);
	for (const key of Object.keys(value)) {
		if (!CROP_IDS.includes(key as CropId)) {
			problems.push(`calendar.${key}: not a crop id`);
		}
	}
	return problems;
}

export function rotationsProblems(value: unknown): Problems {
	if (!Array.isArray(value)) return ["rotations: expected a list"];
	const problems: Problems = [];
	const seen = new Set<unknown>();
	value.forEach((rotation, index) => {
		const at = `rotations[${index}]`;
		if (!isRecord(rotation)) {
			problems.push(`${at}: expected an object`);
			return;
		}
		const cycleYears = rotation.cycleYears;
		const cycleOk = Number.isInteger(cycleYears) && (cycleYears as number) >= 1;
		problems.push(
			...(isText(rotation.id) ? [] : [`${at}.id: expected an id`]),
			...(isText(rotation.name) ? [] : [`${at}.name: expected a name`]),
			...(cycleOk ? [] : [`${at}.cycleYears: expected a whole number of years`]),
			...oneOf(["dryland", "irrigated", "either"], "dryland, irrigated or either")(rotation.water, `${at}.water`),
			...flag(rotation.needsNoTill, `${at}.needsNoTill`),
			...cited(rotation.benefits, `${at}.benefits`),
			...cited(rotation.risks, `${at}.risks`),
		);
		if (!Array.isArray(rotation.regions) || rotation.regions.some((region) => !REGIONS.includes(region))) {
			problems.push(`${at}.regions: expected a list of west, central or east`);
		}
		if (!Array.isArray(rotation.plantings) || rotation.plantings.length === 0) {
			problems.push(`${at}.plantings: expected at least one planting`);
		} else {
			rotation.plantings.forEach((planting, plantingIndex) => {
				const here = `${at}.plantings[${plantingIndex}]`;
				if (!isRecord(planting)) {
					problems.push(`${here}: expected { crop, plantYear }`);
					return;
				}
				problems.push(...oneOf(CROP_IDS, "a crop id")(planting.crop, `${here}.crop`));
				const year = planting.plantYear;
				if (!Number.isInteger(year) || (year as number) < 1 || (cycleOk && (year as number) > (cycleYears as number))) {
					problems.push(`${here}.plantYear: expected a year of the cycle, 1 to ${String(cycleYears)}`);
				}
			});
		}
		if (seen.has(rotation.id)) problems.push(`${at}.id: listed twice`);
		seen.add(rotation.id);
	});
	return problems;
}

export function scoringProblems(value: unknown): Problems {
	if (!isRecord(value)) return ["scoring: expected an object"];
	const problems: Problems = [];
	const positive = (key: string) => {
		const found = value[key];
		if (!isNumber(found) || found <= 0) {
			problems.push(`scoring.${key}: expected a number above zero`);
		}
	};
	const share: Check = (found, where) =>
		isNumber(found) && found > 0 && found <= 1
			? []
			: [`${where}: expected a share between 0 and 1`];

	positive("hotDayF");
	positive("irrigationNeedCapIn");
	positive("hotDaysCap");
	if (!isNumber(value.risingTrendPenalty) || value.risingTrendPenalty < 0) {
		problems.push("scoring.risingTrendPenalty: expected a number, zero or more");
	}
	const bands = value.regionRainBandsIn;
	if (!Array.isArray(bands) || bands.length !== 2 || !bands.every(isNumber) || bands[0] >= bands[1]) {
		problems.push("scoring.regionRainBandsIn: expected two rising numbers of inches");
	}
	const season = value.growingSeasonMonths;
	if (
		!Array.isArray(season) ||
		season.length !== 2 ||
		!season.every((month) => Number.isInteger(month) && month >= 1 && month <= 12) ||
		season[0] > season[1]
	) {
		problems.push("scoring.growingSeasonMonths: expected a first and a last month, 1 to 12");
	}
	problems.push(
		...sourced(share)(value.effectiveRainFraction, "scoring.effectiveRainFraction"),
		...sourced(share)(value.fallowEfficiency, "scoring.fallowEfficiency"),
		...numbers(["kTimesSlopeCap", "windIndexCap"])(value.erosion, "scoring.erosion"),
		...numbers(["nFixing", "highResidue", "coverCrop", "deepRoots"])(value.soilBuildingPoints, "scoring.soilBuildingPoints"),
		...numbers(["local", "regional", "contract"])(value.marketScores, "scoring.marketScores"),
		...numbers(["perExtraCrop", "missingNoTillPenalty"])(value.simplicity, "scoring.simplicity"),
	);

	// Each indicator is weighed by exactly one slider, so no indicator is counted twice or lost.
	const map = value.priorityIndicators;
	if (!isRecord(map)) {
		problems.push("scoring.priorityIndicators: expected an object");
	} else {
		const used: unknown[] = [];
		for (const priority of PRIORITIES) {
			const list = map[priority];
			if (!Array.isArray(list) || list.length === 0) {
				problems.push(`scoring.priorityIndicators.${priority}: expected a list of indicators`);
			} else {
				used.push(...list);
			}
		}
		for (const id of INDICATOR_IDS) {
			const count = used.filter((item) => item === id).length;
			if (count !== 1) {
				problems.push(`scoring.priorityIndicators: ${id} is listed ${count} times, expected once`);
			}
		}
		for (const item of used) {
			if (!INDICATOR_IDS.includes(item as IndicatorId)) {
				problems.push(`scoring.priorityIndicators: ${JSON.stringify(item)} is not an indicator`);
			}
		}
	}
	return problems;
}

function load<T>(file: string, value: unknown, check: (value: unknown) => Problems): T {
	const problems = check(value);
	if (problems.length > 0) {
		throw new Error(`${file} is not in the expected shape:\n  ${problems.join("\n  ")}`);
	}
	return value as T;
}

export const CROPS = load<Crop[]>("data/crops.json", cropsJson, cropsProblems);
export const CALENDAR = load<CropCalendar>("data/calendar.json", calendarJson, calendarProblems);
export const ROTATIONS = load<Rotation[]>("data/rotations.json", rotationsJson, rotationsProblems);
export const SCORING = load<ScoringConfig>("config/scoring.json", scoringJson, scoringProblems);

/** Everything a score is worked out from, so tests can pass their own. */
export type Library = {
	crops: readonly Crop[];
	calendar: CropCalendar;
	rotations: readonly Rotation[];
	scoring: ScoringConfig;
};

export const LIBRARY: Library = {
	crops: CROPS,
	calendar: CALENDAR,
	rotations: ROTATIONS,
	scoring: SCORING,
};

export function findCrop(crops: readonly Crop[], id: CropId): Crop | undefined {
	return crops.find((crop) => crop.id === id);
}
