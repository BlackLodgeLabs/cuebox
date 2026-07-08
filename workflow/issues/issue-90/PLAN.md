# Implementation plan — issue #90

Harden `record-spawn-on-branch` TOCTOU, recovery branch-tip refetch, and git-fidelity integration tests.

## Overview

Issue [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / PR [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88) added cross-run refetch, branch `handoff_pending` locks, and first-wins spawn recording. During PR #88 dogfood at `create-pr-ready`, three babysit agents were still POSTed because:

1. **`record-spawn-on-branch.sh` TOCTOU** — two concurrent runs both read `agents.<skill>=null`, then the later push overwrote the peer's agent id (`0ddb0c7` over `f6b3be8`).
2. **Recovery checkout rewind** — the handoff Action seeds `/tmp/workflow.state.json` from `AFTER_SHA` (trigger commit). Discovery refresh from branch tip is skipped when `stage` rank ≥ `plan-in-progress`. Recovery then sees `agents.<skill>=null` locally even though branch tip already recorded the spawn.
3. **Test gap** — cases A–F in `test-cursor-workflow-handoff.sh` use JSON overlay hooks (`CURSOR_WORKFLOW_REFETCH_REMOTE_JSON` / `CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE`) and `CURSOR_WORKFLOW_PENDING_DRY_RUN=1`; they do not exercise real `git fetch` / `git push` races.

This is **workflow infrastructure** (not an application bug). No bug reproduction against the Docker stack is required.

## Root cause

| Gap | Location | Mechanism |
|-----|----------|-----------|
| Record-spawn TOCTOU | `cursor-workflow-record-spawn-on-branch.sh` L64–99 | Single fetch/checkout/read gate; concurrent writer can land between read and jq write |
| Recovery rewind | `cursor-workflow-handoff.yml` L100 + `cursor-workflow-handoff-recovery.sh` | State file copied from trigger SHA; branch-tip agent records invisible when discovery skip applies |
| Test fidelity | `test-cursor-workflow-handoff.sh` | Mock overlays bypass production git paths in `record-handoff-pending` / `record-spawn-on-branch` |

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `scripts/cursor-workflow-record-spawn-on-branch.sh` | Modify | Pre-write refetch + abort on peer agent id |
| `scripts/cursor-workflow-handoff-recovery.sh` | Modify | Branch-tip refetch before spawn decision; never trust trigger-SHA local agents alone |
| `scripts/cursor-workflow-refetch-state.sh` | Modify (optional) | Explicit branch-tip mode or stricter empty-remote handling when git is available |
| `scripts/cursor-workflow-spawn-agent.sh` | Modify (only if needed) | Align refetch placement if recovery delegates here; avoid duplicate fetch |
| `scripts/test-cursor-workflow-handoff.sh` | Modify | Cases G–I: real temp bare-remote git fixtures |
| `scripts/fixtures/cursor-workflow/` | Add | Seed state JSON for git-remote tests if not inline |
| `workflow/cursor-workflow/WORKFLOW.md` | Modify | Document pre-write refetch and recovery branch-tip semantics |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | Modify | Link pattern rows to issue #90 / PR #94 mitigation |

**Out of scope per spec:** `.github/workflows/cursor-workflow-handoff.yml` (recovery script hardening should suffice), application code, [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) recovery gaps.

## Implementation steps

### Step 1 — Pre-write refetch in `record-spawn-on-branch.sh`

In the production path (after L59), keep the existing initial fetch/checkout/read gate, then **immediately before the jq write** (currently L84):

```bash
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
CURRENT=$(jq -r --arg k "$AGENT_KEY" '...' "$REL_PATH")
# if peer id set and != AGENT_ID → log + exit 0
```

Behavior:

- If `agents.<skill>` is set to a **different** id → log peer message, **exit 0** (no overwrite).
- If set to same id and pending cleared → exit 0 (idempotent).
- Only write when slot is empty or matches our id.

**Optional hardening:** on `git push` non-fast-forward, retry fetch/checkout/read once before giving up (log and exit 0). Primary fix is abort-before-overwrite, not winning the race.

### Step 2 — Branch-tip refetch in recovery

In `cursor-workflow-handoff-recovery.sh`, before `cursor-workflow-admission-gate.sh` (currently L86–91):

1. `git fetch origin "$BRANCH"` (force fresh refs).
2. Call `cursor-workflow-refetch-state.sh` (already present).
3. **Verify** admission reads branch-tip agents: if `refetch-state` still leaves `agents.<skill>` null but `git show "origin/${BRANCH}:${REL_PATH}"` has a value, overlay agents from branch tip (or strengthen `refetch-state` to treat remote as authoritative for `agents` when `git show` succeeds).

Preferred approach: extend `refetch-state.sh` with optional `--agents-from-tip` (or make existing merge always prefer remote agents when `git cat-file -e origin/branch:path` succeeds after fetch). Recovery always passes this flag.

Do **not** spawn when branch tip already records the target skill, even if `/tmp/workflow.state.json` (trigger SHA) lacks it.

### Step 3 — Tighten `refetch-state.sh` (if needed)

Review whether empty `REMOTE_JSON` after a failed fetch allows local null agents to pass admission. When git is available and `origin/$BRANCH:$REL_PATH` exists:

- Always populate `REMOTE_JSON` from `git show` after fetch.
- If fetch fails, log warning; recovery/spawn should **defer** rather than proceed with stale local agents (fail closed).

Keep test hooks (`CURSOR_WORKFLOW_REFETCH_REMOTE_JSON`, `CURSOR_WORKFLOW_REFETCH_REMOTE_STATE_FILE`) unchanged for cases A–F.

### Step 4 — Git-remote integration tests (cases G–I)

Add a helper (e.g. `scripts/fixtures/cursor-workflow/git-remote-test-lib.sh` or inline in test file) that:

1. Creates a temp bare remote and clone with `workflow/issues/issue-90/workflow.state.json` on branch `cursor/issue-90-test`.
2. Configures `git` user.name/email in the clone.
3. Unsets `CURSOR_WORKFLOW_PENDING_DRY_RUN` and `MOCK_CURSOR_API` for these cases only.

**Case G — parallel pending + spawn race (real git):**

- Seed state at `create-pr-ready`, `agents.babysit-pr=null`, `handoff_pending=null`.
- Run two background subshells in the clone, each: `record-handoff-pending set` → mock POST (`MOCK_CURSOR_API=1`) → `record-spawn-on-branch`.
- Assert exactly **one** winning `agents.babysit-pr` id at `origin/cursor/issue-90-test` tip; loser exits 2 or 0 without overwrite; `MOCK_CURSOR_POST_COUNT_FILE` = 1.

**Case H — record-spawn TOCTOU (real git):**

- Push commit A with `agents.execute=bc-first`.
- Two parallel `record-spawn-on-branch` calls with `bc-second` and `bc-third`.
- Assert branch tip preserves `bc-first` (or first writer wins); second logs peer message.

**Case I — recovery checkout rewind (real git):**

- Push commit A: `create-pr-ready`, `agents.babysit-pr=null`.
- Push commit B (branch tip): `agents.babysit-pr=bc-remote-winner`.
- In clone, checkout A so local `workflow.state.json` lacks agent.
- `git fetch` so `origin/branch` sees B.
- Invoke `cursor-workflow-handoff-recovery.sh` with local state at A.
- Assert `skip:agent-already-recorded` / deferred, **0 POST**.

Register new cases at bottom of `test-cursor-workflow-handoff.sh`; keep cases A–F passing.

### Step 5 — Documentation

**`WORKFLOW.md`** — under "Cross-run spawn dedup (#84)" / `record-spawn-on-branch`:

- Document pre-write refetch in `record-spawn-on-branch.sh`.
- Document recovery always refetches branch tip before admission (not trigger SHA).

**`RETROSPECTIVES.md`** — update pattern rows:

| Pattern | Mitigation link |
|---------|-----------------|
| `record-spawn` git race overwrites peer agent | [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) / PR #94 |
| Handoff recovery spawns after checkout forced-update hides branch-tip spawn record | [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) / PR #94 |

## Tests required

| Test | Type | Acceptance criterion |
|------|------|----------------------|
| Case G: parallel pending + spawn (real git) | Integration | Exactly one POST; one agent id at branch tip |
| Case H: record-spawn TOCTOU (real git) | Integration | Peer id not overwritten |
| Case I: recovery rewind (real git) | Integration | Recovery skips spawn when tip has agent |
| Cases A–F regression | Unit/mock | Existing #84 behavior unchanged |
| `bash scripts/verify-workflow-paths.sh` | Gate | Schema + script registration intact |

No `api-ci`, `frontend-ci`, or Docker stack tests required.

## Gate script

Before push (execute stage):

```bash
bash scripts/verify-workflow-paths.sh
bash scripts/test-cursor-workflow-handoff.sh
```

Use `run-gate-scripts` skill if additional workflow regressions are needed; Phase 8+ gates are not required for this issue.

## Documentation updates

- `workflow/cursor-workflow/WORKFLOW.md` — pre-write refetch + recovery branch-tip semantics
- `workflow/cursor-workflow/RETROSPECTIVES.md` — mitigation links for two pattern rows

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Extra `git fetch` latency on every spawn record | Acceptable; spawn is infrequent; correctness > speed |
| Over-aggressive defer when fetch fails | Log clearly; defer rather than duplicate POST |
| Git-remote tests flaky on slow CI | Use `wait` on PIDs; modest sleep between parallel starts; retry fetch in test setup |
| Rollback | Revert PR; no data migration; workflow returns to #84 behavior |

## Definition of done

- [ ] `record-spawn-on-branch.sh` re-fetches before jq write; aborts on peer agent id (exit 0)
- [ ] Recovery refetches branch tip; does not spawn when tip records target skill
- [ ] Cases G–I pass with real temp git remotes
- [ ] Cases A–F and existing tests still pass
- [ ] `verify-workflow-paths.sh` passes
- [ ] `WORKFLOW.md` and `RETROSPECTIVES.md` updated
- [ ] No application code changes
- [ ] Commits pushed to `cursor/issue-90-harden-record-spawn-toctou` (via draft PR #94)
