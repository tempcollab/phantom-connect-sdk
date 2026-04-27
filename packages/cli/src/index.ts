import { Cli, z } from "incur";
import { SessionManager } from "./session/manager.js";
import { Logger } from "./utils/logger.js";
import { PhantomApiClient } from "@phantom/phantom-api-client";
import { ANALYTICS_HEADERS, NetworkId } from "@phantom/constants";
import { AddressType } from "@phantom/client";
import { base64urlEncode } from "@phantom/base64url";
import { loginCommand } from "./actions/login.js";
import { logoutCommand } from "./actions/logout.js";
import { walletCli } from "./commands/wallet.js";
import { solanaCli } from "./commands/solana.js";
import { evmCli } from "./commands/evm.js";
import { transferCommand } from "./actions/transfer-tokens.js";
import { buyCommand } from "./actions/buy-token.js";
import { simulateCommand } from "./actions/simulate-transaction.js";
import { payCommand } from "./actions/pay-api-access.js";
import { perpsCli } from "./commands/perps.js";
import { tokenPriceCommand } from "./actions/get-token-price.js";
import * as packageJson from "../package.json";
import { varsSchema } from "./vars.js";
import { tools } from "./tools/index.js";
import { getWalletAddressesTool } from "./actions/get-wallet-addresses.js";
import { getConnectionStatusTool } from "./actions/get-connection-status.js";

const MCP_INSTRUCTIONS = [
  "This is the Phantom Wallet MCP Server. Phantom is an enterprise-grade non-custodial crypto wallet supporting Solana, Ethereum, Bitcoin, Base, Polygon, Sui, and Monad. " +
    "Authentication uses Phantom Connect (OAuth with Google, Apple, or Phantom extension). Sessions persist across restarts. " +
    `Always call ${getWalletAddressesTool.name} or ${getConnectionStatusTool.name} first to confirm the user is authenticated. ` +
    "If an auth error occurs, re-authentication is triggered and the agent should retry after the user completes browser sign-in. ",
  "Available tools: " + tools.map(tool => tool.name).join(", "),
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
  // Login manages auth via resetSession(), and logout clears state directly —
  // skip initialize() for both so middleware doesn't trigger unnecessary auth flow.
  if (![loginCommand.name, logoutCommand.name].includes(c.command) && !c.var.manager.isInitialized()) {
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
cli.command(logoutCommand);
cli.command(walletCli);
cli.command(solanaCli);
cli.command(evmCli);
cli.command(transferCommand);
cli.command(buyCommand);
cli.command(simulateCommand);
cli.command(payCommand);
cli.command(perpsCli);
cli.command(tokenPriceCommand);

export default cli;

// Re-exports for consumers that previously imported from @phantom/mcp-server
export { loginTool } from "./actions/login.js";
export { logoutTool } from "./actions/logout.js";
export { SessionManager } from "./session/manager.js";
export type { SessionData } from "./session/types.js";
export type { DeviceCodeAuthDisplayOptions } from "./auth/DeviceCodeAuthProvider.js";
export type { PhantomClient } from "@phantom/client";
export { tools } from "./tools/index.js";
export type { ToolContext } from "./tools/types.js";
export { PluginConfigSchema, PluginConfigJsonSchema } from "./plugin-config.js";
export type { PluginConfig } from "./plugin-config.js";
