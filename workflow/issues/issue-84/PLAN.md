# Issue #84 — Implementation plan

## Overview

Harden the Cursor workflow handoff spawn path so **at most one Cloud Agent is created per skill per stage transition**, even when multiple GitHub Actions handoff jobs overlap. The fix adds **cross-run state visibility** (re-fetch `origin/<branch>` before admission checks and POST) and a **branch-pushed `handoff_pending` lock** written before `POST /v1/agents` in production — not only in dry-run/mock paths.

This is **workflow infrastructure** (not an application bug). No Docker stack or bug-repro artifacts are required.

**Forensics (issue #79):** Four handoff runs overlapped 2026-07-07 07:10:04–07:10:23 UTC after create-pr set `stage=create-pr-ready`. Each run saw `agents.babysit-pr=null` on its local checkout and spawned babysit before any peer's `record-spawn-on-branch.sh` push landed. Recovery amplified the race by using the same local-only admission check.

## Root cause

| Mechanism | Scope | Failure under concurrency |
|-----------|-------|---------------------------|
| `agents.<skill>` in `cursor-workflow-admission-gate.sh` | Local checkout | Peer spawn record not fetched |
| `CURSOR_WORKFLOW_PENDING_SKILL` env | Same Action job | Invisible to other jobs |
| `handoff_pending` on branch | Branch (when pushed) | Production never pushes pending before POST — only dry-run/mock |
| `record-spawn-on-branch.sh` | Branch (after POST) | Too late; peers already passed gate |

**Secondary mode:** POST succeeds but `record-spawn-on-branch.sh` fails → next push sees `agents.<skill>` null. Branch `handoff_pending` (if written pre-POST) blocks duplicate spawn within the 15-minute stale window.

## Target spawn flow (production)

```text
loop (max 3 attempts):
  1. refetch remote workflow.state.json into local state file
  2. admission gate → skip | defer | proceed
  3. if proceed:
       a. record-handoff-pending (branch push: set skill + started_at)
       b. refetch remote state
       c. admission gate again
          - peer recorded agent → skip
          - peer holds fresh pending for same skill (not us) → defer:pending-lock
          - still proceed → POST /v1/agents once
       d. record-spawn-on-branch (clears pending, sets agents.<skill>)
```

Recovery and normal handoff both route through `cursor-workflow-spawn-agent.sh` — no local-only gate bypass.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `scripts/cursor-workflow-refetch-state.sh` | **New** | Fetch `origin/<branch>` and overlay remote `workflow.state.json` onto local state file (or emit remote JSON for tests via env) |
| `scripts/cursor-workflow-spawn-agent.sh` | **Modify** | Orchestrate refetch → gate → branch pending lock → refetch → re-gate → POST; use production `record-handoff-pending` before POST |
| `scripts/cursor-workflow-admission-gate.sh` | **Modify** (optional) | Accept optional `--remote-state <file>` or document that caller must refetch first; no behavioral change if refetch is always caller responsibility |
| `scripts/cursor-workflow-handoff-recovery.sh` | **Modify** | Remove redundant local-only `admission-gate` + `agents.<skill>` early exit that bypasses cross-run dedup; delegate to hardened `spawn-agent.sh` (keep PR-draft guards) |
| `scripts/cursor-workflow-record-spawn-on-branch.sh` | **Modify** | First-wins idempotency: if `agents.<skill>` already set to a **different** id → no-op exit 0 (do not overwrite) |
| `scripts/cursor-workflow-record-handoff-pending.sh` | **Modify** (minor) | Return distinguishable exit code when push loses race (peer already has pending/agent); support test dry-run overlay |
| `scripts/cursor-workflow-load-scripts.sh` | **Modify** | Register `cursor-workflow-refetch-state.sh` in `HANDOFF_SCRIPTS` |
| `scripts/verify-workflow-paths.sh` | **Modify** | Add new script to required-scripts list |
| `scripts/test-cursor-workflow-handoff.sh` | **Modify** | Add concurrent/overlapping spawn regression cases (fixtures A–D below) |
| `scripts/fixtures/cursor-workflow/` | **Add** | Remote-state fixtures for cross-run tests |
| `workflow/cursor-workflow/WORKFLOW.md` | **Modify** | Document cross-run refetch + branch pending lock before POST |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | **Modify** | Update concurrent-handoff pattern row with mitigation link when landed |

No `.github/workflows/cursor-workflow-handoff.yml` changes expected — orchestration stays in scripts.

## Implementation steps

### Step 1 — `cursor-workflow-refetch-state.sh`

Create helper:

```bash
# Usage: cursor-workflow-refetch-state.sh <state-file> <branch>
```

Behavior:

1. Read `issue` and relative path from local state file.
2. `git fetch origin "$BRANCH"` (no-op in test when `CURSOR_WORKFLOW_REFETCH_REMOTE_JSON` env set).
3. Read remote JSON via `git show "origin/${BRANCH}:${REL_PATH}"` (empty `{}` if missing).
4. Merge into local state file fields relevant to admission: `agents`, `handoff_pending`, `stage`, `pr`, `loops` — **do not** clobber local-only progress fields the caller may be writing (`active_skill` during spawn is set by record-spawn, not refetch).
5. Exit 0 always; log when remote differs from pre-fetch for observability.

Test hook: `CURSOR_WORKFLOW_REFETCH_REMOTE_JSON='{...}'` bypasses git and applies fixture as remote overlay (same pattern as `MERGE_STATE_REMOTE_JSON` in merge-state tests).

Register in `HANDOFF_SCRIPTS` and `verify-workflow-paths.sh`.

### Step 2 — Production pending lock in `spawn-agent.sh`

In the `proceed` branch, replace the current production path that only sets `CURSOR_WORKFLOW_PENDING_SKILL` env:

```166:177:scripts/cursor-workflow-spawn-agent.sh
    proceed)
      if [ "${CURSOR_WORKFLOW_PENDING_DRY_RUN:-}" = "1" ]; then
        "$WF/cursor-workflow-record-handoff-pending.sh" ...
      elif [ "${MOCK_CURSOR_API:-}" != "1" ]; then
        export CURSOR_WORKFLOW_PENDING_SKILL="$SKILL"
```

New production sequence:

1. Call `refetch-state.sh`.
2. First `admission-gate` → handle skip/defer as today.
3. On `proceed`: call `record-handoff-pending.sh set` (branch push) unless `MOCK_CURSOR_API=1` (local jq only).
4. `refetch-state.sh` again.
5. Second `admission-gate`:
   - `skip:agent-already-recorded` → exit 0 (peer won).
   - `defer:pending-lock` → sleep/backoff retry (peer holds lock).
   - `proceed` → `do_post_agent`.
6. Keep in-job `CURSOR_WORKFLOW_PENDING_SKILL` as defense-in-depth within the same job.
7. On API 400: `record-handoff-pending clear` (existing behavior).
8. On successful POST + failed `record-spawn-on-branch`: **do not** clear branch pending (record-spawn is the only clearer); subsequent runs defer on pending until stale (15 min) or recovery re-records.

### Step 3 — `record-spawn-on-branch.sh` first-wins

Extend idempotency block:

```51:57:scripts/cursor-workflow-record-spawn-on-branch.sh
CURRENT=$(jq -r --arg k "$AGENT_KEY" '...')
if [ -n "$CURRENT" ] && [ "$CURRENT" != "null" ] && [ "$CURRENT" = "$AGENT_ID" ] ...
```

Add before jq write:

- If `CURRENT` is non-null and **≠** `AGENT_ID` → log "peer agent already recorded" and exit 0 without overwrite.

### Step 4 — Recovery parity

Simplify `cursor-workflow-handoff-recovery.sh`:

- Keep stage → skill mapping and create-pr-ready draft-PR guard.
- Remove lines 59–65 (local `agents.<skill>` check) and lines 89–93 (local-only admission gate) — `spawn-agent.sh` performs refetch + gate.
- Keep `echo "Handoff recovery: spawning …"` before calling `spawn-agent.sh`.

### Step 5 — Tests (`test-cursor-workflow-handoff.sh`)

Add fixtures and cases:

| Case | Fixture | Assertion |
|------|---------|-----------|
| **A — remote agent recorded** | Local: no `agents.babysit-pr`; `REFETCH_REMOTE_JSON` sets `agents.babysit-pr=bc-peer` | Admission after refetch → `skip:agent-already-recorded`; spawn logs "Spawn skipped"; **0 POST** |
| **B — remote pending lock** | Local: proceed; between gate calls remote fixture gains fresh `handoff_pending` for same skill | Second gate → `defer:pending-lock`; **0 POST** |
| **C — single POST under race** | Two spawn invocations in subshell with scripted remote sequence (first wins pending, second sees lock) | Count POST marker (`MOCK_CURSOR_POST_COUNT_FILE`); exactly **1** POST |
| **D — recovery respects remote** | `state-babysit-recovery.json` + remote already has `agents.babysit-pr` | Recovery exits without "spawning babysit-pr" log; **0 POST** |
| **E — record-spawn first-wins** | Branch state has `agents.execute=bc-first`; record-spawn called with `bc-second` | No overwrite; exit 0 |
| **F — failed record-spawn + pending** | Mock POST success + mock record-spawn failure; state has fresh pending | Subsequent spawn defers on `pending-lock`; **0 second POST** |

Use `CURSOR_WORKFLOW_PENDING_DRY_RUN=1` and `MOCK_CURSOR_API=1` for hermetic tests (no real git push). Add `MOCK_RECORD_SPAWN_FAIL=1` hook in `spawn-agent.sh` for case F only if needed.

### Step 6 — Documentation

- **WORKFLOW.md** — In "Batched spawn writes" / admission gate section, add subsection **Cross-run spawn dedup**: refetch before gate; branch `handoff_pending` pushed before POST; second refetch + gate; first-wins record-spawn.
- **RETROSPECTIVES.md** — Update recurring pattern row "Concurrent handoff runs race admission gate…" to link to issue #84 / PR #88 instead of "proposed".

## Tests required

| Test | Maps to acceptance criterion |
|------|-------------------------------|
| `test_refetch_remote_agent_skip` | Cross-run state visibility |
| `test_refetch_remote_pending_defer` | Branch-pushed pending lock |
| `test_concurrent_single_post` | Single spawn per skill per transition |
| `test_failed_record_spawn_pending_blocks` | Failed record-spawn safety |
| `test_recovery_remote_agent_skip` | Recovery parity |
| `test_record_spawn_first_wins` | Race semantics (different id → no-op) |
| `bash scripts/verify-workflow-paths.sh` | Regression + new script registration |
| Existing handoff tests (dedup, fresh pending, babysit recovery, etc.) | No regressions |

No API/frontend/E2E tests — out of scope.

## Gate script

Before push (execute stage):

```bash
bash scripts/verify-workflow-paths.sh
```

This runs `test-cursor-workflow-handoff.sh` and related workflow tests. No phase gate scripts required.

## Documentation updates

| File | Update |
|------|--------|
| `workflow/cursor-workflow/WORKFLOW.md` | Cross-run dedup + pending-before-POST semantics |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | Mitigation link for concurrent-handoff pattern |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Extra `git fetch` + branch push per spawn adds latency | Acceptable — spawns are infrequent; correctness over speed |
| Pending lock push races (two runs push pending simultaneously) | Second run re-fetches, sees peer pending, defers; first-wins on `agents.<skill>` |
| Stale pending blocks spawn >15 min after crashed job | Existing 15-minute stale window in admission gate; document in WORKFLOW.md |
| `record-handoff-pending` push fails (network) | Treat as defer; retry loop with backoff; do not POST without lock |
| New script missing from `load-scripts.sh` | verify-workflow-paths.sh enforces registration ([#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) lesson) |

**Rollback:** Revert script changes; workflow falls back to pre-#84 behavior (possible duplicate spawns under concurrency but functional handoffs).

## Definition of done

- [ ] `cursor-workflow-refetch-state.sh` created and registered in `load-scripts.sh` + `verify-workflow-paths.sh`
- [ ] Production spawn path: refetch → gate → branch pending → refetch → re-gate → POST
- [ ] Recovery routes through hardened spawn path (no local-only bypass)
- [ ] `record-spawn-on-branch.sh` first-wins when different agent id already recorded
- [ ] Failed record-spawn leaves branch pending; subsequent spawn defers within stale window
- [ ] `test-cursor-workflow-handoff.sh` extended with cases A–F; all pass
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `WORKFLOW.md` and `RETROSPECTIVES.md` updated
- [ ] No changes to application code, database, or frontend
