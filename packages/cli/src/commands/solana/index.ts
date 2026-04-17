import { Cli } from "incur";
import { varsSchema } from "../../vars.js";
import { sendSolanaCommand } from "./send.js";
import { signSolanaCommand } from "./sign.js";

export const solanaCli = Cli.create("solana", {
  description: "Solana operations",
  vars: varsSchema,
});

solanaCli.command(sendSolanaCommand);
solanaCli.command(signSolanaCommand);
