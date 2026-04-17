/**
 * withdraw_from_hyperliquid_spot tool
 *
 * Bridges USDC from the Hyperliquid spot wallet to an external chain via the Relay V2 bridge.
 * Delegates all signing and submission logic to PerpsClient.withdrawFromSpot().
 *
 * Note: funds must be in the spot account before calling this tool.
 * Use withdraw_from_perps first if funds are in the perp account.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { getEthereumAddress } from "../utils/evm.js";
import { getSolanaAddress } from "../utils/solana.js";
import { isSolanaChain } from "@phantom/utils";
import { normalizeSwapperChainId } from "../utils/network.js";
import {
  WalletIdSchema,
  DerivationIndexSchema,
  Caip2ChainIdSchema,
  Caip19Schema,
  PositiveNumericStringSchema,
} from "./schemas.js";

export const withdrawFromHyperliquidSpotSchema = z.object({
  amountUsdc: PositiveNumericStringSchema.describe('Amount of USDC to bridge out (e.g. "8.0" for 8 USDC)'),
  destinationChainId: Caip2ChainIdSchema.describe(
    'Destination chain CAIP-2 ID. Examples: "solana:mainnet", "eip155:8453" (Base), ' +
      '"eip155:1" (Ethereum), "eip155:42161" (Arbitrum), "eip155:137" (Polygon).',
  ),
  buyToken: Caip19Schema.optional().describe(
    'CAIP-19 token to receive on the destination chain (e.g. "solana:101/token:EPjFWdd5..."). ' +
      "Defaults to USDC on the destination chain if omitted.",
  ),
  execute: z
    .union([z.boolean(), z.stringbool()])
    .default(false)
    .describe("If false (default), returns the quote only. If true, signs and broadcasts immediately."),
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type WithdrawFromHyperliquidSpotParams = z.infer<typeof withdrawFromHyperliquidSpotSchema>;

export const withdrawFromHyperliquidSpotTool = createTool({
  name: "withdraw_from_hyperliquid_spot",
  description:
    "Bridges USDC from the Hyperliquid spot wallet to an external chain (Solana, Base, Ethereum, Arbitrum, Polygon) " +
    "via the Relay bridge. Funds must be in the Hyperliquid spot account — use withdraw_from_perps first if they " +
    "are in the perp account. " +
    "By default receives USDC on the destination chain; pass buyToken to receive a different asset. " +
    "Use execute: false (default) to preview the quote first.",
  inputSchema: withdrawFromHyperliquidSpotSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const { logger } = context;
    const session = context.manager.getSession();

    const walletId = params.walletId ?? session.walletId;

    const derivationIndex = params.derivationIndex;
    const execute = params.execute;

    const normalizedDestChain = normalizeSwapperChainId(params.destinationChainId);
    const isSolanaDestination = isSolanaChain(normalizedDestChain);

    const destinationAddress = isSolanaDestination
      ? await getSolanaAddress(context, walletId, derivationIndex)
      : await getEthereumAddress(context, walletId, derivationIndex);

    const perps = await createPerpsClient(context, walletId, derivationIndex);

    const withdrawParams = {
      amountUsdc: params.amountUsdc,
      destinationChainId: normalizedDestChain,
      destinationAddress,
      buyToken: params.buyToken,
    };

    if (!execute) {
      logger.info("withdraw_from_hyperliquid_spot: returning quote only (execute: false)");
      const quote = await perps.getWithdrawFromSpotQuote(withdrawParams);
      return { quote };
    }

    return perps.withdrawFromSpot(withdrawParams);
  },
});
