#!/usr/bin/env bash
# Sync GitHub issue labels and a single updatable status comment from
# workflow/issues/issue-NNN/workflow.state.json. Intended for GitHub Actions
# (GITHUB_TOKEN or PAT with issues:write). Cloud agents cannot rely on this —
# they push state; this script runs on the subsequent workflow trigger.
set -euo pipefail

MARKER="<!-- cursor-workflow-status:v1 -->"

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

STATE_FILE="${1:?usage: cursor-workflow-sync-github-status.sh <path-to-workflow.state.json>}"

if [ ! -f "$STATE_FILE" ]; then
  echo "State file not found: $STATE_FILE"
  exit 1
fi

if [ "${CURSOR_WORKFLOW_SYNCED:-}" = "1" ] && [ -z "${HANDOFF_PROGRESS_STAGE:-}" ]; then
  echo "sync skipped — already synced this job"
  exit 0
fi

if [ -n "${CURSOR_WORKFLOW_SYNC_CALL_COUNT:-}" ]; then
  CURSOR_WORKFLOW_SYNC_CALL_COUNT=$((CURSOR_WORKFLOW_SYNC_CALL_COUNT + 1))
  export CURSOR_WORKFLOW_SYNC_CALL_COUNT
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
CACHED_COMMENT_ID=$(jq -r '.status_comment_id // empty' "$STATE_FILE")

PASSBACK_TO=$(jq -r '.passback_to // empty' "$STATE_FILE")
PASSBACK_REASON=$(jq -r '.passback_reason // empty' "$STATE_FILE")

agent_id_for_key() {
  jq -r --arg k "$1" '
    ((.agents // {})[$k] // empty)
    | if type == "object" then .id // empty else . end
  ' "$STATE_FILE"
}

agent_link_for_key() {
  local id
  id=$(agent_id_for_key "$1")
  if [ -z "$id" ] || [ "$id" = "null" ]; then
    echo "—"
  else
    echo "[\`${id}\`](https://cursor.com/agents/${id})"
  fi
}

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

if [ -z "$ISSUE" ] || [ -z "$STAGE" ]; then
  echo "State file missing issue or stage"
  exit 1
fi

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$GH_TOKEN" ]; then
  echo "GH_TOKEN or GITHUB_TOKEN not set"
  exit 1
fi
export GH_TOKEN

stage_label() {
  case "$1" in
    spec-needs-info) echo "cursor:spec-needs-info" ;;
    spec-in-progress) echo "cursor:spec-in-progress" ;;
    spec-ready) echo "cursor:spec-ready" ;;
    plan-needs-info) echo "cursor:plan-needs-info" ;;
    plan-in-progress) echo "cursor:plan-in-progress" ;;
    plan-ready) echo "cursor:plan-ready" ;;
    execute-in-progress) echo "cursor:execute-in-progress" ;;
    execute-ready) echo "cursor:execute-ready" ;;
    execute-passback) echo "cursor:execute-passback" ;;
    changes-requested) echo "cursor:changes-requested" ;;
    demo-in-progress) echo "cursor:demo-in-progress" ;;
    demo-ready) echo "cursor:demo-ready" ;;
    create-pr-in-progress) echo "cursor:create-pr-in-progress" ;;
    create-pr-ready) echo "cursor:create-pr-ready" ;;
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
    plan-needs-info) echo "Planning — waiting on you (bug repro)" ;;
    plan-in-progress) echo "Planning — in progress" ;;
    plan-ready) echo "Plan complete → execute queued" ;;
    execute-in-progress) echo "Execute — in progress" ;;
    execute-ready) echo "Execute complete → demo queued" ;;
    execute-passback) echo "Execute pass-back — demo found code defect" ;;
    changes-requested) echo "Changes requested — scope added after complete" ;;
    demo-in-progress) echo "Demo — in progress" ;;
    demo-ready) echo "Demo complete → create PR queued" ;;
    create-pr-in-progress) echo "Create PR — in progress" ;;
    create-pr-ready) echo "PR description complete → babysit queued" ;;
    babysit-in-progress) echo "Babysit — in progress" ;;
    complete) echo "Complete — ready for your review" ;;
    blocked) echo "Blocked" ;;
    *) echo "$1" ;;
  esac
}

CURSOR_LABELS=(
  "cursor:spec-needs-info"
  "cursor:spec-in-progress"
  "cursor:spec-ready"
  "cursor:plan-needs-info"
  "cursor:plan-in-progress"
  "cursor:plan-ready"
  "cursor:execute-in-progress"
  "cursor:execute-ready"
  "cursor:execute-passback"
  "cursor:changes-requested"
  "cursor:demo-in-progress"
  "cursor:demo-ready"
  "cursor:create-pr-in-progress"
  "cursor:create-pr-ready"
  "cursor:babysit-in-progress"
  "cursor:complete"
  "cursor:blocked"
)

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

NEW_LABEL=$(stage_label "$DISPLAY_STAGE")
TITLE=$(stage_title "$DISPLAY_STAGE")

if [ "${MOCK_GITHUB_SYNC:-}" != "1" ]; then
CURRENT_LABELS=$(gh issue view "$ISSUE" --repo "$REPO" --json labels -q '.labels[].name' 2>/dev/null || echo "")
REMOVE_ARGS=()
for label in "${CURSOR_LABELS[@]}"; do
  if echo "$CURRENT_LABELS" | grep -qxF "$label"; then
    REMOVE_ARGS+=(--remove-label "$label")
  fi
done

if [ ${#REMOVE_ARGS[@]} -gt 0 ] || [ -n "$NEW_LABEL" ]; then
  EDIT_ARGS=("${REMOVE_ARGS[@]}")
  if [ -n "$NEW_LABEL" ]; then
    EDIT_ARGS+=(--add-label "$NEW_LABEL")
  fi
  gh issue edit "$ISSUE" --repo "$REPO" "${EDIT_ARGS[@]}"
fi
fi

PR_LINE="—"
if [ -n "$PR" ] && [ "$PR" != "null" ]; then
  PR_LINE="[#${PR}](https://github.com/${REPO}/pull/${PR})"
fi

LATEST_AGENT_LINE="—"
if [ -n "$ACTIVE_AGENT" ] && [ "$ACTIVE_AGENT" != "null" ]; then
  LATEST_AGENT_LINE="[\`${ACTIVE_AGENT}\`](https://cursor.com/agents/${ACTIVE_AGENT})"
fi

SKILL_LINE="${ACTIVE_SKILL:-—}"

PASSBACK_LINES=""
if [ -n "$PASSBACK_TO" ] && [ "$PASSBACK_TO" != "null" ]; then
  PASSBACK_TARGET_LINE="$PASSBACK_TO"
  PASSBACK_AGENT_LINK=$(agent_link_for_key "$PASSBACK_TO")
  if [ "$PASSBACK_AGENT_LINK" != "—" ]; then
    PASSBACK_TARGET_LINE="${PASSBACK_TO} (${PASSBACK_AGENT_LINK})"
  fi
  PASSBACK_LINES="| **Pass-back target** | ${PASSBACK_TARGET_LINE} |"
  if [ -n "$PASSBACK_REASON" ] && [ "$PASSBACK_REASON" != "null" ]; then
    PASSBACK_LINES="${PASSBACK_LINES}
| **Pass-back reason** | ${PASSBACK_REASON} |"
  fi
fi

AGENTS_TABLE="| **Review & spec** | $(agent_link_for_key review-and-spec) |
| **Planning** | $(agent_link_for_key planning) |
| **Execute** | $(agent_link_for_key execute) |
| **Demo** | $(agent_link_for_key demo) |
| **Create PR** | $(agent_link_for_key create-pr) |
| **PR babysitter** | $(agent_link_for_key babysit-pr) |"

CONTINUED_ID=$(agent_id_for_key review-and-spec-continued)
if [ -n "$CONTINUED_ID" ] && [ "$CONTINUED_ID" != "null" ]; then
  AGENTS_TABLE="| **Review & spec** | $(agent_link_for_key review-and-spec) |
| **Review & spec (continued)** | $(agent_link_for_key review-and-spec-continued) |
| **Planning** | $(agent_link_for_key planning) |
| **Execute** | $(agent_link_for_key execute) |
| **Demo** | $(agent_link_for_key demo) |
| **Create PR** | $(agent_link_for_key create-pr) |
| **PR babysitter** | $(agent_link_for_key babysit-pr) |"
fi

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
| **Latest agent** | ${LATEST_AGENT_LINE} |
${PASSBACK_LINES}

### Agent conversations

| Stage | Link |
|---|---|
${AGENTS_TABLE}

[Open Cursor agents](https://cursor.com/agents) · [Workflow docs](https://github.com/${REPO}/blob/main/workflow/cursor-workflow/WORKFLOW.md)

_This comment is updated automatically on every push to \`${BRANCH:-cursor/issue-*}\` from \`workflow/issues/issue-${ISSUE}/workflow.state.json\`._"

COMMENT_ID=""
PATCH_USED=false
if [ -n "$CACHED_COMMENT_ID" ] && [ "$CACHED_COMMENT_ID" != "null" ]; then
  if [ "${MOCK_GITHUB_SYNC:-}" = "1" ]; then
    if [ "${MOCK_COMMENT_PATCH_404:-}" = "1" ]; then
      COMMENT_ID=""
    else
      COMMENT_ID="$CACHED_COMMENT_ID"
      PATCH_USED=true
      echo "MOCK PATCH comment ${COMMENT_ID}" >&2
    fi
  else
    http_code="$(_gh_api_http_code -X PATCH "repos/${REPO}/issues/comments/${CACHED_COMMENT_ID}" -f body="$BODY")"
    if [ "$http_code" = "000" ]; then
      http_code=404
    fi
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
      COMMENT_ID="$CACHED_COMMENT_ID"
      PATCH_USED=true
    fi
  fi
fi

if [ -z "$COMMENT_ID" ]; then
  if [ "${MOCK_GITHUB_SYNC:-}" = "1" ]; then
    COMMENT_ID="${MOCK_NEW_COMMENT_ID:-999001}"
    echo "MOCK LIST+CREATE comment ${COMMENT_ID}" >&2
  else
    COMMENT_ID=$(gh api "repos/${REPO}/issues/${ISSUE}/comments" --paginate \
      | jq -r --arg m "$MARKER" '.[] | select(.body != null and (.body | contains($m))) | .id' | head -n1)
    COMMENT_ID="${COMMENT_ID%%$'\n'*}"
    if [ -n "$COMMENT_ID" ]; then
      gh api -X PATCH "repos/${REPO}/issues/comments/${COMMENT_ID}" -f body="$BODY" >/dev/null
      PATCH_USED=true
    else
      gh issue comment "$ISSUE" --repo "$REPO" --body "$BODY" >/dev/null
      COMMENT_ID=$(gh api "repos/${REPO}/issues/${ISSUE}/comments" --paginate \
        | jq -r --arg m "$MARKER" '.[] | select(.body != null and (.body | contains($m))) | .id' | head -n1)
      COMMENT_ID="${COMMENT_ID%%$'\n'*}"
    fi
  fi
fi

export CURSOR_WORKFLOW_SYNCED=1
if [ -n "$COMMENT_ID" ] && [ "$COMMENT_ID" != "null" ]; then
  export CURSOR_WORKFLOW_STATUS_COMMENT_ID="$COMMENT_ID"
fi

if [ "$PATCH_USED" = "true" ]; then
  echo "Updated status comment ${COMMENT_ID} on issue #${ISSUE} (label: ${NEW_LABEL:-none})"
else
  echo "Created status comment on issue #${ISSUE} (label: ${NEW_LABEL:-none})"
fi
