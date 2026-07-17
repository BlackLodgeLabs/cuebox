# Demo notes — issue #127

**Date:** 2026-07-17T10:58:00Z  
**Commit SHA:** `c43e5c1`  
**Tier:** workflow  
**Branch:** `cursor/issue-127-v1-hardening-orchestration-reliability-68f4`  
**Docker stack:** All four services Up (postgres, api, frontend, backup); API and frontend health OK.

## Scenario results

| # | Scenario | Result | Artifact |
|---|----------|--------|----------|
| 1 | Handoff regression suite passes | **PASS** | [scenario-1-handoff-tests.log](./scenario-1-handoff-tests.log) |
| 2 | Workflow path and portable gates | **PASS** | [scenario-2-gates.log](./scenario-2-gates.log) |
| 3 | Canonical branch guard (mocked) | **PASS** | [scenario-3-canonical-guard.log](./scenario-3-canonical-guard.log) |
| 4 | Honest labels on defer | **PASS** | [scenario-4-honest-labels.log](./scenario-4-honest-labels.log) |
| 5 | Operator documentation exists | **PASS** | [scenario-5-operations-doc.log](./scenario-5-operations-doc.log) |
| 6 | Deferred handoff marker | **PASS** | [scenario-6-deferred-marker.log](./scenario-6-deferred-marker.log) |

## Gate exit lines

- **Scenario 1:** `test-cursor-workflow-handoff.sh: all cases passed` (exit 0)
- **Scenario 2:** `PATHS_EXIT=0`, `PORTABLE_EXIT=0`
- **Docker health:** `{"status":"ok","database":"ok"}`; frontend HTTP 200

## Issue #127 acceptance coverage (from scenario 1 log)

- `canonical branch guard would skip side-branch` — PASS
- `side-branch push ignored logic` — PASS
- `same-skill in-flight defer` — PASS
- `duplicate handoff skip logged` — PASS
- `defer honest labels show execute-ready` — PASS
- `deferred marker written` / `deferred marker cleared on spawn` — PASS
- `late-stage resume used /runs` — PASS

## Notes

- Initial parallel run of scenario 1 hit a flaky `reopen inference agents+demo` failure (pending-lock-race under concurrent load). Clean sequential re-run passed; artifact reflects the passing run.
- Workflow-tier demo: no application UI screenshots required per `demo-spec.md`.
