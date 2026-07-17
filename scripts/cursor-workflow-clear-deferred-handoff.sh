#!/usr/bin/env bash
# Clear handoff_deferred from a state file (local or dry-run).
# Usage: cursor-workflow-clear-deferred-handoff.sh <state-file>
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-clear-deferred-handoff.sh <state-file>}"

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

if jq -e '.handoff_deferred == null' "$STATE_FILE" >/dev/null 2>&1; then
  exit 0
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
jq '.handoff_deferred = null | .updated_at = $ts' --arg ts "$TS" \
  "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
