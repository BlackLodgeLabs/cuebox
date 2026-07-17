# Issue #127 — Implementation plan

**Tier:** workflow

## Overview

Harden the v1 Cursor workflow orchestrator so one issue run completes without manual nudges. This plan builds on companion fixes (#84, #90, #91, #109, #111, #117, #118, #119) and addresses remaining gaps: duplicate same-skill spawns from concurrent handoff runs and side-branch pushes, optimistic `*-in-progress` labels before spawn confirmation, stalled recovery when in-job backoff exhausts, and optional late-stage context reuse.

Implementation is confined to `scripts/cursor-workflow-*`, `.github/workflows/cursor-workflow-*`, `workflow/cursor-workflow/*`, and `.cursor/skills/*` notes — no `api/` or `frontend/` changes.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `scripts/cursor-workflow-admission-gate.sh` | Extend | Per-issue same-skill in-flight dedup via agents list; preserve existing `handoff_pending` and at-cap gates |
| `scripts/cursor-workflow-count-in-flight-for-issue.sh` | **New** | Query cached agents list for RUNNING/CREATING runs matching repo + `cursor/issue-{N}-` branch prefix + target skill |
| `scripts/cursor-workflow-spawn-agent.sh` | Modify | Gate label sync; `skip:duplicate-handoff`; deferred marker write; optional late-stage resume (`POST /runs`) |
| `scripts/cursor-workflow-handoff-recovery.sh` | Modify | Early `skip:duplicate-handoff`; shared gate path only (no bypass) |
| `scripts/cursor-workflow-sync-github-status.sh` | Modify | Honest labels: ignore `HANDOFF_PROGRESS_STAGE` unless `CURSOR_WORKFLOW_SPAWN_CONFIRMED=1` or state already `*-in-progress` |
| `scripts/cursor-workflow-record-deferred-handoff.sh` | **New** | Persist/clear `handoff_deferred` on branch when in-job backoff exhausts |
| `scripts/cursor-workflow-clear-deferred-handoff.sh` | **New** | Clear `handoff_deferred` on successful spawn (called from record-spawn) |
| `scripts/cursor-workflow-resume-agent-run.sh` | **New** | `POST /v1/agents/{id}/runs` for late-stage resume (extract from passback pattern) |
| `scripts/cursor-workflow-config.sh` | Extend | Export `WORKFLOW_LATE_STAGE_RESUME`, `WORKFLOW_PER_ISSUE_SPAWN_SERIALIZATION` |
| `workflow/cursor-workflow/workflow.config.yaml` | Extend | `orchestration.late_stage_resume`, `orchestration.per_issue_spawn_serialization` |
| `.github/workflows/cursor-workflow-handoff.yml` | Modify | Canonical branch guard; skip label sync + spawn on side-branch refs |
| `.github/workflows/cursor-workflow-retry-deferred.yml` | **New** | Scheduled/dispatch scan for `handoff_deferred` + handoff-ready labels → recovery |
| `scripts/cursor-workflow-load-scripts.sh` | Extend | Bundle new scripts for Actions `/tmp` load |
| `scripts/test-cursor-workflow-handoff.sh` | Extend | All new acceptance cases (mocked) |
| `scripts/cursor-workflow-housekeeping.sh` | Minor | Report `handoff_deferred` count in drift output |
| `workflow/cursor-workflow/STATE-SCHEMA.md` | Extend | Document `handoff_deferred` optional field |
| `workflow/cursor-workflow/WORKFLOW.md` | Extend | Canonical guard, label honesty, deferred re-queue, late-stage resume, single-push babysit |
| `workflow/cursor-workflow/SETUP.md` | Extend | Human fallback template; deferred retry workflow |
| `workflow/cursor-workflow/OPERATIONS.md` | **New** | Operator checklist: runs vs ACTIVE workspaces, pre-flight, resync vs `@cursoragent` |
| `.cursor/skills/{demo,create-pr,babysit-pr}/SKILL.md` | Minor | Single-push finalize for babysit; late-stage resume note when config enabled |

## Implementation steps

### Step 1 — Config and schema (commit 1)

1. Add to `workflow.config.yaml`:
   ```yaml
   orchestration:
     late_stage_resume: false
     per_issue_spawn_serialization: true
   ```
2. Export via `cursor-workflow-config.sh` as `WORKFLOW_LATE_STAGE_RESUME` and `WORKFLOW_PER_ISSUE_SPAWN_SERIALIZATION`.
3. Document `handoff_deferred` in `STATE-SCHEMA.md`:
   ```json
   "handoff_deferred": { "skill": "demo", "reason": "at-cap", "at": "2026-07-17T10:00:00Z" }
   ```
4. Update `workflow/cursor-workflow/templates/workflow.state.json` if template lacks `schema_version`.

### Step 2 — Per-issue same-skill serialization (commit 2)

1. Create `cursor-workflow-count-in-flight-for-issue.sh`:
   - Input: issue number, target skill, optional branch prefix override.
   - Reuse `cursor-workflow-fetch-agents-list.sh` cache.
   - For each ACTIVE agent with latest run RUNNING/CREATING targeting `github.com/{repo}`:
     - Match branch ref starting with `cursor/issue-{N}-` (from agent metadata / run git branches).
     - Match skill via agent display name suffix (`Demo Agent`, etc.) or branch name containing skill slug.
   - Return count to stdout; exit 0.
2. In `cursor-workflow-admission-gate.sh`, when `WORKFLOW_PER_ISSUE_SPAWN_SERIALIZATION=true` and not `--passback`/`--reopen`:
   - Read `issue` from state file.
   - If in-flight count ≥ 1 for same issue + skill → `defer:same-skill-in-flight` (or `skip:` when peer already recorded on branch tip — existing path).
3. Preserve existing `handoff_pending` cross-skill defer when fresh lock held by different skill.

### Step 3 — Canonical branch guard (commit 3)

1. In `cursor-workflow-handoff.yml` push job, after parsing `BRANCH` from `GITHUB_REF`:
   ```bash
   canonical=$(jq -r '.branch // empty' /tmp/workflow.state.json)
   if [ "$BRANCH" != "$canonical" ]; then
     echo "Skipping — push ref ${BRANCH} ≠ canonical ${canonical} (side-branch or agent workspace)"
     exit 0
   fi
   ```
2. Early exit **before** `sync-github-status` and recovery/spawn — side-branch pushes must not change labels or spawn.
3. Parse issue number from `canonical` branch (not push ref) when they differ is unreachable after guard; keep existing sed on push ref for the guard case only.

### Step 4 — Honest labels (commit 4)

1. Remove unconditional `sync_after_spawn` pre-confirmation label override in `cursor-workflow-spawn-agent.sh`:
   - Call `sync-github-status` **only after** `record-spawn-on-branch.sh` succeeds.
   - Set `CURSOR_WORKFLOW_SPAWN_CONFIRMED=1` for that post-spawn sync.
2. In `cursor-workflow-sync-github-status.sh`:
   - Apply `HANDOFF_PROGRESS_STAGE` override **only when** `CURSOR_WORKFLOW_SPAWN_CONFIRMED=1` **or** `STAGE` already ends with `-in-progress` (agent-committed progress).
   - Otherwise `DISPLAY_STAGE` = state file `stage` (honest `*-ready` during defer).
3. Update `cursor-workflow-passback-run.sh` to set `CURSOR_WORKFLOW_SPAWN_CONFIRMED=1` when pass-back run starts (pass-back is confirmed progress).
4. Remove or gate any `HANDOFF_PROGRESS_STAGE` injection on defer paths — failed/deferred spawn must not advance labels.

### Step 5 — Duplicate handoff skip (commit 5)

1. In `cursor-workflow-handoff-recovery.sh` and handoff YAML `handoff()`:
   - After `--agents-from-tip` refetch, if `agents.<target_skill>` is non-null → log `skip:duplicate-handoff` and exit 0 (no POST).
2. When `state_changed=false` and stage is handoff value with `agents.<target>` set → same skip (recovery must not POST again).
3. Distinguish from `skip:agent-already-recorded` in admission gate — recovery layer logs `skip:duplicate-handoff` for operator clarity.

### Step 6 — Idempotent resume hardening (commit 6)

1. Ensure recovery always runs admission gate + refetch + pending-lock via `spawn-agent.sh` (already true — verify no direct POST bypass).
2. When `agents.<skill>` is null at tip but POST succeeded and `record-spawn-on-branch.sh` failed (`MOCK_RECORD_SPAWN_FAIL` path):
   - Recovery re-attempts spawn; admission gate `proceed` → POST or peer first-wins skip.
3. Add test: skill-complete `*-ready` without `agents.*` → recovery spawns exactly once.

### Step 7 — Durable deferred re-queue (commit 7)

1. Create `cursor-workflow-record-deferred-handoff.sh`:
   - On backoff exhaust (`defer:at-cap`, `defer:pending-lock`, `api-400`), jq-write `handoff_deferred` to branch state.
2. Clear marker in `record-spawn-on-branch.sh` on successful agent record.
3. Add `.github/workflows/cursor-workflow-retry-deferred.yml`:
   - `schedule: cron` (e.g. `*/15 * * * *`) + `workflow_dispatch`.
   - List open issues with labels `cursor:spec-ready` … `cursor:create-pr-ready`.
   - For each, fetch canonical branch state; if `handoff_deferred` set → run recovery (respects cap).
4. Document human fallback in `SETUP.md`:
   > `@cursoragent use <skill> skill for issue NNN` or Actions → Cursor workflow handoff → resync.

### Step 8 — Late-stage context reuse (commit 8)

1. Create `cursor-workflow-resume-agent-run.sh` (mirror `passback-run.sh`):
   - `POST /v1/agents/{prior_id}/runs` with new prompt.
   - Handle 409 busy → defer (same as pass-back).
2. In `spawn-agent.sh`, when `WORKFLOW_LATE_STAGE_RESUME=true`:
   - `demo-ready` → create-pr: if `agents.demo` set, resume instead of `POST /v1/agents`.
   - `create-pr-ready` → babysit-pr: if `agents.create-pr` set, resume instead.
   - Record run metadata on `agents.<skill>` if API returns new run id.
3. Default `late_stage_resume: false` — opt-in only.
4. Note in `create-pr` and `babysit-pr` skills: when resume enabled, expect faster context carry-over.

### Step 9 — Operator docs and babysit single-push (commit 9)

1. Create `workflow/cursor-workflow/OPERATIONS.md`:
   - Runs (RUNNING/CREATING) vs ACTIVE workspaces ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70)).
   - Pre-flight: `< 8` in-flight runs; housekeeping sweep; optional orphan ACTIVE cleanup in Cursor dashboard.
   - `cursor-workflow-list-agents.ps1` (Windows) + Linux equivalent (`gh` + API or script).
   - When to use `workflow_dispatch` resync vs `@cursoragent` comment.
2. Extend `babysit-pr` skill with single batched `create-pr-ready` push pattern (mirror demo/create-pr #119).
3. Update `WORKFLOW.md`: canonical guard, label honesty, deferred re-queue, late-stage resume, OPERATIONS cross-link.
4. Optional: housekeeping drift report includes deferred-handoff count.

### Step 10 — Tests and regression (commit 10)

Run and fix until green:

```bash
bash scripts/test-cursor-workflow-handoff.sh
bash scripts/verify-workflow-paths.sh
bash scripts/verify-workflow-portable.sh
```

## Tests required

| Acceptance criterion | Test |
|---------------------|------|
| AC1: Same-skill in-flight blocks spawn | `test_same_skill_in_flight_defer` — mock agents list with RUNNING run on same issue branch + skill → `defer:same-skill-in-flight` |
| AC1: Fresh `handoff_pending` different skill preserved | Extend `test_fresh_pending` — different skill still defers |
| AC1: Canonical-only handoff | `test_canonical_branch_guard` — push ref `cursor/issue-127-pr-130-plan-agent-*` vs canonical → early exit, no sync/spawn |
| AC1: Side-branch ignored | `test_side_branch_push_ignored` — YAML/logic unit test via shell helper simulating `BRANCH ≠ canonical` |
| AC2: `skip:duplicate-handoff` | `test_duplicate_handoff_skip` — recovery with `agents.demo` set at tip → log contains `skip:duplicate-handoff`, no POST |
| AC2: `verify-workflow-paths.sh` | Existing gate — must pass unchanged |
| AC3: Recovery spawns when `agents.*` null | `test_recovery_spawns_once_without_agent` — `*-ready` + empty agents → exactly one POST |
| AC3: Peer-recorded id → skip | Existing `test_recovery_remote_agent_skip` — no regression |
| AC4: Defer without spawn → honest labels | `test_defer_honest_labels` — spawn defers at cap; sync shows `demo-ready` not `demo-in-progress` |
| AC4: Confirmed spawn → in-progress label | `test_confirmed_spawn_progress_label` — after record-spawn, sync shows `demo-in-progress` |
| AC5: `handoff_deferred` persisted | `test_deferred_marker_written` — backoff exhaust writes marker; cleared on spawn |
| AC5: Retry workflow script | `test_retry_deferred_recovery` — state with marker → recovery invoked (mocked) |
| AC6: Resume vs new agent | `test_late_stage_resume_runs` / `test_late_stage_new_agent_default` — `MOCK_CURSOR_API=1`, assert `/runs` vs `/agents` URL |
| AC7: OPERATIONS.md exists | `verify-workflow-paths.sh` doc registration |
| AC8: All handoff tests | `test-cursor-workflow-handoff.sh` full suite |
| AC8: Portable semantics | `verify-workflow-portable.sh` — new optional field allowed |

## Gate script

```bash
bash scripts/verify-workflow-paths.sh
bash scripts/test-cursor-workflow-handoff.sh
bash scripts/verify-workflow-portable.sh
```

Primary regression gate: `$WORKFLOW_REGRESSION_GATE` (`scripts/verify-workflow-paths.sh`). Handoff and portable gates are required per SPEC AC8.

## Documentation updates

| File | Content |
|------|---------|
| `workflow/cursor-workflow/WORKFLOW.md` | Canonical branch guard; label honesty; deferred re-queue; late-stage resume; babysit single-push |
| `workflow/cursor-workflow/STATE-SCHEMA.md` | `handoff_deferred` field |
| `workflow/cursor-workflow/SETUP.md` | Deferred retry workflow; human fallback template |
| `workflow/cursor-workflow/OPERATIONS.md` | New operator checklist |
| `workflow/cursor-workflow/workflow.config.yaml` | New orchestration keys |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Same-skill dedup false positive blocks legitimate spawn | Match on branch prefix + skill slug; allow `--reopen`/`--passback` bypass; config flag `per_issue_spawn_serialization` |
| Canonical guard blocks legitimate pushes | Only skip when `GITHUB_REF` ≠ `state.branch`; agent side-branches must merge to canonical before handoff |
| Removing pre-spawn label sync delays visible progress | Post-spawn sync still sets `*-in-progress`; agents may commit `*-in-progress` in state for earlier signal |
| Late-stage resume carries stale context | Default off; opt-in via config; 409 busy defers like pass-back |
| Scheduled retry spawns at cap | Retry job runs same admission gate; defers again and keeps marker |
| **Rollback** | Revert PR; set `per_issue_spawn_serialization: false` and `late_stage_resume: false`; manual `workflow_dispatch` resync for stuck issues |

## Definition of done

- [ ] All SPEC acceptance criteria (§1–8) implemented
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` — all cases pass (including new)
- [ ] `bash scripts/verify-workflow-paths.sh` — exit 0
- [ ] `bash scripts/verify-workflow-portable.sh` — exit 0
- [ ] `WORKFLOW.md`, `STATE-SCHEMA.md`, `SETUP.md`, `OPERATIONS.md` updated
- [ ] `workflow.config.yaml` keys documented and exported
- [ ] No changes under `api/` or `frontend/`
- [ ] Demo agent can run `demo-spec.md` scenarios on VM
- [ ] Draft PR #130 receives execute commits only (no new PR)

## PR seed

**Tier:** workflow
**What / why:** Close remaining v1 orchestration reliability gaps (duplicate spawns, dishonest labels, stalled deferred handoffs) before Callsheet extraction (#122).
**Key changes:** Per-issue same-skill serialization; canonical-branch guard; honest label sync; `skip:duplicate-handoff`; durable `handoff_deferred` + scheduled retry; optional late-stage resume; `OPERATIONS.md` checklist.
**Gate:** `verify-workflow-paths.sh` + `test-cursor-workflow-handoff.sh` + `verify-workflow-portable.sh` exit 0 at `<short-sha>`
**How to test:** `bash scripts/test-cursor-workflow-handoff.sh`; mock canonical vs side-branch guard; verify defer leaves `*-ready` label; optional `MOCK_CURSOR_API=1` resume path.
