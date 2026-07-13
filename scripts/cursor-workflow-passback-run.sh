#!/usr/bin/env bash
# Start a pass-back run on an existing agent (POST /v1/agents/{id}/runs).
# Usage: cursor-workflow-passback-run.sh <issue> <branch> <state-file>
# Exit 0 on success/defer (409 busy); exit 1 on missing preconditions.
set -euo pipefail

ISSUE="${1:?}"
BRANCH="${2:?}"
STATE_FILE="${3:?}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF="${WF:-${SCRIPTS_DIR:-$SCRIPT_DIR}}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

stage=$(jq -r '.stage // empty' "$STATE_FILE")
if [ "$stage" != "execute-passback" ]; then
  echo "Pass-back skipped — stage is not execute-passback (got ${stage})" >&2
  exit 1
fi

passback_to=$(jq -r '.passback_to // empty' "$STATE_FILE")
passback_reason=$(jq -r '.passback_reason // empty' "$STATE_FILE")
agent_id=$(jq -r --arg k "$passback_to" '((.agents // {})[$k] // empty) | if type == "object" then .id // empty else . end' "$STATE_FILE")

if [ -z "$passback_to" ] || [ "$passback_to" = "null" ] || [ -z "$agent_id" ] || [ "$agent_id" = "null" ]; then
  echo "Pass-back skipped — missing passback_to or agents.${passback_to}" >&2
  exit 1
fi

prompt="Resume execute for GitHub issue #${ISSUE} on branch ${BRANCH}. Pass-back reason: ${passback_reason}. Read workflow/issues/issue-${ISSUE}/demo/demo-notes.md section 'Pass-back to execute' and use the execute skill. Draft PR #$(jq -r '.pr // empty' "$STATE_FILE") already exists — push commits only."

mock_curl_post_runs() {
  local out_file="$1"
  local code="${MOCK_CURSOR_POST_CODE:-201}"
  if [ -n "${MOCK_CURSOR_RUNS_COUNT_FILE:-}" ]; then
    local count=0
    [ -f "$MOCK_CURSOR_RUNS_COUNT_FILE" ] && count=$(cat "$MOCK_CURSOR_RUNS_COUNT_FILE")
    count=$((count + 1))
    echo "$count" > "$MOCK_CURSOR_RUNS_COUNT_FILE"
  fi
  echo '{"id":"bc-mock-run-id"}' > "$out_file"
  echo "$code"
}

if [ -n "${CURSOR_API_KEY:-}" ] || [ "${MOCK_CURSOR_API:-}" = "1" ]; then
  payload=$(jq -n --arg text "$prompt" '{prompt: {text: $text}}')
  if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
    http_code=$(mock_curl_post_runs /tmp/cursor-passback.json)
  else
    http_code=$(curl -sS -o /tmp/cursor-passback.json -w "%{http_code}" \
      -X POST "https://api.cursor.com/v1/agents/${agent_id}/runs" \
      -u "${CURSOR_API_KEY}:" \
      -H "Content-Type: application/json" \
      -d "$payload")
  fi
  if [ "$http_code" = "409" ]; then
    echo "::warning::Pass-back agent busy (409) — re-push after current run completes"
    exit 0
  fi
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo "Pass-back run started on agent ${agent_id}"
    HANDOFF_PROGRESS_STAGE="execute-in-progress" \
    HANDOFF_ACTIVE_SKILL="execute" \
    HANDOFF_ACTIVE_AGENT="$agent_id" \
      "$WF/cursor-workflow-sync-github-status.sh" "$STATE_FILE"
    exit 0
  fi
  echo "Pass-back API returned ${http_code}: $(cat /tmp/cursor-passback.json)" >&2
fi

if [ -n "${CURSOR_HANDOFF_GITHUB_TOKEN:-}" ]; then
  echo "${CURSOR_HANDOFF_GITHUB_TOKEN}" | gh auth login --with-token
  gh issue comment "$ISSUE" --repo "$REPO" \
    --body "@cursoragent ${prompt}"
  exit 0
fi

echo "::warning::Pass-back failed — set CURSOR_API_KEY or CURSOR_HANDOFF_GITHUB_TOKEN" >&2
exit 1
