import { Cli } from "incur";
import { varsSchema } from "../vars.js";
import { payApiAccessTool, payApiAccessSchema } from "../tools/pay-api-access.js";

export const payCommand = Cli.create("pay", {
  description: payApiAccessTool.description,
  vars: varsSchema,
  options: payApiAccessSchema,
  mcp: { annotations: payApiAccessTool.annotations, command: payApiAccessTool.name },
  async run(c) {
    return payApiAccessTool.handler(c.options, c.var);
  },
});
