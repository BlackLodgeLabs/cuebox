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
