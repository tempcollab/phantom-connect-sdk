import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getPerpAccountTool, getPerpAccountSchema } from "../../tools/get-perp-account.js";

export const perpsAccountCommand = Cli.create("account", {
  description: getPerpAccountTool.description,
  vars: varsSchema,
  options: getPerpAccountSchema,
  mcp: { annotations: getPerpAccountTool.annotations, command: getPerpAccountTool.name },
  async run(c) {
    return getPerpAccountTool.handler(c.options, c.var);
  },
});
