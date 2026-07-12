## Related Issue

Closes #109

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/109)

## Description

**What does this PR do?**

During [issue #26](https://github.com/BlackLodgeLabs/cuebox/issues/26), the execute agent pushed `stage: execute-ready` but left `active_skill: execute`. Issue [#91](https://github.com/BlackLodgeLabs/cuebox/issues/91)'s admission gate correctly returned `defer:execute-active`, but at terminal execute stage execute will not push again — the workflow stalled ~7 hours until a human commented `@cursoragent continue the workflow`.

This PR hardens the execute→demo handoff with a two-layer fix:

1. **Skill contract** — `.cursor/skills/execute/SKILL.md` **Finalize state** now requires `active_skill: null` (and documents `active_agent_id: null`) when setting `stage: execute-ready`, mirroring the planning skill on `plan-ready`.
2. **Defense-in-depth** — `scripts/cursor-workflow-admission-gate.sh` narrows `defer:execute-active` so it applies only when `active_skill=execute` **and** stage rank &lt; `execute-ready`; stale locks at terminal execute stage no longer block demo spawn.

This is **issue 1 of 3** in the epic split from [#102](https://github.com/BlackLodgeLabs/cuebox/issues/102). PAT fallback labels ([#110](https://github.com/BlackLodgeLabs/cuebox/issues/110)) and stalled human notification ([#111](https://github.com/BlackLodgeLabs/cuebox/issues/111)) are out of scope.

**Why is this the best approach?**

The root cause was asymmetric skill contracts: planning clears `active_skill` on handoff; execute did not. Fixing the skill contract prevents future stalls; narrowing the admission gate provides defense-in-depth when an agent forgets to clear the lock. No handoff YAML or spawn-script changes are needed — the existing gate stdout contract (`proceed` / `defer:*` / `skip:*`) is preserved, and issue #91 premature-demo protection during `execute-in-progress` remains unchanged.

## Changes Proposed

* Updated `.cursor/skills/execute/SKILL.md` — **Finalize state** JSON template adds `active_skill: null` and `active_agent_id: null`; prose documents the obligation on successful completion (including pass-back resume)
* Updated `scripts/cursor-workflow-admission-gate.sh` — `defer:execute-active` only when `active_skill=execute` **and** `stage_rank < execute_ready_rank`
* Updated `scripts/test-cursor-workflow-handoff.sh` — renamed `test_demo_defer_execute_active` → `test_demo_proceed_execute_ready_stale_lock`; asserts `proceed` + demo spawn at `execute-ready` with stale lock
* Updated `workflow/cursor-workflow/WORKFLOW.md` — execute agent finalize obligation; admission gate table documents narrowed defer semantics and stale-lock recovery ([#109](https://github.com/BlackLodgeLabs/cuebox/issues/109))
* Added workflow artifacts: `workflow/issues/issue-109/SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, and five scenario logs under `workflow/issues/issue-109/demo/`

**Explicitly unchanged:** `.github/workflows/cursor-workflow-handoff.yml`, `scripts/cursor-workflow-record-spawn-on-branch.sh`, `scripts/cursor-workflow-spawn-agent.sh`, and all application code (`api/`, `frontend/`).

## Scenario Results

Workflow-only change — no product UI. Demo validated execute skill contract, admission gate stale-lock recovery, handoff regression suite, WORKFLOW.md documentation, and unchanged handoff YAML.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Execute skill finalize contract | **PASS** | [scenario-1-execute-skill.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/319078e4c2bb3c3bba86c014114cbe2fc9ab6a39/workflow/issues/issue-109/demo/scenario-1-execute-skill.log) |
| 2 | Admission gate stale-lock recovery | **PASS** | [scenario-2-admission-gate.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/319078e4c2bb3c3bba86c014114cbe2fc9ab6a39/workflow/issues/issue-109/demo/scenario-2-admission-gate.log) |
| 3 | Handoff regression suite | **PASS** | [scenario-3-regression.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/319078e4c2bb3c3bba86c014114cbe2fc9ab6a39/workflow/issues/issue-109/demo/scenario-3-regression.log) |
| 4 | WORKFLOW.md documentation | **PASS** | [scenario-4-workflow-docs.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/319078e4c2bb3c3bba86c014114cbe2fc9ab6a39/workflow/issues/issue-109/demo/scenario-4-workflow-docs.log) |
| 5 | Handoff YAML unchanged | **PASS** | [scenario-5-yaml-unchanged.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/319078e4c2bb3c3bba86c014114cbe2fc9ab6a39/workflow/issues/issue-109/demo/scenario-5-yaml-unchanged.log) |

Key gate assertions from scenario 3:

- `demo proceed execute-ready stale lock gate` — `proceed` (not `defer:execute-active`)
- `demo proceed execute-ready stale lock recovery spawned demo` — handoff recovery spawns demo
- `demo skip execute-in-progress gate` — issue #91 protection preserved

## How to Test

1. Checkout this branch: `git checkout cursor/issue-109-harden-execute-demo-handoff`
2. Confirm execute skill finalize contract:
   ```bash
   grep -A5 'active_skill' .cursor/skills/execute/SKILL.md | head -20
   ```
   Expect `active_skill: null` in the **Finalize state** JSON template.
3. Test admission gate stale-lock recovery:
   ```bash
   STATE=$(mktemp)
   echo '{"issue":109,"branch":"cursor/issue-109-test","stage":"execute-ready","active_skill":"execute","agents":{"execute":"bc-test"},"pr":112,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' > "$STATE"
   bash scripts/cursor-workflow-admission-gate.sh "$STATE" demo
   # Expect stdout: proceed
   echo '{"issue":109,"branch":"cursor/issue-109-test","stage":"execute-in-progress","active_skill":"execute","agents":{"execute":"bc-test"},"pr":112,"handoff_pending":null,"loops":{"bugbot":0,"ci_autofix":0,"total_runs":1}}' > "$STATE"
   bash scripts/cursor-workflow-admission-gate.sh "$STATE" demo
   # Expect stdout: skip:execute-in-progress
   rm -f "$STATE"
   ```
4. Run handoff regression suite:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
5. Run workflow path verification:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
6. Confirm WORKFLOW.md documents execute obligation and narrowed defer:
   ```bash
   grep -E 'active_skill|defer:execute-active|#109' workflow/cursor-workflow/WORKFLOW.md
   ```
7. Confirm handoff YAML unchanged:
   ```bash
   git diff main -- .github/workflows/cursor-workflow-handoff.yml
   ```
   Expect empty diff.

**Docker stack not required** — workflow-only scope.

## Known Issues / Notes for Reviewer

* Epic follow-ups ([#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) honest PAT deferral labels, [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111) stalled human notification) are intentionally deferred.
* With the narrowed gate condition, `defer:execute-active` is unreachable at current check order for stages ≥ `execute-ready` — the behavioral change is removing unconditional defer at `execute-ready`; the condition documents defense-in-depth if check order changes later.
* `demo-spec.md` and `PLAN.md` were restored from the planning side branch during demo when missing from the issue branch tip.

## Gate evidence

- [x] `test-cursor-workflow-handoff.sh exit 0 at eb94dc3` (execute — includes `test_demo_proceed_execute_ready_stale_lock`)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at eb94dc3` (execute)
- [x] `test-cursor-workflow-handoff.sh exit 0 at 319078e` (demo)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at 319078e` (demo)
- [x] `.github/workflows/cursor-workflow-handoff.yml` — 0 lines diff vs `main` (demo)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Handoff YAML spawn logic unchanged
