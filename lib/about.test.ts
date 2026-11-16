// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Checks what the About the data tab is built from: the source list as committed, that
// nothing the tool cites is missing from it, that every constant is explained with its own
// number, and the two-slope table.

import { describe, expect, it } from "vitest";
import sourcesJson from "@/data/sources.json";
import {
	assumptions,
	CITATIONS,
	citations,
	describeUses,
	formatSlope,
	CROP_HISTORY_YEARS,
	pairCount,
	SOURCE_BADGE_ENTRIES,
	SOURCE_KINDS,
	SOURCES,
	slopeRows,
	sourcesProblems,
	TOOL_RULES,
	toolRules,
	unlistedLinks,
	usesOf,
} from "@/lib/about";
import { GLOSSARY } from "@/lib/glossary";
import { HISTORY_YEARS } from "@/lib/cropland";
import { FREEZE_F } from "@/lib/indicators";
import { LIBRARY, SCORING } from "@/lib/library";
import { RECENT_YEARS } from "@/lib/scoring";
import { MIN_TREND_POINTS } from "@/lib/trends";
import type { ClimateResponse } from "@/lib/types";
import brown from "@/public/data/samples/brown.json";
import finney from "@/public/data/samples/finney.json";
import thomas from "@/public/data/samples/thomas.json";

const sampleClimates = {
	finney: finney.climate,
	thomas: thomas.climate,
	brown: brown.climate,
} as unknown as Record<string, ClimateResponse>;

type Loose = Record<string, unknown>;
const loose = (): Loose[] => JSON.parse(JSON.stringify(sourcesJson)) as Loose[];
const entryOf = (list: Loose[], id: string): Loose =>
	list.find((item) => item.id === id) as Loose;

const source = (id: string) => {
	const found = SOURCES.find((entry) => entry.id === id);
	if (!found) throw new Error(`no source ${id}`);
	return found;
};

describe("the source list as committed", () => {
	it("has the expected shape", () => {
		expect(sourcesProblems(sourcesJson)).toEqual([]);
	});

	it("holds every link that a value, a sentence or a definition cites", () => {
		expect(CITATIONS.length).toBeGreaterThan(50);
		expect(unlistedLinks()).toEqual([]);
	});

	it("says what every source is for: in its own words, or through what cites it", () => {
		for (const entry of SOURCES) {
			const uses = usesOf(entry);
			expect(entry.purpose !== null || uses.length > 0, entry.id).toBe(true);
		}
	});

	it("gives the three sources read for each field a resolution and a confidence", () => {
		const live = SOURCES.filter((entry) => entry.kind === "live");
		expect(live.map((entry) => entry.id)).toEqual(["nasa-power", "usda-cdl", "usda-ssurgo"]);
		for (const entry of live) {
			expect(entry.resolution, entry.id).toBeTruthy();
			expect(entry.confidence, entry.id).toBeTruthy();
		}
	});

	it("keeps the confidence wording of SPEC.md, 'Uncertainty on every number'", () => {
		expect(source("usda-ssurgo").confidence).toBe(
			"High for soil type; the map unit can still mix soils",
		);
		expect(source("usda-cdl").confidence).toBe(
			"High; single-pixel misclassification is possible, so the farmer can edit",
		);
		expect(source("nasa-power").confidence).toBe(
			"Medium: regional climate, not a field station",
		);
		expect(source("usda-cdl").resolution).toBe("30 m pixel");
		expect(source("usda-ssurgo").resolution).toBe("Field scale");
		// SPEC.md rounds NASA POWER's grid to "about 50 km". Its own methodology page gives
		// half a degree by five eighths, which in Kansas is about 55 km, or 34 miles.
		expect(source("nasa-power").resolution).toContain("Roughly 35 miles across (about 55 km)");
	});

	it("has the entry that each source badge opens", () => {
		// The three sources read for a field, the NASA layer on the map, and the county data
		// prepared in advance.
		for (const id of Object.values(SOURCE_BADGE_ENTRIES)) {
			expect(["live", "map", "prepared"], id).toContain(source(id).kind);
		}
		expect(source(SOURCE_BADGE_ENTRIES["NASA SMAP"]).kind).toBe("prepared");
		expect(source(SOURCE_BADGE_ENTRIES["NASA SMAP"]).resolution).toBeTruthy();
		expect(source(SOURCE_BADGE_ENTRIES["NASA SMAP"]).confidence).toBe(
			"Medium: an area average, not one field",
		);
		expect(source(SOURCE_BADGE_ENTRIES["NASA GIBS MODIS"]).resolution).toContain("820 ft (250 m)");
	});

	it("puts every entry in a known group", () => {
		const kinds: readonly string[] = SOURCE_KINDS.map((kind) => kind.id);
		for (const entry of SOURCES) expect(kinds, entry.id).toContain(entry.kind);
	});
});

describe("sourcesProblems", () => {
	it("refuses a source without a link, and a link listed twice", () => {
		const noLink = loose();
		entryOf(noLink, "epa-g9").links = [];
		expect(sourcesProblems(noLink).join("\n")).toContain(
			"sources[epa-g9].links: every source needs at least one link",
		);

		const twice = loose();
		entryOf(twice, "nws-glossary").links = [
			{ label: "Again", url: "https://power.larc.nasa.gov/" },
		];
		expect(sourcesProblems(twice).join("\n")).toContain("is already listed under nasa-power");
	});

	it("refuses a source read for each field that does not say how fine it is", () => {
		const broken = loose();
		entryOf(broken, "nasa-power").resolution = null;
		expect(sourcesProblems(broken).join("\n")).toContain(
			"sources[nasa-power].resolution: a source that describes a field has to state it",
		);
	});

	it("refuses something that is not a list", () => {
		expect(sourcesProblems(null)).toEqual(["sources: expected a list of entries"]);
	});
});

describe("citations and uses", () => {
	it("finds the links of crop values, usual dates, rotations, constants and definitions", () => {
		const whats = new Set(CITATIONS.map((citation) => citation.what));
		for (const what of [
			"Crop coefficients",
			"Growth-stage lengths",
			"Heat-sensitive months",
			"Usual planting and harvest dates",
			"Benefits of a rotation",
			"Risks of a rotation",
			"The usable share of rain",
			"Fallow efficiency",
			"Definitions",
		]) {
			expect(whats, what).toContain(what);
		}
	});

	it("finds a link that is only in an assumption's words", () => {
		// The Tribune report is cited in the note on fallow efficiency, not in its source.
		const tribune = source("schlegel-2020");
		expect(usesOf(tribune)).toEqual([{ what: "Fallow efficiency", subjects: [] }]);
	});

	it("groups what a source is used for, each subject once", () => {
		const fao = usesOf(source("fao-56"));
		const coefficients = fao.find((use) => use.what === "Crop coefficients");
		expect(coefficients?.subjects).toEqual([
			"winter wheat",
			"corn",
			"grain sorghum",
			"soybeans",
			"alfalfa",
		]);
		expect(fao.map((use) => use.what)).toContain("Definitions");
	});

	it("writes the uses as one sentence", () => {
		expect(
			describeUses([
				{ what: "Crop coefficients", subjects: ["corn", "soybeans"] },
				{ what: "Residue class", subjects: [] },
			]),
		).toBe("Crop coefficients (corn, soybeans); residue class.");
		expect(describeUses([])).toBe("");
	});

	it("reports a cited link that the list does not hold", () => {
		const extra = citations(LIBRARY, [
			{ term: "Made up", source: "Nowhere. https://example.org/not-listed" },
		]);
		expect(unlistedLinks(extra)).toEqual(["https://example.org/not-listed"]);
		expect(unlistedLinks(citations(LIBRARY, GLOSSARY))).toEqual([]);
	});
});

describe("assumptions", () => {
	const all = assumptions();
	const byKey = (key: string) => {
		const found = all.find((item) => item.key === key);
		if (!found) throw new Error(`no assumption ${key}`);
		return found;
	};

	it("explains every constant in config/scoring.json, and nothing else", () => {
		expect(all.map((item) => item.key).sort()).toEqual(Object.keys(SCORING).sort());
		for (const item of all) {
			expect(item.label, item.key).toBeTruthy();
			expect(item.text.length, item.key).toBeGreaterThan(20);
		}
	});

	it("quotes the config's own numbers", () => {
		expect(byKey("hotDayF").value).toBe(`${SCORING.hotDayF}°F`);
		expect(byKey("irrigationNeedCapIn").value).toBe(`${SCORING.irrigationNeedCapIn} in a year`);
		expect(byKey("hotDaysCap").value).toBe(`${SCORING.hotDaysCap} days`);
		expect(byKey("risingTrendPenalty").value).toBe(`${SCORING.risingTrendPenalty} points`);
		expect(byKey("erosion").text).toContain(`highest at ${SCORING.erosion.kTimesSlopeCap} or more`);
		expect(byKey("simplicity").text).toContain(
			`${SCORING.simplicity.perExtraCrop} for each crop after the first`,
		);
		expect(byKey("effectiveRainFraction").value).toBe("75 percent");
		expect(byKey("fallowEfficiency").value).toBe("20 percent");
		expect(byKey("growingSeasonMonths").value).toBe("April to September");
	});

	it("shows the source and the note of a number picked among published ones", () => {
		for (const key of ["effectiveRainFraction", "fallowEfficiency"] as const) {
			expect(byKey(key).source).toBe(SCORING[key]?.source);
			expect(byKey(key).assumption).toBe(SCORING[key]?.assumption);
		}
	});

	it("says a sourced constant is not sourced yet when the config holds none", () => {
		const without = assumptions({
			...LIBRARY,
			scoring: { ...SCORING, fallowEfficiency: null },
		});
		const item = without.find((entry) => entry.key === "fallowEfficiency");
		expect(item?.value).toBe("not sourced yet");
		expect(item?.source).toBeUndefined();
	});

	it("gives region edges that are halfway between the averages it quotes", () => {
		// The sentence names K-State's averages for the three thirds of Kansas (MF3335).
		expect(byKey("regionRainBandsIn").text).toContain("20.2, 26.0 and 37.2 in");
		expect(SCORING.regionRainBandsIn[0]).toBeCloseTo((20.2 + 26.0) / 2, 5);
		expect(SCORING.regionRainBandsIn[1]).toBeCloseTo((26.0 + 37.2) / 2, 5);
	});

	it("names each slider with the indicators the config gives it", () => {
		expect(byKey("priorityIndicators").text).toBe(
			"Save water: water fit. Protect soil: soil protection and soil building. Income: heat and drought exposure, pest and disease break and market fit. Simplicity: simplicity. A slider's weight is shared equally between its indicators.",
		);
	});

	it("says which crops go to which market, from the crop file", () => {
		expect(byKey("marketScores").text).toContain(
			"winter wheat, corn, grain sorghum and soybeans can go to a local elevator, and alfalfa needs a regional buyer.",
		);
	});
});

describe("the rules with no constant", () => {
	it("quote the code's own constants", () => {
		const text = TOOL_RULES.map((rule) => rule.text).join(" ");
		expect(text).toContain(`the last ${RECENT_YEARS} full years`);
		expect(text).toContain(`${FREEZE_F}°F or below`);
		expect(text).toContain(`at least ${MIN_TREND_POINTS} complete years`);
	});

	it("say which crops the tool can score in a field's own rotation, from the crop file", () => {
		const own = TOOL_RULES.find((rule) => rule.title === "Your current rotation")?.text ?? "";
		expect(own).toContain(
			"The tool has the values it needs for corn, grain sorghum, soybeans and winter wheat.",
		);
		// Alfalfa has crop coefficients but no stage lengths and no heat-sensitive months yet.
		expect(own).toContain(
			"For alfalfa some values are not sourced yet, so its years are not counted in water fit or heat exposure.",
		);
		expect(own).toContain(`up to ${HISTORY_YEARS} years`);
		expect(CROP_HISTORY_YEARS).toBe(HISTORY_YEARS);

		// Once alfalfa is fully loaded, the sentence about it goes and it joins the list.
		const loaded = toolRules({
			...LIBRARY,
			crops: LIBRARY.crops.map((crop) =>
				crop.id === "alfalfa"
					? {
							...crop,
							stageDays: { value: { ini: 10, dev: 30, mid: 25, late: 10 }, source: "Made up for a test. https://example.org/" },
							heatSensitiveMonths: { value: [7], source: "Made up for a test. https://example.org/" },
						}
					: crop,
			),
		});
		const ownLoaded = loaded.find((rule) => rule.title === "Your current rotation")?.text ?? "";
		expect(ownLoaded).toContain("soybeans, winter wheat and alfalfa.");
		expect(ownLoaded).not.toContain("not sourced yet");
	});

	it("say that a perennial with no usual dates covers the whole year, while that is so", () => {
		const season = TOOL_RULES.find((rule) => rule.title === "A crop's season")?.text ?? "";
		expect(LIBRARY.calendar.alfalfa).toBeNull();
		expect(season).toContain(
			"Alfalfa has no usual dates on file and is taken to be in the ground the whole year it is planted.",
		);
		const dated = toolRules({
			...LIBRARY,
			calendar: {
				...LIBRARY.calendar,
				alfalfa: {
					value: { plantStart: "08-15", plantEnd: "09-15", harvestStart: "05-15", harvestEnd: "09-30" },
					source: "Made up for a test. https://example.org/",
				},
			},
		});
		expect(dated.find((rule) => rule.title === "A crop's season")?.text).not.toContain(
			"no usual dates on file",
		);
	});

	it("each have a title and a sentence", () => {
		expect(TOOL_RULES.length).toBeGreaterThan(5);
		for (const rule of TOOL_RULES) {
			expect(rule.title).toBeTruthy();
			expect(rule.text.length, rule.title).toBeGreaterThan(30);
		}
	});
});

describe("slopeRows", () => {
	it("lists both slopes of every series that has a trend, for each sample field", () => {
		for (const [name, climate] of Object.entries(sampleClimates)) {
			const rows = slopeRows(climate);
			expect(rows.length, name).toBe(Object.keys(climate.trends).length);
			expect(rows.length, name).toBe(5);
			for (const row of rows) {
				const trend = climate.trends[row.id];
				expect(row.sensPerDecade).toBe(trend.perDecade);
				expect(row.linearPerDecade).toBe(trend.linearPerDecade);
				expect(row.pValue).toBe(trend.pValue);
				expect(row.label).toBe(trend.label);
				expect(row.years).toBeGreaterThanOrEqual(MIN_TREND_POINTS);
				expect(row.years).toBeLessThanOrEqual(climate.years.length);
			}
		}
	});

	it("leaves out a series with no trend, and counts only the years that have a value", () => {
		const rows = slopeRows({
			years: [
				{ year: 2001, seasonRainIn: 10, hotDays: 3, lastSpringFreezeDoy: null, firstFallFreezeDoy: 290, meanTempF: 55 },
				{ year: 2002, seasonRainIn: 12, hotDays: 5, lastSpringFreezeDoy: 100, firstFallFreezeDoy: 291, meanTempF: 56 },
			],
			trends: {
				hotDays: { perDecade: 1.5, linearPerDecade: 2.25, pValue: 0.04, label: "likely" },
				lastSpringFreezeDoy: { perDecade: -0.5, linearPerDecade: -0.4, pValue: 0.5, label: "none" },
			},
		});
		expect(rows.map((row) => row.id)).toEqual(["hotDays", "lastSpringFreezeDoy"]);
		expect(rows[0]).toMatchObject({ name: "Hot days", unit: "days", years: 2 });
		expect(rows[1].years).toBe(1);
	});
});

describe("formatSlope and pairCount", () => {
	it("writes a slope with its sign and unit", () => {
		expect(formatSlope(1.416, "days")).toBe("+1.42 days");
		expect(formatSlope(-0.3, "in")).toBe("−0.30 in");
		expect(formatSlope(0.004, "°F")).toBe("0.00 °F");
		expect(formatSlope(-0.004, "°F")).toBe("0.00 °F");
	});

	it("counts the pairs of years as EPA's n(n-1)/2", () => {
		expect(pairCount(45)).toBe(990);
		expect(pairCount(10)).toBe(45);
	});
});
