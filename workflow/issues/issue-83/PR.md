## Related Issue

Closes #83

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/83)

## Description

**What does this PR do?**

Hardens the Cursor workflow handoff GitHub Action so multi-commit agent pushes reliably detect changes to `workflow.state.json` and `PR.md` across the full push range (`BEFORE_SHA` → `AFTER_SHA`), not only the tip commit.

PR #82 added `cursor-workflow-ensure-before-sha.sh` and generalized handoff recovery as a safety net when execute was stuck at `plan-ready` on issue #79. That partial fix still left two gaps:

1. **`fetch-depth: 2`** — on pushes with 3+ commits, `github.event.before` often remained outside the shallow clone even after the ensure-before-sha fetch attempt.
2. **`pr_md_changed` guard asymmetry** — unlike `state_changed`, it called `git diff` without verifying `BEFORE_SHA` exists locally; when fetch failed, behavior was inconsistent and tip-only fallback was not applied.

This PR sets `fetch-depth: 0` on both handoff jobs (matching `cursor-workflow-post-merge.yml`), extracts shared push-diff logic into `scripts/cursor-workflow-push-diff-includes.sh`, aligns `pr_md_changed` with `state_changed` guards, adds shell regression tests for non-tip state/PR.md changes, and updates workflow documentation.

A post-babysit workflow review found that the new helper was referenced in handoff YAML but not registered in `cursor-workflow-load-scripts.sh`, so live handoffs from `execute-ready` through `complete` used recovery instead of primary diff detection. This PR now registers the helper and adds a gate check so YAML/`load-scripts` parity cannot drift again.

**Why is this the best approach?**

Full history checkout (`fetch-depth: 0`) eliminates the `BEFORE_SHA` class of failures for typical agent pushes on this small repo, with negligible checkout overhead compared to the existing sync-only run-time target (< 2 min). A shared diff helper keeps `state_changed` and `pr_md_changed` DRY so the guards cannot drift again. `cursor-workflow-ensure-before-sha.sh` remains as defense-in-depth for edge cases (force-push, unusual runner state). Handoff recovery from #82 stays as a safety net — it is not the primary path for diff detection.

## Changes Proposed

* Added `scripts/cursor-workflow-push-diff-includes.sh` — single source of truth for push-range file detection with `BEFORE_SHA` availability guards and tip-only fallback.
* Updated `.github/workflows/cursor-workflow-handoff.yml` — `fetch-depth: 0` on `handoff` and `resync-status` jobs; replaced inline `state_changed` / `pr_md_changed` blocks with shared helper calls.
* Updated `scripts/cursor-workflow-ensure-before-sha.sh` — comment-only clarification that it is defense-in-depth now that checkout uses full history.
* Extended `scripts/test-cursor-workflow-handoff.sh` — regression tests for multi-commit non-tip `workflow.state.json` and `PR.md` changes, plus tip-only fallback miss cases.
* Updated `scripts/verify-workflow-paths.sh` — added `cursor-workflow-push-diff-includes.sh` to script inventory; gate asserts every `$WF/cursor-workflow-*.sh` referenced in handoff YAML is listed in `load-scripts`.
* Registered `cursor-workflow-push-diff-includes.sh` in `scripts/cursor-workflow-load-scripts.sh` — required for live handoff runs to load the helper before merge to `main`.
* Updated `workflow/cursor-workflow/WORKFLOW.md` — checkout depth, `BEFORE_SHA` section, and diff helper reference.
* Updated `workflow/cursor-workflow/RETROSPECTIVES.md` — shallow `BEFORE_SHA` mitigation row links PR #87; index row for issue #83 workflow review.
* Added `workflow/issues/issue-83/WORKFLOW-REVIEW.md` — post-babysit retrospective.

## Scenario Results

Workflow/infrastructure change — no UI screenshots. All five demo scenarios passed (see [demo-notes.md](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4d94b06ecf9d057b3c1676d8a51ebe8b5e865951/workflow/issues/issue-83/demo/demo-notes.md)).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Workflow paths gate | **PASS** | [scenario-1-verify-workflow-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4d94b06ecf9d057b3c1676d8a51ebe8b5e865951/workflow/issues/issue-83/demo/scenario-1-verify-workflow-paths.log) — exit 0, `test-cursor-workflow-handoff.sh: all cases passed` |
| 2 | Multi-commit non-tip state change | **PASS** | [scenario-2-push-diff-state.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4d94b06ecf9d057b3c1676d8a51ebe8b5e865951/workflow/issues/issue-83/demo/scenario-2-push-diff-state.log) — `PASS: push diff detects non-tip state change across full range` |
| 3 | Multi-commit non-tip PR.md change | **PASS** | [scenario-3-push-diff-pr-md.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4d94b06ecf9d057b3c1676d8a51ebe8b5e865951/workflow/issues/issue-83/demo/scenario-3-push-diff-pr-md.log) — `PASS: push diff detects non-tip PR.md change across full range` |
| 4 | Handoff YAML full checkout | **PASS** | [scenario-4-fetch-depth.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4d94b06ecf9d057b3c1676d8a51ebe8b5e865951/workflow/issues/issue-83/demo/scenario-4-fetch-depth.log) — two `fetch-depth: 0` entries (lines 44, 360); zero `fetch-depth: 2` |
| 5 | Helper script wired | **PASS** | [scenario-5-helper-wiring.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4d94b06ecf9d057b3c1676d8a51ebe8b5e865951/workflow/issues/issue-83/demo/scenario-5-helper-wiring.log) — helper executable; referenced twice in handoff YAML |

## How to Test

1. Checkout this branch:
   ```bash
   git fetch origin cursor/issue-83-harden-fetch-depth-before-sha
   git checkout cursor/issue-83-harden-fetch-depth-before-sha
   ```
2. Run the workflow paths gate (includes handoff test suite):
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
   Expect exit 0 and `PASS: no legacy workflow paths found`.
3. Run handoff tests directly:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
   Expect `test-cursor-workflow-handoff.sh: all cases passed` and the new non-tip push-diff cases to pass.
4. Verify checkout depth in the handoff workflow:
   ```bash
   grep -n 'fetch-depth' .github/workflows/cursor-workflow-handoff.yml
   ```
   Expect two `fetch-depth: 0` lines and no `fetch-depth: 2`.
5. Verify helper wiring and load-scripts registration:
   ```bash
   test -x scripts/cursor-workflow-push-diff-includes.sh
   grep -F 'cursor-workflow-push-diff-includes.sh' .github/workflows/cursor-workflow-handoff.yml
   grep -F 'cursor-workflow-push-diff-includes.sh' scripts/cursor-workflow-load-scripts.sh
   ```

No Docker stack, API keys, or application smoke tests required — workflow/shell-only change.

## Known Issues / Notes for Reviewer

* **PR body sync:** The create-pr push did not update the GitHub PR description because `push-diff-includes.sh` was missing from `load-scripts` at that time (fixed in `21abfb6`). Sync manually after checkout — see command below.
* Until this PR merges to `main`, other `cursor/issue-*` branches still load old helpers from `origin/main` via `cursor-workflow-load-scripts.sh` for scripts already on `main` — existing behavior documented in HANDOFF-HARDENING-NOTES #6. New helpers on this branch are available via HEAD fallback once listed in `load-scripts`.
* Tip-only fallback still misses non-tip changes if full fetch fails; rare with `fetch-depth: 0`; recovery remains safety net for handoffs (not PR body sync).
* Live GitHub Actions during this run used recovery for demo/create-pr/babysit spawns; shell/git fixtures validated the diff helper. Post-merge smoke test recommended.
* Follow-up issues #84 (concurrent spawn dedup) and #86 (pass-back recovery) should land after this hardening.
* Workflow review: [WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/21abfb6/workflow/issues/issue-83/WORKFLOW-REVIEW.md)

## Gate evidence

- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `0a6f6df` (babysit) and `c1f59c9` (post-review load-scripts fix)
- [x] `test-cursor-workflow-handoff.sh: all cases passed` at `0a6f6df` and `c1f59c9`

## Checklist

- [x] Code follows project conventions
- [x] Tests pass locally
- [x] Documentation updated where applicable
- [x] No secrets or credentials in commits or demo artifacts
- [x] Acceptance criteria from issue #83 met
