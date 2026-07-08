## Related Issue

Closes #86

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/86)

## Description

**What does this PR do?**

Closes the remaining handoff recovery gaps documented in issue #79's workflow review after the initial recovery script landed in PR #82. Forward handoff stages (`spec-ready` through `create-pr-ready`) were mostly covered on sync-only pushes, but **pass-back**, **post-review re-open**, **draft PR linking**, and **manual resync** could still leave issues stuck until an operator pushed again or intervened manually.

This PR extracts shared helpers from inline YAML (`passback-run`, `ensure-pr-on-branch`, `infer-reopen`), extends `cursor-workflow-handoff-recovery.sh` to cover `execute-passback`, re-open inference, and early-stage draft PR linking, and wires recovery into the `workflow_dispatch` resync path so stuck issues self-heal without a no-op push.

**Why is this the best approach?**

Extracting helpers keeps push-triggered `handoff()` and recovery on the same code paths — no duplicated pass-back or ensure-PR logic. Re-open inference uses state signals (`agents.demo` + `agents.execute` both set, or `prev_stage=changes-requested`) with a git fallback for incomplete agent discovery, avoiding false positives on first `execute-ready` after execute. Pass-back recovery reuses `POST /v1/agents/{id}/runs` (not `POST /v1/agents`), respecting 409 busy deferral. Resync recovery runs after label/comment sync with empty `prev_stage`, letting `infer-reopen.sh` handle the changes-requested case.

## Changes Proposed

* **`scripts/cursor-workflow-passback-run.sh`** (new) — Extract `handle_passback()` API logic for reuse by push job and recovery; 409 busy → exit 0.
* **`scripts/cursor-workflow-ensure-pr-on-branch.sh`** (new) — Extract `ensure_pr_on_branch()` so recovery links a draft PR before spawning spec/plan agents.
* **`scripts/cursor-workflow-infer-reopen.sh`** (new) — State/git heuristic: `execute-ready` + prior cycle agents → spawn execute `--reopen`, not demo.
* **`scripts/cursor-workflow-handoff-recovery.sh`** — Add `execute-passback` case; call ensure-pr for `spec-ready`/`plan-ready`; integrate reopen inference for `execute-ready`.
* **`.github/workflows/cursor-workflow-handoff.yml`** — Replace inline passback/ensure helpers with script calls; invoke recovery from `resync-status` after sync.
* **`scripts/cursor-workflow-load-scripts.sh`** — Register the three new scripts in `HANDOFF_SCRIPTS`.
* **`scripts/test-cursor-workflow-handoff.sh`** — Regression tests for pass-back recovery, 409 deferral, reopen inference, ensure PR, and forward execute-ready → demo.
* **`scripts/verify-workflow-paths.sh`** — Grep assertion that `resync-status` invokes `handoff-recovery.sh` after sync.
* **`scripts/fixtures/cursor-workflow/`** — Fixtures for passback, reopen, and null-pr recovery scenarios.
* **`workflow/cursor-workflow/WORKFLOW.md`** — Handoff recovery coverage table (pass-back, re-open, resync).
* **`workflow/cursor-workflow/SETUP.md`** — Note that manual resync runs recovery automatically.

## Scenario Results

Workflow-script hardening only — no UI changes. Demo evidence is log-based.

| Scenario | Result | Evidence |
|----------|--------|----------|
| 1. Workflow path regression gate | PASS | [scenario-1-verify-workflow-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f49e4e202f9a4760592484ffa8d7523b5b812ede/workflow/issues/issue-86/demo/scenario-1-verify-workflow-paths.log) |
| 2. Mock handoff test suite (all four gaps) | PASS | [scenario-2-test-handoff.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f49e4e202f9a4760592484ffa8d7523b5b812ede/workflow/issues/issue-86/demo/scenario-2-test-handoff.log) |
| 3. Pass-back recovery (focused) | PASS | [scenario-3-passback-recovery.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f49e4e202f9a4760592484ffa8d7523b5b812ede/workflow/issues/issue-86/demo/scenario-3-passback-recovery.log) |
| 4. Re-open inference (focused) | PASS | [scenario-4-reopen-recovery.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f49e4e202f9a4760592484ffa8d7523b5b812ede/workflow/issues/issue-86/demo/scenario-4-reopen-recovery.log) |
| 5. Ensure draft PR on early recovery | PASS | [scenario-5-ensure-pr.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f49e4e202f9a4760592484ffa8d7523b5b812ede/workflow/issues/issue-86/demo/scenario-5-ensure-pr.log) |

Key assertions from scenario 2:

- `PASS: passback recovery started run`
- `PASS: passback recovery 0 agent POST`
- `PASS: passback recovery 409 defer exit 0`
- `PASS: reopen inference agents+demo spawns execute`
- `PASS: execute-ready forward spawns demo`
- `PASS: spec-ready ensure pr updated state`
- `PASS: plan-ready ensure pr recovery spawned execute`

## How to Test

1. Checkout the branch: `git checkout cursor/issue-86-handoff-recovery-gaps`
2. Run workflow path gate: `bash scripts/verify-workflow-paths.sh` — expect exit 0, no `FAIL:` lines; grep confirms `resync-status` invokes `cursor-workflow-handoff-recovery.sh`.
3. Run handoff integration suite: `bash scripts/test-cursor-workflow-handoff.sh` — expect exit 0 and `test-cursor-workflow-handoff.sh: all cases passed`.
4. Optional focused spot checks (mock API, no secrets):
   ```bash
   export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
   export CURSOR_WORKFLOW_PENDING_DRY_RUN=1
   export CURSOR_WORKFLOW_TEST_MODE=1
   export MOCK_CURSOR_API=1
   export MOCK_ACTIVE_AGENT_COUNT=0

   # Pass-back recovery
   state=$(mktemp)
   cp scripts/fixtures/cursor-workflow/state-passback-recovery.json "$state"
   WF=scripts scripts/cursor-workflow-handoff-recovery.sh 86 cursor/issue-86-handoff-recovery-gaps "$state"
   # Expect: Pass-back run started; no forward spawn

   # Re-open inference
   cp scripts/fixtures/cursor-workflow/state-reopen-recovery.json "$state"
   WF=scripts scripts/cursor-workflow-handoff-recovery.sh 86 cursor/issue-86-handoff-recovery-gaps "$state" ""
   # Expect: Handoff recovery: spawning execute (not demo)

   # Ensure draft PR
   export MOCK_ENSURE_DRAFT_PR=99
   cp scripts/fixtures/cursor-workflow/state-spec-ready-null-pr.json "$state"
   WF=scripts scripts/cursor-workflow-handoff-recovery.sh 86 cursor/issue-86-test "$state"
   jq -r '.pr' "$state"
   # Expect: 99
   ```

No Docker stack, API keys, or application migrations required.

## Known Issues / Notes for Reviewer

* Workflow infrastructure only — no application, database, or frontend changes.
* New helper scripts must merge to `main` before production Actions jobs on other branches can load them from `origin/main` via `load-scripts.sh`; this is expected for workflow script changes.
* Focused scenario 4 may log pending-lock deferral in dry-run without `GH_TOKEN` — reopen decision is still exercised in the full test suite (scenario 2).
* Scenario 5 uses branch `cursor/issue-86-test` (nonexistent remote) so refetch does not overwrite mock `pr` with tip `pr: 96` — same isolation as automated `test_spec_ready_ensure_pr`.
* Demo logs under `workflow/issues/issue-86/demo/`; no secrets in captured output.
* Builds on prerequisites from issues #83, #84, and #90 (fetch-depth, spawn dedup, record-spawn TOCTOU).

## Gate evidence

- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `f49e4e2`
- [x] Workflow regression: `test-cursor-workflow-handoff.sh` exit 0 at `f49e4e2` (pass-back, reopen, ensure-pr, forward demo)

## Checklist

- [ ] Acceptance criteria in issue #86 spec are met
- [ ] No application code or schema changes
- [ ] Demo logs reviewed under `workflow/issues/issue-86/demo/`
- [ ] Recovery coverage table in `WORKFLOW.md` is accurate
