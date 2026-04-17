import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { closePerpPositionTool, closePerpPositionSchema } from "../../tools/close-perp-position.js";

export const perpsCloseCommand = Cli.create("close", {
  description: closePerpPositionTool.description,
  vars: varsSchema,
  options: closePerpPositionSchema,
  mcp: { annotations: closePerpPositionTool.annotations, command: closePerpPositionTool.name },
  async run(c) {
    return closePerpPositionTool.handler(c.options, c.var);
  },
});
