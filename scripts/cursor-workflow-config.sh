#!/usr/bin/env bash
# Resolve workflow/cursor-workflow/workflow.config.yaml into env vars or single values.
#
# Usage:
#   source scripts/cursor-workflow-config.sh
#   bash scripts/cursor-workflow-config.sh get gates.workflow_regression
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${ROOT}/workflow/cursor-workflow/workflow.config.yaml"

if [[ ! -f "$CONFIG" ]]; then
  echo "FAIL: workflow config not found: $CONFIG" >&2
  exit 1
fi

_config_get() {
  local path="$1"
  python3 - "$CONFIG" "$path" <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("FAIL: PyYAML required to parse workflow.config.yaml", file=sys.stderr)
    sys.exit(1)

config_path = Path(sys.argv[1])
dot_path = sys.argv[2]
data = yaml.safe_load(config_path.read_text(encoding="utf-8"))
node = data
for part in dot_path.split("."):
    if not isinstance(node, dict) or part not in node:
        print(f"FAIL: config key not found: {dot_path}", file=sys.stderr)
        sys.exit(1)
    node = node[part]
if node is None:
    print(f"FAIL: config key is null: {dot_path}", file=sys.stderr)
    sys.exit(1)
if isinstance(node, list):
    print(" ".join(str(x) for x in node))
else:
    print(node)
PY
}

_config_try_get() {
  local path="$1"
  if _config_get "$path" >/dev/null 2>&1; then
    _config_get "$path"
    return 0
  fi
  return 1
}

_config_get_with_fallback() {
  local path
  for path in "$@"; do
    if val="$(_config_try_get "$path")"; then
      echo "$val"
      return 0
    fi
  done
  _config_get "$1"
}

_export_config() {
  export WORKFLOW_ARTIFACT_ROOT="$(_config_get paths.artifact_root)"
  export WORKFLOW_DOCS="$(_config_get paths.workflow_docs)"
  export WORKFLOW_SKILLS_ROOT="$(_config_get paths.skills_root)"
  export WORKFLOW_REGRESSION_GATE="$(_config_get gates.workflow_regression)"
  export APP_DEFAULT_GATE="$(_config_get_with_fallback adapter.gates.application_default gates.application_default)"
  export APP_HEALTH_URL_FRONTEND="$(_config_get_with_fallback adapter.environment.health_url_frontend environment.health_url_frontend)"
  export APP_HEALTH_URL_API="$(_config_get_with_fallback adapter.environment.health_url_api environment.health_url_api)"
  export APP_DATABASE_URL_HOST_TEST="$(_config_get_with_fallback adapter.environment.database_url_host_test environment.database_url_host_test)"
  export GITHUB_REPO_OWNER="$(_config_get repository.owner)"
  export GITHUB_REPO_NAME="$(_config_get repository.name)"
  export GITHUB_REPO_SLUG="${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}"
  export WORKFLOW_BASE_BRANCH="$(_config_get repository.base_branch)"
  export WORKFLOW_BRANCH_PATTERN="$(_config_get repository.branch_pattern)"
  export WORKFLOW_LABEL_PREFIX="$(_config_get repository.label_prefix)"
  export WORKFLOW_ARCHIVE_BRANCH="$(_config_get repository.archive_branch)"
  export WORKFLOW_BRANCH_PREFIX="${WORKFLOW_LABEL_PREFIX}/issue-"
  export WORKFLOW_MAX_ACTIVE_AGENTS="${CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS:-$(_config_get orchestration.max_active_agents)}"
  export WORKFLOW_HANDOFF_PENDING_STALE_MINUTES="${CURSOR_WORKFLOW_PENDING_STALE_MINUTES:-$(_config_get orchestration.handoff_pending_stale_minutes)}"
  export WORKFLOW_DEFERRAL_COMMENT_COOLDOWN_MINUTES="${CURSOR_WORKFLOW_DEFERRAL_COMMENT_MINUTES:-$(_config_get orchestration.deferral_comment_cooldown_minutes)}"
  export WORKFLOW_LOOP_LIMIT_BUGBOT="$(_config_get tiering.workflow_loop_limits.bugbot)"
  export WORKFLOW_LOOP_LIMIT_CI_AUTOFIX="$(_config_get tiering.workflow_loop_limits.ci_autofix)"
  export APPLICATION_LOOP_LIMIT_BUGBOT="$(_config_get tiering.application_loop_limits.bugbot)"
  export APPLICATION_LOOP_LIMIT_CI_AUTOFIX="$(_config_get tiering.application_loop_limits.ci_autofix)"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ "${1:-}" == "get" && -n "${2:-}" ]]; then
    case "$2" in
      gates.application_default)
        _config_get_with_fallback adapter.gates.application_default gates.application_default
        ;;
      environment.health_url_frontend)
        _config_get_with_fallback adapter.environment.health_url_frontend environment.health_url_frontend
        ;;
      environment.health_url_api)
        _config_get_with_fallback adapter.environment.health_url_api environment.health_url_api
        ;;
      environment.database_url_host_test)
        _config_get_with_fallback adapter.environment.database_url_host_test environment.database_url_host_test
        ;;
      *)
        _config_get "$2"
        ;;
    esac
  else
    echo "Usage: $0 get <dot.path>" >&2
    echo "       source $0" >&2
    exit 1
  fi
else
  _export_config
fi
