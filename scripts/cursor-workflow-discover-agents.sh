#!/usr/bin/env bash
# Backfill review-and-spec agent links from the Cursor API when agents pushed to
# the issue branch (user-triggered @cursoragent spec / continue spec runs).
# Handoff stages record agents directly in cursor-workflow-handoff.yml.
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-discover-agents.sh <state-file> <branch>}"
BRANCH="${2:?}"

if [ -z "${CURSOR_API_KEY:-}" ]; then
  exit 0
fi

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
REPO_SLUG="github.com/${REPO}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

need_spec=$(jq -r '.agents["review-and-spec"] // empty | if type == "object" then .id // empty else . end' "$STATE_FILE")
need_continued=$(jq -r '.agents["review-and-spec-continued"] // empty | if type == "object" then .id // empty else . end' "$STATE_FILE")
if [ -n "$need_spec" ] && [ "$need_spec" != "null" ] && [ -n "$need_continued" ] && [ "$need_continued" != "null" ]; then
  exit 0
fi

known_ids=$(jq -r '
  [.agents // {} | to_entries[] | .value | if type == "object" then .id // empty else . end]
  | map(select(. != "" and . != null))
  | unique
  | .[]
' "$STATE_FILE")

branch_matches() {
  local agent_id="$1"
  local run_id
  run_id=$(curl -sS -u "${CURSOR_API_KEY}:" \
    "https://api.cursor.com/v1/agents/${agent_id}" \
    | jq -r '.latestRunId // empty')
  if [ -z "$run_id" ] || [ "$run_id" = "null" ]; then
    return 1
  fi
  curl -sS -u "${CURSOR_API_KEY}:" \
    "https://api.cursor.com/v1/agents/${agent_id}/runs/${run_id}" \
    | jq -e --arg repo "$REPO_SLUG" --arg branch "$BRANCH" '
        .git.branches // []
        | any(.repoUrl == $repo and .branch == $branch)
      ' >/dev/null
}

is_known() {
  local id="$1"
  local known
  for known in $known_ids; do
    if [ "$known" = "$id" ]; then
      return 0
    fi
  done
  return 1
}

CANDIDATES_FILE=$(mktemp)
trap 'rm -f "$CANDIDATES_FILE"' EXIT

cursor=""
while true; do
  url="https://api.cursor.com/v1/agents?limit=50"
  if [ -n "$cursor" ]; then
    url="${url}&cursor=${cursor}"
  fi
  response=$(curl -sS -u "${CURSOR_API_KEY}:" "$url")
  while IFS= read -r agent_id; do
    [ -z "$agent_id" ] && continue
    if is_known "$agent_id"; then
      continue
    fi
    if branch_matches "$agent_id"; then
      created=$(curl -sS -u "${CURSOR_API_KEY}:" \
        "https://api.cursor.com/v1/agents/${agent_id}" \
        | jq -r '.createdAt // empty')
      printf '%s\t%s\n' "${created:-1970-01-01T00:00:00Z}" "$agent_id" >> "$CANDIDATES_FILE"
    fi
  done < <(echo "$response" | jq -r '.items[]?.id // empty')

  cursor=$(echo "$response" | jq -r '.nextCursor // empty')
  if [ -z "$cursor" ] || [ "$cursor" = "null" ]; then
    break
  fi
done

if [ ! -s "$CANDIDATES_FILE" ]; then
  exit 0
fi

mapfile -t SPEC_CANDIDATES < <(sort -t $'\t' -k1,1 "$CANDIDATES_FILE" | cut -f2)

updates=0
if [ -z "$need_spec" ] || [ "$need_spec" = "null" ]; then
  if [ ${#SPEC_CANDIDATES[@]} -ge 1 ]; then
    jq --arg id "${SPEC_CANDIDATES[0]}" \
      '.agents //= {} | .agents["review-and-spec"] = $id' \
      "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    need_spec="${SPEC_CANDIDATES[0]}"
    updates=1
  fi
fi

if { [ -z "$need_continued" ] || [ "$need_continued" = "null" ]; } && [ ${#SPEC_CANDIDATES[@]} -ge 2 ]; then
  continued_id="${SPEC_CANDIDATES[1]}"
  if [ "$continued_id" != "$need_spec" ]; then
    jq --arg id "$continued_id" \
      '.agents //= {} | .agents["review-and-spec-continued"] = $id' \
      "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    updates=1
  fi
fi

if [ "$updates" -eq 0 ]; then
  exit 0
fi

ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
REL_PATH="workflow/issues/issue-${ISSUE}/workflow.state.json"

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg spec "$(jq -r '.agents["review-and-spec"] // empty' "$STATE_FILE")" \
  --arg cont "$(jq -r '.agents["review-and-spec-continued"] // empty' "$STATE_FILE")" \
  '.agents //= {}
   | if $spec != "" and $spec != "null" then .agents["review-and-spec"] = $spec else . end
   | if $cont != "" and $cont != "null" then .agents["review-and-spec-continued"] = $cont else . end
   | .updated_at = $ts' \
  "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"

git add "$REL_PATH"
git diff --staged --quiet && exit 0

git commit -m "chore(workflow): discover spec agent links for issue #${ISSUE}"
git push origin "$BRANCH"
echo "Discovered spec agent(s) for issue #${ISSUE} on ${BRANCH}"
