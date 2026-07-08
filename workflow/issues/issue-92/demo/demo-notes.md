# Demo notes — issue #92

**Date:** 2026-07-08  
**Branch:** `cursor/issue-92-batch-create-pr-single-commit`  
**Commit (pre-demo artifacts):** `5abcc4a`  
**Demo agent:** documentation-only workflow change (no product UI screenshots)

## Environment

- Full Docker stack verified **Up** before completing demo (user requirement): `postgres`, `api`, `frontend`, `backup` all running; health endpoints at `:8000` and `:3000` returned `"status":"ok"` and `"database":"ok"`.
- Demo scenarios themselves require no application state (per demo-spec preconditions).

## Pass/fail summary

| Scenario | Description | Result |
|----------|-------------|--------|
| 1 | Skill + WORKFLOW.md + automation-prompt alignment; `verify-workflow-paths.sh` | **PASS** |
| 2 | Simulated single `create-pr-ready` commit (dry run) | **PASS** |
| 3 | Workflow-only issues without demo images | **PASS** |

## Scenario 1

Verified `.cursor/skills/create-pr/SKILL.md`, `workflow/cursor-workflow/WORKFLOW.md` (§ Create-pr push batching, issues #79/#84), and `workflow/cursor-workflow/automation-prompts/create-pr.md` all describe:

- Optional early `create-pr-in-progress` push without `PR.md`
- Exactly **one** handoff-triggering push with complete `PR.md` + `stage: create-pr-ready`
- SHA resolution via `git rev-parse HEAD` + `git commit --amend` before single push
- Explicit prohibition of follow-up SHA-fix pushes

`bash scripts/verify-workflow-paths.sh` exited **0** — see `scenario-1-verify-workflow-paths.log`.

Excerpts captured in `scenario-1-skill-excerpts.md`.

## Scenario 2

Dry-run simulation in ephemeral repo: one commit containing both `PR.md` and `workflow.state.json` at `create-pr-ready`; SHA embedded then amended in place (no second push). Details in `scenario-2-dry-run-notes.md`.

**Script guard (PLAN Step 4):** **Deferred** — skill-only guidance sufficient; no admission-gate changes in execute per PLAN defer-by-default.

## Scenario 3

Issue #92 is a **workflow-only** change (skills + WORKFLOW.md + automation prompt). The create-pr skill:

- Does **not** require demo PNG screenshots for workflow-only PRs (Gate evidence uses `verify-workflow-paths.sh`; UI changes require embedded images).
- Applies the same single final push guidance with or without demo artifacts.

This PR's own `PR.md` (create-pr stage) will use text-based Scenario Results and gate evidence — no product UI screenshots — consistent with the updated guidance.

## Artifacts

- `scenario-1-skill-excerpts.md`
- `scenario-1-verify-workflow-paths.log`
- `scenario-2-dry-run-notes.md`
- `demo-notes.md` (this file)

No secrets in logs or notes.
