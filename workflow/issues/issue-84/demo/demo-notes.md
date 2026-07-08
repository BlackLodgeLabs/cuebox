# Demo notes — issue #84

**Date:** 2026-07-08  
**Commit:** `2da7651` (demo artifacts; implementation at `6735ffa` / `b03b5f1`)  
**Branch:** `cursor/issue-84-harden-concurrent-handoff-spawn-dedup`  
**Docker stack:** All four containers Up; health endpoints returned `status: ok`, `database: ok`.

## Summary

All three demo scenarios **pass**. Cross-run handoff spawn dedup is implemented: `cursor-workflow-refetch-state.sh`, hardened spawn/recovery paths, extended handoff tests (cases A–F), and WORKFLOW/RETROSPECTIVES documentation updates.

## Scenario 1: Workflow handoff tests — PASS

**Command:** `bash scripts/test-cursor-workflow-handoff.sh`  
**Exit code:** 0  
**Log:** [scenario-1-handoff-tests.log](./scenario-1-handoff-tests.log)

New cross-run regression cases present and passing:

| Marker | Result |
|--------|--------|
| refetch remote agent skip | PASS |
| refetch remote pending defer | PASS |
| concurrent race exactly 1 POST | PASS |
| recovery remote agent skip | PASS |
| record-spawn first-wins | PASS |
| failed record-spawn pending lock | PASS |

Final line: `test-cursor-workflow-handoff.sh: all cases passed`. No `FAIL:` lines.

## Scenario 2: Workflow paths gate — PASS

**Command:** `bash scripts/verify-workflow-paths.sh`  
**Exit code:** 0  
**Log:** [scenario-2-verify-workflow-paths.log](./scenario-2-verify-workflow-paths.log)

`cursor-workflow-refetch-state.sh` registered in `cursor-workflow-load-scripts.sh` and `verify-workflow-paths.sh` `HANDOFF_SCRIPTS`. Final message: `PASS: no legacy workflow paths found`.

## Scenario 3: Spawn flow documentation — PASS

**Capture:** [scenario-3-workflow-docs.png](./scenario-3-workflow-docs.png)

- `WORKFLOW.md` § "Cross-run spawn dedup (issue #84)" documents re-fetch → gate → branch pending lock → re-fetch + second gate → POST.
- `RETROSPECTIVES.md` concurrent-handoff pattern row links landed mitigation ([#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88)) — no longer "proposed".

## Artifacts

- [x] `scenario-1-handoff-tests.log`
- [x] `scenario-2-verify-workflow-paths.log`
- [x] `scenario-3-workflow-docs.png`
- [x] `demo-notes.md`
- [x] No secrets in logs or screenshots
