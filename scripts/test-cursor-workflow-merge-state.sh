#!/usr/bin/env bash
# Fixture tests for cursor-workflow-merge-state.sh preservation semantics.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MERGE="$ROOT/scripts/cursor-workflow-merge-state.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

failures=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS: $desc"
  else
    echo "FAIL: $desc (expected '$expected', got '$actual')" >&2
    failures=$((failures + 1))
  fi
}

run_merge() {
  local local_json="$1" remote_json="$2" outfile="$3"
  printf '%s\n' "$local_json" > "$outfile"
  MERGE_STATE_REMOTE_JSON="$remote_json" bash "$MERGE" "$outfile"
}

# Case 1: local updates stage only — remote agents.execute preserved
STATE="$TMP/case1.json"
run_merge \
  '{"issue":1,"branch":"cursor/issue-1-test","stage":"execute-in-progress","active_skill":"execute","updated_at":"2026-01-02T00:00:00Z","agents":{"execute":null},"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' \
  '{"issue":1,"branch":"cursor/issue-1-test","stage":"plan-ready","agents":{"execute":"bc-exec-123","planning":"bc-plan-456"},"pr":42,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":2}}' \
  "$STATE"
assert_eq "case1 stage" "execute-in-progress" "$(jq -r '.stage' "$STATE")"
assert_eq "case1 agents.execute" "bc-exec-123" "$(jq -r '.agents.execute' "$STATE")"
assert_eq "case1 pr" "42" "$(jq -r '.pr' "$STATE")"

# Case 2: local sets agents.planning to new ID — new ID wins
STATE="$TMP/case2.json"
run_merge \
  '{"issue":2,"branch":"cursor/issue-2-test","stage":"plan-in-progress","agents":{"planning":"bc-new-plan"},"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' \
  '{"issue":2,"branch":"cursor/issue-2-test","agents":{"planning":"bc-old-plan"},"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' \
  "$STATE"
assert_eq "case2 agents.planning" "bc-new-plan" "$(jq -r '.agents.planning' "$STATE")"

# Case 3: local passback_to null — remote passback_to preserved
STATE="$TMP/case3.json"
run_merge \
  '{"issue":3,"branch":"cursor/issue-3-test","stage":"execute-in-progress","passback_to":null,"passback_reason":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' \
  '{"issue":3,"branch":"cursor/issue-3-test","passback_to":"execute","passback_reason":"demo found bug","loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' \
  "$STATE"
assert_eq "case3 passback_to" "execute" "$(jq -r '.passback_to' "$STATE")"
assert_eq "case3 passback_reason" "demo found bug" "$(jq -r '.passback_reason' "$STATE")"

# Case 4: local passback_to execute + reason — local wins
STATE="$TMP/case4.json"
run_merge \
  '{"issue":4,"branch":"cursor/issue-4-test","stage":"execute-passback","passback_to":"execute","passback_reason":"fix pagination","loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' \
  '{"issue":4,"branch":"cursor/issue-4-test","passback_to":null,"passback_reason":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' \
  "$STATE"
assert_eq "case4 passback_to" "execute" "$(jq -r '.passback_to' "$STATE")"
assert_eq "case4 passback_reason" "fix pagination" "$(jq -r '.passback_reason' "$STATE")"

# Case 6: local loops stale — remote higher total_runs preserved via max merge
STATE="$TMP/case6.json"
run_merge \
  '{"issue":6,"branch":"cursor/issue-6-test","stage":"babysit-in-progress","loops":{"bugbot":0,"ci_autofix":0,"total_runs":3}}' \
  '{"issue":6,"branch":"cursor/issue-6-test","loops":{"bugbot":1,"ci_autofix":0,"total_runs":5}}' \
  "$STATE"
assert_eq "case6 loops.total_runs" "5" "$(jq -r '.loops.total_runs' "$STATE")"
assert_eq "case6 loops.bugbot" "1" "$(jq -r '.loops.bugbot' "$STATE")"

INVALID="$TMP/invalid.json"
echo 'not json' > "$INVALID"
if MERGE_STATE_REMOTE_JSON='{}' bash "$MERGE" "$INVALID" 2>/dev/null; then
  echo "FAIL: case5 invalid JSON should exit non-zero" >&2
  failures=$((failures + 1))
else
  echo "PASS: case5 invalid JSON exits non-zero"
fi

if [ "$failures" -ne 0 ]; then
  echo "${failures} test(s) failed" >&2
  exit 1
fi

echo "All merge-state tests passed"
