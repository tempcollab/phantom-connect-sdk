import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getTokenAllowanceTool, getTokenAllowanceSchema } from "../../tools/get-token-allowance.js";

export const allowanceEvmCommand = Cli.create("allowance", {
  description: getTokenAllowanceTool.description,
  vars: varsSchema,
  options: getTokenAllowanceSchema,
  mcp: { annotations: getTokenAllowanceTool.annotations, command: getTokenAllowanceTool.name },
  async run(c) {
    return getTokenAllowanceTool.handler(c.options, c.var);
  },
});
