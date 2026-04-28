/**
 * get_perp_trade_history tool
 *
 * Returns trade history for the authenticated wallet's perpetuals account.
 */

import { Cli, z } from "incur";
import { createAction } from "../utils/actions.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "../utils/schemas.js";

const GetPerpTradeHistorySchema = z.object({
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});

const PerpTradeSchema = z.object({
  id: z.string(),
  coin: z.string(),
  type: z.string(),
  timestamp: z.number(),
  price: z.string(),
  size: z.string(),
  tradeValue: z.string(),
  fee: z.string(),
  closedPnl: z.string().optional(),
});

const GetPerpTradeHistoryOutputSchema = z.array(PerpTradeSchema);

const getPerpTradeHistoryAction = createAction({
  description:
    "Returns historical perpetual trades for the wallet. Each entry includes trade ID, coin, type (open/close/liquidation), timestamp, price, size, trade value, fee, and closed PnL.",
  options: GetPerpTradeHistorySchema,
  output: GetPerpTradeHistoryOutputSchema,
  mcp: {
    command: "get_perp_trade_history",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  run: async ({ options: params, var: context }) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;

    const perps = await createPerpsClient(context, walletId, params.derivationIndex);
    return perps.getTradeHistory();
  },
});

export const perpsHistoryCommand = Cli.create("history", getPerpTradeHistoryAction.command);
export const getPerpTradeHistoryTool = getPerpTradeHistoryAction.tool;
