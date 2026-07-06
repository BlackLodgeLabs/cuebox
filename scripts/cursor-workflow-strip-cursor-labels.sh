#!/usr/bin/env bash
# Remove all cursor:* workflow labels from a GitHub issue.
# Usage: cursor-workflow-strip-cursor-labels.sh <issue-number>
# Requires: gh, GH_TOKEN or GITHUB_TOKEN
set -euo pipefail

ISSUE="${1:?usage: cursor-workflow-strip-cursor-labels.sh <issue-number>}"
REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$GH_TOKEN" ]]; then
  echo "GH_TOKEN or GITHUB_TOKEN required" >&2
  exit 1
fi
export GH_TOKEN

CURSOR_LABELS=(
  cursor:spec-needs-info cursor:spec-in-progress cursor:spec-ready
  cursor:plan-needs-info cursor:plan-in-progress cursor:plan-ready
  cursor:execute-in-progress cursor:execute-ready cursor:execute-passback
  cursor:changes-requested cursor:demo-in-progress cursor:demo-ready
  cursor:create-pr-in-progress cursor:create-pr-ready cursor:babysit-in-progress
  cursor:complete cursor:blocked
)

remove_args=()
for label in "${CURSOR_LABELS[@]}"; do
  remove_args+=(--remove-label "$label")
done

# gh issue edit accepts only one --remove-label per flag; comma-separated values do not work.
gh issue edit "$ISSUE" --repo "$REPO" "${remove_args[@]}" 2>/dev/null || true
echo "Stripped cursor labels from issue #${ISSUE}"
