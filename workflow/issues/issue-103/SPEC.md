# Issue #103 — Post-merge cleanup: auto-delete cloud-agent side-branches

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/103

## Problem

After a workflow PR merges, two cleanup paths exist:

| Mechanism | What it removes |
|-----------|-----------------|
| GitHub `delete_branch_on_merge` | PR head branch only (e.g. `cursor/issue-99-add-film-to-watch-list`) |
| `cursor-workflow-post-merge.yml` | `cursor:*` labels + archives `workflow/issues/issue-N/` |

Neither removes **cloud-agent side branches** (`cursor/issue-NNN-pr-MMM-<skill>-agent-<id>`). These are ephemeral agent workspaces with no associated PR. As of 2026-07-11 there are **18** orphan side-branches on the repo, all tied to already-merged PRs (#82, #88, #94, #96, #97, #98, #100).

## Goal

Extend post-merge automation to delete agent side-branches scoped to the merged PR. Add an optional housekeeping sweep for existing orphans.

## Acceptance criteria

- [ ] On merge of PR `#MMM` to `main`, all remote branches matching `^cursor/issue-[0-9]+-pr-{MMM}-` are deleted
- [ ] Merged PR `headRefName` is deleted as fallback when it still exists and matches `^cursor/issue-`
- [ ] Branches that are the head of an **open** PR are never deleted
- [ ] `DELETE` 404 is treated as success (idempotent)
- [ ] Housekeeping workflow accepts optional `sweep_stale_agent_branches` input to delete side-branches whose embedded PR is merged
- [ ] `cursor-workflow-housekeeping.sh` reports count of stale agent side-branches in drift output
- [ ] Unit tests cover PR-scoped delete, sweep, dry-run, open-PR guard, malformed names, idempotency
- [ ] `workflow/cursor-workflow/WORKFLOW.md` § Post-merge cleanup documents branch deletion

## Scope

### In scope

- `scripts/cursor-workflow-delete-stale-branches.sh` (post-merge + `--sweep-merged` + `--dry-run`)
- Wire into `scripts/cursor-workflow-post-merge.sh`
- Extend `.github/workflows/cursor-workflow-housekeeping.yml`
- Tests in `scripts/test-cursor-workflow-delete-stale-branches.sh`
- Register script in `scripts/verify-workflow-paths.sh`

### Out of scope

- Deleting ad-hoc `cursor/<descriptive>-a8c0` cloud-agent branches
- Broad `cursor/*` deletion without `-pr-{PR}-` anchor
- Handoff spawn / side-branch creation changes
- UI or API changes

## User-visible behavior

No product UI changes. Repository operators see fewer stale `cursor/` branches after workflow PR merges. Housekeeping Action gains an optional sweep toggle for one-time orphan cleanup.

## Data / integration impact

None — GitHub git refs only. Existing `contents: write` permission on post-merge workflow is sufficient.

## Open questions

None.
