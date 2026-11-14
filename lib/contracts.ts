// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Shape checks for the crop history and soil answers (HistoryResponse and SoilResponse in
// lib/types.ts). Used on answers from the routes and on the cached sample files, in the
// browser and on the server. The check for ClimateResponse lives in lib/climate.ts.

import type { HistoryResponse, SoilResponse } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isNumberOrNull = (value: unknown) => value === null || isNumber(value);
const isTextOrNull = (value: unknown) =>
	value === null || typeof value === "string";

export function isHistoryResponse(value: unknown): value is HistoryResponse {
	if (!isRecord(value)) return false;
	if (value.source !== "USDA NASS Cropland Data Layer") return false;
	return (
		Array.isArray(value.years) &&
		value.years.every(
			(row) =>
				isRecord(row) &&
				isNumber(row.year) &&
				isNumber(row.cdlCode) &&
				typeof row.crop === "string",
		)
	);
}

export function isSoilResponse(value: unknown): value is SoilResponse {
	if (!isRecord(value)) return false;
	if (value.source !== "USDA NRCS SSURGO") return false;
	return (
		typeof value.mukey === "string" &&
		typeof value.mapUnitName === "string" &&
		isTextOrNull(value.texture) &&
		isNumberOrNull(value.availableWaterIn) &&
		isNumberOrNull(value.organicMatterPct) &&
		isNumberOrNull(value.kFactor) &&
		isNumberOrNull(value.windErodibilityIndex) &&
		isNumberOrNull(value.slopePct) &&
		isTextOrNull(value.hydrologicGroup)
	);
}
