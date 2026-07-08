#!/usr/bin/env bash
# Ensure draft PR is linked in workflow.state.json for an issue branch.
# Usage: cursor-workflow-ensure-pr-on-branch.sh <issue> <branch> <state-file>
set -euo pipefail

ISSUE="${1:?}"
BRANCH="${2:?}"
STATE_FILE="${3:?}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF="${WF:-${SCRIPTS_DIR:-$SCRIPT_DIR}}"

if [ -n "${MOCK_ENSURE_DRAFT_PR:-}" ]; then
  pr="$MOCK_ENSURE_DRAFT_PR"
elif [ "${CURSOR_WORKFLOW_TEST_MODE:-}" = "1" ] && [ -z "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]; then
  pr=$(jq -r '.pr // 99' "$STATE_FILE")
  if [ -z "$pr" ] || [ "$pr" = "null" ]; then
    pr=99
  fi
else
  pr=$("$WF/cursor-workflow-ensure-draft-pr.sh" "$ISSUE" "$BRANCH")
  "$WF/cursor-workflow-record-pr-on-branch.sh" "$STATE_FILE" "$pr" "$BRANCH"
fi

jq --argjson pr "$pr" '.pr = $pr' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
echo "Draft PR #${pr} linked for issue #${ISSUE}"
