// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Guards the cached sample files: each one must match the sample list, satisfy the three
// API contracts, and agree with what the current code gives for its own numbers.

import { describe, expect, it } from "vitest";
import { cdlClassName } from "@/lib/cdl";
import { climatePoint, isClimateResponse } from "@/lib/climate";
import { isHistoryResponse, isSoilResponse } from "@/lib/contracts";
import { HISTORY_YEARS } from "@/lib/cropland";
import { isInKansasBounds } from "@/lib/kansas";
import { POWER_FIRST_YEAR } from "@/lib/power";
import {
	cachedClimateFor,
	cachedHistoryFor,
	cachedSoilFor,
} from "@/lib/sample-data";
import { findSampleField, SAMPLE_FIELDS } from "@/lib/samples";
import { analyzeTrend } from "@/lib/trends";
import brownFile from "@/public/data/samples/brown.json";
import finneyFile from "@/public/data/samples/finney.json";
import thomasFile from "@/public/data/samples/thomas.json";

const FILES: Record<string, unknown> = {
	brown: brownFile,
	finney: finneyFile,
	thomas: thomasFile,
};
const SAMPLES = SAMPLE_FIELDS.map((sample) => [sample.id, sample] as const);

// The rule the sample points were chosen by (see lib/samples.ts): every one of the 8 years
// is a crop from SPEC.md's rotation library, one of their double crops, or fallow.
const ROTATION_LIBRARY_CODES = new Set([1, 4, 5, 24, 26, 36, 61, 225, 236]);

describe("sample fields", () => {
	it("lists the three counties SPEC.md names", () => {
		expect(SAMPLE_FIELDS.map((sample) => sample.name)).toEqual([
			"Finney County",
			"Thomas County",
			"Brown County",
		]);
		expect(findSampleField("finney")?.name).toBe("Finney County");
		expect(findSampleField("nowhere")).toBeUndefined();
	});

	it.each(SAMPLES)("%s: the cached file matches the list and the three contracts", (_id, sample) => {
		const file = FILES[sample.id] as Record<string, unknown>;
		expect(file).toMatchObject({
			id: sample.id,
			name: sample.name,
			lat: sample.lat,
			lon: sample.lon,
		});
		expect(sample.file).toBe(`/data/samples/${sample.id}.json`);
		expect(isInKansasBounds(sample.lat, sample.lon)).toBe(true);
		expect(isClimateResponse(file.climate)).toBe(true);
		expect(isHistoryResponse(file.history)).toBe(true);
		expect(isSoilResponse(file.soil)).toBe(true);
	});

	it.each(SAMPLES)("%s: the cached climate is for that point and has no gaps", (_id, sample) => {
		const climate = cachedClimateFor(sample.lat, sample.lon);
		if (!climate) throw new Error("no cached climate for the sample point");

		expect({ lat: climate.lat, lon: climate.lon }).toEqual(
			climatePoint(sample.lat, sample.lon),
		);
		const years = climate.years.map((row) => row.year);
		expect(years.length).toBeGreaterThanOrEqual(45);
		expect(years).toEqual(years.map((_, index) => POWER_FIRST_YEAR + index));
		expect(Number.isNaN(Date.parse(climate.fetchedAt))).toBe(false);
	});

	it.each(SAMPLES)("%s: the cached hot-day trend is what the trend maths gives for the cached counts", (_id, sample) => {
		const climate = cachedClimateFor(sample.lat, sample.lon);
		if (!climate) throw new Error("no cached climate for the sample point");

		// Hot-day counts are whole numbers, so the file loses nothing to rounding.
		const fresh = analyzeTrend(
			climate.years.map((row) => row.year),
			climate.years.map((row) => row.hotDays),
		);
		const cached = climate.trends.hotDays;
		expect(fresh?.label).toBe(cached.label);
		expect(fresh?.perDecade).toBeCloseTo(cached.perDecade, 3);
		expect(fresh?.linearPerDecade).toBeCloseTo(cached.linearPerDecade, 3);
		expect(fresh?.pValue).toBeCloseTo(cached.pValue, 6);
	});

	it.each(SAMPLES)("%s: the cached crop history is 8 years of library crops, named as USDA names them", (_id, sample) => {
		const history = cachedHistoryFor(sample.lat, sample.lon);
		if (!history) throw new Error("no cached crop history for the sample point");

		expect(history.years).toHaveLength(HISTORY_YEARS);
		const years = history.years.map((row) => row.year);
		expect(years).toEqual(years.map((_, index) => years[0] + index));
		for (const row of history.years) {
			expect(ROTATION_LIBRARY_CODES.has(row.cdlCode)).toBe(true);
			expect(row.crop).toBe(cdlClassName(row.cdlCode));
		}
	});

	it.each(SAMPLES)("%s: the cached soil names a map unit and has every fact", (_id, sample) => {
		const soil = cachedSoilFor(sample.lat, sample.lon);
		if (!soil) throw new Error("no cached soil for the sample point");

		expect(soil.mukey).toMatch(/^\d+$/);
		expect(soil.mapUnitName.length).toBeGreaterThan(0);
		for (const fact of [
			soil.texture,
			soil.availableWaterIn,
			soil.organicMatterPct,
			soil.kFactor,
			soil.windErodibilityIndex,
			soil.slopePct,
			soil.hydrologicGroup,
		]) {
			expect(fact).not.toBeNull();
		}
	});

	it("has nothing cached for a point that is not a sample field", () => {
		expect(cachedClimateFor(39.35, -101.05)).toBeNull();
		expect(cachedHistoryFor(39.35, -101.05)).toBeNull();
		expect(cachedSoilFor(39.35, -101.05)).toBeNull();
	});

	it("matches crop history and soil only at the exact point, not the 1 km climate cell", () => {
		// 0.003 degrees is about 300 m: inside the climate request's rounding, outside the field's.
		const finney = SAMPLE_FIELDS[0];
		expect(cachedClimateFor(finney.lat + 0.003, finney.lon)).not.toBeNull();
		expect(cachedHistoryFor(finney.lat + 0.003, finney.lon)).toBeNull();
		expect(cachedSoilFor(finney.lat + 0.003, finney.lon)).toBeNull();
	});
});
