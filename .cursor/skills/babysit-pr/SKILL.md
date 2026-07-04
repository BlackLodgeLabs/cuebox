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

## Read first

1. `workflow/issues/issue-{NNN}/workflow.state.json` — **check limits before acting**
2. PR (number in state file): checks, Bugbot comments, review threads
3. `workflow/issues/issue-{NNN}/PR.md` — PR description (synced to GitHub by Actions)
4. `workflow/issues/issue-{NNN}/PLAN.md` — definition of done
4. `run-gate-scripts` — re-run gates after fixes

## Loop limits (hard stop)

| Counter | Max | Increment when |
|---------|-----|----------------|
| `loops.bugbot` | 3 | You push a commit primarily addressing Bugbot findings |
| `loops.ci_autofix` | 2 | You push a commit primarily addressing CI failure |
| `loops.total_runs` | 10 | Any agent stage run on this issue (already tracked in state) |

**Before each fix cycle:** read counters. If any would exceed max after this cycle → **block** (below).

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
3. Labels: `cursor:blocked` on issue; comment on issue + PR with counters and last errors
4. **Stop** — no further automated handoffs

## Success — ready for review

When **all** true:

- Required CI checks green (or only allowed skips)
- No unresolved Bugbot **must-fix** items you own
- No merge conflicts
- Demo artifacts present on branch (`workflow/issues/issue-{NNN}/demo/`)
- `workflow/issues/issue-{NNN}/PR.md` committed (PR body synced by Actions)
- **Gate evidence** recorded in `PR.md` or `demo/demo-notes.md`, e.g. `Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>` (workflow-only issues) or `Phase 8 gate exit 0 at <short-sha>` (feature issues)

Then:

1. Run merge helper, then set `stage`: `complete`
2. **Convert draft PR → ready for review** (not merged)
3. Commit and push `workflow.state.json` — GitHub Actions applies `cursor:complete`, @mentions the issue author, and assigns the PR (cloud agents cannot post issue comments)

Do **not** post an issue comment — the handoff Action handles that notification.

## Do not

- Merge the PR
- Post issue comments (GitHub Actions notifies the issue author at `complete`)
- Exceed loop limits silently
- Disable tests or skip gates to greenwash CI
- Mark ready while demo artifacts, PR.md, or critical checks are missing
