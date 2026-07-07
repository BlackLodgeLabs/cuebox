## Related Issue

Closes #79

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/79)

## Description

**What does this PR do?**

Adds a **human-triggered** Cursor agent skill (`workflow-review`) that produces structured per-issue workflow post-mortems after babysit-pr or post-merge. The skill reads workflow artifacts (`workflow.state.json`, `SPEC.md`, `PLAN.md`, `PR.md`, demo notes) plus GitHub PR forensics, writes `workflow/issues/issue-NNN/WORKFLOW-REVIEW.md` from a new template, and appends a curated index row to `workflow/cursor-workflow/RETROSPECTIVES.md`. Documentation in `AGENTS.md`, `WORKFLOW.md`, and `workflow/README.md` is updated so authors know to invoke `@cursoragent workflow-review` on the issue. The gate script `verify-workflow-paths.sh` enforces skill, template, and doc requirements.

This formalizes the ad hoc forensic reviews from issues [#28](https://github.com/BlackLodgeLabs/cuebox/issues/28) and [#59](https://github.com/BlackLodgeLabs/cuebox/issues/59) that previously drove hardening work in [#62](https://github.com/BlackLodgeLabs/cuebox/issues/62) and [#70](https://github.com/BlackLodgeLabs/cuebox/issues/70).

**Why is this the best approach?**

- **Human-triggered only (v1):** avoids coupling a new handoff stage or Action spawn to an optional retrospective step; keeps the eight-stage pipeline unchanged.
- **C+ index model:** full forensics stay per-issue (`WORKFLOW-REVIEW.md`); `RETROSPECTIVES.md` holds a skim-friendly index and recurring-patterns table — lessons survive archive-on-merge via commit-SHA or `workflow/archive` links.
- **Template + skill:** archived #28/#59 reviews informed the section structure so future agents produce consistent, actionable output without re-reading every prior review.
- **Gate enforcement:** `verify-workflow-paths.sh` regression catches missing skill/template/doc drift in CI without application test overhead.

## Changes Proposed

* Added `.cursor/skills/workflow-review/SKILL.md` — invocation patterns, read-first list, `WORKFLOW-REVIEW.md` write steps, RETROSPECTIVES append/dedup rules, link policy (commit SHA / archive), optional follow-up issue guidance; explicitly forbids stage changes, handoff spawns, and PR creation.
* Added `workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md` — section structure modeled on archived #28 and #59 reviews (summary, baseline, timeline, agent index, deviations, recommendations, references).
* Extended `scripts/verify-workflow-paths.sh` — `workflow-review` in `WORKFLOW_SKILLS`; asserts template sections, `AGENTS.md` committed skills list, `WORKFLOW.md` invocation docs, and RETROSPECTIVES seed rows for #28/#59.
* Updated `AGENTS.md` — promotes `workflow-review` from parenthetical deferral to the committed skills list.
* Updated `workflow/cursor-workflow/WORKFLOW.md` — expanded "Optional workflow review" with invocation table, post-merge archive flow, link policy, and explicit note that handoff does not spawn this skill in v1.
* Updated `workflow/README.md` — artifacts table row documents when/how to invoke `@cursoragent workflow-review`.
* Demo: `workflow/issues/issue-79/WORKFLOW-REVIEW.md` self-review for issue #79; appended #79 index row to `RETROSPECTIVES.md`; demo evidence under `workflow/issues/issue-79/demo/`.
* Incidental: `fix(workflow): recover handoffs when shallow checkout misses BEFORE_SHA` — unblocked execute spawn after `plan-ready` on this branch.
* Incidental: aligned `test-cursor-workflow-strip-cursor-labels.sh` with dynamic per-label removal.

## Scenario Results

Workflow/docs-only change — no UI screenshots. Demo ran five scenarios per [demo-spec.md](https://github.com/BlackLodgeLabs/cuebox/blob/5d8e189/workflow/issues/issue-79/demo/demo-spec.md).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Gate script validates new artifacts | **PASS** | [scenario-1-gate-pass.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/5d8e189/workflow/issues/issue-79/demo/scenario-1-gate-pass.log) |
| 2 | Skill file structure check | **PASS** | [demo-notes.md § Scenario 2](https://github.com/BlackLodgeLabs/cuebox/blob/5d8e189/workflow/issues/issue-79/demo/demo-notes.md#scenario-2-skill-file-structure-check) |
| 3 | Template structure check | **PASS** | [demo-notes.md § Scenario 3](https://github.com/BlackLodgeLabs/cuebox/blob/5d8e189/workflow/issues/issue-79/demo/demo-notes.md#scenario-3-template-structure-check) |
| 4 | Self-review output | **PASS** | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/d68bb5b/workflow/issues/issue-79/WORKFLOW-REVIEW.md), [RETROSPECTIVES row snippet](https://github.com/BlackLodgeLabs/cuebox/blob/5d8e189/workflow/issues/issue-79/demo/scenario-4-retrospectives-snippet.md) |
| 5 | Documentation cross-links | **PASS** | [demo-notes.md § Scenario 5](https://github.com/BlackLodgeLabs/cuebox/blob/5d8e189/workflow/issues/issue-79/demo/demo-notes.md#scenario-5-documentation-cross-links) |

## How to Test

1. Checkout this branch: `git checkout cursor/issue-79-workflow-review-skill`
2. Run the workflow regression gate from repo root:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
   Expect exit code 0 and final line `PASS: no legacy workflow paths found`.
3. Confirm the skill file exists and documents human invocation:
   ```bash
   grep -E 'workflow-review|@cursoragent workflow-review' .cursor/skills/workflow-review/SKILL.md AGENTS.md workflow/cursor-workflow/WORKFLOW.md workflow/README.md
   ```
4. Confirm the template covers archived review sections:
   ```bash
   grep -E '^## ' workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md
   ```
5. Review demo self-review output:
   - `workflow/issues/issue-79/WORKFLOW-REVIEW.md` — concrete forensics for this workflow run (not placeholders).
   - `workflow/cursor-workflow/RETROSPECTIVES.md` — index row for #79 with commit-SHA link to full review.
6. *(Optional, post-merge)* Comment `@cursoragent workflow-review` on a completed issue to validate the skill on a real babysit-complete run.

No Docker stack, API, or frontend routes required — workflow and documentation only.

## Known Issues / Notes for Reviewer

* The demo used a **self-review** on issue #79 (scenario 4) rather than waiting for babysit `complete` — appropriate because the deliverable is the review skill itself. Post-merge invocation against archived paths is documented in the skill but not exercised in this PR.
* v1 does **not** add `workflow.state.json` stages or handoff Action spawns for `workflow-review`; invocation is issue-comment only.
* `WORKFLOW-REVIEW.md` for #79 notes the pipeline was at `demo-ready` when the self-review was written; create-pr and babysit stages follow in the same PR.
* A handoff recovery fix (`BEFORE_SHA` shallow-checkout) landed on this branch before execute spawned — unrelated to the feature but required for this run to complete execute.

## Gate evidence

- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `71a26a8` (execute-ready)
- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `d68bb5b` (demo self-review)
- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `5d8e189` (demo-ready, re-verified at create-pr)

## Checklist

- [ ] Acceptance criteria in [SPEC.md](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-79-workflow-review-skill/workflow/issues/issue-79/SPEC.md) met
- [ ] No application code changes (API, frontend, DB)
- [ ] `workflow-review` skill does not change `stage` or spawn handoff
- [ ] RETROSPECTIVES index row for #79 uses commit-SHA or archive link (not `main` path)
- [ ] Gate script passes on reviewer machine
