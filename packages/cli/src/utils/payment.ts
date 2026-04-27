import { PaymentRequiredError, RateLimitError } from "@phantom/phantom-api-client";
import { z } from "incur";

export const PaymentRequiredSchema = z.object({
  paymentRequired: z.literal(true),
  limitType: z.literal("daily"),
  amount: z.string(),
  token: z.string(),
  preparedTx: z.string(),
  message: z.string(),
});

export type PaymentRequiredResult = z.infer<typeof PaymentRequiredSchema>;

export const RateLimitedSchema = z.object({
  rateLimited: z.literal(true),
  retryAfterMs: z.number(),
  message: z.string(),
});

export type RateLimitedResult = z.infer<typeof RateLimitedSchema>;

/**
 * Wraps an async handler and converts PaymentRequiredError / RateLimitError into
 * structured return values instead of thrown errors. All other errors propagate normally.
 */
export async function wrapWithPaymentHandling<T>(
  fn: () => Promise<T>,
): Promise<T | PaymentRequiredResult | RateLimitedResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PaymentRequiredError) {
      return {
        paymentRequired: true,
        limitType: err.limitType,
        amount: err.payment.amount,
        token: err.payment.token,
        preparedTx: err.payment.preparedTx,
        message: `API quota limit reached. Call pay_api_access with the preparedTx to pay ${err.payment.amount} ${err.payment.token} and unlock access.`,
      };
    }
    if (err instanceof RateLimitError) {
      return {
        rateLimited: true,
        retryAfterMs: err.retryAfterMs,
        message: `Too many requests. Retry in ${err.retryAfterMs}ms.`,
      };
    }
    throw err;
  }
}
