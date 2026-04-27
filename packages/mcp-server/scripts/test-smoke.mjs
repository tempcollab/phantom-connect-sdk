#!/usr/bin/env node
/**
 * test-smoke.mjs
 *
 * Smoke-tests the @phantom/mcp-server binary by:
 *   1. Spawning `dist/bin.js` as an MCP stdio server.
 *   2. Sending an `initialize` request and verifying the response.
 *   3. Sending a `tools/list` request and verifying all expected tool names
 *      are present.
 *   4. Sending a `tools/call` for `wallet_status` and verifying the response
 *      shape (error is acceptable — we just verify the server responds).
 *
 * Usage: node scripts/test-smoke.mjs
 * Requires: yarn build
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.resolve(__dirname, "../dist/bin.js");

// ---------------------------------------------------------------------------
// Expected tool names (incur-based MCP server)
// ---------------------------------------------------------------------------

const expectedToolNames = [
  "buy",
  "evm_allowance",
  "evm_send",
  "evm_sign",
  "evm_sign-typed",
  "login",
  "pay",
  "perps_account",
  "perps_cancel",
  "perps_close",
  "perps_deposit",
  "perps_history",
  "perps_leverage",
  "perps_markets",
  "perps_open",
  "perps_orders",
  "perps_positions",
  "perps_transfer",
  "perps_withdraw",
  "perps_withdraw-hl-spot",
  "simulate",
  "solana_send",
  "solana_sign",
  "transfer",
  "wallet_addresses",
  "wallet_balances",
  "wallet_rebalance",
  "wallet_status",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let requestId = 0;

function makeRequest(method, params = {}) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: ++requestId,
    method,
    params,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Spawning MCP server: node ${BIN}`);

  const proc = spawn("node", [BIN], {
    stdio: ["pipe", "pipe", "inherit"],
  });

  const rl = createInterface({ input: proc.stdout });

  /** @type {Map<number, { resolve: Function; reject: Function }>} */
  const pending = new Map();

  rl.on("line", line => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // ignore non-JSON output
    }
    const handler = pending.get(msg.id);
    if (handler) {
      pending.delete(msg.id);
      handler.resolve(msg);
    }
  });

  function send(method, params) {
    return new Promise((resolve, reject) => {
      const req = makeRequest(method, params);
      const id = requestId; // captured after increment in makeRequest
      pending.set(id, { resolve, reject });
      proc.stdin.write(req + "\n");
    });
  }

  let failed = false;

  try {
    // ------------------------------------------------------------------
    // 1. initialize
    // ------------------------------------------------------------------
    console.log("\n[1/3] initialize");
    const initResp = await withTimeout(
      send("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "0.0.0" },
      }),
      5000,
      "initialize timed out",
    );
    if (initResp.error) {
      console.error("initialize returned error:", initResp.error);
      failed = true;
    } else {
      console.log("initialize OK — server info:", JSON.stringify(initResp.result?.serverInfo ?? {}));
    }

    // ------------------------------------------------------------------
    // 2. tools/list
    // ------------------------------------------------------------------
    console.log("\n[2/3] tools/list");
    const listResp = await withTimeout(send("tools/list", {}), 5000, "tools/list timed out");
    if (listResp.error) {
      console.error("tools/list returned error:", listResp.error);
      failed = true;
    } else {
      const tools = listResp.result?.tools ?? [];
      const actualNames = tools.map(t => t.name).sort();
      const missing = expectedToolNames.filter(n => !actualNames.includes(n));
      const extra = actualNames.filter(n => !expectedToolNames.includes(n));

      if (missing.length > 0) {
        console.error("MISSING tools:", missing);
        failed = true;
      }
      if (extra.length > 0) {
        console.warn("EXTRA tools (not in expected list):", extra);
      }
      if (missing.length === 0) {
        console.log(`tools/list OK — ${actualNames.length} tools registered.`);
      }
    }

    // ------------------------------------------------------------------
    // 3. tools/call — wallet_status (may fail due to missing auth, that's OK)
    // ------------------------------------------------------------------
    console.log("\n[3/3] tools/call wallet_status");
    const callResp = await withTimeout(
      send("tools/call", { name: "wallet_status", arguments: {} }),
      10000,
      "tools/call timed out",
    );
    if (callResp.error) {
      // JSON-RPC level error — unexpected
      console.error("tools/call returned JSON-RPC error:", callResp.error);
      failed = true;
    } else {
      // MCP tool errors are returned as content with isError:true — acceptable
      const content = callResp.result?.content ?? [];
      const isError = callResp.result?.isError ?? false;
      if (isError) {
        const msg = content.map(c => c.text).join(" ");
        console.log(`tools/call OK (tool returned error, expected without auth): ${msg.slice(0, 120)}`);
      } else {
        console.log("tools/call OK — wallet_status returned result.");
      }
    }
  } catch (err) {
    console.error("Smoke test error:", err.message);
    failed = true;
  } finally {
    proc.stdin.end();
    proc.kill();
  }

  if (failed) {
    console.error("\nSmoke test FAILED.");
  } else {
    console.log("\nSmoke test PASSED.");
  }
  process.exit(failed ? 1 : 0);
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      v => {
        clearTimeout(timer);
        resolve(v);
      },
      e => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

main();
