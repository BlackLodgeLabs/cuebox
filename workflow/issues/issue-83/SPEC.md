# Issue #83: Harden fetch-depth / BEFORE_SHA from issue #79 workflow review

## Summary

Harden the Cursor workflow handoff GitHub Action so multi-commit agent pushes reliably detect `workflow.state.json` and `PR.md` changes. The partial fix from PR [#82](https://github.com/BlackLodgeLabs/cuebox/pull/82) (`cursor-workflow-ensure-before-sha.sh` + handoff recovery) still leaves edge cases where `state_changed` and `pr_md_changed` are false on 3+ commit pushes. This issue completes the first (#79) workflow-hardening follow-up: increase checkout depth and align diff guards so handoffs and PR body sync do not depend on recovery-only paths.

## Problem

The handoff Action (`.github/workflows/cursor-workflow-handoff.yml`) checks out with `fetch-depth: 2`. On pushes that add **three or more commits** in one handoff window, `github.event.before` (`BEFORE_SHA`) often falls outside the shallow clone even after `cursor-workflow-ensure-before-sha.sh` runs.

**Current behavior when `BEFORE_SHA` is unavailable:**

| Detection | Fallback | Failure mode |
|-----------|----------|--------------|
| `state_changed` | `git diff-tree --no-commit-id --name-only -r "$AFTER_SHA"` (tip commit only) | State change in a non-tip commit → `state_changed=false` → handoff skipped unless recovery catches a stuck stage |
| `pr_md_changed` | Same tip-only fallback when `BEFORE_SHA` is zero; otherwise `git diff` without verifying `BEFORE_SHA` exists | `PR.md` changed in a non-tip commit → GitHub PR body not updated on that push |

PR [#82](https://github.com/BlackLodgeLabs/cuebox/pull/82) unblocked issue #79 when execute was stuck at `plan-ready` by fetching `BEFORE_SHA` and adding generalized handoff recovery. That recovery is a safety net, not a substitute for correct diff detection — and it does not cover `pr_md_changed` at all.

**Why this matters first:** Issues [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) (concurrent spawn dedup) and [#86](https://github.com/BlackLodgeLabs/cuebox/issues/86) (recovery gaps) assume reliable `state_changed` on every push. Fixing fetch depth and diff guards here reduces false sync-only exits and makes later hardening effective.

**Source:** [WORKFLOW-REVIEW.md § Top recommendations #1](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md), [HANDOFF-HARDENING-NOTES § Gaps #4 and #7](https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-79-workflow-review-skill/workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md), [RETROSPECTIVES recurring pattern](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/RETROSPECTIVES.md).

## Acceptance criteria

- [ ] Handoff Action checkout uses `fetch-depth: 0` (full history) **or** a documented depth with rationale in `WORKFLOW.md` if full fetch is rejected for performance
- [ ] `state_changed` detection is correct when an agent pushes **3+ commits** in one handoff window and `workflow.state.json` changes in a **non-tip** commit
- [ ] `pr_md_changed` uses the same `BEFORE_SHA` availability guard as `state_changed` (verify commit exists before `git diff`; tip-only fallback only when `BEFORE_SHA` is the all-zero SHA or fetch definitively failed)
- [ ] `scripts/test-cursor-workflow-handoff.sh` includes a regression case: simulated multi-commit push where state changes on commit 2 of 3 (non-tip)
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `workflow/cursor-workflow/RETROSPECTIVES.md` shallow `BEFORE_SHA` row updated with mitigation link to the landed PR when complete
- [ ] `workflow/cursor-workflow/WORKFLOW.md` § "Shallow checkout and `BEFORE_SHA`" reflects the new checkout depth and diff behavior

## Scope

### In scope

- `.github/workflows/cursor-workflow-handoff.yml`:
  - `handoff` job checkout `fetch-depth` (line ~44)
  - `resync-status` job checkout `fetch-depth` (line ~379) — keep consistent with push job unless documented exception
  - `pr_md_changed` block (lines ~302–316): align with `state_changed` guards (lines ~318–338)
- `scripts/cursor-workflow-ensure-before-sha.sh` — retain as defense-in-depth; update comments if checkout depth changes
- Extract or share diff-helper logic if duplication between `state_changed` and `pr_md_changed` would otherwise drift (optional small script, e.g. `cursor-workflow-push-diff-includes.sh`, acceptable if it keeps YAML DRY)
- `scripts/test-cursor-workflow-handoff.sh` — new multi-commit non-tip state-change case (git fixture repo or inline `git init` test harness consistent with existing tests)
- `scripts/verify-workflow-paths.sh` — wire new test if added as separate script
- `workflow/cursor-workflow/WORKFLOW.md` and `RETROSPECTIVES.md` documentation updates

### Out of scope

- Cross-run spawn dedup ([#84](https://github.com/BlackLodgeLabs/cuebox/issues/84)) — do **after** this issue
- `execute-passback` recovery ([#86](https://github.com/BlackLodgeLabs/cuebox/issues/86))
- `handoff-recovery.sh` behavior changes beyond what falls out naturally from better diff detection
- Application code (API, frontend, database)
- `workflow_dispatch` resync running recovery (HANDOFF-HARDENING-NOTES gap #8)

## User flows / API changes

No end-user UI or public API changes.

**Workflow operator experience (GitHub Actions + issue labels):**

1. **Multi-commit agent push (3+ commits, state change mid-push):** Handoff Action detects `workflow.state.json` change across the full push range → `state_changed=true` → next agent spawns on the same run without waiting for recovery on a later sync-only push.
2. **Multi-commit push updating `PR.md`:** `pr_md_changed=true` when `PR.md` changes in any commit of the push → `cursor-workflow-update-pr-body.sh` runs on that push.
3. **Single-commit or two-commit pushes:** Existing behavior preserved (no regression).
4. **Recovery still runs on sync-only pushes** when diff detection is unchanged — recovery remains a safety net, not the primary path.

**Recommended implementation approach (for planning):**

| Option | Pros | Cons |
|--------|------|------|
| `fetch-depth: 0` on both checkout steps | Eliminates `BEFORE_SHA` class; matches `cursor-workflow-post-merge.yml` | Slightly slower checkout on large repos (Cuebox workflow repo is small) |
| Higher fixed depth (e.g. 50) | Faster than full | Must document and may still fail on very large pushes |

**Default recommendation:** `fetch-depth: 0` unless gate/measurement shows unacceptable checkout time on `ubuntu-latest`.

**`pr_md_changed` alignment pattern** (mirror `state_changed`):

```yaml
# Pseudocode — planning should match actual YAML structure
if BEFORE_SHA is not all-zero:
  if git cat-file -e BEFORE_SHA:
    pr_md_changed = git diff --name-only BEFORE_SHA AFTER_SHA includes PR.md
  else:
  # warn; tip-only fallback (same as state_changed)
    pr_md_changed = git diff-tree -r AFTER_SHA includes PR.md
else:
  pr_md_changed = git diff-tree -r AFTER_SHA includes PR.md
```

## Data and integration notes

- **GitHub Actions only** — no database, sync pipeline, or external API contract changes.
- **`GITHUB_TOKEN` / `CURSOR_API_KEY`** — unchanged; handoff spawn and label sync behavior unchanged except when diff detection correctly fires.
- **Scripts loaded from `origin/main`:** Until this PR merges, other `cursor/issue-*` branches still load old helpers from main via `cursor-workflow-load-scripts.sh`; that is existing behavior (HANDOFF-HARDENING-NOTES #6).
- **Performance:** `WORKFLOW.md` documents sync-only target &lt; 2 min; full checkout on Cuebox should remain well within that. If `fetch-depth: 0` is chosen, update the "Checkout and setup" bullet that currently says `fetch-depth: 2`.
- **Test strategy:** Add a shell test that builds a temporary git repo with three commits on a branch, sets `BEFORE_SHA` to commit 1 and `AFTER_SHA` to commit 3, with `workflow.state.json` modified only on commit 2; assert the diff logic (extracted helper or sourced YAML fragment) reports changed. Existing `test-cursor-workflow-handoff.sh` pattern (mocked env, no live Actions) is the right home.

## Open questions (must be empty before plan-ready)

_None — issue body and #79 review artifacts provide sufficient detail._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/83
- Parent review: https://github.com/BlackLodgeLabs/cuebox/issues/79
- Prior partial fix: https://github.com/BlackLodgeLabs/cuebox/pull/82
- Hardening notes: https://github.com/BlackLodgeLabs/cuebox/blob/cursor/issue-79-workflow-review-skill/workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md
- Workflow review: https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md
- Follow-up (after this): https://github.com/BlackLodgeLabs/cuebox/issues/84, https://github.com/BlackLodgeLabs/cuebox/issues/86
- Handoff workflow: `.github/workflows/cursor-workflow-handoff.yml`
- Ensure-before-sha script: `scripts/cursor-workflow-ensure-before-sha.sh`
