#!/usr/bin/env bash
# Fail if legacy workflow paths reappear after consolidation under workflow/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LEGACY_DIRS=(
  documents/cursor-workflow
  documents/specs
  documents/plans
  demos
)

for dir in "${LEGACY_DIRS[@]}"; do
  if [[ -e "$dir" ]]; then
    echo "FAIL: legacy directory still exists: $dir" >&2
    exit 1
  fi
done

PATTERNS=(
  'documents/cursor-workflow/'
  'documents/specs/'
  'documents/plans/'
  'demos/issue-'
  'workflow-state\.json'
)

EXCLUDE='^(workflow/README\.md|scripts/verify-workflow-paths\.sh)$'
fail=0

while IFS= read -r -d '' file; do
  [[ "$file" =~ $EXCLUDE ]] && continue
  for pattern in "${PATTERNS[@]}"; do
    if grep -E "$pattern" "$file" >/dev/null 2>&1; then
      echo "FAIL: $file contains legacy pattern: $pattern" >&2
      fail=1
    fi
  done
done < <(git ls-files -z '*.md' '*.yml' '*.yaml' '*.json' '*.sh')

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: no legacy workflow paths found"
