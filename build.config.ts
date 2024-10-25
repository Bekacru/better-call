import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  outDir: "dist",
  declaration: true,
  externals: ["zod"],
});
