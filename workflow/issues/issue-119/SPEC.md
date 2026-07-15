# Issue #119: Demo skill single-push demo-ready finalize

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/119

## Summary

Align the **demo** skill with the **create-pr** skill's **batched final push** discipline: one handoff-triggering push at `demo-ready` that includes demo artifacts, `demo-notes.md`, and finalized `workflow.state.json` — with any commit SHA references embedded via `git commit --amend` before push, never in a follow-up SHA-only commit.

Also clear `active_skill: null` (and optionally `active_agent_id: null`) on `demo-ready` finalize, matching execute/planning. Optionally apply the same finalize contract to create-pr (`create-pr-ready`) and babysit (`complete`).

Workflow-only change; no application code.

## Problem

On issue [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115), the demo agent:

1. Pushed `stage: demo-ready` (triggering handoff to create-pr)
2. Immediately pushed a **second** commit that only updated the commit SHA in `demo-notes.md`

The second push **cancelled** the in-flight handoff Action for `demo-ready` (concurrency group cancels superseded runs). The follow-up run saw an unchanged stage (`sync only`) and relied on **handoff recovery** — which then failed with `jq ARG_MAX` in `fetch-agents-list`. Net result: **~2h stall at `demo-ready`** with no create-pr agent spawned.

The **create-pr** skill already documents the correct pattern (issue #92 / #84): draft locally → commit → embed SHA → amend in place → **single push**. **Demo** still uses a separate SHA-fix push pattern in its "Git and state" section.

Additionally, demo does not clear `active_skill` on `demo-ready` finalize. Execute (#109) and planning already require `active_skill: null` at terminal stages; demo should match for consistency and admission-gate hygiene.

**Evidence:**

- [issue #115 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/2ea2eb23634b1e3b4ee9aa547fd7338388886ad0/workflow/issues/issue-115/WORKFLOW-REVIEW.md)
- [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/12f3932f8dc4425b73efa17555b5e365bc3d8a77/workflow/cursor-workflow/RETROSPECTIVES.md) — "Rapid follow-up push after `*-ready` orphans stage-transition handoff"
- Cancelled handoff run: [29271581256](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271581256)

Companion hardening (out of scope here): [#117](https://github.com/BlackLodgeLabs/cuebox/issues/117) ARG_MAX fetch, [#118](https://github.com/BlackLodgeLabs/cuebox/issues/118) stalled notify on recovery failure.

## Acceptance criteria

- [ ] `.cursor/skills/demo/SKILL.md` documents a **batched final push** for `demo-ready` (mirror create-pr):
  - Artifacts + `demo-notes.md` + `workflow.state.json` in **one** handoff-triggering commit
  - Embed commit SHA in `demo-notes.md` (and any other SHA references) **before** push
  - Use `git commit --amend --no-edit` if SHA changes after initial local commit
  - **No** follow-up SHA-only push after `demo-ready`
  - Expected push pattern documented: optional early `demo-in-progress` push; **one** `demo-ready` push
- [ ] On `demo-ready` finalize, set `active_skill: null` (and optionally `active_agent_id: null`) — same contract as execute `execute-ready` and planning `plan-ready`
- [ ] `workflow/cursor-workflow/automation-prompts/demo.md` updated to reference batched final push (not "set stage to demo-ready and push" alone)
- [ ] `workflow/cursor-workflow/WORKFLOW.md` cross-links demo push batching (symmetric to existing "Create-pr push batching" section for issue #92)
- [ ] **Optional (include if low-cost):** create-pr skill finalize sets `active_skill: null` on `create-pr-ready`; babysit skill finalize sets `active_skill: null` on `complete`
- [ ] No application-code changes (`api/`, `frontend/`, database, etc.)
- [ ] `bash scripts/verify-workflow-paths.sh` still passes after doc/skill edits

## Scope

### In scope

| File / area | Change |
|-------------|--------|
| `.cursor/skills/demo/SKILL.md` | **Required** — batched final push section; `active_skill: null` on finalize; anti-patterns (no SHA-fix follow-up) |
| `workflow/cursor-workflow/automation-prompts/demo.md` | Reference demo skill batched push sequence |
| `workflow/cursor-workflow/WORKFLOW.md` | New "Demo push batching" subsection (mirror create-pr); cross-link from handoff table |
| `.cursor/skills/create-pr/SKILL.md` | **Optional** — `active_skill: null` on `create-pr-ready` finalize |
| `.cursor/skills/babysit-pr/SKILL.md` | **Optional** — `active_skill: null` on `complete` finalize |
| `scripts/verify-workflow-paths.sh` | Only if new doc paths or skill references need registration (unlikely) |

### Out of scope

- ARG_MAX rewrite in `fetch-agents-list` ([#117](https://github.com/BlackLodgeLabs/cuebox/issues/117))
- Stalled-notify wiring when recovery/fetch hard-fails ([#118](https://github.com/BlackLodgeLabs/cuebox/issues/118))
- Changing handoff concurrency YAML (`cancel-in-progress`) unless required only to **document** cancel behavior
- Application code
- Changing create-pr's existing batched push semantics (already correct)

## User flows / API changes

No product UI or API changes.

### Operators

After a successful demo run, **create-pr** should auto-spawn from the single `demo-ready` push without human "continue" when handoff recovery is healthy. Fewer orphaned/cancelled handoff runs from SHA-fix follow-ups.

### Demo agents — target finalize sequence

When all scenarios pass:

1. Capture artifacts and draft `demo-notes.md` locally (SHA placeholder OK initially).
2. Run merge helper; set locally in `workflow.state.json`:
   - `stage: demo-ready`
   - `active_skill: null` (and optionally `active_agent_id: null`)
   - increment `loops.total_runs`
3. `git add` demo artifacts + `demo-notes.md` + `workflow.state.json`
4. `git commit -m "docs(workflow): demo evidence for issue #NNN"`
5. `git rev-parse HEAD` → embed short/full SHA in `demo-notes.md` (and any embedded raw URLs if used)
6. If notes changed: `git add demo-notes.md && git commit --amend --no-edit`
7. **Single** `git push` → one handoff run spawns create-pr
8. **MCP (preferred):** PR scenario summary comment after push (unchanged; not part of handoff trigger)

**Anti-pattern (forbidden):** push `demo-ready`, then push again only to fix SHA in `demo-notes.md`.

### Create-pr agents (unchanged)

Continue using existing batched final push at `create-pr-ready` per create-pr skill.

### Optional consistency (create-pr / babysit)

| Stage | Skill | Finalize fields |
|-------|-------|-----------------|
| `demo-ready` | demo | `active_skill: null` (**required**) |
| `create-pr-ready` | create-pr | `active_skill: null` (optional) |
| `complete` | babysit-pr | `active_skill: null` (optional) |

Mirror execute skill language:

```json
{
  "stage": "demo-ready",
  "active_skill": null,
  "active_agent_id": null
}
```

### WORKFLOW.md documentation

Add a subsection **Demo push batching** (parallel to lines 359–372 "Create-pr push batching") covering:

- Why rapid follow-up pushes cancel handoff runs
- Expected 1–2 pushes per demo run (optional `demo-in-progress`; one `demo-ready`)
- Amend-in-place SHA embedding before push
- Link to demo skill batched final push section
- Note that recovery exists but must not be relied on for SHA-fix races ([#115](https://github.com/BlackLodgeLabs/cuebox/issues/115))

## Data and integration notes

- **Application DB/API:** none
- **GitHub Actions:** no YAML changes expected; handoff trigger conditions unchanged (`stage` change to `demo-ready` on push)
- **Concurrency:** document that `.github/workflows/cursor-workflow-handoff.yml` uses `cancel-in-progress: true` on the concurrency group — a second push within seconds cancels the first handoff job
- **Verification:** `bash scripts/verify-workflow-paths.sh` (workflow path regression; no Docker/Postgres)

### Test plan (execute stage)

| Check | Command / action |
|-------|------------------|
| Workflow path regression | `bash scripts/verify-workflow-paths.sh` |
| Demo skill documents batched push | Manual review of `.cursor/skills/demo/SKILL.md` |
| Demo skill documents `active_skill: null` | Manual review |
| WORKFLOW.md cross-link | Manual review |
| automation-prompts/demo.md | Manual review |
| No app code diff | `git diff main -- api frontend` empty |

No new automated test required — docs/skills only. Dogfood: next workflow issue that reaches demo should follow the new sequence.

## Open questions (must be empty before plan-ready)

None.

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/119
- Parent review: [#115 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/2ea2eb23634b1e3b4ee9aa547fd7338388886ad0/workflow/issues/issue-115/WORKFLOW-REVIEW.md)
- Related create-pr batching: [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92), WORKFLOW.md "Create-pr push batching"
- Execute `active_skill` clearing: [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109)
- Companion: [#117](https://github.com/BlackLodgeLabs/cuebox/issues/117) (ARG_MAX), [#118](https://github.com/BlackLodgeLabs/cuebox/issues/118) (stalled notify)
- Reference implementation: `.cursor/skills/create-pr/SKILL.md` § "Git and state — batched final push"
