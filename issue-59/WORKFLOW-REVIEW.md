# Workflow review — Issue #59 / PR #60

**Review date:** 2026-06-30  
**Branch:** [`cursor/issue-59-manual-film-metadata-rematch`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-59-manual-film-metadata-rematch)  
**PR:** [#60](https://github.com/BlackLodgeLabs/cuebox/pull/60)  
**Reference:** [Cursor workflow docs](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

Issue #59 ran through the full eight-stage Cursor workflow once on **2026-06-28** (spec → plan → execute → demo → create-pr → babysit → `complete`) in roughly **75 minutes**. The core feature shipped with strong artifacts ([SPEC](SPEC.md), [PLAN](PLAN.md), [demo evidence](demo/), [PR.md](PR.md)) and green CI.

A **second loop** on **2026-06-30** was driven by human PR feedback (TMDB pagination, then Bugbot review). That loop re-used demo → create-pr → babysit stages but **skipped execute**, committed code while `stage` was `complete`, marked the PR ready for review **before** Bugbot fixes landed, and left [`workflow.state.json`](workflow.state.json) out of sync with GitHub (no terminal label; `babysit-in-progress` on branch vs PR already non-draft).

The workflow automation mostly worked for the first pass. The main gaps are **state-file fidelity**, **post-complete change control**, and **agent ID preservation** — not missing skills or handoff failures.

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

Draft PR creation at `spec-ready` is done by [`.github/workflows/cursor-workflow-handoff.yml`](https://github.com/BlackLodgeLabs/cuebox/blob/main/.github/workflows/cursor-workflow-handoff.yml), not cloud agents. Visibility is via issue status comment, `cursor:*` labels, and [`workflow.state.json`](workflow.state.json).

---

## What happened — timeline

Agent links open the conversation in the [Cursor agents UI](https://cursor.com/agents). IDs are attributed from [`workflow.state.json`](workflow.state.json) on adjacent commits, [`cursor-workflow-record-agent-on-branch.sh`](https://github.com/BlackLodgeLabs/cuebox/blob/main/scripts/cursor-workflow-record-agent-on-branch.sh) pushes, and Cursor bot links on issue/PR comments. Steps without a recorded ID show **—**.

### 2026-06-28 — First automated pass (successful)

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 17:37 | Human [`@cursoragent spec`](https://github.com/BlackLodgeLabs/cuebox/issues/59#issuecomment-4826876842) on [#59](https://github.com/BlackLodgeLabs/cuebox/issues/59) | — | — (human trigger) |
| 17:40 | Spec committed ([`37b894e`](https://github.com/BlackLodgeLabs/cuebox/commit/37b894e4158037c06ac087ed2f1d678595467349)) | `spec-ready` | [`bc-d394e178…`](https://cursor.com/agents/bc-d394e178-1b87-408b-bab3-153240218df4) ([spec reply](https://github.com/BlackLodgeLabs/cuebox/issues/59#issuecomment-4826877059)) |
| 17:42 | Actions linked [draft PR #60](https://github.com/BlackLodgeLabs/cuebox/pull/60) ([`d6a9d5e`](https://github.com/BlackLodgeLabs/cuebox/commit/d6a9d5ef9d6c58048efb22bda271aeb056478b5e)) | `cursor:spec-ready` → planning handoff | — (GitHub Actions) |
| 17:42 | Planning agent spawned ([`917c011`](https://github.com/BlackLodgeLabs/cuebox/commit/917c0111c197f259878190d8e43643658c990989)) | handoff | [`bc-f877646a…`](https://cursor.com/agents/bc-f877646a-dc7a-462c-b7cc-e29ae8317312) |
| 17:43 | Plan in progress ([`dda0d2c`](https://github.com/BlackLodgeLabs/cuebox/commit/dda0d2c6e064fe80dd45c9dc9d82fdd96bff58f1)) | `plan-in-progress` | [`bc-f877646a…`](https://cursor.com/agents/bc-f877646a-dc7a-462c-b7cc-e29ae8317312) (inferred) |
| 17:44 | [PLAN.md](PLAN.md) + [demo-spec.md](demo/demo-spec.md) ([`85f86f2`](https://github.com/BlackLodgeLabs/cuebox/commit/85f86f22edca43bb9a5b0c88c6257fa78e13ced2)) | `plan-ready` | [`bc-f877646a…`](https://cursor.com/agents/bc-f877646a-dc7a-462c-b7cc-e29ae8317312) (inferred) |
| 17:47 | Execute agent spawned ([`a3dd4c6`](https://github.com/BlackLodgeLabs/cuebox/commit/a3dd4c648ae307d2b2d5265fde67729f0a1b9f60)) | handoff | [`bc-3bd9ae07…`](https://cursor.com/agents/bc-3bd9ae07-6ffe-4689-bb6a-50bbf4e0b01b) |
| 17:47–18:09 | Execute: API, tests, docs, frontend, E2E ([`04bd2b8`…`5833d83`](https://github.com/BlackLodgeLabs/cuebox/commit/5833d83)) | GitHub label `cursor:execute-in-progress` | [`bc-3bd9ae07…`](https://cursor.com/agents/bc-3bd9ae07-6ffe-4689-bb6a-50bbf4e0b01b) ([`a3dd4c6`](https://github.com/BlackLodgeLabs/cuebox/commit/a3dd4c648ae307d2b2d5265fde67729f0a1b9f60)) |
| 18:09 | `execute-ready` ([`2a75356`](https://github.com/BlackLodgeLabs/cuebox/commit/2a75356)) | demo handoff | [`bc-3bd9ae07…`](https://cursor.com/agents/bc-3bd9ae07-6ffe-4689-bb6a-50bbf4e0b01b) (inferred) |
| 18:11 | Demo agent spawned ([`762172f`](https://github.com/BlackLodgeLabs/cuebox/commit/762172fe0da17c226bd7d060bbde4c1e90d31f72)) | handoff | [`bc-b74255a7…`](https://cursor.com/agents/bc-b74255a7-271e-495c-8d3f-44046959f664) |
| 18:13 | Demo in progress ([`4d02040`](https://github.com/BlackLodgeLabs/cuebox/commit/4d020408ccd0f5db936486dd8b87552a3d8b7204)) | `demo-in-progress` | [`bc-b74255a7…`](https://cursor.com/agents/bc-b74255a7-271e-495c-8d3f-44046959f664) (inferred) |
| 18:29 | Demo: all four scenarios **PASS** ([`8ff24fd`](https://github.com/BlackLodgeLabs/cuebox/commit/8ff24fdd8467ac99a9a4f4ec4200cd65d52b2ebb)) | `demo-ready` | [`bc-b74255a7…`](https://cursor.com/agents/bc-b74255a7-271e-495c-8d3f-44046959f664) (inferred) |
| 18:31 | Create-pr agent spawned ([`b4e1cf1`](https://github.com/BlackLodgeLabs/cuebox/commit/b4e1cf17f8d48a9d61adf0aaf3e4af7a8dbf4c3e)) | handoff | [`bc-a4648891…`](https://cursor.com/agents/bc-a4648891-26b8-4b07-8cac-e41dc44efb09) |
| 18:32 | [PR.md](PR.md) written ([`4a8898b`](https://github.com/BlackLodgeLabs/cuebox/commit/4a8898bbdf38d8373ed5465509020caf6375c9cb)) | `create-pr-ready` | [`bc-a4648891…`](https://cursor.com/agents/bc-a4648891-26b8-4b07-8cac-e41dc44efb09) (inferred) |
| 18:36 | Babysit agent spawned ([`2854052`](https://github.com/BlackLodgeLabs/cuebox/commit/2854052418202763d7e1c326e9b80d90c7811540)) | handoff | [`bc-ce79799e…`](https://cursor.com/agents/bc-ce79799e-7aba-4300-b9b8-6db8f247eae6) |
| 18:43–18:49 | Babysit marked complete ([`fcdc0e1`](https://github.com/BlackLodgeLabs/cuebox/commit/fcdc0e16ac887be39676b951dc98a51e9f28ba54)); PR marked ready; [`cursor:complete`](https://github.com/BlackLodgeLabs/cuebox/issues/59#issuecomment-4827056380) notification | `complete` | [`bc-ce79799e…`](https://cursor.com/agents/bc-ce79799e-7aba-4300-b9b8-6db8f247eae6) |

**Duration (spec trigger → complete):** ~75 minutes.

### 2026-06-30 — Human-driven second pass (pagination + Bugbot)

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 06:18 | Human [PR comment](https://github.com/BlackLodgeLabs/cuebox/pull/60#issuecomment-4840460950): TMDB pagination + demo | After `complete`; not routed through issue workflow | — (human trigger) |
| 06:18–06:41 | Pagination, demo, create-pr, babysit ([`c0876a2`…`24fbb9b`](https://github.com/BlackLodgeLabs/cuebox/commits/cursor/issue-59-manual-film-metadata-rematch)) | `complete` → `demo-ready` → `create-pr-ready` → `complete` | [`bc-cd85c308…`](https://cursor.com/agents/bc-cd85c308-c95c-45b0-b4ee-7a71f27a6b2e) ([pagination reply](https://github.com/BlackLodgeLabs/cuebox/pull/60#issuecomment-4840461774); also [discovered](https://github.com/BlackLodgeLabs/cuebox/commit/2d332fa3a2697b4bf0c4650947dea126c0d58c37) as `review-and-spec`) |
| 06:21 | Pagination feature ([`c0876a2`](https://github.com/BlackLodgeLabs/cuebox/commit/c0876a256c6fa9a09c90f489e5d0cf782b611c71)) | `complete` (state not reset) | [`bc-cd85c308…`](https://cursor.com/agents/bc-cd85c308-c95c-45b0-b4ee-7a71f27a6b2e) (inferred) |
| 06:31 | Demo re-run ([`d9f2b67`](https://github.com/BlackLodgeLabs/cuebox/commit/d9f2b6729e2be4ea8812e8b6eae9061a23b0e93e)) | `demo-ready` | [`bc-cd85c308…`](https://cursor.com/agents/bc-cd85c308-c95c-45b0-b4ee-7a71f27a6b2e) (inferred; Scenario 3 **SKIP**) |
| 06:34 | Create-pr agent spawned ([`a399ee7`](https://github.com/BlackLodgeLabs/cuebox/commit/a399ee72dc16873241c37c74ccb12c8d6b88720f)) | handoff | [`bc-a65d210c…`](https://cursor.com/agents/bc-a65d210c-b971-402e-88ef-33940dfad866) |
| 06:36 | [PR.md](PR.md) updated ([`b4e9480`](https://github.com/BlackLodgeLabs/cuebox/commit/b4e948042244840fe00b9e62b3a0ea2c8c903b9c)) | `create-pr-ready` | [`bc-a65d210c…`](https://cursor.com/agents/bc-a65d210c-b971-402e-88ef-33940dfad866) (inferred) |
| 06:37 | Babysit agent spawned ([`fffb3eb`](https://github.com/BlackLodgeLabs/cuebox/commit/fffb3ebd42fd78b86170ac5105084d0a5330ba49)) | handoff | [`bc-0ba769b4…`](https://cursor.com/agents/bc-0ba769b4-c40f-4664-af4f-e34730603b0d) |
| 06:41 | Babysit → `complete` again ([`24fbb9b`](https://github.com/BlackLodgeLabs/cuebox/commit/24fbb9be1ce4430ec69195346827675ec8ed1425)) | `complete` | [`bc-ce79799e…`](https://cursor.com/agents/bc-ce79799e-7aba-4300-b9b8-6db8f247eae6) (state file; may be stale ID vs spawn) |
| 07:00 | Human [requests Bugbot review](https://github.com/BlackLodgeLabs/cuebox/pull/60#issuecomment-4840733664) | After second `complete` | — (human trigger) |
| 07:00–07:08 | Bugbot review + fixes ([`c852a9e`](https://github.com/BlackLodgeLabs/cuebox/commit/c852a9e0110b0bd630ac56becb418742ca08808e), [`bc0e3b2`](https://github.com/BlackLodgeLabs/cuebox/commit/bc0e3b286142ce2464a4aa6572c990e4441b5e94)) | `babysit-in-progress` | [`bc-cd85c308…`](https://cursor.com/agents/bc-cd85c308-c95c-45b0-b4ee-7a71f27a6b2e) ([Bugbot reply](https://github.com/BlackLodgeLabs/cuebox/pull/60#issuecomment-4840734340)); state file shows [`bc-ce79799e…`](https://cursor.com/agents/bc-ce79799e-7aba-4300-b9b8-6db8f247eae6) |
| 07:10 | Issue label `cursor:babysit-in-progress` removed; **no** `cursor:complete` re-applied | — | — |

**Agent index (all attributed IDs)**

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| review-and-spec | `bc-d394e178-1b87-408b-bab3-153240218df4` | [Open](https://cursor.com/agents/bc-d394e178-1b87-408b-bab3-153240218df4) |
| PR follow-up (pagination, Bugbot) | `bc-cd85c308-c95c-45b0-b4ee-7a71f27a6b2e` | [Open](https://cursor.com/agents/bc-cd85c308-c95c-45b0-b4ee-7a71f27a6b2e) |
| planning | `bc-f877646a-dc7a-462c-b7cc-e29ae8317312` | [Open](https://cursor.com/agents/bc-f877646a-dc7a-462c-b7cc-e29ae8317312) |
| execute | `bc-3bd9ae07-6ffe-4689-bb6a-50bbf4e0b01b` | [Open](https://cursor.com/agents/bc-3bd9ae07-6ffe-4689-bb6a-50bbf4e0b01b) |
| demo | `bc-b74255a7-271e-495c-8d3f-44046959f664` | [Open](https://cursor.com/agents/bc-b74255a7-271e-495c-8d3f-44046959f664) |
| create-pr (1st pass) | `bc-a4648891-26b8-4b07-8cac-e41dc44efb09` | [Open](https://cursor.com/agents/bc-a4648891-26b8-4b07-8cac-e41dc44efb09) |
| create-pr (2nd pass) | `bc-a65d210c-b971-402e-88ef-33940dfad866` | [Open](https://cursor.com/agents/bc-a65d210c-b971-402e-88ef-33940dfad866) |
| babysit-pr (1st pass) | `bc-ce79799e-7aba-4300-b9b8-6db8f247eae6` | [Open](https://cursor.com/agents/bc-ce79799e-7aba-4300-b9b8-6db8f247eae6) |
| babysit-pr (2nd spawn) | `bc-0ba769b4-c40f-4664-af4f-e34730603b0d` | [Open](https://cursor.com/agents/bc-0ba769b4-c40f-4664-af4f-e34730603b0d) |

**HEAD state ([`workflow.state.json`](workflow.state.json)):** `babysit-in-progress`, `loops.bugbot: 2`, `loops.total_runs: 9`.  
**PR state:** Open, **not draft**, CI green ([API](https://github.com/BlackLodgeLabs/cuebox/actions), [Frontend](https://github.com/BlackLodgeLabs/cuebox/actions)).

---

## What worked as designed

1. **Human gate + handoff chain (first pass)** — `@cursoragent spec` → Actions handoffs through babysit completed without manual stage overrides ([issue timeline labels](https://github.com/BlackLodgeLabs/cuebox/issues/59)).
2. **Draft PR automation** — PR #60 created and linked at `spec-ready`; execute/create-pr agents pushed commits only ([execute skill](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/execute/SKILL.md)).
3. **Artifact quality** — [SPEC.md](SPEC.md) is detailed and testable; [PLAN.md](PLAN.md) maps files, tests, and gates; [demo-spec.md](demo/demo-spec.md) gave the demo agent exact capture paths.
4. **Implementation coverage** — Plan steps delivered: [`GET /films/{id}/tmdb-search`](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-59-manual-film-metadata-rematch/api/app/routers/v1/films.py), [`POST /films/{id}/rematch`](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-59-manual-film-metadata-rematch/api/app/routers/v1/films.py), [`EditFilmMatchDialog`](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-59-manual-film-metadata-rematch/frontend/src/components/edit-film-match-dialog.tsx), [integration tests](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-59-manual-film-metadata-rematch/api/tests/test_integration_rematch.py), [Playwright E2E](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-59-manual-film-metadata-rematch/frontend/e2e/film-rematch.spec.ts), [api-contracts §4.4–4.5](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-59-manual-film-metadata-rematch/documents/api-contracts.md).
5. **First demo run** — All four flows passed, including Scenario 3 (review override) after seeding a review candidate via CSV ([first `demo-notes.md` at `8ff24fd`](https://github.com/BlackLodgeLabs/cuebox/commit/8ff24fdd8467ac99a9a4f4ec4200cd65d52b2ebb)).
6. **GitHub visibility (transient)** — Handoff Action correctly applied progress labels (`cursor:execute-in-progress`, `cursor:create-pr-in-progress`) even when agents did not commit those stages to the state file.
7. **Human feedback loop** — Pagination gap found in manual review was fixed, re-demoed, and covered by additional tests in [`bc0e3b2`](https://github.com/BlackLodgeLabs/cuebox/commit/bc0e3b286142ce2464a4aa6572c990e4441b5e94).

---

## What did not happen (or deviated)

### State file vs labels

| Expected ([WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)) | Observed on #59 |
|-----|--------|
| Agents commit `*-in-progress` at stage start ([planning](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/planning/SKILL.md), [execute](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/execute/SKILL.md), [create-pr](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/create-pr/SKILL.md) skills) | `execute-in-progress` and `create-pr-in-progress` **never appear** in committed [`workflow.state.json`](workflow.state.json); only GitHub labels reflected them transiently |
| Execute commits while `execute-in-progress` | Code commits [`04bd2b8`–`5833d83`](https://github.com/BlackLodgeLabs/cuebox/commits/cursor/issue-59-manual-film-metadata-rematch) made while state file still showed `plan-ready` |
| Babysit ends at `complete` with stable labels | Three transitions to `complete` (Jun 28, Jun 30 ×2); final push left **no** `cursor:*` label on the issue |
| `agents` map retains handoff IDs ([WORKFLOW.md § Agent conversation links](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)) | Actions recorded IDs ([`917c011`](https://github.com/BlackLodgeLabs/cuebox/commit/917c0111c197f259878190d8e43643658c990989), [`a3dd4c6`](https://github.com/BlackLodgeLabs/cuebox/commit/a3dd4c648ae307d2b2d5265fde67729f0a1b9f60), etc.) but **agent commits overwrote** `agents.*` to `null`; issue status comment shows Planning/Execute/Demo/Create PR as "—" |

### Execute / gate requirements

| Requirement ([execute skill](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/execute/SKILL.md), [PLAN.md](PLAN.md)) | Evidence |
|------------|----------|
| `bash scripts/verify-phase8-gates.sh` before push | Rematch tests added to [gate script](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-59-manual-film-metadata-rematch/scripts/verify-phase8-gates.sh); **no commit or CI log** showing full Phase 8 gate run on the branch |
| `npm run test:unit` when frontend touched | No evidence in commits/PR comments |
| No push until tests green | First pass: plausible (targeted tests committed). Pagination pass: feature committed at [`c0876a2`](https://github.com/BlackLodgeLabs/cuebox/commit/c0876a256c6fa9a09c90f489e5d0cf782b611c71) while stage was `complete` |

### Demo / babysit

| Requirement ([demo skill](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/demo/SKILL.md), [babysit-pr skill](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/babysit-pr/SKILL.md)) | Observed |
|------------|----------|
| Demo agent does not change production code | Pagination **production code** committed before demo stage reset ([`c0876a2`](https://github.com/BlackLodgeLabs/cuebox/commit/c0876a256c6fa9a09c90f489e5d0cf782b611c71) at `complete`) |
| All demo-spec scenarios pass or → `blocked` | Second demo **skipped Scenario 3** ([demo-notes.md](demo/demo-notes.md)); first run had passed it with seeded review data |
| Mark PR ready only when Bugbot/CI clean | PR marked ready at [`24fbb9b`](https://github.com/BlackLodgeLabs/cuebox/commit/24fbb9be1ce4430ec69195346827675ec8ed1425); Bugbot must-fix landed **after** in [`c852a9e`](https://github.com/BlackLodgeLabs/cuebox/commit/c852a9e0110b0bd630ac56becb418742ca08808e) |
| Post-`complete` changes re-enter workflow | Pagination bypassed **execute**; human used `@cursoragent` on PR, not issue + stage reset |

### Spec / product gap

- [SPEC.md](SPEC.md) and [PLAN.md](PLAN.md) specify TMDB search with a **capped result count** (limit 10–20) but **not pagination**. Human review uncovered a real UX gap ([PR comment](https://github.com/BlackLodgeLabs/cuebox/pull/60#issuecomment-4840460950)). Pagination was added correctly but **outside** the original spec acceptance criteria.

---

## Efficiency observations

**Efficient**

- Single-day first pass from spec to PR-ready (~75 min wall time for stages 2–7).
- Execute delivered the full vertical slice in **four logical commits** (API, tests, docs, frontend E2E) rather than the plan’s ten micro-commits — reasonable batching.
- Reuse of `accept_review` / `run_semantic_pipeline_for_film` pattern (as planned) kept scope tight (~2,200 lines added vs `main`).
- Handoff Action spawned agents reliably; no `cursor:blocked` or loop-limit hits (`total_runs` 9/10).

**Less efficient**

- **Duplicate tail stages:** Full create-pr → babysit → `complete` cycle ran **twice** (Jun 28 and Jun 30) plus a **third partial babysit** for Bugbot — ~4 extra agent invocations for one feature.
- **State-file churn:** 11 workflow-only commits (`chore(workflow): …`) on a 27-commit branch (~40% meta commits); many are agent-ID record/discover pushes fighting agent overwrites.
- **Demo regression cost:** Second demo could not replay Scenario 3 without re-seeding review data (documented in [demo-notes.md](demo/demo-notes.md)); first demo had explicitly seeded via CSV.
- **Premature `complete`:** Jun 28 notification told the author to review before human had exercised the UI; human found pagination on first real use → full re-loop.

---

## Issues to learn from

1. **`workflow.state.json` is not the source of truth during agent runs** — Progress labels on the issue were correct; the committed state file lagged (e.g. `plan-ready` during execute). Debugging from the branch file alone is misleading.

2. **Agent state commits wipe `agents` and `active_agent_id`** — [record-agent script](https://github.com/BlackLodgeLabs/cuebox/blob/main/scripts/cursor-workflow-record-agent-on-branch.sh) writes IDs; the next agent push resets them. Issue [#59 status comment](https://github.com/BlackLodgeLabs/cuebox/issues/59#issuecomment-4826887118) lost audit trail for planning/execute/demo/create-pr.

3. **No guard on changes after `complete`** — Feature and fix commits at `complete` / after PR marked ready broke the “terminal stage” contract and desynchronised labels, notifications, and PR draft state.

4. **Demo environment drift** — Part 2 seed data does not guarantee a `review_required` film. Scenario 3 is non-deterministic across demo runs unless the demo agent seeds data per [demo-spec Scenario 3 step 1](demo/demo-spec.md).

5. **Spec did not encode search UX depth** — “Scrollable result list” was implemented with a hard cap; pagination became post-merge scope. Bugbot then found a **stale-results-on-page-change** bug — a class of issue neither spec nor first-pass E2E caught (fixed in [`c852a9e`](https://github.com/BlackLodgeLabs/cuebox/commit/c852a9e0110b0bd630ac56becb418742ca08808e); E2E added in [`bc0e3b2`](https://github.com/BlackLodgeLabs/cuebox/commit/bc0e3b286142ce2464a4aa6572c990e4441b5e94)).

6. **`loops` counters under-report babysit work** — `loops.bugbot` is 2 but stage never returned to `complete` after the final fixes; `ci_autofix` stayed 0 despite multiple CI runs on pagination commits.

7. **Comparison with [#45](https://github.com/BlackLodgeLabs/cuebox/tree/main/workflow/issues/issue-45)** — Issue 45 reached `complete` in one pass with `total_runs: 5` and no post-complete loops. Issue 59 shows what happens when human review adds scope after automation declares done.

---

## Deliverable checklist (feature vs workflow)

| Item | Status |
|------|--------|
| [SPEC.md](SPEC.md) acceptance criteria (original scope) | Met on first pass |
| TMDB search pagination | Added post-`complete`; now in [PR.md](PR.md) and code |
| Tests (integration + Playwright) | Present; expanded in pagination/Bugbot fixes |
| Demo artifacts | Present; Scenario 3 skipped on second run |
| PR description [PR.md](PR.md) | Present and updated |
| Workflow `complete` + author notification | Fired twice; **currently inconsistent** (state: babysit-in-progress, issue: no label) |
| Human merge | Pending |

---

## Top 5 recommendations for the next issue/PR

### 1. Make state updates merge-safe (preserve `agents`, `pr`, `loops`)

Update every skill’s state JSON example to **read-modify-write**: never replace the whole `agents` object; always preserve `agents`, `pr`, `active_agent_id`, and `loops` from the latest remote commit. Optionally add a small `scripts/cursor-workflow-merge-state.sh` that agents must run before committing `workflow.state.json`. This fixes the #59 audit-trail loss where only review-and-spec and babysit-pr links survive on the [issue status comment](https://github.com/BlackLodgeLabs/cuebox/issues/59#issuecomment-4826887118).

### 2. Add a `changes-requested` (or `reopen`) stage for post-`complete` work

When a human comments on the PR with new requirements after `complete`, document a single path: set `stage` to e.g. `execute-ready` or a new `changes-requested` → handoff to **execute** (not demo-only), increment `loops.total_runs`, and **convert PR back to draft** until babysit finishes again. Issue #59’s pagination change should have been `plan-ready`/`execute-ready` with an updated SPEC/PLAN, not a code commit at `complete`.

### 3. Require progress stages in committed `workflow.state.json`

Align the branch file with GitHub labels: agents must commit `execute-in-progress` before the first code commit and `create-pr-in-progress` before editing PR.md ([execute](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/execute/SKILL.md) / [create-pr](https://github.com/BlackLodgeLabs/cuebox/blob/main/.cursor/skills/create-pr/SKILL.md) already say this; #59 skipped it). Consider a lightweight CI check that fails if code paths change while `stage` is `complete` or `plan-ready` during execute work.

### 4. Make demo-spec preconditions reproducible for conditional scenarios

For flows that depend on `review_required` or `failed` films, add explicit seed steps to [demo-spec template](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/templates/demo-spec.md) (API call, CSV import, or `scripts/seed-dev-db.py` extension) — as the first demo run did for Scenario 3. Prevents SKIP on re-demo and matches the demo skill rule: document failure or seed, don’t rely on ambient DB state ([Part 2 gate](https://github.com/BlackLodgeLabs/cuebox/blob/main/documents/cloud-agent-part2-test-data.md)).

### 5. Tighten babysit exit criteria and gate evidence

Babysit should not set `complete` until (a) required human review comments on the PR are addressed or explicitly deferred, and (b) a gate run is **recorded** (e.g. one line in PR.md or `demo-notes.md`: “Phase 8 gate exit 0 at `<sha>`”). For UI-heavy features, add spec acceptance criteria for **search/browse UX** (pagination or “showing X of Y”) up front to reduce post-`complete` scope creep like [#60 pagination](https://github.com/BlackLodgeLabs/cuebox/pull/60#issuecomment-4840460950).

---

## References

- Issue: https://github.com/BlackLodgeLabs/cuebox/issues/59  
- PR: https://github.com/BlackLodgeLabs/cuebox/pull/60  
- Workflow docs: [WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md), [SETUP.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/SETUP.md)  
- Artifacts: [SPEC.md](SPEC.md), [PLAN.md](PLAN.md), [PR.md](PR.md), [demo/](demo/), [workflow.state.json](workflow.state.json)  
- Prior workflow run (reference): [issue-45](https://github.com/BlackLodgeLabs/cuebox/tree/main/workflow/issues/issue-45)
