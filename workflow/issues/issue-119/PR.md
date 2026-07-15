## Related Issue

Closes #119

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/119)

## Description

**What does this PR do?**

Aligns the **demo** skill with the **create-pr** skill's **batched final push** discipline so demo agents emit exactly one handoff-triggering push at `demo-ready` (artifacts + `demo-notes.md` + `workflow.state.json`), with commit SHA references embedded via `git commit --amend` before push — never in a follow-up SHA-only commit.

Also requires `active_skill: null` (and optionally `active_agent_id: null`) on `demo-ready` finalize, matching execute (#109) and planning. Optionally applies the same finalize contract to create-pr (`create-pr-ready`) and babysit (`complete`).

**Why is this the best approach?**

On issue #115, a demo agent pushed `demo-ready`, then immediately pushed a second commit that only updated the commit SHA in `demo-notes.md`. The handoff Action's concurrency group (`cancel-in-progress: true`) cancelled the in-flight `demo-ready` handoff run; recovery then failed (ARG_MAX), causing a ~2h stall. The create-pr skill already documents the correct batched-push pattern (#92); this PR extends that contract to demo and cross-links it in WORKFLOW.md and automation prompts so agents do not race the handoff Action. Docs/skills only — no application code or YAML changes.

## Changes Proposed

* Rewrote `.cursor/skills/demo/SKILL.md` § "Git and state — batched final push" — one handoff commit, SHA embed via amend, anti-pattern forbidding SHA-fix follow-up, `active_skill: null` on finalize
* Updated `workflow/cursor-workflow/automation-prompts/demo.md` — references batched final push sequence instead of push-alone `demo-ready`
* Added `workflow/cursor-workflow/WORKFLOW.md` § "Demo push batching (issue #119)" — mirrors create-pr batching; cross-links from execute finalize section
* Updated `.cursor/skills/create-pr/SKILL.md` — `active_skill: null` on `create-pr-ready` finalize (optional consistency)
* Updated `.cursor/skills/babysit-pr/SKILL.md` — `active_skill: null` on `complete` finalize (optional consistency)
* Demo artifacts under `workflow/issues/issue-119/demo/` — five scenario screenshots/logs and `demo-notes.md`

**Explicitly unchanged:** `api/`, `frontend/`, database, `.github/workflows/cursor-workflow-handoff.yml`.

## Scenario Results

Workflow-only change — no product UI. Demo validated skill documentation, cross-links, gate script, scope boundary, and optional `active_skill` clearing.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Demo skill batched final push documented | **PASS** | Screenshot below |
| 2 | WORKFLOW.md and automation prompt cross-links | **PASS** | Screenshots below |
| 3 | Workflow path regression passes | **PASS** | [scenario-3-verify-workflow-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-119-demo-single-push-finalize/workflow/issues/issue-119/demo/scenario-3-verify-workflow-paths.log) — exit 0 |
| 4 | No application code changes | **PASS** | [scenario-4-no-app-code.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-119-demo-single-push-finalize/workflow/issues/issue-119/demo/scenario-4-no-app-code.log) — empty diff |
| 5 | create-pr / babysit active_skill clearing (optional) | **PASS** | Screenshot below |

![Scenario 1 — Demo skill batched final push section](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-119-demo-single-push-finalize/workflow/issues/issue-119/demo/scenario-1-demo-skill-batched-push.png)

![Scenario 2 — WORKFLOW.md Demo push batching subsection](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-119-demo-single-push-finalize/workflow/issues/issue-119/demo/scenario-2-workflow-demo-batching.png)

![Scenario 2 — automation-prompts/demo.md batched push reference](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-119-demo-single-push-finalize/workflow/issues/issue-119/demo/scenario-2-automation-prompt.png)

![Scenario 5 — create-pr and babysit active_skill null on finalize](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-119-demo-single-push-finalize/workflow/issues/issue-119/demo/scenario-5-optional-active-skill.png)

## How to Test

1. Checkout this branch: `git checkout cursor/issue-119-demo-single-push-finalize`
2. Confirm demo skill batched final push section:
   ```bash
   grep -A2 'batched final push' .cursor/skills/demo/SKILL.md
   grep 'active_skill: null' .cursor/skills/demo/SKILL.md
   ```
3. Confirm WORKFLOW.md and automation prompt cross-links:
   ```bash
   grep -n 'Demo push batching' workflow/cursor-workflow/WORKFLOW.md
   grep 'batched final push' workflow/cursor-workflow/automation-prompts/demo.md
   ```
4. Run workflow path regression:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
5. Confirm no application code changes:
   ```bash
   git fetch origin main
   git diff origin/main -- api frontend
   ```
   Expect empty output.
6. Optional: verify create-pr and babysit finalize contracts:
   ```bash
   grep 'active_skill: null' .cursor/skills/create-pr/SKILL.md .cursor/skills/babysit-pr/SKILL.md
   ```

**Docker stack not required** — workflow-only scope.

## Known Issues / Notes for Reviewer

* Companion hardening for ARG_MAX fetch ([#117](https://github.com/BlackLodgeLabs/cuebox/issues/117)) and stalled-notify on recovery failure ([#118](https://github.com/BlackLodgeLabs/cuebox/issues/118)) are out of scope; this PR documents why recovery must not be relied on for SHA-fix races ([#115](https://github.com/BlackLodgeLabs/cuebox/issues/115)).
* Handoff concurrency YAML unchanged — `cancel-in-progress: true` behaviour is documented, not modified.
* Dogfood: this issue's demo run followed the new batched final push contract (one commit + one push at `demo-ready`).

## Gate evidence

- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at 060e051` (execute)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at e6f6756` (demo)
- [x] `git diff origin/main -- api frontend` empty (demo)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at 506667f` (babysit)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Handoff YAML spawn logic unchanged
