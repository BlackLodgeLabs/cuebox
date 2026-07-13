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
| [#99](https://github.com/BlackLodgeLabs/cuebox/issues/99) | [#100](https://github.com/BlackLodgeLabs/cuebox/pull/100) | 2026-07-10 | Letterboxd Cloudflare 403 blocked first demo (3/5); slug-probe pass-back required before 5/5 — plan demo-spec should flag datacenter external API risk | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/81b08a23883033bbb0c22c4559bfab2221762e06/workflow/issues/issue-99/WORKFLOW-REVIEW.md) |
| [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92) | [#97](https://github.com/BlackLodgeLabs/cuebox/pull/97) | 2026-07-08 | Cloud Agent side-branch `create-pr-ready` + canonical push duplicated babysit PAT fallbacks; parallel #91 added pending-lock contention | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/0c1aeae/workflow/issues/issue-92/WORKFLOW-REVIEW.md) |
| [#26](https://github.com/BlackLodgeLabs/cuebox/issues/26) | [#101](https://github.com/BlackLodgeLabs/cuebox/pull/101) | 2026-07-11 | Execute left `active_skill: execute` at `execute-ready`; #91 gate stalled demo ~7h until human resume — execute skill must clear `active_skill` | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/65697ccd41abda1a2f7261f92e6cb4234d6e2b80/workflow/issues/issue-26/WORKFLOW-REVIEW.md) |
| [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) | [#116](https://github.com/BlackLodgeLabs/cuebox/pull/116) | 2026-07-13 | `demo-ready` handoff cancelled + recovery/`create-pr-ready` spawn died on `jq ARG_MAX` in fetch-agents-list — stalled ~2h with no #111 notify | [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/2ea2eb23634b1e3b4ee9aa547fd7338388886ad0/workflow/issues/issue-115/WORKFLOW-REVIEW.md) |

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
| `record-spawn` git race overwrites peer agent despite first-wins check | [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | Pre-write refetch + abort on peer id ([#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) / [#94](https://github.com/BlackLodgeLabs/cuebox/pull/94)) |
| Handoff recovery spawns after checkout forced-update hides branch-tip spawn record | [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | Recovery `--agents-from-tip` refetch before admission ([#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) / [#94](https://github.com/BlackLodgeLabs/cuebox/pull/94)) |
| Shallow checkout misses `BEFORE_SHA` on multi-commit pushes | [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79) | `fetch-depth: 0` + `cursor-workflow-push-diff-includes.sh` ([#87](https://github.com/BlackLodgeLabs/cuebox/pull/87)); `cursor-workflow-ensure-before-sha.sh` + recovery ([#82](https://github.com/BlackLodgeLabs/cuebox/pull/82)) as defense-in-depth |
| Third-party redirect blocked from cloud/datacenter IPs breaks demo before code fallback exists | [#99](https://github.com/BlackLodgeLabs/cuebox/issues/99) | Plan risk table + demo-spec external-dependency preconditions; ship server-side fallback in execute when redirect is required |
| Cloud Agent side-branch pushes duplicate handoffs for same issue | [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92) | Skip handoff when push ref ≠ `state.branch` (proposed — see [#92 review](https://github.com/BlackLodgeLabs/cuebox/blob/0c1aeae/workflow/issues/issue-92/WORKFLOW-REVIEW.md)) |
| PAT-fallback handoff comments spawn without dedup | [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92) | Dedupe PAT `@cursoragent` comments per skill within window (proposed — see [#92 review](https://github.com/BlackLodgeLabs/cuebox/blob/0c1aeae/workflow/issues/issue-92/WORKFLOW-REVIEW.md)) |
| `execute-ready` without clearing `active_skill` blocks demo indefinitely (#91 gate) | [#26](https://github.com/BlackLodgeLabs/cuebox/issues/26) | Execute skill must set `active_skill: null` on `execute-ready` (see [#26 review](https://github.com/BlackLodgeLabs/cuebox/blob/65697ccd41abda1a2f7261f92e6cb4234d6e2b80/workflow/issues/issue-26/WORKFLOW-REVIEW.md)); stalled notifier ([#95](https://github.com/BlackLodgeLabs/cuebox/issues/95)) for terminal `defer:execute-active` |
| `jq --argjson` ARG_MAX in `fetch-agents-list` breaks recovery + babysit spawn; recovery `\|\| true` hides it | [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) | Rewrite fetch to pipe JSON via file/stdin; remove PR-filter `or (. == .)`; notify-stalled on fetch hard-fail (proposed — see [#115 review](https://github.com/BlackLodgeLabs/cuebox/blob/2ea2eb23634b1e3b4ee9aa547fd7338388886ad0/workflow/issues/issue-115/WORKFLOW-REVIEW.md)) |
| Rapid follow-up push after `*-ready` orphans stage-transition handoff | [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) | Demo skill single-push `demo-ready` (mirror create-pr amend-in-place); recovery must spawn or notify stalled (proposed — see [#115 review](https://github.com/BlackLodgeLabs/cuebox/blob/2ea2eb23634b1e3b4ee9aa547fd7338388886ad0/workflow/issues/issue-115/WORKFLOW-REVIEW.md)) |

---

## Archive policy

Completed issue folders move from `workflow/issues/issue-N/` on `main` to `issue-N/` on the **`workflow/archive`** branch after PR merge. See [workflow/README.md](../README.md).

PR and retrospective links should use **commit SHA** or the `workflow/archive` branch — not `main` paths.
