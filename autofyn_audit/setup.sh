#!/usr/bin/env bash
# setup.sh — Phantom Connect SDK Security Audit environment setup
#
# Builds and verifies the live target reproducibly:
# - Pulls and verifies the pinned Docker image by digest
# - Checks the repo is at the pinned commit (warns if not)
# - Installs workspace dependencies (idempotent)
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
echo "[setup] Installing workspace dependencies (yarn workspaces focus)..."
export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v yarn &>/dev/null; then
  echo "ERROR: yarn not found. Ensure corepack/yarn is installed and in PATH." >&2
  exit 1
fi

# Focus install: get @phantom/cli and @phantom/embedded-provider-core deps
# (including @solana/web3.js for S1 PoC)
cd "${REPO_ROOT}"
yarn workspaces focus @phantom/cli @phantom/embedded-provider-core 2>&1 | \
  grep -v "^➤ YN0002\|^➤ YN0060\|^➤ YN0086\|^➤ YN0066" | tail -5 || true

echo "[setup] Dependency installation complete."

# ── Verify tsx available ──────────────────────────────────────────────────────
if ! npx tsx --version &>/dev/null 2>&1; then
  echo "WARNING: 'npx tsx' not available. PoCs require tsx to run TypeScript source." >&2
  echo "         Install with: npm install -g tsx" >&2
else
  echo "[setup] tsx available: $(npx tsx --version 2>&1 | head -1)"
fi

# ── Verify openssl available (needed for HTTPS capture server in S1) ──────────
if ! command -v openssl &>/dev/null; then
  echo "WARNING: 'openssl' not found. S1 HTTPS capture server requires openssl." >&2
else
  echo "[setup] openssl available: $(openssl version 2>&1 | head -1)"
fi

echo ""
echo "[setup] Setup complete. Run: bash autofyn_audit/run_exploits.sh"
