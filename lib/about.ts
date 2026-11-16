// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// What the About the data tab shows (SPEC.md, user flow step 8 and feature 10), built from
// the repo's own files so that it cannot drift from them:
//   - the sources (data/sources.json), and what each is used for, worked out from the
//     values and definitions that cite it;
//   - the tool's assumptions: every constant in config/scoring.json, with what it does;
//   - the rules the tool follows that have no constant to tune;
//   - the two slopes of every trend at a field (SPEC.md, "Comparing approaches").

import sourcesJson from "@/data/sources.json";
import { INDICATOR_LABELS, PRIORITY_LABELS, splitSource } from "@/lib/card-text";
import { GLOSSARY, type GlossaryEntry } from "@/lib/glossary";
import { CDL_CROPS } from "@/lib/existing-rotation";
import { FREEZE_F, GROWING_SEASON } from "@/lib/indicators";
import { LIBRARY, type Library, PRIORITIES } from "@/lib/library";
import { RAIN_CHANGE_RANGE, RECENT_YEARS, signedPercent } from "@/lib/scoring";
import { monthName } from "@/lib/trend-text";
import { MIN_TREND_POINTS, type TrendLabel } from "@/lib/trends";
import type { ClimateResponse, CropId, ScoringConfig } from "@/lib/types";

export const SOURCE_KINDS = [
	{
		id: "live",
		title: "Read for each field",
		note: "Fetched through this app's own server when a field is chosen. The three sample fields use saved copies.",
	},
	{
		id: "method",
		title: "Methods",
		note: "Where the calculations and the thresholds come from.",
	},
	{
		id: "library",
		title: "Crop and rotation values",
		note: "The crop values and the benefits and risks of each rotation were compiled with an AI assistant from these publications. A second AI pass checked each value against its source before it was loaded, and some wording was corrected afterwards without a new check. Which crops a rotation holds, in what order, and where in Kansas it is usual are this project's own design. Several publications were written for other places, and most of their names say where.",
	},
	{
		id: "prepared",
		title: "Prepared in advance",
		note: "Too large to read live, so a script read it once for the center of every Kansas county and the app holds one small file per county. A chosen point shows its county's file.",
	},
	{ id: "map", title: "Map", note: "" },
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number]["id"];

export type SourceLink = { label: string; url: string };

export type SourceEntry = {
	id: string;
	kind: SourceKind;
	name: string;
	links: SourceLink[];
	/** What the tool takes from it. Null when that is worked out from the values that cite it. */
	purpose: string | null;
	/** How fine the source is, for a source read for each field (SPEC.md, "Uncertainty on every number"). */
	resolution: string | null;
	/** How far to trust it for one field. */
	confidence: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

const isLink = (value: unknown): value is string =>
	isText(value) && /^https?:\/\/\S+$/.test(value);

/** What is wrong with a source list, in plain words. An empty list means it is sound. */
export function sourcesProblems(value: unknown): string[] {
	if (!Array.isArray(value)) return ["sources: expected a list of entries"];
	const problems: string[] = [];
	const ids = new Set<unknown>();
	const urls = new Map<string, string>();
	const kinds: readonly string[] = SOURCE_KINDS.map((kind) => kind.id);
	value.forEach((entry: unknown, index) => {
		const where = `sources[${isRecord(entry) && isText(entry.id) ? entry.id : index}]`;
		if (!isRecord(entry)) {
			problems.push(`${where}: expected an object`);
			return;
		}
		if (!isText(entry.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) {
			problems.push(`${where}.id: expected lower-case words joined by hyphens`);
		} else if (ids.has(entry.id)) {
			problems.push(`${where}.id: used twice`);
		}
		ids.add(entry.id);
		if (!kinds.includes(entry.kind as string)) {
			problems.push(`${where}.kind: expected one of ${kinds.join(", ")}`);
		}
		if (!isText(entry.name)) problems.push(`${where}.name: expected text`);
		if (!Array.isArray(entry.links) || entry.links.length === 0) {
			problems.push(`${where}.links: every source needs at least one link`);
		} else {
			entry.links.forEach((link: unknown, at) => {
				if (!isRecord(link) || !isText(link.label) || !isLink(link.url)) {
					problems.push(`${where}.links[${at}]: expected { label, url } with an http link`);
					return;
				}
				const owner = urls.get(link.url);
				if (owner !== undefined) {
					problems.push(`${where}.links[${at}]: ${link.url} is already listed under ${owner}`);
				}
				urls.set(link.url, String(entry.id));
			});
		}
		for (const key of ["purpose", "resolution", "confidence"] as const) {
			if (entry[key] !== null && !isText(entry[key])) {
				problems.push(`${where}.${key}: expected null or text`);
			}
		}
		if (entry.kind === "live" || entry.kind === "prepared") {
			for (const key of ["purpose", "resolution", "confidence"] as const) {
				if (!isText(entry[key])) {
					problems.push(`${where}.${key}: a source that describes a field has to state it`);
				}
			}
		}
	});
	return problems;
}

function loadSources(value: unknown): SourceEntry[] {
	const problems = sourcesProblems(value);
	if (problems.length > 0) {
		throw new Error(
			`data/sources.json is not in the expected shape:\n  ${problems.join("\n  ")}`,
		);
	}
	return value as SourceEntry[];
}

export const SOURCES: readonly SourceEntry[] = loadSources(sourcesJson);

/** The source entry that each source badge in the panel opens. */
export const SOURCE_BADGE_ENTRIES = {
	"NASA POWER": "nasa-power",
	"USDA NASS CDL": "usda-cdl",
	"USDA NRCS SSURGO": "usda-ssurgo",
	"NASA GIBS MODIS": "nasa-gibs-ndvi",
	"NASA SMAP": "nasa-smap",
} as const;

/** The id of the element that shows a source on the About tab. */
export const sourceAnchor = (id: string) => `source-${id}`;

/** The id of the element that shows a glossary term on the About tab. */
export const termAnchor = (id: string) => `term-${id}`;

/** One place where a value, a sentence or a definition cites a link. */
export type Citation = { url: string; what: string; subject: string };

const CROP_VALUES = [
	["kc", "Crop coefficients"],
	["stageDays", "Growth-stage lengths"],
	["heatSensitiveMonths", "Heat-sensitive months"],
	["nFixing", "Whether a crop fixes nitrogen"],
	["residue", "Residue class"],
	["rootDepth", "Rooting depth"],
] as const;

function linksIn(text: string | null | undefined): string[] {
	if (!text) return [];
	return splitSource(text).flatMap((part) => ("url" in part ? [part.url] : []));
}

/**
 * Every link cited by a crop value, a usual date, a rotation's benefit or risk, a sourced
 * constant or a glossary definition, with what cites it.
 */
export function citations(
	library: Library = LIBRARY,
	glossary: readonly Pick<GlossaryEntry, "term" | "source">[] = GLOSSARY,
): Citation[] {
	const found: Citation[] = [];
	const cite = (
		value: { source: string; assumption?: string } | null,
		what: string,
		subject: string,
	) => {
		if (!value) return;
		for (const url of [...linksIn(value.source), ...linksIn(value.assumption)]) {
			found.push({ url, what, subject });
		}
	};
	for (const crop of library.crops) {
		const name = crop.name.toLowerCase();
		for (const [field, what] of CROP_VALUES) cite(crop[field], what, name);
		cite(library.calendar[crop.id], "Usual planting and harvest dates", name);
	}
	for (const rotation of library.rotations) {
		for (const item of rotation.benefits) cite(item, "Benefits of a rotation", rotation.name);
		for (const item of rotation.risks) cite(item, "Risks of a rotation", rotation.name);
	}
	cite(library.scoring.effectiveRainFraction, "The usable share of rain", "");
	cite(library.scoring.fallowEfficiency, "Fallow efficiency", "");
	cite(library.scoring.soilMoisture.nearNormalZ, "The about-normal band for soil moisture", "");
	for (const entry of glossary) {
		if (entry.source) cite({ source: entry.source }, "Definitions", entry.term);
	}
	return found;
}

export const CITATIONS: readonly Citation[] = citations();

export type SourceUse = { what: string; subjects: string[] };

/** What a source is cited for, grouped: "Crop coefficients" for these crops, and so on. */
export function usesOf(
	source: Pick<SourceEntry, "links">,
	all: readonly Citation[] = CITATIONS,
): SourceUse[] {
	const urls = new Set(source.links.map((link) => link.url));
	const uses = new Map<string, string[]>();
	for (const citation of all) {
		if (!urls.has(citation.url)) continue;
		const subjects = uses.get(citation.what) ?? [];
		if (citation.subject && !subjects.includes(citation.subject)) {
			subjects.push(citation.subject);
		}
		uses.set(citation.what, subjects);
	}
	return [...uses].map(([what, subjects]) => ({ what, subjects }));
}

/** For example "Crop coefficients (corn, soybeans); residue class (corn)." */
export function describeUses(uses: readonly SourceUse[]): string {
	if (uses.length === 0) return "";
	const parts = uses.map(({ what, subjects }, index) => {
		const name = index === 0 ? what : `${what.charAt(0).toLowerCase()}${what.slice(1)}`;
		return subjects.length > 0 ? `${name} (${subjects.join(", ")})` : name;
	});
	return `${parts.join("; ")}.`;
}

/** Links that something cites but the source list does not hold. Always empty in a sound repo. */
export function unlistedLinks(
	all: readonly Citation[] = CITATIONS,
	sources: readonly Pick<SourceEntry, "links">[] = SOURCES,
): string[] {
	const listed = new Set(sources.flatMap((source) => source.links.map((link) => link.url)));
	return [...new Set(all.map((citation) => citation.url))].filter((url) => !listed.has(url));
}

/** One constant of config/scoring.json, as the About tab shows it. */
export type Assumption = {
	key: keyof ScoringConfig;
	label: string;
	/** The value in words, or "" when the text below already gives it. */
	value: string;
	/** What it does, and why this value. */
	text: string;
	/** For a number picked among published ones: where it is printed. */
	source?: string;
	/** And what the tool did with what is printed. */
	assumption?: string;
};

const NOT_SOURCED = "not sourced yet";

const percent = (share: number) => `${Math.round(share * 100)} percent`;

function listed(items: readonly string[]): string {
	if (items.length <= 1) return items.join("");
	return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Every constant the tool chose (SPEC.md: "tool assumptions, all shown on the About the
 * Data tab"). Each number is read from the config, so the words cannot disagree with it.
 * The reasons follow data/README.md.
 */
export function assumptions(library: Library = LIBRARY): Assumption[] {
	const { scoring, crops } = library;
	const [westBelow, centralBelow] = scoring.regionRainBandsIn;
	const points = scoring.soilBuildingPoints;
	const pointValues = [points.nFixing, points.highResidue, points.coverCrop, points.deepRoots];
	const sold = crops.filter((crop) => crop.kind !== "cover");
	const goesTo = (market: "local" | "regional" | "contract") =>
		sold.filter((crop) => crop.market === market).map((crop) => crop.name.toLowerCase());
	const marketPart = (market: "local" | "regional" | "contract", one: string, several: string) => {
		const names = goesTo(market);
		return names.length === 0 ? [] : [`${listed(names)} ${names.length === 1 ? one : several}`];
	};
	const marketParts = [
		...marketPart("local", "can go to a local elevator", "can go to a local elevator"),
		...marketPart("regional", "needs a regional buyer", "need a regional buyer"),
		...marketPart("contract", "is grown only on contract", "are grown only on contract"),
	];
	return [
		{
			key: "hotDayF",
			label: "Hot day",
			value: `${scoring.hotDayF}°F`,
			text: "A day counts as hot when its high is at or above this.",
		},
		{
			key: "growingSeasonMonths",
			label: "Growing season",
			value: `${monthName(GROWING_SEASON.firstMonth)} to ${monthName(GROWING_SEASON.lastMonth)}`,
			text: "The months whose rain is added up as growing-season rain. No public definition for Kansas was found, so the months are the tool's choice.",
		},
		{
			key: "regionRainBandsIn",
			label: "West, central and east Kansas",
			value: `${westBelow} and ${centralBelow} in of rain a year`,
			text: `A field counts as western Kansas when its average rain in a year, in NASA POWER's record since 1984, is below ${westBelow} in, as central below ${centralBelow} in, and as eastern from there up. The two edges are halfway between K-State's averages for the western, middle and eastern thirds of Kansas over 1895 to 2015: 20.2, 26.0 and 37.2 in. The field's figure and K-State's cover different years.`,
			source:
				"K-State, Kansas Climate Basics: Precipitation Trends and Changes in Drought (MF3335, April 2017). https://bookstore.ksre.ksu.edu/pubs/MF3335.pdf",
		},
		{
			key: "effectiveRainFraction",
			label: "Usable share of rain",
			value: scoring.effectiveRainFraction
				? percent(scoring.effectiveRainFraction.value)
				: NOT_SOURCED,
			text: "The part of the rain in a crop's season that counts toward its water supply.",
			source: scoring.effectiveRainFraction?.source,
			assumption: scoring.effectiveRainFraction?.assumption,
		},
		{
			key: "fallowEfficiency",
			label: "Fallow efficiency",
			value: scoring.fallowEfficiency ? percent(scoring.fallowEfficiency.value) : NOT_SOURCED,
			text: "The part of the rain on a bare field that counts as stored in the soil for the next crop, up to what the soil can hold.",
			source: scoring.fallowEfficiency?.source,
			assumption: scoring.fallowEfficiency?.assumption,
		},
		{
			key: "irrigationNeedCapIn",
			label: "Irrigation cap",
			value: `${scoring.irrigationNeedCapIn} in a year`,
			text: "An irrigated rotation that needs this much water or more scores 0 on water fit, and one that needs none scores 100. It is a round number, not a measured limit. An irrigated rotation also never scores higher than it would on rain alone, so its water fit is the lower of the two.",
		},
		{
			key: "hotDaysCap",
			label: "Hot days cap",
			value: `${scoring.hotDaysCap} days`,
			text: `A crop with this many hot days or more in its heat-sensitive month scores 0 on heat exposure.${scoring.hotDaysCap === 31 ? " 31 is the length of the longest month." : ""}`,
		},
		{
			key: "risingTrendPenalty",
			label: "Rising heat penalty",
			value: `${scoring.risingTrendPenalty} points`,
			text: "Taken off the heat score where hot days are likely rising.",
		},
		{
			key: "erosion",
			label: "Erosion caps",
			value: `${scoring.erosion.kTimesSlopeCap} and ${scoring.erosion.windIndexCap}`,
			text: `Erosion risk by water is the soil's K factor times its slope in percent, and counts as highest at ${scoring.erosion.kTimesSlopeCap} or more. Erosion risk by wind counts as highest at a wind erodibility index of ${scoring.erosion.windIndexCap} tons per acre per year or more.`,
		},
		{
			key: "soilBuildingPoints",
			label: "Soil building points",
			value: pointValues.every((value) => value === pointValues[0])
				? `${pointValues[0]} each`
				: listed(pointValues.map(String)),
			text: "Points for a nitrogen-fixing crop, a high-residue crop, a cover crop and a deep-rooted crop, in that order.",
		},
		{
			key: "marketScores",
			label: "Market scores",
			value: `${scoring.marketScores.local}, ${scoring.marketScores.regional} and ${scoring.marketScores.contract}`,
			text: `For a crop a local elevator takes, a crop that needs a regional buyer, and a crop grown only on contract. Which crop needs which is also the tool's assumption: ${marketParts.join(", and ")}.`,
		},
		{
			key: "simplicity",
			label: "Simplicity points",
			value: `${scoring.simplicity.perExtraCrop} and ${scoring.simplicity.missingNoTillPenalty}`,
			text: `Taken off 100: ${scoring.simplicity.perExtraCrop} for each crop after the first, and ${scoring.simplicity.missingNoTillPenalty} when the rotation needs no-till equipment the farm does not have.`,
		},
		{
			key: "priorityIndicators",
			label: "What each slider weighs",
			value: "",
			text: `${PRIORITIES.map(
				(priority) =>
					`${PRIORITY_LABELS[priority]}: ${listed(
						scoring.priorityIndicators[priority].map((id) => INDICATOR_LABELS[id].toLowerCase()),
					)}.`,
			).join(" ")} A slider's weight is shared equally between its indicators.`,
		},
		{
			key: "rainScenario",
			label: "Rain scenario range",
			value: `${signedPercent(scoring.rainScenario.minPct)} to ${signedPercent(scoring.rainScenario.maxPct)}, in steps of ${scoring.rainScenario.stepPct}`,
			text: "How far the \"What if the rain changes?\" slider can take every month's rain from the record. The range and the steps are the tool's own choices, taken from its build plan; they are a what-if, not a forecast of any kind.",
		},
		{
			key: "soilMoisture",
			label: "Soil moisture: about normal, and enough readings",
			value: scoring.soilMoisture.nearNormalZ
				? `${scoring.soilMoisture.nearNormalZ.value} standard deviations, and ${scoring.soilMoisture.minDaysPerMonth} readings`
				: `${NOT_SOURCED}, and ${scoring.soilMoisture.minDaysPerMonth} readings`,
			text: `A county's soil moisture month counts as about normal while it is within this many standard deviations of the same month's average over the other years of NASA SMAP's record; beyond that it is wetter or drier than usual. A month needs at least ${scoring.soilMoisture.minDaysPerMonth} readings of recommended quality to count at all, a round number the tool chose.`,
			source: scoring.soilMoisture.nearNormalZ?.source,
			assumption: scoring.soilMoisture.nearNormalZ?.assumption,
		},
	];
}

/** A rule the tool follows that has no constant in the config. */
export type ToolRule = { title: string; text: string };

/** How many years of crop history the field's own rotation is built from (lib/cropland.ts, HISTORY_YEARS). */
export const CROP_HISTORY_YEARS = 8;

function capitalized(text: string): string {
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/**
 * The rules the tool follows that have no constant in the config. Each says what the code
 * does: lib/scoring.ts, lib/calendar.ts, lib/crop-water.ts, lib/climate-windows.ts,
 * lib/existing-rotation.ts, lib/indicators.ts and lib/trends.ts. What depends on which crop
 * values are loaded is worked out from the library, so it stays true as values are added.
 */
export function toolRules(library: Library = LIBRARY): ToolRule[] {
	const nameOf = (id: CropId) =>
		(library.crops.find((crop) => crop.id === id)?.name ?? id).toLowerCase();

	// A perennial with no usual dates on file is in the ground the whole year it is planted
	// (lib/calendar.ts).
	const wholeYear = library.crops
		.filter((crop) => crop.kind === "perennial" && library.calendar[crop.id] === null)
		.map((crop) => crop.name.toLowerCase());

	// The crops a field's own rotation can hold, and what the tool can score for each.
	const ownCrops = [...new Set(Object.values(CDL_CROPS).flat())];
	const missingFor = (id: CropId): string[] => {
		const crop = library.crops.find((item) => item.id === id);
		const parts: string[] = [];
		// Water demand needs the crop coefficients and the stage lengths (lib/crop-water.ts).
		if (!crop?.kc || !crop.stageDays) parts.push("water fit");
		// Heat exposure needs the heat-sensitive months (lib/scoring.ts).
		if (!crop?.heatSensitiveMonths) parts.push("heat exposure");
		return parts;
	};
	const complete = ownCrops.filter((id) => missingFor(id).length === 0).map(nameOf);
	const partly = ownCrops
		.filter((id) => missingFor(id).length > 0)
		.map(
			(id) =>
				` For ${nameOf(id)} some values are not sourced yet, so its years are not counted in ${missingFor(id).join(" or ")}.`,
		)
		.join("");

	return [
		{
			title: "Recent weather",
			text: `Water fit and heat exposure use the average of the last ${RECENT_YEARS} full years on record, not the whole record. Two things follow the whole record instead: the penalty for rising heat, and the trend of each crop's potential water demand on its evidence line, worked out year by year from the first year with reference evapotranspiration (1984 in NASA POWER's answers) and tested the same way as the climate charts.`,
		},
		{
			title: "A crop's season",
			text: `A crop is taken to be in the ground from the middle of its usual planting window to the middle of its usual harvest window, on USDA's most active dates for Kansas. FAO-56's growth-stage rows are not labelled for Kansas, so their lengths are stretched or shrunk in proportion until they fill that season.${
				wholeYear.length > 0
					? ` ${capitalized(listed(wholeYear))} ${wholeYear.length === 1 ? "has" : "have"} no usual dates on file and ${wholeYear.length === 1 ? "is" : "are"} taken to be in the ground the whole year ${wholeYear.length === 1 ? "it is" : "they are"} planted.`
					: ""
			}`,
		},
		{
			title: "Crop months and bare months",
			text: "A month counts as a crop month when a crop is in the ground for at least half of it. Otherwise it is bare. In a year whose crop the tool does not know, the months are marked as not known. Water is counted by days, not by these months, and every year is taken as 365 days.",
		},
		{
			title: "Hot, dry and frost windows",
			text: "The three rows at the top of a field calendar. Each has its own rule, given in the glossary below, and none of them changes a score.",
		},
		{
			title: "Which rotations are ranked",
			text: "The library lists each rotation for one or more parts of Kansas. Only the rotations listed for the field's part are ranked. The others are scored the same way and shown apart. A rotation that needs irrigation is left out until the switch says the field can be irrigated. A library rotation with the same crops as the field's own is left out, because it would repeat that card.",
		},
		{
			title: "Your current rotation",
			text: `Built from up to ${CROP_HISTORY_YEARS} years of the Cropland Data Layer and your corrections, taken as one cycle that repeats. The tool has the values it needs for ${listed(complete)}.${partly} Fallow counts as a year with no planting, and the three double-crop classes of winter wheat with soybeans, corn or sorghum are read as two crops in one year. A year with any other crop, or with none on record, is named and left out of the score. Winter wheat seen in a year is taken as planted the fall before.`,
		},
		{
			title: "Pest and disease break",
			text: "100 times the number of different crops, divided by that number plus one, then divided by the longest run of years in which the same crop is planted. The form is the tool's own.",
		},
		{
			title: "Freeze day",
			text: `A day whose low is ${FREEZE_F}°F or below. The National Weather Service's definition also asks for a widespread area and "a climatologically significant period of time". The tool's rule is simpler: one day in NASA POWER's grid cell.`,
		},
		{
			title: "Trend test",
			text: `A series needs at least ${MIN_TREND_POINTS} complete years to be tested. The p-value is two-sided, because the tool does not know in advance which way a series is heading. EPA's worked examples test one direction at a time.`,
		},
		{
			title: "Rain scenario",
			text: `The "What if the rain changes?" slider scales every month's rain in the recent average by the percent chosen, from ${signedPercent(RAIN_CHANGE_RANGE.min)} to ${signedPercent(RAIN_CHANGE_RANGE.max)} in steps of ${RAIN_CHANGE_RANGE.step}, before the water budget, so only water fit changes. The range, the steps and the same change in every month are the tool's own choices, taken from its build plan; they are a what-if, not a forecast. Evaporative demand, the record itself, the charts, the climate windows and the field's region are left as recorded. The temperature half of the plan's scenario is not built: it would need each day's temperatures in the browser, which the climate answer does not carry.`,
		},
		{
			title: "Soil moisture month",
			text: "The soil moisture shown is the last full calendar month of NASA SMAP's record that has enough readings, set against the same month in the other years. The reading is the satellite's 6 a.m. pass at the center of the county; the 6 p.m. pass is not used, a choice of the tool's, since the product's user guide states no preference and one reading a day keeps the months comparable. A day counts when its quality flag is 0 or 8, the two values the user guide calls high quality. A z-score needs at least three other years with that month; with fewer, the month is shown without a label.",
		},
	];
}

/** The rules as the app shows them, for the library as loaded. */
export const TOOL_RULES: readonly ToolRule[] = toolRules();

const SLOPE_SERIES = [
	{ id: "hotDays", name: "Hot days", unit: "days" },
	{ id: "seasonRainIn", name: "Growing-season rain", unit: "in" },
	{ id: "meanTempF", name: "Average temperature of the year", unit: "°F" },
	{ id: "lastSpringFreezeDoy", name: "Last spring freeze", unit: "days" },
	{ id: "firstFallFreezeDoy", name: "First fall freeze", unit: "days" },
] as const;

/** The two slopes of one yearly series, both per decade. */
export type SlopeRow = {
	id: (typeof SLOPE_SERIES)[number]["id"];
	name: string;
	unit: string;
	/** Sen's slope: the one the tool reports. */
	sensPerDecade: number;
	/** The least-squares regression slope, for comparison. */
	linearPerDecade: number;
	pValue: number;
	label: TrendLabel;
	/** How many years have a value in this series. */
	years: number;
};

/** The series at a field that have a trend, with both slopes (SPEC.md, "Comparing approaches"). */
export function slopeRows(climate: Pick<ClimateResponse, "years" | "trends">): SlopeRow[] {
	return SLOPE_SERIES.flatMap((series) => {
		const trend = climate.trends[series.id];
		if (!trend) return [];
		return [
			{
				...series,
				sensPerDecade: trend.perDecade,
				linearPerDecade: trend.linearPerDecade,
				pValue: trend.pValue,
				label: trend.label,
				years: climate.years.filter((row) => row[series.id] !== null).length,
			},
		];
	});
}

/** A slope with its sign, for example "+1.42 days" or "−0.30 in". Zero has no sign. */
export function formatSlope(value: number, unit: string): string {
	const size = Math.abs(value).toFixed(2);
	const sign = Number(size) === 0 ? "" : value > 0 ? "+" : "−";
	return `${sign}${size} ${unit}`;
}

/** How many pairs of years a record of this many years has: n(n-1)/2 (EPA QA/G-9, 4.3.3.1). */
export function pairCount(years: number): number {
	return (years * (years - 1)) / 2;
}
