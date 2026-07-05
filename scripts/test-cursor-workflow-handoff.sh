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

fail=0
pass() { echo "PASS: $1"; }
fail_test() { echo "FAIL: $1" >&2; fail=1; }

# --- Dedup: agents.demo set → skip, no POST ---
test_dedup() {
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
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-babysit-recovery.json" "$state"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_PR_IS_DRAFT=true
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  unset CURSOR_API_KEY

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-babysit-recovery.sh" \
    70 "cursor/issue-70-test" "$state" >/tmp/babysit-recovery.log 2>&1

  babysit=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "babysit-pr")
  if grep -q "Babysit recovery: spawning" /tmp/babysit-recovery.log; then
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

test_dedup
test_at_cap
test_api_400
test_fresh_pending
test_babysit_recovery
test_stage_merge
test_stage_rank
test_plan_ready_merge

if [ "$fail" -ne 0 ]; then
  echo "test-cursor-workflow-handoff.sh: FAILED" >&2
  exit 1
fi

echo "test-cursor-workflow-handoff.sh: all cases passed"
