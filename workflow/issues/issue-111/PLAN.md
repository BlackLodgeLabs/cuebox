# Issue #111 — Implementation plan

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/111  
**Branch:** `cursor/issue-111-workflow-human-notifications`  
**Draft PR:** #114  
**Prerequisite:** [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) merged (PR #113) — verified on branch base `60da6ac`.

## Overview

Replace unreliable PAT `@cursoragent` fallback with Actions-owned **stalled** notifications, extend **complete** notifications to @mention both repo owner and issue author via a shared resolver, and update skills/docs so agents distinguish **genuine product questions** (MCP issue comment) from **step failures** (pass-back only).

This is workflow infrastructure only — no application UI, API, or database changes. Prerequisite #110 already ensures failed spawn/pass-back paths do not sync false `*-in-progress` labels; this issue replaces PAT comments with human-visible stalled alerts while preserving that behavior.

## Classification

**Feature / workflow infrastructure** — not an application bug. Bug reproduction skipped per planning skill.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `scripts/cursor-workflow-resolve-notify-targets.sh` | **New** | Shared @mention resolution for Actions notifiers |
| `scripts/cursor-workflow-notify-stalled.sh` | **New** | Terminal failure human alert with idempotency |
| `scripts/cursor-workflow-notify-complete.sh` | Modify | Use resolver; dual @mentions |
| `scripts/cursor-workflow-spawn-agent.sh` | Modify | Remove `pat_fallback()`; call stalled notifier |
| `scripts/cursor-workflow-passback-run.sh` | Modify | Stalled notifier on API failure; remove PAT block |
| `scripts/cursor-workflow-load-scripts.sh` | Modify | Register new scripts in `HANDOFF_SCRIPTS` |
| `scripts/verify-workflow-paths.sh` | Modify | Register scripts; add doc keyword checks |
| `scripts/test-cursor-workflow-handoff.sh` | Modify | New resolver/stalled/complete tests; rename PAT tests |
| `.cursor/skills/review-and-spec/SKILL.md` | Modify | Genuine-question template with @mentions + agent link |
| `.cursor/skills/planning/SKILL.md` | Modify | Same for plan questions |
| `.cursor/skills/demo/SKILL.md` | Modify | Explicit pass-back rules; no human questions |
| `.cursor/skills/execute/SKILL.md` | Modify | No genuine questions; defects via demo pass-back |
| `.cursor/skills/babysit-pr/SKILL.md` | Modify | Complete notification owned by Actions; blocked via MCP |
| `workflow/cursor-workflow/WORKFLOW.md` | Modify | Four communication scenarios; deprecate PAT fallback |
| `workflow/cursor-workflow/SETUP.md` | Modify | Secrets table; stalled notifier troubleshooting |
| `workflow/cursor-workflow/MCP-GITHUB.md` | Modify | `resolve-notify-targets.sh` as @mention source of truth |
| `AGENTS.md` | Modify | Short pointer to communication rules |

## Implementation steps

### Step 0 — Branch hygiene

1. Confirm branch is based on `main` with #110 merged (already true at `60da6ac`).
2. Commit `execute-in-progress` state before code (execute agent).

### Step 1 — `cursor-workflow-resolve-notify-targets.sh`

Create script with contract from SPEC:

```bash
cursor-workflow-resolve-notify-targets.sh <issue-number> [--json]
```

**Behavior:**

- `GITHUB_REPOSITORY` required; `GH_TOKEN` / `GITHUB_TOKEN` for `gh`.
- Issue author: `gh issue view <n> --json author -q '.author.login'`.
- Repo owner: `gh api repos/{owner}/{repo} --jq '.owner.login'`.
- Default output (sourced or eval-friendly):
  - `AUTHOR=<login>`
  - `OWNER=<login>` (empty if resolution fails)
  - `MENTIONS=@author` when author == owner; `@author @owner` when different.
- `--json`: `{"author":"…","owner":"…","mentions":"@…"}`.
- Exit non-zero if author missing; warn to stderr and emit author-only `MENTIONS` if owner fails.

**Commit:** `feat(workflow): add resolve-notify-targets helper (#111)`

### Step 2 — `cursor-workflow-notify-stalled.sh`

Create script:

```bash
cursor-workflow-notify-stalled.sh <state-file> <reason> [expected-skill]
```

**Behavior:**

- Read `issue`, `branch`, `stage`, `pr`, `agents` from state file.
- Idempotency: scan issue comments for `<!-- cursor-workflow-stalled-notify:v1 -->`; skip if present.
- Source @mentions via `resolve-notify-targets.sh`.
- Map `reason` to human-readable text + recovery steps per SPEC table (`execute-active`, `at-cap`, `api-400`, `pending-lock`, `missing-api-key`, `passback-failed`, plus pass-through for defer reasons).
- Body includes: @mentions, issue #, branch, stage, expected skill, reason, recovery (`@cursoragent use <skill> skill for issue NNN on branch …` or workflow_dispatch), optional agent link from `agents.<expected-skill>`, marker last line.
- **Does not** call `cursor-workflow-sync-github-status.sh` or set `HANDOFF_PROGRESS_STAGE`.
- Uses `GITHUB_TOKEN` only (no `CURSOR_HANDOFF_GITHUB_TOKEN` requirement).

**Commit:** `feat(workflow): add notify-stalled script (#111)`

### Step 3 — Extend `cursor-workflow-notify-complete.sh`

- Replace inline author resolution with `source` / subprocess from `resolve-notify-targets.sh`.
- Update body to `@${MENTIONS}` (both logins when different).
- Preserve: marker `<!-- cursor-workflow-complete-notify:v1 -->`, early exit when `stage != complete`, PR assignee to issue author, idempotent skip.

**Commit:** `feat(workflow): complete notifier mentions owner + author (#111)`

### Step 4 — Replace `pat_fallback()` in `cursor-workflow-spawn-agent.sh`

1. **Delete** `pat_fallback()` function entirely.
2. Add helper `notify_stalled(reason)` that calls `"$WF/cursor-workflow-notify-stalled.sh" "$STATE_FILE" "$reason" "$SKILL"`.
3. Replace every `pat_fallback || true` with `notify_stalled "<reason>" || true`:
   - Defer exhausted: use defer reason (`execute-active`, `at-cap`, `pending-lock`, etc.)
   - `api-400` after retries: `api-400`
   - Missing `CURSOR_API_KEY` after retries: `missing-api-key`
   - Generic post failure after retries: `spawn-failed` or map from `post_rc`
4. **Preserve** `cursor-workflow-post-deferral-comment.sh` calls before stalled notifier on terminal defer paths.
5. **Preserve** #110 behavior: no `HANDOFF_PROGRESS_STAGE` / `sync_after_spawn` on failure paths.

**Commit:** `fix(workflow): replace PAT fallback with stalled notifier (#111)`

### Step 5 — Update `cursor-workflow-passback-run.sh`

1. On API failure (non-409, non-2xx): call `notify-stalled.sh` with `passback-failed` instead of PAT `@cursoragent` comment.
2. Remove `CURSOR_HANDOFF_GITHUB_TOKEN` auth + `gh issue comment` block.
3. Exit 1 when API fails and stalled notification also fails (log warning if no token).
4. **Preserve** 409 defer (exit 0) and success path with `HANDOFF_PROGRESS_STAGE=execute-in-progress` sync.

**Commit:** `fix(workflow): pass-back failure uses stalled notifier (#111)`

### Step 6 — Register scripts

- Add both new scripts to `HANDOFF_SCRIPTS` in `cursor-workflow-load-scripts.sh`.
- Add to `HANDOFF_SCRIPTS` array in `verify-workflow-paths.sh`.
- Add `WORKFLOW.md` keyword checks: `notify-stalled`, `resolve-notify-targets`, `stalled notification`, deprecate or remove PAT fallback references as appropriate.
- Add `SETUP.md` keyword: `notify-stalled` or `stalled notification`.
- Update `MCP-GITHUB.md` @mention section: remove "Until #95 lands"; point to `resolve-notify-targets.sh`.

**Commit:** `chore(workflow): register notify scripts in load-scripts and verify (#111)`

### Step 7 — Tests (`test-cursor-workflow-handoff.sh`)

Extend `setup_mock_gh()` to support:

- `gh issue view` with `--json author`
- `gh api repos/...` for owner
- `gh issue comment` (capture body to temp file for assertions)
- Paginated comments API returning bodies for idempotency checks

**New tests:**

| Test | Assert |
|------|--------|
| `test_resolve_notify_targets_dedup` | Same author/owner → single `@login` in `MENTIONS` |
| `test_resolve_notify_targets_distinct` | Different author/owner → both in `MENTIONS` |
| `test_notify_complete_mentions_both` | Body contains both @mentions; idempotent second run skips |
| `test_notify_stalled_body_and_idempotency` | Reason, recovery, marker; second run skips |
| `test_spawn_stalled_no_progress_sync` | **Replaces** `test_spawn_pat_fallback_no_progress_sync` — stalled notifier called, no PAT comment, no false progress sync, stage unchanged |
| `test_passback_stalled_no_progress_sync` | **Replaces** `test_passback_pat_fallback_no_progress_sync` — stalled on API failure, no sync, stage `execute-passback` |

Remove assertions expecting `Posted handoff comment` (PAT). Assert `Posted stalled notification` or mock comment body contains stalled marker.

**Commit:** `test(workflow): stalled notifier and resolve-targets coverage (#111)`

### Step 8 — Skill updates

Per SPEC table, add **Genuine question vs step failure** sections:

| Skill | Genuine question | Step failure |
|-------|------------------|--------------|
| `review-and-spec` | MCP comment + marker + `spec-needs-info` + @mentions + agent link | N/A |
| `planning` | MCP comment + marker + `plan-needs-info` + @mentions + agent link | N/A |
| `demo` | N/A | Pass-back only; no human question |
| `execute` | N/A | Fix via pass-back from demo |
| `babysit-pr` | N/A | `blocked` via MCP; Actions owns complete notify |

Include comment template from SPEC (author + owner @mentions, numbered questions, continue command, agent chat link).

**Commit:** `docs(skills): genuine-question vs pass-back rules (#111)`

### Step 9 — Documentation

- **WORKFLOW.md:** New § Human communication with four scenarios table; update complete notification bullet (owner + author); document stalled notifier; mark PAT fallback deprecated/removed.
- **SETUP.md:** Note `CURSOR_HANDOFF_GITHUB_TOKEN` no longer required for handoff fallback; optional for deferral comments; troubleshooting stalled notifications.
- **MCP-GITHUB.md:** @mention rules reference `resolve-notify-targets.sh`; parity note for MCP `issue_read` + repo metadata.
- **AGENTS.md:** One-line pointer under workflow section to `WORKFLOW.md` communication scenarios.

**Commit:** `docs(workflow): human notification scenarios (#111)`

## Tests required

| Acceptance criterion | Test |
|---------------------|------|
| Resolver: author + owner, dedup | `test_resolve_notify_targets_*` |
| Complete: both @mentions, idempotent | `test_notify_complete_mentions_both` |
| Stalled: reason, recovery, marker, idempotent | `test_notify_stalled_*` |
| Terminal defer → stalled, not PAT | `test_spawn_stalled_no_progress_sync` |
| Pass-back API fail → stalled | `test_passback_stalled_no_progress_sync` |
| No false progress sync on failure (#110) | Same tests assert `CURSOR_WORKFLOW_SYNC_CALL_COUNT=0` |
| Transient deferral unchanged | Existing deferral tests / manual grep `post-deferral-comment` still called pre-terminal |
| Scripts registered | `verify-workflow-paths.sh` |
| Skills reference merge-state | Existing `verify-workflow-paths.sh` skill checks |
| MCP markers documented | `test-cursor-workflow-mcp-github.sh` (no change expected) |

**Gate script:** `bash scripts/verify-workflow-paths.sh` (includes `test-cursor-workflow-handoff.sh` and related shell tests). No phase 3–8 gates — workflow-only change.

## Documentation updates

| File | Updates |
|------|---------|
| `workflow/cursor-workflow/WORKFLOW.md` | Four scenarios; stalled notifier; deprecate PAT |
| `workflow/cursor-workflow/SETUP.md` | Secrets, troubleshooting |
| `workflow/cursor-workflow/MCP-GITHUB.md` | Resolver as @mention source of truth |
| `AGENTS.md` | Short communication pointer |
| `.cursor/skills/*/SKILL.md` | Genuine question vs pass-back |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| #110 not on branch | Branch already includes #113 merge; execute rebases if drift |
| Stalled marker blocks re-notification after fix | Human uses workflow_dispatch or `@cursoragent` comment; marker is per stall episode (acceptable per SPEC) |
| `gh` unavailable in Actions | Same as complete notifier — requires `GITHUB_TOKEN` |
| Owner is org bot | Use `.owner.login` as SPEC; no org-member expansion |
| Skills post @mentions without resolver | Document MCP parity in MCP-GITHUB.md; optional future shell call from cloud agents |

**Rollback:** Revert PR; PAT fallback restored from git history if needed.

## Definition of done

- [ ] `cursor-workflow-resolve-notify-targets.sh` and `cursor-workflow-notify-stalled.sh` exist and are executable
- [ ] `pat_fallback()` removed; no `@cursoragent` in spawn/pass-back failure paths
- [ ] Complete notifier @mentions owner + author via helper
- [ ] Terminal defer/pass-back failures invoke stalled notifier with correct reasons
- [ ] No `HANDOFF_PROGRESS_STAGE` sync on failure paths (#110 preserved)
- [ ] `cursor-workflow-load-scripts.sh` and `verify-workflow-paths.sh` list new scripts
- [ ] All skills updated per SPEC table
- [ ] WORKFLOW.md, SETUP.md, MCP-GITHUB.md, AGENTS.md updated
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] Demo scenarios in `demo/demo-spec.md` pass
- [ ] `workflow.state.json` at `execute-ready` with `active_skill: null`
