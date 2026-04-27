/**
 * MCP Tools Registry
 *
 * Aggregates all tools defined in ../actions/* (wallet, Solana, EVM, Hyperliquid perps, utilities).
 */

import { getWalletAddressesTool } from "../actions/get-wallet-addresses.js";
import { getConnectionStatusTool } from "../actions/get-connection-status.js";
import { getTokenBalancesTool } from "../actions/get-token-balances.js";
import { transferTokensTool } from "../actions/transfer-tokens.js";
import { buyTokenTool } from "../actions/buy-token.js";
import { loginTool } from "../actions/login.js";
import { logoutTool } from "../actions/logout.js";
import { sendSolanaTransactionTool } from "../actions/send-solana-transaction.js";
import { sendEvmTransactionTool } from "../actions/send-evm-transaction.js";
import { signSolanaMessageTool } from "../actions/sign-solana-message.js";
import { signEvmPersonalMessageTool } from "../actions/sign-evm-personal-message.js";
import { signEvmTypedDataTool } from "../actions/sign-evm-typed-data.js";
import { simulateTransactionTool } from "../actions/simulate-transaction.js";
import { portfolioRebalanceTool } from "../actions/portfolio-rebalance.js";
import { getPerpMarketsTool } from "../actions/get-perp-markets.js";
import { getPerpAccountTool } from "../actions/get-perp-account.js";
import { getPerpPositionsTool } from "../actions/get-perp-positions.js";
import { getPerpOrdersTool } from "../actions/get-perp-orders.js";
import { getPerpTradeHistoryTool } from "../actions/get-perp-trade-history.js";
import { openPerpPositionTool } from "../actions/open-perp-position.js";
import { closePerpPositionTool } from "../actions/close-perp-position.js";
import { cancelPerpOrderTool } from "../actions/cancel-perp-order.js";
import { updatePerpLeverageTool } from "../actions/update-perp-leverage.js";
import { transferSpotToPerpsTool } from "../actions/transfer-spot-to-perps.js";
import { depositToHyperliquidTool } from "../actions/deposit-to-hyperliquid.js";
import { withdrawFromPerpsTool } from "../actions/withdraw-from-perps.js";
import { withdrawFromHyperliquidSpotTool } from "../actions/withdraw-from-hyperliquid-spot.js";

import { payApiAccessTool } from "../actions/pay-api-access.js";
import { getTokenAllowanceTool } from "../actions/get-token-allowance.js";
import { getTokenPriceTool } from "../actions/get-token-price.js";
import type { ToolHandler } from "./types.js";

/**
 * Array of all available tools
 */
export const tools: ToolHandler[] = [
  loginTool,
  logoutTool,
  // Wallet utilities
  getWalletAddressesTool,
  getConnectionStatusTool,
  getTokenBalancesTool,
  getTokenPriceTool,
  simulateTransactionTool,
  // Solana tools
  sendSolanaTransactionTool,
  signSolanaMessageTool,
  transferTokensTool,
  buyTokenTool,
  portfolioRebalanceTool,
  // EVM tools
  sendEvmTransactionTool,
  signEvmPersonalMessageTool,
  signEvmTypedDataTool,
  getTokenAllowanceTool,
  // Perps tools (read)
  getPerpMarketsTool,
  getPerpAccountTool,
  getPerpPositionsTool,
  getPerpOrdersTool,
  getPerpTradeHistoryTool,
  // Perps tools (write)
  openPerpPositionTool,
  closePerpPositionTool,
  cancelPerpOrderTool,
  updatePerpLeverageTool,
  transferSpotToPerpsTool,
  withdrawFromPerpsTool,
  depositToHyperliquidTool,
  withdrawFromHyperliquidSpotTool,
  payApiAccessTool,
];
