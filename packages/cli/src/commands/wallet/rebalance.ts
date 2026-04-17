import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { portfolioRebalanceTool, portfolioRebalanceSchema } from "../../tools/portfolio-rebalance.js";

export const walletRebalanceCommand = Cli.create("rebalance", {
  description: portfolioRebalanceTool.description,
  vars: varsSchema,
  options: portfolioRebalanceSchema,
  mcp: { annotations: portfolioRebalanceTool.annotations, command: portfolioRebalanceTool.name },
  async run(c) {
    return portfolioRebalanceTool.handler(c.options, c.var);
  },
});
