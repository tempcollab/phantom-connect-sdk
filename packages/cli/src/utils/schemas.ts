/**
 * Reusable Zod schemas for MCP tool parameters.
 *
 * Import the base schema and chain .describe() at the call site so each tool
 * can provide context-appropriate wording while sharing validation logic.
 *
 * Schemas with .transform() return a refined type; call sites that need the raw
 * string (e.g. for JSON Schema generation) should use the non-transform variants.
 */

import { z } from "incur";
import { getAddress } from "viem";
import { PublicKey } from "@solana/web3.js";

// ─── Wallet / Derivation ──────────────────────────────────────────────────────

/**
 * HD wallet derivation index.
 * No .describe() or .optional() here — add them at the call site.
 * Using .default(0) so the field is optional from the caller's perspective.
 *
 * @example
 *   derivationIndex: DerivationIndexSchema.describe("Optional derivation index (default: 0)"),
 */
export const DerivationIndexSchema = z.coerce.number().int().min(0).default(0).refine(Number.isSafeInteger, {
  message: "derivationIndex must be a safe integer",
});

/**
 * Optional wallet ID override.
 * No .describe() — add at call site.
 *
 * @example
 *   walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
 */
export const WalletIdSchema = z.string().optional();

// ─── Blockchain Addresses ─────────────────────────────────────────────────────

/**
 * EVM address — validates format and normalizes to EIP-55 checksum.
 *
 * Accepts any case (0xabc, 0xABC, mixed) and returns the checksummed form.
 * Rejects strings that are not 0x-prefixed 40-hex-char addresses.
 */
export const EthereumAddressSchema = z.string().transform((value, ctx) => {
  try {
    return getAddress(value);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Invalid Ethereum address — must be a 0x-prefixed 40-char hex string",
    });
    return z.NEVER;
  }
});

/**
 * Solana address — validates as a valid base58-encoded 32-byte public key.
 * Returns the original string (Solana addresses are case-sensitive, no checksum transform).
 */
export const SolanaAddressSchema = z.string().transform((value, ctx) => {
  try {
    new PublicKey(value);
    return value;
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Invalid Solana address — must be a valid base58-encoded public key",
    });
    return z.NEVER;
  }
});

// ─── Chain Identifiers ────────────────────────────────────────────────────────

/**
 * CAIP-2 chain ID — validates the `namespace:reference` format.
 * Does NOT normalize (e.g. "solana:mainnet" is accepted as-is).
 *
 * Examples: "eip155:1", "solana:mainnet", "bip122:000000000019d6689c085ae165831e93"
 */
export const Caip2ChainIdSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/,
    'Must be a valid CAIP-2 chain ID (e.g. "eip155:1", "solana:mainnet", "eip155:8453")',
  );

/**
 * EVM CAIP-2 chain ID — must start with "eip155:".
 * Examples: "eip155:1", "eip155:8453", "eip155:137"
 */
export const EvmCaip2ChainIdSchema = Caip2ChainIdSchema.refine(
  v => v.startsWith("eip155:"),
  'Must be an EVM chain ID starting with "eip155:" (e.g. "eip155:1" for Ethereum, "eip155:8453" for Base)',
);

/**
 * Solana CAIP-2 chain ID — must start with "solana:".
 * Examples: "solana:mainnet", "solana:devnet", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
 */
export const SolanaCaip2ChainIdSchema = Caip2ChainIdSchema.refine(
  v => v.startsWith("solana:"),
  'Must be a Solana chain ID starting with "solana:" (e.g. "solana:mainnet", "solana:devnet")',
);

/**
 * EVM chain ID coerced from number or string — accepts numeric chain IDs as used by DeFi
 * aggregators (e.g. 1, 8453, "8453", "0x2105").
 * Does NOT validate the chain is supported; use parseChainId() at runtime.
 */
export const EvmChainIdSchema = z
  .union([z.number(), z.string()])
  .describe('EVM chain ID as a number or decimal/hex string (e.g. 1, 8453, "8453", "0x2105" for Base).');

// ─── Token Identifiers ────────────────────────────────────────────────────────

/**
 * CAIP-19 token identifier — validates `{caip2}/{assetNamespace}:{assetReference}` format
 * and cross-validates the asset address against the chain namespace:
 *  - eip155:N/erc20:0xAbCd… — asset address must be a valid EVM address
 *  - solana:N/token:EPjF…  — asset address must be a valid Solana public key
 *  - {any}/slip44:N or {any}/nativeToken:N — native tokens, reference is a numeric slip44 index
 *
 * Examples:
 *   "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
 *   "solana:101/token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 *   "solana:101/slip44:501"
 */
export const Caip19Schema = z.string().superRefine((val, ctx) => {
  const slashIdx = val.indexOf("/");
  if (slashIdx === -1) {
    ctx.addIssue({
      code: "custom",
      message: 'Must be a valid CAIP-19 identifier in the form "chainId/assetNamespace:assetReference"',
    });
    return;
  }

  const chainId = val.slice(0, slashIdx);
  const assetRef = val.slice(slashIdx + 1);

  // Validate chain ID portion using the shared Caip2ChainIdSchema
  if (!Caip2ChainIdSchema.safeParse(chainId).success) {
    ctx.addIssue({ code: "custom", message: `Invalid CAIP-2 chain ID in CAIP-19: "${chainId}"` });
    return;
  }

  // Validate asset reference portion: must have a namespace and reference
  const colonIdx = assetRef.indexOf(":");
  if (colonIdx === -1) {
    ctx.addIssue({
      code: "custom",
      message: `Invalid asset reference in CAIP-19 — must be "namespace:reference", got "${assetRef}"`,
    });
    return;
  }

  const assetNamespace = assetRef.slice(0, colonIdx);
  const assetAddress = assetRef.slice(colonIdx + 1);

  // Cross-validate EVM contract addresses
  const isEvmChain = EvmCaip2ChainIdSchema.safeParse(chainId).success;
  if (isEvmChain && (assetNamespace === "erc20" || assetNamespace === "address")) {
    if (!EthereumAddressSchema.safeParse(assetAddress).success) {
      ctx.addIssue({
        code: "custom",
        message: `EVM ${assetNamespace} address must be a 0x-prefixed 40-char hex string, got "${assetAddress}"`,
      });
    }
  }

  // Cross-validate Solana mint addresses
  const isSolanaChain = SolanaCaip2ChainIdSchema.safeParse(chainId).success;
  if (isSolanaChain && assetNamespace === "token") {
    if (!SolanaAddressSchema.safeParse(assetAddress).success) {
      ctx.addIssue({
        code: "custom",
        message: `Solana token address must be a valid base58-encoded public key, got "${assetAddress}"`,
      });
    }
  }

  // slip44 and nativeToken namespaces: reference must be a non-negative integer
  if (assetNamespace === "slip44" || assetNamespace === "nativeToken") {
    if (!/^\d+$/.test(assetAddress)) {
      ctx.addIssue({
        code: "custom",
        message: `${assetNamespace} asset reference must be a non-negative integer, got "${assetAddress}"`,
      });
    }
  }
});

// ─── Numeric Ranges ───────────────────────────────────────────────────────────

/**
 * Percentage value in [0, 100], excluding non-finite numbers (NaN, ±Infinity).
 * No .describe() — add at call site.
 */
export const PercentageSchema = z.coerce
  .number()
  .refine(Number.isFinite, { message: "Percentage must be a finite number" })
  .min(0)
  .max(100);

// ─── Encoded Strings ─────────────────────────────────────────────────────────

/**
 * 0x-prefixed hex string of any length (including "0x" with no data).
 * Does not enforce even length or minimum length beyond the prefix.
 */
export const HexStringSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]*$/, 'Must be a 0x-prefixed hex string (e.g. "0x", "0x1234abcd")');

/**
 * Standard base64-encoded string (A-Za-z0-9+/= with correct padding).
 * Rejects base64url (- and _) — use this for Solana transaction bytes.
 */
export const Base64Schema = z
  .string()
  .regex(/^[A-Za-z0-9+/]*={0,2}$/, "Must be a valid standard base64 string (A-Za-z0-9+/= with correct padding)")
  .refine(s => s.length % 4 !== 1, "Base64 string has invalid length — check padding");

/**
 * Positive numeric string — validates that the string parses to a finite number greater than 0.
 */
export const PositiveNumericStringSchema = z.string().refine(
  value => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0;
  },
  {
    message: "Must be a positive number string (e.g. '100' or '10.5')",
  },
);
