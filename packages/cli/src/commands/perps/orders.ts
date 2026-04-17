import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getPerpOrdersTool, getPerpOrdersSchema } from "../../tools/get-perp-orders.js";

export const perpsOrdersCommand = Cli.create("orders", {
  description: getPerpOrdersTool.description,
  vars: varsSchema,
  options: getPerpOrdersSchema,
  mcp: { annotations: getPerpOrdersTool.annotations, command: getPerpOrdersTool.name },
  async run(c) {
    return getPerpOrdersTool.handler(c.options, c.var);
  },
});
