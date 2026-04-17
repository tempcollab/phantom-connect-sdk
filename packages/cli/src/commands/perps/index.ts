import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { perpsMarketsCommand } from "./markets.js";
import { perpsAccountCommand } from "./account.js";
import { perpsPositionsCommand } from "./positions.js";
import { perpsOrdersCommand } from "./orders.js";
import { perpsHistoryCommand } from "./history.js";
import { perpsOpenCommand } from "./open.js";
import { perpsCloseCommand } from "./close.js";
import { perpsCancelCommand } from "./cancel.js";
import { perpsLeverageCommand } from "./leverage.js";
import { perpsTransferCommand } from "./transfer.js";
import { perpsDepositCommand } from "./deposit.js";
import { perpsWithdrawCommand } from "./withdraw.js";
import { perpsWithdrawHlSpotCommand } from "./withdraw-hl-spot.js";

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
