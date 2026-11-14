// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import {
	describeChange,
	describeTrend,
	formatAmount,
	formatLatLon,
	formatPValue,
	HOT_DAY_WORDS,
	trendDirection,
} from "@/lib/trend-text";

describe("formatAmount", () => {
	it.each([
		[1.429, "1.4"],
		[-1.429, "1.4"],
		[1.96, "2"],
		[0.04, "0"],
		[0.05, "0.1"],
		[9.94, "9.9"],
		[9.96, "10"],
		[12.4, "12"],
	])("shows %f as %s", (value, text) => {
		expect(formatAmount(value)).toBe(text);
	});
});

describe("trendDirection", () => {
	it("follows the sign, and is flat when the change rounds to zero", () => {
		expect(trendDirection(1.4)).toBe("up");
		expect(trendDirection(-0.3)).toBe("down");
		expect(trendDirection(0.04)).toBe("flat");
		expect(trendDirection(-0.04)).toBe("flat");
		expect(trendDirection(0)).toBe("flat");
	});
});

describe("describeChange", () => {
	it("says how much more or fewer per decade", () => {
		expect(describeChange(1.429, HOT_DAY_WORDS)).toBe(
			"about 1.4 more hot days per decade",
		);
		expect(describeChange(-2.6, HOT_DAY_WORDS)).toBe(
			"about 2.6 fewer hot days per decade",
		);
	});

	it("uses the singular for exactly one", () => {
		expect(describeChange(1.02, HOT_DAY_WORDS)).toBe(
			"about 1 more hot day per decade",
		);
	});

	it("says no change when the amount rounds to zero", () => {
		expect(describeChange(0.01, HOT_DAY_WORDS)).toBe("no change per decade");
	});
});

describe("describeTrend", () => {
	const base = { linearPerDecade: 1.7, pValue: 0.03 };

	it("states the change when a trend is likely or possible", () => {
		expect(
			describeTrend({ ...base, perDecade: 2.2, label: "likely" }, HOT_DAY_WORDS),
		).toBe("About 2.2 more hot days per decade.");
		expect(
			describeTrend(
				{ ...base, perDecade: -1.5, label: "possible" },
				HOT_DAY_WORDS,
			),
		).toBe("About 1.5 fewer hot days per decade.");
	});

	it("still reports the best estimate when there is no clear trend, and says why it is not one", () => {
		expect(
			describeTrend(
				{ ...base, perDecade: 1.429, pValue: 0.25, label: "none" },
				HOT_DAY_WORDS,
			),
		).toBe(
			"Best estimate: about 1.4 more hot days per decade. The years vary too much to call that a trend.",
		);
	});

	it("keeps it short when the best estimate is no change", () => {
		expect(
			describeTrend(
				{ ...base, perDecade: 0.02, pValue: 0.9, label: "none" },
				HOT_DAY_WORDS,
			),
		).toBe("Best estimate: no change per decade.");
	});
});

describe("formatPValue", () => {
	it.each([
		[0.251555, "p = 0.25"],
		[0.05, "p = 0.05"],
		[0.001805, "p = 0.002"],
		[0.0004, "p below 0.001"],
	])("shows %f as %s", (pValue, text) => {
		expect(formatPValue(pValue)).toBe(text);
	});
});

describe("formatLatLon", () => {
	it("writes degrees with compass letters instead of signs", () => {
		expect(formatLatLon(38.0498, -100.74)).toBe("38.050°N, 100.740°W");
	});
});
