## Related Issue

Closes #92

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/92)

## Description

**What does this PR do?**

Issue [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) dogfood showed create-pr agents pushing two commits within seconds (`PR.md` + `create-pr-ready`, then a follow-up SHA URL fix). Each push to a `cursor/issue-*` branch with a handoff `stage` can trigger `.github/workflows/cursor-workflow-handoff.yml`, widening the TOCTOU window for overlapping babysit spawns despite [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) hardening.

This PR updates the **create-pr skill**, **WORKFLOW.md**, and the **create-pr automation prompt** so agents batch the handoff-triggering work into **one final push**: complete `PR.md` + `workflow.state.json` at `stage: create-pr-ready`, with demo image SHA URLs resolved via `git rev-parse HEAD` and `git commit --amend` before push — no follow-up SHA-fix commit.

**Why is this the best approach?**

Reducing push frequency at the agent layer is the lowest-risk fix: it complements existing spawn dedup and admission-gate hardening without adding CI debounce or script complexity. The optional admission-gate idempotency guard (PLAN Step 4) was **deferred** after demo showed skill-only guidance is sufficient for workflow-only issues.

## Changes Proposed

* Updated `.cursor/skills/create-pr/SKILL.md` with a numbered **batched final push** sequence: draft `PR.md` locally → commit → `git rev-parse HEAD` → amend SHA URLs in place → single push; explicit "Do not" list forbidding follow-up SHA-fix pushes.
* Added **Create-pr push batching (issue #92)** subsection to `workflow/cursor-workflow/WORKFLOW.md` with expected 1–2 push pattern, cross-refs to [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79) / [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84), and table footnote that `create-pr-ready` expects one batched push per agent run.
* Aligned `workflow/cursor-workflow/automation-prompts/create-pr.md` with the skill: optional early `create-pr-in-progress` (no `PR.md`); batched final push with amend-if-needed.
* Added issue workflow artifacts: `SPEC.md`, `PLAN.md`, demo spec/notes, and verification logs under `workflow/issues/issue-92/demo/`.
* **Deferred (per PLAN):** optional `cursor-workflow-admission-gate.sh` idempotency guard for rapid duplicate `create-pr-ready` pushes — not needed after dry-run verification.

## Scenario Results

Workflow-only change — no product UI screenshots. Demo verification used text artifacts and gate logs.

| Scenario | Description | Result |
|----------|-------------|--------|
| 1 | Skill + WORKFLOW.md + automation-prompt alignment; `verify-workflow-paths.sh` | **PASS** |
| 2 | Simulated single `create-pr-ready` commit (dry run with amend-before-push) | **PASS** |
| 3 | Workflow-only issues without demo images still use single final push | **PASS** |

**Scenario 1 — skill excerpts** (batched push and SHA amend guidance present in all three doc sources):

See [`scenario-1-skill-excerpts.md`](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-92-batch-create-pr-single-commit/workflow/issues/issue-92/demo/scenario-1-skill-excerpts.md) on this branch.

**Scenario 2 — dry run:** Ephemeral repo produced exactly **one** commit containing `PR.md` + `workflow.state.json` at `create-pr-ready`; SHA embedded then amended in place with no second push. Details in [`scenario-2-dry-run-notes.md`](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-92-batch-create-pr-single-commit/workflow/issues/issue-92/demo/scenario-2-dry-run-notes.md).

**Script guard:** Deferred — skill-only guidance sufficient; no admission-gate changes.

## How to Test

1. Checkout this branch: `git checkout cursor/issue-92-batch-create-pr-single-commit`
2. Confirm create-pr skill documents batched final push:

   ```bash
   grep -A8 "batched final push" .cursor/skills/create-pr/SKILL.md
   ```

3. Confirm WORKFLOW.md batching subsection:

   ```bash
   grep -A12 "Create-pr push batching" workflow/cursor-workflow/WORKFLOW.md
   ```

4. Confirm automation prompt alignment:

   ```bash
   grep "Batched final push" workflow/cursor-workflow/automation-prompts/create-pr.md
   ```

5. Run workflow regression gate (no Docker or Postgres required):

   ```bash
   bash scripts/verify-workflow-paths.sh
   ```

   Expected: exit 0; all `PASS` lines including `no legacy workflow paths found`.

6. Optional — simulate the batched commit pattern locally (see `workflow/issues/issue-92/demo/scenario-2-dry-run-notes.md` for full commands): one `git commit` with `PR.md` + state, amend SHA in place, verify `git log -1 --name-only` shows both files and only one commit.

## Known Issues / Notes for Reviewer

* **Documentation-only** — no application code, database, or frontend changes.
* **Optional script guard deferred** — if dogfood on future issues still shows duplicate babysit spawns from a single agent double-push, PLAN Step 4 admission-gate idempotency can be added in a follow-up.
* **Handoff scripts on `main`** — any future script-level guard takes effect only after merge to `main` (standard deployment note).
* This PR dogfoods its own guidance: `PR.md` and `create-pr-ready` land in a single handoff-triggering push with no follow-up SHA-fix commit.

## Gate evidence

- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `aabc0e3` (demo Scenario 1)
