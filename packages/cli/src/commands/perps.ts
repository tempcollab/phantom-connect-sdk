import { Cli } from "incur";
import { varsSchema } from "../vars.js";
import { perpsMarketsCommand } from "../actions/get-perp-markets.js";
import { perpsAccountCommand } from "../actions/get-perp-account.js";
import { perpsPositionsCommand } from "../actions/get-perp-positions.js";
import { perpsOrdersCommand } from "../actions/get-perp-orders.js";
import { perpsHistoryCommand } from "../actions/get-perp-trade-history.js";
import { perpsOpenCommand } from "../actions/open-perp-position.js";
import { perpsCloseCommand } from "../actions/close-perp-position.js";
import { perpsCancelCommand } from "../actions/cancel-perp-order.js";
import { perpsLeverageCommand } from "../actions/update-perp-leverage.js";
import { perpsTransferCommand } from "../actions/transfer-spot-to-perps.js";
import { perpsDepositCommand } from "../actions/deposit-to-hyperliquid.js";
import { perpsWithdrawCommand } from "../actions/withdraw-from-perps.js";
import { perpsWithdrawHlSpotCommand } from "../actions/withdraw-from-hyperliquid-spot.js";

export const perpsCli = Cli.create("perps", {
  description: "Hyperliquid perpetuals",
  vars: varsSchema,
});

perpsCli.command(perpsMarketsCommand);
perpsCli.command(perpsAccountCommand);
perpsCli.command(perpsPositionsCommand);
perpsCli.command(perpsOrdersCommand);
perpsCli.command(perpsHistoryCommand);
perpsCli.command(perpsOpenCommand);
perpsCli.command(perpsCloseCommand);
perpsCli.command(perpsCancelCommand);
perpsCli.command(perpsLeverageCommand);
perpsCli.command(perpsTransferCommand);
perpsCli.command(perpsDepositCommand);
perpsCli.command(perpsWithdrawCommand);
perpsCli.command(perpsWithdrawHlSpotCommand);
