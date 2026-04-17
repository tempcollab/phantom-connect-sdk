import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { signEvmPersonalMessageTool, signEvmPersonalMessageSchema } from "../../tools/sign-evm-personal-message.js";

export const signEvmCommand = Cli.create("sign", {
  description: signEvmPersonalMessageTool.description,
  vars: varsSchema,
  options: signEvmPersonalMessageSchema,
  mcp: { annotations: signEvmPersonalMessageTool.annotations, command: signEvmPersonalMessageTool.name },
  async run(c) {
    return signEvmPersonalMessageTool.handler(c.options, c.var);
  },
});
