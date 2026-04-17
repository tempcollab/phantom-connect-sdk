/**
 * @phantom/mcp-server — Phantom CLI exposed as an MCP stdio server.
 *
 * This package re-exports the CLI instance from @phantom/cli and provides
 * a `serve` helper that starts it in `--mcp` mode.
 *
 * Usage:
 *   # Register with your agent (e.g. Claude Code):
 *   phantom-mcp mcp add
 *
 *   # Start MCP server manually:
 *   phantom-mcp --mcp
 */
export { cli } from "@phantom/cli";

/**
 * Start the Phantom CLI as an MCP stdio server.
 * Equivalent to running `phantom --mcp` from the terminal.
 */
export async function serve(): Promise<void> {
  const { cli } = await import("@phantom/cli");
  await cli.serve(["--mcp"]);
}
