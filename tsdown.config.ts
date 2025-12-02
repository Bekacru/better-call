import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		client: "src/client.ts",
		node: "src/adapters/node/index.ts",
	},
	external: ["zod"],
	dts: true,
	hash: false,
	sourcemap: true,
	format: ["esm", "cjs"],
	target: "es2022",
});
