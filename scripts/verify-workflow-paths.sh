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
OPTIONAL_STATE_KEYS=(pr active_skill active_agent_id passback_to passback_reason updated_at)

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

# --- Template must include pass-back fields ---
TEMPLATE_STATE="workflow/cursor-workflow/templates/workflow.state.json"
if [ -f "$TEMPLATE_STATE" ]; then
  for key in passback_to passback_reason; do
    if ! jq -e --arg k "$key" 'has($k)' "$TEMPLATE_STATE" >/dev/null 2>&1; then
      echo "FAIL: ${TEMPLATE_STATE} missing key: ${key}" >&2
      fail=1
    fi
  done
fi

# --- Handoff docs and workflow ---
WORKFLOW_MD="workflow/cursor-workflow/WORKFLOW.md"
for keyword in changes-requested execute-passback cursor-workflow-merge-state.sh; do
  if ! grep -qF "$keyword" "$WORKFLOW_MD"; then
    echo "FAIL: ${WORKFLOW_MD} must mention ${keyword}" >&2
    fail=1
  fi
done

HANDOFF_YML=".github/workflows/cursor-workflow-handoff.yml"
for keyword in runs changes-requested execute-passback; do
  if ! grep -qF "$keyword" "$HANDOFF_YML"; then
    echo "FAIL: ${HANDOFF_YML} must reference ${keyword}" >&2
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: no legacy workflow paths found"
