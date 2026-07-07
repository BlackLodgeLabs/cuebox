# Workflow review — Issue #79 / PR #82

**Review date:** 2026-07-07  
**Branch:** [`cursor/issue-79-workflow-review-skill`](https://github.com/BlackLodgeLabs/cuebox/tree/cursor/issue-79-workflow-review-skill)  
**PR:** [#82](https://github.com/BlackLodgeLabs/cuebox/pull/82)  
**Reference:** [Cursor workflow docs](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md)

---

## Summary

Issue #79 completed the full Cursor workflow on **2026-07-07** in roughly **62 minutes** (06:29–07:31 UTC). Execute delivered the `workflow-review` skill, `WORKFLOW-REVIEW.md` template, gate-script extensions, and documentation updates — all workflow/docs-only, no application code. Babysit marked PR #82 **ready for review** with zero Bugbot/CI autofix loops.

Two handoff hardening events landed mid-run on this branch:

1. **`BEFORE_SHA` shallow-checkout recovery** ([`e459289`](https://github.com/BlackLodgeLabs/cuebox/commit/e4592899dd62a878a37c5493d86162da55aaeb14)) — unblocked execute spawn after `plan-ready` when `github.event.before` fell outside `fetch-depth: 2`.
2. **Babysit multi-spawn race** — four concurrent handoff Action runs (from rapid create-pr pushes) each spawned a babysit agent before any run recorded `agents.babysit-pr` on the branch. One babysit agent eventually completed the stage; three orphan agents were wasted. Gaps and follow-up hardening are documented in [HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md).

**Headline deviation:** Demo ran a **self-review** at `d68bb5b` (appropriate for this meta-feature) before create-pr/babysit finished; this document is the **post-babysit** pass requested via `@cursoragent workflow-review`.

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

## What happened — timeline

Agent links open conversations in the [Cursor agents UI](https://cursor.com/agents). IDs are from [`workflow.state.json`](workflow.state.json), PR commit history, and handoff Action logs.

| Time (UTC) | Event | Stage / label | Agent |
|------------|-------|----------------|-------|
| 06:29 | `spec-in-progress` ([`475bd45`](https://github.com/BlackLodgeLabs/cuebox/commit/475bd457f2034616170fff62faa36141f12f5467)) | `spec-in-progress` | — |
| 06:29 | [SPEC.md](SPEC.md) committed ([`8d5732b`](https://github.com/BlackLodgeLabs/cuebox/commit/8d5732b8946a615b221776a503083e6fd2d07bb2)) | `spec-ready` | — |
| 06:31 | Draft [PR #82](https://github.com/BlackLodgeLabs/cuebox/pull/82) linked ([`2ae1fc5`](https://github.com/BlackLodgeLabs/cuebox/commit/2ae1fc597c26eb12a4bf94752695f616dac749c8)) | planning handoff | — (GitHub Actions) |
| 06:31 | Planning agent recorded ([`3829ae0`](https://github.com/BlackLodgeLabs/cuebox/commit/3829ae0e9473a4e6d0a06cdbefc4b5ac9787ab6d)) | handoff | [`bc-50cb7402…`](https://cursor.com/agents/bc-50cb7402-9ebf-4027-9564-730fa8bf0782) |
| 06:34 | [PLAN.md](PLAN.md) + [demo-spec.md](demo/demo-spec.md) ([`8e82ad5`](https://github.com/BlackLodgeLabs/cuebox/commit/8e82ad57040826373564f9102cca001ec3d0dbd7)) | `plan-ready` | [`bc-50cb7402…`](https://cursor.com/agents/bc-50cb7402-9ebf-4027-9564-730fa8bf0782) |
| 06:56 | Handoff recovery fix for `BEFORE_SHA` ([`e459289`](https://github.com/BlackLodgeLabs/cuebox/commit/e4592899dd62a878a37c5493d86162da55aaeb14)) | infrastructure | — |
| 06:57 | Execute agent recorded ([`4489442`](https://github.com/BlackLodgeLabs/cuebox/commit/4489442221804cbbb65260fb23953a196ae0f6aa)) | handoff | [`bc-e3842ec9…`](https://cursor.com/agents/bc-e3842ec9-24af-4f7d-b393-e82cde16bfd5) |
| 07:00 | Skill + template ([`0aedc71`](https://github.com/BlackLodgeLabs/cuebox/commit/0aedc71b4ff8871b16c4fa72d5980e7dccbf1150)) | execute | [`bc-e3842ec9…`](https://cursor.com/agents/bc-e3842ec9-24af-4f7d-b393-e82cde16bfd5) |
| 07:01 | `execute-ready` ([`71a26a8`](https://github.com/BlackLodgeLabs/cuebox/commit/71a26a88a45028bca70e73ff0ddc8eaf8cc45fc5)) | demo handoff | [`bc-e3842ec9…`](https://cursor.com/agents/bc-e3842ec9-24af-4f7d-b393-e82cde16bfd5) |
| 07:02 | Demo agent recorded ([`fde1a9c`](https://github.com/BlackLodgeLabs/cuebox/commit/fde1a9c8b44dd32867a12e514a409ef096158d6f)) | handoff | [`bc-2a4cacba…`](https://cursor.com/agents/bc-2a4cacba-4617-4ad9-8936-3e2c4d5f8b78) |
| 07:06 | Demo self-review + evidence ([`d68bb5b`](https://github.com/BlackLodgeLabs/cuebox/commit/d68bb5ba2cb119d2b6f1081bffbb96c39c931ffe)) | demo | [`bc-2a4cacba…`](https://cursor.com/agents/bc-2a4cacba-4617-4ad9-8936-3e2c4d5f8b78) |
| 07:07–07:08 | **Duplicate create-pr spawn records** ([`7208720`](https://github.com/BlackLodgeLabs/cuebox/commit/7208720), [`8c45622`](https://github.com/BlackLodgeLabs/cuebox/commit/8c45622)) | handoff race | `bc-41147efe…` then `bc-510752ca…` |
| 07:09 | Create-pr agent starts ([`38439fb`](https://github.com/BlackLodgeLabs/cuebox/commit/38439fb)) | `create-pr-in-progress` | [`bc-510752ca…`](https://cursor.com/agents/bc-510752ca-4f39-4a38-a05b-8c8892d667d2) |
| 07:10 | Rapid create-pr pushes + merge ([`659c6fb`](https://github.com/BlackLodgeLabs/cuebox/commit/659c6fb) → [`2499b03`](https://github.com/BlackLodgeLabs/cuebox/commit/2499b03)) | `create-pr-ready` | [`bc-510752ca…`](https://cursor.com/agents/bc-510752ca-4f39-4a38-a05b-8c8892d667d2) |
| 07:11 | **Four babysit spawns** (concurrent handoff runs — see below) | `create-pr-ready` | 4 agent IDs |
| 07:29 | Babysit agent starts work ([`db8d736`](https://github.com/BlackLodgeLabs/cuebox/commit/db8d736)) | `babysit-in-progress` | [`bc-5a55e9b7…`](https://cursor.com/agents/bc-5a55e9b7-6e2b-4934-b43e-65aa65d0fcb3) |
| 07:31 | Babysit complete, PR ready ([`4d369a5`](https://github.com/BlackLodgeLabs/cuebox/commit/4d369a5)) | `complete` | [`bc-b906be30…`](https://cursor.com/agents/bc-b906be30-9300-46e5-b677-124ee8ccefd8) |
| 07:49 | [HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md) committed ([`5be359c`](https://github.com/BlackLodgeLabs/cuebox/commit/5be359c)) | documentation | — |

**Duration (spec trigger → complete):** ~62 minutes.  
**Babysit / complete:** reached at 07:31 UTC; PR #82 marked ready for review (`isDraft: false`).

### Parallel agent side-branches

| Branch suffix | Stage | Notes |
|---------------|-------|-------|
| `cursor/issue-79-pr-82-demo-agent-be5c` | demo | Merged to issue branch; no orphan demo side-branch on PR #82 (contrast [#28](https://github.com/BlackLodgeLabs/cuebox/issues/28)) |
| `cursor/issue-79-pr-82-create-pr-agent-*` | create-pr | Side branches merged; rapid pushes triggered overlapping handoff runs |

### Babysit multi-spawn forensics

Four handoff Action runs overlapped between **07:10:04–07:10:23 UTC**, each seeing `stage=create-pr-ready` and `agents.babysit-pr=null`:

| Run ID | Trigger commit | Babysit agent spawned | Record commit |
|--------|----------------|----------------------|---------------|
| [28848308262](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28848308262) | `659c6fb` create-pr draft | `bc-820ff152-e48d-4e5e-8454-a5a97ac66749` | [`a7412ba`](https://github.com/BlackLodgeLabs/cuebox/commit/a7412ba) |
| [28848324526](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28848324526) | `2499b03` merge create-pr | `bc-9cef1e8f-1281-4623-a3fd-ff3e521d6f61` | [`3bb4358`](https://github.com/BlackLodgeLabs/cuebox/commit/3bb4358) |
| [28848315854](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28848315854) | `5ba78a3` create-pr draft | `bc-b906be30-9300-46e5-b677-124ee8ccefd8` | [`3571630`](https://github.com/BlackLodgeLabs/cuebox/commit/3571630) |
| [28848322933](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28848322933) | `b125e7f` create-pr fix | `bc-5a55e9b7-6e2b-4934-b43e-65aa65d0fcb3` (via recovery) | [`fb658a0`](https://github.com/BlackLodgeLabs/cuebox/commit/fb658a0) |

**Root cause:** `cursor-workflow-admission-gate.sh` skips spawn only when `agents.<skill>` is already recorded on the **checked-out state file**. Concurrent runs all passed the gate before any `record-spawn-on-branch.sh` push landed — a race distinct from [#28](https://github.com/BlackLodgeLabs/cuebox/issues/28) parallel demo side-branches. `handoff_pending` did not prevent the second through fourth spawns because each run set pending independently before the branch reflected a prior record.

**Outcome:** Babysit-in-progress recorded `bc-5a55e9b7` ([`db8d736`](https://github.com/BlackLodgeLabs/cuebox/commit/db8d736)); final `complete` state retained `bc-b906be30` ([`4d369a5`](https://github.com/BlackLodgeLabs/cuebox/commit/4d369a5)) — agent ID churn from competing record commits. PR still reached `complete` cleanly.

### Agent index

| Skill / role | Agent ID | Conversation |
|--------------|----------|--------------|
| planning | `bc-50cb7402-9ebf-4027-9564-730fa8bf0782` | [Open](https://cursor.com/agents/bc-50cb7402-9ebf-4027-9564-730fa8bf0782) |
| execute | `bc-e3842ec9-24af-4f7d-b393-e82cde16bfd5` | [Open](https://cursor.com/agents/bc-e3842ec9-24af-4f7d-b393-e82cde16bfd5) |
| demo | `bc-2a4cacba-4617-4ad9-8936-3e2c4d5f8b78` | [Open](https://cursor.com/agents/bc-2a4cacba-4617-4ad9-8936-3e2c4d5f8b78) |
| create-pr | `bc-510752ca-4f39-4a38-a05b-8c8892d667d2` | [Open](https://cursor.com/agents/bc-510752ca-4f39-4a38-a05b-8c8892d667d2) |
| babysit-pr (final) | `bc-b906be30-9300-46e5-b677-124ee8ccefd8` | [Open](https://cursor.com/agents/bc-b906be30-9300-46e5-b677-124ee8ccefd8) |
| babysit-pr (orphan) | `bc-820ff152`, `bc-9cef1e8f`, `bc-5a55e9b7` | Wasted spawns from concurrent handoffs |

---

## What worked as designed

1. **Spec and plan stages** completed cleanly with structured [SPEC.md](SPEC.md) and [PLAN.md](PLAN.md) including a demo-spec that exercises the skill output path.
2. **Execute** delivered all acceptance-criteria artifacts in logical commits (skill+template, gate+docs) with `verify-workflow-paths.sh` passing at each gate checkpoint.
3. **`BEFORE_SHA` recovery** ([`e459289`](https://github.com/BlackLodgeLabs/cuebox/commit/e4592899dd62a878a37c5493d86162da55aaeb14)) unblocked execute after `plan-ready` — directly addresses shallow-checkout gaps noted in [#70](https://github.com/BlackLodgeLabs/cuebox/issues/70).
4. **Demo self-review** at `d68bb5b` validated the skill write path (scenarios 1–5 in [demo-notes.md](demo/demo-notes.md)) before babysit — appropriate for this meta-feature.
5. **Babysit** completed with zero Bugbot/CI autofix loops; PR #82 ready for human review.
6. **No parallel demo orphan branches** on PR #82 (contrast [#28](https://github.com/BlackLodgeLabs/cuebox/issues/28)).
7. **[HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md)** captured remaining recovery gaps and GitHub MCP setup guidance when Cloud Agents cannot post issue comments.

---

## What did not happen (or deviated)

### Stage / label drift

Minor agent ID churn at babysit: `babysit-in-progress` ([`db8d736`](https://github.com/BlackLodgeLabs/cuebox/commit/db8d736)) recorded `bc-5a55e9b7` while `complete` ([`4d369a5`](https://github.com/BlackLodgeLabs/cuebox/commit/4d369a5)) retained `bc-b906be30` from an earlier concurrent spawn record. Stage progression itself was correct (`create-pr-ready` → `babysit-in-progress` → `complete`).

### Parallel agents or handoff failures

**Babysit multi-spawn (4 agents):** concurrent handoff runs from rapid create-pr pushes (07:10:01–07:10:23) each spawned babysit before branch state reflected any prior record. Same pattern affected create-pr earlier (two spawn records: `bc-41147efe` vs `bc-510752ca`). Admission gate and `handoff_pending` did not serialize cross-run spawns.

**`BEFORE_SHA` gap (fixed mid-run):** without [`e459289`](https://github.com/BlackLodgeLabs/cuebox/commit/e4592899dd62a878a37c5493d86162da55aaeb14), execute would not have spawned after planning — recovery on this branch was essential.

### Demo / CI / review gaps

- Application CI workflows (api-ci, frontend-ci) did not run on PR #82 — expected for workflow/docs-only change; only handoff Action ran (SUCCESS).
- No human review comments or Bugbot findings at time of review.
- Post-babysit `@cursoragent workflow-review` invocation (this document) closes the loop the demo self-review started.

---

## Efficiency notes

- **6 workflow agent runs** (`loops.total_runs: 6`) for a docs-only feature — reasonable.
- **3 wasted babysit agents** from concurrent handoff race — quota/cost inefficiency; pipeline still completed.
- **Incidental hardening commit** (`e459289`) on the feature branch was necessary for this run but increases PR scope beyond the skill deliverable.

---

## Issues to learn from

1. **Shallow checkout + multi-commit pushes** leave `github.event.before` outside fetch depth; `cursor-workflow-ensure-before-sha.sh` + recovery are essential ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70) pattern). Remaining gaps documented in [HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md) §Gaps.
2. **Concurrent handoff runs race the admission gate** when multiple pushes land before spawn records propagate — distinct from [#28](https://github.com/BlackLodgeLabs/cuebox/issues/28) demo side-branches. `handoff_pending` is per-run, not cross-run.
3. **Recovery can amplify races:** run [28848322933](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28848322933) spawned babysit via recovery after normal handoffs had already fired — recovery keys off `agents.<skill>` null, same race window.
4. **Meta-features** benefit from demo self-review before babysit; post-babysit review captures CI/handoff forensics the self-review could not.
5. **Cloud Agent integration tokens** cannot post GitHub issue comments — [HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md) documents GitHub MCP + PAT workaround.

---

## Deliverable checklist

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Feature / workflow scope | Done | Skill, template, docs, gate per [SPEC.md](SPEC.md) |
| Tests / gates | Done | `verify-workflow-paths.sh` exit 0 at execute, demo, create-pr, babysit |
| Demo evidence | Done | Five scenarios in [demo/](demo/); self-review at `d68bb5b` |
| PR.md | Done | [PR.md](PR.md) at create-pr stage |
| CI | Partial | Handoff Action SUCCESS; no app CI (docs-only) |
| Babysit / complete | Done | PR #82 ready for review at `4d369a5` |

---

## Top recommendations

Priority order aligns with [HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md) §Suggested hardening:

1. **Increase `fetch-depth`** to `0` (or sufficient depth) in handoff Action checkout — simplest fix for the `BEFORE_SHA` class of bugs.
2. **Cross-run spawn dedup** — before POST `/v1/agents`, re-fetch branch state (or use a short-lived lock) so concurrent handoff runs see a peer's `record-spawn` commit; extend admission gate beyond local file check.
3. **Recovery for `execute-passback`** when `passback_to` is set but no run started — currently uncovered.
4. **Infer re-open without `prev_stage`** on sync-only pushes — avoid spawning demo instead of execute after `changes-requested`.
5. **Call `ensure_pr_on_branch` from recovery** for `spec-ready` / `plan-ready` — avoid `Draft PR #null` prompts.
6. **Configure GitHub MCP** (dashboard PAT) for Cloud Agents that need issue/PR write access — see [HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md) §Setup.

---

## Follow-up issues

Created from this review and [HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md):

| Order | Issue | Title |
|-------|-------|-------|
| **1** | [#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) | Harden fetch-depth / BEFORE_SHA |
| **2** | [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | Harden concurrent handoff spawn dedup *(after #83)* |
| **3** | [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) | Harden handoff recovery gaps *(after #83 and #84)* |
| parallel | [#85](https://github.com/BlackLodgeLabs/cuebox/issues/85) | Document GitHub MCP for Cloud Agent issue comments |

```
#83 fetch-depth/BEFORE_SHA
  └─► #84 cross-run spawn dedup
        └─► #86 recovery gaps (passback, re-open, ensure-PR, resync)

#85 MCP docs (independent)
```

---

## References

- Issue: [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79)
- PR: [#82](https://github.com/BlackLodgeLabs/cuebox/pull/82)
- Artifacts: `workflow/issues/issue-79/`
- Hardening notes: [HANDOFF-HARDENING-NOTES.md](HANDOFF-HARDENING-NOTES.md)
- Related reviews: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md) ([#28](https://github.com/BlackLodgeLabs/cuebox/blob/workflow/archive/issue-28/WORKFLOW-REVIEW.md), [#59](https://github.com/BlackLodgeLabs/cuebox/blob/workflow/archive/issue-59/WORKFLOW-REVIEW.md))
