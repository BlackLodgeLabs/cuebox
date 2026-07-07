# Issue #79: Workflow review skill (post-babysit retrospective)

## Summary

Add a **human-triggered** Cursor agent skill (`workflow-review`) that runs after babysit-pr (or after PR merge) to produce structured per-issue workflow post-mortems. The skill writes `workflow/issues/issue-NNN/WORKFLOW-REVIEW.md`, appends a curated index row to `workflow/cursor-workflow/RETROSPECTIVES.md`, and optionally proposes follow-up GitHub issues for workflow hardening. This formalizes the ad hoc reviews from issues [#28](https://github.com/BlackLodgeLabs/cuebox/issues/28) and [#59](https://github.com/BlackLodgeLabs/cuebox/issues/59) that drove hardening work in [#62](https://github.com/BlackLodgeLabs/cuebox/issues/62) and [#70](https://github.com/BlackLodgeLabs/cuebox/issues/70).

## Problem

Completed workflow runs produced valuable forensic reviews (`WORKFLOW-REVIEW.md`) that exposed real gaps — parallel demo agents, state drift, missing babysit, pass-back needs — but the process was **ad hoc**: no skill, no template, no standard trigger, and lessons were scattered across issue folders that archive on merge.

Without a repeatable review step:

- Workflow-hardening agents lack a single place to skim recurring patterns before spec/plan work.
- Index maintenance is manual and inconsistent.
- Follow-up issues are opened without structured links back to forensics.

## Acceptance criteria

- [ ] New skill: `.cursor/skills/workflow-review/SKILL.md`
- [ ] New template: `workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md`
- [ ] Skill triggered by human issue comment (e.g. `@cursoragent workflow-review` or `@cursoragent workflow review for issue NNN`) — **not** spawned by `cursor-workflow-handoff.yml` in v1
- [ ] Skill reads: `workflow.state.json`, `SPEC.md`, `PLAN.md`, `PR.md`, `demo/demo-notes.md`, PR checks/comments, and existing `RETROSPECTIVES.md`
- [ ] Skill writes: `workflow/issues/issue-NNN/WORKFLOW-REVIEW.md` (full forensics)
- [ ] Skill appends to `workflow/cursor-workflow/RETROSPECTIVES.md`: index row (issue, PR, date, headline lesson, link to full review) + updates "Recurring patterns" only when a new pattern appears
- [ ] Index links use **commit SHA** or `workflow/archive` path (compatible with archive-on-merge policy)
- [ ] `workflow/README.md` documents when to run workflow review (extend existing table entry with invocation guidance)
- [ ] `workflow/cursor-workflow/WORKFLOW.md` documents optional post-babysit step (human-triggered only; section exists — verify completeness against this spec)
- [ ] `AGENTS.md` skills table lists `workflow-review` in the committed skills list (not parenthetical "when #79 lands")
- [ ] `RETROSPECTIVES.md` seeded with retrospective summaries from issue #28 and #59 (already present on `main` — execute verifies content matches archived reviews)
- [ ] `scripts/verify-workflow-paths.sh` validates: template exists; skill file exists; skill references merge-state helper if it commits `workflow.state.json`

## Scope

### In scope

- **Skill** (`.cursor/skills/workflow-review/SKILL.md`): invocation triggers, read list, write steps, RETROSPECTIVES append rules, optional follow-up issue guidance, merge-state helper usage when touching `workflow.state.json`
- **Template** (`workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md`): section structure modeled on archived reviews from #28 and #59 (summary, expected baseline, timeline, agent side-branches, root causes, recommendations, follow-up issues)
- **RETROSPECTIVES.md** structure (C+ model): central index + recurring patterns table; full reviews stay per-issue
- **Docs updates**: `WORKFLOW.md`, `workflow/README.md`, `AGENTS.md` — align with skill behavior
- **User-triggered invocation** via issue comments only
- **Gate script** extension in `verify-workflow-paths.sh`
- **Seed verification** for #28 and #59 index rows (content already on `main`; no duplicate work if accurate)

### Out of scope (v1)

- New `workflow.state.json` stages (`workflow-review-ready`, `workflow-review-in-progress`, etc.)
- Handoff Action spawning `workflow-review` agent
- Auto-run on `complete` or PR merge
- Application code changes (API, frontend, DB)
- Consolidating or deleting archived per-issue reviews on `workflow/archive`
- GitHub labels for workflow-review stage (not part of the handoff pipeline)

## User flows / API changes

### Primary flow (post-babysit, pre-merge)

1. Workflow reaches `complete` (babysit-pr finished; PR ready for review).
2. Issue author comments **`@cursoragent workflow-review`** on the issue (or `@cursoragent workflow review for issue NNN`).
3. Cloud agent on branch `cursor/issue-NNN-{slug}`:
   - Reads workflow artifacts and PR forensics (checks, comments, Action runs).
   - Writes `workflow/issues/issue-NNN/WORKFLOW-REVIEW.md` from template.
   - Appends one row to `RETROSPECTIVES.md` index; updates "Recurring patterns" only for genuinely new patterns.
   - Commits and pushes (no PR creation by the agent — uses existing draft PR).
4. Issue author reads the review; optionally opens follow-up issues (e.g. "Harden X from issue #NNN review").

### Alternate flow (post-merge)

1. PR merges; post-merge Action archives `workflow/issues/issue-N/` to `workflow/archive` branch.
2. Human comments `@cursoragent workflow-review` on the closed issue.
3. Agent checks out `workflow/archive` (or uses archived paths) to write review; RETROSPECTIVES index link targets `workflow/archive/issue-N/WORKFLOW-REVIEW.md` or a commit SHA on the archive branch.

### Invocation patterns (skill must document)

| Comment | Behavior |
|---------|----------|
| `@cursoragent workflow-review` | Review the issue the comment is on |
| `@cursoragent workflow review for issue 28` | Review issue #28 explicitly |
| `@cursoragent use workflow-review skill for issue NNN` | Same as above |

### No API / UI changes

Workflow and docs only. No new HTTP endpoints or screens.

## Data and integration notes

### Inputs (read-only)

| Source | Purpose |
|--------|---------|
| `workflow/issues/issue-NNN/workflow.state.json` | Stage timeline, agent IDs, loop counters, PR number |
| `SPEC.md`, `PLAN.md`, `PR.md` | Intended vs actual scope |
| `demo/demo-notes.md`, `demo/demo-spec.md` | Demo pass/fail, evidence gaps |
| GitHub PR checks, comments, review threads | CI/Bugbot/human feedback |
| GitHub Actions handoff runs | Spawn failures, deferrals, API 400s |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | Avoid duplicate index rows; pattern dedup |
| Archived `WORKFLOW-REVIEW.md` on `workflow/archive` | Reference format for #28/#59 |

### Outputs

| Path | Writer |
|------|--------|
| `workflow/issues/issue-NNN/WORKFLOW-REVIEW.md` | `workflow-review` skill |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | Append index row; conditional pattern row |

### Link policy

- **Index "Full review" column:** `https://github.com/{owner}/{repo}/blob/workflow/archive/issue-N/WORKFLOW-REVIEW.md` after merge, or `https://github.com/{owner}/{repo}/blob/{commit-sha}/workflow/issues/issue-N/WORKFLOW-REVIEW.md` before merge.
- Do **not** link to `main` paths for artifacts that will move on archive.

### State file

v1 does **not** add handoff stages. The skill may optionally set `active_skill: workflow-review` on push for traceability but must **not** change `stage` or trigger handoff Action spawns. If the skill commits `workflow.state.json` (e.g. to record `active_skill`), it must run `cursor-workflow-merge-state.sh` first.

### RETROSPECTIVES append rules (C+ model)

1. **Index table:** append one row per review; never duplicate an issue number already indexed.
2. **Headline lesson:** one sentence — the single most actionable takeaway.
3. **Recurring patterns:** add a row only when the pattern is not already covered (match on pattern name or equivalent mitigation); link "Seen in" to the new issue.
4. Do not copy the full review into RETROSPECTIVES — link only.

### Follow-up issues (optional, skill guidance)

When recommending hardening work, use title format: `Harden {area} from issue #NNN workflow review` and body links to `WORKFLOW-REVIEW.md` and the RETROSPECTIVES index row. Do not auto-create issues — human opens them.

### Existing main-branch prep (execute should not redo)

These already reference #79 on `main`:

- `workflow/cursor-workflow/RETROSPECTIVES.md` — seeded index for #28 and #59
- `workflow/cursor-workflow/WORKFLOW.md` — "Optional workflow review" subsection
- `workflow/README.md` — `WORKFLOW-REVIEW.md` row in artifacts table
- `AGENTS.md` — skills table mentions `workflow-review` parenthetically

Execute focuses on skill, template, gate script, and finalizing AGENTS.md skills list.

### Verification

- `bash scripts/verify-workflow-paths.sh` must pass after changes.
- Manual: comment `@cursoragent workflow-review` on a completed test issue; confirm `WORKFLOW-REVIEW.md` and RETROSPECTIVES row.

## Open questions (must be empty before plan-ready)

*(none — issue body is complete)*

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/79
- Prior reviews (archive): [issue-28](https://github.com/BlackLodgeLabs/cuebox/blob/workflow/archive/issue-28/WORKFLOW-REVIEW.md), [issue-59](https://github.com/BlackLodgeLabs/cuebox/blob/workflow/archive/issue-59/WORKFLOW-REVIEW.md)
- Retrospectives index: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
- Workflow docs: [WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)
- Related hardening: [#62](https://github.com/BlackLodgeLabs/cuebox/issues/62), [#70](https://github.com/BlackLodgeLabs/cuebox/issues/70), [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68), [#77](https://github.com/BlackLodgeLabs/cuebox/issues/77)
