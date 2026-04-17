import { Cli } from "incur";
import { varsSchema } from "../vars.js";
import { transferTokensTool, transferTokensSchema } from "../tools/transfer-tokens.js";

export const transferCommand = Cli.create("transfer", {
  description: transferTokensTool.description,
  vars: varsSchema,
  options: transferTokensSchema,
  mcp: { annotations: transferTokensTool.annotations, command: transferTokensTool.name },
  async run(c) {
    return transferTokensTool.handler(c.options, c.var);
  },
});
