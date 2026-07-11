# Scenario 4 — Open-PR guard

**Date:** 2026-07-11  
**Result:** PASS

## Approach

Could not create a new draft PR (token lacks `createPullRequest` permission). Used the
existing open PR **#104** head branch instead, which is the realistic production case:
post-merge delete must not remove a branch that still has an open PR.

## Test

```bash
export GH_TOKEN=$(gh auth token)
export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
bash scripts/cursor-workflow-delete-stale-branches.sh 104 --dry-run
```

## Output

```
Deleting agent side-branches for merged PR #104...
BRANCH: skipped-open-pr cursor/issue-103-post-merge-agent-branch-cleanup-a8c0
Summary: deleted=0 skipped-open-pr=1 not-found=0 errors=0
```

## Verification

- Branch `cursor/issue-103-post-merge-agent-branch-cleanup-a8c0` still exists (PR #104 open)
- Log shows `skipped-open-pr` as required

## Unit test coverage

`scripts/test-cursor-workflow-delete-stale-branches.sh` — case "open PR guard skips branch" also passes.
