# Demo notes — issue #118

- **Date:** 2026-07-15T18:10:00Z
- **Commit under test:** `2a5f008`
- **Branch:** `cursor/issue-118-notify-stalled-handoff-failures-c8b7`
- **PR:** #124
- **Docker stack:** all four services (`postgres`, `api`, `frontend`, and `backup`) were Up. Both `http://localhost:3000/api/v1/health` and `http://localhost:8000/api/v1/health` returned `{"status":"ok","database":"ok"}`.

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Execute the issue demo specification | **BLOCKED** | `workflow/issues/issue-118/demo/demo-spec.md` is absent from the tested branch, so no approved scenarios, capture paths, or expected artifacts exist to execute. |
| 2 | Supplemental workflow regression verification | **PASS** | `bash scripts/test-cursor-workflow-handoff.sh` completed with all cases passed, including forced recovery list-fetch failures for `planning`, `execute`, `demo`, `create-pr`, and `babysit-pr`; it also verified that an active-agent count failure remains terminal and that notifier failure does not hide the original failure. |
| 3 | Workflow path regression | **PASS** | `bash scripts/verify-workflow-paths.sh` completed successfully; its nested workflow and GitHub-MCP checks passed. |

## Notes

- This is a workflow-only change; no product UI scenario is applicable.
- Passing regression gates validate the implementation, but they cannot replace a missing approved demo specification. The workflow is therefore blocked rather than advanced to `demo-ready`.
- No screenshots or recordings were specified or captured, and no secrets were included.
