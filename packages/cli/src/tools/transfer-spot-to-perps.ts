/**
 * transfer_spot_to_perps tool
 *
 * Moves USDC from the Hyperliquid spot account into the perps account.
 * Both accounts live on Hypercore (Hyperliquid's chain) — this is an
 * internal Hyperliquid transfer, not a cross-chain bridge.
 *
 * To get USDC onto the Hyperliquid spot account from an external chain
 * (Solana, Ethereum, Base, Arbitrum) you need a dedicated bridge flow
 * via the Phantom /swap/v2/spot/funding endpoint — that is not handled here.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema, PositiveNumericStringSchema } from "./schemas.js";

export const transferSpotToPerpsSchema = z.object({
  amountUsdc: PositiveNumericStringSchema.describe(
    'Amount of USDC to move from spot to perps (e.g. "100" for 100 USDC)',
  ),
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type TransferSpotToPerpsParams = z.infer<typeof transferSpotToPerpsSchema>;

export const transferSpotToPerpsTool = createTool({
  name: "transfer_spot_to_perps",
  description:
    "Moves USDC from the Hyperliquid spot account into the perpetuals account. " +
    "Both accounts live on Hypercore (Hyperliquid's own chain) — this is an internal transfer, not a cross-chain bridge. " +
    "IMPORTANT: This only works if USDC is already in your Hyperliquid spot account. " +
    "If your USDC is on Solana, Ethereum, Base, or Arbitrum you need to bridge it to Hyperliquid first " +
    "(the Phantom app handles this via the dedicated Hyperliquid deposit flow). " +
    "Use get_perp_account to verify the perp balance after transferring.",
  inputSchema: transferSpotToPerpsSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;
    const perps = await createPerpsClient(context, walletId, params.derivationIndex);

    context.logger.info(`Transferring ${params.amountUsdc} USDC from Hyperliquid spot → perps`);

    return perps.deposit(params.amountUsdc);
  },
});
