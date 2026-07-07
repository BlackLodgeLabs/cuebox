# Implementation plan — issue #83: Harden fetch-depth / BEFORE_SHA

## Overview

Harden the Cursor workflow handoff GitHub Action so multi-commit agent pushes reliably detect changes to `workflow.state.json` and `PR.md` across the full push range (`BEFORE_SHA` → `AFTER_SHA`), not only the tip commit.

PR [#82](https://github.com/BlackLodgeLabs/cuebox/pull/82) added `cursor-workflow-ensure-before-sha.sh` and generalized handoff recovery as a safety net when execute was stuck at `plan-ready` on issue #79. That partial fix still leaves two gaps:

1. **`fetch-depth: 2`** — on pushes with 3+ commits, `github.event.before` often remains outside the shallow clone even after the ensure-before-sha fetch attempt.
2. **`pr_md_changed` guard asymmetry** — unlike `state_changed`, it calls `git diff` without verifying `BEFORE_SHA` exists locally; when fetch fails, behavior is inconsistent and tip-only fallback is not applied.

**Approach:** Set `fetch-depth: 0` on both handoff jobs (matches `cursor-workflow-post-merge.yml`), extract shared push-diff logic into `scripts/cursor-workflow-push-diff-includes.sh`, align `pr_md_changed` with `state_changed` guards, add a shell regression test for non-tip state changes, and update workflow docs.

**Classification:** Workflow/infrastructure — not an application bug. No Docker stack reproduction required.

## Root cause

| Component | Current behavior | Failure mode |
|-----------|------------------|--------------|
| Checkout `fetch-depth: 2` | Only tip + parent in clone | `BEFORE_SHA` from a 3+ commit push is outside shallow history |
| `cursor-workflow-ensure-before-sha.sh` | `git fetch --depth=1` for missing SHA | May fetch SHA object but not intermediate commits needed for `git diff` range |
| `state_changed` tip fallback | `git diff-tree -r AFTER_SHA` | Misses `workflow.state.json` changed in commit 2 when tip is commit 3 |
| `pr_md_changed` | `git diff` without `git cat-file -e BEFORE_SHA` | Silent empty/wrong diff when SHA missing; no aligned warning/fallback |

Handoff recovery (`cursor-workflow-handoff-recovery.sh`) covers stuck handoff stages on sync-only pushes but does **not** update PR bodies when `pr_md_changed` is false.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `.github/workflows/cursor-workflow-handoff.yml` | Edit | `fetch-depth: 0` on `handoff` (~line 44) and `resync-status` (~line 379) jobs; replace inline `state_changed` / `pr_md_changed` blocks with shared helper calls |
| `scripts/cursor-workflow-push-diff-includes.sh` | **New** | Single source of truth for push-range file detection with BEFORE_SHA guards |
| `scripts/cursor-workflow-ensure-before-sha.sh` | Edit (comments only) | Note defense-in-depth role when `fetch-depth: 0` is primary mitigation |
| `scripts/test-cursor-workflow-handoff.sh` | Edit | Add multi-commit non-tip state-change regression + PR.md non-tip case |
| `scripts/verify-workflow-paths.sh` | Edit | Add `cursor-workflow-push-diff-includes.sh` to `HANDOFF_SCRIPTS` list |
| `workflow/cursor-workflow/WORKFLOW.md` | Edit | Update § "Shallow checkout and `BEFORE_SHA`" and "Checkout and setup" bullets |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | Edit | Update shallow `BEFORE_SHA` row with link to landed PR #87 |

## Implementation steps

### Step 1 — Shared diff helper

Create `scripts/cursor-workflow-push-diff-includes.sh`:

```bash
# Usage: cursor-workflow-push-diff-includes.sh <before_sha> <after_sha> <grep_mode> <pattern>
# grep_mode: -E (regex) or -F (fixed string)
# Exit 0 if any changed file in the push range matches; exit 1 otherwise.
```

Logic (mirror current `state_changed` structure):

1. If `before_sha` is all-zero → `git diff-tree --no-commit-id --name-only -r after_sha | grep <mode> pattern`
2. Else if `git cat-file -e before_sha` → `git diff --name-only before_sha after_sha | grep <mode> pattern`
3. Else → emit `::warning::BEFORE_SHA … unavailable — checking AFTER_SHA commit only` → tip-only `git diff-tree` fallback

Make executable (`chmod +x`). Keep script self-contained (no YAML sourcing).

### Step 2 — Handoff workflow YAML

In `.github/workflows/cursor-workflow-handoff.yml`:

1. Change both `actions/checkout@v4.3.1` steps from `fetch-depth: 2` to `fetch-depth: 0`.
2. Replace `pr_md_changed` block (~lines 302–312) with:

```bash
if "$WF/cursor-workflow-push-diff-includes.sh" "$BEFORE_SHA" "$AFTER_SHA" -F "$PR_MD_FILE"; then
  pr_md_changed=true
fi
```

3. Replace `state_changed` detection block (~lines 323–338) with helper call using `-E` and `$STATE_PATH_PATTERN`. Keep `prev_stage` extraction unchanged (it already guards with `git cat-file -e "${BEFORE_SHA}:${STATE_FILE}"`).

4. Load helper from `$WF` (scripts dir from `cursor-workflow-load-scripts.sh`) — same as other handoff scripts. Until merge to `main`, branch copy is used when present; after merge, main copy is authoritative.

### Step 3 — Ensure-before-sha comments

Update header comment in `cursor-workflow-ensure-before-sha.sh` to state it remains defense-in-depth for edge cases (force-push, unusual runner state) now that checkout uses full history.

### Step 4 — Regression tests

Add to `scripts/test-cursor-workflow-handoff.sh`:

**`test_push_diff_non_tip_state_change`** — inline `git init` fixture:

1. Create temp repo; add `workflow/issues/issue-83/workflow.state.json` with `stage: spec-in-progress`.
2. Commit 1 (`C1`): initial file.
3. Commit 2 (`C2`): change `stage` to `spec-ready`.
4. Commit 3 (`C3`): unrelated change (e.g. touch `README` or amend metadata only).
5. Set `BEFORE_SHA=C1`, `AFTER_SHA=C3`.
6. Assert `cursor-workflow-push-diff-includes.sh C1 C3 -E 'workflow/issues/issue-[0-9]+/workflow\.state\.json'` exits 0.
7. Assert tip-only path: unset/missing `C1` from object store (or use a bogus SHA) → helper uses fallback → **does not** match when only commit 2 changed state (documents why full history matters).

**`test_push_diff_non_tip_pr_md`** — same pattern for `PR.md` with `-F` mode.

Wire both tests into the existing `pass`/`fail_test` harness at bottom of file.

### Step 5 — verify-workflow-paths.sh

Add `cursor-workflow-push-diff-includes.sh` to the `HANDOFF_SCRIPTS` array (~line 107). No other gate changes required.

### Step 6 — Documentation

**`WORKFLOW.md`:**

- Rename or revise § "Shallow checkout and `BEFORE_SHA`" to describe `fetch-depth: 0` on push/resync jobs.
- Note `cursor-workflow-ensure-before-sha.sh` as defense-in-depth.
- Document `cursor-workflow-push-diff-includes.sh` as the shared diff primitive.
- Update "Checkout and setup" bullet (currently `fetch-depth: 2`) to `fetch-depth: 0`.
- Keep sync-only run-time target (< 2 min) — full history on Cuebox is negligible overhead.

**`RETROSPECTIVES.md`:**

- Update recurring pattern row "Shallow checkout misses `BEFORE_SHA`" mitigation column to link PR #87 (this issue) alongside #82 partial fix.

### Suggested commit grouping (execute)

1. `feat(workflow): add cursor-workflow-push-diff-includes.sh helper`
2. `fix(workflow): fetch-depth 0 and align pr_md_changed guards in handoff Action`
3. `test(workflow): multi-commit non-tip push diff regression`
4. `docs(workflow): update WORKFLOW.md and RETROSPECTIVES for fetch-depth hardening`

## Tests required

| Test | Type | Maps to acceptance criterion |
|------|------|------------------------------|
| `test_push_diff_non_tip_state_change` in `test-cursor-workflow-handoff.sh` | Shell unit (git fixture) | `state_changed` correct on 3-commit push with state change on commit 2 |
| `test_push_diff_non_tip_pr_md` in `test-cursor-workflow-handoff.sh` | Shell unit (git fixture) | `pr_md_changed` uses same BEFORE_SHA guard |
| Existing cases in `test-cursor-workflow-handoff.sh` | Regression | Single/two-commit and recovery paths unchanged |
| `bash scripts/verify-workflow-paths.sh` | Gate | All path/schema checks + runs handoff test suite |
| Manual YAML review | Static | Both checkout steps use `fetch-depth: 0` |

No API, frontend, or Playwright tests — out of scope per spec.

## Gate script

Run before push:

```bash
bash scripts/verify-workflow-paths.sh
```

This executes `test-cursor-workflow-handoff.sh` and validates script presence, WORKFLOW.md keywords, and handoff YAML references. No phase gate scripts (3–8) apply — workflow-only change.

## Documentation updates

| File | Update |
|------|--------|
| `workflow/cursor-workflow/WORKFLOW.md` | Checkout depth, BEFORE_SHA section, diff helper reference |
| `workflow/cursor-workflow/RETROSPECTIVES.md` | Mitigation link for shallow checkout pattern |
| `scripts/cursor-workflow-ensure-before-sha.sh` | Comment-only clarification |

No `README.md` or `AGENTS.md` changes unless `verify-workflow-paths.sh` keyword checks require it (they should not).

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Slightly slower checkout on `ubuntu-latest` | Cuebox repo is small; `fetch-depth: 0` already used in post-merge workflow |
| Helper loaded from `origin/main` until PR merges | Branch includes helper; `load-scripts.sh` prefers branch copy when on issue branch |
| Tip-only fallback still misses non-tip changes if full fetch fails | Rare with `fetch-depth: 0`; recovery remains safety net for handoffs (not PR body) |
| Regression in single-commit pushes | Existing test suite + explicit single-commit sub-case in new test if easy |

**Rollback:** Revert PR; restore `fetch-depth: 2` and inline YAML blocks. Recovery from #82 continues to function.

## Definition of done

- [ ] `handoff` and `resync-status` jobs use `fetch-depth: 0`
- [ ] `cursor-workflow-push-diff-includes.sh` exists, executable, and used for both `state_changed` and `pr_md_changed`
- [ ] `pr_md_changed` verifies `BEFORE_SHA` exists before `git diff`; tip-only fallback aligned with `state_changed`
- [ ] Regression test: 3-commit push, state/`PR.md` change on commit 2, full-range detection passes
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] `WORKFLOW.md` § checkout/BEFORE_SHA reflects new behavior
- [ ] `RETROSPECTIVES.md` shallow-checkout row links mitigation to this PR
- [ ] Demo artifacts captured per `demo/demo-spec.md`
- [ ] No application code changes
