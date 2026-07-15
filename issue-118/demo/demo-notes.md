# Demo notes — issue #118

- **Date:** 2026-07-15T18:36:00Z
- **Commit under test:** `e1c0157`
- **Branch:** `cursor/issue-118-notify-stalled-handoff-failures-c8b7`
- **PR:** #124
- **Docker stack:** all four services (`postgres`, `api`, `frontend`, and `backup`) were Up. Both `http://localhost:3000/api/v1/health` and `http://localhost:8000/api/v1/health` returned `{"status":"ok","database":"ok"}`.

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Agent-list failure is terminal and notified | **PASS** | `scenario-1-handoff-tests.log` captures `scripts/test-cursor-workflow-handoff.sh` passing every forced recovery fetch/count failure across `planning`, `execute`, `demo`, `create-pr`, and `babysit-pr`. It also verifies the stable `agents-list-fetch-failed` reason, stalled-notification marker, expected next skill, no agent POST/false progress, and preservation of the original error when notification posting fails. |
| 2 | Workflow path and documentation regression | **PASS** | `scenario-2-workflow-gate.log` captures `scripts/verify-workflow-paths.sh` passing its nested handoff suite plus the GitHub-MCP, documentation-link, and legacy-path checks. |

## Notes

- This is a workflow-only change, so the approved demo specifies shell-log artifacts rather than UI screenshots or recordings.
- The operator recovery guidance for `agents-list-fetch-failed` is covered in `workflow/cursor-workflow/WORKFLOW.md` and `workflow/cursor-workflow/SETUP.md`.
- The committed logs contain only mocked test-harness output; no credentials or environment values are included.
- The GitHub MCP token cannot convert PR #124 from draft to ready (`Resource not accessible by personal access token`); the workflow state is completed, but a maintainer must use GitHub’s **Ready for review** control.
