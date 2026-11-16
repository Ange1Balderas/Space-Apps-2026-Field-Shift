// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import { evidenceLines } from "@/lib/card-text";
import { LIBRARY } from "@/lib/library";
import {
	DEFAULT_CONSTRAINTS,
	describeRainChange,
	RAIN_CHANGE_RANGE,
	rainChangeOf,
	rainFactor,
	scoreRotation,
	signedPercent,
} from "@/lib/scoring";
import type { ClimateResponse, SoilResponse } from "@/lib/types";
import finney from "@/public/data/samples/finney.json";

const field = {
	climate: finney.climate as ClimateResponse,
	soil: finney.soil as SoilResponse,
};
const wheat = LIBRARY.rotations.find((rotation) => rotation.id === "continuous-wheat");
if (!wheat) throw new Error("continuous-wheat is not in the library");

const waterFit = (pct: number | undefined) =>
	scoreRotation(wheat, field, LIBRARY, { ...DEFAULT_CONSTRAINTS, rainChangePct: pct }).indicators
		.waterFit.score;

describe("the rain scenario", () => {
	it("is a factor on the rain: 1 for the record, 0.7 at -30, 1.1 at +10, and clamped", () => {
		expect(rainFactor({ rainChangePct: 0 })).toBe(1);
		expect(rainFactor({})).toBe(1);
		expect(rainFactor({ rainChangePct: -30 })).toBeCloseTo(0.7);
		expect(rainFactor({ rainChangePct: 10 })).toBeCloseTo(1.1);
		expect(rainFactor({ rainChangePct: -90 })).toBeCloseTo(1 + RAIN_CHANGE_RANGE.min / 100);
		expect(rainFactor({ rainChangePct: 50 })).toBeCloseTo(1 + RAIN_CHANGE_RANGE.max / 100);
	});

	it("leaves the score alone at 0, lowers water fit with less rain and raises it with more", () => {
		const recorded = waterFit(undefined);
		expect(recorded).not.toBeNull();
		expect(waterFit(0)).toBe(recorded);
		expect(waterFit(-30)).toBeLessThan(recorded as number);
		expect(waterFit(10)).toBeGreaterThan(recorded as number);
	});

	it("changes only water fit", () => {
		const base = scoreRotation(wheat, field, LIBRARY);
		const dry = scoreRotation(wheat, field, LIBRARY, { ...DEFAULT_CONSTRAINTS, rainChangePct: -30 });
		for (const id of ["heatExposure", "soilProtection", "soilBuilding", "pestBreak", "marketFit", "simplicity"] as const) {
			expect(dry.indicators[id].score, id).toBe(base.indicators[id].score);
		}
		// The rain in the detail is the scenario's rain, so the evidence lines say what was scored.
		expect(dry.water?.seasons[0].seasonRainIn).toBeCloseTo(
			(base.water?.seasons[0].seasonRainIn ?? 0) * 0.7,
		);
	});

	it("names the scenario wherever a scaled number is shown, and nowhere when it is off", () => {
		const base = scoreRotation(wheat, field, LIBRARY);
		const dry = scoreRotation(wheat, field, LIBRARY, { ...DEFAULT_CONSTRAINTS, rainChangePct: -20 });
		expect(base.water?.rainChangePct).toBe(0);
		expect(dry.water?.rainChangePct).toBe(-20);
		expect(dry.indicators.waterFit.why).toContain("20% less rain (your scenario)");
		expect(base.indicators.waterFit.why).not.toContain("scenario");
		const dryLines = evidenceLines(dry, LIBRARY);
		expect(dryLines[0].text).toContain("your scenario, not the record");
		expect(dryLines[0].source).toContain("scaled by your scenario");
		const baseLines = evidenceLines(base, LIBRARY);
		expect(baseLines[0].text).not.toContain("scenario");
		expect(baseLines[0].source).toBe("NASA POWER rain and weather, FAO-56 method and crop coefficients");
	});

	it("writes the words for a scenario", () => {
		expect(describeRainChange(0)).toBe("the rain as recorded");
		expect(describeRainChange(-20)).toBe("20% less rain");
		expect(describeRainChange(10)).toBe("10% more rain");
		expect(signedPercent(-30)).toBe("−30%");
		expect(signedPercent(10)).toBe("+10%");
		expect(rainChangeOf({})).toBe(0);
		expect(rainChangeOf({ rainChangePct: -45 })).toBe(-30);
	});
});
