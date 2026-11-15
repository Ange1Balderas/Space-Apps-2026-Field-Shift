// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import { locationProblem, locationResult } from "@/lib/location";

describe("locationResult", () => {
	it("passes on a point inside Kansas", () => {
		expect(locationResult(38.5, -98.3)).toEqual({ kind: "point", lat: 38.5, lon: -98.3 });
	});

	it("says so when the location is outside Kansas, and chooses nothing", () => {
		// Kansas City, Missouri, just east of the state line.
		const result = locationResult(39.1, -94.55);
		expect(result.kind).toBe("problem");
		expect(result).toMatchObject({ message: expect.stringContaining("outside Kansas") });
	});

	it("treats a position that is not a number as no position", () => {
		expect(locationResult(Number.NaN, -98)).toEqual({
			kind: "problem",
			message: locationProblem(2),
		});
	});
});

describe("locationProblem", () => {
	it("has its own sentence for denied, unavailable, timed out and unsupported", () => {
		const messages = [1, 2, 3, null].map(locationProblem);
		expect(messages[0]).toMatch(/not allowed/);
		expect(messages[1]).toMatch(/could not work out where it is/);
		expect(messages[2]).toMatch(/took too long/);
		expect(messages[3]).toMatch(/does not share a location/);
		expect(new Set(messages).size).toBe(4);
		// An unknown code gets the general sentence, not a blank.
		expect(locationProblem(99)).toBe(messages[3]);
	});
});
