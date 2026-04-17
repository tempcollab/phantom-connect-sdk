/**
 * get_perp_trade_history tool
 *
 * Returns trade history for the authenticated wallet's perpetuals account.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "./schemas.js";

export const getPerpTradeHistorySchema = z.object({
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type GetPerpTradeHistoryParams = z.infer<typeof getPerpTradeHistorySchema>;

export const getPerpTradeHistoryTool = createTool({
  name: "get_perp_trade_history",
  description:
    "Returns historical perpetual trades for the wallet. Each entry includes trade ID, coin, type (open/close/liquidation), timestamp, price, size, trade value, fee, and closed PnL.",
  inputSchema: getPerpTradeHistorySchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;

    const perps = await createPerpsClient(context, walletId, params.derivationIndex);
    return perps.getTradeHistory();
  },
});
