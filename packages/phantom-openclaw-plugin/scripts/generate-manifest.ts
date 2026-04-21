import { PluginConfigJsonSchema } from "@phantom/cli";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(dir, "..", "openclaw.plugin.json");

const existing = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;

const { $schema, ...configSchema } = { ...PluginConfigJsonSchema, additionalProperties: false } as Record<
  string,
  unknown
>;
void $schema;

writeFileSync(manifestPath, JSON.stringify({ ...existing, configSchema }, null, 2) + "\n");
// eslint-disable-next-line no-console
console.log("Generated configSchema in openclaw.plugin.json");
