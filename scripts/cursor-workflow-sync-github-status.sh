#!/usr/bin/env bash
# Sync GitHub issue labels and a single updatable status comment from workflow-state.json.
set -euo pipefail

STATE_FILE="${1:?usage: cursor-workflow-sync-github-status.sh <path-to-workflow-state.json>}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE"
  exit 1
fi

ISSUE=$(jq -r '.issue // empty' "$STATE_FILE")
BRANCH=$(jq -r '.branch // empty' "$STATE_FILE")
STAGE=$(jq -r '.stage // empty' "$STATE_FILE")
PR=$(jq -r '.pr // empty' "$STATE_FILE")
BUGBOT=$(jq -r '.loops.bugbot // 0' "$STATE_FILE")
CI_FIX=$(jq -r '.loops.ci_autofix // 0' "$STATE_FILE")
TOTAL=$(jq -r '.loops.total_runs // 0' "$STATE_FILE")
UPDATED=$(jq -r '.updated_at // empty' "$STATE_FILE")
ACTIVE_SKILL=$(jq -r '.active_skill // empty' "$STATE_FILE")
ACTIVE_AGENT=$(jq -r '.active_agent_id // empty' "$STATE_FILE")

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

if [ -z "$ISSUE" ] || [ -z "$STAGE" ]; then
  echo "State file missing issue or stage"
  exit 1
fi

if [ -z "${GH_TOKEN:-}" ]; then
  echo "GH_TOKEN not set"
  exit 1
fi

HANDOFF_PROGRESS_STAGE="${HANDOFF_PROGRESS_STAGE:-}"
HANDOFF_ACTIVE_SKILL="${HANDOFF_ACTIVE_SKILL:-}"
HANDOFF_ACTIVE_AGENT="${HANDOFF_ACTIVE_AGENT:-}"

DISPLAY_STAGE="$STAGE"
if [ -n "$HANDOFF_PROGRESS_STAGE" ]; then
  DISPLAY_STAGE="$HANDOFF_PROGRESS_STAGE"
fi
if [ -n "$HANDOFF_ACTIVE_SKILL" ]; then
  ACTIVE_SKILL="$HANDOFF_ACTIVE_SKILL"
fi
if [ -n "$HANDOFF_ACTIVE_AGENT" ]; then
  ACTIVE_AGENT="$HANDOFF_ACTIVE_AGENT"
fi

stage_label() {
  case "$1" in
    spec-needs-info) echo "cursor:spec-needs-info" ;;
    spec-in-progress) echo "cursor:spec-in-progress" ;;
    spec-ready) echo "cursor:spec-ready" ;;
    plan-in-progress) echo "cursor:plan-in-progress" ;;
    plan-ready) echo "cursor:plan-ready" ;;
    execute-in-progress) echo "cursor:execute-in-progress" ;;
    execute-ready) echo "cursor:execute-ready" ;;
    demo-in-progress) echo "cursor:demo-in-progress" ;;
    demo-ready) echo "cursor:demo-ready" ;;
    babysit-in-progress) echo "cursor:babysit-in-progress" ;;
    complete) echo "cursor:complete" ;;
    blocked) echo "cursor:blocked" ;;
    *) echo "" ;;
  esac
}

stage_title() {
  case "$1" in
    spec-needs-info) echo "Spec — waiting on you" ;;
    spec-in-progress) echo "Spec — in progress" ;;
    spec-ready) echo "Spec complete → planning queued" ;;
    plan-in-progress) echo "Planning — in progress" ;;
    plan-ready) echo "Plan complete → execute queued" ;;
    execute-in-progress) echo "Execute — in progress" ;;
    execute-ready) echo "Execute complete → demo queued" ;;
    demo-in-progress) echo "Demo — in progress" ;;
    demo-ready) echo "Demo complete → babysit queued" ;;
    babysit-in-progress) echo "Babysit — in progress" ;;
    complete) echo "Complete — ready for your review" ;;
    blocked) echo "Blocked" ;;
    *) echo "$1" ;;
  esac
}

CURSOR_LABELS=(
  "cursor:spec-needs-info" "cursor:spec-in-progress" "cursor:spec-ready"
  "cursor:plan-in-progress" "cursor:plan-ready" "cursor:execute-in-progress"
  "cursor:execute-ready" "cursor:demo-in-progress" "cursor:demo-ready"
  "cursor:babysit-in-progress" "cursor:complete" "cursor:blocked"
)

NEW_LABEL=$(stage_label "$DISPLAY_STAGE")
TITLE=$(stage_title "$DISPLAY_STAGE")

REMOVE_ARGS=()
for label in "${CURSOR_LABELS[@]}"; do
  REMOVE_ARGS+=(--remove-label "$label")
done

if [ -n "$NEW_LABEL" ]; then
  gh issue edit "$ISSUE" --repo "$REPO" "${REMOVE_ARGS[@]}" --add-label "$NEW_LABEL" 2>/dev/null || \
    gh issue edit "$ISSUE" --repo "$REPO" --add-label "$NEW_LABEL"
else
  gh issue edit "$ISSUE" --repo "$REPO" "${REMOVE_ARGS[@]}" 2>/dev/null || true
fi

PR_LINE="—"
if [ -n "$PR" ] && [ "$PR" != "null" ]; then
  PR_LINE="[#${PR}](https://github.com/${REPO}/pull/${PR})"
fi

AGENT_LINE="—"
if [ -n "$ACTIVE_AGENT" ]; then
  AGENT_LINE="[\`${ACTIVE_AGENT}\`](https://cursor.com/agents)"
fi

SKILL_LINE="${ACTIVE_SKILL:-—}"
MARKER="<!-- cursor-workflow-status:v1 -->"

BODY="${MARKER}
## Cursor workflow — issue #${ISSUE}

**${TITLE}**

| | |
|---|---|
| **Stage** | \`${DISPLAY_STAGE}\` (file: \`${STAGE}\`) |
| **Skill** | ${SKILL_LINE} |
| **Branch** | \`${BRANCH:-—}\` |
| **PR** | ${PR_LINE} |
| **Loops** | bugbot ${BUGBOT}/3 · ci ${CI_FIX}/2 · total ${TOTAL}/10 |
| **State updated** | ${UPDATED:-—} |
| **Latest agent** | ${AGENT_LINE} |

[Open Cursor agents](https://cursor.com/agents) · [Workflow docs](https://github.com/${REPO}/blob/main/documents/cursor-workflow/WORKFLOW.md)

_Updated when \`demos/issue-${ISSUE}/workflow-state.json\` changes._"

COMMENT_ID=$(gh api "repos/${REPO}/issues/${ISSUE}/comments" --paginate \
  | jq -r --arg m "$MARKER" '.[] | select(.body | contains($m)) | .id' | head -n1)

if [ -n "$COMMENT_ID" ]; then
  gh api -X PATCH "repos/${REPO}/issues/comments/${COMMENT_ID}" -f body="$BODY" >/dev/null
  echo "Updated status comment on issue #${ISSUE} (label: ${NEW_LABEL:-none})"
else
  gh issue comment "$ISSUE" --repo "$REPO" --body "$BODY" >/dev/null
  echo "Created status comment on issue #${ISSUE} (label: ${NEW_LABEL:-none})"
fi
