# Demo spec — issue #91: Prevent demo spawn before execute-ready

Planning agent: workflow infrastructure change — no Docker stack or product UI required.

## Preconditions

- Repository checked out on branch `cursor/issue-91-prevent-demo-spawn-before-execute-ready`
- Bash, `jq`, and git available (cloud VM default)
- **No Docker stack required** — all scenarios use mocked Cursor API shell tests

### Environment setup

```bash
cd /workspace
export CURSOR_WORKFLOW_PENDING_DRY_RUN=1
export CURSOR_WORKFLOW_TEST_MODE=1
export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
```

## Scenarios

### Scenario 1: Demo blocked during execute-in-progress

**Goal:** Prove admission gate returns `skip:execute-in-progress` and spawn makes 0 POST when stage is `execute-in-progress`.

**Steps:**

1. Run the full handoff test suite:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
2. Confirm output includes `PASS: demo skip execute-in-progress` (or equivalent test name from plan).

**Capture:**

- Log excerpt: `workflow/issues/issue-91/demo/scenario-1-gate-skip.log`

**Pass criteria:**

- `test_demo_skip_execute_in_progress` passes
- Gate decision is `skip:execute-in-progress`
- `MOCK_CURSOR_POST_COUNT_FILE` remains 0 after spawn attempt

### Scenario 2: Demo deferred when execute still active at execute-ready

**Goal:** Reproduce the #84 failure mode — `stage=execute-ready` with `active_skill=execute` must not spawn demo.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh`
2. Confirm `test_demo_defer_execute_active` passes.

**Capture:**

- Log excerpt: `workflow/issues/issue-91/demo/scenario-2-defer-execute-active.log`

**Pass criteria:**

- Gate returns `defer:execute-active`
- Spawn and recovery logs show deferral, not "spawning demo"
- POST count = 0

### Scenario 3: Demo proceeds when execute cycle complete

**Goal:** Confirm unchanged happy path — `execute-ready` with cleared `active_skill` spawns demo.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh`
2. Confirm `test_demo_proceed_execute_ready` and `test_execute_ready_forward` pass.

**Capture:**

- Log excerpt: `workflow/issues/issue-91/demo/scenario-3-proceed.log`

**Pass criteria:**

- Gate returns `proceed`
- Recovery log contains "Handoff recovery: spawning demo"
- POST count = 1

### Scenario 4: Workflow path regression

**Goal:** Confirm no legacy path regressions.

**Steps:**

1. ```bash
   bash scripts/verify-workflow-paths.sh
   ```

**Capture:**

- Terminal output: `workflow/issues/issue-91/demo/scenario-4-verify-workflow-paths.log`

**Pass criteria:**

- Exit code 0, no FAIL lines

### Scenario 5: Re-open path unaffected

**Goal:** Post-review re-open still spawns execute, not demo.

**Steps:**

1. From `test-cursor-workflow-handoff.sh` output, confirm existing tests pass:
   - `reopen inference agents+demo spawns execute`
   - `reopen inference prev_stage spawns execute`
   - `reopen inference agents+demo not demo`

**Capture:**

- Log excerpt: `workflow/issues/issue-91/demo/scenario-5-reopen.log`

**Pass criteria:**

- All three reopen inference assertions pass

## Artifacts checklist

- [ ] `scenario-1-gate-skip.log`
- [ ] `scenario-2-defer-execute-active.log`
- [ ] `scenario-3-proceed.log`
- [ ] `scenario-4-verify-workflow-paths.log`
- [ ] `scenario-5-reopen.log`
- [ ] `workflow/issues/issue-91/demo/demo-notes.md` with short narrative summarizing pass/fail per scenario
- [ ] No secrets in logs
