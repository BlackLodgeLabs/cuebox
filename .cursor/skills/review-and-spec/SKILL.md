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

## If detail is insufficient

1. Post a numbered comment on the issue with specific questions (one topic per number).
2. Create branch `cursor/issue-{NNN}-{slug}` from `main` (same slug rules as below).
3. Update or create `workflow/issues/issue-{NNN}/workflow.state.json`:
   - `stage`: `spec-needs-info`
   - `issue`: NNN
   - `branch`: `cursor/issue-{NNN}-{slug}`
   - increment `loops.total_runs`
4. Commit and push **only** `workflow/issues/issue-{NNN}/workflow.state.json` on that branch (no spec file yet).
5. Add label `cursor:spec-needs-info`; remove `cursor:spec-ready` if present.
6. **Stop.** Do not hand off to planning. User will reply and comment `@cursoragent continue spec`.

## If detail is sufficient

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

Cloud agents often **cannot** post issue comments or set labels (integration token limits). **Do not fail the task** for that — commit and push are what matter.

1. Commit spec + `workflow/issues/issue-{NNN}/workflow.state.json` on the feature branch; push.
2. **Labels and a status comment** are applied by `.github/workflows/cursor-workflow-handoff.yml` using `GITHUB_TOKEN` (not your job).
3. Optionally try labels/comments via `gh`; if permission denied, note in commit message only.

**Do not** ask the human to add labels manually unless the GitHub Action also failed.

## Resume (`continue spec`)

1. Re-read issue comments for answers to your numbered questions.
2. If still ambiguous → ask follow-ups and stay on `spec-needs-info`.
3. If clear → update spec, set `stage` to `spec-ready`, preserve `loops` from existing `workflow.state.json`, push, update labels.

## Do not

- Open a pull request (execute opens the draft PR later)
- Start planning or implementation in this skill
- Post bot `@cursoragent` comments to chain agents
