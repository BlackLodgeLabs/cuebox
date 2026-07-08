# Workflow review — Issue #92 / PR #97

**Review date:** 2026-07-08  
**Branch:** [`cursor/issue-92-batch-create-pr-single-commit`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-92-batch-create-pr-single-commit)  
**PR:** [#97](https://github.com/BlackLodgeLabs/cuebox/pull/97)  
**Reference:** [Cursor workflow docs](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

Issue #92 delivered its scoped documentation changes (create-pr batched final push guidance in the skill, `WORKFLOW.md`, and automation prompt) through planning, execute, and demo with `verify-workflow-paths.sh` passing. The run **did not reach `complete`**: babysit was triggered twice via PAT fallback after pending-lock deferrals, `workflow.state.json` remains at `create-pr-ready` while GitHub labels show `cursor:babysit-in-progress`, and no `agents.babysit-pr` is recorded.

The headline deviation is ironic dogfood: the demo agent pushed a follow-up SHA-fix commit 38s after `demo-ready`, and create-pr spawned **two** `create-pr-ready` handoffs (orphan Cloud Agent side branch `cursor/issue-92-pr-97-create-pr-agent-97ca` at 19:20:34 UTC, then canonical branch at 19:22:02 UTC) — the exact race class this issue was written to prevent.

**Parallel run with issue #91** (started ~2 minutes earlier) had a **moderate detrimental effect on #92** at the create-pr→babysit boundary (pending-lock deferrals, overlapping handoff jobs) but **did not block #91**, which reached `complete` at 19:21:33 UTC. The root cause of duplicate babysit triggers is side-branch handoffs, not cross-issue interference alone; parallel execution amplified contention.

**Duration (spec trigger → review):** ~54 minutes (18:50 UTC spec → 19:44 UTC workflow-review request).  
**Babysit / complete:** Not reached — stuck after duplicate PAT-fallback babysit comments (19:22:22 and 19:23:49 UTC).

---

## Expected workflow (baseline)

Per [WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md) and [SETUP.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/SETUP.md):

| Stage | Trigger | Skill | Key output |
|-------|---------|-------|------------|
| 1 | Human creates issue | — | GitHub issue |
| 2 | `@cursoragent spec` | `review-and-spec` | SPEC.md, `spec-ready` |
| 3 | Handoff | `planning` | PLAN.md, demo-spec.md, `plan-ready` |
| 4 | Handoff | `execute` | Code + tests, `execute-ready` |
| 5 | Handoff | `demo` | demo/ artifacts, `demo-ready` |
| 6 | Handoff | `create-pr` | PR.md, `create-pr-ready` |
| 7 | Handoff | `babysit-pr` | PR ready for review, `complete` |
| 8 | Human | — | Merge |

---

## What happened — timeline

Agent links open conversations in the [Cursor agents UI](https://cursor.com/agents). IDs are from `workflow.state.json` and handoff Action logs.

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 18:50:36 | `@cursoragent spec` on issue | — | — |
| 18:51:54 | `spec-in-progress` push | spec-in-progress | — |
| 18:52:52 | SPEC.md + `spec-ready` | spec-ready | [`bc-556ee75d`](https://cursor.com/agents/bc-556ee75d-ce31-4a0f-8267-bb44ee94ec26) (spec comment; not in state `agents`) |
| 18:55:05 | Draft PR #97 linked (Actions) | spec-ready | — |
| 18:56:16–22 | `handoff_pending` + planning spawn recorded | plan-in-progress | [`bc-dd9f4b1e`](https://cursor.com/agents/bc-dd9f4b1e-c695-467a-8de4-f0799cae6561) |
| 18:58:21 | Plan-in-progress push | plan-in-progress | bc-dd9f4b1e |
| 19:05:00 | PLAN.md + demo-spec + `plan-ready` | plan-ready | bc-dd9f4b1e |
| 19:06:20 | Execute spawn recorded | execute-in-progress | [`bc-78b1055d`](https://cursor.com/agents/bc-78b1055d-7abd-47af-a2b7-c8786c7030f7) |
| 19:08:51 | Skill + WORKFLOW.md + automation prompt + `execute-ready` | execute-ready | bc-78b1055d |
| 19:10:17 | Demo spawn recorded | demo-in-progress | [`bc-c8d10b76`](https://cursor.com/agents/bc-c8d10b76-6638-42b0-a537-0d605dc6838b) |
| 19:13:51 | Demo artifacts + `demo-ready` | demo-ready | bc-c8d10b76 |
| 19:14:29 | **Follow-up SHA fix** in demo-notes (38s later) | demo-ready (unchanged) | bc-c8d10b76 |
| 19:15:18 | Create-pr spawn recorded | create-pr-in-progress | [`bc-d6fd71b9`](https://cursor.com/agents/bc-d6fd71b9-f9c2-493a-a463-17efda390af3) |
| 19:21:17 | `create-pr-in-progress` on canonical branch | create-pr-in-progress | bc-d6fd71b9 |
| 19:20:34 | **Side branch** `cursor/issue-92-pr-97-create-pr-agent-97ca` push with `create-pr-ready` | create-pr-ready | bc-d6fd71b9 |
| 19:21:55 | Canonical branch: PR.md + `create-pr-ready` (single commit) | create-pr-ready | bc-d6fd71b9 |
| 19:22:02 | Two handoff runs fire on same SHA (side + canonical refs) | create-pr-ready | — |
| 19:22:21 | Deferral comment (pending-lock) on issue #92 | — | — |
| 19:22:22 | **First** PAT-fallback `@cursoragent` babysit comment | babysit-in-progress (label) | — |
| 19:23:49 | **Second** PAT-fallback babysit comment | babysit-in-progress (label) | — |
| 19:44:17 | Human `@cursoragent workflow-review` | babysit-in-progress (label) / `create-pr-ready` (file) | — |

**Duration (spec trigger → review):** ~54 minutes.  
**Babysit / complete:** Not reached.

### Parallel issue #91 overlap

Issue #91 spec triggered at **18:48:43 UTC** (~2 min before #92). Both issues ran the full pipeline concurrently through 19:22 UTC.

| Time (UTC) | Issue #91 event | Issue #92 event (same window) |
|------------|-----------------|-------------------------------|
| 18:48–18:53 | Spec + draft PR #98 | — (spec starts 18:50) |
| 18:56–19:05 | Planning + plan-ready | Planning in progress |
| 19:00–19:04 | Execute (side branch `cursor/issue-91-pr-98-execute-agent-a78d`) | Execute starting |
| 19:08–19:09 | Execute-ready + demo | Execute-ready pushed |
| 19:09–19:12 | Demo + create-pr (side branch `cursor/issue-91-pr-98-create-pr-agent-793c`) | Demo running |
| 19:19:44 | #91 babysit-in-progress | #92 demo finishing |
| 19:21:33 | **#91 `complete`** | #92 create-pr-in-progress |
| 19:20–19:23 | #91 handoff jobs winding down | #92 duplicate babysit PAT fallbacks |

**#91 outcome:** Reached `complete`; PR #98 ready for review. Planning agent ID is `null` in final state (cosmetic index gap only).

### Parallel agent side-branches

| Branch suffix | Stage pushed | Notes |
|---------------|--------------|-------|
| `cursor/issue-92-pr-97-create-pr-agent-97ca` | `create-pr-ready` | Cloud Agent workspace branch; triggered handoff run [28969396187](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28969396187) with `BEFORE_SHA=000…` → first babysit spawn attempt |
| `cursor/issue-91-pr-98-execute-agent-a78d` | execute-ready | #91 execute agent side branch (merged to canonical) |
| `cursor/issue-91-pr-98-create-pr-agent-793c` | create-pr-ready | #91 create-pr side branch |

Handoff concurrency is **per git ref** (`cursor-handoff-${{ github.ref }}`), so side-branch and canonical-branch pushes for the same issue run **in parallel**, not serialized.

### Agent index

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| review-and-spec | — (bc-556ee75d in issue comment only) | Not persisted in `workflow.state.json` |
| planning | bc-dd9f4b1e-c695-467a-8de4-f0799cae6561 | [link](https://cursor.com/agents/bc-dd9f4b1e-c695-467a-8de4-f0799cae6561) |
| execute | bc-78b1055d-7abd-47af-a2b7-c8786c7030f7 | [link](https://cursor.com/agents/bc-78b1055d-7abd-47af-a2b7-c8786c7030f7) |
| demo | bc-c8d10b76-6638-42b0-a537-0d605dc6838b | [link](https://cursor.com/agents/bc-c8d10b76-6638-42b0-a537-0d605dc6838b) |
| create-pr | bc-d6fd71b9-f9c2-493a-a463-17efda390af3 | [link](https://cursor.com/agents/bc-d6fd71b9-f9c2-493a-a463-17efda390af3) |
| babysit-pr | — | Never API-spawned; two PAT-fallback comments only |

---

## What worked as designed

1. **Spec → plan → execute → demo pipeline** completed without stage oscillation or passback; each handoff stage advanced once on the canonical branch.
2. **Execute delivered all acceptance-criteria files** — create-pr skill batched-push section, `WORKFLOW.md` subsection, automation prompt alignment.
3. **`verify-workflow-paths.sh` passed** during demo (Scenario 1 log committed).
4. **Optional admission-gate guard correctly deferred** per PLAN Step 4; demo-notes document defer rationale.
5. **Cross-run pending lock partially worked** — API spawn was deferred rather than triple-spawning babysit agents via Cursor API; PAT fallback is the escape hatch when lock retries exhaust.
6. **Parallel #91 run completed independently** — global 8-agent cap was not hit; #91 was not starved by #92.

---

## What did not happen (or deviated)

### Stage / label drift

- `workflow.state.json` at tip (`52d697c`): `stage: create-pr-ready`, `active_skill: create-pr`, `handoff_pending.skill: babysit-pr`.
- GitHub issue label / status comment: `cursor:babysit-in-progress`.
- Babysit agent never recorded in `agents.babysit-pr`; `loops.total_runs` stuck at 5.
- PAT fallback updated labels via `cursor-workflow-sync-github-status.sh` but did not commit `babysit-in-progress` back to the branch.

### Parallel agents or handoff failures

- **Duplicate babysit PAT-fallback comments** (19:22:22 and 19:23:49) from two handoff runs on the same `create-pr-ready` transition:
  - Run [28969396187](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28969396187) — push to side branch `cursor/issue-92-pr-97-create-pr-agent-97ca`.
  - Run [28969481891](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28969481891) — push to canonical branch.
- Both runs logged `Spawn deferred (pending-lock)` × 3, then PAT fallback. Neither recorded a babysit agent ID.
- **Concurrent #91 complete handoff** at 19:21:37 added repo-wide handoff activity during #92's create-pr window; logs show pending-lock deferrals, not cap-limit deferrals.

### Demo / CI / review gaps

- **Demo dogfood violated batching intent:** `f1934f7` "fix commit SHA in demo-notes" 38s after `aabc0e3` demo-ready — same SHA-chase pattern #92 documents for create-pr (demo skill has no equivalent amend-before-push guidance yet).
- **Create-pr dogfood partial:** Canonical branch used one `create-pr-ready` commit (`52d697c`) after optional `create-pr-in-progress` (`86dbfb7`) — acceptable per spec. However, side branch pushed `create-pr-ready` **first**, triggering an extra handoff before canonical merge.
- **PR.md claims** "This PR dogfoods its own guidance: … no follow-up SHA-fix commit" — true for create-pr on canonical branch only; demo stage and side-branch push contradict the spirit of the acceptance criteria.
- **CI:** Handoff checks passed; no application CI (docs-only). PR remains draft; babysit never marked ready for review.

---

## Efficiency notes

- **20 commits** on canonical branch (including 7 GitHub Actions meta commits for pending/spawn records).
- **2 wasted babysit PAT-fallback spawns** (potential duplicate cloud agents) from side-branch + canonical double handoff.
- **Parallel #91 + #92** ran ~12 concurrent cloud agents across both issues during peak (spec through create-pr), multiplying handoff Action runs. Acceptable under 8-run cap but increased pending-lock wait times.
- **Irony cost:** Issue fixes rapid-push races; its own demo and side-branch create-pr reproduced them.

---

## Issues to learn from

1. **Handoff fires on all `cursor/issue-*` branches**, including Cloud Agent side branches (`cursor/issue-N-pr-*-agent-*`). Concurrency groups are per-ref, so the same issue can trigger parallel handoffs for one logical stage transition.
2. **Side-branch `create-pr-ready` before canonical merge** is a new duplicate-trigger path distinct from "PR.md then SHA fix on canonical branch" (#84 pattern) but equally dangerous.
3. **PAT fallback does not dedupe** — when two handoff runs exhaust pending-lock retries, both post `@cursoragent` babysit comments, recreating multi-spawn at the comment layer.
4. **Parallel issues compound pending-lock latency** — #91 completing during #92 create-pr increased deferral/backoff window; not fatal to #91 but delayed #92 babysit API spawn.
5. **Label/state divergence after PAT fallback** — sync updates GitHub labels to `babysit-in-progress` without committing state, leaving operators with conflicting signals.
6. **Demo skill lacks batching guidance** — SHA fix follow-up push is still common at demo stage.
7. **Spec agent ID not persisted** — `bc-556ee75d` appears in issue comment only; minor traceability gap (same pattern as #91 planning `null`).

---

## Deliverable checklist

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Feature / workflow scope | **Done** | Skill, WORKFLOW.md, automation prompt updated per SPEC |
| Tests / gates | **Done** | `verify-workflow-paths.sh` exit 0 |
| Demo evidence | **Partial** | Scenarios 1–3 pass; demo SHA follow-up push undermines batching narrative |
| PR.md | **Done** | On branch; overclaims dogfood |
| CI | **Pass** | Handoff workflow success |
| Babysit / complete | **Not done** | Duplicate PAT fallbacks; state stuck at `create-pr-ready` |

---

## Top recommendations

1. **Skip handoff on non-canonical agent side branches** — In `cursor-workflow-handoff.yml`, after reading `workflow.state.json`, exit early when `GITHUB_REF` branch ≠ `state.branch` (or match `cursor/issue-N-pr-*` / `cursor/issue-N-*-agent-*` denylist). Only canonical `cursor/issue-N-slug` pushes should spawn agents. This directly prevents the #92 duplicate babysit trigger and is the highest-leverage fix for parallel runs.
2. **Deduplicate PAT-fallback handoff comments** — Before posting `@cursoragent` babysit prompt, skip if an identical skill comment was posted within 60s or if `agents.babysit-pr` / recent PAT comment exists (mirror admission-gate dedup).
3. **Extend batching guidance to the demo skill** — Add the same amend-before-push SHA pattern to `.cursor/skills/demo/SKILL.md` so demo agents do not push SHA fixes after `demo-ready` (issue #92 demo commit `f1934f7`).
4. **Create-pr skill: canonical branch only** — Explicit rule: all pushes including `create-pr-ready` must target `state.branch`; never push handoff stages from Cloud Agent workspace branches.
5. **Parallel issue operator guidance** — Document in `WORKFLOW.md` that running 2+ issues concurrently is supported but increases handoff contention; recommend staggering spec triggers by ~5–10 minutes when debugging handoff races, or waiting for `complete` on hardening PRs before dogfooding the next.
6. **Babysit recovery for PAT-fallback stall** — When `handoff_pending.skill=babysit-pr` persists > N minutes with label `babysit-in-progress` but no `agents.babysit-pr`, recovery should re-attempt API spawn or clear stale pending lock (extends #86 recovery patterns).
7. **Commit state on PAT-fallback progress** — `pat_fallback` should push `babysit-in-progress` to canonical branch (or recovery merges label back to file stage) to avoid label/file drift.

---

## Follow-up issues

Proposed titles (human opens):

- `Harden handoff to ignore Cloud Agent side-branch pushes from issue #92 workflow review`
- `Deduplicate PAT-fallback handoff comments from issue #92 workflow review`
- `Extend amend-before-push batching guidance to demo skill from issue #92 workflow review`
- `Document parallel multi-issue workflow expectations from issue #92 workflow review`

---

## References

- Issue: [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92)
- PR: [#97](https://github.com/BlackLodgeLabs/cuebox/pull/97)
- Parallel issue: [#91](https://github.com/BlackLodgeLabs/cuebox/issues/91) / [PR #98](https://github.com/BlackLodgeLabs/cuebox/pull/98) (completed)
- Artifacts: `workflow/issues/issue-92/` (pre-merge)
- Source reviews: [#84 WORKFLOW-REVIEW](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md), [#79 WORKFLOW-REVIEW](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md)
- Handoff runs: [28969396187](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28969396187) (side branch), [28969481891](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28969481891) (canonical)
- Full review (this file): [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/0c1aeae/workflow/issues/issue-92/WORKFLOW-REVIEW.md)
- Related reviews: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
