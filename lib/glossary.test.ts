// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Checks the glossary file as committed, the checks that guard it, and the function that
// finds terms in text.

import { describe, expect, it } from "vitest";
import glossaryJson from "@/data/glossary.json";
import {
	fillValues,
	GLOSSARY,
	GLOSSARY_GROUPS,
	GLOSSARY_VALUES,
	glossaryEntry,
	glossaryProblems,
	INDICATOR_TERMS,
	markTerms,
	TERM_IDS,
	type TextPart,
	unknownPlaceholders,
} from "@/lib/glossary";
import { INDICATOR_IDS, SCORING } from "@/lib/library";

/** A copy of the file that a test can break, with nothing assumed about its fields. */
type Loose = Record<string, unknown>;
const loose = (): Loose[] => JSON.parse(JSON.stringify(glossaryJson)) as Loose[];
const entryOf = (list: Loose[], id: string): Loose =>
	list.find((item) => item.id === id) as Loose;

/** The marked terms of one text, as "term:words". */
const marks = (parts: readonly TextPart[]) =>
	parts.flatMap((part) => (typeof part === "string" ? [] : [`${part.term}:${part.text}`]));

const joined = (parts: readonly TextPart[]) =>
	parts.map((part) => (typeof part === "string" ? part : part.text)).join("");

describe("the glossary file as committed", () => {
	it("has the expected shape", () => {
		expect(glossaryProblems(glossaryJson)).toEqual([]);
	});

	it("holds one entry for each term id, and at least the 8 terms SPEC.md asks for", () => {
		expect(GLOSSARY.map((entry) => entry.id).sort()).toEqual([...TERM_IDS].sort());
		expect(GLOSSARY.length).toBeGreaterThanOrEqual(8);
	});

	it("gives every published definition a source with a link and a short source name", () => {
		const published = GLOSSARY.filter((entry) => !entry.own);
		expect(published.length).toBeGreaterThan(0);
		for (const entry of published) {
			expect(entry.source, entry.id).toMatch(/https?:\/\/\S+/);
			expect(entry.sourceName, entry.id).toBeTruthy();
		}
	});

	it("marks as the tool's own every entry that has no source", () => {
		for (const entry of GLOSSARY) {
			if (entry.source === null) expect(entry.own, entry.id).toBe(true);
		}
	});

	it("leaves no name in braces unfilled", () => {
		for (const entry of GLOSSARY) {
			expect(entry.definition, entry.id).not.toMatch(/[{}]/);
			expect(entry.here ?? "", entry.id).not.toMatch(/[{}]/);
		}
	});

	it("quotes the config's own numbers", () => {
		expect(glossaryEntry("hot-day").definition).toContain(`${SCORING.hotDayF}°F`);
		expect(glossaryEntry("water-fit").definition).toContain(
			`reaching 0 at ${SCORING.irrigationNeedCapIn} in a year`,
		);
		expect(glossaryEntry("erosion-risk").definition).toContain(
			`highest at ${SCORING.erosion.windIndexCap} or more`,
		);
		expect(glossaryEntry("trend-confidence").definition).toContain("below 0.05");
		expect(glossaryEntry("trend-confidence").definition).toContain("from 0.05 to 0.20");
	});

	it("has a term for every indicator, in the group of the seven scores", () => {
		for (const id of INDICATOR_IDS) {
			expect(glossaryEntry(INDICATOR_TERMS[id]).group, id).toBe("scores");
		}
		expect(GLOSSARY.filter((entry) => entry.group === "scores")).toHaveLength(
			INDICATOR_IDS.length,
		);
	});

	it("puts every entry in a known group", () => {
		const groups: readonly string[] = GLOSSARY_GROUPS.map((group) => group.id);
		for (const entry of GLOSSARY) expect(groups, entry.id).toContain(entry.group);
	});
});

describe("glossaryProblems", () => {
	it("refuses a published definition with no source", () => {
		const broken = loose();
		entryOf(broken, "fallow").source = null;
		expect(glossaryProblems(broken).join("\n")).toContain(
			"glossary[fallow].source: a published definition needs a source with a link",
		);
	});

	it("refuses a source without a link", () => {
		const broken = loose();
		entryOf(broken, "fallow").source = "K-State MF3066";
		expect(glossaryProblems(broken).join("\n")).toContain("glossary[fallow].source");
	});

	it("refuses a name in braces that the code cannot fill", () => {
		const broken = loose();
		entryOf(broken, "hot-day").definition = "A day at or above {hotDayC} degrees.";
		expect(glossaryProblems(broken).join("\n")).toContain(
			"{hotDayC} is not a value the code can fill",
		);
	});

	it("refuses a phrase claimed by two entries, a missing term and an unknown one", () => {
		const twice = loose();
		entryOf(twice, "dryland").match = ["Fallow"];
		expect(glossaryProblems(twice).join("\n")).toContain('"Fallow" is already a phrase of fallow');

		const missing = loose().filter((item) => item.id !== "slope");
		expect(glossaryProblems(missing)).toContain("glossary: slope has 0 entries, expected one");

		const unknown = loose();
		unknown[0].id = "ndvi";
		expect(glossaryProblems(unknown).join("\n")).toContain(
			"glossary[ndvi].id: not one of the term ids",
		);
	});

	it("refuses something that is not a list", () => {
		expect(glossaryProblems({})).toEqual(["glossary: expected a list of entries"]);
	});
});

describe("fillValues", () => {
	it("fills a known name and leaves an unknown one as written", () => {
		expect(fillValues("at {a} or {b}", { a: "95" })).toBe("at 95 or {b}");
		expect(unknownPlaceholders("at {a} or {b}", { a: "95" })).toEqual(["b"]);
	});

	it("knows the hot-day threshold and the trend cut-offs", () => {
		expect(GLOSSARY_VALUES.hotDayF).toBe(String(SCORING.hotDayF));
		expect(GLOSSARY_VALUES.likelyBelowP).toBe("0.05");
		expect(GLOSSARY_VALUES.possibleUpToP).toBe("0.20");
	});
});

describe("markTerms", () => {
	it("marks a term and keeps the text whole", () => {
		const text = "Crop water demand is potential demand: what a well-watered crop would use.";
		const [parts] = markTerms([text]);
		expect(marks(parts)).toEqual(["potential-demand:potential demand"]);
		expect(joined(parts)).toBe(text);
	});

	it("prefers the longer phrase where two overlap", () => {
		const [parts] = markTerms(["Scored from monthly rain and reference evapotranspiration."]);
		expect(marks(parts)).toEqual(["reference-et:reference evapotranspiration"]);
	});

	it("marks a term once in a block, at its first use", () => {
		const [first, second] = markTerms([
			"Corn: potential water demand 26.1 in.",
			"Winter wheat: potential water demand 24.0 in.",
		]);
		expect(marks(first)).toEqual(["potential-demand:potential water demand"]);
		expect(marks(second)).toEqual([]);
		expect(joined(second)).toBe("Winter wheat: potential water demand 24.0 in.");
	});

	it("does not mark a shorter phrase inside one that was already marked", () => {
		const [, second] = markTerms([
			"Reference evapotranspiration is worked out daily.",
			"Reference evapotranspiration starts in 1984.",
		]);
		expect(marks(second)).toEqual([]);
	});

	it("ignores upper and lower case and keeps the text's own letters", () => {
		const [parts] = markTerms(["Fallow stores water. The k factor is 0.32."]);
		expect(marks(parts)).toEqual(["fallow:Fallow", "k-factor:k factor"]);
	});

	it("reads a typographic apostrophe as a plain one", () => {
		const [parts] = markTerms(["The change per decade is Sen’s slope."]);
		expect(marks(parts)).toEqual(["sens-slope:Sen’s slope"]);
	});

	it("leaves a rotation's name alone, and a word that only starts like a term", () => {
		expect(marks(markTerms(["Wheat-fallow leaves the field bare."])[0])).toEqual([]);
		expect(marks(markTerms(["Wheat-sorghum-fallow and fallow-wheat."])[0])).toEqual([]);
		expect(marks(markTerms(["The drylands of the west."])[0])).toEqual([]);
	});

	it("marks the plural it was given, not the singular inside it", () => {
		const [parts] = markTerms(["Hot days are likely increasing here."]);
		expect(marks(parts)).toEqual(["hot-day:Hot days"]);
	});

	it("carries a block on when given the same set again", () => {
		const seen = new Set<(typeof TERM_IDS)[number]>();
		const [first] = markTerms(["Scored as dryland."], { seen });
		const [second] = markTerms(["This field is scored as dryland."], { seen });
		expect(marks(first)).toEqual(["dryland:dryland"]);
		expect(marks(second)).toEqual([]);
	});

	it("returns text with no term as it came", () => {
		expect(markTerms(["3 crops to manage.", ""])).toEqual([["3 crops to manage."], []]);
	});

	it("finds a term in every sentence the cards can write about water", () => {
		const why =
			"Rain and stored soil water cover about 62 percent of potential crop demand: on average 14.9 of 24.0 in per crop, on 2016 to 2025 weather.";
		expect(marks(markTerms([why])[0])).toEqual(["potential-demand:potential crop demand"]);
	});
});
