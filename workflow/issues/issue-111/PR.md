## Related Issue

Closes #111

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/111)

## Description

**What does this PR do?**

Introduces reliable, Actions-owned human notifications for the Cursor workflow. Terminal handoff failures now post a **stalled** issue comment (with @mentions, stall reason, and recovery steps) instead of the unreliable PAT `@cursoragent` fallback. **Complete** notifications now @mention both the repo owner and issue author via a shared resolver. Skills and workflow docs distinguish **genuine product questions** (MCP issue comment with @mentions) from **step failures** (pass-back only, no human fix request).

This is workflow infrastructure only — no application UI, API, or database changes. Prerequisite [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) (no false `*-in-progress` labels on failed spawn) is preserved.

**Why is this the best approach?**

A single `cursor-workflow-resolve-notify-targets.sh` helper keeps @mention rules consistent across complete and stalled notifiers and documents parity for MCP-based agent comments. Idempotency markers (`cursor-workflow-complete-notify:v1`, `cursor-workflow-stalled-notify:v1`) prevent comment spam. Replacing `pat_fallback()` removes dependence on `CURSOR_HANDOFF_GITHUB_TOKEN` for human-visible alerts while keeping transient deferral comments unchanged for audit trails.

## Changes Proposed

* **New** `scripts/cursor-workflow-resolve-notify-targets.sh` — resolves issue author + repo owner logins dynamically; deduplicates when same person.
* **New** `scripts/cursor-workflow-notify-stalled.sh` — terminal failure notification with reason-specific recovery text and idempotency marker.
* **Updated** `scripts/cursor-workflow-notify-complete.sh` — dual @mentions via shared helper; PR assignee behaviour unchanged.
* **Updated** `scripts/cursor-workflow-spawn-agent.sh` — removed `pat_fallback()`; terminal paths call stalled notifier; no `HANDOFF_PROGRESS_STAGE` sync on failure (#110 preserved).
* **Updated** `scripts/cursor-workflow-passback-run.sh` — stalled notifier on API failure instead of PAT comment.
* **Updated** `scripts/cursor-workflow-load-scripts.sh` and `scripts/verify-workflow-paths.sh` — register new scripts and doc keyword checks.
* **Updated** `scripts/test-cursor-workflow-handoff.sh` — resolver, complete, and stalled notifier tests; PAT-fallback tests renamed to stalled-notifier expectations.
* **Updated** `.cursor/skills/{review-and-spec,planning,demo,execute,babysit-pr}/SKILL.md` — genuine-question vs pass-back rules with MCP markers.
* **Updated** `workflow/cursor-workflow/{WORKFLOW.md,SETUP.md,MCP-GITHUB.md}` and `AGENTS.md` — four communication scenarios documented; PAT fallback deprecated.

## Scenario Results

Workflow-only change (no product UI). Demo captured at commit `d8967db` on branch `cursor/issue-111-workflow-human-notifications`.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Resolve notify targets | PASS | [scenario-1-resolve-targets.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-111-workflow-human-notifications/workflow/issues/issue-111/demo/scenario-1-resolve-targets.log) |
| 2 | Complete notification — dual @mentions | PASS | [scenario-2-complete-notify.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-111-workflow-human-notifications/workflow/issues/issue-111/demo/scenario-2-complete-notify.log) |
| 3 | Stalled notification replaces PAT fallback | PASS | [scenario-3-spawn-stalled.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-111-workflow-human-notifications/workflow/issues/issue-111/demo/scenario-3-spawn-stalled.log) |
| 4 | Pass-back failure uses stalled notifier | PASS | [scenario-4-passback-stalled.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-111-workflow-human-notifications/workflow/issues/issue-111/demo/scenario-4-passback-stalled.log) |
| 5 | Stalled notifier idempotency and body content | PASS | [scenario-5-stalled-idempotency.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-111-workflow-human-notifications/workflow/issues/issue-111/demo/scenario-5-stalled-idempotency.log) |
| 6 | Workflow path verification | PASS | [scenario-6-verify-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-111-workflow-human-notifications/workflow/issues/issue-111/demo/scenario-6-verify-paths.log) |
| 7 | Documentation and skills spot-check | PASS | Greps confirmed in `demo-notes.md` — four scenarios in WORKFLOW.md, `resolve-notify-targets` in MCP-GITHUB.md, genuine-question markers in spec/plan skills, pass-back rules in demo skill |

## How to Test

1. Checkout the feature branch: `git checkout cursor/issue-111-workflow-human-notifications`
2. Run the handoff test suite:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
   Confirm `test_resolve_notify_targets_*`, `test_notify_complete_mentions_both`, `test_notify_stalled_*`, `test_spawn_stalled_no_progress_sync`, and `test_passback_stalled_no_progress_sync` all PASS.
3. Run the workflow regression gate:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
   Expect exit 0; grep confirms `notify-stalled` and `resolve-notify-targets` registered in `cursor-workflow-load-scripts.sh`.
4. Spot-check PAT removal:
   ```bash
   ! grep -q 'pat_fallback' scripts/cursor-workflow-spawn-agent.sh
   ! grep -q 'CURSOR_HANDOFF_GITHUB_TOKEN' scripts/cursor-workflow-passback-run.sh
   ```
5. Documentation greps (optional):
   ```bash
   grep -q 'stalled notification' workflow/cursor-workflow/WORKFLOW.md
   grep -q 'resolve-notify-targets' workflow/cursor-workflow/MCP-GITHUB.md
   grep -q 'cursor-mcp-spec-questions:v1' .cursor/skills/review-and-spec/SKILL.md
   ```

No Docker stack or database setup required.

## Known Issues / Notes for Reviewer

* Stalled notification idempotency marker blocks duplicate alerts for the same stall episode; after a fix, use workflow_dispatch or `@cursoragent` comment to resume.
* `CURSOR_HANDOFF_GITHUB_TOKEN` is no longer required for handoff fallback; may still be used for transient deferral comments.
* `execute-active` stall recovery text references the demo skill per [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) (clearing `active_skill` on execute-ready is out of scope here).
* Demo re-run note: first `test-cursor-workflow-handoff.sh` pass had a flaky `reopen inference prev_stage` failure; re-run passed — not part of demo-spec scenarios.

## Gate evidence

- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `5cddf02` (babysit commit)
- [x] Handoff tests: `test-cursor-workflow-handoff.sh` exit 0 at `5cddf02` (babysit commit)

## Checklist

- [x] Code follows project conventions
- [x] Tests added/updated and passing
- [x] Documentation updated where applicable
- [x] No secrets committed
- [x] Demo scenarios verified
