import { Cli } from "incur";
import { varsSchema } from "../vars.js";
import { sendEvmCommand } from "../actions/send-evm-transaction.js";
import { signEvmCommand } from "../actions/sign-evm-personal-message.js";
import { signEvmTypedCommand } from "../actions/sign-evm-typed-data.js";
import { allowanceEvmCommand } from "../actions/get-token-allowance.js";

export const evmCli = Cli.create("evm", {
  description: "EVM operations",
  vars: varsSchema,
});

evmCli.command(sendEvmCommand);
evmCli.command(signEvmCommand);
evmCli.command(signEvmTypedCommand);
evmCli.command(allowanceEvmCommand);
