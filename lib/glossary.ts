// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The glossary (SPEC.md, user flow step 8 and feature 10), read from data/glossary.json.
//
// Every entry is one of two kinds:
//   - a published definition, reworded in plain language, with the source it was reworded
//     from and a link to it (`own: false`);
//   - a term or rule that is the tool's own, saying what the code does (`own: true`).
// `here`, when present, says what the tool does with a published term.
//
// A number in an entry is never typed twice: text such as "{hotDayF}" is filled in from
// config/scoring.json and from the constants in the code when this module loads. The file is
// checked at the same time, so a broken entry stops the build and the tests.

import glossaryJson from "@/data/glossary.json";
import { FREEZE_F, GROWING_SEASON } from "@/lib/indicators";
import { SCORING } from "@/lib/library";
import { RECENT_YEARS } from "@/lib/scoring";
import { monthName } from "@/lib/trend-text";
import { LIKELY_BELOW_P, POSSIBLE_UP_TO_P } from "@/lib/trends";
import type { IndicatorId } from "@/lib/types";

/** Every term the app can show. A component names a term by one of these, so a typo fails the typecheck. */
export const TERM_IDS = [
	"evapotranspiration",
	"reference-et",
	"crop-coefficient",
	"potential-demand",
	"water-balance",
	"fallow",
	"dryland",
	"soil-texture",
	"available-water",
	"organic-matter",
	"slope",
	"k-factor",
	"wind-erodibility",
	"hydrologic-group",
	"erosion-risk",
	"hot-day",
	"growing-season",
	"freeze",
	"hot-window",
	"dry-window",
	"frost-window",
	"trend-confidence",
	"mann-kendall",
	"p-value",
	"sens-slope",
	"linear-slope",
	"water-fit",
	"heat-exposure",
	"soil-protection",
	"soil-building",
	"pest-break",
	"market-fit",
	"simplicity",
] as const;

export type TermId = (typeof TERM_IDS)[number];

export const GLOSSARY_GROUPS = [
	{ id: "water", title: "Water" },
	{ id: "soil", title: "Soil" },
	{ id: "climate", title: "Climate and trends" },
	{ id: "scores", title: "The seven scores" },
] as const;

export type GlossaryGroup = (typeof GLOSSARY_GROUPS)[number]["id"];

export type GlossaryEntry = {
	id: TermId;
	group: GlossaryGroup;
	/** The term as a heading, for example "Evapotranspiration (ET)". */
	term: string;
	/** Phrases to mark in running text. Empty when the term is only marked by hand. */
	match: string[];
	definition: string;
	/** What the tool does with a published term, or null. */
	here: string | null;
	/** A caution about the term itself, shown with the full entry on the About tab, or null. */
	note: string | null;
	/** True when the term or the rule is the tool's own. */
	own: boolean;
	/** A short name for the source, shown in the tooltip. */
	sourceName: string | null;
	/** The citation, with a link. Always present for a published definition. */
	source: string | null;
};

/** The glossary term that explains each indicator. */
export const INDICATOR_TERMS: Record<IndicatorId, TermId> = {
	waterFit: "water-fit",
	heatExposure: "heat-exposure",
	soilProtection: "soil-protection",
	soilBuilding: "soil-building",
	pestBreak: "pest-break",
	marketFit: "market-fit",
	simplicity: "simplicity",
};

/** The values an entry can quote, by the name it writes in braces. */
export const GLOSSARY_VALUES: Readonly<Record<string, string>> = {
	hotDayF: String(SCORING.hotDayF),
	hotDaysCap: String(SCORING.hotDaysCap),
	risingTrendPenalty: String(SCORING.risingTrendPenalty),
	irrigationNeedCapIn: String(SCORING.irrigationNeedCapIn),
	kTimesSlopeCap: String(SCORING.erosion.kTimesSlopeCap),
	windIndexCap: String(SCORING.erosion.windIndexCap),
	nFixing: String(SCORING.soilBuildingPoints.nFixing),
	highResidue: String(SCORING.soilBuildingPoints.highResidue),
	coverCrop: String(SCORING.soilBuildingPoints.coverCrop),
	deepRoots: String(SCORING.soilBuildingPoints.deepRoots),
	marketLocal: String(SCORING.marketScores.local),
	marketRegional: String(SCORING.marketScores.regional),
	marketContract: String(SCORING.marketScores.contract),
	perExtraCrop: String(SCORING.simplicity.perExtraCrop),
	missingNoTillPenalty: String(SCORING.simplicity.missingNoTillPenalty),
	likelyBelowP: LIKELY_BELOW_P.toFixed(2),
	possibleUpToP: POSSIBLE_UP_TO_P.toFixed(2),
	recentYears: String(RECENT_YEARS),
	freezeF: String(FREEZE_F),
	growingSeason: `${monthName(GROWING_SEASON.firstMonth)} to ${monthName(GROWING_SEASON.lastMonth)}`,
};

const PLACEHOLDER = /\{(\w+)\}/g;

/** The names in braces that `values` does not hold. */
export function unknownPlaceholders(
	text: string,
	values: Readonly<Record<string, string>> = GLOSSARY_VALUES,
): string[] {
	return [...text.matchAll(PLACEHOLDER)]
		.map((match) => match[1])
		.filter((name) => !(name in values));
}

/** Fills each name in braces with its value. A name that is not known is left as written. */
export function fillValues(
	text: string,
	values: Readonly<Record<string, string>> = GLOSSARY_VALUES,
): string {
	return text.replace(PLACEHOLDER, (whole, name: string) =>
		name in values ? values[name] : whole,
	);
}

type Problems = string[];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

const hasLink = (value: unknown): boolean =>
	isText(value) && /https?:\/\/\S+/.test(value);

/**
 * What is wrong with a glossary file, in plain words. An empty list means it is sound.
 * A published definition needs a source with a link and a short source name; a phrase can
 * belong to one entry only; every name in braces has to be one the code can fill.
 */
export function glossaryProblems(
	value: unknown,
	values: Readonly<Record<string, string>> = GLOSSARY_VALUES,
): Problems {
	if (!Array.isArray(value)) return ["glossary: expected a list of entries"];
	const problems: Problems = [];
	const ids: unknown[] = [];
	const phrases = new Map<string, string>();
	const groups: readonly string[] = GLOSSARY_GROUPS.map((group) => group.id);
	value.forEach((entry: unknown, index) => {
		const where = `glossary[${isRecord(entry) && isText(entry.id) ? entry.id : index}]`;
		if (!isRecord(entry)) {
			problems.push(`${where}: expected an object`);
			return;
		}
		ids.push(entry.id);
		if (!(TERM_IDS as readonly unknown[]).includes(entry.id)) {
			problems.push(`${where}.id: not one of the term ids in lib/glossary.ts`);
		}
		if (!groups.includes(entry.group as string)) {
			problems.push(`${where}.group: expected one of ${groups.join(", ")}`);
		}
		for (const key of ["term", "definition"] as const) {
			if (!isText(entry[key])) problems.push(`${where}.${key}: expected text`);
		}
		for (const key of ["here", "note"] as const) {
			if (entry[key] !== null && !isText(entry[key])) {
				problems.push(`${where}.${key}: expected null or text`);
			}
		}
		if (typeof entry.own !== "boolean") {
			problems.push(`${where}.own: expected true or false`);
		}
		if (entry.source !== null && !hasLink(entry.source)) {
			problems.push(`${where}.source: expected null or a source with a link`);
		}
		if (entry.own === false && !hasLink(entry.source)) {
			problems.push(`${where}.source: a published definition needs a source with a link`);
		}
		if ((entry.source === null) !== (entry.sourceName === null)) {
			problems.push(`${where}.sourceName: expected a short name when there is a source, and null when there is none`);
		}
		if (entry.sourceName !== null && !isText(entry.sourceName)) {
			problems.push(`${where}.sourceName: expected null or text`);
		}
		if (!Array.isArray(entry.match) || !entry.match.every(isText)) {
			problems.push(`${where}.match: expected a list of phrases`);
		} else {
			for (const phrase of entry.match) {
				const key = phrase.toLowerCase();
				const owner = phrases.get(key);
				if (owner !== undefined) {
					problems.push(`${where}.match: "${phrase}" is already a phrase of ${owner}`);
				}
				phrases.set(key, String(entry.id));
			}
		}
		for (const key of ["definition", "here", "note"] as const) {
			const text = entry[key];
			if (!isText(text)) continue;
			for (const name of unknownPlaceholders(text, values)) {
				problems.push(`${where}.${key}: {${name}} is not a value the code can fill`);
			}
		}
	});
	for (const id of TERM_IDS) {
		const count = ids.filter((item) => item === id).length;
		if (count !== 1) problems.push(`glossary: ${id} has ${count} entries, expected one`);
	}
	return problems;
}

function load(value: unknown): GlossaryEntry[] {
	const problems = glossaryProblems(value);
	if (problems.length > 0) {
		throw new Error(
			`data/glossary.json is not in the expected shape:\n  ${problems.join("\n  ")}`,
		);
	}
	return (value as GlossaryEntry[]).map((entry) => ({
		...entry,
		definition: fillValues(entry.definition),
		here: entry.here === null ? null : fillValues(entry.here),
		note: entry.note === null ? null : fillValues(entry.note),
	}));
}

export const GLOSSARY: readonly GlossaryEntry[] = load(glossaryJson);

const BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]));

export function glossaryEntry(id: TermId): GlossaryEntry {
	// Every id has exactly one entry: the load above refuses a file where one is missing.
	return BY_ID.get(id) as GlossaryEntry;
}

/** A run of text, or a glossary term found in it. */
export type TextPart = string | { term: TermId; text: string };

type Phrase = { lower: string; term: TermId };

function phrasesOf(entries: readonly Pick<GlossaryEntry, "id" | "match">[]): Phrase[] {
	return entries
		.flatMap((entry) =>
			entry.match.map((phrase) => ({ lower: phrase.toLowerCase(), term: entry.id })),
		)
		.sort((a, b) => b.lower.length - a.lower.length);
}

const PHRASES = phrasesOf(GLOSSARY);

// A letter, a digit or a hyphen continues a word, so "fallow" is not found inside
// "wheat-fallow", which is the name of a rotation, nor "hot day" inside "hot days".
const CONTINUES_WORD = /[a-z0-9-]/;

/**
 * Finds the glossary terms in pieces of text that are shown together, such as the lines of
 * one list. Each term is marked once, where it is first used; later uses stay plain text.
 * Where two phrases overlap the longer one wins, so "reference evapotranspiration" is one
 * term and not "evapotranspiration" with a word in front. Upper and lower case are the same.
 *
 * `seen` holds the terms already marked. Pass the same set again to carry on a block.
 */
export function markTerms(
	texts: readonly string[],
	options: {
		entries?: readonly Pick<GlossaryEntry, "id" | "match">[];
		seen?: Set<TermId>;
	} = {},
): TextPart[][] {
	const phrases = options.entries ? phrasesOf(options.entries) : PHRASES;
	const seen = options.seen ?? new Set<TermId>();
	return texts.map((text) => {
		// A typographic apostrophe is the same letter to the reader ("Sen's slope").
		const lower = text.toLowerCase().replaceAll("’", "'");
		const parts: TextPart[] = [];
		let plainFrom = 0;
		let at = 0;
		while (at < text.length) {
			const startsWord = at === 0 || !CONTINUES_WORD.test(lower[at - 1]);
			const found = startsWord
				? phrases.find(
						(phrase) =>
							lower.startsWith(phrase.lower, at) &&
							!CONTINUES_WORD.test(lower[at + phrase.lower.length] ?? " "),
					)
				: undefined;
			if (!found) {
				at += 1;
				continue;
			}
			const end = at + found.lower.length;
			if (!seen.has(found.term)) {
				seen.add(found.term);
				if (at > plainFrom) parts.push(text.slice(plainFrom, at));
				parts.push({ term: found.term, text: text.slice(at, end) });
				plainFrom = end;
			}
			// A phrase that is not marked again is still stepped over whole, so a shorter
			// phrase inside it is not picked up in its place.
			at = end;
		}
		if (plainFrom < text.length) parts.push(text.slice(plainFrom));
		return parts;
	});
}
