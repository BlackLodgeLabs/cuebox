#!/usr/bin/env bash
# Verify cursor-workflow-strip-cursor-labels.sh removes labels one at a time (not CSV).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/cursor-workflow-strip-cursor-labels.sh"

if ! grep -q 'gh issue view.*labels' "$SCRIPT"; then
  echo "FAIL: strip-cursor-labels.sh must read cursor:* labels from the issue" >&2
  exit 1
fi

if ! grep -q 'for label in' "$SCRIPT" || ! grep -q -- '--remove-label "$label"' "$SCRIPT"; then
  echo "FAIL: strip-cursor-labels.sh must remove each label with --remove-label in a loop" >&2
  exit 1
fi

if grep -q 'LABELS_CSV\|IFS=,' "$SCRIPT"; then
  echo "FAIL: strip-cursor-labels.sh must not use comma-separated --remove-label" >&2
  exit 1
fi

echo "PASS: strip-cursor-labels uses per-label --remove-label flags"
echo "test-cursor-workflow-strip-cursor-labels.sh: all cases passed"
