import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		client: "src/client.ts",
	},
	splitting: false,
	sourcemap: true,
	format: ["esm", "cjs"],
	target: "es2020",
	bundle: true,
	external: ["zod"],
});
