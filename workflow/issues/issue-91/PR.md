## Related Issue

Closes #91

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/91)

## Description

**What does this PR do?**

During issue #84, the cursor-workflow handoff spawned **demo** at 06:26 UTC on a premature `execute-ready` transition while `active_skill` was still `execute` and implementation commits continued until 06:30. Demo ran against incomplete code, issued a pass-back to execute, and wasted a demo cycle plus a failed handoff run.

This PR hardens the shared admission gate (`cursor-workflow-admission-gate.sh`) so **demo** never spawns while the execute cycle is still active. When `TARGET_SKILL=demo`, the gate now enforces:

| Condition | Gate outcome | Effect |
|-----------|--------------|--------|
| `stage=execute-in-progress` | `skip:execute-in-progress` | No POST, no retry |
| Stage rank < `execute-ready` (40) | `skip:stage-not-ready` | No POST |
| `active_skill=execute` at `execute-ready` or higher | `defer:execute-active` | Backoff retry; recovery defers |

Recovery (`cursor-workflow-handoff-recovery.sh`) already calls the admission gate before spawn, so it inherits these checks automatically. Three regression tests cover the #84 failure mode and the unchanged happy path.

**Why is this the best approach?**

The admission gate is the single enforcement point shared by transition `handoff()` and recovery — adding demo-specific stage/skill preconditions there avoids duplicating logic in YAML or recovery scripts. Using `active_skill=execute` as the defer signal closes the forensic gap where `execute-in-progress` never persisted on branch tip due to monotonic merge / concurrent pushes. Re-open paths (`--reopen` → execute) are unaffected because the demo block only runs when `TARGET_SKILL=demo`.

## Changes Proposed

* **`scripts/cursor-workflow-admission-gate.sh`** — Added demo-specific preconditions before generic `proceed`: `skip:execute-in-progress`, `skip:stage-not-ready`, `defer:execute-active`.
* **`scripts/test-cursor-workflow-handoff.sh`** — Added `test_demo_skip_execute_in_progress`, `test_demo_defer_execute_active`, and `test_demo_proceed_execute_ready`; updated `test_execute_ready_forward` fixture to set `active_skill: null`.
* **`workflow/cursor-workflow/WORKFLOW.md`** — Documented new gate outcomes and execute→demo deferral rule in cross-run dedup and recovery coverage sections.
* **`.github/workflows/cursor-workflow-handoff.yml`** — Added documentation comment before demo dispatch (belt-and-suspenders; gate is the enforcement point).
* **`workflow/issues/issue-91/demo/`** — Captured scenario log artifacts and demo notes (all five scenarios pass).

## Scenario Results

Workflow infrastructure change — no product UI. Evidence is shell test output and gate logs.

| Scenario | Result | Key assertion |
|----------|--------|---------------|
| 1. Demo blocked during `execute-in-progress` | **PASS** | Gate: `skip:execute-in-progress`; POST count 0 |
| 2. Demo deferred when `active_skill=execute` at `execute-ready` | **PASS** | Gate: `defer:execute-active`; recovery defers, POST count 0 |
| 3. Demo proceeds when execute cycle complete | **PASS** | Gate: `proceed`; recovery spawns demo; POST count 1 |
| 4. Workflow path regression | **PASS** | `verify-workflow-paths.sh` exit 0 |
| 5. Re-open path unaffected | **PASS** | All three reopen inference tests pass |

Log artifacts (absolute URLs):

* [scenario-1-gate-skip.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/7acec43/workflow/issues/issue-91/demo/scenario-1-gate-skip.log)
* [scenario-2-defer-execute-active.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/7acec43/workflow/issues/issue-91/demo/scenario-2-defer-execute-active.log)
* [scenario-3-proceed.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/7acec43/workflow/issues/issue-91/demo/scenario-3-proceed.log)
* [scenario-4-verify-workflow-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/7acec43/workflow/issues/issue-91/demo/scenario-4-verify-workflow-paths.log)
* [scenario-5-reopen.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/7acec43/workflow/issues/issue-91/demo/scenario-5-reopen.log)

## How to Test

1. Checkout the branch:
   ```bash
   git fetch origin cursor/issue-91-prevent-demo-spawn-before-execute-ready
   git checkout cursor/issue-91-prevent-demo-spawn-before-execute-ready
   ```
2. Set test environment (no Docker stack required):
   ```bash
   export CURSOR_WORKFLOW_PENDING_DRY_RUN=1
   export CURSOR_WORKFLOW_TEST_MODE=1
   export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
   ```
3. Run the handoff regression suite:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
   Confirm these tests pass:
   - `demo skip execute-in-progress`
   - `demo defer execute-active`
   - `demo proceed execute-ready`
   - `execute-ready forward` (existing happy path)
   - `reopen inference agents+demo spawns execute` (and related reopen tests)
4. Run workflow path regression:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
   Expect exit 0 and `PASS: no legacy workflow paths found`.

## Known Issues / Notes for Reviewer

* **Scripts load from `main` in Actions** — admission gate changes take effect for live handoffs after merge to `main`; this branch carries the scripts for review.
* **`defer:execute-active` relies on execute clearing `active_skill`** — the execute skill already sets `active_skill: null` on final `execute-ready`; if execute forgets, demo defers with backoff retry within the job.
* **No application code changes** — workflow infrastructure only; no database migrations or Docker rebuild required.
* **Out of scope** — spawn dedup / record-spawn TOCTOU (#84/#90) and execute skill hygiene for premature `execute-ready` are separate concerns.

## Gate evidence

- [x] `bash scripts/test-cursor-workflow-handoff.sh` exit 0 at `7acec43` (demo scenarios 1–3, 5); babysit re-verified at `3dd2766`
- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `7acec43` (demo scenario 4); babysit re-verified at `3dd2766`

## Checklist

- [ ] Admission gate demo preconditions match spec acceptance criteria
- [ ] Regression tests cover execute-in-progress skip, execute-active defer, and happy-path proceed
- [ ] Re-open path (`execute-ready` → execute `--reopen`) unaffected
- [ ] `WORKFLOW.md` documents new gate outcomes
- [ ] No secrets in demo logs or PR description
