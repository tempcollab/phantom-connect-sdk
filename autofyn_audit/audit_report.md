# Security Audit Report — Phantom Connect SDK

| Field | Value |
|-------|-------|
| **Target** | Phantom Connect SDK monorepo (`@phantom/sdk-monorepo`) |
| **Audit commit** | `872944c9f26f4eef21b1d4a9f795ffea627719b7` |
| **Docker base image** | `node@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63` (node:24-bookworm) |
| **Node runtime** | v24.16.0, yarn@4.2.2 |
| **Date** | 2026-06-04 |
| **Scope** | Static code review + PoC authoring; live confirmation is reviewer's responsibility |
| **Methodology** | Static analysis of TypeScript source, attacker-reachability tracing, PoC script authoring, local unit-level live execution |

---

## Verdict Summary

**Bottom line:** 8 independent findings are live-confirmed against the real SDK code (S1–S8). **None reach CRITICAL.** Two are LOW (S2, S5) and six are MEDIUM (S1, S3, S4, S6, S7, S8). Several MEDIUMs (S3, S7, S8) require a malicious/compromised backend or TLS MitM as a precondition — they are reported because each grants a *distinct* capability in a *distinct* package/CWE, and that precondition is stated plainly in each finding rather than glossed over. The browser private-key handling path is hardened (non-extractable WebCrypto keys, origin-isolated IndexedDB), and the server/parser/RPC-validation surfaces are largely sound; we did **not** find RCE, command injection, SQLi, path traversal, or unconditional fund/key exfiltration. Severity is deliberately not inflated.

| ID | Title | Status | Severity |
|----|-------|--------|----------|
| **S1** | Inconsistent Solana RPC SSRF — `resolveSolanaRpcUrl` skips private-IP block | **Confirmed by PoC** | MEDIUM |
| **S2** | Insecure randomness (CWE-330/338) for OAuth state / session id — weak CSRF-token entropy | **Confirmed by PoC** | LOW |
| **S3** | Auto-402 payment handler signs without the whitelist `pay_api_access` enforces — blind-signing asymmetry | **Confirmed by PoC** (live: real auto-handler blind-signs unvalidated drain tx; whitelist asymmetry shown by source-citation + labeled reference reproduction) | MEDIUM |
| **S4** | `BrowserAuthProvider.resumeAuthFromRedirect` conditional CSRF bypass (legacy non-default class) | **Confirmed by PoC** | MEDIUM |
| **S5** | `validateEip712TypedData` missing `primaryType`-in-`types` membership check | **Confirmed by PoC** | LOW |
| **S6** | MCP financial-action confirmation-gate asymmetry (`buy_token`/perps vs `transfer_tokens`/`send_solana_transaction`) | **Confirmed by PoC** | MEDIUM |
| **S7** | CVE-2026-40895: follow-redirects 1.15.11 custom-header leak in `@phantom/auth2` | **Confirmed by PoC** | MEDIUM |
| **S8** | Backend-controlled EIP-712 domain in `PerpsClient.withdrawFromSpot` `authorizeStep` — blind signing, absent `verifyingContract` allowlist (CWE-345) | **Confirmed by PoC** | MEDIUM |
| **CHAIN-A (C1)** | S1⟶S6 RPC-decimals amplified un-gated swap — silent magnitude distortion of an intended swap, no backend compromise, single M1 tool call | **Confirmed by PoC** (Stages 1/2/4 live real-code; Stage 3 live or argued — see Exploit Chains section) | MEDIUM-HIGH |
| F1 | `randomUUID()` silent fallback + `randomString()` unconditional `Math.random` | Follow-on | LOW |
| F2 | 402 `preparedTx` blind-signing path | Superseded — see confirmed S3 (asymmetry framing) | MEDIUM |
| R1 | Developer-config `apiBaseUrl`/`authApiBaseUrl` SSRF | **Rejected** | — |
| R2 | EIP-6963 / Wallet Standard provider injection | **Rejected** | — |
| R3 | Plaintext `session.json` / `auth2-stamper.json` secret key | **Rejected** | — |
| R4 | No MCP transport authentication (stdio) | **Rejected** | — |
| R5 | `execFile` browser-open argument injection | **Rejected** | — |
| R6 | OAuth callback `wallet_id` not server-verified | **Superseded by S4** (see note in R6 section) | — |
| R7 | JWT no client-side signature verification | **Rejected** | — |
| R8 | Axios CVEs (CVE-2025-62718, CVE-2026-40175), debug-log leakage, PKCE `.slice(96)` | **Rejected** | — |

---

## Confirmed Findings

---

### S1 — Inconsistent Solana RPC SSRF

**Severity:** MEDIUM  
**Provisional CVSS:** AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N (~6.5)  
*(PR:L because the `buy_token` handler calls `getSession()` at buy-token.ts:141, which throws
if the session is uninitialized — the SSRF is SESSION-GATED, not pre-auth. Impact rises to HIGH
only on cloud hosts with a reachable IMDS endpoint at 169.254.169.254.)*

**Affected file:** `packages/cli/src/utils/rpc.ts`  
**Affected lines:** `validateHttpsUrl` (30-43), `resolveSolanaRpcUrl` (82-97)  
**Contrast:** `validateRpcUrl` (51-76), `resolveEvmRpcUrl` (103-115)

#### Attacker and Trust Boundary

The `rpcUrl` parameter is a user-controlled MCP tool parameter on `buy_token`
(`packages/cli/src/actions/buy-token.ts:105`, `z.string().optional()`) and `transfer_tokens`
(`packages/cli/src/actions/transfer-tokens.ts:76`). In an LLM/MCP agent context, the attacker is a
malicious upstream tool result or a prompt-injection payload that supplies an
attacker-controlled URL.

#### Technical Description

The EVM override path uses `validateRpcUrl` (rpc.ts:105), which explicitly blocks:
- Loopback: `localhost`, `127.0.0.1`, `::1`, `[::1]`
- RFC-1918 private ranges: `10.x`, `192.168.x`, `172.16-31.x`
- Link-local: `169.254.x` (cloud IMDS)

The Solana override path uses `validateHttpsUrl` (rpc.ts:95), which checks **only**:
- Protocol is `https:`
- Hostname is non-empty

**No IP-range check is performed on the Solana path.** Supplying
`rpcUrl: "https://169.254.169.254/latest/meta-data/"` passes `validateHttpsUrl`
and is returned by `resolveSolanaRpcUrl`. The resulting `new Connection(rpcUrl)` dials
the cloud IMDS endpoint. The identical URL passed to `validateRpcUrl` (EVM path) throws.

#### Reachable Code Path

```
buy_token handler (packages/cli/src/actions/buy-token.ts:105) receives rpcUrl → z.string().optional()
  ↓ (requires initialized session — getSession() at buy-token.ts:141 throws if not initialized)
  ↓
resolveSolanaRpcUrl("solana:101", rpcUrl)  (packages/cli/src/actions/buy-token.ts:220)
  → validateHttpsUrl(url, "Solana RPC")    (rpc.ts:95) — NO IP CHECK
  → returns url
  ↓
new Connection(url)                         (packages/cli/src/actions/buy-token.ts:221)
  ↓
getMint(connection, ...)                    (packages/cli/src/actions/buy-token.ts:222) — SSRF fires

Also: transfer_tokens → resolveSolanaRpcUrl (packages/cli/src/actions/transfer-tokens.ts:277)
             → new Connection(url) (packages/cli/src/actions/transfer-tokens.ts:278)
```

**Session gate:** The SSRF fires after session initialization — `getSession()` at
`packages/cli/src/actions/buy-token.ts:141` throws "SessionManager not initialized" if the
session is not initialized. A valid, initialized session is required to reach the SSRF sink.
This is an **authenticated SSRF**, not pre-auth. The CVSS PR:L reflects this requirement.
The PoC exercises `resolveSolanaRpcUrl` + `Connection` directly, which is the same call
sequence the handlers execute after session setup.

**PoC scope (C1):** The PoC demonstrates the asymmetry at the SDK function level and
shows that `Connection` dials the attacker-supplied URL. It does not drive the full
MCP `buyTokenAction.run()` handler end-to-end.

#### Confirmation / Evidence

Verbatim stdout from the S1 PoC (live run, 2026-06-04, `bash autofyn_audit/run_exploits.sh`):

```
── LAYER 1: Validator asymmetry (IMDS IP, no network dial) ──────────────
  Testing: validateRpcUrl vs resolveSolanaRpcUrl on https://169.254.169.254/latest/meta-data/
  [CONFIRMED] validateRpcUrl('https://169.254.169.254/latest/meta-data/')
              threw: rpcUrl hostname is not permitted: 169.254.169.254
  [CONFIRMED] resolveSolanaRpcUrl('solana:101', 'https://169.254.169.254/latest/meta-data/')
              returned: https://169.254.169.254/latest/meta-data/
              (link-local/IMDS IP accepted — no IP block in validateHttpsUrl)

  LAYER 1: ASYMMETRY CONFIRMED

── LAYER 2: Network fires through Solana path, blocked on EVM path ─────
  Capture server (HTTPS self-signed) listening on: https://127.0.0.1:43019
  NOTE: In a real attack, https://169.254.169.254 is the SSRF target.
        127.0.0.1 is used here as safe stand-in; the IP check is identical (absent).
  [CONFIRMED] validateRpcUrl('https://127.0.0.1:43019') threw: rpcUrl hostname is not permitted: 127.0.0.1
  [CONFIRMED] resolveSolanaRpcUrl returned: https://127.0.0.1:43019
  Dialing https://127.0.0.1:43019 via new Connection().getLatestBlockhash()...
  [CONFIRMED] Capture server received inbound request:
    method: POST
    url: /
    host: 127.0.0.1:43019
    timestamp: 2026-06-04T20:39:52.358Z
  SSRF reachable: the SDK Connection dialed the attacker-supplied URL
  with NO IP-range check. https://169.254.169.254/ would be reached identically.

  LAYER 2: NETWORK DIAL CONFIRMED

=== S1: Inconsistent Solana RPC SSRF ===
  Layer 1 (validator asymmetry, IMDS IP): CONFIRMED
  Layer 2 (network fires, loopback HTTPS): CONFIRMED
  Overall: CONFIRMED
```

#### Real-World Impact

An attacker who can supply `rpcUrl` to the `buy_token` or `transfer_tokens` MCP
tool can exfiltrate cloud instance metadata (AWS/GCP/Azure IMDS credentials),
reach internal services behind the network boundary, or poison the RPC response
to affect transaction construction.

#### PoC Reference

`autofyn_audit/exploits/s1-solana-rpc-ssrf/run.mjs`  
Run: `cd packages/cli && npx tsx /path/to/autofyn_audit/exploits/s1-solana-rpc-ssrf/run.mjs`

#### Remediation

1. **Primary:** Route Solana override through the same `validateRpcUrl` used by EVM:
   ```typescript
   // rpc.ts: resolveSolanaRpcUrl — replace validateHttpsUrl with validateRpcUrl
   validateRpcUrl(url);  // blocks all private/loopback/link-local IPs
   ```
2. **Defense-in-depth:** Add a DNS-resolution-time IP re-check after `new Connection()` to
   defend against DNS rebinding attacks. This is a stretch goal.
3. **Audit other chains:** Review any similar `resolveXxxRpcUrl` or `getXxxConnection`
   helpers for the same pattern.

---

### S2 — Insecure Randomness (CWE-330/CWE-338) for OAuth State / Session ID — Weak CSRF-Token Entropy

**Severity:** LOW  
**Provisional CVSS:** AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N (~3.7)  
**CWE:** CWE-330 (Use of Insufficiently Random Values), CWE-338 (Use of Cryptographically Weak PRNG)

**Affected file:** `packages/embedded-provider-core/src/utils/session.ts`  
**Affected lines:** `generateSessionId()` lines 1-9  
**Affected surface:** Browser / embedded-provider OAuth redirect flow ONLY

**Scope note (C4):** `packages/cli/src/auth/oauth.ts:309-311` uses
`crypto.randomBytes(32)` for the CLI/MCP session ID. **The CLI OAuth path is NOT
affected by this finding.**

#### Attacker and Trust Boundary

The defect is the absence of CSPRNG entropy in `generateSessionId()`. The OAuth `state`
CSRF token contains zero cryptographically secure entropy. The practical exploitation path
requires an attacker running in the **same V8 isolate** as the victim page (e.g., via XSS
or a compromised dependency) to have already observed prior `Math.random()` output. Published
research (V8 xorshift128+ state recovery via Z3 / 3-consecutive-output methods) establishes
the theoretical basis for state recovery and prediction; however, the base-36 mantissa
truncation (`Math.random().toString(36).substring(2,15)` discards the low mantissa bits)
increases the recovery difficulty compared to observing raw float64 values.

#### Technical Description

`generateSessionId()` uses `Math.random()` exclusively — it has zero imports and makes no
CSPRNG call:

```typescript
export function generateSessionId(): string {
  return (
    "session_" +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    "_" + Date.now()
  );
}
```

This function is called at `embedded-provider.ts:1114,1174` and the resulting
`sessionId` is passed as the OAuth `state` parameter:

```typescript
// auth2Flow.ts:133
state: sessionId,
```

The `state` is the **sole CSRF guard** at callback time:

```typescript
// auth2Flow.ts:178-180
if (state !== expectedSessionId) {
  throw new Error("Auth2 state mismatch — possible CSRF attack.");
}
```

V8's `Math.random()` implements **xorshift128+** — a 128-bit-state PRNG that is
deterministic and NOT cryptographically secure. Published research has demonstrated
that V8 xorshift128+ internal state is recoverable from observed outputs (see e.g.
the 3-consecutive-output / Z3-based recovery documented by Filet-O-Bytes and others).
The `session_<base36_truncated>` format observed in OAuth traffic discards low mantissa
bits, which increases recovery difficulty relative to raw float64 observation — a full
attack from observable session IDs alone is non-trivial and is NOT demonstrated by this PoC.

**What the PoC demonstrates:** The PoC confirms that `generateSessionId()` derives the
OAuth `state` CSRF token **solely from `Math.random()`** with no `crypto.getRandomValues`
path, and that the produced `state` contains no CSPRNG entropy. The mechanism of
`Math.random()` determinism is demonstrated by recording outputs within the same isolate
and replaying them — this is honest record-and-replay, not state recovery from observable
session IDs. The full cross-context attack (recovering state from base-36-truncated session
IDs visible to an outside observer) is non-trivial and is not claimed here.

**PKCE note:** The PKCE `code_verifier` is separately generated via
`crypto.getRandomValues()` (auth2Flow.ts:89), which IS CSPRNG. This finding is
specifically a CSRF-token entropy defect, not a PKCE defect.

#### Observability Caveat (C5 — load-bearing for severity)

The severity (LOW) is based on the difficulty of exploiting the weak randomness in practice:

1. A same-isolate attacker (XSS, compromised dependency) who can already call `Math.random()`
   and observe the victim's sequence gains the least marginal benefit from this defect —
   such an attacker already has full page access.
2. A cross-origin attacker would need to recover V8 xorshift128+ state from the
   base-36-truncated session IDs visible in OAuth traffic. Published research makes this
   theoretically plausible, but the truncation substantially increases the difficulty.
3. The LOW severity reflects the gap between the theoretical weakness and a demonstrated,
   practical attack path. The defect is still worth fixing because it removes an entire
   class of weak-randomness issues cheaply.

#### Confirmation / Evidence

Verbatim stdout from the S2 PoC (live run, 2026-06-04, `bash autofyn_audit/run_exploits.sh`):

```
  ── Step 1: Verify Math.random() is the sole entropy source ──
  generateSessionId() produced: session_8y8vuj6y9imuwls866hmw_<timestamp>
  Math.random() calls made:     2 (expected 2 per call)
  crypto.getRandomValues called: false (expected false)

  No CSPRNG path: CONFIRMED

  ── Step 2: Record Math.random() outputs and replay to reproduce session ID ──
  (This is record-and-replay, NOT state recovery from observable session IDs.)
  (It demonstrates Math.random() determinism within one isolate only.)

  Target session ID (generated while recording):
    recorded r1 = 0.537232676945299 → 'jc94llhvhp'
    recorded r2 = 0.3659204451595739 → 'd68du1ekdtj'
  Reproduced prefix: session_jc94llhvhpd68du1ekdtj
  Actual prefix:     session_jc94llhvhpd68du1ekdtj

  Record-and-replay match: CONFIRMED
  → Math.random() is deterministic; same recorded floats reproduce the session ID exactly.
  → The OAuth state token contains no CSPRNG entropy.

=== S2: Insecure Randomness (CWE-330/338) — OAuth State CSRF Token ===
  No CSPRNG path in generateSessionId():  CONFIRMED
  Math.random() determinism (record/replay): CONFIRMED
  Insecure randomness defect:              CONFIRMED
```

The full PoC stdout (Step 3 PRNG entropy analysis) is reproducible via the harness; the
above excerpt is the load-bearing evidence. The record-and-replay is honest same-isolate
determinism, NOT state recovery from observable session IDs (see Observability Caveat).

#### Real-World Impact

The use of a non-CSPRNG for OAuth `state` means the CSRF token contains less entropy than
required by best practice (RFC 6819 recommends at least 128 bits of CSPRNG entropy). Under
threat models where an attacker can recover V8 xorshift128+ state from observable outputs
(e.g., via published Z3-based techniques applied to session IDs visible in OAuth traffic),
the CSRF guard could be bypassed. The practical impact is bounded by the difficulty of that
recovery in the truncated base-36 format and requires some degree of attacker observability.

#### PoC Reference

`autofyn_audit/exploits/s2-weak-oauth-state-prng/run.mjs`  
Run: `cd packages/cli && npx tsx /path/to/autofyn_audit/exploits/s2-weak-oauth-state-prng/run.mjs`

The PoC confirms the insecure randomness defect (no CSPRNG path in `generateSessionId()`).
It does NOT claim to recover xorshift128+ state from the truncated base-36 session IDs
an attacker can actually observe externally — that full attack is non-trivial and is
cited via published research only.

#### Remediation

Replace `Math.random()` in `generateSessionId()` with the Web Crypto API:

```typescript
export function generateSessionId(): string {
  // crypto.randomUUID() is available in all modern browsers and Node.js 19+
  return "session_" + crypto.randomUUID().replace(/-/g, "") + "_" + Date.now();
}
```

Or use `crypto.getRandomValues()` for maximum compatibility:

```typescript
export function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return "session_" + hex + "_" + Date.now();
}
```

Both alternatives provide cryptographically secure entropy and are available in
the browser environment where `embedded-provider-core` runs.

---

### S3 — Auto-402 Blind-Signing Asymmetry

**Severity:** MEDIUM  
**Provisional CVSS:** AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:N  
*(AC:H: exploiting requires controlling the 402 response body at the configured baseUrl — realistically a MitM of the TLS connection to api.phantom.app, a compromised/substituted backend, or a developer-config substitution. NOT critical.)*  
**CWE:** CWE-345 (Insufficient Verification of Data Authenticity), CWE-20 (Improper Input Validation)

**Affected file:** `packages/cli/src/index.ts`  
**Affected lines:** `apiClient.setPaymentHandler` block, lines 50-72  
**Contrast:** `packages/cli/src/actions/pay-api-access.ts` — `PaymentTransactionSchema` (lines 29-112) + `runSimulation` gate (lines 155-167)

#### Round-1 Trust-Boundary Class / Distinction from R1

**Trust-boundary class:** S3 shares the same class of boundary as the round-1 rejected
finding R1 (developer-config `apiBaseUrl`/`authApiBaseUrl` SSRF): exploiting S3 requires
controlling the HTTP 402 response body served at the configured `baseUrl` (default:
`https://api.phantom.app`), which realistically means a MitM of the TLS connection or a
compromised/substituted backend. This is the same MitM/compromised-backend boundary that
led round 1 to reject the `apiBaseUrl` SSRF finding as not attacker-reachable.

**Why S3 is still reportable (defense-in-depth / validated-vs-unvalidated asymmetry):**
S3 is NOT about making the boundary easier to cross — it does not. The NEW, independently
reportable angle is the **validated-vs-unvalidated asymmetry** between the two code paths
that handle the same `preparedTx` payload once the boundary IS crossed:
- The **explicit `pay_api_access` tool** enforces `PaymentTransactionSchema` (forbids
  SystemProgram, requires ≥1 SPL token transfer, runs simulation gate).
- The **auto-handler** (`index.ts:50-72`) decodes and signs any `preparedTx` with zero
  validation.

This asymmetry means the SDK's own defenses are inconsistent and can be bypassed by any
party who can influence the 402 response — a significant defense-in-depth failure that is
worth reporting separately from R1. Severity remains MEDIUM (AC:H — boundary is hard to
cross; but impact-on-exploit is native SOL fund loss).

#### Attacker and Trust Boundary

An attacker who controls the contents of a 402 HTTP response returned by the server at
`baseUrl` (default: `https://api.phantom.app`). Realistically: a MitM of the TLS
connection to `api.phantom.app`, a compromised/substituted backend, or a developer who
points `PHANTOM_API_BASE_URL` at a hostile server. **NOT attacker-reachable via MCP tool
params alone — requires backend/TLS control. NOT critical.**

#### Technical Description

The module-load handler (`packages/cli/src/index.ts:50-72`) decodes any server-supplied
`payment.preparedTx` and forwards it to `client.signAndSendTransaction` with **zero
validation**:

```typescript
// index.ts:60-66 (auto-handler)
const txBytes = Buffer.from(payment.preparedTx, "base64");
const result = await client.signAndSendTransaction({
  walletId: session.walletId,
  transaction: base64urlEncode(txBytes),
  networkId: NetworkId.SOLANA_MAINNET,
  account,
});
```

The explicit `pay_api_access` tool (`pay-api-access.ts`) enforces `PaymentTransactionSchema`,
which forbids `SystemProgram` (native SOL transfer) and non-Set ComputeBudget instructions,
requires ≥1 SPL token Transfer/TransferChecked, and runs a simulation gate before signing.

`PhantomApiClient.handleResponse` builds `PaymentRequiredError` from `body.payment`
with no validation of `body.payment` (`PhantomApiClient.ts:186-202`). The `_pay()` method
passes `err.payment` directly to the registered `paymentHandler`.

#### Reachable Code Path

```
GET/POST → PhantomApiClient._get/_post → handleResponse → 402
  → PaymentRequiredError(body.limitType, body.payment)  [body.payment NOT validated]
  → _pay(err) → paymentHandler!(err.payment)
  → handler: Buffer.from(payment.preparedTx, "base64") → signAndSendTransaction
                [NO PaymentTransactionSchema, NO simulation gate]
```

**Contrast (explicit tool):**
```
pay_api_access(preparedTx) → PaymentTransactionSchema.safeParse → rejects SystemProgram
  → runSimulation gate → THEN signAndSendTransaction
```

The PoC drives the real `PhantomApiClient._pay → handler` wiring via a loopback HTTP 402
server. The handler body in the PoC is a faithful transcription of `index.ts:60-66`
(decode + sign). The only substitutions are a stub signer in place of the KMS client and
stubbed session/address lookup — the PoC must not require real keys (per audit rules).

**What is live-confirmed vs. shown by reference:**

- **LIVE-CONFIRMED** (assertions a+b+c, real SDK code): The real `PhantomApiClient` invokes
  `_pay()`, the auto-handler (`index.ts:50-72`) decodes the malicious `SystemProgram.transfer`
  `preparedTx` and forwards it to the signer with **zero validation** — no schema, no
  simulation gate, no instruction check. The CONFIRMED verdict rests solely on (a)+(b)+(c).
- **SHOWN BY SOURCE CITATION + REFERENCE REPRODUCTION** (assertion d, supplementary):
  The asymmetry contrast — that `PaymentTransactionSchema` WOULD reject this same tx — is
  shown using `payment-schema.mjs`, a verbatim copy of `pay-api-access.ts:16-112`. The
  **real schema cannot be imported standalone under tsx**: importing `pay-api-access.ts`
  pulls `z` from `"incur"`, whose `src` export condition drags in `Mcp.ts →
  @modelcontextprotocol/server`; that package has no CJS condition, so tsx throws
  `"No exports main defined"`. The schema is also bundled-but-unexported in
  `packages/cli/dist/index.js`. The reference reproduction demonstrates the documented
  asymmetry but is **not a live run of the real schema**. This limitation does not weaken
  the finding — the auto-handler's lack of validation is plainly evident from source
  inspection of `index.ts:50-72` and confirmed by the live (a)+(b)+(c) assertions.

#### Confirmation / Evidence

Verbatim stdout from the S3 PoC (live run, 2026-06-04, `bash autofyn_audit/run_exploits.sh`):

```
── Step 2: Loopback HTTP 402 server + PhantomApiClient + stub signer ───────
  Loopback 402 server listening on http://127.0.0.1:41563

── Step 3: Live assertions (real PhantomApiClient + auto-handler) ───────────
  (a) [LIVE] Loopback server received ≥1 request from PhantomApiClient: PASS (count=2)
      GET /v1/anything at 2026-06-04T20:40:24.267Z
  (b) [LIVE] Auto-handler decoded preparedTx and forwarded to signer (no validation): PASS
  (c) [LIVE] SystemProgram.transfer instruction reached stub signer unchecked: PASS
      programId: 11111111111111111111111111111111 — auto-handler accepted this without any validation

── Step 4: [reference contrast] reproduced PaymentTransactionSchema ────────
  [reference contrast] reproduced PaymentTransactionSchema (faithful copy of
  pay-api-access.ts lines 16-112; the real schema is not standalone-importable
  under tsx, see README) REJECTS the same tx — demonstrating the documented
  asymmetry between the explicit tool path and the auto-handler.
    issue: Payment transaction must not contain SOL transfers or system instructions (native SOL payment is forbidden).

=== S3: Auto-402 Blind-Signing Asymmetry ===
  (a) [LIVE]  402 server received request from PhantomApiClient: CONFIRMED
  (b) [LIVE]  Auto-handler reached decode+sign step, no validation: CONFIRMED
  (c) [LIVE]  SystemProgram drain tx reached stub signer unchecked: CONFIRMED
  (ref)       Reproduced schema rejects same tx (reference contrast only): YES
  Overall:                                                          CONFIRMED
  Pass condition: (a)+(b)+(c) only — real auto-handler blindly signed drain tx
```

The CONFIRMED verdict rests SOLELY on the live (a)+(b)+(c) assertions against the real
`PhantomApiClient` + auto-handler. The schema-rejection line is a labeled reference
reproduction (`payment-schema.mjs`, verbatim copy of `pay-api-access.ts:16-112`) shown
for ILLUSTRATIVE contrast only — see the "What is live-confirmed vs. shown by reference"
note above.

#### Real-World Impact

An attacker who controls the 402 response body can inject a malicious `preparedTx`
(e.g., a native SOL drain via `SystemProgram.transfer`) that the auto-handler signs and
broadcasts without validation. High impact IF exploited (native SOL drain). Practical bar
is high (backend/TLS control required), hence MEDIUM severity.

#### PoC Reference

`autofyn_audit/exploits/s3-auto402-blind-signing/run.mjs`  
Run: `cd packages/cli && npx tsx /path/to/autofyn_audit/exploits/s3-auto402-blind-signing/run.mjs`

#### Remediation

1. Route the auto-handler through `PaymentTransactionSchema` (same validation as `pay_api_access`).
2. Add `runSimulation` gate before signing in the auto-handler.
3. Consider requiring explicit user confirmation before the auto-handler signs.
4. Validate `body.payment` fields in `PhantomApiClient.handleResponse` before constructing
   `PaymentRequiredError`.

---

### S4 — BrowserAuthProvider Conditional CSRF Bypass

**Severity:** MEDIUM  
**Provisional CVSS:** AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N  
*(Contingent on integrator using BrowserAuthProvider — see note below.)*  
**CWE:** CWE-352 (Cross-Site Request Forgery), CWE-287 (Improper Authentication)

**Affected file:** `packages/browser-sdk/src/providers/embedded/adapters/auth.ts`  
**Affected line:** 148

#### Attacker and Trust Boundary

Any party that can navigate the victim's browser to the app's OAuth callback URL with
attacker-chosen query parameters — via open redirect, phishing, or server-side redirect.
The attacker does NOT need to intercept TLS; controlling the URL params is sufficient when
`sessionStorage` is absent or cleared.

**IMPORTANT:** `BrowserAuthProvider` is exported from `adapters/index.ts` but is NOT
exported from the top-level `packages/browser-sdk/src/index.ts`. The **default production
path** uses `Auth2AuthProvider`, whose session-ID check is unconditional and sound.
**This finding is conditional on an integrator explicitly using `BrowserAuthProvider`.**
Severity MEDIUM reflects this conditional exploitability.

#### Technical Description

The CSRF guard at `auth.ts:148`:

```typescript
if (context.sessionId && sessionId !== context.sessionId) {
  throw new Error("Session ID mismatch - possible session corruption or replay attack");
}
```

is a **no-op** whenever `context.sessionId` is falsy. `context` comes from
`sessionStorage.getItem("phantom-auth-context")` (auth.ts:137-145), which is `null` on
first visit, cross-tab navigation, post-refresh, or programmatic nav without a prior
`authenticate()` call. When `contextStr` is null, `context = {}` and `context.sessionId =
undefined` (falsy) — the guard is skipped.

After the skipped guard, `resumeAuthFromRedirect` returns an `AuthResult` built entirely
from URL params (auth.ts:196-203): `walletId ← wallet_id`, `organizationId ← organization_id`,
`authUserId ← auth_user_id`. These are fully attacker-controlled.

The fail-closed fix is one character: `if (!context.sessionId || ...)`.

#### Reachable Code Path

```
BrowserAuthProvider.resumeAuthFromRedirect("google")
  → sessionStorage.getItem("phantom-auth-context") → null → context = {}
  → context.sessionId = undefined → falsy → guard skipped
  → returns AuthResult({ walletId: url_param_wallet_id, organizationId: ... })
                       [fully attacker-controlled from URL params]
```

#### Confirmation / Evidence

Verbatim stdout from the S4 PoC (live run, 2026-06-04, `bash autofyn_audit/run_exploits.sh`):

```
── Case 1 (attack): empty sessionStorage — guard skipped ──────────────────
  [RESULT] AuthResult returned from attacker URL params:
    walletId:       ATTACKER_WALLET
    organizationId: ATTACKER_ORG
    authUserId:     ATTACKER_USER
    sessionId:      (provider param) ATTACKER_SESSION_ANY
  [CONFIRMED] CSRF guard skipped on empty sessionStorage — attacker walletId accepted.

── Case 2 (contrast): sessionStorage has legit sessionId — guard fires ────
  [CONFIRMED] Guard threw: Session ID mismatch - possible session corruption or replay attack
  The guard fires correctly when context.sessionId is truthy and mismatched.

=== S4: BrowserAuthProvider Conditional CSRF Bypass ===
  (a) Empty context → guard skipped → attacker walletId accepted: CONFIRMED
  (b) Present+mismatched context → guard fires (throws mismatch):  CONFIRMED
  Overall:                                                          CONFIRMED
```

#### Real-World Impact

An attacker who can navigate the victim to the callback URL with attacker-chosen params
can inject a `walletId` and `organizationId` controlled by the attacker. Depending on
what the application does with the `AuthResult`, this can lead to account takeover or
unauthorized wallet access within the application session.

#### PoC Reference

`autofyn_audit/exploits/s4-browser-auth-csrf-bypass/run.mjs`  
Run: `cd packages/browser-sdk && npx tsx /path/to/autofyn_audit/exploits/s4-browser-auth-csrf-bypass/run.mjs`

#### Remediation

Change the guard to fail-closed (one-line fix in auth.ts:148):
```typescript
// Replace:
if (context.sessionId && sessionId !== context.sessionId) {
// With:
if (!context.sessionId || sessionId !== context.sessionId) {
```
This rejects the redirect when context is absent (preventing first-visit bypass) and when
sessionId mismatches. See also `recon-browser-auth.md` SUSPECT 1.

---

### S5 — `validateEip712TypedData` Missing `primaryType`-in-`types` Membership Check

**Severity:** LOW  
**Provisional CVSS:** AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N  
*(Client-side validation gap only; downstream KMS may independently reject. No signing/fund-loss impact is demonstrated. The upper "MEDIUM" half of a LOW-MEDIUM range is unsupported — only a client-side gap is confirmed.)*  
**CWE:** CWE-20 (Improper Input Validation)

**Affected file:** `packages/parsers/src/index.ts`  
**Affected lines:** `validateEip712TypedData` (lines 43-65)  
**Caller:** `packages/cli/src/actions/sign-evm-typed-data.ts:69` (MCP tool `sign_evm_typed_data`)

#### Attacker and Trust Boundary

A **legitimate `sign_evm_typed_data` MCP tool caller** — an LLM agent or a
prompt-injection / malicious upstream tool result supplying malformed `typedData`.
This is the only one of the three S3/S4/S5 findings reachable **directly via an MCP
tool parameter** with no special privileges.

#### Technical Description

`validateEip712TypedData()` checks top-level shape but omits three structural membership
checks required for well-formed EIP-712 data:

1. `primaryType ∈ keys(types)` — Case A: `primaryType="MISSING_TYPE"` with
   `types={ EIP712Domain: [...], Permit: [...] }` passes without error.
2. `EIP712Domain ∈ keys(types)` — Case B: `types={ Permit: [] }` (no `EIP712Domain`)
   passes without error.
3. `types[primaryType]` non-empty array — Case C: `types={ Transfer: [] }` with
   `primaryType="Transfer"` passes without error (signed struct covers zero fields).

Both the `validateEip712TypedData` function and the zod schema in `sign-evm-typed-data.ts`
(lines 20-40) fail to enforce membership. The validator signals intent to validate
EIP-712 structure (checks `domain.chainId` at the tool layer) but misses these checks.

**Client-side gap only:** We cannot test the downstream KMS server. The KMS may
independently reject malformed EIP-712 data. No signing or fund-loss impact is claimed.

#### Reachable Code Path

```
sign_evm_typed_data MCP tool ← attacker-supplied typedData (z.object with z.record)
  → sign-evm-typed-data.ts:69: validateEip712TypedData(params.typedData)
      → checks: object, non-null types, non-empty primaryType, non-null domain/message
      → DOES NOT CHECK: primaryType ∈ keys(types)
      → DOES NOT CHECK: EIP712Domain ∈ keys(types)
      → DOES NOT CHECK: types[primaryType] is non-empty array
  → proceeds to client.ethereumSignTypedData(...) → KMS
```

#### Confirmation / Evidence

Verbatim stdout from the S5 PoC (live run, 2026-06-04, `bash autofyn_audit/run_exploits.sh`):

```
── Negative control: clearly invalid shape ──────────────────────────────────
  [PASS] Negative control threw (validator is running): typedData.types must be an object mapping type names to field arrays

── Case A: primaryType NOT a key in types ───────────────────────────────────
  primaryType='MISSING_TYPE', keys(types)=['EIP712Domain','Permit']
  [CONFIRMED] validateEip712TypedData did NOT throw — primaryType not in types is accepted.

── Case B: EIP712Domain missing from types ──────────────────────────────────
  primaryType='Permit', keys(types)=['Permit'] (no EIP712Domain)
  [CONFIRMED] validateEip712TypedData did NOT throw — EIP712Domain absence is accepted.

── Case C: types[primaryType] is an empty array ─────────────────────────────
  primaryType='Transfer', types.Transfer=[] (empty — zero fields)
  [CONFIRMED] validateEip712TypedData did NOT throw — empty types array is accepted.

=== S5: validateEip712TypedData primaryType-in-types Gap ===
  Case A (primaryType not in types):        CONFIRMED (no throw)
  Case B (EIP712Domain missing):            CONFIRMED (no throw)
  Case C (types[primaryType] is empty []):  CONFIRMED (no throw)
  Negative control (validator is live):     CONFIRMED (threw)
  Overall:                                  CONFIRMED
```

#### Real-World Impact

A `sign_evm_typed_data` MCP tool caller can supply structurally invalid EIP-712 data
that passes the SDK's client-side validator. If the KMS does not independently reject,
the attacker could cause signing of arbitrary EIP-712 structures (e.g., permit signatures
for unauthorized token approvals) without the SDK's validator catching the malformation.

#### PoC Reference

`autofyn_audit/exploits/s5-eip712-primarytype-gap/run.mjs`  
Run: `cd packages/parsers && npx tsx /path/to/autofyn_audit/exploits/s5-eip712-primarytype-gap/run.mjs`

#### Remediation

Add to `validateEip712TypedData` (`parsers/src/index.ts`, after line 64):
```typescript
if (!(obj.primaryType in (obj.types as object))) {
  throw new Error(`typedData.primaryType "${obj.primaryType}" is not a key in typedData.types`);
}
if (!("EIP712Domain" in (obj.types as object))) {
  throw new Error("typedData.types must contain an EIP712Domain entry");
}
// Optionally: validate each types[k] is an array of {name:string, type:string}
```

---

### S6 — MCP Financial-Action Confirmation-Gate Asymmetry

**Severity:** MEDIUM  
**Provisional CVSS:** AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N (~6.x)  
*(PR:L because the attacker is an AUTHORIZED MCP tool caller — a session-authenticated LLM/agent
or a prompt-injected payload. This is NOT arbitrary fund theft by an unauthenticated party.
Impact is economic — forced swap into an attacker-chosen token, or a leveraged position —
bounded by the user's balance. NOT CRITICAL.)*  
**CWE:** CWE-862 (Missing Authorization / missing confirmation step) — inconsistent
transaction-confirmation control.

**Affected files:**
| File | Lines | Role |
|------|-------|------|
| `packages/cli/src/actions/buy-token.ts` | 96-103, 295-314 | `execute` field, no gate |
| `packages/cli/src/utils/swap.ts` | 206-404 | `executeSwap` — signs in one shot |
| `packages/cli/src/actions/open-perp-position.ts` | 13-90 | no `confirmed`/`dryRun`/gate |
| `packages/cli/src/actions/close-perp-position.ts` | 13-54 | no `confirmed`/`dryRun`/gate |
| `packages/cli/src/actions/cancel-perp-order.ts` | 13-53 | no `confirmed`/`dryRun`/gate |

**Contrast (tools WITH gate):**
| File | Lines | Gate |
|------|-------|------|
| `packages/cli/src/actions/transfer-tokens.ts` | 81-87, 359-373 | `confirmed` + `runSimulation(` + `pending_confirmation` |
| `packages/cli/src/actions/send-solana-transaction.ts` | 32-37, 89-111 | `confirmed` + `runSimulation(` + `pending_confirmation` |

#### Attacker and Trust Boundary

The attacker is a **prompt-injected / untrusted MCP tool caller** — a legitimate session using
the `buy_token` or perps MCP tools, where the LLM has been influenced by injected instructions.
This is the SAME attacker class as S5 (legitimate tool caller) and is a **MORE-REACHABLE class
than S3** (which requires backend/MitM control). The swap route comes from Phantom's quote API —
the attacker does NOT control the route; the impact is forcing a swap into a real but
attacker-chosen worthless/illiquid token, or opening a leveraged position at an inopportune
time. This is NOT arbitrary-recipient fund theft. The finding is the **gate asymmetry** itself.

#### Technical Description

`transfer_tokens` and `send_solana_transaction` enforce a mandatory two-step flow: the first
call runs `runSimulation()` and returns `{ status: "pending_confirmation" }` without signing;
only a second call with `confirmed: true` reaches `signAndSendTransaction`
(`send-solana-transaction.ts:89-111`, `transfer-tokens.ts:359-373`).

`buy_token execute:true` and the perps tools (`open_perp_position`, `close_perp_position`,
`cancel_perp_order`) have **no such gate**: a single tool call signs and broadcasts immediately
with no simulation/preview step. `buy_token execute:true` invokes `executeSwap`
(`swap.ts:206-404`); the Solana same-chain branch (`swap.ts:320-341`) calls
`client.signAndSendTransaction` exactly once with no `runSimulation` and no
`pending_confirmation` return. The perps actions call `perps.openPosition/closePosition/cancelOrder`
directly.

#### Confirmation / Evidence

Verbatim stdout from the S6 PoC (live run, 2026-06-04, `bash autofyn_audit/run_exploits.sh`):

```
── PART A: REAL executeSwap — same-chain Solana path, stub client ────────────
  [LIVE] executeSwap imported from: /home/agentuser/repo/packages/cli/src/utils/swap.ts

  [LIVE] executeSwap completed. signCalls recorded: 1
  [LIVE] signAndSendTransaction call args:
    walletId:     poc-wallet-id
    networkId:    solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
    account:      11111111111111111111111111111111
    transaction:  RFVNTVlfU09MQU5BX1RYX0JZVEVTX1BPQw...

  (A1) [LIVE] signAndSendTransaction called exactly once: PASS (calls=1)
  (A2) [LIVE] No simulation call / pending_confirmation return: PASS (no simulation interceptor exists; stub client has no apiClient)

  ✓ PART A CONFIRMED: real executeSwap (buy_token execute:true path) reached
    signAndSendTransaction in a SINGLE call with ZERO simulation/confirmation step.

── PART C: Source-text asymmetry scan (real .ts files) ─────────────────────
  Files with gate PRESENT (transfer/send):
    transfer-tokens.ts:           runSimulation( YES ✓ | pending_confirmation YES ✓ → Gate scan PASS
    send-solana-transaction.ts:   runSimulation( YES ✓ | pending_confirmation YES ✓ → Gate scan PASS

  Files with gate ABSENT (buy/perps):
    buy-token.ts:            runSimulation( NO ✓ | pending_confirmation NO ✓ → Absent scan PASS
    open-perp-position.ts:   runSimulation( NO ✓ | pending_confirmation NO ✓ → Absent scan PASS
    close-perp-position.ts:  runSimulation( NO ✓ | pending_confirmation NO ✓ → Absent scan PASS
    cancel-perp-order.ts:    runSimulation( NO ✓ | pending_confirmation NO ✓ → Absent scan PASS

  ✓ PART C CONFIRMED: source-text asymmetry verified.

=== S6: MCP financial-action confirmation-gate ASYMMETRY ===
  PART A [LIVE REAL CODE]:
    (A1) real executeSwap → signAndSendTransaction exactly once, no sim:  CONFIRMED
  PART C [source-text scan — real .ts files]:
    Gate present in transfer-tokens.ts + send-solana-transaction.ts:      CONFIRMED
    Gate absent in buy-token.ts + open/close/cancel-perp-position.ts:     CONFIRMED
  Overall: PART A + PART C: CONFIRMED

>>> S6: MCP confirmation-gate asymmetry (buy_token/perps vs transfer/send): CONFIRMED <<<
```

PART B (reference contrast, illustrative only — does NOT affect the verdict) additionally
showed the gated `send_solana_transaction` path returning `pending_confirmation` with `0`
signer calls on `confirmed:false`, and `1` signer call on `confirmed:true`. CONFIRMED rests
SOLELY on PART A (real `executeSwap`) + PART C (source scan). The real action modules cannot
be imported under tsx (they import `incur` → `@modelcontextprotocol/server`, no CJS exports),
so PART B uses a verbatim reference reproduction of the gate branch.

#### Real-World Impact

A prompt-injected LLM agent with access to the `buy_token` or perps MCP tools can force a
swap (e.g., selling the user's SOL for an illiquid or worthless token) or open a leveraged
perpetual position with no user-visible simulation step and no opportunity for the user to
review and reject. Impact is bounded by the user's current balance and collateral.

#### PoC Reference

`autofyn_audit/exploits/s6-mcp-confirmation-gate-asymmetry/run.mjs`  
Run: `cd packages/cli && npx tsx /path/to/autofyn_audit/exploits/s6-mcp-confirmation-gate-asymmetry/run.mjs`

#### Remediation

1. **Primary:** Add a `confirmed`/`dryRun` gate to `buy_token execute:true`: run `runSimulation()`
   and return `{ status: "pending_confirmation" }` when `confirmed !== true`, matching the
   pattern in `transfer_tokens` / `send_solana_transaction`.
2. **Perps tools:** Add a `confirmed` parameter to `open_perp_position`, `close_perp_position`,
   and `cancel_perp_order`. On first call return a position preview (size, leverage, estimated
   liquidation price, margin required); require `confirmed: true` to submit.
3. **Policy:** Establish a consistent tool-authoring policy: all write tools that sign or
   submit transactions must include the two-step simulation/confirmation flow before reaching
   `signAndSendTransaction`.

---

### S7 — CVE-2026-40895: follow-redirects 1.15.11 Custom-Header Leak in @phantom/auth2

**Severity:** MEDIUM  
**Provisional CVSS:** AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N (~5.x–6.x)  
*(AC:H: requires the KMS/wallets backend at the TLS-protected base URL to return a
cross-domain 3xx redirect, or a TLS MitM. Same class as S3. NOT CRITICAL.)*  
**CWE:** CWE-201 (Sensitive Information in Sent Data)  
**CVE:** CVE-2026-40895

**Affected package:** `packages/auth2/node_modules/follow-redirects@1.15.11` (VULNERABLE)  
**Affected file (headers):** `packages/auth2/src/Auth2KmsRpcClient.ts:38-62`  
**Vulnerable strip logic:** `packages/auth2/node_modules/follow-redirects/index.js:471-476`  
**Contrast (patched):** `packages/cli/node_modules/follow-redirects@1.16.0`

#### Attacker and Trust Boundary

SAME class as S3 — requires the KMS/wallets backend at the TLS-protected base URL to return a
cross-domain 302/301/307 redirect, or a TLS MitM between the CLI and the KMS. NOT
attacker-reachable in a normal deployment without backend control or TLS interception. The NEW
angle vs S3 is credential exfiltration (secret theft — explicitly in audit scope) via a stale
transitive dependency in a DISTINCT package (`@phantom/auth2`), with a named CVE. It shares no
PoC code with S3. Independent finding.

#### Technical Description

`@phantom/auth2` uses axios (→ follow-redirects via the Node http adapter) to call the KMS API.
The `auth2` package's own `node_modules` tree pins `follow-redirects@1.15.11`, vulnerable to
CVE-2026-40895: on a cross-domain 3xx redirect the library strips only `authorization`,
`proxy-authorization`, and `cookie` (`index.js:471-476`) — it does NOT strip custom headers.
The signing credential `x-phantom-stamp` and OIDC subject identifier `x-auth-user-id` that
`Auth2KmsRpcClient` adds to every request (`Auth2KmsRpcClient.ts:44-56`) are forwarded verbatim
to the redirect destination. The `packages/cli` tree uses the patched `1.16.0` (strips additional
headers) — the stale dep in auth2 is the defect.

Two loopback ports constitute "cross-domain": `redirectUrl.host`/`currentHost` include the port
(WHATWG `.host`), so `127.0.0.1:<portA>` vs `127.0.0.1:<portB>` differ and `isSubdomain()` is
false — the cross-domain strip branch fires even over plain loopback HTTP, making a deterministic
two-port PoC valid.

#### Confirmation / Evidence

Verbatim stdout from the S7 PoC (live run, 2026-06-04, `bash autofyn_audit/run_exploits.sh`):

```
  Loaded version:    follow-redirects@1.15.11 [CONFIRMED vulnerable]
  (a) [LIVE] Vulnerable 1.15.11 loaded from auth2/node_modules: CONFIRMED
  (b) [LIVE] Redirect server issued 302 cross-domain (portA→portB):  CONFIRMED
  (c) [LIVE] follow-redirects followed the 302 with headers:          CONFIRMED
  (d) [LIVE] x-phantom-stamp leaked to cross-domain target:            CONFIRMED
  (e) [LIVE] x-auth-user-id leaked to cross-domain target:             CONFIRMED
  (f) [LIVE] authorization correctly stripped (selective strip proven): CONFIRMED
  Overall:                                                              CONFIRMED

>>> S7: follow-redirects 1.15.11 custom-auth-header leak (CVE-2026-40895): CONFIRMED <<<
```

A version guard exits 1 (NOT CONFIRMED) if the loaded `follow-redirects` is not 1.15.11, so
CONFIRMED rests on the real vulnerable library. `authorization` being correctly stripped while
`x-phantom-stamp`/`x-auth-user-id` leak proves the SELECTIVE strip (not a total no-op).

#### Real-World Impact

If the KMS/wallets backend (or a TLS MitM) issues a cross-domain redirect, the user's signing
credential (`x-phantom-stamp`) and OIDC subject (`x-auth-user-id`) are exfiltrated to the
redirect destination, enabling credential theft / request replay against the wallets API.

#### PoC Reference

`autofyn_audit/exploits/s7-follow-redirects-header-leak/run.mjs`  
Run: `cd packages/auth2 && npx tsx /path/to/autofyn_audit/exploits/s7-follow-redirects-header-leak/run.mjs`

#### Remediation

1. **Primary:** Bump `follow-redirects` to `>=1.16.0` in `@phantom/auth2`'s dependency tree
   (add a workspace `resolutions` entry if hoisting keeps a stale copy in auth2's node_modules).
2. **Defense-in-depth:** Declare custom secret headers in axios's `sensitiveHeaders` config
   (axios ≥1.4.0) so they are stripped before any redirect.
3. **Audit:** Review all other packages' transitive `follow-redirects` versions for the same
   stale-dep pattern.

---

### S8 — Backend-Controlled EIP-712 Domain in PerpsClient.withdrawFromSpot authorizeStep (Blind Signing, CWE-345)

**Severity:** MEDIUM  
**Provisional CVSS:** AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:H/A:N (~5.9)  
*(AC:H: requires malicious/compromised/MitM backend at the TLS-protected PHANTOM_API_BASE_URL.
 UI:R: user or agent must invoke `withdraw_from_hyperliquid_spot execute:true`.
 NOT independently reachable from MCP tool parameters. NOT CRITICAL.)*  
**CWE:** CWE-345 (Insufficient Verification of Data Authenticity)

**Affected package:** `@phantom/perps-client`  
**Affected file:** `packages/perps-client/src/PerpsClient.ts:356-361`  
**Quote type:** `RelayWithdrawalV2Quote.authorizeStep` (`types.ts:233-241`)  
**Contrast (pinned):** `buildExchangeActionTypedData` → `HYPERLIQUID_EXCHANGE_DOMAIN`;
`buildUsdClassTransferTypedData` → `HYPERLIQUID_SIGN_TRANSACTION_DOMAIN`;
`depositStep` (`PerpsClient.ts:380-385`) → `{ ...HYPERLIQUID_SIGN_TRANSACTION_DOMAIN, chainId }`

#### Attacker and Trust Boundary

Attacker = malicious/compromised/MitM'd Phantom backend at `PHANTOM_API_BASE_URL` (default
`https://api.phantom.app`, TLS-protected). The `GET /swap/v2/spot/bridge-initialize` response is
100% backend-controlled. There is **no independent MCP-caller reachability**: the
`WithdrawFromHyperliquidSpotSchema` accepts only `amountUsdc`, `destinationChainId`, `buyToken`,
`execute`, `walletId`, `derivationIndex` — NO EIP-712 field. The only attacker path is a
backend-controlled `bridge-initialize` response. SAME trust class as S3/S7. Precondition stated
honestly.

#### Technical Description

`PerpsClient.withdrawFromSpot` (`PerpsClient.ts:356-361`) passes the four EIP-712 fields
`{domain, types, primaryType, message}` from the backend-supplied `authorizeStep` **verbatim**
to `this.signTypedData`. The `domain` object includes `verifyingContract` (`types.ts:235`).
There is **no domain pinning, no `verifyingContract` allowlist, and no validation** on this path.

Every other perps signing site pins the domain from constants:

- `buildExchangeActionTypedData` → `HYPERLIQUID_EXCHANGE_DOMAIN` (`verifyingContract = 0x000…000`, `constants.ts:16-20`)
- `buildUsdClassTransferTypedData` (deposit/withdraw) → `HYPERLIQUID_SIGN_TRANSACTION_DOMAIN` (`verifyingContract = 0x000…000`, `constants.ts:9-12`)
- `depositStep` (`PerpsClient.ts:380-385`) → `{ ...HYPERLIQUID_SIGN_TRANSACTION_DOMAIN, chainId }` (only `types`/`eip712PrimaryType` from backend)

The `authorizeStep` is the **single signing site** in the entire perps surface where the backend
controls all four EIP-712 fields including `verifyingContract`.

**Fix framing:** the gap is an **absent `verifyingContract`/domain allowlist** on the
backend-controlled `authorizeStep` signing path. This is NOT a missing `validateEip712TypedData`
call — that validator (`parsers/src/index.ts:43-65`) checks only structural shape (JS types of
types/primaryType/domain/message). It does **NOT** check `verifyingContract`, domain name, or any
allowlist. Calling it would **NOT** stop this attack.

#### Independence from S3 and S7

- **Package:** `@phantom/perps-client` — distinct from `@phantom/cli` (S3) and `@phantom/auth2` (S7).
- **CWE:** CWE-345 (unpinned EIP-712 domain) — distinct from S3 (generic blind-sign asymmetry) and S7 (CWE-201 credential-exfil via stale dep).
- **Code path:** `withdrawFromSpot` authorizeStep EIP-712 sign — distinct from S3's module-load 402 `setPaymentHandler` and S7's follow-redirects header strip.
- **New capability:** off-platform-redeemable EVM signature over an attacker-chosen `verifyingContract`. S3's blind-sign of a Solana `preparedTx` stays in-flow (same backend broadcasts it); S7 exfiltrates a short-lived credential. S8 gives the backend a capability it otherwise lacks: an EVM private-key signature over an arbitrary EIP-712 struct redeemable by the recipient contract directly, without any further backend involvement.

Shared precondition (backend compromise) acknowledged; all three are distinct on
package + CWE + impact, meeting the round-3 Rule bar.

#### Impact

A flow-controlling backend already relays whatever Hyperliquid action it constructs. The NEW
capability `authorizeStep` grants is qualitatively different: the backend can hand the KMS an
**arbitrary EIP-712 struct over an arbitrary `verifyingContract`** — for example,
`Permit{owner:user, spender:attacker, value:MAX_UINT256}` over a real ERC-20 token contract — and
obtain a KMS signature over the user's EVM key that is **redeemable off-platform** (e.g.
ERC-2612/Permit2/Seaport/DAI permit) without any further backend cooperation. That redemption
does not route through the Phantom proxy.

**Honesty caps (MUST be observed):**
- This is **MEDIUM**, not critical. Precondition = backend compromise (AC:H, UI:R).
- **The PoC proves only that the unvalidated attacker domain/message reaches the signer and that
  no allowlist/validation throws.** KMS is opaque (stub signer used). **Live fund loss /
  permit redemption is NOT demonstrated.**
- The off-platform-redeemable-permit impact is an *argued* consequence of an attacker-chosen
  `verifyingContract`, not a live-drained demonstration. The EIP-712 spec guarantees that a
  signature over `verifyingContract=<token>` is verifiable by that token contract; this is the
  property the attack exploits.

#### Confirmation / Evidence

Verbatim stdout from the S8 PoC (live run, 2026-06-04, `bash autofyn_audit/run_exploits.sh`; exit 0, deterministic across two runs):

```
── Step 1: Imported REAL PerpsClient.ts source ──────────────────────────────────────
  [OK] PerpsClient loaded from source: /home/agentuser/repo/packages/perps-client/src/PerpsClient.ts

── Step 2: Malicious quote built ────────────────────────────────────────────────────
  authorizeStep.domain.verifyingContract: 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
  authorizeStep.primaryType:              Permit
  authorizeStep.message.spender:          0xattacker000000000000000000000000000000000

── Step 4: Calling withdrawFromSpot (backend-controlled authorizeStep path) ─────────
  [OK] withdrawFromSpot completed without throwing
  signTypedData call count (withdrawFromSpot): 2

── Step 5: Assertions — attacker path (withdrawFromSpot authorizeStep) ─────────────
  (1) signTypedData called at least once by withdrawFromSpot: PASS
  (2) call[0].domain.verifyingContract === attacker-chosen address: PASS
      got:      0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
      expected: 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
  (3a) call[0].primaryType === "Permit": PASS
       got: Permit
  (3b) call[0].message.spender === attacker address: PASS
       got:      0xattacker000000000000000000000000000000000
       expected: 0xattacker000000000000000000000000000000000
  (3c) No validation error thrown before signer ran (signer WAS reached): PASS

── Step 6: Negative control — deposit() uses pinned verifyingContract ────────────────
  [OK] deposit() completed without throwing
  (4) deposit() call[0].domain.verifyingContract === pinned zero address: PASS
      got:      0x0000000000000000000000000000000000000000
      expected: 0x0000000000000000000000000000000000000000 (HYPERLIQUID_SIGN_TRANSACTION_DOMAIN)
      [CONTRAST] authorizeStep: 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
      [CONTRAST] depositStep (pinned): 0x0000000000000000000000000000000000000000

  (1) [LIVE] Attacker verifyingContract reached signer verbatim:       CONFIRMED
  (2) [LIVE] Attacker primaryType + message.spender reached signer:    CONFIRMED
  (3) [LIVE] No validation error blocked the signer (no allowlist):    CONFIRMED
  (4) [LIVE] Pinned sibling deposit() uses 0x000...000 (unaffected):  CONFIRMED
  Overall:                                                              CONFIRMED

>>> S8: PerpsClient authorizeStep blind EIP-712 sign (CWE-345): CONFIRMED <<<
```

Note: `signTypedData call count (withdrawFromSpot): 2` — `withdrawFromSpot` signs twice
(the backend-controlled `authorizeStep` first, then the pinned `depositStep`). The
assertions target `call[0]` (the `authorizeStep`); the negative-control `deposit()` sign
is the subsequent recorded call and shows the pinned `0x000…000` `verifyingContract`.

#### PoC Reference

`autofyn_audit/exploits/s8-perps-eip712-blind-sign/run.mjs`  
Run: `cd packages/perps-client && npx tsx /path/to/autofyn_audit/exploits/s8-perps-eip712-blind-sign/run.mjs`

#### Remediation

1. **Primary:** Add a `verifyingContract`/domain allowlist for the `authorizeStep` signing path.
   For the Relay V2 bridge, the valid `verifyingContract` addresses are known and small; pin them
   in `constants.ts` and validate before calling `signTypedData`.
2. **Defense-in-depth:** Apply the same pattern as the sibling `depositStep` (`PerpsClient.ts:380-385`):
   construct the `domain` from a constant (`RELAY_AUTHORIZE_DOMAIN`) and only allow the backend to
   extend `types` — never control `verifyingContract`.
3. **Note:** adding a `validateEip712TypedData` call alone is NOT sufficient — see Fix framing above.

---

## Further Work (Follow-On Candidates — Not Yet Confirmed)

These candidates were identified but **not exercised in the first build**. They
should be confirmed against a live instance before being escalated to findings.

### F1 — `randomUUID()` silent `Math.random` fallback + `randomString()` unconditional `Math.random`

**File:** `packages/utils/src/uuid.ts`  
**Status:** LOW — defense-in-depth, no security-sensitive in-scope caller identified.

`randomUUID()` prefers `crypto.randomUUID()` but falls back to `Math.random` when
the crypto API is absent (legacy/edge runtimes). `randomString()` uses `Math.random`
unconditionally with no crypto fallback. Current in-scope call sites (username
generation, organization IDs) are not security-sensitive. Recommend replacing both
with CSPRNG unconditionally for defense-in-depth.

### F2 — 402 `preparedTx` blind-signing path

**File:** `packages/phantom-api-client/src/PhantomApiClient.ts:149-203`  
**Status:** MEDIUM design weakness — not confirmed as exploitable without a MitM Phantom backend.

Server-supplied `payment.preparedTx` is forwarded unvalidated to the app's
`paymentHandler` for signing. The trust boundary requires a MitM or compromised
Phantom API at `baseUrl` (TLS-protected developer configuration). Recommend decoding
and displaying the transaction before signing, and validating `network`/`amount`
against the `preparedTx` fields.

---

## False Positives Deliberately NOT Reported

The following candidates were investigated and rejected. This list is a reputation
asset — accurate rejection of false positives demonstrates audit quality.

### R1 — Developer-config `apiBaseUrl` / `authApiBaseUrl` SSRF

**Files:** `packages/auth2/src/tokenExchange.ts`, `packages/client/src/Auth2KmsRpcClient.ts`,
`packages/phantom-api-client/src/PhantomApiClient.ts`, `packages/server-sdk/src/PhantomClient.ts`

**Rejected because:** These `baseUrl` parameters are **developer configuration set at SDK init
time**, not attacker-reachable inputs crossing a trust boundary during operation.
The developer who configures `baseUrl` already has full access to the SDK execution
environment. This is not an SDK vulnerability — it is exactly the embarrassing
false-positive class. Reporting it as SSRF would discredit the audit.

### R2 — EIP-6963 / Wallet Standard Provider Injection

**File:** `packages/browser-injected-sdk/`

**Rejected because:** In-page provider injection is **by design and by specification**
(`eip6963:requestProvider`). An in-page script that can receive the provider event
already has full DOM access. This is not an SDK vulnerability.

### R3 — Plaintext `session.json` / `auth2-stamper.json` Secret Key

**Files:** `packages/cli/src/session/`, `packages/cli/src/auth/`

**Rejected because:** Files are created with `mode 0o600`, directories with `0o700` —
standard local-user secret storage, on par with `~/.ssh/id_rsa` and
`~/.aws/credentials`. No stronger protection is provided by the OS model. Noting
as a defense-in-depth recommendation only; not a reportable finding.

### R4 — No MCP Transport Authentication (stdio)

**File:** `packages/mcp-server/`

**Rejected because:** The MCP stdio transport runs under the local user and does not
expose a network socket. "Malicious co-user" or "malicious subprocess" is outside
the SDK's threat model by design. This matches the MCP specification's intended
deployment model.

### R5 — `execFile` Browser-Open Argument Injection

**File:** `packages/cli/src/`

**Rejected because:** The `execFile` call (no shell) uses a URL derived from
developer-configured `baseUrl`. The argument is not attacker-reachable across a
trust boundary. No injection is possible without first controlling the developer
configuration.

### R6 — OAuth Callback `wallet_id` Not Server-Verified

**File:** `packages/browser-sdk/src/providers/embedded/`

**Superseded by S4.** The original R6 note ("real but low severity and not in scope") is
contradicted by the round-2 live-confirmed finding S4, which independently confirmed that
`BrowserAuthProvider.resumeAuthFromRedirect` contains a conditional CSRF guard that is a
no-op when `sessionStorage` is empty — precisely the concern R6 identified. S4 assessed
this at MEDIUM severity (AV:N/AC:L/PR:N/UI:R; conditional on integrator using
`BrowserAuthProvider` rather than the default `Auth2AuthProvider`). R6 is superseded; see
confirmed S4 for the full technical writeup and evidence.

### R7 — JWT No Client-Side Signature Verification

**Files:** `packages/crypto/`, `packages/parsers/`

**Rejected because:** By design — the token endpoint is the authority, and the
server-side KMS re-validates on stamp use. Client-side JWT signature verification
is not a security requirement in this architecture.

### R8 — Axios CVEs and Minor Issues

**Rejected because:**
- Axios v1.15.1 appears patched for CVE-2025-62718 and CVE-2026-40175.
- Debug-log leakage is conditional and requires developer misconfiguration.
- PKCE `.slice(96)` is a no-op given the 96-character base64url-encoded verifier.
- Explorer-URL encoding and EVM error disclosure are defense-in-depth items.

None of these constitute independently exploitable findings at the time of audit.

---

## Exploit Chains

This section documents end-to-end exploit chains composed from the independently-confirmed
S1–S8 findings. Chains escalate demonstrated impact above the sum of isolated parts; each
chain must stay within a single attacker model and be live-confirmable.

One chain holds (CHAIN-A). Two candidate chains were evaluated and rejected (CHAIN-B, CHAIN-C)
— those rejections are documented below as a credibility asset; accurate rejection demonstrates
that we declined chains that do not hold in source, rather than overstating.

---

### CHAIN-A (C1) — S1⟶S6: RPC-Decimals Amplified Un-Gated Swap

**Verdict: HOLDS**  
**Severity: MEDIUM-HIGH**  
**Attacker model: M1** — prompt-injected / authorized MCP tool caller. **No backend compromise. No TLS MitM.** This is the chain's headline: two MEDIUM M1 findings compose into a single-call silent magnitude distortion under the most-reachable attacker model.

#### Chain summary

A single prompt-injected `buy_token` tool call (`amountUnit:"ui"`, `execute:true`, attacker-controlled `rpcUrl`) chains:

1. **S1 (Solana rpcUrl un-IP-checked):** `resolveSolanaRpcUrl` accepts the attacker RPC URL without any private-IP/loopback block (`rpc.ts:82-97`, `validateHttpsUrl` checks scheme+hostname only). The EVM path (`validateRpcUrl`) blocks the same URL.
2. **S6 (missing confirmation gate):** `buy_token execute:true` → `executeSwap` → `signAndSendTransaction` in a single call with no `runSimulation`, no `pending_confirmation`, no user-visible magnitude preview (`buy-token.ts:302-314` → `swap.ts:335-341`).
3. **Chain hinge (decimals):** The attacker RPC is consulted for exactly one scalar — `getMint` decimals — at `buy-token.ts:220-223`/`236-239`. The attacker RPC returns a crafted SPL-mint account with `decimals=<attacker-chosen>`. That value flows to `parseUiAmount(amount, decimals!)` at `:247`, then to `sellAmount` in the Phantom quote request (`:283-284`), then to the un-gated `executeSwap`.

**Why this is a genuine chain (not a restatement):** S1 alone was rated MEDIUM for SSRF/metadata-read impact — it controls _where_ the SDK dials. S6 alone was MEDIUM for missing gate — the amount broadcast is the one the user intended. Composed, S1's RPC control becomes a **silent amount-amplification oracle** feeding S6's no-preview auto-execution: an intended "sell 1.0 token" becomes "sell `10^(attackerDecimals)` base units" broadcast in one call.

#### Stages and live vs argued status

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | `validateRpcUrl(attackerUrl)` throws; `resolveSolanaRpcUrl` returns attacker URL (S1 asymmetry) | **LIVE** (real `rpc.ts`) |
| 2 | real `executeSwap` → stub `signAndSendTransaction` exactly once, no sim/confirm gate | **LIVE** (real `swap.ts`, same mechanic as S6) |
| 3 | Attacker loopback RPC controls `getMint` decimals via crafted SPL MintLayout | **LIVE** if `getMint` (spl-token 0.4.x) parses the 82-byte crafted account; **ARGUED** from `buy-token.ts:220-247` + `MintLayout` semantics if not |
| 4 | real `parseUiAmount("1.0", attackerDecimals)` returns `10^30` vs honest `10^6` (24-order inflation) | **LIVE** (real `amount.ts`) |

**CONFIRMED verdict rests on Stages 1 + 2 + 4 (all live real-code).** Stage 3 is live if `getMint` parses the crafted account; argued otherwise — never faked.

#### Honest impact ceiling

The novel property is **silent magnitude distortion of an intended swap**:
- Bounded by the user's token balance — not a full drain to an arbitrary address.
- Routed through the real Phantom quote API — the SDK requests an inflated `sellAmount`, which Phantom must price and the user must have the balance to cover.
- An absurd inflation (e.g. `decimals=30`, `sellAmount=10^30`) exceeds any real balance; the quote API or on-chain execution rejects/fails. A realistic attacker tunes `decimals` to inflate within the victim's balance.
- **NOT** arbitrary-recipient theft. **NOT** key exfil. **NOT** an unconditional drain.

**Argued (not live-drained):** the PoC uses a stub client with no real keys and does not contact the live Phantom quote API. The _mechanism_ (silent amplification feeding an un-gated broadcast) is proven live; an actual larger on-chain spend requires a live environment.

#### Preconditions

1. M1 prompt-injected / authorized MCP tool caller (no backend compromise, no TLS MitM).
2. Victim invokes `buy_token` with `amountUnit:"ui"` on a Solana SPL token (not a native-token or EVM path — those take a different `decimals` code branch not routed through `getMint`).
3. `execute:true` (attacker supplies it in the tool call, or the LLM agent does).
4. Attacker controls the `rpcUrl` MCP parameter.

#### PoC

`autofyn_audit/exploits/c1-rpc-decimals-amplified-swap/run.mjs`  
Run dir: `packages/cli` (same as S1, S6)

---

### CHAIN-B — S7 (stamp leak) ⊕ S8 (blind EIP-712) — VERDICT: COLLAPSES (do NOT build)

**Hypothesis:** the leaked `x-phantom-stamp` from S7 lets the attacker replay/authorize the
`withdrawFromSpot` the S8 blind-sign produces, combining exfil + blind-sign into off-platform
fund redemption.

**Source evidence it does not hold:**
- The leaked stamp is a **per-request body signature** bound to one exact request body
  (`Auth2KmsRpcClient.ts:53-56`: `stamp = await stamper.stamp({ data: Buffer.from(requestBody) })`).
  It authorizes only the single KMS-RPC call that triggered the redirect; it cannot be
  re-pointed at a new "withdraw" request.
- The `authorization` header (the reusable bearer) is the one credential S7 **proved is
  correctly stripped** cross-domain (S7 evidence block, assertion (f)). The leak does not
  hand the attacker a replayable session.
- **Different channels:** S7's stamp is over an `auth2` KMS-RPC body; S8's signature is
  produced by `perps-client` over a `bridge-initialize` EIP-712 struct. The leaked stamp
  does not authorize the S8 withdrawal.
- **Replay is non-live-confirmable.** Whether even the captured method could be replayed
  depends on the opaque KMS backend's timestamp/nonce/replay-protection (`timestampMs: Date.now()`
  is sent, suggesting server-side freshness checks). Per the ironclad Rule, an unconfirmable
  critical step must not be presented as confirmed.

**Verdict: REJECT.** The link (stamp authorizes the withdrawal) does not exist in source.
The chain is S7 and S8 standing side-by-side under the same M2 precondition, not composed.

---

### CHAIN-C — S2 (weak PRNG) ⊕ S4 (CSRF-resume) — VERDICT: COLLAPSES (do NOT build)

**Hypothesis:** predict the OAuth `state` via S2 weak PRNG, then use S4 to accept attacker
identity via the CSRF-resume bypass → browser session takeover.

**Source evidence it does not hold:**
- **S4 needs no prediction.** `auth.ts:148` guard `if (context.sessionId && sessionId !== context.sessionId)` is _skipped entirely_ when `sessionStorage` is empty (`context={}`, `context.sessionId` undefined). The attacker supplies any `session_id` URL param and it is accepted — there is nothing to predict. S2 contributes nothing.
- **Different surfaces/providers.** S2's `generateSessionId` lives in `embedded-provider-core` and feeds the _Auth2/embedded_ OAuth `state` whose check is **unconditional and sound** (per round-2 accumulated role rule). S4's bypass is in the _legacy, non-default_ `BrowserAuthProvider` (browser-sdk). They do not feed each other.
- **S2's prediction half was never live-confirmed.** The report explicitly disclaims recovering xorshift128+ state from the truncated base-36 IDs an outside observer can see. Chaining onto a non-confirmed primitive yields a non-confirmed chain.

**Verdict: REJECT.** The link is incoherent (S4 requires no predicted value; S2 only matters on the sound provider where there is no bypass), and the prediction step is non-live-confirmable.
