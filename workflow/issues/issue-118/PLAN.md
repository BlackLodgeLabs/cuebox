# Issue #118 execution plan

## Implementation

1. Propagate failures from Cursor agent-list fetches through the active-agent count and admission boundary.
2. Make recovery and normal spawn paths post the existing idempotent stalled notification with `agents-list-fetch-failed`, preserve the ready state, and return the original non-zero failure.
3. Keep `skip:*` and `defer:*` outcomes non-terminal; only terminal pre-spawn failures notify and fail the Action.
4. Remove recovery-call error suppression from the handoff workflow so a terminal recovery failure fails the job.

## Verification

- Extend `scripts/test-cursor-workflow-handoff.sh` to force agent-list failures across all ready stages, verify the expected next skill and no agent POST, and prove notification failure does not hide the terminal exit.
- Run `bash scripts/test-cursor-workflow-handoff.sh`.
- Run `bash scripts/verify-workflow-paths.sh`.

## Documentation

- Document detection and recovery steps for `agents-list-fetch-failed` in the workflow guide and setup troubleshooting table.
