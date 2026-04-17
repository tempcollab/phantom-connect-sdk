/**
 * get_perp_positions tool
 *
 * Returns open perpetual positions for the authenticated wallet.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "./schemas.js";

export const getPerpPositionsSchema = z.object({
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type GetPerpPositionsParams = z.infer<typeof getPerpPositionsSchema>;

export const getPerpPositionsTool = createTool({
  name: "get_perp_positions",
  description:
    "Returns all open perpetual positions for the wallet. Each position includes coin, direction (long/short), size, margin, entry price, leverage, unrealized PnL, and liquidation price.",
  inputSchema: getPerpPositionsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;

    const perps = await createPerpsClient(context, walletId, params.derivationIndex);
    return perps.getPositions();
  },
});
