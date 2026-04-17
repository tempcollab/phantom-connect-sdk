import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { cancelPerpOrderTool, cancelPerpOrderSchema } from "../../tools/cancel-perp-order.js";

export const perpsCancelCommand = Cli.create("cancel", {
  description: cancelPerpOrderTool.description,
  vars: varsSchema,
  options: cancelPerpOrderSchema,
  mcp: { annotations: cancelPerpOrderTool.annotations, command: cancelPerpOrderTool.name },
  async run(c) {
    return cancelPerpOrderTool.handler(c.options, c.var);
  },
});
