#!/usr/bin/env bash
# Set linked draft PR body from workflow/issues/issue-NNN/PR.md (GitHub Actions).
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-update-pr-body.sh <workflow.state.json> <PR.md>}"
PR_MD="${2:?usage: cursor-workflow-update-pr-body.sh <workflow.state.json> <PR.md>}"

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE"
  exit 1
fi

if [ ! -f "$PR_MD" ]; then
  echo "PR.md not found: $PR_MD"
  exit 0
fi

PR=$(jq -r '.pr // empty' "$STATE_FILE")
if [ -z "$PR" ] || [ "$PR" = "null" ]; then
  echo "No PR linked in state — skipping PR body update"
  exit 0
fi

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$GH_TOKEN" ]; then
  echo "GH_TOKEN or GITHUB_TOKEN not set"
  exit 1
fi
export GH_TOKEN

gh pr edit "$PR" --repo "$REPO" --body-file "$PR_MD"
echo "Updated PR #${PR} body from ${PR_MD}"
