import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		client: "src/client.ts",
		node: "src/adapters/node/index.ts",
	},
	dts: true,
	sourcemap: true,
	format: ["esm", "cjs"],
	target: "es2022",
});
