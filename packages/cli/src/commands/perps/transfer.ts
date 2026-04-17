import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { transferSpotToPerpsTool, transferSpotToPerpsSchema } from "../../tools/transfer-spot-to-perps.js";

export const perpsTransferCommand = Cli.create("transfer", {
  description: transferSpotToPerpsTool.description,
  vars: varsSchema,
  options: transferSpotToPerpsSchema,
  mcp: { annotations: transferSpotToPerpsTool.annotations, command: transferSpotToPerpsTool.name },
  async run(c) {
    return transferSpotToPerpsTool.handler(c.options, c.var);
  },
});
