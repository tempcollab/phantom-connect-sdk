import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { walletStatusCommand } from "./status.js";
import { walletAddressesCommand } from "./addresses.js";
import { walletBalancesCommand } from "./balances.js";
import { walletRebalanceCommand } from "./rebalance.js";

export const walletCli = Cli.create("wallet", {
  description: "Wallet inspection and management commands",
  vars: varsSchema,
});

walletCli.command(walletStatusCommand);
walletCli.command(walletAddressesCommand);
walletCli.command(walletBalancesCommand);
walletCli.command(walletRebalanceCommand);
