/**
 * close_perp_position tool
 *
 * Closes an existing perpetual position on Hyperliquid.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema, PercentageSchema } from "./schemas.js";

export const closePerpPositionSchema = z.object({
  market: z
    .string()
    .trim()
    .min(1, { message: "market is required" })
    .describe('Market symbol of the position to close (e.g. "BTC")'),
  sizePercent: PercentageSchema.min(1)
    .default(100)
    .describe("Percentage of position to close (1–100, default: 100 for full close)"),
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type ClosePerpPositionParams = z.infer<typeof closePerpPositionSchema>;

export const closePerpPositionTool = createTool({
  name: "close_perp_position",
  description:
    "Closes an open perpetual position on Hyperliquid. By default closes 100% of the position. " +
    "Use sizePercent to partially close (e.g. 50 to close half). " +
    "Uses a market IOC order with 10% slippage buffer.",
  inputSchema: closePerpPositionSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;
    const perps = await createPerpsClient(context, walletId, params.derivationIndex);

    context.logger.info(`Closing ${params.sizePercent}% of ${params.market} perp position`);

    return perps.closePosition({
      market: params.market,
      sizePercent: params.sizePercent,
    });
  },
});
