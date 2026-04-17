import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin.ts"],
  format: ["cjs"],
  dts: true,
  clean: true,
  platform: "node",
  target: "node18",
  noExternal: [/.*/],
});
