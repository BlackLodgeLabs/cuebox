#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXTRACT="$ROOT/scripts/cursor-workflow-linked-issues-from-text.sh"
chmod +x "$EXTRACT"

mapfile -t WITH < <(printf 'Closes #72\nFixes #28\n' | bash "$EXTRACT")
if [[ "${#WITH[@]}" -ne 2 ]] || [[ "${WITH[0]}" != "28" ]] || [[ "${WITH[1]}" != "72" ]]; then
  echo "FAIL: expected issues 28 and 72, got: ${WITH[*]:-empty}" >&2
  exit 1
fi
echo "PASS: extracts Closes/Fixes issue numbers"

mapfile -t NONE < <(printf 'No issue keywords here\n' | bash "$EXTRACT")
if [[ "${#NONE[@]}" -ne 0 ]]; then
  echo "FAIL: expected no issues, got: ${NONE[*]}" >&2
  exit 1
fi
echo "PASS: empty body does not fail under pipefail"

echo "test-cursor-workflow-linked-issues.sh: all cases passed"
