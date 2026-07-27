# Workflow handoff review — July 2026

**Date:** 2026-07-27
**Scope:** Issues ≥ #136 that entered the Cursor workflow (#136, #140, #141, #142, #143, #144) plus #89 as the immediate pre-cohort baseline; secondary cohort = handoff-behaviour merges #109–#127. This is a **cross-cutting** review of the handoff path, not a per-issue post-mortem.
**Method:** All 600 **Cursor workflow handoff** runs from 2026-07-04 to 2026-07-27 pulled via `gh run list`; job-level `created_at`/`started_at`/`completed_at` pulled via `GET /actions/runs/{id}/jobs` to separate concurrency wait from real work; full logs downloaded for all 82 canonical-branch cohort runs plus every failed run; `workflow.state.json` blobs read directly from the failing commit SHAs; issue comments read via `GET /issues/{n}/comments`. Cross-referenced against [WORKFLOW.md](WORKFLOW.md), [OPERATIONS.md](OPERATIONS.md), [RETROSPECTIVES.md](RETROSPECTIVES.md), `.github/workflows/cursor-workflow-handoff.yml`, and `scripts/cursor-workflow-{spawn-agent,admission-gate,count-active-agents,count-in-flight-for-issue,fetch-agents-list,handoff-recovery}.sh`.

---

## Executive summary

- **Slow handoffs are not deferral.** There were **zero** `defer:*` results, zero `handoff_deferred` markers, and zero at-cap deferrals across the entire primary cohort. Every slow run is slow for one reason: the admission gate walks **every** `ACTIVE` Cursor agent workspace and issues a separate `GET /v1/agents/{id}/runs/{run_id}` call for each one. That serial fan-out runs **twice** before the pending lock and **once more** after it, which is why the measured ratio of pre-lock to post-lock time is a near-perfect 1.98 (n=25) and why median spawn latency is **351 s** with a **527 s** worst case.
- **The cost was introduced by #127 and is now the single largest line item in the pipeline.** Canonical handoff runs exceeding 240 s went from **7 %** (pre-#91) and **6 %** (#91–#119) to **34 %** after #127 merged on 2026-07-17, because `per_issue_spawn_serialization` added a *second*, uncached fan-out on top of the cap count. Handoff gating now burns **23–34 minutes per issue** — 42 % of total wall-clock on the fastest issue in the cohort (#140).
- **Handoff failures are dominated by three things that no existing hardening covers.** 5 of 30 stage transitions (**17 %**) failed to spawn. **Two** failed because an agent pushed a `workflow.state.json` containing **unresolved git conflict markers**, which crashes the handoff job at `jq -r '.branch'` with exit 5 ~15 ms into the step, before any notifier can run (11 jobs crashed this way in total). **Two** failed because the agents-list fan-out got **HTTP 429** from the Cursor API when two issues handed off in the same minute — self-inflicted throttling from the same N+1 problem. **One** died on a transient GitHub **502** inside the cosmetic label sync, which is not error-tolerant.
- **Nothing self-heals.** All 5 failed transitions needed an out-of-band nudge (2 human `workflow_dispatch` resyncs, 1 human `@cursoragent` comment, 2 agent-authored "re-trigger" pushes). The 15-minute **Cursor workflow retry deferred** cron recovered **0** of them across 51 scheduled runs, because it only scans for `handoff_deferred`, which is set only by in-job backoff exhaustion — never by a hard failure. **Three** of the five failures posted no notification at all. Added latency: **~5 h 32 m** across the cohort, with two individual stalls of ~1 h 55 m.
- **Top recommendation:** replace the per-workspace fan-out with a single list-derived count (or a server-side filter), and add a JSON-validity guard plus a `always()`-style notifier to the handoff job. Those three changes remove the dominant slowness, the dominant failure class, and the silence — without touching skill prompts. Wait-for-handoff in skills is worth adding, but as a cheap 10-minute backstop in `WORKFLOW.md`, not as the fix.

---

## Topic 1 — Handoff Action duration variability

### Findings (with evidence)

#### Distribution by bucket (82 canonical-branch cohort runs)

Wall-clock is split into **concurrency wait** (time before the job is even created, because a sibling run holds `cursor-handoff-${{ github.ref }}`) and **work** (job `started_at` → `completed_at`).

| Bucket | n | % | median work | max work | median wall | max wall |
|--------|---|---|-------------|----------|-------------|----------|
| **A. Fast sync-only** (no spawn attempt, no discovery) | 39 | 48 % | 16 s | 29 s | 20 s | 369 s¹ |
| **B. Spawn path** (`POST /v1/agents` succeeded) | 27 | 33 % | 425 s | 606 s | 430 s | 753 s |
| **C. Defer / retry path** (in-job backoff or `handoff_deferred`) | **0** | **0 %** | — | — | — | — |
| **D. Discovery / scan only** (spec stages, `cursor-workflow-discover-agents.sh`) | 7 | 9 % | 147 s | 183 s | 152 s | 188 s |
| **E. Failure / stall** | 9 | 11 % | 15 s | 264 s | 18 s | 382 s |

¹ Bucket-A runs never exceed 29 s of work; their long wall-clock is pure concurrency wait behind a bucket-B peer.

Side-branch runs are excluded from the table above but are worth stating separately: **109 of the 198 cohort runs (55 %) fired on `cursor/issue-NNN-pr-MMM-*-agent-*` branches and did nothing** except print `Skipping — push ref … ≠ canonical …` (median 16 s, max 32 s). That is the #127 canonical-branch guard working correctly, but the `on.push.branches: 'cursor/issue-*'` trigger still pays a runner for each one.

#### Root cause of bucket B: a serial N+1 fan-out over every ACTIVE workspace

`cursor-workflow-count-active-agents.sh` reads the cached agents list, then for **every** item with `status == "ACTIVE"` issues one blocking `curl` to `GET /v1/agents/{id}/runs/{run_id}`:

```bash
CACHE=$("$SCRIPT_DIR/cursor-workflow-fetch-agents-list.sh")
while IFS=$'\t' read -r agent_id run_id; do
  if run_counts_toward_cap "$agent_id" "$run_id"; then count=$((count + 1)); fi
done < <(jq -r '.items[]? | select(.status == "ACTIVE" and (.latestRunId // "") != "") ...' "$CACHE")
```

`cursor-workflow-count-in-flight-for-issue.sh` (added by #127) repeats the **same** loop with the **same** per-run detail calls, for the per-issue same-skill check. `CURSOR_AGENTS_LIST_CACHE` caches the *list pages* only; `CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE` caches only the *cap count*. **Neither caches the per-run detail calls, and the per-issue count is not cached at all.**

`cursor-workflow-spawn-agent.sh` runs the admission gate twice — once before `record-handoff-pending.sh set` and once after. That gives:

- **gate 1** = cap fan-out + per-issue fan-out (2 passes)
- **gate 2** = cached cap count + per-issue fan-out (1 pass) + the `POST`

Measured across all 25 non-recovery spawns in the cohort:

| Segment | n | median | min | max |
|---------|---|--------|-----|-----|
| `Handoff:` → `handoff_pending=set` (gate 1) | 25 | **236 s** | 185 s | 375 s |
| `handoff_pending=set` → `Cursor agent created` (gate 2 + POST) | 25 | **119 s** | 92 s | 168 s |
| Total spawn latency | 25 | **351 s** | 297 s | 527 s |

**gate 1 / gate 2 median ratio = 1.98** — exactly the 2:1 the code predicts. This is the single strongest piece of evidence that the fan-out, not deferral or the Cursor `POST`, dominates.

Worked example, [run 30205134470](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30205134470) (#141 `spec-ready` → planning, 753 s wall / 606 s work):

| Timestamp | Event | Δ |
|-----------|-------|---|
| 14:01:22 | job starts, state file read | |
| 14:03:56 | `Updated status comment … cursor:spec-ready` | **+154 s** (discovery fan-out) |
| 14:04:01 | `Handoff: issue #141 stage=spec-ready … Plan Agent` | +5 s |
| 14:08:38 | `Updated … handoff_pending=set` | **+277 s** (gate 1) |
| 14:11:10 | `Cursor agent created: bc-caf9c408…` | **+152 s** (gate 2 + POST) |
| 14:11:15 | status comment → `cursor:plan-in-progress` | +5 s |

#### The regression is attributable to #127

Canonical-branch handoff runs, bucketed by the hardening that was live at the time:

| Period | Landed hardening | n | median work | p90 | max | runs > 240 s |
|--------|------------------|---|-------------|-----|-----|--------------|
| ≤ 2026-07-10 | pre-#91 | 114 | 78 s | 181 s | 653 s | 8 (**7 %**) |
| 2026-07-11 → 07-16 | #91, #109, #110, #111, #117, #118, #119 | 129 | 30 s | 205 s | 461 s | 8 (**6 %**) |
| ≥ 2026-07-17 | + **#127** (`per_issue_spawn_serialization: true`) | 125 | 110 s | 445 s | 753 s | 42 (**34 %**) |

`orchestration.per_issue_spawn_serialization` defaults to `true` in `workflow/cursor-workflow/workflow.config.yaml`, and #127 merged as PR #130 on 2026-07-17 (`6c53fe0 feat(workflow): harden handoff orchestration for issue #127`). The step change lines up exactly.

#### The fan-out is self-throttling, which explains the variance *within* bucket B

The same fan-out shows up as transient Cursor API errors mid-gate:

- [run 30210413254](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30210413254) (#142 `spec-ready`): one `curl: (22) The requested URL returned error: 503` at 16:36:00, spawn still succeeded at 16:37:18.
- [run 30210908228](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30210908228) (#142 `plan-ready`): **three** 503s at 16:41:31, 16:43:25, 16:43:57.
- [run 30256429022](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30256429022) (#144 `create-pr-ready`): one 503 at 10:05:07.

A single fan-out that completes in ~4 s when the API is healthy (see [run 30245531669](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30245531669), #144 recovery spawn: `Handoff recovery: spawning planning` 07:16:34 → `Cursor agent created` 07:16:48, **14 s** end to end) becomes 100–375 s once per-request latency rises, because the cost is `N × per-request latency` with `N` = every ACTIVE workspace ever created for this repo. Nothing archives those workspaces ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70), [OPERATIONS.md § Runs vs ACTIVE workspaces](OPERATIONS.md)), so `N` grows monotonically.

#### Concurrency serialization inflates wall-clock on second pushes

With `cancel-in-progress: false`, a push that lands seconds after a `*-ready` push does not run concurrently — its **job is not created until the peer finishes**. Ten cohort runs waited 90–347 s:

| Run | Issue | Concurrency wait | Own work | Title |
|-----|-------|------------------|----------|-------|
| [30246574745](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30246574745) | #144 | 313 s | 15 s | `clear skill lock on execute-ready #144` |
| [30214482240](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30214482240) | #142 | 347 s | 15 s | `fix gate evidence SHA in PR.md for #142` |
| [30115615228](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30115615228) | #140 | 342 s | 23 s | `clear execute skill lock on issue #140` |
| [30093983824](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30093983824) | #136 | 334 s | 22 s | `check off issue #136 plan definition of done` |

Job timings for the #144 pair make the mechanism explicit: run 30246560238's handoff job ran 07:33:17 → 07:38:40; run 30246574745 was created at run level 07:33:28 but its **job** was created 07:38:41 and finished 07:38:58.

**Documentation correction:** [WORKFLOW.md § Demo push batching (issue #119)](WORKFLOW.md) states *"The workflow uses `cancel-in-progress: true` on its concurrency group — a second push within seconds **cancels** the in-flight handoff run."* The YAML has read `cancel-in-progress: false` since the original scaffold commit `fbfb04a` (2026-06-23) and still does. Rapid second pushes **queue** behind the first; GitHub cancels the older *pending* run only when a third push arrives for the same group (that is the mechanism behind the single cancelled #115 run, [29271581256](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271581256), `chore(workflow): set issue-115 stage to demo-ready`, 2026-07-13). The #119 single-push guidance is still correct advice — but for the queueing reason, not the cancellation reason. Notably, **zero** cohort runs were cancelled (last cancellation repo-wide: 2026-07-17), so #119 held.

#### Bucket D: discovery still runs on every early-spec push

`cursor-workflow-should-discover-agents.sh` skips discovery only when `agents.review-and-spec` and `agents.review-and-spec-continued` are both set, or stage rank ≥ `plan-in-progress` (25). Human-triggered `@cursoragent spec` agents are not recorded by the Action, so every `spec-needs-info` / `spec-in-progress` / `spec-ready` push pays a full discovery fan-out with no spawn to show for it: 113–183 s each, 7 runs in the cohort ([30088309095](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30088309095) 117 s, [30112905460](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30112905460) 183 s, [30205120926](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30205120926) 164 s, [30211216072](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211216072) 113 s, [30244596532](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30244596532) 171 s).

#### Are long runs expected?

No. Against [WORKFLOW.md § Expected run-time targets](WORKFLOW.md):

| Target | Reality |
|--------|---------|
| Sync-only push < 2 min (often < 60 s) | **Met** for true sync-only (median 16 s work) — but breached to 331–369 s wall when queued behind a spawn run |
| Handoff spawn "dominated by Cursor API POST + one push" | **Wrong.** The `POST` and pushes are seconds; the admission gate is 85–95 % of the run (median 351 s of a 425 s job) |
| Resync dispatch (no discover) < 60 s | **Breached.** The #142 recovery resync [30211570664](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211570664) took 7 m 28 s (16:58:03 → 17:05:31), all of it in the same gate |

Cost per issue, summing spawn latency only:

| Issue | Spawns | Gate time | End-to-end (spec comment → complete notify) | Gate share |
|-------|--------|-----------|--------------------------------------------|------------|
| #136 | 4 | 23.0 min | 2 h 22 m | 16 % |
| #140 | 5 | 33.8 min | 1 h 21 m | **42 %** |
| #141 | 5 | 31.1 min | 2 h 09 m | 24 % |
| #142 | 4 | 25.7 min | 2 h 08 m | 20 % |
| #143 | 4 | 25.3 min | 4 h 41 m | 9 % |
| #144 | 5 | 25.0 min | 3 h 14 m | 13 % |

**2 h 44 m of gate time across 27 spawns in six issues.**

### Recommendations

Ranked by value per unit of change.

**1. Observability (do first — it is nearly free and every other fix depends on it).**

- Log the numbers the gate already computes. `cursor-workflow-count-active-agents.sh` prints its count into a shell variable and it is **never echoed**; the same is true of the per-issue count and the agents-list length. Today an operator cannot tell from an Action log whether a 600 s run was at-cap, throttled, or just walking 300 workspaces. Emit one line: `admission: list_items=<n> active_workspaces=<n> in_flight=<n>/<max> same_skill_in_flight=<n> elapsed=<s>s`.
- Add a `$GITHUB_STEP_SUMMARY` block per handoff run: issue, stage transition, decision (`proceed` / `skip:*` / `defer:*` / failure reason), spawned agent id, and a millisecond breakdown of discovery / gate 1 / gate 2 / POST. This turns the log-archaeology done for this review into a one-click read.
- Count and log `curl` non-2xx responses from the fan-out. Today a 503 mid-loop is invisible except as a bare `curl: (22)` line with no context.

**2. Code fixes to remove the fan-out (this is the actual fix for Topic 1).**

- **Derive both counts from the list response instead of per-run detail calls.** If `GET /v1/agents?limit=100` returns enough per-item state (status, `latestRunId`, target branch/repo) to decide "counts toward cap", the fan-out disappears entirely and the gate becomes one or two HTTP calls. Where the list is insufficient, fetch run details **once per job** into a keyed cache file (`$RUNNER_TEMP/cursor-run-details.json`) shared by `count-active-agents.sh`, `count-in-flight-for-issue.sh`, and `discover-agents.sh` — the three scripts currently make the same calls up to three times per run.
- **Cache the per-issue same-skill count** the way the cap count is cached (`CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE`). That alone removes gate 2's fan-out and cuts median spawn latency by roughly a third with a one-line change.
- **Collapse the double gate.** The gate 1 → pending-lock → gate 2 sequence exists to close the #84/#90 TOCTOU window. That window is measured in the time to push one commit, not in the time to walk 300 workspaces. Do the expensive checks **once** (before the lock) and keep only the cheap, state-file-local checks (`agents.<skill>` recorded, `handoff_pending` held by a peer) in gate 2.
- **Bound the fan-out.** If per-run detail calls must stay, run them with a concurrency of 8–16 and a hard wall-clock budget; on budget exhaustion, fail closed with an explicit `defer:cap-unknown` rather than silently proceeding.
- **Fix the silent undercount.** In `run_counts_toward_cap`, `curl -fsS … | jq -e …` under `pipefail` returns jq's `1` when curl fails with 22, and the caller treats `1` as "this run does not count toward the cap". A 503 on any single run-detail call therefore **silently lowers the in-flight count**, which can let the workflow exceed the 8-run cap. Distinguish transport failure from a negative predicate (capture the HTTP status separately).
- **Do not let a PR-filtered list feed the cap.** `cursor-workflow-discover-agents.sh` exports `CURSOR_AGENTS_STATE_FILE` before calling `fetch-agents-list.sh`, which makes the shared `CURSOR_AGENTS_LIST_CACHE` a **`prUrl`-filtered subset**. Any later `count-active-agents.sh` in the same job reuses that cache and computes a global cap from a single PR's agents. This did not demonstrably fire in the cohort (discovery ran while `pr` was still null), but it is one ordering change away from a wrong cap. Write filtered results to a distinct cache path.

**3. Configuration tuning.**

- Consider `orchestration.per_issue_spawn_serialization: false` as an interim measure *only if* the fan-out fix is deferred. It is the direct cause of the 6 % → 34 % slow-run regression. The safer sequencing is to keep the guarantee and make it cheap (cache it), because it does real work — the `-agent-*` branch naming makes same-skill detection reliable.
- `orchestration.max_active_agents: 8` was never reached in the cohort (zero `defer:at-cap`). The cap is not a throughput limiter today; the gate that enforces it is.

**4. Documentation and operator guidance.**

- Correct [WORKFLOW.md § Expected run-time targets](WORKFLOW.md): a handoff spawn is currently ~6 min, dominated by the admission gate, not by "Cursor API POST + one push". State a target (e.g. < 60 s) and treat the gap as a tracked defect rather than leaving the doc describing an aspiration as fact.
- Correct the `cancel-in-progress: true` claim in [WORKFLOW.md § Demo push batching (issue #119)](WORKFLOW.md) and restate the single-push rationale as "a second push serialises behind a 5–9 minute spawn run".
- Add to [OPERATIONS.md](OPERATIONS.md): "a handoff run of 5–10 minutes at a `*-ready` stage is currently normal; it is *not* evidence of at-cap deferral. Check for `Spawn deferred` before assuming the cap."
- Reduce wasted runs: either narrow `on.push.branches` to exclude `*-agent-*` (e.g. keep `cursor/issue-*` and add `paths-ignore`/a name filter), or accept them and note that 55 % of handoff runs are guard no-ops.

---

## Topic 2 — Failed / missing agent spawns

### Definition and rate

A transition **fails** when a push moves `stage` to a handoff value and the handoff job does not record `agents.<target>` — because the job errored, or because it exited without a spawn and no later automated run filled the gap.

The primary cohort has 6 issues × 5 handoff transitions = **30 expected transitions**.

| Metric | Value |
|--------|-------|
| Transitions that failed to spawn on the triggering push | **5 / 30 (17 %)** |
| Issues affected | **4 / 6 (#136, #142, #143, #144)** — only #140 and #141 ran clean |
| Failures that self-healed with no human or agent nudge | **0 / 5** |
| Failures that posted a stalled notification | **2 / 5** |
| Recoveries by the 15-min `retry-deferred` cron | **0** of 51 scheduled runs in the window |
| Total handoff jobs that crashed in the cohort | **14** (9 on the canonical branch, 5 on agent side-branches) |
| Added latency across the cohort | **~5 h 32 m** |

Per-failure detail:

| Issue / stage | Failing run | Cause | Notified? | Recovered by | Stall |
|---------------|-------------|-------|-----------|--------------|-------|
| #136 `plan-ready` | [30091769827](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30091769827) + [30091791070](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30091791070) | conflict markers in state → `jq: parse error`, exit 5 | **No** | human `workflow_dispatch` resync [30092598075](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30092598075) at 12:18:20 | **22 m 10 s** |
| #142 `execute-ready` | [30211387136](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211387136) | Cursor API **429** in agents-list fan-out → `agents-list-fetch-failed`, exit 4 | Yes | human `workflow_dispatch` resync [30211570664](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211570664) at 16:57:48 | **11 m 23 s** |
| #143 `spec-ready` | [30211231599](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211231599) | Cursor API **429**, same minute as #142 | Yes | human `@cursoragent use planning skill …` comment at 18:39:37 | **1 h 55 m 33 s** |
| #143 `demo-ready` | [30216452102](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30216452102) + [30216460965](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30216460965) | conflict markers in state → exit 5 | **No** | agent-authored `re-trigger demo-ready handoff` push → recovery [30220140939](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30220140939) at 20:59:50 | **1 h 53 m 34 s** |
| #144 `spec-ready` | [30244605615](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30244605615) | GitHub API **502** during label sync → `failed to update 1 issue`, exit 1 | **No** | agent-authored `re-trigger handoff` push → recovery [30245531669](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30245531669) at 07:16:10 | **9 m 41 s** |

#### Evidence: unresolved conflict markers in `workflow.state.json`

**Eleven** handoff jobs (6 canonical, 5 side-branch) died on `jq: parse error: Invalid numeric literal at line 4, column 8`; three more logged the same error non-fatally while reading the *previous* commit's state for `prev_stage`. Reading the blob at the failing commit shows why — for example `cae92fe1e18edc49468494ac4b17829098ee661f:workflow/issues/issue-143/workflow.state.json`:

```json
{
  "issue": 143,
  "branch": "cursor/issue-143-watchlist-poster-grid",
<<<<<<< HEAD
  "stage": "execute-ready",
  "active_skill": "demo",
  "updated_at": "2026-07-26T19:07:20Z",
=======
  "stage": "demo-ready",
  "active_skill": null,
  "updated_at": "2026-07-26T19:14:00Z",
>>>>>>> cursor/issue-143-pr-151-demo-agent-c2d3
  "agents": { … }
```

Identical shape at `51c24ec…:workflow/issues/issue-136/…` (`spec-ready` vs `plan-ready`, conflicting with `cursor/issue-136-pr-138-plan-agent-10cf`) and `4b36593…:workflow/issues/issue-144/…` (`demo-in-progress` vs `execute-ready`, conflicting with `origin/cursor/issue-144-mobile-ui-film-detail`).

The mechanism is structural, not incidental: `workflow.state.json` is written by **both** the agent (on its side branch) and the handoff Action (`handoff_pending set`, `record spawn`, `link draft PR`, `record loops` — all pushed to the canonical branch). Every side-branch → canonical merge therefore conflicts on the same three-to-six lines. `cursor-workflow-merge-state.sh` exists precisely for this and **does** validate JSON (`if ! jq empty "$STATE_FILE"`), so these pushes bypassed it — the agent ran a plain `git merge`, resolved code conflicts, and pushed the state file with markers intact.

The handoff job has **no** JSON guard. `.github/workflows/cursor-workflow-handoff.yml` goes straight from `git show "${AFTER_SHA}:${STATE_FILE}" > /tmp/workflow.state.json` to `canonical=$(jq -r '.branch // empty' …)` under `set -euo pipefail`, so exit 5 lands ~15 ms into the step — before the label sync, before the spawn, and before any notifier. `scripts/cursor-workflow-validate-state.sh` already implements exactly the check that is missing, but it is referenced only by `scripts/test-cursor-workflow-state-schema.sh`, `scripts/verify-workflow-portable.sh`, and [STATE-SCHEMA.md](STATE-SCHEMA.md) — **no GitHub Actions workflow or skill invokes it**, and it is not in the `cursor-workflow-load-scripts.sh` handoff bundle (which ships `merge-state.sh` and `refetch-state.sh` but not `validate-state.sh`).

#### Evidence: 429 from self-inflicted API load

`#142` and `#143` failed **in the same second**:

```
30211387136  16:54:03  curl: (22) The requested URL returned error: 429
             16:54:03  Agent-list fetch/count failed before spawning demo (exit 4)
             16:54:04  Posted stalled notification on issue #142
30211231599  16:54:03  curl: (22) The requested URL returned error: 429
             16:54:03  Agent-list fetch/count failed before spawning planning (exit 4)
             16:54:05  Posted stalled notification on issue #143
```

Both jobs were mid-fan-out on the Cursor agents API. The operator had deliberately run #142 and #143 in parallel (issue #143 comment: *"You are running in parallel with #142"*), which doubled the request rate. Two concurrent handoffs were enough to trip rate limiting. The #111/#118 notifier worked correctly here — that hardening is validated.

#### Evidence: `demo-ready` reaches canonical only via a separate promote step

In **all four** demo runs in the mobile-UI cohort, the demo agent pushed its evidence and `demo-ready` state to its `*-demo-agent-*` side branch first, where the #127 canonical guard correctly ignored it, and the transition reached the canonical branch only in a later "promote" commit:

| Issue | Last side-branch demo push | Canonical promote pushed | Promote commit authored | Commit → push |
|-------|---------------------------|--------------------------|-------------------------|---------------|
| #141 | 14:56:22 | 15:39:17 | 15:11:35 | 27 m 42 s |
| #142 | 17:13:10 | 18:04:16 | 17:26:07 | 38 m 09 s |
| #143 | 19:15:16 | 20:59:50 (after two crashed attempts) | 19:28:40 | 1 h 31 m 10 s |
| #144 | 08:06:12 | 09:46:20 | 08:19:57 | 1 h 26 m 23 s |

Two things follow. First, the demo skill is the only late-stage skill with **no** canonical-branch instruction — `grep -c canonical` gives `create-pr/SKILL.md: 2` and `demo/SKILL.md: 0` (also 0 for `planning`, `execute`, `babysit-pr`). Second, the promote merge is exactly where the conflict markers came from in #143 and #144. Third, the commit-to-push delay shows agents finish the state transition long before their final push — the handoff cannot start until then, and no skill step confirms it did.

#### `retry-deferred` cannot recover any of this

`.github/workflows/cursor-workflow-retry-deferred.yml` lists open issues with `cursor:*-ready` labels, reads branch-tip state, and **skips unless `.handoff_deferred.skill` is non-empty**:

```bash
deferred=$(jq -r '.handoff_deferred.skill // empty' /tmp/workflow.state.json)
if [ -z "$deferred" ] || [ "$deferred" = "null" ]; then continue; fi
```

`handoff_deferred` is written only by `record_deferred_exhaust` in `cursor-workflow-spawn-agent.sh`, reached only after in-job backoff exhausts a `defer:*` decision. A job that dies on exit 5 (bad JSON), exit 4 (agents-list failure), or exit 1 (GitHub 502) never gets there. All **51** scheduled retry-deferred runs between 2026-07-24 and 2026-07-27 (148 repo-wide, every one `success`) completed having found nothing to do. **The self-healing story in [WORKFLOW.md § Handoff recovery](WORKFLOW.md) covers only "spawn declined", never "job crashed".**

### Failure taxonomy table

| # | Pattern | Seen in this cohort | Known? | Landed mitigation | Gap |
|---|---------|--------------------|--------|-------------------|-----|
| 1 | **Unresolved git conflict markers in `workflow.state.json` crash the handoff job before any spawn or notification** | 11 crashed jobs — #136 `plan-ready` (2 canonical + 2 side), #142 `execute-in-progress` (2 canonical + 1 side), #143 `demo-ready` (2 canonical), #140 (1 side), #144 (1 side) | **NEW** | none | No `jq empty` guard in the handoff YAML; `validate-state.sh` not wired into any workflow or the script bundle; merge helper bypassable by a plain `git merge` |
| 2 | **Cursor agents-list / run-detail API 429 or 503 under the N+1 fan-out** | #142 `execute-ready`, #143 `spec-ready` (both 429); 503s in #142 ×4, #144 ×1 | Partly — [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) hit the *same script* via `jq` ARG_MAX | [#117](https://github.com/BlackLodgeLabs/cuebox/issues/117) file-based jq; [#118](https://github.com/BlackLodgeLabs/cuebox/issues/118) notify-stalled — notifier fired correctly | No retry/backoff on transport errors; no rate limiting; the fan-out itself is the load source |
| 3 | **Transient GitHub 502 in the cosmetic label sync aborts the spawn** | #144 `spec-ready` | **NEW** | none | `sync-github-status.sh` is called without `\|\| true` at the top of the handoff step; a label edit failure kills the spawn |
| 4 | **`*-ready` pushed to an agent side-branch only; canonical guard drops it** | #141, #142, #143, #144 demo runs (all promoted later) | Related to [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92) but inverted by [#127](https://github.com/BlackLodgeLabs/cuebox/issues/127) | #127 canonical guard; create-pr skill § "Canonical branch required" | Demo/planning/execute/babysit skills say nothing about canonical branch |
| 5 | **No notification when the handoff job crashes** | #136, #143 `demo-ready`, #144 — 3 of 5 failures silent | **NEW** | #111/#118 notifier covers *declined* spawns only | Notifier is invoked from inside the script; a crashed job never reaches it. No job-level `if: failure()` step |
| 6 | **`retry-deferred` cron is blind to hard failures** | 0 recoveries / 51 scheduled runs | **NEW** | — | Gate on `handoff_deferred` only; should also gate on "`*-ready` label older than N minutes with `agents.<target>` null" |
| 7 | **Silent cap undercount when a run-detail `curl` fails** | latent; 503s observed | **NEW** | — | `pipefail` collapses curl 22 into jq 1, which the caller reads as "does not count" |
| 8 | **`prUrl`-filtered agents list can feed the global cap count** | latent | **NEW** | — | `discover-agents.sh` exports `CURSOR_AGENTS_STATE_FILE` before writing the shared cache |
| 9 | Rapid multi-push orphaning a stage transition | **not observed** (0 cancelled runs in cohort) | [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) | [#119](https://github.com/BlackLodgeLabs/cuebox/issues/119) demo single-push, [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92) create-pr batching | Held — but second pushes now serialise for 5+ min instead |
| 10 | `active_skill` not cleared at `execute-ready` | **not observed** — agents pushed explicit "clear skill lock" commits | [#26](https://github.com/BlackLodgeLabs/cuebox/issues/26), [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) | Execute/demo finalize contract + stage-rank override | Held; but the clear is a *second* push that serialises (patterns 9 and 4 interact) |
| 11 | `handoff_pending` / `defer:*` / 8-run cap blocking | **not observed** — 0 deferrals, 0 at-cap | [#70](https://github.com/BlackLodgeLabs/cuebox/issues/70), [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84), [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) | Admission gate, pending lock, cross-run dedup | Held. Also: 4 `skip:duplicate-handoff` results, all correct |
| 12 | Duplicate/triple spawns | **not observed** — every skill recorded exactly one agent id | [#28](https://github.com/BlackLodgeLabs/cuebox/issues/28), [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79), [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84), [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92) | #84/#88, #90/#94, #127 | Held — the dedup work is a success story |

Read together: **the historically-tracked failure modes (patterns 9–12) are fixed.** Every failure in this cohort is a *new* class — malformed input, transport errors, or the absence of a crash notifier — and every one of them is a case of the orchestrator being brittle against inputs and dependencies rather than against concurrency.

### Recommendations

**1. Automation fixes (highest value).**

- **Validate the state file before using it.** In `.github/workflows/cursor-workflow-handoff.yml`, immediately after `git show … > /tmp/workflow.state.json`, run `jq empty` (or `scripts/cursor-workflow-validate-state.sh`). On failure: post a stalled notification with reason `invalid-state-json` including the offending commit SHA, then exit 0 rather than 5. This converts the cohort's largest failure class from a silent crash into an actionable, notified event. Wire `validate-state.sh` into `cursor-workflow-load-scripts.sh` so it is available.
- **Add a job-level crash notifier.** A final step with `if: failure()` that calls `cursor-workflow-notify-stalled.sh` with reason `handoff-job-failed` and a link to the run. Today the notifier lives *inside* the script, so any hard exit bypasses it — 3 of 5 failures were silent.
- **Make the status sync non-fatal.** The label/comment sync at the top of the handoff step is cosmetic relative to spawning the next agent; a GitHub 502 there must not abort the handoff. Either `|| echo "::warning::status sync failed"` it, or move the spawn ahead of the sync. Add retry-with-backoff inside `sync-github-status.sh` for 5xx.
- **Retry transport errors in the fan-out.** Wrap the Cursor API calls in a bounded retry (3 attempts, jittered backoff) that distinguishes 429/5xx from 4xx, and — per Topic 1 — remove the fan-out so there is far less to retry.
- **Broaden `retry-deferred` into a true watchdog.** Recover any open issue whose `cursor:*-ready` label has been set for more than ~10 minutes while branch-tip `agents.<target>` is null, regardless of `handoff_deferred`. That single change would have automatically recovered all 5 cohort failures within one cron tick, including both ~1 h 55 m stalls.
- **Fail closed on an unknown cap.** Treat a failed run-detail fetch as unknown rather than "does not count" (pattern 7).

**2. Skill and doc changes.**

- Add the **"Canonical branch required"** block from `create-pr/SKILL.md` to `demo/SKILL.md` (and, more briefly, to `planning`, `execute`, `babysit-pr`). All four `demo-ready` transitions in the cohort needed a manual promote.
- Make the **merge helper mandatory and verifiable** on side-branch merges: after any `git merge` that touches `workflow.state.json`, require `bash scripts/cursor-workflow-merge-state.sh <path>` **and** `jq empty <path>` before `git add`. Add "never `git add` a `workflow.state.json` containing `<<<<<<<`" to each skill's *Do not* list.
- Better still, **stop merging the file**: give `workflow.state.json` a `merge=ours`-style `.gitattributes` entry or a custom merge driver that always defers to `cursor-workflow-merge-state.sh`. The file is machine-owned with well-defined merge semantics already implemented; letting git line-merge it is the root of pattern 1.
- Update [RETROSPECTIVES.md](RETROSPECTIVES.md) § Recurring patterns with rows for patterns 1, 2 (429 variant), 3, 5, and 6, citing this review.

**3. Operator playbook ([OPERATIONS.md](OPERATIONS.md)).**

- Add a **"handoff job failed"** row to § When handoff stalls: check the Actions run conclusion first; `jq: parse error` means a bad state file on the branch tip (fix the file and push, or dispatch a resync); `429`/`503` means Cursor API throttling (wait and dispatch a resync); `failed to update N issue` means a GitHub blip (dispatch a resync).
- Note that a `workflow_dispatch` resync is currently the **fastest** recovery (it runs `handoff-recovery.sh` unconditionally): the two resync recoveries took 11–22 min, while the two agent/human-comment recoveries took ~1 h 55 m.
- Warn that running two issues in parallel measurably raises the 429 risk while the fan-out remains.

---

## Topic 3 — Wait-for-handoff in skills

### Current behavior

No handoff skill verifies that its handoff actually fired. Each ends at the push.

- **`planning`** — § *Git and labels*: *"1. Commit plan + demo-spec + bug-repro artifacts (if any) + updated state; push branch. 2. Set `stage: plan-ready`, `active_skill: null` (or omit). Issue labels/comments are synced by GitHub Actions on push."* No verification step.
- **`execute`** — § *Finalize state*: *"Issue labels: synced by GitHub Actions on push. Push state file; handoff Action triggers demo."* The only post-push branch is the `pr`-is-null path, which tells the agent to ask a human to run a resync.
- **`demo`** — § *Git and state — batched final push*, step 7: *"**Single** `git push` → one handoff run spawns create-pr"*, then step 8 posts an MCP summary. Closes with *"Handoff Action triggers create-pr."* No canonical-branch instruction and no verification.
- **`create-pr`** — step 8: *"**Single** `git push` to the **canonical branch** (`workflow.state.json` → `.branch`) → one handoff run"*, plus an explicit **Canonical branch required** warning. This is the only skill that reasons about *where* the push lands — still nothing about whether the handoff succeeded.
- **`babysit-pr`** — terminal stage; §: *"**Commit and push** the state file to the issue branch (required so remote automation sees the terminal state and stops handoffs) … **Stop** — no further automated handoffs."* Correctly has nothing to wait for.

So the contract today is *fire and forget*, and the cohort shows the cost: in 5 of 30 transitions the agent declared success while the handoff job had already crashed, and the pipeline sat idle for 9 minutes to 1 h 55 m until a human or a later agent noticed.

### Options

| Approach | Pros | Cons |
|----------|------|------|
| **A. Add wait-for-handoff to every handoff skill** | Directly closes the gap at the exact point of failure; each skill already has a natural "after final push" step | Duplicated prose in 4 skills that must stay in sync; burns agent wall-clock and tokens polling; with a 351 s median spawn latency every agent would idle ~6 min; skills are the least reliable place to enforce anything (agents skip steps) |
| **B. One rule in `WORKFLOW.md` + automation-prompts, referenced by each skill** | Single source of truth; the spawn prompts in `cursor-workflow-handoff.yml` / `handoff-recovery.sh` can carry it verbatim so every spawned agent gets it; cheap to change | Still relies on agent compliance; needs a concrete, checkable "done" test or it degrades into advice |
| **C. Post-push verification helper (`scripts/cursor-workflow-verify-handoff.sh`)** | Deterministic and testable; one command per skill (`bash scripts/cursor-workflow-verify-handoff.sh <issue> <target-skill>`); can poll branch-tip `agents.<skill>` and `gh run list` for the triggering SHA; gives the agent a clear signal to escalate | New portable-core script to maintain and register in `load-scripts.sh` / `verify-workflow-portable.sh`; the agent still has to be told to run it |
| **D. Reliability fixes so waiting is unnecessary** | Removes the need entirely for the three failure classes actually observed; no agent time spent waiting; benefits manual and cron paths equally | Cannot cover *every* future failure; a residual backstop is still valuable |

### Recommendation

**Do D first, then B implemented with C — and explicitly not A.**

Waiting is the wrong primary fix: the cohort's failures were a crashing job, a throttled API, and a GitHub blip. A watchdog (`retry-deferred` broadened per Topic 2) plus a JSON guard plus an `if: failure()` notifier fixes all five instances automatically, in seconds, without any agent idling. Adding a 6–10 minute poll to four skills would have detected those failures but not fixed them, and would have added roughly **30 minutes of agent idle time per issue** on top of the 25–34 minutes the gate already costs.

Concretely:

1. **Land the Topic 2 automation fixes** (state-file validation + notification, `if: failure()` notifier, non-fatal status sync, watchdog recovery on stale `*-ready`). Target: every failed transition self-heals or notifies within one cron tick.
2. **Add `scripts/cursor-workflow-verify-handoff.sh <issue> <target-skill> [--timeout 600]`** to the portable core. It should: resolve the canonical branch from `workflow.state.json`; assert `GITHUB_REF`/pushed ref equals `state.branch` (catching pattern 4 immediately, before any polling); poll `origin/<branch>:workflow/issues/issue-NNN/workflow.state.json` for `agents.<target-skill>`; check `gh run list --workflow "Cursor workflow handoff" --commit <sha>` for a non-`success` conclusion and fail fast on it rather than waiting out the timeout; and exit with a distinct code plus a one-line reason (`spawned` / `handoff-run-failed` / `wrong-branch` / `timeout`).
3. **State the rule once** in [WORKFLOW.md](WORKFLOW.md) (new § *Handoff verification*) and mirror it into `workflow/cursor-workflow/automation-prompts` and the spawn prompts, so every handoff agent receives it in-band. Each of `planning`, `execute`, `demo`, `create-pr` then gets a **one-line** pointer in its final-push section — not a duplicated procedure.
4. **Done criteria for an agent at a handoff stage** (the checkable definition):

   > After your final push you are **not** finished until one of the following is true:
   > 1. `origin/<canonical-branch>` records `agents.<next-skill>` (verified by `cursor-workflow-verify-handoff.sh`) — report the spawned agent id and stop; **or**
   > 2. the handoff run for your pushed SHA concluded non-`success` — report the run URL, the failure reason, and (if it is a state-file problem you caused) fix and re-push once; **or**
   > 3. a stalled notification with marker `<!-- cursor-workflow-stalled-notify:v1 -->` exists on the issue — report it and stop; **or**
   > 4. **10 minutes** have elapsed — report `handoff-unconfirmed` with the run URL so the operator can dispatch a resync.
   >
   > A push whose ref is not `state.branch` never counts as condition 1 — promote to the canonical branch first.

   The 10-minute budget is set from measured data (median spawn latency 351 s, max 527 s, plus up to ~350 s of concurrency wait behind a peer run), and should be tightened to ~2 minutes once the Topic 1 fan-out fix lands.

5. **Guardrail:** the verification must never itself trigger another handoff. It is read-only (`git fetch` + `gh run list`); it must not push, and must not retry the spawn.

---

## Appendix A — Cohort handoff matrix (issues ≥ #136)

Spawn latency = `Handoff:` (or `Handoff recovery: spawning`) → `Cursor agent created`. All times UTC. `gate1` = handoff decision → `handoff_pending=set`; `gate2` = pending lock → `POST` success.

| Issue | Branch / PR | Transition | Handoff run | Bucket | gate1 | gate2 | Spawn latency | Outcome |
|-------|-------------|-----------|-------------|--------|-------|-------|---------------|---------|
| **#136** | `cursor/issue-136-home-search-picker-e134` / PR #138 | `spec-ready` → planning | [30091044828](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30091044828) | B | 185 s | 119 s | 304 s | `planning=bc-6fb95dd4…` |
| #136 | | `plan-ready` → execute | [30091769827](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30091769827), [30091791070](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30091791070) | **E** | — | — | — | **exit 5, conflict markers**; recovered by dispatch [30092598075](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30092598075) → `execute=bc-be4a1afe…` at 12:26:53 |
| #136 | | `execute-ready` → demo | [30093970278](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30093970278) | B | 224 s | 99 s | 323 s | `demo=bc-334a78b6…` |
| #136 | | `demo-ready` → create-pr | [30095196849](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30095196849) | B | 298 s | 147 s | 445 s | `create-pr=bc-30c29872…` |
| #136 | | `create-pr-ready` → babysit | [30095875398](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30095875398) | B | 202 s | 107 s | 309 s | `babysit-pr=bc-30256631…` |
| **#140** | `cursor/issue-140-home-inline-search-8d81` / PR #147 | `spec-ready` → planning | [30112944516](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30112944516) | B | 242 s | 135 s | 377 s | `planning=bc-af08e652…` |
| #140 | | `plan-ready` → execute | [30113946201](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30113946201) | B | 341 s | 159 s | 500 s | `execute=bc-76f97ee9…` |
| #140 | | `execute-ready` → demo | [30115600557](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30115600557) | B | 219 s | 106 s | 325 s | `demo=bc-5fd4423a…` |
| #140 | | `demo-ready` → create-pr | [30116558080](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30116558080) | B | 375 s | 152 s | 527 s | `create-pr=bc-18adf498…` |
| #140 | | `create-pr-ready` → babysit | [30117284313](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30117284313) | B | 197 s | 100 s | 297 s | `babysit-pr=bc-2bb77532…` |
| **#141** | `cursor/issue-141-mobile-ui-app-shell` / PR #149 | `spec-ready` → planning | [30205134470](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30205134470) | B | 277 s | 152 s | 429 s | `planning=bc-caf9c408…` (753 s wall — slowest run in cohort) |
| #141 | | `plan-ready` → execute | [30205680695](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30205680695) | B | 275 s | 131 s | 406 s | `execute=bc-d2c2c8bd…` |
| #141 | | `execute-ready` → demo | [30206558747](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30206558747) | B | 213 s | 104 s | 317 s | `demo=bc-923f5439…` |
| #141 | | `demo-ready` → create-pr | [30208662364](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30208662364) | B | 290 s | 130 s | 420 s | `create-pr=bc-08f04666…`; required promote commit (side-branch `demo-ready` at 14:56) |
| #141 | | `create-pr-ready` → babysit | [30208994411](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30208994411) | B | 205 s | 92 s | 297 s | `babysit-pr=bc-d5da7045…` |
| **#142** | `cursor/issue-142-home-hub-composition` / PR #150 | `spec-ready` → planning | [30210413254](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30210413254) | B | 260 s | 130 s | 390 s | `planning=bc-1ddaaaf3…`; 1× Cursor 503 |
| #142 | | `plan-ready` → execute | [30210908228](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30210908228) | B | 230 s | 108 s | 338 s | `execute=bc-edb4fb3b…`; 3× Cursor 503 |
| #142 | | `execute-ready` → demo | [30211387136](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211387136) | **E** | — | — | — | **429 → `agents-list-fetch-failed`, exit 4, stalled notice**; recovered by dispatch [30211570664](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211570664) → `demo=bc-15557316…` at 17:05:26 |
| #142 | | `demo-ready` → create-pr | [30213926130](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30213926130) | B | 311 s | 154 s | 465 s | `create-pr=bc-4810224a…`; required promote commit |
| #142 | | `create-pr-ready` → babysit | [30214465547](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30214465547) | B | 236 s | 115 s | 351 s | `babysit-pr=bc-3a40cc74…` |
| **#143** | `cursor/issue-143-watchlist-poster-grid` / PR #151 | `spec-ready` → planning | [30211231599](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211231599) | **E** | — | — | — | **429, exit 4, stalled notice**; recovered by human `@cursoragent use planning skill` at 18:39:37 → `planning=bc-9f9c47fb…` |
| #143 | | `plan-ready` → execute | [30215255032](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30215255032) | B | 318 s | 151 s | 469 s | `execute=bc-6e9980d2…` |
| #143 | | `execute-ready` → demo | [30215879956](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30215879956) | B | 319 s | 157 s | 476 s | `demo=bc-f8059baf…` |
| #143 | | `demo-ready` → create-pr | [30216452102](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30216452102), [30216460965](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30216460965) | **E** | — | — | — | **exit 5, conflict markers, no notice**; recovered 1 h 53 m later by recovery in [30220140939](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30220140939) → `create-pr=bc-f97808ea…` |
| #143 | | `create-pr-ready` → babysit | [30220702066](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30220702066) | B | 202 s | 101 s | 303 s | `babysit-pr=bc-c0b3bf28…` |
| **#144** | `cursor/issue-144-mobile-ui-film-detail` / PR #152 | `spec-ready` → planning | [30244605615](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30244605615) | **E** | — | — | — | **GitHub 502 in label sync, exit 1, no notice**; recovered by recovery in [30245531669](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30245531669) → `planning=bc-d0b93ea7…` (14 s spawn) |
| #144 | | `plan-ready` → execute | [30245725432](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30245725432) | B | 224 s | 118 s | 342 s | `execute=bc-8acca2a6…` |
| #144 | | `execute-ready` → demo | [30246560238](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30246560238) | B | 201 s | 100 s | 301 s | `demo=bc-131187e5…` |
| #144 | | `demo-ready` → create-pr | [30255344904](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30255344904) | B | 344 s | 168 s | 512 s | `create-pr=bc-37cdf19d…`; required promote commit |
| #144 | | `create-pr-ready` → babysit | [30256429022](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30256429022) | B | 228 s | 105 s | 333 s | `babysit-pr=bc-28d2466d…`; 1× Cursor 503 |

Baseline (immediately pre-cohort, same post-#127 code): **#89** on `cursor/issue-89-import-watched-list-9ab1` ran 2026-07-20 with canonical handoff runs of 379 s, 382 s, 443 s, 290 s — consistent with the cohort, confirming the slowness is code-driven, not cohort-specific.

Human / agent interventions observed on issue threads:

| Issue | Intervention | Timestamp |
|-------|--------------|-----------|
| #136 | `workflow_dispatch` resync (Actions) | 12:18:20 |
| #142 | `workflow_dispatch` resync (Actions) | 16:57:48 |
| #142 | stalled notice, reason `agents-list-fetch-failed` | 16:54:04 |
| #143 | stalled notice, reason `agents-list-fetch-failed` | 16:54:05 |
| #143 | `@cursoragent use planning skill for issue … #143 on branch …` | 18:39:37 |
| #143 | agent-authored `re-trigger demo-ready handoff` push | 20:59:50 |
| #144 | agent-authored `re-trigger handoff` push | 07:16:10 |

Issues **#145**, **#146** had not entered the workflow at review time (no `cursor/issue-145-*` / `cursor/issue-146-*` branch, no handoff runs). Issues **#142**, **#143**, **#144** carry `cursor:complete` and remain open pending merge of PRs #150–#152 into `feature/mobile-ui`.

---

## Appendix B — Chronology of handoff-related changes (issues / PRs)

Merges to `main` touching `.github/workflows/cursor-workflow*.yml`, `scripts/cursor-workflow-*.sh`, or `workflow/cursor-workflow/WORKFLOW.md`.

| Date | Issue | PR | Change | Effect seen in cohort |
|------|-------|----|--------|----------------------|
| 2026-07-08 | [#91](https://github.com/BlackLodgeLabs/cuebox/issues/91) | [#98](https://github.com/BlackLodgeLabs/cuebox/pull/98) | Prevent demo spawn before execute cycle completes (`skip:execute-in-progress`, `defer:execute-active`) | Held — no premature demo spawn observed |
| 2026-07-11 | [#103](https://github.com/BlackLodgeLabs/cuebox/issues/103) | [#104](https://github.com/BlackLodgeLabs/cuebox/pull/104) | Post-merge auto-delete of agent side-branches | Working — merged issues' side-branches gone; #141–#144 still present pending merge |
| 2026-07-12 | [#105](https://github.com/BlackLodgeLabs/cuebox/issues/105) | [#107](https://github.com/BlackLodgeLabs/cuebox/pull/107) | GitHub MCP adoption in skills | Visible — `cursor[bot]` question/summary comments on #136 |
| 2026-07-12 | [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) | [#112](https://github.com/BlackLodgeLabs/cuebox/pull/112) | Execute must clear `active_skill` at `execute-ready`; stage-rank override | Held — but the clear arrives as a *second* push (#140, #144) that serialises for 5+ min |
| 2026-07-13 | [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) | [#113](https://github.com/BlackLodgeLabs/cuebox/pull/113) | Honest labels on failed spawn (no false `*-in-progress`) | Held — #142/#143 kept `execute-ready` / `spec-ready` after their 429s |
| 2026-07-13 | [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111) | [#114](https://github.com/BlackLodgeLabs/cuebox/pull/114) | Replace PAT `@cursoragent` fallback with `notify-stalled.sh` | **Validated** — fired correctly for both 429s; **gap:** cannot fire when the job crashes |
| 2026-07-15 | [#117](https://github.com/BlackLodgeLabs/cuebox/issues/117) | [#121](https://github.com/BlackLodgeLabs/cuebox/pull/121) | Avoid `jq --argjson` ARG_MAX in `fetch-agents-list.sh` | Held — no ARG_MAX failures; the same script now fails on 429/503 instead |
| 2026-07-15 | [#118](https://github.com/BlackLodgeLabs/cuebox/issues/118) | [#124](https://github.com/BlackLodgeLabs/cuebox/pull/124) | `notify-stalled` on agent-list fetch hard-fail; remove `\|\| true` masking | **Validated** by the #142/#143 429 path |
| 2026-07-15 | [#119](https://github.com/BlackLodgeLabs/cuebox/issues/119) | [#125](https://github.com/BlackLodgeLabs/cuebox/pull/125) | Demo single-push `demo-ready` finalize | Held — 0 cancelled runs in cohort (last repo-wide cancellation 2026-07-17). Doc rationale is wrong (`cancel-in-progress` is `false`) |
| 2026-07-16 | [#126](https://github.com/BlackLodgeLabs/cuebox/issues/126) | [#128](https://github.com/BlackLodgeLabs/cuebox/pull/128) | Tier-aware late-stage skills, config indirection | Working — `workflow.config.yaml` resolved in all runs |
| 2026-07-17 | [#122](https://github.com/BlackLodgeLabs/cuebox/issues/122) | [#129](https://github.com/BlackLodgeLabs/cuebox/pull/129) | Portable core / adapter split; config bootstrap in Actions | Working |
| 2026-07-17 | [#127](https://github.com/BlackLodgeLabs/cuebox/issues/127) | [#130](https://github.com/BlackLodgeLabs/cuebox/pull/130) | Canonical branch guard, per-issue same-skill serialization, honest labels, `skip:duplicate-handoff`, `handoff_deferred` + retry cron, opt-in late-stage resume | **Mixed.** Guard and dedup work (109 side-branch no-ops, 4 correct `skip:duplicate-handoff`, 0 duplicate spawns). **Serialization is the cause of the 6 % → 34 % slow-run regression.** `handoff_deferred` never set → retry cron recovered nothing in 39 runs |
| 2026-07-17 | — | [#130](https://github.com/BlackLodgeLabs/cuebox/pull/130) | `OPERATIONS.md` operator checklist | Useful, but has no row for "handoff job failed" |

**No handoff-behaviour change has merged to `main` since 2026-07-17.** The entire primary cohort ran on the post-#127 code, so the cohort is a clean read on the current orchestrator.

---

## References

**Documentation**

- [WORKFLOW.md](WORKFLOW.md) — stages, `handoff_pending`, recovery, § Performance optimizations (#77), § v1 orchestration hardening (#127), § Expected run-time targets, § Demo push batching (#119)
- [OPERATIONS.md](OPERATIONS.md) — runs vs ACTIVE workspaces, pre-flight, § When handoff stalls, resync vs `@cursoragent`
- [RETROSPECTIVES.md](RETROSPECTIVES.md) — index and § Recurring patterns
- [workflow.config.yaml](workflow.config.yaml) — `orchestration.max_active_agents: 8`, `handoff_pending_stale_minutes: 15`, `per_issue_spawn_serialization: true`, `late_stage_resume: false`

**Code read**

- `.github/workflows/cursor-workflow-handoff.yml` — canonical guard (unguarded `jq -r '.branch'` at the top of the dispatch step), `concurrency.cancel-in-progress: false`, `handoff()` / `is_skip_stage()` / recovery calls
- `.github/workflows/cursor-workflow-retry-deferred.yml` — `handoff_deferred`-only gate
- `scripts/cursor-workflow-spawn-agent.sh` — `BACKOFF=(30 60 120)`, `MAX_ATTEMPTS=3`, double admission gate, `record_deferred_exhaust`, `fail_pre_spawn_admission`
- `scripts/cursor-workflow-admission-gate.sh` — cap check (cached), per-issue same-skill check (**not** cached), demo preconditions
- `scripts/cursor-workflow-count-active-agents.sh` — per-workspace `GET /v1/agents/{id}/runs/{run_id}` fan-out; `pipefail` collapse of curl failures
- `scripts/cursor-workflow-count-in-flight-for-issue.sh` — second, uncached fan-out (#127)
- `scripts/cursor-workflow-fetch-agents-list.sh` — list-page cache, `prUrl` filter
- `scripts/cursor-workflow-handoff-recovery.sh` — `--agents-from-tip` refetch, `skip:duplicate-handoff`, draft-PR check
- `scripts/cursor-workflow-merge-state.sh`, `scripts/cursor-workflow-validate-state.sh` (exists, unwired), `scripts/cursor-workflow-discover-agents.sh`
- `.cursor/skills/{planning,execute,demo,create-pr,babysit-pr}/SKILL.md` — final-push sections

**Key evidence commits (malformed state files)**

- `51c24ec3be8cac43f04975ad6678f1a763360e9d` — issue #136, `spec-ready` / `plan-ready` conflict
- `cae92fe1e18edc49468494ac4b17829098ee661f` — issue #143, `execute-ready` / `demo-ready` conflict
- `4b36593fd85e6487244014315f05ac9d995eeaa1` — issue #144, `demo-in-progress` / `execute-ready` conflict

**Key Action runs**

- Slowest run: [30205134470](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30205134470) (753 s wall / 606 s work, #141 `spec-ready`)
- 429 pair: [30211231599](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211231599), [30211387136](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211387136)
- Conflict-marker crashes: [30091769827](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30091769827), [30091791070](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30091791070), [30216452102](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30216452102), [30216460965](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30216460965), [30211160067](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211160067), [30211170109](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211170109)
- GitHub 502 crash: [30244605615](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30244605615)
- Recovery successes: [30092598075](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30092598075) (dispatch), [30211570664](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30211570664) (dispatch), [30220140939](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30220140939) (push recovery), [30245531669](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30245531669) (push recovery, 14 s spawn)
- Concurrency serialization: [30246560238](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30246560238) / [30246574745](https://github.com/BlackLodgeLabs/cuebox/actions/runs/30246574745) pair

**Issue threads**

- [#136](https://github.com/BlackLodgeLabs/cuebox/issues/136), [#140](https://github.com/BlackLodgeLabs/cuebox/issues/140), [#141](https://github.com/BlackLodgeLabs/cuebox/issues/141), [#142](https://github.com/BlackLodgeLabs/cuebox/issues/142), [#143](https://github.com/BlackLodgeLabs/cuebox/issues/143), [#144](https://github.com/BlackLodgeLabs/cuebox/issues/144)
