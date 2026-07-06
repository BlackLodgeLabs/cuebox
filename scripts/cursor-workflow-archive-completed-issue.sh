#!/usr/bin/env bash
# Move workflow/issues/issue-NNN/ to the workflow/archive branch (issue-NNN/) and remove from current branch.
# Idempotent: no-op if the source folder is missing.
# Usage: cursor-workflow-archive-completed-issue.sh <issue-number> [--no-commit]
set -euo pipefail

ISSUE="${1:?usage: cursor-workflow-archive-completed-issue.sh <issue-number> [--no-commit]}"
NO_COMMIT=false
if [[ "${2:-}" == "--no-commit" ]]; then
  NO_COMMIT=true
fi

ARCHIVE_BRANCH="workflow/archive"
SRC="workflow/issues/issue-${ISSUE}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d "$SRC" ]]; then
  echo "No source folder (skip): $SRC"
  exit 0
fi

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT
cp -a "$SRC/." "$STAGING/"

if [[ -f "$STAGING/workflow.state.json" ]]; then
  jq '.stage = "complete" | .active_skill = null | .active_agent_id = null' \
    "$STAGING/workflow.state.json" > "$STAGING/workflow.state.json.tmp"
  mv "$STAGING/workflow.state.json.tmp" "$STAGING/workflow.state.json"
fi

rm -f "$STAGING/PROPOSED-GITHUB-ISSUE.md"
rm -f "$STAGING/demo/render-terminal-screenshot.py" "$STAGING/demo/render-status-preview.sh"

CURRENT_BRANCH="$(git branch --show-current)"
WORKTREE="$(mktemp -d)"
trap 'rm -rf "$STAGING" "$WORKTREE"' EXIT

git fetch origin "$ARCHIVE_BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/remotes/origin/${ARCHIVE_BRANCH}"; then
  git worktree add -B "$ARCHIVE_BRANCH" "$WORKTREE" "origin/${ARCHIVE_BRANCH}"
else
  git worktree add -B "$ARCHIVE_BRANCH" "$WORKTREE" --orphan
  (
    cd "$WORKTREE"
    git rm -rf . 2>/dev/null || true
    cat > README.md <<'EOF'
# Workflow archive

Completed per-issue workflow artifacts (spec, plan, demo, PR, state, reviews).

Each folder `issue-N/` was moved from `workflow/issues/issue-N/` on `main` after the linked PR merged.

Active issues remain on `main` under `workflow/issues/`. See `workflow/cursor-workflow/RETROSPECTIVES.md` on `main` for an index.
EOF
    git add README.md
    git commit -m "chore(archive): initialize workflow archive branch"
  )
fi

DEST_REL="issue-${ISSUE}"
mkdir -p "$WORKTREE/$DEST_REL"
rm -rf "$WORKTREE/$DEST_REL"
cp -a "$STAGING/." "$WORKTREE/$DEST_REL/"

(
  cd "$WORKTREE"
  git add "$DEST_REL"
  if git diff --cached --quiet; then
    echo "Archive branch unchanged for issue #${ISSUE}"
  else
    git -c user.name="${GIT_AUTHOR_NAME:-github-actions[bot]}" \
        -c user.email="${GIT_AUTHOR_EMAIL:-github-actions[bot]@users.noreply.github.com}" \
        commit -m "chore(archive): add issue #${ISSUE} workflow artifacts"
    git push origin "$ARCHIVE_BRANCH"
    echo "Pushed issue #${ISSUE} to ${ARCHIVE_BRANCH}"
  fi
)

git worktree remove "$WORKTREE" --force
trap 'rm -rf "$STAGING"' EXIT

git rm -rf "$SRC"
echo "Removed $SRC from branch ${CURRENT_BRANCH}"

if [[ "$NO_COMMIT" == false ]]; then
  if ! git diff --quiet --cached; then
    git -c user.name="${GIT_AUTHOR_NAME:-github-actions[bot]}" \
        -c user.email="${GIT_AUTHOR_EMAIL:-github-actions[bot]@users.noreply.github.com}" \
        commit -m "chore(workflow): remove archived issue #${ISSUE} from main"
  fi
fi
