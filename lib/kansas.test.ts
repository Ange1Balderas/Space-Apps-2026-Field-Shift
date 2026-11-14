// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import { isInKansasBounds, KANSAS_BOUNDS } from "@/lib/kansas";

describe("isInKansasBounds", () => {
	it("accepts points inside the bounding box, edges included", () => {
		expect(isInKansasBounds(38.0498, -100.74)).toBe(true);
		const [[west, south], [east, north]] = KANSAS_BOUNDS;
		expect(isInKansasBounds(south, west)).toBe(true);
		expect(isInKansasBounds(north, east)).toBe(true);
	});

	it("rejects points beyond each side of the box", () => {
		expect(isInKansasBounds(41.2, -100)).toBe(false); // north, in Nebraska
		expect(isInKansasBounds(35.47, -97.5)).toBe(false); // south, in Oklahoma
		expect(isInKansasBounds(39.74, -104.99)).toBe(false); // west, in Colorado
		expect(isInKansasBounds(38.63, -90.2)).toBe(false); // east, in Missouri
	});

	it("rejects values that are not numbers", () => {
		expect(isInKansasBounds(Number.NaN, -100)).toBe(false);
		expect(isInKansasBounds(38, Number.POSITIVE_INFINITY)).toBe(false);
	});
});
