# Implementation plan — Issue #79: Workflow review skill

## Overview

Add a **human-triggered** `workflow-review` Cursor skill that formalizes post-mortem reviews after babysit-pr (or post-merge). The skill reads workflow artifacts and GitHub forensics, writes a per-issue `WORKFLOW-REVIEW.md` from a new template, and appends a curated index row to `RETROSPECTIVES.md`. No handoff Action changes, no new `workflow.state.json` stages, and no application code.

Most prep work is already on `main`: `RETROSPECTIVES.md` is seeded with #28 and #59 summaries; `WORKFLOW.md`, `workflow/README.md`, and `AGENTS.md` reference the skill parenthetically. Execute delivers the skill file, template, gate-script extension, and doc finalization.

**Classification:** Workflow / infrastructure feature — **not** an application bug. Bug reproduction is skipped.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `.cursor/skills/workflow-review/SKILL.md` | **Create** | Core skill: invocation, read list, write steps, RETROSPECTIVES rules, optional follow-up guidance |
| `workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md` | **Create** | Section structure modeled on archived #28 and #59 reviews |
| `scripts/verify-workflow-paths.sh` | **Modify** | Add `workflow-review` to skills list; validate template exists; check merge-state reference |
| `AGENTS.md` | **Modify** | Promote `workflow-review` from parenthetical to committed skills list |
| `workflow/cursor-workflow/WORKFLOW.md` | **Modify** | Expand "Optional workflow review" with invocation table, post-merge flow, link policy |
| `workflow/README.md` | **Modify** | Add invocation guidance to `WORKFLOW-REVIEW.md` table row |
| `workflow/issues/issue-79/WORKFLOW-REVIEW.md` | **Create (demo)** | Self-review produced by demo agent to validate skill output |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | **Modify (demo)** | Append #79 index row after demo self-review |

**No changes:** `cursor-workflow-handoff.yml`, application code, `workflow.state.json` stages, GitHub labels.

## Implementation steps

### Step 1 — Create `WORKFLOW-REVIEW.md` template

Create `workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md` with sections derived from archived reviews:

1. **Header** — Review date, branch, PR, reference link to WORKFLOW.md
2. **Summary** — 2–4 sentences: outcome, duration, headline deviation (if any)
3. **Expected workflow (baseline)** — Eight-stage table from WORKFLOW.md
4. **Pre-workflow history** (optional) — Prior attempts, superseded PRs
5. **What happened — timeline** — UTC table: time, event, stage/label, agent link
6. **Parallel agent side-branches** (when applicable) — Branch suffix table
7. **Agent index** — Skill/role, agent ID, conversation link
8. **What worked as designed** — Numbered list
9. **What did not happen (or deviated)** — Subsections per failure mode
10. **Efficiency notes** (optional) — Commit count, meta churn, wasted agents
11. **Issues to learn from** — Numbered forensic findings
12. **Deliverable checklist** — Feature vs workflow status table
13. **Top recommendations** — 3–5 actionable items for future hardening
14. **Follow-up issues** (optional) — Proposed titles; human opens them
15. **References** — Issue, PR, artifacts, related reviews

Include HTML comment placeholders (like `PR.md` template) for agent guidance; do not leave bracket placeholders in output files.

### Step 2 — Create `workflow-review` skill

Create `.cursor/skills/workflow-review/SKILL.md` following conventions from `create-pr` and `review-and-spec`:

**Front matter:**
```yaml
name: workflow-review
description: Produce structured workflow post-mortem after babysit or merge; write WORKFLOW-REVIEW.md and update RETROSPECTIVES.md. Use when user comments @cursoragent workflow-review on an issue.
paths:
  - "workflow/**"
```

**Sections to include:**

| Section | Content |
|---------|---------|
| When to use | `@cursoragent workflow-review`, `@cursoragent workflow review for issue NNN`, `@cursoragent use workflow-review skill for issue NNN` |
| Preconditions | Issue has completed (or partially completed) workflow artifacts; prefer `stage: complete` but allow post-merge archive |
| Read first | `workflow.state.json`, `SPEC.md`, `PLAN.md`, `PR.md`, `demo/demo-notes.md`, `demo/demo-spec.md`, `RETROSPECTIVES.md`, archived reviews on `workflow/archive`, PR checks/comments via `gh` |
| Issue resolution | Comment issue number wins; else explicit `for issue NNN`; else issue the comment is on |
| Post-merge path | Fetch `workflow/archive` branch; read `issue-N/` paths; link index to archive branch |
| Write WORKFLOW-REVIEW.md | Copy template structure; fill from forensics; commit to `workflow/issues/issue-NNN/` (pre-merge) or note archive path (post-merge) |
| RETROSPECTIVES append | One index row; dedupe by issue number; headline lesson = one sentence; update Recurring patterns only for genuinely new patterns |
| Link policy | Pre-merge: `blob/{commit-sha}/workflow/issues/issue-N/WORKFLOW-REVIEW.md`; post-merge: `blob/workflow/archive/issue-N/WORKFLOW-REVIEW.md` |
| State file | **Do not** change `stage`. Optionally set `active_skill: workflow-review` for traceability; if touching `workflow.state.json`, run `cursor-workflow-merge-state.sh` first |
| Follow-up issues | Title format `Harden {area} from issue #NNN workflow review`; link to review + RETROSPECTIVES row; **do not** auto-create |
| Git | Commit review + RETROSPECTIVES on issue branch; push; **do not** create PR |
| Do not | Spawn handoff, add stages/labels, change application code, duplicate index rows |

### Step 3 — Extend `verify-workflow-paths.sh`

Add checks (after existing `WORKFLOW_SKILLS` block):

1. Add `workflow-review` to `WORKFLOW_SKILLS` array (inherits merge-state + file-exists checks).
2. Assert `workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md` exists.
3. Assert template contains key sections: `Summary`, `Expected workflow`, `timeline`, `recommendations` (or equivalent headings).
4. Assert `WORKFLOW_MD` mentions `workflow-review` and `@cursoragent workflow-review`.
5. Assert `AGENTS.md` skills list includes `workflow-review` (not parenthetical "when #79 lands").
6. Assert `RETROSPECTIVES.md` index rows exist for issues #28 and #59 with `workflow/archive` links.

### Step 4 — Finalize documentation

**`AGENTS.md`** — Update skills bullet from:
```
(+ workflow-review when #79 lands)
```
to include `workflow-review` in the committed list:
```
.cursor/skills/{review-and-spec,planning,execute,demo,create-pr,babysit-pr,run-gate-scripts,workflow-review}/SKILL.md
```

**`workflow/cursor-workflow/WORKFLOW.md`** — Expand "Optional workflow review" subsection:
- Invocation patterns table (from SPEC)
- Post-merge alternate flow (archive branch)
- Link policy (commit SHA vs archive)
- Explicit note: not spawned by handoff Action in v1
- Cross-link to skill file and RETROSPECTIVES.md

**`workflow/README.md`** — Extend `WORKFLOW-REVIEW.md` table row with:
- When to run: after babysit `complete` or post-merge
- How: `@cursoragent workflow-review` on the issue

### Step 5 — Verify RETROSPECTIVES seed content

Read `workflow/cursor-workflow/RETROSPECTIVES.md` and compare index rows for #28 and #59 against archived `WORKFLOW-REVIEW.md` headlines. **Do not rewrite** if accurate. Gate script assertions in Step 3 enforce presence.

### Step 6 — Run gate and commit

```bash
bash scripts/verify-workflow-paths.sh
```

Commit in logical units:
1. Template + skill
2. Gate script + docs
3. Demo artifacts (demo agent)

## Tests required

| Test | Type | Maps to acceptance criterion |
|------|------|------------------------------|
| `bash scripts/verify-workflow-paths.sh` | Gate / regression | Template exists; skill exists; skill references merge-state; AGENTS.md updated; RETROSPECTIVES seed rows |
| Gate: `workflow-review` in `WORKFLOW_SKILLS` | Shell assertion (new) | Skill file exists and references `cursor-workflow-merge-state.sh` |
| Gate: `WORKFLOW-REVIEW.md` template sections | Shell assertion (new) | Template structure matches archived review format |
| Gate: RETROSPECTIVES #28/#59 rows | Shell assertion (new) | Seeded content matches archive links |
| Manual: `@cursoragent workflow-review` on completed issue | Integration (demo) | Produces `WORKFLOW-REVIEW.md` + index row |
| Demo self-review on #79 | Demo scenario | Validates skill output on a real workflow run |

No API, frontend, or DB unit tests — workflow-only change.

## Gate script

Primary gate:

```bash
bash scripts/verify-workflow-paths.sh
```

No phase gates required (no application code). Execute records gate evidence in PR.md as:

```
Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>
```

## Documentation updates

| File | Update |
|------|--------|
| `AGENTS.md` | Add `workflow-review` to committed skills list |
| `workflow/cursor-workflow/WORKFLOW.md` | Expand optional workflow review section |
| `workflow/README.md` | Invocation guidance for WORKFLOW-REVIEW.md |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | Demo appends #79 row (execute/demo) |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Duplicate RETROSPECTIVES rows | Skill checks issue number before append; gate can add jq assertion |
| Skill changes `stage` and spawns unwanted handoff | Skill explicitly forbids `stage` changes; no new handoff stages in v1 |
| Post-merge agent cannot find artifacts | Skill documents `git fetch origin workflow/archive` and `issue-N/` paths |
| Index links break after archive | Link policy uses commit SHA (pre-merge) or `workflow/archive` branch (post-merge) |
| Over-broad template makes reviews verbose | Template includes "optional" section markers; skill guidance says skip empty sections |

**Rollback:** Revert skill, template, gate additions, and doc edits. `RETROSPECTIVES.md` row for #79 can stay (harmless) or be removed manually.

## Definition of done

- [ ] `.cursor/skills/workflow-review/SKILL.md` exists with invocation, read/write steps, RETROSPECTIVES rules, merge-state reference
- [ ] `workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md` exists with sections matching #28/#59 archive format
- [ ] `scripts/verify-workflow-paths.sh` validates skill, template, RETROSPECTIVES seed, AGENTS.md
- [ ] `AGENTS.md` lists `workflow-review` in committed skills (no parenthetical deferral)
- [ ] `WORKFLOW.md` and `workflow/README.md` document human-triggered invocation
- [ ] `bash scripts/verify-workflow-paths.sh` exits 0
- [ ] Demo: `WORKFLOW-REVIEW.md` for #79 committed; RETROSPECTIVES index row appended
- [ ] No handoff Action, application code, or new workflow stages changed
- [ ] `workflow.state.json` at `plan-ready` (planning agent)
