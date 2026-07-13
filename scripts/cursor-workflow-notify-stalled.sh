#!/usr/bin/env bash
# Post a one-time stalled-workflow notification on the issue (terminal handoff failure).
# Usage: cursor-workflow-notify-stalled.sh <state-file> <reason> [expected-skill]
set -euo pipefail

MARKER="<!-- cursor-workflow-stalled-notify:v1 -->"

STATE_FILE="${1:?usage: cursor-workflow-notify-stalled.sh <state-file> <reason> [expected-skill]}"
REASON="${2:?}"
EXPECTED_SKILL="${3:-}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF="${WF:-${SCRIPTS_DIR:-$SCRIPT_DIR}}"

ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
BRANCH=$(jq -r '.branch // empty' "$STATE_FILE")
STAGE=$(jq -r '.stage // empty' "$STATE_FILE")
PR=$(jq -r '.pr // empty' "$STATE_FILE")

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

if [ -z "$ISSUE" ]; then
  echo "State file missing issue number" >&2
  exit 1
fi

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$GH_TOKEN" ]; then
  echo "GH_TOKEN or GITHUB_TOKEN not set" >&2
  exit 1
fi
export GH_TOKEN

already=$(gh api "repos/${REPO}/issues/${ISSUE}/comments" --paginate \
  | jq -r --arg m "$MARKER" '[.[] | select(.body != null and (.body | contains($m)))] | length')
if [ "${already:-0}" != "0" ]; then
  echo "Stalled notification already posted on issue #${ISSUE}"
  exit 0
fi

# shellcheck disable=SC1090
eval "$("$WF/cursor-workflow-resolve-notify-targets.sh" "$ISSUE")"

reason_text() {
  case "$1" in
    execute-active)
      echo "Execute finished at execute-ready but active_skill is still execute — demo should run next, not another execute pass."
      ;;
    at-cap)
      echo "Global agent cap is full after retries."
      ;;
    api-400)
      echo "Cursor API returned 400 (quota/plan limit) after retries."
      ;;
    pending-lock)
      echo "Pending-lock race could not be resolved after retries."
      ;;
    missing-api-key)
      echo "CURSOR_API_KEY is not set and API spawn failed."
      ;;
    passback-failed)
      echo "Pass-back API call failed and no successful spawn occurred."
      ;;
    spawn-failed)
      echo "Agent spawn failed after retries."
      ;;
    *)
      echo "Workflow handoff stalled (${1})."
      ;;
  esac
}

recovery_hint() {
  local skill="$1"
  local issue_num="$2"
  local branch_name="$3"
  if [ -n "$skill" ]; then
    echo "@cursoragent use ${skill} skill for issue #${issue_num} on branch ${branch_name}"
  else
    echo "Actions → **Cursor workflow handoff** → **Run workflow** with issue #${issue_num}"
  fi
}

HUMAN_REASON=$(reason_text "$REASON")
RECOVERY=$(recovery_hint "$EXPECTED_SKILL" "$ISSUE" "${BRANCH:-—}")

AGENT_LINK=""
if [ -n "$EXPECTED_SKILL" ]; then
  agent_id=$(jq -r --arg k "$EXPECTED_SKILL" '((.agents // {})[$k] // empty) | if type == "object" then .id // empty else . end' "$STATE_FILE")
  if [ -n "$agent_id" ] && [ "$agent_id" != "null" ]; then
    AGENT_LINK="Last agent conversation: https://cursor.com/agents/${agent_id}"
  fi
fi

BODY="${MENTIONS} — The cursor workflow for issue #${ISSUE} has stalled.

**Reason:** ${HUMAN_REASON}

**Current stage:** \`${STAGE:-—}\` · **Branch:** \`${BRANCH:-—}\`"

if [ -n "$EXPECTED_SKILL" ]; then
  BODY="${BODY} · **Expected next skill:** \`${EXPECTED_SKILL}\`"
fi

if [ -n "$PR" ] && [ "$PR" != "null" ]; then
  BODY="${BODY} · **PR:** #${PR}"
fi

BODY="${BODY}

**Recovery:**
1. ${RECOVERY}
2. Or: Actions → **Cursor workflow handoff** → **Run workflow** with issue #${ISSUE}"

if [ -n "$AGENT_LINK" ]; then
  BODY="${BODY}
3. ${AGENT_LINK}"
fi

BODY="${BODY}

${MARKER}"

gh issue comment "$ISSUE" --repo "$REPO" --body "$BODY"
echo "Posted stalled notification on issue #${ISSUE}"
