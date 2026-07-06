#!/usr/bin/env bash
# Remove all cursor:* labels from issues linked to a merged PR (Closes/Fixes #N in body).
# Usage: cursor-workflow-strip-labels-from-pr.sh <pr-number>
set -euo pipefail

PR="${1:?usage: cursor-workflow-strip-labels-from-pr.sh <pr-number>}"
REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$GH_TOKEN" ]]; then
  echo "GH_TOKEN or GITHUB_TOKEN required" >&2
  exit 1
fi
export GH_TOKEN

BODY="$(gh pr view "$PR" --repo "$REPO" --json body -q .body 2>/dev/null || echo "")"

mapfile -t ISSUES < <(printf '%s\n' "$BODY" | grep -oiE '(close[sd]?|fixe[sd]?)\s+#([0-9]+)' | grep -oiE '#[0-9]+' | tr -d '#' | sort -nu)

if [[ ${#ISSUES[@]} -eq 0 ]]; then
  echo "No Closes/Fixes issue references in PR #${PR}"
  exit 0
fi

CURSOR_LABELS=(
  cursor:spec-needs-info cursor:spec-in-progress cursor:spec-ready
  cursor:plan-needs-info cursor:plan-in-progress cursor:plan-ready
  cursor:execute-in-progress cursor:execute-ready cursor:execute-passback
  cursor:changes-requested cursor:demo-in-progress cursor:demo-ready
  cursor:create-pr-in-progress cursor:create-pr-ready cursor:babysit-in-progress
  cursor:complete cursor:blocked
)

for issue in "${ISSUES[@]}"; do
  echo "Stripping cursor labels from issue #${issue} (PR #${PR})"
  for label in "${CURSOR_LABELS[@]}"; do
    gh issue edit "$issue" --repo "$REPO" --remove-label "$label" 2>/dev/null || true
  done
done

echo "Done."
