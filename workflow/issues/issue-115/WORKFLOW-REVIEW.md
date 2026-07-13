# Workflow review — Issue #115 / PR #116

**Review date:** 2026-07-13  
**Branch:** [`cursor/issue-115-tabbed-watchlist-watched-archived`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-115-tabbed-watchlist-watched-archived)  
**PR:** [#116](https://github.com/BlackLodgeLabs/cuebox/pull/116)  
**Reference:** [Cursor workflow docs](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

Issue #115 completed successfully: tabbed watchlist, manual status API, and additive-only CSV sync shipped with 6/6 demo scenarios, green CI, and PR #116 ready for review. End-to-end calendar time was ~3h (spec 16:49 → complete 19:51 UTC), but **~2h of that was idle stall at `demo-ready`**. Headline deviations: (1) the `demo-ready` handoff run was cancelled and recovery failed on `jq: Argument list too long` in `cursor-workflow-fetch-agents-list.sh`, so create-pr never auto-spawned; (2) the later `create-pr-ready` → babysit handoff failed on the same ARG_MAX bug — babysit finished only because the human-resumed create-pr agent continued in-place.

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
| 2026-07-13 14:27 | Issue #115 opened | — | — |
| 16:49:20 | Human `@cursoragent spec` | — | — |
| 16:51–16:52 | Spec + `spec-ready` | `spec-ready` | [`bc-11989aaa`](https://cursor.com/agents/bc-11989aaa-2ae6-42d0-8183-ea8f31c30e1c) |
| 16:55:27 | Draft PR #116 linked | `spec-ready` | Actions |
| 16:56–16:59 | Plan + demo-spec | `plan-ready` | [`bc-5f77654c`](https://cursor.com/agents/bc-5f77654c-8548-41ed-90e0-6b93c0ebdf33) |
| 17:01–17:11 | Execute (API + frontend + tests + gates) | `execute-ready` (`active_skill` still `execute`) | [`bc-1212c4a0`](https://cursor.com/agents/bc-1212c4a0-349b-4d53-94d9-363902f4df4c) |
| 17:11–17:12 | Demo spawned (admission proceeded via #109 defense-in-depth) | `demo-in-progress` | [`bc-923efa2f`](https://cursor.com/agents/bc-923efa2f-275b-45b3-aebc-9ca8583a571e) |
| 17:43:27–17:43:36 | Demo artifacts + `demo-ready` | `demo-ready` (`active_skill` still `demo`) | demo |
| 17:43:39 | Handoff run for `demo-ready` started | — | [29271581256](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271581256) |
| 17:43:49 | Follow-up push: demo notes commit SHA | `demo-ready` unchanged | demo |
| 17:43:52 | `demo-ready` handoff **cancelled** (actor `cursor[bot]`) | stuck `demo-ready` | — |
| 17:43:52–17:44:14 | Follow-up handoff: sync-only + recovery → **`jq ARG_MAX`** | still `demo-ready` | [29271594646](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271594646) |
| 17:43–19:38 | **~1h 55m idle stall** — no create-pr agent; no stalled notify | `demo-ready` | — |
| 19:38:37 | Human: “Workflow is stuck at demo ready. Continue…” | — | — |
| 19:39–19:40 | create-pr-in-progress → PR.md + `create-pr-ready` | `create-pr-ready` | [`bc-2abeb61d`](https://cursor.com/agents/bc-2abeb61d-2ea3-472c-9fe5-80474453819b) |
| 19:40:31–19:40:52 | Babysit handoff reaches spawn, then **`jq ARG_MAX`** (job failure exit 126) | — | [29279362038](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29279362038) |
| 19:49–19:51 | Babysit continued **in-place** on same agent; CI green; PR ready; `complete` | `complete` | same `bc-2abeb61d` |

**Duration (spec trigger → complete):** ~3h 02m (16:49 → 19:51 UTC)  
**Babysit / complete:** ~12m after human resume (19:38 → 19:51)  
**Stall window:** ~1h 55m (`demo-ready` 17:43 → human resume 19:38)

### Agent index

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| review-and-spec | `bc-11989aaa-2ae6-42d0-8183-ea8f31c30e1c` | [link](https://cursor.com/agents/bc-11989aaa-2ae6-42d0-8183-ea8f31c30e1c) |
| planning | `bc-5f77654c-8548-41ed-90e0-6b93c0ebdf33` | [link](https://cursor.com/agents/bc-5f77654c-8548-41ed-90e0-6b93c0ebdf33) |
| execute | `bc-1212c4a0-349b-4d53-94d9-363902f4df4c` | [link](https://cursor.com/agents/bc-1212c4a0-349b-4d53-94d9-363902f4df4c) |
| demo | `bc-923efa2f-275b-45b3-aebc-9ca8583a571e` | [link](https://cursor.com/agents/bc-923efa2f-275b-45b3-aebc-9ca8583a571e) |
| create-pr | `bc-2abeb61d-2ea3-472c-9fe5-80474453819b` | [link](https://cursor.com/agents/bc-2abeb61d-2ea3-472c-9fe5-80474453819b) |
| babysit-pr | `bc-2abeb61d-2ea3-472c-9fe5-80474453819b` | same run (in-place after failed handoff spawn) |

---

## What worked as designed

1. Spec had no clarifying questions; plan and execute matched SPEC scope (status API, tabs, additive CSV, docs, tests).
2. Automated handoffs worked for planning → execute → demo (despite execute leaving `active_skill: execute` — #109 gate defense-in-depth).
3. Demo captured all 6 scenarios with screenshots/JSON; MCP demo summary posted with `<!-- cursor-mcp-demo-summary:v1 -->`.
4. Execute fixed Phase 4 gate regressions and swapped lucide icons for text labels when the dependency was missing — feature still met acceptance.
5. After human resume, create-pr produced a solid `PR.md`; babysit verified CI (`api-tests` + `frontend` success), marked PR ready, and reached `complete` with complete-notify.
6. Loops stayed low: bugbot 0/3, ci_autofix 0/2, total_runs 6/10.

---

## What did not happen (or deviated)

### Stage / label drift

- Final state still has `active_skill: babysit-pr` at `stage: complete` (cosmetic; no further handoff).
- Execute and demo both left non-null `active_skill` on their `*-ready` commits (`execute`, `demo`). Demo→create-pr admission does not special-case `active_skill`, so this was not the stall root cause (unlike #26’s execute→demo path before #109).

### Parallel agents or handoff failures

1. **`demo-ready` handoff cancelled** — run [29271581256](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271581256) for commit `083a6e5` was cancelled (actor `cursor[bot]`) seconds after a follow-up SHA-only push (`04c964e`). Workflow concurrency is `cancel-in-progress: false`, so this cancel is unexpected relative to the YAML; net effect was the same: the stage-transition spawn never ran.

2. **Recovery hit `jq ARG_MAX` and was swallowed** — follow-up run [29271594646](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271594646) correctly saw unchanged stage (`workflow.state.json unchanged — sync only`) and invoked `cursor-workflow-handoff-recovery.sh` under `|| true`. Recovery called `cursor-workflow-fetch-agents-list.sh`, which failed at:
   ```bash
   jq -n --argjson items "$all_items" '{items: $items}' > "$CACHE"
   ```
   with `/usr/bin/jq: Argument list too long`. Because recovery is `|| true`, the job still concluded **success** — no spawn, no job failure signal, **no stalled notification** (#111 notifier never fired).

3. **Same ARG_MAX killed babysit handoff** — after human-driven create-pr, run [29279362038](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29279362038) labeled `create-pr-ready` and started babysit spawn, then failed hard (exit 126) on the same `jq` line. Stalled notify lives inside `spawn-agent.sh` after admission; the crash happened earlier while counting/fetching agents, so again no owner alert.

4. **Root cause in fetch script** — `cursor-workflow-fetch-agents-list.sh` accumulates the full agents list, then passes it via `--argjson` (argv). The optional PR filter also contains `or (. == .)`, which makes the filter a no-op and keeps the full payload. Large account agent lists blow Linux `ARG_MAX`.

### Demo / CI / review gaps

- Demo Scenario 5 needed a retry after wrong Letterboxd CSV column order — documented; final PASS.
- Spec called for watch/archive icons; execute shipped text labels (lucide-react not available) — acceptable UX, noted in PR.md.
- No Bugbot findings; no review threads. CI green on final head (`api-tests`, `frontend`).

---

## Efficiency notes

- ~30 commits on the branch; productive agent work was roughly ~1h of wall clock excluding the stall.
- `loops.total_runs: 6` — create-pr and babysit share one agent ID because babysit was not API-spawned.
- One human nudge unblocked the tail; without it, workflow would have remained at `demo-ready` indefinitely.

---

## Issues to learn from

1. **`jq --argjson` ARG_MAX is a hard handoff breaker** — any path that calls `fetch-agents-list` (admission count, discovery, recovery, spawn) can fail once the Cursor agents list is large enough. Failures in recovery are masked by `|| true`.
2. **Rapid post-`*-ready` follow-up pushes are dangerous** — demo’s SHA-fix push orphaned the `demo-ready` handoff; create-pr skill already forbids post-ready SHA amend pushes, but demo skill still does a separate SHA update pattern.
3. **#111 stalled notifier did not cover this failure mode** — ARG_MAX aborts before `spawn-agent`’s `notify_stalled`, and recovery’s `|| true` converts a terminal miss into a green Action run.
4. **Skills still leave `active_skill` set on `*-ready`** — execute skill docs already require `null` (#26/#109); demo/create-pr/babysit finalize should mirror that for consistency even when the gate does not depend on it.
5. **Human had to push the pipeline** — status comment showed `demo-ready` for ~2h with no create-pr agent and no stalled @mention.

---

## Deliverable checklist

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Feature / workflow scope | ✅ | Tabs, status API, additive CSV, docs — matches SPEC |
| Tests / gates | ✅ | Phase 4 + 6 gates at execute; focused API/frontend tests |
| Demo evidence | ✅ | 6/6 PASS with screenshots + 409 JSON |
| PR.md | ✅ | Embedded evidence URLs; how-to-test; breaking-change notes |
| CI | ✅ | `api-tests` + `frontend` success on final head |
| Babysit / complete | ✅ | PR ready for review; `cursor:complete`; complete-notify posted |

---

## Top recommendations

1. **Fix `cursor-workflow-fetch-agents-list.sh` ARG_MAX** — write items via stdin/temp file (`jq -n --slurpfile` or `jq '{items: .}' < items.json`); remove the `or (. == .)` no-op so PR filtering actually shrinks the list.
2. **Treat fetch/count failures as terminal stalls** — if recovery or pre-spawn agent-list fetch fails, fail the job **and** call `cursor-workflow-notify-stalled.sh` (do not `|| true` away ARG_MAX / curl / jq errors).
3. **Demo skill: single `demo-ready` push** — embed final artifact commit SHA before the handoff push (mirror create-pr amend-in-place); avoid a second SHA-only push that races the handoff run.
4. **Clear `active_skill: null` on every `*-ready` / `complete` finalize** — extend demo, create-pr, and babysit skills to match execute/planning.
5. **Add a regression fixture** — mock a multi-MB agents list and assert fetch-agents-list + recovery still spawn (or notify stalled) without ARG_MAX.

---

## Follow-up issues

| Issue | Title | Scope |
|-------|-------|-------|
| [#117](https://github.com/BlackLodgeLabs/cuebox/issues/117) | Harden agents-list fetch ARG_MAX from issue #115 workflow review | Rewrite `cursor-workflow-fetch-agents-list.sh` to avoid `--argjson` argv; fix PR filter no-op; tests |
| [#118](https://github.com/BlackLodgeLabs/cuebox/issues/118) | Notify stalled when handoff recovery/fetch fails (from #115) | Wire `notify-stalled` for fetch/count hard failures; stop masking recovery errors with bare `\|\| true` |
| [#119](https://github.com/BlackLodgeLabs/cuebox/issues/119) | Demo skill single-push `demo-ready` finalize (from #115) | Align demo git/state rules with create-pr batched push |

---

## References

- Issue: [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115)
- PR: [#116](https://github.com/BlackLodgeLabs/cuebox/pull/116)
- Handoff (cancelled demo-ready): [29271581256](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271581256)
- Handoff (sync-only + ARG_MAX recovery): [29271594646](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271594646)
- Handoff (create-pr-ready babysit ARG_MAX): [29279362038](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29279362038)
- Related: [#26](https://github.com/BlackLodgeLabs/cuebox/issues/26) (`active_skill` on ready), [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) (execute→demo gate), [#111](https://github.com/BlackLodgeLabs/cuebox/issues/111) (stalled notifier)
- Artifacts: `workflow/issues/issue-115/` (pre-merge)
- Related reviews: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
