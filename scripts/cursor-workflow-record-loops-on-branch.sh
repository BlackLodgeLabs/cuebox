#!/usr/bin/env bash
# Increment loops.total_runs in workflow.state.json on the remote branch.
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-record-loops-on-branch.sh <state-file> <branch>}"
BRANCH="${2:?}"

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

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '.loops //= {}
   | .loops.total_runs = ((.loops.total_runs // 0) + 1)
   | .updated_at = $ts' \
  "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"

git add "$REL_PATH"
git diff --staged --quiet && exit 0

git commit -m "chore(workflow): increment total_runs for issue #${ISSUE}"
git push origin "$BRANCH"
echo "Incremented loops.total_runs in ${REL_PATH}"
