// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Trend detection for a series with one value per year (SPEC.md, "SI layer: trends,
// anomalies and uncertainty"): the Mann-Kendall test says whether a trend exists, Sen's slope
// says how large it is, and an ordinary least-squares slope is kept beside it for comparison.
//
// Method source: U.S. EPA, "Guidance for Data Quality Assessment: Practical Methods for Data
// Analysis", EPA QA/G-9, QA00 update, EPA/600/R-96/084, July 2000, section 4.3.
// https://www.epa.gov/sites/default/files/2015-06/documents/g9-final.pdf
//
//   Section 4.3.3.1, Sen's slope: the median of the n(n-1)/2 pairwise slopes.
//   Box 4-9, Mann-Kendall with the normal approximation, for 10 or more values:
//     S    = (later-minus-earlier differences above zero) - (differences below zero)
//     V(S) = [ n(n-1)(2n+5) - sum over tied groups of w(w-1)(2w+5) ] / 18
//     Z    = (S-1)/sqrt(V(S)) if S > 0,  0 if S = 0,  (S+1)/sqrt(V(S)) if S < 0
//
// The EPA boxes test one direction at a time. This tool does not know the direction in
// advance, so it reports the two-sided p-value: 2 x (area of the normal curve beyond |Z|).
//
// Known limit: the test treats the years as independent. Climate series can carry some
// year-to-year persistence, which makes a trend look slightly more certain than it is.

import type { ClimateResponse } from "@/lib/types";

export type TrendLabel = "likely" | "possible" | "none";

/** Same shape as one entry of `ClimateResponse.trends`. */
export type TrendSummary = ClimateResponse["trends"][string];

export type MannKendallResult = {
	n: number;
	/** Mann-Kendall statistic S. */
	s: number;
	/** Variance of S, with the correction for tied values. */
	varS: number;
	/** Standard normal score, with the continuity correction. */
	z: number;
	/** Two-sided p-value from the normal approximation. */
	pValue: number;
};

// SPEC.md, "Thresholds": "Trend labels: p below 0.05 likely, 0.05 to 0.20 possible, else none".
export const LIKELY_BELOW_P = 0.05;
export const POSSIBLE_UP_TO_P = 0.2;

// EPA QA/G-9, Box 4-9: "If the sample size is 10 or more, a normal approximation to the
// Mann-Kendall procedure may be used." Shorter series get no trend at all.
export const MIN_TREND_POINTS = 10;

/**
 * Area of the standard normal curve above x, for x at or above zero.
 * Abramowitz and Stegun, "Handbook of Mathematical Functions" (National Bureau of Standards
 * Applied Mathematics Series 55, 1964), formula 26.2.17. Absolute error below 7.5e-8.
 * lib/trends.test.ts checks it against the normal percentiles printed in EPA QA/G-9, Table A-1.
 */
export function normalUpperTail(x: number): number {
	if (x < 0) return 1 - normalUpperTail(-x);
	const t = 1 / (1 + 0.2316419 * x);
	const polynomial =
		t *
		(0.31938153 +
			t *
				(-0.356563782 +
					t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
	const density = Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
	return density * polynomial;
}

/** Mann-Kendall trend test with the tie correction. `values` must be in time order. */
export function mannKendall(values: readonly number[]): MannKendallResult {
	const n = values.length;

	let s = 0;
	for (let i = 0; i < n - 1; i += 1) {
		for (let j = i + 1; j < n; j += 1) {
			s += Math.sign(values[j] - values[i]);
		}
	}

	const groupSizes = new Map<number, number>();
	for (const value of values) {
		groupSizes.set(value, (groupSizes.get(value) ?? 0) + 1);
	}
	let tieTerm = 0;
	for (const w of groupSizes.values()) {
		if (w > 1) tieTerm += w * (w - 1) * (2 * w + 5);
	}
	const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;

	// S = 0, or every value equal (V(S) = 0): no evidence of a trend in either direction.
	if (s === 0 || varS <= 0) return { n, s, varS, z: 0, pValue: 1 };

	const z = (s > 0 ? s - 1 : s + 1) / Math.sqrt(varS);
	const pValue = Math.min(1, 2 * normalUpperTail(Math.abs(z)));
	return { n, s, varS, z, pValue };
}

function median(sortedAscending: readonly number[]): number {
	const count = sortedAscending.length;
	if (count === 0) return Number.NaN;
	const middle = Math.floor(count / 2);
	return count % 2 === 1
		? sortedAscending[middle]
		: (sortedAscending[middle - 1] + sortedAscending[middle]) / 2;
}

function assertSameLength(
	times: readonly number[],
	values: readonly number[],
): void {
	if (times.length !== values.length) {
		throw new RangeError("times and values must have the same length.");
	}
}

/**
 * Sen's slope: the median of the slopes between every pair of points, in value units per
 * time unit. Real time values are used, so a missing year does not distort the slope.
 * Returns NaN when fewer than two distinct times are given.
 */
export function senSlope(
	times: readonly number[],
	values: readonly number[],
): number {
	assertSameLength(times, values);
	const slopes: number[] = [];
	for (let i = 0; i < values.length - 1; i += 1) {
		for (let j = i + 1; j < values.length; j += 1) {
			const elapsed = times[j] - times[i];
			if (elapsed !== 0) slopes.push((values[j] - values[i]) / elapsed);
		}
	}
	return median(slopes.sort((a, b) => a - b));
}

/**
 * Ordinary least-squares slope, kept only for comparison with Sen's slope: one extreme
 * year can pull this one, while the median of pairwise slopes barely moves.
 * Returns NaN when fewer than two distinct times are given.
 */
export function linearSlope(
	times: readonly number[],
	values: readonly number[],
): number {
	assertSameLength(times, values);
	const n = values.length;
	if (n === 0) return Number.NaN;
	const meanTime = times.reduce((sum, t) => sum + t, 0) / n;
	const meanValue = values.reduce((sum, v) => sum + v, 0) / n;
	let crossSum = 0;
	let timeSum = 0;
	for (let i = 0; i < n; i += 1) {
		crossSum += (times[i] - meanTime) * (values[i] - meanValue);
		timeSum += (times[i] - meanTime) ** 2;
	}
	return timeSum === 0 ? Number.NaN : crossSum / timeSum;
}

export function trendLabel(pValue: number): TrendLabel {
	if (pValue < LIKELY_BELOW_P) return "likely";
	if (pValue <= POSSIBLE_UP_TO_P) return "possible";
	return "none";
}

/**
 * Trend of a yearly series: Sen's slope and the least-squares slope, both per decade, with
 * the Mann-Kendall p-value and its label. Returns null when the series has fewer than
 * MIN_TREND_POINTS values, because the normal approximation is not valid for it.
 */
export function analyzeTrend(
	years: readonly number[],
	values: readonly number[],
): TrendSummary | null {
	assertSameLength(years, values);
	if (values.length < MIN_TREND_POINTS) return null;
	const { pValue } = mannKendall(values);
	return {
		perDecade: senSlope(years, values) * 10,
		linearPerDecade: linearSlope(years, values) * 10,
		pValue,
		label: trendLabel(pValue),
	};
}
