# Issue #110: Honest GitHub status on failed spawn (no false *-in-progress labels)

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/110

## Summary

When handoff spawn exhausts retries without a successful `POST /v1/agents` (or pass-back `POST /v1/agents/{id}/runs`), `pat_fallback()` and the pass-back PAT branch still call `cursor-workflow-sync-github-status.sh` with `HANDOFF_PROGRESS_STAGE` set to the **target** skill's in-progress stage. That overwrites GitHub labels and the pinned status comment with a false `demo-in-progress` (or similar) while `workflow.state.json` remains at the prior stage (e.g. `execute-ready`).

This change removes progress-label sync from failure paths only. Successful spawns continue to sync in-progress labels via `sync_after_spawn()` / pass-back success branch. PAT `@cursoragent` fallback comments are **kept** until [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111) replaces them with a stalled notifier.

**Series position:** 2 of 3 from [#102](https://github.com/BlackLodgeLabs/cuebox/issues/102). Prerequisite [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) (clear `active_skill` on `execute-ready`) is complete.

## Problem

### Observed failure (issue #26)

During [issue #26](https://github.com/BlackLodgeLabs/cuebox/issues/26), execute finished and set `stage: execute-ready`. Demo spawn was deferred and eventually exhausted retries; `pat_fallback()` posted `@cursoragent` but demo never spawned. GitHub showed **Demo — in progress** (~7 hours) while `workflow.state.json` stayed `execute-ready`.

**Handoff run:** [29132830362](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29132830362)

### Root cause

`pat_fallback()` in `cursor-workflow-spawn-agent.sh` always syncs progress after posting the PAT comment:

```138:146:scripts/cursor-workflow-spawn-agent.sh
pat_fallback() {
  if [ -n "${CURSOR_HANDOFF_GITHUB_TOKEN:-}" ]; then
    ...
    HANDOFF_PROGRESS_STAGE="$PROGRESS_STAGE" \
    HANDOFF_ACTIVE_SKILL="$SKILL" \
      "$WF/cursor-workflow-sync-github-status.sh" "$STATE_FILE" || true
```

`HANDOFF_PROGRESS_STAGE` overrides the display stage in `cursor-workflow-sync-github-status.sh` (lines 154–157), so labels reflect the **intended** next skill, not the **actual** state file stage.

The same pattern exists in `cursor-workflow-passback-run.sh` when the API path fails and PAT fallback runs (lines 71–78): it sets `HANDOFF_PROGRESS_STAGE="execute-in-progress"` even though `POST .../runs` never succeeded.

### Why this matters

Operators use GitHub labels and the pinned status comment to see workflow progress. A false in-progress label hides stalls and delays human intervention until someone reads `workflow.state.json` on the branch.

## Acceptance criteria

- [ ] `pat_fallback()` does **not** call `cursor-workflow-sync-github-status.sh` with `HANDOFF_PROGRESS_STAGE` when `POST /v1/agents` never returned 2xx in that spawn attempt
- [ ] `pat_fallback()` still posts `@cursoragent` issue comment when `CURSOR_HANDOFF_GITHUB_TOKEN` is set (unchanged until #111)
- [ ] Pass-back PAT fallback branch in `cursor-workflow-passback-run.sh` does **not** set `HANDOFF_PROGRESS_STAGE` when `POST /v1/agents/{id}/runs` never returned 2xx
- [ ] Pass-back **success** path (2xx from runs API) still syncs `execute-in-progress` — regression preserved
- [ ] Successful agent spawn (`do_post_agent` → `sync_after_spawn`) still syncs target `*-in-progress` — regression preserved
- [ ] Regression test: terminal spawn failure (retries exhausted) with PAT fallback → status sync **not** invoked with target `*-in-progress` label; log/state reflect actual `workflow.state.json` stage (e.g. `execute-ready` → `cursor:execute-ready`, not `cursor:demo-in-progress`)
- [ ] Regression test: pass-back API failure + PAT fallback → no `execute-in-progress` progress sync
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` passes
- [ ] `bash scripts/verify-workflow-paths.sh` passes

## Scope

### In scope

| File | Change |
|------|--------|
| `scripts/cursor-workflow-spawn-agent.sh` | Remove `HANDOFF_PROGRESS_STAGE` / `HANDOFF_ACTIVE_SKILL` sync from `pat_fallback()`; keep `@cursoragent` comment |
| `scripts/cursor-workflow-passback-run.sh` | Remove progress sync from PAT fallback branch (lines 75–78); keep success-path sync (lines 62–65) |
| `scripts/test-cursor-workflow-handoff.sh` | New failure-path regression tests (spawn + pass-back) |
| `scripts/fixtures/cursor-workflow/` | Optional fixture JSON for `execute-ready` terminal defer scenario (if cleaner than inline state) |

### Out of scope

- Replacing `pat_fallback()` with stalled notifier — [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111)
- Clearing `active_skill` on `execute-ready` — [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) (done)
- Transient deferral comment wording — [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111)
- State-only resync from `pat_fallback()` without progress override (labels refresh on next push via Actions is sufficient)
- Application code, database, frontend

## User flows / API changes

No product UI or API changes.

### Operators (GitHub issue view)

| Before | After |
|--------|-------|
| Spawn fails after retries → label jumps to `cursor:demo-in-progress` (or target skill) | Spawn fails → label **unchanged** (stays at actual stage, e.g. `cursor:execute-ready`) |
| Status comment title shows false "Demo — in progress" | Status comment not updated with false progress on failed spawn |
| PAT `@cursoragent` comment still posted | Unchanged (until #111) |

### Agents / Actions

- Handoff Action still calls `cursor-workflow-spawn-agent.sh` and `cursor-workflow-passback-run.sh` unchanged
- Next push to the issue branch still runs `cursor-workflow-sync-github-status.sh` from the handoff workflow with state-derived labels (no `HANDOFF_PROGRESS_STAGE`)

## Data and integration notes

### Implementation detail

**Spawn (`pat_fallback`):** Delete the three lines that export `HANDOFF_PROGRESS_STAGE`, `HANDOFF_ACTIVE_SKILL`, and call `cursor-workflow-sync-github-status.sh`. Do not add alternative sync in this function.

**Pass-back:** Structure is already split — success block (API 2xx) vs PAT fallback. Only remove progress sync from the PAT fallback block.

**Invariant:** `HANDOFF_PROGRESS_STAGE` is only set when an agent/run was actually created in the current code path:

| Path | POST succeeded? | Progress sync? |
|------|-----------------|----------------|
| `do_post_agent` → `sync_after_spawn` | Yes | Yes |
| Pass-back API 2xx | Yes | Yes |
| `pat_fallback` | No | **No** (this issue) |
| Pass-back PAT fallback | No | **No** (this issue) |

### Test strategy

Use existing test harness patterns from `test-cursor-workflow-handoff.sh`:

1. **Spawn terminal failure + PAT fallback**
   - State: `stage: execute-ready`, `active_skill: null`, no `agents.demo` (demo not yet spawned)
   - `MOCK_CURSOR_API=1`, `MOCK_IN_FLIGHT_RUN_COUNT` high or admission gate defer reason that exhausts `MAX_ATTEMPTS` (3 in test mode with `CURSOR_WORKFLOW_TEST_MODE=1`)
   - Set `CURSOR_HANDOFF_GITHUB_TOKEN=mock` and mock `gh` / stub issue comment (or use `MOCK_GITHUB_SYNC=1` + `CURSOR_WORKFLOW_SYNC_CALL_COUNT`)
   - Run `cursor-workflow-spawn-agent.sh` for skill `demo`, progress stage `demo-in-progress`
   - Assert: PAT comment logged; `CURSOR_WORKFLOW_SYNC_CALL_COUNT` is 0 **or** sync log does **not** contain `cursor:demo-in-progress`
   - Assert: `jq -r '.stage'` remains `execute-ready`

   **Note:** `defer:execute-active` from the original #26 narrative is no longer reachable at `execute-ready` after [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) admission-gate changes. Use an equivalent terminal failure (e.g. `defer:at-cap` with `MOCK_IN_FLIGHT_RUN_COUNT=8`, or repeated `defer:pending-lock`) that ends in `pat_fallback()` — same bug surface.

2. **Pass-back PAT failure**
   - State: `execute-passback` with `agents.execute` set
   - `MOCK_CURSOR_API=1`, `MOCK_CURSOR_POST_CODE=500` (non-2xx), `CURSOR_HANDOFF_GITHUB_TOKEN=mock`
   - Run `cursor-workflow-passback-run.sh`
   - Assert: no sync with `execute-in-progress` label

3. **Regression: successful spawn still syncs**
   - Existing `test_batched_spawn_writes`, `test_passback_recovery` — must still pass

### Docs

No `WORKFLOW.md` change required for this narrow fix. #111 will document stalled vs progress sync holistically.

## Open questions (must be empty before plan-ready)

_None._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/110
- Epic: https://github.com/BlackLodgeLabs/cuebox/issues/102
- Prerequisite (done): https://github.com/BlackLodgeLabs/cuebox/issues/109
- Follow-up: https://github.com/BlackLodgeLabs/cuebox/issues/111
- Source incident: https://github.com/BlackLodgeLabs/cuebox/issues/26
- Issue #26 review: `workflow/issues/issue-26/WORKFLOW-REVIEW.md` (on commit `65697ccd`)
- Handoff run: https://github.com/BlackLodgeLabs/cuebox/actions/runs/29132830362
