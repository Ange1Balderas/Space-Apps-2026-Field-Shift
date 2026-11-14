// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The class codes are the Cropland Data Layer's: 1 corn, 4 sorghum, 5 soybeans, 24 winter
// wheat, 26 winter wheat then soybeans, 36 alfalfa, 61 fallow, 176 grassland or pasture.

import { describe, expect, it } from "vitest";
import { existingRotation } from "@/lib/existing-rotation";
import { LIBRARY } from "@/lib/library";
import { scoreRotation } from "@/lib/scoring";
import type { ClimateResponse, SoilResponse } from "@/lib/types";
import finney from "@/public/data/samples/finney.json";

const years = (codes: (number | null)[], first = 2018) =>
	codes.map((cdlCode, index) => ({ year: first + index, cdlCode }));

describe("existingRotation", () => {
	it("turns corn every year into one planting a year", () => {
		const own = existingRotation(years([1, 1, 1]));
		expect(own?.rotation.cycleYears).toBe(3);
		expect(own?.rotation.plantings).toEqual([
			{ crop: "corn", plantYear: 1 },
			{ crop: "corn", plantYear: 2 },
			{ crop: "corn", plantYear: 3 },
		]);
		expect(own?.rotation.water).toBe("either");
		expect(own).toMatchObject({ unknownYears: [], leftOut: [], scoredYears: 3, totalYears: 3 });
	});

	it("plants winter wheat the fall before the year it is seen, round the cycle", () => {
		// The Thomas County sample: wheat and fallow in turn, then sorghum.
		const own = existingRotation(years([24, 61, 24, 61, 24, 61, 24, 4]));
		expect(own?.rotation.plantings).toEqual([
			{ crop: "winter_wheat", plantYear: 8 },
			{ crop: "winter_wheat", plantYear: 2 },
			{ crop: "winter_wheat", plantYear: 4 },
			{ crop: "winter_wheat", plantYear: 6 },
			{ crop: "grain_sorghum", plantYear: 8 },
		]);
		expect(own?.scoredYears).toBe(8);
	});

	it("treats a fallow year as a year with no planting", () => {
		const own = existingRotation(years([61, 61]));
		expect(own?.rotation.plantings).toEqual([]);
		expect(own?.scoredYears).toBe(2);
	});

	it("maps a wheat double-crop class to wheat and the second crop in the same year", () => {
		const own = existingRotation(years([1, 26]));
		expect(own?.rotation.plantings).toEqual([
			{ crop: "corn", plantYear: 1 },
			{ crop: "winter_wheat", plantYear: 1 },
			{ crop: "soybean", plantYear: 2 },
		]);
	});

	it("names a year whose class has no crop id and leaves it out of the score", () => {
		const own = existingRotation(years([1, 176, 1, null]));
		expect(own?.unknownYears).toEqual([2, 4]);
		expect(own?.leftOut).toEqual([
			{ year: 2019, cdlCode: 176 },
			{ year: 2021, cdlCode: null },
		]);
		expect(own).toMatchObject({ scoredYears: 2, totalYears: 4 });
		// Classes the decision leaves unmapped, although their names hold crops the tool knows.
		expect(existingRotation(years([238]))?.unknownYears).toEqual([1]);
		expect(existingRotation(years([241]))?.unknownYears).toEqual([1]);
	});

	it("orders the years itself and is null with no years", () => {
		const own = existingRotation([
			{ year: 2020, cdlCode: 5 },
			{ year: 2019, cdlCode: 1 },
		]);
		expect(own?.rotation.plantings).toEqual([
			{ crop: "corn", plantYear: 1 },
			{ crop: "soybean", plantYear: 2 },
		]);
		expect(existingRotation([])).toBeNull();
	});

	it("is scored on the years it knows: an unknown year is neither crop nor bare", () => {
		const field = {
			climate: finney.climate as unknown as ClimateResponse,
			soil: finney.soil as unknown as SoilResponse,
		};
		const own = existingRotation(years([1, 176, 1, 1]));
		if (!own) throw new Error("expected a rotation");
		const score = scoreRotation(own.rotation, field, LIBRARY, undefined, own.unknownYears);
		expect(score.calendar.knownMonths).toBe(36);
		// Corn covers May to September in each of its three years: 21 bare months of 36.
		expect(score.calendar.bareMonths).toBe(21);
		expect(score.indicators.waterFit.score).not.toBeNull();
		// With every year unknown there is nothing to score, and no score is made up.
		const none = existingRotation(years([176, 176]));
		if (!none) throw new Error("expected a rotation");
		const empty = scoreRotation(none.rotation, field, LIBRARY, undefined, none.unknownYears);
		expect(Object.values(empty.indicators).map((item) => item.score)).toEqual(Array(7).fill(null));
	});
});
