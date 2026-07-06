#!/usr/bin/env bash
# Remove all cursor:* labels from issues linked to a merged PR (Closes/Fixes #N in body).
# Usage: cursor-workflow-strip-labels-from-pr.sh <pr-number>
set -euo pipefail

PR="${1:?usage: cursor-workflow-strip-labels-from-pr.sh <pr-number>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$GH_TOKEN" ]]; then
  echo "GH_TOKEN or GITHUB_TOKEN required" >&2
  exit 1
fi
export GH_TOKEN

BODY="$(gh pr view "$PR" --repo "$REPO" --json body -q .body 2>/dev/null || echo "")"

mapfile -t ISSUES < <(printf '%s\n' "$BODY" | bash "$ROOT/scripts/cursor-workflow-linked-issues-from-text.sh")

if [[ ${#ISSUES[@]} -eq 0 ]]; then
  echo "No Closes/Fixes issue references in PR #${PR}"
  exit 0
fi

for issue in "${ISSUES[@]}"; do
  echo "Stripping cursor labels from issue #${issue} (PR #${PR})"
  bash "$ROOT/scripts/cursor-workflow-strip-cursor-labels.sh" "$issue"
done

echo "Done."
