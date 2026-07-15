# Implementation plan — issue #119

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/119  
**Branch:** `cursor/issue-119-demo-single-push-finalize`  
**Draft PR:** #125

## Overview

Workflow-only documentation and skill updates. Align the **demo** skill with the **create-pr** skill's **batched final push** discipline so demo agents emit exactly one handoff-triggering push at `demo-ready` (artifacts + `demo-notes.md` + `workflow.state.json`), with commit SHA references embedded via `git commit --amend` before push — never in a follow-up SHA-only commit.

Also require `active_skill: null` (and optionally `active_agent_id: null`) on `demo-ready` finalize, matching execute (#109) and planning. Optionally apply the same finalize contract to create-pr (`create-pr-ready`) and babysit (`complete`).

**Classification:** Infrastructure / workflow scaffolding — not an application bug. Bug reproduction is skipped per planning skill.

**Root cause (documented):** On issue #115, the demo agent pushed `demo-ready`, then immediately pushed a second commit that only updated the commit SHA in `demo-notes.md`. The handoff Action's concurrency group (`cancel-in-progress: true`) cancelled the in-flight `demo-ready` handoff run; the follow-up run saw unchanged stage (sync only) and relied on recovery, which then failed (ARG_MAX). Net result: ~2h stall at `demo-ready`.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `.cursor/skills/demo/SKILL.md` | **Required** — rewrite "Git and state" | Add batched final push section mirroring create-pr; `active_skill: null` on finalize; anti-patterns (no SHA-fix follow-up) |
| `workflow/cursor-workflow/automation-prompts/demo.md` | **Required** — update prompt | Reference demo skill batched push sequence instead of "set stage to demo-ready and push" alone |
| `workflow/cursor-workflow/WORKFLOW.md` | **Required** — new subsection | Add "Demo push batching" parallel to "Create-pr push batching"; cross-link from handoff table / execute finalize section |
| `.cursor/skills/create-pr/SKILL.md` | **Optional** — finalize block | Add `active_skill: null` on `create-pr-ready` finalize (low-cost consistency) |
| `.cursor/skills/babysit-pr/SKILL.md` | **Optional** — success section | Add `active_skill: null` on `complete` finalize (low-cost consistency) |
| `scripts/verify-workflow-paths.sh` | Unlikely | Only if new doc paths or skill references need registration |

No changes to `api/`, `frontend/`, database, or `.github/workflows/cursor-workflow-handoff.yml`.

## Implementation steps

### Step 1 — Demo skill batched final push (required)

Replace the current "Git and state → If all scenarios pass" section in `.cursor/skills/demo/SKILL.md` (lines 78–88) with a **"Git and state — batched final push"** section modeled on create-pr skill lines 80–104.

**Include:**

1. **Target finalize sequence** (from SPEC):
   - Capture artifacts; draft `demo-notes.md` locally (SHA placeholder OK).
   - Run merge helper; set locally:
     - `stage: demo-ready`
     - `active_skill: null` (and optionally `active_agent_id: null`)
     - increment `loops.total_runs`
   - `git add` demo artifacts + `demo-notes.md` + `workflow.state.json`
   - `git commit -m "docs(workflow): demo evidence for issue #NNN"`
   - `git rev-parse HEAD` → embed short/full SHA in `demo-notes.md`
   - If notes changed: `git add demo-notes.md && git commit --amend --no-edit`
   - **Single** `git push`
   - **MCP (preferred):** PR scenario summary comment **after** push (unchanged; not part of handoff trigger)

2. **Expected push pattern:** 1–2 pushes total (optional early `demo-in-progress`; one `demo-ready` push).

3. **Anti-patterns (Do not section):**
   - Push `demo-ready`, then push again only to fix SHA in `demo-notes.md`
   - Leave `active_skill: "demo"` on `demo-ready` finalize

4. **Finalize state JSON block** mirroring execute skill:

```json
{
  "stage": "demo-ready",
  "active_skill": null,
  "active_agent_id": null,
  "loops": { "bugbot": <preserve>, "ci_autofix": <preserve>, "total_runs": <increment> },
  "updated_at": "<ISO8601>"
}
```

5. Preserve existing pass-back and blocked paths unchanged (those are not `demo-ready` handoffs).

**Reference implementation:** `.cursor/skills/create-pr/SKILL.md` § "Git and state — batched final push".

### Step 2 — Automation prompt (required)

Update `workflow/cursor-workflow/automation-prompts/demo.md` prompt text:

- Replace "Set stage to demo-ready and push" with explicit batched final push steps.
- Point to demo skill § batched final push.
- Mention `active_skill: null` on finalize.
- Note: MCP PR summary comment happens after the single push.

### Step 3 — WORKFLOW.md cross-links (required)

Add **"Demo push batching (issue #119)"** subsection immediately after the existing **"Create-pr push batching (issue #92)"** section (~line 372 in `WORKFLOW.md`).

**Cover:**

- Why rapid follow-up pushes cancel handoff runs (`cancel-in-progress: true` on concurrency group)
- Expected 1–2 pushes per demo run (optional `demo-in-progress`; one `demo-ready`)
- Amend-in-place SHA embedding before push
- Link to demo skill batched final push section
- Recovery exists but must not be relied on for SHA-fix races (#115)
- `active_skill: null` on `demo-ready` finalize (issue #109 symmetry)

**Also add:**

- Under **"Execute finalize (`active_skill` clearing, issue #109)"** (~line 181): cross-reference demo finalize clearing `active_skill` on `demo-ready`.
- In the stage table or MCP adoption map: note demo batched push parallels create-pr (#92).

### Step 4 — Optional create-pr / babysit consistency (include if low-cost)

**create-pr skill:** In the batched final push section (~line 86), add `active_skill: null` (and optionally `active_agent_id: null`) to the local `workflow.state.json` fields set before commit. Add one line in finalize JSON block.

**babysit-pr skill:** In "Success — ready for review" (~line 108), add `active_skill: null` to the `complete` state update before push.

These are one-line additions each; include them in the same commit as demo skill changes.

### Step 5 — Verification

Run `bash scripts/verify-workflow-paths.sh` and confirm exit 0.

Confirm no application code diff:

```bash
git diff main -- api frontend
```

(expected empty after execute)

## Tests required

| Acceptance criterion | Verification |
|---------------------|----------------|
| Demo skill documents batched final push | Manual review: `.cursor/skills/demo/SKILL.md` contains "batched final push", amend sequence, anti-pattern |
| Demo skill documents `active_skill: null` | Manual review: finalize JSON block in demo skill |
| `automation-prompts/demo.md` updated | Manual review |
| `WORKFLOW.md` cross-links demo push batching | Manual review: "Demo push batching" subsection exists |
| Optional create-pr / babysit `active_skill: null` | Manual review if included |
| No application-code changes | `git diff main -- api frontend` empty |
| Workflow path regression | `bash scripts/verify-workflow-paths.sh` exit 0 |

No new automated unit/integration/E2E tests — docs/skills only.

## Gate script

| Gate | When |
|------|------|
| `bash scripts/verify-workflow-paths.sh` | **Required** before push (workflow-only issue) |

No Phase 3–8 gates, Docker stack, or Postgres required.

## Documentation updates

All changes are documentation/skills:

- `.cursor/skills/demo/SKILL.md` (primary)
- `workflow/cursor-workflow/automation-prompts/demo.md`
- `workflow/cursor-workflow/WORKFLOW.md`
- `.cursor/skills/create-pr/SKILL.md` (optional)
- `.cursor/skills/babysit-pr/SKILL.md` (optional)

No `README.md`, `AGENTS.md`, or `documents/` changes unless `verify-workflow-paths.sh` fails and requires a keyword addition (unlikely).

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Agents miss new instructions on first dogfood | WORKFLOW.md + automation prompt + demo skill all cross-link; retrospective #115 is cited |
| Over-documenting optional create-pr/babysit changes | Keep optional edits to single JSON lines; skip if diff grows |
| `verify-workflow-paths.sh` keyword checks fail | Run gate locally before push; add required keywords only if script enforces them |

**Rollback:** Revert the docs/skills commit(s) on the issue branch. No runtime impact — workflow skills are advisory.

## Definition of done

- [ ] `.cursor/skills/demo/SKILL.md` has batched final push section mirroring create-pr
- [ ] Demo skill sets `active_skill: null` on `demo-ready` finalize
- [ ] `workflow/cursor-workflow/automation-prompts/demo.md` references batched push
- [ ] `workflow/cursor-workflow/WORKFLOW.md` has "Demo push batching" subsection
- [ ] Optional: create-pr and babysit skills clear `active_skill` on terminal stages
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `git diff main -- api frontend` is empty
- [ ] `workflow.state.json` at `execute-ready` after execute stage (not this plan)
