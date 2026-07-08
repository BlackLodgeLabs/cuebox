#!/usr/bin/env bash
# Copy cursor-workflow helper scripts from origin/main into a fixed directory.
# Feature branches created before those scripts landed do not contain them; loading
# from main lets handoff/resync work on any cursor/issue-* branch.
# Usage: cursor-workflow-load-scripts.sh [dest-dir] [handoff|agent]
set -euo pipefail

DEST="${1:-/tmp/cursor-workflow-scripts}"
SCRIPT_SET="${2:-handoff}"
REF="${WORKFLOW_SCRIPTS_REF:-origin/main}"

FETCH_BRANCH="main"
if [[ "$REF" == origin/* ]]; then
  FETCH_BRANCH="${REF#origin/}"
fi
git fetch origin "$FETCH_BRANCH"

AGENT_SCRIPTS=(
  cursor-workflow-sync-github-status.sh
  cursor-workflow-ensure-draft-pr.sh
  cursor-workflow-record-pr-on-branch.sh
  cursor-workflow-record-agent-on-branch.sh
  cursor-workflow-record-loops-on-branch.sh
  cursor-workflow-discover-agents.sh
  cursor-workflow-notify-complete.sh
  cursor-workflow-update-pr-body.sh
  cursor-workflow-merge-state.sh
)

HANDOFF_SCRIPTS=(
  cursor-workflow-sync-github-status.sh
  cursor-workflow-ensure-draft-pr.sh
  cursor-workflow-record-pr-on-branch.sh
  cursor-workflow-record-agent-on-branch.sh
  cursor-workflow-record-loops-on-branch.sh
  cursor-workflow-discover-agents.sh
  cursor-workflow-notify-complete.sh
  cursor-workflow-update-pr-body.sh
  cursor-workflow-count-active-agents.sh
  cursor-workflow-admission-gate.sh
  cursor-workflow-record-handoff-pending.sh
  cursor-workflow-refetch-state.sh
  cursor-workflow-spawn-agent.sh
  cursor-workflow-babysit-recovery.sh
  cursor-workflow-handoff-recovery.sh
  cursor-workflow-passback-run.sh
  cursor-workflow-ensure-pr-on-branch.sh
  cursor-workflow-infer-reopen.sh
  cursor-workflow-ensure-before-sha.sh
  cursor-workflow-push-diff-includes.sh
  cursor-workflow-post-deferral-comment.sh
  cursor-workflow-fetch-agents-list.sh
  cursor-workflow-should-discover-agents.sh
  cursor-workflow-record-spawn-on-branch.sh
  cursor-workflow-stage-rank.sh
)

case "$SCRIPT_SET" in
  agent) SCRIPTS=("${AGENT_SCRIPTS[@]}") ;;
  handoff) SCRIPTS=("${HANDOFF_SCRIPTS[@]}") ;;
  *)
    echo "Unknown script set: $SCRIPT_SET (use handoff or agent)" >&2
    exit 1
    ;;
esac

mkdir -p "$DEST"
for script in "${SCRIPTS[@]}"; do
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
