/**
 * Reusable Zod schemas for action output types.
 *
 * Import these at the call site instead of defining inline schemas for shapes
 * that appear in multiple actions.
 */

import type { ActionResponse, WithdrawFromSpotResult } from "@phantom/perps-client";
import { z } from "incur";

/**
 * Generic response from Hyperliquid write operations (open/close/cancel/leverage/transfer).
 */
export const ActionResponseSchema = z.object({
  status: z.string(),
  data: z.unknown().optional(),
});
assertType<z.infer<typeof ActionResponseSchema>, ActionResponse>();

/**
 * The "preview" leg of two-step transaction flows — returned when `confirmed` is
 * false/omitted so the agent can show the user what will happen before executing.
 */
export const PendingConfirmationSchema = z.object({
  status: z.literal("pending_confirmation"),
  simulation: z.unknown(),
});

/**
 * Result of a successful Relay V2 bridge withdrawal from Hyperliquid spot or perps.
 */
export const WithdrawFromSpotResultSchema = z.object({
  requestId: z.string(),
  details: z.object({
    amountIn: z.string(),
    amountOut: z.string(),
    amountOutUsd: z.string().optional(),
  }),
  checkEndpoint: z.string(),
  execution: z.unknown(),
});
assertType<z.infer<typeof WithdrawFromSpotResultSchema>, WithdrawFromSpotResult>();

/**
 * Single signature returned by all message-signing actions.
 */
export const SignatureOutputSchema = z.object({
  signature: z.string(),
});

/**
 * Output from buy_token and deposit_to_hyperliquid.
 * `execution` is present only when `execute: true` was passed.
 */
export const BuyTokenOutputSchema = z.object({
  quoteRequest: z.record(z.string(), z.unknown()),
  quoteResponse: z.object({
    quotes: z.array(z.record(z.string(), z.unknown())),
  }),
  execution: z
    .object({
      signature: z.string().nullable(),
      rawTransaction: z.string(),
      explorerUrl: z.string().nullable(),
    })
    .optional(),
});

type AssertEqual<T, Expected> = [T] extends [Expected] ? ([Expected] extends [T] ? true : false) : false;

function assertType<T, Expected>(..._: AssertEqual<T, Expected> extends true ? [] : ["invalid type"]) {}
