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

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

```json
{ "stage": "demo-in-progress", "active_skill": "demo", "updated_at": "<ISO8601>" }
```

Push before running scenarios.

## GitHub MCP

See [workflow/cursor-workflow/MCP-GITHUB.md](../../../workflow/cursor-workflow/MCP-GITHUB.md).

1. `GetMcpTools` → `github` with `serverStatus: ready`?
2. If yes: use MCP for mapped operations (check idempotency markers first)
3. Always: merge-state + push `workflow.state.json`
4. If MCP fails: log in `demo-notes.md`; rely on Actions sync on push

## Genuine question vs step failure

| Situation | Action |
|-----------|--------|
| **Genuine question** | N/A — product ambiguity should be caught in spec/plan |
| **Step failure** — code defect, failing scenario | Pass-back only: `execute-passback` + `demo-notes.md` § Pass-back to execute. **Do not** post human questions on the issue |

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
4. **MCP (preferred):** `pull_request_read` method `get_comments` on PR — skip if `<!-- cursor-mcp-demo-summary:v1 -->` present. Else `add_issue_comment` (PR number as `issue_number`) with scenario pass/fail table, artifact paths, marker as last line.
5. Issue labels synced by GitHub Actions on push.

Handoff Action triggers create-pr. No bot `@cursoragent` comment.

### If any scenario cannot pass

1. Commit artifacts + `demo-notes.md` + updated state (document failures in notes)
2. Set `stage: blocked`; increment `loops.total_runs`
3. Push to issue branch
4. **MCP (preferred):** `add_issue_comment` on PR with scenario summary + `<!-- cursor-mcp-demo-summary:v1 -->`; `add_issue_comment` on issue with failure summary + `<!-- cursor-mcp-blocked:v1 -->` (check markers first)
5. Issue labels: `cursor:blocked`; remove `cursor:execute-ready` (MCP `issue_write` or Actions sync)

Do **not** set `demo-ready` or hand off to create-pr when scenarios fail.

## Pass-back path (code defect)

When a scenario fails due to a **code defect** (not environment/seed):

1. Write `## Pass-back to execute` in `workflow/issues/issue-{NNN}/demo/demo-notes.md` with failure details
2. Run merge helper, then set:
   - `stage`: `execute-passback`
   - `passback_to`: `execute`
   - `passback_reason`: short summary
3. Push — **do not** edit `api/` or `frontend/`
4. Handoff Action calls `POST /v1/agents/{id}/runs` on the stored execute agent

## Do not

- Change production code on pass-back (execute fixes defects)
- Change production code (file bugs on PR if demo reveals issues — babysit may fix)
- Mark PR ready for review
