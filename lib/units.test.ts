// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import { cmToIn, cToF, fToC, mmToIn, mToFt, roundTo } from "@/lib/units";

describe("unit conversions", () => {
	it("converts millimetres to inches (25.4 mm is one inch)", () => {
		expect(mmToIn(25.4)).toBe(1);
		expect(mmToIn(0)).toBe(0);
		expect(mmToIn(508)).toBe(20);
	});

	it("converts centimetres to inches (2.54 cm is one inch)", () => {
		expect(cmToIn(2.54)).toBe(1);
		expect(cmToIn(25.4)).toBe(10);
		expect(cmToIn(0)).toBe(0);
	});

	it("converts metres to feet (0.3048 m is one foot)", () => {
		expect(mToFt(0.3048)).toBeCloseTo(1, 12);
		expect(mToFt(250)).toBeCloseTo(820.21, 2);
		expect(mToFt(0)).toBe(0);
	});

	it("converts °C to °F", () => {
		expect(cToF(0)).toBe(32);
		expect(cToF(100)).toBe(212);
		expect(cToF(35)).toBe(95);
		expect(cToF(-40)).toBe(-40);
	});

	it("converts °F to °C, and 95°F is exactly 35°C", () => {
		expect(fToC(95)).toBe(35);
		expect(fToC(32)).toBe(0);
		expect(fToC(212)).toBe(100);
	});

	it("rounds to a number of decimal places", () => {
		expect(roundTo(15.2834, 2)).toBe(15.28);
		expect(roundTo(41.36, 1)).toBe(41.4);
		expect(roundTo(-0.126, 2)).toBe(-0.13);
		expect(roundTo(57, 2)).toBe(57);
	});
});
