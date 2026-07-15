# Issue #118: Notify stalled when handoff recovery or agent-list fetch fails

## Summary
Make workflow handoff failures that occur before an agent is spawned visible and terminal. When recovery or admission cannot fetch/count the Cursor agent list, the Action must post the existing idempotent stalled notification with the affected next skill and fail rather than silently leaving the issue at a ready stage.

## Problem
Issue #115 reached `demo-ready`, but its recovery path failed while fetching the Cursor agent list (`jq` hit `ARG_MAX`). The handoff workflow invoked recovery with `|| true`, so the Action reported success without spawning `create-pr` or alerting operators. The issue remained stalled until a human intervened.

`cursor-workflow-notify-stalled.sh` already covers terminal failures reached from agent spawn and pass-back. It does not cover failures in the prerequisite agent-list fetch/count path, and recovery callers currently suppress non-zero recovery exits. The companion hardening work for #117 prevents the known `ARG_MAX` path where possible; this issue defines failure signaling for any remaining curl, jq, fetch, or count failure.

## Acceptance criteria
- [ ] A non-zero agent-list fetch or active-agent count failure is treated as a hard handoff failure; it is not converted into a successful zero count or silently ignored.
- [ ] Recovery failures caused by agent-list fetch/count, including curl, jq, and `ARG_MAX` failures, invoke `cursor-workflow-notify-stalled.sh` with a clear stable reason such as `agents-list-fetch-failed` and the stage-derived expected next skill.
- [ ] The normal state-transition handoff path receives the same handling for pre-spawn fetch/count failures, not only sync-only recovery.
- [ ] After the stalled notifier is attempted, the Action exits non-zero for these hard failures so the workflow run is visibly failed. Notification failure must not erase the original terminal failure.
- [ ] Existing `<!-- cursor-workflow-stalled-notify:v1 -->` behavior remains the duplicate guard; repeated failing pushes do not post duplicate stalled comments.
- [ ] Expected next skill remains correct for every supported ready stage: planning, execute, demo (or reopen execute), create-pr, and babysit-pr.
- [ ] Existing self-healing outcomes (`skip:*` and `defer:*`, including at-cap and pending-lock deferrals) continue to use their established skip/deferral behavior and do not create stalled notifications solely because they deferred.
- [ ] `scripts/test-cursor-workflow-handoff.sh` proves a forced recovery fetch/count failure posts the stalled marker/reason and returns failure, while a successful recovery still records and spawns the expected agent.
- [ ] `bash scripts/verify-workflow-paths.sh` passes.
- [ ] `WORKFLOW.md` and/or `SETUP.md` explain how operators identify an agent-list fetch failure and resume or investigate it after the stalled notification.

## Scope
### In scope
- `.github/workflows/cursor-workflow-handoff.yml` handling of recovery and pre-spawn hard failures.
- `cursor-workflow-handoff-recovery.sh`, `cursor-workflow-spawn-agent.sh`, and the active-agent count/fetch boundary as needed to preserve failure status and provide state/skill context to the notifier.
- Reuse of `cursor-workflow-notify-stalled.sh` and its existing marker.
- Mocked shell coverage in `scripts/test-cursor-workflow-handoff.sh`.
- Targeted workflow troubleshooting documentation.

### Out of scope
- Reworking the agent-list aggregation implementation or fixing the root `ARG_MAX` defect addressed by #117.
- Demo-agent push sequencing work tracked by #119.
- Changes to complete notifications, genuine-question MCP paths, application code, or external data schemas.

## User flows / API changes
1. A ready workflow stage needs a next agent. Recovery or admission fetches/counts the Cursor agent list.
2. If that prerequisite succeeds, current admission, deferral, deduplication, and spawn behavior remains unchanged.
3. If it fails, the code retains the ready-stage state, calls the stalled notifier with the derived next skill and a reason that identifies the agent-list failure, then returns a non-zero status to the workflow job.
4. Operators receive one stalled issue comment that mentions the repository owner and issue author, includes the ready stage and expected skill, and gives existing manual-skill/workflow-dispatch recovery instructions. Later identical failures are marker-deduplicated.

No public application API changes are required.

## Data and integration notes
- `workflow.state.json` remains the source of the issue, branch, stage, and agent context passed to the notifier. It must not be advanced to an in-progress state when fetch/count fails.
- The GitHub Action continues to load helper scripts from `main`; implementation changes take effect after merge.
- The notifier depends on the Action `GITHUB_TOKEN` and its existing GitHub issue-comment permissions. The original fetch/count error must still fail the job if notification cannot be posted.
- Tests should force a real non-zero prerequisite boundary (rather than a `defer:*` decision) and assert both the notifier content/marker and failure exit code.

## Open questions
None.

## Links
- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/118
- Incident review: https://github.com/BlackLodgeLabs/cuebox/blob/2ea2eb23634b1e3b4ee9aa547fd7338388886ad0/workflow/issues/issue-115/WORKFLOW-REVIEW.md
- Companion hardening issue: https://github.com/BlackLodgeLabs/cuebox/issues/117
- Existing stalled notifier work: https://github.com/BlackLodgeLabs/cuebox/issues/111
