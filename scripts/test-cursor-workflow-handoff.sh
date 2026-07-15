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
    MOCK_CURSOR_RUNS_COUNT_FILE MOCK_ENSURE_DRAFT_PR MOCK_GH_COMMENTS_FILE MOCK_GH_LAST_COMMENT_FILE \
    MOCK_CURSOR_LIST_FETCH_FAIL MOCK_CURSOR_ACTIVE_COUNT_FAIL MOCK_GH_AUTHOR MOCK_GH_OWNER MOCK_GH_COMMENT_FAIL
}
cleanup_workflow_cache

fail=0
pass() { echo "PASS: $1"; }
fail_test() { echo "FAIL: $1" >&2; fail=1; }

# Stub gh for notification and PAT fallback tests.
setup_mock_gh() {
  local gh_dir
  gh_dir=$(mktemp -d)
  MOCK_GH_COMMENTS_FILE=$(mktemp)
  MOCK_GH_LAST_COMMENT_FILE=$(mktemp)
  export MOCK_GH_COMMENTS_FILE MOCK_GH_LAST_COMMENT_FILE
  export MOCK_GH_AUTHOR="${MOCK_GH_AUTHOR:-test-author}"
  export MOCK_GH_OWNER="${MOCK_GH_OWNER:-test-owner}"
  echo '[]' > "$MOCK_GH_COMMENTS_FILE"
  cat > "$gh_dir/gh" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  auth)
    echo "MOCK gh auth $*" >&2
    ;;
  issue)
    if [ "${2:-}" = "view" ]; then
      if [[ "${*:-}" == *"--json author"* ]]; then
        if [[ "${*:-}" == *"-q"* ]]; then
          echo "${MOCK_GH_AUTHOR}"
        else
          echo "{\"author\":{\"login\":\"${MOCK_GH_AUTHOR}\"}}"
        fi
      fi
    elif [ "${2:-}" = "comment" ]; then
      if [ "${MOCK_GH_COMMENT_FAIL:-}" = "1" ]; then
        echo "Mock gh issue comment failure" >&2
        exit 1
      fi
      body=""
      shift 2
      while [ $# -gt 0 ]; do
        case "$1" in
          --body) body="$2"; shift 2 ;;
          *) shift ;;
        esac
      done
      echo "$body" > "${MOCK_GH_LAST_COMMENT_FILE}"
      echo "MOCK gh issue comment posted" >&2
    fi
    ;;
  api)
    if [[ "${*:-}" == *"/comments"* ]]; then
      cat "${MOCK_GH_COMMENTS_FILE}"
    elif [[ "${*:-}" == *"repos/"* ]] && [[ "${*:-}" != *"/comments"* ]]; then
      if [[ "${*:-}" == *"--jq"* ]]; then
        echo "${MOCK_GH_OWNER}"
      else
        echo "{\"owner\":{\"login\":\"${MOCK_GH_OWNER}\"}}"
      fi
    fi
    ;;
esac
exit 0
EOF
  chmod +x "$gh_dir/gh"
  export PATH="$gh_dir:$PATH"
  export GITHUB_TOKEN=mock-token
}

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

# --- Large agents list: no ARG_MAX via --argjson (issue #117) ---
test_large_agents_list_no_argmax() {
  local tmp bindir cache count pr_count
  tmp=$(mktemp -d)
  bindir="$tmp/bin"
  mkdir -p "$bindir"
  cache="$tmp/cache.json"

  # Fake curl: one multi-MB page (no pagination) — large enough that --argjson hits ARG_MAX.
  python3 - "$tmp/page.json" <<'PY'
import json, sys
n = 8000
items = [
    {
        "id": f"bc-large-{i}",
        "status": "ACTIVE",
        "latestRunId": f"run-{i}",
        "prUrl": (
            "https://github.com/BlackLodgeLabs/cuebox/pull/121"
            if i % 100 == 0
            else "https://github.com/BlackLodgeLabs/cuebox/pull/999"
        ),
        "createdAt": "2026-01-01T00:00:00Z",
    }
    for i in range(n)
]
json.dump({"items": items, "nextCursor": None}, open(sys.argv[1], "w"))
PY

  cat > "$bindir/curl" <<EOF
#!/usr/bin/env bash
set -euo pipefail
out=""
while [ \$# -gt 0 ]; do
  case "\$1" in
    -o) out="\$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [ -z "\$out" ]; then
  cat "$tmp/page.json"
else
  cp "$tmp/page.json" "\$out"
fi
EOF
  chmod +x "$bindir/curl"

  # Document the failure mode this fix avoids (skip assert if runner ARG_MAX is huge).
  if ! jq -n --argjson items "$(cat "$tmp/page.json" | jq -c '.items')" '{items: $items}' >/dev/null 2>"$tmp/argjson.err"; then
    if grep -q "Argument list too long" "$tmp/argjson.err"; then
      pass "large list reproduces ARG_MAX via --argjson"
    else
      pass "large list --argjson failed (non-ARG_MAX); safe path still required"
    fi
  else
    pass "large list --argjson succeeded on this runner; safe path still exercised"
  fi

  export PATH="$bindir:$PATH"
  unset MOCK_CURSOR_API || true
  export CURSOR_API_KEY=mock-key-for-large-list
  export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
  export CURSOR_AGENTS_LIST_CACHE="$cache"
  rm -f "$cache"

  if ! "$SCRIPT_DIR/cursor-workflow-fetch-agents-list.sh" >"$tmp/out.path" 2>"$tmp/fetch.err"; then
    fail_test "large list fetch failed: $(cat "$tmp/fetch.err")"
    rm -rf "$tmp"
    return 0
  fi

  count=$(jq '.items | length' "$cache")
  if [ "$count" = "8000" ]; then
    pass "large list fetch completes without ARG_MAX (8000 items)"
  else
    fail_test "large list fetch expected 8000 items got $count"
  fi

  # PR filter must shrink (no-op or (. == .) removed).
  rm -f "$cache"
  export CURSOR_AGENTS_PR_URL="https://github.com/BlackLodgeLabs/cuebox/pull/121"
  "$SCRIPT_DIR/cursor-workflow-fetch-agents-list.sh" >/dev/null
  pr_count=$(jq '.items | length' "$cache")
  if [ "$pr_count" = "80" ]; then
    pass "PR filter shrinks large list (80 matches)"
  else
    fail_test "PR filter expected 80 items got $pr_count"
  fi

  # Admission/count can still read the cache (mock in-flight count).
  export MOCK_CURSOR_API=1
  export MOCK_AGENTS_LIST_JSON="$cache"
  export MOCK_IN_FLIGHT_RUN_COUNT=0
  export CURSOR_AGENTS_LIST_CACHE="$tmp/cache2.json"
  rm -f "$CURSOR_AGENTS_LIST_CACHE"
  if "$SCRIPT_DIR/cursor-workflow-count-active-agents.sh" >/dev/null; then
    pass "count-active proceeds after large-list fetch"
  else
    fail_test "count-active failed after large-list fetch"
  fi

  rm -rf "$tmp"
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

# --- Resolve notify targets: dedup when author == owner ---
test_resolve_notify_targets_dedup() {
  cleanup_workflow_cache
  setup_mock_gh
  export MOCK_GH_AUTHOR=same-user
  export MOCK_GH_OWNER=same-user
  export GITHUB_TOKEN=mock

  output=$("$SCRIPT_DIR/cursor-workflow-resolve-notify-targets.sh" 111)
  if echo "$output" | grep -qE 'MENTIONS=.*@same-user' && ! echo "$output" | grep -qE '@same-user.*@same-user'; then
    pass "resolve notify targets dedup"
  else
    fail_test "resolve notify targets dedup expected single @same-user got: $output"
  fi
}

# --- Resolve notify targets: distinct author and owner ---
test_resolve_notify_targets_distinct() {
  cleanup_workflow_cache
  setup_mock_gh
  export MOCK_GH_AUTHOR=issue-author
  export MOCK_GH_OWNER=repo-owner
  export GITHUB_TOKEN=mock

  output=$("$SCRIPT_DIR/cursor-workflow-resolve-notify-targets.sh" 111)
  if echo "$output" | grep -qE 'MENTIONS=.*@issue-author.*@repo-owner'; then
    pass "resolve notify targets distinct"
  else
    fail_test "resolve notify targets distinct expected both mentions got: $output"
  fi
}

# --- Complete notifier: both @mentions, idempotent ---
test_notify_complete_mentions_both() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  echo '{"issue":111,"branch":"cursor/issue-111-test","stage":"complete","pr":114,"agents":{}}' > "$state"
  setup_mock_gh
  export MOCK_GH_AUTHOR=issue-author
  export MOCK_GH_OWNER=repo-owner
  export GITHUB_TOKEN=mock

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-notify-complete.sh" "$state" >/tmp/notify-complete.log 2>&1
  if grep -q '@issue-author @repo-owner' "$MOCK_GH_LAST_COMMENT_FILE"; then
    pass "notify complete mentions both"
  else
    fail_test "notify complete missing both mentions"
  fi

  echo '[{"body":"<!-- cursor-workflow-complete-notify:v1 -->"}]' > "$MOCK_GH_COMMENTS_FILE"
  WF="$WF" "$SCRIPT_DIR/cursor-workflow-notify-complete.sh" "$state" >/tmp/notify-complete-idem.log 2>&1
  if grep -q "already posted" /tmp/notify-complete-idem.log; then
    pass "notify complete idempotent skip"
  else
    fail_test "notify complete idempotent skip failed"
  fi
  rm -f "$state"
}

# --- Stalled notifier: body, marker, idempotent ---
test_notify_stalled_body_and_idempotency() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  echo '{"issue":111,"branch":"cursor/issue-111-test","stage":"execute-ready","pr":114,"agents":{"demo":"bc-test-agent"}}' > "$state"
  setup_mock_gh
  export MOCK_GH_AUTHOR=issue-author
  export MOCK_GH_OWNER=repo-owner
  export GITHUB_TOKEN=mock

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-notify-stalled.sh" "$state" "at-cap" "demo" >/tmp/notify-stalled.log 2>&1
  if grep -q 'cursor-workflow-stalled-notify:v1' "$MOCK_GH_LAST_COMMENT_FILE" \
    && grep -q '@issue-author @repo-owner' "$MOCK_GH_LAST_COMMENT_FILE" \
    && grep -q 'at-cap\|agent cap' "$MOCK_GH_LAST_COMMENT_FILE"; then
    pass "notify stalled body and marker"
  else
    fail_test "notify stalled body/marker missing"
  fi

  echo '[{"body":"<!-- cursor-workflow-stalled-notify:v1 -->"}]' > "$MOCK_GH_COMMENTS_FILE"
  WF="$WF" "$SCRIPT_DIR/cursor-workflow-notify-stalled.sh" "$state" "at-cap" "demo" >/tmp/notify-stalled-idem.log 2>&1
  if grep -q "already posted" /tmp/notify-stalled-idem.log; then
    pass "notify stalled idempotent skip"
  else
    fail_test "notify stalled idempotent skip failed"
  fi
  rm -f "$state"
}

test_recovery_agent_list_failure_is_terminal() {
  cleanup_workflow_cache
  local state cache stage skill rc post_count
  setup_mock_gh
  export MOCK_CURSOR_API=1
  export MOCK_CURSOR_LIST_FETCH_FAIL=1
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_ENSURE_DRAFT_PR=124
  export MOCK_PR_IS_DRAFT=true
  export GITHUB_TOKEN=mock

  while IFS=: read -r stage skill; do
    state=$(mktemp)
    cache=$(mktemp)
    post_count=$(mktemp)
    rm -f "$cache"
    echo 0 > "$post_count"
    export CURSOR_AGENTS_LIST_CACHE="$cache"
    export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
    echo "{\"issue\":118,\"branch\":\"cursor/issue-118-test\",\"stage\":\"${stage}\",\"active_skill\":null,\"agents\":{},\"pr\":124,\"handoff_pending\":null,\"loops\":{\"bugbot\":0,\"ci_autofix\":0,\"total_runs\":1}}" > "$state"

    rc=0
    if WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
      118 "cursor/issue-118-test" "$state" >/tmp/recovery-agent-list-failure.log 2>&1; then
      :
    else
      rc=$?
    fi

    if [ "$rc" -ne 0 ]; then
      pass "recovery ${stage} agent-list failure exits non-zero"
    else
      fail_test "recovery ${stage} agent-list failure expected non-zero exit"
    fi
    if grep -Fq 'cursor-workflow-stalled-notify:v1' "$MOCK_GH_LAST_COMMENT_FILE" \
      && grep -Fq 'agents-list-fetch-failed' "$MOCK_GH_LAST_COMMENT_FILE" \
      && grep -Fq "**Expected next skill:** \`${skill}\`" "$MOCK_GH_LAST_COMMENT_FILE"; then
      pass "recovery ${stage} reports ${skill} stalled notification"
    else
      fail_test "recovery ${stage} stalled notification missing reason or expected skill"
    fi
    if [ "$(cat "$post_count")" = "0" ]; then
      pass "recovery ${stage} does not spawn after agent-list failure"
    else
      fail_test "recovery ${stage} spawned after agent-list failure"
    fi
    rm -f "$state" "$cache" "$post_count"
  done <<'EOF'
spec-ready:planning
plan-ready:execute
execute-ready:demo
demo-ready:create-pr
create-pr-ready:babysit-pr
EOF
}

test_recovery_active_count_failure_is_terminal() {
  cleanup_workflow_cache
  local state cache post_count rc
  state=$(mktemp)
  cache=$(mktemp)
  post_count=$(mktemp)
  rm -f "$cache"
  echo 0 > "$post_count"
  echo '{"issue":118,"branch":"cursor/issue-118-test","stage":"plan-ready","agents":{},"pr":124,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' > "$state"
  setup_mock_gh
  export MOCK_CURSOR_API=1
  export MOCK_CURSOR_ACTIVE_COUNT_FAIL=1
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  export CURSOR_AGENTS_LIST_CACHE="$cache"
  export GITHUB_TOKEN=mock

  rc=0
  if WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    118 "cursor/issue-118-test" "$state" >/tmp/recovery-active-count-failure.log 2>&1; then
    :
  else
    rc=$?
  fi

  if [ "$rc" -ne 0 ]; then
    pass "recovery active-agent count failure exits non-zero"
  else
    fail_test "recovery active-agent count failure expected non-zero exit"
  fi
  if grep -Fq 'cursor-workflow-stalled-notify:v1' "$MOCK_GH_LAST_COMMENT_FILE" \
    && grep -Fq 'agents-list-fetch-failed' "$MOCK_GH_LAST_COMMENT_FILE" \
    && grep -Fq '**Expected next skill:** `execute`' "$MOCK_GH_LAST_COMMENT_FILE"; then
    pass "recovery active-agent count failure posts execute notification"
  else
    fail_test "recovery active-agent count failure notification missing"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "recovery active-agent count failure does not spawn"
  else
    fail_test "recovery active-agent count failure unexpectedly spawned"
  fi
  rm -f "$state" "$cache" "$post_count"
}

test_spawn_agent_list_failure_stays_terminal_when_notify_fails() {
  cleanup_workflow_cache
  local state cache post_count rc
  state=$(mktemp)
  cache=$(mktemp)
  post_count=$(mktemp)
  rm -f "$cache"
  echo 0 > "$post_count"
  echo '{"issue":118,"branch":"cursor/issue-118-test","stage":"plan-ready","agents":{},"pr":124,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' > "$state"
  setup_mock_gh
  export MOCK_CURSOR_API=1
  export MOCK_CURSOR_LIST_FETCH_FAIL=1
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  export CURSOR_AGENTS_LIST_CACHE="$cache"
  export MOCK_GH_COMMENT_FAIL=1
  export GITHUB_TOKEN=mock

  rc=0
  if WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    118 "cursor/issue-118-test" "$state" execute "test prompt" "execute-in-progress" \
    >/tmp/spawn-agent-list-notify-failure.log 2>&1; then
    :
  else
    rc=$?
  fi

  if [ "$rc" -ne 0 ]; then
    pass "spawn agent-list failure remains non-zero when notification fails"
  else
    fail_test "spawn agent-list failure became successful when notification failed"
  fi
  if [ "$(cat "$post_count")" = "0" ]; then
    pass "spawn agent-list failure does not POST an agent"
  else
    fail_test "spawn agent-list failure unexpectedly POSTed an agent"
  fi
  rm -f "$state" "$cache" "$post_count"
}

# --- Spawn deferral: no stalled notification or false progress sync ---
test_spawn_stalled_no_progress_sync() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-execute-ready-no-demo.json" "$state"
  setup_mock_gh
  export MOCK_CURSOR_API=1
  export MOCK_IN_FLIGHT_RUN_COUNT=8
  export GITHUB_TOKEN=mock
  export CURSOR_WORKFLOW_SYNC_CALL_COUNT=0
  unset CURSOR_API_KEY
  unset CURSOR_HANDOFF_GITHUB_TOKEN

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-spawn-agent.sh" \
    110 "cursor/issue-110-test" "$state" demo "test prompt" "demo-in-progress" \
    >/tmp/spawn-stalled.log 2>&1
  rc=$?

  if [ "$rc" -eq 0 ]; then
    pass "spawn stalled exit 0"
  else
    fail_test "spawn stalled expected exit 0 got $rc"
  fi
  if ! grep -q "Posted stalled notification" /tmp/spawn-stalled.log; then
    pass "spawn deferral does not post stalled notification"
  else
    fail_test "spawn deferral unexpectedly posted stalled notification"
  fi
  if ! grep -q 'cursor-workflow-stalled-notify:v1' "$MOCK_GH_LAST_COMMENT_FILE" 2>/dev/null; then
    pass "spawn deferral has no stalled marker"
  else
    fail_test "spawn deferral unexpectedly wrote stalled marker"
  fi
  if [ "${CURSOR_WORKFLOW_SYNC_CALL_COUNT:-0}" = "0" ]; then
    pass "spawn stalled no sync call"
  else
    fail_test "spawn stalled expected 0 sync calls got ${CURSOR_WORKFLOW_SYNC_CALL_COUNT}"
  fi
  if ! grep -qE 'cursor:demo-in-progress|Updated status comment|Created status comment' /tmp/spawn-stalled.log; then
    pass "spawn stalled no false progress label sync"
  else
    fail_test "spawn stalled log contains false progress sync"
  fi
  if [ "$(jq -r '.stage' "$state")" = "execute-ready" ]; then
    pass "spawn stalled stage unchanged"
  else
    fail_test "spawn stalled expected execute-ready stage"
  fi
  rm -f "$state"
}

# --- Pass-back stalled notifier: no false progress sync (issue #110/#111) ---
test_passback_stalled_no_progress_sync() {
  cleanup_workflow_cache
  local state
  state=$(mktemp)
  cp "$FIXTURES/state-passback-recovery.json" "$state"
  setup_mock_gh
  export MOCK_CURSOR_API=1
  export MOCK_CURSOR_POST_CODE=500
  export GITHUB_TOKEN=mock
  export CURSOR_WORKFLOW_SYNC_CALL_COUNT=0
  unset CURSOR_API_KEY
  unset CURSOR_HANDOFF_GITHUB_TOKEN

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-passback-run.sh" \
    86 "cursor/issue-86-test" "$state" >/tmp/passback-stalled.log 2>&1 || rc=$?
  rc=${rc:-0}

  if [ "$rc" -eq 1 ]; then
    pass "passback stalled exit 1"
  else
    fail_test "passback stalled expected exit 1 got $rc"
  fi
  if grep -q "Posted stalled notification" /tmp/passback-stalled.log; then
    pass "passback stalled posted notification"
  else
    fail_test "passback stalled did not post stalled notification"
  fi
  if [ "${CURSOR_WORKFLOW_SYNC_CALL_COUNT:-0}" = "0" ]; then
    pass "passback stalled no sync call"
  else
    fail_test "passback stalled expected 0 sync calls got ${CURSOR_WORKFLOW_SYNC_CALL_COUNT}"
  fi
  if ! grep -qE 'execute-in-progress|HANDOFF_PROGRESS_STAGE|Updated status comment|Created status comment' /tmp/passback-stalled.log; then
    pass "passback stalled no false progress sync"
  else
    fail_test "passback stalled log contains false progress sync"
  fi
  if [ "$(jq -r '.stage' "$state")" = "execute-passback" ]; then
    pass "passback stalled stage unchanged"
  else
    fail_test "passback stalled expected execute-passback stage"
  fi
  rm -f "$state"
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

# --- Demo proceed at execute-ready with stale active_skill=execute (issue #109) ---
test_demo_proceed_execute_ready_stale_lock() {
  cleanup_workflow_cache
  local state post_count
  state=$(mktemp)
  post_count=$(mktemp)
  echo '{"issue":109,"branch":"cursor/issue-109-test","stage":"execute-ready","active_skill":"execute","agents":{"demo":null,"execute":"bc-exec"},"pr":112,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":2}}' > "$state"
  echo 0 > "$post_count"
  export MOCK_CURSOR_API=1
  export MOCK_ACTIVE_AGENT_COUNT=0
  export MOCK_CURSOR_POST_CODE=201
  export MOCK_CURSOR_POST_RESPONSE="$FIXTURES/mock-agent-create-201.json"
  export MOCK_CURSOR_POST_COUNT_FILE="$post_count"
  unset CURSOR_API_KEY

  decision=$("$SCRIPT_DIR/cursor-workflow-admission-gate.sh" "$state" "demo")
  if [ "$decision" = "proceed" ]; then
    pass "demo proceed execute-ready stale lock gate"
  else
    fail_test "demo proceed execute-ready stale lock expected proceed got $decision"
  fi

  WF="$WF" "$SCRIPT_DIR/cursor-workflow-handoff-recovery.sh" \
    109 "cursor/issue-109-test" "$state" "" >/tmp/demo-proceed-stale-recovery.log 2>&1 || true

  if grep -q "Handoff recovery: spawning demo" /tmp/demo-proceed-stale-recovery.log; then
    pass "demo proceed execute-ready stale lock recovery spawned demo"
  else
    fail_test "demo proceed execute-ready stale lock recovery did not spawn demo"
  fi
  if [ "$(cat "$post_count")" = "1" ]; then
    pass "demo proceed execute-ready stale lock 1 POST"
  else
    fail_test "demo proceed execute-ready stale lock expected 1 POST got $(cat "$post_count")"
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
test_large_agents_list_no_argmax
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
test_resolve_notify_targets_dedup
test_resolve_notify_targets_distinct
test_notify_complete_mentions_both
test_notify_stalled_body_and_idempotency
test_recovery_agent_list_failure_is_terminal
test_recovery_active_count_failure_is_terminal
test_spawn_agent_list_failure_stays_terminal_when_notify_fails
test_spawn_stalled_no_progress_sync
test_passback_stalled_no_progress_sync
test_reopen_inference_agents_demo
test_reopen_inference_prev_stage
test_execute_ready_forward
test_demo_skip_execute_in_progress
test_demo_proceed_execute_ready_stale_lock
test_demo_proceed_execute_ready
test_spec_ready_ensure_pr
test_plan_ready_ensure_pr

if [ "$fail" -ne 0 ]; then
  echo "test-cursor-workflow-handoff.sh: FAILED" >&2
  exit 1
fi

echo "test-cursor-workflow-handoff.sh: all cases passed"
