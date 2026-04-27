import { Cli } from "incur";
import { varsSchema } from "../vars.js";
import { sendSolanaCommand } from "../actions/send-solana-transaction.js";
import { signSolanaCommand } from "../actions/sign-solana-message.js";

export const solanaCli = Cli.create("solana", {
  description: "Solana operations",
  vars: varsSchema,
});

solanaCli.command(sendSolanaCommand);
solanaCli.command(signSolanaCommand);
