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

Push before drafting the PR description.

**Required:** Commit `create-pr-in-progress` before writing `PR.md` or other substantive work (same rule as execute `execute-in-progress`).

## Read first

1. `workflow/cursor-workflow/templates/PR.md` — section structure and placeholders
2. `workflow/issues/issue-{NNN}/SPEC.md` — problem, scope, acceptance criteria
3. `workflow/issues/issue-{NNN}/PLAN.md` — approach, files touched, test plan
4. `workflow/issues/issue-{NNN}/demo/demo-notes.md` — scenario results, screenshots
5. `workflow/issues/issue-{NNN}/workflow.state.json` — issue number, branch, PR number
6. Commit log on the issue branch: `git log main..HEAD --oneline` and `git log main..HEAD --format=%s%n%b` for detail

## Draft PR.md

Fill every section in the template with **concrete** content from the sources above. Do not leave bracket placeholders.

| Section | Sources |
|---------|---------|
| Related Issue | `Closes #{NNN}` on its own line (auto-closes issue on merge) + link to `https://github.com/{owner}/{repo}/issues/{NNN}` |
| Description — what / why | SPEC summary + PLAN architectural choices |
| Changes Proposed | Commit subjects + PLAN file list; bullet per meaningful change |
| Scenario Results | Embed demo screenshots/recordings using **absolute** `raw.githubusercontent.com` URLs (see below); copy pass/fail table from `demo-notes.md` |
| How to Test | PLAN test steps + demo-spec manual steps; include real branch name and routes |
| Known Issues / Notes | `demo-notes.md` findings, migration commands, TODOs worth flagging |
| Gate evidence | From execute/demo gate runs: `Phase N gate exit 0 at <short-sha>` or `Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>` for workflow-only issues |
| Checklist | Leave boxes unchecked (`- [ ]`) for the human reviewer |

### Demo image URLs (required for Scenario Results)

`PR.md` is synced to the GitHub **PR description** via `gh pr edit --body-file`. Relative paths such as `demo/scenario-1.png` resolve against the PR page URL (`/pull/demo/...`) and **break**.

Use absolute `raw.githubusercontent.com` URLs. Prefer the **current commit SHA** so images survive post-merge archive (workflow folders move off `main`):

```text
https://raw.githubusercontent.com/{owner}/{repo}/{commit-sha}/workflow/issues/issue-{NNN}/demo/{filename}
```

Fall back to the issue **branch** name if SHA is unavailable:

```text
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/workflow/issues/issue-{NNN}/demo/{filename}
```

Get SHA: `git rev-parse HEAD`. Derive `{owner}/{repo}` from `git remote get-url origin`; `{NNN}` from `issue`. Do **not** use `main` in demo URLs. Do **not** use short relative paths like `demo/foo.png`.

Quality bar:

- Accurate to the **current** branch — re-read diff if unsure
- No secrets in the description
- UI changes must include embedded demo images in Scenario Results (absolute raw URLs)
- How to Test must be copy-pasteable for a reviewer on this repo (`docker compose up`, gate scripts, etc. as appropriate)

## Git and state

1. Write `workflow/issues/issue-{NNN}/PR.md`
2. Commit PR.md + updated `workflow.state.json`
3. Set `stage: create-pr-ready`; increment `loops.total_runs`
4. Push to issue branch
5. GitHub Actions syncs labels and **updates the draft PR description** from `PR.md`

Handoff Action triggers babysit-pr. No bot `@cursoragent` comment.

## Do not

- Create or open a new PR (`gh pr create` fails for cloud agents; draft PR already exists)
- Mark the PR ready for review (babysit does that)
- Change production code in this stage
