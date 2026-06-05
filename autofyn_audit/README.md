# Phantom Connect SDK — Security Audit

**Target:** Phantom Connect SDK monorepo  
**Audit commit:** `33efbe59a34a0de25d1bd38f3e91758a802a3f5f`  
**Docker image:** `node@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63`  
**Scope:** 8 live-confirmed findings (S1–S8) + 1 exploit chain (CHAIN-A/C1). All confirmed against a live instance via `run_exploits.sh` (exit 0).

> **Reproducibility:** The pinned commit above is the reproducibility-verified baseline containing the complete deliverable (all PoCs S1–S8 + CHAIN-A). Clone this branch (or checkout the pinned commit) and run `autofyn_audit/setup.sh`; because the SDK source is never modified by this audit, every commit on this branch carries the identical SDK under test.

---

## Safety Note

**No real network calls are made to cloud metadata endpoints (169.254.169.254) or
real Phantom backend services.** All PoCs run offline against local loopback listeners:
- S1 uses `127.0.0.1` as a safe stand-in; `169.254.169.254` is tested only at the
  *validator layer* (no network dial).
- S2, S4, S5 run entirely within a single Node.js process (no network).
- S3, S7 dial only loopback HTTP servers.
- S6 drives real SDK code (`executeSwap`) with a stub client; no network, no keys.
- S8 drives real `PerpsClient.ts` source with a stub signer and stub apiClient; no network, no keys.
- C1 drives real `executeSwap` + `parseUiAmount` + `resolveSolanaRpcUrl` with a stub client and a
  local loopback Solana JSON-RPC server; no real keys, no Phantom API calls.
- No private keys, KMS calls, or real signing are performed by any PoC.

---

## Quick Start

```bash
# 1. Setup (installs deps, verifies pinned commit and Docker image)
bash autofyn_audit/setup.sh

# 2. Run all PoCs (S1–S8); exit 0 = all confirmed
bash autofyn_audit/run_exploits.sh

# 3. Cleanup
bash autofyn_audit/teardown.sh
```

---

## Findings Overview

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| S1 | Inconsistent Solana RPC SSRF (`resolveSolanaRpcUrl` skips private-IP block) | MEDIUM | Confirmed by PoC |
| S2 | Insecure randomness (CWE-330/338) — OAuth state weak CSRF-token entropy | LOW | Confirmed by PoC |
| S3 | Auto-402 payment handler blind-signs without the `pay_api_access` whitelist (asymmetry) | MEDIUM | Confirmed by PoC |
| S4 | `BrowserAuthProvider.resumeAuthFromRedirect` conditional CSRF bypass (legacy non-default path) | MEDIUM | Confirmed by PoC |
| S5 | `validateEip712TypedData` missing `primaryType`-in-`types` membership check | LOW | Confirmed by PoC |
| S6 | MCP financial-action confirmation-gate asymmetry (`buy_token`/perps vs `transfer_tokens`/`send_solana_transaction`) | MEDIUM | Confirmed by PoC |
| S7 | CVE-2026-40895: follow-redirects 1.15.11 custom-header leak in `@phantom/auth2` | MEDIUM | Confirmed by PoC |
| S8 | Backend-controlled EIP-712 domain in `PerpsClient.withdrawFromSpot` `authorizeStep` — absent `verifyingContract` allowlist (CWE-345) | MEDIUM | Confirmed by PoC |
| **CHAIN-A (C1)** | S1+S6: RPC-decimals amplified un-gated swap — silent magnitude distortion, M1 attacker only, no backend compromise | MEDIUM-HIGH | Confirmed by PoC |

**Exploit chain CHAIN-A (C1) confirmed:** S1+S6 chain produces silent magnitude distortion of
an intended swap under a single M1 (prompt-injected MCP) tool call — no backend compromise.
See Exploit Chains section in `audit_report.md` for the chain analysis and CHAIN-B/CHAIN-C rejections.

No CRITICAL findings confirmed. Severities are deliberately conservative (accuracy > quantity).
See `audit_report.md` for full per-finding writeups (attacker/trust boundary, reachable code
path, live evidence excerpts), rejected false-positive candidates (R1–R8), and follow-on work.

---

## Directory Layout

```
autofyn_audit/
  README.md                       this file
  setup.sh                        install deps, verify pinned image/commit, build packages
  run_exploits.sh                 run all PoCs (S1–S8), print CONFIRMED/NOT CONFIRMED
  teardown.sh                     clean up containers and temp files
  Dockerfile                      pinned node image + yarn build
  PINNED_COMMIT.txt               written by setup.sh (actual vs pinned commit)
  audit_report.md                 full security report
  lib/
    capture-server.mjs            HTTPS capture server (used by S1)
  exploits/
    s1-solana-rpc-ssrf/           run.mjs + README (validator asymmetry + loopback dial)
    s2-weak-oauth-state-prng/     run.mjs + README (no-CSPRNG path; record/replay)
    s3-auto402-blind-signing/     run.mjs + payment-schema.mjs (reference contrast)
    s4-browser-auth-csrf-bypass/  run.mjs (sessionStorage shim, no network)
    s5-eip712-primarytype-gap/    run.mjs (membership-check gaps + negative control)
    s6-mcp-confirmation-gate-asymmetry/  run.mjs + confirmation-gate-reference.mjs
    s7-follow-redirects-header-leak/     run.mjs (two-port cross-domain leak)
    s8-perps-eip712-blind-sign/          run.mjs (attacker verifyingContract reaches signer)
    c1-rpc-decimals-amplified-swap/      run.mjs + README (CHAIN-A: S1+S6 chain PoC)
```

Each `run.mjs` exits `0` = confirmed, `1` = not confirmed (patched/absent), `2` = harness error.

---

## Per-PoC Run Directories

`run_exploits.sh` runs each PoC from the directory whose `node_modules` resolves its deps:

| PoC | Run dir | Why |
|-----|---------|-----|
| S1, S2, S3, S6 | `packages/cli` | `@phantom/client`, `@solana/web3.js`, `incur`, `bs58` resolve here |
| S4 | `packages/browser-sdk` | `@phantom/constants` scope |
| S5 | `packages/parsers` | `ethers` + `@solana/transactions` live only here |
| S7 | `packages/auth2` | vulnerable `follow-redirects@1.15.11` is in `auth2/node_modules` (CLI has patched 1.16.0) |
| S8 | `packages/perps-client` | `@phantom/parsers`, `@phantom/client`, `@phantom/phantom-api-client` resolve from `perps-client/node_modules` |
| C1 | `packages/cli` | `@solana/web3.js`, `@solana/spl-token`, `bs58`, `@phantom/client` resolve here (same as S1/S6) |

---

## Requirements

- Node.js v24.x (host)
- yarn 4.2.2 via corepack (`~/.local/bin/yarn`)
- `tsx` (setup.sh ensures it is on PATH)
- `openssl` in PATH (for S1 HTTPS capture server)
- Docker (optional, for container-based reproduction)
