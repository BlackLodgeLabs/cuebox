#!/usr/bin/env bash
# Write an agent id into workflow/issues/issue-N/workflow.state.json on the remote branch.
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-record-agent-on-branch.sh <state-file> <agent-key> <agent-id> <branch>}"
AGENT_KEY="${2:?}"
AGENT_ID="${3:?}"
BRANCH="${4:?}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
if [ -z "$ISSUE" ]; then
  echo "State file missing issue number" >&2
  exit 1
fi

REL_PATH="workflow/issues/issue-${ISSUE}/workflow.state.json"

CURRENT=$(jq -r --arg k "$AGENT_KEY" '((.agents // {})[$k] // empty) | if type == "object" then .id // empty else . end' "$STATE_FILE")
if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" = "$AGENT_ID" ]; then
  echo "Agent already recorded for ${AGENT_KEY} as ${AGENT_ID}" >&2
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

jq --arg key "$AGENT_KEY" --arg id "$AGENT_ID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '.agents //= {}
   | .agents[$key] = $id
   | .active_agent_id = $id
   | .updated_at = $ts' \
  "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"

git add "$REL_PATH"
git diff --staged --quiet && exit 0

git commit -m "chore(workflow): record ${AGENT_KEY} agent for issue #${ISSUE}"
git push origin "$BRANCH"
echo "Updated ${REL_PATH} with agents.${AGENT_KEY}=${AGENT_ID}"
