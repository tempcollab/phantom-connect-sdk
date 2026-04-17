/**
 * cancel_perp_order tool
 *
 * Cancels an open perpetual order on Hyperliquid.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "./schemas.js";

export const cancelPerpOrderSchema = z.object({
  market: z.string().trim().min(1, { message: "market is required" }).describe('Market symbol (e.g. "BTC")'),
  orderId: z.coerce
    .number()
    .int()
    .refine(n => Number.isSafeInteger(n), {
      message: "orderId must be a safe integer",
    })
    .describe("The numeric order ID to cancel (from get_perp_orders)"),
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type CancelPerpOrderParams = z.infer<typeof cancelPerpOrderSchema>;

export const cancelPerpOrderTool = createTool({
  name: "cancel_perp_order",
  description:
    "Cancels an open perpetual order on Hyperliquid. Use get_perp_orders to retrieve the order ID before cancelling.",
  inputSchema: cancelPerpOrderSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;
    const perps = await createPerpsClient(context, walletId, params.derivationIndex);

    context.logger.info(`Cancelling perp order ${params.orderId} on ${params.market}`);

    return perps.cancelOrder({
      market: params.market,
      orderId: params.orderId,
    });
  },
});
