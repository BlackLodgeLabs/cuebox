# Issue #86: Harden handoff recovery gaps from issue #79 workflow review

## Summary

Close the remaining gaps in `cursor-workflow-handoff-recovery.sh` and the manual `workflow_dispatch` resync path documented in [HANDOFF-HARDENING-NOTES](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md) after the initial recovery script landed via PR [#82](https://github.com/BlackLodgeLabs/cuebox/pull/82).

Forward handoff stages (`spec-ready` through `create-pr-ready`) are mostly covered on sync-only pushes, but **pass-back**, **post-review re-open**, **draft PR linking**, and **manual resync** still leave issues stuck until an operator pushes again or intervenes manually.

## Problem

`cursor-workflow-handoff-recovery.sh` runs on sync-only pushes when `workflow.state.json` did not change in the triggering commit. It spawns the target agent when `agents.<skill>` is null. Four failure modes remain:

1. **`execute-passback` not covered** — Pass-back (`POST /v1/agents/{id}/runs`) only runs when `state_changed=true` and `stage=execute-passback`. If the pass-back transition was missed (e.g. shallow-checkout era, Action failure, or quota deferral), recovery does not retry; the issue stays at `execute-passback` until manual `@cursoragent` intervention.

2. **`execute-ready` after `changes-requested` can spawn the wrong agent** — Recovery uses `prev_stage` to choose execute (`--reopen`) vs demo. On sync-only pushes where `prev_stage` is empty (e.g. recovery-only re-run, unusual checkout state), recovery spawns **demo** instead of **execute** for a post-review scope-change re-open.

3. **`spec-ready` / `plan-ready` recovery skips `ensure_pr_on_branch`** — Normal `handoff()` creates/links a draft PR before spawning. Recovery builds prompts with `pr` from state; if `pr` is null from an earlier failure, prompts reference `Draft PR #null` and downstream agents lack a linked PR.

4. **`workflow_dispatch` resync doesn't run recovery** — The `resync-status` job only syncs labels/comments (and optionally ensures draft PR). A stuck `plan-ready` (or any handoff stage with null target agent) still requires a push to the issue branch to trigger recovery.

**Prerequisite work (landed before this issue):**

| Issue | PR | What landed |
|-------|-----|-------------|
| [#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) | [#87](https://github.com/BlackLodgeLabs/cuebox/pull/87) | `fetch-depth: 0`, `cursor-workflow-push-diff-includes.sh` — reliable `BEFORE_SHA` and `state_changed` |
| [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) | [#88](https://github.com/BlackLodgeLabs/cuebox/pull/88) | Cross-run spawn dedup (refetch, admission gate, branch pending lock) |
| [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) | [#94](https://github.com/BlackLodgeLabs/cuebox/pull/94) | `record-spawn` TOCTOU hardening; recovery `--agents-from-tip` refetch |

This issue builds on those foundations; it does not re-implement them.

## Acceptance criteria

- [ ] Recovery handles `execute-passback` when `passback_to` and `agents.<passback_to>` are set but no pass-back run was started (reuses `handle_passback` logic or equivalent shared helper)
- [ ] On `execute-ready` after `changes-requested`, recovery infers re-open without `prev_stage` (e.g. `agents.execute` exists and `loops.total_runs` was incremented on the branch) → spawn **execute** with `--reopen`, not demo
- [ ] Recovery for `spec-ready` / `plan-ready` calls `ensure_pr_on_branch` (or shared `cursor-workflow-ensure-draft-pr.sh` + `record-pr-on-branch`) before spawning so prompts always reference a valid draft PR number
- [ ] `workflow_dispatch` resync path runs recovery when stage is a stuck handoff stage and target `agents.<skill>` is null (same guards as push-triggered recovery: admission gate, draft PR check for babysit, etc.)
- [ ] Coverage table in `workflow/cursor-workflow/WORKFLOW.md` (or a committed `HANDOFF-HARDENING-NOTES` excerpt on this branch) updated for `execute-passback` and `changes-requested` re-open recovery
- [ ] `scripts/test-cursor-workflow-handoff.sh` covers each new path; `bash scripts/verify-workflow-paths.sh` passes

## Scope

### In scope

- `scripts/cursor-workflow-handoff-recovery.sh` — new cases for `execute-passback`, re-open inference, `ensure_pr_on_branch`
- Pass-back recovery integration (shared with or called from `handle_passback` in `.github/workflows/cursor-workflow-handoff.yml`)
- `workflow_dispatch` / `resync-status` job in `.github/workflows/cursor-workflow-handoff.yml` — invoke recovery after sync
- `scripts/cursor-workflow-load-scripts.sh` registration if new helpers are extracted
- Unit tests in `scripts/test-cursor-workflow-handoff.sh`
- Documentation updates in `workflow/cursor-workflow/WORKFLOW.md`

### Out of scope

- `fetch-depth` / `BEFORE_SHA` changes ([#83](https://github.com/BlackLodgeLabs/cuebox/issues/83) — done)
- Cross-run spawn dedup mechanics ([#84](https://github.com/BlackLodgeLabs/cuebox/issues/84), [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) — done)
- Prompt deduplication refactor (extract shared prompt builder for `handoff()` and recovery) — lower priority follow-up
- `pr_md_changed` hardening (HANDOFF-HARDENING-NOTES gap #7) — separate issue
- GitHub MCP setup for Cloud Agents — documented in issue #79 notes, not this issue

## User flows / API changes

No end-user UI or API changes. Workflow operators should observe:

| Scenario | Before | After |
|----------|--------|-------|
| Demo pass-back missed | Issue stuck at `cursor:execute-passback`; manual comment needed | Recovery retries `POST /v1/agents/{id}/runs` on next push or manual resync |
| Post-review scope change | Sync-only recovery may spawn demo instead of execute | Recovery infers re-open → execute with `--reopen` |
| Early handoff with null `pr` | Recovery prompt says `Draft PR #null` | Recovery ensures draft PR before spawn |
| Stuck mid-flight issue | Operator must no-op push to trigger recovery | Actions → Run workflow → resync unsticks without push |

**Implementation notes for planning:**

1. **`execute-passback` recovery** — Mirror `handle_passback()` preconditions: `stage=execute-passback`, `passback_to` set, `agents.<passback_to>` non-null. Call the same API path (`POST /v1/agents/{id}/runs`) or extract `cursor-workflow-passback-run.sh`. Respect 409 busy deferral. Do not spawn a new agent via `POST /v1/agents`.

2. **Re-open inference** — When `stage=execute-ready`, `prev_stage` empty, and `agents.execute` is set: compare `loops.total_runs` on branch tip vs a heuristic (e.g. incremented since last `complete`, or presence of `changes-requested` in recent git history of state file). Prefer state-based signals over git archaeology. Set `reopen_flag=--reopen` and use execute prompt from `handoff()`.

3. **`ensure_pr_on_branch` in recovery** — For `spec-ready` and `plan-ready`, call the same helpers as `handoff()` before building prompt/spawn. Update local state file `pr` field. In mock tests, stub `cursor-workflow-ensure-draft-pr.sh`.

4. **Resync recovery** — After `cursor-workflow-sync-github-status.sh` in `resync-status` job, call `cursor-workflow-handoff-recovery.sh` with empty `prev_stage` (re-open inference handles changes-requested case). Pass issue number, resolved branch, and fetched state file path.

5. **Dedup** — All recovery spawns must continue through `cursor-workflow-admission-gate.sh` and `--agents-from-tip` refetch (issue #90). Pass-back recovery should not bypass pending-lock semantics.

## Data and integration notes

- **GitHub Actions only** — no database, sync, or external product API changes
- **Cursor Cloud Agents API** — pass-back recovery uses `POST /v1/agents/{id}/runs`; forward recovery uses existing `cursor-workflow-spawn-agent.sh`
- **Scripts loaded from `main`** — new helpers must be registered in `cursor-workflow-load-scripts.sh` (lesson from [#83](https://github.com/BlackLodgeLabs/cuebox/issues/83))
- **Mock testing** — extend `MOCK_CURSOR_API`, `MOCK_CURSOR_POST_CODE`, and fixtures under `scripts/fixtures/` as needed; resync path may need a focused shell test or workflow YAML grep assertion in `verify-workflow-paths.sh`

## Open questions (must be empty before plan-ready)

_None — prerequisites landed; acceptance criteria and scope are explicit._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/86
- Source review: [WORKFLOW-REVIEW.md § Top recommendations #3–5](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md) (issue #79)
- Hardening notes: [HANDOFF-HARDENING-NOTES.md § Gaps #1–3, #8](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md)
- Initial recovery: PR [#82](https://github.com/BlackLodgeLabs/cuebox/pull/82)
- Retrospectives index: [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md)
