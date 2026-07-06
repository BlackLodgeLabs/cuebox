# Issue #77: Optimize cursor-workflow-handoff Actions performance

## Summary

Reduce **cursor-workflow-handoff** GitHub Actions run time from the current **2–10+ minutes** (highly variable) to well under **2 minutes** for sync-only pushes, by eliminating redundant Cursor API scans, duplicate status syncs, and cascading git push round-trips during handoff spawns. Builds on [#70 / PR #71](https://github.com/BlackLodgeLabs/cuebox/pull/71) (dedup, cap, babysit recovery) and [#76](https://github.com/BlackLodgeLabs/cuebox/pull/76) (`includeArchived=false`, stage-rank fixes).

This is **workflow scaffolding only** — no Cuebox application (API/frontend/DB) changes.

## Problem

Issue #72 and recent handoff runs showed most Action time is spent on overhead, not the actual `POST /v1/agents` spawn:

1. **Unconditional agent discovery** — `cursor-workflow-discover-agents.sh` runs on every push when `CURSOR_API_KEY` is set, even after `plan-in-progress` when handoff stages already record agent IDs. Discovery paginates all agents and performs a redundant `GET /v1/agents/{id}` per candidate before branch matching.
2. **Duplicate full agent list scans** — Discovery and `cursor-workflow-count-active-agents.sh` each independently paginate `GET /v1/agents?includeArchived=false` in the same job.
3. **Cascading git pushes per spawn** — `handoff_pending` set, agent ID record, and `handoff_pending` clear each trigger separate fetch/checkout/commit/push cycles (up to **3** extra workflow runs per handoff).
4. **Duplicate status sync** — `cursor-workflow-sync-github-status.sh` runs at the start of every job, again inside `spec-ready` handoff (`ensure_pr` path), and again after spawn — each sync paginates all issue comments to find the status marker.
5. **Repeated cap counting on deferral** — `cursor-workflow-spawn-agent.sh` re-runs the full active-agent scan on every admission-gate retry within one job.
6. **Heavy Actions setup** — `fetch-depth: 0`, unconditional `apt-get install jq gh`, and duplicated inline script loaders add baseline latency.

Users see long gaps between agent stage commits and the next agent starting; resync (`workflow_dispatch`) is slower than necessary because it always runs discovery.

## Acceptance criteria

### P1 — Conditional agent discovery

- [ ] `cursor-workflow-discover-agents.sh` is **skipped** when:
  - `agents.review-and-spec` is already set **and** `agents.review-and-spec-continued` is set or not needed (same predicate as today, extended with stage check below), **or**
  - `stage` rank is **≥ `plan-in-progress`** (25) — handoff-recorded agents do not need API backfill for spec links.
- [ ] When discovery **does** run (early spec stages, missing `review-and-spec` link), pass `prUrl` query filter to `GET /v1/agents` when `state.pr` is known: `https://github.com/{owner}/{repo}/pull/{pr}`.
- [ ] Skip logic is callable from both the push job and resync job; resync defaults to **no discovery** (labels/comment sync only).

### P1 — Discovery API efficiency

- [ ] `branch_matches` uses list-item `latestRunId` directly — **no** redundant `GET /v1/agents/{id}` before `GET /v1/agents/{id}/runs/{latestRunId}`.
- [ ] Discovery still uses `includeArchived=false` on all list calls.

### P2 — Shared agent list scan

- [ ] New helper (e.g. `cursor-workflow-fetch-agents-list.sh` or env-backed cache in existing scripts) performs **one** paginated `GET /v1/agents?includeArchived=false` pass per Actions job.
- [ ] Discovery (when run) and `cursor-workflow-count-active-agents.sh` / admission gate reuse the cached JSON (file under `$RUNNER_TEMP` or exported path), not independent full scans.
- [ ] Cache is job-scoped (not persisted across workflow runs).

### P3 — Batched git state writes

- [ ] `handoff_pending` set, agent ID record, and `handoff_pending` clear are combined into **one** branch commit/push per successful spawn (or equivalent single GitHub API contents update).
- [ ] A single push must not re-trigger redundant handoff evaluation for intermediate states (only the final merged state matters).
- [ ] Discovery backfill (when it runs) remains a separate push — acceptable; batched writes apply to spawn path only.

### P4 — Deduped status sync

- [ ] `cursor-workflow-sync-github-status.sh` is not called redundantly in the same job when content would be unchanged:
  - Remove duplicate sync in `spec-ready` handoff path (main flow already synced at job start), **or**
  - Skip post-spawn sync when main flow synced within the same job and `HANDOFF_*` overrides are already reflected.
- [ ] Pass-back and PAT-fallback paths still sync when they are the only status update in that code path.

### P5 — Trim Actions script loader

- [ ] Remove `cursor-workflow-merge-state.sh` and `cursor-workflow-stage-rank.sh` from the handoff workflow script load list (agent-skill / test-only).
- [ ] Adopt `scripts/cursor-workflow-load-scripts.sh` (extended with handoff-only script list) in both `handoff` and `resync-status` jobs to replace duplicated inline loader blocks.
- [ ] `cursor-workflow-load-scripts.sh` includes all scripts required by handoff/spawn/admission (today's full set minus merge/stage-rank).

### P6 — Cache cap count in spawn retry loop

- [ ] `cursor-workflow-spawn-agent.sh` does not re-run full `count-active-agents` on each deferral retry within the same job.
- [ ] Cache in-flight count for job lifetime (env var set on first admission-gate call) or short TTL (e.g. 60s) documented in WORKFLOW.md.
- [ ] Cap semantics unchanged: still count `RUNNING`/`CREATING` runs targeting this repo.

### P7 — Actions job setup

- [ ] Use shallow checkout (`fetch-depth: 2` or minimal depth sufficient for `git show $BEFORE_SHA:path` and `git show $AFTER_SHA:path`) where safe; document fallback if shallow miss.
- [ ] Skip `apt-get install` when `jq` and `gh` are already on `ubuntu-latest` runner image (guard with `command -v`).
- [ ] Prefer sparse/partial fetch of `scripts/` from `main` via `cursor-workflow-load-scripts.sh` rather than full history when shallow checkout is used.

### P8 — Status comment ID caching

- [ ] After first status comment create, store `status_comment_id` (integer) in `workflow.state.json`.
- [ ] Subsequent syncs use `PATCH /repos/{owner}/{repo}/issues/comments/{id}` when cached ID is valid; fall back to paginated search only when PATCH returns 404.
- [ ] On successful fallback create, persist new ID via branch push (same commit as other state updates when batched) or dedicated record script.

### Resync job

- [ ] `workflow_dispatch` resync does **not** run agent discovery unless explicitly needed (e.g. new `--discover` input default `false`, or skip when stage ≥ `plan-in-progress` and spec agent set).

### Validation

- [ ] Extend `scripts/test-cursor-workflow-handoff.sh` (and fixtures) for: skip-discovery predicates, batched writes (mock git — count pushes or dry-run mode), no duplicate sync (log/assert call count or env flag).
- [ ] `scripts/verify-workflow-paths.sh` and handoff workflow CI remain green.
- [ ] `workflow/cursor-workflow/WORKFLOW.md` updated with skip/cache rules and expected run-time characteristics.
- [ ] PR documents before/after timings on representative runs: sync-only push, handoff spawn, deferred spawn.

## Scope

### In scope

- [`.github/workflows/cursor-workflow-handoff.yml`](../../../.github/workflows/cursor-workflow-handoff.yml)
- [`scripts/cursor-workflow-*.sh`](../../../scripts/) helpers: discover, count, spawn, record-*, sync-github-status, load-scripts, new shared-list cache helper
- [`workflow/cursor-workflow/templates/workflow.state.json`](../../cursor-workflow/templates/workflow.state.json) — additive `status_comment_id`
- Tests: `scripts/test-cursor-workflow-handoff.sh`, `scripts/fixtures/cursor-workflow/`
- Docs: `workflow/cursor-workflow/WORKFLOW.md`, cross-links in `AGENTS.md` if needed
- Before/after timing notes in PR / demo

### Out of scope

- Changing the 8-agent cap, deferral backoff durations (30/60/120s), or handoff stage semantics
- Cursor API feature requests (e.g. global in-flight run list endpoint)
- Cloud agent skill behavior beyond optional `status_comment_id` field
- Archiving old Cursor agent workspaces (operational hygiene; docs note only)
- Cuebox application code (API, frontend, DB)

## User flows / API changes

### GitHub issue status (unchanged behavior)

- Issue **Cursor workflow — issue #NNN** status comment and `cursor:*` labels continue to update correctly on every push.
- Handoff spawns (planning → execute → demo → etc.) still fire on `workflow.state.json` stage transitions.
- Humans still trigger spec via `@cursoragent spec`; discovery backfill still works when `review-and-spec` link is missing and stage is before `plan-in-progress`.

### Faster paths (new behavior)

| Trigger | Before | After |
|---------|--------|-------|
| Sync-only push (no stage change) | Full discovery + full comment pagination + label sync | Skip discovery (stage ≥ plan); cached comment ID; single sync |
| Handoff spawn | 3 state pushes + 2–3 syncs + 2 agent list scans | 1 state push + 1 sync + 1 agent list scan |
| `workflow_dispatch` resync | Discovery + full scan | Labels/comment only (no discovery) |
| Deferred spawn (3 retries) | 3× full cap scan | 1× cap scan (cached) |

### No user-facing app changes

- No API, frontend, or database changes.

## Data and integration notes

### `workflow.state.json` schema (additive)

| Field | Type | Purpose |
|-------|------|---------|
| `status_comment_id` | `number \| null` | GitHub issue comment ID for status marker; avoids paginating all comments each run |

Existing fields unchanged. Template and `verify-workflow-paths.sh` updated to document optional `status_comment_id`.

### Discovery skip predicate

Use existing stage rank from [`cursor-workflow-stage-rank.sh`](../../../scripts/cursor-workflow-stage-rank.sh):

```text
skip_discovery =
  (agents.review-and-spec is set AND continued slot satisfied)
  OR stage_rank(stage) >= stage_rank("plan-in-progress")
```

When `skip_discovery` is false and `pr` is set, list agents with `prUrl=https://github.com/{repo}/pull/{pr}`.

### Shared agents list cache

| Env / file | Purpose |
|------------|---------|
| `CURSOR_AGENTS_LIST_CACHE` | Path to JSON file written once per job |
| Written by | First of: count-active-agents, discover-agents, admission gate |
| Read by | Subsequent callers in same job |

List response shape: paginated `items[]` with `id`, `latestRunId`, `status`, `createdAt`; consumers filter locally.

### Batched spawn state write

Single commit on `cursor/issue-*` branch should include (when applicable):

```json
{
  "handoff_pending": null,
  "agents": { "<skill>": "<agent-id>" },
  "active_agent_id": "<agent-id>",
  "active_skill": "<skill>",
  "status_comment_id": 12345678,
  "updated_at": "<ISO8601>"
}
```

Implementation options (planning chooses):

1. New `cursor-workflow-record-spawn-on-branch.sh` replacing separate pending + agent + clear calls, **or**
2. Extend `cursor-workflow-record-agent-on-branch.sh` to accept optional pending action and comment ID.

`handoff_pending` set before `POST` may remain a local-only or in-memory lock during POST; only the **post-success** push is required if admission gate checks local state file before POST. If cross-run lock visibility is required, set pending in the same batched push as agent record (lock cleared in that push) — planning must preserve [#70](https://github.com/BlackLodgeLabs/cuebox/issues/70) dedup semantics.

### Status sync dedup

Track `CURSOR_WORKFLOW_SYNCED=1` in job env after first successful sync; spawn/post-spawn callers skip when set unless `HANDOFF_PROGRESS_STAGE` changes display fields not yet synced.

Remove redundant call at line 132 in handoff YAML (`spec-ready` → `sync` before spawn) since job-start sync already ran.

### Actions checkout

- `fetch-depth: 2` minimum for `BEFORE_SHA`/`AFTER_SHA` diff of `workflow.state.json`.
- `cursor-workflow-load-scripts.sh` fetches `origin/main` scripts regardless of branch depth.

### Shell tests (CI-safe)

Extend `scripts/test-cursor-workflow-handoff.sh`:

| Case | Mock / fixture | Expected |
|------|----------------|----------|
| Skip discovery at plan-in-progress | `state` stage `plan-in-progress`, spec agent set | discover script exit 0 without API calls (`MOCK_CURSOR_API=1`, assert no curl) |
| Skip discovery missing spec only | stage `spec-ready`, no `review-and-spec` | discovery runs |
| Shared list cache | two count calls in one job | one list fetch (mock counter) |
| Batched spawn writes | `CURSOR_WORKFLOW_PENDING_DRY_RUN=1` + mock git | single logical state update with agent + pending clear |
| No duplicate sync | env call counter | at most one sync per job in handoff path fixture |
| Comment ID cache | `status_comment_id` set | sync uses PATCH not list |

### Expected run-time targets (document in PR)

| Scenario | Target |
|----------|--------|
| Sync-only | &lt; 2 min (often &lt; 60s excluding queue) |
| Handoff spawn | Dominated by Cursor API POST + one push, not 3 pushes |
| Resync dispatch | &lt; 60s without discovery |

### Labels

No new labels required.

## Open questions (must be empty before plan-ready)

_None — issue body plus defaults above (stage-rank skip threshold, `status_comment_id` field, job-scoped list cache, batched spawn push, resync skips discovery by default) are sufficient for planning._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/77
- Prior hardening: [#70 / PR #71](https://github.com/BlackLodgeLabs/cuebox/pull/71)
- `includeArchived=false`: [#76](https://github.com/BlackLodgeLabs/cuebox/pull/76)
- Investigation context: [#72](https://github.com/BlackLodgeLabs/cuebox/issues/72) workflow runs
- Workflow docs: [WORKFLOW.md](../../cursor-workflow/WORKFLOW.md), [SETUP.md](../../cursor-workflow/SETUP.md)
- Handoff workflow: [`.github/workflows/cursor-workflow-handoff.yml`](../../../.github/workflows/cursor-workflow-handoff.yml)
- Cursor API: https://cursor.com/docs/cloud-agent/api/endpoints
