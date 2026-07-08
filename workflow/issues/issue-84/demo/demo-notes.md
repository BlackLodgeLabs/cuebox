# Demo notes — issue #84

**Date:** 2026-07-08  
**Commit:** `3565599d6a93d5295b77701ae8460aedd474ea0e`  
**Branch:** `cursor/issue-84-harden-concurrent-handoff-spawn-dedup`  
**Docker stack:** All four containers Up; health endpoints returned `status: ok`, `database: ok`.

## Summary

Demo ran against the plan-only branch. Execute has not yet landed the cross-run spawn dedup implementation from `PLAN.md`. Scenarios 1 and 3 fail demo-spec pass criteria; scenario 2 exits 0 but does not yet exercise the planned `cursor-workflow-refetch-state.sh` registration.

**Result:** Pass-back to execute (code defect — implementation missing).

## Scenario 1: Workflow handoff tests — FAIL

**Command:** `bash scripts/test-cursor-workflow-handoff.sh`  
**Exit code:** 0  
**Log:** [scenario-1-handoff-tests.log](./scenario-1-handoff-tests.log)

Existing regression cases pass (`test-cursor-workflow-handoff.sh: all cases passed`). Demo-spec requires **new** cross-run PASS markers that are not present in the test suite yet:

| Expected marker | Present |
|-----------------|---------|
| remote agent skip | No |
| remote pending defer | No |
| single POST under race | No |
| recovery remote skip | No |
| record-spawn first-wins | No |

No `FAIL:` lines appeared, but the new issue #84 cases from the plan are not implemented.

## Scenario 2: Workflow paths gate — PARTIAL FAIL

**Command:** `bash scripts/verify-workflow-paths.sh`  
**Exit code:** 0  
**Log:** [scenario-2-verify-workflow-paths.log](./scenario-2-verify-workflow-paths.log)

Gate passes on current branch, but `scripts/cursor-workflow-refetch-state.sh` does not exist and is not listed in `scripts/cursor-workflow-load-scripts.sh` or `verify-workflow-paths.sh` `HANDOFF_SCRIPTS` (planned in PLAN.md Step 1).

## Scenario 3: Spawn flow documentation — FAIL

**Capture:** [scenario-3-workflow-docs.png](./scenario-3-workflow-docs.png)

- `WORKFLOW.md` has no cross-run spawn dedup section (refetch before POST, branch `handoff_pending` before API call, second admission check).
- `RETROSPECTIVES.md` concurrent-handoff pattern row still says **(proposed)** and links to HANDOFF-HARDENING-NOTES — not a landed #84 mitigation.

## Artifacts

- [x] `scenario-1-handoff-tests.log`
- [x] `scenario-2-verify-workflow-paths.log`
- [x] `scenario-3-workflow-docs.png`
- [x] `demo-notes.md`
- [x] No secrets in logs or screenshots

## Pass-back to execute

Execute must implement `PLAN.md` before demo can pass:

1. Add `scripts/cursor-workflow-refetch-state.sh` and register in load-scripts + verify-workflow-paths.
2. Harden `cursor-workflow-spawn-agent.sh` (refetch → gate → branch pending → refetch → re-gate → POST).
3. Update recovery path and `record-spawn-on-branch.sh` first-wins semantics.
4. Extend `test-cursor-workflow-handoff.sh` with concurrent/overlapping spawn regression cases (expected PASS markers in demo-spec).
5. Document cross-run dedup in `WORKFLOW.md`; update `RETROSPECTIVES.md` pattern row to reference landed #84 mitigation (remove "proposed").
