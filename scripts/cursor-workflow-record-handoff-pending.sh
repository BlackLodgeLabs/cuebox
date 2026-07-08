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

if [ "${CURSOR_WORKFLOW_PENDING_DRY_RUN:-}" = "1" ] || [ "${MOCK_CURSOR_API:-}" = "1" ]; then
  case "$ACTION" in
    set)
      agent_recorded=$(jq -r --arg k "$SKILL" '
        ((.agents // {})[$k] // empty)
        | if type == "object" then .id // empty else . end
      ' "$STATE_FILE")
      if [ -n "$agent_recorded" ] && [ "$agent_recorded" != "null" ]; then
        echo "Peer agent already recorded for ${SKILL}" >&2
        exit 2
      fi
      pending_skill=$(jq -r '.handoff_pending.skill // empty' "$STATE_FILE")
      if [ -n "$pending_skill" ] && [ "$pending_skill" = "$SKILL" ]; then
        echo "Peer holds pending lock for ${SKILL}" >&2
        exit 2
      fi
      jq --arg skill "$SKILL" --arg ts "$TS" --argjson attempt "$ATTEMPT" \
        '.handoff_pending = {skill: $skill, started_at: $ts, attempt: $attempt}' \
        "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
      if [ -n "${CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE:-}" ]; then
        remote_base="{}"
        if [ -f "$CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE" ]; then
          remote_base=$(cat "$CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE")
        fi
        echo "$remote_base" | jq --arg skill "$SKILL" --arg ts "$TS" --argjson attempt "$ATTEMPT" \
          '.handoff_pending = {skill: $skill, started_at: $ts, attempt: $attempt}' \
          > "$CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE"
      fi
      ;;
    clear)
      jq '.handoff_pending = null' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
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
    agent_recorded=$(jq -r --arg k "$SKILL" '
      ((.agents // {})[$k] // empty)
      | if type == "object" then .id // empty else . end
    ' "$REL_PATH")
    if [ -n "$agent_recorded" ] && [ "$agent_recorded" != "null" ]; then
      echo "Peer agent already recorded for ${SKILL}" >&2
      exit 2
    fi
    pending_skill=$(jq -r '.handoff_pending.skill // empty' "$REL_PATH")
    pending_started=$(jq -r '.handoff_pending.started_at // empty' "$REL_PATH")
    if [ -n "$pending_skill" ] && [ "$pending_skill" = "$SKILL" ] \
      && [ -n "$pending_started" ] && [ "$pending_started" != "null" ]; then
      now_epoch=$(date -u +%s)
      started_epoch=$(date -u -d "$pending_started" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$pending_started" +%s 2>/dev/null || echo 0)
      age_minutes=$(( (now_epoch - started_epoch) / 60 ))
      stale_minutes="${CURSOR_WORKFLOW_PENDING_STALE_MINUTES:-15}"
      if [ "$age_minutes" -lt "$stale_minutes" ]; then
        echo "Peer holds pending lock for ${SKILL}" >&2
        exit 2
      fi
    fi
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
