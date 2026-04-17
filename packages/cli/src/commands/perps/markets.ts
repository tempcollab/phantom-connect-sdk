import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getPerpMarketsTool, getPerpMarketsSchema } from "../../tools/get-perp-markets.js";

export const perpsMarketsCommand = Cli.create("markets", {
  description: getPerpMarketsTool.description,
  vars: varsSchema,
  options: getPerpMarketsSchema,
  mcp: { annotations: getPerpMarketsTool.annotations, command: getPerpMarketsTool.name },
  async run(c) {
    return getPerpMarketsTool.handler(c.options, c.var);
  },
});
