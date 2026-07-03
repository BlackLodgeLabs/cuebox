#!/usr/bin/env bash
# Copy cursor-workflow helper scripts from origin/main into a fixed directory.
# Feature branches created before those scripts landed do not contain them; loading
# from main lets handoff/resync work on any cursor/issue-* branch.
set -euo pipefail

DEST="${1:-/tmp/cursor-workflow-scripts}"
REF="${WORKFLOW_SCRIPTS_REF:-origin/main}"

FETCH_BRANCH="main"
if [[ "$REF" == origin/* ]]; then
  FETCH_BRANCH="${REF#origin/}"
fi
git fetch origin "$FETCH_BRANCH"

mkdir -p "$DEST"
for script in \
  cursor-workflow-sync-github-status.sh \
  cursor-workflow-ensure-draft-pr.sh \
  cursor-workflow-record-pr-on-branch.sh \
  cursor-workflow-record-agent-on-branch.sh \
  cursor-workflow-record-loops-on-branch.sh \
  cursor-workflow-discover-agents.sh \
  cursor-workflow-notify-complete.sh \
  cursor-workflow-update-pr-body.sh \
  cursor-workflow-merge-state.sh; do
  if git cat-file -e "${REF}:scripts/${script}" 2>/dev/null; then
    git show "${REF}:scripts/${script}" > "${DEST}/${script}"
  elif git cat-file -e "HEAD:scripts/${script}" 2>/dev/null; then
    git show "HEAD:scripts/${script}" > "${DEST}/${script}"
  else
    echo "Missing workflow script: scripts/${script} (not on ${REF} or HEAD)" >&2
    exit 1
  fi
  chmod +x "${DEST}/${script}"
done

echo "$DEST"
