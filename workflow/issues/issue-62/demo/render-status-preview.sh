#!/usr/bin/env bash
# Dry-run status comment pass-back section from workflow.state.json (no GitHub API).
set -euo pipefail

STATE_FILE="${1:?usage: render-status-preview.sh <workflow.state.json>}"

PASSBACK_TO=$(jq -r '.passback_to // empty' "$STATE_FILE")
PASSBACK_REASON=$(jq -r '.passback_reason // empty' "$STATE_FILE")
STAGE=$(jq -r '.stage // empty' "$STATE_FILE")

agent_id_for_key() {
  jq -r --arg k "$1" '
    ((.agents // {})[$k] // empty)
    | if type == "object" then .id // empty else . end
  ' "$STATE_FILE"
}

agent_link_for_key() {
  local id
  id=$(agent_id_for_key "$1")
  if [ -z "$id" ] || [ "$id" = "null" ]; then
    echo "—"
  else
    echo "[\`${id}\`](https://cursor.com/agents/${id})"
  fi
}

echo "=== Status comment preview (pass-back section) ==="
echo "Stage: ${STAGE}"
echo ""

if [ -n "$PASSBACK_TO" ] && [ "$PASSBACK_TO" != "null" ]; then
  PASSBACK_TARGET_LINE="$PASSBACK_TO"
  PASSBACK_AGENT_LINK=$(agent_link_for_key "$PASSBACK_TO")
  if [ "$PASSBACK_AGENT_LINK" != "—" ]; then
    PASSBACK_TARGET_LINE="${PASSBACK_TO} (${PASSBACK_AGENT_LINK})"
  fi
  echo "| **Pass-back target** | ${PASSBACK_TARGET_LINE} |"
  if [ -n "$PASSBACK_REASON" ] && [ "$PASSBACK_REASON" != "null" ]; then
    echo "| **Pass-back reason** | ${PASSBACK_REASON} |"
  fi
else
  echo "(no pass-back fields set)"
fi
