# Additional Hardening Items (Not Submitted as Advisories)

These two findings are **live-confirmed and accurate**, but they are validator-completeness / tool-surface-consistency improvements rather than independently exploitable vulnerabilities. They are documented in full in [audit_report.md](https://github.com/tempcollab/phantom-connect-sdk/blob/autofyn/we-are-a-world-c-490983/autofyn_audit/audit_report.md) (findings PHANTOM-004 and PHANTOM-005) and are intentionally **not** filed as standalone GitHub Security Advisories — submitting low-severity hardening items as CVEs alongside the genuine findings (PHANTOM-001/002/003) would dilute their signal. They are recorded here so the maintainers still see them.

Both are MEDIUM-floor (CVSS 3.1 4.3) and both have passing PoCs.

---

## PHANTOM-004 — `validateEip712TypedData` Accepts Malformed EIP-712 Data

**CVSS3.1:** 4.3 `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N`
**CWE:** CWE-20 (Improper Input Validation)
**Affected:** `@phantom/parsers` — `packages/parsers/src/index.ts:43-65`; caller `packages/cli/src/actions/sign-evm-typed-data.ts:69`.

`validateEip712TypedData` validates the top-level shape of EIP-712 typed data but omits three structural membership checks: (a) `primaryType ∈ keys(types)`, (b) `EIP712Domain ∈ keys(types)`, (c) `types[primaryType]` is a non-empty array. Malformed typed data (e.g. `primaryType="MISSING_TYPE"`, or `types` with no `EIP712Domain`, or an empty field array) passes the validator. Reachable directly via the `sign_evm_typed_data` MCP parameter.

**Why it's a hardening note, not an advisory:** this is a client-side validator-completeness gap. The downstream KMS may independently reject the malformed structure, so no signing or fund-loss impact is demonstrated. It is worth fixing (defense-in-depth, and the validator clearly *intends* to enforce EIP-712 well-formedness) but it does not move funds on its own.

**PoC:** `cd packages/parsers && npx tsx ../../autofyn_audit/exploits/s5-eip712-primarytype-gap/run.mjs`

**Fix:** enforce `primaryType in types`, `EIP712Domain in types`, and that each `types[k]` is a non-empty array of `{name, type}` in `validateEip712TypedData`.

---

## PHANTOM-005 — MCP Financial-Action Confirmation-Gate Asymmetry

**CVSS3.1:** 4.3 `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N`
**CWE:** missing confirmation step (inconsistent transaction-confirmation control — deliberately *not* CWE-862).
**Affected:** `@phantom/cli` — `buy-token.ts` / `swap.ts:320-341` and the perps actions (no gate); contrast `transfer-tokens.ts:359-373`, `send-solana-transaction.ts:89-111` (two-step gate).

`transfer_tokens` and `send_solana_transaction` enforce a two-step flow — first call runs a simulation and returns `pending_confirmation` without signing; only a second call with `confirmed:true` signs. `buy_token execute:true` and the perps tools sign in a single call with no simulation or preview.

**Why it's a hardening note, not an advisory:** the missing step is a human-in-the-loop preview, **not an authorization boundary**. The attacker model is a prompt-injected/authorized MCP caller that is already permitted to call `buy_token` — and a compromised agent simply confirms its own second call, so the gate protects a *human reviewer*, not against the adversary. Impact is bounded economic distortion via the Phantom-priced route, no arbitrary recipient. It is a genuine tool-surface inconsistency (all signing tools should share the two-step pattern) and is the silent-execution leg of CHAIN-A, but it is not an independently exploitable vulnerability.

**PoC:** `cd packages/cli && npx tsx ../../autofyn_audit/exploits/s6-mcp-confirmation-gate-asymmetry/run.mjs`

**Fix:** add a `confirmed`/`dryRun` gate to `buy_token execute:true` and the perps tools, matching the `transfer_tokens` / `send_solana_transaction` two-step pattern.
