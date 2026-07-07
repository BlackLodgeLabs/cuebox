# Demo notes — Issue #79

**Date:** 2026-07-07  
**Commit SHA:** `d68bb5ba2cb119d2b6f1081bffbb96c39c931ffe`  
**Branch:** `cursor/issue-79-pr-82-demo-agent-be5c`  
**Demo agent:** `bc-2a4cacba-4617-4ad9-8936-3e2c4d5f8b78`

## Environment

- Docker stack: **Up** (all four containers; health checks OK) — not required for this docs-only demo but verified per run instructions.
- Gate: `bash scripts/verify-workflow-paths.sh` exit 0 (see `scenario-1-gate-pass.log`).

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Gate script validates new artifacts | **PASS** | [scenario-1-gate-pass.log](scenario-1-gate-pass.log) |
| 2 | Skill file structure check | **PASS** | Checklist below |
| 3 | Template structure check | **PASS** | Checklist below |
| 4 | Self-review output | **PASS** | [WORKFLOW-REVIEW.md](../WORKFLOW-REVIEW.md), [scenario-4-retrospectives-snippet.md](scenario-4-retrospectives-snippet.md) |
| 5 | Documentation cross-links | **PASS** | Checklist below |

---

## Scenario 2: Skill file structure check

Source: `.cursor/skills/workflow-review/SKILL.md`

| Requirement | Present |
|-------------|---------|
| Invocation patterns table (`@cursoragent workflow-review`, `workflow review for issue NNN`, `use workflow-review skill`) | Yes — "When to use" + "Issue resolution" |
| Read-first list (state, SPEC, PLAN, PR, demo, RETROSPECTIVES, gh) | Yes — "Read first" section |
| RETROSPECTIVES append rules (dedup, headline lesson, patterns) | Yes — "RETROSPECTIVES append" |
| Link policy (commit SHA / archive) | Yes — "Link policy" table |
| `cursor-workflow-merge-state.sh` reference | Yes — "State file" section |
| Explicit "do not change stage" rule | Yes — "State file" + "Do not" |
| Follow-up issue title format (`Harden {area} from issue #NNN workflow review`) | Yes — "Follow-up issues" |
| Does **not** instruct opening a PR | Yes — "Do not" lists no PR creation; Git says push only |
| Does **not** change handoff Action | Yes — "Not spawned by handoff" + "Do not spawn handoff" |

---

## Scenario 3: Template structure check

Source: `workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md` compared to archived #28 and #59 reviews.

| Section | Template | Archive #28 | Archive #59 |
|---------|----------|-------------|-------------|
| Summary | Yes | Yes | Yes |
| Expected workflow (baseline) | Yes | Yes | Yes |
| Pre-workflow history (optional) | Yes | Yes | No (omitted in #59) |
| What happened — timeline | Yes | Yes | Yes |
| Agent index | Yes | Yes | Yes (inline in timeline) |
| Parallel agent side-branches (optional) | Yes | Yes | No |
| What worked as designed | Yes | Yes | Yes |
| What did not happen / deviated | Yes | Yes | Yes |
| Efficiency notes (optional) | Yes | Yes | No |
| Issues to learn from | Yes | Yes | Yes |
| Deliverable checklist | Yes | Yes | Yes |
| Top recommendations | Yes | Yes | Yes |
| Follow-up issues (optional) | Yes | Yes | Yes |
| References | Yes | Yes | Yes |

| Requirement | Result |
|-------------|--------|
| No unfilled `[TODO]` bracket placeholders | **PASS** — only HTML guidance comments (`<!-- ... -->`) |
| Guidance comments OK | Yes |

Gate script assertions (`scripts/verify-workflow-paths.sh` lines 206–224) would fail if `workflow-review` skill or `WORKFLOW-REVIEW.md` template were removed.

---

## Scenario 5: Documentation cross-links

| File | `@cursoragent workflow-review` | Human-triggered (not handoff) |
|------|-------------------------------|-------------------------------|
| `AGENTS.md` | Yes — skills table row + committed skills list | Yes — "on issue (optional)" |
| `workflow/cursor-workflow/WORKFLOW.md` | Yes — invocation table | Yes — "Not spawned by the handoff Action in v1" |
| `workflow/README.md` | Yes — artifacts table row | Yes — "human-triggered" |

| Requirement | Result |
|-------------|--------|
| `AGENTS.md` lists `workflow-review` in committed skills (no parenthetical deferral) | **PASS** |
| `WORKFLOW.md` optional review section has invocation table | **PASS** |
| `workflow/README.md` artifacts table includes when/how to invoke | **PASS** |
