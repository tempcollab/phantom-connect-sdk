/**
 * get_perp_markets tool
 *
 * Returns all available perpetual markets on Hyperliquid with current prices,
 * funding rates, and market metadata.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient, createAnonymousPerpsClient } from "../utils/perps.js";
import { WalletIdSchema } from "./schemas.js";

export const getPerpMarketsSchema = z.object({
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
});
export type GetPerpMarketsParams = z.infer<typeof getPerpMarketsSchema>;

export const getPerpMarketsTool = createTool({
  name: "get_perp_markets",
  description:
    "Returns all available perpetual markets on Hyperliquid with current prices, funding rates, open interest, 24h volume, max leverage, and asset IDs. Use this to discover tradeable markets and get current prices before opening positions.",
  inputSchema: getPerpMarketsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;
    const perps = walletId ? await createPerpsClient(context, walletId) : createAnonymousPerpsClient(context);
    return perps.getMarkets();
  },
});
