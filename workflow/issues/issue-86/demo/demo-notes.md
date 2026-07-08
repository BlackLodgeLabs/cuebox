# Demo notes — issue #86: Handoff recovery hardening

- **Date:** 2026-07-08
- **Commit SHA:** `f49e4e202f9a4760592484ffa8d7523b5b812ede`
- **Branch:** `cursor/issue-86-handoff-recovery-gaps`
- **Docker stack:** All four services Up; health checks passed (`status: ok`, `database: ok`; frontend HTTP 200). Demo scenarios are workflow-script tests and do not require the app stack; stack was running per handoff prompt.

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Workflow path regression gate | **PASS** | [scenario-1-verify-workflow-paths.log](./scenario-1-verify-workflow-paths.log) — exit 0, no `FAIL:` lines. `verify-workflow-paths.sh` asserts `resync-status` invokes `cursor-workflow-handoff-recovery.sh` (see `.github/workflows/cursor-workflow-handoff.yml` line 351). |
| 2 | Mock handoff test suite | **PASS** | [scenario-2-test-handoff.log](./scenario-2-test-handoff.log) — ends with `test-cursor-workflow-handoff.sh: all cases passed`. Covers pass-back recovery, re-open inference, ensure PR on spec/plan-ready, and execute-ready forward to demo. |
| 3 | Pass-back recovery (focused) | **PASS** | [scenario-3-passback-recovery.log](./scenario-3-passback-recovery.log) — `Pass-back run started on agent bc-exec`; no `Handoff recovery: spawning` forward skill; no new agent POST. |
| 4 | Re-open inference (focused) | **PASS** | [scenario-4-reopen-recovery.log](./scenario-4-reopen-recovery.log) — `Handoff recovery: spawning execute` (not demo) for fixture with both `agents.execute` and `agents.demo` set. Spawn deferred on pending-lock race in dry-run (expected without GitHub token); reopen decision exercised in Scenario 2 PASS lines. |
| 5 | Ensure draft PR on early recovery | **PASS** | [scenario-5-ensure-pr.log](./scenario-5-ensure-pr.log) — `Draft PR #99 linked`; state `pr` = `99`; spawn proceeds to planning (not `PR #null`). Used branch `cursor/issue-86-test` (nonexistent remote) so refetch does not overwrite mock `pr` with tip `pr: 96` on the real issue branch — same isolation as automated test `test_spec_ready_ensure_pr`. |

## Environment

```bash
export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
export CURSOR_WORKFLOW_PENDING_DRY_RUN=1
export CURSOR_WORKFLOW_TEST_MODE=1
export MOCK_CURSOR_API=1
```

No secrets appear in logs.

## Summary

All five demo scenarios pass. Handoff recovery hardening for issue #86 is verified: pass-back uses runs API, re-open infers execute over demo, early-stage recovery ensures draft PR before spawn, and forward `execute-ready` still routes to demo when appropriate.
