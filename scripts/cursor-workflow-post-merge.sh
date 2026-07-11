#!/usr/bin/env bash
# Post-merge workflow cleanup: strip cursor labels and archive workflow artifacts on main.
# Usage: cursor-workflow-post-merge.sh <pr-number>
set -euo pipefail

PR="${1:?usage: cursor-workflow-post-merge.sh <pr-number>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash "$ROOT/scripts/cursor-workflow-strip-labels-from-pr.sh" "$PR"

bash "$ROOT/scripts/cursor-workflow-delete-stale-branches.sh" "$PR"

REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
BODY="$(gh pr view "$PR" --repo "$REPO" --json body -q .body 2>/dev/null || echo "")"

mapfile -t ISSUES < <(printf '%s\n' "$BODY" | bash "$ROOT/scripts/cursor-workflow-linked-issues-from-text.sh")

if [[ ${#ISSUES[@]} -eq 0 ]]; then
  echo "No issues to archive for PR #${PR}"
  exit 0
fi

ARCHIVED=0
for issue in "${ISSUES[@]}"; do
  if [[ -d "workflow/issues/issue-${issue}" ]]; then
    bash "$ROOT/scripts/cursor-workflow-archive-completed-issue.sh" "$issue" --no-commit
    ARCHIVED=$((ARCHIVED + 1))
  fi
done

if [[ "$ARCHIVED" -gt 0 ]]; then
  if ! git diff --quiet --cached; then
    git -c user.name="${GIT_AUTHOR_NAME:-github-actions[bot]}" \
        -c user.email="${GIT_AUTHOR_EMAIL:-github-actions[bot]@users.noreply.github.com}" \
        commit -m "chore(workflow): archive artifacts for PR #${PR} post-merge"
    git push origin HEAD
    echo "Archived ${ARCHIVED} issue folder(s) from PR #${PR}"
  else
    echo "No changes staged to commit for PR #${PR}"
  fi
else
  echo "No workflow folders to archive for PR #${PR}"
fi
