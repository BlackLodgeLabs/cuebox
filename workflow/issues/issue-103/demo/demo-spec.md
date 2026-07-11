# Demo spec — issue #103

Workflow-only change (no product UI). Demo agent validates branch cleanup via GitHub API and housekeeping Action.

## Preconditions

- Full Docker stack **not required** for this issue
- `gh` CLI authenticated with repo read/write (delete refs)
- Post-merge and housekeeping workflows deployed to `main` (after execute merges this PR)

### Seed steps

1. Before merge, note orphan branch count:
   ```bash
   gh api repos/BlackLodgeLabs/cuebox/git/refs/heads/cursor --jq '[.[] | select(.ref | test("-agent-"))] | length'
   ```
2. Optionally create a throwaway test branch matching the pattern (delete after test):
   ```bash
   git checkout -b cursor/issue-103-pr-999-demo-agent-test000 origin/main
   git push -u origin cursor/issue-103-pr-999-demo-agent-test000
   ```

## Scenarios

### Scenario 1: Post-merge deletes PR-scoped side-branches

**Goal:** Merging the issue #103 PR triggers automatic deletion of its agent side-branches.

**Steps:**

1. During execute, if any agent side-branches were created for this PR (e.g. `cursor/issue-103-pr-{N}-*-agent-*`), list them before merge.
2. Merge PR to `main`.
3. Wait for **Cursor workflow post-merge** Action to complete.
4. Re-list branches matching `cursor/issue-103-pr-{N}-`.

**Capture:**

- Log: `workflow/issues/issue-103/demo/scenario-1-post-merge-delete.log` (branch list before/after, Action run URL)

**Pass criteria:**

- All `cursor/issue-103-pr-{merged-pr}-*` branches are gone (or were never created).
- Post-merge Action log shows `deleted` lines for each removed branch.

### Scenario 2: Housekeeping sweep clears historical orphans

**Goal:** One-time sweep removes pre-existing agent side-branches for merged PRs.

**Steps:**

1. Confirm orphan count > 0 before sweep (expected ~18 from issues #79, #84, #86, #90, #91, #92, #99).
2. Actions → **Cursor workflow housekeeping** → Run workflow → enable `sweep_stale_agent_branches`.
3. Wait for completion.
4. Re-run orphan count query.

**Capture:**

- Log: `workflow/issues/issue-103/demo/scenario-2-sweep.log` (count before/after, Action run URL)

**Pass criteria:**

- Orphan count drops to 0 (or only branches tied to open PRs remain).
- Action log shows summary with `deleted` count.

### Scenario 3: Dry-run preview (local or CI)

**Goal:** `--dry-run` lists intended deletes without mutating refs.

**Steps:**

1. With at least one stale branch present (before Scenario 2), run:
   ```bash
   bash scripts/cursor-workflow-delete-stale-branches.sh --sweep-merged --dry-run
   ```
2. Verify output lists branch names with `dry-run: would delete` (or equivalent).
3. Confirm branches still exist after dry-run.

**Capture:**

- Log: `workflow/issues/issue-103/demo/scenario-3-dry-run.log`

**Pass criteria:**

- Dry-run output matches expected branch set.
- No branches deleted.

### Scenario 4: Open-PR guard

**Goal:** Script never deletes a branch that is the head of an open PR.

**Steps:**

1. If feasible, open a draft PR from a test side-branch (or document skip if no open PRs exist).
2. Run delete script in dry-run or sweep mode.
3. Confirm branch is `skipped-open-pr`.

**Capture:**

- Notes: `workflow/issues/issue-103/demo/scenario-4-open-pr-guard.md`

**Pass criteria:**

- Branch with open PR is not deleted.
- Log shows `skipped-open-pr`.

## Notes

- No screenshots required (no UI).
- `demo-notes.md` should summarize Action run URLs and before/after branch counts.
