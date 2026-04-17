import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getPerpPositionsTool, getPerpPositionsSchema } from "../../tools/get-perp-positions.js";

export const perpsPositionsCommand = Cli.create("positions", {
  description: getPerpPositionsTool.description,
  vars: varsSchema,
  options: getPerpPositionsSchema,
  mcp: { annotations: getPerpPositionsTool.annotations, command: getPerpPositionsTool.name },
  async run(c) {
    return getPerpPositionsTool.handler(c.options, c.var);
  },
});
