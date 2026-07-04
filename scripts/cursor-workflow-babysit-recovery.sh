#!/usr/bin/env bash
# Recover missed babysit handoff when stage is create-pr-ready but no babysit agent recorded.
# Usage: cursor-workflow-babysit-recovery.sh <issue> <branch> <state-file>
set -euo pipefail

ISSUE="${1:?}"
BRANCH="${2:?}"
STATE_FILE="${3:?}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF="${WF:-${SCRIPTS_DIR:-$SCRIPT_DIR}}"

stage=$(jq -r '.stage // empty' "$STATE_FILE")
babysit=$(jq -r '((.agents // {})["babysit-pr"] // empty) | if type == "object" then .id // empty else . end' "$STATE_FILE")
pr=$(jq -r '.pr // empty' "$STATE_FILE")

if [ "$stage" != "create-pr-ready" ]; then
  exit 0
fi
if [ -n "$babysit" ] && [ "$babysit" != "null" ]; then
  exit 0
fi
if [ -z "$pr" ] || [ "$pr" = "null" ]; then
  exit 0
fi

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

if [ "${MOCK_PR_IS_DRAFT:-}" = "false" ]; then
  echo "Babysit recovery skipped — PR is not draft"
  exit 0
fi

is_draft=true
if [ "${MOCK_PR_IS_DRAFT:-}" != "true" ]; then
  if command -v gh >/dev/null 2>&1; then
    is_draft=$(gh pr view "$pr" --repo "$REPO" --json isDraft -q '.isDraft' 2>/dev/null || echo false)
  else
    is_draft=false
  fi
fi

if [ "$is_draft" != "true" ]; then
  echo "Babysit recovery skipped — PR #${pr} is not draft"
  exit 0
fi

decision=$("$WF/cursor-workflow-admission-gate.sh" "$STATE_FILE" "babysit-pr")
if [ "$decision" != "proceed" ]; then
  echo "Babysit recovery deferred: $decision"
  exit 0
fi

prompt="Use the babysit-pr skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Loop limits: bugbot 3, ci_autofix 2, total 10. Mark PR ready for review when clean."
echo "Babysit recovery: spawning babysit-pr for issue #${ISSUE}"

"$WF/cursor-workflow-spawn-agent.sh" \
  "$ISSUE" "$BRANCH" "$STATE_FILE" "babysit-pr" "$prompt" "babysit-in-progress"
