# Implementation plan — Issue #86: Harden handoff recovery gaps

## Overview

Close four remaining gaps in the Cursor workflow handoff recovery path so stuck issues self-heal on sync-only pushes **and** manual `workflow_dispatch` resync — without operator no-op pushes or `@cursoragent` comments.

This is **workflow infrastructure** (GitHub Actions + shell scripts), not an application bug. No Docker stack or product UI changes. Implementation extracts shared helpers from inline YAML functions, extends `cursor-workflow-handoff-recovery.sh`, wires recovery into the `resync-status` job, and adds mocked regression tests.

**Current gaps (from spec + code review):**

| Gap | Current behavior | Target |
|-----|------------------|--------|
| `execute-passback` | Recovery exits 0 (not in `case`); pass-back only on `state_changed` | Recovery calls `POST /v1/agents/{id}/runs` on sync-only / resync |
| Re-open after `changes-requested` | Recovery spawns **demo** when `prev_stage` empty | Infer re-open → spawn **execute** with `--reopen` |
| Early handoff + null `pr` | Recovery embeds `Draft PR #null` in prompts | Call `ensure_pr_on_branch` before spawn for `spec-ready` / `plan-ready` |
| Manual resync | Labels/comments only | Run recovery after sync with same guards |

## Root cause

`cursor-workflow-handoff-recovery.sh` only handles forward handoff stages (`spec-ready` … `create-pr-ready`). Pass-back and re-open paths live exclusively in the push-triggered `handoff()` / `handle_passback()` inline functions in `.github/workflows/cursor-workflow-handoff.yml`. When `state_changed=false` (sync-only push) or when an operator runs **Resync** from Actions, recovery never reaches those code paths.

Additionally, `ensure_pr_on_branch()` is defined inline in the push job and never called from recovery, so early-stage recovery can build prompts with `pr=null`.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `scripts/cursor-workflow-passback-run.sh` | **New** | Extract `handle_passback()` API logic for reuse by push job and recovery |
| `scripts/cursor-workflow-ensure-pr-on-branch.sh` | **New** | Extract `ensure_pr_on_branch()` for reuse by push job, recovery, and resync |
| `scripts/cursor-workflow-infer-reopen.sh` | **New** | State/git heuristic for re-open when `prev_stage` empty |
| `scripts/cursor-workflow-handoff-recovery.sh` | **Modify** | Add `execute-passback` case; call ensure-pr + reopen inference |
| `.github/workflows/cursor-workflow-handoff.yml` | **Modify** | Replace inline helpers with script calls; invoke recovery from `resync-status` |
| `scripts/cursor-workflow-load-scripts.sh` | **Modify** | Register new scripts in `HANDOFF_SCRIPTS` |
| `scripts/test-cursor-workflow-handoff.sh` | **Modify** | Add tests for all four gaps |
| `scripts/verify-workflow-paths.sh` | **Modify** | Grep assertions for resync recovery + new script names |
| `scripts/fixtures/cursor-workflow/*.json` | **New** | Fixtures for passback, re-open, null-pr recovery |
| `workflow/cursor-workflow/WORKFLOW.md` | **Modify** | Recovery coverage table for pass-back and re-open |

## Implementation steps

### Step 1 — Extract `cursor-workflow-ensure-pr-on-branch.sh`

Move the inline `ensure_pr_on_branch()` body from the push job into a standalone script:

```bash
# Usage: cursor-workflow-ensure-pr-on-branch.sh <issue> <branch> <state-file>
```

Behavior (unchanged):

1. `cursor-workflow-ensure-draft-pr.sh "$issue" "$branch"` → PR number
2. `cursor-workflow-record-pr-on-branch.sh "$state_file" "$pr" "$branch"`
3. `jq` update local `$state_file` `.pr` field
4. Log `Draft PR #N linked`

Update push job `handoff()` to call this script instead of the inline function. Mock tests can stub `MOCK_ENSURE_DRAFT_PR=99` (add env hook in ensure-draft-pr or wrapper) to avoid `gh` in unit tests.

### Step 2 — Extract `cursor-workflow-passback-run.sh`

Move `handle_passback()` logic from YAML into:

```bash
# Usage: cursor-workflow-passback-run.sh <issue> <branch> <state-file>
# Exit 0 on success/defer (409 busy); exit 1 on missing preconditions
```

Preconditions (mirror current `handle_passback`):

- `stage=execute-passback`
- `passback_to` non-null
- `agents.<passback_to>` non-null (string or `{id}` object)

Behavior:

1. Build pass-back prompt (same text as today)
2. `POST /v1/agents/{agent_id}/runs` when `CURSOR_API_KEY` set; **409 → exit 0** with warning (busy deferral)
3. Fallback: `CURSOR_HANDOFF_GITHUB_TOKEN` → issue comment `@cursoragent …`
4. On success: `HANDOFF_PROGRESS_STAGE=execute-in-progress` + sync status

Push job `handle_passback()` becomes a one-liner calling this script.

**Admission:** Pass-back does **not** use `cursor-workflow-spawn-agent.sh` or `POST /v1/agents`. Recovery should call `passback-run.sh` directly after a lightweight gate check (pending lock / at-cap optional — pass-back reuses existing agent, so skip `skip:agent-already-recorded` semantics).

### Step 3 — Add `cursor-workflow-infer-reopen.sh`

```bash
# Usage: cursor-workflow-infer-reopen.sh <state-file> [prev-stage]
# stdout: reopen | forward
```

Decision tree for `stage=execute-ready`:

| Condition | Result |
|-----------|--------|
| `prev_stage=changes-requested` | `reopen` (existing path) |
| `agents.demo` non-null **and** `agents.execute` non-null | `reopen` — prior cycle completed; execute-ready again implies post-review re-open |
| Git: `workflow.state.json` on branch had `stage=changes-requested` in a parent commit within last 10 commits **and** current stage is `execute-ready` | `reopen` (fallback when demo agent missing from state) |
| Otherwise | `forward` (spawn demo) |

Rationale: first `execute-ready` after execute always has `agents.demo=null`; re-open after `changes-requested` always follows a completed cycle where demo (and usually later agents) were recorded. Git fallback covers edge cases where agent discovery backfill is incomplete.

Update `cursor-workflow-handoff-recovery.sh` `execute-ready` branch:

```bash
reopen_decision=$("$WF/cursor-workflow-infer-reopen.sh" "$STATE_FILE" "$PREV_STAGE")
if [ "$reopen_decision" = "reopen" ]; then
  skill="execute"; reopen_flag="--reopen"; ...
else
  skill="demo"; ...
fi
```

Mirror the same inference in push job `handoff()` for `execute-ready` when `prev_stage` is empty (defense in depth for missed `prev_stage` on state-changed pushes too).

### Step 4 — Extend `cursor-workflow-handoff-recovery.sh`

**4a. `execute-passback` case** (before the `*)` default):

```bash
execute-passback)
  "$WF/cursor-workflow-passback-run.sh" "$ISSUE" "$BRANCH" "$STATE_FILE"
  exit $?
  ;;
```

No `spawn-agent.sh`; no new agent id.

**4b. `ensure_pr_on_branch` for early stages** — after skill/progress_stage are set, before admission gate:

```bash
if [ "$stage" = "spec-ready" ] || [ "$stage" = "plan-ready" ]; then
  if [ -z "$pr" ] || [ "$pr" = "null" ]; then
    "$WF/cursor-workflow-ensure-pr-on-branch.sh" "$ISSUE" "$BRANCH" "$STATE_FILE"
    pr=$(jq -r '.pr' "$STATE_FILE")
    # Rebuild prompt with updated $pr
  fi
fi
```

For `spec-ready`, always ensure PR (matching `handoff()` which always calls ensure). For `plan-ready`, only when null (matching `handoff()` conditional).

**4c. Re-open inference** — integrate Step 3 for `execute-ready`.

**4d. Preserve existing guards** — `--agents-from-tip` refetch, admission gate, babysit draft-PR check unchanged.

### Step 5 — Wire recovery into `resync-status` job

After `cursor-workflow-sync-github-status.sh` in the `resync-status` step (`.github/workflows/cursor-workflow-handoff.yml` ~line 405):

```bash
"$WF/cursor-workflow-handoff-recovery.sh" "$ISSUE" "$BRANCH" /tmp/workflow.state.json "" || true
```

Empty `prev_stage` is intentional; `infer-reopen.sh` handles the `changes-requested` → `execute-ready` case.

Optional: pass `GITHUB_REPOSITORY` (already in env). No `state_changed` check — recovery is the point of manual resync.

### Step 6 — Register scripts in `cursor-workflow-load-scripts.sh`

Add to `HANDOFF_SCRIPTS`:

- `cursor-workflow-passback-run.sh`
- `cursor-workflow-ensure-pr-on-branch.sh`
- `cursor-workflow-infer-reopen.sh`

### Step 7 — Tests (`scripts/test-cursor-workflow-handoff.sh`)

| Test name | Fixture / setup | Assert |
|-----------|-----------------|--------|
| `test_passback_recovery` | `stage=execute-passback`, `passback_to=execute`, `agents.execute=bc-exec`; `MOCK_CURSOR_API=1`, mock `/runs` endpoint | Recovery logs pass-back run started; no `POST /v1/agents` create |
| `test_passback_recovery_409` | Same + `MOCK_CURSOR_POST_CODE=409` on runs | Exit 0, defer message, no spawn |
| `test_reopen_inference_agents_demo` | `stage=execute-ready`, `agents.execute` + `agents.demo` set, empty prev_stage | Recovery spawns **execute** with `--reopen`, not demo |
| `test_reopen_inference_prev_stage` | `prev_stage=changes-requested` | Same (existing path, regression) |
| `test_execute_ready_forward` | `stage=execute-ready`, `agents.execute` set, `agents.demo` null | Recovery spawns **demo** |
| `test_spec_ready_ensure_pr` | `stage=spec-ready`, `pr=null`, `MOCK_ENSURE_DRAFT_PR=99` | Recovery calls ensure; prompt contains `PR #99`; `pr` updated in state |
| `test_plan_ready_ensure_pr` | `stage=plan-ready`, `pr=null` | Same |
| `test_resync_recovery_yaml` | Grep-only in `verify-workflow-paths.sh` | `resync-status` step invokes `handoff-recovery.sh` |

Add fixtures under `scripts/fixtures/cursor-workflow/`:

- `state-passback-recovery.json`
- `state-reopen-recovery.json`
- `state-spec-ready-null-pr.json`

Extend mock spawn script to count `/runs` POSTs separately from `/agents` POSTs if not already supported (`MOCK_CURSOR_POST_COUNT_FILE` or new `MOCK_CURSOR_RUNS_COUNT_FILE`).

### Step 8 — Documentation (`workflow/cursor-workflow/WORKFLOW.md`)

Add a **Handoff recovery coverage** subsection under “Handoff recovery”:

| Stage | Recovery action | Notes |
|-------|-----------------|-------|
| `spec-ready` | Spawn planning; **ensure draft PR** | |
| `plan-ready` | Spawn execute; **ensure draft PR if null** | |
| `execute-ready` | Spawn demo **or** execute (`--reopen`) | Re-open inferred via `infer-reopen.sh` |
| `demo-ready` | Spawn create-pr | |
| `create-pr-ready` | Spawn babysit-pr (draft PR check) | |
| `execute-passback` | **`POST /v1/agents/{id}/runs`** | No new agent |
| Manual resync | Same as above | After label/comment sync |

Update “Babysit recovery” paragraph to mention pass-back and resync paths.

## Tests required

| Acceptance criterion | Test |
|---------------------|------|
| Pass-back recovery | `test_passback_recovery`, `test_passback_recovery_409` |
| Re-open without `prev_stage` | `test_reopen_inference_agents_demo`, `test_reopen_inference_prev_stage` |
| Ensure PR on early recovery | `test_spec_ready_ensure_pr`, `test_plan_ready_ensure_pr` |
| Resync invokes recovery | `verify-workflow-paths.sh` grep + optional shell integration |
| Regression | Full `bash scripts/test-cursor-workflow-handoff.sh`; `bash scripts/verify-workflow-paths.sh` |

No API/frontend unit tests — out of scope.

## Gate script

```bash
bash scripts/verify-workflow-paths.sh
bash scripts/test-cursor-workflow-handoff.sh
```

`verify-workflow-paths.sh` is the primary gate (explicit in acceptance criteria). Run `test-cursor-workflow-handoff.sh` as the functional test suite for workflow scripts. No phase gate (`verify-phase*-gates.sh`) applies — workflow-only change.

## Documentation updates

| File | Update |
|------|--------|
| `workflow/cursor-workflow/WORKFLOW.md` | Recovery coverage table; resync recovery note |
| `workflow/cursor-workflow/SETUP.md` | Optional one-liner under manual resync: “recovery runs automatically” |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Re-open heuristic false positive (demo → execute) | Require `agents.demo` non-null; git fallback only when demo missing |
| Re-open false negative | Git log fallback for `changes-requested` in recent state commits |
| Pass-back recovery duplicates run | 409 busy handling; no `POST /v1/agents` create |
| Scripts on issue branch ahead of `main` | `load-scripts.sh` copies from `origin/main` in Actions until merge; new scripts must land on branch and merge to `main` for production Actions (document in PR) |
| `ensure_pr` needs `gh` / token | Resync job already has `GH_TOKEN`; recovery skips ensure when mock env set |

Rollback: revert PR; recovery returns to pre-#86 behavior (gaps reopen but no regression to existing forward recovery).

## Definition of done

- [ ] `cursor-workflow-passback-run.sh`, `cursor-workflow-ensure-pr-on-branch.sh`, `cursor-workflow-infer-reopen.sh` exist and are registered in `load-scripts.sh`
- [ ] `cursor-workflow-handoff-recovery.sh` handles `execute-passback`, ensure-pr, and reopen inference
- [ ] Push job YAML uses extracted scripts (no duplicated passback/ensure logic)
- [ ] `resync-status` job calls recovery after sync
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` passes (all new tests green)
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `workflow/cursor-workflow/WORKFLOW.md` coverage table updated
- [ ] All acceptance criteria in `SPEC.md` satisfied
