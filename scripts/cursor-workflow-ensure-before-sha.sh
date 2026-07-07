#!/usr/bin/env bash
# Ensure github.event.before is present in the checkout for shallow clones.
# Usage: cursor-workflow-ensure-before-sha.sh <before-sha>
set -euo pipefail

BEFORE_SHA="${1:?usage: cursor-workflow-ensure-before-sha.sh <before-sha>}"

if [ "$BEFORE_SHA" = "0000000000000000000000000000000000000000" ]; then
  exit 0
fi

if git cat-file -e "${BEFORE_SHA}" 2>/dev/null; then
  exit 0
fi

echo "Fetching missing BEFORE_SHA ${BEFORE_SHA} (shallow checkout)"
if git fetch --depth=1 origin "${BEFORE_SHA}" 2>/dev/null; then
  exit 0
fi
if git fetch origin "${BEFORE_SHA}" 2>/dev/null; then
  exit 0
fi

echo "::warning::Could not fetch BEFORE_SHA ${BEFORE_SHA}"
exit 0
