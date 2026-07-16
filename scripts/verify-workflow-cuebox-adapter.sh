#!/usr/bin/env bash
# Cuebox adapter regression — application gates, cloud bootstrap, adapter docs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

ADAPTER_MD="workflow/cursor-workflow/ADAPTER.md"
if [[ ! -f "$ADAPTER_MD" ]]; then
  echo "FAIL: missing ${ADAPTER_MD}" >&2
  fail=1
else
  for keyword in verify-phase8-gates.sh api-ci frontend-ci health_url scripts/cloud- documents/cloud-agent- database_url_host_test adapter.gates; do
    if ! grep -qF "$keyword" "$ADAPTER_MD"; then
      echo "FAIL: ${ADAPTER_MD} must mention ${keyword}" >&2
      fail=1
    fi
  done
fi

for doc in documents/cloud-agent-part2-test-data.md documents/cloud-agent-tier3-fixture-import-plan.md; do
  if [[ ! -f "$doc" ]]; then
    echo "FAIL: missing ${doc}" >&2
    fail=1
  fi
done

RETROSPECTIVES_MD="workflow/cursor-workflow/RETROSPECTIVES.md"
if [[ ! -f "$RETROSPECTIVES_MD" ]]; then
  echo "FAIL: missing ${RETROSPECTIVES_MD}" >&2
  fail=1
else
  for issue_num in 28 59; do
    if ! grep -qF "issue-${issue_num}/WORKFLOW-REVIEW.md" "$RETROSPECTIVES_MD"; then
      echo "FAIL: ${RETROSPECTIVES_MD} must index issue #${issue_num} with workflow/archive link" >&2
      fail=1
    fi
  done
fi

if ! grep -qF 'workflow-review' AGENTS.md || grep -qF 'when [#79]' AGENTS.md; then
  echo "FAIL: AGENTS.md must list workflow-review in committed skills (no parenthetical deferral)" >&2
  fail=1
fi

if ! grep -qF "handoff_pending" AGENTS.md; then
  echo "FAIL: AGENTS.md must cross-link workflow hardening (handoff_pending)" >&2
  fail=1
fi

CONFIG_YAML="workflow/cursor-workflow/workflow.config.yaml"
if [[ -f "$CONFIG_YAML" ]]; then
  if ! grep -qF 'verify-phase8-gates.sh' "$CONFIG_YAML"; then
    echo "FAIL: ${CONFIG_YAML} adapter section must reference verify-phase8-gates.sh" >&2
    fail=1
  fi
fi

POST_MERGE_YML=".github/workflows/cursor-workflow-post-merge.yml"
if [[ ! -f "$POST_MERGE_YML" ]]; then
  echo "FAIL: missing ${POST_MERGE_YML}" >&2
  fail=1
else
  if ! grep -qF 'Load workflow config' "$POST_MERGE_YML"; then
    echo "FAIL: ${POST_MERGE_YML} must bootstrap workflow config" >&2
    fail=1
  fi
fi

WORKFLOW_REVIEW_TEMPLATE="workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md"
if [[ ! -f "$WORKFLOW_REVIEW_TEMPLATE" ]]; then
  echo "FAIL: missing ${WORKFLOW_REVIEW_TEMPLATE}" >&2
  fail=1
else
  for section in Summary "Expected workflow" timeline recommendations; do
    if ! grep -qiF "$section" "$WORKFLOW_REVIEW_TEMPLATE"; then
      echo "FAIL: ${WORKFLOW_REVIEW_TEMPLATE} must contain section: ${section}" >&2
      fail=1
    fi
  done
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: Cuebox adapter regression"
