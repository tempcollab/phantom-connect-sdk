/**
 * open_perp_position tool
 *
 * Opens a perpetual position on Hyperliquid via Phantom backend.
 */

import { z } from "incur";
import { createTool } from "./types.js";
import { createPerpsClient } from "../utils/perps.js";
import { WalletIdSchema, DerivationIndexSchema } from "./schemas.js";

export const openPerpPositionSchema = z
  .object({
    market: z
      .string()
      .trim()
      .min(1, { message: "market is required" })
      .describe('Market symbol (e.g. "BTC", "ETH", "SOL")'),
    direction: z.enum(["long", "short"]).describe("Position direction"),
    sizeUsd: z.coerce
      .number()
      .refine(n => Number.isFinite(n) && n > 0, { message: "sizeUsd must be a positive number" })
      .describe('Position size in USD (e.g. "100" for $100 notional value)'),
    leverage: z.coerce
      .number()
      .refine(n => Number.isFinite(n) && n >= 1, { message: "leverage must be a finite number >= 1" })
      .describe("Leverage multiplier (e.g. 1 for 1x, 10 for 10x)"),
    orderType: z
      .enum(["market", "limit"])
      .describe("Order type. Market orders execute immediately; limit orders rest on the book"),
    limitPrice: z.coerce.number().optional().describe('Required for limit orders: the limit price (e.g. "50000")'),
    marginType: z
      .enum(["isolated", "cross"])
      .default("isolated")
      .describe("Margin type: 'isolated' (default) limits risk to this position; 'cross' shares account balance"),
    reduceOnly: z
      .union([z.boolean(), z.stringbool()])
      .default(false)
      .describe("If true, the order can only reduce an existing position (default: false)"),
    walletId: WalletIdSchema.describe("Optional wallet ID (defaults to authenticated wallet)"),
    derivationIndex: DerivationIndexSchema.describe("Optional derivation index for the account (default: 0)"),
  })
  .superRefine((data, ctx) => {
    if (data.orderType !== "limit") return;
    const lp = data.limitPrice;
    if (lp === undefined || !Number.isFinite(lp) || lp <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "limitPrice must be a positive number",
        path: ["limitPrice"],
      });
    }
  });
export type OpenPerpPositionParams = z.infer<typeof openPerpPositionSchema>;

export const openPerpPositionTool = createTool({
  name: "open_perp_position",
  description:
    "Opens a perpetual position on Hyperliquid. Supports market and limit orders in either long or short direction. " +
    "The position size is specified in USD. For market orders, a 10% slippage buffer is applied automatically. " +
    "Use get_perp_markets first to verify the market symbol and current price. " +
    "Requires the wallet to have USDC deposited in the perps account (use deposit_to_perps if needed).",
  inputSchema: openPerpPositionSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  handler: async (params, context) => {
    const walletId = params.walletId ?? context.manager.getSession().walletId;
    const perps = await createPerpsClient(context, walletId, params.derivationIndex);

    context.logger.info(
      `Opening ${params.direction} perp position on ${params.market} for $${params.sizeUsd} at ${params.leverage}x leverage`,
    );

    return perps.openPosition({
      market: params.market,
      direction: params.direction,
      sizeUsd: String(params.sizeUsd),
      leverage: params.leverage,
      marginType: params.marginType,
      orderType: params.orderType,
      limitPrice: params.limitPrice !== undefined ? String(params.limitPrice) : undefined,
      reduceOnly: params.reduceOnly,
    });
  },
});
