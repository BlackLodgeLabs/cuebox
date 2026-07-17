#!/usr/bin/env bash
# Offline unit tests for scripts/cursor-workflow-config.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONFIG="workflow/cursor-workflow/workflow.config.yaml"
RESOLVER="scripts/cursor-workflow-config.sh"

fail=0
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" != "$actual" ]]; then
    echo "FAIL: ${label}: expected '${expected}', got '${actual}'" >&2
    fail=1
  fi
}

if [[ ! -f "$CONFIG" ]]; then
  echo "FAIL: missing $CONFIG" >&2
  exit 1
fi

if [[ ! -x "$RESOLVER" ]]; then
  echo "FAIL: missing or non-executable $RESOLVER" >&2
  exit 1
fi

gate="$("$RESOLVER" get gates.workflow_regression)"
assert_eq "gates.workflow_regression" "scripts/verify-workflow-paths.sh" "$gate"

app_gate="$("$RESOLVER" get gates.application_default)"
assert_eq "gates.application_default" "scripts/verify-phase8-gates.sh" "$app_gate"

owner="$("$RESOLVER" get repository.owner)"
assert_eq "repository.owner" "BlackLodgeLabs" "$owner"

name="$("$RESOLVER" get repository.name)"
assert_eq "repository.name" "cuebox" "$name"

# source exports
# shellcheck disable=SC1090
source "$RESOLVER"

assert_eq "WORKFLOW_REGRESSION_GATE export" "scripts/verify-workflow-paths.sh" "$WORKFLOW_REGRESSION_GATE"
assert_eq "APP_DEFAULT_GATE export" "scripts/verify-phase8-gates.sh" "$APP_DEFAULT_GATE"
assert_eq "GITHUB_REPO_SLUG export" "BlackLodgeLabs/cuebox" "$GITHUB_REPO_SLUG"
assert_eq "WORKFLOW_ARTIFACT_ROOT export" "workflow/issues" "$WORKFLOW_ARTIFACT_ROOT"
assert_eq "WORKFLOW_LOOP_LIMIT_BUGBOT export" "1" "$WORKFLOW_LOOP_LIMIT_BUGBOT"
assert_eq "WORKFLOW_LOOP_LIMIT_CI_AUTOFIX export" "1" "$WORKFLOW_LOOP_LIMIT_CI_AUTOFIX"
assert_eq "APPLICATION_LOOP_LIMIT_BUGBOT export" "3" "$APPLICATION_LOOP_LIMIT_BUGBOT"
assert_eq "APPLICATION_LOOP_LIMIT_CI_AUTOFIX export" "2" "$APPLICATION_LOOP_LIMIT_CI_AUTOFIX"

base_branch="$("$RESOLVER" get repository.base_branch)"
assert_eq "repository.base_branch" "main" "$base_branch"

label_prefix="$("$RESOLVER" get repository.label_prefix)"
assert_eq "repository.label_prefix" "cursor" "$label_prefix"

archive_branch="$("$RESOLVER" get repository.archive_branch)"
assert_eq "repository.archive_branch" "workflow/archive" "$archive_branch"

max_agents="$("$RESOLVER" get orchestration.max_active_agents)"
assert_eq "orchestration.max_active_agents" "8" "$max_agents"

stale_minutes="$("$RESOLVER" get orchestration.handoff_pending_stale_minutes)"
assert_eq "orchestration.handoff_pending_stale_minutes" "15" "$stale_minutes"

deferral_minutes="$("$RESOLVER" get orchestration.deferral_comment_cooldown_minutes)"
assert_eq "orchestration.deferral_comment_cooldown_minutes" "30" "$deferral_minutes"

late_resume="$("$RESOLVER" get orchestration.late_stage_resume)"
if [[ "${late_resume,,}" != "false" ]]; then
  echo "FAIL: orchestration.late_stage_resume: expected 'false', got '${late_resume}'" >&2
  fail=1
fi

per_issue="$("$RESOLVER" get orchestration.per_issue_spawn_serialization)"
if [[ "${per_issue,,}" != "true" ]]; then
  echo "FAIL: orchestration.per_issue_spawn_serialization: expected 'true', got '${per_issue}'" >&2
  fail=1
fi

assert_eq "WORKFLOW_BASE_BRANCH export" "main" "$WORKFLOW_BASE_BRANCH"
assert_eq "WORKFLOW_LABEL_PREFIX export" "cursor" "$WORKFLOW_LABEL_PREFIX"
assert_eq "WORKFLOW_ARCHIVE_BRANCH export" "workflow/archive" "$WORKFLOW_ARCHIVE_BRANCH"
assert_eq "WORKFLOW_BRANCH_PREFIX export" "cursor/issue-" "$WORKFLOW_BRANCH_PREFIX"
assert_eq "WORKFLOW_MAX_ACTIVE_AGENTS export" "8" "$WORKFLOW_MAX_ACTIVE_AGENTS"
assert_eq "WORKFLOW_HANDOFF_PENDING_STALE_MINUTES export" "15" "$WORKFLOW_HANDOFF_PENDING_STALE_MINUTES"
assert_eq "WORKFLOW_DEFERRAL_COMMENT_COOLDOWN_MINUTES export" "30" "$WORKFLOW_DEFERRAL_COMMENT_COOLDOWN_MINUTES"
assert_eq "WORKFLOW_LATE_STAGE_RESUME export" "false" "$WORKFLOW_LATE_STAGE_RESUME"
assert_eq "WORKFLOW_PER_ISSUE_SPAWN_SERIALIZATION export" "true" "$WORKFLOW_PER_ISSUE_SPAWN_SERIALIZATION"

if [[ -z "${APP_HEALTH_URL_FRONTEND:-}" || -z "${APP_DATABASE_URL_HOST_TEST:-}" ]]; then
  echo "FAIL: environment exports missing" >&2
  fail=1
fi

if "$RESOLVER" get nonexistent.key.path >/dev/null 2>&1; then
  echo "FAIL: invalid key should exit non-zero" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: cursor-workflow-config.sh"
