/**
 * get_token_allowance tool
 *
 * Returns the ERC-20 allowance granted by an owner to a spender on any supported EVM chain.
 * Useful before a swap to check whether an approval transaction is needed.
 */

import { z } from "incur";
import type { NetworkId } from "@phantom/client";
import { isEthereumChain } from "@phantom/utils";
import { chainIdToNetworkId } from "@phantom/constants";
import { createTool } from "./types.js";
import { getEthereumAddress } from "../utils/evm.js";
import { fetchERC20Allowance } from "../utils/allowance.js";
import { resolveEvmRpcUrl } from "../utils/rpc.js";
import { parseChainId } from "../utils/params.js";
import { WalletIdSchema, DerivationIndexSchema, EvmChainIdSchema, EthereumAddressSchema } from "./schemas.js";

export const getTokenAllowanceSchema = z.object({
  chainId: EvmChainIdSchema.describe(
    'EVM chain ID (e.g. 8453 for Base, 1 for Ethereum, 137 for Polygon). Accepts a number, decimal string, or hex string (e.g. "0x2105").',
  ),
  tokenAddress: EthereumAddressSchema.describe("ERC-20 token contract address (0x-prefixed, checksummed)."),
  spenderAddress: EthereumAddressSchema.describe("Address of the spender to check allowance for (e.g. a swap router)."),
  ownerAddress: EthereumAddressSchema.optional().describe(
    "Address of the token owner. If omitted, the authenticated wallet address for the chain is used.",
  ),
  derivationIndex: DerivationIndexSchema.describe(
    "Optional derivation index for the wallet address (default: 0). Only used when ownerAddress is omitted.",
  ),
  rpcUrl: z.string().optional().describe("Optional EVM RPC URL override."),
  walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
});
export type GetTokenAllowanceParams = z.infer<typeof getTokenAllowanceSchema>;

export const getTokenAllowanceTool = createTool({
  name: "get_token_allowance",
  description:
    "Returns the ERC-20 token allowance granted by an owner address to a spender address on a supported EVM chain. " +
    "Use this before a swap to check whether an approval transaction is needed. " +
    "If ownerAddress is omitted, the authenticated wallet address for the chain is used.",
  inputSchema: getTokenAllowanceSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const { logger } = context;
    const session = context.manager.getSession();

    const chainId = parseChainId(params.chainId);
    const networkId = chainIdToNetworkId(chainId) as NetworkId | undefined;
    if (!networkId || !isEthereumChain(networkId)) {
      throw new Error(
        `Unsupported chainId: ${chainId}. Use a supported EVM chain ID (e.g. 1 for Ethereum, 8453 for Base, 137 for Polygon).`,
      );
    }

    // EthereumAddressSchema already validates and checksums these at parse time
    const tokenAddress = params.tokenAddress;
    const spenderAddress = params.spenderAddress;
    const rpcUrl = resolveEvmRpcUrl(networkId, params.rpcUrl);

    // Resolve owner: explicit address or derive from wallet
    let ownerAddress: string;
    if (params.ownerAddress !== undefined) {
      ownerAddress = params.ownerAddress;
    } else {
      const walletId = params.walletId ?? session.walletId;
      ownerAddress = await getEthereumAddress(context, walletId, params.derivationIndex);
    }

    logger.info(`Checking ERC-20 allowance: token=${tokenAddress} owner=${ownerAddress} spender=${spenderAddress}`);

    const allowance = await fetchERC20Allowance(rpcUrl, tokenAddress, ownerAddress, spenderAddress);
    const allowanceDecimal = allowance.toString();
    const allowanceHex = "0x" + allowance.toString(16);

    return {
      chainId,
      tokenAddress,
      ownerAddress,
      spenderAddress,
      allowance: allowanceDecimal,
      allowanceHex,
    };
  },
});
