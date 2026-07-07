#!/usr/bin/env bash
# Recover missed handoffs when stage is ready but the target agent was never spawned.
# Usage: cursor-workflow-handoff-recovery.sh <issue> <branch> <state-file> [prev-stage]
set -euo pipefail

ISSUE="${1:?}"
BRANCH="${2:?}"
STATE_FILE="${3:?}"
PREV_STAGE="${4:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF="${WF:-${SCRIPTS_DIR:-$SCRIPT_DIR}}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

stage=$(jq -r '.stage // empty' "$STATE_FILE")
pr=$(jq -r '.pr // empty' "$STATE_FILE")

skill=""
progress_stage=""
prompt=""

case "$stage" in
  spec-ready)
    skill="planning"
    progress_stage="plan-in-progress"
    prompt="Use the planning skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Draft PR #${pr} already exists — do not create a PR. Read workflow/cursor-workflow/WORKFLOW.md and workflow/issues/issue-${ISSUE}/workflow.state.json."
    ;;
  plan-ready)
    skill="execute"
    progress_stage="execute-in-progress"
    prompt="Use the execute skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Draft PR #${pr} already exists — push commits only; do not create a PR. Run all tests and gate scripts before pushing."
    ;;
  execute-ready)
    if [ "$PREV_STAGE" = "changes-requested" ]; then
      skill="execute"
      progress_stage="execute-in-progress"
      prompt="Use the execute skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Draft PR #${pr} already exists — push commits only; do not create a PR. Post-complete scope changes requested; read SPEC.md and PLAN.md for updates. Run all tests and gate scripts before pushing."
    else
      skill="demo"
      progress_stage="demo-in-progress"
      prompt="Use the demo skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Full Docker stack must be running. Follow workflow/issues/issue-${ISSUE}/demo/demo-spec.md."
    fi
    ;;
  demo-ready)
    skill="create-pr"
    progress_stage="create-pr-in-progress"
    prompt="Use the create-pr skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Draft PR #${pr} already exists — write workflow/issues/issue-${ISSUE}/PR.md from spec, plan, commits, and demo notes; do not create a PR."
    ;;
  create-pr-ready)
    skill="babysit-pr"
    progress_stage="babysit-in-progress"
    prompt="Use the babysit-pr skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Loop limits: bugbot 3, ci_autofix 2, total 10. Mark PR ready for review when clean."
    ;;
  *)
    exit 0
    ;;
esac

agent_recorded=$(jq -r --arg k "$skill" '
  ((.agents // {})[$k] // empty)
  | if type == "object" then .id // empty else . end
' "$STATE_FILE")
if [ -n "$agent_recorded" ] && [ "$agent_recorded" != "null" ]; then
  exit 0
fi

if [ "$stage" = "create-pr-ready" ]; then
  if [ -z "$pr" ] || [ "$pr" = "null" ]; then
    exit 0
  fi
  if [ "${MOCK_PR_IS_DRAFT:-}" = "false" ]; then
    echo "Handoff recovery skipped — PR is not draft"
    exit 0
  fi
  is_draft=true
  if [ "${MOCK_PR_IS_DRAFT:-}" != "true" ]; then
    if command -v gh >/dev/null 2>&1; then
      is_draft=$(gh pr view "$pr" --repo "$REPO" --json isDraft -q '.isDraft' 2>/dev/null || echo false)
    else
      is_draft=false
    fi
  fi
  if [ "$is_draft" != "true" ]; then
    echo "Handoff recovery skipped — PR #${pr} is not draft"
    exit 0
  fi
fi

decision=$("$WF/cursor-workflow-admission-gate.sh" "$STATE_FILE" "$skill")
if [ "$decision" != "proceed" ]; then
  echo "Handoff recovery deferred (${stage} → ${skill}): $decision"
  exit 0
fi

reopen_flag=""
if [ "$stage" = "execute-ready" ] && [ "$PREV_STAGE" = "changes-requested" ]; then
  reopen_flag="--reopen"
fi

echo "Handoff recovery: spawning ${skill} for issue #${ISSUE} (stage=${stage})"
"$WF/cursor-workflow-spawn-agent.sh" \
  "$ISSUE" "$BRANCH" "$STATE_FILE" "$skill" "$prompt" "$progress_stage" \
  $reopen_flag
