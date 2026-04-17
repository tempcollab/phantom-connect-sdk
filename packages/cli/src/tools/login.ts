/**
 * phantom_login tool — triggers a fresh authentication flow
 *
 * Clears the current session and re-authenticates using the configured
 * auth flow (SSO browser redirect or RFC 8628 device code).
 *
 * This tool is handled specially by the `login` command before the normal
 * root middleware (client/session resolution) runs, so it works even when
 * not yet authenticated.
 */

import { z } from "incur";
import { createTool } from "./types.js";

export const loginSchema = z.object({
  displayMode: z
    .enum(["browser", "text"])
    .optional()
    .default("browser")
    .describe(
      "'browser' (default) tries to open the browser automatically. 'text' returns the login prompt text instead.",
    ),
});
export type LoginParams = z.infer<typeof loginSchema>;

export const loginTool = createTool({
  name: "phantom_login",
  description:
    "Re-authenticate with Phantom. Use this to log in for the first time, switch accounts, or refresh an expired session. " +
    "Set displayMode to 'text' if you want the login prompt returned as text instead of trying to open a browser automatically.",
  inputSchema: loginSchema,
  annotations: {
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  // Placeholder — actual execution is handled by the login command before root middleware
  handler: () => {
    throw new Error(
      "phantom_login must be handled by the CLI login command before root middleware runs — it cannot be dispatched through the normal tool handler.",
    );
  },
});
