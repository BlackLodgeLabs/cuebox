# Demo spec — issue #84

Cross-run handoff spawn dedup hardening. **No Docker stack required** — this is workflow-script infrastructure only.

## Preconditions

- Repository checked out on branch `cursor/issue-84-harden-concurrent-handoff-spawn-dedup`
- `bash`, `jq`, and `git` available on the VM
- No API keys or running services needed

### Seed steps

None — all scenarios use mocked fixtures under `scripts/fixtures/cursor-workflow/`.

## Scenarios

### Scenario 1: Workflow handoff tests pass (regression + new cases)

**Goal:** Prove extended `test-cursor-workflow-handoff.sh` passes, including new concurrent/overlapping spawn regression cases.

**Steps:**

1. From repo root, run:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
2. Confirm output ends with `test-cursor-workflow-handoff.sh: all cases passed`.
3. Grep the log for new case markers (remote agent skip, remote pending defer, single POST under race, recovery remote skip, record-spawn first-wins).

**Capture:**

- Terminal log: `workflow/issues/issue-84/demo/scenario-1-handoff-tests.log`

**Pass criteria:**

- Exit code 0
- Log contains `PASS:` lines for new cross-run cases (remote agent skip, pending defer, single POST, recovery skip, first-wins)
- No `FAIL:` lines

### Scenario 2: Workflow paths gate passes

**Goal:** Prove `verify-workflow-paths.sh` passes with new `cursor-workflow-refetch-state.sh` registered.

**Steps:**

1. From repo root, run:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
2. Confirm exit code 0 and final success message.

**Capture:**

- Terminal log: `workflow/issues/issue-84/demo/scenario-2-verify-workflow-paths.log`

**Pass criteria:**

- Exit code 0
- `cursor-workflow-refetch-state.sh` listed in load-scripts / required-scripts checks (no FAIL for missing script)

### Scenario 3: Spawn flow documents cross-run dedup

**Goal:** Show WORKFLOW.md documents the new cross-run refetch + branch pending lock semantics.

**Steps:**

1. Open `workflow/cursor-workflow/WORKFLOW.md`.
2. Locate the cross-run spawn dedup section (refetch before POST, branch `handoff_pending` before API call, second admission check).
3. Confirm `workflow/cursor-workflow/RETROSPECTIVES.md` concurrent-handoff pattern row links to issue #84 mitigation (not "proposed").

**Capture:**

- Screenshot: `workflow/issues/issue-84/demo/scenario-3-workflow-docs.png` (terminal `grep -n` highlighting the new section, or browser/editor view of WORKFLOW.md)

**Pass criteria:**

- WORKFLOW.md describes refetch + pending-before-POST + re-gate sequence
- RETROSPECTIVES.md pattern row references landed mitigation for issue #84

## Artifacts checklist

- [ ] `scenario-1-handoff-tests.log` saved under `workflow/issues/issue-84/demo/`
- [ ] `scenario-2-verify-workflow-paths.log` saved under `workflow/issues/issue-84/demo/`
- [ ] `scenario-3-workflow-docs.png` saved under `workflow/issues/issue-84/demo/`
- [ ] `workflow/issues/issue-84/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets in logs or screenshots
