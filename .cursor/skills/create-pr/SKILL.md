---
name: create-pr
description: Craft the PR description from spec, plan, commits, and demo notes; save workflow/issues/issue-NNN/PR.md. Use when workflow stage is demo-ready or when asked to create-pr for issue NNN.
paths:
  - "workflow/**"
---

# Create PR

Write `workflow/issues/issue-{NNN}/PR.md` using the repo template. GitHub Actions updates the linked draft PR body when this file is pushed.

## When to use

- Handoff when `stage: demo-ready`
- Prompt: "use create-pr skill for issue {NNN}"

## Start — update state

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

```json
{ "stage": "create-pr-in-progress", "active_skill": "create-pr", "updated_at": "<ISO8601>" }
```

Optionally push `create-pr-in-progress` before drafting `PR.md` (progress signal only; **no `PR.md`** in that push). This stage does **not** trigger babysit — only `create-pr-ready` does.

**Required:** Commit `create-pr-in-progress` before writing `PR.md` or other substantive work (same rule as execute `execute-in-progress`).

## Read first

1. `workflow/issues/issue-{NNN}/PLAN.md` — § **PR seed**, § Definition of done (primary narrative)
2. `workflow/issues/issue-{NNN}/demo/demo-notes.md` — scenario results, gate line
3. `workflow/cursor-workflow/templates/PR.md` — section structure and placeholders
4. `workflow/issues/issue-{NNN}/workflow.state.json` — issue number, branch, PR number
5. Commit log on the issue branch: `git log main..HEAD --oneline` and `git log main..HEAD --format=%s%n%b` for detail
6. `source scripts/cursor-workflow-config.sh` — `$GITHUB_REPO_SLUG` for URLs
7. [workflow/cursor-workflow/SKILL-TIERING.md](../../../workflow/cursor-workflow/SKILL-TIERING.md) — excerpt map for stage context (do **not** ingest full `WORKFLOW.md`)

Do **not** require full `SPEC.md` or full `WORKFLOW.md` — PR seed + targeted PLAN excerpts are sufficient.

## Draft PR.md

Fill every section in the template with **concrete** content from the sources above. Do not leave bracket placeholders.

| Section | Sources |
|---------|---------|
| Related Issue | `Closes #{NNN}` on its own line (auto-closes issue on merge) + link to `https://github.com/$GITHUB_REPO_SLUG/issues/{NNN}` |
| Description — what / why | **PR seed** + PLAN architectural choices |
| Changes Proposed | PR seed key changes + commit subjects + PLAN file list |
| Scenario Results | Embed demo screenshots/recordings using **absolute** `raw.githubusercontent.com` URLs (see below); copy pass/fail table from `demo-notes.md`; for `workflow` tier with no screenshots, state "workflow tier — script verification only" and cite demo-notes gate line |
| How to Test | PR seed test steps + PLAN test steps; include real branch name and routes |
| Known Issues / Notes | `demo-notes.md` findings, migration commands, TODOs worth flagging |
| Gate evidence | From execute/demo gate runs via config: `Workflow regression: $WORKFLOW_REGRESSION_GATE exit 0 at <short-sha>` (workflow tier) or application gate line from demo-notes |
| Checklist | Leave boxes unchecked (`- [ ]`) for the human reviewer |

### Demo image URLs (required for Scenario Results)

`PR.md` is synced to the GitHub **PR description** via `gh pr edit --body-file`. Relative paths such as `demo/scenario-1.png` resolve against the PR page URL (`/pull/demo/...`) and **break**.

Use absolute `raw.githubusercontent.com` URLs. Prefer the **current commit SHA** so images survive post-merge archive (workflow folders move off `main`):

```text
https://raw.githubusercontent.com/$GITHUB_REPO_SLUG/{commit-sha}/workflow/issues/issue-{NNN}/demo/{filename}
```

Fall back to the issue **branch** name if SHA is unavailable:

```text
https://raw.githubusercontent.com/$GITHUB_REPO_SLUG/{branch}/workflow/issues/issue-{NNN}/demo/{filename}
```

Resolve SHA **before** the handoff-triggering push: URLs must reference the commit that **contains** `PR.md` (the commit about to be pushed, or amended in place). Get SHA with `git rev-parse HEAD` on that local commit. Derive slug from `$GITHUB_REPO_SLUG` after `source scripts/cursor-workflow-config.sh`; `{NNN}` from `issue`. Branch-name fallback (above) is for edge cases only. Do **not** use `main` in demo URLs. Do **not** use short relative paths like `demo/foo.png`.

Quality bar:

- Accurate to the **current** branch — re-read diff if unsure
- No secrets in the description
- UI changes must include embedded demo images in Scenario Results (absolute raw URLs)
- How to Test must be copy-pasteable for a reviewer on this repo (`docker compose up`, gate scripts, etc. as appropriate)

## Git and state — batched final push

The handoff-triggering push must be **exactly one** commit containing complete `PR.md` + `workflow.state.json` with `stage: create-pr-ready`. Use this sequence:

1. Read sources locally (no `PR.md` push yet).
2. Draft `PR.md` locally (placeholders OK for SHA).
3. Run merge helper; set locally in `workflow.state.json`:
   - `stage: create-pr-ready`
   - `active_skill: null` (and optionally `active_agent_id: null`)
   - increment `loops.total_runs`
4. `git add PR.md` + `workflow.state.json`
5. `git commit -m "docs(workflow): PR description for issue #NNN"`
6. `git rev-parse HEAD` → embed SHA in `raw.githubusercontent.com` URLs in `PR.md`
7. If URLs changed: `git add PR.md && git commit --amend --no-edit` (still one commit)
8. **Single** `git push` → one handoff run

Expected push pattern: 1–2 pushes total (optional early `create-pr-in-progress` without `PR.md`; one `create-pr-ready` push with complete `PR.md`).

Finalize state JSON:

```json
{
  "stage": "create-pr-ready",
  "active_skill": null,
  "active_agent_id": null,
  "loops": { "bugbot": <preserve>, "ci_autofix": <preserve>, "total_runs": <increment> },
  "updated_at": "<ISO8601>"
}
```

GitHub Actions syncs labels and **updates the draft PR description** from `PR.md`. Handoff Action triggers babysit-pr. No bot `@cursoragent` comment.

When `orchestration.late_stage_resume` is enabled in `workflow.config.yaml`, handoff may resume the demo agent via `POST /runs` instead of spawning a new create-pr agent — expect faster context carry-over.

## Do not

- Create or open a new PR (`gh pr create` fails for cloud agents; draft PR already exists)
- Mark the PR ready for review (babysit does that)
- Change production code in this stage
- Push `PR.md` with `create-pr-ready` until demo image URLs are final
- Push then amend SHA in a **second** push (use `git commit --amend` before the single push instead)
- Make a follow-up "fix demo image SHA" push after `create-pr-ready`
