#!/usr/bin/env bash
# teardown.sh — Clean up audit artifacts
#
# - Removes the audit Docker container (if running)
# - Kills any lingering capture-server processes started by the harness
# - Cleans up temporary files created by the PoCs
# - The HTTPS capture server in S1 is started and stopped within run.mjs (in-process),
#   so no external PID tracking is needed for normal operation.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="phantom-audit"

echo "[teardown] Cleaning up audit environment..."

# ── Docker container ──────────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  if docker inspect "${CONTAINER_NAME}" &>/dev/null 2>&1; then
    echo "[teardown] Stopping and removing Docker container: ${CONTAINER_NAME}"
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  else
    echo "[teardown] No Docker container named '${CONTAINER_NAME}' found (ok)."
  fi
else
  echo "[teardown] docker not available; skipping container cleanup."
fi

# ── PoC temp files ────────────────────────────────────────────────────────────
# The HTTPS capture server creates self-signed certs in a temp dir via mkdtempSync.
# These are cleaned up automatically by the close() handler in capture-server.mjs.
# Any leftover /tmp/poc-capture-* dirs are cleaned here as a safety net.
if ls /tmp/poc-capture-* &>/dev/null 2>&1; then
  echo "[teardown] Removing leftover capture server temp dirs..."
  rm -rf /tmp/poc-capture-* 2>/dev/null || true
fi

# ── Lingering node processes ──────────────────────────────────────────────────
# The S1 capture server is started in-process within run.mjs and closed via finally{}.
# No external processes should remain. As a safety net, check for any node processes
# referencing the audit scripts if pgrep/pkill are available (not present in all envs).
AUDIT_SCRIPT_PATTERN="autofyn_audit"
if command -v pgrep &>/dev/null && command -v pkill &>/dev/null; then
  if pgrep -f "${AUDIT_SCRIPT_PATTERN}" &>/dev/null 2>&1; then
    echo "[teardown] Found lingering processes matching '${AUDIT_SCRIPT_PATTERN}' — killing..."
    pkill -f "${AUDIT_SCRIPT_PATTERN}" 2>/dev/null || true
    sleep 1
  fi
else
  echo "[teardown] pgrep/pkill not available; skipping process cleanup (capture servers close in-process)."
fi

echo "[teardown] Cleanup complete."
