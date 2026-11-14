// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The answer used here is a real Soil Data Access answer for 37.96548, -100.72299,
// retrieved 2026-11-14 with the query in lib/soil.ts.

import { describe, expect, it } from "vitest";
import { isSoilResponse } from "@/lib/contracts";
import { buildSoilQuery, parseSoilAnswer } from "@/lib/soil";
import { UpstreamError } from "@/lib/upstream";

const COLUMNS = [
	"mukey",
	"muname",
	"aws0100wta",
	"slopegradwta",
	"hydgrp",
	"wei",
	"om_r",
	"kwfact",
	"texdesc",
];

const ULYSSES = [
	"2668639",
	"Ulysses silt loam, 1 to 3 percent slopes",
	"22.39",
	"2",
	"B",
	"48",
	"1.8",
	".43",
	"Silt loam",
];

describe("buildSoilQuery", () => {
	it("writes the point as longitude then latitude with five decimals", () => {
		const query = buildSoilQuery({ lat: 37.96548, lon: -100.72299 });
		expect(query).toContain("'point(-100.72299 37.96548)'");
		expect(query).toContain("ORDER BY c.comppct_r DESC, c.cokey ASC, ch.hzdept_r ASC");
	});

	it("refuses anything that is not a pair of numbers", () => {
		expect(() => buildSoilQuery({ lat: Number.NaN, lon: -100 })).toThrow(RangeError);
		expect(() =>
			buildSoilQuery({ lat: 38, lon: Number.POSITIVE_INFINITY }),
		).toThrow(RangeError);
	});
});

describe("parseSoilAnswer", () => {
	it("reads the map unit, converts water storage to inches and keeps the rest as is", () => {
		const soil = parseSoilAnswer({ Table: [COLUMNS, ULYSSES] });
		expect(soil).toEqual({
			mukey: "2668639",
			mapUnitName: "Ulysses silt loam, 1 to 3 percent slopes",
			texture: "Silt loam",
			// 22.39 cm divided by 2.54 is 8.815 in.
			availableWaterIn: 8.81,
			organicMatterPct: 1.8,
			kFactor: 0.43,
			windErodibilityIndex: 48,
			slopePct: 2,
			hydrologicGroup: "B",
			source: "USDA NRCS SSURGO",
		});
		expect(isSoilResponse(soil)).toBe(true);
	});

	it("keeps a missing value as null instead of a zero", () => {
		const values = [...ULYSSES];
		values[2] = null as unknown as string; // aws0100wta
		values[6] = null as unknown as string; // om_r
		values[8] = null as unknown as string; // texdesc
		const soil = parseSoilAnswer({ Table: [COLUMNS, values] });
		expect(soil.availableWaterIn).toBeNull();
		expect(soil.organicMatterPct).toBeNull();
		expect(soil.texture).toBeNull();
		expect(soil.kFactor).toBe(0.43);
		expect(isSoilResponse(soil)).toBe(true);
	});

	it("reads columns by name, not by position", () => {
		const reversed = { Table: [[...COLUMNS].reverse(), [...ULYSSES].reverse()] };
		expect(parseSoilAnswer(reversed).mapUnitName).toBe(
			"Ulysses silt loam, 1 to 3 percent slopes",
		);
	});

	it("says so when no soil survey covers the point", () => {
		// Soil Data Access answers {} when the query finds no row.
		try {
			parseSoilAnswer({});
			expect.unreachable("an empty answer must be an error");
		} catch (error) {
			expect(error).toBeInstanceOf(UpstreamError);
			expect((error as UpstreamError).kind).toBe("no-data");
			expect((error as UpstreamError).message).toBe(
				"The USDA soil survey has no data at this point.",
			);
		}
	});

	it.each([
		["not an object", null],
		["a table with only its header", { Table: [COLUMNS] }],
		["a row without a map unit key", { Table: [["muname"], ["Ulysses"]] }],
	])("rejects %s", (_name, body) => {
		expect(() => parseSoilAnswer(body)).toThrow(UpstreamError);
	});
});
