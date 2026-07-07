# Demo spec — issue #79: Workflow review skill

Planning agent output. Demo agent follows this exactly.

## Preconditions

- **No Docker stack required** — workflow/docs-only change
- Issue branch `cursor/issue-79-workflow-review-skill` checked out with execute commits (skill, template, gate, docs)
- `bash scripts/verify-workflow-paths.sh` passes on HEAD
- `gh` CLI available for PR/issue forensics (optional but recommended)

### Seed steps

None — this issue's workflow artifacts (`SPEC.md`, `PLAN.md`, `workflow.state.json`, draft PR #82) are sufficient for a self-review demo.

## Scenarios

### Scenario 1: Gate script validates new artifacts

**Goal:** Confirm `verify-workflow-paths.sh` enforces skill, template, and doc requirements.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh` from repo root.
2. Capture stdout.

**Capture:**

- Log excerpt: `workflow/issues/issue-79/demo/scenario-1-gate-pass.log`

**Pass criteria:**

- Exit code 0
- Output includes `PASS: no legacy workflow paths found`
- Script would fail if `workflow-review` skill or `WORKFLOW-REVIEW.md` template were removed (verify by reading gate script assertions, not by breaking the build)

### Scenario 2: Skill file structure check

**Goal:** Confirm the committed skill documents all required behaviors from SPEC acceptance criteria.

**Steps:**

1. Read `.cursor/skills/workflow-review/SKILL.md`.
2. Verify it contains: invocation patterns table, read-first list, RETROSPECTIVES append rules, link policy, merge-state helper reference, explicit "do not change stage" rule, follow-up issue title format.
3. Confirm it does **not** instruct opening a PR or changing handoff Action.

**Capture:**

- Checklist in `workflow/issues/issue-79/demo/demo-notes.md` (Scenario 2 section)

**Pass criteria:**

- All SPEC invocation patterns documented (`@cursoragent workflow-review`, `workflow review for issue NNN`, `use workflow-review skill`)
- `cursor-workflow-merge-state.sh` referenced
- No handoff stage additions documented

### Scenario 3: Template structure check

**Goal:** Confirm `WORKFLOW-REVIEW.md` template matches archived review format.

**Steps:**

1. Read `workflow/cursor-workflow/templates/WORKFLOW-REVIEW.md`.
2. Compare section headings against archived reviews at `workflow/archive` issue-28 and issue-59.
3. Confirm template includes: Summary, Expected workflow, timeline, agent index, what worked, deviations, recommendations, references.

**Capture:**

- Checklist in `demo-notes.md` (Scenario 3 section)

**Pass criteria:**

- Template covers the same major sections as archived #28 and #59 reviews
- No unfilled bracket placeholders like `[TODO]` in the template (guidance comments are OK)

### Scenario 4: Self-review output (workflow-review skill simulation)

**Goal:** Produce a real `WORKFLOW-REVIEW.md` for issue #79 and append a RETROSPECTIVES index row — validating the skill's write path end-to-end.

**Steps:**

1. Follow the read list from `.cursor/skills/workflow-review/SKILL.md`:
   - `workflow/issues/issue-79/workflow.state.json`
   - `SPEC.md`, `PLAN.md` (and `PR.md` if present)
   - `demo/demo-spec.md`
   - `workflow/cursor-workflow/RETROSPECTIVES.md`
   - PR #82 checks/comments via `gh pr view 82` (if available)
2. Write `workflow/issues/issue-79/WORKFLOW-REVIEW.md` using the template structure.
3. Append one row to `workflow/cursor-workflow/RETROSPECTIVES.md` index for issue #79 (skip if row already exists).
4. Do **not** change `stage` in `workflow.state.json`.
5. Commit and push both files.

**Capture:**

- `workflow/issues/issue-79/WORKFLOW-REVIEW.md` (the artifact itself)
- `workflow/issues/issue-79/demo/scenario-4-retrospectives-snippet.md` — copy of the new RETROSPECTIVES index row

**Pass criteria:**

- `WORKFLOW-REVIEW.md` has concrete content (not placeholders) covering issue #79's workflow run
- RETROSPECTIVES index row uses commit-SHA or branch link for "Full review" column
- No duplicate #79 row if re-run
- `stage` unchanged in `workflow.state.json`

### Scenario 5: Documentation cross-links

**Goal:** Confirm human invocation is documented in all three entry points.

**Steps:**

1. Grep for `workflow-review` in `AGENTS.md`, `workflow/cursor-workflow/WORKFLOW.md`, `workflow/README.md`.
2. Verify each mentions `@cursoragent workflow-review` and notes human-triggered (not handoff-spawned).

**Capture:**

- Checklist in `demo-notes.md` (Scenario 5 section)

**Pass criteria:**

- `AGENTS.md` skills list includes `workflow-review` (not parenthetical deferral)
- `WORKFLOW.md` optional review section has invocation table
- `workflow/README.md` artifacts table row includes when/how to invoke

## Artifacts checklist

- [ ] `workflow/issues/issue-79/demo/scenario-1-gate-pass.log`
- [ ] `workflow/issues/issue-79/demo/demo-notes.md` with pass/fail table for scenarios 1–5
- [ ] `workflow/issues/issue-79/WORKFLOW-REVIEW.md` (from scenario 4)
- [ ] `workflow/issues/issue-79/demo/scenario-4-retrospectives-snippet.md`
- [ ] No secrets in logs or review document
