#!/usr/bin/env bash
# Post a deferral comment on the issue at most once per 30 minutes.
# Usage: cursor-workflow-post-deferral-comment.sh <issue> <reason>
set -euo pipefail

ISSUE="${1:?usage: cursor-workflow-post-deferral-comment.sh <issue> <reason>}"
REASON="${2:?}"

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
WINDOW_MINUTES="${CURSOR_WORKFLOW_DEFERRAL_COMMENT_MINUTES:-30}"

if [ -z "${GH_TOKEN:-}" ] && [ -z "${CURSOR_HANDOFF_GITHUB_TOKEN:-}" ]; then
  echo "No GitHub token available for deferral comment" >&2
  exit 0
fi

if [ -n "${CURSOR_HANDOFF_GITHUB_TOKEN:-}" ]; then
  echo "${CURSOR_HANDOFF_GITHUB_TOKEN}" | gh auth login --with-token 2>/dev/null || true
fi

marker="<!-- cursor-workflow-deferral -->"
body="Cursor workflow handoff deferred (${REASON}). Will retry on the next push or workflow_dispatch. ${marker}"

now_epoch=$(date -u +%s)
recent=false
while IFS= read -r created; do
  [ -z "$created" ] && continue
  created_epoch=$(date -u -d "$created" +%s 2>/dev/null || echo 0)
  age=$(( (now_epoch - created_epoch) / 60 ))
  if [ "$age" -lt "$WINDOW_MINUTES" ]; then
    recent=true
    break
  fi
done < <(gh api "repos/${REPO}/issues/${ISSUE}/comments" --jq '.[] | select(.body | contains("cursor-workflow-deferral")) | .created_at' 2>/dev/null || true)

if [ "$recent" = "true" ]; then
  echo "Deferral comment already posted within ${WINDOW_MINUTES}m — skipping"
  exit 0
fi

gh issue comment "$ISSUE" --repo "$REPO" --body "$body"
echo "Posted deferral comment on issue #${ISSUE}"
