import { Cli, z } from "incur";
import { varsSchema } from "../vars.js";
import { loginSchema, loginTool } from "../tools/login.js";

export const loginCommand = Cli.create("login", {
  description:
    "Re-authenticate with Phantom. Use this to log in for the first time, switch accounts, or refresh an expired session.",
  vars: varsSchema,
  options: loginSchema,
  mcp: { annotations: loginTool.annotations, command: loginTool.name },
  output: z.object({
    walletId: z.string(),
    organizationId: z.string(),
  }),
  async run({ options, var: vars }) {
    try {
      await vars.manager.resetSession({
        openBrowser: options.displayMode === "browser",
        promptOnly: options.displayMode === "text",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Authentication failed: ${message}`);
    }
    const session = vars.manager.getSession();
    return { walletId: session.walletId, organizationId: session.organizationId };
  },
});
