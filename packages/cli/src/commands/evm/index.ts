import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { sendEvmCommand } from "./send.js";
import { signEvmCommand } from "./sign.js";
import { signEvmTypedCommand } from "./sign-typed.js";
import { allowanceEvmCommand } from "./allowance.js";

export const evmCli = Cli.create("evm", {
  description: "EVM operations",
  vars: varsSchema,
});

evmCli.command(sendEvmCommand);
evmCli.command(signEvmCommand);
evmCli.command(signEvmTypedCommand);
evmCli.command(allowanceEvmCommand);
