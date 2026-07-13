---
name: review-and-spec
description: Review a GitHub issue for completeness, ask clarifying questions if ambiguous, and write a feature spec on a new branch. Use when the user comments spec or continue spec on an issue, or when triggered for issue triage before planning.
---

# Review and spec

Turn a GitHub issue into a clear, testable feature spec on a dedicated branch.

## When to use

- User commented `@cursoragent spec` on an issue → **new** spec run
- User commented `@cursoragent continue spec` → **resume** after they answered your questions
- Handoff automation with prompt referencing this skill and an issue number

## Read first

1. GitHub issue (title, body, comments)
2. [workflow/cursor-workflow/WORKFLOW.md](../../../workflow/cursor-workflow/WORKFLOW.md)
3. Existing `workflow/issues/issue-{NNN}/workflow.state.json` if resuming

## Completeness rubric

Before writing the spec, the issue must clearly cover:

- **Problem / goal** — what and why
- **Acceptance criteria** — testable outcomes
- **Scope** — in scope and explicitly out of scope
- **User-visible behavior** — screens, flows, or API changes
- **Data / integration impact** — DB, sync, external APIs if relevant

If any item is missing or ambiguous, **do not** write the spec document yet.

## GitHub MCP

See [workflow/cursor-workflow/MCP-GITHUB.md](../../../workflow/cursor-workflow/MCP-GITHUB.md).

1. `GetMcpTools` → `github` with `serverStatus: ready`?
2. If yes: use MCP for mapped operations (check idempotency markers first)
3. Always: merge-state + push `workflow.state.json`
4. If MCP fails: log in commit message; rely on Actions sync on push

## Genuine question vs step failure

| Situation | Action |
|-----------|--------|
| **Genuine question** — product/spec ambiguity, missing acceptance criteria | MCP issue comment with @mentions + agent link + `<!-- cursor-mcp-spec-questions:v1 -->`; set `cursor:spec-needs-info` |
| **Step failure** — code bug, CI failure, environment defect | N/A for this skill — fix or document in spec; do not ask human to fix code |

**Genuine question comment template** (@mentions from `issue_read` author + repo owner metadata; marker last):

```markdown
@{author} @{owner} — I need clarification before proceeding on issue #NNN.

1. …
2. …

Reply on this issue, then comment `@cursoragent continue spec`.

If you need to chat more, talk to me [here](https://cursor.com/agents/<agent-id>).

<!-- cursor-mcp-spec-questions:v1 -->
```

## If detail is insufficient

1. **MCP (preferred):** `issue_read` method `get_comments` — skip if `<!-- cursor-mcp-spec-questions:v1 -->` present. Else `add_issue_comment` with numbered questions (one topic per number) + marker as last line. `issue_write` method `update` with `labels: ["cursor:spec-needs-info"]`.
2. Create branch `cursor/issue-{NNN}-{slug}` from `main` (same slug rules as below).
3. Run merge helper, then update or create `workflow/issues/issue-{NNN}/workflow.state.json`:
   - `stage`: `spec-needs-info`
   - `issue`: NNN
   - `branch`: `cursor/issue-{NNN}-{slug}`
   - increment `loops.total_runs`
4. Commit and push **only** `workflow/issues/issue-{NNN}/workflow.state.json` on that branch (no spec file yet).
5. **MCP (preferred):** ensure `cursor:spec-needs-info` label via `issue_write`; remove `cursor:spec-ready` if present. Actions reconcile labels on push if MCP unavailable.
6. **Stop.** Do not hand off to planning. User will reply and comment `@cursoragent continue spec`.

## If detail is sufficient

### Start — update state (first commit)

Before writing the spec, commit an early state update:

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

```json
{ "stage": "spec-in-progress", "active_skill": "review-and-spec", "updated_at": "<ISO8601>" }
```

Push before substantive work.

### Branch

Create from `main`:

```text
cursor/issue-{NNN}-{slug}
```

`slug` = lowercase issue title, alphanumeric + hyphens, max ~40 chars.

### Files to create

| Path | Content |
|------|---------|
| `workflow/issues/issue-{NNN}/SPEC.md` | Full feature spec (template below) |
| `workflow/issues/issue-{NNN}/workflow.state.json` | State file (see WORKFLOW.md) |

### Spec template (`workflow/issues/issue-{NNN}/SPEC.md`)

```markdown
# Issue #{NNN}: {title}

## Summary
## Problem
## Acceptance criteria
- [ ] ...
## Scope
### In scope
### Out of scope
## User flows / API changes
## Data and integration notes
## Open questions (must be empty before plan-ready)
## Links
- GitHub issue: ...
```

### Finalize state

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

```json
{
  "issue": NNN,
  "branch": "cursor/issue-{NNN}-{slug}",
  "pr": null,
  "stage": "spec-ready",
  "loops": { "bugbot": 0, "ci_autofix": 0, "total_runs": <1 if new, else preserve from existing> },
  "updated_at": "<ISO8601>"
}
```

Preserve existing `loops` when resuming from `spec-needs-info` (do not reset `total_runs`).

### Git and GitHub visibility

1. Commit spec + `workflow/issues/issue-{NNN}/workflow.state.json` on the feature branch; push.
2. **MCP (preferred):** After push, optional `add_issue_comment` with spec summary + `<!-- cursor-mcp-spec-ready:v1 -->` (check marker first via `issue_read` method `get_comments`). Dogfood criterion for workflow issues.
3. **Labels and pinned status comment** are also applied by `.github/workflows/cursor-workflow-handoff.yml` on push (belt-and-suspenders).
4. If MCP unavailable, push alone is sufficient — Actions sync labels and status comment.

**Do not** ask the human to add labels manually unless both MCP and the GitHub Action failed.

## Resume (`continue spec`)

1. **MCP (preferred):** `issue_read` method `get_comments` for answers to your numbered questions.
2. If still ambiguous → ask follow-ups and stay on `spec-needs-info`.
3. If clear → update spec, set `stage` to `spec-ready`, preserve `loops` from existing `workflow.state.json`, push, update labels.

## Agent side-branch merges

When merging a cloud-agent side branch (`cursor/issue-NNN-pr-MMM-*-agent-*` or any `*-agent-*` branch) into the main issue branch, run the merge helper on `workflow.state.json` **before** committing so `stage`, `agents`, and `loops` do not regress:

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

## Do not

- Open a pull request (`.github/workflows/cursor-workflow-handoff.yml` opens the draft PR at `spec-ready`)
- Start planning or implementation in this skill
- Post bot `@cursoragent` comments to chain agents
