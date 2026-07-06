# Issue #70: Harden cursor workflow from issue #28 review (handoff dedup, quota, babysit recovery)

## Summary

Harden the Cursor multi-agent issue workflow so handoffs are **deduplicated**, **quota-safe**, and **self-healing** when a forward stage is missed. Builds on [#62 / PR #63](https://github.com/BlackLodgeLabs/cuebox/pull/63) (state merge, pass-back, `changes-requested`) and addresses the failure mode documented in [issue #28 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/WORKFLOW-REVIEW.md) where PR [#67](https://github.com/BlackLodgeLabs/cuebox/pull/67) reached `create-pr-ready` but **babysit never ran** due to over-spawning, Cursor API 400 (plan limit), and sync-only pushes after a lost handoff.

This is **workflow scaffolding only** — no Cuebox application (API/frontend/DB) changes.

## Problem

Issue #28 ran spec through create-pr with strong feature work, but the pipeline stalled:

1. **Over-spawning** — Five parallel demo agent side-branches on one issue; duplicate create-pr handoffs wasted quota and confused audit trails.
2. **Cursor API 400** — Concurrent Cloud Agent plan limit hit; handoff Action exited 1 with no recovery path.
3. **Missed babysit handoff** — First `create-pr-ready` transition was lost; later pushes were sync-only because `stage` did not change.
4. **State regression on merge** — A merge from an agent side-branch regressed `create-pr-ready` → `demo-ready` because the merge helper did not enforce monotonic stage ordering.
5. **Progress stages skipped** — No `execute-in-progress` / `create-pr-in-progress` in commits; no gate evidence line in `PR.md`.

Without these fixes, the next feature issue repeats wasted agent cycles, red failed Actions runs at quota, and branches stuck at `create-pr-ready` with draft PRs that never reach babysit.

## Acceptance criteria

### 1. Handoff deduplication and babysit recovery

- [ ] Before `POST /v1/agents`, skip spawn when `agents.<skill>` is already non-null for the target skill, unless the path is explicit pass-back (`execute-passback` + `passback_to`) or re-open (`changes-requested` → `execute-ready`).
- [ ] **`handoff_pending`** lock in `workflow.state.json` set immediately before `POST /v1/agents`; cleared on successful agent record, documented timeout, or deferral (see §2).
- [ ] **Babysit recovery:** when `stage=create-pr-ready`, linked PR is draft, and `agents.babysit-pr` is null → spawn babysit even when `workflow.state.json` did not change `stage` on this push (idempotent next-skill recovery).
- [ ] No new `babysit-queued` stage (aligns with [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68) v2 direction).

### 2. Global 8-agent cap + admission gate

- [ ] **Hard rule:** never more than **8** concurrent `ACTIVE` Cloud Agents attributable to this repository’s workflow handoffs.
- [ ] Admission gate before every `POST /v1/agents`: per-issue `handoff_pending` lock + global active count; if at cap, **defer** (do not `exit 1`) with retry/backoff and a single issue comment explaining deferral.
- [ ] On Cursor API 400 (quota / plan limit), log warning, defer/retry — not fatal Action failure.
- [ ] Optional fallback to `CURSOR_HANDOFF_GITHUB_TOKEN` `@cursoragent` comment documented when defer/retry exhausts.
- [ ] Document cap and recovery in [WORKFLOW.md](../../cursor-workflow/WORKFLOW.md) and [SETUP.md](../../cursor-workflow/SETUP.md).

### 3. Merge helper on agent-branch merges

- [ ] Skills/docs: before merging `cursor/issue-NNN-pr-MMM-*-agent-*` (or any `*-agent-*` side branch) into `cursor/issue-NNN-*`, always run [`cursor-workflow-merge-state.sh`](../../../scripts/cursor-workflow-merge-state.sh).
- [ ] Merge helper never regresses `stage`, `agents`, or `loops` to lower or stale values from side branches (monotonic stage rank; agents/loops use max / non-null-wins rules).
- [ ] `verify-workflow-paths.sh` validates skills reference merge helper and documents agent-branch merge rule.

### 4. Demo serialization

- [ ] `handoff_pending` + dedup prevents multiple demo (or same forward skill) agents for one issue.
- [ ] Demo skill unchanged in intent: one authoritative `demo-notes.md` per run.

### 5. Gate evidence and progress stages (skills/templates only)

- [ ] Execute, create-pr, babysit skills require committing matching `*-in-progress` before substantive work (reinforce #62 rule where gaps remain).
- [ ] [PR template](../../cursor-workflow/templates/PR.md) and create-pr skill: include a **Gate evidence** section/line (e.g. `Phase N gate exit 0 at <short-sha>`).
- [ ] **No new CI guard** on `cursor/issue-*` for progress stages in v1 — defer to [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68).

### Validation

- [ ] Extend [`scripts/verify-workflow-paths.sh`](../../../scripts/verify-workflow-paths.sh) for `handoff_pending`, handoff/admission script references, docs, and skill coverage.
- [ ] Add focused **shell tests** for handoff/admission logic with mocked API responses (at-cap, 400, dedup, babysit recovery) — no live Cloud Agent burn required for CI.

## Scope

### In scope

- [`.github/workflows/cursor-workflow-handoff.yml`](../../../.github/workflows/cursor-workflow-handoff.yml)
- New/updated scripts under [`scripts/cursor-workflow-*.sh`](../../../scripts/) (admission gate, active-agent count, handoff spawn wrapper, tests)
- [`workflow.state.json` template](../../cursor-workflow/templates/workflow.state.json) — additive `handoff_pending`
- Skills: `.cursor/skills/{execute,create-pr,babysit-pr,demo,planning}/SKILL.md` (and merge-helper note in `review-and-spec` if agent-branch guidance added)
- Docs: `WORKFLOW.md`, `SETUP.md`, `AGENTS.md` cross-links
- Regression: `verify-workflow-paths.sh` + `scripts/test-cursor-workflow-handoff.sh` (or equivalent)

### Out of scope

- Cuebox application code (API, frontend, DB)
- Recovering PR #67 / issue #28 branch to `complete` (manual resync or separate human action)
- New `babysit-queued` stage or full v2 pipeline ([#68](https://github.com/BlackLodgeLabs/cuebox/issues/68))
- v1 CI guard for production diffs vs workflow stage
- Cursor plan upgrade (ops decision; cap enforced in code)
- Retroactive fix to issue #28 branch state

### Deployment note

GitHub Actions loads workflow helper scripts from **`origin/main`**. New admission/recovery behavior **does not take effect for any issue branch until this PR merges to `main`**.

## User flows / API changes

**No Cuebox user-facing UI or public API changes.**

### Issue author / reviewer

| Flow | Behavior |
|------|----------|
| Normal pipeline | Fewer duplicate agent spawns; status comment reflects accurate stage and agent links |
| At 8-agent cap | One clear deferral comment on the issue (with retry schedule), not a red failed Actions run |
| Stuck `create-pr-ready` | Draft PR + no `agents.babysit-pr` → next push self-heals via babysit recovery spawn |

### Cloud agents

| Flow | Behavior |
|------|----------|
| State commit | Run merge helper before committing `workflow.state.json` |
| Agent side-branch merge | Before merging `*-agent-*` into main issue branch, run merge helper on `workflow.state.json` so stage/agents/loops do not regress |
| Execute / create-pr / babysit | Commit `*-in-progress` before substantive work; create-pr records gate evidence line in `PR.md` |

### GitHub Actions (handoff workflow)

| Trigger | Behavior |
|---------|----------|
| Handoff stage transition | Admission gate → dedup check → set `handoff_pending` → `POST /v1/agents` → record agent → clear `handoff_pending` |
| `agents.<skill>` already set | Skip spawn (log + sync only), except pass-back / changes-requested paths |
| `handoff_pending` set and fresh | Skip duplicate spawn for same issue/skill |
| At global cap or API 400 | Defer with exponential backoff inside Action; post issue comment once per deferral window; do not `exit 1` |
| Push with unchanged `stage` | If babysit recovery predicate matches → spawn babysit |
| Defer/retry exhausted | Fall back to `CURSOR_HANDOFF_GITHUB_TOKEN` `@cursoragent` comment (documented) |

### Cursor Cloud API

- **List/count:** `GET /v1/agents?limit=100` (paginate via `nextCursor`); count items with `status == "ACTIVE"` whose latest run targets `github.com/<owner>/<repo>` (same repo filter as `cursor-workflow-discover-agents.sh`).
- **Create (forward):** `POST /v1/agents` — gated by admission + dedup.
- **Continue (pass-back):** `POST /v1/agents/{id}/runs` — unchanged; not subject to dedup skip for the same skill id when `passback_to` is set.

## Data and integration notes

### `workflow.state.json` schema (additive)

| Field | Type | Purpose |
|-------|------|---------|
| `handoff_pending` | `object \| null` | Per-issue spawn lock; see below |
| `handoff_pending.skill` | `string` | Target skill key being spawned (`planning`, `demo`, …) |
| `handoff_pending.started_at` | `string` (ISO8601) | Lock acquisition time |
| `handoff_pending.attempt` | `number` | Defer/retry attempt counter for this handoff |

Existing fields unchanged. Template and `verify-workflow-paths.sh` updated to include `handoff_pending` (nullable object).

#### `handoff_pending` semantics

1. Set `{ skill, started_at, attempt: 0 }` immediately before `POST /v1/agents`.
2. **Clear** on: successful agent id recorded in `agents.<skill>`; explicit deferral commit that increments `attempt` and clears lock for retry; lock age &gt; **15 minutes** (stale lock recovery — treat as clear and allow retry).
3. While lock is set and not stale, another handoff for the same issue/skill **must not** call `POST /v1/agents`.
4. Lock is per-issue in state file; global cap is enforced separately via API poll.

### Global active-agent count (resolved design)

New script `scripts/cursor-workflow-count-active-agents.sh`:

```bash
# Exit 0; prints integer count to stdout
# Requires CURSOR_API_KEY, GITHUB_REPOSITORY
# Paginate GET /v1/agents; count status=="ACTIVE" where latest run branch repoUrl matches github.com/${GITHUB_REPOSITORY}
```

Admission gate (`scripts/cursor-workflow-admission-gate.sh`):

- Input: issue number, target skill, state file path
- Returns exit 0 + stdout `proceed` when spawn allowed
- Returns exit 0 + stdout `defer:<reason>` when at cap, `handoff_pending` blocks, or dedup skip
- Returns exit 0 + stdout `skip:<reason>` when `agents.<skill>` already set (non pass-back path)
- Never returns non-zero for quota/cap (caller handles defer without failing the Action job)

**Cap constant:** `CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS=8` (env override for tests).

### Handoff spawn wrapper

Extract spawn logic from inline YAML into `scripts/cursor-workflow-spawn-agent.sh`:

1. Run admission gate
2. If `defer` → schedule retry (Action `sleep` backoff: 30s, 60s, 120s, max 3 attempts in one job) or exit 0 with warning for a follow-up push/workflow_dispatch
3. If `skip` → log and return 0
4. Set `handoff_pending` on branch via `cursor-workflow-record-handoff-pending.sh` (new)
5. `POST /v1/agents`
6. On 2xx → record agent, clear `handoff_pending`
7. On 400 → log, clear or retain lock per stale rules, return `defer` not failure
8. Post deferral comment via existing sync script or dedicated helper (once per issue per 30 minutes)

### Babysit recovery predicate

After the existing “sync only” path (state unchanged or stage unchanged), evaluate:

```text
stage == "create-pr-ready"
AND agents.babysit-pr is null
AND pr is non-null
AND linked PR is draft (gh pr view --json isDraft)
AND handoff_pending is null or stale
AND admission gate allows proceed
→ spawn babysit-pr (same prompt as forward handoff)
```

This runs **even when** `workflow.state.json` did not change in the push (extend the Action early-exit logic).

### Stage monotonicity (merge helper)

Add stage rank map to `cursor-workflow-merge-state.sh` (or shared `cursor-workflow-stage-rank.sh`):

| Rank | Stages |
|------|--------|
| 0 | `spec-needs-info`, `plan-needs-info` |
| 10 | `spec-in-progress`, `plan-in-progress` |
| 20 | `spec-ready`, `plan-ready` |
| 30 | `execute-in-progress`, `execute-passback` |
| 40 | `execute-ready`, `changes-requested` |
| 50 | `demo-in-progress` |
| 60 | `demo-ready` |
| 70 | `create-pr-in-progress` |
| 80 | `create-pr-ready` |
| 90 | `babysit-in-progress` |
| 100 | `complete`, `blocked` |

Merge rule: `stage = stage_with_higher_rank(remote.stage, local.stage)` unless local explicitly sets a forward handoff stage that is ≥ remote (agents merging side branches typically only touch code; their stale `demo-ready` must not beat remote `create-pr-ready`).

`agents`: keep existing non-null-wins per key; never overwrite non-null remote with null from side branch.

`loops`: keep existing per-counter **max**.

### PR template gate evidence

Add to `workflow/cursor-workflow/templates/PR.md`:

```markdown
## Gate evidence

- [ ] `Phase N gate exit 0 at <short-sha>` (feature issues) or `Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>` (workflow-only)
```

Create-pr skill: populate this section from execute/demo gate runs when drafting `PR.md`.

### Shell tests (CI-safe)

New `scripts/test-cursor-workflow-handoff.sh` invoked from `verify-workflow-paths.sh` or standalone in API CI:

| Case | Mock | Expected |
|------|------|----------|
| Dedup | `agents.demo` set | `skip`, no POST |
| At cap | count script returns 8 | `defer`, no POST |
| API 400 | curl mock returns 400 | defer, Action exit 0 |
| Babysit recovery | state `create-pr-ready`, no babysit agent, draft PR | spawn babysit |
| `handoff_pending` fresh | lock &lt; 15m | skip POST |
| Stage merge | local `demo-ready`, remote `create-pr-ready` | merged `create-pr-ready` |

Use env vars `MOCK_CURSOR_API=1`, `MOCK_ACTIVE_AGENT_COUNT`, fixture JSON files under `scripts/fixtures/cursor-workflow/`.

### Labels

No new labels required. Babysit recovery uses existing `cursor:create-pr-ready` until spawn sets `babysit-in-progress` via status sync.

## Open questions (must be empty before plan-ready)

_None — issue body plus defaults above (API-based active count, `handoff_pending` shape, 15m stale lock, 8 cap, babysit recovery predicate, stage rank table) are sufficient for planning._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/70
- Workflow review (source): [issue #28 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/WORKFLOW-REVIEW.md)
- Prior hardening: [#62 / PR #63](https://github.com/BlackLodgeLabs/cuebox/pull/63)
- v2 design north star: [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68)
- Stuck example: [PR #67](https://github.com/BlackLodgeLabs/cuebox/pull/67) (issue #28)
- Workflow docs: [WORKFLOW.md](../../cursor-workflow/WORKFLOW.md), [SETUP.md](../../cursor-workflow/SETUP.md)
- Cursor API: https://cursor.com/docs/cloud-agent/api/endpoints
