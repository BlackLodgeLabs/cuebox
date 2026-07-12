# Demo spec — issue #109

Workflow-only change (no product UI). Demo agent validates execute→demo handoff hardening: skill contract, admission gate semantics, and regression scripts.

## Preconditions

- Full Docker stack **not required**
- Branch: `cursor/issue-109-harden-execute-demo-handoff`
- Draft PR **#112** linked in `workflow.state.json` (`pr: 112`)

### Seed steps

None (no database state required).

## Scenarios

### Scenario 1: Execute skill finalize contract

**Goal:** Execute skill documents clearing `active_skill` on `execute-ready`.

**Steps:**

1. Open `.cursor/skills/execute/SKILL.md` → **Finalize state** section.
2. Confirm JSON template includes `"active_skill": null` and `"active_agent_id": null`.
3. Confirm prose states execute agents must clear `active_skill` (and optionally `active_agent_id`) when setting `stage: execute-ready`, including after pass-back resume.
4. Compare with `.cursor/skills/planning/SKILL.md` — planning requires `active_skill: null` on `plan-ready`; execute should mirror that pattern.

**Capture:**

- Log: `workflow/issues/issue-109/demo/scenario-1-execute-skill.log` (grep excerpts from Finalize state section)

**Pass criteria:**

- Finalize state JSON includes `active_skill: null`
- Prose documents the obligation

### Scenario 2: Admission gate stale-lock recovery

**Goal:** Defense-in-depth — `execute-ready` + stale `active_skill: execute` returns `proceed`.

**Steps:**

1. Create temp state file:

   ```json
   {"issue":109,"branch":"cursor/issue-109-test","stage":"execute-ready","active_skill":"execute","agents":{"execute":"bc-test"},"pr":112,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}
   ```

2. Run: `bash scripts/cursor-workflow-admission-gate.sh <state-file> demo`
3. Confirm stdout is `proceed` (not `defer:execute-active`).
4. Repeat with `stage: execute-in-progress`, `active_skill: execute` — confirm stdout is `skip:execute-in-progress`.

**Capture:**

- Log: `workflow/issues/issue-109/demo/scenario-2-admission-gate.log` (gate decisions for both states)

**Pass criteria:**

- Stale lock at `execute-ready` → `proceed`
- Active execute → `skip:execute-in-progress`

### Scenario 3: Handoff regression suite

**Goal:** All workflow handoff tests pass with updated expectations.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh` — exit 0.
2. Confirm renamed/updated test (formerly `test_demo_defer_execute_active`) asserts `proceed` at `execute-ready` with stale `active_skill` and handoff recovery spawns demo.
3. Confirm `test_demo_skip_execute_in_progress` and `test_demo_proceed_execute_ready` still listed and passing.
4. Run `bash scripts/verify-workflow-paths.sh` — exit 0.

**Capture:**

- Log: `workflow/issues/issue-109/demo/scenario-3-regression.log` (full command output, short SHA from `git rev-parse --short HEAD`)

**Pass criteria:**

- Both scripts exit 0
- Stale-lock test expects `proceed`, not `defer:execute-active`

### Scenario 4: WORKFLOW.md documentation

**Goal:** Operator docs reflect execute obligation and narrowed defer semantics.

**Steps:**

1. Open `workflow/cursor-workflow/WORKFLOW.md`.
2. Confirm admission gate table documents `defer:execute-active` only when `active_skill=execute` **and** stage rank &lt; `execute-ready`.
3. Confirm execute agent obligation to clear `active_skill` on `execute-ready` is documented.
4. Confirm cross-run spawn dedup section references #109 stale-lock recovery.

**Capture:**

- Log: `workflow/issues/issue-109/demo/scenario-4-workflow-docs.log` (grep excerpts)

**Pass criteria:**

- Gate table and execute obligation present
- Issue #109 or stale-lock recovery mentioned

### Scenario 5: Handoff YAML unchanged

**Goal:** Spawn logic remains in admission gate + existing scripts (no YAML changes).

**Steps:**

1. `git diff main -- .github/workflows/cursor-workflow-handoff.yml` — expect empty (no diff).

**Capture:**

- Log: `workflow/issues/issue-109/demo/scenario-5-yaml-unchanged.log` (diff output or "no changes")

**Pass criteria:**

- Handoff YAML has no functional changes on this branch

## Artifacts checklist

- [ ] `scenario-1-execute-skill.log`
- [ ] `scenario-2-admission-gate.log`
- [ ] `scenario-3-regression.log`
- [ ] `scenario-4-workflow-docs.log`
- [ ] `scenario-5-yaml-unchanged.log`
- [ ] `workflow/issues/issue-109/demo/demo-notes.md` with date, commit SHA, scenario pass/fail table, gate evidence line
- [ ] No secrets in logs
