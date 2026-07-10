# Issue #92: Batch create-pr pushes to single commit from issue #84 workflow review

## Summary

Reduce duplicate handoff runs at the `create-pr-ready` → babysit transition by updating the **create-pr skill** and **WORKFLOW.md** so agents commit `PR.md` and set `stage: create-pr-ready` in **one final push**, with demo image SHA URLs resolved before that commit. Optional script-level idempotency guard only if skill-only guidance proves insufficient.

## Problem

Issue [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) dogfooded the same rapid-push race class documented in [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79): the create-pr agent pushed two commits 14 seconds apart (`88e945c` PR.md at 06:56:36, `4715d93` demo image SHA fix at 06:56:50). Both landed with `stage=create-pr-ready`, triggering **two overlapping handoff runs** and contributing to a **triple babysit spawn** despite cross-run dedup ([#88](https://github.com/BlackLodgeLabs/cuebox/pull/88)) being on the branch.

Root cause for the extra handoff trigger: the create-pr skill currently instructs agents to:

1. Push `create-pr-in-progress` **before** drafting `PR.md`
2. Commit `PR.md` + state and push `create-pr-ready`
3. Sometimes push a **follow-up** commit to fix demo image SHA URLs

Each push to `cursor/issue-*` with a handoff `stage` can spawn the next agent. Rapid successive pushes widen the TOCTOU window for admission gate, pending lock, and recovery paths — even with [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) hardening.

**This issue reduces trigger frequency** (fewer pushes per create-pr stage) rather than fixing spawn races directly. It complements TOCTOU hardening and can land in parallel.

**Source:** [Issue #84 WORKFLOW-REVIEW § Top recommendation #5](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md), [§ Efficiency notes](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md); same guidance in [Issue #79 WORKFLOW-REVIEW](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md).

## Acceptance criteria

- [ ] `.cursor/skills/create-pr/SKILL.md` instructs agents to commit `PR.md` and set `create-pr-ready` in **one final push** — no intermediate push that includes partial `PR.md` or transitions to `create-pr-ready` before the PR description is complete
- [ ] Demo image / artifact SHA references in `PR.md` are resolved **before** the final commit (agent runs `git rev-parse HEAD` on the commit that will contain `PR.md`, or uses branch name only as documented fallback — no follow-up "fix demo image SHA" push)
- [ ] `workflow/cursor-workflow/WORKFLOW.md` documents the batched create-pr-ready push expectation in the create-pr / handoff section
- [ ] `workflow/cursor-workflow/automation-prompts/create-pr.md` aligned with the skill (if it still says "set stage and push" without batching guidance)
- [ ] Optional: handoff recovery or admission gate treats rapid `create-pr-ready` pushes within N seconds as idempotent (defer second spawn) — **only if** skill-only change is insufficient during dogfood
- [ ] No regression in create-pr workflow on issues that legitimately need a single `PR.md` commit (normal path unchanged except fewer intermediate pushes)
- [ ] `bash scripts/verify-workflow-paths.sh` passes (workflow doc/skill changes only unless optional script guard is added)

## Scope

### In scope

- `.cursor/skills/create-pr/SKILL.md` — batched final commit guidance; clarify relationship between `create-pr-in-progress` (local/state-only or single early push) and the **one** handoff-triggering push
- `workflow/cursor-workflow/WORKFLOW.md` — operator/agent documentation for create-pr push batching
- `workflow/cursor-workflow/automation-prompts/create-pr.md` — backup automation prompt alignment
- Optional hardening in handoff scripts (`cursor-workflow-handoff-recovery.sh`, admission gate, or handoff YAML) if skill-only guidance does not prevent duplicate spawns in practice

### Out of scope

- Spawn dedup mechanics ([#84](https://github.com/BlackLodgeLabs/cuebox/issues/84), [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90)) — separate issues (mostly landed)
- [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) recovery gaps — separate issue (landed)
- Babysit / create-pr script changes unrelated to push batching
- Application code, database, frontend
- Changing the handoff Action to coalesce multiple pushes (debounce at CI level) — prefer agent discipline first

## User flows / API changes

No end-user UI or product API changes. Workflow operators should observe:

| Scenario | Before | After |
|----------|--------|-------|
| create-pr completes | 2–3 pushes (`create-pr-in-progress`, `PR.md` + `create-pr-ready`, optional SHA fix) | 1–2 pushes: optional early `create-pr-in-progress` only; **one** push with complete `PR.md` + `create-pr-ready` |
| Handoff at create-pr-ready | Multiple Action runs within seconds → overlapping babysit spawns | One handoff run per create-pr completion in the common case |
| Orphan agents | Extra babysit agents from rapid pushes | Fewer concurrent handoff jobs and orphan agents |

**Implementation notes for planning:**

1. **Skill workflow reorder** — Keep reading sources locally first. Allow `create-pr-in-progress` state update in a **first** push (progress signal only, no `PR.md`) if the skill still requires early stage visibility; the **handoff-triggering** push must be exactly one commit containing final `PR.md` + `workflow.state.json` with `stage: create-pr-ready`. Do not push `PR.md` until demo URLs use the SHA of **that** commit (agent stages commit locally, computes SHA, embeds URLs, then commits once).

2. **SHA resolution pattern** — Document explicit sequence: stage `PR.md` + state locally → `git commit` (amend OK before push) → `git rev-parse HEAD` → verify/fix raw URLs in the same commit if needed (amend) → single `git push`. Never push then amend SHA in a second push.

3. **WORKFLOW.md placement** — Add subsection near "Stage-specific handoff behavior" / create-pr notes (alongside existing demo URL guidance at line ~304). Cross-reference issue #79 / #84 reviews.

4. **Optional script guard (defer unless needed)** — If dogfood still shows duplicate spawns from a single agent's double-push, consider: admission gate or recovery skipping spawn when `stage=create-pr-ready` unchanged and `agents.babysit-pr` null but a peer pending lock or recent same-stage push exists within N seconds (e.g. 30–60s). Must not block legitimate re-runs after `changes-requested`. Prefer measurement in PLAN demo-spec before adding script complexity.

5. **Regression check** — Issues with no demo screenshots (workflow-only changes) should still complete create-pr in one final push with only `PR.md` + state.

## Data and integration notes

- **Documentation-first** — primary deliverable is skill + workflow docs; no database, sync, or external product API changes
- **GitHub Actions** — each push to `cursor/issue-*` with handoff `stage` triggers `.github/workflows/cursor-workflow-handoff.yml`; reducing pushes directly reduces spawn opportunities
- **Scripts loaded from `main`** — optional handoff changes take effect only after merge to `main` (standard deployment note)
- **Depends on (recommended, not blocking):** [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88) spawn dedup baseline — already merged

## Open questions (must be empty before plan-ready)

_None — issue body, #84 review, and #79 review provide sufficient detail; optional script guard is explicitly deferred to execute if skill-only proves insufficient._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/92
- Source review (#84): [WORKFLOW-REVIEW.md § Top recommendation #5, § Efficiency notes](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md)
- Prior pattern (#79): [WORKFLOW-REVIEW.md — babysit multi-spawn from rapid create-pr pushes](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md)
- Current create-pr skill: [`.cursor/skills/create-pr/SKILL.md`](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/create-pr/SKILL.md)
- Handoff docs: [`workflow/cursor-workflow/WORKFLOW.md`](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)
- Retrospectives: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
