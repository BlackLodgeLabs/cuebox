## Related Issue

Closes #118

[GitHub issue #118](https://github.com/BlackLodgeLabs/cuebox/issues/118)

## Description

**What does this PR do?**

This PR makes Cursor workflow handoff failures visible and terminal when the prerequisite Cursor agent-list fetch or active-agent count fails. Recovery and normal admission retain the ready state, post the existing idempotent stalled notification with `agents-list-fetch-failed` and the stage-derived next skill, then fail the Action instead of silently treating the failure as successful recovery.

**Why is this the best approach?**

It reuses the established stalled-notification marker and keeps terminal prerequisite failures separate from intentional `skip:*` and `defer:*` outcomes. That preserves current admission and deferral behavior while providing operators an actionable failed workflow run and a deduplicated issue notification.

## Changes Proposed

* Propagate non-zero Cursor agent-list fetch and active-agent count failures through fetch, count, recovery, and spawn boundaries.
* Make sync-only recovery and normal handoff notify with `agents-list-fetch-failed`, preserve the ready-stage state, and return the original terminal failure even when notification posting also fails.
* Stop the handoff Action from suppressing recovery failures.
* Add mocked handoff coverage for terminal failures at every ready stage, expected next-skill derivation, no false spawn/progress, and notifier-failure behavior.
* Document diagnosis and recovery steps for `agents-list-fetch-failed`.

## Scenario Results

This workflow-only change has no product UI scenario. Its approved demo captures shell-regression logs instead.

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Agent-list failure is terminal and notified | **PASS** | `workflow/issues/issue-118/demo/scenario-1-handoff-tests.log` |
| 2 | Workflow path and documentation regression | **PASS** | `workflow/issues/issue-118/demo/scenario-2-workflow-gate.log` |

## How to Test

1. Check out `cursor/issue-118-notify-stalled-handoff-failures-c8b7`.
2. Run `bash scripts/test-cursor-workflow-handoff.sh`.
3. Confirm the forced-failure tests cover recovery at each ready stage, active-agent count failure, `agents-list-fetch-failed`, no agent POST, and notifier-failure terminality.
4. Run `bash scripts/verify-workflow-paths.sh`.
5. Verify `workflow/cursor-workflow/WORKFLOW.md` and `workflow/cursor-workflow/SETUP.md` contain the `agents-list-fetch-failed` recovery guidance.

## Known Issues / Notes for Reviewer

* No product UI, Docker services, or provider credentials are involved.
* The demo artifacts are mocked shell-test logs and contain no credentials or environment values.

## Gate evidence

- Workflow handoff regression: `scripts/test-cursor-workflow-handoff.sh` exit 0 at `e1c0157`
- Workflow regression: `scripts/verify-workflow-paths.sh` exit 0 at `e1c0157`

## Checklist

- [ ] Review terminal-failure and notification behavior across all ready stages.
- [ ] Verify the operator recovery guidance is actionable after a failed Cursor agent-list request.
- [ ] Confirm the two approved demo logs cover the required assertions.
