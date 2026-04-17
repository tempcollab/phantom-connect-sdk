/**
 * get_perp_account tool
 *
 * Returns the perpetuals account balance for the authenticated wallet.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "./schemas.js";

export const getPerpAccountSchema = z.object({
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type GetPerpAccountParams = z.infer<typeof getPerpAccountSchema>;

export const getPerpAccountTool = createTool({
  name: "get_perp_account",
  description:
    "Returns the perpetuals account balance including total account value, available balance, and withdrawable amount. The account is on Hyperliquid (funded with USDC).",
  inputSchema: getPerpAccountSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;

    const perps = await createPerpsClient(context, walletId, params.derivationIndex);
    return perps.getBalance();
  },
});
