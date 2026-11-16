// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	countyAt,
	isCountyCollection,
	loadCounties,
	pointInRing,
	resetCountiesForTests,
} from "@/lib/counties";
import { readFileSync } from "node:fs";
import { SAMPLE_FIELDS } from "@/lib/samples";

// A .geojson file is not a JSON module to the bundler, so the test reads it from disk.
const counties: unknown = JSON.parse(readFileSync("public/data/counties.geojson", "utf-8"));

describe("the county outlines as committed", () => {
	it("hold 105 Kansas counties with distinct FIPS codes", () => {
		expect(isCountyCollection(counties)).toBe(true);
		if (!isCountyCollection(counties)) return;
		const codes = counties.features.map((feature) => feature.properties.fips);
		expect(codes).toHaveLength(105);
		expect(new Set(codes).size).toBe(105);
	});

	it("place each sample field in its own county", () => {
		if (!isCountyCollection(counties)) throw new Error("not a collection");
		const expected: Record<string, string> = {
			finney: "20055",
			thomas: "20193",
			brown: "20013",
		};
		for (const sample of SAMPLE_FIELDS) {
			const county = countyAt(sample.lat, sample.lon, counties);
			expect(county?.fips, sample.id).toBe(expected[sample.id]);
			expect(county?.name, sample.id).toBe(sample.name);
		}
	});

	it("find no county for a point outside Kansas", () => {
		if (!isCountyCollection(counties)) throw new Error("not a collection");
		expect(countyAt(41.2, -100, counties)).toBeNull(); // Nebraska
		expect(countyAt(38.63, -90.2, counties)).toBeNull(); // Missouri
	});
});

describe("pointInRing", () => {
	const square: [number, number][] = [
		[0, 0],
		[2, 0],
		[2, 2],
		[0, 2],
		[0, 0],
	];
	it("is true inside and false outside", () => {
		expect(pointInRing(1, 1, square)).toBe(true);
		expect(pointInRing(3, 1, square)).toBe(false);
		expect(pointInRing(1, -1, square)).toBe(false);
	});
});

describe("isCountyCollection", () => {
	it("refuses a feature with a non-Kansas FIPS code or a short ring", () => {
		const ring = [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 0],
		];
		expect(
			isCountyCollection({
				features: [
					{ properties: { fips: "31001", name: "x" }, geometry: { type: "Polygon", coordinates: [ring] } },
				],
			}),
		).toBe(false);
		expect(
			isCountyCollection({
				features: [
					{ properties: { fips: "20001", name: "x" }, geometry: { type: "Polygon", coordinates: [ring.slice(0, 3)] } },
				],
			}),
		).toBe(false);
		expect(
			isCountyCollection({
				features: [
					{ properties: { fips: "20001", name: "x" }, geometry: { type: "Polygon", coordinates: [ring] } },
				],
			}),
		).toBe(true);
	});
});

describe("loadCounties", () => {
	beforeEach(() => resetCountiesForTests());

	it("fetches the outlines once and shares them", async () => {
		const fetchJson = vi.fn(async () => counties);
		const first = await loadCounties(fetchJson);
		const second = await loadCounties(fetchJson);
		expect(first).toBe(second);
		expect(fetchJson).toHaveBeenCalledTimes(1);
	});

	it("forgets a failed fetch so the next lookup tries again", async () => {
		const fetchJson = vi
			.fn<(url: string) => Promise<unknown>>()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(counties);
		await expect(loadCounties(fetchJson)).rejects.toThrow("offline");
		await expect(loadCounties(fetchJson)).resolves.toBeTruthy();
		expect(fetchJson).toHaveBeenCalledTimes(2);
	});

	it("refuses a file that is not a county collection", async () => {
		await expect(loadCounties(async () => ({ features: "no" }))).rejects.toThrow(
			"could not read",
		);
	});
});
