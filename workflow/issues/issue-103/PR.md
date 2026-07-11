## Related Issue

Closes #103

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/103)

## Description

**What does this PR do?**

After a workflow PR merges, GitHub's `delete_branch_on_merge` removes only the PR head branch. Cloud-agent **side branches** (`cursor/issue-NNN-pr-MMM-<skill>-agent-<id>`) are ephemeral workspaces with no associated PR and were never cleaned up — leaving 18 orphan branches on the repo as of 2026-07-11.

This PR adds `scripts/cursor-workflow-delete-stale-branches.sh` to delete PR-scoped agent side-branches automatically on every merge, plus an optional housekeeping sweep for historical orphans.

**Why is this best approach?**

Branch deletion is keyed on the **merged PR number** from the workflow event (not issue number), matching the naming convention in `WORKFLOW.md` § Agent side-branch merges. The script runs unconditionally on every merge (not gated on `Closes #NNN`) because agent branches are PR-scoped. An open-PR guard prevents deleting branches still referenced by open PRs; `DELETE` 404 is treated as success for idempotency. A separate `--sweep-merged` mode lets operators clear pre-existing orphans via the housekeeping Action without broad `cursor/*` deletion.

## Changes Proposed

* Added `scripts/cursor-workflow-delete-stale-branches.sh` — post-merge delete, `--sweep-merged`, `--dry-run`, and `--count-stale` modes
* Added `scripts/test-cursor-workflow-delete-stale-branches.sh` — 12 unit test cases (PR-scoped delete, sweep, dry-run, open-PR guard, malformed names, idempotency)
* Updated `scripts/cursor-workflow-post-merge.sh` — calls delete script after label strip on every merged PR
* Updated `scripts/cursor-workflow-housekeeping.sh` — drift report includes stale agent side-branch count
* Updated `.github/workflows/cursor-workflow-housekeeping.yml` — optional `sweep_stale_agent_branches` input
* Updated `scripts/verify-workflow-paths.sh` — registers new script and runs unit tests
* Updated `workflow/cursor-workflow/WORKFLOW.md` — documents post-merge step 4 (branch deletion)
* Updated `workflow/cursor-workflow/SETUP.md` — one-time sweep instructions

## Scenario Results

Workflow-only change — no UI screenshots. Demo validation used dry-run against live remote branches.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Post-merge deletes PR-scoped side-branches | **DEFERRED** (post-merge) | [scenario-1-post-merge-delete.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-103-post-merge-agent-branch-cleanup-a8c0/workflow/issues/issue-103/demo/scenario-1-post-merge-delete.log) — no `cursor/issue-103-pr-104-*` side-branches exist; dry-run validates open-PR guard on head ref |
| 2 | Housekeeping sweep clears orphans | **DEFERRED** (post-merge) | [scenario-2-sweep.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-103-post-merge-agent-branch-cleanup-a8c0/workflow/issues/issue-103/demo/scenario-2-sweep.log) — 18 stale branches; dry-run lists all targets |
| 3 | Dry-run preview | **PASS** | [scenario-3-dry-run.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-103-post-merge-agent-branch-cleanup-a8c0/workflow/issues/issue-103/demo/scenario-3-dry-run.log) — 18 `dry-run delete` lines; branches unchanged |
| 4 | Open-PR guard | **PASS** | [scenario-4-open-pr-guard.md](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-103-post-merge-agent-branch-cleanup-a8c0/workflow/issues/issue-103/demo/scenario-4-open-pr-guard.md) — `skipped-open-pr` for PR #104 head |

## How to Test

1. Checkout this branch: `git checkout cursor/issue-103-post-merge-agent-branch-cleanup-a8c0`
2. Run unit tests:
   ```bash
   bash scripts/test-cursor-workflow-delete-stale-branches.sh
   ```
3. Run workflow regression:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
4. Dry-run sweep against live remote (requires `gh` auth):
   ```bash
   export GH_TOKEN=$(gh auth token)
   export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
   bash scripts/cursor-workflow-delete-stale-branches.sh --sweep-merged --dry-run
   ```
5. Verify open-PR guard on this PR's head branch:
   ```bash
   bash scripts/cursor-workflow-delete-stale-branches.sh 104 --dry-run
   ```
   Expect `skipped-open-pr` for `cursor/issue-103-post-merge-agent-branch-cleanup-a8c0`.

**Post-merge integration (after merge to `main`):**

1. Confirm post-merge Action for PR #104 completes; verify no `cursor/issue-103-pr-104-*` branches remain.
2. Run **Cursor workflow housekeeping** Action with `sweep_stale_agent_branches: true` to clear ~18 historical orphans.
3. Re-run `bash scripts/cursor-workflow-delete-stale-branches.sh --count-stale` — expect 0.

## Known Issues / Notes for Reviewer

* Scenarios 1 and 2 are **deferred** until this PR merges — post-merge Action and housekeeping sweep require the new script on `main`.
* After merge, operators should run the one-time housekeeping sweep (`sweep_stale_agent_branches: true`) to clear 18 pre-existing orphan branches tied to merged PRs #82, #88, #94, #96, #97, #98, #100.
* Deleted branches are not recoverable from git. Use `--dry-run` before bulk sweep.
* Out of scope: ad-hoc `cursor/<descriptive>-a8c0` cloud-agent branches without `-pr-{PR}-` anchor.

## Gate evidence

- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at 7c4f394` (execute)
- [x] `test-cursor-workflow-delete-stale-branches.sh` — 12/12 cases passed at `7c4f394` (execute)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at ac750e0` (babysit)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Post-merge sweep planned for historical orphans
