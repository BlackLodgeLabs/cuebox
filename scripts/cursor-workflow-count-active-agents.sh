#!/usr/bin/env bash
# Count ACTIVE Cursor Cloud Agents whose latest run targets this repository.
# Prints integer count to stdout; always exit 0.
set -euo pipefail

if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
  echo "${MOCK_ACTIVE_AGENT_COUNT:-0}"
  exit 0
fi

if [ -z "${CURSOR_API_KEY:-}" ]; then
  echo 0
  exit 0
fi

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
REPO_SLUG="github.com/${REPO}"

agent_targets_repo() {
  local agent_id="$1"
  local agent_json run_id
  agent_json=$(curl -sS -u "${CURSOR_API_KEY}:" \
    "https://api.cursor.com/v1/agents/${agent_id}")
  if [ "$(echo "$agent_json" | jq -r '.status // empty')" != "ACTIVE" ]; then
    return 1
  fi
  run_id=$(echo "$agent_json" | jq -r '.latestRunId // empty')
  if [ -z "$run_id" ] || [ "$run_id" = "null" ]; then
    return 1
  fi
  curl -sS -u "${CURSOR_API_KEY}:" \
    "https://api.cursor.com/v1/agents/${agent_id}/runs/${run_id}" \
    | jq -e --arg repo "$REPO_SLUG" '
        .git.branches // []
        | any(.repoUrl == $repo)
      ' >/dev/null
}

count=0
cursor=""
while true; do
  url="https://api.cursor.com/v1/agents?limit=100"
  if [ -n "$cursor" ]; then
    url="${url}&cursor=${cursor}"
  fi
  response=$(curl -sS -u "${CURSOR_API_KEY}:" "$url")
  while IFS= read -r agent_id; do
    [ -z "$agent_id" ] && continue
    if agent_targets_repo "$agent_id"; then
      count=$((count + 1))
    fi
  done < <(echo "$response" | jq -r '.items[]? | select(.status == "ACTIVE") | .id // empty')

  cursor=$(echo "$response" | jq -r '.nextCursor // empty')
  if [ -z "$cursor" ] || [ "$cursor" = "null" ]; then
    break
  fi
done

echo "$count"
