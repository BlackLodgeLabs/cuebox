#!/usr/bin/env bash
# Persist handoff_deferred on branch when in-job spawn backoff exhausts.
# Usage: cursor-workflow-record-deferred-handoff.sh <state-file> <branch> <skill> <reason>
set -euo pipefail

STATE_FILE="${1:?}"
BRANCH="${2:?}"
SKILL="${3:?}"
REASON="${4:?}"

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
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

write_deferred() {
  local target="$1"
  jq --arg skill "$SKILL" --arg reason "$REASON" --arg ts "$TS" \
    '.handoff_deferred = {skill: $skill, reason: $reason, at: $ts}
     | .updated_at = $ts' \
    "$target" > "${target}.tmp" && mv "${target}.tmp" "$target"
}

if [ "${CURSOR_WORKFLOW_PENDING_DRY_RUN:-}" = "1" ] || [ "${MOCK_CURSOR_API:-}" = "1" ]; then
  write_deferred "$STATE_FILE"
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

if [ ! -f "$REL_PATH" ]; then
  echo "State file not found on branch: $REL_PATH" >&2
  exit 1
fi

write_deferred "$REL_PATH"
git add "$REL_PATH"
git diff --staged --quiet && exit 0

git commit -m "chore(workflow): record deferred handoff for issue #${ISSUE} (${SKILL}: ${REASON})"
git push origin "$BRANCH"
echo "Recorded handoff_deferred for issue #${ISSUE} skill=${SKILL} reason=${REASON}"
