import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		client: "src/client.ts",
	},
	splitting: false,
	sourcemap: true,
	clean: true,
	dts: true,
	format: ["esm", "cjs"],
	target: "es2020",
	minify: true,
	bundle: true,
	external: ["zod"],
});
