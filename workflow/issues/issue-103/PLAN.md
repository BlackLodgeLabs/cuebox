# Implementation plan — Issue #103

Post-merge cleanup: auto-delete cloud-agent side-branches (`cursor/issue-*-pr-*-agent-*`).

## Overview

Add a small shell script that deletes PR-scoped agent side-branches via the GitHub API, call it from the existing post-merge workflow on every merged PR, and expose a one-time sweep mode through the housekeeping workflow. Branch deletion is keyed on the **merged PR number** from the workflow event (not issue number), matching the naming convention documented in `WORKFLOW.md` § Agent side-branch merges.

## Reproduction findings

Not a product bug — workflow hygiene gap. Evidence:

- 18 orphan branches on `origin` as of 2026-07-11, all matching `cursor/issue-*-pr-*-agent-*` with no open PR
- Repo setting `delete_branch_on_merge: true` is enabled; merged head branches (e.g. `cursor/issue-99-add-film-to-watch-list`) are removed correctly
- `cursor-workflow-post-merge.sh` strips labels and archives artifacts only — no branch deletion
- `cursor-workflow-housekeeping.sh` reports label/folder drift only — no branch reporting

## Root cause

Cloud agents push ephemeral side-branches (`cursor/issue-NNN-pr-MMM-<skill>-agent-<id>`) during handoff stages. These branches are never PR heads, so GitHub auto-delete-on-merge never applies. Post-merge automation was implemented in PR #80 without branch cleanup (manual follow-up noted in PR body).

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `scripts/cursor-workflow-delete-stale-branches.sh` | **New** | Core delete logic (post-merge + sweep + dry-run) |
| `scripts/test-cursor-workflow-delete-stale-branches.sh` | **New** | Unit tests with mocked branch lists |
| `scripts/cursor-workflow-post-merge.sh` | Edit | Call delete script after label strip |
| `scripts/cursor-workflow-housekeeping.sh` | Edit | Drift report: stale agent branch count |
| `.github/workflows/cursor-workflow-housekeeping.yml` | Edit | Optional `sweep_stale_agent_branches` input |
| `scripts/verify-workflow-paths.sh` | Edit | Register new script + run new test |
| `workflow/cursor-workflow/WORKFLOW.md` | Edit | Document post-merge step 4 |
| `workflow/cursor-workflow/SETUP.md` | Edit | Note one-time sweep via housekeeping |

No changes to `.github/workflows/cursor-workflow-post-merge.yml` expected (`contents: write` already set).

## Implementation steps

### Step 1 — `cursor-workflow-delete-stale-branches.sh`

```
Usage:
  cursor-workflow-delete-stale-branches.sh <pr-number> [--dry-run]
  cursor-workflow-delete-stale-branches.sh --sweep-merged [--dry-run]
```

**Mode A — post-merge (primary)**

1. Accept merged PR number `MMM` from argv.
2. List remote refs under `cursor/issue-*-pr-${MMM}-*` via paginated `gh api` or `git ls-remote`.
3. Filter with regex: `^cursor/issue-[0-9]+-pr-${MMM}-`.
4. For each candidate:
   - Skip if `gh pr list --head <branch> --state open` returns a row.
   - Else `DELETE repos/{owner}/{repo}/git/refs/heads/{branch}`; treat 404 as success.
5. Fallback: fetch merged PR `headRefName` from `gh pr view`; if it still exists and matches `^cursor/issue-`, delete it.

**Mode B — sweep (`--sweep-merged`)**

1. List all `cursor/issue-*-agent-*` branches.
2. Extract embedded PR number from `-pr-(\d+)-` segment.
3. If that PR state is `MERGED`, delete (same open-PR guard).
4. Print summary: `deleted`, `skipped-open-pr`, `not-found`, `errors`.

**Shared behavior**

- `--dry-run`: log intended actions, no API deletes.
- Log every branch with action taken.
- Exit 0 unless unrecoverable API error (not 404).

### Step 2 — Wire post-merge

In `cursor-workflow-post-merge.sh`, after `cursor-workflow-strip-labels-from-pr.sh`:

```bash
bash "$ROOT/scripts/cursor-workflow-delete-stale-branches.sh" "$PR"
```

Run **unconditionally** on merge (not gated on `Closes #NNN`). Agent branches are PR-scoped.

### Step 3 — Housekeeping integration

**`cursor-workflow-housekeeping.sh`**

- When `gh` + token available, count branches matching `cursor/issue-*-pr-*-agent-*` where embedded PR is `MERGED`.
- If count > 0: `report "N stale agent side-branches for merged PRs (enable sweep_stale_agent_branches)"`.

**`cursor-workflow-housekeeping.yml`**

Add input:

```yaml
sweep_stale_agent_branches:
  description: Delete agent side-branches for merged PRs (orphan cleanup)
  type: boolean
  default: false
```

When true:

```bash
bash scripts/cursor-workflow-delete-stale-branches.sh --sweep-merged
```

### Step 4 — Tests

`scripts/test-cursor-workflow-delete-stale-branches.sh` — mock branch list via env (same pattern as `test-cursor-workflow-handoff.sh`):

| Case | Expected |
|------|----------|
| Post-merge PR #88 | Deletes `cursor/issue-84-pr-88-*`; keeps `cursor/issue-84-pr-99-*` |
| Open PR guard | Listed branch with open PR → `skipped-open-pr` |
| `--dry-run` | Logs only, no delete calls |
| `--sweep-merged` | Deletes only when embedded PR is merged |
| Malformed names | `cursor/fix-foo`, `cursor/issue-99-add-film` → no match |
| Idempotent | Second pass → all `not-found`, exit 0 |

Add script to `HANDOFF_SCRIPTS` in `verify-workflow-paths.sh`; run test in shell-test block.

### Step 5 — Documentation

Update `WORKFLOW.md` § Post-merge cleanup:

1. GitHub auto-closes linked issue
2. Strips `cursor:*` labels
3. Archives `workflow/issues/issue-N/`
4. **Deletes `cursor/issue-*-pr-{PR}-*` agent side-branches**

Update `SETUP.md` with one-time sweep instructions.

### Step 6 — One-time cleanup (post-merge of this PR)

After this feature merges:

1. Actions → **Cursor workflow housekeeping** → `sweep_stale_agent_branches: true`
2. Confirm ~18 orphan branches removed
3. Re-run drift report → no stale branch warning

## Tests required

| Test | Type | Maps to |
|------|------|---------|
| `test-cursor-workflow-delete-stale-branches.sh` | Shell unit | All acceptance criteria for delete logic |
| `verify-workflow-paths.sh` | Regression | Script registered, tests wired |
| Manual: merge this PR | Integration | Post-merge deletes side-branches for PR #MMM |
| Manual: housekeeping sweep | Integration | Clears pre-existing 18 orphans |

No API/frontend/E2E tests — workflow-only change.

## Gate script

```bash
bash scripts/verify-workflow-paths.sh
```

No phase gate scripts required (no app code).

## Documentation updates

- `workflow/cursor-workflow/WORKFLOW.md` — post-merge step 4
- `workflow/cursor-workflow/SETUP.md` — sweep instructions

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Delete branch needed for `changes-requested` reopen | Only delete on **merge** of that PR; reopen starts new cycle |
| Agent still pushing at merge time | Open-PR guard; merge happens after babysit + human review |
| Regex too broad | Anchor on `-pr-{PR}-`; never delete without PR number |
| Irreversible delete | `--dry-run` + sweep report preview before bulk delete |

**Rollback:** Remove call from `cursor-workflow-post-merge.sh`. Deleted branches are not recoverable from git.

## Definition of done

- [ ] `cursor-workflow-delete-stale-branches.sh` with post-merge and sweep modes
- [ ] Called from `cursor-workflow-post-merge.sh` on every merged PR
- [ ] `test-cursor-workflow-delete-stale-branches.sh` passes via `verify-workflow-paths.sh`
- [ ] Housekeeping reports stale count; optional sweep deletes orphans
- [ ] `WORKFLOW.md` and `SETUP.md` updated
- [ ] One-time sweep clears existing 18 orphans
- [ ] Next workflow PR merge leaves zero `cursor/issue-*-pr-{that-pr}-*` branches
