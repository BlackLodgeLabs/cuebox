# Demo notes — issue #110

**Date:** 2026-07-12  
**Commit:** `0175c7e` (`cursor/issue-110-pr-113-demo-agent-5222`)  
**Branch:** `cursor/issue-110-pr-113-demo-agent-5222` (base: `cursor/issue-110-honest-github-status-failed-spawn`)  
**PR:** #113

## Environment

- Full Docker stack running (all four services Up; health checks OK; frontend HTTP 200).
- Workflow-only demo — no database seed required.

## Scenario results

| # | Scenario | Result | Artifact |
|---|----------|--------|----------|
| 1 | Spawn terminal failure — no false progress sync | **PASS** | [scenario-1-spawn-failure.log](scenario-1-spawn-failure.log) |
| 2 | Pass-back PAT failure — no false progress sync | **PASS** | [scenario-2-passback-failure.log](scenario-2-passback-failure.log) |
| 3 | Success-path regression | **PASS** | [scenario-3-success-regression.log](scenario-3-success-regression.log) |
| 4 | Workflow path verification | **PASS** | [scenario-4-verify-paths.log](scenario-4-verify-paths.log) |

## Scenario details

### Scenario 1 — PASS

- `pat_fallback()` in `scripts/cursor-workflow-spawn-agent.sh` posts a handoff comment only; no `HANDOFF_PROGRESS_STAGE` or `cursor-workflow-sync-github-status.sh` call.
- `test_spawn_pat_fallback_no_progress_sync` passed: comment posted, no sync call, no false `cursor:demo-in-progress` label sync, `stage` unchanged (`execute-ready`).

### Scenario 2 — PASS

- PAT fallback block in `scripts/cursor-workflow-passback-run.sh` (lines 71–76) posts `@cursoragent` comment only; no progress sync.
- Success path (API 2xx, lines 60–66) still calls sync with `HANDOFF_PROGRESS_STAGE="execute-in-progress"`.
- `test_passback_pat_fallback_no_progress_sync` passed: no sync on PAT fallback, `stage` unchanged (`execute-passback`).

### Scenario 3 — PASS

- `test_batched_spawn_writes`: `PASS: batched spawn clears pending and records agent`
- `test_passback_recovery`: `PASS: passback recovery started run`
- Full handoff suite exit 0.

### Scenario 4 — PASS

- `bash scripts/verify-workflow-paths.sh` exit 0 at commit `0175c7e`.

## Notes

- First handoff test run had one unrelated flaky failure (`reopen inference prev_stage`); immediate rerun passed all cases. Scenario-specific assertions all passed on first run.
- No secrets captured in logs.
