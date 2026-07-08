#!/usr/bin/env bash
# Infer whether execute-ready should reopen execute or forward to demo.
# Usage: cursor-workflow-infer-reopen.sh <state-file> [prev-stage]
# stdout: reopen | forward
set -euo pipefail

STATE_FILE="${1:?}"
PREV_STAGE="${2:-}"

stage=$(jq -r '.stage // empty' "$STATE_FILE")
if [ "$stage" != "execute-ready" ]; then
  echo "forward"
  exit 0
fi

if [ "$PREV_STAGE" = "changes-requested" ]; then
  echo "reopen"
  exit 0
fi

agents_execute=$(jq -r '.agents.execute // empty' "$STATE_FILE")
agents_demo=$(jq -r '.agents.demo // empty' "$STATE_FILE")

if [ -n "$agents_execute" ] && [ "$agents_execute" != "null" ] && \
   [ -n "$agents_demo" ] && [ "$agents_demo" != "null" ]; then
  echo "reopen"
  exit 0
fi

BRANCH=$(jq -r '.branch // empty' "$STATE_FILE")
ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
REL_PATH="workflow/issues/issue-${ISSUE}/workflow.state.json"

if [ -n "$BRANCH" ] && [ -n "$ISSUE" ] && git rev-parse --git-dir >/dev/null 2>&1; then
  while IFS= read -r sha; do
    [ -z "$sha" ] && continue
    prev_stage_in_commit=$(git show "${sha}:${REL_PATH}" 2>/dev/null | jq -r '.stage // empty' || true)
    if [ "$prev_stage_in_commit" = "changes-requested" ]; then
      echo "reopen"
      exit 0
    fi
  done < <(git log -10 --format=%H "origin/${BRANCH}" -- "$REL_PATH" 2>/dev/null || true)
fi

echo "forward"
