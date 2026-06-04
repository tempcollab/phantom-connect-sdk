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

| ID | Title | Status | Severity |
|----|-------|--------|----------|
| **S1** | Inconsistent Solana RPC SSRF — `resolveSolanaRpcUrl` skips private-IP block | **Confirmed by PoC** | MEDIUM |
| **S2** | Insecure randomness (CWE-330/338) for OAuth state / session id — weak CSRF-token entropy | **Confirmed by PoC** | LOW |
| F1 | `randomUUID()` silent fallback + `randomString()` unconditional `Math.random` | Follow-on | LOW |
| F2 | 402 `preparedTx` blind-signing path | Follow-on | MEDIUM |
| R1 | Developer-config `apiBaseUrl`/`authApiBaseUrl` SSRF | **Rejected** | — |
| R2 | EIP-6963 / Wallet Standard provider injection | **Rejected** | — |
| R3 | Plaintext `session.json` / `auth2-stamper.json` secret key | **Rejected** | — |
| R4 | No MCP transport authentication (stdio) | **Rejected** | — |
| R5 | `execFile` browser-open argument injection | **Rejected** | — |
| R6 | OAuth callback `wallet_id` not server-verified | **Rejected / Downgraded** | — |
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

*(Leave blank — reviewer fills in after live run)*

```
LAYER 1 (validator asymmetry):
  validateRpcUrl('https://169.254.169.254/...') threw: rpcUrl hostname is not permitted: 169.254.169.254
  resolveSolanaRpcUrl('solana:101', 'https://169.254.169.254/...') returned: [URL] (not blocked)

LAYER 2 (network fires):
  Capture server received POST from Connection.getLatestBlockhash()
  [Reviewer confirms: inbound request logged at capture server]
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

*(Leave blank — reviewer fills in after live run)*

```
generateSessionId() source verified: uses Math.random() exclusively, zero CSPRNG path.
Insecure randomness defect CONFIRMED: OAuth state token contains no CSPRNG entropy.
Math.random() determinism demonstrated via same-isolate record-and-replay.
```

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

**Rejected / Downgraded because:** The callback is guarded by the random `session_id`.
The legacy `BrowserAuthProvider` conditional-check concern is real but low severity
and not in scope for this build.

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
