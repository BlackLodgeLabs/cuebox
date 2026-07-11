# Demo notes — issue #105

- **Date:** 2026-07-11T18:40:00Z
- **Commit:** cb52ce1
- **Branch:** `cursor/issue-105-adopt-github-mcp-fb51`
- **PR:** #107
- **Docker stack:** Not required for this workflow-only demo (demo-spec preconditions). Stack not running; no product UI scenarios.

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | MCP availability and documentation | **PASS** | [scenario-1-mcp-docs.log](scenario-1-mcp-docs.log) |
| 2 | Skill MCP integration | **PASS** | [scenario-2-skills.log](scenario-2-skills.log) |
| 3 | Regression scripts | **PASS** | [scenario-3-regression.log](scenario-3-regression.log) |
| 4 | Live GitHub MCP visibility | **PASS** | [scenario-4-comment-urls.log](scenario-4-comment-urls.log), [scenario-4-github-comment.png](scenario-4-github-comment.png) |
| 5 | Idempotency marker table | **PASS** | [scenario-5-markers.log](scenario-5-markers.log) |

## Gate evidence

- `bash scripts/test-cursor-workflow-mcp-github.sh` — exit 0
- `bash scripts/verify-workflow-paths.sh` — exit 0
- `.github/workflows/cursor-workflow-handoff.yml` — 0 lines diff vs `main`

## Scenario 4 — MCP comment URLs

- Issue #105 spec-ready comment (marker `<!-- cursor-mcp-spec-ready:v1 -->`): https://github.com/BlackLodgeLabs/cuebox/issues/105#issuecomment-4948258758
- Posted via GitHub MCP during spec stage before state push (dogfood criterion met)

## Notes

- GitHub MCP `serverStatus: ready`; required tools (`add_issue_comment`, `issue_write`, `pull_request_read`) available.
- Six scoped skills reference `MCP-GITHUB.md` with MCP-first + push fallback; `create-pr` unchanged (out of scope).
- No secrets in logs or screenshots.
