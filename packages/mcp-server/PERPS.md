# Perpetuals (Hyperliquid) — @phantom/mcp-server

The Phantom MCP server exposes a full suite of perpetuals tools backed by [Hyperliquid](https://hyperliquid.xyz/). This document covers each tool, its parameters, and common workflows.

## MCP Tool Names

All perps tools use the `perps_` prefix in the MCP tool registry.

| MCP Tool Name            | Description                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `perps_markets`          | List all available perp markets with prices, funding rates, open interest, and max leverage |
| `perps_account`          | Get your perps account balance (total value, available balance, withdrawable)               |
| `perps_positions`        | Get your open perpetual positions                                                           |
| `perps_orders`           | Get your open perpetual orders                                                              |
| `perps_history`          | Get your perpetual trade history                                                            |
| `perps_open`             | Open a perpetual position (market or limit)                                                 |
| `perps_close`            | Close a perpetual position                                                                  |
| `perps_cancel`           | Cancel a perpetual order                                                                    |
| `perps_leverage`         | Update the leverage multiplier for a market                                                 |
| `perps_transfer`         | Transfer USDC from Hyperliquid spot to the perps account                                    |
| `perps_deposit`          | Bridge tokens from an external chain into Hyperliquid as USDC                               |
| `perps_withdraw`         | Withdraw USDC from the perps account back to spot                                           |
| `perps_withdraw-hl-spot` | Withdraw from the Hyperliquid spot account to an external chain                             |

---

## Tool Reference

### `perps_markets`

Returns all available perpetual markets on Hyperliquid with current prices, funding rates, open interest, 24h volume, max leverage, and asset IDs. Use this to discover tradeable markets and get current prices before opening positions.

**Parameters:** none required

---

### `perps_account`

Returns the perpetuals account balance including total account value, available balance, and withdrawable amount. The account is funded with USDC on Hyperliquid.

**Parameters:**

- `walletId` (optional) — wallet ID, defaults to authenticated wallet
- `derivationIndex` (optional) — derivation index, default 0

---

### `perps_positions`

Returns your open perpetual positions including entry price, mark price, unrealized PnL, and margin used.

**Parameters:**

- `walletId` (optional)
- `derivationIndex` (optional)

---

### `perps_orders`

Returns your open perpetual orders (resting limit orders waiting to be filled).

**Parameters:**

- `walletId` (optional)
- `derivationIndex` (optional)

---

### `perps_history`

Returns your perpetual trade history (filled orders).

**Parameters:**

- `walletId` (optional)
- `derivationIndex` (optional)

---

### `perps_open`

Opens a perpetual position on Hyperliquid. Supports market and limit orders in long or short direction. The position size is specified in USD.

**Parameters:**

- `market` — market symbol, e.g. `"BTC"`, `"ETH"`, `"SOL"`
- `direction` — `"long"` or `"short"`
- `sizeUsd` — position size in USD (e.g. `100` for $100 notional)
- `leverage` — leverage multiplier (e.g. `1` for 1x, `10` for 10x)
- `orderType` — `"market"` or `"limit"`
- `limitPrice` (required for limit orders) — the limit price
- `marginType` — `"isolated"` (default) or `"cross"`
- `reduceOnly` (optional) — if true, can only reduce an existing position
- `walletId` (optional)
- `derivationIndex` (optional)

**Notes:**

- Use `perps_markets` first to verify the market symbol and current price.
- Market orders apply a 10% slippage buffer automatically.
- Requires USDC in the perps account. Use `perps_deposit` to bridge tokens from an external chain if needed.

---

### `perps_close`

Closes an open perpetual position. Submits a market order in the opposite direction to fully close the position.

**Parameters:**

- `market` — market symbol of the position to close
- `walletId` (optional)
- `derivationIndex` (optional)

---

### `perps_cancel`

Cancels an open perpetual order by order ID.

**Parameters:**

- `orderId` — the order ID to cancel
- `market` — market symbol of the order
- `walletId` (optional)
- `derivationIndex` (optional)

---

### `perps_leverage`

Updates the leverage multiplier for a market without changing any positions.

**Parameters:**

- `market` — market symbol
- `leverage` — new leverage multiplier
- `marginType` — `"isolated"` or `"cross"`
- `walletId` (optional)
- `derivationIndex` (optional)

---

### `perps_transfer`

Moves USDC from the Hyperliquid spot account into the perpetuals account. This is an internal Hyperliquid transfer — both accounts live on Hypercore (Hyperliquid's chain).

**Parameters:**

- `amountUsdc` — amount of USDC to transfer (e.g. `"100"`)
- `walletId` (optional)
- `derivationIndex` (optional)

**Note:** USDC must already be in your Hyperliquid spot account. Use this tool when you have USDC in Hyperliquid spot that you want to move into the perps account.

---

### `perps_deposit`

Bridges tokens from an external chain (Solana, Arbitrum, Base, Ethereum, Polygon) into Hyperliquid as USDC via a cross-chain swap. USDC is delivered directly to your Hyperliquid perps account.

**Parameters:**

- `sourceChainId` — CAIP-2 source chain ID (e.g. `"solana:mainnet"`, `"eip155:42161"` for Arbitrum, `"eip155:8453"` for Base)
- `amount` — amount to send in human-readable units (e.g. `"100"` for 100 USDC)
- `sellTokenMint` (optional) — token to sell on source chain; defaults to USDC on source chain
- `sellTokenIsNative` (optional) — set `true` to sell native SOL or ETH
- `execute` — `false` (default) to preview quote only; `true` to sign and broadcast

---

### `perps_withdraw`

Transfers USDC from the perpetuals account back to the Hyperliquid spot wallet. Only the withdrawable balance can be withdrawn.

**Parameters:**

- `amountUsdc` — amount of USDC to withdraw (e.g. `"50"`)
- `walletId` (optional)
- `derivationIndex` (optional)

**Note:** Use `perps_account` to check the withdrawable balance before withdrawing.

---

### `perps_withdraw-hl-spot`

Withdraws USDC from the Hyperliquid spot account to an external destination (e.g. back to Solana or an EVM chain).

**Parameters:**

- `amountUsdc` — amount of USDC to withdraw
- `destinationChainId` (optional) — CAIP-2 destination chain ID
- `walletId` (optional)
- `derivationIndex` (optional)

---

## Common Workflows

### Fund and open a position

```
1. perps_deposit   — bridge USDC from Solana/Arbitrum/Base directly into the Hyperliquid perps account
2. perps_markets   — check the market symbol and current price
3. perps_open      — open a long or short position
4. perps_positions — verify the position was opened
```

### Close and withdraw

```
1. perps_positions  — find the open position
2. perps_close      — close the position
3. perps_account    — check withdrawable balance
4. perps_withdraw   — move USDC back to Hyperliquid spot
5. perps_withdraw-hl-spot  — withdraw from spot to external chain (optional)
```

### Manage a limit order

```
1. perps_open    — open with orderType: "limit"
2. perps_orders  — verify the order is resting on the book
3. perps_cancel  — cancel the order if needed
```
