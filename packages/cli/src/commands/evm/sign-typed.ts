import { Cli, z } from "incur";
import { varsSchema } from "../../vars.js";
import { signEvmTypedDataTool, signEvmTypedDataSchema } from "../../tools/sign-evm-typed-data.js";

// CLI-specific schema: accepts typedData as a JSON string (from --typed-data '{}') or object (from MCP/tests).
// The tool schema stays unmodified so MCP clients see the correct object shape.
const signEvmTypedCliSchema = signEvmTypedDataSchema.extend({
  typedData: z.preprocess(val => {
    if (typeof val !== "string") {
      return val;
    }
    try {
      return JSON.parse(val);
    } catch (e) {
      throw new Error(`Invalid JSON for --typed-data: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, signEvmTypedDataSchema.shape.typedData),
});

export const signEvmTypedCommand = Cli.create("sign-typed", {
  description: signEvmTypedDataTool.description,
  vars: varsSchema,
  options: signEvmTypedCliSchema,
  mcp: { annotations: signEvmTypedDataTool.annotations, command: signEvmTypedDataTool.name },
  async run(c) {
    return signEvmTypedDataTool.handler(c.options, c.var);
  },
});
