#!/usr/bin/env bash
# Count in-flight Cursor runs for the same issue + target skill (per-issue serialization).
# Usage: cursor-workflow-count-in-flight-for-issue.sh <issue> <target-skill> [branch-prefix]
# Prints integer count to stdout. Agent-list fetch failures propagate as non-zero.
set -euo pipefail

ISSUE="${1:?usage: cursor-workflow-count-in-flight-for-issue.sh <issue> <target-skill> [branch-prefix]}"
TARGET_SKILL="${2:?}"
BRANCH_PREFIX="${3:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/cursor-workflow-config.sh"

BRANCH_PREFIX="${BRANCH_PREFIX:-${WORKFLOW_BRANCH_PREFIX}${ISSUE}-}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
REPO_SLUG="github.com/${REPO}"

skill_agent_suffix() {
  case "$1" in
    planning) echo "Plan Agent" ;;
    execute) echo "Execute Agent" ;;
    demo) echo "Demo Agent" ;;
    create-pr) echo "Create PR Agent" ;;
    babysit-pr) echo "Babysit PR Agent" ;;
    *) echo "$1" ;;
  esac
}

skill_slug_in_branch() {
  case "$1" in
    planning) echo "plan" ;;
    execute) echo "execute" ;;
    demo) echo "demo" ;;
    create-pr) echo "create-pr" ;;
    babysit-pr) echo "babysit" ;;
    *) echo "$1" ;;
  esac
}

agent_matches_skill() {
  local name="$1" branch="$2"
  local suffix slug
  suffix=$(skill_agent_suffix "$TARGET_SKILL")
  if [[ "$name" == *"$suffix"* ]]; then
    return 0
  fi
  slug=$(skill_slug_in_branch "$TARGET_SKILL")
  if [[ "$branch" == *"-${slug}-agent-"* ]] || [[ "$branch" == *"-${slug}-agent" ]]; then
    return 0
  fi
  return 1
}

run_counts_for_issue_skill() {
  local agent_id="$1" run_id="$2" agent_name="$3"
  if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
    local cache
    cache="${CURSOR_AGENTS_LIST_CACHE:-${RUNNER_TEMP:-/tmp}/cursor-agents-list.json}"
    if [ -f "$cache" ]; then
      jq -e --arg id "$agent_id" --arg repo "$REPO_SLUG" --arg prefix "$BRANCH_PREFIX" --arg skill "$TARGET_SKILL" '
        .items[]?
        | select(.id == $id)
        | .mockRun // empty
        | select(
            (.status == "RUNNING" or .status == "CREATING")
            and ((.branches // []) | any(.repoUrl == $repo and (.branch | startswith($prefix))))
          )
      ' "$cache" >/dev/null && return 0
    fi
    if [ -n "${MOCK_SAME_SKILL_IN_FLIGHT_COUNT:-}" ] && [ "${MOCK_SAME_SKILL_IN_FLIGHT_COUNT}" -gt 0 ]; then
      agent_matches_skill "$agent_name" "${MOCK_SAME_SKILL_BRANCH:-$BRANCH_PREFIX}" && return 0
    fi
    return 1
  fi

  local run_json branch
  run_json=$(curl -fsS -u "${CURSOR_API_KEY}:" \
    "https://api.cursor.com/v1/agents/${agent_id}/runs/${run_id}")
  if ! jq -e --arg repo "$REPO_SLUG" '
      (.status == "RUNNING" or .status == "CREATING")
      and (((.git // {}).branches // []) | any(.repoUrl == $repo))
    ' <<<"$run_json" >/dev/null; then
    return 1
  fi
  while IFS= read -r branch; do
    [ -z "$branch" ] && continue
    if [[ "$branch" == "$BRANCH_PREFIX"* ]] && agent_matches_skill "$agent_name" "$branch"; then
      return 0
    fi
  done < <(jq -r --arg repo "$REPO_SLUG" '
      (.git // {}).branches // []
      | map(select(.repoUrl == $repo) | .branch)
      | .[]
    ' <<<"$run_json")
  return 1
}

if [ "${MOCK_CURSOR_API:-}" = "1" ] && [ -n "${MOCK_SAME_SKILL_IN_FLIGHT_COUNT:-}" ]; then
  "$SCRIPT_DIR/cursor-workflow-fetch-agents-list.sh" >/dev/null
  echo "${MOCK_SAME_SKILL_IN_FLIGHT_COUNT}"
  exit 0
fi

if [ -z "${CURSOR_API_KEY:-}" ] && [ "${MOCK_CURSOR_API:-}" != "1" ]; then
  echo 0
  exit 0
fi

CACHE=$("$SCRIPT_DIR/cursor-workflow-fetch-agents-list.sh")

count=0
while IFS=$'\t' read -r agent_id run_id agent_name; do
  [ -z "$agent_id" ] && continue
  [ -z "$run_id" ] || [ "$run_id" = "null" ] && continue
  if run_counts_for_issue_skill "$agent_id" "$run_id" "$agent_name"; then
    count=$((count + 1))
  fi
done < <(jq -r '
    .items[]?
    | select(.status == "ACTIVE" and (.latestRunId // "") != "")
    | [.id, .latestRunId, (.name // "")]
    | @tsv
  ' "$CACHE" | tr -d '\r')

echo "$count"
