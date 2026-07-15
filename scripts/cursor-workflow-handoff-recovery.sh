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

case "$stage" in
  execute-passback)
    "$WF/cursor-workflow-passback-run.sh" "$ISSUE" "$BRANCH" "$STATE_FILE"
    exit $?
    ;;
esac

skill=""
progress_stage=""
prompt=""
reopen_decision=""

case "$stage" in
  spec-ready)
    skill="planning"
    progress_stage="plan-in-progress"
    ;;
  plan-ready)
    skill="execute"
    progress_stage="execute-in-progress"
    ;;
  execute-ready)
    reopen_decision=$("$WF/cursor-workflow-infer-reopen.sh" "$STATE_FILE" "$PREV_STAGE")
    if [ "$reopen_decision" = "reopen" ]; then
      skill="execute"
      progress_stage="execute-in-progress"
    else
      skill="demo"
      progress_stage="demo-in-progress"
    fi
    ;;
  demo-ready)
    skill="create-pr"
    progress_stage="create-pr-in-progress"
    ;;
  create-pr-ready)
    skill="babysit-pr"
    progress_stage="babysit-in-progress"
    ;;
  *)
    exit 0
    ;;
esac

if [ "$stage" = "spec-ready" ]; then
  "$WF/cursor-workflow-ensure-pr-on-branch.sh" "$ISSUE" "$BRANCH" "$STATE_FILE"
  pr=$(jq -r '.pr' "$STATE_FILE")
elif [ "$stage" = "plan-ready" ]; then
  if [ -z "$pr" ] || [ "$pr" = "null" ]; then
    "$WF/cursor-workflow-ensure-pr-on-branch.sh" "$ISSUE" "$BRANCH" "$STATE_FILE"
    pr=$(jq -r '.pr' "$STATE_FILE")
  fi
fi

case "$stage" in
  spec-ready)
    prompt="Use the planning skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Draft PR #${pr} already exists — do not create a PR. Read workflow/cursor-workflow/WORKFLOW.md and workflow/issues/issue-${ISSUE}/workflow.state.json."
    ;;
  plan-ready)
    prompt="Use the execute skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Draft PR #${pr} already exists — push commits only; do not create a PR. Run all tests and gate scripts before pushing."
    ;;
  execute-ready)
    if [ "$skill" = "execute" ]; then
      prompt="Use the execute skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Draft PR #${pr} already exists — push commits only; do not create a PR. Post-complete scope changes requested; read SPEC.md and PLAN.md for updates. Run all tests and gate scripts before pushing."
    else
      prompt="Use the demo skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Full Docker stack must be running. Follow workflow/issues/issue-${ISSUE}/demo/demo-spec.md."
    fi
    ;;
  demo-ready)
    prompt="Use the create-pr skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Draft PR #${pr} already exists — write workflow/issues/issue-${ISSUE}/PR.md from spec, plan, commits, and demo notes; do not create a PR."
    ;;
  create-pr-ready)
    prompt="Use the babysit-pr skill for GitHub issue #${ISSUE}. Branch: ${BRANCH}. Loop limits: bugbot 3, ci_autofix 2, total 10. Mark PR ready for review when clean."
    ;;
esac

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

reopen_flag=""
if [ "$stage" = "execute-ready" ] && [ "$reopen_decision" = "reopen" ]; then
  reopen_flag="--reopen"
fi

fail_pre_spawn_admission() {
  local original_rc="${1:-1}"
  echo "Agent-list fetch/count failed during recovery for ${skill} (exit ${original_rc})" >&2
  if ! "$WF/cursor-workflow-notify-stalled.sh" \
    "$STATE_FILE" "agents-list-fetch-failed" "$skill"; then
    echo "::warning::Could not post stalled notification for agent-list fetch/count failure" >&2
  fi
  return "$original_rc"
}

if git rev-parse --git-dir >/dev/null 2>&1; then
  git fetch origin "$BRANCH" --quiet 2>/dev/null || echo "Warning: recovery fetch origin/${BRANCH} failed" >&2
fi
if "$WF/cursor-workflow-refetch-state.sh" "$STATE_FILE" "$BRANCH" --agents-from-tip >/dev/null; then
  :
else
  refetch_rc=$?
  fail_pre_spawn_admission "$refetch_rc"
  exit $?
fi
gate_args=("$STATE_FILE" "$skill")
if [ "$reopen_flag" = "--reopen" ]; then
  gate_args+=("--reopen")
fi
if decision=$("$WF/cursor-workflow-admission-gate.sh" "${gate_args[@]}"); then
  :
else
  gate_rc=$?
  fail_pre_spawn_admission "$gate_rc"
  exit $?
fi
if [ "$decision" != "proceed" ]; then
  echo "Handoff recovery deferred (${stage} → ${skill}): $decision"
  exit 0
fi

echo "Handoff recovery: spawning ${skill} for issue #${ISSUE} (stage=${stage})"
"$WF/cursor-workflow-spawn-agent.sh" \
  "$ISSUE" "$BRANCH" "$STATE_FILE" "$skill" "$prompt" "$progress_stage" \
  $reopen_flag
