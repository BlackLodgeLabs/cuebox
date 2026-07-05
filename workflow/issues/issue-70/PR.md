## Related Issue

[#70 — Harden cursor workflow from issue #28 review (handoff dedup, quota, babysit recovery)](https://github.com/BlackLodgeLabs/cuebox/issues/70)

## Description

**What does this PR do?**

Hardens the Cursor multi-agent issue workflow so handoffs are deduplicated, quota-safe, and self-healing when a forward stage is missed. This addresses the failure mode from [issue #28 / PR #67](https://github.com/BlackLodgeLabs/cuebox/pull/67) where the branch reached `create-pr-ready` but babysit never ran due to over-spawning, Cursor API 400 (plan limit), and sync-only pushes after a lost handoff.

Key changes:

- **`handoff_pending` lock** — per-issue spawn lock set before `POST /v1/agents`, cleared on success or stale timeout (15 minutes)
- **Admission gate** — skip spawn when `agents.<skill>` is already set; enforce global **8-agent cap** via `GET /v1/agents`; defer/retry on cap or API 400 instead of failing the Action
- **Babysit recovery** — spawn babysit when `stage=create-pr-ready`, linked PR is draft, and `agents.babysit-pr` is null, even if `stage` did not change on the push
- **Stage monotonicity** — merge helper uses a stage rank table so agent side-branch merges cannot regress `create-pr-ready` → `demo-ready`
- **Gate evidence** — PR template and skills require progress stages and gate evidence lines

This is **workflow scaffolding only** — no Cuebox application (API, frontend, DB) changes.

**Why is this approach best?**

Spawn logic is extracted from inline YAML into testable shell scripts (`cursor-workflow-admission-gate.sh`, `cursor-workflow-spawn-agent.sh`, `cursor-workflow-babysit-recovery.sh`) so dedup, cap, and recovery behavior can be validated in CI with mocked API responses. Deferral (not `exit 1`) on quota exhaustion keeps the pipeline recoverable on the next push or `workflow_dispatch`. Babysit recovery reuses the forward spawn path without introducing a new `babysit-queued` stage, aligning with the [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68) v2 direction.

**Deployment note:** GitHub Actions loads workflow helper scripts from `origin/main`. New admission/recovery behavior does not take effect for any issue branch until this PR merges to `main`.

## Changes Proposed

* Added `scripts/cursor-workflow-stage-rank.sh` — shared stage rank map (0–100) for monotonic merge
* Added `scripts/cursor-workflow-count-active-agents.sh` — paginate `GET /v1/agents`; count `ACTIVE` agents for this repo
* Added `scripts/cursor-workflow-admission-gate.sh` — dedup, cap, and `handoff_pending` checks; stdout `proceed`/`defer`/`skip`
* Added `scripts/cursor-workflow-record-handoff-pending.sh` — set/clear `handoff_pending` on branch via commit
* Added `scripts/cursor-workflow-spawn-agent.sh` — admission → lock → POST → record → clear; retry on defer/400
* Added `scripts/cursor-workflow-babysit-recovery.sh` — evaluate recovery predicate; call spawn wrapper
* Added `scripts/cursor-workflow-post-deferral-comment.sh` — post deferral comment at most once per 30 minutes
* Updated `scripts/cursor-workflow-merge-state.sh` — monotonic `stage` via rank; `handoff_pending` merge rules
* Added `scripts/test-cursor-workflow-handoff.sh` and fixtures under `scripts/fixtures/cursor-workflow/` — mocked shell tests
* Extended `scripts/verify-workflow-paths.sh` — validate `handoff_pending`, new scripts, docs keywords, skill refs
* Refactored `.github/workflows/cursor-workflow-handoff.yml` — replace inline spawn with scripts; add babysit recovery path
* Added `handoff_pending: null` to `workflow/cursor-workflow/templates/workflow.state.json`
* Added **Gate evidence** section to `workflow/cursor-workflow/templates/PR.md`
* Updated `WORKFLOW.md`, `SETUP.md`, `AGENTS.md` — document cap, deferral, recovery, agent-branch merge rule
* Updated skills (`execute`, `create-pr`, `babysit-pr`, `review-and-spec`) — progress stages, gate evidence, merge helper

## Scenario Results

| # | Scenario | Result |
|---|----------|--------|
| 1 | Workflow path regression (`verify-workflow-paths.sh`) | PASS |
| 2 | Handoff shell tests (mocked dedup, cap, 400, babysit recovery) | PASS |
| 3 | Stage merge monotonicity (`create-pr-ready` beats `demo-ready`) | PASS |
| 4 | Documentation spot-check (8-agent cap, `handoff_pending`, babysit recovery) | PASS |

![Scenario 1 — verify-workflow-paths.sh exit 0](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-70-harden-cursor-workflow-handoff-dedup/workflow/issues/issue-70/demo/scenario-1-verify-workflow-paths.png)

![Scenario 2 — handoff shell tests pass](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-70-harden-cursor-workflow-handoff-dedup/workflow/issues/issue-70/demo/scenario-2-handoff-tests-pass.png)

![Scenario 3 — stage merge monotonicity](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-70-harden-cursor-workflow-handoff-dedup/workflow/issues/issue-70/demo/scenario-3-stage-merge.png)

![Scenario 4 — docs cap and recovery](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-70-harden-cursor-workflow-handoff-dedup/workflow/issues/issue-70/demo/scenario-4-docs-cap-recovery.png)

## How to Test

Workflow-only issue — no Docker stack required.

1. Checkout this branch:

   ```bash
   git checkout cursor/issue-70-harden-cursor-workflow-handoff-dedup
   ```

2. Run the workflow path regression gate:

   ```bash
   bash scripts/verify-workflow-paths.sh
   ```

   Expected: exit 0; output includes `PASS: no legacy workflow paths found` and extended checks for `handoff_pending`, admission/spawn scripts, and skill merge-helper references.

3. Run mocked handoff shell tests:

   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```

   Expected: all cases pass (dedup skip, at-cap defer, API 400 exit 0, fresh pending lock defer, babysit recovery spawn, stage merge keeps higher rank).

4. Spot-check stage merge monotonicity:

   ```bash
   bash scripts/cursor-workflow-merge-state.sh scripts/fixtures/cursor-workflow/state-babysit-recovery.json
   jq -r '.stage' scripts/fixtures/cursor-workflow/state-babysit-recovery.json
   ```

   With remote `create-pr-ready` and local `demo-ready`, merged output should retain `create-pr-ready`.

5. Review documentation updates in `workflow/cursor-workflow/WORKFLOW.md` and `SETUP.md` for 8-agent cap, `handoff_pending` semantics, and babysit recovery predicate.

## Known Issues / Notes for Reviewer

* New handoff scripts load from `origin/main` in GitHub Actions — behavior is fully active only after this PR merges.
* Recovering stuck [PR #67](https://github.com/BlackLodgeLabs/cuebox/pull/67) / issue #28 branch is **out of scope**; this PR hardens future issues only.
* No v1 CI guard for progress stages on `cursor/issue-*` branches — deferred to [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68).
* `CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS` defaults to 8; override for tests via env.
* When defer/retry exhausts, optional fallback to `CURSOR_HANDOFF_GITHUB_TOKEN` `@cursoragent` comment is documented in `WORKFLOW.md`.

## Gate evidence

- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at d454265`
