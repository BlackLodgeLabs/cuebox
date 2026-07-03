## Related Issue

[Issue #62 — Harden cursor workflow from issue #59 review (state, pass-back, gates)](https://github.com/BlackLodgeLabs/cuebox/issues/62)

Follows workflow review from [issue #59 WORKFLOW-REVIEW.md](../issue-59/WORKFLOW-REVIEW.md) after PR #60.

## Description

**What does this PR do?**

Hardens the Cursor multi-agent issue workflow so `workflow.state.json` survives concurrent agent and GitHub Actions edits, post-`complete` scope changes follow a documented re-open path, demo code defects route back to the **same** execute agent conversation, and babysit cannot finish without recorded gate evidence. This is **workflow scaffolding only** — no Cuebox API or frontend changes.

- **State merge:** New `scripts/cursor-workflow-merge-state.sh` deep-merges local stage edits with `origin/<branch>` so `agents`, `pr`, `loops`, `active_agent_id`, and pass-back fields recorded by Actions are preserved unless intentionally overridden.
- **Progress stages:** All six workflow skills document committing `*-in-progress` before substantive work so the branch file matches GitHub labels.
- **New stages:** `changes-requested` (post-complete re-open with draft PR conversion) and `execute-passback` (demo → same execute agent via `POST /v1/agents/{id}/runs`).
- **Handoff Action:** Updated `.github/workflows/cursor-workflow-handoff.yml` for pass-back runs API, `changes-requested` draft conversion, and label sync.
- **Regression:** Extended `scripts/verify-workflow-paths.sh` plus `scripts/test-cursor-workflow-merge-state.sh` fixture tests.

**Why is this the best approach?**

The merge helper addresses the root cause of audit-trail loss (full state file replacements) without changing the existing forward-handoff model. Pass-back reuses the stored `agents.execute` ID and Cursor's documented `POST /v1/agents/{id}/runs` endpoint instead of minting a new agent, preserving conversation context for code fixes. The two-step `changes-requested` → `execute-ready` path avoids spawning execute before the PR is converted back to draft. Local wins for `stage`/`active_skill`; remote wins for agent IDs and pass-back fields unless local sets non-null overrides — matching how agents and Actions actually edit state.

## Changes Proposed

* **Merge-state helper** (`feat(workflow)`): Add `scripts/cursor-workflow-merge-state.sh` with jq deep-merge semantics; add `scripts/test-cursor-workflow-merge-state.sh` fixture tests for agent preservation and pass-back field handling.
* **Templates** (`chore(workflow)`): Add `passback_to` / `passback_reason` to `workflow/cursor-workflow/templates/workflow.state.json`; require **Seed steps** subsection in `demo-spec.md` template.
* **Skills** (`docs(skills)`): All six workflow skills (`review-and-spec`, `planning`, `execute`, `demo`, `create-pr`, `babysit-pr`) document merge helper call and `*-in-progress` commit rule; demo skill adds pass-back path (no `api/`/`frontend/` edits); babysit requires gate evidence before `complete`.
* **Status sync** (`feat(workflow)`): `cursor-workflow-sync-github-status.sh` handles `changes-requested`, `execute-passback` labels/titles and renders pass-back target/reason in issue status comment.
* **Handoff Action** (`feat(workflow)`): Pass-back via `POST .../runs` when `passback_to` set; `changes-requested` converts linked PR to draft and increments `loops.total_runs`; forward handoffs unchanged.
* **Regression** (`test(workflow)`): Extend `verify-workflow-paths.sh` for state schema validation, skill merge-helper references, and handoff doc checks.
* **Documentation** (`docs(workflow)`): Update `WORKFLOW.md`, `SETUP.md`, and `AGENTS.md` with merge helper, pass-back API, `changes-requested` human path, and new labels.
* **Workflow artifacts**: Spec, plan, demo spec, demo notes, screenshots, and pass-back fixture under `workflow/issues/issue-62/`.

## Scenario Results

Demo run on workflow-only VM (2026-07-02, commit `cd4e7dc`). No Docker stack required. See `workflow/issues/issue-62/demo/demo-notes.md`.

| # | Scenario | Result |
|---|----------|--------|
| 1 — Workflow regression gates pass | **PASS** — `test-cursor-workflow-merge-state.sh` and `verify-workflow-paths.sh` exit 0 |
| 2 — Execute-passback fixture and preserved agent ID | **PASS** — Fixture documents `execute-passback` stage with non-null `agents.execute` |
| 3 — Merge helper preserves remote agents | **PASS** — Remote `agents.execute` preserved when local only updates `stage` |
| 4 — Status comment pass-back rendering | **PASS** — Preview shows Pass-back target and Pass-back reason rows |
| 5 — Skill and doc cross-check | **PASS** — All six skills reference merge helper; `WORKFLOW.md` mentions new stages |

**Workflow regression:** `verify-workflow-paths.sh` exit 0 at `cd4e7dc`

### Scenario 1 — Workflow regression gates

![Scenario 1 gates pass](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-62-harden-cursor-workflow-state-pass-back/workflow/issues/issue-62/demo/scenario-1-gates-pass.png)

### Scenario 2 — Execute-passback fixture

![Scenario 2 passback fixture](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-62-harden-cursor-workflow-state-pass-back/workflow/issues/issue-62/demo/scenario-2-passback-fixture.png)

### Scenario 3 — Merge helper preserves remote agents

![Scenario 3 merge preserve](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-62-harden-cursor-workflow-state-pass-back/workflow/issues/issue-62/demo/scenario-3-merge-preserve.png)

### Scenario 4 — Status comment pass-back rendering

![Scenario 4 status passback](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-62-harden-cursor-workflow-state-pass-back/workflow/issues/issue-62/demo/scenario-4-status-passback.png)

### Scenario 5 — Skill and doc cross-check

![Scenario 5 skill grep](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-62-harden-cursor-workflow-state-pass-back/workflow/issues/issue-62/demo/scenario-5-skill-grep.png)

## How to Test

### Automated (primary — no Docker)

```bash
# Checkout branch
git checkout cursor/issue-62-harden-cursor-workflow-state-pass-back

# Merge-state fixture tests
bash scripts/test-cursor-workflow-merge-state.sh

# Workflow path regression (schema, skills, handoff docs)
bash scripts/verify-workflow-paths.sh

# Confirm all six skills reference merge helper
grep -l cursor-workflow-merge-state.sh .cursor/skills/*/SKILL.md

# Confirm new stages documented
grep -E 'changes-requested|execute-passback' workflow/cursor-workflow/WORKFLOW.md
```

### Manual merge-state check

```bash
# Copy fixture and run merge helper (requires origin branch fetched)
cp workflow/issues/issue-62/demo/fixture-execute-passback-state.json /tmp/test-state.json
bash scripts/cursor-workflow-merge-state.sh /tmp/test-state.json
```

### Status comment preview (no GH_TOKEN)

```bash
bash workflow/issues/issue-62/demo/render-status-preview.sh
```

### Post-merge validation (after this PR merges to `main`)

New handoff behavior (pass-back runs, `changes-requested` draft conversion) loads scripts from `origin/main` and only activates after merge. To validate live:

1. Merge this PR to `main`
2. Push a test state transition on an issue branch with `passback_to` set and populated `agents.execute`
3. Confirm GitHub Actions calls `POST /v1/agents/{id}/runs` (not `POST /v1/agents`) and issue status comment shows pass-back fields

## Known Issues / Notes for Reviewer

* **Handoff activation deferred until merge:** GitHub Actions loads workflow helper scripts from `origin/main`. New pass-back and `changes-requested` behavior does **not** take effect for any issue branch until this PR merges. Issue #62 agents were triggered manually during development; automated handoffs on this branch may not exercise new stages pre-merge.
* **No Cuebox app changes:** No changes under `api/` or `frontend/`. Phase 8 gates are not the primary acceptance gate; workflow regression scripts are.
* **Pass-back 409 `agent_busy`:** Handoff Action logs a warning and skips if the target agent is busy; re-push after the run completes (documented in `SETUP.md`).
* **`changes-requested` two-step path:** First push sets `changes-requested` (PR → draft, `loops.total_runs` incremented); follow-up push with `execute-ready` spawns execute. PR stays draft until babysit finishes again.
* **Demo Scenario 4:** Used local `render-status-preview.sh` dry-run because `GH_TOKEN` was unavailable on the cloud VM; output matches expected status comment markdown.
* **Gate evidence for babysit:** Babysit stage should append `Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>` before setting `complete`.

## Bugbot review (2026-07-03)

| Severity | Finding | Resolution |
|----------|---------|------------|
| **High** | Handoff Action loads `cursor-workflow-merge-state.sh` from `origin/main` only; script does not exist until this PR merges → CI `handoff` job fails on every push | Script loader now falls back to `HEAD` when a script is missing on `main` |
| **Medium** | `pick_local_or_remote` for `loops` let stale local loop counters clobber Action-incremented remote values (agents always commit a full `loops` object) | `merge_loops` now takes per-counter **max** of remote and local |
| **Medium** | `handle_changes_requested` incremented `loops.total_runs` only in `/tmp` — never persisted to branch | New `cursor-workflow-record-loops-on-branch.sh`; handoff calls it before status sync |
| **Low** | Pass-back `409 agent_busy` leaves stage unchanged; re-push with same `execute-passback` stage is skipped by unchanged-stage guard | Documented in SETUP.md; operator must bump `updated_at` or clear/re-set stage to retry |

**Workflow regression:** `verify-workflow-paths.sh` exit 0 and `test-cursor-workflow-merge-state.sh` exit 0 after fixes (pending commit SHA).

## Checklist

- [ ] Acceptance criteria in `workflow/issues/issue-62/SPEC.md` met
- [ ] `bash scripts/test-cursor-workflow-merge-state.sh` passes
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] All six workflow skills reference `cursor-workflow-merge-state.sh`
- [ ] `WORKFLOW.md` / `SETUP.md` / `AGENTS.md` updated
- [ ] Demo screenshots reviewed (no secrets in artifacts)
- [ ] No changes under `api/` or `frontend/`
- [ ] CI green on PR
