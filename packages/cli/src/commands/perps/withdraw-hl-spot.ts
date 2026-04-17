import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import {
  withdrawFromHyperliquidSpotTool,
  withdrawFromHyperliquidSpotSchema,
} from "../../tools/withdraw-from-hyperliquid-spot.js";

export const perpsWithdrawHlSpotCommand = Cli.create("withdraw-hl-spot", {
  description: withdrawFromHyperliquidSpotTool.description,
  vars: varsSchema,
  options: withdrawFromHyperliquidSpotSchema,
  mcp: { annotations: withdrawFromHyperliquidSpotTool.annotations, command: withdrawFromHyperliquidSpotTool.name },
  async run(c) {
    return withdrawFromHyperliquidSpotTool.handler(c.options, c.var);
  },
});
