# Implementation plan — Issue #62: Harden cursor workflow (state, pass-back, gates)

## Overview

Harden the Cursor multi-agent issue workflow so `workflow.state.json` survives concurrent agent and GitHub Actions edits, post-`complete` scope changes follow a documented re-open path, demo code defects route back to the **same** execute agent conversation via `POST /v1/agents/{id}/runs`, and babysit cannot finish without recorded gate evidence. This is **workflow scaffolding only** — no Cuebox API or frontend changes.

The approach has four pillars:

1. **`cursor-workflow-merge-state.sh`** — before any agent commits state, deep-merge local stage edits with `origin/<branch>` so `agents`, `pr`, `loops`, `active_agent_id`, and pass-back fields recorded by Actions are preserved.
2. **Committed progress stages** — every skill pushes its `*-in-progress` stage before substantive work so the branch file matches GitHub labels.
3. **New stages** — `changes-requested` (post-complete re-open) and `execute-passback` (demo → same execute agent); handoff Action updated for draft-PR conversion, pass-back runs API, and label sync.
4. **Regression** — extend `verify-workflow-paths.sh` plus fixture tests for merge-state; demo validates scripts and status-comment rendering (no app stack required).

### Design decisions (from SPEC defaults)

| Topic | Choice |
|-------|--------|
| Merge semantics | Local wins for `stage`, `active_skill`, `updated_at`. Remote wins for `agents`, `pr`, `loops`, `active_agent_id`, `passback_to`, `passback_reason` unless local sets a **non-null** override for that field/key. |
| `changes-requested` handoff | **Two-step:** first push sets `changes-requested` only (Action converts PR to draft, increments `loops.total_runs`, does **not** spawn execute). Human or agent sets `execute-ready` in a **follow-up** push to spawn execute. |
| `execute-passback` label | Dedicated `cursor:execute-passback` (not aliased to `execute-in-progress`) for audit visibility. |
| Pass-back target | `passback_to: "execute"` only in v1; babysit pass-back deferred. |
| Handoff activation | New Action behavior loads from `main` after merge; issue #62 agents may need manual triggers until then (document in PR.md). |

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `scripts/cursor-workflow-merge-state.sh` | **Add** | Core merge helper; called by all skills before state commits |
| `scripts/test-cursor-workflow-merge-state.sh` | **Add** | Fixture tests for merge preservation semantics |
| `scripts/verify-workflow-paths.sh` | **Modify** | Schema validation, skill merge-helper references, handoff doc checks |
| `scripts/cursor-workflow-sync-github-status.sh` | **Modify** | `changes-requested`, `execute-passback` labels/titles; pass-back lines in status comment |
| `.github/workflows/cursor-workflow-handoff.yml` | **Modify** | Pass-back (`POST .../runs`), `changes-requested`, draft conversion, script list includes merge-state |
| `workflow/cursor-workflow/templates/workflow.state.json` | **Modify** | Add `passback_to`, `passback_reason` |
| `workflow/cursor-workflow/templates/demo-spec.md` | **Modify** | Require **Seed steps** subsection under Preconditions |
| `workflow/cursor-workflow/WORKFLOW.md` | **Modify** | New stages, merge helper, in-progress commit rule, pass-back API, labels |
| `workflow/cursor-workflow/SETUP.md` | **Modify** | Merge helper usage, new labels, post-complete path, pass-back |
| `AGENTS.md` | **Modify** | One-line cross-link to workflow hardening docs |
| `.cursor/skills/review-and-spec/SKILL.md` | **Modify** | Merge helper + `spec-in-progress` commit rule |
| `.cursor/skills/planning/SKILL.md` | **Modify** | Merge helper + `plan-in-progress`; demo-spec seed checklist |
| `.cursor/skills/execute/SKILL.md` | **Modify** | Merge helper; pass-back resume path; clear passback fields on `execute-ready` |
| `.cursor/skills/demo/SKILL.md` | **Modify** | Pass-back flow; forbid `api/`/`frontend/` edits on pass-back |
| `.cursor/skills/create-pr/SKILL.md` | **Modify** | Merge helper + `create-pr-in-progress` |
| `.cursor/skills/babysit-pr/SKILL.md` | **Modify** | Gate evidence requirement; merge helper |
| `workflow/issues/issue-62/demo/demo-spec.md` | **Add** | Demo scenarios for this issue (planning output) |
| `workflow/issues/issue-62/workflow.state.json` | **Modify** | Stage → `plan-ready` |

## Implementation steps

### Step 1 — Merge-state helper (`scripts/cursor-workflow-merge-state.sh`)

1. Usage: `bash scripts/cursor-workflow-merge-state.sh <path-to-workflow.state.json>`
2. Read local JSON; validate `branch` field present.
3. `git fetch origin "<branch>"` (quiet; tolerate missing remote in local-only dev with warning).
4. If `origin/<branch>:<same path>` exists, read remote JSON; else treat remote as `{}`.
5. **jq merge** (write back to same path):
   - Start from remote object.
   - Overlay local `stage`, `active_skill`, `updated_at` (local always wins when present).
   - `agents`: for each key in `(remote.agents // {}) + (local.agents // {})`, keep remote value if local value is `null` or missing; else use local (allows intentional ID updates).
   - `pr`, `loops`, `active_agent_id`, `passback_to`, `passback_reason`: use local if non-null; else remote.
   - Preserve `issue`, `branch` from local (agent's source of truth).
6. Exit non-zero on invalid JSON, missing path, or jq failure.

**Commit:** `feat(workflow): add cursor-workflow-merge-state.sh`

### Step 2 — Merge-state tests (`scripts/test-cursor-workflow-merge-state.sh`)

Fixture pairs (temp dirs + mocked `git show` via env `MERGE_STATE_REMOTE_JSON` or inline heredocs):

| Case | Assert |
|------|--------|
| Local updates `stage` only | Remote `agents.execute` preserved |
| Local sets `agents.planning` to new ID | New ID wins |
| Local `passback_to: null` | Remote `passback_to: "execute"` preserved |
| Local `passback_to: "execute"` + reason | Local wins |
| Invalid JSON | Exit non-zero |

**Commit:** `test(workflow): add merge-state fixture tests`

### Step 3 — Template and schema baseline

1. Add `passback_to: null`, `passback_reason: null` to `workflow/cursor-workflow/templates/workflow.state.json`.
2. Update `workflow/cursor-workflow/templates/demo-spec.md`:
   - Under **Preconditions**, add **Seed steps** subsection with placeholder and note: "Required when any scenario depends on non-default DB state (`review_required`, `failed`, empty watchlist, etc.)."

**Commit:** `chore(workflow): extend state template and demo-spec seed steps`

### Step 4 — Skill updates (all six + planning checklist)

For **each** skill (`review-and-spec`, `planning`, `execute`, `demo`, `create-pr`, `babysit-pr`):

1. Add **State merge (required)** section before any state commit:
   ```bash
   bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
   ```
2. Reiterate **Start — update state**: commit matching `*-in-progress` **before** substantive work (spec/plan/execute/demo/create-pr/babysit).

Skill-specific additions:

| Skill | Extra |
|-------|-------|
| `planning` | Checklist item: demo-spec includes **Seed steps** when scenarios need non-default DB |
| `execute` | On pass-back resume: read `demo/demo-notes.md` § Pass-back; clear `passback_to`/`passback_reason` when setting `execute-ready` |
| `demo` | **Pass-back path:** if code defect, write `## Pass-back to execute` in `demo-notes.md`; set `stage: execute-passback`, `passback_to: execute`, `passback_reason: <summary>`; **no** `api/` or `frontend/` edits |
| `babysit-pr` | Before `complete`: append gate evidence line to `PR.md` or `demo/demo-notes.md`; do not mark PR ready without it |

**Commit:** `docs(skills): require merge-state helper and in-progress commits`

### Step 5 — Status sync script

Update `scripts/cursor-workflow-sync-github-status.sh`:

1. `stage_label` / `stage_title` for `changes-requested`, `execute-passback`.
2. Add labels to `CURSOR_LABELS` array.
3. When `passback_to` or `passback_reason` non-null, add rows to status comment body:
   - **Pass-back target:** `passback_to`
   - **Pass-back reason:** `passback_reason`
   - Link to `agents[passback_to]` when present.

**Commit:** `feat(workflow): sync pass-back and new stages in status comment`

### Step 6 — Handoff Action (`.github/workflows/cursor-workflow-handoff.yml`)

1. Add `cursor-workflow-merge-state.sh` to script load list (for future use in Action if needed; primarily agent-side).
2. Extend `is_handoff_stage` / `is_skip_stage`:
   - Handoff: keep existing five; add `execute-ready` when **previous** stage was `changes-requested` (spawn execute).
   - Skip (sync only): `changes-requested`, `execute-passback` (pass-back handled separately).
3. **`changes-requested` transition** (when `prev_stage` was `complete` or any stage → `changes-requested`):
   - `gh pr ready --undo` or `gh api` to convert linked PR to **draft**
   - Increment `loops.total_runs` in state on branch via `cursor-workflow-record-*` or inline jq + push (prefer recording script pattern)
   - Sync labels; **do not** spawn agent
4. **`execute-passback` / pass-back handler** (when `passback_to` set and `agents[passback_to]` non-null):
   - Build prompt citing `passback_reason`, `demo-notes.md`, execute skill
   - `POST https://api.cursor.com/v1/agents/{id}/runs` with `{ "prompt": { "text": "..." } }`
   - **Do not** call `POST /v1/agents`
   - Set `HANDOFF_PROGRESS_STAGE=execute-in-progress`, `HANDOFF_ACTIVE_SKILL=execute`
   - On 409 `agent_busy`, log warning and skip (document retry via re-push)
5. Forward handoffs unchanged when no pass-back.

**Commit:** `feat(workflow): handoff pass-back runs and changes-requested draft conversion`

### Step 7 — Extend `verify-workflow-paths.sh`

Add checks after existing legacy-path scan:

1. **State schema:** for each `workflow/issues/issue-*/workflow.state.json` on branch, assert keys: `issue`, `branch`, `stage`, `agents`, `loops`; optional `passback_to`, `passback_reason` allowed.
2. **Skills:** all six skills under `.cursor/skills/*/SKILL.md` (workflow skills only) contain string `cursor-workflow-merge-state.sh`.
3. **Handoff docs:** `WORKFLOW.md` mentions `changes-requested`, `execute-passback`, and `cursor-workflow-merge-state.sh`.
4. **Handoff workflow:** `.github/workflows/cursor-workflow-handoff.yml` references `runs` (pass-back) and `changes-requested`.

**Commit:** `test(workflow): extend verify-workflow-paths regression`

### Step 8 — Documentation

1. **`WORKFLOW.md`:** stage taxonomy table (handoff, pass-back, re-open, progress, terminal); merge helper section; in-progress commit rule; `changes-requested` human path; pass-back API; new label `cursor:changes-requested`, `cursor:execute-passback`; deployment note (scripts from `main`).
2. **`SETUP.md`:** merge helper one-liner; label creation rows; post-complete flow diagram; pass-back overview.
3. **`AGENTS.md`:** under Cursor issue workflow, link to `workflow/cursor-workflow/WORKFLOW.md#state-merge` (or section anchor).

**Commit:** `docs(workflow): document merge helper, pass-back, and changes-requested`

### Step 9 — Dry-run demonstration artifact

Per acceptance criterion: on this branch, add either:

- `workflow/issues/issue-62/demo/fixture-execute-passback-state.json` — sample state with `stage: execute-passback`, populated `agents.execute`, `passback_to`, `passback_reason`; plus a short note in `demo-notes.md` from demo agent, **or**
- A throwaway commit updating a copy under `workflow/issues/issue-62/demo/` showing preserved agent links.

Execute does **not** need to run full GitHub status sync locally; demo agent runs `cursor-workflow-sync-github-status.sh` in dry-run mode if `GH_TOKEN` unavailable, or documents expected comment markdown in `demo-notes.md`.

**Commit:** (demo agent — Step 9 artifact committed during demo stage)

## Tests required

| Acceptance criterion | Test / verification |
|---------------------|---------------------|
| `cursor-workflow-merge-state.sh` exists with preservation semantics | `scripts/test-cursor-workflow-merge-state.sh` |
| All six skills document merge helper | `verify-workflow-paths.sh` grep check |
| Template includes `passback_to` / `passback_reason` | `verify-workflow-paths.sh` schema + file read |
| Skills commit `*-in-progress` before work | Skill doc review; `verify-workflow-paths.sh` optional grep for `in-progress` in Start sections |
| `changes-requested` stage + draft PR + label | Handoff yml contains logic; **Demo Scenario 3** documents expected Action behavior (post-merge) |
| `changes-requested` → `execute-ready` spawns execute | Handoff yml case branch; WORKFLOW.md documents two-step path |
| `execute-passback` + `passback_to` + `passback_reason` | Demo Scenario 2 fixture; handoff yml `runs` endpoint |
| Demo forbids app edits on pass-back | `demo/SKILL.md` text; demo pass-back scenario is notes-only |
| Pass-back uses `POST .../runs` not `POST /v1/agents` | Handoff yml grep; WORKFLOW.md |
| Execute clears passback on `execute-ready` | `execute/SKILL.md`; merge test for null preservation |
| Status comment renders pass-back fields | **Demo Scenario 4:** run sync script against fixture state (or capture expected markdown in `demo-notes.md`) |
| Demo-spec **Seed steps** template | Template file + planning skill checklist |
| Babysit gate evidence before `complete` | `babysit-pr/SKILL.md`; **Demo Scenario 1** runs `verify-workflow-paths.sh` and records SHA |
| `verify-workflow-paths.sh` extensions | **Demo Scenario 1** + execute runs script |
| WORKFLOW.md / SETUP.md / AGENTS.md | Doc review; `verify-workflow-paths.sh` keyword checks |
| Dry-run pass-back demonstration | **Demo Scenario 2** fixture + notes |

**Not required:** Phase 8 gates (no app code). API CI / Frontend CI still run on PR but are not the primary acceptance gate for this issue.

## Gate script

Before push (execute and babysit):

```bash
bash scripts/test-cursor-workflow-merge-state.sh
bash scripts/verify-workflow-paths.sh
```

Optional quick sanity (no Docker):

```bash
bash scripts/verify-workflow-paths.sh
git grep -l cursor-workflow-merge-state.sh .cursor/skills/
```

**Do not** require `verify-phase8-gates.sh` unless unrelated files are touched.

## Documentation updates

| File | Update |
|------|--------|
| `workflow/cursor-workflow/WORKFLOW.md` | Stage taxonomy, merge helper, pass-back, `changes-requested`, labels |
| `workflow/cursor-workflow/SETUP.md` | Setup steps for new labels and post-complete path |
| `AGENTS.md` | Cross-link to workflow hardening |
| `workflow/cursor-workflow/templates/demo-spec.md` | Seed steps subsection |
| `workflow/cursor-workflow/templates/workflow.state.json` | Pass-back fields |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Merge helper hides intentional agent ID wipe | Local non-null `agents` keys still override; document in WORKFLOW.md |
| Pass-back 409 `agent_busy` | Log warning; re-push after run completes; document in SETUP.md |
| New Action behavior inactive until merge to `main` | SPEC deployment note; PR.md calls out manual triggers for issue #62 |
| `changes-requested` without follow-up `execute-ready` | PR stays draft; label shows `cursor:changes-requested` — human sets next stage |
| jq/git fetch fails in cloud VM | Merge script exits non-zero; agent must not commit state until resolved |

**Rollback:** Revert PR; workflow falls back to pre-#62 behavior. No DB or app impact.

## Definition of done

- [ ] `scripts/cursor-workflow-merge-state.sh` implemented and tested
- [ ] `scripts/test-cursor-workflow-merge-state.sh` passes
- [ ] `scripts/verify-workflow-paths.sh` passes with new checks
- [ ] All six workflow skills reference merge helper and in-progress commit rule
- [ ] Demo skill documents pass-back; babysit documents gate evidence
- [ ] Templates updated (`workflow.state.json`, `demo-spec.md`)
- [ ] `cursor-workflow-sync-github-status.sh` handles new stages and pass-back display
- [ ] `cursor-workflow-handoff.yml` implements pass-back runs, `changes-requested`, draft conversion
- [ ] `WORKFLOW.md`, `SETUP.md`, `AGENTS.md` updated
- [ ] Demo artifacts committed per `demo-spec.md`
- [ ] `workflow.state.json` → `execute-ready` (execute stage)
- [ ] No changes under `api/` or `frontend/` (except if babysit fixes unrelated CI — should not apply here)
