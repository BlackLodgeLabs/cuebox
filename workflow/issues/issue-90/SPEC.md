# Issue #90: Harden record-spawn TOCTOU and recovery tip refetch from issue #84 workflow review

## Summary

Issue [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / PR [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88) shipped cross-run refetch, branch `handoff_pending` lock, first-wins `record-spawn-on-branch.sh`, and recovery parity. During PR #88's own `create-pr-ready` → babysit transition, **three distinct babysit agents** were still POSTed: handoff runs [28923767707](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923767707) and [28923774155](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923774155) each spawned a peer, and commit [`0ddb0c7`](https://github.com/BlackLodgeLabs/cuebox/commit/0ddb0c7f29e8ed9a447a679e3942ef719eb683f9) **overwrote** [`f6b3be8`](https://github.com/BlackLodgeLabs/cuebox/commit/f6b3be82434f68fcb481200a648c58363a317b42) despite first-wins logic.

This issue closes three residual gaps identified in [issue #84 WORKFLOW-REVIEW.md § Top recommendations #1–3](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md):

1. **`record-spawn-on-branch.sh` TOCTOU** — fetch + checkout + read + write is not atomic; a concurrent writer can overwrite a peer's agent id between read and jq write.
2. **Recovery uses stale checkout** — `actions/checkout` forced update on trigger SHA can hide branch-tip spawn records; recovery decides `agents.<skill>` is null and spawns again.
3. **Tests use JSON overlay only** — mocked concurrent tests (`CURSOR_WORKFLOW_REFETCH_REMOTE_JSON`) do not simulate real git push races between `record-handoff-pending` and `record-spawn-on-branch`.

**Depends on:** [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88) (merged). Should land **before** [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) so expanded recovery paths inherit hardened spawn/record semantics.

## Problem

### Production incident (PR #88 dogfood)

At `create-pr-ready`, two handoff runs fired within seconds on rapid create-pr pushes. Both saw `agents.babysit-pr=null` before peer pending/spawn records landed:

| Commit | Agent recorded | Outcome |
|--------|----------------|---------|
| `f6b3be8` | `bc-c8157c3f…` | First spawn record |
| `0ddb0c7` | `bc-139b6f8c…` | **Overwrote** first record |
| `ce43b9d` | `bc-ee8343db…` | Recovery + third handoff spawn |

Mocked tests (cases A–F in `test-cursor-workflow-handoff.sh`) passed, but production rapid-push + recovery + `record-spawn` git races left duplicate spawns.

### Gap 1: `record-spawn` first-wins TOCTOU

`cursor-workflow-record-spawn-on-branch.sh` currently:

1. `git fetch` + `git checkout -B origin/<branch>` (line 64–65)
2. Reads `agents.<skill>` from checked-out file (line 72–82)
3. Writes jq overlay and `git push` (line 84–99)

Between steps 2 and 3, a concurrent run can fetch, write, and push its own agent id. The late run's read sees null (or its own id), writes, and **overwrites** the peer's record — exactly what happened at `0ddb0c7`.

The dry-run / mock path already has first-wins logic; production needs a **second refetch immediately before the jq write** (or equivalent) so the read and write are based on the same branch tip.

### Gap 2: Recovery checkout rewind

`cursor-workflow-handoff-recovery.sh` calls `cursor-workflow-refetch-state.sh` (line 86), which overlays remote `agents` from `origin/<branch>` via `git show` without forcing a working-tree checkout. However, when recovery is invoked from the GitHub Action, the job's `actions/checkout` may be pinned to the **trigger SHA**, not branch tip. If a spawn record landed on a newer commit after the trigger SHA, the local `workflow.state.json` on disk may lack `agents.<skill>` even though branch tip has it.

Recovery then passes admission gate and POSTs a duplicate agent. Run [28923774155](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923774155) exhibited this pattern.

### Gap 3: Test fidelity

Existing concurrent tests use `CURSOR_WORKFLOW_REFETCH_REMOTE_JSON` or `CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE` overlays — they model logical races but not **real git push ordering** between `record-handoff-pending` and `record-spawn-on-branch`. A fixture with temp bare remotes and parallel shell processes is needed to catch pending-lock and record-spawn races that JSON mocks miss.

## Acceptance criteria

- [ ] `cursor-workflow-record-spawn-on-branch.sh` re-fetches `origin/<branch>` immediately before the jq write and aborts (exit 0, no overwrite) when `agents.<skill>` is already set to a different id
- [ ] `cursor-workflow-handoff-recovery.sh` (and spawn path it delegates to) refetches **branch tip** — not trigger SHA / checked-out commit — before deciding whether to spawn when `agents.<skill>` appears null locally
- [ ] Pending-lock TOCTOU narrowed: concurrent `record-handoff-pending` losers defer without POST (existing behavior verified under real git fixture)
- [ ] New integration test in `scripts/test-cursor-workflow-handoff.sh` uses **real temp git remotes** (not JSON overlay) simulating two parallel `record-handoff-pending` + POST paths; exactly one POST
- [ ] Regression test for recovery: branch tip has `agents.<skill>` set but trigger SHA checkout lacks it → recovery does **not** spawn
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `workflow/cursor-workflow/RETROSPECTIVES.md` pattern rows for `record-spawn` git race and recovery checkout rewind updated with mitigation link when landed

## Scope

### In scope

| Path | Change |
|------|--------|
| `scripts/cursor-workflow-record-spawn-on-branch.sh` | Pre-write refetch + abort on peer agent id |
| `scripts/cursor-workflow-handoff-recovery.sh` | Branch-tip refetch before spawn decision |
| `scripts/cursor-workflow-spawn-agent.sh` | Refetch placement if recovery refetch belongs here instead of recovery script |
| `scripts/cursor-workflow-refetch-state.sh` | Optional: explicit branch-tip mode if needed by recovery |
| `scripts/test-cursor-workflow-handoff.sh` | Parallel git remote fixture tests (pending race + recovery rewind) |
| `scripts/fixtures/cursor-workflow/` | New fixtures if needed for git remote tests |
| `workflow/cursor-workflow/WORKFLOW.md` | Document pre-write refetch and recovery branch-tip semantics |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | Update mitigation links for pattern rows |

### Out of scope

- [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) recovery gaps (`execute-passback`, `changes-requested`, `ensure_pr_on_branch`, `workflow_dispatch`) — separate issue; this issue only hardens spawn/record/refetch mechanics those paths will call
- Demo spawn timing (defer demo until `execute-ready`) — separate issue per [#84 WORKFLOW-REVIEW recommendation #4](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md)
- Create-pr batched pushes — separate issue per [#84 WORKFLOW-REVIEW recommendation #5](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md)
- Application code, database, frontend

## User flows / API changes

No end-user UI or API changes. Workflow operators should observe:

| Scenario | Expected behavior |
|----------|-------------------|
| Overlapping handoff runs on rapid pushes | At most **one** agent POST per skill per stage transition (production, not just mocked fixtures) |
| Recovery on sync-only push after spawn record on newer commit | Recovery **does not** spawn when branch tip already records the target skill |
| Concurrent `record-spawn-on-branch` commits | Later run **aborts** (exit 0) with peer message; never overwrites a different agent id |
| Concurrent `record-handoff-pending` | Loser exits 2 / defers without POST (verified under real git fixture) |

### Technical behavior (implementation hints)

**`record-spawn-on-branch.sh`:**

After the initial fetch/checkout/read gate, immediately before writing:

```bash
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
# re-read agents.<skill>; if set to different id → exit 0
```

Consider push retry on non-fast-forward if two runs race the write window (optional hardening; primary fix is abort-before-overwrite).

**Recovery branch-tip refetch:**

Ensure `cursor-workflow-refetch-state.sh` (or recovery wrapper) reads `origin/<branch>:workflow/issues/issue-N/workflow.state.json` at **branch tip**, not the working tree file left by `actions/checkout` at trigger SHA. The admission gate (`cursor-workflow-admission-gate.sh`) must see remote `agents.<skill>` before deciding to proceed.

**Git remote integration test:**

1. Create temp bare remote + clone
2. Seed `workflow.state.json` at `create-pr-ready` with `agents.babysit-pr=null`
3. Run two parallel paths: `record-handoff-pending set` → mock POST → `record-spawn-on-branch`
4. Assert exactly one POST and one winning agent id in branch-tip state

**Recovery rewind regression:**

1. Checkout commit A (no `agents.babysit-pr`)
2. Push commit B to remote with `agents.babysit-pr` set
3. Invoke recovery with local state at A
4. Assert recovery skips spawn (`skip:agent-already-recorded` or equivalent)

## Data and integration notes

- **Data impact:** None — GitHub Actions workflow scripts and git branch state only
- **External APIs:** No Cursor API contract changes; spawn payload unchanged
- **CI:** `verify-workflow-paths.sh` and `test-cursor-workflow-handoff.sh` are the primary gates; no api-ci / frontend-ci required
- **Ordering:** Merge after [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88); land before [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86)

## Open questions (must be empty before plan-ready)

_None — issue body and #84 workflow review provide sufficient detail._

## Links

- GitHub issue: [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90)
- Parent issue: [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88)
- Workflow review source: [issue #84 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/cd62b3a/workflow/issues/issue-84/WORKFLOW-REVIEW.md)
- Retrospectives index: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
- Incident commits: [`f6b3be8`](https://github.com/BlackLodgeLabs/cuebox/commit/f6b3be82434f68fcb481200a648c58363a317b42), [`0ddb0c7`](https://github.com/BlackLodgeLabs/cuebox/commit/0ddb0c7f29e8ed9a447a679e3942ef719eb683f9), [`ce43b9d`](https://github.com/BlackLodgeLabs/cuebox/commit/ce43b9d88ec5cecb3dc340d7173b09066cd640d5)
- Handoff runs: [28923767707](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923767707), [28923774155](https://github.com/BlackLodgeLabs/cuebox/actions/runs/28923774155)
