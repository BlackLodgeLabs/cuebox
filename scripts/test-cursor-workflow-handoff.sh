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
    "${CURSOR_AGENTS_LIST_CACHE:-}" "${CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE:-}" 2>/dev/null || true
  unset CURSOR_WORKFLOW_IN_FLIGHT_COUNT CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE \
    CURSOR_AGENTS_LIST_CACHE CURSOR_WORKFLOW_PENDING_SKILL CURSOR_WORKFLOW_WE_HOLD_LOCK \
    CURSOR_WORKFLOW_SYNCED CURSOR_WORKFLOW_SYNC_CALL_COUNT MOCK_CURSOR_LIST_FETCH_COUNT_FILE \
    CURSOR_WORKFLOW_REFETCH_REMOTE_JSON CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE \
    MOCK_CURSOR_POST_COUNT_FILE MOCK_RECORD_SPAWN_FAIL MOCK_IN_FLIGHT_RUN_COUNT MOCK_ACTIVE_AGENT_COUNT \
    MOCK_CURSOR_RUNS_COUNT_FILE MOCK_ENSURE_DRAFT_PR
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

# --- Multi-commit push: state change on non-tip commit (issue #83) ---
test_push_diff_non_tip_state_change() {
  local repo state_file c1 c2 c3 pattern bogus_sha
  repo=$(mktemp -d)
  state_file="workflow/issues/issue-83/workflow.state.json"
  pattern='workflow/issues/issue-[0-9]+/workflow\.state\.json'

  git -C "$repo" init -q
  git -C "$repo" config user.email "test@example.com"
  git -C "$repo" config user.name "Test User"

  mkdir -p "$repo/$(dirname "$state_file")"
  echo '{"issue":83,"stage":"spec-in-progress"}' > "$repo/$state_file"
  git -C "$repo" add "$state_file"
  git -C "$repo" commit -q -m "C1: initial state"
  c1=$(git -C "$repo" rev-parse HEAD)

  echo '{"issue":83,"stage":"spec-ready"}' > "$repo/$state_file"
  git -C "$repo" add "$state_file"
  git -C "$repo" commit -q -m "C2: state change"
  c2=$(git -C "$repo" rev-parse HEAD)

  echo "# unrelated" > "$repo/README.md"
  git -C "$repo" add README.md
  git -C "$repo" commit -q -m "C3: unrelated"
  c3=$(git -C "$repo" rev-parse HEAD)

  pushd "$repo" >/dev/null
  if "$SCRIPT_DIR/cursor-workflow-push-diff-includes.sh" "$c1" "$c3" -E "$pattern"; then
    pass "push diff detects non-tip state change across full range"
  else
    fail_test "push diff should detect state change on commit 2 (C1=$c1 C2=$c2 C3=$c3)"
  fi

  bogus_sha="0000000000000000000000000000000000000001"
  if "$SCRIPT_DIR/cursor-workflow-push-diff-includes.sh" "$bogus_sha" "$c3" -E "$pattern" 2>/dev/null; then
    fail_test "tip-only fallback should not match when state changed only on non-tip commit"
  else
    pass "tip-only fallback misses non-tip state change when BEFORE_SHA unavailable"
  fi
  popd >/dev/null

  rm -rf "$repo"
}

# --- Multi-commit push: PR.md change on non-tip commit (issue #83) ---
test_push_diff_non_tip_pr_md() {
  local repo pr_file c1 c2 c3 bogus_sha
  repo=$(mktemp -d)
  pr_file="workflow/issues/issue-83/PR.md"

  git -C "$repo" init -q
  git -C "$repo" config user.email "test@example.com"
  git -C "$repo" config user.name "Test User"

  mkdir -p "$repo/$(dirname "$pr_file")"
  echo "# Draft PR" > "$repo/$pr_file"
  git -C "$repo" add "$pr_file"
  git -C "$repo" commit -q -m "C1: initial PR.md"
  c1=$(git -C "$repo" rev-parse HEAD)

  echo "# Updated PR body" > "$repo/$pr_file"
  git -C "$repo" add "$pr_file"
  git -C "$repo" commit -q -m "C2: PR.md change"
  c2=$(git -C "$repo" rev-parse HEAD)

  echo "# unrelated" > "$repo/README.md"
  git -C "$repo" add README.md
  git -C "$repo" commit -q -m "C3: unrelated"
  c3=$(git -C "$repo" rev-parse HEAD)

  pushd "$repo" >/dev/null
  if "$SCRIPT_DIR/cursor-workflow-push-diff-includes.sh" "$c1" "$c3" -F "$pr_file"; then
    pass "push diff detects non-tip PR.md change across full range"
  else
    fail_test "push diff should detect PR.md change on commit 2 (C1=$c1 C2=$c2 C3=$c3)"
  fi

  bogus_sha="0000000000000000000000000000000000000001"
  if "$SCRIPT_DIR/cursor-workflow-push-diff-includes.sh" "$bogus_sha" "$c3" -F "$pr_file" 2>/dev/null; then
    fail_test "tip-only fallback should not match when PR.md changed only on non-tip commit"
  else
    pass "tip-only fallback misses non-tip PR.md change when BEFORE_SHA unavailable"
  fi
  popd >/dev/null

  rm -rf "$repo"
}

# --- Case A: remote agent recorded → skip, no POST (issue #84) ---
test_refetch_remote_agent_skip() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-babysit-recovery.json" "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  post_count=$(mktemp)
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  echo 0 > "$post_count"
  export CURSOR_WORKFLOW_REFETCH_REMOTE_JSON
  CURSOR_WORKFLOW_REFETCH_REMOTE_JSON=$(cat "$FIXTURES/state-remote-babysit-agent.json")

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    70 "cursor/issue-70-test" "$state" "babysit-pr" "test prompt" "babysit-in-progress" \
    >/tmp/spawn-remote-agent-skip.log 2>&1 || true

  if grep -q "Spawn skipped" /tmp/spawn-remote-agent-skip.log; then
    pass "refetch remote agent skip logged"
  else
    fail_test "refetch remote agent skip did not log Spawn skipped"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "refetch remote agent skip 0 POST"
  else
    fail_test "refetch remote agent skip expected 0 POST got $(cat "$post_count")"
  fi
  rm -f "$state" "$post_count"
}

# --- Case B: remote pending lock → defer, no POST (issue #84) ---
test_refetch_remote_pending_defer() {
  cleanup_workflow_cache
  local state remote
  state=$(mktemp)
  remote=$(mktemp)
  echo '{"issue":70,"branch":"cursor/issue-70-test","stage":"plan-ready","agents":{},"handoff_pending":{"skill":"execute","started_at":"2099-01-01T00:00:00Z","attempt":0},"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$remote"
  echo '{"issue":70,"branch":"cursor/issue-70-test","stage":"plan-ready","agents":{},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_IN_FLIGHT_RUN_COUNT=0
  export CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE="$remote"
  post_count=$(mktemp)
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  echo 0 > "$post_count"

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    70 "cursor/issue-70-test" "$state" "execute" "test prompt" "execute-in-progress" \
    >/tmp/spawn-remote-pending-defer.log 2>&1 || true

  if grep -q "defer:pending-lock\|Spawn deferred (pending-lock" /tmp/spawn-remote-pending-defer.log; then
    pass "refetch remote pending defer logged"
  else
    fail_test "refetch remote pending defer did not log defer"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "refetch remote pending defer 0 POST"
  else
    fail_test "refetch remote pending defer expected 0 POST got $(cat "$post_count")"
  fi
  rm -f "$state" "$remote" "$post_count"
}

# --- Case C: concurrent race → exactly 1 POST (issue #84) ---
test_concurrent_single_post() {
  cleanup_workflow_cache
  local state1 state2 remote post_count
  state1=$(mktemp)
  state2=$(mktemp)
  remote=$(mktemp)
  post_count=$(mktemp)
  echo '{}' > "$remote"
  echo '{"issue":84,"branch":"cursor/issue-84-test","stage":"create-pr-ready","agents":{},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$state1"
  cp "$state1" "$state2"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE="$remote"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  echo 0 > "$post_count"

  WF="$WF" CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE="$remote" MOCK_CURSOR_POST_COUNT_FILE="$post_count" \
    "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    84 "cursor/issue-84-test" "$state1" "babysit-pr" "race prompt 1" "babysit-in-progress" \
    >/tmp/spawn-race-1.log 2>&1 &
  pid1=$!
  sleep 0.2
  WF="$WF" CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE="$remote" MOCK_CURSOR_POST_COUNT_FILE="$post_count" \
    "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    84 "cursor/issue-84-test" "$state2" "babysit-pr" "race prompt 2" "babysit-in-progress" \
    >/tmp/spawn-race-2.log 2>&1 &
  pid2=$!
  wait "$pid1" "$pid2" || true

  if [ "$(cat "$post_count")" = "1" ]; then
    pass "concurrent race exactly 1 POST"
  else
    fail_test "concurrent race expected 1 POST got $(cat "$post_count")"
  fi
  rm -f "$state1" "$state2" "$remote" "$post_count"
}

# --- Case D: recovery respects remote agent → no spawn (issue #84) ---
test_recovery_remote_agent_skip() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-babysit-recovery.json" "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_PR_IS_DRAFT=true
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export CURSOR_WORKFLOW_REFETCH_REMOTE_JSON
  CURSOR_WORKFLOW_REFETCH_REMOTE_JSON=$(cat "$FIXTURES/state-remote-babysit-agent.json")
  post_count=$(mktemp)
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  echo 0 > "$post_count"
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    70 "cursor/issue-70-test" "$state" >/tmp/recovery-remote-skip.log 2>&1 || true

  if grep -q "Handoff recovery deferred.*skip:agent-already-recorded" /tmp/recovery-remote-skip.log \
    && ! grep -q "Handoff recovery: spawning babysit-pr" /tmp/recovery-remote-skip.log; then
    pass "recovery remote agent skip no spawn log"
  else
    fail_test "recovery should defer on remote agent without spawning"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "recovery remote agent skip 0 POST"
  else
    fail_test "recovery remote agent skip expected 0 POST got $(cat "$post_count")"
  fi
  rm -f "$state" "$post_count"
}

# --- Case E: record-spawn first-wins when different id (issue #84) ---
test_record_spawn_first_wins() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  echo '{"issue":84,"branch":"cursor/issue-84-test","stage":"execute-in-progress","agents":{"execute":"bc-first"},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' > "$state"
  export MOCK_CURSOR_API=1

  "$SCRIPT_DIR/cursor-workflow-record-spawn-on-branch.sh" \
    "$state" "execute" "bc-second" "cursor/issue-84-test" >/tmp/record-first-wins.log 2>&1

  recorded=$(jq -r '.agents.execute // empty' "$state")
  if [ "$recorded" = "bc-first" ]; then
    pass "record-spawn first-wins preserves bc-first"
  else
    fail_test "record-spawn first-wins expected bc-first got $recorded"
  fi
  if grep -q "Peer agent already recorded" /tmp/record-first-wins.log; then
    pass "record-spawn first-wins logged peer"
  else
    fail_test "record-spawn first-wins did not log peer message"
  fi
  rm -f "$state"
}

# --- Case F: failed record-spawn leaves pending; next spawn defers (issue #84) ---
test_failed_record_spawn_pending_blocks() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  echo '{"issue":84,"branch":"cursor/issue-84-test","stage":"plan-ready","agents":{},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_RECORD_SPAWN_FAIL=1
  post_count=$(mktemp)
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  echo 0 > "$post_count"
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    84 "cursor/issue-84-test" "$state" "execute" "first prompt" "execute-in-progress" \
    >/tmp/spawn-fail-record.log 2>&1 || true

  pending=$(jq -r '.handoff_pending.skill // empty' "$state")
  if [ "$pending" = "execute" ]; then
    pass "failed record-spawn leaves pending lock"
  else
    fail_test "failed record-spawn expected pending=execute got $pending"
  fi
  first_posts=$(cat "$post_count")

  unset MOCK_RECORD_SPAWN_FAIL
  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    84 "cursor/issue-84-test" "$state" "execute" "second prompt" "execute-in-progress" \
    >/tmp/spawn-fail-record-2.log 2>&1 || true

  if [ "$(cat "$post_count")" = "$first_posts" ]; then
    pass "failed record-spawn blocks second POST"
  else
    fail_test "failed record-spawn expected no second POST got $(cat "$post_count")"
  fi
  rm -f "$state" "$post_count"
}

# --- Case G: parallel pending + spawn race with real git (issue #90) ---
test_git_parallel_pending_spawn_race() {
  cleanup_workflow_cache
  # shellcheck source=fixtures/cursor-workflow/git-remote-test-lib.sh
  source "$FIXTURES/git-remote-test-lib.sh"

  local seed_state post_count local_state pid1 pid2 tip_agent
  git_remote_fixture_init 90

  seed_state='{"issue":90,"branch":"cursor/issue-90-test","stage":"create-pr-ready","agents":{},"pr":94,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}'
  git_remote_fixture_push_state "$seed_state" "seed create-pr-ready"

  post_count=$(mktemp)
  echo 0 > "$post_count"
  local_state="$GIT_CLONE_DIR/$GIT_REMOTE_STATE_REL"

  pushd "$GIT_CLONE_DIR" >/dev/null
  (
    unset CURSOR_WORKFLOW_PENDING_DRY_RUN MOCK_CURSOR_API
    if WF="$WF" "$SCRIPT_DIR/cursor-workflow-record-handoff-pending.sh" \
      "$local_state" "$GIT_REMOTE_BRANCH" set babysit-pr 0; then
      count=$(cat "$post_count")
      echo $((count + 1)) > "$post_count"
      WF="$WF" "$SCRIPT_DIR/cursor-workflow-record-spawn-on-branch.sh" \
        "$local_state" "babysit-pr" "bc-git-race-1" "$GIT_REMOTE_BRANCH"
    fi
  ) >/tmp/git-race-1.log 2>&1 &
  pid1=$!
  sleep 0.15
  (
    unset CURSOR_WORKFLOW_PENDING_DRY_RUN MOCK_CURSOR_API
    if WF="$WF" "$SCRIPT_DIR/cursor-workflow-record-handoff-pending.sh" \
      "$local_state" "$GIT_REMOTE_BRANCH" set babysit-pr 0; then
      count=$(cat "$post_count")
      echo $((count + 1)) > "$post_count"
      WF="$WF" "$SCRIPT_DIR/cursor-workflow-record-spawn-on-branch.sh" \
        "$local_state" "babysit-pr" "bc-git-race-2" "$GIT_REMOTE_BRANCH"
    fi
  ) >/tmp/git-race-2.log 2>&1 &
  pid2=$!
  wait "$pid1" "$pid2" || true
  popd >/dev/null

  if [ "$(cat "$post_count")" = "1" ]; then
    pass "git parallel pending+spawn exactly 1 POST"
  else
    fail_test "git parallel pending+spawn expected 1 POST got $(cat "$post_count")"
  fi
  tip_agent=$(git_remote_fixture_tip_agent babysit-pr)
  if [ -n "$tip_agent" ] && [ "$tip_agent" != "null" ]; then
    if [ "$tip_agent" = "bc-git-race-1" ] || [ "$tip_agent" = "bc-git-race-2" ]; then
      pass "git parallel pending+spawn one agent at tip"
    else
      fail_test "git parallel pending+spawn unexpected agent $tip_agent"
    fi
  else
    fail_test "git parallel pending+spawn no agent at branch tip"
  fi

  rm -f "$post_count"
  git_remote_fixture_cleanup
}

# --- Case H: record-spawn TOCTOU with real git (issue #90) ---
test_git_record_spawn_toctou() {
  cleanup_workflow_cache
  # shellcheck source=fixtures/cursor-workflow/git-remote-test-lib.sh
  source "$FIXTURES/git-remote-test-lib.sh"

  local seed_state local_state pid1 pid2 tip
  git_remote_fixture_init 90

  seed_state='{"issue":90,"branch":"cursor/issue-90-test","stage":"execute-in-progress","agents":{"execute":"bc-first"},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}'
  git_remote_fixture_push_state "$seed_state" "seed bc-first"

  local_state="$GIT_CLONE_DIR/$GIT_REMOTE_STATE_REL"
  pushd "$GIT_CLONE_DIR" >/dev/null
  unset CURSOR_WORKFLOW_PENDING_DRY_RUN MOCK_CURSOR_API
  WF="$WF" "$SCRIPT_DIR/cursor-workflow-record-spawn-on-branch.sh" \
    "$local_state" execute bc-second "$GIT_REMOTE_BRANCH" >/tmp/git-toctou-2.log 2>&1 &
  pid1=$!
  WF="$WF" "$SCRIPT_DIR/cursor-workflow-record-spawn-on-branch.sh" \
    "$local_state" execute bc-third "$GIT_REMOTE_BRANCH" >/tmp/git-toctou-3.log 2>&1 &
  pid2=$!
  wait "$pid1" "$pid2" || true
  popd >/dev/null

  tip=$(git_remote_fixture_tip_agent execute)
  if [ "$tip" = "bc-first" ]; then
    pass "git record-spawn TOCTOU preserves bc-first"
  else
    fail_test "git record-spawn TOCTOU expected bc-first got $tip"
  fi
  if grep -q "Peer agent already recorded" /tmp/git-toctou-2.log /tmp/git-toctou-3.log; then
    pass "git record-spawn TOCTOU logged peer"
  else
    fail_test "git record-spawn TOCTOU missing peer log"
  fi

  git_remote_fixture_cleanup
}

# --- Case I: recovery checkout rewind with real git (issue #90) ---
test_git_recovery_checkout_rewind() {
  cleanup_workflow_cache
  # shellcheck source=fixtures/cursor-workflow/git-remote-test-lib.sh
  source "$FIXTURES/git-remote-test-lib.sh"

  local state_a state_b sha_a local_copy post_count
  git_remote_fixture_init 90

  state_a='{"issue":90,"branch":"cursor/issue-90-test","stage":"create-pr-ready","agents":{},"pr":94,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}'
  git_remote_fixture_push_state "$state_a" "commit A no babysit"
  sha_a=$(git -C "$GIT_CLONE_DIR" rev-parse HEAD)

  state_b='{"issue":90,"branch":"cursor/issue-90-test","stage":"create-pr-ready","agents":{"babysit-pr":"bc-remote-winner"},"pr":94,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}'
  git_remote_fixture_push_state "$state_b" "commit B babysit recorded"

  git -C "$GIT_CLONE_DIR" checkout -q "$sha_a"
  local_copy=$(mktemp)
  cp "$GIT_CLONE_DIR/$GIT_REMOTE_STATE_REL" "$local_copy"

  post_count=$(mktemp)
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_PR_IS_DRAFT=true
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  unset CURSOR_API_KEY CURSOR_WORKFLOW_REFETCH_REMOTE_JSON CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE

  pushd "$GIT_CLONE_DIR" >/dev/null
  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    90 "$GIT_REMOTE_BRANCH" "$local_copy" >/tmp/git-recovery-rewind.log 2>&1 || true
  popd >/dev/null

  if grep -q "Handoff recovery deferred.*skip:agent-already-recorded" /tmp/git-recovery-rewind.log \
    && ! grep -q "Handoff recovery: spawning babysit-pr" /tmp/git-recovery-rewind.log; then
    pass "git recovery rewind deferred spawn"
  else
    fail_test "git recovery rewind should defer without spawn (log: $(cat /tmp/git-recovery-rewind.log))"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "git recovery rewind 0 POST"
  else
    fail_test "git recovery rewind expected 0 POST got $(cat "$post_count")"
  fi

  rm -f "$local_copy" "$post_count"
  git_remote_fixture_cleanup
}

# --- Pass-back recovery (issue #86) ---
test_passback_recovery() {
  cleanup_workflow_cache
  local state runs_count post_count
  state=$(mktemp)
  runs_count=$(mktemp)
  post_count=$(mktemp)
  cp "$FIXTURES/state-passback-recovery.json" "$state"
  echo 0 > "$runs_count"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export CURSOR_API_KEY=mock-key-for-test
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_RUNS_COUNT_FILE="$runs_count"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  export CURSOR_WORKFLOW_SYNCED=1

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    86 "cursor/issue-86-test" "$state" >/tmp/passback-recovery.log 2>&1
  rc=$?

  if [ "$rc" -eq 0 ] && grep -q "Pass-back run started on agent bc-exec" /tmp/passback-recovery.log; then
    pass "passback recovery started run"
  else
    fail_test "passback recovery did not start run (rc=$rc log: $(cat /tmp/passback-recovery.log))"
  fi
  if [ "$(cat "$runs_count")" = "1" ]; then
    pass "passback recovery 1 runs POST"
  else
    fail_test "passback recovery expected 1 runs POST got $(cat "$runs_count")"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "passback recovery 0 agent POST"
  else
    fail_test "passback recovery expected 0 agent POST got $(cat "$post_count")"
  fi
  rm -f "$state" "$runs_count" "$post_count"
}

test_passback_recovery_409() {
  cleanup_workflow_cache
  local state runs_count
  state=$(mktemp)
  runs_count=$(mktemp)
  cp "$FIXTURES/state-passback-recovery.json" "$state"
  echo 0 > "$runs_count"
  export MOCK_CURSOR_API=1
  export CURSOR_API_KEY=mock-key-for-test
  export MOCK_CURSOR_POST_CODE=409
  export MOCK_CURSOR_RUNS_COUNT_FILE="$runs_count"

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    86 "cursor/issue-86-test" "$state" >/tmp/passback-409.log 2>&1
  rc=$?

  if [ "$rc" -eq 0 ] && grep -q "Pass-back agent busy (409)" /tmp/passback-409.log; then
    pass "passback recovery 409 defer exit 0"
  else
    fail_test "passback recovery 409 expected exit 0 with defer (rc=$rc)"
  fi
  rm -f "$state" "$runs_count"
}

# --- Re-open inference (issue #86) ---
test_reopen_inference_agents_demo() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  cp "$FIXTURES/state-reopen-recovery.json" "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    86 "cursor/issue-86-test" "$state" "" >/tmp/reopen-agents.log 2>&1

  if grep -q "Handoff recovery: spawning execute" /tmp/reopen-agents.log \
    && grep -q "reopen" /tmp/reopen-agents.log 2>/dev/null || grep -q "Handoff recovery: spawning execute" /tmp/reopen-agents.log; then
    pass "reopen inference agents+demo spawns execute"
  else
    fail_test "reopen inference agents+demo did not spawn execute"
  fi
  if ! grep -q "Handoff recovery: spawning demo" /tmp/reopen-agents.log; then
    pass "reopen inference agents+demo not demo"
  else
    fail_test "reopen inference agents+demo incorrectly spawned demo"
  fi
  rm -f "$state" "$post_count"
}

test_reopen_inference_prev_stage() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  echo '{"issue":86,"branch":"cursor/issue-86-test","stage":"execute-ready","agents":{"execute":"bc-exec"},"pr":96,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":5}}' > "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    86 "cursor/issue-86-test" "$state" "changes-requested" >/tmp/reopen-prev.log 2>&1

  if grep -q "Handoff recovery: spawning execute" /tmp/reopen-prev.log; then
    pass "reopen inference prev_stage spawns execute"
  else
    fail_test "reopen inference prev_stage did not spawn execute"
  fi
  rm -f "$state" "$post_count"
}

test_execute_ready_forward() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  echo '{"issue":86,"branch":"cursor/issue-86-test","stage":"execute-ready","active_skill":null,"agents":{"execute":"bc-exec"},"pr":96,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":3}}' > "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    86 "cursor/issue-86-test" "$state" "" >/tmp/execute-forward.log 2>&1

  if grep -q "Handoff recovery: spawning demo" /tmp/execute-forward.log; then
    pass "execute-ready forward spawns demo"
  else
    fail_test "execute-ready forward did not spawn demo"
  fi
  if [ "$(cat "$post_count")" = "1" ]; then
    pass "execute-ready forward 1 POST"
  else
    fail_test "execute-ready forward expected 1 POST got $(cat "$post_count")"
  fi
  rm -f "$state" "$post_count"
}

# --- Demo skip when execute-in-progress (issue #91) ---
test_demo_skip_execute_in_progress() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  echo '{"issue":91,"branch":"cursor/issue-91-test","stage":"execute-in-progress","active_skill":"execute","agents":{"demo":null},"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":0}}' > "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  unset CURSOR_API_KEY

  decision=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "demo")
  if [ "$decision" = "skip:execute-in-progress" ]; then
    pass "demo skip execute-in-progress gate"
  else
    fail_test "demo skip execute-in-progress expected skip:execute-in-progress got $decision"
  fi

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    91 "cursor/issue-91-test" "$state" "demo" "test prompt" "demo-in-progress" \
    >/tmp/demo-skip-exec.log 2>&1 || true

  if grep -q "Spawn skipped" /tmp/demo-skip-exec.log; then
    pass "demo skip execute-in-progress spawn skipped"
  else
    fail_test "demo skip execute-in-progress did not log skip"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "demo skip execute-in-progress 0 POST"
  else
    fail_test "demo skip execute-in-progress expected 0 POST got $(cat "$post_count")"
  fi
  rm -f "$state" "$post_count"
}

# --- Demo defer when active_skill=execute at execute-ready (issue #91) ---
test_demo_defer_execute_active() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  echo '{"issue":91,"branch":"cursor/issue-91-test","stage":"execute-ready","active_skill":"execute","agents":{"demo":null,"execute":"bc-exec"},"pr":98,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":2}}' > "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  unset CURSOR_API_KEY

  decision=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "demo")
  if [ "$decision" = "defer:execute-active" ]; then
    pass "demo defer execute-active gate"
  else
    fail_test "demo defer execute-active expected defer:execute-active got $decision"
  fi

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    91 "cursor/issue-91-test" "$state" "demo" "test prompt" "demo-in-progress" \
    >/tmp/demo-defer-exec.log 2>&1 || true

  if grep -q "defer:execute-active\|Spawn deferred" /tmp/demo-defer-exec.log; then
    pass "demo defer execute-active spawn deferred"
  else
    fail_test "demo defer execute-active did not log defer"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "demo defer execute-active 0 POST"
  else
    fail_test "demo defer execute-active expected 0 POST got $(cat "$post_count")"
  fi

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    91 "cursor/issue-91-test" "$state" "" >/tmp/demo-defer-recovery.log 2>&1 || true

  if grep -q "Handoff recovery deferred.*defer:execute-active" /tmp/demo-defer-recovery.log \
    && ! grep -q "Handoff recovery: spawning demo" /tmp/demo-defer-recovery.log; then
    pass "demo defer execute-active recovery deferred"
  else
    fail_test "demo defer execute-active recovery should defer without spawn"
  fi
  rm -f "$state" "$post_count"
}

# --- Demo proceed when execute-ready and active_skill cleared (issue #91) ---
test_demo_proceed_execute_ready() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  echo '{"issue":91,"branch":"cursor/issue-91-test","stage":"execute-ready","active_skill":null,"agents":{"demo":null},"pr":98,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":2}}' > "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  unset CURSOR_API_KEY

  decision=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "demo")
  if [ "$decision" = "proceed" ]; then
    pass "demo proceed execute-ready gate"
  else
    fail_test "demo proceed execute-ready expected proceed got $decision"
  fi

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    91 "cursor/issue-91-test" "$state" "" >/tmp/demo-proceed.log 2>&1

  if grep -q "Handoff recovery: spawning demo" /tmp/demo-proceed.log; then
    pass "demo proceed execute-ready recovery spawned demo"
  else
    fail_test "demo proceed execute-ready recovery did not spawn demo"
  fi
  if [ "$(cat "$post_count")" = "1" ]; then
    pass "demo proceed execute-ready 1 POST"
  else
    fail_test "demo proceed execute-ready expected 1 POST got $(cat "$post_count")"
  fi
  rm -f "$state" "$post_count"
}

test_spec_ready_ensure_pr() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  cp "$FIXTURES/state-spec-ready-null-pr.json" "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  export MOCK_ENSURE_DRAFT_PR=99
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    86 "cursor/issue-86-test" "$state" >/tmp/spec-ensure-pr.log 2>&1

  pr=$(jq -r '.pr' "$state")
  if [ "$pr" = "99" ]; then
    pass "spec-ready ensure pr updated state"
  else
    fail_test "spec-ready ensure pr expected 99 got $pr"
  fi
  if grep -q "Draft PR #99" /tmp/spec-ensure-pr.log || grep -q "Handoff recovery: spawning planning" /tmp/spec-ensure-pr.log; then
    pass "spec-ready ensure pr recovery proceeded"
  else
    fail_test "spec-ready ensure pr recovery did not proceed"
  fi
  rm -f "$state" "$post_count"
}

test_plan_ready_ensure_pr() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  echo '{"issue":86,"branch":"cursor/issue-86-test","stage":"plan-ready","agents":{"planning":"bc-plan"},"pr":null,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":2}}' > "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  export MOCK_ENSURE_DRAFT_PR=99
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    86 "cursor/issue-86-test" "$state" >/tmp/plan-ensure-pr.log 2>&1

  pr=$(jq -r '.pr' "$state")
  if [ "$pr" = "99" ]; then
    pass "plan-ready ensure pr updated state"
  else
    fail_test "plan-ready ensure pr expected 99 got $pr"
  fi
  if grep -q "Handoff recovery: spawning execute" /tmp/plan-ensure-pr.log; then
    pass "plan-ready ensure pr recovery spawned execute"
  else
    fail_test "plan-ready ensure pr recovery did not spawn execute"
  fi
  rm -f "$state" "$post_count"
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
test_push_diff_non_tip_state_change
test_push_diff_non_tip_pr_md
test_refetch_remote_agent_skip
test_refetch_remote_pending_defer
test_concurrent_single_post
test_recovery_remote_agent_skip
test_record_spawn_first_wins
test_failed_record_spawn_pending_blocks
test_git_parallel_pending_spawn_race
test_git_record_spawn_toctou
test_git_recovery_checkout_rewind
test_passback_recovery
test_passback_recovery_409
test_reopen_inference_agents_demo
test_reopen_inference_prev_stage
test_execute_ready_forward
test_demo_skip_execute_in_progress
test_demo_defer_execute_active
test_demo_proceed_execute_ready
test_spec_ready_ensure_pr
test_plan_ready_ensure_pr

if [ "$fail" -ne 0 ]; then
  echo "test-cursor-workflow-handoff.sh: FAILED" >&2
  exit 1
fi

echo "test-cursor-workflow-handoff.sh: all cases passed"
