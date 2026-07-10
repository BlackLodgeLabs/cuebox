# Demo spec — issue #92: Batch create-pr single final push

Planning agent output. Demo agent follows this exactly.

## Preconditions

- Repository checked out on branch `cursor/issue-92-batch-create-pr-single-commit`
- **No Docker stack required** — workflow documentation-only change
- Execute has committed skill + WORKFLOW.md + automation-prompt changes

### Seed steps

None. No database or application state required.

## Scenarios

### Scenario 1: Skill and workflow docs contain batching guidance

**Goal:** Prove acceptance criteria for documentation updates are met.

**Steps:**

1. Open `.cursor/skills/create-pr/SKILL.md` and confirm:
   - Early `create-pr-in-progress` push is optional/progress-only and does not include `PR.md`
   - Exactly **one** handoff-triggering push with complete `PR.md` + `stage: create-pr-ready`
   - SHA resolution happens before push (local commit → `git rev-parse HEAD` → amend if URLs change → single push)
   - Explicit prohibition of follow-up "fix demo image SHA" push
2. Open `workflow/cursor-workflow/WORKFLOW.md` and confirm a create-pr push batching subsection exists near stage-specific handoff / demo URL guidance, with cross-references to issues #79 and #84.
3. Open `workflow/cursor-workflow/automation-prompts/create-pr.md` and confirm it matches the skill's batched-final-push guidance (not merely "set stage and push").
4. Run `bash scripts/verify-workflow-paths.sh` and capture exit code.

**Capture:**

- Text excerpt file: `workflow/issues/issue-92/demo/scenario-1-skill-excerpts.md` — paste the batched-push and SHA-amend sections from the skill (≤30 lines each)
- Gate output: `workflow/issues/issue-92/demo/scenario-1-verify-workflow-paths.log` — full stdout/stderr from `verify-workflow-paths.sh`

**Pass criteria:**

- All three files contain consistent batched-final-push guidance
- `verify-workflow-paths.sh` exits 0
- No contradictory instruction to push `PR.md` before SHA URLs are final

### Scenario 2: Simulated create-pr commit pattern (dry run)

**Goal:** Validate the documented workflow produces a single `create-pr-ready` handoff push for a workflow-only issue (no demo screenshots).

**Steps:**

1. On a detached worktree or local branch tip (do **not** push to the issue branch), simulate the create-pr agent workflow per the updated skill:
   - Draft a minimal `PR.md` stub locally
   - Stage `PR.md` + `workflow.state.json` with `stage: create-pr-ready`
   - `git commit` locally
   - Run `git rev-parse HEAD` and verify/amend URLs in `PR.md` if present
   - Count commits that would set `create-pr-ready` with `PR.md` — must be **1**
2. Inspect `git log -1 --name-only` on the simulated commit — must include both `PR.md` and `workflow.state.json`.
3. Document whether optional script guard (Step 4 in PLAN) was implemented or deferred.

**Capture:**

- Notes: `workflow/issues/issue-92/demo/scenario-2-dry-run-notes.md` — commands run, commit count, amend used (yes/no), script-guard decision

**Pass criteria:**

- Simulated flow yields exactly one commit containing `PR.md` + `create-pr-ready` state
- No second commit for SHA URL fix
- Script guard status documented (implemented or deferred with rationale)

### Scenario 3: No regression for issues without demo images

**Goal:** Confirm workflow-only issues (no `demo/*.png`) still complete create-pr in one final push per updated guidance.

**Steps:**

1. Read the skill section for issues without demo screenshots (workflow-only changes).
2. Confirm Gate evidence section still references `verify-workflow-paths.sh` for workflow-only issues.
3. Note in demo-notes that issue #92 itself is an example of workflow-only create-pr (no product UI screenshots in PR.md Scenario Results).

**Capture:**

- Brief note in `workflow/issues/issue-92/demo/demo-notes.md` under "Scenario 3"

**Pass criteria:**

- Skill does not require demo images for workflow-only PRs
- Single final push guidance applies equally with or without embedded screenshots

## Artifacts checklist

- [ ] `workflow/issues/issue-92/demo/scenario-1-skill-excerpts.md`
- [ ] `workflow/issues/issue-92/demo/scenario-1-verify-workflow-paths.log`
- [ ] `workflow/issues/issue-92/demo/scenario-2-dry-run-notes.md`
- [ ] `workflow/issues/issue-92/demo/demo-notes.md` — narrative summary, pass/fail table, script-guard decision
- [ ] No secrets in logs or notes
