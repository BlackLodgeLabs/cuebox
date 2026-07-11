# Demo notes — issue #103

**Date:** 2026-07-11  
**Branch:** `cursor/issue-103-post-merge-agent-branch-cleanup-a8c0`  
**Commit:** `12013b9`  
**PR:** [#104](https://github.com/BlackLodgeLabs/cuebox/pull/104)

## Environment

- Docker stack: **not required** (workflow-only change; demo spec § Preconditions)
- `gh` CLI: authenticated as `cursor` with repo read access
- Orphan agent side-branches on remote: **18** (merged PRs) + 1 throwaway test branch

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Post-merge deletes PR-scoped side-branches | **DEFERRED** (post-merge) | [scenario-1-post-merge-delete.log](./scenario-1-post-merge-delete.log) — no `cursor/issue-103-pr-104-*` side-branches exist; dry-run validates open-PR guard on head ref |
| 2 | Housekeeping sweep clears orphans | **DEFERRED** (post-merge) | [scenario-2-sweep.log](./scenario-2-sweep.log) — 18 stale branches; dry-run lists all targets |
| 3 | Dry-run preview | **PASS** | [scenario-3-dry-run.log](./scenario-3-dry-run.log) — 18 `dry-run delete` lines; branches unchanged |
| 4 | Open-PR guard | **PASS** | [scenario-4-open-pr-guard.md](./scenario-4-open-pr-guard.md) — `skipped-open-pr` for PR #104 head |

## Automated tests

```bash
bash scripts/test-cursor-workflow-delete-stale-branches.sh   # 12/12 PASS
bash scripts/verify-workflow-paths.sh                        # PASS (includes delete script tests)
```

## Post-merge operator checklist

After PR #104 merges to `main`:

1. Confirm post-merge Action for #104 completes; verify no `cursor/issue-103-pr-104-*` branches
2. Run housekeeping with `sweep_stale_agent_branches: true` to clear 18 historical orphans
3. Update scenario-1 and scenario-2 logs with Action run URLs

## Cleanup

- Removed throwaway branch `cursor/issue-103-pr-999-demo-agent-test000` after scenario 4 setup attempt
