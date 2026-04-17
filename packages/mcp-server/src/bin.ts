#!/usr/bin/env node
/**
 * phantom-mcp binary — starts the Phantom CLI as an MCP stdio server.
 *
 * Identical to running `phantom --mcp` but packaged as a dedicated binary
 * for agents that look for a standalone MCP server entry point.
 *
 * Register with your agent:
 *   phantom-mcp mcp add
 */
import { cli } from "@phantom/cli";

cli.serve(["--mcp"]).catch(err => {
  console.error("phantom-mcp: fatal error:", err);
  process.exit(1);
});
