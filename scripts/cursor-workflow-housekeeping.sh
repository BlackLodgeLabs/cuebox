#!/usr/bin/env bash
# Report workflow/repo hygiene drift. Exit 1 when actionable items found.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/cursor-workflow-config.sh"
cd "$ROOT"

FOUND=0
REPO="${GITHUB_REPOSITORY:-}"

if [[ -z "$REPO" ]] && command -v gh >/dev/null 2>&1; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
fi

report() {
  echo "HOUSEKEEPING: $*"
  FOUND=1
}

echo "=== Cuebox workflow housekeeping ==="

# workflow folders on main where state is complete (candidate for archive)
for state in workflow/issues/issue-*/workflow.state.json; do
  [[ -f "$state" ]] || continue
  stage="$(jq -r '.stage // empty' "$state")"
  issue="$(jq -r '.issue // empty' "$state")"
  if [[ "$stage" == "complete" ]]; then
    report "workflow/issues/issue-${issue}/ still on main with stage=complete (archive candidate)"
  fi
done

if [[ -n "$REPO" ]] && command -v gh >/dev/null 2>&1; then
  export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  if [[ -n "${GH_TOKEN:-}" ]]; then
    gh issue list --repo "$REPO" --state open --label "${WORKFLOW_LABEL_PREFIX}:complete" \
      --json number,title -q '.[] | "\(.number)\t\(.title)"' 2>/dev/null \
      | while IFS=$'\t' read -r num title; do
          [[ -z "$num" ]] && continue
          report "Issue #${num} is OPEN with ${WORKFLOW_LABEL_PREFIX}:complete — ${title}"
        done

    gh issue list --repo "$REPO" --state closed --limit 100 \
      --json number,labels,title -q ".[] | select([.labels[].name] | any(startswith(\"${WORKFLOW_LABEL_PREFIX}:\"))) | \"\(.number)\t\(.title)\"" 2>/dev/null \
      | while IFS=$'\t' read -r num title; do
          [[ -z "$num" ]] && continue
          report "Closed issue #${num} still has ${WORKFLOW_LABEL_PREFIX}:* label — ${title}"
        done

    stale_count="$(bash "$ROOT/scripts/cursor-workflow-delete-stale-branches.sh" --count-stale 2>/dev/null || echo 0)"
    if [[ "$stale_count" -gt 0 ]]; then
      report "${stale_count} stale agent side-branches for merged PRs (enable sweep_stale_agent_branches)"
    fi
  fi
fi

if [[ "$FOUND" -eq 0 ]]; then
  echo "PASS: no hygiene issues detected"
  exit 0
fi

echo ""
echo "Fix: merge PRs with Closes #N; run Actions → Cursor workflow housekeeping (strip_labels_on_closed)."
exit 1
