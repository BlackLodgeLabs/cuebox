# Demo spec — issue #127

Planning agent output. Demo agent follows this exactly.

**Tier:** workflow — no Docker stack or health URLs required unless a scenario explicitly needs them.

## Preconditions

- Repository checkout on branch `cursor/issue-127-v1-hardening-orchestration-reliability-68f4` at execute commit SHA
- `source scripts/cursor-workflow-config.sh` succeeds
- No application stack required (workflow-tier change only)

### Seed steps

None — all scenarios use mocked shell tests and doc verification.

## Scenarios

### Scenario 1: Handoff regression suite passes

**Goal:** Prove all new and existing orchestration tests pass after execute.

**Steps:**

1. `cd` to repository root.
2. Run `bash scripts/test-cursor-workflow-handoff.sh`.
3. Capture full stdout/stderr.

**Capture:**

- Log: `workflow/issues/issue-127/demo/scenario-1-handoff-tests.log`

**Pass criteria:**

- Exit code 0
- Log ends with `test-cursor-workflow-handoff.sh: all cases passed`
- New cases present when implemented: `canonical_branch_guard`, `side_branch_push_ignored`, `same_skill_in_flight`, `duplicate_handoff_skip`, `defer_honest_labels`, `deferred_marker_written`, `late_stage_resume` (names may vary — grep log for PASS lines)

### Scenario 2: Workflow path and portable gates

**Goal:** Confirm workflow regression gates and portable boundary unchanged in semantics.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh`.
2. Run `bash scripts/verify-workflow-portable.sh`.
3. Record exit codes and tail of output.

**Capture:**

- Log: `workflow/issues/issue-127/demo/scenario-2-gates.log`

**Pass criteria:**

- Both commands exit 0
- `verify-workflow-portable.sh` accepts optional `handoff_deferred` in state schema

### Scenario 3: Canonical branch guard (mocked)

**Goal:** Side-branch pushes do not trigger label sync or spawn.

**Steps:**

1. With `MOCK_CURSOR_API=1` and `CURSOR_WORKFLOW_TEST_MODE=1`, run the canonical-branch guard test from `test-cursor-workflow-handoff.sh` (or dedicated helper if extracted).
2. Simulate push ref `cursor/issue-127-pr-130-plan-agent-test` with state `branch: cursor/issue-127-v1-hardening-orchestration-reliability-68f4`.
3. Assert early exit before sync/spawn.

**Capture:**

- Log: `workflow/issues/issue-127/demo/scenario-3-canonical-guard.log`

**Pass criteria:**

- Guard skips handoff when push ref ≠ `state.branch`
- No `POST` to Cursor API in log
- No `Updated status comment` / label sync for side-branch ref

### Scenario 4: Honest labels on defer

**Goal:** Deferred spawn leaves GitHub label matching state file stage, not optimistic `*-in-progress`.

**Steps:**

1. Run `test_defer_honest_labels` (or equivalent) with `MOCK_GITHUB_SYNC=1`.
2. State at `demo-ready`; spawn defers at cap without recording `agents.demo`.
3. Inspect sync output for `DISPLAY_STAGE` / label applied.

**Capture:**

- Log: `workflow/issues/issue-127/demo/scenario-4-honest-labels.log`

**Pass criteria:**

- Label/stage shown is `demo-ready` (or `cursor:demo-ready`), not `demo-in-progress`
- After mocked successful spawn + record, label advances to `demo-in-progress`

### Scenario 5: Operator documentation exists

**Goal:** `OPERATIONS.md` checklist is present and cross-linked.

**Steps:**

1. `test -f workflow/cursor-workflow/OPERATIONS.md`
2. Grep for: `in-flight`, `ACTIVE`, `workflow_dispatch`, `cursor-workflow-count-active-agents`
3. Grep `WORKFLOW.md` and `SETUP.md` for link or reference to `OPERATIONS.md`

**Capture:**

- Log: `workflow/issues/issue-127/demo/scenario-5-operations-doc.log`

**Pass criteria:**

- `OPERATIONS.md` exists with pre-flight checklist
- `WORKFLOW.md` cross-links operations checklist
- `SETUP.md` documents human fallback (`@cursoragent use <skill> skill for issue NNN`)

### Scenario 6: Deferred handoff marker (optional if implemented)

**Goal:** Backoff exhaust persists `handoff_deferred`; cleared on spawn.

**Steps:**

1. Run deferred-marker test with `MOCK_CURSOR_API=1`.
2. Verify `handoff_deferred` written to state on `defer:at-cap` exhaust.
3. Verify marker cleared after successful `record-spawn-on-branch.sh`.

**Capture:**

- Log: `workflow/issues/issue-127/demo/scenario-6-deferred-marker.log`

**Pass criteria:**

- `handoff_deferred.skill` matches target skill
- Marker null after successful spawn

## Artifacts checklist

- [ ] `scenario-1-handoff-tests.log`
- [ ] `scenario-2-gates.log`
- [ ] `scenario-3-canonical-guard.log`
- [ ] `scenario-4-honest-labels.log`
- [ ] `scenario-5-operations-doc.log`
- [ ] `scenario-6-deferred-marker.log` (when AC5 implemented)
- [ ] `workflow/issues/issue-127/demo/demo-notes.md` with date, commit SHA, tier, gate exit lines
