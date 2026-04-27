import { Cli } from "incur";
import { varsSchema } from "../vars.js";
import { walletStatusCommand } from "../actions/get-connection-status.js";
import { walletAddressesCommand } from "../actions/get-wallet-addresses.js";
import { walletBalancesCommand } from "../actions/get-token-balances.js";
import { walletRebalanceCommand } from "../actions/portfolio-rebalance.js";

export const walletCli = Cli.create("wallet", {
  description: "Wallet inspection and management commands",
  vars: varsSchema,
});

walletCli.command(walletStatusCommand);
walletCli.command(walletAddressesCommand);
walletCli.command(walletBalancesCommand);
walletCli.command(walletRebalanceCommand);
