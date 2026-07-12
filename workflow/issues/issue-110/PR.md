## Related Issue

Closes #110

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/110)

## Description

**What does this PR do?**

When handoff spawn exhausts retries without a successful `POST /v1/agents` (or pass-back `POST /v1/agents/{id}/runs`), `pat_fallback()` and the pass-back PAT branch were still calling `cursor-workflow-sync-github-status.sh` with `HANDOFF_PROGRESS_STAGE` set to the **target** skill's in-progress stage. That overwrote GitHub labels and the pinned status comment with a false `demo-in-progress` (or similar) while `workflow.state.json` remained at the prior stage (e.g. `execute-ready`) — the defect observed during [issue #26](https://github.com/BlackLodgeLabs/cuebox/issues/26) ([Actions run 29132830362](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29132830362)).

This PR removes progress-label sync from failure paths only. Successful spawns continue to sync in-progress labels via `sync_after_spawn()` and the pass-back success branch. PAT `@cursoragent` fallback comments are **kept** until [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111) replaces them with a stalled notifier.

**Why is this the best approach?**

`HANDOFF_PROGRESS_STAGE` is intended to show immediate progress after a **successful** agent creation. Reusing it on terminal failure paths masks the actual `stage` in `workflow.state.json` and misleads operators. The narrow fix deletes the erroneous sync calls without changing the sync script, handoff Action, or success-path behaviour. Labels refresh on the next push via Actions with state-derived values — no alternative sync is needed in `pat_fallback()`.

## Changes Proposed

* Removed `HANDOFF_PROGRESS_STAGE` / `HANDOFF_ACTIVE_SKILL` sync from `pat_fallback()` in `scripts/cursor-workflow-spawn-agent.sh` — PAT `@cursoragent` comment unchanged
* Removed progress sync from PAT fallback block in `scripts/cursor-workflow-passback-run.sh` — success-path sync (API 2xx → `execute-in-progress`) preserved
* Added `scripts/fixtures/cursor-workflow/state-execute-ready-no-demo.json` — fixture for spawn terminal-failure test
* Added `test_spawn_pat_fallback_no_progress_sync` and `test_passback_pat_fallback_no_progress_sync` in `scripts/test-cursor-workflow-handoff.sh`
* Demo artifacts under `workflow/issues/issue-110/demo/` — four scenario logs and `demo-notes.md`

**Explicitly unchanged:** `scripts/cursor-workflow-sync-github-status.sh`, `.github/workflows/cursor-workflow-handoff.yml`, `workflow/cursor-workflow/WORKFLOW.md`, and all application code (API, frontend, database).

## Scenario Results

Workflow-only change — no product UI. Demo validated failure-path honesty and success-path regression via shell tests.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Spawn terminal failure — no false progress sync | **PASS** | [scenario-1-spawn-failure.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/da871aa/workflow/issues/issue-110/demo/scenario-1-spawn-failure.log) |
| 2 | Pass-back PAT failure — no false progress sync | **PASS** | [scenario-2-passback-failure.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/da871aa/workflow/issues/issue-110/demo/scenario-2-passback-failure.log) |
| 3 | Success-path regression | **PASS** | [scenario-3-success-regression.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/da871aa/workflow/issues/issue-110/demo/scenario-3-success-regression.log) |
| 4 | Workflow path verification | **PASS** | [scenario-4-verify-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/da871aa/workflow/issues/issue-110/demo/scenario-4-verify-paths.log) |

## How to Test

1. Checkout this branch: `git checkout cursor/issue-110-honest-github-status-failed-spawn`
2. Confirm failure paths have no progress sync:
   ```bash
   grep -A8 'pat_fallback()' scripts/cursor-workflow-spawn-agent.sh | grep -c 'HANDOFF_PROGRESS_STAGE' && echo UNEXPECTED || echo OK spawn pat_fallback
   grep -A12 'PAT fallback' scripts/cursor-workflow-passback-run.sh | grep -c 'cursor-workflow-sync-github-status' && echo UNEXPECTED || echo OK passback PAT fallback
   ```
3. Run handoff regression suite:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
   Expect `PASS: spawn pat fallback no sync call`, `PASS: passback pat fallback no false progress sync`, and `test-cursor-workflow-handoff.sh: all cases passed`.
4. Run workflow path verification:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
5. Confirm success paths still sync progress:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh 2>&1 | grep -E 'PASS: batched spawn|PASS: passback recovery started run'
   ```

**Docker stack not required** — workflow-only scope.

## Known Issues / Notes for Reviewer

* PAT `@cursoragent` fallback comments still post on terminal failure — intentional until [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111) adds a stalled notifier.
* Operators will not see an immediate label refresh on failed spawn; the label stays at the actual stage (e.g. `cursor:execute-ready`) until the next push triggers Actions sync — expected behaviour.
* Demo run noted one unrelated flaky failure (`reopen inference prev_stage`) on first handoff suite run; immediate rerun passed all cases. Scenario-specific assertions passed on first run.
* Series position: 2 of 3 from [#102](https://github.com/BlackLodgeLabs/cuebox/issues/102). Prerequisite [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) is complete.

## Gate evidence

- [x] `test-cursor-workflow-handoff.sh exit 0 at f0ac516` (execute)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at f0ac516` (execute)
- [x] `test-cursor-workflow-handoff.sh exit 0 at 0175c7e` (demo)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at 0175c7e` (demo)
- [x] `test-cursor-workflow-handoff.sh exit 0 at da871aa` (babysit)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at da871aa` (babysit)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Success-path progress sync preserved (`test_batched_spawn_writes`, `test_passback_recovery`)
