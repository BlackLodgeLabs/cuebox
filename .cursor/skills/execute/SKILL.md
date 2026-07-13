---
name: execute
description: Implement the plan for a GitHub issue, run all required tests and gate scripts before pushing, and push commits to the existing draft PR branch. Use when workflow stage is plan-ready or when asked to execute issue NNN.
paths:
  - "api/**"
  - "frontend/**"
  - "documents/**"
  - "scripts/**"
  - "workflow/**"
---

# Execute

Implement `workflow/issues/issue-{NNN}/PLAN.md`, verify with tests, update docs, push to the **existing draft PR** branch.

## Draft PR

**Cloud agents cannot create PRs** (integration token). The handoff GitHub Action creates a draft PR at `spec-ready` and records `"pr"` in `workflow.state.json`.

- Check `workflow.state.json` → `"pr"` for the PR number
- If `pr` is null, **do not** use `gh pr create` — push your commits and note in the issue that the human should run **Actions → Cursor workflow handoff → Run workflow** with **ensure draft PR** enabled
- Push commits to the branch; the open draft PR updates automatically

## When to use

- Handoff when `stage: plan-ready`
- Prompt: "use execute skill for issue {NNN}"

## Start — update state

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

Push before substantive work.

**Required:** The `execute-in-progress` commit must land before any implementation files, tests, or docs beyond workflow state.

```json
{ "stage": "execute-in-progress", "active_skill": "execute", "updated_at": "<ISO8601>" }
```

## Pass-back resume

When resuming after demo pass-back (`stage` was `execute-passback`):

1. Read `workflow/issues/issue-{NNN}/demo/demo-notes.md` § **Pass-back to execute**
2. Fix the code defect; run tests and gates
3. Run merge helper, then set `execute-ready` and **clear** `passback_to` / `passback_reason` to `null`

## Read first

1. `workflow/issues/issue-{NNN}/PLAN.md`
2. `workflow/issues/issue-{NNN}/SPEC.md`
3. `workflow/issues/issue-{NNN}/workflow.state.json`
4. Use **`run-gate-scripts`** skill to pick and run the correct gate script

## Implementation rules

- Follow the plan; if the plan is wrong, update the plan file with a **Plan revision** section before deviating materially
- Smallest correct diff; match repo conventions
- All acceptance criteria must be addressable by code + tests

## Tests before push (required)

**No push until all of the following pass:**

1. Tests listed in the implementation plan
2. Appropriate phase gate from `run-gate-scripts` (default: `bash scripts/verify-phase8-gates.sh` for full regression; use narrower gate if plan specifies)
3. Frontend: `cd frontend && npx tsc --noEmit` and `npm run test:unit` when frontend touched
4. API: `cd api && ruff check app tests` when API touched

## Genuine question vs step failure

| Situation | Action |
|-----------|--------|
| **Genuine question** | N/A — never ask humans product questions during execute |
| **Step failure** — defect found during demo pass-back | Fix via pass-back from demo (`execute-passback`); do not post human fix requests on the issue |

### Cloud / compose gotchas

- Export reachable DB URL before host pytest/gates if compose is up:  
  `export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox`
- Before host `npm run build`: `docker compose stop frontend && sudo rm -rf frontend/.next` if EACCES

If tests fail: fix, re-run, do not push.

## Documentation

After code is green, check the plan's **Documentation updates** section:

- Update `documents/`, `README.md`, or `AGENTS.md` only when behavior or setup changed
- Commit doc changes on the same branch

## Finalize state

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

```json
{
  "stage": "execute-ready",
  "active_skill": null,
  "active_agent_id": null,
  "passback_to": null,
  "passback_reason": null,
  "pr": <number from workflow.state.json — preserve>,
  "loops": { "bugbot": <preserve>, "ci_autofix": <preserve>, "total_runs": <increment> },
  "updated_at": "<ISO8601>"
}
```

Set `active_skill: null` (and optionally `active_agent_id: null`) on `execute-ready`, mirroring the planning skill's `plan-ready` finalize — clears the skill lock so demo admission proceeds. Defense-in-depth: the admission gate also allows demo at `execute-ready` even if `active_skill` is stale (issue #109).

Preserve `pr` from workflow.state.json (set by GitHub Actions). Do not reset `loops.bugbot` / `loops.ci_autofix`.

Issue labels: synced by GitHub Actions on push. Push state file; handoff Action triggers demo.

## Do not

- Create or open pull requests (`gh pr create` will fail in cloud VMs)
- Mark PR ready for review (babysit does that)
- Record demo artifacts (demo skill does that)
- Push failing code

## GitHub MCP

See [workflow/cursor-workflow/MCP-GITHUB.md](../../../workflow/cursor-workflow/MCP-GITHUB.md).

1. `GetMcpTools` → `github` with `serverStatus: ready`?
2. If yes: use MCP for mapped operations (check idempotency markers first)
3. Always: merge-state + push `workflow.state.json`
4. If MCP fails: log in commit message; rely on Actions sync on push

### When `pr` is null after push

**MCP (preferred):** `issue_read` method `get_comments` — skip if `<!-- cursor-mcp-execute-no-pr:v1 -->` present. Else `add_issue_comment` on the issue with recovery steps:

- Actions → **Cursor workflow handoff** → Run workflow → issue number → enable **ensure draft PR**
- Push did not create a PR — human should resync

Include marker as last line. Keep "do not `gh pr create`" — draft PR stays Actions (phase 2 optional MCP create documented in MCP-GITHUB.md).
