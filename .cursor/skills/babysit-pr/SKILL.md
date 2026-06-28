---
name: babysit-pr
description: Monitor a draft PR through Bugbot, CI, and review feedback; fix issues within loop limits; mark PR ready for review when clean. Use when workflow stage is demo-ready or when asked to babysit issue NNN PR.
paths:
  - "api/**"
  - "frontend/**"
  - ".github/**"
  - "workflow/**"
---

# Babysit PR

Keep the issue PR merge-ready: respond to Bugbot, CI failures, and review threads within strict loop limits, then mark **ready for review**.

## When to use

- Handoff when `stage: demo-ready`
- Prompt: "use babysit-pr skill for issue {NNN}"

## Start — update state

```json
{ "stage": "babysit-in-progress", "active_skill": "babysit-pr", "updated_at": "<ISO8601>" }
```

## Read first

1. `workflow/issues/issue-{NNN}/workflow.state.json` — **check limits before acting**
2. PR (number in state file): checks, Bugbot comments, review threads
3. `workflow/issues/issue-{NNN}/PLAN.md` — definition of done
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

Then:

1. `stage`: `complete`
2. **Convert draft PR → ready for review** (not merged)
3. Labels: `cursor:complete` applied by GitHub Actions on push.
4. PR comment: summary for human reviewer — link `workflow/issues/issue-{NNN}/demo/demo-notes.md`, list gates run, note loop counts
5. Issue comment: "@{issue-author} PR is ready for your final review" (use issue author; do not @cursoragent)

Human receives GitHub notification for review.

## Do not

- Merge the PR
- Exceed loop limits silently
- Disable tests or skip gates to greenwash CI
- Mark ready while demo artifacts or critical checks are missing
