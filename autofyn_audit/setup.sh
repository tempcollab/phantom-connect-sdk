#!/usr/bin/env bash
# setup.sh — Phantom Connect SDK Security Audit environment setup
#
# Builds and verifies the live target reproducibly:
# - Pulls and verifies the pinned Docker image by digest
# - Checks the repo is at the pinned commit (warns if not)
# - Installs ALL workspace dependencies (full yarn install — required for S3/S4/S5)
# - Builds all workspace package dist/ dirs (yarn build:packages — required for S3/S4/S5)
# - Writes PINNED_COMMIT.txt artifact
#
# Pinned:
#   Docker image:  node@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63
#   Git commit:    872944c9f26f4eef21b1d4a9f795ffea627719b7
#
# PoC mode: runs on the HOST node (v24.x) using yarn workspace deps.
# The Docker image is pulled and verified for reproducibility, but the PoCs
# themselves execute on the host to avoid container networking complexity.
# To run PoCs inside the container, use the Dockerfile in this directory.
#
# Why full yarn install (not workspaces focus):
#   A full install is required so (a) root devDep `turbo` is present for
#   build:packages, and (b) every workspace's deps resolve:
#     - browser-sdk's @phantom/* scope (S4)
#     - parsers' ethers / @solana/transactions (S5)
#     - cli's @modelcontextprotocol/server (S3)
#   YN0002/YN0086 peer-dep warnings and the optional utf-8-validate
#   native-build failure are expected and non-fatal.

set -euo pipefail

PINNED_IMAGE_DIGEST="sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63"
PINNED_IMAGE_REF="node@${PINNED_IMAGE_DIGEST}"
PINNED_COMMIT="872944c9f26f4eef21b1d4a9f795ffea627719b7"

# ── Locate repo root dynamically ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null || echo "")"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: Could not determine repo root via git. Run from within the repository." >&2
  exit 1
fi
echo "[setup] Repo root: ${REPO_ROOT}"

# ── Check commit ──────────────────────────────────────────────────────────────
ACTUAL_COMMIT="$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo "unknown")"
ARTIFACT_FILE="${REPO_ROOT}/autofyn_audit/PINNED_COMMIT.txt"

if [[ "${ACTUAL_COMMIT}" == "${PINNED_COMMIT}" ]]; then
  echo "[setup] Commit verified: ${ACTUAL_COMMIT}"
else
  echo "[setup] WARNING: actual commit (${ACTUAL_COMMIT}) != pinned commit (${PINNED_COMMIT})" >&2
  echo "[setup]          Continuing, but results may differ from the audit baseline."
fi

cat > "${ARTIFACT_FILE}" <<EOF
PINNED_COMMIT=${PINNED_COMMIT}
ACTUAL_COMMIT=${ACTUAL_COMMIT}
SETUP_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
echo "[setup] Wrote ${ARTIFACT_FILE}"

# ── Verify / pull Docker image ────────────────────────────────────────────────
echo "[setup] Pulling pinned Docker image: docker.io/library/${PINNED_IMAGE_REF}"
if command -v docker &>/dev/null; then
  if docker pull "node@${PINNED_IMAGE_DIGEST}" >/dev/null 2>&1; then
    echo "[setup] Docker image verified: ${PINNED_IMAGE_DIGEST}"
  else
    # Offline fallback: check local cache
    LOCAL_DIGEST="$(docker inspect --format '{{index .RepoDigests 0}}' node:24-bookworm 2>/dev/null | sed 's/.*@//' || echo "")"
    if [[ "${LOCAL_DIGEST}" == "${PINNED_IMAGE_DIGEST}" ]]; then
      echo "[setup] Docker image found locally (offline mode): ${LOCAL_DIGEST}"
    else
      echo "[setup] WARNING: Docker image pull failed and local image digest (${LOCAL_DIGEST}) does not match pinned (${PINNED_IMAGE_DIGEST})." >&2
      echo "[setup]          Continuing with host node for PoC execution." >&2
    fi
  fi
else
  echo "[setup] WARNING: docker not available; skipping image verification." >&2
  echo "[setup]          PoCs will run on host node. Install Docker for full reproducibility."
fi

# ── Install workspace dependencies ───────────────────────────────────────────
echo "[setup] Installing ALL workspace dependencies (full yarn install)..."
export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v yarn &>/dev/null; then
  echo "ERROR: yarn not found. Ensure corepack/yarn is installed and in PATH." >&2
  exit 1
fi

# Full install: required so root devDep `turbo` is present (for build:packages)
# and every workspace's deps resolve (browser-sdk/@phantom scope for S4,
# parsers/ethers+@solana/transactions for S5, cli/@modelcontextprotocol/server for S3).
# YN0002/YN0086 peer-dep warnings and the optional utf-8-validate native-build
# failure are expected — do not treat as setup failure (|| true tolerates them).
cd "${REPO_ROOT}"
yarn install 2>&1 | tail -8 || true

echo "[setup] Dependency installation complete."

# ── Build workspace package dist/ dirs ───────────────────────────────────────
# This produces packages/*/dist/index.mjs, required because every @phantom/*
# package exports points at ./dist/index.mjs.  Without it the S3/S4/S5 source
# imports cannot resolve their transitive @phantom/* deps.
# turbo builds in topological order (23 tasks), so each @phantom/* dist resolves
# before its dependents.  DTS build warnings are non-fatal — the runtime .mjs
# outputs are what the PoCs need.
echo "[setup] Building workspace package dist (yarn build:packages)..."
yarn build:packages 2>&1 | tail -12

# ── Dist sanity check ─────────────────────────────────────────────────────────
for p in parsers browser-sdk phantom-api-client base64url constants; do
  if [[ ! -f "${REPO_ROOT}/packages/$p/dist/index.mjs" ]]; then
    echo "[setup] WARNING: packages/$p/dist/index.mjs missing — S3/S4/S5 imports may fail" >&2
  fi
done

# ── Ensure tsx is available for PoCs ─────────────────────────────────────────
# tsx must be runnable as `npx tsx` without network access. After full yarn install,
# tsx is present in packages/phantom-openclaw-plugin/node_modules/.bin/tsx.
# If tsx is not already on PATH, create a shim in ~/.local/bin so all PoCs can
# invoke it as `npx tsx` regardless of npx cache state (offline-safe).
TSX_SHIM="${HOME}/.local/bin/tsx"
TSX_WORKSPACE="${REPO_ROOT}/packages/phantom-openclaw-plugin/node_modules/.bin/tsx"

if command -v tsx &>/dev/null; then
  echo "[setup] tsx already on PATH: $(tsx --version 2>&1 | head -1)"
elif [[ -x "${TSX_WORKSPACE}" ]]; then
  echo "[setup] tsx not on PATH — installing shim from workspace tsx (offline-safe)"
  mkdir -p "${HOME}/.local/bin"
  # Symlink ~/.local/bin/tsx → workspace binary (already on PATH via setup export above)
  ln -sf "${TSX_WORKSPACE}" "${TSX_SHIM}"
  chmod +x "${TSX_SHIM}"
  echo "[setup] tsx shim installed at ${TSX_SHIM}: $(tsx --version 2>&1 | head -1)"
elif npx tsx --version &>/dev/null 2>&1; then
  echo "[setup] tsx available via npx cache: $(npx tsx --version 2>&1 | head -1)"
else
  echo "WARNING: tsx not found in PATH, workspace, or npx cache. PoCs require tsx." >&2
  echo "         Ensure yarn install completed successfully (tsx is in phantom-openclaw-plugin)." >&2
fi

# ── Verify openssl available (needed for HTTPS capture server in S1) ──────────
if ! command -v openssl &>/dev/null; then
  echo "WARNING: 'openssl' not found. S1 HTTPS capture server requires openssl." >&2
else
  echo "[setup] openssl available: $(openssl version 2>&1 | head -1)"
fi

echo ""
echo "[setup] Setup complete. Run: bash autofyn_audit/run_exploits.sh"
