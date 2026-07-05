# Workflow review — Issue #28 / PR #67

**Review date:** 2026-07-03  
**Branch:** [`cursor/issue-28-hard-delete-past-recommendations`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-hard-delete-past-recommendations)  
**PR:** [#67](https://github.com/BlackLodgeLabs/cuebox/pull/67)  
**Reference:** [Cursor workflow docs](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

Issue #28 ran the Cursor workflow **once on 2026-07-03** after a human reset (`@cursoragent spec`, ignoring an earlier June 2026 plan on [PR #29](https://github.com/BlackLodgeLabs/cuebox/pull/29)). Stages **spec → plan → execute → demo → create-pr** completed in roughly **56 minutes** (14:22–15:18 UTC). The feature implementation, tests, demo evidence, and [PR.md](PR.md) are in good shape; [API CI](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28669112856) and [Frontend CI](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28669112855) are green on HEAD.

**Stage 7 (babysit-pr) never started.** [`workflow.state.json`](workflow.state.json) is stuck at `create-pr-ready`; [PR #67](https://github.com/BlackLodgeLabs/cuebox/pull/67) remains **draft**; the issue label is `cursor:create-pr-ready`. The demo/create-pr tail was disrupted by **parallel cloud agents** (five demo side-branches), **merge conflicts** on demo artifacts, and **Cursor API 400 errors** (concurrent agent limit). Compared with [issue #59 / PR #60](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-59/WORKFLOW-REVIEW.md), this run shows progress on agent-ID preservation (issue #62 merge) but exposes a new failure mode: **handoff never reaches babysit when stage oscillates and the final push does not change `stage`.**

---

## Expected workflow (baseline)

Per [WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md) and [SETUP.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/SETUP.md):

| Stage | Trigger | Skill | Key output |
|-------|---------|-------|------------|
| 1 | Human creates issue | — | GitHub issue |
| 2 | `@cursoragent spec` | `review-and-spec` | [SPEC.md](SPEC.md), `spec-ready` |
| 3 | Handoff | `planning` | [PLAN.md](PLAN.md), [demo-spec.md](demo/demo-spec.md), `plan-ready` |
| 4 | Handoff | `execute` | Code + tests, `execute-ready` |
| 5 | Handoff | `demo` | [demo/](demo/) artifacts, `demo-ready` |
| 6 | Handoff | `create-pr` | [PR.md](PR.md), `create-pr-ready` |
| 7 | Handoff | `babysit-pr` | PR ready for review, `complete` |
| 8 | Human | — | Merge |

Draft PR creation at `spec-ready` is done by [`.github/workflows/cursor-workflow-handoff.yml`](https://github.com/BlackLodgeLabs/cuebox/blob/main/.github/workflows/cursor-workflow-handoff.yml). Visibility is via the [issue status comment](https://github.com/BlackLodgeLabs/cuebox/issues/28#issuecomment-4877232502), `cursor:*` labels, and [`workflow.state.json`](workflow.state.json).

---

## Pre-workflow history

| Date | Event | Notes |
|------|-------|-------|
| 2026-06-17 | [Issue #28](https://github.com/BlackLodgeLabs/cuebox/issues/28) opened | Feature request for hard delete |
| 2026-06-19 | Human [`@cursoragent plan`](https://github.com/BlackLodgeLabs/cuebox/issues/28#issuecomment-4750273440) | Pre-workflow style: plan saved to `documents/recommendation-history-delete-plan.md`, [draft PR #29](https://github.com/BlackLodgeLabs/cuebox/pull/29) |
| 2026-07-03 | Human [`@cursoragent spec` (ignore previous plans)](https://github.com/BlackLodgeLabs/cuebox/issues/28#issuecomment-4877204429) | Proper workflow restart on `cursor/issue-28-hard-delete-past-recommendations` |

The June plan was correctly superseded. No `workflow/issues/issue-28/` artifacts exist from that pass.

---

## What happened — timeline

Agent links open conversations in the [Cursor agents UI](https://cursor.com/agents). IDs are from [`workflow.state.json`](workflow.state.json) and [handoff Action logs](https://github.com/BlackLodgeLabs/cuebox/actions/workflows/cursor-workflow-handoff.yml). Steps without a recorded ID show **—**.

### 2026-07-03 — Automated pass (incomplete at babysit)

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 14:22 | Human [`@cursoragent spec`](https://github.com/BlackLodgeLabs/cuebox/issues/28#issuecomment-4877204429) | — | — |
| 14:24 | `spec-in-progress` ([`edf1a49`](https://github.com/BlackLodgeLabs/cuebox/commit/edf1a49698376cc9a1b49db2e1767b6ea111347d)) | `spec-in-progress` | [`bc-80b9393e…`](https://cursor.com/agents/bc-80b9393e-eb78-4c87-aba5-f1bd7b591a64) (spec reply) |
| 14:25 | [SPEC.md](SPEC.md) committed ([`2769c90`](https://github.com/BlackLodgeLabs/cuebox/commit/2769c90ba77b90f22b7ff23194d638241078b65f)) | `spec-ready` | [`bc-80b9393e…`](https://cursor.com/agents/bc-80b9393e-eb78-4c87-aba5-f1bd7b591a64) |
| 14:29 | Actions linked [draft PR #67](https://github.com/BlackLodgeLabs/cuebox/pull/67) ([`552a9a3`](https://github.com/BlackLodgeLabs/cuebox/commit/552a9a38b350793bf2f0d81a00790d1245de3c51)) | planning handoff | — (GitHub Actions) |
| 14:29 | Planning agent recorded ([`bafc78c`](https://github.com/BlackLodgeLabs/cuebox/commit/bafc78c8a3f86d87d54e495a4a2a4899c251e20e)) | handoff | [`bc-70e8bf39…`](https://cursor.com/agents/bc-70e8bf39-267e-4f87-b08c-4f8571cff09a) |
| 14:32 | `plan-in-progress` ([`79e5ae7`](https://github.com/BlackLodgeLabs/cuebox/commit/79e5ae75130a77265c1abd34fac33db9bbeebc67)) | `plan-in-progress` | [`bc-70e8bf39…`](https://cursor.com/agents/bc-70e8bf39-267e-4f87-b08c-4f8571cff09a) |
| 14:34 | [PLAN.md](PLAN.md) + [demo-spec.md](demo/demo-spec.md) ([`826157f`](https://github.com/BlackLodgeLabs/cuebox/commit/826157f1843cf3e35b8c93dda30e793fd73e69f7)) | `plan-ready` | [`bc-70e8bf39…`](https://cursor.com/agents/bc-70e8bf39-267e-4f87-b08c-4f8571cff09a) |
| 14:37 | Execute agent recorded ([`2f24dc8`](https://github.com/BlackLodgeLabs/cuebox/commit/2f24dc8c5b72ca9a11467554578ed261f407d15b)) | handoff | [`bc-b341671c…`](https://cursor.com/agents/bc-b341671c-e127-4b03-be94-8d732f4da013) |
| 14:40–14:50 | Feature + fixes ([`e62f790`](https://github.com/BlackLodgeLabs/cuebox/commit/e62f790df759afb8bfc466bef3fe6b0ea3ce2861), [`1dbfb8e`](https://github.com/BlackLodgeLabs/cuebox/commit/1dbfb8e3cb5ed9a199ec007e25210e1490edf294), [`bb479da`](https://github.com/BlackLodgeLabs/cuebox/commit/bb479dabf00a8990fbf098d8783f91a6b43fd928)) | state still `plan-ready` during first code commit | [`bc-b341671c…`](https://cursor.com/agents/bc-b341671c-e127-4b03-be94-8d732f4da013) |
| 14:50 | `execute-ready` ([`f81f0fa`](https://github.com/BlackLodgeLabs/cuebox/commit/f81f0faa5386d3e9ba6030f8fd221a0ce56eb4f4)) | demo handoff | [`bc-b341671c…`](https://cursor.com/agents/bc-b341671c-e127-4b03-be94-8d732f4da013) |
| 14:51 | Merge execute branch ([`77f65b6`](https://github.com/BlackLodgeLabs/cuebox/commit/77f65b6138cb136969025b915eba332ebc118848)) | handoff spawns demo | [`bc-7e67995a…`](https://cursor.com/agents/bc-7e67995a-ac9c-4159-9192-00535bd9a83f) |
| 14:52–14:57 | Multiple demo agent side-branches created; `demo-in-progress` ([`8494edb`](https://github.com/BlackLodgeLabs/cuebox/commit/8494edbd21801df9bb6defc013890806d2bf7072)) | `demo-in-progress` | [`bc-7e67995a…`](https://cursor.com/agents/bc-7e67995a-ac9c-4159-9192-00535bd9a83f) + **4 additional demo branches** (see below) |
| 15:06–15:10 | Competing demo/create-pr commits; merge conflict resolution ([`447d1ac`](https://github.com/BlackLodgeLabs/cuebox/commit/447d1accc8f62513184eb84807fb01d7179fa56c)) | stage regressed `create-pr-ready` → `demo-ready` on merge | multiple agents |
| 15:06 | First successful `demo-ready` → create-pr handoff ([run 28668785257](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668785257)) | spawns create-pr | [`bc-7ac76c63…`](https://cursor.com/agents/bc-7ac76c63-0f1c-4b8f-a622-303b84847772) |
| 15:08–15:11 | Two failed handoffs — Cursor API **400 concurrent agent limit** ([runs 28668888024](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668888024), [28668999510](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668999510)) | `demo-ready` re-handoff to create-pr | — |
| 15:07–15:12 | [PR.md](PR.md) written/rewritten (multiple commits) | `create-pr-ready` | [`bc-7ac76c63…`](https://cursor.com/agents/bc-7ac76c63-0f1c-4b8f-a622-303b84847772) |
| 15:13 | Final push ([`e23b02d`](https://github.com/BlackLodgeLabs/cuebox/commit/e23b02df5a85a53e3917e6b147ed45f5cf66d311)); handoff **sync only** ([run 28669110370](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28669110370)) | `create-pr-ready` — **no babysit spawn** | — |

**Duration (spec trigger → create-pr-ready):** ~56 minutes.  
**Babysit:** not reached.

### Parallel agent side-branches (issue #28 / PR #67)

Handoff spawns use named branches (post [PR #66](https://github.com/BlackLodgeLabs/cuebox/pull/66)). Eight side-branches were created for this issue:

| Branch suffix | Stage | Notes |
|---------------|-------|-------|
| [`plan-agent-d1df`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-pr-67-plan-agent-d1df) | planning | Merged cleanly |
| [`execute-agent-9312`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-pr-67-execute-agent-9312) | execute | Merged to main issue branch |
| [`execute-agent-ea44`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-pr-67-execute-agent-ea44) | execute | **Duplicate** execute agent; not merged |
| [`demo-agent-3249`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-pr-67-demo-agent-3249) | demo | Partial demo artifacts |
| [`demo-agent-34c5`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-pr-67-demo-agent-34c5) | demo | Partial demo artifacts |
| [`demo-agent-68d3`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-pr-67-demo-agent-68d3) | demo | Partial demo artifacts |
| [`demo-agent-be1b`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-pr-67-demo-agent-be1b) | demo | Partial demo artifacts |
| [`demo-agent-ea6c`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-28-pr-67-demo-agent-ea6c) | demo | Partial demo artifacts |

### Agent index (recorded IDs)

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| review-and-spec | — (null in state) | [`bc-80b9393e…`](https://cursor.com/agents/bc-80b9393e-eb78-4c87-aba5-f1bd7b591a64) (issue comment only) |
| planning | `bc-70e8bf39-267e-4f87-b08c-4f8571cff09a` | [Open](https://cursor.com/agents/bc-70e8bf39-267e-4f87-b08c-4f8571cff09a) |
| execute | `bc-b341671c-e127-4b03-be94-8d732f4da013` | [Open](https://cursor.com/agents/bc-b341671c-e127-4b03-be94-8d732f4da013) |
| demo | `bc-7e67995a-ac9c-4159-9192-00535bd9a83f` | [Open](https://cursor.com/agents/bc-7e67995a-ac9c-4159-9192-00535bd9a83f) |
| create-pr | `bc-7ac76c63-0f1c-4b8f-a622-303b84847772` | [Open](https://cursor.com/agents/bc-7ac76c63-0f1c-4b8f-a622-303b84847772) |
| babysit-pr | — | never spawned |

**HEAD state ([`workflow.state.json`](workflow.state.json)):** `create-pr-ready`, `loops.total_runs: 6`, `loops.bugbot: 0`, `loops.ci_autofix: 0`.  
**PR state:** Open, **draft**, CI green.

---

## What worked as designed

1. **Human reset and spec handoff** — `@cursoragent spec` (ignore PR #29) produced a thorough [SPEC.md](SPEC.md) with exposure-reversal acceptance criteria; Actions created [draft PR #67](https://github.com/BlackLodgeLabs/cuebox/pull/67) at `spec-ready`.
2. **Planning chain** — [PLAN.md](PLAN.md) and [demo-spec.md](demo/demo-spec.md) committed with `plan-in-progress` → `plan-ready`; execute handoff fired ([run 28667138947](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28667138947)).
3. **Implementation quality** — Plan deliverables landed: [`DELETE /recommendations/{session_id}`](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-28-hard-delete-past-recommendations/api/app/routers/v1/recommendations.py), exposure reversal in [`recommendation_service.py`](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-28-hard-delete-past-recommendations/api/app/services/recommendation_service.py), history list/detail UI, integration tests, mocked Playwright E2E, [api-contracts §8.2](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-28-hard-delete-past-recommendations/documents/api-contracts.md).
4. **Agent ID preservation (partial)** — Unlike [issue #59](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-59/WORKFLOW-REVIEW.md), planning/execute/demo/create-pr IDs survived in state (issue [#62](https://github.com/BlackLodgeLabs/cuebox/pull/63) merge helper). [Issue status comment](https://github.com/BlackLodgeLabs/cuebox/issues/28#issuecomment-4877232502) shows links for those stages.
5. **Demo evidence** — All four [demo-spec](demo/demo-spec.md) scenarios **PASS** in final [demo-notes.md](demo/demo-notes.md) at [`eaa7db4`](https://github.com/BlackLodgeLabs/cuebox/commit/eaa7db4cbb9370dc77a371d33e415cf4b7fd0d99); screenshots use absolute URLs in [PR.md](PR.md).
6. **CI** — [API CI](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28669112856) and [Frontend CI](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28669112855) pass on HEAD.
7. **Handoff agent naming** — [PR #66](https://github.com/BlackLodgeLabs/cuebox/pull/66) display names (e.g. `Issue #28 / PR #67 - Demo Agent`) appear in Action logs and aid debugging.

---

## What did not happen (or deviated)

### Workflow stages

| Expected ([WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)) | Observed on #28 |
|-----|--------|
| Stage 7 babysit → `complete`, PR marked ready | **Never started** — stuck at `create-pr-ready` |
| `create-pr-ready` handoff spawns babysit-pr | **No successful handoff log** for `Babysit PR Agent`; final Action run was [sync only](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28669110370) because `stage` unchanged |
| One agent per stage | **5 demo** + **2 execute** side-branches; duplicate `demo-ready` → create-pr handoffs (3 attempts) |
| Agents commit `execute-in-progress` / `create-pr-in-progress` before work ([execute](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/execute/SKILL.md), [create-pr](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/create-pr/SKILL.md) skills) | **`execute-in-progress` and `create-pr-in-progress` never committed** |
| `review-and-spec` agent in `agents` map | **`review-and-spec: null`** — only visible via [issue comment](https://github.com/BlackLodgeLabs/cuebox/issues/28#issuecomment-4877204978) |
| Demo agent does not change production code | Execute fix [`bb479da`](https://github.com/BlackLodgeLabs/cuebox/commit/bb479dabf00a8990fbf098d8783f91a6b43fd928) landed before `execute-ready`; acceptable but indicates execute self-correction after initial push |

### Handoff failures

| Run | Trigger | Failure |
|-----|---------|---------|
| [28668888024](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668888024) | Merge demo artifacts | Cursor API **400**: concurrent Cloud Agent limit |
| [28668999510](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668999510) | Demo refresh commit | Same **400** on re-handoff to create-pr |
| [28668863017](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668863017) | First PR.md + `create-pr-ready` | Run **cancelled/failed** — babysit handoff window missed |

When [`447d1ac`](https://github.com/BlackLodgeLabs/cuebox/commit/447d1accc8f62513184eb84807fb01d7179fa56c) resolved demo merge conflicts, `workflow.state.json` **regressed** from `create-pr-ready` to `demo-ready`, re-triggering create-pr spawns instead of babysit.

### Execute / gate requirements

| Requirement ([PLAN.md](PLAN.md), [execute skill](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/execute/SKILL.md)) | Evidence |
|------------|----------|
| `verify-phase5-gates.sh` + `verify-phase6-gates.sh` before push | Listed in [PR.md](PR.md) How to Test; **no gate exit SHA recorded** (contrast [issue #62 PR.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-62/PR.md)) |
| Default `verify-phase8-gates.sh` per execute skill | Not referenced in PR.md |
| CI as substitute | CI green — sufficient for merge confidence but not documented as gate evidence |

### Demo artifacts

| Issue | Detail |
|-------|--------|
| Wrong commit SHA in [demo-notes.md](demo/demo-notes.md) | References `b213229` (demo side-branch) instead of merged HEAD |
| Multiple competing demo commits | Four `demo(issue-28):` commits + merge commit before stable artifacts |
| Scenario 4 initially partial | Early PR.md drafts noted gap; final [`eaa7db4`](https://github.com/BlackLodgeLabs/cuebox/commit/eaa7db4cbb9370dc77a371d33e415cf4b7fd0d99) shows PASS |

---

## Efficiency observations

**Efficient**

- Single-calendar-day pass from spec to PR description (~56 min for stages 2–6).
- Execute delivered the vertical slice in three logical commits (feature, import fix, SQL delete/toast/test fixes).
- Exposure-reversal design reused existing `increment_exposure` pattern — no migration.
- First half of the pipeline (spec → execute) ran without loop-limit or blocked states.

**Less efficient**

- **34 commits** in the workflow window; **14** are `chore(workflow): record * agent` — meta churn from parallel spawns.
- **Five demo agents** ran overlapping work; merge conflict commit [`447d1ac`](https://github.com/BlackLodgeLabs/cuebox/commit/447d1accc8f62513184eb84807fb01d7179fa56c) was required.
- **Six create-pr/PR.md commits** (`569ff22` through `e23b02d`) — duplicate create-pr agents rewriting the same file.
- **Cloud agent quota** blocked handoffs twice; agents kept running while Actions failed, wasting concurrent slots.
- **Babysit never ran** — human review notification ([`cursor-workflow-notify-complete.sh`](https://github.com/BlackLodgeLabs/cuebox/blob/main/scripts/cursor-workflow-notify-complete.sh)) not fired; author not @mentioned for final review.

---

## Issues to learn from

1. **Concurrent agent limit is a workflow blocker** — When the Cursor API returns 400, the handoff Action fails hard ([run 28668999510](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668999510)). No retry, no queue, no fallback `@cursoragent` comment. Babysit never gets a chance to spawn.

2. **Stage regression on merge** — Merge commit [`447d1ac`](https://github.com/BlackLodgeLabs/cuebox/commit/447d1accc8f62513184eb84807fb01d7179fa56c) took `demo-ready` over `create-pr-ready`, causing duplicate downstream handoffs. [`cursor-workflow-merge-state.sh`](https://github.com/BlackLodgeLabs/cuebox/blob/main/scripts/cursor-workflow-merge-state.sh) was not used on that merge.

3. **Handoff deduplication gap** — `demo-ready` triggered create-pr handoff **three times** because stage bounced. No guard prevents spawning a new create-pr agent when one is already active or when `agents.create-pr` is set.

4. **Progress stages still skipped** — Same class of issue as [#59](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-59/WORKFLOW-REVIEW.md): code at [`e62f790`](https://github.com/BlackLodgeLabs/cuebox/commit/e62f790df759afb8bfc466bef3fe6b0ea3ce2861) while state showed `plan-ready`. Labels on the issue were correct transiently; branch file lagged.

5. **Terminal handoff requires stage *change*** — Once stable at `create-pr-ready`, further PR.md pushes ([`e23b02d`](https://github.com/BlackLodgeLabs/cuebox/commit/e23b02df5a85a53e3917e6b147ed45f5cf66d311)) did not re-trigger babysit ([run 28669110370](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28669110370): "unchanged — sync only"). A missed or failed first `create-pr-ready` transition cannot be recovered without manual resync or a no-op stage bump.

6. **Spec agent discovery still incomplete** — `review-and-spec` remains null despite [`bc-80b9393e…`](https://cursor.com/agents/bc-80b9393e-eb78-4c87-aba5-f1bd7b591a64) in the issue comment. [`cursor-workflow-discover-agents.sh`](https://github.com/BlackLodgeLabs/cuebox/blob/main/scripts/cursor-workflow-discover-agents.sh) did not backfill before the status comment was finalized.

7. **Comparison with [#59](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-59/WORKFLOW-REVIEW.md) and [#62](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-62/PLAN.md)** — Issue #62 hardened state merge and pass-back; issue #28 benefited (agent IDs preserved) but exposed **multi-agent concurrency** as the next bottleneck. Issue #59 reached `complete` once; #28 did not reach babysit.

---

## Deliverable checklist (feature vs workflow)

| Item | Status |
|------|--------|
| [SPEC.md](SPEC.md) acceptance criteria | Implemented; unchecked in spec file |
| [PLAN.md](PLAN.md) steps | Delivered |
| Tests (integration + unit + Playwright mocked) | Present; CI green |
| Demo artifacts | Present; all scenarios PASS at [`eaa7db4`](https://github.com/BlackLodgeLabs/cuebox/commit/eaa7db4cbb9370dc77a371d33e415cf4b7fd0d99) |
| [PR.md](PR.md) | Present with absolute demo URLs |
| Babysit → `complete` | **Not done** |
| PR ready for human review | **Not done** (still draft) |
| Human merge | Pending |

---

## Top 5 recommendations for the next issue/PR

### 1. Add handoff deduplication and babysit recovery

Extend [`.github/workflows/cursor-workflow-handoff.yml`](https://github.com/BlackLodgeLabs/cuebox/blob/main/.github/workflows/cursor-workflow-handoff.yml) to: (a) skip spawning when `agents.<skill>` is already set and the prior handoff was recent; (b) on push to `create-pr-ready` where `agents.babysit-pr` is null and PR is still draft, spawn babysit even if `stage` unchanged (or require create-pr agent to bump `updated_at` through a `babysit-queued` pseudo-transition). Issue #28 missed babysit because the first `create-pr-ready` transition failed/cancelled and later pushes were sync-only.

### 2. Handle Cursor API concurrent-agent limit without failing the workflow

When the API returns 400 (quota), the Action should: log a warning, post a single issue comment with recovery steps, and retry with backoff — not `exit 1`. Optionally fall back to `CURSOR_HANDOFF_GITHUB_TOKEN` `@cursoragent` comment. Issue #28 lost two handoffs ([28668888024](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668888024), [28668999510](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28668999510)) while extra demo/create-pr agents still consumed quota.

### 3. Require merge helper on every agent branch merge to main issue branch

Document and enforce: before merging `cursor/issue-NNN-pr-MMM-*-agent-*` into `cursor/issue-NNN-*`, always run [`cursor-workflow-merge-state.sh`](https://github.com/BlackLodgeLabs/cuebox/blob/main/scripts/cursor-workflow-merge-state.sh) and never take a lower `stage` from the side branch. Merge [`447d1ac`](https://github.com/BlackLodgeLabs/cuebox/commit/447d1accc8f62513184eb84807fb01d7179fa56c) regressed `create-pr-ready` → `demo-ready` and re-spawned create-pr agents.

### 4. Serialize demo stage — one demo agent per issue

Five demo side-branches for one issue is wasteful and caused artifact conflicts. Options: (a) handoff sets a `handoff_pending` lock in state before API call; (b) demo agents push only to their side branch and a single Action job merges to the issue branch; (c) kill prior same-stage agent via API when spawning a replacement. Aligns with demo skill rule: one authoritative `demo-notes.md` per run.

### 5. Record gate evidence and commit progress stages

Add to [create-pr skill](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/create-pr/SKILL.md) / [PR template](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/templates/PR.md): one line with gate script name + exit 0 + commit SHA (as [issue #62](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-62/PR.md) does). Reinstate progress-stage commits (`execute-in-progress`, `create-pr-in-progress`) in agent checklists; optional CI check that production diffs do not land while `stage` is `plan-ready` or `complete`.

---

## References

- Issue: https://github.com/BlackLodgeLabs/cuebox/issues/28  
- PR: https://github.com/BlackLodgeLabs/cuebox/pull/67  
- Pre-workflow plan PR: https://github.com/BlackLodgeLabs/cuebox/pull/29  
- Workflow docs: [WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md), [SETUP.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/SETUP.md)  
- Artifacts: [SPEC.md](SPEC.md), [PLAN.md](PLAN.md), [PR.md](PR.md), [demo/](demo/), [workflow.state.json](workflow.state.json)  
- Prior workflow reviews: [issue-59](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-59/WORKFLOW-REVIEW.md), [issue-62](https://github.com/BlackLodgeLabs/cuebox/tree/main/workflow/issues/issue-62)  
- Related workflow hardening: [PR #63 (issue #62)](https://github.com/BlackLodgeLabs/cuebox/pull/63), [PR #66 (agent naming)](https://github.com/BlackLodgeLabs/cuebox/pull/66)
