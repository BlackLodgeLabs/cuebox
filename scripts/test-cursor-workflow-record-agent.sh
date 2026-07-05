#!/usr/bin/env bash
# Regression tests for cursor-workflow-record-agent-on-branch.sh (spawn pre-update vs remote).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RECORD="$ROOT/scripts/cursor-workflow-record-agent-on-branch.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fail=0
pass() { echo "PASS: $1"; }
fail_test() { echo "FAIL: $1" >&2; fail=1; }

setup_repo() {
  local suffix="${1:?setup_repo suffix}"
  REMOTE="$TMP/remote-${suffix}.git"
  WORKDIR="$TMP/work-${suffix}"
  BRANCH="cursor/issue-99-test"
  ISSUE=99
  REL_PATH="workflow/issues/issue-${ISSUE}/workflow.state.json"
  AGENT_ID="bc-spawned-agent"

  git init --bare "$REMOTE" >/dev/null 2>&1
  git clone "$REMOTE" "$WORKDIR" >/dev/null 2>&1
  cd "$WORKDIR"
  git config user.name "test"
  git config user.email "test@test"
  git checkout -b main
  mkdir -p "$(dirname "$REL_PATH")"
  cat > "$REL_PATH" <<'EOF'
{
  "issue": 99,
  "branch": "cursor/issue-99-test",
  "stage": "create-pr-ready",
  "agents": { "babysit-pr": null },
  "loops": { "bugbot": 0, "ci_autofix": 0, "total_runs": 0 }
}
EOF
  git add "$REL_PATH"
  git commit -m "init workflow state" >/dev/null
  git branch "$BRANCH"
  git push -u origin main "$BRANCH" >/dev/null
}

# spawn-agent updates local state before record-agent; remote slot may still be null.
test_push_when_local_preupdated() {
  setup_repo "push"
  local local_state
  local_state=$(mktemp)
  cat > "$local_state" <<EOF
{
  "issue": 99,
  "branch": "cursor/issue-99-test",
  "stage": "create-pr-ready",
  "agents": { "babysit-pr": "${AGENT_ID}" },
  "active_agent_id": "${AGENT_ID}",
  "loops": { "bugbot": 0, "ci_autofix": 0, "total_runs": 0 }
}
EOF

  bash "$RECORD" "$local_state" "babysit-pr" "$AGENT_ID" "$BRANCH" >/tmp/record-agent-push.log 2>&1

  git fetch origin "$BRANCH" >/dev/null
  git checkout "$BRANCH" >/dev/null 2>&1
  recorded=$(jq -r '.agents["babysit-pr"]' "$REL_PATH")
  if [ "$recorded" = "$AGENT_ID" ]; then
    pass "record-agent pushes ID when remote slot is null but local pre-updated"
  else
    fail_test "expected agents.babysit-pr=${AGENT_ID} on branch, got ${recorded}"
  fi
  rm -f "$local_state"
}

# When remote already has the same ID, skip without error.
test_idempotent_remote_match() {
  setup_repo "idempotent"
  local local_state
  local_state=$(mktemp)
  cat > "$local_state" <<EOF
{
  "issue": 99,
  "branch": "cursor/issue-99-test",
  "stage": "babysit-in-progress",
  "agents": { "babysit-pr": "${AGENT_ID}" },
  "active_agent_id": "${AGENT_ID}",
  "loops": { "bugbot": 0, "ci_autofix": 0, "total_runs": 0 }
}
EOF

  git checkout "$BRANCH" >/dev/null 2>&1
  jq --arg id "$AGENT_ID" '.agents["babysit-pr"] = $id | .active_agent_id = $id' \
    "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"
  git add "$REL_PATH"
  git commit -m "record babysit agent" >/dev/null
  git push origin "$BRANCH" >/dev/null

  if bash "$RECORD" "$local_state" "babysit-pr" "$AGENT_ID" "$BRANCH" >/tmp/record-agent-idempotent.log 2>&1; then
    if grep -q "Agent already recorded" /tmp/record-agent-idempotent.log; then
      pass "record-agent idempotent when remote already has agent ID"
    else
      fail_test "expected idempotent skip message"
    fi
  else
    fail_test "record-agent should exit 0 when remote already matches"
  fi
  rm -f "$local_state"
}

test_push_when_local_preupdated
test_idempotent_remote_match

if [ "$fail" -ne 0 ]; then
  echo "test-cursor-workflow-record-agent.sh: FAILED" >&2
  exit 1
fi

echo "test-cursor-workflow-record-agent.sh: all cases passed"
