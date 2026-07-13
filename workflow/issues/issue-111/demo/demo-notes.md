# Demo notes — issue #111

- **Date:** 2026-07-13
- **Commit:** `d8967dbb8626a7ad1c2be98d53d5693496eb2a31`
- **Branch:** `cursor/issue-111-workflow-human-notifications`
- **PR:** #114
- **Stack:** Full Docker Compose stack Up (postgres, api, frontend, backup); health checks OK on `:3000` and `:8000`

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Resolve notify targets | PASS | `scenario-1-resolve-targets.log` — dedup + distinct author/owner tests PASS; usernames only in test fixtures |
| 2 | Complete notification — dual @mentions | PASS | `scenario-2-complete-notify.log` — `notify complete mentions both` + idempotent skip; `resolve-notify-targets` in notify-complete.sh; marker preserved |
| 3 | Stalled notification replaces PAT fallback | PASS | `scenario-3-spawn-stalled.log` — no `pat_fallback`; stalled notifier invoked; `CURSOR_WORKFLOW_SYNC_CALL_COUNT=0`; stage unchanged |
| 4 | Pass-back failure uses stalled notifier | PASS | `scenario-4-passback-stalled.log` — no PAT block in passback-run.sh; stalled on failure; `passback recovery` success regression PASS |
| 5 | Stalled notifier idempotency and body content | PASS | `scenario-5-stalled-idempotency.log` — body/marker tests PASS; idempotent skip on second run |
| 6 | Workflow path verification | PASS | `scenario-6-verify-paths.log` — `verify-workflow-paths.sh` exit 0; scripts registered in load-scripts.sh |
| 7 | Documentation and skills spot-check | PASS | See below |

## Scenario 7 — documentation greps

- **WORKFLOW.md:** Four communication scenarios documented (complete, stalled, genuine question, step failure); PAT fallback marked deprecated/removed (#111).
- **MCP-GITHUB.md:** References `resolve-notify-targets.sh`; no "Until #95 lands".
- **planning/SKILL.md:** `cursor-mcp-plan-questions:v1` marker for genuine questions.
- **review-and-spec/SKILL.md:** `cursor-mcp-spec-questions:v1` marker for genuine questions.
- **demo/SKILL.md:** Pass-back rules documented; no human question posting on step failure.

## Environment notes

- Workflow-only change; no product UI or database seed required.
- `bash scripts/test-cursor-workflow-handoff.sh` — all cases passed (re-run after initial flaky `reopen inference prev_stage` failure in first pass; not part of demo-spec scenarios).
- `bash scripts/verify-workflow-paths.sh` — exit 0 including embedded handoff suite.
