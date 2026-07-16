#!/usr/bin/env bash
# Re-fetch remote workflow.state.json from origin/<branch> and overlay admission fields.
# Usage: cursor-workflow-refetch-state.sh <state-file> <branch> [--agents-from-tip]
# Env: CURSOR_WORKFLOW_REFETCH_REMOTE_JSON — test hook bypassing git fetch
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/cursor-workflow-config.sh"

STATE_FILE="${1:?usage: cursor-workflow-refetch-state.sh <state-file> <branch> [--agents-from-tip]}"
BRANCH="${2:?usage: cursor-workflow-refetch-state.sh <state-file> <branch> [--agents-from-tip]}"
shift 2 || true

AGENTS_FROM_TIP=false
for arg in "$@"; do
  case "$arg" in
    --agents-from-tip) AGENTS_FROM_TIP=true ;;
  esac
done

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 0
fi

if ! jq empty "$STATE_FILE" 2>/dev/null; then
  echo "Invalid JSON in ${STATE_FILE}" >&2
  exit 0
fi

ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
if [ -z "$ISSUE" ]; then
  echo "State file missing issue number" >&2
  exit 0
fi

REL_PATH="workflow/issues/issue-${ISSUE}/workflow.state.json"
PENDING_STALE_MINUTES="${WORKFLOW_HANDOFF_PENDING_STALE_MINUTES}"

REMOTE_JSON="{}"
FETCH_OK=false
if [ -n "${CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE:-}" ] && [ -f "$CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE" ]; then
  REMOTE_JSON=$(cat "$CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE")
elif [ -n "${CURSOR_WORKFLOW_REFETCH_REMOTE_JSON:-}" ]; then
  REMOTE_JSON="$CURSOR_WORKFLOW_REFETCH_REMOTE_JSON"
elif git rev-parse --git-dir >/dev/null 2>&1; then
  if git fetch origin "$BRANCH" --quiet 2>/dev/null; then
    FETCH_OK=true
  else
    echo "Warning: could not fetch origin/${BRANCH} — refetch with empty remote" >&2
  fi
  if git cat-file -e "origin/${BRANCH}:${REL_PATH}" 2>/dev/null; then
    REMOTE_JSON=$(git show "origin/${BRANCH}:${REL_PATH}")
    if ! jq empty <<<"$REMOTE_JSON" 2>/dev/null; then
      echo "Invalid remote JSON at origin/${BRANCH}:${REL_PATH}" >&2
      exit 0
    fi
  elif [ "$AGENTS_FROM_TIP" = "true" ]; then
    echo "Warning: origin/${BRANCH}:${REL_PATH} not found after fetch" >&2
  fi
fi

LOCAL_JSON=$(cat "$STATE_FILE")
BEFORE_HASH=$(echo "$LOCAL_JSON" | jq -c '{agents, handoff_pending, stage, pr, loops}')

OVERLAYED=$(jq -n \
  --argjson remote "$REMOTE_JSON" \
  --argjson local "$LOCAL_JSON" \
  --argjson stale_minutes "$PENDING_STALE_MINUTES" \
  '
  def pending_fresh($p):
    if $p == null then false
    elif ($p.started_at // "") == "" then false
    else
      (($p.started_at | fromdateiso8601) as $started |
       (now - $started) / 60 < $stale_minutes)
    end;

  def merge_agents($r; $l):
    (($r.agents // {}) + ($l.agents // {}) | keys | unique) as $keys |
    ($r.agents // {}) as $ra |
    ($l.agents // {}) as $la |
    reduce $keys[] as $k ({}; .[$k] = if ($ra[$k] // null) != null then $ra[$k] else ($la[$k] // null) end);

  def merge_handoff_pending($r; $l):
    ($r.handoff_pending // null) as $rp |
    ($l.handoff_pending // null) as $lp |
    if $lp != null and (pending_fresh($lp)) then $lp
    elif $rp != null and (pending_fresh($rp)) then $rp
    else null
    end;

  $local as $l | ($remote // {}) as $r |
  $l
  | .agents = merge_agents($r; $l)
  | .handoff_pending = merge_handoff_pending($r; $l)
  | .stage = (if ($r.stage // null) != null then $r.stage else ($l.stage // null) end)
  | .pr = (if ($r.pr // null) != null then $r.pr else ($l.pr // null) end)
  | .loops = (
      (($r.loops // {}) + ($l.loops // {}) | keys | unique) as $keys |
      ($r.loops // {}) as $rl |
      ($l.loops // {}) as $ll |
      reduce $keys[] as $k ({}; .[$k] = ([($rl[$k] // 0), ($ll[$k] // 0)] | max))
    )
  ')

printf '%s\n' "$OVERLAYED" > "$STATE_FILE"

# Branch-tip agents overlay: never trust trigger-SHA local agents when tip has records (issue #90).
if [ "$AGENTS_FROM_TIP" = "true" ] && [ -z "${CURSOR_WORKFLOW_REFETCH_REMOTE_JSON:-}" ] \
  && [ -z "${CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE:-}" ] \
  && git rev-parse --git-dir >/dev/null 2>&1; then
  if git cat-file -e "origin/${BRANCH}:${REL_PATH}" 2>/dev/null; then
    TIP_JSON=$(git show "origin/${BRANCH}:${REL_PATH}")
    if jq empty <<<"$TIP_JSON" 2>/dev/null; then
      jq --argjson tip "$TIP_JSON" '
        .agents = (
          (($tip.agents // {}) + (.agents // {}) | keys | unique) as $keys |
          ($tip.agents // {}) as $ta |
          (.agents // {}) as $la |
          reduce $keys[] as $k ({}; .[$k] = if ($ta[$k] // null) != null then $ta[$k] else ($la[$k] // null) end)
        )
        | .stage = (if ($tip.stage // null) != null then $tip.stage else (.stage // null) end)
        | .pr = (if ($tip.pr // null) != null then $tip.pr else (.pr // null) end)
      ' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    fi
  elif [ "$FETCH_OK" != "true" ]; then
    echo "Warning: --agents-from-tip but fetch failed; admission may use stale local agents" >&2
  fi
fi

AFTER_HASH=$(cat "$STATE_FILE" | jq -c '{agents, handoff_pending, stage, pr, loops}')
if [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
  echo "Refetched remote state for issue #${ISSUE} from origin/${BRANCH}"
fi

exit 0
