# Issue #84: Harden concurrent handoff spawn dedup from issue #79 workflow review

## Summary

Harden the Cursor workflow handoff path so **only one Cloud Agent is spawned per skill per stage transition**, even when multiple GitHub Actions handoff jobs run concurrently (e.g. rapid create-pr pushes). Today `cursor-workflow-admission-gate.sh` deduplicates against the **local checked-out** `workflow.state.json`; concurrent runs all pass the gate before any peer's `record-spawn-on-branch.sh` commit lands on the branch. This issue adds **cross-run visibility** (branch re-fetch and/or branch-pushed lock) before `POST /v1/agents`, covers the recovery path, and closes the gap where a successful API create followed by a failed state write can cause a duplicate spawn.

**Depends on:** [#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) / [#87](https://github.com/BlackLodgeLabs/cuebox/pull/87) (`fetch-depth: 0`, `cursor-workflow-push-diff-includes.sh`) — landed; reduces false recovery triggers but does not fix the cross-run spawn race.

**Source:** [issue #79 WORKFLOW-REVIEW.md § Babysit multi-spawn](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md), [HANDOFF-HARDENING-NOTES.md § Gap #5](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-79-workflow-review-skill/workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md), [RETROSPECTIVES.md recurring pattern — concurrent handoff race](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md).

## Problem

### Observed failure (issue #79, 2026-07-07)

Four handoff Action runs overlapped between **07:10:04–07:10:23 UTC** after create-pr pushed `stage=create-pr-ready`. Each run saw `agents.babysit-pr=null` on its local checkout and spawned a babysit agent before any run's `record-spawn-on-branch.sh` push landed. Two create-pr spawn records (`bc-41147efe…` vs `bc-510752ca…`) showed the same pattern earlier. One babysit agent completed the stage; three were wasted quota.

Handoff run [28848322933](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28848322933) also spawned babysit via **recovery** while normal handoffs were already firing — recovery uses the same local-only admission check.

### Root cause

| Mechanism | Scope | Why it fails under concurrency |
|-----------|-------|--------------------------------|
| `agents.<skill>` check in `cursor-workflow-admission-gate.sh` | Local `/tmp/workflow.state.json` | Peer run's spawn record not fetched yet |
| `CURSOR_WORKFLOW_PENDING_SKILL` env in `cursor-workflow-spawn-agent.sh` | Same Action job | Not visible to other jobs |
| `handoff_pending` in `workflow.state.json` | Branch (when pushed) | In production, pending is **not** pushed to branch before `POST /v1/agents` — only set in dry-run/mock paths |
| `record-spawn-on-branch.sh` | Branch (after POST) | Too late; gate already returned `proceed` for peers |

### Secondary failure mode

If `POST /v1/agents` succeeds but `record-spawn-on-branch.sh` fails (git push error, transient GitHub outage), the next push sees `agents.<skill>` still null. Recovery or a fresh handoff may spawn a duplicate. `handoff_pending` mitigates for ~15 minutes only when it was actually written to the branch.

## Acceptance criteria

- [ ] **Cross-run state visibility:** Immediately before `POST /v1/agents`, the spawn path re-fetches `origin/<branch>` (or equivalent) and re-runs admission checks against the **remote** `workflow.state.json` so a peer run's `agents.<skill>` or fresh `handoff_pending` is visible.
- [ ] **Branch-pushed pending lock:** When admission returns `proceed`, `handoff_pending` is written to the branch **before** the Cursor API call in production (not only dry-run/mock), using `cursor-workflow-record-handoff-pending.sh` or equivalent; concurrent runs defer on `defer:pending-lock`.
- [ ] **Single spawn per skill per transition:** Under simulated 2+ overlapping handoff jobs for the same issue branch and target skill, exactly one run reaches `POST /v1/agents` (others skip or defer until the winner records `agents.<skill>`).
- [ ] **Failed record-spawn safety:** When the API create succeeds but `record-spawn-on-branch.sh` fails, a subsequent push within the 15-minute pending window does **not** spawn a duplicate for the same skill (defer/skip based on branch `handoff_pending` and/or API backfill if feasible).
- [ ] **Recovery parity:** `cursor-workflow-handoff-recovery.sh` uses the same cross-run dedup path as normal handoff (re-fetch + admission gate); recovery does not spawn when a peer already recorded the target skill or holds a fresh pending lock.
- [ ] **Tests:** `scripts/test-cursor-workflow-handoff.sh` extended with concurrent/overlapping spawn regression cases (mocked git fetch + state fixtures); `bash scripts/verify-workflow-paths.sh` passes.
- [ ] **Docs:** `workflow/cursor-workflow/RETROSPECTIVES.md` concurrent-handoff pattern row updated with mitigation link when landed; `WORKFLOW.md` documents cross-run dedup behavior if scripts or lock semantics change.

## Scope

### In scope

- `scripts/cursor-workflow-admission-gate.sh` — optional re-fetch input or helper call; honor branch `handoff_pending` from remote state
- `scripts/cursor-workflow-spawn-agent.sh` — orchestrate re-fetch, branch pending lock before POST, re-check admission after lock
- `scripts/cursor-workflow-handoff-recovery.sh` — route through hardened spawn path (no local-only gate bypass)
- `scripts/cursor-workflow-record-spawn-on-branch.sh` — idempotent when peer already recorded same or different agent for skill (first-wins semantics)
- New helper(s) if needed (e.g. `cursor-workflow-refetch-state.sh`) — must be registered in `scripts/cursor-workflow-load-scripts.sh`
- `.github/workflows/cursor-workflow-handoff.yml` — only if lock/re-fetch orchestration must live in YAML (prefer scripts)
- `scripts/test-cursor-workflow-handoff.sh`, `scripts/verify-workflow-paths.sh` references
- `workflow/cursor-workflow/RETROSPECTIVES.md`, `workflow/cursor-workflow/WORKFLOW.md` as needed

### Out of scope

- `fetch-depth` / `BEFORE_SHA` changes ([#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) — done)
- 8-agent cap / quota deferral ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70) — done)
- Parallel demo side-branch prevention ([#70](https://github.com/BlackLodgeLabs/cuebox/issues/70) — different failure mode)
- `execute-passback` recovery, `changes-requested` re-open inference, `ensure_pr_on_branch` in recovery (separate hardening items in HANDOFF-HARDENING-NOTES)
- Application code, database, or frontend changes

## User flows / API changes

No end-user UI or public API changes.

**Workflow operator experience:**

| Before | After |
|--------|-------|
| Rapid pushes (e.g. create-pr batched commits) can spawn 2–4 agents for the same skill | At most one agent spawned per skill per stage transition |
| Wasted Cloud Agent quota from orphan babysit/create-pr runs | Defer/skip with log lines; optional deferral comment unchanged |
| Recovery may amplify races | Recovery respects same cross-run dedup as normal handoff |

**Handoff Action log expectations (success path):**

1. Admission gate → `proceed`
2. Branch pending lock pushed (or re-fetch shows peer already proceeding)
3. Re-fetch + second admission check → still `proceed` (or `skip`/`defer`)
4. `POST /v1/agents` once
5. `record-spawn-on-branch.sh` clears pending and sets `agents.<skill>`

**Handoff Action log expectations (concurrent loser):**

- `defer:pending-lock` or `skip:agent-already-recorded` after re-fetch; no POST

## Data and integration notes

- **Git:** Cross-run coordination uses the issue branch's `workflow/issues/issue-{NNN}/workflow.state.json` as source of truth — same contract as existing merge-state and spawn-record helpers.
- **Cursor Cloud Agents API:** No API changes; still single `POST /v1/agents` per winning run. Optional: if record-spawn fails but agent id is known, consider writing agent id to branch without re-POST (planning may detail retry vs discover-agents backfill).
- **GitHub Actions:** Handoff workflow already checks out the issue branch; re-fetch is `git fetch origin <branch>` + read `origin/<branch>:workflow/issues/issue-{NNN}/workflow.state.json` or checkout refresh — must not regress shallow-checkout fixes from #83.
- **Race semantics:** When two runs both attempt pending lock, first push wins; loser re-fetches and defers. When two runs record different agent IDs for the same skill, **first recorded agent id on branch wins**; later record attempts should no-op (existing idempotency in `record-spawn-on-branch.sh` may need extension for "different id already set → skip").
- **Test strategy:** Extend mocked handoff tests with:
  - Fixture A: local state has no agent; remote fixture has `agents.babysit-pr` set → skip
  - Fixture B: local proceed; remote fixture gets pending lock between gate calls → defer
  - Fixture C: two simulated spawn paths; only one POST (count mock curl or log marker)
  - Recovery path with remote agent already set → no spawn
- **load-scripts.sh:** Any new helper must appear in `HANDOFF_SCRIPTS` array ([#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) lesson).

## Open questions (must be empty before plan-ready)

*(none)*

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/84
- Parent review: https://github.com/BlackLodgeLabs/cuebox/issues/79
- Depends on (merged): https://github.com/BlackLodgeLabs/cuebox/pull/87
- Forensics: https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md
- Hardening notes: https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-79-workflow-review-skill/workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md
