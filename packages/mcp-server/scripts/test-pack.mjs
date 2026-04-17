#!/usr/bin/env node
/**
 * test-pack.mjs
 *
 * Packs the @phantom/mcp-server package and verifies the resulting tarball
 * contains the expected files. Run after `yarn build` to catch accidental
 * omissions from the published artifact.
 *
 * Usage: node scripts/test-pack.mjs
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(__dirname, "..");

const REQUIRED_FILES = ["package.json", "dist/bin.js", "dist/index.js", "README.md", "CHANGELOG.md"];

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

console.log("Packing @phantom/mcp-server …");
const packOut = execSync("yarn pack --json", { cwd: PKG_DIR }).toString().trim();
let tarballPath;
try {
  const info = JSON.parse(packOut);
  tarballPath = info.output ?? info.filename;
} catch {
  // yarn v1 just prints the filename
  tarballPath = packOut.split("\n").find(l => l.endsWith(".tgz"));
}

if (!tarballPath || !fs.existsSync(tarballPath)) {
  // Fallback: look for any .tgz in PKG_DIR
  const tarballs = fs.readdirSync(PKG_DIR).filter(f => f.endsWith(".tgz"));
  if (tarballs.length === 0) {
    console.error("Could not find packed tarball.");
    process.exit(1);
  }
  tarballPath = path.join(PKG_DIR, tarballs[tarballs.length - 1]);
}

console.log(`Tarball: ${tarballPath}`);

// ---------------------------------------------------------------------------
// List contents
// ---------------------------------------------------------------------------

const rawList = execSync(`tar tzf ${tarballPath}`).toString();
const packedFiles = rawList
  .split("\n")
  .map(f => f.replace(/^package\//, "").trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

let failed = false;

for (const required of REQUIRED_FILES) {
  if (!packedFiles.some(f => f === required || f.startsWith(required))) {
    console.error(`MISSING: ${required}`);
    failed = true;
  } else {
    console.log(`OK:      ${required}`);
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

fs.unlinkSync(tarballPath);
console.log("Tarball removed.");

if (failed) {
  console.error("\nPack check FAILED — some expected files were missing.");
  process.exit(1);
} else {
  console.log("\nPack check PASSED.");
}
