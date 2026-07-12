# Issue #109: Harden execute→demo handoff — clear active_skill on execute-ready

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/109

## Summary

During [issue #26](https://github.com/BlackLodgeLabs/cuebox/issues/26), the execute agent set `stage: execute-ready` but left `active_skill: execute`. Issue [#91](https://github.com/BlackLodgeLabs/cuebox/issues/91)'s admission gate correctly deferred demo spawn (`defer:execute-active`); the workflow stalled ~7 hours until a human commented `@cursoragent continue the workflow`.

This issue hardens the execute→demo handoff so demo spawns automatically after a normal execute completion. It is **issue 1 of 3** in the epic split from [#102](https://github.com/BlackLodgeLabs/cuebox/issues/102): #109 → [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) → [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111).

## Problem

**Root cause:** The planning skill requires `active_skill: null` on `plan-ready`; the execute skill's **Finalize state** section does not document or require clearing `active_skill` on `execute-ready`. Execute agents can finish implementation, push `execute-ready`, and leave a stale skill lock.

**Symptom:** `cursor-workflow-admission-gate.sh` defers demo when `active_skill=execute` (issue #91). At `execute-ready` with stale `active_skill`, execute will not push again, so the stall does **not** self-heal on the next push. Handoff recovery and PAT fallback also cannot spawn demo while the gate returns `defer:execute-active`.

**Evidence:** [Issue #26 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/65697ccd/workflow/issues/issue-26/WORKFLOW-REVIEW.md); [RETROSPECTIVES.md](../../cursor-workflow/RETROSPECTIVES.md) entry for #26.

## Acceptance criteria

- [ ] `.cursor/skills/execute/SKILL.md` **Finalize state** requires `active_skill: null` (and documents optional `active_agent_id: null`) when setting `stage: execute-ready`
- [ ] **Defense-in-depth:** admission gate allows demo when `stage` rank ≥ `execute-ready` even if `active_skill=execute` (stage rank wins over stale skill lock); `defer:execute-active` applies only when `active_skill=execute` **and** stage rank &lt; `execute-ready`
- [ ] Regression: `execute-ready` + `active_skill: null` → demo admission gate returns `proceed` (`test_demo_proceed_execute_ready` still passes)
- [ ] Regression: `execute-ready` + stale `active_skill: execute` → demo admission gate returns `proceed` (replaces current `test_demo_defer_execute_active` expectation)
- [ ] Regression: simulated execute finalize with `execute-ready` + cleared `active_skill` → handoff spawns demo (mock API; extend or align with `test_execute_ready_forward`)
- [ ] Regression: `execute-in-progress` + `active_skill: execute` → demo still blocked (`test_demo_skip_execute_in_progress` unchanged)
- [ ] `workflow/cursor-workflow/WORKFLOW.md` documents execute agent obligation to clear `active_skill` on `execute-ready` and updated admission-gate semantics for stale locks at terminal execute stage
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` passes
- [ ] `bash scripts/verify-workflow-paths.sh` passes

## Scope

### In scope

| Area | Change |
|------|--------|
| `.cursor/skills/execute/SKILL.md` | Finalize state JSON template: add `active_skill: null`, optional `active_agent_id: null`; mirror planning skill wording |
| `scripts/cursor-workflow-admission-gate.sh` | Narrow `defer:execute-active` to `active_skill=execute` **and** stage rank &lt; `execute-ready` |
| `scripts/test-cursor-workflow-handoff.sh` | Update `test_demo_defer_execute_active` → proceed-at-execute-ready-with-stale-lock; keep execute-in-progress defer tests |
| `workflow/cursor-workflow/WORKFLOW.md` | Document execute finalize obligation; update admission-gate table for stale-lock recovery at `execute-ready` |

### Out of scope

- `pat_fallback()` / false progress labels — [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110)
- Stalled human notification — [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111)
- GitHub MCP ([#105](https://github.com/BlackLodgeLabs/cuebox/issues/105)) — orthogonal
- Application code, database, frontend
- Handoff YAML spawn logic changes (admission gate fix is sufficient defense-in-depth; no `record-spawn-on-branch.sh` mutation needed)

## User flows / API changes

No product UI or API changes.

### Workflow operators

1. After execute completes normally, demo spawns on the next handoff push **without** manual `@cursoragent continue the workflow`.
2. If an execute agent forgets to clear `active_skill`, defense-in-depth at `execute-ready` still allows demo (stage rank wins).
3. During active execute (`execute-in-progress`), demo remains blocked — issue #91 premature-demo protection is preserved.

### Execute agent (skill contract)

On successful completion (including pass-back resume), finalize state must include:

```json
{
  "stage": "execute-ready",
  "active_skill": null,
  "active_agent_id": null,
  "passback_to": null,
  "passback_reason": null,
  "pr": <preserve>,
  "loops": { ... },
  "updated_at": "<ISO8601>"
}
```

Push `workflow.state.json`; handoff Action spawns demo when admission gate returns `proceed`.

### Admission gate semantics (demo target)

| Condition | stdout | Notes |
|-----------|--------|-------|
| `stage=execute-in-progress` | `skip:execute-in-progress` | Unchanged (#91) |
| stage rank &lt; `execute-ready` | `skip:stage-not-ready` | Unchanged (#91) |
| `active_skill=execute` **and** stage rank &lt; `execute-ready` | `defer:execute-active` | Narrowed — no defer at terminal execute stage |
| `stage=execute-ready` (any `active_skill`) | `proceed` | Stale lock no longer blocks |
| `active_skill: null` at `execute-ready` | `proceed` | Happy path |

## Data and integration notes

- **Application DB/API:** none
- **GitHub Actions:** handoff YAML unchanged; spawn path uses existing admission gate
- **Coordination:** run before [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) and [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111); #110 addresses honest status labels when spawn is deferred for other reasons; #111 adds human notifications for terminal stalls

## Open questions (must be empty before plan-ready)

None.

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/109
- Epic: [#102 Harden execute→demo handoff and workflow status honesty](https://github.com/BlackLodgeLabs/cuebox/issues/102)
- Related: [#91 Admission gate for demo spawn](https://github.com/BlackLodgeLabs/cuebox/issues/91), [#26 workflow review](https://github.com/BlackLodgeLabs/cuebox/issues/26)
- Source review: [issue-26 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/65697ccd/workflow/issues/issue-26/WORKFLOW-REVIEW.md)
