# Implementation plan — issue #70

Harden the Cursor multi-agent workflow handoff pipeline: deduplicate agent spawns, enforce an 8-agent global cap with graceful deferral, recover missed babysit handoffs, and prevent stage regression when merging agent side-branches.

**Classification:** Workflow scaffolding only — no Cuebox application (API/frontend/DB) changes. Bug reproduction skipped per planning skill (not an app defect).

## Overview

Issue #28 demonstrated three failure modes in the current handoff Action (`.github/workflows/cursor-workflow-handoff.yml`):

1. **Over-spawning** — inline `handoff()` always calls `POST /v1/agents` on stage transition with no dedup check against `agents.<skill>`.
2. **Quota exhaustion** — API 400 causes `exit 1` (lines 203–218) with no retry or deferral path.
3. **Missed babysit** — when `stage` is already `create-pr-ready`, sync-only pushes exit early (line 354–356) even if `agents.babysit-pr` is null.

Additionally, `cursor-workflow-merge-state.sh` takes local `stage` unconditionally (line 74), allowing side-branch merges to regress `create-pr-ready` → `demo-ready`.

The fix extracts spawn logic into testable shell scripts, adds `handoff_pending` locking and admission gating, implements babysit recovery on sync-only pushes, and enforces monotonic stage ordering in the merge helper.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `scripts/cursor-workflow-stage-rank.sh` | **New** | Shared stage rank map for merge helper and tests |
| `scripts/cursor-workflow-count-active-agents.sh` | **New** | Paginate `GET /v1/agents`; count `ACTIVE` for this repo |
| `scripts/cursor-workflow-admission-gate.sh` | **New** | Dedup, cap, `handoff_pending` checks; stdout `proceed`/`defer`/`skip` |
| `scripts/cursor-workflow-record-handoff-pending.sh` | **New** | Set/clear `handoff_pending` on branch via commit |
| `scripts/cursor-workflow-spawn-agent.sh` | **New** | Admission → lock → POST → record → clear; retry on defer/400 |
| `scripts/cursor-workflow-babysit-recovery.sh` | **New** | Evaluate recovery predicate; call spawn wrapper |
| `scripts/cursor-workflow-post-deferral-comment.sh` | **New** | Post issue comment once per 30m deferral window |
| `scripts/cursor-workflow-merge-state.sh` | **Modify** | Monotonic `stage` via stage-rank; preserve `handoff_pending` merge rules |
| `scripts/test-cursor-workflow-handoff.sh` | **New** | Mocked shell tests (dedup, cap, 400, recovery, pending, stage merge) |
| `scripts/fixtures/cursor-workflow/` | **New** | JSON fixtures for admission/spawn/merge tests |
| `scripts/verify-workflow-paths.sh` | **Modify** | Validate `handoff_pending`, new scripts, docs keywords, skill refs |
| `.github/workflows/cursor-workflow-handoff.yml` | **Modify** | Replace inline `handoff()` spawn with scripts; add babysit recovery path; load new scripts |
| `workflow/cursor-workflow/templates/workflow.state.json` | **Modify** | Add `handoff_pending: null` |
| `workflow/cursor-workflow/templates/PR.md` | **Modify** | Add **Gate evidence** section |
| `workflow/cursor-workflow/WORKFLOW.md` | **Modify** | Document cap, `handoff_pending`, babysit recovery, agent-branch merge |
| `workflow/cursor-workflow/SETUP.md` | **Modify** | Document 8-agent cap, deferral behavior, recovery |
| `AGENTS.md` | **Modify** | Cross-link workflow hardening docs |
| `.cursor/skills/review-and-spec/SKILL.md` | **Modify** | Agent side-branch merge rule + merge helper |
| `.cursor/skills/create-pr/SKILL.md` | **Modify** | Populate Gate evidence line in `PR.md` |
| `.cursor/skills/execute/SKILL.md` | **Modify** | Reinforce `execute-in-progress` before substantive work |
| `.cursor/skills/babysit-pr/SKILL.md` | **Modify** | Reinforce `babysit-in-progress` before substantive work |
| `workflow/issues/issue-70/workflow.state.json` | **Modify** | `plan-ready` handoff |

## Implementation steps

### Step 1 — Stage rank helper

Create `scripts/cursor-workflow-stage-rank.sh`:

- Accepts stage name on stdin or as arg; prints integer rank.
- Rank table per SPEC (0 → 100).
- Export a `stage_higher_rank(a, b)` jq function or bash comparison used by merge helper.

### Step 2 — Monotonic merge helper

Update `scripts/cursor-workflow-merge-state.sh`:

- Import stage rank (source `cursor-workflow-stage-rank.sh` or inline jq map).
- Replace `.stage = ($l.stage // $base.stage)` with `stage_with_higher_rank($base.stage; $l.stage)`.
- Add `handoff_pending` merge: remote non-null fresh lock wins unless local explicitly clears; stale locks (>15m) treated as null.
- Keep existing `agents` non-null-wins and `loops` max rules.

### Step 3 — Active agent count

Create `scripts/cursor-workflow-count-active-agents.sh`:

- Requires `CURSOR_API_KEY`, `GITHUB_REPOSITORY`.
- Paginate `GET /v1/agents?limit=100` via `nextCursor`.
- For each item with `status == "ACTIVE"`, verify latest run targets `github.com/${GITHUB_REPOSITORY}` (same filter as `cursor-workflow-discover-agents.sh` `branch_matches` pattern).
- Print integer count to stdout; exit 0.
- Support `MOCK_CURSOR_API=1` + `MOCK_ACTIVE_AGENT_COUNT` for tests.

### Step 4 — Admission gate

Create `scripts/cursor-workflow-admission-gate.sh`:

```
Usage: cursor-workflow-admission-gate.sh <state-file> <target-skill> [--passback|--reopen]
```

Decision order:

1. If `agents.<skill>` non-null and not pass-back/reopen → stdout `skip:agent-already-recorded`
2. If `handoff_pending` fresh (<15m) for same skill → stdout `defer:pending-lock`
3. If global count ≥ `CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS` (default 8) → stdout `defer:at-cap`
4. Else → stdout `proceed`

Always exit 0. Never exit non-zero for quota/cap.

### Step 5 — Handoff pending recorder

Create `scripts/cursor-workflow-record-handoff-pending.sh`:

- Args: state path, branch, action (`set`|`clear`), optional skill/attempt.
- Commits updated `workflow.state.json` to branch (same pattern as `cursor-workflow-record-agent-on-branch.sh`).
- `set`: `{ skill, started_at, attempt: N }`
- `clear`: `handoff_pending: null`

### Step 6 — Spawn wrapper

Create `scripts/cursor-workflow-spawn-agent.sh`:

1. Parse: issue, branch, state file, skill, prompt, progress_stage.
2. Run admission gate.
3. On `skip` → log, return 0.
4. On `defer` → if attempt < 3, sleep (30s/60s/120s), increment attempt, retry; else post deferral comment and return 0 (no `exit 1`).
5. On `proceed`:
   - Set `handoff_pending` via recorder.
   - `POST /v1/agents` with payload (extract from current YAML `handoff()`).
   - On 2xx → record agent via `cursor-workflow-record-agent-on-branch.sh`, clear pending, sync status.
   - On 400 → log warning, clear stale lock, return defer (not failure).
   - On other errors → try PAT fallback; if exhausted, return 0 with warning.

Support `MOCK_CURSOR_API=1` with fixture responses for tests.

### Step 7 — Babysit recovery

Create `scripts/cursor-workflow-babysit-recovery.sh`:

Predicate (all must be true):

- `stage == "create-pr-ready"`
- `agents.babysit-pr` is null
- `pr` is non-null
- Linked PR `isDraft == true` (`gh pr view`)
- `handoff_pending` null or stale
- Admission gate returns `proceed`

If matched → call spawn wrapper with babysit prompt (same as forward handoff for `create-pr-ready`).

### Step 8 — Refactor handoff Action

Update `.github/workflows/cursor-workflow-handoff.yml`:

- Add new scripts to the load loop (both `handoff` and `resync-status` jobs).
- Replace inline `handoff()` spawn block with calls to `cursor-workflow-spawn-agent.sh`.
- Keep `handle_passback` and `handle_changes_requested` largely unchanged (pass-back uses `POST /v1/agents/{id}/runs`, not subject to forward dedup).
- **After sync-only early path** (state unchanged): call `cursor-workflow-babysit-recovery.sh` before `exit 0`.
- Remove `exit 1` on API failure when spawn wrapper handles deferral.

### Step 9 — Deferral comment helper

Create `scripts/cursor-workflow-post-deferral-comment.sh`:

- Track last comment timestamp in state or use gh issue comments API.
- Post at most one deferral comment per issue per 30 minutes.
- Message: cap reached or API 400; will retry on next push or workflow_dispatch.

### Step 10 — Shell tests

Create `scripts/test-cursor-workflow-handoff.sh` with cases:

| Case | Mock env | Expected |
|------|----------|----------|
| Dedup | `agents.demo` set in fixture state | `skip`, no POST |
| At cap | `MOCK_ACTIVE_AGENT_COUNT=8` | `defer`, no POST |
| API 400 | Mock curl returns 400 | defer, exit 0 |
| Babysit recovery | state `create-pr-ready`, no babysit, draft PR mock | spawn babysit |
| Fresh pending | lock < 15m | skip POST |
| Stage merge | local `demo-ready`, remote `create-pr-ready` | merged `create-pr-ready` |

Invoke from `verify-workflow-paths.sh` at end (or as sub-check).

### Step 11 — Template and skill updates

- Add `handoff_pending: null` to `workflow/cursor-workflow/templates/workflow.state.json`.
- Add Gate evidence section to `workflow/cursor-workflow/templates/PR.md`.
- Update `create-pr` skill: populate gate line from execute gate run SHA.
- Update `review-and-spec` skill: before merging `*-agent-*` side branch, run merge helper.
- Reinforce `*-in-progress` commit rule in execute/babysit skills where gaps remain.

### Step 12 — Documentation

Update `WORKFLOW.md`:

- `handoff_pending` schema and semantics
- 8-agent cap and deferral (not fatal Action)
- Babysit recovery predicate
- Stage monotonicity in merge helper
- Agent side-branch merge rule

Update `SETUP.md`:

- Cap constant and env override
- What happens at cap (deferral comment, retry)
- Babysit recovery self-heal behavior

Add cross-link in `AGENTS.md` Cursor workflow section.

### Step 13 — Verify and handoff

- Run `bash scripts/verify-workflow-paths.sh` (must pass).
- Run `bash scripts/test-cursor-workflow-handoff.sh` (must pass).
- Set `workflow.state.json` → `plan-ready`; push.

## Tests required

| Test | Maps to acceptance criterion |
|------|------------------------------|
| `test-cursor-workflow-handoff.sh` dedup case | §1 skip when `agents.<skill>` set |
| `test-cursor-workflow-handoff.sh` pending lock case | §1 `handoff_pending` blocks duplicate |
| `test-cursor-workflow-handoff.sh` babysit recovery case | §1 babysit recovery on sync-only push |
| `test-cursor-workflow-handoff.sh` at-cap case | §2 global 8-agent cap defers |
| `test-cursor-workflow-handoff.sh` API 400 case | §2 400 is defer not fatal |
| `test-cursor-workflow-handoff.sh` stage merge case | §3 monotonic stage in merge helper |
| `verify-workflow-paths.sh` extended checks | §Validation script/skill/doc coverage |
| Manual: spawn wrapper with `MOCK_CURSOR_API=1` | §2 PAT fallback path documented |

No Cuebox API/frontend tests required (workflow-only scope).

## Gate script

```bash
bash scripts/verify-workflow-paths.sh
```

This is the primary gate for workflow-only issues. No phase gate scripts (3–8) apply.

Record in `PR.md` Gate evidence: `Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>`.

## Documentation updates

- `workflow/cursor-workflow/WORKFLOW.md` — cap, pending lock, recovery, stage rank
- `workflow/cursor-workflow/SETUP.md` — operator setup for cap/deferral
- `AGENTS.md` — cross-link to WORKFLOW.md hardening section
- `workflow/cursor-workflow/templates/PR.md` — Gate evidence section
- `workflow/cursor-workflow/templates/workflow.state.json` — `handoff_pending`

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| New scripts not loaded until merge to `main` | Document deployment note; test locally with `SCRIPTS_DIR=./scripts` |
| Stale `handoff_pending` blocks spawn | 15-minute timeout clears lock automatically |
| Babysit recovery spawns duplicate on race | `handoff_pending` + dedup against `agents.babysit-pr` |
| Stage rank too aggressive | Rank table matches SPEC; test merge fixtures |
| Active count API slow | Paginate with limit=100; cache not needed for handoff frequency |

**Rollback:** Revert PR; handoff Action falls back to pre-#70 inline spawn (no dedup/recovery but functional).

## Definition of done

- [ ] All acceptance criteria in `SPEC.md` satisfied
- [ ] `scripts/test-cursor-workflow-handoff.sh` passes locally and in CI
- [ ] `bash scripts/verify-workflow-paths.sh` exit 0
- [ ] `handoff_pending` in state template; merge helper enforces monotonic stage
- [ ] Handoff Action uses spawn wrapper; babysit recovery runs on sync-only pushes
- [ ] Skills and PR template include gate evidence guidance
- [ ] WORKFLOW.md and SETUP.md document cap, deferral, recovery
- [ ] No Cuebox application code changes
- [ ] `workflow.state.json` → `plan-ready` committed and pushed
