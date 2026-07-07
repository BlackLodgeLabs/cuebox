# Workflow review — Issue #83 / PR #87

**Review date:** 2026-07-07  
**Branch:** [`cursor/issue-83-harden-fetch-depth-before-sha`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-83-harden-fetch-depth-before-sha)  
**PR:** [#87](https://github.com/BlackLodgeLabs/cuebox/pull/87)  
**Reference:** [Cursor workflow docs](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

Issue #83 completed the full Cursor workflow on **2026-07-07** in roughly **19 minutes** from `@cursoragent spec` (18:40 UTC) to `complete` (18:59 UTC). Execute delivered `fetch-depth: 0`, shared `cursor-workflow-push-diff-includes.sh`, regression tests, and documentation — the first #79 hardening follow-up. Babysit marked PR #87 **ready for review** with zero Bugbot/CI autofix loops.

**Headline deviation:** From `execute-ready` through `complete`, live handoff Action runs referenced `cursor-workflow-push-diff-includes.sh` in YAML but the script was **not registered** in `cursor-workflow-load-scripts.sh`. Every affected run logged `No such file or directory`, skipped primary `state_changed` / `pr_md_changed` detection, and spawned **demo**, **create-pr**, and **babysit-pr** via **handoff recovery** instead. Shell/git fixture tests passed; production handoffs did not exercise the new diff path until merge (or until `load-scripts` is fixed).

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
| 2026-07-07 | Issue #83 opened | First #79 hardening follow-up; scoped from [WORKFLOW-REVIEW #79](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md) and [HANDOFF-HARDENING-NOTES](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-79-workflow-review-skill/workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md) |
| 2026-07-07 | PR #82 merged | Partial `BEFORE_SHA` mitigation (`ensure-before-sha.sh` + recovery) on `main` |

---

## What happened — timeline

Agent links open conversations in the [Cursor agents UI](https://cursor.com/agents). IDs are from [`workflow.state.json`](workflow.state.json), PR commit history, and handoff Action logs.

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 16:58 | Issue #83 opened | — | — |
| 18:40 | `@cursoragent spec` on issue | — | — |
| 18:41:03 | `spec-in-progress` ([`9738e48`](https://github.com/BlackLodgeLabs/cuebox/commit/9738e4842007c341cdf09a1e326bab6f12fd831b)) | `spec-in-progress` | — |
| 18:41:39 | [SPEC.md](SPEC.md) committed ([`94ace48`](https://github.com/BlackLodgeLabs/cuebox/commit/94ace48ca739e2f7aa66323c0dfb61da29a47ffa)) | `spec-ready` | [`bc-ff4736f3…`](https://cursor.com/agents/bc-ff4736f3-9a79-4572-848c-11e2c3a4a2a8) |
| 18:43:26 | Draft [PR #87](https://github.com/BlackLodgeLabs/cuebox/pull/87) linked ([`be3dd84`](https://github.com/BlackLodgeLabs/cuebox/commit/be3dd840c60111bcf5f6d5ee17ab090057a22413)) | planning handoff | — (GitHub Actions) |
| 18:44:24 | Planning agent recorded ([`002126f`](https://github.com/BlackLodgeLabs/cuebox/commit/002126f8cc50c47939ec68cdc2d4be78e6076626)) | handoff | [`bc-b8e22f36…`](https://cursor.com/agents/bc-b8e22f36-9b9b-4303-8f79-5569e1dcdddb) |
| 18:46:00 | [PLAN.md](PLAN.md) + [demo-spec.md](demo/demo-spec.md) ([`0423663`](https://github.com/BlackLodgeLabs/cuebox/commit/042366367746d4480d06144c4fc599cafe414245)) | `plan-ready` | [`bc-b8e22f36…`](https://cursor.com/agents/bc-b8e22f36-9b9b-4303-8f79-5569e1dcdddb) |
| 18:47:26 | Execute agent recorded ([`8f502aa`](https://github.com/BlackLodgeLabs/cuebox/commit/8f502aa0152bd62b49256521a64b41a5f60e297f)) | handoff | [`bc-efc1212c…`](https://cursor.com/agents/bc-efc1212c-a59e-439b-9a40-32b6d8cb7f30) |
| 18:48–18:49 | Implementation commits ([`a84fd18`](https://github.com/BlackLodgeLabs/cuebox/commit/a84fd181f56d69dfe924dad4a4d164603d4edde3), [`91b982a`](https://github.com/BlackLodgeLabs/cuebox/commit/91b982a5457cb4679772be32b26faaa0a97248d1), [`af93d38`](https://github.com/BlackLodgeLabs/cuebox/commit/af93d382a75dc060d070accdd5c22ca59019ee03)) | execute | [`bc-efc1212c…`](https://cursor.com/agents/bc-efc1212c-a59e-439b-9a40-32b6d8cb7f30) |
| 18:49:45 | `execute-ready` ([`185db93`](https://github.com/BlackLodgeLabs/cuebox/commit/185db93ecf9d057b3c1676d8a51ebe8b5e865951)) | demo handoff (recovery) | [`bc-efc1212c…`](https://cursor.com/agents/bc-efc1212c-a59e-439b-9a40-32b6d8cb7f30) |
| 18:51:22 | Demo agent recorded ([`73699f1`](https://github.com/BlackLodgeLabs/cuebox/commit/73699f1894875cdac0a29f9f874b81e828b723f3)) | handoff recovery → demo | [`bc-c7ddb676…`](https://cursor.com/agents/bc-c7ddb676-75e3-47f7-af09-db58b2ef41a1) |
| 18:52:54 | Demo artifacts ([`4d94b06`](https://github.com/BlackLodgeLabs/cuebox/commit/4d94b06137b5a7982b8b2f1c2677300f9b9f3e9c)) | `demo-ready` | [`bc-c7ddb676…`](https://cursor.com/agents/bc-c7ddb676-75e3-47f7-af09-db58b2ef41a1) |
| 18:53:57 | Create-pr agent recorded ([`909cc32`](https://github.com/BlackLodgeLabs/cuebox/commit/909cc32a501b8cd42866c03ff5f445ed8911b7d4)) | handoff recovery → create-pr | [`bc-37fc3a63…`](https://cursor.com/agents/bc-37fc3a63-d12d-4bfe-b053-1a42815a099c) |
| 18:55:39 | [PR.md](PR.md) committed ([`c9c1bc8`](https://github.com/BlackLodgeLabs/cuebox/commit/c9c1bc8a97c6c034fa19f3e438362cfc6ceb49e2)) | `create-pr-ready` | [`bc-37fc3a63…`](https://cursor.com/agents/bc-37fc3a63-d12d-4bfe-b053-1a42815a099c) |
| 18:57:10 | Babysit agent recorded ([`0a6f6df`](https://github.com/BlackLodgeLabs/cuebox/commit/0a6f6df993c573dac4776933b2cf38d85077810d)) | handoff recovery → babysit-pr | [`bc-c83df549…`](https://cursor.com/agents/bc-c83df549-97d4-49b5-800b-00873735b0f9) |
| 18:59:25 | Babysit complete ([`eb03123`](https://github.com/BlackLodgeLabs/cuebox/commit/eb0312313a649310bf0382174e7713962644a4d4)) | `complete` | [`bc-c83df549…`](https://cursor.com/agents/bc-c83df549-97d4-49b5-800b-00873735b0f9) |
| 19:25 | `@cursoragent workflow-review` requested | post-complete review | [`bc-def9c2bb…`](https://cursor.com/agents/bc-def9c2bb-c181-4b49-a289-cab9ff4cb71c) |

**Duration (spec trigger → complete):** ~19 minutes.  
**Babysit / complete:** reached at 18:59 UTC; PR #87 marked ready for review (`isDraft: false`).

### Handoff helper load failure (execute-ready → complete)

After execute landed the new YAML (`91b982a`), handoff runs referenced `$WF/cursor-workflow-push-diff-includes.sh` but `cursor-workflow-load-scripts.sh` did not copy that script into `/tmp/cursor-workflow-scripts/`. Runs on `origin/main` lack the helper; HEAD fallback only applies to scripts **listed** in `HANDOFF_SCRIPTS`.

| Run ID | Trigger commit | Stage transition | Primary diff | Outcome |
|--------|----------------|------------------|--------------|---------|
| [28890579608](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28890579608) | `185db93` execute-ready | `execute-ready` → demo | Helper missing → `state_changed` false | Recovery spawned demo (~78s delay) |
| [28890771442](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28890771442) | `4d94b06` demo-ready | `demo-ready` → create-pr | Helper missing | Recovery spawned create-pr (~42s delay) |
| [28890936758](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28890936758) | `c9c1bc8` PR.md + create-pr-ready | `create-pr-ready` → babysit | Helper missing; `pr_md_changed` also failed | Recovery spawned babysit (~71s delay) |

**Log excerpt** (run 28890579608):

```text
/tmp/cursor-workflow-scripts/cursor-workflow-push-diff-includes.sh: No such file or directory
Handoff recovery: spawning demo for issue #83 (stage=execute-ready)
```

Early runs (spec → execute spawn) still used inline `state_changed` blocks from pre-`91b982a` YAML or detected state on tip-only pushes with one commit — those succeeded without the new helper.

### Agent index

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| review-and-spec | `bc-ff4736f3-9a79-4572-848c-11e2c3a4a2a8` | [Open](https://cursor.com/agents/bc-ff4736f3-9a79-4572-848c-11e2c3a4a2a8) (not recorded in `workflow.state.json`) |
| planning | `bc-b8e22f36-9b9b-4303-8f79-5569e1dcdddb` | [Open](https://cursor.com/agents/bc-b8e22f36-9b9b-4303-8f79-5569e1dcdddb) |
| execute | `bc-efc1212c-a59e-439b-9a40-32b6d8cb7f30` | [Open](https://cursor.com/agents/bc-efc1212c-a59e-439b-9a40-32b6d8cb7f30) |
| demo | `bc-c7ddb676-75e3-47f7-af09-db58b2ef41a1` | [Open](https://cursor.com/agents/bc-c7ddb676-75e3-47f7-af09-db58b2ef41a1) |
| create-pr | `bc-37fc3a63-d12d-4bfe-b053-1a42815a099c` | [Open](https://cursor.com/agents/bc-37fc3a63-d12d-4bfe-b053-1a42815a099c) |
| babysit-pr | `bc-c83df549-97d4-49b5-800b-00873735b0f9` | [Open](https://cursor.com/agents/bc-c83df549-97d4-49b5-800b-00873735b0f9) |
| workflow-review | `bc-def9c2bb-c181-4b49-a289-cab9ff4cb71c` | [Open](https://cursor.com/agents/bc-def9c2bb-c181-4b49-a289-cab9ff4cb71c) |

---

## What worked as designed

1. **Spec and plan** completed without clarifying questions; [SPEC.md](SPEC.md) and [PLAN.md](PLAN.md) mapped directly to #79 hardening scope and execution order (#84/#86 deferred).
2. **Execute** delivered all planned artifacts in logical commits: helper script, YAML `fetch-depth: 0` + DRY diff calls, regression tests, docs.
3. **Shell regression tests** in `test-cursor-workflow-handoff.sh` cover 3-commit non-tip `workflow.state.json` and `PR.md` changes — the exact #79 failure mode.
4. **Demo** ran all five scenarios; `verify-workflow-paths.sh` passed with evidence in [demo-notes.md](demo/demo-notes.md).
5. **Babysit** completed with zero Bugbot/CI autofix loops; PR #87 ready for human review.
6. **No parallel demo orphan branches** and **no concurrent babysit multi-spawn** (contrast [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79)).
7. **Handoff recovery** (#82) kept the pipeline moving when primary diff detection failed — validated as safety net, not ideal primary path.
8. **[RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-83-harden-fetch-depth-before-sha/workflow/cursor-workflow/RETROSPECTIVES.md)** shallow-checkout row updated with PR #87 mitigation link during execute.

---

## What did not happen (or deviated)

### Stage / label drift

- `review-and-spec` agent ID (`bc-ff4736f3`) appears in the issue comment but `workflow.state.json` has `agents.review-and-spec: null` — minor traceability gap (same pattern as other issues before agent recording at spec stage).

### Parallel agents or handoff failures

No duplicate spawns or orphan branches. **Primary-path failure:** `load-scripts` omission caused three consecutive recovery spawns (demo, create-pr, babysit) with ~1–1.5 minute added latency per stage.

### Demo / CI / review gaps

- **Live GitHub Actions did not exercise** `cursor-workflow-push-diff-includes.sh` on any handoff run — demo correctly scoped shell/git fixtures only, but PR acceptance implied handoff hardening; production validation awaits merge + `load-scripts` fix.
- Application CI (api-ci, frontend-ci) did not run — expected for workflow-only change; handoff Action SUCCESS on all nine runs.
- No Bugbot or human review comments at time of review.

---

## Efficiency notes

- **6 workflow agent runs** (`loops.total_runs: 6`) — on target for a focused infrastructure change.
- **19 minutes** spec → complete — faster than [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79) (~62 min); no mid-run hardening commits on the feature branch.
- **~3 minutes** cumulative handoff delay from recovery spawns after helper load failure — avoidable with `load-scripts` registration.

---

## Issues to learn from

1. **YAML references to `$WF/<script>.sh` require `cursor-workflow-load-scripts.sh` registration** — adding a script to the repo and handoff YAML is insufficient; handoff copies only scripts in `HANDOFF_SCRIPTS`. Until merge to `main`, HEAD fallback works only for listed scripts.
2. **`verify-workflow-paths.sh` checks script existence on disk** but did not verify `load-scripts` lists scripts referenced from handoff YAML — gate gap allowed this regression to pass.
3. **Recovery masked the bug** — demo/create-pr/babysit still spawned, so the workflow reached `complete` without surfacing the missing helper as a hard failure. Operators must read Action logs to distinguish primary vs recovery paths.
4. **Pre-merge branch behavior** (HANDOFF-HARDENING-NOTES #6) interacts with new helpers: even with `load-scripts` fixed, other `cursor/issue-*` branches on old `main` will not get the helper until this PR merges — expected, but worth documenting in execute plans.
5. **First #79 follow-up landed the right code** (`fetch-depth: 0`, shared diff helper, tests) but live handoffs during this run still depended on recovery — merge + `load-scripts` fix needed for full mitigation.

---

## Deliverable checklist

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Feature / workflow scope | **Pass** | `fetch-depth: 0`, shared helper, aligned guards per [SPEC.md](SPEC.md) |
| Tests / gates | **Pass** | `verify-workflow-paths.sh` + non-tip regression tests |
| Demo evidence | **Pass** | Five scenarios in [demo/](demo/) |
| PR.md | **Pass** | [PR.md](PR.md) with gate evidence |
| CI | **Pass** | Handoff Action SUCCESS; no app CI required |
| Babysit / complete | **Pass** | `complete`, PR ready for review |
| Live handoff diff path | **Fail (pre-fix)** | Helper not loaded; recovery used for stages 5–7 |

---

## Top recommendations

1. **Register `cursor-workflow-push-diff-includes.sh` in `cursor-workflow-load-scripts.sh` `HANDOFF_SCRIPTS`** before merge (or in a fast-follow commit on PR #87) — required for live handoff diff detection on this and other open branches.
2. **Extend `verify-workflow-paths.sh`** to assert every `cursor-workflow-*.sh` referenced via `$WF/` in `cursor-workflow-handoff.yml` appears in `load-scripts` `HANDOFF_SCRIPTS` — prevents recurrence.
3. **After merge**, smoke-test one multi-commit push on a workflow issue and confirm Action logs show `state_changed=true` without `Handoff recovery:` lines.
4. **Proceed with [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) concurrent spawn dedup** now that diff detection code is on branch — execution order from spec remains valid.
5. **Record `review-and-spec` agent ID** in `workflow.state.json` when spec agent comments with bcId (optional traceability improvement).

---

## Follow-up issues

Proposed titles (human opens):

- `Harden load-scripts registration from issue #83 workflow review` — gate + `load-scripts` parity for new handoff helpers
- Existing [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84), [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) remain as planned

---

## References

- Issue: [#83](https://github.com/BlackLodgeLabs/cuebox/issues/83)
- PR: [#87](https://github.com/BlackLodgeLabs/cuebox/pull/87)
- Parent review: [#79 WORKFLOW-REVIEW](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md)
- Artifacts: `workflow/issues/issue-83/` (pre-merge)
- Related reviews: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-83-harden-fetch-depth-before-sha/workflow/cursor-workflow/RETROSPECTIVES.md)
