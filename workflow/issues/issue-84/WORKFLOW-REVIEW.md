# Workflow review — Issue #84 / PR #88

**Review date:** 2026-07-08  
**Branch:** [`cursor/issue-84-harden-concurrent-handoff-spawn-dedup`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-84-harden-concurrent-handoff-spawn-dedup)  
**PR:** [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88)  
**Reference:** [Cursor workflow docs](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

Issue #84 completed the full Cursor workflow on **2026-07-08** in roughly **68 minutes** from spec-in-progress (05:53 UTC) to `complete` (07:04 UTC). Execute delivered cross-run refetch, branch `handoff_pending` lock before POST, recovery parity, first-wins `record-spawn`, regression tests (cases A–F), and documentation — closing the #79 hardening follow-up scoped in [HANDOFF-HARDENING-NOTES § Gap #5](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-79-workflow-review-skill/workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md). Babysit marked PR #88 **ready for review** with zero Bugbot/CI autofix loops.

**Headline deviation:** The workflow **dogfooded its own bug class** at `create-pr-ready` → babysit: three overlapping handoff runs still **POSTed three distinct babysit agents** (`bc-c8157c3f…`, `bc-139b6f8c…`, `bc-ee8343db…`) despite the hardened spawn path being on the branch. Mocked tests passed; production rapid-push + recovery + `record-spawn` git races left residual duplicate spawns. One babysit agent (`bc-ee8343db…`) completed the stage.

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

---

## Pre-workflow history

| Date | Event | Notes |
|------|-------|-------|
| 2026-07-07 | Issue #84 opened | Second #79 hardening follow-up; depends on [#83](https://github.com/BlackLodgeLabs/cuebox/pull/87) (`fetch-depth: 0`) — merged before execute |
| 2026-07-07 | Issue #79 workflow review | Four concurrent babysit spawns at `create-pr-ready` motivated this issue — [WORKFLOW-REVIEW #79](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md) |

---

## What happened — timeline

Agent links open conversations in the [Cursor agents UI](https://cursor.com/agents). IDs are from [`workflow.state.json`](workflow.state.json), PR commit history, and handoff Action logs.

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 2026-07-07 16:58 | Issue #84 opened | — | — |
| 05:53:49 | `spec-in-progress` ([`0c6cdc6`](https://github.com/BlackLodgeLabs/cuebox/commit/0c6cdc62b0192ba87b76d5fca4796bf04b4a52a3)) | `spec-in-progress` | — |
| 05:54:43 | [SPEC.md](SPEC.md) committed ([`b27e0d4`](https://github.com/BlackLodgeLabs/cuebox/commit/b27e0d44683d144492ab54a9d628ee06638074ed)) | `spec-ready` | [`bc-57d9d4d2…`](https://cursor.com/agents/bc-57d9d4d2-b642-4c3f-a053-9f682924846e) |
| 05:56:14 | Draft [PR #88](https://github.com/BlackLodgeLabs/cuebox/pull/88) linked ([`f6f711c`](https://github.com/BlackLodgeLabs/cuebox/commit/f6f711c1a81d9e355246ef10841a3fd91c838372)) | planning handoff | — (GitHub Actions) |
| 05:57:12 | Planning agent recorded ([`b26b6bf`](https://github.com/BlackLodgeLabs/cuebox/commit/b26b6bf49ad38442057e3a4c114c15c91810879c)) | handoff | [`bc-a288c673…`](https://cursor.com/agents/bc-a288c673-b373-4555-8a64-f1a10951722f) |
| 05:59:04 | [PLAN.md](PLAN.md) + [demo-spec.md](demo/demo-spec.md) ([`8e5703b`](https://github.com/BlackLodgeLabs/cuebox/commit/8e5703bfd30b8565213b22d78f750173dcf9eb67)) | `plan-ready` | [`bc-a288c673…`](https://cursor.com/agents/bc-a288c673-b373-4555-8a64-f1a10951722f) |
| 06:00:08 | Execute agent recorded ([`c72b943`](https://github.com/BlackLodgeLabs/cuebox/commit/c72b94359ec55a86f9bfc177bb9acd5809c95e47)) | handoff | [`bc-5add15c4…`](https://cursor.com/agents/bc-5add15c4-eed3-4e94-a73d-1e1404c296fa) |
| 06:18–06:29 | Implementation commits ([`b03b5f1`](https://github.com/BlackLodgeLabs/cuebox/commit/b03b5f1ce9afb863f80e8966e0fca59634df3149), [`6735ffa`](https://github.com/BlackLodgeLabs/cuebox/commit/6735ffad811635e7aeb7adf9916769c829a0cdd8)) | execute | [`bc-5add15c4…`](https://cursor.com/agents/bc-5add15c4-eed3-4e94-a73d-1e1404c296fa) |
| 06:26:27 | Demo agent recorded ([`3565599`](https://github.com/BlackLodgeLabs/cuebox/commit/3565599d6a93d5295b77701ae8460aedd474ea0e)) | handoff (early) | [`bc-e466e966…`](https://cursor.com/agents/bc-e466e966-cd3f-4e9e-b0c0-76663f415084) |
| 06:30:41 | `execute-ready` ([`7ac19a7`](https://github.com/BlackLodgeLabs/cuebox/commit/7ac19a708d0bcde6b0411d13d8efbd99a68d5dc6)) | execute-ready | [`bc-5add15c4…`](https://cursor.com/agents/bc-5add15c4-eed3-4e94-a73d-1e1404c296fa) |
| 06:46:40 | Demo pass-back artifacts ([`2da7651`](https://github.com/BlackLodgeLabs/cuebox/commit/2da7651aa655acc39e5f318930ca0a7861d4095a)) | `execute-passback` | [`bc-e466e966…`](https://cursor.com/agents/bc-e466e966-cd3f-4e9e-b0c0-76663f415084) |
| 06:50:14 | Handoff run [28923441600](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923441600) **failed** on pass-back push | handoff failure | — |
| 06:53:11 | Demo re-run pass ([`0397155`](https://github.com/BlackLodgeLabs/cuebox/commit/03971550edce5aea3de32cebb7de97f38bb7a880)) | `demo-ready` | [`bc-e466e966…`](https://cursor.com/agents/bc-e466e966-cd3f-4e9e-b0c0-76663f415084) |
| 06:54:46 | Create-pr agent recorded ([`b6dc93c`](https://github.com/BlackLodgeLabs/cuebox/commit/b6dc93c80cef9d0366f72ecbc63f1c2ce79b5fa2)) | handoff | [`bc-5c8cd4d2…`](https://cursor.com/BlackLodgeLabs/cuebox/commit/b6dc93c80cef9d0366f72ecbc63f1c2ce79b5fa2) |
| 06:56:36–06:56:50 | [PR.md](PR.md) + `create-pr-ready` ([`88e945c`](https://github.com/BlackLodgeLabs/cuebox/commit/88e945c8c36e91f4d6ff414ed1fb7a961cd9a7ad), [`4715d93`](https://github.com/BlackLodgeLabs/cuebox/commit/4715d934336c1665c2a0e93cb0e6ae20fd127b62)) | `create-pr-ready` | [`bc-5c8cd4d2…`](https://cursor.com/agents/bc-5c8cd4d2-f1dc-48c0-a8af-4d8f5e952612) |
| 06:57:16 | Babysit spawn record #1 ([`f6b3be8`](https://github.com/BlackLodgeLabs/cuebox/commit/f6b3be82434f68fcb481200a648c58363a317b42)) | `agents.babysit-pr=bc-c8157c3f…` | overlapping handoff |
| 06:57:43 | Babysit spawn record #2 ([`0ddb0c7`](https://github.com/BlackLodgeLabs/cuebox/commit/0ddb0c7f29e8ed9a447a679e3942ef719eb683f9)) **overwrites #1** | `agents.babysit-pr=bc-139b6f8c…` | [run 28923767707](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923767707) |
| 06:58:56 | Recovery spawn on [run 28923774155](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923774155) | recovery → babysit | — |
| 06:58:59 | Babysit spawn record #3 ([`ce43b9d`](https://github.com/BlackLodgeLabs/cuebox/commit/ce43b9d88ec5cecb3dc340d7173b09066cd640d5)) | `agents.babysit-pr=bc-ee8343db…` | recovery + handoff |
| 07:00:24 | Babysit-in-progress ([`57b9e8c`](https://github.com/BlackLodgeLabs/cuebox/commit/57b9e8c9844b3d349b2109487d08f601336ad033)) | `babysit-in-progress` | [`bc-ee8343db…`](https://cursor.com/agents/bc-ee8343db-658d-4723-99ca-389a3f108e46) |
| 07:01:24 | `complete` ([`045bfe0`](https://github.com/BlackLodgeLabs/cuebox/commit/045bfe0d36ab6a03eb5deedf7851ac4f006aeb1a)) | `complete` | [`bc-ee8343db…`](https://cursor.com/agents/bc-ee8343db-658d-4723-99ca-389a3f108e46) |
| 07:29 | `@cursoragent workflow-review` requested | post-complete review | — |

**Duration (spec trigger → complete):** ~68 minutes.  
**Babysit / complete:** reached at 07:04 UTC (`workflow.state.json` `updated_at`); PR #88 marked ready for review.

### Babysit multi-spawn at create-pr-ready (dogfood)

Two handoff runs fired **8 seconds apart** on rapid create-pr pushes (`88e945c` at 06:56:45, `4715d93` at 06:56:53). Both saw `stage=create-pr-ready` and `agents.babysit-pr=null` before peer pending/spawn records landed.

| Run ID | Trigger SHA | Outcome | Recorded agent |
|--------|-------------|---------|----------------|
| [28923767707](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923767707) | `88e945c` | Normal handoff → spawn + record | `bc-139b6f8c…` ([`0ddb0c7`](https://github.com/BlackLodgeLabs/cuebox/commit/0ddb0c7f29e8ed9a447a679e3942ef719eb683f9)) |
| (concurrent) | `4715d93` | Spawn + record before peer visible | `bc-c8157c3f…` ([`f6b3be8`](https://github.com/BlackLodgeLabs/cuebox/commit/f6b3be82434f68fcb481200a648c58363a317b42)) |
| [28923774155](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923774155) | `4715d93` | Checkout **forced update** `0ddb0c7…4715d93` hid peer records → recovery spawn | `bc-ee8343db…` ([`ce43b9d`](https://github.com/BlackLodgeLabs/cuebox/commit/ce43b9d88ec5cecb3dc340d7173b09066cd640d5)) |

**First-wins violation:** [`f6b3be8`](https://github.com/BlackLodgeLabs/cuebox/commit/f6b3be82434f68fcb481200a648c58363a317b42) recorded `bc-c8157c3f…`, but run 28923767707's [`0ddb0c7`](https://github.com/BlackLodgeLabs/cuebox/commit/0ddb0c7f29e8ed9a447a679e3942ef719eb683f9) overwrote with `bc-139b6f8c…` despite `record-spawn-on-branch.sh` first-wins logic — likely a git fetch/checkout/write race where both runs POSTed before either branch record was visible at pending-lock time.

**Recovery amplification:** Run 28923774155 logged `+ 0ddb0c7...4715d93 … (forced update)` on checkout, rewinding the runner's view to the trigger SHA and hiding [`0ddb0c7`](https://github.com/BlackLodgeLabs/cuebox/commit/0ddb0c7f29e8ed9a447a679e3942ef719eb683f9)'s babysit record before recovery fired: `Handoff recovery: spawning babysit-pr for issue #84 (stage=create-pr-ready)`.

### Agent index

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| review-and-spec | `bc-57d9d4d2-b642-4c3f-a053-9f682924846e` | [Open](https://cursor.com/agents/bc-57d9d4d2-b642-4c3f-a053-9f682924846e) |
| planning | `bc-a288c673-b373-4555-8a64-f1a10951722f` | [Open](https://cursor.com/agents/bc-a288c673-b373-4555-8a64-f1a10951722f) |
| execute | `bc-5add15c4-eed3-4e94-a73d-1e1404c296fa` | [Open](https://cursor.com/agents/bc-5add15c4-eed3-4e94-a73d-1e1404c296fa) |
| demo | `bc-e466e966-cd3f-4e9e-b0c0-76663f415084` | [Open](https://cursor.com/agents/bc-e466e966-cd3f-4e9e-b0c0-76663f415084) |
| create-pr | `bc-5c8cd4d2-f1dc-48c0-a8af-4d8f5e952612` | [Open](https://cursor.com/agents/bc-5c8cd4d2-f1dc-48c0-a8af-4d8f5e952612) |
| babysit-pr (final) | `bc-ee8343db-658d-4723-99ca-389a3f108e46` | [Open](https://cursor.com/agents/bc-ee8343db-658d-4723-99ca-389a3f108e46) |
| babysit-pr (orphan) | `bc-c8157c3f-2a9e-4c7b-82d6-4079647b065f` | spawn record overwritten |
| babysit-pr (orphan) | `bc-139b6f8c-cc7d-42a6-b8a7-9d368bbdba1d` | spawn record overwritten |

---

## What worked as designed

1. **Linear six-agent pipeline** after demo pass-back recovery — spec → planning → execute → demo → create-pr → babysit with one agent per skill in final `workflow.state.json`.
2. **SPEC/PLAN fidelity** — refetch helper, production pending lock, recovery parity, first-wins record-spawn, tests A–F, and docs all landed per acceptance criteria.
3. **`verify-workflow-paths.sh` and handoff tests** — cases A–F pass in [demo logs](demo/scenario-1-handoff-tests.log); `cursor-workflow-refetch-state.sh` registered in `load-scripts.sh` ([#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) lesson applied).
4. **Dependency ordering** — #83 merged before #84 execute; no `fetch-depth` regressions observed.
5. **Babysit efficiency** — zero Bugbot and zero CI autofix loops; PR #88 ready for review on first babysit completion.
6. **Demo pass-back recovery** — demo correctly detected missing implementation, pass-back re-ran execute path, second demo pass succeeded.

---

## What did not happen (or deviated)

### Stage / label drift

- Demo agent spawned at **06:26** while execute was still committing (**06:18–06:29**), before `execute-ready` at **06:30** — demo ran against a branch missing the cross-run dedup implementation and issued pass-back ([`2da7651`](https://github.com/BlackLodgeLabs/cuebox/commit/2da7651aa655acc39e5f318930ca0a7861d4095a)).
- Handoff run [28923441600](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923441600) **failed** on the pass-back push (06:50 UTC); recovery succeeded on the subsequent demo-ready push.

### Parallel agents or handoff failures

- **Three babysit POSTs** at `create-pr-ready` despite #84 hardening on the branch — same failure class as #79, reduced from four to three but not eliminated.
- **`record-spawn` first-wins bypassed** in production — [`0ddb0c7`](https://github.com/BlackLodgeLabs/cuebox/commit/0ddb0c7f29e8ed9a447a679e3942ef719eb683f9) overwrote [`f6b3be8`](https://github.com/BlackLodgeLabs/cuebox/commit/f6b3be82434f68fcb481200a648c58363a317b42)'s agent id.
- **Recovery + checkout forced update** spawned a third babysit when the trigger SHA was stale relative to branch tip.

### Demo / CI / review gaps

- Mocked concurrent tests use `CURSOR_WORKFLOW_REFETCH_REMOTE_JSON` fixtures — they do not simulate `actions/checkout` forced updates or real git push races between `record-handoff-pending` and `record-spawn-on-branch`.
- No application CI (api-ci / frontend-ci) on this workflow-only PR — expected for scope.

---

## Efficiency notes

- **Total agent runs:** 5 recorded in `loops.total_runs` plus **2 orphan babysit** agents from the create-pr-ready race.
- **Pass-back cost:** one extra demo cycle and one failed handoff run (~3 minutes).
- **Meta churn:** three `record babysit-pr spawn` commits within 2 minutes; create-pr pushed two PR.md commits 14 seconds apart, triggering overlapping handoffs.

---

## Issues to learn from

1. **Pending-lock window still has a TOCTOU race** — two runs can both pass the first gate, both push `handoff_pending`, and both POST before either refetch sees the peer's lock or agent record. Tests model sequential fixture updates; production had parallel git pushes.
2. **`record-spawn-on-branch.sh` first-wins is not atomic** — fetch + checkout + read + write can lose to a concurrent writer; a late run overwrote an earlier peer's agent id even though first-wins logic was deployed.
3. **`actions/checkout` forced update on trigger SHA** can hide branch-tip spawn records from recovery's local state, causing recovery to spawn when normal handoff already succeeded.
4. **Demo spawned before `execute-ready`** — handoff fired on an intermediate execute push (`3565599` demo spawn vs `7ac19a7` execute-ready), wasting a demo cycle on incomplete code.
5. **Dogfooding gap** — the issue that fixes concurrent spawn dedup still exhibited the bug during its own babysit transition; production validation should be a recommended demo scenario for workflow-hardening PRs.

---

## Deliverable checklist

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Feature / workflow scope | ✅ | Cross-run refetch, pending lock, recovery parity, first-wins record-spawn |
| Tests / gates | ✅ | `test-cursor-workflow-handoff.sh` A–F; `verify-workflow-paths.sh` pass |
| Demo evidence | ✅ | [demo-notes.md](demo/demo-notes.md), logs, screenshot at `0397155` |
| PR.md | ✅ | [PR.md](PR.md) with scenario results |
| CI | ✅ | Handoff Action success on `complete` push |
| Babysit / complete | ✅ | PR #88 ready for review; `stage=complete` |

---

## Top recommendations

1. **Re-fetch immediately before `record-spawn` jq write** (not only at script entry) and abort if `agents.<skill>` is already set — close the first-wins TOCTOU gap observed at [`0ddb0c7`](https://github.com/BlackLodgeLabs/cuebox/commit/0ddb0c7f29e8ed9a447a679e3942ef719eb683f9).
2. **Recovery must refetch branch tip** (not trigger SHA) before deciding `agents.<skill>` is null — avoid forced-checkout rewind false negatives.
3. **Add integration test** simulating two parallel `record-handoff-pending` + POST paths with real temp git remotes (not just JSON overlay) to catch pending-lock races.
4. **Defer demo handoff until `execute-ready`** — admission gate or handoff YAML should not spawn demo from `execute-in-progress` when implementation commits are still landing.
5. **Batch create-pr pushes** — create-pr skill should set `create-pr-ready` in a single final commit to reduce rapid-push overlap (same guidance as #79).

---

## Follow-up issues

Proposed titles (human opens):

- `Harden record-spawn TOCTOU and recovery tip refetch from issue #84 workflow review`
- `Prevent demo spawn before execute-ready from issue #84 workflow review`

---

## References

- Issue: [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84)
- PR: [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88)
- Parent review: [#79 WORKFLOW-REVIEW](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md)
- Depends on (merged): [#87](https://github.com/BlackLodgeLabs/cuebox/pull/87)
- Artifacts: `workflow/issues/issue-84/` (pre-merge)
- Babysit race runs: [28923767707](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923767707), [28923774155](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923774155)
