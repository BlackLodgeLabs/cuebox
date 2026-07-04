#!/usr/bin/env bash
# Set or clear handoff_pending on workflow.state.json and commit to branch.
# Usage: cursor-workflow-record-handoff-pending.sh <state-file> <branch> <set|clear> [skill] [attempt]
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-record-handoff-pending.sh <state-file> <branch> <set|clear> [skill] [attempt]}"
BRANCH="${2:?}"
ACTION="${3:?}"
SKILL="${4:-}"
ATTEMPT="${5:-0}"

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

if [ "${CURSOR_WORKFLOW_PENDING_DRY_RUN:-}" = "1" ]; then
  case "$ACTION" in
    set)
      jq --arg skill "$SKILL" --arg ts "$TS" --argjson attempt "$ATTEMPT" \
        '.handoff_pending = {skill: $skill, started_at: $ts, attempt: $attempt}' \
        "$STATE_FILE"
      ;;
    clear)
      jq '.handoff_pending = null' "$STATE_FILE"
      ;;
    *)
      echo "Unknown action: $ACTION" >&2
      exit 1
      ;;
  esac
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

case "$ACTION" in
  set)
    jq --arg skill "$SKILL" --arg ts "$TS" --argjson attempt "$ATTEMPT" \
      --arg updated "$TS" \
      '.handoff_pending = {skill: $skill, started_at: $ts, attempt: $attempt}
       | .updated_at = $updated' \
      "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"
    ;;
  clear)
    jq --arg updated "$TS" \
      '.handoff_pending = null | .updated_at = $updated' \
      "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac

git add "$REL_PATH"
git diff --staged --quiet && exit 0

git commit -m "chore(workflow): handoff_pending ${ACTION} for issue #${ISSUE}"
git push origin "$BRANCH"
echo "Updated ${REL_PATH} handoff_pending=${ACTION}"
