// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import { evidenceLines } from "@/lib/card-text";
import { LIBRARY } from "@/lib/library";
import { demandTrend, scoreRotation } from "@/lib/scoring";
import { MIN_TREND_POINTS } from "@/lib/trends";
import type { ClimateResponse, SoilResponse } from "@/lib/types";
import finney from "@/public/data/samples/finney.json";

const field = {
	climate: finney.climate as ClimateResponse,
	soil: finney.soil as SoilResponse,
};
const wheat = LIBRARY.rotations.find((rotation) => rotation.id === "continuous-wheat");
if (!wheat) throw new Error("continuous-wheat is not in the library");

describe("the trend of a crop's potential water demand", () => {
	it("is worked out from the years with reference ET and tested like the charts", () => {
		const score = scoreRotation(wheat, field, LIBRARY);
		const season = score.water?.seasons[0];
		expect(season?.demandTrend).not.toBeNull();
		const trend = season?.demandTrend;
		if (!trend) return;
		// NASA POWER's sunlight, and so reference ET, starts in 1984 in the answers received.
		expect(trend.firstYear).toBeGreaterThanOrEqual(1984);
		expect(trend.lastYear).toBeLessThanOrEqual(new Date().getFullYear());
		expect(trend.years).toBeGreaterThanOrEqual(MIN_TREND_POINTS);
		expect(["likely", "possible", "none"]).toContain(trend.label);
		expect(trend.pValue).toBeGreaterThanOrEqual(0);
		expect(trend.pValue).toBeLessThanOrEqual(1);
		expect(Number.isFinite(trend.perDecade)).toBe(true);
	});

	it("is null with too few years", () => {
		const season = { startDay: 100, lengthDays: 120 };
		const crop = LIBRARY.crops.find((item) => item.id === "corn");
		if (!crop) throw new Error("no corn");
		const short = {
			monthlyByYear: field.climate.monthlyByYear.filter((row) => row.year >= 2020),
		};
		expect(demandTrend(season, crop, short)).toBeNull();
	});

	it("is said on the evidence line, with the test's p-value and the years", () => {
		const score = scoreRotation(wheat, field, LIBRARY);
		const line = evidenceLines(score, LIBRARY)[0].text;
		expect(line).toMatch(/potential water demand [\d.]+ in\. Since \d{4}: (likely trend|possible trend|no clear trend), /);
		expect(line).toMatch(/Mann-Kendall p = /);
		expect(line).toMatch(/\d+ years\)\./);
	});
});
