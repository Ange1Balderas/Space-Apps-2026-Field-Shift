// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Plain-language wording for trends and coordinates. Every sentence is built from computed
// values by these templates; none of it is free text.

import type { TrendLabel, TrendSummary } from "@/lib/trends";

export type TrendDirection = "up" | "down" | "flat";

/** Words for one yearly series, used to phrase its change per decade. */
export type SeriesWords = {
	/** One unit, for example "hot day". */
	singular: string;
	/** Several units, for example "hot days". */
	plural: string;
	/** Word for a rise, for example "more". */
	rise: string;
	/** Word for a fall, for example "fewer". */
	fall: string;
};

export const HOT_DAY_WORDS: SeriesWords = {
	singular: "hot day",
	plural: "hot days",
	rise: "more",
	fall: "fewer",
};

// SPEC.md, "Trend detection" > "Labels".
export const TREND_LABEL_TEXT: Record<TrendLabel, string> = {
	likely: "Likely trend",
	possible: "Possible trend",
	none: "No clear trend",
};

/** A size without its sign: one decimal place below 10, a whole number from 10 up. */
export function formatAmount(value: number): string {
	const size = Math.abs(value);
	const text = size < 9.95 ? size.toFixed(1) : size.toFixed(0);
	return text.endsWith(".0") ? text.slice(0, -2) : text;
}

/** Which way a per-decade change points, after rounding it the way it is shown. */
export function trendDirection(perDecade: number): TrendDirection {
	if (formatAmount(perDecade) === "0") return "flat";
	return perDecade > 0 ? "up" : "down";
}

/** For example "about 1.4 more hot days per decade", or "no change per decade". */
export function describeChange(perDecade: number, words: SeriesWords): string {
	const direction = trendDirection(perDecade);
	if (direction === "flat") return "no change per decade";
	const amount = formatAmount(perDecade);
	const unit = amount === "1" ? words.singular : words.plural;
	const change = direction === "up" ? words.rise : words.fall;
	return `about ${amount} ${change} ${unit} per decade`;
}

/**
 * The sentence shown under a trend's confidence label. When the test finds no clear trend
 * the best estimate is still reported, with the reason it is not called a trend, so nothing
 * is hidden and nothing is overstated.
 */
export function describeTrend(trend: TrendSummary, words: SeriesWords): string {
	const change = describeChange(trend.perDecade, words);
	if (trend.label !== "none") {
		return `${change.charAt(0).toUpperCase()}${change.slice(1)}.`;
	}
	return trendDirection(trend.perDecade) === "flat"
		? `Best estimate: ${change}.`
		: `Best estimate: ${change}. The years vary too much to call that a trend.`;
}

/** For example "p = 0.25", "p = 0.002" or "p below 0.001". */
export function formatPValue(pValue: number): string {
	if (pValue < 0.001) return "p below 0.001";
	return `p = ${pValue < 0.01 ? pValue.toFixed(3) : pValue.toFixed(2)}`;
}

/** For example "38.050°N, 100.740°W". */
export function formatLatLon(lat: number, lon: number): string {
	const northSouth = lat >= 0 ? "N" : "S";
	const eastWest = lon >= 0 ? "E" : "W";
	return `${Math.abs(lat).toFixed(3)}°${northSouth}, ${Math.abs(lon).toFixed(3)}°${eastWest}`;
}
