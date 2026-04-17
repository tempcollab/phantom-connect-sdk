/**
 * get_wallet_addresses tool - Gets addresses for the authenticated embedded wallet
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { DerivationIndexSchema } from "./schemas.js";

export const getWalletAddressesSchema = z.object({
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index for the addresses (default: 0)"),
});
export type GetWalletAddressesParams = z.infer<typeof getWalletAddressesSchema>;

export const getWalletAddressesTool = createTool({
  name: "get_wallet_addresses",
  description:
    "Returns all blockchain addresses (Solana, Ethereum, Bitcoin, Sui) for the authenticated Phantom embedded wallet. " +
    "Call this first to confirm the user is connected and to get their wallet addresses before any transfer or swap. " +
    "Response format: {walletId: string, organizationId: string, addresses: [{addressType: string, address: string}]} " +
    "where addressType is one of 'solana', 'ethereum', 'bitcoin', 'sui'. " +
    "Use the Solana address with send_solana_transaction, sign_solana_message, and transfer_tokens; " +
    "use the Ethereum address with send_evm_transaction, sign_evm_personal_message, and sign_evm_typed_data. " +
    "If this returns an auth error (session expired or revoked), call phantom_login to re-authenticate.",
  inputSchema: getWalletAddressesSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const { logger } = context;
    const client = context.manager.getClient();
    const session = context.manager.getSession();

    logger.info("Getting addresses for wallet");

    try {
      // Call PhantomClient to get wallet addresses
      const addresses = await client.getWalletAddresses(
        session.walletId,
        undefined, // Use default derivation paths (Solana, Ethereum, Bitcoin, Sui)
        params.derivationIndex,
      );

      logger.info(`Successfully retrieved ${addresses.length} addresses`);

      return {
        walletId: session.walletId,
        organizationId: session.organizationId,
        addresses: addresses.map(addr => ({
          addressType: addr.addressType,
          address: addr.address,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get wallet addresses: ${errorMessage}`);
      throw new Error(`Failed to get wallet addresses: ${errorMessage}`);
    }
  },
});
