# Issue #91: Prevent demo spawn before execute-ready from issue #84 workflow review

## Summary

Harden the cursor-workflow handoff so **demo** never spawns while execute is still in progress. During issue [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84), demo spawned at **06:26 UTC** while the execute agent was still landing implementation commits (**06:18–06:29**), before the final `execute-ready` at **06:30**. Demo ran against incomplete code, issued pass-back to execute ([`2da7651`](https://github.com/BlackLodgeLabs/cuebox/commit/2da7651aa655acc39e5f318930ca0a7861d4095a)), and wasted one demo cycle plus a failed handoff run [28923441600](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923441600).

This issue adds explicit admission-gate and recovery guards so demo dispatch requires a finished execute cycle, not merely a transient `execute-ready` transition while the execute agent is still active.

## Problem

### Observed failure (issue #84)

| Time (UTC) | Event | `stage` on branch tip | `active_skill` |
|------------|-------|----------------------|----------------|
| 06:02 | Execute sets `execute-in-progress` locally ([`2890311`](https://github.com/BlackLodgeLabs/cuebox/commit/2890311)) | `plan-ready` (did not persist) | `execute` |
| 06:18–06:20 | Implementation commits ([`b03b5f1`](https://github.com/BlackLodgeLabs/cuebox/commit/b03b5f1ce9afb863f80e8966e0fca59634df3149), [`ed2572c`](https://github.com/BlackLodgeLabs/cuebox/commit/ed2572c)) | `plan-ready` | `execute` |
| 06:24 | Premature `execute-ready` ([`3a7a5f5`](https://github.com/BlackLodgeLabs/cuebox/commit/3a7a5f5)) | `execute-ready` | `execute` |
| 06:26 | **Demo spawned** ([`3565599`](https://github.com/BlackLodgeLabs/cuebox/commit/3565599d6a93d5295b77701ae8460aedd474ea0e)) | `plan-ready` (record-spawn merge) | `demo` |
| 06:29 | More implementation ([`6735ffa`](https://github.com/BlackLodgeLabs/cuebox/commit/6735ffad811635e7aeb7adf9916769c829a0cdd8)) | `plan-ready` | `demo` |
| 06:30 | Final `execute-ready` ([`7ac19a7`](https://github.com/BlackLodgeLabs/cuebox/commit/7ac19a708d0bcde6b0411d13d8efbd99a68d5dc6)) | `execute-ready` | `execute` |

**Root cause:** Handoff fired demo on the `execute-ready` transition at 06:24 while `active_skill` was still `execute` and implementation commits continued. Branch tip often never showed `execute-in-progress` (monotonic merge / concurrent pushes kept `plan-ready`), so the existing `is_skip_stage` guard for `execute-in-progress` did not apply.

### Gap in current guards

| Path | Current behavior | Gap |
|------|------------------|-----|
| `handoff()` on stage transition | Skips progress stages via `is_skip_stage` | Demo can spawn on premature `execute-ready` while execute is still active |
| `cursor-workflow-handoff-recovery.sh` | Spawns demo when `stage=execute-ready` and `agents.demo` null | No check that execute cycle finished |
| `cursor-workflow-admission-gate.sh` | Dedup, pending lock, cap | No stage/skill precondition for target skill |

**Prerequisite work (landed; orthogonal):**

| Issue | PR | Relevance |
|-------|-----|-----------|
| [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88) | Spawn dedup — did not prevent early demo |
| [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) | [#96](https://github.com/BlackLodgeLabs/cuebox/pull/96) | Recovery gaps — demo recovery path exists |
| [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) | [#94](https://github.com/BlackLodgeLabs/cuebox/pull/94) | record-spawn TOCTOU — separate concern |

## Acceptance criteria

- [ ] Handoff does **not** spawn demo when `stage=execute-in-progress` (or equivalent in-progress execute stage)
- [ ] Demo spawn only fires when `stage=execute-ready` (normal path) or recovery explicitly targets demo with valid preconditions
- [ ] Admission gate or handoff YAML documents and enforces execute-in-progress skip for demo skill
- [ ] Admission gate defers demo when `active_skill=execute` (execute agent still owns the branch — closes the #84 forensic gap where `execute-in-progress` never persisted on tip)
- [ ] Regression test: state at `execute-in-progress` with implementation diff on branch → no demo spawn log, 0 POST
- [ ] Regression test: state at `execute-ready` with `active_skill=execute` → demo deferred (`defer:execute-active` or equivalent), 0 POST
- [ ] Regression test: state at `execute-ready` with `active_skill` cleared or non-execute → demo spawn proceeds as today
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `workflow/cursor-workflow/WORKFLOW.md` updated with execute-in-progress → demo deferral rule

## Scope

### In scope

- `scripts/cursor-workflow-admission-gate.sh` — stage/skill preconditions for `demo` target (primary enforcement point; shared by `handoff()` and recovery)
- `.github/workflows/cursor-workflow-handoff.yml` — document guard; optional belt-and-suspenders skip before `handoff()` demo dispatch
- `scripts/cursor-workflow-handoff-recovery.sh` — inherits gate via existing `cursor-workflow-admission-gate.sh` call (no local-only bypass)
- `scripts/test-cursor-workflow-handoff.sh` — execute-in-progress and execute-active demo skip cases
- `workflow/cursor-workflow/WORKFLOW.md` — coverage table + cross-run dedup section update

### Out of scope

- Spawn dedup / record-spawn TOCTOU ([#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) follow-ups) — separate issues
- [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) recovery gaps — landed in PR [#96](https://github.com/BlackLodgeLabs/cuebox/pull/96)
- Execute skill prompt changes (execute agent should still set `execute-ready` in one final commit — existing skill behavior; premature `execute-ready` is a separate hygiene issue)
- Application code, database, frontend
- Blocking demo on premature `execute-ready` by git-diff heuristics alone (admission gate on `active_skill` is the chosen signal)

## User flows / API changes

No end-user UI or API changes. Workflow operators should observe:

| Scenario | Before | After |
|----------|--------|-------|
| Execute landing implementation commits | Demo may spawn on intermediate `execute-ready` or while `active_skill=execute` | Demo deferred until execute cycle completes |
| Stage `execute-in-progress` on branch tip | `is_skip_stage` blocks transition handoff; recovery could still reach demo via stale `execute-ready` | Admission gate returns `skip:execute-in-progress` or `defer:execute-active` for demo |
| Final `execute-ready` after execute clears `active_skill` | Demo spawns (correct) | Unchanged — demo spawns |
| Post-review re-open (`execute-ready` → execute `--reopen`) | Spawns execute, not demo | Unchanged — reopen path unaffected |

**Implementation notes for planning:**

1. **Admission gate (primary)** — In `cursor-workflow-admission-gate.sh`, when `TARGET_SKILL=demo`:
   - If `stage=execute-in-progress` → `skip:execute-in-progress` (or `defer:execute-in-progress` if recovery should retry later)
   - If `stage` rank &lt; `execute-ready` (40) → `skip:stage-not-ready`
   - If `active_skill=execute` → `defer:execute-active` (covers #84 case)
   - Re-open path (`--reopen` flag) targets **execute**, not demo — no change needed

2. **Handoff YAML** — `is_skip_stage` already includes `execute-in-progress`; add a comment or explicit pre-check before demo dispatch in `handoff()` for documentation parity. Do not duplicate logic that belongs in the gate.

3. **Recovery** — `cursor-workflow-handoff-recovery.sh` already calls admission gate before spawn; new demo preconditions apply automatically after gate update. Verify recovery at `execute-ready` with `active_skill=execute` defers instead of spawning.

4. **Tests** — Extend `scripts/test-cursor-workflow-handoff.sh`:
   - `test_demo_skip_execute_in_progress`: `stage=execute-in-progress`, call gate/spawn for demo → skip/defer, 0 POST
   - `test_demo_defer_execute_active`: `stage=execute-ready`, `active_skill=execute` → defer, 0 POST
   - `test_demo_proceed_execute_ready`: `stage=execute-ready`, `active_skill=null` or `demo`, `agents.demo` null → proceed (mirror existing `test_execute_ready_forward`)

5. **Gate stdout contract** — New outcomes: `skip:execute-in-progress`, `defer:execute-active`. Document in WORKFLOW.md admission gate table. `spawn-agent.sh` already handles `defer:*` with backoff retry within job; `skip:*` exits without POST.

6. **Re-open inference** — `cursor-workflow-infer-reopen.sh` + recovery `execute-ready` → execute path must remain unaffected (gate runs with `TARGET_SKILL=execute`, not `demo`).

## Data and integration notes

- **GitHub Actions / shell scripts only** — no database, sync, or product API changes
- **Cursor Cloud Agents API** — demo spawn still uses existing `POST /v1/agents` via `cursor-workflow-spawn-agent.sh`; no new endpoints
- **Scripts loaded from `main`** — if helpers are extracted, register in `cursor-workflow-load-scripts.sh`
- **Mock testing** — use `MOCK_CURSOR_API=1`, `MOCK_CURSOR_POST_COUNT_FILE`; fixtures under `scripts/fixtures/cursor-workflow/`

## Open questions (must be empty before plan-ready)

_None — issue body, #84 WORKFLOW-REVIEW recommendation #4, and forensic timeline provide sufficient detail._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/91
- Source review: [Issue #84 WORKFLOW-REVIEW.md § Top recommendation #4](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md)
- Parent incident: [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88)
- Failed pass-back run: [28923441600](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923441600)
- Retrospectives index: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
