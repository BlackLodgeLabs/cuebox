---
name: demo
description: Run the demo spec on the cloud VM with full Docker stack, capture screenshots and recordings under workflow/issues/issue-NNN/demo/, and push evidence to the PR branch. Use when workflow stage is execute-ready or when asked to demo issue NNN.
paths:
  - "workflow/**"
---

# Demo

Execute `workflow/issues/issue-{NNN}/demo/demo-spec.md` on the running stack and commit evidence.

## When to use

- Handoff when `stage: execute-ready`
- Prompt: "use demo skill for issue {NNN}"

## Start — update state

```json
{ "stage": "demo-in-progress", "active_skill": "demo", "updated_at": "<ISO8601>" }
```

Push before running scenarios.

## Read first

1. `workflow/issues/issue-{NNN}/demo/demo-spec.md`
2. `workflow/issues/issue-{NNN}/SPEC.md` (context)
3. `workflow/issues/issue-{NNN}/workflow.state.json`
4. PR diff (know what changed)

## Environment

1. Confirm stack: `docker compose ps` — all services Up
2. Health checks:
   - `curl -sf http://localhost:3000/api/v1/health`
   - `curl -sf http://localhost:8000/api/v1/health`
3. Use VM secrets / `.env` for API keys when the demo needs live providers
4. If stack is down: `bash scripts/cloud-ensure-docker.sh` and start stack per `AGENTS.md`

## Capture

Follow **every** scenario in `demo-spec.md`:

- Screenshots → paths named in the spec (under `workflow/issues/issue-{NNN}/demo/`)
- Short screen recordings where specified (use Cursor screen recording or browser tools)
- Write `workflow/issues/issue-{NNN}/demo/demo-notes.md`:
  - Date, commit SHA
  - Scenario-by-scenario pass/fail, including embedded screenshots or recordings
  - Links to any oversized artifacts posted on the PR instead of committed

## Quality bar

- No secrets in images or notes
- Artifacts must reflect the **current** branch behavior
- If a scenario cannot pass, document why in `demo-notes.md` and set `stage` to `blocked` with explanation — do not fake passes

## Git and state

### If all scenarios pass

1. Commit artifacts + `demo-notes.md` + updated state
2. Set `stage: demo-ready`; increment `loops.total_runs`
3. Push to issue branch
4. PR comment: summary + thumbnail/list of artifacts (paths in repo)
5. Issue labels synced by GitHub Actions on push.

Handoff Action triggers babysit. No bot `@cursoragent` comment.

### If any scenario cannot pass

1. Commit artifacts + `demo-notes.md` + updated state (document failures in notes)
2. Set `stage: blocked`; increment `loops.total_runs`
3. Push to issue branch
4. Post summary on issue and PR explaining the failure
5. Issue labels: `cursor:blocked`; remove `cursor:execute-ready`

Do **not** set `demo-ready` or hand off to babysit.

## Do not

- Change production code (file bugs on PR if demo reveals issues — babysit may fix)
- Mark PR ready for review
