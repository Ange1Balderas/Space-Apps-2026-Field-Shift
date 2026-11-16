// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import {
	benefitLines,
	computedAdvantages,
	evidenceLines,
	INDICATOR_LABELS,
	informationGaps,
	riskLines,
	splitSource,
	VERIFY_LOCALLY,
	whySuggested,
} from "@/lib/card-text";
import { existingRotation } from "@/lib/existing-rotation";
import { INDICATOR_IDS, LIBRARY } from "@/lib/library";
import { type RotationScore, scoreField } from "@/lib/scoring";
import type { ClimateResponse, HistoryResponse, IndicatorId, SoilResponse } from "@/lib/types";
import finney from "@/public/data/samples/finney.json";

/** A score with the given indicator values and nothing else of interest. */
function withScores(values: Partial<Record<IndicatorId, number | null>>): RotationScore {
	return {
		indicators: Object.fromEntries(
			INDICATOR_IDS.map((id) => [id, { score: values[id] ?? null, why: `no ${id}` }]),
		),
	} as unknown as RotationScore;
}

const climate = finney.climate as unknown as ClimateResponse;
const scores = scoreField(
	{ climate, soil: finney.soil as unknown as SoilResponse },
	LIBRARY,
	undefined,
	existingRotation((finney.history as unknown as HistoryResponse).years),
);
const wheatFallow = scores.candidates.find((score) => score.rotation.id === "wheat-fallow");
if (!wheatFallow) throw new Error("expected wheat-fallow among the candidates");

describe("whySuggested", () => {
	it("names the two indicators where the rotation beats the field's own by the most", () => {
		const candidate = withScores({ waterFit: 50.4, pestBreak: 66.7, simplicity: 80, marketFit: 100 });
		const own = withScores({ waterFit: 36, pestBreak: 0, simplicity: 100, marketFit: 100 });
		expect(whySuggested(candidate, own)).toBe(
			"Scores higher than your current rotation on pest and disease break (67 against 0) and on water fit (50 against 36).",
		);
	});

	it("says so when it beats the field's own on nothing, or when there is nothing to compare with", () => {
		const same = withScores({ waterFit: 40 });
		expect(whySuggested(same, same)).toBe(
			"It does not score higher than your current rotation on any indicator.",
		);
		expect(whySuggested(same, null)).toBe("There is no current rotation to compare it with.");
		// An indicator with no score on either side is not compared.
		expect(whySuggested(withScores({ waterFit: 90 }), withScores({ waterFit: null }))).toMatch(/does not score higher/);
	});
});

describe("splitSource", () => {
	it("splits a source into its words and its links, and names each link's site", () => {
		expect(
			splitSource(
				"K-State, The Value of Crop Residue (MF2604). https://bookstore.ksre.ksu.edu/download/x_MF2604 ; USDA NRCS sheet. https://www.mssoy.org/a.pdf",
			),
		).toEqual([
			{ text: "K-State, The Value of Crop Residue (MF2604)." },
			{ url: "https://bookstore.ksre.ksu.edu/download/x_MF2604", host: "bookstore.ksre.ksu.edu" },
			{ text: "USDA NRCS sheet." },
			{ url: "https://www.mssoy.org/a.pdf", host: "mssoy.org" },
		]);
		// Two links joined by "and", and a link that ends a sentence inside brackets.
		expect(
			splitSource("See https://a.example/1.pdf and https://b.example/2.pdf (also https://c.example/3)."),
		).toEqual([
			{ text: "See" },
			{ url: "https://a.example/1.pdf", host: "a.example" },
			{ text: "and" },
			{ url: "https://b.example/2.pdf", host: "b.example" },
			{ text: "(also" },
			{ url: "https://c.example/3", host: "c.example" },
			{ text: ")." },
		]);
		expect(splitSource("no link here")).toEqual([{ text: "no link here" }]);
	});

	it("finds a well-formed link in every source of the data files", () => {
		const sources: string[] = [];
		for (const crop of LIBRARY.crops) {
			for (const value of [crop.kc, crop.stageDays, crop.heatSensitiveMonths, crop.nFixing, crop.residue, crop.rootDepth]) {
				if (value) sources.push(value.source);
			}
		}
		for (const dates of Object.values(LIBRARY.calendar)) if (dates) sources.push(dates.source);
		for (const rotation of LIBRARY.rotations) {
			for (const item of [...rotation.benefits, ...rotation.risks]) sources.push(item.source);
		}
		for (const value of [LIBRARY.scoring.effectiveRainFraction, LIBRARY.scoring.fallowEfficiency]) {
			if (value) sources.push(value.source);
		}
		expect(sources.length).toBeGreaterThan(30);
		for (const source of sources) {
			const links = splitSource(source).flatMap((part) => ("url" in part ? [part] : []));
			expect(links.length, source).toBeGreaterThan(0);
			for (const link of links) {
				expect(() => new URL(link.url), link.url).not.toThrow();
				expect(link.host, link.url).toMatch(/\.(org|edu|gov|com)$/);
				expect(link.url, link.url).not.toMatch(/[.,;)]$/);
			}
		}
	});
});

describe("computedAdvantages", () => {
	const own = scores.existing;
	if (!own) throw new Error("expected the field's own rotation");

	it("says when the field is bare for less of the cycle", () => {
		// The Finney field is corn every year: bare in 56 of 96 months. Continuous wheat is bare in 3 of 12.
		const wheat = scores.candidates.find((score) => score.rotation.id === "continuous-wheat");
		if (!wheat) throw new Error("expected continuous wheat");
		expect(computedAdvantages(wheat, own)).toEqual([
			{
				text: "The field is bare for less of the cycle than under your current rotation: 3 of 12 months against 56 of 96.",
				source: "USDA NASS usual planting and harvesting dates",
			},
		]);
		// Wheat-fallow is bare for more of the cycle, so nothing is claimed for it.
		expect(computedAdvantages(wheatFallow, own)).toEqual([]);
		expect(computedAdvantages(wheat, null)).toEqual([]);
		expect(benefitLines(wheat, own)).toHaveLength(wheat.rotation.benefits.length + 1);
	});

	it("says how much less irrigation it would take, when both are irrigated", () => {
		const need = (inches: number) =>
			({
				...own,
				calendar: { ...own.calendar, bareShare: null },
				water: { mode: "irrigated", seasons: [], irrigationNeedIn: inches, rainChangePct: 0 },
			}) as typeof own;
		expect(computedAdvantages(need(12.3), need(20.7))).toEqual([
			{
				text: "Irrigating it would take about 8.4 in less water a year than your current rotation: 12.3 in against 20.7 in.",
				source: "NASA POWER rain and weather, FAO-56 method and crop coefficients",
			},
		]);
		expect(computedAdvantages(need(20.7), need(12.3))).toEqual([]);
	});
});

describe("the card lines for wheat-fallow at the Finney County sample", () => {
	it("give the numbers behind the scores, each with where it comes from", () => {
		const lines = evidenceLines(wheatFallow, LIBRARY);
		expect(lines[0].text).toMatch(
			/^Winter wheat: potential water demand \d+\.\d in\. Since \d{4}: (likely trend|possible trend|no clear trend), .* per decade \(Mann-Kendall p = .*, \d+ years\)\. Rain in its season \d+\.\d in/,
		);
		expect(lines[0].source).toMatch(/NASA POWER/);
		expect(lines.some((line) => /days a year at or above 95°F in June/.test(line.text))).toBe(true);
		expect(lines[lines.length - 1].text).toBe("The field is bare in 15 of the cycle's 24 months.");
		for (const line of lines) expect(line.source).toBeTruthy();
	});

	it("carry the library's benefits and risks with their sources, and every risk ends the same way", () => {
		expect(benefitLines(wheatFallow)).toEqual(wheatFallow.rotation.benefits);
		const risks = riskLines(wheatFallow, climate, "west");
		expect(risks).toHaveLength(1);
		expect(risks[0].source).toMatch(/MF3066/);
		for (const risk of risks) expect(risk.text.endsWith(VERIFY_LOCALLY)).toBe(true);
	});

	it("add a rising hot-day trend and a region mismatch to the risks when the numbers show them", () => {
		const rising = { trends: { hotDays: { perDecade: 2.04, linearPerDecade: 2, pValue: 0.01, label: "likely" as const } } };
		const risks = riskLines({ ...wheatFallow, typicalHere: false }, rising, "east");
		expect(risks.map((risk) => risk.text)).toEqual([
			expect.stringContaining("14-month fallow"),
			`Hot days are likely increasing here, by about 2.0 a decade since 1981. ${VERIFY_LOCALLY}`,
			`The library lists this rotation for west Kansas; this field's rainfall puts it in the east. ${VERIFY_LOCALLY}`,
		]);
		// A possible trend is not a likely one, and is not listed.
		const possible = { trends: { hotDays: { ...rising.trends.hotDays, label: "possible" as const } } };
		expect(riskLines(wheatFallow, possible, "west")).toHaveLength(1);
	});

	it("list what the tool cannot see, and name any indicator it could not score", () => {
		const gaps = informationGaps(wheatFallow);
		expect(gaps[0]).toMatch(/local prices/);
		expect(gaps.some((gap) => /potential demand/.test(gap))).toBe(true);
		expect(gaps.some((gap) => /has no score/.test(gap))).toBe(false);
		const unscored = { ...wheatFallow, indicators: { ...wheatFallow.indicators, waterFit: { score: null, why: "No monthly rain." } } };
		expect(informationGaps(unscored)).toContain(`${INDICATOR_LABELS.waterFit} has no score: No monthly rain.`);
	});
});
