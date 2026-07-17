---
name: babysit-pr
description: Monitor a draft PR through Bugbot, CI, and review feedback; fix issues within loop limits; mark PR ready for review when clean. Use when workflow stage is create-pr-ready or when asked to babysit issue NNN PR.
paths:
  - "api/**"
  - "frontend/**"
  - ".github/**"
  - "workflow/**"
---

# Babysit PR

Keep the issue PR merge-ready: respond to Bugbot, CI failures, and review threads within strict loop limits, then mark **ready for review**.

## When to use

- Handoff when `stage: create-pr-ready`
- Prompt: "use babysit-pr skill for issue {NNN}"

## Start — update state

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

Push before monitoring or fixes.

**Required:** Commit `babysit-in-progress` before substantive babysit work (CI fixes, Bugbot responses, gate re-runs).

```json
{ "stage": "babysit-in-progress", "active_skill": "babysit-pr", "updated_at": "<ISO8601>" }
```

## GitHub MCP

See [workflow/cursor-workflow/MCP-GITHUB.md](../../../workflow/cursor-workflow/MCP-GITHUB.md).

1. `GetMcpTools` → `github` with `serverStatus: ready`?
2. If yes: use MCP for mapped operations (check idempotency markers first)
3. Always: merge-state + push `workflow.state.json`
4. If MCP fails: log in commit message; rely on Actions sync on push

## Genuine question vs step failure

| Situation | Action |
|-----------|--------|
| **Genuine question** | N/A — do not ask humans to fix code or clarify product during babysit |
| **Step failure** — loop limits, unrecoverable CI/Bugbot | Set `blocked` via MCP comments (`<!-- cursor-mcp-blocked:v1 -->`); Actions owns complete notification at `complete` |

## Read first

1. `workflow/issues/issue-{NNN}/workflow.state.json` — **check limits before acting**
2. `workflow/issues/issue-{NNN}/PLAN.md` — tier from PR seed / front matter; definition of done
3. `source scripts/cursor-workflow-config.sh` — tier-aware loop limits
4. PR (number in state file): **MCP (preferred)** `pull_request_read` methods `get`, `get_check_runs`, `get_reviews`, `get_review_comments` — replaces `gh pr view` / `gh api`
5. `workflow/issues/issue-{NNN}/PR.md` — PR description (synced to GitHub by Actions)
6. `run-gate-scripts` — re-run gates after fixes

## Loop limits (hard stop)

Read tier from `PLAN.md` § PR seed. Resolve limits from config after `source scripts/cursor-workflow-config.sh`:

| Tier | `loops.bugbot` max | `loops.ci_autofix` max |
|------|-------------------|------------------------|
| `workflow` | `$WORKFLOW_LOOP_LIMIT_BUGBOT` (default 1) | `$WORKFLOW_LOOP_LIMIT_CI_AUTOFIX` (default 1) |
| `application` | `$APPLICATION_LOOP_LIMIT_BUGBOT` (default 3) | `$APPLICATION_LOOP_LIMIT_CI_AUTOFIX` (default 2) |

| Counter | Increment when |
|---------|----------------|
| `loops.bugbot` | You push a commit primarily addressing Bugbot findings |
| `loops.ci_autofix` | You push a commit primarily addressing CI failure |
| `loops.total_runs` | Any agent stage run on this issue (already tracked in state) |

**Before each fix cycle:** read counters. If any would exceed max after this cycle → **block** (below).

### Workflow tier early-exit

When tier is `workflow` and **all** true after first CI run:

- Required CI checks green (or only allowed skips)
- No unresolved Bugbot **must-fix** items you own
- No merge conflicts
- Demo artifacts and `PR.md` present on branch
- Gate evidence in `PR.md` or `demo-notes.md`

→ Mark ready immediately (`complete`); do **not** enter further fix cycles.

## React to everything

Monitor and act on:

- **Bugbot** review comments and summaries
- **CI / GitHub Actions** failures (not skipped checks failing on base)
- **Human review** comments and unresolved threads (if any early feedback)
- **Merge conflicts** with `main`

Prioritize: CI blocking → Bugbot high severity → other comments.

## Fix cycle

1. Identify root cause from logs / comments
2. Fix on issue branch; run tests + gate script **before push** (same bar as `execute`)
3. Push; update relevant counter in `workflow.state.json`
4. Re-check PR checks; repeat until clean or limit hit

## Blocked

If limits exceeded or unrecoverable failure:

1. Update `workflow/issues/issue-{NNN}/workflow.state.json`: `stage`: `blocked`, increment `loops.total_runs`, set `updated_at` to current ISO8601
2. **Commit and push** the state file to the issue branch (required so remote automation sees the terminal state and stops handoffs)
3. **MCP (preferred):** `add_issue_comment` on issue + PR with counters and last errors + `<!-- cursor-mcp-blocked:v1 -->` (check markers first). `issue_write` for `cursor:blocked` label or rely on Actions sync.
4. **Stop** — no further automated handoffs

## Success — ready for review

When **all** true:

- Required CI checks green (or only allowed skips)
- No unresolved Bugbot **must-fix** items you own
- No merge conflicts
- Demo artifacts present on branch (`workflow/issues/issue-{NNN}/demo/`)
- `workflow/issues/issue-{NNN}/PR.md` committed (PR body synced by Actions)
- Gate evidence recorded in `PR.md` or `demo/demo-notes.md`, e.g. `Workflow regression: $WORKFLOW_REGRESSION_GATE exit 0 at <short-sha>` (workflow tier) or application gate line from demo-notes (feature issues)

Then:

1. Run merge helper, then set `stage`: `complete`, `active_skill: null` (and optionally `active_agent_id: null`)
2. **Convert draft PR → ready for review** via MCP `update_pull_request` with `draft: false` (or existing path if MCP unavailable)
3. **Single batched push** — commit all fixes + final `workflow.state.json` (`complete`) together, then one `git push` (mirror demo/create-pr #119; avoids duplicate handoff runs)

When `orchestration.late_stage_resume` is enabled, handoff may resume the create-pr agent via `POST /runs` instead of spawning a new babysit agent.

Do **not** MCP-post an issue comment at `complete` — the handoff Action runs `cursor-workflow-notify-complete.sh` (see MCP-GITHUB.md).

## Do not

- Merge the PR
- MCP-post issue comments at `complete` (GitHub Actions notifies the issue author)
- Exceed loop limits silently
- Disable tests or skip gates to greenwash CI
- Mark ready while demo artifacts, PR.md, or critical checks are missing
