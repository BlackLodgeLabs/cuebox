#!/usr/bin/env bash
# Backfill review-and-spec agent links from the Cursor API when agents pushed to
# the issue branch (user-triggered @cursoragent spec / continue spec runs).
# Handoff stages record agents directly in cursor-workflow-handoff.yml.
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-discover-agents.sh <state-file> <branch>}"
BRANCH="${2:?}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${CURSOR_API_KEY:-}" ] && [ "${MOCK_CURSOR_API:-}" != "1" ]; then
  exit 0
fi

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
REPO_SLUG="github.com/${REPO}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

if "$SCRIPT_DIR/cursor-workflow-should-discover-agents.sh" "$STATE_FILE"; then
  echo "Discovery skipped (stage or agents already satisfied)"
  exit 0
fi

agent_id_from_state() {
  jq -r --arg k "$1" '
    ((.agents // {})[$k] // empty)
    | if type == "object" then .id // empty else . end
  ' "$2"
}

need_spec=$(agent_id_from_state review-and-spec "$STATE_FILE")
need_continued=$(agent_id_from_state review-and-spec-continued "$STATE_FILE")

ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
REL_PATH="workflow/issues/issue-${ISSUE}/workflow.state.json"

if [ "${MOCK_CURSOR_API:-}" != "1" ]; then
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git fetch origin "$BRANCH"
  git checkout -B "$BRANCH" "origin/$BRANCH"

  need_spec=$(agent_id_from_state review-and-spec "$REL_PATH")
  need_continued=$(agent_id_from_state review-and-spec-continued "$REL_PATH")
  if [ -n "$need_spec" ] && [ "$need_spec" != "null" ] && [ -n "$need_continued" ] && [ "$need_continued" != "null" ]; then
    exit 0
  fi
else
  REL_PATH="$STATE_FILE"
fi

known_ids=$(jq -r '
  [.agents // {} | to_entries[] | .value | if type == "object" then .id // empty else . end]
  | map(select(. != "" and . != null))
  | unique
  | .[]
' "$REL_PATH")

branch_matches() {
  local agent_id="$1" run_id="$2" created_at="$3"
  if [ -z "$run_id" ] || [ "$run_id" = "null" ]; then
    return 1
  fi
  if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
    if [ -n "${MOCK_BRANCH_MATCH_AGENT:-}" ] && [ "$agent_id" = "${MOCK_BRANCH_MATCH_AGENT}" ]; then
      MATCHED_CREATED_AT="${created_at:-1970-01-01T00:00:00Z}"
      return 0
    fi
    return 1
  fi
  if curl -sS -u "${CURSOR_API_KEY}:" \
    "https://api.cursor.com/v1/agents/${agent_id}/runs/${run_id}" \
    | jq -e --arg repo "$REPO_SLUG" --arg branch "$BRANCH" '
        .git.branches // []
        | any(.repoUrl == $repo and .branch == $branch)
      ' >/dev/null; then
    MATCHED_CREATED_AT="${created_at:-1970-01-01T00:00:00Z}"
    return 0
  fi
  return 1
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

export CURSOR_AGENTS_STATE_FILE="$STATE_FILE"
CACHE=$("$SCRIPT_DIR/cursor-workflow-fetch-agents-list.sh")

while IFS=$'\t' read -r agent_id run_id created_at; do
  [ -z "$agent_id" ] && continue
  if is_known "$agent_id"; then
    continue
  fi
  MATCHED_CREATED_AT=""
  if branch_matches "$agent_id" "$run_id" "$created_at"; then
    printf '%s\t%s\n' "${MATCHED_CREATED_AT:-1970-01-01T00:00:00Z}" "$agent_id" >> "$CANDIDATES_FILE"
  fi
done < <(jq -r '
    .items[]?
    | [.id, (.latestRunId // ""), (.createdAt // "1970-01-01T00:00:00Z")]
    | @tsv
  ' "$CACHE" | tr -d '\r')

if [ ! -s "$CANDIDATES_FILE" ]; then
  exit 0
fi

mapfile -t SPEC_CANDIDATES < <(sort -t $'\t' -k1,1 "$CANDIDATES_FILE" | cut -f2)

spec_id=""
continued_id=""
if [ -z "$need_spec" ] || [ "$need_spec" = "null" ]; then
  if [ ${#SPEC_CANDIDATES[@]} -ge 1 ]; then
    spec_id="${SPEC_CANDIDATES[0]}"
  fi
fi

if { [ -z "$need_continued" ] || [ "$need_continued" = "null" ]; } && [ ${#SPEC_CANDIDATES[@]} -ge 2 ]; then
  continued_id="${SPEC_CANDIDATES[1]}"
  if [ "$continued_id" = "$spec_id" ]; then
    continued_id=""
  fi
fi

if [ -z "$spec_id" ] && [ -z "$continued_id" ]; then
  exit 0
fi

jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg spec "$spec_id" \
  --arg cont "$continued_id" \
  '.agents //= {}
   | if $spec != "" and $spec != "null" then .agents["review-and-spec"] = $spec else . end
   | if $cont != "" and $cont != "null" then .agents["review-and-spec-continued"] = $cont else . end
   | .updated_at = $ts' \
  "$REL_PATH" > "${REL_PATH}.tmp" && mv "${REL_PATH}.tmp" "$REL_PATH"

if [ "${MOCK_CURSOR_API:-}" = "1" ]; then
  cp "$REL_PATH" "$STATE_FILE"
  exit 0
fi

git add "$REL_PATH"
git diff --staged --quiet && exit 0

git commit -m "chore(workflow): discover spec agent links for issue #${ISSUE}"
git push origin "$BRANCH"
echo "Discovered spec agent(s) for issue #${ISSUE} on ${BRANCH}"
