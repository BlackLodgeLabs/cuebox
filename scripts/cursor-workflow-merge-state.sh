#!/usr/bin/env bash
# Deep-merge local workflow.state.json with origin/<branch> before committing.
# Preserves remote agents, pr, loops, active_agent_id, pass-back fields, and handoff_pending
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
PENDING_STALE_MINUTES="${CURSOR_WORKFLOW_PENDING_STALE_MINUTES:-15}"

MERGED=$(jq -n \
  --argjson remote "$REMOTE_JSON" \
  --argjson local "$LOCAL_JSON" \
  --argjson stale_minutes "$PENDING_STALE_MINUTES" \
  '
  def stage_rank($s):
    if $s == null or $s == "" then -1
    elif ($s | IN("spec-needs-info", "plan-needs-info")) then 0
    elif $s == "spec-in-progress" then 10
    elif $s == "spec-ready" then 20
    elif $s == "plan-in-progress" then 25
    elif $s == "plan-ready" then 28
    elif ($s | IN("execute-in-progress", "execute-passback")) then 30
    elif ($s | IN("execute-ready", "changes-requested")) then 40
    elif $s == "demo-in-progress" then 50
    elif $s == "demo-ready" then 60
    elif $s == "create-pr-in-progress" then 70
    elif $s == "create-pr-ready" then 80
    elif $s == "babysit-in-progress" then 90
    elif ($s | IN("complete", "blocked")) then 100
    else -1
    end;

  def stage_with_higher_rank($a; $b):
    if (stage_rank($a)) >= (stage_rank($b)) then $a else $b end;

  def pending_fresh($p):
    if $p == null then false
    elif ($p.started_at // "") == "" then false
    else
      (($p.started_at | fromdateiso8601) as $started |
       (now - $started) / 60 < $stale_minutes)
    end;

  def merge_handoff_pending($r; $l):
    ($r.handoff_pending // null) as $rp |
    ($l.handoff_pending // null) as $lp |
    if $lp == null and ($l | has("handoff_pending")) and ($l.handoff_pending == null) then null
    elif $lp != null and (pending_fresh($lp) | not) then null
    elif $lp != null then $lp
    elif $rp != null and (pending_fresh($rp) | not) then null
    elif $rp != null then $rp
    else null
    end;

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
  | .stage = stage_with_higher_rank(($base.stage // null); ($l.stage // null))
  | .active_skill = ($l.active_skill // $base.active_skill // null)
  | .updated_at = ($l.updated_at // $base.updated_at // null)
  | .agents = merge_agents($base.agents; $l.agents)
  | .pr = pick_local_or_remote("pr"; $base; $l)
  | .active_agent_id = pick_local_or_remote("active_agent_id"; $base; $l)
  | .passback_to = pick_local_or_remote("passback_to"; $base; $l)
  | .passback_reason = pick_local_or_remote("passback_reason"; $base; $l)
  | .handoff_pending = merge_handoff_pending($base; $l)
  | .loops = merge_loops($base.loops; $l.loops)
  ')

printf '%s\n' "$MERGED" > "$STATE_FILE"
echo "Merged ${STATE_FILE} with origin/${BRANCH}:${REL_PATH}"
