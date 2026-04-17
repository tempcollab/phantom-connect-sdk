import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getConnectionStatusTool } from "../../tools/get-connection-status.js";

export const walletStatusCommand = Cli.create("status", {
  description: getConnectionStatusTool.description,
  vars: varsSchema,
  mcp: { annotations: getConnectionStatusTool.annotations, command: getConnectionStatusTool.name },
  async run(c) {
    return getConnectionStatusTool.handler({}, c.var);
  },
});
