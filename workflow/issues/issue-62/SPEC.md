# Issue #62: Harden cursor workflow from issue #59 review (state, pass-back, gates)

## Summary

Harden the Cursor multi-agent issue workflow so `workflow.state.json` is merge-safe and auditable, post-`complete` changes follow a documented stage path, demo failures route code fixes back to the **same** execute agent conversation, and babysit cannot mark a PR ready without recorded gate evidence. This is **workflow scaffolding only** — no Cuebox application (API/frontend) changes.

The work addresses gaps documented in [issue #59 WORKFLOW-REVIEW.md](../issue-59/WORKFLOW-REVIEW.md) after PR #60.

## Problem

Issue #59 completed the feature pipeline but exposed systemic workflow failures:

1. **State clobbering** — Agents committed full `workflow.state.json` replacements, wiping `agents.*`, `pr`, and `active_agent_id` recorded by GitHub Actions. The issue status comment lost hyperlinked audit trails (Planning/Execute/Demo/Create PR showed "—").
2. **Progress stages missing from commits** — GitHub labels briefly showed `cursor:execute-in-progress` but the branch file stayed at `plan-ready` during code commits, making the branch file unreliable for debugging.
3. **Post-`complete` scope creep** — Human PR feedback (pagination, Bugbot) committed production code while `stage` was `complete`, skipped execute, re-ran demo→create-pr→babysit, and left labels/PR draft state inconsistent.
4. **Demo non-determinism** — Conditional scenarios (`review_required`, `failed`) were SKIP on re-demo because seed steps were not required in the demo-spec template.
5. **Premature babysit exit** — PR marked ready before Bugbot fixes landed; no gate-run evidence line in artifacts.
6. **No agent pass-back** — Every handoff mints a new cloud agent (`POST /v1/agents`) instead of continuing the execute conversation when demo finds a code defect.

Without these fixes, the next feature issue repeats wasted agent cycles, broken audit trails, and silent production edits outside formal stages.

## Acceptance criteria

### State merge and preservation

- [ ] `scripts/cursor-workflow-merge-state.sh` exists: fetches `origin/<branch>` version of `workflow.state.json`, deep-merges with local edits, and preserves remote `agents`, `pr`, `loops`, `active_agent_id`, and `passback_to` / `passback_reason` unless the agent intentionally overwrites them.
- [ ] Every workflow skill (`review-and-spec`, `planning`, `execute`, `demo`, `create-pr`, `babysit-pr`) documents and demonstrates calling the merge helper **before** committing `workflow.state.json`.
- [ ] Template `workflow/cursor-workflow/templates/workflow.state.json` includes `passback_to` and `passback_reason` (nullable).

### Progress stages in committed state

- [ ] Each skill commits the matching `*-in-progress` stage **before** substantive work:
  - `execute-in-progress` before first `api/` / `frontend/` commit
  - `create-pr-in-progress` before editing `PR.md`
  - Same pattern for `plan-in-progress`, `demo-in-progress`, `babysit-in-progress`, `spec-in-progress`
- [ ] `WORKFLOW.md` lists new terminal/handoff stages (below) and reiterates the in-progress commit rule.

### Post-`complete` changes (`changes-requested`)

- [ ] New stage **`changes-requested`**: entered when human scope is added after `complete` (human sets via documented path — issue comment, PR comment with workflow trigger, or `workflow_dispatch` resync after manual state edit).
- [ ] Handoff Action on transition **to** `changes-requested` (from `complete` or any stage): converts linked PR to **draft**, increments `loops.total_runs`, syncs label `cursor:changes-requested`.
- [ ] Handoff Action on transition **from** `changes-requested` **to** `execute-ready` (or direct handoff): spawns **execute** agent (not demo-only), sets `execute-in-progress`.
- [ ] Documented human path: after `complete`, new requirements → update SPEC/PLAN if needed → set `changes-requested` → execute → demo → create-pr → babysit → `complete` again.

### Agent pass-back (`execute-passback`)

- [ ] New stage **`execute-passback`**: set by demo (or babysit when appropriate) when a **code defect** is found; requires `passback_to: "execute"` and non-empty `passback_reason`.
- [ ] Demo skill **forbids** editing `api/` or `frontend/` on pass-back; must write structured failure notes to `workflow/issues/issue-{NNN}/demo/demo-notes.md` (section: `## Pass-back to execute`).
- [ ] Handoff Action: when `passback_to` is set and `agents[passback_to]` is non-null, call `POST /v1/agents/{id}/runs` with prompt referencing `passback_reason` and `demo-notes.md`; **do not** call `POST /v1/agents`.
- [ ] After pass-back run completes, execute agent sets `execute-ready` (clears `passback_to` / `passback_reason` via merge helper); normal forward handoff to demo resumes.
- [ ] `cursor-workflow-sync-github-status.sh` renders `passback_to` / `passback_reason` in the issue status comment when set.

### Demo-spec reproducibility

- [ ] `workflow/cursor-workflow/templates/demo-spec.md` requires an explicit **Seed steps** subsection under Preconditions for any scenario that depends on non-default DB state (`review_required`, `failed`, empty watchlist, etc.).
- [ ] Planning skill checklist references the updated template.

### Babysit gate evidence

- [ ] Babysit skill requires a **gate evidence** line in `PR.md` or `demo/demo-notes.md` before setting `complete`, e.g. `Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>` (for workflow-only issues) or `Phase 8 gate exit 0 at <short-sha>` (for feature issues).
- [ ] Babysit must not mark PR ready for review until Bugbot/CI are clean **and** gate evidence is present.

### Regression and docs

- [ ] `scripts/verify-workflow-paths.sh` extended to:
  - Validate issue `workflow.state.json` files against required keys (`agents`, `loops`, optional `passback_to` / `passback_reason`)
  - Assert all six skills mention `cursor-workflow-merge-state.sh`
  - Assert handoff workflow references pass-back / `changes-requested` stages (after Action update)
- [ ] `WORKFLOW.md` and `SETUP.md` document merge helper, `changes-requested`, `execute-passback`, pass-back API (`POST /v1/agents/{id}/runs`), and agent ID preservation.
- [ ] `AGENTS.md` cross-links workflow hardening docs (one line under Cursor issue workflow).

### Demonstration

- [ ] Dry-run on branch `cursor/issue-62-harden-cursor-workflow-state-pass-back`: commit a sample `workflow.state.json` fragment or doc showing `execute-passback` with populated `agents.execute` and verify status-comment rendering **or** update `workflow/issues/issue-59/workflow.state.json` on a throwaway commit on this branch to show preserved agent links (no app code).

## Scope

### In scope

- `scripts/cursor-workflow-merge-state.sh` (new)
- Updates to existing `scripts/cursor-workflow-*.sh` as needed (especially `sync-github-status`, handoff consumer in Action)
- `.github/workflows/cursor-workflow-handoff.yml` — pass-back branch, `changes-requested`, draft-PR conversion, `POST .../runs`
- Skills: `.cursor/skills/{review-and-spec,planning,execute,demo,create-pr,babysit-pr}/SKILL.md`
- Templates: `workflow/cursor-workflow/templates/{workflow.state.json,demo-spec.md}`
- Docs: `workflow/cursor-workflow/{WORKFLOW.md,SETUP.md}`, `AGENTS.md` cross-link
- `scripts/verify-workflow-paths.sh` extensions
- New GitHub label `cursor:changes-requested` documented in `WORKFLOW.md` (label created in repo by human or Action doc)

### Out of scope

- Cuebox application features (API, frontend, Postgres schema)
- Cursor product API changes (we adapt to documented `POST /v1/agents/{id}/runs`)
- Retroactive repair of PR #60 feature code or issue #59 branch state on `main`
- Bugbot/GitHub Actions CI configuration beyond babysit exit documentation
- Enabling new handoff behavior on **other** open issue branches until this work merges to `main` (Actions load scripts from `main`; see note below)

### Deployment note (meta)

GitHub Actions loads workflow helper scripts from **`origin/main`** on every push. New pass-back and `changes-requested` behavior **does not take effect for any issue branch until this PR merges to `main`**. Until then, agents on issue #62 must be triggered manually; do not assume automated handoffs exercise new stages pre-merge.

## User flows / API changes

**No Cuebox user-facing UI or public API changes.**

### Issue author / reviewer

| Flow | Behavior |
|------|----------|
| Normal pipeline | Issue status comment lists hyperlinked agent conversations per stage; no "—" gaps after a standard run |
| Post-`complete` feedback | Labels: `cursor:complete` → `cursor:changes-requested` → `cursor:execute-in-progress` → … → `cursor:complete`; PR returns to **draft** until babysit finishes again |
| Pass-back visibility | Status comment shows pass-back target skill, reason, and link to execute agent conversation |

### Cloud agents

| Flow | Behavior |
|------|----------|
| Any state commit | Run `bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json` (or documented equivalent), then apply stage edits, then commit |
| Execute start | Commit `execute-in-progress` before first code commit |
| Demo code defect | Update `demo-notes.md` pass-back section; set `stage: execute-passback`, `passback_to: execute`, `passback_reason: <summary>`; push — **no** `api/` / `frontend/` edits |
| Babysit finish | Append gate evidence line; set `complete` only when CI/Bugbot clean |

### GitHub Actions (handoff workflow)

| Trigger | Behavior |
|---------|----------|
| `stage` → `changes-requested` | Sync labels; convert PR to draft; increment `loops.total_runs`; do **not** spawn agent until human/agent sets `execute-ready` or Action documents auto-transition to `execute-ready` on same push |
| `stage` → `execute-ready` from `changes-requested` | Spawn execute (new agent or existing per forward rules) |
| `passback_to` set + `agents[passback_to]` present | `POST https://api.cursor.com/v1/agents/{id}/runs` with prompt citing `passback_reason` and demo notes |
| Forward handoffs unchanged | `spec-ready` … `create-pr-ready` still use `POST /v1/agents` when no pass-back |

**Recommended `changes-requested` transition:** single push sets `changes-requested` with a companion field or immediate follow-up commit setting `execute-ready` after merge helper runs — **plan stage must choose one** and document in `PLAN.md`. Default proposal: one push sets `changes-requested`; human or spec agent sets `execute-ready` in next commit to avoid spawning execute before PR is draft.

### Cursor Cloud API

- **Create agent (forward):** `POST /v1/agents` — unchanged for spec→plan→execute→demo→create-pr→babysit forward handoffs.
- **Continue agent (pass-back):** `POST /v1/agents/{agent_id}/runs` — when `passback_to` references a skill with stored ID.

## Data and integration notes

### `workflow.state.json` schema (additive)

| Field | Type | Purpose |
|-------|------|---------|
| `passback_to` | `string \| null` | Skill key to receive pass-back (`execute`, optionally `babysit-pr` later) |
| `passback_reason` | `string \| null` | Short summary for handoff prompt and status comment |
| `stage` | enum | Add `changes-requested`, `execute-passback` |

Existing fields (`issue`, `branch`, `pr`, `stage`, `active_skill`, `active_agent_id`, `agents`, `loops`, `updated_at`) unchanged in meaning.

### Stage taxonomy (updated)

| Category | Stages |
|----------|--------|
| Handoff (spawn next agent forward) | `spec-ready`, `plan-ready`, `execute-ready`, `demo-ready`, `create-pr-ready` |
| Pass-back handoff | `execute-passback` (with `passback_to`) |
| Re-open handoff | `changes-requested` → `execute-ready` |
| Progress | `spec-in-progress`, `plan-in-progress`, `execute-in-progress`, `demo-in-progress`, `create-pr-in-progress`, `babysit-in-progress` |
| Terminal | `complete`, `blocked`, `spec-needs-info` |

### `cursor-workflow-merge-state.sh` (proposed contract)

```bash
# Usage: cursor-workflow-merge-state.sh <path-to-workflow.state.json>
# 1. Read local file
# 2. git fetch origin <branch from local file>
# 3. If remote file exists, jq-merge: preserve agents, pr, loops, active_agent_id from remote unless local explicitly sets non-null overrides for agents keys being updated
# 4. Write merged result back to path (or stdout — plan decides)
# 5. Exit non-zero if branch missing or JSON invalid
```

Plan stage should specify exact merge semantics (especially whether local `stage` always wins).

### Labels (new)

| Label | Stage |
|-------|-------|
| `cursor:changes-requested` | `changes-requested` |
| `cursor:execute-passback` | `execute-passback` (optional; or map to `cursor:execute-in-progress` during pass-back — plan chooses) |

### Testing approach (this issue)

- **Primary regression:** `bash scripts/verify-workflow-paths.sh` (extended) — **not** Phase 8 gates (no app code).
- Shell tests for merge-state: fixture remote/local JSON pairs → assert preserved `agents.execute` when local only updates `stage`.
- Optional: workflow_dispatch resync on issue #62 branch after merge to `main` to validate status comment.

### Reference implementation targets

| Area | Files |
|------|-------|
| Handoff | `.github/workflows/cursor-workflow-handoff.yml` |
| Status sync | `scripts/cursor-workflow-sync-github-status.sh` |
| Prior art | `workflow/issues/issue-59/WORKFLOW-REVIEW.md` recommendations 1–5 |
| Cursor API | https://cursor.com/docs/cloud-agent/api/endpoints |

## Open questions (must be empty before plan-ready)

_None — defaults above (stage names, merge helper, verify-workflow-paths regression, post-merge handoff activation) are sufficient for planning._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/62
- Workflow review (source): [workflow/issues/issue-59/WORKFLOW-REVIEW.md](../issue-59/WORKFLOW-REVIEW.md)
- Prior workflow run: [workflow/issues/issue-45/](../issue-45/)
- Workflow docs: [workflow/cursor-workflow/WORKFLOW.md](../../cursor-workflow/WORKFLOW.md), [SETUP.md](../../cursor-workflow/SETUP.md)
- Cursor API (pass-back): https://cursor.com/docs/cloud-agent/api/endpoints
