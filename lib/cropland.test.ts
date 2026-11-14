// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The answer shape used here was copied from a real `identify` answer of USDA's CDL image
// service on 2026-11-14 (keys, text values, "NoData"), with the lists shortened.

import { describe, expect, it } from "vitest";
import { cdlClassName, isObservedCdlClass } from "@/lib/cdl";
import { buildCdlIdentifyUrl, parseCdlIdentify } from "@/lib/cropland";
import { UpstreamError } from "@/lib/upstream";

/** An identify answer with one class value per year, newest first, as the service sends it. */
function identifyBody(valuesByYear: Record<number, string>): unknown {
	const years = Object.keys(valuesByYear)
		.map(Number)
		.sort((a, b) => b - a);
	return {
		objectId: 0,
		name: "Pixel",
		value: valuesByYear[years[0]],
		properties: { Values: years.map((year) => valuesByYear[year]) },
		catalogItems: {
			features: years.map((year) => ({
				attributes: { Year: year, Name: `${year}_30m_cdls` },
			})),
		},
	};
}

describe("CDL class table", () => {
	// The classes Kansas rotations in SPEC.md are made of, as USDA's table names them.
	it.each([
		[1, "Corn"],
		[4, "Sorghum"],
		[5, "Soybeans"],
		[24, "Winter Wheat"],
		[26, "Dbl Crop WinWht/Soybeans"],
		[36, "Alfalfa"],
		[61, "Fallow/Idle Cropland"],
		[176, "Grassland/Pasture"],
	])("names class %i %s", (code, name) => {
		expect(cdlClassName(code)).toBe(name);
		expect(isObservedCdlClass(code)).toBe(true);
	});

	it("does not treat background, clouds or an unknown code as an observation", () => {
		expect(isObservedCdlClass(0)).toBe(false);
		expect(isObservedCdlClass(81)).toBe(false);
		expect(cdlClassName(7)).toBeNull();
		expect(isObservedCdlClass(7)).toBe(false);
	});
});

describe("buildCdlIdentifyUrl", () => {
	it("asks for every catalog year at the point, in longitude and latitude", () => {
		const url = new URL(buildCdlIdentifyUrl({ lat: 37.96548, lon: -100.72299 }));
		expect(`${url.origin}${url.pathname}`).toBe(
			"https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer/identify",
		);
		expect(JSON.parse(url.searchParams.get("geometry") ?? "")).toEqual({
			x: -100.72299,
			y: 37.96548,
			spatialReference: { wkid: 4326 },
		});
		expect(url.searchParams.get("returnCatalogItems")).toBe("true");
		expect(url.searchParams.get("f")).toBe("json");
	});
});

describe("parseCdlIdentify", () => {
	it("pairs each value with its catalog year and names the class, oldest first", () => {
		const years = parseCdlIdentify(
			identifyBody({ 2025: "24", 2024: "61", 2023: "4" }),
		);
		expect(years).toEqual([
			{ year: 2023, cdlCode: 4, crop: "Sorghum" },
			{ year: 2024, cdlCode: 61, crop: "Fallow/Idle Cropland" },
			{ year: 2025, cdlCode: 24, crop: "Winter Wheat" },
		]);
	});

	it("leaves out years with no observation instead of filling them", () => {
		const years = parseCdlIdentify(
			identifyBody({
				2025: "1",
				2024: "NoData",
				2023: "81",
				2022: "0",
				2021: "5",
				2020: "7",
			}),
		);
		expect(years.map((row) => row.year)).toEqual([2021, 2025]);
	});

	it("returns an empty list when the point has no class in any year", () => {
		expect(parseCdlIdentify(identifyBody({ 2025: "NoData" }))).toEqual([]);
	});

	it("rejects an answer whose values and catalog rows do not line up", () => {
		const body = identifyBody({ 2025: "1", 2024: "5" }) as {
			properties: { Values: string[] };
		};
		body.properties.Values.pop();
		expect(() => parseCdlIdentify(body)).toThrow(UpstreamError);
	});

	it.each([
		["not an object", null],
		["no values", { catalogItems: { features: [] } }],
		["no catalog", { properties: { Values: [] } }],
	])("rejects %s", (_name, body) => {
		expect(() => parseCdlIdentify(body)).toThrow(UpstreamError);
	});

	it("reports an error the service sent inside a 200 answer", () => {
		const body = { error: { code: 400, message: "Invalid parameters" } };
		expect(() => parseCdlIdentify(body)).toThrow(/answered with an error/);
	});
});
