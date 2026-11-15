// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import {
	describeChange,
	FREEZE_DATE_WORDS,
	formatDayOfYear,
	monthName,
	SEASON_RAIN_WORDS,
} from "@/lib/trend-text";

describe("wording for the rain and freeze-date series", () => {
	it("phrases a change in growing-season rain", () => {
		expect(describeChange(0.34, SEASON_RAIN_WORDS)).toBe("about 0.3 more inches of rain per decade");
		expect(describeChange(-1, SEASON_RAIN_WORDS)).toBe("about 1 fewer inch of rain per decade");
		expect(describeChange(0.02, SEASON_RAIN_WORDS)).toBe("no change per decade");
	});

	it("puts later and earlier after the unit for a date that moves", () => {
		expect(describeChange(3.3, FREEZE_DATE_WORDS)).toBe("about 3.3 days later per decade");
		expect(describeChange(-1, FREEZE_DATE_WORDS)).toBe("about 1 day earlier per decade");
	});
});

describe("formatDayOfYear and monthName", () => {
	it("reads a day of the year as a date", () => {
		expect(formatDayOfYear(1)).toBe("January 1");
		expect(formatDayOfYear(102)).toBe("April 12");
		expect(formatDayOfYear(293, "short")).toBe("Oct 20");
		expect(formatDayOfYear(365)).toBe("December 31");
		// An average is rarely a whole day: it is rounded to the nearest one.
		expect(formatDayOfYear(101.6)).toBe("April 12");
	});

	it("names a month", () => {
		expect(monthName(4)).toBe("April");
		expect(monthName(9)).toBe("September");
	});
});
