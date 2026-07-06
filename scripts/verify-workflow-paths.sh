#!/usr/bin/env bash
# Fail if legacy workflow paths reappear after consolidation under workflow/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LEGACY_DIRS=(
  documents/cursor-workflow
  documents/specs
  documents/plans
  demos
)

for dir in "${LEGACY_DIRS[@]}"; do
  if [[ -e "$dir" ]]; then
    echo "FAIL: legacy directory still exists: $dir" >&2
    exit 1
  fi
done

PATTERNS=(
  'documents/cursor-workflow/'
  'documents/specs/'
  'documents/plans/'
  'demos/issue-'
  'workflow-state\.json'
)

EXCLUDE='^(workflow/README\.md|scripts/verify-workflow-paths\.sh)$'
fail=0

while IFS= read -r -d '' file; do
  [[ "$file" =~ $EXCLUDE ]] && continue
  for pattern in "${PATTERNS[@]}"; do
    if grep -E "$pattern" "$file" >/dev/null 2>&1; then
      echo "FAIL: $file contains legacy pattern: $pattern" >&2
      fail=1
    fi
  done
done < <(git ls-files -z '*.md' '*.yml' '*.yaml' '*.json' '*.sh')

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

# --- Issue workflow.state.json schema ---
REQUIRED_STATE_KEYS=(issue branch stage agents loops)
OPTIONAL_STATE_KEYS=(pr active_skill active_agent_id passback_to passback_reason handoff_pending status_comment_id updated_at)

while IFS= read -r -d '' state_file; do
  for key in "${REQUIRED_STATE_KEYS[@]}"; do
    if ! jq -e --arg k "$key" 'has($k)' "$state_file" >/dev/null 2>&1; then
      echo "FAIL: ${state_file} missing required key: ${key}" >&2
      fail=1
    fi
  done
  # agents must be an object
  if ! jq -e '.agents | type == "object"' "$state_file" >/dev/null 2>&1; then
    echo "FAIL: ${state_file} agents must be an object" >&2
    fail=1
  fi
  # loops must be an object with expected counters
  for counter in bugbot ci_autofix total_runs; do
    if ! jq -e --arg c "$counter" '.loops | has($c)' "$state_file" >/dev/null 2>&1; then
      echo "FAIL: ${state_file} loops missing counter: ${counter}" >&2
      fail=1
    fi
  done
done < <(git ls-files -z 'workflow/issues/issue-*/workflow.state.json')

# --- Skills must reference merge-state helper ---
WORKFLOW_SKILLS=(
  review-and-spec
  planning
  execute
  demo
  create-pr
  babysit-pr
)
for skill in "${WORKFLOW_SKILLS[@]}"; do
  skill_file=".cursor/skills/${skill}/SKILL.md"
  if [ ! -f "$skill_file" ]; then
    echo "FAIL: missing skill file: ${skill_file}" >&2
    fail=1
    continue
  fi
  if ! grep -q 'cursor-workflow-merge-state.sh' "$skill_file"; then
    echo "FAIL: ${skill_file} must reference cursor-workflow-merge-state.sh" >&2
    fail=1
  fi
done

# --- Template must include pass-back fields and handoff_pending ---
TEMPLATE_STATE="workflow/cursor-workflow/templates/workflow.state.json"
if [ -f "$TEMPLATE_STATE" ]; then
  for key in passback_to passback_reason handoff_pending status_comment_id; do
    if ! jq -e --arg k "$key" 'has($k)' "$TEMPLATE_STATE" >/dev/null 2>&1; then
      echo "FAIL: ${TEMPLATE_STATE} missing key: ${key}" >&2
      fail=1
    fi
  done
fi

# --- Handoff hardening scripts exist ---
HANDOFF_SCRIPTS=(
  cursor-workflow-stage-rank.sh
  cursor-workflow-count-active-agents.sh
  cursor-workflow-admission-gate.sh
  cursor-workflow-record-handoff-pending.sh
  cursor-workflow-spawn-agent.sh
  cursor-workflow-babysit-recovery.sh
  cursor-workflow-post-deferral-comment.sh
  cursor-workflow-fetch-agents-list.sh
  cursor-workflow-should-discover-agents.sh
  cursor-workflow-record-spawn-on-branch.sh
  cursor-workflow-load-scripts.sh
  cursor-workflow-archive-completed-issue.sh
  cursor-workflow-post-merge.sh
  cursor-workflow-housekeeping.sh
  test-cursor-workflow-handoff.sh
  test-cursor-workflow-record-agent.sh
)
for script in "${HANDOFF_SCRIPTS[@]}"; do
  if [ ! -x "scripts/${script}" ]; then
    echo "FAIL: missing or non-executable script: scripts/${script}" >&2
    fail=1
  fi
done

COUNT_SCRIPT="scripts/cursor-workflow-count-active-agents.sh"
for keyword in RUNNING CREATING; do
  if ! grep -qF "$keyword" "$COUNT_SCRIPT"; then
    echo "FAIL: ${COUNT_SCRIPT} must count ${keyword} runs toward cap" >&2
    fail=1
  fi
done

if [ ! -f "scripts/cursor-workflow-list-agents.ps1" ]; then
  echo "FAIL: missing scripts/cursor-workflow-list-agents.ps1 (Windows cap diagnostic)" >&2
  fail=1
fi

# --- Handoff docs and workflow ---
WORKFLOW_MD="workflow/cursor-workflow/WORKFLOW.md"
for keyword in changes-requested execute-passback cursor-workflow-merge-state.sh handoff_pending babysit recovery RUNNING status_comment_id CURSOR_AGENTS_LIST_CACHE skip discovery; do
  if ! grep -qF "$keyword" "$WORKFLOW_MD"; then
    echo "FAIL: ${WORKFLOW_MD} must mention ${keyword}" >&2
    fail=1
  fi
done

SETUP_MD="workflow/cursor-workflow/SETUP.md"
for keyword in CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS handoff_pending deferral "in flight"; do
  if ! grep -qF "$keyword" "$SETUP_MD"; then
    echo "FAIL: ${SETUP_MD} must mention ${keyword}" >&2
    fail=1
  fi
done

HANDOFF_YML=".github/workflows/cursor-workflow-handoff.yml"
for keyword in runs changes-requested execute-passback cursor-workflow-spawn-agent.sh cursor-workflow-babysit-recovery.sh cursor-workflow-load-scripts.sh cursor-workflow-should-discover-agents.sh; do
  if ! grep -qF "$keyword" "$HANDOFF_YML"; then
    echo "FAIL: ${HANDOFF_YML} must reference ${keyword}" >&2
    fail=1
  fi
done

# --- PR template gate evidence ---
PR_TEMPLATE="workflow/cursor-workflow/templates/PR.md"
if ! grep -qF "Gate evidence" "$PR_TEMPLATE"; then
  echo "FAIL: ${PR_TEMPLATE} must include Gate evidence section" >&2
  fail=1
fi

# --- Agent side-branch merge rule in review-and-spec skill ---
REVIEW_SPEC_SKILL=".cursor/skills/review-and-spec/SKILL.md"
if ! grep -qF '*-agent-*' "$REVIEW_SPEC_SKILL"; then
  echo "FAIL: ${REVIEW_SPEC_SKILL} must document agent side-branch merge rule" >&2
  fail=1
fi

# --- create-pr skill gate evidence ---
CREATE_PR_SKILL=".cursor/skills/create-pr/SKILL.md"
if ! grep -qF "Gate evidence" "$CREATE_PR_SKILL"; then
  echo "FAIL: ${CREATE_PR_SKILL} must reference Gate evidence" >&2
  fail=1
fi

if ! grep -qF "Closes #NNN" "$PR_TEMPLATE"; then
  echo "FAIL: ${PR_TEMPLATE} must include Closes #NNN for auto-close on merge" >&2
  fail=1
fi

if [ ! -f "workflow/cursor-workflow/RETROSPECTIVES.md" ]; then
  echo "FAIL: missing workflow/cursor-workflow/RETROSPECTIVES.md" >&2
  fail=1
fi

for doc in documents/cloud-agent-part2-test-data.md documents/cloud-agent-tier3-fixture-import-plan.md; do
  if [ ! -f "$doc" ]; then
    echo "FAIL: missing ${doc}" >&2
    fail=1
  fi
done

POST_MERGE_YML=".github/workflows/cursor-workflow-post-merge.yml"
if [ ! -f "$POST_MERGE_YML" ]; then
  echo "FAIL: missing ${POST_MERGE_YML}" >&2
  fail=1
fi

# --- AGENTS.md cross-link ---
if ! grep -qF "handoff_pending" AGENTS.md; then
  echo "FAIL: AGENTS.md must cross-link workflow hardening (handoff_pending)" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

# --- Shell tests for handoff hardening ---
bash scripts/test-cursor-workflow-handoff.sh
bash scripts/test-cursor-workflow-record-agent.sh

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: no legacy workflow paths found"
