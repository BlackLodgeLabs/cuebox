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
| Related Issue | Link to `https://github.com/{owner}/{repo}/issues/{NNN}` |
| Description — what / why | SPEC summary + PLAN architectural choices |
| Changes Proposed | Commit subjects + PLAN file list; bullet per meaningful change |
| Scenario Results | Embed demo screenshots/recordings using **absolute** `raw.githubusercontent.com` URLs (see below); copy pass/fail table from `demo-notes.md` |
| How to Test | PLAN test steps + demo-spec manual steps; include real branch name and routes |
| Known Issues / Notes | `demo-notes.md` findings, migration commands, TODOs worth flagging |
| Checklist | Leave boxes unchecked (`- [ ]`) for the human reviewer |

### Demo image URLs (required for Scenario Results)

`PR.md` is synced to the GitHub **PR description** via `gh pr edit --body-file`. Relative paths such as `demo/scenario-1.png` resolve against the PR page URL (`/pull/demo/...`) and **break**.

Use absolute raw URLs with the issue branch and full repo path from `workflow.state.json`:

```text
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/workflow/issues/issue-{NNN}/demo/{filename}
```

Example (issue 62, branch `cursor/issue-62-harden-cursor-workflow-state-pass-back`):

```markdown
![Scenario 1 gates pass](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-62-harden-cursor-workflow-state-pass-back/workflow/issues/issue-62/demo/scenario-1-gates-pass.png)
```

Derive `{owner}/{repo}` from `git remote get-url origin`; `{branch}` from `workflow.state.json` → `branch`; `{NNN}` from `issue`. Do **not** use short relative paths like `demo/foo.png` or `workflow/issues/issue-NNN/demo/foo.png` without the `https://raw.githubusercontent.com/...` prefix.

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
