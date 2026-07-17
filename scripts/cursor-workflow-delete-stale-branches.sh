#!/usr/bin/env bash
# Delete cloud-agent side-branches scoped to a merged PR, or sweep orphans.
#
# Usage:
#   cursor-workflow-delete-stale-branches.sh <pr-number> [--dry-run]
#   cursor-workflow-delete-stale-branches.sh --sweep-merged [--dry-run]
#   cursor-workflow-delete-stale-branches.sh --count-stale
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/cursor-workflow-config.sh"

REPO="${GITHUB_REPOSITORY:-}"
DRY_RUN=0
SWEEP=0
COUNT_STALE=0
PR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --sweep-merged) SWEEP=1; shift ;;
    --count-stale) COUNT_STALE=1; shift ;;
    -h|--help)
      echo "Usage: $0 <pr-number> [--dry-run] | --sweep-merged [--dry-run] | --count-stale"
      exit 0
      ;;
    *)
      if [[ -z "$PR" && "$1" =~ ^[0-9]+$ ]]; then
        PR="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ "$COUNT_STALE" -eq 1 ]]; then
  :
elif [[ "$SWEEP" -eq 1 ]]; then
  :
elif [[ -z "$PR" ]]; then
  echo "usage: $0 <pr-number> [--dry-run] | --sweep-merged [--dry-run] | --count-stale" >&2
  exit 1
fi

if [[ -z "$REPO" ]] && command -v gh >/dev/null 2>&1; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
fi

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -n "$GH_TOKEN" ]]; then
  export GH_TOKEN
fi

DELETED=0
SKIPPED_OPEN=0
NOT_FOUND=0
ERRORS=0

log_action() {
  echo "BRANCH: $*"
}

# GitHub git ref API paths require slashes in branch names to be percent-encoded.
_encode_branch_ref() {
  local branch="$1"
  printf '%s' "$branch" | sed 's|/|%2F|g'
}

_gh_api_http_code() {
  local output code
  output="$(gh api "$@" --silent -i 2>&1 || true)"
  code="$(printf '%s\n' "$output" | head -n 1 | awk '{print $2}')"
  if [[ "$code" =~ ^[0-9]{3}$ ]]; then
    echo "$code"
  else
    echo "000"
  fi
}

# --- Test-mode mocks (CURSOR_WORKFLOW_TEST_MODE=1) ---
# MOCK_REMOTE_BRANCHES: newline-separated branch names
# MOCK_OPEN_PR_HEADS: newline-separated branches with open PRs
# MOCK_MERGED_PRS: comma-separated merged PR numbers
# MOCK_PR_HEAD_REFS: lines "PR:headRefName" for gh pr view fallback
# MOCK_DELETE_CALLS_FILE: append deleted branch names
# MOCK_DELETE_HTTP_CODE: HTTP code for delete (default 204); set 404 for not-found

_list_remote_branches() {
  if [[ "${CURSOR_WORKFLOW_TEST_MODE:-}" == "1" ]]; then
    printf '%s\n' "${MOCK_REMOTE_BRANCHES:-}"
    return
  fi
  if [[ -z "$REPO" || -z "${GH_TOKEN:-}" ]]; then
    return
  fi
  gh api "repos/${REPO}/git/matching-refs/heads/${WORKFLOW_BRANCH_PREFIX}" --paginate \
    -q '.[].ref' 2>/dev/null | sed 's|^refs/heads/||' || true
}

_branch_exists() {
  local branch="$1"
  if [[ "${CURSOR_WORKFLOW_TEST_MODE:-}" == "1" ]]; then
    if [[ -n "${MOCK_DELETE_CALLS_FILE:-}" ]] && [[ -f "$MOCK_DELETE_CALLS_FILE" ]] \
        && grep -Fxq "$branch" "$MOCK_DELETE_CALLS_FILE"; then
      return 1
    fi
    printf '%s\n' "${MOCK_REMOTE_BRANCHES:-}" | grep -Fxq "$branch"
    return
  fi
  if [[ -z "$REPO" || -z "${GH_TOKEN:-}" ]]; then
    return 1
  fi
  local encoded
  encoded="$(_encode_branch_ref "$branch")"
  gh api "repos/${REPO}/git/ref/heads/${encoded}" >/dev/null 2>&1
}

_is_open_pr_head() {
  local branch="$1"
  if [[ "${CURSOR_WORKFLOW_TEST_MODE:-}" == "1" ]]; then
    printf '%s\n' "${MOCK_OPEN_PR_HEADS:-}" | grep -Fxq "$branch"
    return
  fi
  if [[ -z "$REPO" || -z "${GH_TOKEN:-}" ]]; then
    return 1
  fi
  local count
  count="$(gh pr list --repo "$REPO" --head "$branch" --state open --json number -q 'length' 2>/dev/null || echo 0)"
  [[ "$count" -gt 0 ]]
}

_pr_is_merged() {
  local pr_num="$1"
  if [[ "${CURSOR_WORKFLOW_TEST_MODE:-}" == "1" ]]; then
    local merged_csv=",${MOCK_MERGED_PRS:-},"
    [[ "$merged_csv" == *",$pr_num,"* ]]
    return
  fi
  if [[ -z "$REPO" || -z "${GH_TOKEN:-}" ]]; then
    return 1
  fi
  local state
  state="$(gh pr view "$pr_num" --repo "$REPO" --json state -q .state 2>/dev/null || echo "")"
  [[ "$state" == "MERGED" ]]
}

_pr_head_ref() {
  local pr_num="$1"
  if [[ "${CURSOR_WORKFLOW_TEST_MODE:-}" == "1" ]]; then
    local line
    line="$(printf '%s\n' "${MOCK_PR_HEAD_REFS:-}" | grep -E "^${pr_num}:" | head -1 || true)"
    if [[ -n "$line" ]]; then
      echo "${line#*:}"
    fi
    return
  fi
  if [[ -z "$REPO" || -z "${GH_TOKEN:-}" ]]; then
    return
  fi
  gh pr view "$pr_num" --repo "$REPO" --json headRefName -q .headRefName 2>/dev/null || true
}

_delete_branch() {
  local branch="$1"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log_action "dry-run delete ${branch}"
    return 0
  fi
  if [[ "${CURSOR_WORKFLOW_TEST_MODE:-}" == "1" ]]; then
    if [[ -n "${MOCK_DELETE_CALLS_FILE:-}" ]]; then
      echo "$branch" >> "$MOCK_DELETE_CALLS_FILE"
    fi
    local code="${MOCK_DELETE_HTTP_CODE:-204}"
    if [[ "$code" == "404" ]]; then
      return 1
    fi
    return 0
  fi
  if [[ -z "$REPO" || -z "${GH_TOKEN:-}" ]]; then
    log_action "error ${branch} (no GH token)"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
  local encoded http_code
  encoded="$(_encode_branch_ref "$branch")"
  http_code="$(_gh_api_http_code -X DELETE "repos/${REPO}/git/refs/heads/${encoded}")"
  case "$http_code" in
    204|200)
      return 0
      ;;
    404|422)
      return 1
      ;;
    *)
      log_action "error ${branch} (HTTP ${http_code})"
      ERRORS=$((ERRORS + 1))
      return 1
      ;;
  esac
}

_try_delete_branch() {
  local branch="$1"
  if _is_open_pr_head "$branch"; then
    log_action "skipped-open-pr ${branch}"
    SKIPPED_OPEN=$((SKIPPED_OPEN + 1))
    return 0
  fi
  if ! _branch_exists "$branch"; then
    log_action "not-found ${branch}"
    NOT_FOUND=$((NOT_FOUND + 1))
    return 0
  fi
  if _delete_branch "$branch"; then
    log_action "deleted ${branch}"
    DELETED=$((DELETED + 1))
  else
    if _branch_exists "$branch"; then
      log_action "error ${branch}"
      ERRORS=$((ERRORS + 1))
    else
      log_action "not-found ${branch}"
      NOT_FOUND=$((NOT_FOUND + 1))
    fi
  fi
}

_extract_pr_from_branch() {
  local branch="$1"
  if [[ "$branch" =~ -pr-([0-9]+)- ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

_is_agent_side_branch() {
  local branch="$1"
  [[ "$branch" =~ ^${WORKFLOW_BRANCH_PREFIX}[0-9]+-pr-[0-9]+-.*-agent- ]]
}

_matches_pr_scope() {
  local branch="$1"
  local pr_num="$2"
  [[ "$branch" =~ ^${WORKFLOW_BRANCH_PREFIX}[0-9]+-pr-${pr_num}- ]]
}

_count_stale_branches() {
  local count=0
  local branch pr_num
  while IFS= read -r branch; do
    [[ -z "$branch" ]] && continue
    _is_agent_side_branch "$branch" || continue
    pr_num="$(_extract_pr_from_branch "$branch")"
    [[ -z "$pr_num" ]] && continue
    if _pr_is_merged "$pr_num"; then
      count=$((count + 1))
    fi
  done < <(_list_remote_branches)
  echo "$count"
}

_post_merge_delete() {
  local pr_num="$1"
  local branch
  while IFS= read -r branch; do
    [[ -z "$branch" ]] && continue
    _matches_pr_scope "$branch" "$pr_num" || continue
    _try_delete_branch "$branch"
  done < <(_list_remote_branches)

  local head_ref
  head_ref="$(_pr_head_ref "$pr_num")"
  if [[ -n "$head_ref" && "$head_ref" =~ ^${WORKFLOW_BRANCH_PREFIX} ]]; then
    _try_delete_branch "$head_ref"
  fi
}

_sweep_merged() {
  local branch pr_num
  while IFS= read -r branch; do
    [[ -z "$branch" ]] && continue
    _is_agent_side_branch "$branch" || continue
    pr_num="$(_extract_pr_from_branch "$branch")"
    [[ -z "$pr_num" ]] && continue
    _pr_is_merged "$pr_num" || continue
    _try_delete_branch "$branch"
  done < <(_list_remote_branches)
}

if [[ "$COUNT_STALE" -eq 1 ]]; then
  _count_stale_branches
  exit 0
fi

if [[ "$SWEEP" -eq 1 ]]; then
  echo "Sweeping stale agent side-branches for merged PRs..."
  _sweep_merged
else
  echo "Deleting agent side-branches for merged PR #${PR}..."
  _post_merge_delete "$PR"
fi

echo "Summary: deleted=${DELETED} skipped-open-pr=${SKIPPED_OPEN} not-found=${NOT_FOUND} errors=${ERRORS}"
if [[ "$ERRORS" -gt 0 ]]; then
  exit 1
fi
exit 0
