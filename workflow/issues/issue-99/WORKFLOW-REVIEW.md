# Workflow review — Issue #99 / PR #100

**Review date:** 2026-07-10  
**Branch:** [`cursor/issue-99-add-film-to-watch-list`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-99-add-film-to-watch-list)  
**PR:** [#100](https://github.com/BlackLodgeLabs/cuebox/pull/100)  
**Reference:** [Cursor workflow docs](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

Issue #99 completed the full eight-stage Cursor workflow on **2026-07-10** with `stage: complete`, green CI (API + Frontend at `6769cbe`), and all five demo scenarios passing after a pass-back fix. Wall-clock time from `@cursoragent spec` to `complete` was **~32 hours** (2026-07-09 06:25 → 2026-07-10 14:41 UTC), dominated by a **16-hour human Q&A gap** after `spec-needs-info` and a **~15-hour pause** before the second demo run.

The headline deviation: the first demo pass **blocked at 3/5** because Letterboxd’s `/tmdb/{id}` redirect returns **HTTP 403** from cloud/datacenter IPs. Execute was re-spawned to add a **slug-probe fallback** (`letterboxd_resolver._resolve_via_slug_probe`); the second demo pass achieved **5/5** on the main branch. No Bugbot or CI autofix loops were needed (`loops.bugbot: 0`, `loops.ci_autofix: 0`).

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

## Pre-workflow history

| Date | Event | Notes |
|------|-------|-------|
| 2026-07-09 06:25 | Human `@cursoragent spec` on [#99](https://github.com/BlackLodgeLabs/cuebox/issues/99) | Feature request: in-app watchlist add |
| 2026-07-09 06:29 | `spec-needs-info` | Six product decisions required (identity, sync, UI, duplicates, restore, cap) — recorded later in [DECISIONS.md](DECISIONS.md) |

---

## What happened — timeline

Agent links open conversations in the [Cursor agents UI](https://cursor.com/agents). IDs are from [`workflow.state.json`](workflow.state.json), spawn-record commits, and issue/PR bot comments.

### 2026-07-09 — Spec through execute

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 06:25 | Human `@cursoragent spec` | — | — |
| 06:29 | Clarifying questions posted ([`2225f7b`](https://github.com/BlackLodgeLabs/cuebox/commit/2225f7b619308609e29fd308cca5f66547f0634a)) | `spec-needs-info` | [`bc-6d747284…`](https://cursor.com/agents/bc-6d747284-b96c-4d48-ae9a-f470e193f2f3) |
| 22:52 | [SPEC.md](SPEC.md) committed ([`7cb71d7`](https://github.com/BlackLodgeLabs/cuebox/commit/7cb71d786b46952020a802858b4781f7d351ed3e)) | `spec-ready` | — (human answers in [DECISIONS.md](DECISIONS.md); `review-and-spec-continued` not recorded) |
| 22:53 | Draft [PR #100](https://github.com/BlackLodgeLabs/cuebox/pull/100) linked ([`4360e97`](https://github.com/BlackLodgeLabs/cuebox/commit/4360e970a851e8d856618b69faa730c16f0209f5)) | Actions handoff | — |
| 22:54 | Planning spawn ([`954671a`](https://github.com/BlackLodgeLabs/cuebox/commit/954671a8b65a932006ee0af0623030b15fea3be1)) | handoff | [`bc-091d1673…`](https://cursor.com/agents/bc-091d1673-f7d9-4a29-b991-8f7140e5bbbf) |
| 22:55–22:57 | [PLAN.md](PLAN.md) + [demo-spec.md](demo/demo-spec.md) ([`8efc07e`](https://github.com/BlackLodgeLabs/cuebox/commit/8efc07e324c67d9f4cff6a5a01c7c2b12196f19d)) | `plan-ready` | [`bc-091d1673…`](https://cursor.com/agents/bc-091d1673-f7d9-4a29-b991-8f7140e5bbbf) |
| 22:58 | Planning branch merged ([`b87d985`](https://github.com/BlackLodgeLabs/cuebox/commit/b87d985d0f4e5b1674df8c3c018304151a8bc86d)) | `plan-ready` | — |
| 22:59 | Execute spawn ([`aa22352`](https://github.com/BlackLodgeLabs/cuebox/commit/aa223526b9041da0b8c45ac8e31bf03836df00a0)) | handoff | [`bc-36603d68…`](https://cursor.com/agents/bc-36603d68-858e-4bcc-91a4-d99db07a127a) |
| 23:12 | Feature commits: API + frontend ([`6a75b01`](https://github.com/BlackLodgeLabs/cuebox/commit/6a75b0121b4633f844047ba418f397335cb093b1), [`3f74914`](https://github.com/BlackLodgeLabs/cuebox/commit/3f74914bfa558d8c2c3439f1d60accfef364b224)) | `execute-ready` (implicit) | [`bc-36603d68…`](https://cursor.com/agents/bc-36603d68-858e-4bcc-91a4-d99db07a127a) |
| 23:14 | Demo spawn ([`80d77e5`](https://github.com/BlackLodgeLabs/cuebox/commit/80d77e5a65db445ec62d5cc7bcf2d8bb237c972a)) | handoff | [`bc-04a3e9f3…`](https://cursor.com/agents/bc-04a3e9f3-0077-4b9e-9fa4-f08b041a3115) |

### 2026-07-09 night — First demo blocked; execute pass-back

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| ~23:18 | Handoff **deferred** (pending-lock) on issue [#99](https://github.com/BlackLodgeLabs/cuebox/issues/99#issuecomment-4930411768) | — | — |
| ~23:18 | Execute re-spawn comment posted (slug-fallback scope) | pass-back to execute | — |
| ~23:32 | Demo agent PR comment: **blocked 3/5** ([comment](https://github.com/BlackLodgeLabs/cuebox/pull/100#issuecomment-4930502789)) | `blocked` on side branch | [`bc-04a3e9f3…`](https://cursor.com/agents/bc-04a3e9f3-0077-4b9e-9fa4-f08b041a3115) |
| — | Side branch `cursor/issue-99-pr-100-demo-agent-f0fc` set `blocked`; scenarios 3 (duplicate) and 5 (restore) failed on Cloudflare 403 | — | — |

### 2026-07-10 — Slug fallback, second demo, create-pr race, complete

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 11:48 | Slug-probe fallback + UX fixes ([`a53c15d`](https://github.com/BlackLodgeLabs/cuebox/commit/a53c15d857848216a2417492975dc2db9d377500)) | execute pass-back | [`bc-36603d68…`](https://cursor.com/agents/bc-36603d68-858e-4bcc-91a4-d99db07a127a) (inferred) |
| 14:20 | Demo re-run in progress ([`f15773c`](https://github.com/BlackLodgeLabs/cuebox/commit/f15773c02e16526ee6199800962b84e6fa0e4f29)) | `demo-in-progress` | [`bc-04a3e9f3…`](https://cursor.com/agents/bc-04a3e9f3-0077-4b9e-9fa4-f08b041a3115) |
| 14:30 | Demo **5/5 PASS** + artifacts ([`f08551c`](https://github.com/BlackLodgeLabs/cuebox/commit/f08551cbd1824ba40785794e514081e387861e99)) | `demo-ready` | [`bc-04a3e9f3…`](https://cursor.com/agents/bc-04a3e9f3-0077-4b9e-9fa4-f08b041a3115) |
| 14:30–14:31 | Overlapping **babysit-in-progress** + **create-pr-in-progress** commits | stage oscillation | — |
| 14:32 | Create-pr spawn ([`c92f405`](https://github.com/BlackLodgeLabs/cuebox/commit/c92f4052a7bdf39f35ed021a4b74f882932d61da)) | handoff | [`bc-eea65507…`](https://cursor.com/agents/bc-eea65507-1b04-4c95-be05-16849f2886ff) |
| 14:33 | [PR.md](PR.md) + demo image SHA fixes; create-pr branch merged ([`f9c90bc`](https://github.com/BlackLodgeLabs/cuebox/commit/f9c90bc64f4d0e310bbc6731ad4f20cf0249dcbc)) | `create-pr-ready` | [`bc-eea65507…`](https://github.com/agents/bc-eea65507-1b04-4c95-be05-16849f2886ff) |
| 14:35 | Babysit spawn ([`1301523`](https://github.com/BlackLodgeLabs/cuebox/commit/1301523afbf00c56d0334429f1eb5fd0b0efd8de)) | handoff | [`bc-06ecb2b8…`](https://cursor.com/agents/bc-06ecb2b8-4363-4eda-a673-f3fb038346cc) |
| 14:37–14:41 | Babysit → `complete`; CI green at `6769cbe` ([`34d29fc`](https://github.com/BlackLodgeLabs/cuebox/commit/34d29fc004190cca3e91c9f3419b71638b3204e0), [`d51ea6e`](https://github.com/BlackLodgeLabs/cuebox/commit/d51ea6ef6b75fe938b833425f8058edbc847df73)) | `complete` | [`bc-06ecb2b8…`](https://cursor.com/agents/bc-06ecb2b8-4363-4eda-a673-f3fb038346cc) |

**Duration (spec trigger → complete):** ~32 hours wall clock; **~6 hours** of active agent work excluding human Q&A wait and overnight pause.

**Babysit / complete:** Single babysit pass; no Bugbot loops; API CI + Frontend CI SUCCESS on final push.

### Parallel agent side-branches

| Branch suffix | Stage reached | Notes |
|---------------|---------------|-------|
| `pr-100-plan-agent-cb3c` | `plan-ready` | Merged to main issue branch via [`b87d985`](https://github.com/BlackLodgeLabs/cuebox/commit/b87d985d0f4e5b1674df8c3c018304151a8bc86d) |
| `pr-100-demo-agent-f0fc` | `blocked` | Partial demo (3/5); artifacts superseded by main-branch re-demo |
| `pr-100-create-pr-agent-a60f` | — | No unique commits beyond main branch |

### Agent index

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| review-and-spec | `bc-6d747284-b96c-4d48-ae9a-f470e193f2f3` | [Open](https://cursor.com/agents/bc-6d747284-b96c-4d48-ae9a-f470e193f2f3) |
| planning | `bc-091d1673-f7d9-4a29-b991-8f7140e5bbbf` | [Open](https://cursor.com/agents/bc-091d1673-f7d9-4a29-b991-8f7140e5bbbf) |
| execute | `bc-36603d68-858e-4bcc-91a4-d99db07a127a` | [Open](https://cursor.com/agents/bc-36603d68-858e-4bcc-91a4-d99db07a127a) |
| demo | `bc-04a3e9f3-0077-4b9e-9fa4-f08b041a3115` | [Open](https://cursor.com/agents/bc-04a3e9f3-0077-4b9e-9fa4-f08b041a3115) |
| create-pr | `bc-eea65507-1b04-4c95-be05-16849f2886ff` | [Open](https://cursor.com/agents/bc-eea65507-1b04-4c95-be05-16849f2886ff) |
| babysit-pr | `bc-06ecb2b8-4363-4eda-a673-f3fb038346cc` | [Open](https://cursor.com/agents/bc-06ecb2b8-4363-4eda-a673-f3fb038346cc) |

---

## What worked as designed

1. **`spec-needs-info` gate** surfaced six product decisions (Letterboxd redirect identity, CSV/RSS sync, UI entry, duplicates, restore, cap) before planning — answers captured in [DECISIONS.md](DECISIONS.md) and reflected in [SPEC.md](SPEC.md).
2. **Planning → execute handoff** completed in ~15 minutes after spec-ready; [PLAN.md](PLAN.md) file list matched shipped code with only one material addition (slug-probe fallback).
3. **Execute** delivered the feature in two commits (API + frontend) with integration tests (`test_integration_watchlist_add.py`, `test_letterboxd_resolver.py`) and Phase 8 gate evidence.
4. **Demo pass-back loop** worked: blocked demo correctly identified Cloudflare 403; execute added `_resolve_via_slug_probe`; second demo achieved 5/5 with screenshots on the main branch.
5. **Handoff hardening** from [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) held — pending-lock deferral at 23:18 retried cleanly; no runaway parallel executes.
6. **Babysit** reached `complete` with zero Bugbot/CI autofix loops; final checks green (api-tests 1m3s, frontend 1m3s at `6769cbe`).
7. **Reuse of #59 patterns** (TMDB search, review queue, metadata persist) kept scope tight — three substantive code commits plus one pass-back fix.

---

## What did not happen (or deviated)

### Stage / label drift

- **14:30–14:33 UTC:** `babysit-in-progress` and `create-pr-in-progress` commits interleaved before `create-pr-ready` settled — two **cancelled** handoff runs ([`29100096435`](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29100096435), [`29100091108`](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29100091108)). Recovery succeeded via merge commit [`f9c90bc`](https://github.com/BlackLodgeLabs/cuebox/commit/f9c90bc64f4d0e310bbc6731ad4f20cf0249dcbc).
- `workflow.state.json` lists `review-and-spec: null` — initial spec agent ID not preserved despite successful `spec-needs-info` → `spec-ready` transition.

### Parallel agents or handoff failures

- Demo side-branch `cursor/issue-99-pr-100-demo-agent-f0fc` left `stage: blocked` with a PR comment reporting 3/5 — superseded by main-branch re-demo but may confuse reviewers reading comment history chronologically.
- One handoff **deferred** (pending-lock) at 23:18 before execute pass-back — expected behavior, not a failure.

### Demo / CI / review gaps

- **First demo blocked (3/5)** on Cloudflare 403 for `letterboxd.com/tmdb/{id}` — duplicate and restore scenarios require successful redirect *before* duplicate detection runs.
- PLAN risk table mentioned “rate limits / blocking → review fallback” but did not specify **datacenter IP 403** or a slug-probe mitigation — execute had to discover this live during demo.
- Slug-probe fallback is **title-heuristic**; obscure titles may still require manual paste (documented in PR Known Issues).

---

## Efficiency notes

- **33 commits** on the issue branch vs **5 substantive** (spec, plan, API feat, frontend feat, slug fallback).
- **~85% workflow meta churn** — typical for multi-agent handoffs but higher than #59’s first pass due to demo pass-back and create-pr/babysit overlap.
- **`loops.total_runs: 9`** — includes spec, planning, execute (×2 effective), demo (×2), create-pr, babysit; within the 10-run cap.
- Execute core implementation: **~13 minutes** (22:59 → 23:12 UTC).

---

## Issues to learn from

1. **External API environment sensitivity:** Letterboxd blocks `/tmdb` redirects from cloud VM IPs with HTTP 403. Happy-path demo scenarios that depend on redirect success will fail until a server-side fallback exists or demo uses pre-seeded bypass.
2. **Duplicate detection ordering:** `WatchlistAddService` resolves Letterboxd before checking `already_on_watchlist` by URI — when redirect fails, duplicate UX cannot run even if `tmdb_id` is already on the watchlist via metadata.
3. **Demo-before-hardening:** Slug-probe was added *after* first demo failure; planning risk table had a generic mitigation but not the concrete fallback shipped in [`a53c15d`](https://github.com/BlackLodgeLabs/cuebox/commit/a53c15d857848216a2417492975dc2db9d377500).
4. **Create-pr / babysit race on demo-ready:** Rapid commits at 14:30 spawned overlapping handoff targets; cancelled runs recovered but added ~4 duplicate workflow commits.
5. **Agent ID gaps:** `review-and-spec` null in state; `review-and-spec-continued` never recorded for the 16-hour spec completion window.

---

## Deliverable checklist

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Feature / workflow scope | ✅ | All [SPEC.md](SPEC.md) acceptance criteria met per PR checklist |
| Tests / gates | ✅ | Integration tests + Phase 8 gate; CI green at `6769cbe` |
| Demo evidence | ✅ | 5/5 scenarios on main branch; 8 screenshots + [demo-notes.md](demo/demo-notes.md) |
| PR.md | ✅ | Scenario table, gate evidence, known issues documented |
| CI | ✅ | api-tests + frontend SUCCESS (2026-07-10 14:41 UTC) |
| Babysit / complete | ✅ | `stage: complete`, PR open and ready for human review |

---

## Top recommendations

1. **Plan risk template:** When a feature depends on a third-party HTTP redirect from server IPs, planning should require an explicit **datacenter-block mitigation** (fallback resolver, TMDB-id pre-check, or demo mock) — not only “timeout → review fallback.”
2. **Demo-spec external dependencies:** Add a precondition section for Letterboxd reachability from cloud VMs, or document which scenarios use integration-test evidence when live redirect is blocked.
3. **Duplicate detection by `tmdb_id`:** Consider checking active watchlist metadata for `tmdb_id` *before* Letterboxd redirect so duplicate UX works even when Cloudflare blocks redirect.
4. **Record spec agent IDs:** Persist `review-and-spec` and `review-and-spec-continued` agent IDs in `workflow.state.json` on both `spec-needs-info` and `spec-ready` commits.
5. **Babysit recovery on `demo-ready`:** When create-pr and babysit commits race after demo-ready, prefer babysit recovery gate ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70)) over spawning create-pr if `PR.md` already exists on branch tip.

---

## Follow-up issues

Proposed (human opens):

- **Harden Letterboxd resolver from issue #99 workflow review** — TMDB-id duplicate pre-check; optional DB cache for `tmdb_id → letterboxd_uri`; demo-spec cloud preconditions.
- **Harden demo external-dependency docs from issue #99 workflow review** — template section for third-party redirect/block scenarios in `demo-spec.md`.

---

## References

- Issue: [#99](https://github.com/BlackLodgeLabs/cuebox/issues/99)
- PR: [#100](https://github.com/BlackLodgeLabs/cuebox/pull/100)
- Artifacts: `workflow/issues/issue-99/` (pre-merge)
- Demo blocked comment: [PR #100 comment](https://github.com/BlackLodgeLabs/cuebox/pull/100#issuecomment-4930502789)
- Related reviews: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
