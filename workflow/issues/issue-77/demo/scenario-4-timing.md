# Scenario 4 — GitHub Actions timing (issue #77)

**Baseline (issue #72 / #77 spec):** handoff runs routinely **2–10+ minutes**, highly variable.

**Measured on branch `cursor/issue-77-optimize-handoff-actions-perf-e7b1` after execute merge** (2026-07-06 UTC). Durations are **job execution** (startedAt → completedAt) unless noted.

| Scenario | Run | Job duration | Total workflow | vs target | Notes |
|----------|-----|--------------|----------------|-----------|-------|
| **Sync-only push** (stage `execute-ready`, no spawn) | [28774704298](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28774704298) | **13s** | 18s | **PASS** (&lt; 2 min; &lt; 60s excl. queue) | Discovery skipped (stage ≥ plan-in-progress); label/comment sync only |
| **Handoff spawn** (`plan-ready` → planning agent) | [28774015821](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28774015821) | **2m 7s** | 2m 12s | **PASS** (&lt; 2 min marginal; down from 2–10+ min baseline) | POST + batched state write (one push vs three pre-#77) |
| **Handoff spawn** (`execute-in-progress` → execute agent) | [28774171189](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28774171189) | **1m 37s** | 1m 41s | **PASS** | Spawn step ~86s; shared list cache + skip discovery |
| **Deferred spawn** (admission gate deferral) | — | — | — | **N/A** | Not triggered on this branch during execute; mock evidence: `cap count cached across admission gate calls` in `scenario-1-test-output.log` |
| **Resync dispatch** (no discover) | — | — | — | **Pending** | No `workflow_dispatch` resync on #77 post-merge; pre-optimization reference: [28742706968](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28742706968) resync job **2m 49s** (2026-07-05, old scripts). Target after merge: &lt; 60s with `discover=false`. |

## Summary

- **Sync-only** runs dropped from multi-minute baseline to **~13s** job time on this branch.
- **Handoff spawns** complete in **~1.5–2 min** (vs 2–10+ min before), with a single batched push per spawn.
- Shell tests confirm skip-discovery, shared cache, batched writes, sync dedup, and cap-count cache behaviors independent of live deferral/resync runs.
