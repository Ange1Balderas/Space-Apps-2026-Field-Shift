// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Soil at a point from USDA NRCS SSURGO, through Soil Data Access (SDA). Server only.
// Docs: https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html
//
// One query finds the map unit under the point, then takes its dominant component (the
// largest share of the map unit) and that component's surface layer.
//
// What each column means, and its unit, was read on 2026-11-14 from SDA's own `sdvattribute`
// table (attributename and attributeuomabbrev), through the same endpoint:
//   muaggatt.aws0100wta     "Available Water Supply, 0 to 100 cm"   cm
//   chorizon.om_r           "Organic Matter"                        percent
//   chorizon.kwfact         "K Factor, Whole Soil"                  (no unit)
//   component.wei           "Wind Erodibility Index"                tons/acre/yr
//   component.hydgrp        "Hydrologic Soil Group"
//   chtexturegrp.texdesc    "Surface Texture"
// muaggatt.slopegradwta is not in that table. It was checked against it instead: for map unit
// 1152346 the components' "Representative Slope" values (percent) are 1, 0 and 0 with shares
// of 94, 4 and 2 percent, and slopegradwta is 0.9, their share-weighted average.

import type { SoilResponse } from "@/lib/types";
import { cmToIn, roundTo } from "@/lib/units";
import { fetchUpstreamJson, isRecord, UpstreamError } from "@/lib/upstream";

export const SDA_ENDPOINT =
	"https://sdmdataaccess.sc.egov.usda.gov/tabular/post.rest";

const SERVICE = "The USDA soil survey service";

/**
 * The SQL sent to SDA. The point is written with fixed decimals from two numbers, so no
 * text from the request can reach the query. Ties in component share are broken by the
 * component key, which keeps the answer the same from one call to the next.
 */
export function buildSoilQuery(point: { lat: number; lon: number }): string {
	if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
		throw new RangeError("A soil query needs a numeric latitude and longitude.");
	}
	const wkt = `point(${point.lon.toFixed(5)} ${point.lat.toFixed(5)})`;
	return [
		"SELECT TOP 1 mu.mukey, mu.muname, ma.aws0100wta, ma.slopegradwta,",
		"c.hydgrp, c.wei, ch.om_r, ch.kwfact, tg.texdesc",
		`FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('${wkt}') AS k`,
		"INNER JOIN mapunit AS mu ON mu.mukey = k.mukey",
		"LEFT JOIN muaggatt AS ma ON ma.mukey = mu.mukey",
		"LEFT JOIN component AS c ON c.mukey = mu.mukey",
		"LEFT JOIN chorizon AS ch ON ch.cokey = c.cokey",
		"LEFT JOIN chtexturegrp AS tg ON tg.chkey = ch.chkey AND tg.rvindicator = 'Yes'",
		"ORDER BY c.comppct_r DESC, c.cokey ASC, ch.hzdept_r ASC",
	].join(" ");
}

const unexpected = () =>
	new UpstreamError(
		"unexpected",
		`${SERVICE} sent an answer this tool could not read.`,
	);

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function toText(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Reads SDA's "JSON+COLUMNNAME" answer: a `Table` whose first row holds the column names
 * and whose second row holds the values, all as text. A value SDA does not have stays null.
 * An empty answer means no soil survey covers the point.
 */
export function parseSoilAnswer(body: unknown): SoilResponse {
	if (!isRecord(body)) throw unexpected();
	const table = body.Table;
	if (table === undefined) {
		throw new UpstreamError(
			"no-data",
			"The USDA soil survey has no data at this point.",
		);
	}
	if (!Array.isArray(table) || table.length < 2) throw unexpected();
	const [names, values]: unknown[] = table;
	if (!Array.isArray(names) || !Array.isArray(values)) throw unexpected();

	const row: Record<string, unknown> = {};
	names.forEach((name, index) => {
		if (typeof name === "string") row[name] = values[index];
	});

	const mukey = toText(row.mukey);
	const mapUnitName = toText(row.muname);
	if (mukey === null || mapUnitName === null) throw unexpected();

	const availableWaterCm = toNumber(row.aws0100wta);
	return {
		mukey,
		mapUnitName,
		texture: toText(row.texdesc),
		availableWaterIn:
			availableWaterCm === null ? null : roundTo(cmToIn(availableWaterCm), 2),
		organicMatterPct: toNumber(row.om_r),
		kFactor: toNumber(row.kwfact),
		windErodibilityIndex: toNumber(row.wei),
		slopePct: toNumber(row.slopegradwta),
		hydrologicGroup: toText(row.hydgrp),
		source: "USDA NRCS SSURGO",
	};
}

export async function fetchSoil(point: {
	lat: number;
	lon: number;
}): Promise<SoilResponse> {
	const body = await fetchUpstreamJson(SERVICE, SDA_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({
			format: "JSON+COLUMNNAME",
			query: buildSoilQuery(point),
		}),
	});
	return parseSoilAnswer(body);
}
