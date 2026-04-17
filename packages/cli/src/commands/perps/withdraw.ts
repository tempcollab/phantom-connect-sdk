import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { withdrawFromPerpsTool, withdrawFromPerpsSchema } from "../../tools/withdraw-from-perps.js";

export const perpsWithdrawCommand = Cli.create("withdraw", {
  description: withdrawFromPerpsTool.description,
  vars: varsSchema,
  options: withdrawFromPerpsSchema,
  mcp: { annotations: withdrawFromPerpsTool.annotations, command: withdrawFromPerpsTool.name },
  async run(c) {
    return withdrawFromPerpsTool.handler(c.options, c.var);
  },
});
