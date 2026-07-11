# Issue #105 — Adopt GitHub MCP in Cursor workflow agents

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/105

## Summary

Cloud Agents now have **GitHub MCP** (hosted `https://api.githubcopilot.com/mcp/` with a fine-grained PAT). They can post issue/PR comments, set labels, and read PR checks/reviews — operations that previously failed with the App integration token (`Resource not accessible by integration`).

This change adopts MCP for **human-visible GitHub writes and reads** across workflow skills while **keeping** `workflow.state.json` as the handoff contract and GitHub Actions for agent spawning (`CURSOR_API_KEY`), status-comment sync, draft PR creation, and complete/stalled notifications.

## Problem

The workflow is documented and implemented as **push-only** toward GitHub:

| Symptom | Root cause |
|---------|------------|
| Spec/plan questions invisible until next handoff push | Skills tell agents not to fail when `gh issue comment` is denied; labels sync only on push |
| `blocked` stage silent on issue/PR | Agents cannot post; humans must read `workflow.state.json` on the branch |
| Demo results only in `demo-notes.md` | No PR comment with scenario summary |
| Babysit uses `gh pr view` / `gh api` | CLI often unavailable or permission-limited in cloud VMs |
| Execute stuck with `pr: null` | Recovery steps buried in commit message |

Evidence: workflow reviews [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79), [#26](https://github.com/BlackLodgeLabs/cuebox/issues/26), [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92); communication gaps [#95](https://github.com/BlackLodgeLabs/cuebox/issues/95).

## Acceptance criteria

- [ ] **MCP adoption map** added to `workflow/cursor-workflow/WORKFLOW.md` and `SETUP.md`: per stage, which operations use MCP vs GitHub Actions
- [ ] **`workflow/cursor-workflow/MCP-GITHUB.md`** created: tool mapping (`gh` → MCP), idempotency HTML markers (`<!-- cursor-mcp-*:v1 -->`), @mention rules (align with #95 when landed), fallback when MCP unavailable
- [ ] **Skills updated** (`review-and-spec`, `planning`, `demo`, `babysit-pr`, `execute`, `workflow-review`): prefer GitHub MCP when tools are listed; graceful fallback to push + Actions
- [ ] **Spec/plan `*-needs-info`**: agents post numbered questions via MCP `add_issue_comment` and set labels via MCP `issue_write` immediately; still push `workflow.state.json`
- [ ] **`blocked` stage**: demo and babysit post summary comments on issue **and** PR via MCP
- [ ] **Demo**: PR comment with scenario pass/fail summary via MCP after `demo-ready` or `blocked`
- [ ] **Babysit**: read PR checks/reviews via MCP `pull_request_read`; document replacements for `gh pr view`
- [ ] **Execute `pr: null`**: issue comment via MCP with manual handoff resync steps
- [ ] **SETUP.md**: GitHub MCP required for workflow Cloud Agents; link to verification test
- [ ] **`verify-workflow-paths.sh`** passes; handoff YAML spawn logic unchanged
- [ ] **Dogfood**: this workflow run posts at least one MCP comment on GitHub before the `spec-ready` state push (spec completion comment on issue #105)

## Scope

### In scope

| Area | Today | Target |
|------|-------|--------|
| Spec/plan human questions | `gh` fails; labels after push | MCP `add_issue_comment` + `issue_write` labels immediately |
| `blocked` notifications | Push only | Issue + PR comments via MCP |
| Demo PR summary | `demo-notes.md` only | PR comment via MCP |
| Babysit triage | `gh pr view` / `gh api` | MCP `pull_request_read` (get, get_check_runs, get_reviews, get_review_comments) |
| Execute stuck (no PR) | Commit message note | Issue comment via MCP |
| workflow-review | `gh` forensics | MCP read tools |
| Docs | "cannot post comments" | "use MCP when configured" |
| `scripts/verify-workflow-paths.sh` | — | Register `MCP-GITHUB.md`; optional MCP smoke test script |

**Optional phase 2** (document in `MCP-GITHUB.md`, implement only if time permits in execute):

- Draft PR via MCP `create_pull_request` when `pr` is null (today Actions-only at `spec-ready`)
- PR body update via MCP `update_pull_request` after `PR.md` commit (belt-and-suspenders vs Actions sync)

### Out of scope

- Replacing `workflow.state.json` handoff contract or Action-triggered `POST /v1/agents`
- Removing Actions status-comment sync (`status_comment_id` cache)
- Removing Actions complete / stalled notifications without coordinating [#95](https://github.com/BlackLodgeLabs/cuebox/issues/95)
- Repo `.cursor/mcp.json` as Cloud source of truth (dashboard HTTP MCP stays required)
- PAT `@cursoragent` fallback removal (#95)
- Application code changes (API, frontend, database)

## User flows / API changes

No product UI or API changes. Operator and agent behaviour on GitHub:

### Operators

1. Clarification requests on issues appear **immediately** (numbered questions + `cursor:spec-needs-info` / `cursor:plan-needs-info` label) without waiting for handoff Action
2. `blocked` issues show issue **and** PR comments with loop counters and last error
3. Demo adds a PR comment with scenario summary and artifact paths (raw GitHub URLs)
4. Stuck-without-PR runs get an issue comment with recovery steps (Actions → handoff resync, ensure draft PR)
5. Complete notification stays with GitHub Actions / #95 — babysit does **not** duplicate via MCP

### Agents

1. At skill start, check MCP availability (`GetMcpTools` for `github` server with `serverStatus: ready`)
2. For mapped operations, use MCP first; on auth/unavailable, fall back to commit + push (existing behaviour)
3. Always push `workflow.state.json` for stage transitions
4. MCP comments include idempotency HTML markers; agents search existing comments before posting duplicates

### Per-stage MCP map

| Stage | Skill | MCP (add) | Actions (unchanged) |
|-------|-------|-----------|---------------------|
| 2 / 2b | `review-and-spec` | Read comments (`issue_read`); post questions (`add_issue_comment`); `spec-needs-info` label (`issue_write`) | Spawn planning at `spec-ready`; draft PR; label sync on push |
| 3 | `planning` | `plan-needs-info` questions + label | Spawn execute at `plan-ready` |
| 4 | `execute` | Issue comment when `pr` is null | Spawn demo; label sync |
| 5 | `demo` | PR scenario summary; `blocked` issue+PR comments | Spawn create-pr; pass-back spawn |
| 6 | `create-pr` | Optional: `update_pull_request` body from `PR.md` | Sync PR body from `PR.md`; spawn babysit |
| 7 | `babysit-pr` | Read checks/reviews; `blocked` comments | Mark ready; `complete` notification |
| — | `workflow-review` | MCP forensics (issues, PRs, checks, comments) | — |

## Data and integration notes

- **Application DB/API:** none
- **GitHub:** more issue/PR comments on workflow issues (mitigated by idempotency markers in `MCP-GITHUB.md`)
- **Cursor Cloud:** GitHub MCP must remain enabled on the Cuebox environment (dashboard HTTP MCP config)
- **Secrets:** no new Actions secrets; PAT lives in Cursor dashboard MCP config
- **Coordination with #95:** @mention rules in `MCP-GITHUB.md` should reference `cursor-workflow-resolve-notify-targets.sh` when #95 lands; until then, agents @mention issue author via `issue_read` and repo owner via `get_me` / repository metadata — no hardcoded usernames

### MCP tool mapping (summary — full detail in `MCP-GITHUB.md`)

| Workflow need | MCP tool | Replaces |
|---------------|----------|----------|
| Post issue comment | `add_issue_comment` | `gh issue comment` |
| Post PR comment | `add_issue_comment` (PR number as `issue_number`) | `gh pr comment` |
| Set issue labels | `issue_write` method `update` | `gh issue edit --add-label` |
| Read issue + comments | `issue_read` | `gh issue view` |
| PR details | `pull_request_read` method `get` | `gh pr view` |
| CI check runs | `pull_request_read` method `get_check_runs` | `gh pr checks` |
| Review threads | `pull_request_read` method `get_review_comments` | `gh api` |
| PR reviews | `pull_request_read` method `get_reviews` | `gh pr view --json reviews` |
| Update PR body (phase 2) | `update_pull_request` | `gh pr edit --body-file` |
| Create draft PR (phase 2) | `create_pull_request` draft=true | Actions-only today |

### Idempotency markers

All MCP-posted comments must include a hidden HTML marker as the last line:

```html
<!-- cursor-mcp-{purpose}:v1 -->
```

| Purpose | Marker | Used by |
|---------|--------|---------|
| Spec questions | `<!-- cursor-mcp-spec-questions:v1 -->` | review-and-spec |
| Plan questions | `<!-- cursor-mcp-plan-questions:v1 -->` | planning |
| Demo summary | `<!-- cursor-mcp-demo-summary:v1 -->` | demo |
| Blocked notice | `<!-- cursor-mcp-blocked:v1 -->` | demo, babysit-pr |
| Execute no-PR recovery | `<!-- cursor-mcp-execute-no-pr:v1 -->` | execute |
| Spec complete | `<!-- cursor-mcp-spec-ready:v1 -->` | review-and-spec |

Before posting, read existing comments and skip if marker already present.

### Verification

Add to `SETUP.md` and optionally `scripts/test-cursor-workflow-mcp-github.sh`:

1. Cloud agent confirms `GetMcpTools` returns `github` with `serverStatus: ready`
2. `add_issue_comment` on a test issue or workflow issue with marker
3. `issue_write` label add/remove on a test issue

Registered in `verify-workflow-paths.sh` (script presence + doc links).

## Open questions (must be empty before plan-ready)

None.

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/105
- Related: [#95 Workflow communication updates](https://github.com/BlackLodgeLabs/cuebox/issues/95)
- Workflow reviews: [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79), [#26](https://github.com/BlackLodgeLabs/cuebox/issues/26), [#92](https://github.com/BlackLodgeLabs/cuebox/issues/92)
- Existing branch with partial work (if any): `origin/cursor/github-mcp-workflow-integration-d223` — planning should diff and merge useful content
