import { Cli, z } from "incur";
import { SessionManager } from "./session/manager.js";
import { Logger } from "./utils/logger.js";
import { PhantomApiClient } from "@phantom/phantom-api-client";
import { ANALYTICS_HEADERS, NetworkId } from "@phantom/constants";
import { AddressType } from "@phantom/client";
import { base64urlEncode } from "@phantom/base64url";
import { loginCommand } from "./commands/login.js";
import { walletCli } from "./commands/wallet/index.js";
import { solanaCli } from "./commands/solana/index.js";
import { evmCli } from "./commands/evm/index.js";
import { transferCommand } from "./commands/transfer.js";
import { buyCommand } from "./commands/buy.js";
import { simulateCommand } from "./commands/simulate.js";
import { payCommand } from "./commands/pay.js";
import { perpsCli } from "./commands/perps/index.js";
import * as packageJson from "../package.json";
import { varsSchema } from "./vars.js";

const MCP_INSTRUCTIONS = [
  "This is the Phantom Wallet MCP Server. Phantom is an enterprise-grade non-custodial crypto wallet supporting Solana, Ethereum, Bitcoin, Base, Polygon, Sui, and Monad. " +
    "Authentication uses Phantom Connect (OAuth with Google, Apple, or Phantom extension). Sessions persist across restarts. " +
    "Available tools: get_wallet_addresses (check connection & get addresses), get_connection_status (lightweight connection check), " +
    "get_token_balances (check all token balances + USD prices via Phantom portfolio API), " +
    "transfer_tokens (SOL/SPL transfers on Solana), buy_token (Solana token swaps via Phantom routing), " +
    "sign_transaction (sign and broadcast pre-built transactions), sign_message (sign UTF-8 messages). " +
    "Always call get_wallet_addresses or get_connection_status first to confirm the user is authenticated. " +
    "Solana transactions require a small SOL balance (~0.000005 SOL) for network fees. " +
    "If an auth error occurs, re-authentication is triggered and the agent should retry after the user completes browser sign-in.",
];

const STATIC_HEADERS: Record<string, string> = {
  [ANALYTICS_HEADERS.PLATFORM]: "ext-sdk",
  [ANALYTICS_HEADERS.CLIENT]: "mcp",
  [ANALYTICS_HEADERS.SDK_VERSION]: process.env["PHANTOM_VERSION"] ?? "0.0.1",
  // Signal to the backend that this client supports all order types (limit, TP, SL).
  // "0.0.0-dev" is treated as always-eligible by isClientVersionEligible().
  "x-phantom-version": "0.0.0-dev",
};

const logger = new Logger("cli");
const manager = new SessionManager();
const apiClient = new PhantomApiClient({
  baseUrl: process.env["PHANTOM_API_BASE_URL"] ?? "https://api.phantom.app",
});

apiClient.setGetHeaders(() => manager.getOAuthHeaders());

apiClient.setPaymentHandler(async payment => {
  const client = manager.getClient();
  const session = manager.getSession();

  const addresses = await client.getWalletAddresses(session.walletId);
  const account = addresses.find(address => address.addressType === AddressType.solana)?.address;
  if (!account) {
    throw new Error("No Solana address found for payment");
  }

  const txBytes = Buffer.from(payment.preparedTx, "base64");
  const result = await client.signAndSendTransaction({
    walletId: session.walletId,
    transaction: base64urlEncode(txBytes),
    networkId: NetworkId.SOLANA_MAINNET,
    account,
  });

  if (!result.hash) {
    throw new Error("Payment tx submitted but no signature returned");
  }
  return result.hash;
});

export const cli = Cli.create("phantom", {
  version: packageJson.version,
  description: "Interact with your Phantom wallet from the terminal",
  vars: z.object({
    apiClient: varsSchema.shape.apiClient.default(apiClient),
    logger: varsSchema.shape.logger.default(logger),
    manager: varsSchema.shape.manager.default(manager),
  }),
  mcp: {
    instructions: MCP_INSTRUCTIONS.join("\n"),
  },
  sync: {
    suggestions: [
      "log in to my Phantom wallet",
      "show my wallet addresses",
      "check my token balances",
      "transfer tokens",
      "buy tokens",
      "open a perps position",
    ],
  },
});

cli.use(async (c, next) => {
  // The login command manages its own auth via resetSession() — skip initialize()
  // and session-dependent setup so the middleware doesn't trigger a redundant auth flow.
  if (c.command !== "login" && !c.var.manager.isInitialized()) {
    await c.var.manager.initialize();
  }

  const sessionAppId = c.var.manager.isInitialized() ? c.var.manager.getSession().appId : undefined;
  const appId = process.env["PHANTOM_APP_ID"] ?? process.env["PHANTOM_CLIENT_ID"] ?? sessionAppId;

  if (appId) {
    STATIC_HEADERS[ANALYTICS_HEADERS.APP_ID] = appId;
    STATIC_HEADERS["x-api-key"] = appId;
  }
  apiClient.setHeaders(STATIC_HEADERS);

  await next();
});

cli.command(loginCommand);
cli.command(walletCli);
cli.command(solanaCli);
cli.command(evmCli);
cli.command(transferCommand);
cli.command(buyCommand);
cli.command(simulateCommand);
cli.command(payCommand);
cli.command(perpsCli);

export default cli;

// Re-exports for consumers that previously imported from @phantom/mcp-server
export { SessionManager } from "./session/manager.js";
export type { SessionData } from "./session/types.js";
export type { SessionManagerOptions } from "./session/manager.js";
export type { DeviceCodeAuthDisplayOptions } from "./auth/DeviceCodeAuthProvider.js";
export type { PhantomClient } from "@phantom/client";
export { tools, getTool, getToolNames } from "./tools/index.js";
export type { ToolHandler, ToolContext, ToolInputSchema } from "./tools/types.js";
