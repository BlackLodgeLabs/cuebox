# Demo notes — issue #119

**Date:** 2026-07-15  
**Commit:** `f7558315e20cfe153de2d5fe713a8ffa31072963`  
**Branch:** `cursor/issue-119-demo-single-push-finalize`  
**Stack:** Docker Compose up (postgres, api, frontend, backup); health checks OK at `localhost:3000` and `localhost:8000`.

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Demo skill batched final push documented | **PASS** | [scenario-1-demo-skill-batched-push.png](./scenario-1-demo-skill-batched-push.png) |
| 2 | WORKFLOW.md and automation prompt cross-links | **PASS** | [scenario-2-workflow-demo-batching.png](./scenario-2-workflow-demo-batching.png), [scenario-2-automation-prompt.png](./scenario-2-automation-prompt.png) |
| 3 | Workflow path regression passes | **PASS** | [scenario-3-verify-workflow-paths.log](./scenario-3-verify-workflow-paths.log) — exit 0, `PASS: no legacy workflow paths found` |
| 4 | No application code changes | **PASS** | [scenario-4-no-app-code.log](./scenario-4-no-app-code.log) — empty diff for `api/` and `frontend/` vs `main` (after `git fetch origin main:main`) |
| 5 | create-pr / babysit active_skill clearing (optional) | **PASS** | [scenario-5-optional-active-skill.png](./scenario-5-optional-active-skill.png) — `active_skill: null` on create-pr-ready and complete finalize |

## Verification notes

- **Scenario 1:** `.cursor/skills/demo/SKILL.md` § "Git and state — batched final push" documents one handoff commit (artifacts + `demo-notes.md` + `workflow.state.json`), SHA embed via `git rev-parse HEAD` + amend, no SHA-fix follow-up push, 1–2 push pattern, and `active_skill: null` on finalize.
- **Scenario 2:** `WORKFLOW.md` "Demo push batching (issue #119)" mirrors create-pr batching (cancel-in-progress, amend-in-place SHA, recovery not relied upon #115). `automation-prompts/demo.md` references batched final push, not push-alone `demo-ready`.
- **Scenario 3:** `bash scripts/verify-workflow-paths.sh` exit 0 at `f7558315e20cfe153de2d5fe713a8ffa31072963`.
- **Scenario 4:** `git diff main -- api frontend` empty after syncing local `main` to `origin/main` (PR base `88480c8`).
- **Scenario 5:** Optional execute edits present in `create-pr` and `babysit-pr` skills; both clear `active_skill` on finalize.

## Dogfood

This demo run follows the batched final push contract from issue #119: one commit + one push at `demo-ready` (SHA embedded via amend before push).
