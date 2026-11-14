// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Published source for the expected values:
// U.S. EPA, "Guidance for Data Quality Assessment: Practical Methods for Data Analysis",
// EPA QA/G-9, QA00 update, EPA/600/R-96/084, July 2000.
// https://www.epa.gov/sites/default/files/2015-06/documents/g9-final.pdf
//
// Each test says whether its expected value is PRINTED in that document or WORKED BY HAND
// from a formula printed there. Nothing else is used as an expected value.

import { describe, expect, it } from "vitest";
import {
	analyzeTrend,
	linearSlope,
	mannKendall,
	normalUpperTail,
	senSlope,
	trendLabel,
} from "@/lib/trends";

// Box 4-10, "An Example of Mann-Kendall Trend Test by Normal Approximation" (page 4-20):
// 11 weekly measurements, with four values tied at 10 and two tied at 15.
const EPA_BOX_4_10 = [10, 10, 10, 5, 10, 20, 18, 17, 15, 24, 15];

// Box 4-8, "An Example of Mann-Kendall Trend Test for Small Sample Sizes" (page 4-18).
const EPA_BOX_4_8 = [5, 6, 11, 8, 10];

describe("normalUpperTail", () => {
	// PRINTED: Table A-1, "Critical Values of Student's t Distribution" (page A-3), last row.
	// The note under the table says that row gives "the critical values for a standard normal
	// distribution (z)".
	it.each([
		[0.7, 0.524],
		[0.75, 0.674],
		[0.8, 0.842],
		[0.85, 1.036],
		[0.9, 1.282],
		[0.95, 1.645],
		[0.975, 1.96],
		[0.99, 2.326],
		[0.995, 2.576],
	])("puts %f of the normal curve below z = %f", (below, z) => {
		expect(1 - normalUpperTail(z)).toBeCloseTo(below, 3);
	});

	it("is symmetric around zero", () => {
		expect(normalUpperTail(0)).toBeCloseTo(0.5, 6);
		expect(normalUpperTail(-1.645)).toBeCloseTo(0.95, 3);
	});
});

describe("mannKendall", () => {
	it("reproduces S and V(S) from EPA QA/G-9 Box 4-10, which has tied values", () => {
		const result = mannKendall(EPA_BOX_4_10);
		expect(result.n).toBe(11);
		// PRINTED, step 2: "S = (sum of + signs) - (sum of - signs) = 35 - 13 = 22".
		expect(result.s).toBe(22);
		// PRINTED, step 4: V(S) = 155.33, using two tied groups of 4 and 2 values.
		expect(result.varS).toBeCloseTo(155.33, 2);
	});

	it("computes Z from the Box 4-9 formula for the Box 4-10 data", () => {
		// WORKED BY HAND from the printed formula Z = (S - 1) / sqrt(V(S)):
		// (22 - 1) / sqrt(155.33) = 21 / 12.463 = 1.685.
		//
		// The box itself prints "22 - 1 = 20" and so reports Z = 20 / 12.46 = 1.605. That is an
		// arithmetic slip in the document: 22 - 1 is 21. The slip matters, because 1.605 is below
		// the 1.645 critical value and 1.685 is above it. The printed S and V(S) are correct, so
		// only those two are taken as published values.
		const result = mannKendall(EPA_BOX_4_10);
		expect(result.z).toBeCloseTo(1.685, 3);

		// Table A-1 (PRINTED) gives z = 1.645 for 0.95 and z = 1.960 for 0.975. Z = 1.685 lies
		// between them, so the two-sided p-value must lie between 0.05 and 0.10.
		expect(result.pValue).toBeGreaterThan(0.05);
		expect(result.pValue).toBeLessThan(0.1);
	});

	it("reproduces S from EPA QA/G-9 Box 4-8", () => {
		// PRINTED, step 3: "S = 8 - 2 = 6".
		expect(mannKendall(EPA_BOX_4_8).s).toBe(6);
	});

	it("uses the untied variance n(n-1)(2n+5)/18 when no values repeat", () => {
		// WORKED BY HAND: ten rising values give all 45 pairs positive, and 10 x 9 x 25 / 18 = 125.
		const result = mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		expect(result.s).toBe(45);
		expect(result.varS).toBe(125);
		expect(result.z).toBeCloseTo(44 / Math.sqrt(125), 10);
	});

	it("mirrors S and Z, and keeps the p-value, when the series is reversed", () => {
		const forward = mannKendall(EPA_BOX_4_10);
		const backward = mannKendall([...EPA_BOX_4_10].reverse());
		expect(backward.s).toBe(-forward.s);
		expect(backward.z).toBeCloseTo(-forward.z, 12);
		expect(backward.pValue).toBeCloseTo(forward.pValue, 12);
	});

	it("reports no trend when S is zero", () => {
		// WORKED BY HAND: 1, 2, 2, 1 has two rising pairs, two falling pairs and two ties.
		// V(S) = (4 x 3 x 13 - 2 x (2 x 1 x 9)) / 18 = 120 / 18.
		const result = mannKendall([1, 2, 2, 1]);
		expect(result.s).toBe(0);
		expect(result.varS).toBeCloseTo(120 / 18, 10);
		expect(result.z).toBe(0);
		expect(result.pValue).toBe(1);
	});

	it("reports no trend when every value is the same", () => {
		expect(mannKendall([7, 7, 7, 7, 7])).toEqual({
			n: 5,
			s: 0,
			varS: 0,
			z: 0,
			pValue: 1,
		});
	});
});

describe("senSlope", () => {
	it("is the median of the pairwise slopes of the EPA Box 4-8 data", () => {
		// WORKED BY HAND from the definition printed in section 4.3.3.1 (page 4-16): the slope
		// for a pair is (Xi - Xj) / (i - j), and Sen's slope is the median of all of them.
		// EPA QA/G-9 gives no worked Sen's slope example ("directions are not given in this
		// document"), so this value is not a published one.
		//
		// Data 5, 6, 11, 8, 10 at times 1 to 5. The ten slopes:
		//   from time 1: 1, 3, 1, 1.25      from time 2: 5, 1, 1.3333
		//   from time 3: -3, -0.5           from time 4: 2
		// In order: -3, -0.5, 1, 1, 1, 1.25, 1.3333, 2, 3, 5. The median of ten values is the
		// mean of the fifth and sixth: (1 + 1.25) / 2 = 1.125.
		expect(senSlope([1, 2, 3, 4, 5], EPA_BOX_4_8)).toBeCloseTo(1.125, 12);
	});

	it("uses real time gaps, so a missing year does not change the slope", () => {
		// WORKED BY HAND: the points lie on a line rising 1 per year, with 1983 and 1984 missing.
		expect(senSlope([1981, 1982, 1985], [1, 2, 5])).toBe(1);
	});

	it("barely moves for one extreme value, while the least-squares slope is pulled", () => {
		// WORKED BY HAND: values 1 to 7 follow the line y = t, except the sixth, which is 16.
		// Sen: fifteen of the 21 pairwise slopes are exactly 1, so the median is 1.
		// Least squares: sum of (t - 4)(y) = 48 and sum of (t - 4)^2 = 28, so 48 / 28 = 12 / 7.
		const times = [1, 2, 3, 4, 5, 6, 7];
		const values = [1, 2, 3, 4, 5, 16, 7];
		expect(senSlope(times, values)).toBe(1);
		expect(linearSlope(times, values)).toBeCloseTo(12 / 7, 12);
	});

	it("returns NaN when there are not two distinct times", () => {
		expect(senSlope([], [])).toBeNaN();
		expect(senSlope([2000], [3])).toBeNaN();
		expect(senSlope([2000, 2000], [3, 4])).toBeNaN();
	});

	it("rejects series of different lengths", () => {
		expect(() => senSlope([1, 2, 3], [1, 2])).toThrow(RangeError);
	});
});

describe("linearSlope", () => {
	it("recovers the slope of an exact line", () => {
		expect(linearSlope([1981, 1982, 1983, 1984], [3, 5, 7, 9])).toBeCloseTo(2, 12);
	});

	it("matches a least-squares fit worked by hand", () => {
		// WORKED BY HAND: mean time 3, mean value 4. Sum of products of deviations
		// = (-2)(-2) + (-1)(0) + 0 + (1)(0) + (2)(1) = 6. Sum of squared time deviations = 10.
		expect(linearSlope([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(0.6, 12);
	});

	it("returns NaN when every time is the same", () => {
		expect(linearSlope([5, 5, 5], [1, 2, 3])).toBeNaN();
	});
});

describe("trendLabel", () => {
	// SPEC.md, "Thresholds": p below 0.05 likely, 0.05 to 0.20 possible, else none.
	it.each([
		[0.001, "likely"],
		[0.0499, "likely"],
		[0.05, "possible"],
		[0.2, "possible"],
		[0.2001, "none"],
		[1, "none"],
	] as const)("labels p = %f as %s", (pValue, label) => {
		expect(trendLabel(pValue)).toBe(label);
	});
});

describe("analyzeTrend", () => {
	it("gives no trend for fewer than ten values (EPA QA/G-9 Box 4-9)", () => {
		expect(analyzeTrend([1, 2, 3, 4, 5], EPA_BOX_4_8)).toBeNull();
		expect(
			analyzeTrend([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9]),
		).toBeNull();
	});

	it("reports slopes per decade", () => {
		// WORKED BY HAND: a series that rises 0.2 a year rises 2 a decade.
		const years = Array.from({ length: 10 }, (_, index) => 1981 + index);
		const values = years.map((year) => (year - 1981) * 0.2);
		const trend = analyzeTrend(years, values);
		expect(trend?.perDecade).toBeCloseTo(2, 10);
		expect(trend?.linearPerDecade).toBeCloseTo(2, 10);
		expect(trend?.label).toBe("likely");
	});

	it("labels the EPA Box 4-10 data as a possible trend", () => {
		// Two-sided p is between 0.05 and 0.10 (see the Z test above), which SPEC.md calls possible.
		const weeks = EPA_BOX_4_10.map((_, index) => index + 1);
		const trend = analyzeTrend(weeks, EPA_BOX_4_10);
		expect(trend?.label).toBe("possible");
		expect(trend?.pValue).toBeCloseTo(mannKendall(EPA_BOX_4_10).pValue, 12);
	});

	it("labels a flat, noisy series as no clear trend", () => {
		const years = Array.from({ length: 12 }, (_, index) => 1981 + index);
		const values = [5, 9, 4, 8, 6, 7, 5, 8, 4, 9, 6, 6];
		expect(analyzeTrend(years, values)?.label).toBe("none");
	});
});
