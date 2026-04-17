/**
 * get_perp_orders tool
 *
 * Returns open perpetual orders for the authenticated wallet.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "./schemas.js";

export const getPerpOrdersSchema = z.object({
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type GetPerpOrdersParams = z.infer<typeof getPerpOrdersSchema>;

export const getPerpOrdersTool = createTool({
  name: "get_perp_orders",
  description:
    "Returns all open perpetual orders (limit orders, take-profit, stop-loss) for the wallet. Each order includes ID, coin, side, type, limit/trigger price, size, and whether it is reduce-only.",
  inputSchema: getPerpOrdersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;

    const perps = await createPerpsClient(context, walletId, params.derivationIndex);
    return perps.getOpenOrders();
  },
});
