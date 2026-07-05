#!/usr/bin/env bash
# Admission gate before POST /v1/agents. Always exit 0.
# Usage: cursor-workflow-admission-gate.sh <state-file> <target-skill> [--passback|--reopen]
# stdout: proceed | defer:<reason> | skip:<reason>
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-admission-gate.sh <state-file> <target-skill> [--passback|--reopen]}"
TARGET_SKILL="${2:?}"
shift 2 || true

PASSBACK=false
REOPEN=false
for arg in "$@"; do
  case "$arg" in
    --passback) PASSBACK=true ;;
    --reopen) REOPEN=true ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PENDING_STALE_MINUTES="${CURSOR_WORKFLOW_PENDING_STALE_MINUTES:-15}"
MAX_ACTIVE="${CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS:-8}"

if [ ! -f "$STATE_FILE" ]; then
  echo "defer:missing-state-file"
  exit 0
fi

agent_recorded=$(jq -r --arg k "$TARGET_SKILL" '
  ((.agents // {})[$k] // empty)
  | if type == "object" then .id // empty else . end
' "$STATE_FILE")

if [ -n "$agent_recorded" ] && [ "$agent_recorded" != "null" ] && [ "$PASSBACK" != "true" ] && [ "$REOPEN" != "true" ]; then
  echo "skip:agent-already-recorded"
  exit 0
fi

pending_skill=$(jq -r '.handoff_pending.skill // empty' "$STATE_FILE")
pending_started=$(jq -r '.handoff_pending.started_at // empty' "$STATE_FILE")

if [ -n "$pending_skill" ] && [ "$pending_skill" != "null" ] && [ -n "$pending_started" ] && [ "$pending_started" != "null" ]; then
  now_epoch=$(date -u +%s)
  started_epoch=$(date -u -d "$pending_started" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$pending_started" +%s 2>/dev/null || echo 0)
  age_minutes=$(( (now_epoch - started_epoch) / 60 ))
  if [ "$age_minutes" -lt "$PENDING_STALE_MINUTES" ] && [ "$pending_skill" = "$TARGET_SKILL" ]; then
    echo "defer:pending-lock"
    exit 0
  fi
fi

active_count=$("$SCRIPT_DIR/cursor-workflow-count-active-agents.sh")
if [ "$active_count" -ge "$MAX_ACTIVE" ]; then
  echo "defer:at-cap"
  exit 0
fi

echo "proceed"
