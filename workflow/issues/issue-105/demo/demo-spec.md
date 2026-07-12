# Demo spec — issue #105

Workflow-only change (no product UI). Demo agent validates GitHub MCP adoption in docs, skills, regression scripts, and live GitHub visibility.

## Preconditions

- Full Docker stack **not required**
- GitHub MCP available in cloud VM: `GetMcpTools` with `server: github` returns `serverStatus: ready`
- Draft PR **#107** linked in `workflow.state.json` (`pr: 107`)
- Branch: `cursor/issue-105-adopt-github-mcp-fb51`

### Seed steps

None (no database state required).

## Scenarios

### Scenario 1: MCP availability and documentation

**Goal:** Confirm GitHub MCP is configured and canonical docs exist.

**Steps:**

1. Call `GetMcpTools` with `server: github` — confirm `serverStatus: ready` and tools include `add_issue_comment`, `issue_write`, `pull_request_read`.
2. Verify `workflow/cursor-workflow/MCP-GITHUB.md` exists and contains:
   - Tool mapping table (`gh` → MCP)
   - Idempotency marker section with all six workflow markers
   - Availability check (`GetMcpTools`)
   - Fallback when MCP unavailable
3. Verify `workflow/cursor-workflow/WORKFLOW.md` has MCP adoption map section linking `MCP-GITHUB.md`.
4. Verify `workflow/cursor-workflow/SETUP.md` lists GitHub MCP as required for workflow Cloud Agents.

**Capture:**

- Log: `workflow/issues/issue-105/demo/scenario-1-mcp-docs.log` (GetMcpTools summary, grep results for key sections)

**Pass criteria:**

- MCP server ready
- All three doc files present with required content

### Scenario 2: Skill MCP integration

**Goal:** All six scoped skills reference MCP patterns.

**Steps:**

1. For each skill (`review-and-spec`, `planning`, `execute`, `demo`, `babysit-pr`, `workflow-review`), confirm `SKILL.md` references `MCP-GITHUB.md` and documents MCP-first behavior with push fallback.
2. Confirm `babysit-pr` documents `pull_request_read` for checks/reviews (not only `gh pr view`).
3. Confirm `babysit-pr` **does not** instruct MCP issue comment at `complete` (Actions owns notification).
4. Confirm `create-pr` skill was **not** modified (out of scope).

**Capture:**

- Log: `workflow/issues/issue-105/demo/scenario-2-skills.log` (per-skill grep summary)

**Pass criteria:**

- Six skills updated; `create-pr` unchanged
- Each skill has idempotency / marker awareness or defers to `MCP-GITHUB.md`

### Scenario 3: Regression scripts

**Goal:** Workflow path verification passes with new MCP checks.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-mcp-github.sh` — exit 0.
2. Run `bash scripts/verify-workflow-paths.sh` — exit 0.
3. Confirm `.github/workflows/cursor-workflow-handoff.yml` has no functional spawn-logic changes (diff against `main` should be empty or absent).

**Capture:**

- Log: `workflow/issues/issue-105/demo/scenario-3-regression.log` (command output, short SHA)

**Pass criteria:**

- Both scripts exit 0
- Handoff YAML unchanged

### Scenario 4: Live GitHub MCP visibility (dogfood)

**Goal:** At least one MCP-posted comment is visible on GitHub for this workflow run.

**Steps:**

1. On issue **#105**, search comments for `<!-- cursor-mcp-spec-ready:v1 -->` (posted during spec stage) or `<!-- cursor-mcp-plan-questions:v1 -->` / plan-related marker if applicable.
2. Alternatively, after demo stage execute posts demo summary: on PR **#107**, search for `<!-- cursor-mcp-demo-summary:v1 -->`.
3. Record comment URL(s) in demo notes.

**Capture:**

- Screenshot: `workflow/issues/issue-105/demo/scenario-4-github-comment.png` (issue or PR comment showing marker line in expanded/raw view, or comment body visible)
- Log: `workflow/issues/issue-105/demo/scenario-4-comment-urls.log` (URLs)

**Pass criteria:**

- At least one workflow MCP marker comment visible on issue #105 or PR #107
- Comment appeared without requiring human to run Actions resync first (MCP direct post)

### Scenario 5: Idempotency marker table

**Goal:** All spec-defined markers are documented and grep-able.

**Steps:**

1. Grep `MCP-GITHUB.md` for each marker:
   - `cursor-mcp-spec-questions:v1`
   - `cursor-mcp-plan-questions:v1`
   - `cursor-mcp-spec-ready:v1`
   - `cursor-mcp-demo-summary:v1`
   - `cursor-mcp-blocked:v1`
   - `cursor-mcp-execute-no-pr:v1`
2. Confirm `scripts/test-cursor-workflow-mcp-github.sh` validates marker presence.

**Capture:**

- Log: `workflow/issues/issue-105/demo/scenario-5-markers.log`

**Pass criteria:**

- All six markers documented; test script checks them

## Artifacts checklist

- [ ] `scenario-1-mcp-docs.log`
- [ ] `scenario-2-skills.log`
- [ ] `scenario-3-regression.log`
- [ ] `scenario-4-github-comment.png` (or `scenario-4-comment-urls.log` if screenshot impractical)
- [ ] `scenario-5-markers.log`
- [ ] `workflow/issues/issue-105/demo/demo-notes.md` with date, commit SHA, scenario pass/fail table, gate evidence line
- [ ] No secrets in logs or screenshots
