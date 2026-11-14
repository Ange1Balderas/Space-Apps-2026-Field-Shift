// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import {
	benefitLines,
	evidenceLines,
	INDICATOR_LABELS,
	informationGaps,
	riskLines,
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

describe("the card lines for wheat-fallow at the Finney County sample", () => {
	it("give the numbers behind the scores, each with where it comes from", () => {
		const lines = evidenceLines(wheatFallow, LIBRARY);
		expect(lines[0].text).toMatch(/^Winter wheat: potential water demand \d+\.\d in\. Rain in its season \d+\.\d in/);
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
