/**
 * get_perp_markets tool
 *
 * Returns all available perpetual markets on Hyperliquid with current prices,
 * funding rates, and market metadata.
 */

import { Cli, z } from "incur";
import { createAction } from "../utils/actions.js";
import { createPerpsClient, createAnonymousPerpsClient } from "../utils/perps.js";
import { WalletIdSchema } from "../utils/schemas.js";

const GetPerpMarketsSchema = z.object({
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
});

const PerpMarketSchema = z.object({
  symbol: z.string(),
  assetId: z.number(),
  maxLeverage: z.number(),
  szDecimals: z.number(),
  price: z.string(),
  fundingRate: z.string(),
  openInterest: z.string(),
  volume24h: z.string(),
});

const GetPerpMarketsOutputSchema = z.array(PerpMarketSchema);

const getPerpMarketsAction = createAction({
  description:
    "Returns all available perpetual markets on Hyperliquid with current prices, funding rates, open interest, 24h volume, max leverage, and asset IDs. Use this to discover tradeable markets and get current prices before opening positions.",
  options: GetPerpMarketsSchema,
  output: GetPerpMarketsOutputSchema,
  mcp: {
    command: "get_perp_markets",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  run: async ({ options: params, var: context }) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;
    const perps = walletId ? await createPerpsClient(context, walletId) : createAnonymousPerpsClient(context);
    return perps.getMarkets();
  },
});

export const perpsMarketsCommand = Cli.create("markets", getPerpMarketsAction.command);
export const getPerpMarketsTool = getPerpMarketsAction.tool;
