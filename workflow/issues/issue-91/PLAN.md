# Implementation plan — Issue #91: Prevent demo spawn before execute-ready

## Overview

Harden `cursor-workflow-admission-gate.sh` so **demo** never spawns while the execute cycle is still active. During issue #84, demo spawned at 06:26 UTC on a premature `execute-ready` transition while `active_skill` was still `execute` and implementation commits continued until 06:30. The fix adds demo-specific stage/skill preconditions to the shared admission gate (used by both transition `handoff()` and `cursor-workflow-handoff-recovery.sh`), with regression tests and WORKFLOW.md documentation.

This is **workflow infrastructure only** — no application code, Docker stack, or product API changes.

## Classification

**Workflow / infra** (not an app bug). Bug reproduction skipped per planning skill — the #84 forensic timeline in `SPEC.md` provides sufficient evidence.

## Root cause

| Layer | What happened |
|-------|----------------|
| Execute agent | Set `execute-ready` prematurely (06:24) before final implementation commits landed |
| `is_skip_stage` | Only blocks handoff when **current** `stage` is `execute-in-progress`; branch tip often stayed `plan-ready` due to monotonic merge / concurrent pushes |
| Admission gate | Had dedup, pending lock, and cap checks — **no** stage/skill preconditions for `demo` target |
| Recovery | Could spawn demo at `execute-ready` without checking whether execute still owned the branch (`active_skill=execute`) |

**Chosen signal:** `active_skill=execute` at `execute-ready` → defer demo (`defer:execute-active`). Complements `stage=execute-in-progress` → skip demo (`skip:execute-in-progress`).

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `scripts/cursor-workflow-admission-gate.sh` | Modify | Primary enforcement: demo stage/skill preconditions before generic `proceed` |
| `scripts/test-cursor-workflow-handoff.sh` | Modify | Three regression tests + update `test_execute_ready_forward` fixture clarity |
| `workflow/cursor-workflow/WORKFLOW.md` | Modify | Document new gate outcomes and execute→demo deferral rule |
| `.github/workflows/cursor-workflow-handoff.yml` | Modify (comment only) | Belt-and-suspenders documentation before demo dispatch in `handoff()` |
| `scripts/cursor-workflow-handoff-recovery.sh` | Verify only | Already calls admission gate — inherits new checks automatically |

## Implementation steps

### Step 1 — Admission gate demo preconditions

In `scripts/cursor-workflow-admission-gate.sh`, after existing dedup/pending/cap checks and **before** `echo "proceed"`, add a block when `TARGET_SKILL=demo`:

```bash
if [ "$TARGET_SKILL" = "demo" ]; then
  stage=$(jq -r '.stage // empty' "$STATE_FILE")
  active_skill=$(jq -r '.active_skill // empty' "$STATE_FILE")

  if [ "$stage" = "execute-in-progress" ]; then
    echo "skip:execute-in-progress"
    exit 0
  fi

  stage_rank=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "$stage")
  execute_ready_rank=$("$SCRIPT_DIR/cursor-workflow-stage-rank.sh" "execute-ready")
  if [ "$stage_rank" -lt "$execute_ready_rank" ]; then
    echo "skip:stage-not-ready"
    exit 0
  fi

  if [ "$active_skill" = "execute" ]; then
    echo "defer:execute-active"
    exit 0
  fi
fi
```

**Outcome semantics:**

| stdout | When | spawn-agent behavior |
|--------|------|----------------------|
| `skip:execute-in-progress` | `stage=execute-in-progress`, target `demo` | Exit 0, no POST, no retry |
| `skip:stage-not-ready` | Stage rank &lt; 40 (`execute-ready`) | Exit 0, no POST |
| `defer:execute-active` | `stage=execute-ready` (or higher) but `active_skill=execute` | Backoff retry (3 attempts); recovery defers and exits |

**Order:** Check `execute-in-progress` before rank comparison (explicit case). Check rank before `active_skill` (lower stages should skip, not defer).

**Unaffected paths:**

- `TARGET_SKILL=execute` (including `--reopen`) — no demo block runs
- `TARGET_SKILL=planning`, `create-pr`, `babysit-pr` — unchanged
- Pass-back (`--passback`) — targets execute via `passback-run.sh`, not demo

### Step 2 — Regression tests

Extend `scripts/test-cursor-workflow-handoff.sh` with three tests following existing patterns (`MOCK_CURSOR_API=1`, `MOCK_CURSOR_POST_COUNT_FILE`, gate decision assertions + spawn log checks):

#### `test_demo_skip_execute_in_progress`

- State: `stage=execute-in-progress`, `active_skill=execute`, `agents.demo=null`
- Call `cursor-workflow-admission-gate.sh` → expect `skip:execute-in-progress`
- Call `cursor-workflow-spawn-agent.sh` with skill `demo` → expect "Spawn skipped" in log, POST count = 0

#### `test_demo_defer_execute_active`

- State: `stage=execute-ready`, `active_skill=execute`, `agents.demo=null`, `agents.execute=bc-exec`
- Gate → expect `defer:execute-active`
- Spawn via `cursor-workflow-spawn-agent.sh` → expect defer log, POST count = 0 (test mode backoff is 0; exhausts without POST)
- Recovery: `cursor-workflow-handoff-recovery.sh` with same state → expect "Handoff recovery deferred" with `defer:execute-active`, no "spawning demo"

#### `test_demo_proceed_execute_ready`

- State: `stage=execute-ready`, `active_skill` absent or `null`, `agents.demo=null`
- Gate → expect `proceed`
- Recovery → expect "Handoff recovery: spawning demo" (mirror existing `test_execute_ready_forward`)
- POST count = 1 after spawn

**Update `test_execute_ready_forward`:** Explicitly set `"active_skill": null` in fixture JSON so the test documents the intended post-fix contract (execute agent cleared ownership before demo).

### Step 3 — WORKFLOW.md documentation

Add to `workflow/cursor-workflow/WORKFLOW.md`:

1. **Cross-run spawn dedup section** — new bullet under admission gate outcomes for demo preconditions
2. **Handoff recovery coverage table** — note demo recovery defers when `active_skill=execute`
3. **Admission gate stdout table** (new or extend existing) documenting:

| stdout | Meaning |
|--------|---------|
| `skip:execute-in-progress` | Demo blocked — execute stage in progress |
| `skip:stage-not-ready` | Demo blocked — stage rank below `execute-ready` |
| `defer:execute-active` | Demo deferred — execute agent still owns branch (`active_skill=execute`) |

Reference issue #91 and #84 forensic link.

### Step 4 — Handoff YAML comment (optional belt-and-suspenders)

In `.github/workflows/cursor-workflow-handoff.yml`, inside `handoff()` `execute-ready` branch where `skill="demo"`:

```yaml
# Demo spawn deferred by admission gate when active_skill=execute or stage < execute-ready.
# is_skip_stage blocks execute-in-progress transitions; gate covers recovery + premature execute-ready.
```

No duplicate logic in YAML — gate is the single enforcement point.

### Step 5 — Verify recovery inheritance

Confirm `cursor-workflow-handoff-recovery.sh` lines 129–133 already exit on non-`proceed` gate decisions. No code change expected; `test_demo_defer_execute_active` validates recovery path.

## Tests required

| Test | Type | Acceptance criterion |
|------|------|----------------------|
| `test_demo_skip_execute_in_progress` | Shell mock | Handoff does not spawn demo when `stage=execute-in-progress` |
| `test_demo_defer_execute_active` | Shell mock | Demo deferred when `active_skill=execute` at `execute-ready`, 0 POST |
| `test_demo_proceed_execute_ready` | Shell mock | Demo proceeds when `execute-ready` and `active_skill` cleared |
| `test_execute_ready_forward` (updated) | Shell mock | Existing forward path still spawns demo when preconditions met |
| `test_reopen_inference_*` | Shell mock (existing) | Re-open path spawns execute, not demo — must still pass |
| `bash scripts/test-cursor-workflow-handoff.sh` | Suite | All tests green |
| `bash scripts/verify-workflow-paths.sh` | Gate | Path/schema regression |

No API, frontend, or E2E tests — out of scope per spec.

## Gate script

Before push (execute stage):

```bash
bash scripts/test-cursor-workflow-handoff.sh
bash scripts/verify-workflow-paths.sh
```

No phase gate scripts (3–8) — workflow-only change.

## Documentation updates

| File | Update |
|------|--------|
| `workflow/cursor-workflow/WORKFLOW.md` | Demo deferral rule, admission gate outcomes, recovery table note |

No `README.md`, `AGENTS.md`, or skill file changes required.

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Demo never spawns if execute forgets to clear `active_skill` | Execute skill already sets `active_skill: null` on final `execute-ready` commit; `defer:execute-active` retries within job |
| False defer on stale `active_skill` after execute finishes | Recovery re-fetches branch tip before gate; next push with cleared `active_skill` proceeds |
| Over-blocking demo on `agents.execute` set but `active_skill` null | Gate checks `active_skill`, not `agents.execute` — `test_execute_ready_forward` covers this |
| Scripts loaded from `main` in Actions | Changes take effect after merge to `main`; issue branch carries scripts for review |

**Rollback:** Revert admission gate demo block; tests will fail if left in place.

## Definition of done

- [ ] `cursor-workflow-admission-gate.sh` returns `skip:execute-in-progress`, `skip:stage-not-ready`, or `defer:execute-active` for demo when preconditions fail
- [ ] Demo spawn proceeds unchanged when `stage=execute-ready` and `active_skill` is null/cleared
- [ ] Re-open path (`execute-ready` → execute `--reopen`) unaffected
- [ ] Three new regression tests pass; existing handoff test suite passes
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `workflow/cursor-workflow/WORKFLOW.md` documents execute-in-progress → demo deferral rule and new gate outcomes
- [ ] Handoff YAML has documentation comment (no duplicate logic)
- [ ] All changes pushed to `cursor/issue-91-prevent-demo-spawn-before-execute-ready` (draft PR #98)
