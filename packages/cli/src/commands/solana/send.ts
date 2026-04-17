import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { sendSolanaTransactionTool, sendSolanaTransactionSchema } from "../../tools/send-solana-transaction.js";

export const sendSolanaCommand = Cli.create("send", {
  description: sendSolanaTransactionTool.description,
  vars: varsSchema,
  options: sendSolanaTransactionSchema,
  mcp: { annotations: sendSolanaTransactionTool.annotations, command: sendSolanaTransactionTool.name },
  async run(c) {
    return sendSolanaTransactionTool.handler(c.options, c.var);
  },
});
