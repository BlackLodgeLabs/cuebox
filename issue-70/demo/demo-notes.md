# Demo notes — issue #70

**Date:** 2026-07-04  
**Commit:** `d454265`  
**Branch:** `cursor/issue-70-harden-cursor-workflow-handoff-dedup`  
**Environment:** Workflow-only (no Docker stack required)

## Scenario results

| # | Scenario | Result | Artifact |
|---|----------|--------|----------|
| 1 | Workflow path regression | PASS | [scenario-1-verify-workflow-paths.png](./scenario-1-verify-workflow-paths.png) |
| 2 | Handoff shell tests (mocked) | PASS | [scenario-2-handoff-tests-pass.png](./scenario-2-handoff-tests-pass.png) |
| 3 | Stage merge monotonicity | PASS | [scenario-3-stage-merge.png](./scenario-3-stage-merge.png) |
| 4 | Documentation spot-check | PASS | [scenario-4-docs-cap-recovery.png](./scenario-4-docs-cap-recovery.png) |

## Evidence

### Scenario 1 — Workflow path regression

`bash scripts/verify-workflow-paths.sh` exited 0 with:

- `PASS: no legacy workflow paths found`
- Extended checks for `handoff_pending`, admission/spawn scripts, and skill merge-helper references

**Workflow regression:** `verify-workflow-paths.sh` exit 0 at `d454265`

### Scenario 2 — Handoff shell tests (mocked)

`bash scripts/test-cursor-workflow-handoff.sh` exited 0; all cases passed:

- Dedup admission skip / spawn skipped
- At-cap admission defer
- API 400 exit 0 with warning logged
- Fresh pending lock defer
- Babysit recovery spawned and agent recorded in state
- Stage merge keeps higher rank (`create-pr-ready`)

### Scenario 3 — Stage merge monotonicity

Fixture merge with remote `create-pr-ready` (rank 80) and local `demo-ready` (rank 60):

- Merge helper output retained `create-pr-ready`
- Confirms side-branch stage regression is prevented

### Scenario 4 — Documentation spot-check

`WORKFLOW.md` documents:

- Global **8-agent cap** and deferral behavior
- `handoff_pending` lock semantics (15-minute stale recovery)
- **Babysit recovery** predicate (`create-pr-ready` + draft PR + no `agents.babysit-pr`)

`SETUP.md` documents agent cap, deferral on API 400, and babysit recovery self-heal.

## Notes

- No secrets in artifacts or logs.
- No Cuebox application changes in this issue; Docker stack not required.
