#!/usr/bin/env bash
# Find or create a draft PR for a cursor/issue-* workflow branch. Uses gh (GITHUB_TOKEN).
# Prints the PR number to stdout.
set -euo pipefail

ISSUE="${1:?usage: cursor-workflow-ensure-draft-pr.sh <issue> <branch>}"
BRANCH="${2:?}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

if [ -z "${GH_TOKEN:-}" ]; then
  echo "GH_TOKEN not set" >&2
  exit 1
fi

EXISTING=$(gh pr list --repo "$REPO" --head "$BRANCH" --state all --json number,state -q \
  '[.[] | select(.state == "OPEN" or .state == "DRAFT")][0].number // empty')

if [ -n "$EXISTING" ]; then
  echo "Found existing PR #${EXISTING} for ${BRANCH}" >&2
  echo "$EXISTING"
  exit 0
fi

TITLE=$(gh issue view "$ISSUE" --repo "$REPO" --json title -q '.title')
SPEC_PATH="documents/specs/issue-${ISSUE}.md"
PLAN_PATH="documents/plans/issue-${ISSUE}.md"
DEMO_PATH="demos/issue-${ISSUE}/"

BODY=$(cat <<EOF
## Cursor workflow — Issue #${ISSUE}

Automated draft PR for the [Cursor issue workflow](https://github.com/${REPO}/blob/main/documents/cursor-workflow/WORKFLOW.md).

| Artifact | Path |
|----------|------|
| Issue | #${ISSUE} |
| Branch | \`${BRANCH}\` |
| Spec | \`${SPEC_PATH}\` |
| Plan | \`${PLAN_PATH}\` (when planning completes) |
| Demo | \`${DEMO_PATH}\` |

**Status:** pipeline in progress. Do not merge until \`cursor:complete\` and human review.

Related to #${ISSUE}
EOF
)

PR_NUM=$(gh pr create --repo "$REPO" \
  --base main \
  --head "$BRANCH" \
  --draft \
  --title "Issue #${ISSUE}: ${TITLE}" \
  --body "$BODY" | sed -n 's|.*/pull/\([0-9]*\).*|\1|p')

if [ -z "$PR_NUM" ]; then
  # gh sometimes prints only the URL on stdout
  PR_NUM=$(gh pr list --repo "$REPO" --head "$BRANCH" --json number -q '.[0].number')
fi

if [ -z "$PR_NUM" ]; then
  echo "Failed to create or resolve PR for ${BRANCH}" >&2
  exit 1
fi

echo "Created draft PR #${PR_NUM} for issue #${ISSUE}" >&2
echo "$PR_NUM"
