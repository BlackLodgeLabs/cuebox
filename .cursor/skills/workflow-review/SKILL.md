---
name: workflow-review
description: Produce structured workflow post-mortem after babysit or merge; write WORKFLOW-REVIEW.md and update RETROSPECTIVES.md. Use when user comments @cursoragent workflow-review on an issue.
paths:
  - "workflow/**"
---

# Workflow review

Produce a structured post-mortem for a completed (or partially completed) Cursor workflow run. Writes `WORKFLOW-REVIEW.md` and appends one index row to [RETROSPECTIVES.md](../../../workflow/cursor-workflow/RETROSPECTIVES.md).

## When to use

- User commented **`@cursoragent workflow-review`** on an issue → review that issue
- User commented **`@cursoragent workflow review for issue NNN`** → review issue NNN
- User commented **`@cursoragent use workflow-review skill for issue NNN`** → review issue NNN
- After babysit-pr reaches `complete`, or post-merge on a closed issue (archive path)

**Not** spawned by `cursor-workflow-handoff.yml` in v1 — human-triggered only.

## Issue resolution

1. Issue number from the GitHub issue the comment is on (default)
2. Else explicit `for issue NNN` / `issue NNN` in the prompt
3. Else fail with a clarifying question

## Preconditions

- Workflow artifacts exist (`SPEC.md`, `PLAN.md`, `workflow.state.json` at minimum)
- Prefer `stage: complete`; post-merge archive path is acceptable
- **MCP (preferred):** `GetMcpTools` → `github` ready for PR checks, comments, and Action run forensics — see [MCP-GITHUB.md](../../../workflow/cursor-workflow/MCP-GITHUB.md). Fall back to `gh` CLI only when MCP unavailable.

## GitHub MCP

See [workflow/cursor-workflow/MCP-GITHUB.md](../../../workflow/cursor-workflow/MCP-GITHUB.md).

1. `GetMcpTools` → `github` with `serverStatus: ready`?
2. If yes: use MCP read tools for forensics (check idempotency markers when reading comments)
3. Always: commit + push review artifacts
4. If MCP fails: fall back to `gh` CLI or branch artifacts only

## Read first

1. `workflow/issues/issue-{NNN}/workflow.state.json` — stage timeline, agent IDs, loop counters, PR number
2. `workflow/issues/issue-{NNN}/SPEC.md` — intended scope and acceptance criteria
3. `workflow/issues/issue-{NNN}/PLAN.md` — approach, files, test plan
4. `workflow/issues/issue-{NNN}/PR.md` — if present
5. `workflow/issues/issue-{NNN}/demo/demo-notes.md`, `demo/demo-spec.md` — demo pass/fail, evidence gaps
6. [workflow/cursor-workflow/RETROSPECTIVES.md](../../../workflow/cursor-workflow/RETROSPECTIVES.md) — avoid duplicate index rows; check recurring patterns
7. **MCP (preferred):** `pull_request_read` methods `get`, `get_check_runs`, `get_reviews`, `get_review_comments`; `issue_read` for issue comments — replaces `gh pr view` / `gh api`
8. GitHub Actions handoff runs for spawn failures, deferrals, API errors
9. Archived reviews on `workflow/archive` for format reference (#28, #59)

### Post-merge path

When the issue folder no longer exists on `main`:

```bash
git fetch origin workflow/archive
```

Read artifacts from `origin/workflow/archive` at paths like `issue-N/SPEC.md`, `issue-N/WORKFLOW-REVIEW.md`. Write the new review to the issue branch if one exists, or commit directly noting the archive target path.

## Write WORKFLOW-REVIEW.md

1. Copy section structure from [workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md](../../../workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md)
2. Fill every section with **concrete** forensics — no bracket placeholders in output
3. Skip optional sections when empty (pre-workflow history, parallel side-branches, efficiency notes, follow-up issues)
4. Commit to `workflow/issues/issue-{NNN}/WORKFLOW-REVIEW.md` (pre-merge)

| Section | Sources |
|---------|---------|
| Summary | Outcome, duration, headline deviation |
| Expected workflow | WORKFLOW.md eight-stage baseline |
| Timeline | Commits, handoff runs, state transitions, agent IDs |
| Agent index | `workflow.state.json` agents + handoff logs |
| What worked / deviated | Compare SPEC/PLAN vs actual; PR/CI status |
| Recommendations | Actionable hardening for future runs |
| References | Issue, PR, artifact paths |

## RETROSPECTIVES append

Append **one** index row to [RETROSPECTIVES.md](../../../workflow/cursor-workflow/RETROSPECTIVES.md):

| Column | Rule |
|--------|------|
| Issue | Link to GitHub issue |
| PR | Link to PR (or — if none) |
| Date | Review date (UTC) |
| Headline lesson | One sentence — single most actionable takeaway |
| Full review | Link per link policy below |

**Dedup:** If an index row for issue #NNN already exists, do **not** append a duplicate.

**Recurring patterns:** Add a row to the patterns table only when the pattern is genuinely new (not already covered by name or equivalent mitigation). Link "Seen in" to the new issue.

Do **not** copy the full review into RETROSPECTIVES — link only.

## Link policy

| When | Full review link |
|------|------------------|
| Pre-merge | `https://github.com/{owner}/{repo}/blob/{commit-sha}/workflow/issues/issue-N/WORKFLOW-REVIEW.md` |
| Post-merge | `https://github.com/{owner}/{repo}/blob/workflow/archive/issue-N/WORKFLOW-REVIEW.md` |

Get SHA: `git rev-parse HEAD`. Do **not** link to `main` paths for artifacts that will move on archive.

## State file

**Do not** change `stage` — no handoff spawn in v1.

Optionally set `active_skill: workflow-review` for traceability. If touching `workflow.state.json`:

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

## Follow-up issues (optional)

When recommending hardening work:

- Title: `Harden {area} from issue #NNN workflow review`
- Body: links to `WORKFLOW-REVIEW.md` and the RETROSPECTIVES index row
- **Do not** auto-create issues — human opens them

## Git

1. Write `WORKFLOW-REVIEW.md` and update `RETROSPECTIVES.md`
2. Commit on the issue branch
3. Push — **do not** create or open a PR (draft PR already exists if pre-merge)

## Do not

- Spawn handoff or change `stage`
- Add workflow stages or GitHub labels
- Change application code (API, frontend, DB)
- Duplicate RETROSPECTIVES index rows
- Create PRs (`gh pr create` fails in cloud VMs)
