import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { openPerpPositionTool, openPerpPositionSchema } from "../../tools/open-perp-position.js";

export const perpsOpenCommand = Cli.create("open", {
  description: openPerpPositionTool.description,
  vars: varsSchema,
  options: openPerpPositionSchema,
  mcp: { annotations: openPerpPositionTool.annotations, command: openPerpPositionTool.name },
  async run(c) {
    return openPerpPositionTool.handler(c.options, c.var);
  },
});
