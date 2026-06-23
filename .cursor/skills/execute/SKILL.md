---
name: execute
description: Implement the plan for a GitHub issue, run all required tests and gate scripts before pushing, update documentation, and open a draft PR to main. Use when workflow stage is plan-ready or when asked to execute issue NNN.
paths:
  - "api/**"
  - "frontend/**"
  - "documents/**"
  - "scripts/**"
---

# Execute

Implement `documents/plans/issue-{NNN}.md`, verify with tests, update docs, open **draft PR** to `main`.

## When to use

- Handoff when `stage: plan-ready`
- Prompt: "use execute skill for issue {NNN}"

## Read first

1. `documents/plans/issue-{NNN}.md`
2. `documents/specs/issue-{NNN}.md`
3. `demos/issue-{NNN}/workflow-state.json`
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

### Cloud / compose gotchas

- Export reachable DB URL before host pytest/gates if compose is up:  
  `export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox`
- Before host `npm run build`: `docker compose stop frontend && sudo rm -rf frontend/.next` if EACCES

If tests fail: fix, re-run, do not push.

## Documentation

After code is green, check the plan's **Documentation updates** section:

- Update `documents/`, `README.md`, or `AGENTS.md` only when behavior or setup changed
- Commit doc changes on the same branch

## Open draft PR

**First time only** on this issue branch:

1. Push all commits to `cursor/issue-{NNN}-*`
2. Open a **draft** PR targeting `main`
3. PR title: `Issue #{NNN}: {short title}`
4. PR body: link issue, link spec + plan, checklist from plan's definition of done
5. Record PR number in `workflow-state.json` → `"pr": <number>`

If PR already exists, push new commits to the same branch.

## Finalize state

```json
{
  "stage": "execute-ready",
  "pr": <number>,
  "loops": {
    "bugbot": <preserve>,
    "ci_autofix": <preserve>,
    "total_runs": <increment>
  },
  "updated_at": "<ISO8601>"
}
```

Preserve existing `loops.bugbot` and `loops.ci_autofix` from the current state file — do not reset them.

Issue labels: add `cursor:execute-ready`; remove `cursor:plan-ready`. Push state file; handoff Action triggers demo.

## Do not

- Mark PR ready for review (babysit does that)
- Record demo artifacts (demo skill does that)
- Push failing code
