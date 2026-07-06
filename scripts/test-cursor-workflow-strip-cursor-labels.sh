#!/usr/bin/env bash
# Verify cursor-workflow-strip-cursor-labels.sh builds per-label --remove-label args.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/cursor-workflow-strip-cursor-labels.sh"

label_count="$(grep -oE 'cursor:[a-z0-9-]+' "$SCRIPT" | sort -u | wc -l | tr -d '[:space:]')"
if [[ "$label_count" -lt 17 ]]; then
  echo "FAIL: expected 17 unique cursor:* labels in strip-cursor-labels.sh, got ${label_count}" >&2
  exit 1
fi

if ! grep -q 'remove_args+=(--remove-label' "$SCRIPT"; then
  echo "FAIL: strip-cursor-labels.sh must build remove_args with --remove-label per label" >&2
  exit 1
fi

if grep -q 'LABELS_CSV\|IFS=,' "$SCRIPT"; then
  echo "FAIL: strip-cursor-labels.sh must not use comma-separated --remove-label" >&2
  exit 1
fi

echo "PASS: strip-cursor-labels uses per-label --remove-label flags"
echo "test-cursor-workflow-strip-cursor-labels.sh: all cases passed"
