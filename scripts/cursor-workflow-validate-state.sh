#!/usr/bin/env bash
# Validate workflow.state.json against the v1 schema contract.
# Usage: cursor-workflow-validate-state.sh <path-to-workflow.state.json>
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-validate-state.sh <path-to-workflow.state.json>}"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "FAIL: state file not found: $STATE_FILE" >&2
  exit 1
fi

if ! jq empty "$STATE_FILE" 2>/dev/null; then
  echo "FAIL: invalid JSON in ${STATE_FILE}" >&2
  exit 1
fi

fail=0
REQUIRED_KEYS=(issue branch stage agents loops)
for key in "${REQUIRED_KEYS[@]}"; do
  if ! jq -e --arg k "$key" 'has($k)' "$STATE_FILE" >/dev/null 2>&1; then
    echo "FAIL: ${STATE_FILE} missing required key: ${key}" >&2
    fail=1
  fi
done

if ! jq -e '.agents | type == "object"' "$STATE_FILE" >/dev/null 2>&1; then
  echo "FAIL: ${STATE_FILE} agents must be an object" >&2
  fail=1
fi

for counter in bugbot ci_autofix total_runs; do
  if ! jq -e --arg c "$counter" '.loops | has($c)' "$STATE_FILE" >/dev/null 2>&1; then
    echo "FAIL: ${STATE_FILE} loops missing counter: ${counter}" >&2
    fail=1
  fi
done

version="$(jq -r '.schema_version // 1' "$STATE_FILE")"
if [[ "$version" != "1" ]]; then
  echo "FAIL: ${STATE_FILE} unsupported schema_version: ${version}" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: ${STATE_FILE} valid (schema_version=${version})"
