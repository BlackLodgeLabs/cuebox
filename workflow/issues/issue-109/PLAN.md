# Implementation plan — Issue #109

Harden the execute→demo handoff so demo spawns automatically after normal execute completion, even when an execute agent forgets to clear `active_skill`.

## Overview

During [issue #26](https://github.com/BlackLodgeLabs/cuebox/issues/26), the execute agent pushed `stage: execute-ready` but left `active_skill: execute`. Issue [#91](https://github.com/BlackLodgeLabs/cuebox/issues/91)'s admission gate correctly returned `defer:execute-active`, but at terminal execute stage execute will not push again — the workflow stalled ~7 hours until a human commented `@cursoragent continue the workflow`.

This is **workflow infrastructure** (not an application bug). Execute will apply a two-layer fix:

1. **Skill contract** — `.cursor/skills/execute/SKILL.md` **Finalize state** requires `active_skill: null` (and documents optional `active_agent_id: null`), mirroring the planning skill.
2. **Defense-in-depth** — `scripts/cursor-workflow-admission-gate.sh` narrows `defer:execute-active` so stage rank ≥ `execute-ready` wins over a stale `active_skill=execute` lock; demo proceeds at terminal execute stage.

Issue [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) (honest PAT deferral labels) and [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111) (stalled human notification) are explicitly out of scope.

## Reproduction findings

Not an application bug — static analysis of the stall documented in [issue #26 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/65697ccd/workflow/issues/issue-26/WORKFLOW-REVIEW.md).

| Observed | Location |
|----------|----------|
| Execute finalize JSON omits `active_skill: null` | `.cursor/skills/execute/SKILL.md` lines 94–102 |
| Planning skill **does** require clearing `active_skill` on `plan-ready` | `.cursor/skills/planning/SKILL.md` line 184 |
| Admission gate defers demo unconditionally when `active_skill=execute` | `scripts/cursor-workflow-admission-gate.sh` lines 93–96 |
| At `execute-ready` + stale lock, `test_demo_defer_execute_active` expects defer (blocks demo) | `scripts/test-cursor-workflow-handoff.sh` lines 1061–1107 |
| Happy path with cleared lock already passes | `test_demo_proceed_execute_ready`, `test_execute_ready_forward` |

**Failure mode:** `execute-ready` + `active_skill: execute` → gate returns `defer:execute-active` → handoff recovery and spawn-agent defer without POST → no further execute pushes → terminal stall.

## Root cause

Asymmetric skill contracts: planning requires `active_skill: null` on handoff; execute does not. The #91 admission gate treated `active_skill=execute` as a live ownership lock even at terminal execute stage (`execute-ready`, rank 40), where execute has finished and will not clear the lock on a subsequent push.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `.cursor/skills/execute/SKILL.md` | Edit **Finalize state** JSON + prose | Primary fix — agents clear skill lock on `execute-ready` |
| `scripts/cursor-workflow-admission-gate.sh` | Narrow `defer:execute-active` condition | Defense-in-depth — stale lock at `execute-ready` no longer blocks demo |
| `scripts/test-cursor-workflow-handoff.sh` | Replace `test_demo_defer_execute_active` expectations | Regression for stale-lock proceed path |
| `workflow/cursor-workflow/WORKFLOW.md` | Document execute finalize obligation + updated gate table | Operator and agent reference |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| `.github/workflows/cursor-workflow-handoff.yml` | Spec: spawn path uses existing admission gate |
| `scripts/cursor-workflow-record-spawn-on-branch.sh` | No state mutation changes needed |
| `scripts/cursor-workflow-spawn-agent.sh` | Gate stdout contract unchanged (`proceed` / `defer:*` / `skip:*`) |
| Application code (`api/`, `frontend/`) | Out of scope |

## Implementation steps

### Step 1 — Execute skill finalize contract

Edit `.cursor/skills/execute/SKILL.md` **Finalize state** section:

1. Add `active_skill: null` and `active_agent_id: null` to the JSON template (match planning skill wording: "null (or omit)" for `active_skill`).
2. Add one sentence before the JSON block: on successful completion (including pass-back resume), clear `active_skill` and optionally `active_agent_id` so the admission gate does not treat the branch as execute-owned.
3. Keep existing fields: `passback_to`, `passback_reason`, `pr`, `loops`, `updated_at`.
4. Cross-reference that handoff Action spawns demo when gate returns `proceed`.

**Target JSON:**

```json
{
  "stage": "execute-ready",
  "active_skill": null,
  "active_agent_id": null,
  "passback_to": null,
  "passback_reason": null,
  "pr": <number from workflow.state.json — preserve>,
  "loops": { "bugbot": <preserve>, "ci_autofix": <preserve>, "total_runs": <increment> },
  "updated_at": "<ISO8601>"
}
```

### Step 2 — Admission gate defense-in-depth

Edit `scripts/cursor-workflow-admission-gate.sh` demo block (after existing `skip:stage-not-ready` check, ~lines 86–96).

**Current:**

```bash
if [ "$active_skill" = "execute" ]; then
  echo "defer:execute-active"
  exit 0
fi
```

**Replace with:**

```bash
if [ "$active_skill" = "execute" ] && [ "$stage_rank" -lt "$execute_ready_rank" ]; then
  echo "defer:execute-active"
  exit 0
fi
```

`stage_rank` and `execute_ready_rank` are already computed above. Effect:

| State | Gate result |
|-------|-------------|
| `execute-in-progress` | `skip:execute-in-progress` (unchanged, checked first) |
| rank &lt; `execute-ready` | `skip:stage-not-ready` (unchanged) |
| `execute-ready` + `active_skill: execute` (stale) | `proceed` (was `defer:execute-active`) |
| `execute-ready` + `active_skill: null` | `proceed` (unchanged) |

Note: with current check order, `defer:execute-active` is only reachable for stages with rank ≥ `execute-ready` that are not `execute-in-progress` — the narrowed condition makes that path unreachable except as documented defense-in-depth if check order changes later. The meaningful behavioral change is removing unconditional defer at `execute-ready`.

### Step 3 — Handoff regression tests

Edit `scripts/test-cursor-workflow-handoff.sh`:

1. **Rename** `test_demo_defer_execute_active` → `test_demo_proceed_execute_ready_stale_lock` (or equivalent descriptive name).
2. **Update assertions** for state `stage: execute-ready`, `active_skill: execute`:
   - Gate decision: `proceed` (not `defer:execute-active`)
   - `cursor-workflow-spawn-agent.sh`: demo POST occurs (count = 1) or logs proceed path
   - `cursor-workflow-handoff-recovery.sh`: logs `Handoff recovery: spawning demo` (not deferred)
3. **Keep unchanged:** `test_demo_skip_execute_in_progress`, `test_demo_proceed_execute_ready`, `test_execute_ready_forward`.
4. Update the test runner invocation at file bottom if function name changed.

Optional (only if time permits, not required by spec): add a focused unit assertion that `plan-ready` + `active_skill: execute` still returns `skip:stage-not-ready` — documents that #91 premature-demo protection below `execute-ready` is preserved.

### Step 4 — WORKFLOW.md documentation

Edit `workflow/cursor-workflow/WORKFLOW.md`:

1. **Cross-run spawn dedup** bullet (~line 158): change "defer when `active_skill=execute`" to "defer when `active_skill=execute` **and** stage rank &lt; `execute-ready`"; note stale lock at `execute-ready` does not block demo ([#109](https://github.com/BlackLodgeLabs/cuebox/issues/109)).
2. **Admission gate stdout table** (~lines 169–175): update `defer:execute-active` row — applies only when `active_skill=execute` **and** stage rank &lt; `execute-ready`; add row or note that `execute-ready` with stale `active_skill` returns `proceed`.
3. Add short **Execute agent obligation** note (Visibility or State file section): execute skill must set `active_skill: null` on `execute-ready`, matching planning skill on `plan-ready`.

## Tests required

| Test | Maps to acceptance criterion |
|------|------------------------------|
| `test_demo_proceed_execute_ready` | `execute-ready` + `active_skill: null` → `proceed` |
| `test_demo_proceed_execute_ready_stale_lock` (renamed) | `execute-ready` + stale `active_skill: execute` → `proceed` + recovery spawns demo |
| `test_demo_skip_execute_in_progress` | `execute-in-progress` + `active_skill: execute` → `skip:execute-in-progress` |
| `test_execute_ready_forward` | Handoff recovery spawns demo at `execute-ready` |
| `bash scripts/test-cursor-workflow-handoff.sh` | Full handoff regression suite |
| `bash scripts/verify-workflow-paths.sh` | Workflow path + shell tests (includes handoff suite) |
| Grep: `.cursor/skills/execute/SKILL.md` contains `active_skill: null` in Finalize state | Skill contract |
| Grep: `WORKFLOW.md` documents execute finalize + narrowed defer semantics | Documentation |

No API, frontend, Docker stack, or phase gate tests required.

## Gate script

```bash
bash scripts/verify-workflow-paths.sh
```

This runs `test-cursor-workflow-handoff.sh` and related workflow shell tests. Record in `demo-notes.md` and eventual `PR.md` Gate evidence:

```text
Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>
```

## Documentation updates

| File | Update |
|------|--------|
| `.cursor/skills/execute/SKILL.md` | Finalize state: `active_skill: null`, `active_agent_id: null` |
| `workflow/cursor-workflow/WORKFLOW.md` | Execute obligation + admission gate table |

No `README.md`, `AGENTS.md`, or `documents/` changes unless execute skill cross-links are desired (not required by spec).

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Premature demo spawn during active execute | `skip:execute-in-progress` unchanged; checked before rank/defer logic |
| Demo spawns while execute still running on side branch | `active_skill=execute` at `execute-in-progress` still skips; rank &lt; `execute-ready` still skips |
| Race: execute pushes `execute-ready` before clearing `active_skill` | Defense-in-depth allows demo at `execute-ready` even with stale lock |
| Over-broad proceed at non-terminal stages | Narrowed defer still requires rank &lt; `execute-ready` for defer path; rank check unchanged |

**Rollback:** Revert the four files; `test_demo_defer_execute_active` behavior restored; workflows may stall again on stale `active_skill` at `execute-ready` until human intervention.

## Definition of done

- [ ] `.cursor/skills/execute/SKILL.md` **Finalize state** requires `active_skill: null` (documents `active_agent_id: null`)
- [ ] `cursor-workflow-admission-gate.sh` does not defer demo at `execute-ready` when only `active_skill` is stale
- [ ] `test_demo_proceed_execute_ready_stale_lock` (or equivalent) asserts `proceed` + demo spawn for stale lock at `execute-ready`
- [ ] `test_demo_skip_execute_in_progress` and `test_demo_proceed_execute_ready` still pass unchanged
- [ ] `test_execute_ready_forward` still passes
- [ ] `WORKFLOW.md` documents execute finalize obligation and updated gate semantics
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` exit 0
- [ ] `bash scripts/verify-workflow-paths.sh` exit 0
- [ ] `.github/workflows/cursor-workflow-handoff.yml` unchanged
- [ ] `workflow.state.json` at `execute-ready` with `loops.total_runs` incremented
