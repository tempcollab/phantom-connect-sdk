import { Cli, z } from "incur";
import { varsSchema } from "../vars.js";
import { simulateTransactionTool, simulateTransactionSchema } from "../tools/simulate-transaction.js";

// CLI-specific schema: accepts params as a JSON string (from --params '{}') or object.
// The tool schema stays unmodified so MCP clients see the correct object shape.
const simulateCliSchema = simulateTransactionSchema.extend({
  params: z.preprocess(val => {
    if (typeof val !== "string") {
      return val;
    }
    try {
      return JSON.parse(val);
    } catch (e) {
      throw new Error(`Invalid JSON for --params: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, simulateTransactionSchema.shape.params),
});

export const simulateCommand = Cli.create("simulate", {
  description: simulateTransactionTool.description,
  vars: varsSchema,
  options: simulateCliSchema,
  mcp: { annotations: simulateTransactionTool.annotations, command: simulateTransactionTool.name },
  async run(c) {
    return simulateTransactionTool.handler(c.options, c.var);
  },
});
