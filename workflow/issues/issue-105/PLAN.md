# Implementation plan — Issue #105

Adopt GitHub MCP for human-visible GitHub writes and reads across Cursor workflow skills while preserving `workflow.state.json` handoffs and GitHub Actions spawning.

## Overview

Cloud Agents now have a hosted **GitHub MCP** server (`https://api.githubcopilot.com/mcp/`) with a fine-grained PAT. Workflow skills currently tell agents to treat GitHub writes as best-effort (`gh` often fails with `Resource not accessible by integration`) and rely on push + Actions for labels, status comments, and notifications. This leaves operators blind to clarification questions, `blocked` summaries, demo results, and stuck-without-PR recovery until the next state push.

Execute will:

1. Add **`workflow/cursor-workflow/MCP-GITHUB.md`** — canonical tool mapping, idempotency markers, @mention rules, MCP availability check, and fallback policy.
2. Update **`WORKFLOW.md`** and **`SETUP.md`** with a per-stage MCP vs Actions adoption map.
3. Update **six skills** to prefer MCP for mapped operations with graceful push-only fallback.
4. Add **`scripts/test-cursor-workflow-mcp-github.sh`** (offline doc/skill checks) and extend **`verify-workflow-paths.sh`** to register `MCP-GITHUB.md` and the test script.
5. Leave **handoff YAML spawn logic unchanged** — `POST /v1/agents`, status-comment sync, draft PR creation, and complete notification stay in Actions.

**Phase 2 (optional, time-boxed):** document in `MCP-GITHUB.md` only unless trivial during execute — `create_pull_request` when `pr` is null; `update_pull_request` body belt-and-suspenders after `PR.md` commit.

**Prior art:** `origin/cursor/github-mcp-workflow-integration-d223` contains an `ISSUE-DESCRIPTION.md` draft; useful for wording but no implementation to merge. This issue branch already has the authoritative `SPEC.md`.

## Reproduction findings

Not an application bug — workflow/operator visibility gap. Confirmed by static review:

| Symptom | Evidence |
|---------|----------|
| Spec/plan questions invisible until push | `review-and-spec` / `planning` skills: "do not fail" when `gh` denied; labels via Actions only |
| `blocked` silent on GitHub | `babysit-pr` / `demo` skills request issue+PR comments agents cannot post |
| Demo summary only in repo | `demo` skill: PR comment step exists but no MCP path |
| Babysit triage via CLI | `babysit-pr` / `workflow-review` reference `gh pr view` / `gh api` |
| Execute stuck `pr: null` | `execute` skill: recovery buried in commit message |

GitHub MCP is **available in this cloud VM** (`GetMcpTools` → `github`, `serverStatus: ready`).

## Root cause

Workflow was designed around App integration token limits. GitHub MCP (dashboard HTTP PAT) removes those limits for issue/PR comments, labels, and PR reads — but skills and docs were never updated to use it.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `workflow/cursor-workflow/MCP-GITHUB.md` | **New** | Canonical MCP guide: tools, markers, @mentions, availability, fallback |
| `workflow/cursor-workflow/WORKFLOW.md` | Edit | Per-stage MCP vs Actions table; link to `MCP-GITHUB.md` |
| `workflow/cursor-workflow/SETUP.md` | Edit | GitHub MCP required for workflow agents; verification steps |
| `.cursor/skills/review-and-spec/SKILL.md` | Edit | MCP for questions, labels, spec-ready comment; read comments |
| `.cursor/skills/planning/SKILL.md` | Edit | MCP for plan-needs-info questions + label |
| `.cursor/skills/execute/SKILL.md` | Edit | MCP issue comment when `pr: null` |
| `.cursor/skills/demo/SKILL.md` | Edit | MCP PR summary + blocked issue/PR comments |
| `.cursor/skills/babysit-pr/SKILL.md` | Edit | MCP read checks/reviews; blocked comments; keep Actions for `complete` |
| `.cursor/skills/workflow-review/SKILL.md` | Edit | MCP forensics replacing `gh` reads |
| `scripts/test-cursor-workflow-mcp-github.sh` | **New** | Offline regression: doc links, marker table, skill MCP references |
| `scripts/verify-workflow-paths.sh` | Edit | Register `MCP-GITHUB.md`, test script, keyword checks |
| `AGENTS.md` | Edit (optional) | Cross-link `MCP-GITHUB.md` in workflow section |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| `.github/workflows/cursor-workflow-handoff.yml` | Spec: spawn logic unchanged |
| `scripts/cursor-workflow-spawn-agent.sh` | Actions-only spawning |
| `scripts/cursor-workflow-sync-github-status.sh` | Authoritative status comment + label sync |
| `scripts/cursor-workflow-notify-complete.sh` | Complete notification (#95 coordination) |
| `.cursor/skills/create-pr/SKILL.md` | Not in spec skill list; PR body sync stays Actions |

## Implementation steps

### Step 1 — `MCP-GITHUB.md`

Create `workflow/cursor-workflow/MCP-GITHUB.md` with:

1. **Availability check** — at skill start: `GetMcpTools` with `server: github`; proceed with MCP when `serverStatus` is `ready`; else fall back to push + Actions (no task failure).
2. **Repo context** — resolve `owner`/`repo` from `git remote get-url origin` or `issue_read` / environment; call `get_me` when permissions unclear.
3. **Tool mapping table** (from SPEC) — `gh` → MCP tool + parameters.
4. **Idempotency markers** — HTML comment as last line of every MCP-posted body:

   | Purpose | Marker | Skills |
   |---------|--------|--------|
   | Spec questions | `<!-- cursor-mcp-spec-questions:v1 -->` | review-and-spec |
   | Plan questions | `<!-- cursor-mcp-plan-questions:v1 -->` | planning |
   | Spec complete | `<!-- cursor-mcp-spec-ready:v1 -->` | review-and-spec |
   | Demo summary | `<!-- cursor-mcp-demo-summary:v1 -->` | demo |
   | Blocked notice | `<!-- cursor-mcp-blocked:v1 -->` | demo, babysit-pr |
   | Execute no-PR recovery | `<!-- cursor-mcp-execute-no-pr:v1 -->` | execute |
   | MCP smoke test | `<!-- cursor-mcp-test:v1 -->` | SETUP verification |

5. **Idempotency procedure** — before posting: `issue_read` method `get_comments` (issue) or `pull_request_read` method `get_comments` (PR); skip if marker present.
6. **@mention rules** — until #95 lands: @mention issue author from `issue_read` method `get`; repo owner from `get_me` or repository metadata. Reference `cursor-workflow-resolve-notify-targets.sh` as future source of truth when #95 merges.
7. **Fallback policy** — MCP auth/unavailable → commit + push `workflow.state.json`; Actions sync labels/status on next push. Never fail the skill solely because MCP is down.
8. **Phase 2 appendix** — `create_pull_request` (draft) when `pr` is null; `update_pull_request` after `PR.md` — implement only if time permits.

### Step 2 — `WORKFLOW.md` adoption map

Add section **GitHub MCP adoption** (after State file or Visibility):

- Link to `MCP-GITHUB.md`
- Table from SPEC § Per-stage MCP map (skills 2–7 + workflow-review)
- Clarify **Actions remain authoritative** for: handoff spawn, pinned status comment (`status_comment_id`), draft PR at `spec-ready`, complete notification
- Update visibility section: agents **can** post via MCP when configured; push still required for stage transitions

### Step 3 — `SETUP.md`

In §5 Cloud agent environment:

- Add checklist item: **GitHub MCP** enabled (dashboard HTTP MCP → `https://api.githubcopilot.com/mcp/`)
- Replace "Cloud agents often cannot set labels or post comments" with MCP-first guidance + Actions fallback
- Link verification: `bash scripts/test-cursor-workflow-mcp-github.sh` and manual MCP smoke (`add_issue_comment` with `<!-- cursor-mcp-test:v1 -->`)

### Step 4 — Skill updates

Each skill gets a short **GitHub MCP** subsection referencing `MCP-GITHUB.md`. Pattern:

```
1. GetMcpTools → github ready?
2. If yes: MCP for mapped ops (check markers first)
3. Always: merge-state + push workflow.state.json
4. If MCP fails: log in commit/demo-notes; rely on Actions sync
```

**`review-and-spec`**

- `spec-needs-info`: MCP `add_issue_comment` (numbered questions + `cursor-mcp-spec-questions:v1`) + `issue_write` method `update` with `labels: ["cursor:spec-needs-info"]`
- `spec-ready`: optional MCP `add_issue_comment` with spec summary + `cursor-mcp-spec-ready:v1` (dogfood criterion)
- Read prior answers: `issue_read` method `get_comments`
- Remove "do not fail when gh denied" as primary path; MCP is primary

**`planning`**

- `plan-needs-info`: MCP questions + `cursor:plan-needs-info` label (same pattern as spec)
- Remove instruction to post numbered GitHub issue comment only via `gh`

**`execute`**

- When `pr` is null after push: MCP `add_issue_comment` on issue with recovery steps (Actions → handoff resync → ensure draft PR) + `cursor-mcp-execute-no-pr:v1`
- Keep "do not `gh pr create`" — draft PR stays Actions (phase 2 optional MCP create)

**`demo`**

- After `demo-ready` or `blocked` push: MCP `add_issue_comment` on PR (`issue_number` = PR num) with scenario pass/fail table + artifact paths + `cursor-mcp-demo-summary:v1`
- On `blocked`: also MCP comment on issue with `cursor-mcp-blocked:v1` (loop counters, failure summary)

**`babysit-pr`**

- Triage: `pull_request_read` methods `get`, `get_check_runs`, `get_reviews`, `get_review_comments` (replace `gh pr view` / `gh api` in skill text)
- On `blocked`: MCP issue + PR comments with `cursor-mcp-blocked:v1`
- On `complete`: **do not** MCP-post issue comment — Actions `notify-complete` handles it
- Mark ready: `update_pull_request` method with `draft: false` **or** keep existing path if MCP cannot set ready (document which works in MCP-GITHUB.md during execute)

**`workflow-review`**

- Replace `gh pr view` / `gh api` forensics with MCP `issue_read`, `pull_request_read`, `list_commits` as needed
- Preconditions: prefer MCP over `gh` CLI

### Step 5 — `test-cursor-workflow-mcp-github.sh`

Offline shell test (no live MCP call required in CI):

| Check | Method |
|-------|--------|
| `MCP-GITHUB.md` exists | file test |
| All six markers documented | grep |
| Tool mapping table present | grep key tools |
| Each updated skill references `MCP-GITHUB.md` | grep skill files |
| `WORKFLOW.md` mentions MCP adoption | grep |
| `SETUP.md` mentions GitHub MCP | grep |

Exit 0 on pass; add to `HANDOFF_SCRIPTS` or a dedicated block in `verify-workflow-paths.sh` and run in shell-test section.

Optional **live smoke** (document in SETUP, run manually on cloud VM):

```text
GetMcpTools → github ready
add_issue_comment on test/workflow issue with <!-- cursor-mcp-test:v1 -->
issue_write label add/remove
```

### Step 6 — `verify-workflow-paths.sh`

Add checks:

- `workflow/cursor-workflow/MCP-GITHUB.md` exists
- `MCP-GITHUB.md` contains idempotency marker section and `GetMcpTools`
- `WORKFLOW.md` contains `MCP-GITHUB.md` and adoption map keywords
- `SETUP.md` contains `GitHub MCP`
- `scripts/test-cursor-workflow-mcp-github.sh` executable
- Run `bash scripts/test-cursor-workflow-mcp-github.sh` in shell-test block

### Step 7 — `AGENTS.md` (optional, small)

Add one line under Cursor issue workflow table: link to `workflow/cursor-workflow/MCP-GITHUB.md` for GitHub MCP usage.

## Tests required

| Test | Maps to acceptance criterion |
|------|------------------------------|
| `bash scripts/test-cursor-workflow-mcp-github.sh` | MCP helper pattern, doc links, skill references |
| `bash scripts/verify-workflow-paths.sh` | Regression passes; `MCP-GITHUB.md` registered; handoff YAML unchanged |
| Manual / demo: `GetMcpTools` → github `ready` | SETUP verification |
| Manual / demo: MCP comment visible on issue #105 or PR #107 | Dogfood criterion |
| Grep: handoff YAML diff empty for spawn logic | "handoff YAML spawn logic unchanged" |
| Skill review: each of 6 skills has MCP subsection + fallback | Skills updated |

No API, frontend, or Docker stack tests required (workflow-only scope).

## Gate script

```bash
bash scripts/verify-workflow-paths.sh
```

No phase gate (no `api/` or `frontend/` changes). Record in `demo-notes.md` and `PR.md` Gate evidence:

```text
Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>
```

## Documentation updates

| File | Update |
|------|--------|
| `workflow/cursor-workflow/MCP-GITHUB.md` | New — primary deliverable |
| `workflow/cursor-workflow/WORKFLOW.md` | MCP adoption map |
| `workflow/cursor-workflow/SETUP.md` | MCP required + verification |
| `AGENTS.md` | Optional cross-link |
| Six skill `SKILL.md` files | MCP instructions |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Duplicate comments on re-run | Idempotency markers + read-before-post |
| MCP unavailable in some environments | Graceful fallback; skills must not fail |
| Label drift (MCP + Actions both set labels) | MCP sets needs-info/blocked immediately; Actions reconciles on push — acceptable |
| Babysit marks PR ready via MCP incorrectly | Document exact `update_pull_request` params; test on draft PR #107 |
| Scope creep into Actions replacement | Explicit unchanged-file list; no handoff YAML edits |
| #95 @mention divergence | MCP-GITHUB.md references future `resolve-notify-targets.sh` |

**Rollback:** Revert skill/doc commits; `verify-workflow-paths.sh` still passes if new checks are additive and removed with revert.

## Definition of done

- [ ] `workflow/cursor-workflow/MCP-GITHUB.md` committed with tool map, markers, @mentions, fallback
- [ ] `WORKFLOW.md` and `SETUP.md` include per-stage MCP vs Actions map
- [ ] Skills updated: `review-and-spec`, `planning`, `execute`, `demo`, `babysit-pr`, `workflow-review`
- [ ] `scripts/test-cursor-workflow-mcp-github.sh` passes
- [ ] `bash scripts/verify-workflow-paths.sh` exit 0
- [ ] `.github/workflows/cursor-workflow-handoff.yml` spawn logic unchanged (no diff or comment-only)
- [ ] Demo artifacts show MCP comment on GitHub (issue #105 / PR #107) and `verify-workflow-paths.sh` evidence
- [ ] `workflow.state.json` at `execute-ready` with `loops.total_runs` incremented
- [ ] Phase 2 items documented in `MCP-GITHUB.md` appendix (implement only if explicitly done)
