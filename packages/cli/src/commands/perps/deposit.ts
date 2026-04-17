import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { depositToHyperliquidTool, depositToHyperliquidSchema } from "../../tools/deposit-to-hyperliquid.js";

export const perpsDepositCommand = Cli.create("deposit", {
  description: depositToHyperliquidTool.description,
  vars: varsSchema,
  options: depositToHyperliquidSchema,
  mcp: { annotations: depositToHyperliquidTool.annotations, command: depositToHyperliquidTool.name },
  async run(c) {
    return depositToHyperliquidTool.handler(c.options, c.var);
  },
});
