/**
 * pay_api_access tool — signs and broadcasts the unsigned CASH token transfer tx
 * returned in an API_PAYMENT_REQUIRED error, then stores the signature so all
 * subsequent requests are automatically unlocked for the rest of the day.
 */

import { z } from "incur";
import { AddressType, NetworkId } from "@phantom/client";
import { base64urlEncode } from "@phantom/base64url";
import { createTool } from "./types.js";
import { WalletIdSchema, DerivationIndexSchema, Base64Schema } from "./schemas.js";

export const payApiAccessSchema = z.object({
  preparedTx: Base64Schema.describe(
    "Base64-encoded unsigned Solana transaction from the API_PAYMENT_REQUIRED error response",
  ),
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
  derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
});
export type PayApiAccessParams = z.infer<typeof payApiAccessSchema>;

export const payApiAccessTool = createTool({
  name: "pay_api_access",
  description:
    "Phantom Wallet — Pays for daily API access by signing and broadcasting the CASH token transfer " +
    "transaction included in an API_PAYMENT_REQUIRED error response. " +
    "Call this when any tool returns error code API_PAYMENT_REQUIRED, passing the preparedTx from that response. " +
    "On success, the payment signature is stored and API calls are unlocked until the purchased quota is consumed. " +
    "After calling this, retry the original tool that triggered the payment requirement.",
  inputSchema: payApiAccessSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const { apiClient } = context;
    const client = context.manager.getClient();
    const session = context.manager.getSession();

    const walletId = params.walletId ?? session.walletId;
    const derivationIndex = params.derivationIndex;

    const txBytes = Buffer.from(params.preparedTx, "base64");

    const addresses = await client.getWalletAddresses(walletId, undefined, derivationIndex);
    const solanaAddress = addresses.find(a => a.addressType === AddressType.solana)?.address;
    if (!solanaAddress) throw new Error("No Solana address found for this wallet");

    const result = await client.signAndSendTransaction({
      walletId,
      transaction: base64urlEncode(txBytes),
      networkId: NetworkId.SOLANA_MAINNET,
      account: solanaAddress,
      derivationIndex,
    });

    if (!result.hash) throw new Error("Transaction submitted but no signature returned");

    // Store the signature — included as X-Payment on all subsequent requests
    apiClient.setPaymentSignature(result.hash);

    return {
      success: true,
      signature: result.hash,
      message:
        "API quota refreshed. Retry the original action now. You may need to pay again if you hit the quota limit.",
    };
  },
});
