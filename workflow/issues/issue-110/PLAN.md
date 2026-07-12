# Implementation plan — Issue #110

Stop false `*-in-progress` GitHub labels when handoff spawn or pass-back fails after retries are exhausted.

## Overview

When `cursor-workflow-spawn-agent.sh` exhausts deferral retries and falls through to `pat_fallback()`, or when `cursor-workflow-passback-run.sh` cannot get a 2xx from `POST /v1/agents/{id}/runs`, both scripts still call `cursor-workflow-sync-github-status.sh` with `HANDOFF_PROGRESS_STAGE` set to the **target** skill's in-progress stage. That overrides the display stage derived from `workflow.state.json`, so operators see e.g. `cursor:demo-in-progress` while the state file remains `execute-ready`.

This is a narrow workflow-script fix: remove progress-label sync from failure paths only. Successful spawn and pass-back paths are unchanged. PAT `@cursoragent` fallback comments stay until [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111).

**Series:** 2 of 3 from [#102](https://github.com/BlackLodgeLabs/cuebox/issues/102). Prerequisite [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) is complete.

## Reproduction findings

Not an application bug — workflow/operator visibility defect. Confirmed by static code review against the [#26](https://github.com/BlackLodgeLabs/cuebox/issues/26) incident ([Actions run 29132830362](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29132830362)):

| Symptom | Evidence |
|---------|----------|
| False `demo-in-progress` label after failed demo spawn | `pat_fallback()` lines 143–145 in `cursor-workflow-spawn-agent.sh` set `HANDOFF_PROGRESS_STAGE="$PROGRESS_STAGE"` after PAT comment |
| State file stayed `execute-ready` | `HANDOFF_PROGRESS_STAGE` overrides `DISPLAY_STAGE` in `cursor-workflow-sync-github-status.sh` lines 154–157 |
| Same bug on pass-back PAT fallback | `cursor-workflow-passback-run.sh` lines 75–78 sync `execute-in-progress` when API never returned 2xx |
| Success paths correctly sync progress | `sync_after_spawn()` (spawn 2xx) and pass-back lines 62–65 (runs API 2xx) — must not regress |

**Note:** The original #26 `defer:execute-active` path is no longer reachable at `execute-ready` after #109 admission-gate changes. Terminal failure tests should use `defer:at-cap` (`MOCK_IN_FLIGHT_RUN_COUNT=8`) — same `pat_fallback()` surface.

No Docker stack reproduction required.

## Root cause

`HANDOFF_PROGRESS_STAGE` is intended to show immediate progress after a **successful** agent creation. Both failure handlers incorrectly reuse it:

1. **`pat_fallback()`** — runs when spawn retries exhaust without any 2xx `POST /v1/agents`.
2. **Pass-back PAT branch** — runs when runs API fails and PAT posts `@cursoragent`.

The sync script treats `HANDOFF_PROGRESS_STAGE` as authoritative for labels and status comment title, masking the actual `stage` in `workflow.state.json`.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `scripts/cursor-workflow-spawn-agent.sh` | Remove `HANDOFF_PROGRESS_STAGE` / `HANDOFF_ACTIVE_SKILL` sync from `pat_fallback()` | AC: no false progress on terminal spawn failure |
| `scripts/cursor-workflow-passback-run.sh` | Remove progress sync from PAT fallback block (lines 75–78) | AC: no false `execute-in-progress` on pass-back API failure |
| `scripts/test-cursor-workflow-handoff.sh` | Add `test_spawn_pat_fallback_no_progress_sync` and `test_passback_pat_fallback_no_progress_sync` | AC: regression tests for both failure paths |
| `scripts/fixtures/cursor-workflow/state-execute-ready-no-demo.json` | **New** (optional) | Cleaner fixture for spawn terminal-failure test |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| `scripts/cursor-workflow-sync-github-status.sh` | Override mechanism stays; callers must not set `HANDOFF_PROGRESS_STAGE` on failure |
| `.github/workflows/cursor-workflow-handoff.yml` | Handoff Action still calls spawn/passback scripts unchanged |
| `workflow/cursor-workflow/WORKFLOW.md` | Spec: no doc change for this narrow fix (#111 documents stalled vs progress holistically) |
| Application code (API, frontend, DB) | Out of scope |

## Implementation steps

### Step 1 — Remove false progress sync from `pat_fallback()`

In `scripts/cursor-workflow-spawn-agent.sh`, edit `pat_fallback()`:

**Delete** (lines 143–145):

```bash
    HANDOFF_PROGRESS_STAGE="$PROGRESS_STAGE" \
    HANDOFF_ACTIVE_SKILL="$SKILL" \
      "$WF/cursor-workflow-sync-github-status.sh" "$STATE_FILE" || true
```

**Keep:**

- `gh auth login` + `gh issue comment` with `@cursoragent ${PROMPT}`
- `echo "Posted handoff comment on issue #${ISSUE} (PAT fallback)"`
- `return 0` / warning when token unset

Do **not** add alternative sync in this function (labels refresh on next push via Actions).

### Step 2 — Remove false progress sync from pass-back PAT fallback

In `scripts/cursor-workflow-passback-run.sh`, PAT fallback block (after API non-2xx):

**Delete** (lines 75–78):

```bash
  HANDOFF_PROGRESS_STAGE="execute-in-progress" \
  HANDOFF_ACTIVE_SKILL="execute" \
  HANDOFF_ACTIVE_AGENT="$agent_id" \
    "$WF/cursor-workflow-sync-github-status.sh" "$STATE_FILE"
```

**Keep:**

- `gh issue comment` with `@cursoragent` prompt
- `exit 0`

**Preserve** success block (lines 60–66) unchanged — still syncs `execute-in-progress` on 2xx.

### Step 3 — Add fixture (optional)

Create `scripts/fixtures/cursor-workflow/state-execute-ready-no-demo.json`:

```json
{
  "issue": 110,
  "branch": "cursor/issue-110-test",
  "stage": "execute-ready",
  "active_skill": null,
  "agents": {},
  "pr": 113,
  "handoff_pending": null,
  "loops": { "bugbot": 0, "ci_autofix": 0, "total_runs": 1 }
}
```

### Step 4 — Regression tests in `test-cursor-workflow-handoff.sh`

#### 4a. `test_spawn_pat_fallback_no_progress_sync`

Setup:

- Copy fixture `state-execute-ready-no-demo.json` to temp state
- `export MOCK_CURSOR_API=1`
- `export MOCK_IN_FLIGHT_RUN_COUNT=8` (admission → `defer:at-cap`; exhausts 3 attempts in `CURSOR_WORKFLOW_TEST_MODE=1`)
- `export CURSOR_HANDOFF_GITHUB_TOKEN=mock`
- `export CURSOR_WORKFLOW_SYNC_CALL_COUNT=0`
- Stub `gh` via temp `PATH` prefix (mock `auth login` + `issue comment` → exit 0, log to stderr)
- `unset CURSOR_API_KEY`

Run:

```bash
WF="$WF" cursor-workflow-spawn-agent.sh 110 "cursor/issue-110-test" "$state" demo "test prompt" "demo-in-progress"
```

Assert:

- Exit 0
- Log contains `Posted handoff comment` (PAT comment still posted)
- `CURSOR_WORKFLOW_SYNC_CALL_COUNT` is `0` (or unset — sync never invoked)
- Log does **not** contain `cursor:demo-in-progress` or `Updated status comment` / `Created status comment`
- `jq -r '.stage' "$state"` is still `execute-ready`

#### 4b. `test_passback_pat_fallback_no_progress_sync`

Setup:

- Copy `state-passback-recovery.json` to temp state
- `export MOCK_CURSOR_API=1`
- `export MOCK_CURSOR_POST_CODE=500`
- `export CURSOR_HANDOFF_GITHUB_TOKEN=mock`
- `export CURSOR_WORKFLOW_SYNC_CALL_COUNT=0`
- Same mock `gh` stub
- `unset CURSOR_API_KEY`

Run:

```bash
WF="$WF" cursor-workflow-passback-run.sh 86 "cursor/issue-86-test" "$state"
```

Assert:

- Exit 0
- `CURSOR_WORKFLOW_SYNC_CALL_COUNT` is `0`
- Log does **not** contain `execute-in-progress` label sync (`label: cursor:execute-in-progress` or `HANDOFF_PROGRESS_STAGE`)
- `jq -r '.stage' "$state"` is still `execute-passback`

#### 4c. Register tests

Add both test functions to the main test runner list (near existing `test_passback_recovery` calls).

### Step 5 — Verify regressions

Existing tests that must still pass (success-path progress sync):

- `test_batched_spawn_writes`
- `test_passback_recovery`
- `test_passback_recovery_409`

## Tests required

| Test | Type | Acceptance criterion |
|------|------|----------------------|
| `test_spawn_pat_fallback_no_progress_sync` | Shell regression | Spawn terminal failure + PAT → no target `*-in-progress` sync; stage unchanged |
| `test_passback_pat_fallback_no_progress_sync` | Shell regression | Pass-back API failure + PAT → no `execute-in-progress` sync |
| `test_batched_spawn_writes` | Shell regression (existing) | Successful spawn still syncs progress |
| `test_passback_recovery` | Shell regression (existing) | Pass-back 2xx still syncs `execute-in-progress` |
| `bash scripts/test-cursor-workflow-handoff.sh` | Suite | All tests pass |
| `bash scripts/verify-workflow-paths.sh` | Suite | Path/schema regression |

No API unit tests, frontend tests, or Docker E2E required.

## Gate script

Before push (execute agent):

```bash
bash scripts/test-cursor-workflow-handoff.sh
bash scripts/verify-workflow-paths.sh
```

No phase gate scripts (`verify-phase*-gates.sh`) — workflow scripts only.

## Documentation updates

None required per spec. #111 will document stalled vs progress sync holistically.

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Operators lose immediate label refresh on failed spawn | Expected — actual stage unchanged; next push to issue branch runs Actions sync with state-derived labels |
| Accidentally remove success-path sync | Existing `test_batched_spawn_writes` + `test_passback_recovery` catch regressions |
| PAT comment stops posting | Test asserts `Posted handoff comment` still logged; only sync lines removed |

**Rollback:** Revert the two script edits; no schema or migration impact.

## Definition of done

- [ ] `pat_fallback()` posts PAT comment but does **not** call sync with `HANDOFF_PROGRESS_STAGE`
- [ ] Pass-back PAT fallback does **not** sync progress; pass-back 2xx path still does
- [ ] `sync_after_spawn()` unchanged — successful spawn still syncs target `*-in-progress`
- [ ] New regression tests for spawn + pass-back failure paths
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` exits 0
- [ ] `bash scripts/verify-workflow-paths.sh` exits 0
- [ ] `workflow.state.json` at `plan-ready` (planning) then `execute-ready` (execute)
- [ ] Demo artifacts captured per `demo/demo-spec.md`
