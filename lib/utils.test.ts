// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

// Every ported component builds its class names through cn(), so these two
// behaviours are what the design layer relies on.
describe("cn", () => {
	it("joins class names and drops falsy values", () => {
		expect(cn("rounded-lg", false, undefined, null, "border")).toBe(
			"rounded-lg border",
		);
	});

	it("lets a later Tailwind class override an earlier conflicting one", () => {
		expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
	});
});
