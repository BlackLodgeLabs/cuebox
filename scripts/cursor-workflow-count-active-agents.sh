#!/usr/bin/env bash
# Count in-flight Cursor Cloud Agent runs targeting this repository.
# A run counts when latest run status is RUNNING or CREATING (not FINISHED).
# Cursor v1 keeps agent workspaces ACTIVE after runs complete; cap is run-scoped.
# Prints integer count to stdout; always exit 0.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
  "$SCRIPT_DIR/cursor-workflow-fetch-agents-list.sh" >/dev/null || true
  # MOCK_IN_FLIGHT_RUN_COUNT preferred; MOCK_ACTIVE_AGENT_COUNT kept for older tests.
  echo "${MOCK_IN_FLIGHT_RUN_COUNT:-${MOCK_ACTIVE_AGENT_COUNT:-0}}"
  exit 0
fi

if [ -z "${CURSOR_API_KEY:-}" ]; then
  echo 0
  exit 0
fi

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
REPO_SLUG="github.com/${REPO}"

run_counts_toward_cap() {
  local agent_id="$1" run_id="$2"
  curl -sS -u "${CURSOR_API_KEY}:" \
    "https://api.cursor.com/v1/agents/${agent_id}/runs/${run_id}" \
    | jq -e --arg repo "$REPO_SLUG" '
        (.status == "RUNNING" or .status == "CREATING")
        and (((.git // {}).branches // []) | any(.repoUrl == $repo))
      ' >/dev/null
}

CACHE=$("$SCRIPT_DIR/cursor-workflow-fetch-agents-list.sh")

count=0
while IFS=$'\t' read -r agent_id run_id; do
  [ -z "$agent_id" ] && continue
  [ -z "$run_id" ] || [ "$run_id" = "null" ] && continue
  if run_counts_toward_cap "$agent_id" "$run_id"; then
    count=$((count + 1))
  fi
done < <(jq -r '
    .items[]?
    | select(.status == "ACTIVE" and (.latestRunId // "") != "")
    | [.id, .latestRunId]
    | @tsv
  ' "$CACHE" | tr -d '\r')

echo "$count"
