import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getPerpTradeHistoryTool, getPerpTradeHistorySchema } from "../../tools/get-perp-trade-history.js";

export const perpsHistoryCommand = Cli.create("history", {
  description: getPerpTradeHistoryTool.description,
  vars: varsSchema,
  options: getPerpTradeHistorySchema,
  mcp: { annotations: getPerpTradeHistoryTool.annotations, command: getPerpTradeHistoryTool.name },
  async run(c) {
    return getPerpTradeHistoryTool.handler(c.options, c.var);
  },
});
