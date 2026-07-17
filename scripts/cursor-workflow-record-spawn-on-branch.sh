#!/usr/bin/env bash
# Batched post-spawn state write: agent slot, active fields, handoff_pending clear, optional status_comment_id.
# Usage: cursor-workflow-record-spawn-on-branch.sh <state-file> <agent-key> <agent-id> <branch> [status-comment-id]
set -euo pipefail

STATE_FILE="${1:?}"
AGENT_KEY="${2:?}"
AGENT_ID="${3:?}"
BRANCH="${4:?}"
STATUS_COMMENT_ID="${5:-${CURSOR_WORKFLOW_STATUS_COMMENT_ID:-}}"

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
  CURRENT=$(jq -r --arg k "$AGENT_KEY" '((.agents // {})[$k] // empty) | if type == "object" then .id // empty else . end' "$STATE_FILE")
  if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" != "$AGENT_ID" ]; then
    echo "Peer agent already recorded for ${AGENT_KEY} as ${CURRENT} (not ${AGENT_ID})" >&2
    exit 0
  fi
  if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" = "$AGENT_ID" ]; then
    echo "Spawn state already recorded for ${AGENT_KEY} as ${AGENT_ID}" >&2
    exit 0
  fi
  jq --arg key "$AGENT_KEY" --arg id "$AGENT_ID" --arg ts "$TS" \
    --arg comment "${STATUS_COMMENT_ID}" \
    '.agents //= {}
     | .agents[$key] = $id
     | .active_agent_id = $id
     | .active_skill = $key
     | .handoff_pending = null
     | .handoff_deferred = null
     | if $comment != "" and $comment != "null" then .status_comment_id = ($comment | tonumber? // $comment) else . end
     | .updated_at = $ts' \
    "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
  if [ -n "${CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE:-}" ]; then
    remote_base="{}"
    if [ -f "$CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE" ]; then
      remote_base=$(cat "$CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE")
    fi
    echo "$remote_base" | jq --arg key "$AGENT_KEY" --arg id "$AGENT_ID" --arg ts "$TS" \
      '.agents //= {}
       | .agents[$key] = $id
       | .handoff_pending = null
       | .updated_at = $ts' \
      > "$CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE"
  fi
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

CURRENT=$(jq -r --arg k "$AGENT_KEY" '((.agents // {})[$k] // empty) | if type == "object" then .id // empty else . end' "$REL_PATH")
PENDING=$(jq -r '.handoff_pending // empty' "$REL_PATH")
if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" != "$AGENT_ID" ]; then
  echo "Peer agent already recorded for ${AGENT_KEY} as ${CURRENT} (not ${AGENT_ID})" >&2
  exit 0
fi
if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" = "$AGENT_ID" ] \
  && { [ "$PENDING" = "null" ] || [ -z "$PENDING" ]; }; then
  echo "Spawn state already recorded for ${AGENT_KEY} as ${AGENT_ID}" >&2
  exit 0
fi

# Pre-write refetch: close TOCTOU between initial read and jq write (issue #90).
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

CURRENT=$(jq -r --arg k "$AGENT_KEY" '((.agents // {})[$k] // empty) | if type == "object" then .id // empty else . end' "$REL_PATH")
PENDING=$(jq -r '.handoff_pending // empty' "$REL_PATH")
if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" != "$AGENT_ID" ]; then
  echo "Peer agent already recorded for ${AGENT_KEY} as ${CURRENT} (not ${AGENT_ID})" >&2
  exit 0
fi
if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" = "$AGENT_ID" ] \
  && { [ "$PENDING" = "null" ] || [ -z "$PENDING" ]; }; then
  echo "Spawn state already recorded for ${AGENT_KEY} as ${AGENT_ID}" >&2
  exit 0
fi

jq --arg key "$AGENT_KEY" --arg id "$AGENT_ID" --arg ts "$TS" \
  --arg comment "${STATUS_COMMENT_ID}" \
  '.agents //= {}
   | .agents[$key] = $id
   | .active_agent_id = $id
   | .active_skill = $key
   | .handoff_pending = null
   | .handoff_deferred = null
   | if $comment != "" and $comment != "null" then .status_comment_id = ($comment | tonumber? // $comment) else . end
   | .updated_at = $ts' \
  "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"

git add "$REL_PATH"
git diff --staged --quiet && exit 0

git commit -m "chore(workflow): record ${AGENT_KEY} spawn for issue #${ISSUE}"
if ! git push origin "$BRANCH" 2>/tmp/record-spawn-push.err; then
  if grep -qiE 'non-fast-forward|fetch first|rejected' /tmp/record-spawn-push.err; then
    git fetch origin "$BRANCH"
    git checkout -B "$BRANCH" "origin/$BRANCH"
    CURRENT=$(jq -r --arg k "$AGENT_KEY" '((.agents // {})[$k] // empty) | if type == "object" then .id // empty else . end' "$REL_PATH")
    if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ]; then
      if [ "$CURRENT" != "$AGENT_ID" ]; then
        echo "Peer agent already recorded for ${AGENT_KEY} as ${CURRENT} (not ${AGENT_ID})" >&2
      else
        echo "Spawn state already recorded for ${AGENT_KEY} as ${AGENT_ID}" >&2
      fi
      exit 0
    fi
    echo "Push rejected after pre-write refetch; peer may have won the race" >&2
    exit 0
  fi
  cat /tmp/record-spawn-push.err >&2
  exit 1
fi
echo "Updated ${REL_PATH} with batched spawn record for ${AGENT_KEY}=${AGENT_ID}"
