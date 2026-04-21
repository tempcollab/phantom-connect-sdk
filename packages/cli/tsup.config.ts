import { defineConfig } from "tsup";

const BIG_INT_WARNING_PREFIX = "bigint: Failed to load bindings, pure JS will be used";
const PUNYCODE_DEPRECATION_WARNING_CODE = "DEP0040";

const suppressNoisyWarnings = `
const __origWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === "string" && args[0].startsWith("${BIG_INT_WARNING_PREFIX}")) return;
  __origWarn.apply(console, args);
};
const __origEmitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...args) => {
  if (args[1] === "${PUNYCODE_DEPRECATION_WARNING_CODE}") return;
  __origEmitWarning(warning, ...args);
};
`;

export default defineConfig({
  entry: ["src/index.ts", "src/bin.ts"],
  format: ["cjs"],
  dts: true,
  clean: true,
  platform: "node",
  target: "node18",
  noExternal: [/.*/],
  banner: { js: suppressNoisyWarnings },
});
