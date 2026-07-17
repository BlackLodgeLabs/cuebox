#!/usr/bin/env bash
# Spawn a Cursor Cloud Agent with admission gating, pending lock, and deferral handling.
# Usage: cursor-workflow-spawn-agent.sh <issue> <branch> <state-file> <skill> <prompt> <progress-stage> [--reopen]
# Env: CURSOR_API_KEY, GITHUB_REPOSITORY, SCRIPTS_DIR (optional), WF (optional)
set -euo pipefail

ISSUE="${1:?}"
BRANCH="${2:?}"
STATE_FILE="${3:?}"
SKILL="${4:?}"
PROMPT="${5:?}"
PROGRESS_STAGE="${6:?}"
shift 6 || true

REOPEN=false
for arg in "$@"; do
  case "$arg" in
    --reopen) REOPEN=true ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF="${WF:-${SCRIPTS_DIR:-$SCRIPT_DIR}}"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/cursor-workflow-config.sh"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
REPO_URL="https://github.com/${REPO}"
MAX_ATTEMPTS=3
if [ "${CURSOR_WORKFLOW_TEST_MODE:-}" = "1" ]; then
  BACKOFF=(0 0 0)
else
  BACKOFF=(30 60 120)
fi
attempt=0

skill_agent_label() {
  case "$1" in
    planning) echo "Plan Agent" ;;
    execute) echo "Execute Agent" ;;
    demo) echo "Demo Agent" ;;
    create-pr) echo "Create PR Agent" ;;
    babysit-pr) echo "Babysit PR Agent" ;;
    *) echo "$1" ;;
  esac
}

agent_display_name() {
  local pr label name
  pr=$(jq -r '.pr // empty' "$STATE_FILE")
  label=$(skill_agent_label "$SKILL")
  if [ -n "$pr" ] && [ "$pr" != "null" ]; then
    name="Issue #${ISSUE} / PR #${pr} - ${label}"
  else
    name="Issue #${ISSUE} - ${label}"
  fi
  echo "${name:0:100}"
}

mock_curl_post() {
  local url="$1"
  local out_file="$2"
  local code="${MOCK_CURSOR_POST_CODE:-201}"
  if [ -n "${MOCK_CURSOR_POST_COUNT_FILE:-}" ]; then
    local count=0
    [ -f "$MOCK_CURSOR_POST_COUNT_FILE" ] && count=$(cat "$MOCK_CURSOR_POST_COUNT_FILE")
    count=$((count + 1))
    echo "$count" > "$MOCK_CURSOR_POST_COUNT_FILE"
  fi
  if [ -f "${MOCK_CURSOR_POST_RESPONSE:-}" ]; then
    cp "${MOCK_CURSOR_POST_RESPONSE}" "$out_file"
  else
    echo '{"id":"bc-mock-agent-id"}' > "$out_file"
  fi
  echo "$code"
}

sync_after_spawn() {
  if [ "${CURSOR_WORKFLOW_SYNCED:-}" = "1" ] && [ -z "${HANDOFF_PROGRESS_STAGE:-}" ]; then
    echo "Post-spawn sync skipped — already synced this job"
    return 0
  fi
  CURSOR_WORKFLOW_SPAWN_CONFIRMED=1 \
  HANDOFF_PROGRESS_STAGE="$PROGRESS_STAGE" \
  HANDOFF_ACTIVE_SKILL="$SKILL" \
  HANDOFF_ACTIVE_AGENT="${agent_id:-}" \
    "$WF/cursor-workflow-sync-github-status.sh" "$STATE_FILE" || true
}

do_post_agent() {
  local agent_name payload http_code agent_id

  agent_name=$(agent_display_name)
  payload=$(jq -n \
    --arg name "$agent_name" \
    --arg text "$PROMPT" \
    --arg url "$REPO_URL" \
    --arg ref "$BRANCH" \
    '{name: $name, prompt: {text: $text}, repos: [{url: $url, startingRef: $ref}], autoCreatePR: false}')

  if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
    if [ -n "${MOCK_CURSOR_POST_URL_FILE:-}" ]; then
      echo "https://api.cursor.com/v1/agents" > "$MOCK_CURSOR_POST_URL_FILE"
    fi
    http_code=$(mock_curl_post "https://api.cursor.com/v1/agents" /tmp/cursor-agent.json)
  elif [ -n "${CURSOR_API_KEY:-}" ]; then
    http_code=$(curl -sS -o /tmp/cursor-agent.json -w "%{http_code}" \
      -X POST "https://api.cursor.com/v1/agents" \
      -u "${CURSOR_API_KEY}:" \
      -H "Content-Type: application/json" \
      -d "$payload")
  else
    http_code=0
  fi

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    agent_id=$(jq -r '.agent.id // .id // .agentId // empty' /tmp/cursor-agent.json)
    echo "Cursor agent created: ${agent_id:-unknown}"
      if [ -n "$agent_id" ]; then
        if [ "${MOCK_RECORD_SPAWN_FAIL:-}" = "1" ]; then
          echo "Mock record-spawn failure (MOCK_RECORD_SPAWN_FAIL=1)" >&2
        else
          "$WF/cursor-workflow-record-spawn-on-branch.sh" "$STATE_FILE" "$SKILL" "$agent_id" "$BRANCH" || true
        fi
      fi
    sync_after_spawn
    return 0
  fi

  if [ "$http_code" = "400" ]; then
    echo "Cursor API returned 400 (quota/plan limit): $(cat /tmp/cursor-agent.json 2>/dev/null || true)"
    unset CURSOR_WORKFLOW_PENDING_SKILL
    if [ "${CURSOR_WORKFLOW_PENDING_DRY_RUN:-}" = "1" ]; then
      jq '.handoff_pending = null' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    elif [ "${MOCK_CURSOR_API:-}" != "1" ]; then
      "$WF/cursor-workflow-record-handoff-pending.sh" "$STATE_FILE" "$BRANCH" clear || true
    fi
    return 2
  fi

  echo "Cursor API returned ${http_code}: $(cat /tmp/cursor-agent.json 2>/dev/null || true)"
  return 1
}

late_stage_resume_prior() {
  local prior_key="" prior_id=""
  if [ "${WORKFLOW_LATE_STAGE_RESUME}" != "true" ]; then
    return 1
  fi
  case "$SKILL" in
    create-pr) prior_key="demo" ;;
    babysit-pr) prior_key="create-pr" ;;
    *) return 1 ;;
  esac
  prior_id=$(jq -r --arg k "$prior_key" '
    ((.agents // {})[$k] // empty)
    | if type == "object" then .id // empty else . end
  ' "$STATE_FILE")
  if [ -z "$prior_id" ] || [ "$prior_id" = "null" ]; then
    return 1
  fi

  http_code=$("$WF/cursor-workflow-resume-agent-run.sh" "$prior_id" "$PROMPT" /tmp/cursor-agent.json)
  if [ "$http_code" = "409" ]; then
    echo "Late-stage resume deferred — agent ${prior_id} busy (409)"
    return 2
  fi
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    agent_id="$prior_id"
    echo "Late-stage resume run started on agent ${prior_id} (${prior_key} → ${SKILL})"
    if [ "${MOCK_RECORD_SPAWN_FAIL:-}" = "1" ]; then
      echo "Mock record-spawn failure (MOCK_RECORD_SPAWN_FAIL=1)" >&2
    else
      "$WF/cursor-workflow-record-spawn-on-branch.sh" "$STATE_FILE" "$SKILL" "$agent_id" "$BRANCH" || true
    fi
    sync_after_spawn
    return 0
  fi
  echo "Late-stage resume API returned ${http_code}: $(cat /tmp/cursor-agent.json 2>/dev/null || true)" >&2
  return 1
}

record_deferred_exhaust() {
  local reason="$1"
  "$WF/cursor-workflow-record-deferred-handoff.sh" "$STATE_FILE" "$BRANCH" "$SKILL" "$reason" || true
}

notify_stalled() {
  local reason="${1:?}"
  "$WF/cursor-workflow-notify-stalled.sh" "$STATE_FILE" "$reason" "$SKILL" || true
}

fail_pre_spawn_admission() {
  local original_rc="${1:-1}"
  echo "Agent-list fetch/count failed before spawning ${SKILL} (exit ${original_rc})" >&2
  if ! "$WF/cursor-workflow-notify-stalled.sh" \
    "$STATE_FILE" "agents-list-fetch-failed" "$SKILL"; then
    echo "::warning::Could not post stalled notification for agent-list fetch/count failure" >&2
  fi
  return "$original_rc"
}

gate_args=("$STATE_FILE" "$SKILL")
if [ "$REOPEN" = "true" ]; then
  gate_args+=("--reopen")
fi

set_pending_lock() {
  local attempt_num="$1"
  if [ "${CURSOR_WORKFLOW_PENDING_DRY_RUN:-}" = "1" ] || [ "${MOCK_CURSOR_API:-}" = "1" ]; then
    if ! "$WF/cursor-workflow-record-handoff-pending.sh" "$STATE_FILE" "$BRANCH" set "$SKILL" "$attempt_num" 2>/dev/null; then
      return 2
    fi
    export CURSOR_WORKFLOW_WE_HOLD_LOCK=1
    export CURSOR_WORKFLOW_PENDING_SKILL="$SKILL"
    return 0
  fi
  if ! "$WF/cursor-workflow-record-handoff-pending.sh" "$STATE_FILE" "$BRANCH" set "$SKILL" "$attempt_num"; then
    return 2
  fi
  export CURSOR_WORKFLOW_WE_HOLD_LOCK=1
  export CURSOR_WORKFLOW_PENDING_SKILL="$SKILL"
  return 0
}

while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  if "$WF/cursor-workflow-refetch-state.sh" "$STATE_FILE" "$BRANCH" >/dev/null; then
    :
  else
    refetch_rc=$?
    fail_pre_spawn_admission "$refetch_rc"
    exit $?
  fi

  if decision=$("$WF/cursor-workflow-admission-gate.sh" "${gate_args[@]}"); then
    :
  else
    gate_rc=$?
    fail_pre_spawn_admission "$gate_rc"
    exit $?
  fi
  case "$decision" in
    skip:*)
      echo "Spawn skipped: ${decision#skip:}"
      exit 0
      ;;
    defer:*)
      reason="${decision#defer:}"
      echo "Spawn deferred (${reason}), attempt $((attempt + 1))/${MAX_ATTEMPTS}"
      attempt=$((attempt + 1))
      if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
        sleep "${BACKOFF[$((attempt - 1))]:-120}"
        continue
      fi
      "$WF/cursor-workflow-post-deferral-comment.sh" "$ISSUE" "$reason" || true
      record_deferred_exhaust "$reason"
      exit 0
      ;;
    proceed)
      pending_rc=0
      set_pending_lock "$attempt" || pending_rc=$?
      if [ "$pending_rc" -eq 2 ]; then
        echo "Spawn deferred (pending-lock-race), attempt $((attempt + 1))/${MAX_ATTEMPTS}"
        attempt=$((attempt + 1))
        if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
          sleep "${BACKOFF[$((attempt - 1))]:-120}"
          continue
        fi
        "$WF/cursor-workflow-post-deferral-comment.sh" "$ISSUE" "pending-lock" || true
        record_deferred_exhaust "pending-lock"
        exit 0
      fi

      if "$WF/cursor-workflow-refetch-state.sh" "$STATE_FILE" "$BRANCH" >/dev/null; then
        :
      else
        refetch_rc=$?
        fail_pre_spawn_admission "$refetch_rc"
        exit $?
      fi

      if decision=$("$WF/cursor-workflow-admission-gate.sh" "${gate_args[@]}"); then
        :
      else
        gate_rc=$?
        fail_pre_spawn_admission "$gate_rc"
        exit $?
      fi
      case "$decision" in
        skip:*)
          echo "Spawn skipped: ${decision#skip:}"
          unset CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_WE_HOLD_LOCK
          exit 0
          ;;
        defer:*)
          reason="${decision#defer:}"
          echo "Spawn deferred (${reason}), attempt $((attempt + 1))/${MAX_ATTEMPTS}"
          unset CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_WE_HOLD_LOCK
          attempt=$((attempt + 1))
          if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
            sleep "${BACKOFF[$((attempt - 1))]:-120}"
            continue
          fi
          "$WF/cursor-workflow-post-deferral-comment.sh" "$ISSUE" "$reason" || true
          record_deferred_exhaust "$reason"
          exit 0
          ;;
        proceed)
          if late_stage_resume_prior; then
            resume_rc=$?
            if [ "$resume_rc" -eq 0 ]; then
              unset CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_WE_HOLD_LOCK
              exit 0
            elif [ "$resume_rc" -eq 2 ]; then
              unset CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_WE_HOLD_LOCK
              record_deferred_exhaust "resume-busy"
              exit 0
            fi
          fi
          ;;
        *)
          echo "Unknown admission decision after pending lock: $decision"
          unset CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_WE_HOLD_LOCK
          exit 0
          ;;
      esac

      if ! do_post_agent; then
        post_rc=$?
        unset CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_WE_HOLD_LOCK
        if [ "$post_rc" -eq 2 ]; then
          attempt=$((attempt + 1))
          if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
            sleep "${BACKOFF[$((attempt - 1))]:-120}"
            continue
          fi
          "$WF/cursor-workflow-post-deferral-comment.sh" "$ISSUE" "api-400" || true
          record_deferred_exhaust "api-400"
          exit 0
        fi
        if [ -z "${CURSOR_API_KEY:-}" ] && [ "${MOCK_CURSOR_API:-}" != "1" ]; then
          notify_stalled "missing-api-key" || true
          exit 0
        fi
        attempt=$((attempt + 1))
        if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
          sleep "${BACKOFF[$((attempt - 1))]:-120}"
          continue
        fi
        notify_stalled "spawn-failed" || true
        exit 0
      fi
      unset CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_WE_HOLD_LOCK
      exit 0
      ;;
    *)
      echo "Unknown admission decision: $decision"
      exit 0
      ;;
  esac
done

exit 0
