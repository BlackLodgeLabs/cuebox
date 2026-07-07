# Workflow review — Issue #NNN / PR #NNN

<!-- Agent: replace NNN, dates, branch, PR, and links with concrete values. Remove this comment block in output. -->

**Review date:** YYYY-MM-DD  
**Branch:** [`cursor/issue-NNN-slug`](https://github.com/OWNER/REPO/tree/cursor/issue-NNN-slug)  
**PR:** [#NNN](https://github.com/OWNER/REPO/pull/NNN)  
**Reference:** [Cursor workflow docs](https://github.com/OWNER/REPO/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

<!-- 2–4 sentences: outcome, duration, headline deviation (if any). -->

---

## Expected workflow (baseline)

Per [WORKFLOW.md](https://github.com/OWNER/REPO/blob/main/workflow/cursor-workflow/WORKFLOW.md) and [SETUP.md](https://github.com/OWNER/REPO/blob/main/workflow/cursor-workflow/SETUP.md):

| Stage | Trigger | Skill | Key output |
|-------|---------|-------|------------|
| 1 | Human creates issue | — | GitHub issue |
| 2 | `@cursoragent spec` | `review-and-spec` | SPEC.md, `spec-ready` |
| 3 | Handoff | `planning` | PLAN.md, demo-spec.md, `plan-ready` |
| 4 | Handoff | `execute` | Code + tests, `execute-ready` |
| 5 | Handoff | `demo` | demo/ artifacts, `demo-ready` |
| 6 | Handoff | `create-pr` | PR.md, `create-pr-ready` |
| 7 | Handoff | `babysit-pr` | PR ready for review, `complete` |
| 8 | Human | — | Merge |

---

## Pre-workflow history

<!-- Optional: prior attempts, superseded PRs. Omit section if none. -->

| Date | Event | Notes |
|------|-------|-------|
| | | |

---

## What happened — timeline

Agent links open conversations in the [Cursor agents UI](https://cursor.com/agents). IDs are from `workflow.state.json` and handoff Action logs.

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| | | | |

**Duration (spec trigger → current stage):**  
**Babysit / complete:**  

### Parallel agent side-branches

<!-- Optional: omit if no side-branches. -->

| Branch suffix | Stage | Notes |
|---------------|-------|-------|
| | | |

### Agent index

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| review-and-spec | | |
| planning | | |
| execute | | |
| demo | | |
| create-pr | | |
| babysit-pr | | |

---

## What worked as designed

<!-- Numbered list of successes. -->

1.

---

## What did not happen (or deviated)

<!-- Subsections per failure mode. Omit empty subsections. -->

### Stage / label drift

### Parallel agents or handoff failures

### Demo / CI / review gaps

---

## Efficiency notes

<!-- Optional: commit count, meta churn, wasted agents. Omit if not applicable. -->

---

## Issues to learn from

<!-- Numbered forensic findings. -->

1.

---

## Deliverable checklist

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Feature / workflow scope | | |
| Tests / gates | | |
| Demo evidence | | |
| PR.md | | |
| CI | | |
| Babysit / complete | | |

---

## Top recommendations

<!-- 3–5 actionable items for future hardening. -->

1.

---

## Follow-up issues

<!-- Optional: proposed titles; human opens them. Format: Harden {area} from issue #NNN workflow review -->

---

## References

- Issue: [#NNN](https://github.com/OWNER/REPO/issues/NNN)
- PR: [#NNN](https://github.com/OWNER/REPO/pull/NNN)
- Artifacts: `workflow/issues/issue-NNN/` (pre-merge) or `workflow/archive/issue-NNN/` (post-merge)
- Related reviews: [RETROSPECTIVES.md](https://github.com/OWNER/REPO/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
