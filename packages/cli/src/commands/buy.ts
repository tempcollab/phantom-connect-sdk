import { Cli } from "incur";
import { varsSchema } from "../vars.js";
import { buyTokenTool, buyTokenSchema } from "../tools/buy-token.js";

export const buyCommand = Cli.create("buy", {
  description: buyTokenTool.description,
  vars: varsSchema,
  options: buyTokenSchema,
  mcp: { annotations: buyTokenTool.annotations, command: buyTokenTool.name },
  async run(c) {
    return buyTokenTool.handler(c.options, c.var);
  },
});
