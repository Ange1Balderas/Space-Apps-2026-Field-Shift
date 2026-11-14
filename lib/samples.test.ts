// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Guards the cached sample files: each one must match the sample list, satisfy the API
// contract, and agree with what the current trend maths gives for its own numbers.

import { describe, expect, it } from "vitest";
import { climatePoint, isClimateResponse } from "@/lib/climate";
import { isInKansasBounds } from "@/lib/kansas";
import { POWER_FIRST_YEAR } from "@/lib/power";
import { cachedClimateFor } from "@/lib/sample-data";
import { findSampleField, SAMPLE_FIELDS } from "@/lib/samples";
import { analyzeTrend } from "@/lib/trends";
import finneyFile from "@/public/data/samples/finney.json";

const FILES: Record<string, unknown> = { finney: finneyFile };
const SAMPLES = SAMPLE_FIELDS.map((sample) => [sample.id, sample] as const);

describe("sample fields", () => {
	it("lists Finney County", () => {
		expect(findSampleField("finney")?.name).toBe("Finney County");
		expect(findSampleField("nowhere")).toBeUndefined();
	});

	it.each(SAMPLES)("%s: the cached file matches the list and the contract", (_id, sample) => {
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

	it("has no cached climate for a point that is not a sample field", () => {
		expect(cachedClimateFor(39.35, -101.05)).toBeNull();
	});
});
