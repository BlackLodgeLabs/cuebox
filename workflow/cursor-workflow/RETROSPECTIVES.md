# Workflow retrospectives

Curated index of **workflow post-mortems** from completed issues. Full reviews live on the [`workflow/archive`](https://github.com/BlackLodgeLabs/cuebox/tree/workflow/archive) branch.

Before workflow-hardening work, read this file and skim linked reviews. After babysit-pr, run **`@cursoragent workflow-review`** on the issue (see [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79)).

---

## Index

| Issue | PR | Date | Headline lesson | Full review |
|-------|-----|------|-----------------|-------------|
| [#28](https://github.com/BlackLodgeLabs/cuebox/issues/28) | [#67](https://github.com/BlackLodgeLabs/cuebox/pull/67) | 2026-07-03 | Parallel demo side-branches + stage oscillation prevented babysit from starting; state stuck at `create-pr-ready` | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/workflow/archive/issue-28/WORKFLOW-REVIEW.md) |
| [#59](https://github.com/BlackLodgeLabs/cuebox/issues/59) | [#60](https://github.com/BlackLodgeLabs/cuebox/pull/60) | 2026-06-30 | Post-`complete` feedback loop skipped execute; state file and GitHub labels diverged; agent IDs not preserved on merge | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/workflow/archive/issue-59/WORKFLOW-REVIEW.md) |
| [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79) | [#82](https://github.com/BlackLodgeLabs/cuebox/pull/82) | 2026-07-07 | BEFORE_SHA recovery unblocked execute; four concurrent handoffs raced babysit spawn before state recorded — see HANDOFF-HARDENING-NOTES | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md) |
| [#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) | [#87](https://github.com/BlackLodgeLabs/cuebox/pull/87) | 2026-07-07 | New handoff helpers must be registered in load-scripts.sh — YAML wiring alone left diff detection on recovery until merge | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/21abfb6/workflow/issues/issue-83/WORKFLOW-REVIEW.md) |
| [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88) | 2026-07-08 | Cross-run dedup landed but dogfooded babysit still triple-spawned — pending-lock TOCTOU + record-spawn overwrite + checkout rewind | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md) |

*New rows are appended by the `workflow-review` skill ([#79](https://github.com/BlackLodgeLabs/cuebox/issues/79)).*

---

## Recurring patterns

| Pattern | Seen in | Mitigation (landed) |
|---------|---------|---------------------|
| Parallel demo agents spawn orphan branches | #28 | `handoff_pending`, 8-agent cap, admission gate ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70)) |
| `workflow.state.json` stage not committed → labels lie | #59 | Merge-state helper + `*-in-progress` skill rules ([#62](https://github.com/BlackLodgeLabs/cuebox/issues/62)) |
| Post-`complete` scope bypasses execute | #59 | `changes-requested` stage ([#62](https://github.com/BlackLodgeLabs/cuebox/issues/62)) |
| Handoff never reaches babysit when final push doesn't change `stage` | #28 | Babysit recovery on `create-pr-ready` ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70)) |
| Demo re-run fails without explicit seed steps | #59 | Demo-spec seed requirements in template ([#62](https://github.com/BlackLodgeLabs/cuebox/issues/62)) |
| Concurrent handoff runs race admission gate before spawn record lands | [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79), [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | Cross-run re-fetch + branch pending lock ([#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88)); residual TOCTOU — see [#84 review](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md) |
| `record-spawn` git race overwrites peer agent despite first-wins check | [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | Re-fetch before jq write; push retry on conflict (proposed — [#84 review](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md)) |
| Handoff recovery spawns after checkout forced-update hides branch-tip spawn record | [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | Recovery refetch branch tip before spawn decision (proposed — [#84 review](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md)) |
| Shallow checkout misses `BEFORE_SHA` on multi-commit pushes | [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79) | `fetch-depth: 0` + `cursor-workflow-push-diff-includes.sh` ([#87](https://github.com/BlackLodgeLabs/cuebox/pull/87)); `cursor-workflow-ensure-before-sha.sh` + recovery ([#82](https://github.com/BlackLodgeLabs/cuebox/pull/82)) as defense-in-depth |

---

## Archive policy

Completed issue folders move from `workflow/issues/issue-N/` on `main` to `issue-N/` on the **`workflow/archive`** branch after PR merge. See [workflow/README.md](../README.md).

PR and retrospective links should use **commit SHA** or the `workflow/archive` branch — not `main` paths.
