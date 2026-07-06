#!/usr/bin/env bash
# Remove all cursor:* workflow labels from a GitHub issue.
# Usage: cursor-workflow-strip-cursor-labels.sh <issue-number>
# Requires: gh, GH_TOKEN or GITHUB_TOKEN
set -euo pipefail

ISSUE="${1:?usage: cursor-workflow-strip-cursor-labels.sh <issue-number>}"

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$GH_TOKEN" ]]; then
  echo "GH_TOKEN or GITHUB_TOKEN required" >&2
  exit 1
fi
export GH_TOKEN

REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

mapfile -t ON_ISSUE < <(gh issue view "$ISSUE" --repo "$REPO" --json labels -q '.labels[].name' | grep '^cursor:' || true)

if [[ ${#ON_ISSUE[@]} -eq 0 ]]; then
  echo "No cursor labels on issue #${ISSUE}"
  exit 0
fi

for label in "${ON_ISSUE[@]}"; do
  if ! gh issue edit "$ISSUE" --repo "$REPO" --remove-label "$label"; then
    echo "Warning: could not remove ${label} from issue #${ISSUE}" >&2
  fi
done
echo "Stripped cursor labels from issue #${ISSUE}"
