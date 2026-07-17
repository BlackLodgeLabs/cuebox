#!/usr/bin/env bash
# Portable workflow regression — no Cuebox product paths or Docker required.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

LEGACY_DIRS=(
  documents/cursor-workflow
  documents/specs
  documents/plans
  demos
)

for dir in "${LEGACY_DIRS[@]}"; do
  if [[ -e "$dir" ]]; then
    echo "FAIL: legacy directory still exists: $dir" >&2
    fail=1
  fi
done

PATTERNS=(
  'documents/cursor-workflow/'
  'documents/specs/'
  'documents/plans/'
  'demos/issue-'
  'workflow-state\.json'
)

EXCLUDE='^(workflow/README\.md|scripts/verify-workflow-(paths|portable|cuebox-adapter)\.sh)$'

while IFS= read -r -d '' file; do
  [[ "$file" =~ $EXCLUDE ]] && continue
  for pattern in "${PATTERNS[@]}"; do
    if grep -E "$pattern" "$file" >/dev/null 2>&1; then
      echo "FAIL: $file contains legacy pattern: $pattern" >&2
      fail=1
    fi
  done
done < <(git ls-files -z '*.md' '*.yml' '*.yaml' '*.json' '*.sh')

# --- State schema validation ---
while IFS= read -r -d '' state_file; do
  if ! bash scripts/cursor-workflow-validate-state.sh "$state_file"; then
    fail=1
  fi
done < <(git ls-files -z 'workflow/issues/issue-*/workflow.state.json')

TEMPLATE_STATE="workflow/cursor-workflow/templates/workflow.state.json"
if [[ -f "$TEMPLATE_STATE" ]]; then
  if ! bash scripts/cursor-workflow-validate-state.sh "$TEMPLATE_STATE"; then
    fail=1
  fi
  for key in passback_to passback_reason handoff_pending status_comment_id schema_version; do
    if ! jq -e --arg k "$key" 'has($k)' "$TEMPLATE_STATE" >/dev/null 2>&1; then
      echo "FAIL: ${TEMPLATE_STATE} missing key: ${key}" >&2
      fail=1
    fi
  done
fi

# --- Skills must reference merge-state helper ---
WORKFLOW_SKILLS=(
  review-and-spec
  planning
  execute
  demo
  create-pr
  babysit-pr
  workflow-review
)
for skill in "${WORKFLOW_SKILLS[@]}"; do
  skill_file=".cursor/skills/${skill}/SKILL.md"
  if [[ ! -f "$skill_file" ]]; then
    echo "FAIL: missing skill file: ${skill_file}" >&2
    fail=1
    continue
  fi
  if ! grep -q 'cursor-workflow-merge-state.sh' "$skill_file"; then
    echo "FAIL: ${skill_file} must reference cursor-workflow-merge-state.sh" >&2
    fail=1
  fi
done

# --- Handoff hardening scripts exist ---
HANDOFF_SCRIPTS=(
  cursor-workflow-stage-rank.sh
  cursor-workflow-count-active-agents.sh
  cursor-workflow-admission-gate.sh
  cursor-workflow-record-handoff-pending.sh
  cursor-workflow-refetch-state.sh
  cursor-workflow-spawn-agent.sh
  cursor-workflow-babysit-recovery.sh
  cursor-workflow-handoff-recovery.sh
  cursor-workflow-passback-run.sh
  cursor-workflow-ensure-pr-on-branch.sh
  cursor-workflow-infer-reopen.sh
  cursor-workflow-ensure-before-sha.sh
  cursor-workflow-push-diff-includes.sh
  cursor-workflow-post-deferral-comment.sh
  cursor-workflow-resolve-notify-targets.sh
  cursor-workflow-notify-stalled.sh
  cursor-workflow-notify-complete.sh
  cursor-workflow-fetch-agents-list.sh
  cursor-workflow-should-discover-agents.sh
  cursor-workflow-record-spawn-on-branch.sh
  cursor-workflow-load-scripts.sh
  cursor-workflow-archive-completed-issue.sh
  cursor-workflow-linked-issues-from-text.sh
  cursor-workflow-strip-cursor-labels.sh
  cursor-workflow-post-merge.sh
  cursor-workflow-delete-stale-branches.sh
  cursor-workflow-housekeeping.sh
  cursor-workflow-migrate-state.sh
  cursor-workflow-validate-state.sh
  test-cursor-workflow-handoff.sh
  test-cursor-workflow-record-agent.sh
  test-cursor-workflow-strip-cursor-labels.sh
  test-cursor-workflow-delete-stale-branches.sh
  test-cursor-workflow-mcp-github.sh
  test-cursor-workflow-config.sh
  test-cursor-workflow-load-scripts.sh
  test-cursor-workflow-state-schema.sh
)
for script in "${HANDOFF_SCRIPTS[@]}"; do
  if [[ ! -x "scripts/${script}" ]]; then
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

if [[ ! -f "scripts/cursor-workflow-list-agents.ps1" ]]; then
  echo "FAIL: missing scripts/cursor-workflow-list-agents.ps1 (Windows cap diagnostic)" >&2
  fail=1
fi

# --- Handoff docs and workflow ---
WORKFLOW_MD="workflow/cursor-workflow/WORKFLOW.md"
for keyword in changes-requested execute-passback cursor-workflow-merge-state.sh handoff_pending babysit recovery RUNNING status_comment_id CURSOR_AGENTS_LIST_CACHE skip discovery workflow-review @cursoragent workflow-review notify-stalled resolve-notify-targets stalled notification core adapter; do
  if ! grep -qF "$keyword" "$WORKFLOW_MD"; then
    echo "FAIL: ${WORKFLOW_MD} must mention ${keyword}" >&2
    fail=1
  fi
done

SETUP_MD="workflow/cursor-workflow/SETUP.md"
for keyword in CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS handoff_pending deferral "in flight" notify-stalled stalled notification workflow.config.yaml; do
  if ! grep -qF "$keyword" "$SETUP_MD"; then
    echo "FAIL: ${SETUP_MD} must mention ${keyword}" >&2
    fail=1
  fi
done

HANDOFF_YML=".github/workflows/cursor-workflow-handoff.yml"

LOAD_SCRIPTS="scripts/cursor-workflow-load-scripts.sh"
while IFS= read -r script; do
  if ! grep -qF "$script" "$LOAD_SCRIPTS"; then
    echo "FAIL: ${LOAD_SCRIPTS} must list ${script} (referenced in ${HANDOFF_YML})" >&2
    fail=1
  fi
done < <(grep -oE '\$WF/cursor-workflow-[a-z0-9-]+\.sh' "$HANDOFF_YML" | sed 's|^\$WF/||' | sort -u)
for keyword in runs changes-requested execute-passback cursor-workflow-spawn-agent.sh cursor-workflow-handoff-recovery.sh cursor-workflow-ensure-before-sha.sh cursor-workflow-load-scripts.sh cursor-workflow-should-discover-agents.sh cursor-workflow-passback-run.sh cursor-workflow-ensure-pr-on-branch.sh cursor-workflow-infer-reopen.sh Load workflow config; do
  if ! grep -qF "$keyword" "$HANDOFF_YML"; then
    echo "FAIL: ${HANDOFF_YML} must reference ${keyword}" >&2
    fail=1
  fi
done

if ! grep -A5 'cursor-workflow-sync-github-status.sh' "$HANDOFF_YML" | grep -qF 'cursor-workflow-handoff-recovery.sh'; then
  echo "FAIL: ${HANDOFF_YML} resync-status must invoke cursor-workflow-handoff-recovery.sh after sync" >&2
  fail=1
fi

PR_TEMPLATE="workflow/cursor-workflow/templates/PR.md"
if ! grep -qF "Gate evidence" "$PR_TEMPLATE"; then
  echo "FAIL: ${PR_TEMPLATE} must include Gate evidence section" >&2
  fail=1
fi

REVIEW_SPEC_SKILL=".cursor/skills/review-and-spec/SKILL.md"
if ! grep -qF '*-agent-*' "$REVIEW_SPEC_SKILL"; then
  echo "FAIL: ${REVIEW_SPEC_SKILL} must document agent side-branch merge rule" >&2
  fail=1
fi

CREATE_PR_SKILL=".cursor/skills/create-pr/SKILL.md"
if ! grep -qF "Gate evidence" "$CREATE_PR_SKILL"; then
  echo "FAIL: ${CREATE_PR_SKILL} must reference Gate evidence" >&2
  fail=1
fi

if ! grep -qF "Closes #NNN" "$PR_TEMPLATE"; then
  echo "FAIL: ${PR_TEMPLATE} must include Closes #NNN for auto-close on merge" >&2
  fail=1
fi

MCP_GITHUB_MD="workflow/cursor-workflow/MCP-GITHUB.md"
if [[ ! -f "$MCP_GITHUB_MD" ]]; then
  echo "FAIL: missing ${MCP_GITHUB_MD}" >&2
  fail=1
else
  for keyword in 'Idempotency markers' GetMcpTools 'cursor-mcp-spec-questions:v1'; do
    if ! grep -qF "$keyword" "$MCP_GITHUB_MD"; then
      echo "FAIL: ${MCP_GITHUB_MD} must mention ${keyword}" >&2
      fail=1
    fi
  done
fi

if ! grep -qF 'MCP-GITHUB.md' "$WORKFLOW_MD"; then
  echo "FAIL: ${WORKFLOW_MD} must link MCP-GITHUB.md" >&2
  fail=1
fi
if ! grep -qF 'GitHub MCP adoption' "$WORKFLOW_MD"; then
  echo "FAIL: ${WORKFLOW_MD} must include GitHub MCP adoption map" >&2
  fail=1
fi
if ! grep -qF 'GitHub MCP' "$SETUP_MD"; then
  echo "FAIL: ${SETUP_MD} must mention GitHub MCP" >&2
  fail=1
fi

while IFS= read -r -d '' script; do
  if grep -E 'gh api.*-o /dev/null -w' "$script" >/dev/null 2>&1; then
    echo "FAIL: ${script} uses curl-style -o/-w flags with gh api" >&2
    fail=1
  fi
done < <(git ls-files -z 'scripts/cursor-workflow-*.sh')

CONFIG_YAML="workflow/cursor-workflow/workflow.config.yaml"
CONFIG_SH="scripts/cursor-workflow-config.sh"
TIERING_MD="workflow/cursor-workflow/SKILL-TIERING.md"
STATE_SCHEMA_MD="workflow/cursor-workflow/STATE-SCHEMA.md"

for artifact in "$CONFIG_YAML" "$CONFIG_SH" "$TIERING_MD" "$STATE_SCHEMA_MD"; do
  if [[ ! -f "$artifact" ]]; then
    echo "FAIL: missing ${artifact}" >&2
    fail=1
  fi
done

if [[ ! -x "$CONFIG_SH" ]]; then
  echo "FAIL: ${CONFIG_SH} must be executable" >&2
  fail=1
fi

bash scripts/test-cursor-workflow-config.sh

PLANNING_SKILL=".cursor/skills/planning/SKILL.md"
for keyword in "PR seed" SKILL-TIERING excerpt; do
  if ! grep -qF "$keyword" "$PLANNING_SKILL"; then
    echo "FAIL: ${PLANNING_SKILL} must mention ${keyword}" >&2
    fail=1
  fi
done

TIER_SKILLS=(planning execute demo create-pr babysit-pr)
FORBIDDEN_PATTERNS=('localhost:' 'verify-phase8-gates.sh' 'BlackLodgeLabs/cuebox')
for skill in "${TIER_SKILLS[@]}"; do
  skill_file=".cursor/skills/${skill}/SKILL.md"
  if ! grep -qE 'cursor-workflow-config\.sh|WORKFLOW_REGRESSION_GATE|APP_DEFAULT_GATE|APP_HEALTH_URL|GITHUB_REPO_SLUG|SKILL-TIERING' "$skill_file"; then
    echo "FAIL: ${skill_file} must reference config resolver or config variables" >&2
    fail=1
  fi
  for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if grep -qF "$pattern" "$skill_file"; then
      echo "FAIL: ${skill_file} contains hard-coded pattern: ${pattern}" >&2
      fail=1
    fi
  done
done

ISSUE_126_PLAN="workflow/issues/issue-126/PLAN.md"
if [[ -f "$ISSUE_126_PLAN" ]]; then
  if ! grep -qF '## PR seed' "$ISSUE_126_PLAN"; then
    echo "FAIL: ${ISSUE_126_PLAN} must contain ## PR seed (dogfood)" >&2
    fail=1
  fi
fi

if ! grep -qF 'SKILL-TIERING.md' "$WORKFLOW_MD"; then
  echo "FAIL: ${WORKFLOW_MD} must link SKILL-TIERING.md" >&2
  fail=1
fi
if ! grep -qF 'workflow.config.yaml' "$WORKFLOW_MD"; then
  echo "FAIL: ${WORKFLOW_MD} must mention workflow.config.yaml" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

bash scripts/test-cursor-workflow-handoff.sh
bash scripts/test-cursor-workflow-record-agent.sh
bash scripts/test-cursor-workflow-linked-issues.sh
bash scripts/test-cursor-workflow-strip-cursor-labels.sh
bash scripts/test-cursor-workflow-delete-stale-branches.sh
bash scripts/test-cursor-workflow-mcp-github.sh
bash scripts/test-cursor-workflow-state-schema.sh

echo "PASS: portable workflow regression"
