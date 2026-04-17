import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getTokenBalancesTool, getTokenBalancesSchema } from "../../tools/get-token-balances.js";

export const walletBalancesCommand = Cli.create("balances", {
  description: getTokenBalancesTool.description,
  vars: varsSchema,
  options: getTokenBalancesSchema,
  mcp: { annotations: getTokenBalancesTool.annotations, command: getTokenBalancesTool.name },
  async run(c) {
    return getTokenBalancesTool.handler(c.options, c.var);
  },
});
