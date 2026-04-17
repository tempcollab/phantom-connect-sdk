# MCP End-to-End Test Script

A guided test covering every tool in the Phantom MCP server. Run this with a funded wallet (at least **0.5 SOL** on Solana mainnet). Each step lists which tool is exercised.

---

## Prerequisites

- MCP server running and connected to Claude (or any MCP client)
- Wallet with ≥ 0.5 SOL on Solana mainnet
- All tools should be available after `phantom login`

---

## 1. Auth & Wallet Utilities

```
Tools: login, get_connection_status, get_wallet_addresses, get_token_balances
```

1. **Login** — authenticate with Phantom

   > "Log in to my Phantom wallet"

2. **Connection status** — lightweight session check

   > "Check my wallet connection status"

3. **Wallet addresses** — get all chain addresses

   > "What are my wallet addresses?"

4. **Token balances** — check all balances

   > "What are my token balances?"

   ✅ Expect: SOL balance shown, all chains returned

---

## 2. Solana — Swaps & Transfers

```
Tools: buy_token (Solana same-chain), transfer_tokens
```

5. **Swap SOL → USDC** on Solana

   > "Swap 0.05 SOL to USDC on Solana"

   ✅ Expect: quote returned, tx signed and broadcast, USDC balance increases

6. **Swap USDC → SOL** back

   > "Swap 2 USDC back to SOL"

   ✅ Expect: SOL balance increases

7. **Transfer SOL** to another address

   > "Send 0.001 SOL to `<any valid Solana address>`"

   ✅ Expect: simulation preview shown, confirm, tx sent

8. **Transfer SPL token** (USDC)

   > "Send 0.5 USDC to `<any valid Solana address>`"

   ✅ Expect: simulation preview shown, confirm, tx sent

---

## 3. Cross-chain — Solana ↔ Base

```
Tools: buy_token (cross-chain)
```

9. **Bridge SOL → Base ETH**

   > "Bridge 0.05 SOL to Base ETH"

   ✅ Expect: cross-chain quote via Relay/deBridge, tx broadcast, ETH arrives on Base (~5-30s)

10. **Swap ETH → USDC on Base** (same-chain EVM)

    > "Swap my Base ETH to USDC on Base"

    ✅ Expect: EVM swap quote, tx broadcast

11. **Bridge Base USDC → Solana USDC**

    > "Bridge my Base USDC back to Solana"

    ✅ Expect: cross-chain bridge executes, USDC arrives on Solana

---

## 4. EVM — Sign & Send

```
Tools: sign_evm_personal_message, sign_evm_typed_data, simulate_transaction
```

12. **Sign EVM message**

    > "Sign the message 'hello from phantom' on Ethereum"

    ✅ Expect: 0x-prefixed signature returned

13. **Simulate a transaction**

    > "Simulate sending 0.001 ETH on Base to `<any address>`"

    ✅ Expect: expected asset changes shown, no actual broadcast

---

## 5. Perps — Markets & Account Info

```
Tools: get_perp_markets, get_perp_account, get_perp_positions, get_perp_orders, get_perp_trade_history
```

14. **List markets**

    > "Show me the available perp markets"

    ✅ Expect: list of markets with BTC, ETH, SOL etc.

15. **Account balance** (will be empty initially)

    > "What's my perps account balance?"

    ✅ Expect: accountValue shown (likely $0)

---

## 6. Perps — Deposit Flow

```
Tools: buy_token (cross-chain to hypercore), transfer_spot_to_perps
```

16. **Bridge SOL into Hyperliquid spot**

    > "Bridge 0.05 SOL into Hyperliquid"

    ✅ Expect: ~$4 USDC arrives in HL spot account

17. **Move from spot to perps account**

    > "Transfer 4 USDC from Hyperliquid spot to my perps account"

    ✅ Expect: `{"status":"ok"}` from Hyperliquid

18. **Verify perps balance**

    > "Check my perps account balance"

    ✅ Expect: ~$4 USDC available

---

## 7. Perps — Limit Order Flow

```
Tools: open_perp_position (limit), get_perp_orders, cancel_perp_order
```

19. **Open a BTC limit order** (below market price so it rests)

    > "Open a BTC long limit order for $15 notional at 10x leverage with limit price $60,000"

    ✅ Expect: `{"resting": {"oid": <id>}}` — order on the book

20. **Check open orders**

    > "Show my open perp orders"

    ✅ Expect: BTC limit order listed at $60,000

21. **Cancel the limit order**

    > "Cancel my BTC limit order"

    ✅ Expect: `{"statuses":["success"]}`

22. **Verify orders cleared**

    > "Show my open perp orders"

    ✅ Expect: empty list

---

## 8. Perps — Leveraged Position Flow

```
Tools: update_perp_leverage, open_perp_position (market), get_perp_positions, close_perp_position
```

23. **Update leverage**

    > "Set my BTC leverage to 5x"

    ✅ Expect: leverage updated

24. **Open a market long**

    > "Open a BTC long market order for $15 notional at 5x leverage"

    ✅ Expect: `{"filled": {"totalSz": ..., "avgPx": ...}}` — position opened

25. **Check positions**

    > "Show my open perp positions"

    ✅ Expect: BTC long listed with entry price, margin, unrealized PnL

26. **Check trade history**

    > "Show my perp trade history"

    ✅ Expect: recent BTC fill appears

27. **Close position**

    > "Close my BTC perp position"

    ✅ Expect: position closed at market price

28. **Verify positions cleared**

    > "Show my open perp positions"

    ✅ Expect: empty list

---

## 9. Perps — Withdraw Back to Solana

```
Tools: get_perp_account, withdraw_from_perps
```

29. **Check withdrawable balance**

    > "Check my perps account balance"

    ✅ Expect: available balance shown (slightly less than deposited due to fees/PnL)

30. **Withdraw from perps to Solana**

    > "Withdraw 3 USDC from perps to Solana"

    ✅ Expect: Relay bridge executes, `{"execution":{"status":"ok"}}`, USDC arrives on Solana (~5-30s)

31. **Final balance check**

    > "What are my token balances on Solana?"

    ✅ Expect: USDC balance increased by ~3 (minus bridge fees)

---

## Coverage Summary

| Category         | Tools Tested                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Auth             | `login`, `get_connection_status`, `get_wallet_addresses`                                                  |
| Balances         | `get_token_balances`                                                                                      |
| Solana swaps     | `buy_token` (same-chain Solana)                                                                           |
| Solana transfers | `transfer_tokens`                                                                                         |
| Cross-chain      | `buy_token` (Solana↔Base, Solana↔Hypercore)                                                             |
| EVM signing      | `sign_evm_personal_message`, `sign_evm_typed_data`                                                        |
| Simulation       | `simulate_transaction`                                                                                    |
| Perps info       | `get_perp_markets`, `get_perp_account`, `get_perp_positions`, `get_perp_orders`, `get_perp_trade_history` |
| Perps deposit    | `transfer_spot_to_perps`                                                                                  |
| Perps orders     | `open_perp_position` (limit), `cancel_perp_order`                                                         |
| Perps trading    | `open_perp_position` (market), `update_perp_leverage`, `close_perp_position`                              |
| Perps withdrawal | `withdraw_from_perps`                                                                                     |

**Not covered here** (require special setup):

- `send_solana_transaction` / `send_evm_transaction` — need pre-built serialized tx
- `portfolio_rebalance` — needs multi-token portfolio
- `get_token_allowance` — needs ERC-20 approval context
- `pay_api_access` — internal payment flow
