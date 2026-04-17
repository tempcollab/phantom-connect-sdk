/**
 * MCP Tool types and interfaces
 */

import { z } from "incur";
import type { PhantomApiClient } from "@phantom/phantom-api-client";
import type { Logger } from "../utils/logger.js";
import type { SessionManager } from "../session/manager.js";
import { wrapWithPaymentHandling, type PaymentRequiredResult, type RateLimitedResult } from "../utils/payment.js";

/**
 * Context provided to tool handlers
 */
export interface ToolContext {
  /** Logger instance for this tool */
  logger: Logger;
  /** Shared HTTP client for api.phantom.app (or proxy). Handles 402/429 automatically. */
  apiClient: PhantomApiClient;
  /** Session manager — use manager.getSession() and manager.getClient() to access session and wallet client. */
  manager: SessionManager;
}

/**
 * JSON Schema for MCP tool input validation (used at runtime by the MCP protocol layer).
 * Tool authors supply a Zod schema to createTool; this type is the converted output.
 */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

/**
 * MCP Tool annotations describing safety and behavior characteristics.
 * See: https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations
 */
export interface ToolAnnotations {
  /** If true, the tool only reads data and has no side effects */
  readOnlyHint?: boolean;
  /** If true, the tool may perform destructive or irreversible actions (e.g. sending transactions) */
  destructiveHint?: boolean;
  /** If true, calling the tool repeatedly with the same inputs has the same effect as calling it once */
  idempotentHint?: boolean;
  /** If true, the tool may interact with external systems outside the local environment */
  openWorldHint?: boolean;
}

/**
 * MCP Tool definition. The optional `TResult` type parameter captures the exact return type
 * of the handler — use `ToolHandler` (defaults to `unknown`) when the concrete return type
 * is not needed (e.g. in `ToolHandler[]` collections).
 */
export interface ToolHandler<TResult = unknown> {
  /** Tool name (used in tool calls) */
  name: string;
  /** Tool description (shown to LLM) */
  description: string;
  /** JSON schema for input validation */
  inputSchema: ToolInputSchema;
  /** Safety and behavior annotations */
  annotations?: ToolAnnotations;
  /** Tool handler function */
  handler: (params: Record<string, unknown>, context: ToolContext) => Promise<TResult>;
}

/** Zod schema type accepted by createTool — any object-shaped Zod schema. */
export type ToolSchema = z.ZodType;

/**
 * Converts a Zod object schema to the ToolInputSchema format consumed by the MCP protocol.
 */
function zodToInputSchema(schema: ToolSchema): ToolInputSchema {
  const jsonSchema = z.toJSONSchema(schema, {
    unrepresentable: "any",
    io: "input",
  });

  if (!jsonSchema.properties || jsonSchema.type !== "object") {
    return {
      type: "object",
      properties: {},
    };
  }

  return {
    type: "object",
    properties: jsonSchema.properties,
    required: jsonSchema.required,
  };
}

function isAuthError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { response?: { status?: number } }).response?.status;
    return status === 401 || status === 403;
  }
  return false;
}

/**
 * Creates a ToolHandler with a typed params interface.
 *
 * Pass a Zod schema for `inputSchema` — the handler's `params` type is inferred
 * automatically from the schema via `z.infer<S>`, so no explicit type parameter is needed.
 * The schema is also converted to JSON Schema for the MCP protocol layer.
 *
 * PaymentRequiredError and RateLimitError are automatically converted to structured return
 * values. Auth errors (401/403) clear the session and throw AUTH_EXPIRED.
 *
 * Use `z.coerce.number()` / `z.stringbool()` for numeric and boolean fields so the
 * schema works in both MCP context (already-typed values) and CLI context (string input).
 *
 * @example
 * export const mySchema = z.object({
 *   market: z.string().describe('Market symbol (e.g. "BTC")'),
 *   orderId: z.coerce.number().int().describe("Order ID"),
 * });
 * export type MyParams = z.infer<typeof mySchema>;
 * export const myTool = createTool({
 *   name: "my_tool",
 *   inputSchema: mySchema,
 *   handler: async (params, ctx) => { /* params.market is string * / },
 * });
 */
export function createTool<S extends ToolSchema, TResult>(definition: {
  name: string;
  description: string;
  inputSchema: S;
  annotations?: ToolAnnotations;
  handler: (params: z.infer<S>, context: ToolContext) => Promise<TResult>;
}): ToolHandler<TResult | PaymentRequiredResult | RateLimitedResult> {
  const { inputSchema, handler, ...rest } = definition;
  const wrappedHandler: ToolHandler<TResult | PaymentRequiredResult | RateLimitedResult>["handler"] = async (
    params,
    context,
  ) => {
    const parsed = inputSchema.parse(params);
    try {
      return await wrapWithPaymentHandling(() => handler(parsed, context));
    } catch (err) {
      if (!isAuthError(err)) {
        throw err;
      }
      await context.manager.resetSession();
      throw new Error("AUTH_EXPIRED: Session expired or revoked. Call phantom_login to re-authenticate, then retry.");
    }
  };
  return {
    ...rest,
    handler: wrappedHandler,
    inputSchema: zodToInputSchema(inputSchema),
  };
}
