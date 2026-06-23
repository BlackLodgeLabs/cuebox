---
name: demo
description: Run the demo spec on the cloud VM with full Docker stack, capture screenshots and recordings under demos/issue-NNN/, and push evidence to the PR branch. Use when workflow stage is execute-ready or when asked to demo issue NNN.
paths:
  - "demos/**"
---

# Demo

Execute `demos/issue-{NNN}/demo-spec.md` on the running stack and commit evidence.

## When to use

- Handoff when `stage: execute-ready`
- Prompt: "use demo skill for issue {NNN}"

## Read first

1. `demos/issue-{NNN}/demo-spec.md`
2. `documents/specs/issue-{NNN}.md` (context)
3. `demos/issue-{NNN}/workflow-state.json`
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

- Screenshots → paths named in the spec (under `demos/issue-{NNN}/`)
- Short screen recordings where specified (use Cursor screen recording or browser tools)
- Write `demos/issue-{NNN}/demo-notes.md`:
  - Date, commit SHA
  - Scenario-by-scenario pass/fail
  - Links to any oversized artifacts posted on the PR instead of committed

## Quality bar

- No secrets in images or notes
- Artifacts must reflect the **current** branch behavior
- If a scenario cannot pass, document why in `demo-notes.md` and set `stage` to `blocked` with explanation — do not fake passes

## Git and state

1. Commit artifacts + `demo-notes.md` + updated state
2. Set `stage: demo-ready`; increment `loops.total_runs`
3. Push to issue branch
4. PR comment: summary + thumbnail/list of artifacts (paths in repo)
5. Issue labels: `cursor:demo-ready`; remove `cursor:execute-ready`

Handoff Action triggers babysit. No bot `@cursoragent` comment.

## Do not

- Change production code (file bugs on PR if demo reveals issues — babysit may fix)
- Mark PR ready for review
