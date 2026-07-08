# Implementation plan — Issue #92: Batch create-pr pushes to single commit

## Overview

Issue [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) dogfood showed the create-pr agent pushing two commits 14 seconds apart (`PR.md` + `create-pr-ready`, then a follow-up SHA URL fix). Each push to a `cursor/issue-*` branch with a handoff `stage` can trigger `.github/workflows/cursor-workflow-handoff.yml`, widening the TOCTOU window for overlapping babysit spawns despite [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) hardening.

This issue is **workflow documentation and skill guidance** — not an application bug. The fix reduces handoff trigger frequency by teaching create-pr agents to:

1. Optionally push once for `create-pr-in-progress` (progress signal only; no `PR.md`).
2. Stage `PR.md` and `workflow.state.json` locally with demo image URLs resolved to the **same commit SHA** before push.
3. Make **exactly one** handoff-triggering push containing complete `PR.md` + `stage: create-pr-ready`.

No production code, database, or frontend changes. Optional script-level idempotency is deferred unless dogfood still shows duplicate spawns after skill-only guidance.

## Classification

| Type | Workflow / operator tooling |
|------|-----------------------------|
| Bug reproduction | **Skipped** — not a shipped app defect |

## Root cause

The create-pr skill (`.cursor/skills/create-pr/SKILL.md`) currently instructs:

1. Push `create-pr-in-progress` **before** drafting `PR.md` (correct for progress visibility).
2. Commit `PR.md` + state and push `create-pr-ready`.
3. Does **not** explicitly forbid a follow-up push to fix demo image SHA URLs after the handoff-triggering push.

Agents often compute `git rev-parse HEAD` **after** the first push, discover URLs need the new SHA, and push again — both commits carry `stage: create-pr-ready`, spawning duplicate handoff runs.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `.cursor/skills/create-pr/SKILL.md` | Edit | Primary deliverable: batched final push workflow, SHA resolution sequence, explicit "no follow-up SHA fix push" |
| `workflow/cursor-workflow/WORKFLOW.md` | Edit | Operator docs: create-pr push batching near stage-specific handoff / demo URL section |
| `workflow/cursor-workflow/automation-prompts/create-pr.md` | Edit | Backup automation prompt aligned with skill |
| `scripts/cursor-workflow-admission-gate.sh` (optional) | Edit | Idempotent deferral for rapid duplicate `create-pr-ready` pushes — **only if** skill-only proves insufficient |
| `scripts/test-cursor-workflow-handoff.sh` (optional) | Edit | Tests for optional admission gate guard |

**Out of scope:** application code, babysit skill, handoff YAML debounce, spawn dedup mechanics ([#84](https://github.com/BlackLodgeLabs/cuebox/issues/84), [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90)).

## Implementation steps

### Step 1 — Reorder create-pr skill push guidance

Edit `.cursor/skills/create-pr/SKILL.md`:

**Keep** the early `create-pr-in-progress` push (progress signal; no `PR.md`). Clarify it does **not** trigger babysit — only `create-pr-ready` does.

**Replace** the "Git and state" section with an explicit **batched final push** sequence:

```text
1. Read sources locally (no PR.md push yet).
2. Draft PR.md locally (placeholders OK for SHA).
3. Run merge helper; set stage create-pr-ready + increment loops.total_runs in workflow.state.json locally.
4. git add PR.md + workflow.state.json
5. git commit -m "docs(workflow): PR description for issue #NNN"
6. git rev-parse HEAD → embed SHA in raw.githubusercontent.com URLs in PR.md
7. If URLs changed: git add PR.md && git commit --amend --no-edit  (still one commit)
8. Single git push → one handoff run
```

**Add** a "Do not" bullet: never push then amend SHA in a second push; never push `PR.md` with `create-pr-ready` until URLs are final.

**Clarify** SHA resolution in "Demo image URLs": URLs must reference the commit that **contains** `PR.md` (the commit about to be pushed, or amended in place). Branch-name fallback remains documented for edge cases.

**Preserve** existing sections: template mapping, Gate evidence, Closes #NNN, merge-state helper reference (required by `verify-workflow-paths.sh`).

### Step 2 — Document batching in WORKFLOW.md

Add a subsection **"Create-pr push batching (issue #92)"** after the demo URL paragraph (~line 304) and before "Post-merge cleanup". Include:

- Expected push pattern: 1–2 pushes total (optional `create-pr-in-progress`; one `create-pr-ready` with complete `PR.md`).
- Why: each handoff `stage` push can spawn babysit; rapid pushes caused triple babysit in [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79) / [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) dogfood.
- Cross-reference create-pr skill SHA-amend pattern.
- Note: complements [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) spawn dedup; does not replace it.

Optionally add one row to the "Stage-specific handoff behavior" table footnote clarifying create-pr-ready expects a single batched push per agent run.

### Step 3 — Align automation prompt

Edit `workflow/cursor-workflow/automation-prompts/create-pr.md`:

- Replace "Set stage to create-pr-ready and push" with batched-final-push bullets mirroring the skill (local draft → amend SHA → single push with `PR.md` + `create-pr-ready`).
- Mention optional early `create-pr-in-progress` push without `PR.md`.

### Step 4 — Optional script guard (defer by default)

**Do not implement in the first execute pass** unless demo-spec Scenario 2 finds the skill-only path insufficient.

If needed later:

- In `cursor-workflow-admission-gate.sh` or spawn path: when `stage=create-pr-ready`, `agents.babysit-pr` is null, and a peer `handoff_pending` for `babysit-pr` was set within N seconds (30–60s), defer second spawn.
- Must not block legitimate re-runs after `changes-requested` (stage transition from `changes-requested` → `execute-ready` → … → `create-pr-ready` should always spawn).
- Add unit coverage in `scripts/test-cursor-workflow-handoff.sh`.

Document the defer/no-defer decision in `demo/demo-notes.md` during demo.

### Step 5 — Regression verification

Run `bash scripts/verify-workflow-paths.sh` — must exit 0.

Manually grep changed files for contradictions (e.g. "push before drafting" without "no PR.md in that push").

## Tests required

| Test | Maps to acceptance criterion | Notes |
|------|------------------------------|-------|
| `bash scripts/verify-workflow-paths.sh` | Workflow doc/skill changes only; no regression | Primary gate; includes shell tests for handoff hardening |
| Manual review: create-pr skill contains "single" / "one final push" / amend guidance | Skill instructs one handoff-triggering push | Demo Scenario 1 |
| Manual review: WORKFLOW.md batching subsection | WORKFLOW.md documents expectation | Demo Scenario 1 |
| Manual review: automation-prompts/create-pr.md aligned | Automation prompt aligned | Demo Scenario 1 |
| Simulated commit log check (demo) | No regression for workflow-only issues | Demo Scenario 2 — verify issue #92's own create-pr can complete in one `create-pr-ready` push |
| Optional admission gate test | Optional script guard | Only if Step 4 implemented |

No API, frontend, or Docker stack tests required.

## Gate script

```bash
bash scripts/verify-workflow-paths.sh
```

No phase gates (no application code changes).

## Documentation updates

| File | Update |
|------|--------|
| `.cursor/skills/create-pr/SKILL.md` | Batched push + SHA amend sequence |
| `workflow/cursor-workflow/WORKFLOW.md` | Create-pr push batching subsection |
| `workflow/cursor-workflow/automation-prompts/create-pr.md` | Aligned automation prompt |

No `README.md`, `AGENTS.md`, or `documents/` changes unless execute discovers broken cross-links (unlikely).

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Agents still double-push out of habit | Explicit "Do not" list + amend-before-push sequence; optional script guard in follow-up |
| Amend-before-push confuses agents | Numbered steps in skill; WORKFLOW.md cross-reference |
| Optional guard blocks legitimate babysit after `changes-requested` | Guard only applies when prior stage was already `create-pr-ready` within window, not after full re-open cycle |
| Script changes require merge to `main` for Actions | Document in PR Known Issues; standard deployment note |

**Rollback:** Revert the three doc files; no data migration or runtime impact.

## Definition of done

- [ ] `.cursor/skills/create-pr/SKILL.md` documents batched final push: optional early `create-pr-in-progress` (no `PR.md`); exactly one push with complete `PR.md` + `create-pr-ready`
- [ ] Skill documents SHA resolution **before** push (local commit → `rev-parse` → amend if needed → single push); forbids follow-up SHA fix push
- [ ] `workflow/cursor-workflow/WORKFLOW.md` documents create-pr push batching with cross-refs to #79 / #84
- [ ] `workflow/cursor-workflow/automation-prompts/create-pr.md` aligned with skill
- [ ] `bash scripts/verify-workflow-paths.sh` exits 0
- [ ] Demo artifacts committed per `demo/demo-spec.md`
- [ ] Optional script guard either implemented with tests **or** explicitly deferred with rationale in demo-notes
- [ ] `workflow.state.json` at `stage: execute-ready` after execute handoff (execute agent responsibility)
