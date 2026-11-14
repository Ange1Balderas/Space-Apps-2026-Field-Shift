// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The field's recent crops from the USDA NASS Cropland Data Layer (CDL). Server only.
//
// Source used: USDA's CDL image service, one `identify` request per point. With
// returnCatalogItems=true it answers with the class value of every CDL year at that point.
// https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer
//
// Whose service it is: USDA's own CDL viewer, CroplandCROS (https://croplandcros.scinet.usda.gov/),
// draws this layer. Its web map lists the service by this URL (checked 2026-11-14):
// https://pdi.scinet.usda.gov/portal/sharing/rest/content/items/8181d2325d0745249854214af4b0ed6f/data?f=json
// The viewer's page carries the banner "An official website of the United States government".
// That banner was read in a browser; the page is drawn by script, so a plain fetch does not show it.
//
// The CropScape figures below are measurements made on that day and were not repeated.
//
// SPEC.md names CropScape's GetCDLValue for this (one request per year, in Albers
// coordinates). On 2026-11-14 CropScape took 27 s for one request, answered seven of nine
// parallel requests, hung on 2025, and then stopped answering, which may have been throttling
// after that burst. This service answered in about 0.5 s with all years. At the one point
// compared (38.0498, -100.74) the two gave the same class for 2018 to 2024. See
// spec/2026-11-14-phase-2-field-facts/implementation.md, deviation 1.

import { cdlClassName, isObservedCdlClass } from "@/lib/cdl";
import type { HistoryResponse } from "@/lib/types";
import { fetchUpstreamJson, isRecord, UpstreamError } from "@/lib/upstream";

export const CDL_IDENTIFY_ENDPOINT =
	"https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer/identify";

// SPEC.md, feature 4: "Last 8 years of crops at the point".
export const HISTORY_YEARS = 8;

const SERVICE = "The Cropland Data Layer service";

export function buildCdlIdentifyUrl(point: { lat: number; lon: number }): string {
	const query = new URLSearchParams({
		geometry: JSON.stringify({
			x: point.lon,
			y: point.lat,
			spatialReference: { wkid: 4326 },
		}),
		geometryType: "esriGeometryPoint",
		returnGeometry: "false",
		returnCatalogItems: "true",
		returnPixelValues: "true",
		f: "json",
	});
	return `${CDL_IDENTIFY_ENDPOINT}?${query.toString()}`;
}

const unexpected = () =>
	new UpstreamError(
		"unexpected",
		`${SERVICE} sent an answer this tool could not read.`,
	);

/**
 * Every year the service holds a real class for at this point, oldest first.
 *
 * The answer carries two parallel lists: one class value per CDL year, and the catalog row
 * (with its Year) each value came from. They are paired only when both have the same
 * length. A year whose value is "NoData", background or clouds is left out, never filled.
 */
export function parseCdlIdentify(body: unknown): HistoryResponse["years"] {
	if (!isRecord(body)) throw unexpected();
	// An ArcGIS service reports its own failures inside a 200 answer.
	if (isRecord(body.error)) {
		throw new UpstreamError(
			"unavailable",
			`${SERVICE} answered with an error.`,
		);
	}

	const properties = isRecord(body.properties) ? body.properties : {};
	const values = properties.Values;
	const catalog = isRecord(body.catalogItems) ? body.catalogItems.features : null;
	if (
		!Array.isArray(values) ||
		!Array.isArray(catalog) ||
		values.length !== catalog.length
	) {
		throw unexpected();
	}

	const byYear = new Map<number, HistoryResponse["years"][number]>();
	values.forEach((value, index) => {
		const item: unknown = catalog[index];
		const attributes = isRecord(item) && isRecord(item.attributes) ? item.attributes : {};
		const year = attributes.Year;
		if (typeof year !== "number" || !Number.isInteger(year)) return;
		if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return;

		const cdlCode = Number(value.trim());
		const crop = cdlClassName(cdlCode);
		if (crop === null || !isObservedCdlClass(cdlCode)) return;
		if (!byYear.has(year)) byYear.set(year, { year, cdlCode, crop });
	});

	return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/**
 * The newest HISTORY_YEARS years with a real class at the point, oldest first. The years
 * come from the service's own catalog, so a newly published CDL year appears by itself.
 * Throws a "no-data" UpstreamError when the point has no class in any year.
 */
export async function fetchCropHistory(point: {
	lat: number;
	lon: number;
}): Promise<HistoryResponse> {
	const body = await fetchUpstreamJson(SERVICE, buildCdlIdentifyUrl(point), {
		headers: { Accept: "application/json" },
	});
	const years = parseCdlIdentify(body).slice(-HISTORY_YEARS);
	if (years.length === 0) {
		throw new UpstreamError(
			"no-data",
			"The Cropland Data Layer has no crop record at this point.",
		);
	}
	return { years, source: "USDA NASS Cropland Data Layer" };
}
