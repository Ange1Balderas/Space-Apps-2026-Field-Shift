// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { afterEach, describe, expect, it, vi } from "vitest";
import { resetTokenColors, tokenColor, TRANSPARENT } from "@/lib/map-colors";

afterEach(() => {
	resetTokenColors();
	vi.unstubAllGlobals();
});

describe("tokenColor", () => {
	it("is transparent where there is no document", () => {
		expect(tokenColor("--chart-1")).toBe(TRANSPARENT);
	});

	it("is transparent for a token the page does not define, and remembers the answer", () => {
		const getPropertyValue = vi.fn(() => "");
		vi.stubGlobal("document", { documentElement: {}, createElement: vi.fn() });
		vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue }));
		expect(tokenColor("--nothing")).toBe(TRANSPARENT);
		expect(tokenColor("--nothing")).toBe(TRANSPARENT);
		expect(getPropertyValue).toHaveBeenCalledTimes(1);
	});

	it("is transparent, not black, when the browser does not understand the token's colour", () => {
		// A canvas keeps its previous fill when given a colour it cannot parse.
		const context = {
			fillStyle: "",
			fillRect: vi.fn(),
			getImageData: () => ({ data: [0, 0, 0, 255] }),
		};
		const canvas = { width: 0, height: 0, getContext: () => context };
		vi.stubGlobal("document", {
			documentElement: {},
			createElement: () => canvas,
		});
		vi.stubGlobal("getComputedStyle", () => ({
			getPropertyValue: () => "oklch(0.6863 0.1743 34.2614)",
		}));
		Object.defineProperty(context, "fillStyle", {
			get: () => "#010203",
			set: () => {},
		});
		expect(tokenColor("--chart-1")).toBe(TRANSPARENT);
		expect(context.fillRect).not.toHaveBeenCalled();
	});

	it("reads the painted pixel back as rgba", () => {
		const context = {
			fillStyle: "",
			fillRect: vi.fn(),
			getImageData: () => ({ data: [242, 106, 75, 255] }),
		};
		const canvas = { width: 0, height: 0, getContext: () => context };
		vi.stubGlobal("document", { documentElement: {}, createElement: () => canvas });
		vi.stubGlobal("getComputedStyle", () => ({
			getPropertyValue: () => "oklch(0.6863 0.1743 34.2614)",
		}));
		expect(tokenColor("--chart-1")).toBe("rgba(242, 106, 75, 1.000)");
	});
});
