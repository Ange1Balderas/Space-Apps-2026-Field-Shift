// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// A county's soil moisture status from NASA SMAP (SPEC.md, feature 12 and "Anomalies"):
// the shape check for public/data/counties/{fips}.json, the label worked out from the
// month's z-score and the cut-off in config/scoring.json, and the words the panel shows.

import { SCORING } from "@/lib/library";
import { monthName } from "@/lib/trend-text";
import type { CountyMoisture } from "@/lib/types";

export type MoistureLabel = "wetter" | "normal" | "drier";

export const MOISTURE_LABEL_TEXT: Record<MoistureLabel, string> = {
	wetter: "Wetter than usual",
	normal: "About normal",
	drier: "Drier than usual",
};

/** How many years of the month count as a short record. SMAP began in 2015, so all of them do today. */
export const SHORT_RECORD_YEARS = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isNumberOrNull = (value: unknown) => value === null || isNumber(value);

const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function isMonthRow(value: unknown): boolean {
	return (
		isRecord(value) &&
		Number.isInteger(value.year) &&
		Number.isInteger(value.month) &&
		(value.month as number) >= 1 &&
		(value.month as number) <= 12 &&
		isNumber(value.mean) &&
		Number.isInteger(value.days)
	);
}

export function isCountyMoisture(value: unknown): value is CountyMoisture {
	if (!isRecord(value)) return false;
	if (value.source !== "NASA SMAP") return false;
	if (typeof value.fips !== "string" || typeof value.county !== "string") return false;
	if (typeof value.product !== "string" || typeof value.layer !== "string") return false;
	if (!isDate(value.firstDate) || !isDate(value.lastDate)) return false;
	if (typeof value.qualityRule !== "string" || typeof value.builtAt !== "string") return false;
	if (!Array.isArray(value.months) || !value.months.every(isMonthRow)) return false;
	const { latest } = value;
	if (latest === null) return true;
	return (
		isMonthRow(latest) &&
		isRecord(latest) &&
		isNumberOrNull(latest.normalMean) &&
		isNumberOrNull(latest.normalStd) &&
		Number.isInteger(latest.normalYears) &&
		isNumberOrNull(latest.z)
	);
}

/** The cut-off: a month within this many standard deviations of its usual value is about normal. */
export function nearNormalZ(): number | null {
	return SCORING.soilMoisture.nearNormalZ?.value ?? null;
}

/**
 * The label for a z-score, or null when there is no z-score or no sourced cut-off. The
 * cut-off is a tool assumption and is shown on the About the data tab.
 */
export function moistureLabel(z: number | null, cutOff: number | null = nearNormalZ()): MoistureLabel | null {
	if (z === null || cutOff === null) return null;
	if (z > cutOff) return "wetter";
	if (z < -cutOff) return "drier";
	return "normal";
}

/** A volume fraction as the panel writes it: "17% water by volume". */
export function formatMoisture(fraction: number): string {
	return `${Math.round(fraction * 100)}% water by volume`;
}

/** "October 2026". */
export function formatMonth(year: number, month: number): string {
	return `${monthName(month)} ${year}`;
}

/**
 * The sentence under the label, for example "October 2026 averaged 17% water by volume in
 * the top layer of soil. The usual October here is 21%, over the 11 other years on record."
 */
export function describeMoisture(latest: NonNullable<CountyMoisture["latest"]>): string {
	const when = formatMonth(latest.year, latest.month);
	const first = `${when} averaged ${formatMoisture(latest.mean)} in the top layer of soil, from ${latest.days} readings.`;
	if (latest.normalMean === null || latest.normalYears === 0) {
		return `${first} No other year has this month on record, so there is nothing to set it against.`;
	}
	const usual = `The usual ${monthName(latest.month)} here is ${Math.round(latest.normalMean * 100)}%, over the ${latest.normalYears} other ${latest.normalYears === 1 ? "year" : "years"} on record.`;
	if (latest.z === null) {
		return `${first} ${usual} That is too few years to say whether this one is unusual.`;
	}
	return `${first} ${usual}`;
}

/** The years a month record spans, for the "short record" note: "2015 to 2026, 12 years". */
export function recordSpan(data: Pick<CountyMoisture, "months">): { from: number; to: number; years: number } | null {
	if (data.months.length === 0) return null;
	const years = new Set(data.months.map((row) => row.year));
	return { from: Math.min(...years), to: Math.max(...years), years: years.size };
}
