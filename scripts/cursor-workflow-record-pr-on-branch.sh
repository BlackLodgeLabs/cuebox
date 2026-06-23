#!/usr/bin/env bash
# Write PR number into demos/issue-N/workflow-state.json on the remote branch.
set -euo pipefail

STATE_FILE="${1:?}"
PR_NUM="${2:?}"
BRANCH="${3:?}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
if [ -z "$ISSUE" ]; then
  echo "State file missing issue number" >&2
  exit 1
fi

REL_PATH="demos/issue-${ISSUE}/workflow-state.json"

CURRENT=$(jq -r '.pr // empty' "$STATE_FILE")
if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" = "$PR_NUM" ]; then
  echo "PR already recorded as #${PR_NUM}" >&2
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

jq --argjson pr "$PR_NUM" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '.pr = $pr | .updated_at = $ts' \
  "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"

git add "$REL_PATH"
git diff --staged --quiet && exit 0

git commit -m "chore(workflow): link draft PR #${PR_NUM} for issue workflow"
git push origin "$BRANCH"
echo "Updated ${REL_PATH} with pr=${PR_NUM}"
