## Related Issue

Closes #105

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/105)

## Description

**What does this PR do?**

Cloud Agents now have **GitHub MCP** (hosted PAT via the Cursor dashboard) for issue/PR comments, labels, and PR reads — operations that previously failed with the App integration token (`Resource not accessible by integration`). Workflow skills still relied on push-only GitHub visibility, leaving operators blind to spec/plan questions, `blocked` summaries, demo results, and stuck-without-PR recovery until the next handoff Action.

This PR adopts MCP for **human-visible GitHub writes and reads** across six workflow skills while **preserving** `workflow.state.json` as the handoff contract and GitHub Actions for agent spawning, status-comment sync, draft PR creation, and complete notifications.

**Why is this the best approach?**

MCP removes App-token limits without replacing the existing handoff architecture. Skills use MCP-first with idempotency HTML markers and read-before-post deduplication; on auth/unavailable MCP they fall back to commit + push (existing behaviour). Actions remain authoritative for spawn triggers, pinned status comments, draft PR at `spec-ready`, and complete notification — avoiding scope creep into Actions replacement and keeping rollback simple (revert doc/skill commits).

## Changes Proposed

* Added `workflow/cursor-workflow/MCP-GITHUB.md` — canonical tool mapping (`gh` → MCP), idempotency markers, @mention rules, availability check, fallback policy, and Phase 2 appendix
* Updated `workflow/cursor-workflow/WORKFLOW.md` — per-stage MCP vs Actions adoption map linking `MCP-GITHUB.md`
* Updated `workflow/cursor-workflow/SETUP.md` — GitHub MCP required for workflow Cloud Agents; verification steps
* Updated six skills to prefer MCP for mapped operations: `review-and-spec`, `planning`, `execute`, `demo`, `babysit-pr`, `workflow-review` (each references `MCP-GITHUB.md` with push fallback)
* Added `scripts/test-cursor-workflow-mcp-github.sh` — offline regression for doc links, markers, and skill MCP references
* Updated `scripts/verify-workflow-paths.sh` — registers `MCP-GITHUB.md` and runs the MCP test script
* Updated `AGENTS.md` — cross-link to `MCP-GITHUB.md` in workflow section
* Demo artifacts under `workflow/issues/issue-105/demo/` — five scenario logs, screenshot, and `demo-notes.md`

**Explicitly unchanged:** `.github/workflows/cursor-workflow-handoff.yml` spawn logic, `create-pr` skill, and all application code (API, frontend, database).

## Scenario Results

Workflow-only change — no product UI. Demo validated MCP docs, skill integration, regression scripts, live GitHub visibility, and idempotency markers.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | MCP availability and documentation | **PASS** | [scenario-1-mcp-docs.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cb52ce1d57ac7159a4879f1bb90634da9f41f696/workflow/issues/issue-105/demo/scenario-1-mcp-docs.log) |
| 2 | Skill MCP integration | **PASS** | [scenario-2-skills.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cb52ce1d57ac7159a4879f1bb90634da9f41f696/workflow/issues/issue-105/demo/scenario-2-skills.log) |
| 3 | Regression scripts | **PASS** | [scenario-3-regression.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cb52ce1d57ac7159a4879f1bb90634da9f41f696/workflow/issues/issue-105/demo/scenario-3-regression.log) |
| 4 | Live GitHub MCP visibility | **PASS** | [scenario-4-comment-urls.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cb52ce1d57ac7159a4879f1bb90634da9f41f696/workflow/issues/issue-105/demo/scenario-4-comment-urls.log), screenshot below |
| 5 | Idempotency marker table | **PASS** | [scenario-5-markers.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cb52ce1d57ac7159a4879f1bb90634da9f41f696/workflow/issues/issue-105/demo/scenario-5-markers.log) |

![Scenario 4 — MCP spec-ready comment on issue #105](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cb52ce1d57ac7159a4879f1bb90634da9f41f696/workflow/issues/issue-105/demo/scenario-4-github-comment.png)

Live MCP comment (dogfood): [issue #105 comment](https://github.com/BlackLodgeLabs/cuebox/issues/105#issuecomment-4948258758) with marker `<!-- cursor-mcp-spec-ready:v1 -->`, posted during spec stage before state push.

## How to Test

1. Checkout this branch: `git checkout cursor/issue-105-adopt-github-mcp-fb51`
2. Confirm GitHub MCP is available (cloud VM): `GetMcpTools` with `server: github` → `serverStatus: ready`
3. Run offline MCP regression:
   ```bash
   bash scripts/test-cursor-workflow-mcp-github.sh
   ```
4. Run workflow path verification:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
5. Verify docs and adoption map:
   ```bash
   test -f workflow/cursor-workflow/MCP-GITHUB.md
   grep -q 'MCP-GITHUB.md' workflow/cursor-workflow/WORKFLOW.md
   grep -q 'GitHub MCP' workflow/cursor-workflow/SETUP.md
   ```
6. Confirm handoff YAML unchanged:
   ```bash
   git diff main -- .github/workflows/cursor-workflow-handoff.yml
   ```
   Expect no functional spawn-logic changes (empty diff).
7. Confirm six scoped skills reference `MCP-GITHUB.md`; `create-pr` skill unchanged:
   ```bash
   for s in review-and-spec planning execute demo babysit-pr workflow-review; do
     grep -q MCP-GITHUB.md .cursor/skills/$s/SKILL.md && echo "OK $s"
   done
   ! grep -q MCP-GITHUB.md .cursor/skills/create-pr/SKILL.md && echo "OK create-pr unchanged"
   ```

**Docker stack not required** — workflow-only scope.

## Known Issues / Notes for Reviewer

* `create-pr` skill intentionally unchanged; PR body sync stays GitHub Actions (belt-and-suspenders `update_pull_request` documented as Phase 2 in `MCP-GITHUB.md`).
* Phase 2 optional items (`create_pull_request` when `pr` is null; MCP PR body update) are documented only — not implemented in this PR.
* @mention rules reference future `cursor-workflow-resolve-notify-targets.sh` when [#95](https://github.com/BlackLodgeLabs/cuebox/issues/95) lands; until then agents @mention issue author and repo owner via MCP reads.
* Complete notification remains Actions-only — babysit must not duplicate via MCP.
* Label drift (MCP immediate set + Actions reconcile on push) is acceptable per plan.

## Gate evidence

- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at e1e0e26` (execute)
- [x] `test-cursor-workflow-mcp-github.sh exit 0 at e1e0e26` (execute)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at cb52ce1` (demo)
- [x] `test-cursor-workflow-mcp-github.sh exit 0 at cb52ce1` (demo)
- [x] `.github/workflows/cursor-workflow-handoff.yml` — 0 lines diff vs `main` (demo)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at dbabf10` (babysit)
- [x] `test-cursor-workflow-mcp-github.sh exit 0 at dbabf10` (babysit)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Handoff YAML spawn logic unchanged
