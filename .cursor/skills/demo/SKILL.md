---
name: demo
description: Run the demo spec on the cloud VM; for workflow tier run the regression gate only, for application tier capture screenshots on the full Docker stack. Artifacts under workflow/issues/issue-NNN/demo/. Use when workflow stage is execute-ready or when asked to demo issue NNN.
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

1. `workflow/issues/issue-{NNN}/PLAN.md` — tier from front matter / PR seed
2. `workflow/issues/issue-{NNN}/demo/demo-spec.md`
3. [workflow/cursor-workflow/SKILL-TIERING.md](../../../workflow/cursor-workflow/SKILL-TIERING.md)
4. `source scripts/cursor-workflow-config.sh`
5. `workflow/issues/issue-{NNN}/workflow.state.json`
6. PR diff (know what changed)

## Classify tier

Read tier from `PLAN.md` § PR seed / front matter. Re-check per SKILL-TIERING if touched paths include `api/` or `frontend/` → `application`.

## Workflow tier — light path (default when tier is workflow)

1. Do **not** start Docker or browse UI unless PLAN explicitly lists product scenarios
2. Run `bash $WORKFLOW_REGRESSION_GATE`
3. Write minimal `workflow/issues/issue-{NNN}/demo/demo-notes.md`:
   - Date, commit SHA, `tier=workflow`
   - Gate exit line and log excerpt
4. Batched `demo-ready` push (see below)

## Application tier — full stack path

### Environment

1. Confirm stack: `docker compose ps` — all services Up
2. Health checks:
   - `curl -sf $APP_HEALTH_URL_FRONTEND`
   - `curl -sf $APP_HEALTH_URL_API`
3. Use VM secrets / `.env` for API keys when the demo needs live providers
4. If stack is down: `bash scripts/cloud-ensure-docker.sh` and start stack per `AGENTS.md`

## Capture (application tier)

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

## Git and state — batched final push

The handoff-triggering push must be **exactly one** commit containing demo artifacts + `demo-notes.md` + `workflow.state.json` with `stage: demo-ready`. Use this sequence when all scenarios pass:

1. Capture artifacts and draft `demo-notes.md` locally (SHA placeholder OK initially).
2. Run merge helper; set locally in `workflow.state.json`:
   - `stage: demo-ready`
   - `active_skill: null` (and optionally `active_agent_id: null`)
   - increment `loops.total_runs`
3. `git add` demo artifacts + `demo-notes.md` + `workflow.state.json`
4. `git commit -m "docs(workflow): demo evidence for issue #NNN"`
5. `git rev-parse HEAD` → embed short/full SHA in `demo-notes.md` (and any embedded raw URLs if used)
6. If notes changed: `git add demo-notes.md && git commit --amend --no-edit` (still one commit)
7. **Single** `git push` → one handoff run spawns create-pr
8. **MCP (preferred):** `pull_request_read` method `get_comments` on PR — skip if `<!-- cursor-mcp-demo-summary:v1 -->` present. Else `add_issue_comment` (PR number as `issue_number`) with scenario pass/fail table, artifact paths, marker as last line. MCP PR summary happens **after** the single push (not part of the handoff trigger).

Expected push pattern: 1–2 pushes total (optional early `demo-in-progress`; one `demo-ready` push).

Finalize state JSON:

```json
{
  "stage": "demo-ready",
  "active_skill": null,
  "active_agent_id": null,
  "loops": { "bugbot": <preserve>, "ci_autofix": <preserve>, "total_runs": <increment> },
  "updated_at": "<ISO8601>"
}
```

Issue labels synced by GitHub Actions on push. Handoff Action triggers create-pr. No bot `@cursoragent` comment.

**Reference implementation:** `.cursor/skills/create-pr/SKILL.md` § "Git and state — batched final push".

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
- Push `demo-ready`, then push again only to fix SHA in `demo-notes.md` (use `git commit --amend` before the single push instead)
- Leave `active_skill: "demo"` on `demo-ready` finalize
