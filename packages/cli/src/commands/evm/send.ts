import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { sendEvmTransactionTool, sendEvmTransactionSchema } from "../../tools/send-evm-transaction.js";

export const sendEvmCommand = Cli.create("send", {
  description: sendEvmTransactionTool.description,
  vars: varsSchema,
  options: sendEvmTransactionSchema,
  mcp: { annotations: sendEvmTransactionTool.annotations, command: sendEvmTransactionTool.name },
  async run(c) {
    return sendEvmTransactionTool.handler(c.options, c.var);
  },
});
