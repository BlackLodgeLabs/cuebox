# Demo spec — issue #119

Workflow-only change (skills/docs). No Docker stack or product UI scenarios required. Demo agent validates documentation deliverables and gate script.

## Preconditions

- Issue branch `cursor/issue-119-demo-single-push-finalize` checked out
- Execute stage complete (skill/doc edits committed)
- No full Docker stack required for this issue

### Seed steps

None — no database or API state required.

## Scenarios

### Scenario 1: Demo skill batched final push documented

**Goal:** Confirm `.cursor/skills/demo/SKILL.md` documents the single-push `demo-ready` finalize contract.

**Steps:**

1. Open `.cursor/skills/demo/SKILL.md`.
2. Locate the **"Git and state — batched final push"** section (or equivalent heading).
3. Verify it documents:
   - Artifacts + `demo-notes.md` + `workflow.state.json` in one handoff-triggering commit
   - `git rev-parse HEAD` → embed SHA in `demo-notes.md` before push
   - `git commit --amend --no-edit` if SHA changes after initial commit
   - **No** follow-up SHA-only push after `demo-ready`
   - Expected push pattern: optional `demo-in-progress`; one `demo-ready` push
   - `active_skill: null` (and optionally `active_agent_id: null`) on finalize

**Capture:**

- Screenshot: `workflow/issues/issue-119/demo/scenario-1-demo-skill-batched-push.png` (editor or browser view of the relevant section)

**Pass criteria:**

- All bullets above are present and explicit.
- Anti-pattern forbidding SHA-fix follow-up push is documented.

### Scenario 2: WORKFLOW.md and automation prompt cross-links

**Goal:** Confirm cross-documentation so agents do not race the handoff Action.

**Steps:**

1. Open `workflow/cursor-workflow/WORKFLOW.md` and find **"Demo push batching"** subsection.
2. Verify it covers: cancel-in-progress behavior, 1–2 push pattern, amend-in-place SHA, link to demo skill, recovery not relied upon (#115).
3. Open `workflow/cursor-workflow/automation-prompts/demo.md`.
4. Verify prompt references batched final push (not "set stage to demo-ready and push" alone).

**Capture:**

- Screenshot: `workflow/issues/issue-119/demo/scenario-2-workflow-demo-batching.png` (WORKFLOW.md subsection)
- Screenshot: `workflow/issues/issue-119/demo/scenario-2-automation-prompt.png` (automation-prompts/demo.md)

**Pass criteria:**

- Both files updated per acceptance criteria.
- Demo push batching subsection is symmetric to create-pr push batching section.

### Scenario 3: Workflow path regression passes

**Goal:** Confirm `verify-workflow-paths.sh` still passes after doc/skill edits.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh` from repo root.
2. Confirm exit code 0 and `PASS: no legacy workflow paths found` output.

**Capture:**

- Terminal output saved to: `workflow/issues/issue-119/demo/scenario-3-verify-workflow-paths.log`

**Pass criteria:**

- Script exits 0.

### Scenario 4: No application code changes

**Goal:** Confirm scope stayed workflow-only.

**Steps:**

1. Run `git diff main -- api frontend`.
2. Confirm no output (empty diff).

**Capture:**

- Terminal output saved to: `workflow/issues/issue-119/demo/scenario-4-no-app-code.log`

**Pass criteria:**

- `api/` and `frontend/` unchanged relative to `main`.

### Scenario 5 (optional): create-pr / babysit active_skill clearing

**Goal:** If execute included optional consistency edits, confirm finalize contracts.

**Steps:**

1. If `.cursor/skills/create-pr/SKILL.md` was updated: verify `active_skill: null` on `create-pr-ready` finalize.
2. If `.cursor/skills/babysit-pr/SKILL.md` was updated: verify `active_skill: null` on `complete` finalize.

**Capture:**

- Screenshot: `workflow/issues/issue-119/demo/scenario-5-optional-active-skill.png` (only if optional edits were made)

**Pass criteria:**

- Optional edits match execute/planning/demo finalize pattern, or scenario marked N/A in `demo-notes.md`.

## Artifacts checklist

- [ ] `scenario-1-demo-skill-batched-push.png`
- [ ] `scenario-2-workflow-demo-batching.png`
- [ ] `scenario-2-automation-prompt.png`
- [ ] `scenario-3-verify-workflow-paths.log`
- [ ] `scenario-4-no-app-code.log`
- [ ] `scenario-5-optional-active-skill.png` (if applicable)
- [ ] `workflow/issues/issue-119/demo/demo-notes.md` with scenario pass/fail table and commit SHA

## Demo agent finalize reminder

When all scenarios pass, follow the **new** batched final push in the demo skill (dogfood issue #119):

1. Draft `demo-notes.md` locally.
2. Set `stage: demo-ready`, `active_skill: null`, increment `loops.total_runs`.
3. Commit artifacts + notes + state; embed SHA via amend; **single push**.
