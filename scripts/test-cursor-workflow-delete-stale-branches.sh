#!/usr/bin/env bash
# Mocked shell tests for cursor-workflow-delete-stale-branches.sh (issue #103).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/cursor-workflow-delete-stale-branches.sh"
export GITHUB_REPOSITORY="BlackLodgeLabs/cuebox"
export CURSOR_WORKFLOW_TEST_MODE=1
export GH_TOKEN="test-token"

fail=0
pass() { echo "PASS: $1"; }
fail_test() { echo "FAIL: $1" >&2; fail=1; }

setup() {
  export MOCK_REMOTE_BRANCHES=""
  export MOCK_OPEN_PR_HEADS=""
  export MOCK_MERGED_PRS=""
  export MOCK_PR_HEAD_REFS=""
  export MOCK_DELETE_CALLS_FILE="$(mktemp)"
  export MOCK_DELETE_HTTP_CODE="204"
  : > "$MOCK_DELETE_CALLS_FILE"
}

cleanup() {
  rm -f "${MOCK_DELETE_CALLS_FILE:-}"
}

# Post-merge PR #88: deletes cursor/issue-84-pr-88-*; keeps cursor/issue-84-pr-99-*
test_post_merge_pr_scope() {
  setup
  export MOCK_REMOTE_BRANCHES=$'cursor/issue-84-pr-88-execute-agent-d96d\ncursor/issue-84-pr-88-demo-agent-0254\ncursor/issue-84-pr-99-execute-agent-aaaa\ncursor/issue-99-add-film-to-watch-list'
  export MOCK_MERGED_PRS="88"
  export MOCK_PR_HEAD_REFS="88:cursor/issue-84-pr-88-execute-agent-d96d"

  out="$("$SCRIPT" 88 2>&1)" || true
  deleted_count="$(grep -c 'BRANCH: deleted ' <<<"$out" || true)"
  if [[ "$deleted_count" -eq 2 ]]; then
    pass "post-merge deletes only PR #88 scoped branches"
  else
    fail_test "post-merge expected 2 deletes, got ${deleted_count}; output: $out"
  fi
  if grep -q 'cursor/issue-84-pr-99' <<<"$out"; then
    fail_test "post-merge should not touch PR #99 branches"
  else
    pass "post-merge keeps other PR branches"
  fi
  cleanup
}

# Open PR guard: branch with open PR → skipped-open-pr
test_open_pr_guard() {
  setup
  export MOCK_REMOTE_BRANCHES=$'cursor/issue-84-pr-88-execute-agent-d96d'
  export MOCK_OPEN_PR_HEADS=$'cursor/issue-84-pr-88-execute-agent-d96d'
  export MOCK_MERGED_PRS="88"

  out="$("$SCRIPT" 88 2>&1)" || true
  if grep -q 'skipped-open-pr cursor/issue-84-pr-88-execute-agent-d96d' <<<"$out"; then
    pass "open PR guard skips branch"
  else
    fail_test "open PR guard expected skipped-open-pr; output: $out"
  fi
  if [[ ! -s "$MOCK_DELETE_CALLS_FILE" ]]; then
    pass "open PR guard made no delete calls"
  else
    fail_test "open PR guard should not delete"
  fi
  cleanup
}

# --dry-run: logs only, no delete calls
test_dry_run() {
  setup
  export MOCK_REMOTE_BRANCHES=$'cursor/issue-84-pr-88-execute-agent-d96d'
  export MOCK_MERGED_PRS="88"

  out="$("$SCRIPT" 88 --dry-run 2>&1)" || true
  if grep -q 'dry-run delete cursor/issue-84-pr-88-execute-agent-d96d' <<<"$out"; then
    pass "dry-run logs intended delete"
  else
    fail_test "dry-run expected dry-run delete log; output: $out"
  fi
  if [[ ! -s "$MOCK_DELETE_CALLS_FILE" ]]; then
    pass "dry-run made no delete calls"
  else
    fail_test "dry-run should not call delete API"
  fi
  cleanup
}

# --sweep-merged: deletes only when embedded PR is merged
test_sweep_merged() {
  setup
  export MOCK_REMOTE_BRANCHES=$'cursor/issue-84-pr-88-execute-agent-d96d\ncursor/issue-90-pr-94-demo-agent-31f7\ncursor/issue-91-pr-98-execute-agent-a78d'
  export MOCK_MERGED_PRS="88,94"

  out="$("$SCRIPT" --sweep-merged 2>&1)" || true
  if grep -q 'deleted cursor/issue-84-pr-88-execute-agent-d96d' <<<"$out" \
     && grep -q 'deleted cursor/issue-90-pr-94-demo-agent-31f7' <<<"$out"; then
    pass "sweep deletes branches for merged PRs"
  else
    fail_test "sweep expected deletes for merged PRs; output: $out"
  fi
  if grep -q 'deleted cursor/issue-91-pr-98' <<<"$out"; then
    fail_test "sweep should not delete branch for open PR #98"
  else
    pass "sweep keeps branches for non-merged PRs"
  fi
  cleanup
}

# Malformed names: cursor/fix-foo, cursor/issue-99-add-film → no match
test_malformed_names() {
  setup
  export MOCK_REMOTE_BRANCHES=$'cursor/fix-foo\ncursor/issue-99-add-film-to-watch-list\ncursor/issue-84-pr-88-execute-agent-d96d'
  export MOCK_MERGED_PRS="88"

  out="$("$SCRIPT" --sweep-merged 2>&1)" || true
  deleted_count="$(grep -c 'BRANCH: deleted ' <<<"$out" || true)"
  if [[ "$deleted_count" -eq 1 ]]; then
    pass "malformed names ignored"
  else
    fail_test "malformed names expected 1 delete, got ${deleted_count}; output: $out"
  fi
  cleanup
}

# Idempotent: second pass → all not-found, exit 0
test_idempotent() {
  setup
  export MOCK_REMOTE_BRANCHES=$'cursor/issue-84-pr-88-execute-agent-d96d'
  export MOCK_MERGED_PRS="88"

  "$SCRIPT" 88 >/dev/null
  out="$("$SCRIPT" 88 2>&1)" || true
  rc=$?
  if [[ "$rc" -eq 0 ]]; then
    pass "idempotent second pass exits 0"
  else
    fail_test "idempotent second pass expected exit 0, got $rc"
  fi
  if grep -q 'not-found cursor/issue-84-pr-88-execute-agent-d96d' <<<"$out"; then
    pass "idempotent second pass reports not-found"
  else
    fail_test "idempotent expected not-found; output: $out"
  fi
  cleanup
}

# --count-stale reports merged agent branches
test_count_stale() {
  setup
  export MOCK_REMOTE_BRANCHES=$'cursor/issue-84-pr-88-execute-agent-d96d\ncursor/issue-90-pr-94-demo-agent-31f7\ncursor/issue-91-pr-98-execute-agent-a78d'
  export MOCK_MERGED_PRS="88,94"

  count="$("$SCRIPT" --count-stale)"
  if [[ "$count" -eq 2 ]]; then
    pass "count-stale returns merged agent branch count"
  else
    fail_test "count-stale expected 2, got ${count}"
  fi
  cleanup
}

test_post_merge_pr_scope
test_open_pr_guard
test_dry_run
test_sweep_merged
test_malformed_names
test_idempotent
test_count_stale

if [[ "$fail" -ne 0 ]]; then
  echo "test-cursor-workflow-delete-stale-branches.sh: FAILED" >&2
  exit 1
fi

echo "test-cursor-workflow-delete-stale-branches.sh: all cases passed"
