#!/usr/bin/env bash
# Mocked shell tests for cursor workflow handoff hardening (issue #70).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_DIR="$ROOT/scripts"
FIXTURES="$SCRIPT_DIR/fixtures/cursor-workflow"
WF="$SCRIPT_DIR"
export GITHUB_REPOSITORY="BlackLodgeLabs/cuebox"
export CURSOR_WORKFLOW_PENDING_DRY_RUN=1
export CURSOR_WORKFLOW_TEST_MODE=1

cleanup_workflow_cache() {
  rm -f /tmp/cursor-in-flight-count "${RUNNER_TEMP:-/tmp}/cursor-in-flight-count" \
    "${CURSOR_AGENTS_LIST_CACHE:-}" 2>/dev/null || true
  unset CURSOR_WORKFLOW_IN_FLIGHT_COUNT CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE \
    CURSOR_AGENTS_LIST_CACHE CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_SYNCED \
    CURSOR_WORKFLOW_SYNC_CALL_COUNT MOCK_CURSOR_LIST_FETCH_COUNT_FILE
}
cleanup_workflow_cache

fail=0
pass() { echo "PASS: $1"; }
fail_test() { echo "FAIL: $1" >&2; fail=1; }

# --- Dedup: agents.demo set → skip, no POST ---
test_dedup() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-dedup-demo.json" "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  rm -f /tmp/cursor-agent.json

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    70 "cursor/issue-70-test" "$state" "demo" "test prompt" "demo-in-progress" \
    >/tmp/spawn-dedup.log 2>&1 || true

  decision=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "demo")
  if [ "$decision" = "skip:agent-already-recorded" ]; then
    pass "dedup admission skip"
  else
    fail_test "dedup expected skip:agent-already-recorded got $decision"
  fi
  if grep -q "Spawn skipped" /tmp/spawn-dedup.log; then
    pass "dedup spawn skipped"
  else
    fail_test "dedup spawn did not log skip"
  fi
  rm -f "$state"
}

# --- At cap: MOCK_IN_FLIGHT_RUN_COUNT=8 (in-flight runs) → defer ---
test_at_cap() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  echo '{"issue":70,"branch":"cursor/issue-70-test","stage":"plan-ready","agents":{},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=8
  export CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS=8

  decision=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "execute")
  if [ "$decision" = "defer:at-cap" ]; then
    pass "at-cap admission defer"
  else
    fail_test "at-cap expected defer:at-cap got $decision"
  fi
  rm -f "$state"
}

# --- API 400: defer, exit 0 ---
test_api_400() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  echo '{"issue":70,"branch":"cursor/issue-70-test","stage":"plan-ready","agents":{},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=400
  export MOCK_CURSOR_POST_RESPONSE=/dev/null
  unset CURSOR_API_KEY
  unset CURSOR_HANDOFF_GITHUB_TOKEN

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    70 "cursor/issue-70-test" "$state" "execute" "test prompt" "execute-in-progress" \
    >/tmp/spawn-400.log 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then
    pass "api-400 exit 0"
  else
    fail_test "api-400 expected exit 0 got $rc"
  fi
  if grep -qi "400" /tmp/spawn-400.log; then
    pass "api-400 logged"
  else
    fail_test "api-400 did not log 400 response"
  fi
  rm -f "$state"
}

# --- Fresh pending lock → defer ---
test_fresh_pending() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-fresh-pending.json" "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0

  decision=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "execute")
  if [ "$decision" = "defer:pending-lock" ]; then
    pass "fresh pending lock defer"
  else
    fail_test "fresh pending expected defer:pending-lock got $decision"
  fi
  rm -f "$state"
}

# --- Babysit recovery: create-pr-ready, no babysit, draft PR ---
test_babysit_recovery() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-babysit-recovery.json" "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_PR_IS_DRAFT=true
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    70 "cursor/issue-70-test" "$state" >/tmp/babysit-recovery.log 2>&1

  babysit=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "babysit-pr")
  if grep -q "Handoff recovery: spawning babysit-pr" /tmp/babysit-recovery.log; then
    pass "babysit recovery spawned"
  else
    fail_test "babysit recovery did not spawn"
  fi
  recorded=$(jq -r '.agents["babysit-pr"] // empty' "$state")
  if [ -n "$recorded" ] && [ "$recorded" != "null" ]; then
    pass "babysit agent recorded in state"
  else
    fail_test "babysit agent not recorded"
  fi
  rm -f "$state"
}

# --- Plan-ready recovery: no execute agent ---
test_plan_ready_recovery() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  echo '{"issue":79,"branch":"cursor/issue-79-test","stage":"plan-ready","agents":{"planning":"bc-plan"},"pr":82,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":2}}' > "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    79 "cursor/issue-79-test" "$state" >/tmp/plan-recovery.log 2>&1

  if grep -q "Handoff recovery: spawning execute" /tmp/plan-recovery.log; then
    pass "plan-ready recovery spawned execute"
  else
    fail_test "plan-ready recovery did not spawn execute"
  fi
  recorded=$(jq -r '.agents.execute // empty' "$state")
  if [ -n "$recorded" ] && [ "$recorded" != "null" ]; then
    pass "execute agent recorded in plan-ready recovery"
  else
    fail_test "execute agent not recorded in plan-ready recovery"
  fi
  rm -f "$state"
}

# --- Stage merge: local demo-ready, remote create-pr-ready → create-pr-ready ---
test_stage_merge() {
  local state remote local_json merged_stage
  state=$(mktemp)
  remote='{"issue":70,"branch":"cursor/issue-70-test","stage":"create-pr-ready","agents":{"create-pr":"bc-x"},"pr":71,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":3}}'
  local_json='{"issue":70,"branch":"cursor/issue-70-test","stage":"demo-ready","agents":{},"pr":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}'
  echo "$local_json" > "$state"

  MERGE_STATE_REMOTE_JSON="$remote" \
    "$SCRIPT_DIR/cursor-workflow-merge-state.sh" "$state" >/dev/null

  merged_stage=$(jq -r '.stage' "$state")
  if [ "$merged_stage" = "create-pr-ready" ]; then
    pass "stage merge keeps higher rank (create-pr-ready)"
  else
    fail_test "stage merge expected create-pr-ready got $merged_stage"
  fi
  pr=$(jq -r '.pr' "$state")
  if [ "$pr" = "71" ]; then
    pass "stage merge preserves remote pr"
  else
    fail_test "stage merge expected pr=71 got $pr"
  fi
  rm -f "$state"
}

# --- Stage rank helper ---
test_stage_rank() {
  local r1 r2 r3 r4
  r1=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "demo-ready")
  r2=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "create-pr-ready")
  if [ "$r1" -lt "$r2" ]; then
    pass "stage rank ordering"
  else
    fail_test "stage rank demo-ready ($r1) should be < create-pr-ready ($r2)"
  fi
  r3=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "spec-ready")
  r4=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "plan-ready")
  if [ "$r3" -lt "$r4" ]; then
    pass "plan-ready ranks above spec-ready"
  else
    fail_test "plan-ready ($r4) should rank above spec-ready ($r3)"
  fi
  local r5 r6 r7 r8
  r5=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "plan-in-progress")
  r6=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "plan-needs-info")
  if [ "$r5" -lt "$r6" ]; then
    pass "plan-needs-info ranks above plan-in-progress"
  else
    fail_test "plan-needs-info ($r6) should rank above plan-in-progress ($r5)"
  fi
  r7=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "complete")
  r8=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "changes-requested")
  if [ "$r7" -lt "$r8" ]; then
    pass "changes-requested ranks above complete"
  else
    fail_test "changes-requested ($r8) should rank above complete ($r7)"
  fi
}

# --- Stage merge: local plan-ready, remote spec-ready → plan-ready (issue #72) ---
test_plan_ready_merge() {
  local state remote local_json merged_stage
  state=$(mktemp)
  remote='{"issue":72,"branch":"cursor/issue-72-test","stage":"spec-ready","agents":{},"pr":73,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":2}}'
  local_json='{"issue":72,"branch":"cursor/issue-72-test","stage":"plan-ready","agents":{},"pr":73,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":3}}'
  echo "$local_json" > "$state"

  MERGE_STATE_REMOTE_JSON="$remote" \
    "$SCRIPT_DIR/cursor-workflow-merge-state.sh" "$state" >/dev/null

  merged_stage=$(jq -r '.stage' "$state")
  if [ "$merged_stage" = "plan-ready" ]; then
    pass "stage merge keeps plan-ready over spec-ready"
  else
    fail_test "stage merge expected plan-ready got $merged_stage"
  fi
  rm -f "$state"
}

# --- Skip discovery at plan-in-progress (issue #77) ---
test_skip_discovery_plan_in_progress() {
  local state fetch_count
  state=$(mktemp)
  cp "$FIXTURES/state-plan-in-progress.json" "$state"

  if "$SCRIPT_DIR/cursor-workflow-should-discover-agents.sh" "$state"; then
    pass "should-discover skips plan-in-progress"
  else
    fail_test "should-discover should skip plan-in-progress"
  fi

  export MOCK_CURSOR_API=1
  export MOCK_AGENTS_LIST_JSON="$FIXTURES/mock-agents-list.json"
  fetch_count=$(mktemp)
  export MOCK_CURSOR_LIST_FETCH_COUNT_FILE="$fetch_count"
  echo 0 > "$fetch_count"
  export CURSOR_API_KEY=mock-key-for-test

  "$SCRIPT_DIR/cursor-workflow-discover-agents.sh" "$state" "cursor/issue-77-test" >/tmp/discover-skip.log 2>&1 || true
  if [ "$(cat "$fetch_count")" = "0" ]; then
    pass "discover makes 0 list fetches when skipped"
  else
    fail_test "discover should make 0 list fetches when skipped, got $(cat "$fetch_count")"
  fi
  rm -f "$state" "$fetch_count"
}

# --- Discovery runs at spec-ready without review-and-spec ---
test_discovery_runs_spec_ready() {
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-spec-ready-no-agents.json" "$state"

  if "$SCRIPT_DIR/cursor-workflow-should-discover-agents.sh" "$state"; then
    fail_test "should-discover should run at spec-ready without agents"
  else
    pass "should-discover runs at spec-ready"
  fi
  rm -f "$state"
}

# --- Shared agents list cache ---
test_shared_list_cache() {
  local fetch_count
  export MOCK_CURSOR_API=1
  export MOCK_AGENTS_LIST_JSON="$FIXTURES/mock-agents-list.json"
  export MOCK_IN_FLIGHT_RUN_COUNT=0
  fetch_count=$(mktemp)
  export MOCK_CURSOR_LIST_FETCH_COUNT_FILE="$fetch_count"
  export CURSOR_AGENTS_LIST_CACHE=$(mktemp)
  rm -f "$CURSOR_AGENTS_LIST_CACHE"
  echo 0 > "$fetch_count"

  "$SCRIPT_DIR/cursor-workflow-count-active-agents.sh" >/dev/null
  "$SCRIPT_DIR/cursor-workflow-count-active-agents.sh" >/dev/null

  if [ "$(cat "$fetch_count")" = "1" ]; then
    pass "shared list cache single fetch"
  else
    fail_test "shared list cache expected 1 fetch got $(cat "$fetch_count")"
  fi
  rm -f "$fetch_count" "$CURSOR_AGENTS_LIST_CACHE"
}

# --- Batched spawn writes ---
test_batched_spawn_writes() {
  cleanup_workflow_cache
  local state pending agent
  state=$(mktemp)
  echo '{"issue":77,"branch":"cursor/issue-77-test","stage":"plan-ready","agents":{},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export CURSOR_WORKFLOW_SYNCED=1
  unset CURSOR_API_KEY
  unset CURSOR_HANDOFF_GITHUB_TOKEN

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    77 "cursor/issue-77-test" "$state" "execute" "test prompt" "execute-in-progress" \
    >/tmp/spawn-batched.log 2>&1

  pending=$(jq -r '.handoff_pending // "null"' "$state")
  agent=$(jq -r '.agents.execute // empty' "$state")
  if [ "$pending" = "null" ] && [ -n "$agent" ] && [ "$agent" != "null" ]; then
    pass "batched spawn clears pending and records agent"
  else
    fail_test "batched spawn expected pending=null and agent set (pending=$pending agent=$agent)"
  fi
  rm -f "$state"
}

# --- No duplicate sync in same job ---
test_no_duplicate_sync() {
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-plan-in-progress.json" "$state"
  export MOCK_GITHUB_SYNC=1
  export GH_TOKEN=mock
  export GITHUB_TOKEN=mock
  export CURSOR_WORKFLOW_SYNC_CALL_COUNT=0
  export CURSOR_WORKFLOW_SYNCED=1

  "$SCRIPT_DIR/cursor-workflow-sync-github-status.sh" "$state" >/tmp/sync-dedup.log 2>&1
  if grep -q "sync skipped" /tmp/sync-dedup.log; then
    pass "duplicate sync skipped when already synced"
  else
    fail_test "expected sync skip when CURSOR_WORKFLOW_SYNCED=1"
  fi
  rm -f "$state"
}

# --- Status comment ID cache uses PATCH ---
test_comment_id_cache() {
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-with-comment-id.json" "$state"
  export MOCK_GITHUB_SYNC=1
  export GH_TOKEN=mock
  export GITHUB_TOKEN=mock
  unset CURSOR_WORKFLOW_SYNCED

  "$SCRIPT_DIR/cursor-workflow-sync-github-status.sh" "$state" >/tmp/sync-comment.log 2>&1
  if grep -q "MOCK PATCH" /tmp/sync-comment.log && ! grep -q "MOCK LIST" /tmp/sync-comment.log; then
    pass "comment id cache uses PATCH not list"
  else
    fail_test "expected PATCH path for cached comment id"
  fi
  rm -f "$state"
}

# --- Cap count cached across admission gate retries ---
test_cap_count_cache() {
  local state decision1 decision2
  state=$(mktemp)
  echo '{"issue":77,"branch":"cursor/issue-77-test","stage":"plan-ready","agents":{},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$state"
  export MOCK_CURSOR_API=1
  export MOCK_IN_FLIGHT_RUN_COUNT=0
  export CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS=8
  unset CURSOR_WORKFLOW_IN_FLIGHT_COUNT
  export CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE=$(mktemp)
  rm -f "$CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE"

  decision1=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "execute")
  export MOCK_IN_FLIGHT_RUN_COUNT=8
  decision2=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "execute")

  if [ "$decision1" = "proceed" ] && [ "$decision2" = "proceed" ]; then
    pass "cap count cached across admission gate calls"
  else
    fail_test "cap cache expected proceed/proceed got $decision1/$decision2"
  fi
  rm -f "$state" "$CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE"
}

test_dedup
test_at_cap
test_api_400
test_fresh_pending
test_babysit_recovery
test_plan_ready_recovery
test_stage_merge
test_stage_rank
test_plan_ready_merge
test_skip_discovery_plan_in_progress
test_discovery_runs_spec_ready
test_shared_list_cache
test_batched_spawn_writes
test_no_duplicate_sync
test_comment_id_cache
test_cap_count_cache

if [ "$fail" -ne 0 ]; then
  echo "test-cursor-workflow-handoff.sh: FAILED" >&2
  exit 1
fi

echo "test-cursor-workflow-handoff.sh: all cases passed"
