# Demo notes — issue #109

- **Date:** 2026-07-12T08:42:00Z
- **Commit:** 043c431
- **Branch:** `cursor/issue-109-harden-execute-demo-handoff` (demo agent: `cursor/issue-109-pr-112-demo-agent-3f8f`)
- **PR:** #112
- **Docker stack:** Running (all four services Up; health OK). Not required for workflow-only scenarios per demo-spec preconditions; stack started per handoff prompt.

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Execute skill finalize contract | **PASS** | [scenario-1-execute-skill.log](scenario-1-execute-skill.log) |
| 2 | Admission gate stale-lock recovery | **PASS** | [scenario-2-admission-gate.log](scenario-2-admission-gate.log) |
| 3 | Handoff regression suite | **PASS** | [scenario-3-regression.log](scenario-3-regression.log) |
| 4 | WORKFLOW.md documentation | **PASS** | [scenario-4-workflow-docs.log](scenario-4-workflow-docs.log) |
| 5 | Handoff YAML unchanged | **PASS** | [scenario-5-yaml-unchanged.log](scenario-5-yaml-unchanged.log) |

## Gate evidence

- `bash scripts/test-cursor-workflow-handoff.sh` — exit 0
  - `test_demo_proceed_execute_ready_stale_lock` — proceed at execute-ready with stale `active_skill=execute`
  - `test_demo_skip_execute_in_progress` — still blocks demo during execute-in-progress
  - `test_demo_proceed_execute_ready` — happy path unchanged
- `bash scripts/verify-workflow-paths.sh` — exit 0
- `git diff main -- .github/workflows/cursor-workflow-handoff.yml` — no changes

## Key observations

- Admission gate: `execute-ready` + `active_skill=execute` → `proceed` (defense-in-depth)
- Admission gate: `execute-in-progress` + `active_skill=execute` → `skip:execute-in-progress` (issue #91 protection preserved)
- Execute skill Finalize state documents `active_skill: null` and `active_agent_id: null` on `execute-ready`
- `demo-spec.md` and `PLAN.md` restored from planning side branch (`cursor/issue-109-pr-112-plan-agent-75ee`) — were missing from issue branch when demo started

## Notes

- No secrets in logs.
- Workflow-only change; no product UI scenarios.
