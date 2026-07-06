#!/usr/bin/env bash
# Exit 0 when agent discovery should be skipped; exit 1 when discovery should run.
# Usage: cursor-workflow-should-discover-agents.sh <state-file>
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-should-discover-agents.sh <state-file>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$STATE_FILE" ]; then
  exit 1
fi

agent_id_from_state() {
  jq -r --arg k "$1" '
    ((.agents // {})[$k] // empty)
    | if type == "object" then .id // empty else . end
  ' "$2"
}

need_spec=$(agent_id_from_state review-and-spec "$STATE_FILE")
need_continued=$(agent_id_from_state review-and-spec-continued "$STATE_FILE")
if [ -n "$need_spec" ] && [ "$need_spec" != "null" ] && [ -n "$need_continued" ] && [ "$need_continued" != "null" ]; then
  exit 0
fi

stage=$(jq -r '.stage // empty' "$STATE_FILE")
stage_rank=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "$stage")
plan_rank=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "plan-in-progress")
if [ "$stage_rank" -ge 0 ] && [ "$stage_rank" -ge "$plan_rank" ]; then
  exit 0
fi

exit 1
