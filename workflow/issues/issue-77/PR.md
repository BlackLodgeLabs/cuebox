## Related Issue

[#77 — Optimize cursor-workflow-handoff Actions performance](https://github.com/BlackLodgeLabs/cuebox/issues/77)

Builds on [#70 / PR #71](https://github.com/BlackLodgeLabs/cuebox/pull/71) (dedup, cap, babysit recovery) and [#76](https://github.com/BlackLodgeLabs/cuebox/pull/76) (`includeArchived=false`, stage-rank fixes). Investigation context: [#72](https://github.com/BlackLodgeLabs/cuebox/issues/72).

## Description

**What does this PR do?**

Reduces **cursor-workflow-handoff** GitHub Actions run time from the **2–10+ minute** baseline (highly variable) to well under **2 minutes** for sync-only pushes by eliminating redundant Cursor API scans, duplicate status syncs, and cascading git push round-trips during handoff spawns.

This is **workflow scaffolding only** — no Cuebox application (API, frontend, DB) changes.

Key optimizations (P1–P8 from spec):

- **Conditional agent discovery** — skip when `stage` rank ≥ `plan-in-progress` or spec agent links are already recorded; resync defaults to no discovery (`discover` input default `false`).
- **Shared agents list cache** — one paginated `GET /v1/agents?includeArchived=false` per job via `cursor-workflow-fetch-agents-list.sh`; discovery and cap counting reuse the cached JSON.
- **Batched spawn state writes** — single branch push per successful spawn via `cursor-workflow-record-spawn-on-branch.sh` (agent ID + `handoff_pending: null` + optional `status_comment_id`); in-job pending lock via `CURSOR_WORKFLOW_PENDING_SKILL` env instead of a pre-POST push.
- **Deduped status sync** — `CURSOR_WORKFLOW_SYNCED=1` skips redundant syncs; removed duplicate `spec-ready` sync in handoff YAML; `status_comment_id` in state enables PATCH instead of paginating all issue comments.
- **Cached cap count** — `CURSOR_WORKFLOW_IN_FLIGHT_COUNT` set on first admission-gate call; no full re-scan on deferral retries within the same job.
- **Lighter Actions setup** — shallow checkout (`fetch-depth: 2`), guarded `apt-get` (`command -v jq/gh`), consolidated script loading via `cursor-workflow-load-scripts.sh handoff`.

**Why is this the best approach?**

The bottlenecks were overhead, not the `POST /v1/agents` spawn itself (issue #72). Rather than changing cap semantics or handoff stage rules, this PR attacks redundant work in the same job: duplicate API pagination, triple state pushes per spawn, and repeated comment scans. Job-scoped caches and env-backed locks preserve [#70](https://github.com/BlackLodgeLabs/cuebox/issues/70) dedup semantics while cutting round-trips. Batched writes collapse three workflow triggers into one without losing cross-run dedup (branch-recorded `agents.<skill>` still gates re-spawn). Discovery remains available for early spec stages when `review-and-spec` links are missing.

## Changes Proposed

* **New scripts** (`feat(workflow)`): `cursor-workflow-fetch-agents-list.sh` (shared paginated agents list cache); `cursor-workflow-should-discover-agents.sh` (skip predicate for push + resync); `cursor-workflow-record-spawn-on-branch.sh` (batched post-spawn state write).
* **Discovery efficiency** (`perf(workflow)`): `cursor-workflow-discover-agents.sh` — skip predicate, `prUrl` filter when PR known, `latestRunId` from list item (no redundant `GET /agents/{id}`).
* **Shared list consumers** (`perf(workflow)`): `cursor-workflow-count-active-agents.sh` reads cached list; `cursor-workflow-admission-gate.sh` — in-job pending env check + cached cap count; `cursor-workflow-spawn-agent.sh` — in-job pending, batched record, deduped sync.
* **Status sync** (`perf(workflow)`): `cursor-workflow-sync-github-status.sh` — `status_comment_id` PATCH with 404 fallback, `CURSOR_WORKFLOW_SYNCED` dedup flag.
* **Script loader** (`perf(workflow)`): `cursor-workflow-load-scripts.sh` extended with handoff script set (minus merge/stage-rank from YAML load list).
* **Handoff workflow YAML** (`perf(workflow)`): shallow checkout, guarded apt install, `load-scripts.sh handoff`, conditional discovery block, removed duplicate `spec-ready` sync, resync `discover` input default `false`.
* **Schema** (`feat(workflow)`): `status_comment_id: null` added to `workflow/cursor-workflow/templates/workflow.state.json`.
* **Tests & fixtures** (`test(workflow)`): six new cases in `test-cursor-workflow-handoff.sh` (skip-discovery, shared cache, batched writes, sync dedup, comment ID cache, cap count cache); fixtures under `scripts/fixtures/cursor-workflow/`.
* **Docs** (`docs(workflow)`): `workflow/cursor-workflow/WORKFLOW.md` — performance optimizations section (skip/cache rules, timing targets, resync `discover` input); `AGENTS.md` cross-link; `verify-workflow-paths.sh` updated for new scripts and optional `status_comment_id` key.
* **Workflow artifacts**: Spec, plan, demo logs/screenshots, and demo notes under `workflow/issues/issue-77/`.

## Scenario Results

Demo run on branch `cursor/issue-77-optimize-handoff-actions-perf-e7b1` (2026-07-06, commit `40b25d6`). No Cuebox Docker stack required — validation via shell tests and GitHub Actions timing.

| # | Scenario | Result |
|---|----------|--------|
| 1 | Handoff shell tests pass | **PASS** — `test-cursor-workflow-handoff.sh`, `test-cursor-workflow-record-agent.sh`, `verify-workflow-paths.sh` all exit 0 |
| 2 | Skip-discovery predicate | **PASS** — `plan-in-progress` → skip (exit 0); `spec-ready` without spec agent → run discovery (exit 1) |
| 3 | Workflow documentation | **PASS** — all required topics in `WORKFLOW.md` |
| 4 | Before/after timing | **PASS** — sync-only **13s**; handoff spawns **~1.5–2 min** (vs 2–10+ min baseline); deferred spawn and resync N/A/pending (see notes) |

### Scenario 1 — Handoff shell tests

Log: [`scenario-1-test-output.log`](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-77-optimize-handoff-actions-perf-e7b1/workflow/issues/issue-77/demo/scenario-1-test-output.log)

New regression cases confirmed: `should-discover skips plan-in-progress`, `shared list cache single fetch`, `batched spawn clears pending and records agent`, `duplicate sync skipped when already synced`, `comment id cache uses PATCH not list`, `cap count cached across admission gate calls`.

### Scenario 2 — Skip-discovery predicate

Log: [`scenario-2-skip-discovery.log`](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-77-optimize-handoff-actions-perf-e7b1/workflow/issues/issue-77/demo/scenario-2-skip-discovery.log)

### Scenario 3 — Workflow documentation

![Performance optimizations section in WORKFLOW.md](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-77-optimize-handoff-actions-perf-e7b1/workflow/issues/issue-77/demo/scenario-3-workflow-docs.png)

### Scenario 4 — GitHub Actions timing

| Scenario | Run | Job duration | vs target |
|----------|-----|--------------|-----------|
| Sync-only push | [28774704298](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28774704298) | **13s** | **PASS** (&lt; 2 min; &lt; 60s excl. queue) |
| Handoff spawn (plan-ready → planning) | [28774015821](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28774015821) | **2m 7s** | **PASS** (down from 2–10+ min) |
| Handoff spawn (execute-in-progress → execute) | [28774171189](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28774171189) | **1m 37s** | **PASS** |
| Deferred spawn | — | N/A | Mock evidence in scenario 1 log |
| Resync dispatch (no discover) | — | Pending | Pre-optimization reference: [28742706968](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28742706968) **2m 49s** |

Full table: [`scenario-4-timing.md`](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-77-optimize-handoff-actions-perf-e7b1/workflow/issues/issue-77/demo/scenario-4-timing.md)

## How to Test

### Automated

```bash
git checkout cursor/issue-77-optimize-handoff-actions-perf-e7b1

# Workflow regression (no Docker or Postgres required)
bash scripts/verify-workflow-paths.sh
```

Targeted subsets:

```bash
bash scripts/test-cursor-workflow-handoff.sh
bash scripts/test-cursor-workflow-record-agent.sh
```

### Skip-discovery predicate (manual)

```bash
# Skip discovery at plan-in-progress
scripts/cursor-workflow-should-discover-agents.sh \
  scripts/fixtures/cursor-workflow/state-plan-in-progress.json
echo "exit: $?"   # expect 0

# Run discovery at spec-ready without spec agent
scripts/cursor-workflow-should-discover-agents.sh \
  scripts/fixtures/cursor-workflow/state-spec-ready-no-agents.json
echo "exit: $?"   # expect 1
```

### Live Actions timing (optional)

After merge, compare **cursor-workflow-handoff** runs on an issue branch:

1. **Sync-only push** — stage ≥ `plan-in-progress`, no spawn; expect &lt; 2 min (often &lt; 60s job time).
2. **Handoff spawn** — stage transition triggers spawn; expect one batched state push (not three).
3. **Resync dispatch** — `workflow_dispatch` with `discover=false`; expect &lt; 60s without discovery.

No Cuebox `docker compose up` required for this PR.

## Known Issues / Notes for Reviewer

* **Deferred spawn timing not captured live** — admission-gate deferral was not triggered on this branch during execute; shell test `cap count cached across admission gate calls` provides mock evidence.
* **Resync dispatch timing pending** — no `workflow_dispatch` resync was run post-optimization on #77; pre-optimization reference was **2m 49s** ([run 28742706968](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28742706968)); target after merge is &lt; 60s with `discover=false`.
* **In-job pending lock** — `CURSOR_WORKFLOW_PENDING_SKILL` is job-scoped; cross-run dedup still relies on `agents.<skill>` recorded on the branch (same as #70).
* **Shallow checkout** — `fetch-depth: 2`; if `git show BEFORE_SHA:path` misses, workflow falls back to deeper fetch (documented in WORKFLOW.md).
* **Stale `status_comment_id`** — PATCH 404 triggers paginated search fallback and persists new ID.
* **No application code changes** — no API, frontend, DB, or Alembic migrations.

## Checklist

- [ ] Acceptance criteria in `workflow/issues/issue-77/SPEC.md` met (P1–P8)
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `workflow/cursor-workflow/WORKFLOW.md` documents skip/cache rules and timing targets
- [ ] Demo artifacts reviewed (no secrets in logs or screenshots)
- [ ] CI green on draft PR #78

## Gate evidence

- [x] `Workflow regression: bash scripts/verify-workflow-paths.sh exit 0 at 40b25d6`
- [x] `Handoff tests: bash scripts/test-cursor-workflow-handoff.sh all cases passed at 40b25d6`
- [x] `Record-agent tests: bash scripts/test-cursor-workflow-record-agent.sh all cases passed at 40b25d6`
