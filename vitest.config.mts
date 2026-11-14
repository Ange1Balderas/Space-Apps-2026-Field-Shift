// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// Same "@/..." alias as tsconfig.json.
		alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
	},
	test: {
		environment: "node",
		include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
	},
});
