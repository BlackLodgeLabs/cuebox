# Demo spec — issue #110

Workflow-only change (no product UI). Demo agent validates that failed spawn/pass-back paths no longer set false `*-in-progress` GitHub labels, while success paths still sync progress.

## Preconditions

- Full Docker stack **not required**
- Branch: `cursor/issue-110-honest-github-status-failed-spawn` (or merged agent side branch on draft PR **#113**)
- `workflow/issues/issue-110/PLAN.md` committed at `plan-ready`

### Seed steps

None (no database state required).

## Scenarios

### Scenario 1: Spawn terminal failure — no false progress sync

**Goal:** After spawn retries exhaust and `pat_fallback()` runs, status sync is not invoked with target `demo-in-progress`.

**Steps:**

1. Confirm `scripts/cursor-workflow-spawn-agent.sh` `pat_fallback()` does **not** contain `HANDOFF_PROGRESS_STAGE` or `cursor-workflow-sync-github-status.sh`.
2. Run `bash scripts/test-cursor-workflow-handoff.sh` — confirm new test `test_spawn_pat_fallback_no_progress_sync` (or equivalent grep in output) passes.
3. Optionally grep test log for: `Posted handoff comment` present; no `cursor:demo-in-progress` label sync.

**Capture:**

- Log: `workflow/issues/issue-110/demo/scenario-1-spawn-failure.log` (test output excerpt)

**Pass criteria:**

- `pat_fallback()` has no progress sync call
- Regression test passes; `stage` remains `execute-ready` in test fixture

### Scenario 2: Pass-back PAT failure — no false progress sync

**Goal:** When runs API returns non-2xx and PAT fallback posts `@cursoragent`, no `execute-in-progress` progress sync runs.

**Steps:**

1. Confirm `scripts/cursor-workflow-passback-run.sh` PAT fallback block does **not** call `cursor-workflow-sync-github-status.sh`.
2. Confirm success block (API 2xx) still calls sync with `HANDOFF_PROGRESS_STAGE="execute-in-progress"`.
3. Run handoff test suite — confirm pass-back PAT failure test passes.

**Capture:**

- Log: `workflow/issues/issue-110/demo/scenario-2-passback-failure.log` (test output excerpt)

**Pass criteria:**

- PAT fallback has no sync; success path preserved
- Regression test passes

### Scenario 3: Success-path regression

**Goal:** Successful spawn and pass-back still sync in-progress labels.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh` — confirm existing tests pass:
   - `test_batched_spawn_writes`
   - `test_passback_recovery`
2. Grep output for `PASS: batched spawn` and `PASS: passback recovery started run`.

**Capture:**

- Log: `workflow/issues/issue-110/demo/scenario-3-success-regression.log`

**Pass criteria:**

- All listed tests PASS; full suite exit 0

### Scenario 4: Workflow path verification

**Goal:** Repository workflow path and schema checks still pass.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh` — exit 0.
2. Record short commit SHA (`git rev-parse --short HEAD`).

**Capture:**

- Log: `workflow/issues/issue-110/demo/scenario-4-verify-paths.log`

**Pass criteria:**

- `verify-workflow-paths.sh` exits 0

## Artifacts checklist

- [ ] `scenario-1-spawn-failure.log`
- [ ] `scenario-2-passback-failure.log`
- [ ] `scenario-3-success-regression.log`
- [ ] `scenario-4-verify-paths.log`
- [ ] `workflow/issues/issue-110/demo/demo-notes.md` with date, commit SHA, scenario pass/fail table
- [ ] No secrets in logs
