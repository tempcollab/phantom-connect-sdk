import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { signSolanaMessageTool, signSolanaMessageSchema } from "../../tools/sign-solana-message.js";

export const signSolanaCommand = Cli.create("sign", {
  description: signSolanaMessageTool.description,
  vars: varsSchema,
  options: signSolanaMessageSchema,
  mcp: { annotations: signSolanaMessageTool.annotations, command: signSolanaMessageTool.name },
  async run(c) {
    return signSolanaMessageTool.handler(c.options, c.var);
  },
});
