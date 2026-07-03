#!/usr/bin/env bash
# Deep-merge local workflow.state.json with origin/<branch> before committing.
# Preserves remote agents, pr, loops, active_agent_id, and pass-back fields
# unless the agent intentionally sets non-null overrides.
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-merge-state.sh <path-to-workflow.state.json>}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

if ! jq empty "$STATE_FILE" 2>/dev/null; then
  echo "Invalid JSON in ${STATE_FILE}" >&2
  exit 1
fi

BRANCH=$(jq -r '.branch // empty' "$STATE_FILE")
if [ -z "$BRANCH" ]; then
  echo "State file missing branch field" >&2
  exit 1
fi

REL_PATH="${STATE_FILE#./}"
if [[ "$REL_PATH" != workflow/issues/issue-*/workflow.state.json ]]; then
  REL_PATH=$(realpath --relative-to="$(git rev-parse --show-toplevel 2>/dev/null || pwd)" "$STATE_FILE" 2>/dev/null || echo "$STATE_FILE")
fi

REMOTE_JSON="{}"
if [ -n "${MERGE_STATE_REMOTE_JSON:-}" ]; then
  REMOTE_JSON="$MERGE_STATE_REMOTE_JSON"
elif git rev-parse --git-dir >/dev/null 2>&1; then
  if git fetch origin "$BRANCH" --quiet 2>/dev/null; then
    :
  else
    echo "Warning: could not fetch origin/${BRANCH} — merging with empty remote" >&2
  fi
  if git cat-file -e "origin/${BRANCH}:${REL_PATH}" 2>/dev/null; then
    REMOTE_JSON=$(git show "origin/${BRANCH}:${REL_PATH}")
    if ! jq empty <<<"$REMOTE_JSON" 2>/dev/null; then
      echo "Invalid remote JSON at origin/${BRANCH}:${REL_PATH}" >&2
      exit 1
    fi
  fi
fi

LOCAL_JSON=$(cat "$STATE_FILE")

MERGED=$(jq -n \
  --argjson remote "$REMOTE_JSON" \
  --argjson local "$LOCAL_JSON" \
  '
  def merge_agents($r; $l):
    (($r // {}) + ($l // {}) | keys | unique) as $keys |
    ($r // {}) as $ra |
    ($l // {}) as $la |
    reduce $keys[] as $k ({}; .[$k] = if ($la[$k] // null) != null then $la[$k] else ($ra[$k] // null) end);

  def pick_local_or_remote($field; $r; $l):
    if ($l[$field] // null) != null then $l[$field] else ($r[$field] // null) end;

  def merge_loops($r; $l):
    (($r // {}) + ($l // {}) | keys | unique) as $keys |
    ($r // {}) as $rl |
    ($l // {}) as $ll |
    reduce $keys[] as $k ({}; .[$k] = ([($rl[$k] // 0), ($ll[$k] // 0)] | max));

  $remote as $r | $local as $l |
  ($r // {}) as $base |
  $base
  | .issue = $l.issue
  | .branch = $l.branch
  | .stage = ($l.stage // $base.stage // null)
  | .active_skill = ($l.active_skill // $base.active_skill // null)
  | .updated_at = ($l.updated_at // $base.updated_at // null)
  | .agents = merge_agents($base.agents; $l.agents)
  | .pr = pick_local_or_remote("pr"; $base; $l)
  | .active_agent_id = pick_local_or_remote("active_agent_id"; $base; $l)
  | .passback_to = pick_local_or_remote("passback_to"; $base; $l)
  | .passback_reason = pick_local_or_remote("passback_reason"; $base; $l)
  | .loops = merge_loops($base.loops; $l.loops)
  ')

printf '%s\n' "$MERGED" > "$STATE_FILE"
echo "Merged ${STATE_FILE} with origin/${BRANCH}:${REL_PATH}"
