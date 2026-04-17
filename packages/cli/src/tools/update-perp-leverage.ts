/**
 * update_perp_leverage tool
 *
 * Updates leverage and margin type for a perpetual market on Hyperliquid.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "./schemas.js";

export const updatePerpLeverageSchema = z.object({
  market: z.string().trim().min(1, { message: "market is required" }).describe('Market symbol (e.g. "BTC")'),
  leverage: z.coerce.number().min(1).describe("Leverage multiplier (e.g. 1 for 1x, 10 for 10x)"),
  marginType: z
    .enum(["cross", "isolated"])
    .describe("Margin type: 'cross' shares balance, 'isolated' caps risk per-position"),
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type UpdatePerpLeverageParams = z.infer<typeof updatePerpLeverageSchema>;

export const updatePerpLeverageTool = createTool({
  name: "update_perp_leverage",
  description:
    "Updates the leverage and margin type (cross or isolated) for a perpetual market. " +
    "This takes effect for new orders on that market. Cross margin shares account balance across positions; " +
    "isolated margin limits risk to the margin allocated to that position.",
  inputSchema: updatePerpLeverageSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;
    const perps = await createPerpsClient(context, walletId, params.derivationIndex);

    context.logger.info(`Updating ${params.market} leverage to ${params.leverage}x ${params.marginType}`);

    return perps.updateLeverage({
      market: params.market,
      leverage: params.leverage,
      marginType: params.marginType,
    });
  },
});
