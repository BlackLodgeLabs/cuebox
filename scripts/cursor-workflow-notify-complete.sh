#!/usr/bin/env bash
# Post a one-time @mention on the issue and assign the PR when stage is complete.
# Idempotent via HTML comment marker. Cloud agents cannot post issue comments reliably.
set -euo pipefail

MARKER="<!-- cursor-workflow-complete-notify:v1 -->"

STATE_FILE="${1:?usage: cursor-workflow-notify-complete.sh <path-to-workflow.state.json>}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
PR=$(jq -r '.pr // empty' "$STATE_FILE")
STAGE=$(jq -r '.stage // empty' "$STATE_FILE")
BRANCH=$(jq -r '.branch // empty' "$STATE_FILE")

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

if [ "$STAGE" != "complete" ]; then
  exit 0
fi

if [ -z "$ISSUE" ]; then
  echo "State file missing issue number" >&2
  exit 1
fi

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$GH_TOKEN" ]; then
  echo "GH_TOKEN or GITHUB_TOKEN not set" >&2
  exit 1
fi
export GH_TOKEN

already=$(gh api "repos/${REPO}/issues/${ISSUE}/comments" --paginate \
  | jq -r --arg m "$MARKER" '[.[] | select(.body != null and (.body | contains($m)))] | length')
if [ "${already:-0}" != "0" ]; then
  echo "Complete notification already posted on issue #${ISSUE}"
  exit 0
fi

AUTHOR=$(gh issue view "$ISSUE" --repo "$REPO" --json author -q '.author.login')
if [ -z "$AUTHOR" ] || [ "$AUTHOR" = "null" ]; then
  echo "Could not resolve issue author for #${ISSUE}" >&2
  exit 1
fi

PR_LINE="The linked pull request is ready for your final review."
if [ -n "$PR" ] && [ "$PR" != "null" ]; then
  PR_LINE="**[PR #${PR}](https://github.com/${REPO}/pull/${PR})** is ready for your final review."
fi

BODY="${MARKER}
@${AUTHOR} The cursor workflow for issue #${ISSUE} is complete — ${PR_LINE}

Branch: \`${BRANCH:-—}\` · Label: \`cursor:complete\`

_Demo notes and PR summary are on the pull request. This notification is posted once by GitHub Actions._"

gh issue comment "$ISSUE" --repo "$REPO" --body "$BODY"
echo "Posted complete notification on issue #${ISSUE} for @${AUTHOR}"

if [ -n "$PR" ] && [ "$PR" != "null" ]; then
  if gh pr edit "$PR" --repo "$REPO" --add-assignee "$AUTHOR" 2>/dev/null; then
    echo "Assigned PR #${PR} to @${AUTHOR}"
  else
    echo "::warning::Could not assign PR #${PR} to @${AUTHOR} (permissions or assignee rules)"
  fi
fi
