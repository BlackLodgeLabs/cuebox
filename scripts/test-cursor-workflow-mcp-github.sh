#!/usr/bin/env bash
# Offline regression: MCP-GITHUB.md, skill references, idempotency markers.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

MCP_DOC="workflow/cursor-workflow/MCP-GITHUB.md"
if [[ ! -f "$MCP_DOC" ]]; then
  echo "FAIL: missing ${MCP_DOC}" >&2
  exit 1
fi

MARKERS=(
  'cursor-mcp-spec-questions:v1'
  'cursor-mcp-plan-questions:v1'
  'cursor-mcp-spec-ready:v1'
  'cursor-mcp-demo-summary:v1'
  'cursor-mcp-blocked:v1'
  'cursor-mcp-execute-no-pr:v1'
  'cursor-mcp-test:v1'
)

for marker in "${MARKERS[@]}"; do
  if ! grep -qF "$marker" "$MCP_DOC"; then
    echo "FAIL: ${MCP_DOC} missing marker: ${marker}" >&2
    fail=1
  fi
done

for tool in GetMcpTools add_issue_comment issue_write issue_read pull_request_read update_pull_request; do
  if ! grep -qF "$tool" "$MCP_DOC"; then
    echo "FAIL: ${MCP_DOC} missing tool reference: ${tool}" >&2
    fail=1
  fi
done

MCP_SKILLS=(
  review-and-spec
  planning
  execute
  demo
  babysit-pr
  workflow-review
)

for skill in "${MCP_SKILLS[@]}"; do
  skill_file=".cursor/skills/${skill}/SKILL.md"
  if ! grep -qF 'MCP-GITHUB.md' "$skill_file"; then
    echo "FAIL: ${skill_file} must reference MCP-GITHUB.md" >&2
    fail=1
  fi
  if ! grep -qF 'GetMcpTools' "$skill_file"; then
    echo "FAIL: ${skill_file} must mention GetMcpTools" >&2
    fail=1
  fi
done

WORKFLOW_MD="workflow/cursor-workflow/WORKFLOW.md"
for keyword in 'MCP-GITHUB.md' 'GitHub MCP adoption'; do
  if ! grep -qF "$keyword" "$WORKFLOW_MD"; then
    echo "FAIL: ${WORKFLOW_MD} must mention ${keyword}" >&2
    fail=1
  fi
done

SETUP_MD="workflow/cursor-workflow/SETUP.md"
if ! grep -qF 'GitHub MCP' "$SETUP_MD"; then
  echo "FAIL: ${SETUP_MD} must mention GitHub MCP" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: MCP-GITHUB.md, markers, skills, and doc links verified"
