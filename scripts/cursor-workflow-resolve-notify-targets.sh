#!/usr/bin/env bash
# Resolve @mention targets for workflow notifications (issue author + repo owner).
# Usage: cursor-workflow-resolve-notify-targets.sh <issue-number> [--json]
set -euo pipefail

ISSUE="${1:?usage: cursor-workflow-resolve-notify-targets.sh <issue-number> [--json]}"
JSON_OUTPUT=false
if [ "${2:-}" = "--json" ]; then
  JSON_OUTPUT=true
fi

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$GH_TOKEN" ]; then
  echo "GH_TOKEN or GITHUB_TOKEN not set" >&2
  exit 1
fi
export GH_TOKEN

AUTHOR=$(gh issue view "$ISSUE" --repo "$REPO" --json author -q '.author.login' 2>/dev/null || true)
if [ -z "$AUTHOR" ] || [ "$AUTHOR" = "null" ]; then
  echo "Could not resolve issue author for #${ISSUE}" >&2
  exit 1
fi

OWNER=""
if ! OWNER=$(gh api "repos/${REPO}" --jq '.owner.login' 2>/dev/null); then
  echo "::warning::Could not resolve repo owner for ${REPO} — mentioning author only" >&2
  OWNER=""
fi

if [ -n "$OWNER" ] && [ "$OWNER" != "null" ] && [ "$AUTHOR" != "$OWNER" ]; then
  MENTIONS="@${AUTHOR} @${OWNER}"
else
  MENTIONS="@${AUTHOR}"
fi

if [ "$JSON_OUTPUT" = "true" ]; then
  jq -n \
    --arg author "$AUTHOR" \
    --arg owner "${OWNER:-}" \
    --arg mentions "$MENTIONS" \
    '{author: $author, owner: $owner, mentions: $mentions}'
else
  printf 'AUTHOR=%s\n' "$AUTHOR"
  printf 'OWNER=%s\n' "$OWNER"
  printf 'MENTIONS=%q\n' "$MENTIONS"
fi
