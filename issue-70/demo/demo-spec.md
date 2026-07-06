# Demo spec — issue #70

Workflow-only hardening — no Cuebox UI/API demo required. Demo agent validates shell tests, verify script, and documents outcomes.

## Preconditions

- Repository checked out on branch `cursor/issue-70-harden-cursor-workflow-handoff-dedup`
- `jq`, `bash`, `git` available
- **No Docker stack required** (no application changes)

### Seed steps

None — workflow scripts and tests are self-contained.

## Scenarios

### Scenario 1: Workflow path regression

**Goal:** Confirm legacy path checks and extended schema validation pass.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh` from repo root.
2. Capture terminal output showing `PASS: no legacy workflow paths found`.

**Capture:**

- Screenshot: `workflow/issues/issue-70/demo/scenario-1-verify-workflow-paths.png`

**Pass criteria:**

- Script exits 0.
- Output includes PASS line.
- Extended checks reference `handoff_pending`, admission/spawn scripts, and skill merge-helper refs.

### Scenario 2: Handoff shell tests (mocked)

**Goal:** Prove dedup, cap, 400 deferral, babysit recovery, pending lock, and stage merge logic without live Cloud Agent API calls.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh` from repo root.
2. Confirm all test cases report PASS.

**Capture:**

- Screenshot: `workflow/issues/issue-70/demo/scenario-2-handoff-tests-pass.png`

**Pass criteria:**

- Script exits 0.
- All six cases from PLAN.md pass (dedup, at-cap, API 400, babysit recovery, fresh pending, stage merge).

### Scenario 3: Stage merge monotonicity

**Goal:** Demonstrate side-branch stage regression is prevented.

**Steps:**

1. Run the stage-merge test case interactively or show its fixture inputs:
   - Remote state: `stage: create-pr-ready`
   - Local state: `stage: demo-ready`
2. Run merge helper with `MERGE_STATE_REMOTE_JSON` fixture.
3. Confirm merged output retains `create-pr-ready`.

**Capture:**

- Screenshot: `workflow/issues/issue-70/demo/scenario-3-stage-merge.png`

**Pass criteria:**

- Merged `stage` is `create-pr-ready` (higher rank wins).

### Scenario 4: Documentation spot-check

**Goal:** Confirm operator-facing docs describe cap, deferral, and babysit recovery.

**Steps:**

1. Open `workflow/cursor-workflow/WORKFLOW.md` and locate sections on:
   - 8-agent cap
   - `handoff_pending`
   - Babysit recovery predicate
2. Open `workflow/cursor-workflow/SETUP.md` and locate deferral behavior.

**Capture:**

- Screenshot: `workflow/issues/issue-70/demo/scenario-4-docs-cap-recovery.png`

**Pass criteria:**

- Both docs mention global cap and babysit recovery.
- WORKFLOW.md documents `handoff_pending` semantics.

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-70/demo/`
- [ ] `workflow/issues/issue-70/demo/demo-notes.md` with short narrative and pass/fail table
- [ ] No secrets in images or logs
- [ ] Gate evidence line ready for create-pr: `Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>`
