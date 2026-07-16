---
name: planning
description: Create a detailed implementation plan with required tests, outcomes, and a demo spec from an approved feature spec. For bugs in the existing app, reproduce the issue and capture evidence before planning. Use when workflow stage is spec-ready or when asked to plan issue NNN on a cursor/issue-* branch. Commits only; does not open a PR.
---

# Planning

Produce an implementation plan and demo spec on the existing feature branch.

## When to use

- Handoff from `review-and-spec` (`stage: spec-ready`)
- Prompt: "use planning skill for issue {NNN}"
- Resume after clarifications: `@cursoragent continue plan` when `stage: plan-needs-info`

## Read first

1. `workflow/issues/issue-{NNN}/SPEC.md`
2. `workflow/issues/issue-{NNN}/workflow.state.json`
3. [workflow/cursor-workflow/SKILL-TIERING.md](../../../workflow/cursor-workflow/SKILL-TIERING.md) — tier classification, excerpt map, PR seed contract
4. `source scripts/cursor-workflow-config.sh` — config vars for gates and health URLs
5. [workflow/cursor-workflow/WORKFLOW.md](../../../workflow/cursor-workflow/WORKFLOW.md) — **only** sections listed in SKILL-TIERING excerpt map (not the full file)
6. Relevant code areas (grep/read before planning)

## Preconditions

- Branch `cursor/issue-{NNN}-*` exists and is checked out
- Spec has no open questions in **Open questions** section
- `workflow.state.json` shows `stage: spec-ready` (or you are explicitly resuming planning from `plan-needs-info`)

## Start — update state (first commit)

Before planning work, run the merge helper and commit an early state update:

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

```json
{
  "stage": "plan-in-progress",
  "active_skill": "planning",
  "updated_at": "<ISO8601>"
}
```

Push (triggers status sync on the issue).

## GitHub MCP

See [workflow/cursor-workflow/MCP-GITHUB.md](../../../workflow/cursor-workflow/MCP-GITHUB.md).

1. `GetMcpTools` → `github` with `serverStatus: ready`?
2. If yes: use MCP for mapped operations (check idempotency markers first)
3. Always: merge-state + push `workflow.state.json`
4. If MCP fails: log in commit message; rely on Actions sync on push

## Genuine question vs step failure

| Situation | Action |
|-----------|--------|
| **Genuine question** — bug repro blocked by missing info, ambiguous spec | MCP issue comment with @mentions + agent link + `<!-- cursor-mcp-plan-questions:v1 -->`; set `cursor:plan-needs-info` |
| **Step failure** — code bug found during repro | Document in `bug-repro-notes.md`; do not ask human to fix — note for execute |

**Genuine question comment template** (@mentions from `issue_read` author + repo owner metadata; marker last):

```markdown
@{author} @{owner} — I need clarification before proceeding on issue #NNN.

1. …
2. …

Reply on this issue, then comment `@cursoragent continue plan`.

If you need to chat more, talk to me [here](https://cursor.com/agents/<agent-id>).

<!-- cursor-mcp-plan-questions:v1 -->
```

## Classify tier and issue type

After reading `SPEC.md`, classify **tier** per [SKILL-TIERING.md](../../../workflow/cursor-workflow/SKILL-TIERING.md):

| Tier | When |
|------|------|
| `workflow` | Changes limited to skills, `workflow/`, `scripts/cursor-workflow-*`, docs — no `api/` or `frontend/` product code |
| `application` | Everything else; default when uncertain |

Document tier in `PLAN.md` front matter (`**Tier:** workflow | application`) and `## PR seed`.

Then decide whether this is a **bug in the existing application** (application tier only):

| Treat as bug | Treat as feature / infra / workflow |
|--------------|-------------------------------------|
| Broken or incorrect behavior in shipped UI, API, sync, enrichment, or recommendation flows | New capability, operator tooling, docs-only, or workflow scaffolding |
| Regression — something that used to work | Greenfield feature with no prior behavior to break |
| Spec acceptance criteria describe **fixing** existing behavior | Spec acceptance criteria describe **adding** new behavior |

When uncertain, prefer the bug path and document your reasoning in `bug-repro-notes.md`.

## Bug reproduction (before planning)

**Required** when the issue is a bug in the existing application (`application` tier). **Skip** for `workflow` tier, features, infrastructure, and workflow-only changes — no stack bring-up or `bug-repro-*` artifacts.

Do this **after** the `plan-in-progress` commit and **before** writing `PLAN.md`.

### Environment (application tier only)

1. `source scripts/cursor-workflow-config.sh`
2. Confirm stack: `docker compose ps` — all services Up
3. Health checks:
   - `curl -sf $APP_HEALTH_URL_FRONTEND`
   - `curl -sf $APP_HEALTH_URL_API`
4. If stack is down: `bash scripts/cloud-ensure-docker.sh` and start stack per `AGENTS.md`
5. Run any **Seed steps** from the spec (or `documents/cloud-agent-part2-test-data.md`) needed to reach the reported state

### Reproduce

1. Follow reproduction steps from `SPEC.md` (Problem, User flows, Acceptance criteria). Derive steps from the spec when not explicit.
2. Observe the failure: UI state, API response, logs, console errors, timing, etc.
3. **Do not** change production code during reproduction — evidence only.

### Capture evidence — `workflow/issues/issue-{NNN}/demo/`

| Artifact | Required | Purpose |
|----------|----------|---------|
| `bug-repro-notes.md` | **Yes** | Narrative: date, commit SHA, steps taken, expected vs actual, environment notes |
| `bug-repro-screenshot.png` (or numbered variants) | When UI-visible | Shows the broken state |
| `bug-repro-api-response.json` | When API-visible | Raw response proving the defect |
| `bug-repro-console.log` / `bug-repro-api.log` | When helpful | Relevant log excerpts (no secrets) |

Commit reproduction artifacts **before** writing `PLAN.md`. Push so evidence is on the branch.

### Use findings in the plan

Ground `PLAN.md` in what you observed — not only static code reading:

- **Overview** — cite reproduction outcome (what failed, where, under what conditions)
- **Root cause** (if identified during repro) — tie to observed behavior
- **Implementation steps** — address the reproduced failure mode
- **Tests required** — include a regression test that would have caught the observed bug
- **Demo spec** — Scenario 0 should re-run the reproduction steps and assert the fix (reference `bug-repro-notes.md`)

### If reproduction is blocked or ambiguous

When steps are missing, contradictory, or you cannot reach the reported state:

1. **MCP (preferred):** `issue_read` method `get_comments` — skip if `<!-- cursor-mcp-plan-questions:v1 -->` present. Else `add_issue_comment` with numbered questions + marker. `issue_write` method `update` with `labels: ["cursor:plan-needs-info"]`.
2. Run merge helper, then set:
   - `stage`: `plan-needs-info`
   - `active_skill`: `planning`
3. Commit and push any partial `bug-repro-notes.md` (document what you tried) + updated state. **Do not** write `PLAN.md` yet.
4. **Stop.** User replies on the issue and comments `@cursoragent continue plan`.

### If you cannot confirm the bug

Document in `bug-repro-notes.md` (steps taken, what you saw instead). Then either:

- Ask clarifying questions → `plan-needs-info` (above), or
- Proceed with plan noting **repro inconclusive** and what execute/demo must verify

## Resume (`continue plan`)

1. **MCP (preferred):** `issue_read` method `get_comments` for answers to your numbered questions.
2. If still ambiguous → ask follow-ups and stay on `plan-needs-info`.
3. If clear → complete bug reproduction (if applicable), then write `PLAN.md` and `demo-spec.md`.

## Outputs

### 1. Implementation plan — `workflow/issues/issue-{NNN}/PLAN.md`

Include:

- **Overview** — approach in plain language; for bugs, summarize reproduction findings
- **Reproduction findings** — for bugs only: link to `demo/bug-repro-*` artifacts and observed vs expected behavior
- **Root cause** — for bugs when known; otherwise hypotheses execute should validate
- **Files to change** — table: path, change type, rationale
- **Implementation steps** — ordered, small commits mentally grouped
- **Tests required** — unit, integration, E2E; map each to acceptance criterion; bugs need a regression test for the reproduced failure
- **Gate script** — `workflow` tier: `bash $WORKFLOW_REGRESSION_GATE`; `application` tier: `bash $APP_DEFAULT_GATE` or narrower per `run-gate-scripts` skill (resolve via `source scripts/cursor-workflow-config.sh`)
- **Documentation updates** — list files under `documents/`, `README.md`, etc.
- **Risks and rollback**
- **Definition of done** — checklist execute must satisfy
- **PR seed** — required section (≤15 lines); template in [SKILL-TIERING.md](../../../workflow/cursor-workflow/SKILL-TIERING.md)

### 2. Demo spec — `workflow/issues/issue-{NNN}/demo/demo-spec.md`

Instruct the demo agent what to capture on the VM:

- **Preconditions** — `workflow` tier: script/doc verification only (no health URLs or Docker); `application` tier: stack health via `$APP_HEALTH_URL_*` from config, seed data as needed
- **Scenario 0 (bugs):** repeat reproduction steps from `bug-repro-notes.md`; pass criteria = fixed behavior
- Numbered scenarios with steps, pass criteria, and **exact artifact filenames** under `workflow/issues/issue-{NNN}/demo/`
- Reference [workflow/cursor-workflow/templates/demo-spec.md](../../../workflow/cursor-workflow/templates/demo-spec.md)
- Include **Seed steps** under Preconditions when any scenario depends on non-default DB state

For `application` tier, assume **full Docker stack** on the cloud VM. API keys come from VM secrets / `.env`.

## Workflow state

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

Update `workflow/issues/issue-{NNN}/workflow.state.json`:

```json
{
  "stage": "plan-ready",
  "loops": { "bugbot": 0, "ci_autofix": 0, "total_runs": <increment> },
  "updated_at": "<ISO8601>"
}
```

Preserve `issue`, `branch`, `pr` fields.

## Git and labels

1. Commit plan + demo-spec + bug-repro artifacts (if any) + updated state; push branch.
2. Set `stage: plan-ready`, `active_skill: null` (or omit). Issue labels/comments are synced by GitHub Actions on push.

## Do not

- Write production code (execute does that)
- Open a pull request
- Skip test planning — every acceptance criterion needs a test mapping
- Skip bug reproduction for confirmed app bugs — plans must be grounded in observed behavior
- Write `PLAN.md` while `plan-needs-info` is unresolved
