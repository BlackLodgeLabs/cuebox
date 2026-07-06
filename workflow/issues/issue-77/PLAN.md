# Issue #77 — Implementation Plan

## Overview

Reduce **cursor-workflow-handoff** GitHub Actions run time from 2–10+ minutes to well under 2 minutes for sync-only pushes by eliminating redundant Cursor API scans, duplicate status syncs, and cascading git push round-trips during handoff spawns. This is **workflow scaffolding only** — no Cuebox application changes.

The work builds on [#70 / PR #71](https://github.com/BlackLodgeLabs/cuebox/pull/71) (dedup, cap, babysit recovery) and [#76](https://github.com/BlackLodgeLabs/cuebox/pull/76) (`includeArchived=false`, stage-rank fixes). Execute implements eight priority areas (P1–P8) from the spec in a single cohesive pass, with shell tests guarding each optimization.

## Classification

**Workflow / infrastructure** — not a bug in the shipped Cuebox app. Bug reproduction skipped per planning skill.

## Root cause (from spec + code review)

| Bottleneck | Location | Impact |
|------------|----------|--------|
| Unconditional discovery | `cursor-workflow-handoff.yml` L281–287 | Full agent list pagination + redundant `GET /agents/{id}` per candidate on every push |
| Duplicate agent list scans | `discover-agents.sh` + `count-active-agents.sh` | Two independent paginated `GET /v1/agents` passes per job |
| Cascading state pushes | `record-handoff-pending.sh` (set) → `record-agent-on-branch.sh` → `record-handoff-pending.sh` (clear) | Up to 3 extra workflow runs per handoff spawn |
| Duplicate status sync | YAML L288 + L132 (spec-ready) + spawn post-success | Each sync paginates all issue comments |
| Repeated cap count on retry | `admission-gate.sh` L53 calls `count-active-agents.sh` each loop iteration | 3× full scan on deferred spawn |
| Heavy job setup | `fetch-depth: 0`, unconditional `apt-get`, duplicated inline script loaders | Baseline latency on every run |
| Comment pagination | `sync-github-status.sh` L232–234 | Full comment list fetch every sync |

## Implementation approach

Execute in dependency order: shared infrastructure first (cache helper, load-scripts, skip predicates), then consumers (discover, count, spawn, sync), then YAML consolidation, then tests and docs.

### Design decisions (planning resolves spec options)

1. **Batched spawn writes** — New `cursor-workflow-record-spawn-on-branch.sh` replaces separate `record-agent-on-branch.sh` + `record-handoff-pending.sh clear` calls on the success path. Single commit includes `agents.<skill>`, `active_agent_id`, `active_skill`, `handoff_pending: null`, optional `status_comment_id`, and `updated_at`.

2. **In-job pending lock** — `handoff_pending` set before `POST` uses env var `CURSOR_WORKFLOW_PENDING_SKILL` (job-scoped) instead of a branch push. `admission-gate.sh` checks this env var in addition to state file, preserving [#70](https://github.com/BlackLodgeLabs/cuebox/issues/70) dedup within the same job. Cross-run dedup still relies on `agents.<skill>` recorded on branch after successful spawn.

3. **Shared agents list cache** — New `cursor-workflow-fetch-agents-list.sh` writes paginated list JSON to `$RUNNER_TEMP/cursor-agents-list.json` (or `CURSOR_AGENTS_LIST_CACHE`). `count-active-agents.sh` and `discover-agents.sh` read from cache when present.

4. **Discovery skip** — New `cursor-workflow-should-discover-agents.sh` encapsulates predicate; both push and resync jobs call it before discovery.

5. **Status sync dedup** — `sync-github-status.sh` sets `CURSOR_WORKFLOW_SYNCED=1` on success; callers skip when set unless `HANDOFF_*` overrides require a refresh. Remove redundant `spec-ready` sync at YAML L132.

6. **Cap count cache** — `admission-gate.sh` caches first `count-active-agents` result in `CURSOR_WORKFLOW_IN_FLIGHT_COUNT` for job lifetime (document 60s effective TTL via job scope).

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `scripts/cursor-workflow-fetch-agents-list.sh` | **New** | Single paginated agents list per job (P2) |
| `scripts/cursor-workflow-should-discover-agents.sh` | **New** | Shared skip predicate for push + resync (P1) |
| `scripts/cursor-workflow-record-spawn-on-branch.sh` | **New** | Batched post-spawn state write (P3) |
| `scripts/cursor-workflow-discover-agents.sh` | Modify | Skip predicate, `prUrl` filter, `latestRunId` from list item (P1) |
| `scripts/cursor-workflow-count-active-agents.sh` | Modify | Use shared list cache (P2) |
| `scripts/cursor-workflow-admission-gate.sh` | Modify | In-job pending env check, cached cap count (P6) |
| `scripts/cursor-workflow-spawn-agent.sh` | Modify | In-job pending, batched record, deduped sync (P3, P4, P6) |
| `scripts/cursor-workflow-sync-github-status.sh` | Modify | `status_comment_id` PATCH, sync dedup flag (P4, P8) |
| `scripts/cursor-workflow-load-scripts.sh` | Modify | Full handoff script list minus merge/stage-rank (P5) |
| `.github/workflows/cursor-workflow-handoff.yml` | Modify | Shallow checkout, guarded apt, load-scripts, skip discovery, remove duplicate sync (P1, P4, P5, P7) |
| `workflow/cursor-workflow/templates/workflow.state.json` | Modify | Add `status_comment_id: null` (P8) |
| `scripts/verify-workflow-paths.sh` | Modify | Document `status_comment_id` optional key; require new scripts |
| `scripts/test-cursor-workflow-handoff.sh` | Modify | New test cases per spec table |
| `scripts/fixtures/cursor-workflow/` | Add fixtures | Skip-discovery, batched-write, comment-cache states |
| `workflow/cursor-workflow/WORKFLOW.md` | Modify | Skip/cache rules, timing targets, `status_comment_id` |
| `AGENTS.md` | Modify (optional) | Brief cross-link to performance optimizations |

## Implementation steps

### Step 1 — Shared infrastructure

1. Add `cursor-workflow-fetch-agents-list.sh`:
   - If `CURSOR_AGENTS_LIST_CACHE` file exists and is non-empty, exit 0 (already cached).
   - Paginate `GET /v1/agents?limit=100&includeArchived=false`; write full merged JSON to cache path.
   - Export path via stdout or env for callers.
   - Support `MOCK_CURSOR_API=1` with fixture file `MOCK_AGENTS_LIST_JSON`.

2. Add `cursor-workflow-should-discover-agents.sh`:
   - Input: state file path.
   - Exit 0 (skip) when:
     - `agents.review-and-spec` set AND (`agents.review-and-spec-continued` set OR not needed — same as current discover early-exit), **OR**
     - `stage_rank(stage) >= stage_rank("plan-in-progress")` via `cursor-workflow-stage-rank.sh`.
   - Exit 1 (run discovery) otherwise.
   - No API calls; safe for tests.

3. Extend `cursor-workflow-load-scripts.sh`:
   - Add handoff-only scripts: `count-active-agents`, `admission-gate`, `record-handoff-pending`, `spawn-agent`, `babysit-recovery`, `post-deferral-comment`, `fetch-agents-list`, `should-discover-agents`, `record-spawn-on-branch`, `stage-rank` (needed by should-discover at runtime on main).
   - **Exclude** `merge-state` and `stage-rank` from handoff YAML load list per P5 — but `should-discover-agents.sh` sources `stage-rank.sh` from the loaded bundle.
   - Accept optional second arg for script set: `handoff` (default) vs `agent` (current smaller set).

### Step 2 — P1 discovery efficiency

1. Refactor `cursor-workflow-discover-agents.sh`:
   - Call `should-discover-agents.sh` at top; exit 0 if skip.
   - Use `fetch-agents-list.sh` instead of inline pagination.
   - When `pr` is set in state, append `prUrl=https://github.com/{owner}/{repo}/pull/{pr}` to list URL (first page only if API supports; else filter client-side).
   - `branch_matches`: use list item `latestRunId` directly — remove `GET /v1/agents/{id}`.
   - Keep `includeArchived=false` on all list calls.

### Step 3 — P2 shared list in count-active-agents

1. Refactor `cursor-workflow-count-active-agents.sh`:
   - Call `fetch-agents-list.sh` first.
   - Read items from cache file; for each ACTIVE item with `latestRunId`, call run endpoint (unchanged cap semantics).
   - Mock mode unchanged.

### Step 4 — P3 batched spawn writes

1. Add `cursor-workflow-record-spawn-on-branch.sh`:
   - Args: `<state-file> <agent-key> <agent-id> <branch> [status-comment-id]`
   - Single fetch/checkout/commit/push updating: `agents.<key>`, `active_agent_id`, `active_skill`, `handoff_pending: null`, optional `status_comment_id`, `updated_at`.
   - Idempotent if agent already recorded with same ID.

2. Refactor `cursor-workflow-spawn-agent.sh`:
   - On `proceed`: set `CURSOR_WORKFLOW_PENDING_SKILL=$SKILL` env instead of pushing pending set (unless `CURSOR_WORKFLOW_PENDING_DRY_RUN=1` — keep local jq for tests).
   - On successful POST: call `record-spawn-on-branch.sh` instead of separate agent + pending clear.
   - Post-spawn sync: skip if `CURSOR_WORKFLOW_SYNCED=1` and `HANDOFF_*` overrides already applied in prior sync.

3. Refactor `cursor-workflow-admission-gate.sh`:
   - Check `CURSOR_WORKFLOW_PENDING_SKILL` env matches target skill → `defer:pending-lock`.
   - Cache `CURSOR_WORKFLOW_IN_FLIGHT_COUNT` on first cap check.

### Step 5 — P4/P8 status sync

1. Refactor `cursor-workflow-sync-github-status.sh`:
   - If `CURSOR_WORKFLOW_SYNCED=1` and no `HANDOFF_PROGRESS_STAGE` override → exit 0 early (log "sync skipped — already synced this job").
   - Read `status_comment_id` from state; if set, `PATCH /issues/comments/{id}`; on 404, fall back to paginated search, create if missing.
   - On create or successful PATCH with new ID, return ID via stdout or write to temp for caller to include in batched push.
   - Export `CURSOR_WORKFLOW_SYNCED=1` and `CURSOR_WORKFLOW_STATUS_COMMENT_ID` on success.

2. Wire comment ID persistence:
   - `record-spawn-on-branch.sh` accepts optional comment ID from env `CURSOR_WORKFLOW_STATUS_COMMENT_ID`.
   - Discovery backfill push remains separate (acceptable per spec).

### Step 6 — P5/P7 workflow YAML

1. Replace inline script loader in both jobs with:
   ```bash
   SCRIPTS_DIR=$(bash scripts/cursor-workflow-load-scripts.sh /tmp/cursor-workflow-scripts handoff)
   ```
   Load from checkout HEAD (shallow) with `git fetch origin main` inside load-scripts.

2. `handoff` job checkout: `fetch-depth: 2`.

3. Install step:
   ```bash
   command -v jq >/dev/null || sudo apt-get install -y jq
   command -v gh >/dev/null || sudo apt-get install -y gh
   ```

4. Push job discovery block:
   ```bash
   if [ -n "${CURSOR_API_KEY:-}" ] && ! "$WF/cursor-workflow-should-discover-agents.sh" /tmp/workflow.state.json; then
     "$WF/cursor-workflow-discover-agents.sh" ...
   fi
   ```

5. Remove duplicate sync in `handoff()` spec-ready case (YAML L132).

6. Resync job:
   - Add `discover` input default `false`.
   - Skip discovery unless `discover=true` AND `should-discover-agents` returns run.

### Step 7 — Schema and verification

1. Add `"status_comment_id": null` to `workflow/cursor-workflow/templates/workflow.state.json`.

2. Update `scripts/verify-workflow-paths.sh`:
   - Add `status_comment_id` to `OPTIONAL_STATE_KEYS`.
   - Require new scripts exist and are executable.
   - Add WORKFLOW.md keywords: `status_comment_id`, `CURSOR_AGENTS_LIST_CACHE`, `skip discovery`.

### Step 8 — Tests

Extend `scripts/test-cursor-workflow-handoff.sh` with cases from spec:

| Test | Fixture / mock | Assertion |
|------|----------------|-----------|
| `test_skip_discovery_plan_in_progress` | stage `plan-in-progress`, spec agent set | `should-discover` exits 0; discover makes 0 curl calls with `MOCK_CURSOR_API=1` |
| `test_discovery_runs_spec_ready` | stage `spec-ready`, no `review-and-spec` | `should-discover` exits 1 |
| `test_shared_list_cache` | two count calls | mock counter shows 1 list fetch |
| `test_batched_spawn_writes` | `CURSOR_WORKFLOW_PENDING_DRY_RUN=1` + mock git push counter | single logical update with agent + pending null |
| `test_no_duplicate_sync` | env `CURSOR_WORKFLOW_SYNC_CALL_COUNT` | at most 1 sync per handoff fixture path |
| `test_comment_id_cache` | `status_comment_id` in state | sync uses PATCH mock, not list |

Add fixtures under `scripts/fixtures/cursor-workflow/` as needed.

### Step 9 — Documentation

1. Update `workflow/cursor-workflow/WORKFLOW.md`:
   - New section: **Performance optimizations (issue #77)** covering skip-discovery predicate, shared list cache env vars, batched spawn push, status comment ID, sync dedup, cap count cache, expected run-time targets.
   - Document resync `--discover` input.
   - Document shallow checkout (`fetch-depth: 2`) and fallback to `fetch-depth: 0` if `git show BEFORE_SHA:path` fails.

2. Optional `AGENTS.md` one-liner under workflow section.

## Tests required

| Acceptance criterion | Test |
|---------------------|------|
| P1 conditional discovery | `test_skip_discovery_*`, `test_discovery_runs_spec_ready` |
| P1 discovery API efficiency | Unit test: `branch_matches` uses list item only (mock list fixture with `latestRunId`) |
| P2 shared agent list | `test_shared_list_cache` |
| P3 batched writes | `test_batched_spawn_writes` |
| P4 deduped sync | `test_no_duplicate_sync` |
| P5 load-scripts | `verify-workflow-paths.sh` script existence; manual YAML review |
| P6 cap cache | Test: 3 admission-gate calls → 1 list fetch (mock counter) |
| P7 shallow checkout | CI workflow lint; document fallback |
| P8 comment ID | `test_comment_id_cache` |
| Resync no discovery | Fixture: resync path with `discover=false` skips API |
| Validation | `verify-workflow-paths.sh` + existing handoff tests green |

**Gate script:** `bash scripts/verify-workflow-paths.sh` (includes `test-cursor-workflow-handoff.sh` and `test-cursor-workflow-record-agent.sh`).

No Phase 3–8 gates — no application code changes.

## Documentation updates

- `workflow/cursor-workflow/WORKFLOW.md` — required (skip/cache rules, timing targets)
- `workflow/cursor-workflow/templates/workflow.state.json` — `status_comment_id`
- `scripts/verify-workflow-paths.sh` — optional key + new script checks
- `AGENTS.md` — optional cross-link

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| In-job pending lock misses cross-run dedup | `agents.<skill>` on branch still blocks re-spawn via admission gate; pending push was optimization not sole guard |
| Shallow checkout breaks `BEFORE_SHA` diff | `fetch-depth: 2`; fallback fetch single commit if miss |
| Stale `status_comment_id` after manual comment delete | PATCH 404 → fallback search + persist new ID |
| `prUrl` filter not supported by Cursor API | Client-side filter on cached list |
| Batched push race with concurrent agent state commit | Existing merge-state on agent side; record script fetches latest before write |

**Rollback:** Revert PR; workflow falls back to slower but proven #70/#76 behavior.

## Definition of done

- [ ] All P1–P8 acceptance criteria in SPEC.md satisfied
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` passes (including new cases)
- [ ] `workflow/cursor-workflow/WORKFLOW.md` documents skip/cache rules and timing targets
- [ ] Template includes `status_comment_id`
- [ ] Handoff YAML uses `load-scripts.sh`, shallow checkout, guarded apt
- [ ] Demo captures before/after timing notes for sync-only, handoff spawn, deferred spawn
- [ ] No Cuebox API/frontend/DB changes
- [ ] Draft PR #78 updated via execute commits (no new PR)
