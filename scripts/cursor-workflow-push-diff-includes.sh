#!/usr/bin/env bash
# Detect whether any file matching pattern changed in a push range (BEFORE_SHA..AFTER_SHA).
# Usage: cursor-workflow-push-diff-includes.sh <before_sha> <after_sha> <grep_mode> <pattern>
#   grep_mode: -E (regex) or -F (fixed string)
# Exit 0 if a matching file changed; exit 1 otherwise.
set -euo pipefail

BEFORE_SHA="${1:?usage: cursor-workflow-push-diff-includes.sh <before_sha> <after_sha> <grep_mode> <pattern>}"
AFTER_SHA="${2:?usage: cursor-workflow-push-diff-includes.sh <before_sha> <after_sha> <grep_mode> <pattern>}"
GREP_MODE="${3:?usage: cursor-workflow-push-diff-includes.sh <before_sha> <after_sha> <grep_mode> <pattern>}"
PATTERN="${4:?usage: cursor-workflow-push-diff-includes.sh <before_sha> <after_sha> <grep_mode> <pattern>}"

ZERO_SHA="0000000000000000000000000000000000000000"

if [ "$BEFORE_SHA" = "$ZERO_SHA" ]; then
  if git diff-tree --no-commit-id --name-only -r "$AFTER_SHA" | grep -q "$GREP_MODE" "$PATTERN"; then
    exit 0
  fi
  exit 1
fi

if git cat-file -e "${BEFORE_SHA}" 2>/dev/null; then
  if git diff --name-only "$BEFORE_SHA" "$AFTER_SHA" | grep -q "$GREP_MODE" "$PATTERN"; then
    exit 0
  fi
  exit 1
fi

echo "::warning::BEFORE_SHA ${BEFORE_SHA} unavailable — checking AFTER_SHA commit only"
if git diff-tree --no-commit-id --name-only -r "$AFTER_SHA" | grep -q "$GREP_MODE" "$PATTERN"; then
  exit 0
fi
exit 1
