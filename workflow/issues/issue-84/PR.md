## Related Issue

Closes #84

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/84)

## Description

**What does this PR do?**

Hardens the Cursor workflow handoff spawn path so **at most one Cloud Agent is created per skill per stage transition**, even when multiple GitHub Actions handoff jobs overlap (e.g. rapid create-pr pushes).

The root cause was that `cursor-workflow-admission-gate.sh` only checked the **local** `workflow.state.json`. Concurrent runs all passed the gate before any peer's `record-spawn-on-branch.sh` commit landed on the branch — observed in issue #79 when four overlapping handoff runs each spawned a babysit agent after create-pr set `stage=create-pr-ready`.

This PR adds:

1. **Cross-run state visibility** — `cursor-workflow-refetch-state.sh` fetches `origin/<branch>` and overlays remote `agents`, `handoff_pending`, and related fields before admission checks.
2. **Branch-pushed pending lock** — production spawn path writes `handoff_pending` to the branch **before** `POST /v1/agents` (not only in dry-run/mock).
3. **Second admission gate** — after the pending lock push, re-fetch and re-gate so peers see the lock or an already-recorded agent.
4. **Recovery parity** — `cursor-workflow-handoff-recovery.sh` routes through the hardened spawn path with no local-only bypass.
5. **First-wins record-spawn** — if a peer already recorded a different agent id for the skill, `record-spawn-on-branch.sh` no-ops instead of overwriting.

**Why is this the best approach?**

Cross-run coordination uses the existing contract — the issue branch's `workflow/issues/issue-{NNN}/workflow.state.json` as source of truth — without new external services. The refetch → gate → branch pending lock → refetch → re-gate → POST sequence closes the race window while keeping orchestration in shell scripts (no YAML changes). Failed `record-spawn-on-branch` leaves branch pending in place so subsequent runs defer within the existing 15-minute stale window rather than spawning a duplicate.

Depends on [#83](https://github.com/BlackLodgeLabs/cuebox/pull/87) (`fetch-depth: 0`, push-diff includes) — landed; reduces false recovery triggers but did not fix the cross-run spawn race.

## Changes Proposed

* Added `scripts/cursor-workflow-refetch-state.sh` — fetches `origin/<branch>` and merges remote `workflow.state.json` fields relevant to admission (`agents`, `handoff_pending`, `stage`, `pr`, `loops`).
* Hardened `scripts/cursor-workflow-spawn-agent.sh` — production path: refetch → gate → branch pending lock → refetch → re-gate → POST; in-job `CURSOR_WORKFLOW_PENDING_SKILL` retained as defense-in-depth.
* Updated `scripts/cursor-workflow-handoff-recovery.sh` — removed local-only `agents.<skill>` and admission-gate bypass; delegates to hardened spawn path (keeps PR-draft guards).
* Extended `scripts/cursor-workflow-record-spawn-on-branch.sh` — first-wins idempotency when a different agent id is already recorded.
* Updated `scripts/cursor-workflow-record-handoff-pending.sh` — distinguishable exit code when push loses race; `WE_HOLD_LOCK` bypass for own pending.
* Registered refetch helper in `scripts/cursor-workflow-load-scripts.sh` and `scripts/verify-workflow-paths.sh`.
* Added `scripts/fixtures/cursor-workflow/` remote-state fixtures for cross-run tests.
* Extended `scripts/test-cursor-workflow-handoff.sh` with concurrent/overlapping spawn regression cases A–F.
* Documented cross-run dedup in `workflow/cursor-workflow/WORKFLOW.md` § "Cross-run spawn dedup (issue #84)".
* Updated `workflow/cursor-workflow/RETROSPECTIVES.md` concurrent-handoff pattern row with landed mitigation link ([#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88)).

## Scenario Results

All three demo scenarios **pass** (commit `0397155`).

| Scenario | Result |
|----------|--------|
| 1 — Workflow handoff tests (cases A–F) | PASS |
| 2 — `verify-workflow-paths.sh` gate | PASS |
| 3 — Spawn flow documentation | PASS |

### Scenario 1: Handoff tests (cases A–F)

```bash
bash scripts/test-cursor-workflow-handoff.sh
```

| Marker | Result |
|--------|--------|
| refetch remote agent skip | PASS |
| refetch remote pending defer | PASS |
| concurrent race exactly 1 POST | PASS |
| recovery remote agent skip | PASS |
| record-spawn first-wins | PASS |
| failed record-spawn pending lock | PASS |

Final line: `test-cursor-workflow-handoff.sh: all cases passed`.

### Scenario 2: Workflow paths gate

```bash
bash scripts/verify-workflow-paths.sh
```

Exit 0 — `cursor-workflow-refetch-state.sh` registered; final message: `PASS: no legacy workflow paths found`.

### Scenario 3: Documentation

![WORKFLOW.md cross-run spawn dedup section](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/88e945c/workflow/issues/issue-84/demo/scenario-3-workflow-docs.png)

`WORKFLOW.md` documents re-fetch → gate → branch pending lock → re-fetch + second gate → POST. `RETROSPECTIVES.md` concurrent-handoff pattern row links landed mitigation instead of "proposed".

## How to Test

No Docker stack or API keys required — workflow-script infrastructure only.

1. Checkout this branch:
   ```bash
   git checkout cursor/issue-84-harden-concurrent-handoff-spawn-dedup
   ```
2. Run extended handoff tests (includes new cross-run cases A–F):
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
   Expect exit 0 and final line `test-cursor-workflow-handoff.sh: all cases passed`.
3. Run workflow paths regression gate:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
   Expect exit 0 and `PASS: no legacy workflow paths found`.
4. Confirm documentation:
   ```bash
   grep -n "Cross-run spawn dedup" workflow/cursor-workflow/WORKFLOW.md
   grep -n "issue #84" workflow/cursor-workflow/RETROSPECTIVES.md
   ```

## Known Issues / Notes for Reviewer

* Extra `git fetch` + branch push per spawn adds latency — acceptable because spawns are infrequent and correctness matters more than speed.
* If `record-handoff-pending` push fails (network), spawn defers and retries; no POST without lock.
* Stale `handoff_pending` older than 15 minutes is cleared by existing admission-gate logic — unchanged from pre-#84 behavior.
* No application code, database, frontend, or `.github/workflows/cursor-workflow-handoff.yml` changes.

## Gate evidence

- Workflow regression: `verify-workflow-paths.sh` exit 0 at `0397155`
- Handoff tests: `test-cursor-workflow-handoff.sh` exit 0 at `0397155` (cases A–F all PASS)

## Checklist

- [ ] I have tested these changes locally (or via the demo scenarios above).
- [ ] My code follows the style guidelines of this project.
- [ ] I have performed a self-review of my own code.
- [ ] I have commented my code, particularly in hard-to-understand areas.
- [ ] I have made corresponding changes to the documentation.
- [ ] My changes generate no new warnings or errors.
- [ ] I have added tests that prove my fix is effective or that my feature works.
- [ ] New and existing unit tests pass locally with my changes.
