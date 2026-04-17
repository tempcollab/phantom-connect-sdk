import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { updatePerpLeverageTool, updatePerpLeverageSchema } from "../../tools/update-perp-leverage.js";

export const perpsLeverageCommand = Cli.create("leverage", {
  description: updatePerpLeverageTool.description,
  vars: varsSchema,
  options: updatePerpLeverageSchema,
  mcp: { annotations: updatePerpLeverageTool.annotations, command: updatePerpLeverageTool.name },
  async run(c) {
    return updatePerpLeverageTool.handler(c.options, c.var);
  },
});
