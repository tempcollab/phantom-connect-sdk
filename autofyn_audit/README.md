# Phantom Connect SDK — Security Audit

**Target:** Phantom Connect SDK monorepo  
**Audit commit:** `872944c9f26f4eef21b1d4a9f795ffea627719b7`  
**Docker image:** `node@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63`  
**Scope:** First build — S1 + S2 only (strongest, most clearly live-confirmable findings)

---

## Safety Note

**No real network calls are made to cloud metadata endpoints (169.254.169.254) or
real Phantom backend services.** All PoCs run offline against local listeners:
- S1 uses `127.0.0.1` as a safe stand-in; `169.254.169.254` is tested only at the
  *validator layer* (no network dial).
- S2 runs entirely within a single Node.js process.

---

## Quick Start

```bash
# 1. Setup (installs deps, verifies pinned commit and Docker image)
bash autofyn_audit/setup.sh

# 2. Run all PoCs
bash autofyn_audit/run_exploits.sh

# 3. Cleanup
bash autofyn_audit/teardown.sh
```

---

## Findings Overview

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| S1 | Inconsistent Solana RPC SSRF | MEDIUM | See `exploits/s1-solana-rpc-ssrf/` |
| S2 | Insecure Randomness (CWE-330/338) — OAuth State Weak CSRF-Token Entropy | LOW | See `exploits/s2-weak-oauth-state-prng/` |

See `audit_report.md` for full findings, rejected candidates, and follow-on work.

---

## Directory Layout

```
autofyn_audit/
  README.md                       this file
  setup.sh                        install deps, verify pinned image/commit
  run_exploits.sh                 run all PoCs, print CONFIRMED/NOT CONFIRMED
  teardown.sh                     clean up containers and temp files
  Dockerfile                      pinned node image + yarn build
  PINNED_COMMIT.txt               written by setup.sh (actual vs pinned commit)
  audit_report.md                 full security report
  lib/
    capture-server.mjs            HTTPS capture server (used by S1)
  exploits/
    s1-solana-rpc-ssrf/
      README.md                   repro steps, threat model, code path
      run.mjs                     executable PoC (exit 0 = confirmed)
    s2-weak-oauth-state-prng/
      README.md                   repro steps, observability caveat, code path
      run.mjs                     executable PoC (exit 0 = confirmed)
```

---

## Requirements

- Node.js v24.x (host)
- yarn 4.2.2 via corepack (`~/.local/bin/yarn`)
- `npx tsx` (comes with Node.js 18+)
- `openssl` in PATH (for S1 HTTPS capture server)
- Docker (optional, for container-based reproduction)
