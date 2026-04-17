import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { getWalletAddressesTool, getWalletAddressesSchema } from "../../tools/get-wallet-addresses.js";

export const walletAddressesCommand = Cli.create("addresses", {
  description: getWalletAddressesTool.description,
  vars: varsSchema,
  options: getWalletAddressesSchema,
  mcp: { annotations: getWalletAddressesTool.annotations, command: getWalletAddressesTool.name },
  async run(c) {
    return getWalletAddressesTool.handler(c.options, c.var);
  },
});
