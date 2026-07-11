# GitHub MCP for Cursor workflow agents

Cloud Agents can use the hosted **GitHub MCP** server (`https://api.githubcopilot.com/mcp/`) with a fine-grained PAT configured in the Cursor dashboard. This guide maps workflow operations to MCP tools, defines idempotency markers, and documents fallback when MCP is unavailable.

**Handoff contract unchanged:** agents still push `workflow.state.json` for every stage transition. GitHub Actions remain authoritative for agent spawning, pinned status comments, draft PR creation, and complete notifications.

## Availability check

At skill start, confirm MCP is ready:

```text
GetMcpTools → server: github
```

Proceed with MCP when `serverStatus` is `ready`. If MCP is unavailable or auth fails, fall back to commit + push only — **never fail the skill solely because MCP is down**. GitHub Actions sync labels and the pinned status comment on the next push.

## Repo context

Resolve `owner` and `repo` from:

1. `git remote get-url origin` (parse `github.com/{owner}/{repo}`)
2. `issue_read` / `pull_request_read` responses
3. Cursor cloud environment metadata

Call `get_me` when permissions or @mention targets are unclear.

## Tool mapping

| Workflow need | MCP tool | Parameters / method | Replaces |
|---------------|----------|---------------------|----------|
| Post issue comment | `add_issue_comment` | `owner`, `repo`, `issue_number`, `body` | `gh issue comment` |
| Post PR comment | `add_issue_comment` | `issue_number` = PR number | `gh pr comment` |
| Set issue labels | `issue_write` | method `update`, `labels: [...]` | `gh issue edit --add-label` |
| Read issue + body | `issue_read` | method `get` | `gh issue view` |
| Read issue comments | `issue_read` | method `get_comments` | `gh issue view --comments` |
| PR details | `pull_request_read` | method `get` | `gh pr view` |
| CI check runs | `pull_request_read` | method `get_check_runs` | `gh pr checks` |
| Review threads | `pull_request_read` | method `get_review_comments` | `gh api .../pulls/{n}/comments` |
| PR reviews | `pull_request_read` | method `get_reviews` | `gh pr view --json reviews` |
| List commits on PR | `list_commits` | filter by PR branch or SHA range | `gh pr view --json commits` |
| Mark PR ready for review | `update_pull_request` | `draft: false` | `gh pr ready` |
| Update PR body (phase 2) | `update_pull_request` | `body` | `gh pr edit --body-file` |
| Create draft PR (phase 2) | `create_pull_request` | `draft: true` | Actions-only today |

### Mark PR ready for review

Babysit uses `update_pull_request` with `draft: false` when all checks pass. This is supported by the GitHub MCP `update_pull_request` tool (`draft` boolean parameter). If MCP update fails, document in `demo-notes.md` and rely on manual PR ready toggle — do not block `complete` solely for this.

## Idempotency markers

Every MCP-posted comment must include a hidden HTML marker as the **last line** of the body:

```html
<!-- cursor-mcp-{purpose}:v1 -->
```

| Purpose | Marker | Skills |
|---------|--------|--------|
| Spec questions | `<!-- cursor-mcp-spec-questions:v1 -->` | review-and-spec |
| Plan questions | `<!-- cursor-mcp-plan-questions:v1 -->` | planning |
| Spec complete | `<!-- cursor-mcp-spec-ready:v1 -->` | review-and-spec |
| Demo summary | `<!-- cursor-mcp-demo-summary:v1 -->` | demo |
| Blocked notice | `<!-- cursor-mcp-blocked:v1 -->` | demo, babysit-pr |
| Execute no-PR recovery | `<!-- cursor-mcp-execute-no-pr:v1 -->` | execute |
| MCP smoke test | `<!-- cursor-mcp-test:v1 -->` | SETUP verification |

### Idempotency procedure

Before posting:

1. **Issue comments:** `issue_read` method `get_comments` — scan bodies for the marker
2. **PR comments:** `pull_request_read` method `get_comments` — scan bodies for the marker
3. If marker already present → **skip** posting (idempotent re-run)
4. If not present → post with marker as last line

## @mention rules

Until [#95](https://github.com/BlackLodgeLabs/cuebox/issues/95) lands:

- @mention the **issue author** from `issue_read` method `get` (`user.login`)
- @mention the **repo owner** from `get_me` or repository metadata when notifying operators

When #95 merges, use `scripts/cursor-workflow-resolve-notify-targets.sh` as the source of truth for @mention targets.

Do **not** hardcode usernames in skill files.

## Fallback policy

| Condition | Agent behavior |
|-----------|----------------|
| MCP `serverStatus` not `ready` | Push `workflow.state.json`; Actions sync on next push |
| MCP auth error | Same — log in commit message or `demo-notes.md` |
| MCP post succeeds, push fails | Retry push; MCP comment is already visible |
| Duplicate marker detected | Skip post; continue with push |

Label drift (MCP sets `cursor:spec-needs-info` immediately; Actions reconciles all `cursor:*` labels on push) is acceptable.

## Per-skill MCP operations

See [WORKFLOW.md § GitHub MCP adoption](WORKFLOW.md#github-mcp-adoption) for the stage map.

### Pattern (all skills)

```text
1. GetMcpTools → github ready?
2. If yes: MCP for mapped ops (check markers first)
3. Always: merge-state + push workflow.state.json
4. If MCP fails: log; rely on Actions sync
```

## Phase 2 (optional)

Documented for future execute runs; implement only when explicitly scoped:

| Operation | MCP tool | When |
|-----------|----------|------|
| Create draft PR when `pr` is null | `create_pull_request` with `draft: true` | Execute stuck without PR; belt-and-suspenders vs Actions |
| Sync PR body from `PR.md` | `update_pull_request` with `body` | After create-pr commits `PR.md`; belt-and-suspenders vs Actions |

Today draft PR creation at `spec-ready` and PR body sync stay in `.github/workflows/cursor-workflow-handoff.yml`.

## Verification

### Offline (CI / gate scripts)

```bash
bash scripts/test-cursor-workflow-mcp-github.sh
bash scripts/verify-workflow-paths.sh
```

### Live smoke (cloud VM, manual)

1. `GetMcpTools` → `github` with `serverStatus: ready`
2. `add_issue_comment` on a workflow issue with `<!-- cursor-mcp-test:v1 -->` (check marker first)
3. `issue_write` method `update` — add/remove a test label

See [SETUP.md § Cloud agent environment](SETUP.md#5-cloud-agent-environment).

## Explicitly Actions-only (do not replace with MCP)

| Operation | Why |
|-----------|-----|
| `POST /v1/agents` spawn | Requires `CURSOR_API_KEY` in GitHub Actions |
| Pinned status comment (`status_comment_id`) | Actions cache + `cursor-workflow-sync-github-status.sh` |
| Draft PR at `spec-ready` | `cursor-workflow-ensure-pr-on-branch.sh` in handoff Action |
| Complete notification | `cursor-workflow-notify-complete.sh` (#95 coordination) |
| Deferral comments at agent cap | Handoff Action only |
