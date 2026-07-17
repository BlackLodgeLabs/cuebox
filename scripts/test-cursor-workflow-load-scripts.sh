#!/usr/bin/env bash
# Offline test: load-scripts copies cursor-workflow-config.sh into DEST.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TMP_DEST="$(mktemp -d)"
trap 'rm -rf "$TMP_DEST"' EXIT

DEST="$(bash scripts/cursor-workflow-load-scripts.sh "$TMP_DEST" handoff)"
if [[ ! -x "${DEST}/cursor-workflow-config.sh" ]]; then
  echo "FAIL: load-scripts did not copy cursor-workflow-config.sh to ${DEST}" >&2
  exit 1
fi

export WORKFLOW_REPO_ROOT="$ROOT"
# shellcheck disable=SC1091
source "${DEST}/cursor-workflow-config.sh"
if [[ "${WORKFLOW_LABEL_PREFIX:-}" != "cursor" ]]; then
  echo "FAIL: copied config did not resolve WORKFLOW_LABEL_PREFIX from repo root" >&2
  exit 1
fi

sync_out="$(WORKFLOW_REPO_ROOT="$ROOT" bash "${DEST}/cursor-workflow-sync-github-status.sh" /dev/null 2>&1 || true)"
if ! printf '%s\n' "$sync_out" | grep -q 'State file not found'; then
  echo "FAIL: copied sync script did not source config from DEST" >&2
  exit 1
fi

echo "PASS: cursor-workflow-load-scripts copies config resolver"
