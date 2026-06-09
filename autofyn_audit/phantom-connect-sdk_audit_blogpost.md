# How AI Found 5 Security Flaws in the Phantom Connect SDK

The Phantom Connect SDK is the integration layer Phantom ships for embedding its wallet across React, React Native, Browser, and Server apps. It signs Solana and EVM transactions, brokers an OAuth/KMS auth flow, exposes an MCP agent surface that lets AI tools swap tokens and open perps positions, and parses backend-supplied EIP-712 typed data before handing it to a remote signer. A signing SDK is interesting precisely because every one of those paths ends at a key. We wanted to see how its model holds up when an AI auditor starts pulling at the seams.

We built [AutoFyn](https://github.com/SignalPilot-Labs/AutoFyn), an open source autonomous security auditing tool, and pointed it at the Phantom Connect SDK source at commit `33efbe5`. Every finding in this post was confirmed against source code with reproducible exploit scripts. We responsibly disclosed all findings to the Phantom team before publishing and have submitted advisories for the strongest issues; an upstream dependency leak we surfaced is tracked as CVE-2026-40895.

## The Solana RPC Path That Skips Its Own Block

The most dangerous thing we found is an SSRF in the CLI's RPC handling. The EVM override path validates a user-supplied RPC URL with `validateRpcUrl`, which blocks loopback, RFC-1918 ranges, and link-local `169.254.x` — the cloud metadata range. The Solana override path validates with a different function, `validateHttpsUrl` at `packages/cli/src/utils/rpc.ts:30-43`, which checks only that the scheme is `https:` and the hostname is non-empty. No IP-range check at all.

An MCP tool caller — say, a prompt-injected agent calling `buy_token` — supplies `rpcUrl: "https://169.254.169.254/latest/meta-data/"`. On the EVM path that throws. On the Solana path `resolveSolanaRpcUrl` (`rpc.ts:82-97`) accepts it, and `new Connection(url)` dials the metadata endpoint. The identical URL is blocked one function over.

On a cloud host with a reachable metadata service, that reaches instance credentials from a single tool parameter.

It also chains. The attacker RPC is consulted for one scalar — `getMint` decimals at `buy-token.ts:220-223` — which flows into `parseUiAmount(amount, decimals)` and then into the swap's `sellAmount`. Tune the decimals and you silently inflate the size of an intended swap. The amplification mechanism is proven live on real SDK code; the on-chain over-spend is argued, bounded by the victim's balance and routed through Phantom's real quote API — not an arbitrary drain. What makes it a chain is that the over-spend is silent, and the same path that should have blocked the attacker's RPC is the one that feeds the distortion.

## A Backend Gets to Choose What the Key Signs

Every perps signing site in the SDK pins its EIP-712 domain from constants — `HYPERLIQUID_EXCHANGE_DOMAIN` and its siblings, all with `verifyingContract = 0x000…000`. The `depositStep` path lets the backend extend `types` but nothing else. One signing site breaks the pattern.

`PerpsClient.withdrawFromSpot` passes the backend-supplied `authorizeStep` object — `{domain, types, primaryType, message}` — verbatim to `signTypedData` at `packages/perps-client/src/PerpsClient.ts:356-361`. That includes `domain.verifyingContract`. No pinning, no allowlist. A compromised or MitM'd backend can return an `authorizeStep` shaped as `Permit{owner: user, spender: attacker, value: MAX_UINT256}` over a real ERC-20 contract, and the KMS signs it.

This requires a compromised backend or TLS MitM — but at that point the signature it yields is an off-platform-redeemable permit (ERC-2612, Permit2, Seaport) that never routes back through Phantom. It is the one signing site where the backend controls all four EIP-712 fields.

## The Payment Handler That Signs Anything

The SDK installs a module-load HTTP-402 payment handler. When a request comes back `402`, the handler decodes the server-supplied `payment.preparedTx` and forwards it straight to `signAndSendTransaction` at `packages/cli/src/index.ts:60-66`. No schema, no simulation.

The explicit `pay_api_access` tool — built to do the same job — enforces `PaymentTransactionSchema`: it forbids native-SOL `SystemProgram` transfers, requires at least one SPL token transfer, and runs a simulation gate. The same payload class, two defenses, one of them absent.

An attacker controlling a 402 response body injects a `SystemProgram.transfer` SOL drain. The auto-handler signs and broadcasts the exact transaction `pay_api_access` was written to reject. The SDK built the denial and then shipped a sibling path that walks around it.

## Two More Checks the SDK Forgot to Repeat

The same asymmetry shows up twice more, both reachable through MCP tools. `validateEip712TypedData` at `packages/parsers/src/index.ts:43-65` checks the top-level shape of typed data but never verifies that `primaryType` is actually a member of `types`, that `EIP712Domain` is declared, or that the named type is non-empty. Malformed EIP-712 structures — including zero-field permits — pass the SDK validator on their way to the signer, straight from the `sign_evm_typed_data` tool parameter.

And the confirmation gate is inconsistent. `transfer_tokens` and `send_solana_transaction` run a two-step flow: the first call simulates and returns `pending_confirmation` without signing; only a confirmed second call reaches the signer. `buy_token execute:true` and the perps tools have no such gate (`buy-token.ts:302-314`) — one call signs and broadcasts with no preview. A prompt-injected agent executes a swap the user never sees coming.

## What Ties These Together

Every finding is the same shape: the SDK knows how to defend a surface, builds the defense in one place, and then omits it on a sibling path that handles the same class of data. The EVM RPC path blocks private IPs; the Solana path doesn't. `depositStep` pins its EIP-712 domain; `authorizeStep` doesn't. `pay_api_access` enforces a payment schema; the auto-402 handler doesn't. `transfer_tokens` gates on simulation; `buy_token` doesn't. The vulnerability isn't a missing idea — the idea is already in the codebase — it's that the check wasn't repeated on the symmetric path.

## Why This Matters

A static scanner can flag a missing IP check or a verbatim-forwarded signing payload in isolation. What it can't do is notice that the *same* control exists twenty lines away on a sibling function — and then compose the un-checked RPC path with the un-gated swap into a single silent-amplification chain. That comparison across sibling code paths, holding the whole SDK in view at once, is what AutoFyn does and what used to require a human pentester spending days with the codebase.

AutoFyn produced 8 vulnerabilities and 1 end-to-end exploit chain across this audit, with the strongest five rated Medium. Every finding was tested against the SDK's own source and anything that did not actually work was dropped — seven candidate chains were evaluated and rejected with documented source evidence.

All findings have been responsibly disclosed. The full audit report, exploit scripts, and reproduction instructions are available in the [public audit repo](https://github.com/tempcollab/phantom-connect-sdk/blob/autofyn/we-are-a-world-c-490983/autofyn_audit/audit_report.md).

[AutoFyn](https://github.com/SignalPilot-Labs/AutoFyn) is open source. We are building it at [SignalPilot](https://signalpilot.ai) and would love to hear from teams running it against their own codebases.
