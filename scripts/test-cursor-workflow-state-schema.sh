#!/usr/bin/env bash
# Offline unit tests for workflow.state.json schema v1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
pass() { echo "PASS: $1"; }
fail_test() { echo "FAIL: $1" >&2; fail=1; }

TEMPLATE="workflow/cursor-workflow/templates/workflow.state.json"
MIGRATE="scripts/cursor-workflow-migrate-state.sh"
VALIDATE="scripts/cursor-workflow-validate-state.sh"

# Template includes schema_version
if jq -e '.schema_version == 1' "$TEMPLATE" >/dev/null 2>&1; then
  pass "template has schema_version 1"
else
  fail_test "template missing schema_version 1"
fi

if bash "$VALIDATE" "$TEMPLATE"; then
  pass "template validates"
else
  fail_test "template validation failed"
fi

# Missing schema_version defaults to 1 in validate
FIXTURE="$(mktemp)"
trap 'rm -f "$FIXTURE" "${FIXTURE}.bak"' EXIT
jq 'del(.schema_version)' "$TEMPLATE" > "$FIXTURE"
if bash "$VALIDATE" "$FIXTURE"; then
  pass "missing schema_version treated as v1"
else
  fail_test "missing schema_version should default to 1"
fi

# Migrate is idempotent
bash "$MIGRATE" "$FIXTURE"
if jq -e '.schema_version == 1' "$FIXTURE" >/dev/null 2>&1; then
  pass "migrate adds schema_version 1"
else
  fail_test "migrate did not set schema_version"
fi
cp "$FIXTURE" "${FIXTURE}.v1"
second_run="$(bash "$MIGRATE" "$FIXTURE" 2>&1)"
if grep -q 'No migration needed' <<<"$second_run"; then
  pass "migrate idempotent on v1"
else
  fail_test "second migrate should no-op"
fi
if diff -q "$FIXTURE" "${FIXTURE}.v1" >/dev/null 2>&1; then
  pass "migrate does not alter v1 file"
else
  fail_test "migrate should not change file when already v1"
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: cursor-workflow-state-schema"
