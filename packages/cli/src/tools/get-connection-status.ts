/**
 * get_connection_status tool - Returns current Phantom wallet connection status
 */

import { z } from "incur";
import { createTool } from "./types.js";
import * as packageJson from "../../package.json";

export const getConnectionStatusSchema = z.object({});
export type GetConnectionStatusParams = z.infer<typeof getConnectionStatusSchema>;

export const getConnectionStatusTool = createTool({
  name: "get_connection_status",
  description:
    "Phantom Wallet — Returns the current Phantom embedded wallet connection status. " +
    "Use this as a lightweight check before other operations to confirm the user is authenticated. " +
    "Unlike get_wallet_addresses, this does NOT make an API call and cannot trigger re-authentication; " +
    "it simply reports whether a local session exists. " +
    "Response when connected: {connected: true, walletId: string, organizationId: string, mcpServerVersion: string}. " +
    "Response when not connected: {connected: false, reason: string, mcpServerVersion: string}. " +
    "If connected is false, call get_wallet_addresses to trigger the Phantom Connect browser sign-in flow. " +
    "If connected is true but subsequent tool calls fail with AUTH_EXPIRED, the server-side session was revoked — " +
    "any tool call will automatically re-trigger authentication.",
  inputSchema: getConnectionStatusSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (_params, context) => {
    const { logger } = context;

    logger.info("Checking connection status");

    if (!context.manager.isInitialized()) {
      return Promise.resolve({
        connected: false,
        reason: "No active session found. Call get_wallet_addresses to authenticate.",
        mcpServerVersion: packageJson.version,
      });
    }

    const session = context.manager.getSession();
    return Promise.resolve({
      connected: true,
      walletId: session.walletId,
      organizationId: session.organizationId,
      mcpServerVersion: packageJson.version,
    });
  },
});
