# Issue #105 — GitHub MCP workflow integration

**Template:** Cursor feature · **Create with:** `gh issue create` (see bottom)

---

## Problem / goal

Cloud Agents now have **GitHub MCP** configured (hosted `https://api.githubcopilot.com/mcp/` with a fine-grained PAT). They can post issue comments, set labels, read PR review threads, and perform other GitHub writes that previously failed with the App integration token (`Resource not accessible by integration`).

The Cursor workflow still documents and implements a **push-only GitHub interface**: agents commit `workflow.state.json` and rely on `.github/workflows/cursor-workflow-handoff.yml` to sync labels, status comments, PR bodies, and human notifications. Skills tell agents *not to fail* when `gh issue comment` is denied and to avoid posting comments entirely (e.g. babysit at `complete`).

This issue tracks **where to adopt GitHub MCP in the workflow** — improving human visibility, reducing “silent failure” workarounds, and narrowing reliance on PAT-fallback handoff comments — **without** replacing `workflow.state.json` handoffs or GitHub Actions agent spawning (`CURSOR_API_KEY`).

Evidence: [#79 HANDOFF-HARDENING-NOTES](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md), [#26](https://github.com/BlackLodgeLabs/cuebox/blob/65697ccd41abda1a2f7261f92e6cb4234d6e2b80/workflow/issues/issue-26/WORKFLOW-REVIEW.md), [#92](https://github.com/BlackLodgeLabs/cuebox/blob/0c1aeae/workflow/issues/issue-92/WORKFLOW-REVIEW.md) workflow reviews; [issue #95](https://github.com/BlackLodgeLabs/cuebox/issues/95) communication gaps.

---

## Acceptance criteria

- [ ] **MCP adoption map** documented in `workflow/cursor-workflow/WORKFLOW.md` and `SETUP.md`: per stage, which GitHub actions move to MCP vs stay in Actions (table below is the spec baseline).
- [ ] **Skills updated** (`review-and-spec`, `planning`, `demo`, `babysit-pr`, `execute`, `workflow-review`): when GitHub MCP tools are available, use them for the mapped operations; graceful fallback to push-only + Actions when MCP is absent (no task failure).
- [ ] **Shared MCP helper pattern** in skills or a short `workflow/cursor-workflow/MCP-GITHUB.md`: tool names, idempotency markers (`<!-- cursor-mcp-*:v1 -->`), @mention rules (align with #95 dynamic owner resolution when that lands).
- [ ] **Stage 2/2b (spec)** and **stage 3 (plan)** agents post numbered clarification questions via MCP `add_issue_comment` and set `cursor:spec-needs-info` / `cursor:plan-needs-info` labels via MCP when blocked on human input.
- [ ] **`blocked` terminal stage**: demo and babysit agents post summary comments on **both** the linked issue and PR via MCP (today babysit skill says “comment on issue + PR” but integration token often cannot).
- [ ] **Demo stage**: agent posts a PR comment summarizing demo artifacts (paths, pass/fail counts) via MCP after `demo-ready` or `blocked` push.
- [ ] **Babysit stage**: agent reads PR checks, review threads, and Bugbot context via MCP read tools (supplement `gh pr view`); documents which tools replaced CLI calls.
- [ ] **Execute stuck-without-PR path**: when `workflow.state.json` has `pr: null`, agent posts an issue comment via MCP with recovery steps (Actions → handoff → ensure draft PR) instead of only noting in commit message.
- [ ] **SETUP.md** Cloud section: GitHub MCP required for workflow agents (dashboard HTTP config); link to verification test (`add_issue_comment` with `<!-- cursor-mcp-test -->` marker).
- [ ] **Regression**: `bash scripts/verify-workflow-paths.sh` passes; no change to handoff YAML spawn logic unless explicitly scoped (out of scope below).
- [ ] **Dogfood**: one workflow-only issue run demonstrates MCP-posted spec question or blocked comment visible on GitHub before the next state push.

---

## Scope

### In scope

| Area | Current workaround | Recommended MCP use |
|------|-------------------|---------------------|
| **Human questions** (spec/plan `*-needs-info`) | “Best effort” `gh issue comment`; often fails; labels only after push → Actions | **`add_issue_comment`** with numbered questions + **`update_issue`** labels immediately; still push `workflow.state.json` |
| **`blocked` notifications** | Push state; hope Actions syncs; babysit skill asks for issue+PR comments agents cannot post | **`add_issue_comment`** on issue + **`add_issue_comment`** on PR with loop counters and last error |
| **Demo PR summary** | Artifact paths only in committed `demo-notes.md` | **`add_issue_comment`** on PR with scenario table + links to `demo/` paths |
| **Babysit triage** | `gh pr view`, `gh api` for checks/reviews | **`pull_request_read`**, **`get_pull_request`**, review/check tools where available |
| **Execute / PR missing** | Commit message note only | **Issue comment** via MCP with manual resync instructions |
| **workflow-review forensics** | `gh pr view`, `gh api` | MCP read tools for issue/PR/Action context |
| **Documentation** | “Cloud agents cannot post labels/comments” | “Use GitHub MCP when configured; else push + Actions” |
| **#95 genuine-question scenario** | “Best effort” issue comment | **Primary path: MCP `add_issue_comment`** with @mentions |

### In scope (optional / phase 2 — implement only if low-risk in execute)

| Area | Current workaround | Recommended MCP use |
|------|-------------------|---------------------|
| **Draft PR creation** | Actions at `spec-ready` only; agents cannot `gh pr create` | **`create_pull_request`** (draft) when `pr` is null after spec — reduces stuck runs; must record PR in state via merge helper |
| **PR body from `PR.md`** | Actions `cursor-workflow-update-pr-body.sh` on push | Agent **`update_pull_request`** after final `PR.md` commit as belt-and-suspenders |

### Out of scope

- **Replacing** `workflow.state.json` as the handoff contract or removing push-triggered handoff Action runs.
- **Replacing** `POST /v1/agents` spawning with MCP (MCP cannot spawn the next workflow agent).
- **Removing** Actions status-comment sync (`cursor-workflow-sync-github-status.sh`) — keep Actions as **authoritative** for the pinned “Cursor workflow — issue #NNN” comment and `status_comment_id` cache.
- **Removing** Actions complete notification entirely without coordinating with [#95](https://github.com/BlackLodgeLabs/cuebox/issues/95) (owner @mentions, stalled notifier, PAT fallback deprecation).
- **Repo-committed `.cursor/mcp.json`** as the Cloud Agent source of truth (dashboard HTTP MCP remains required per Cursor platform behavior).
- **Automations / PAT `@cursoragent` fallback** removal (tracked in #95).
- **Application code** (API, frontend, DB).

---

## User-visible behavior

### Operators (humans on GitHub)

1. **Clarification requests** appear on the issue **immediately** when spec/plan agents block — numbered questions, `cursor:spec-needs-info` or `cursor:plan-needs-info` label — without waiting for the next `workflow.state.json` push and handoff Action run.
2. **`blocked` issues** show a clear issue comment and matching PR comment with loop counters and the last failure — not only a label drift after Actions sync.
3. **Demo completion** adds a PR comment with scenario pass/fail summary and artifact paths (in addition to committed `demo-notes.md`).
4. **Stuck without draft PR** surfaces an issue comment with explicit recovery steps when execute finds `pr: null`.
5. **Complete notification** remains owned by GitHub Actions (or #95 extended notifier) — babysit agents do not duplicate “ready for review” posts via MCP unless #95 explicitly moves that.

### Cloud agents

1. Skills instruct: **if GitHub MCP tools are listed**, use them for the mapped writes/reads; **else** retain current push-only behavior.
2. Agents **still** push `workflow.state.json` for every stage transition (handoff contract unchanged).
3. MCP writes use **idempotency HTML markers** in comments to avoid duplicates on agent retries (same pattern as `cursor-workflow-complete-notify`).

---

## Data / integration impact

- **None** for application DB/API.
- **GitHub**: additional issue/PR comments and label updates from agents (higher comment volume on workflow issues; mitigated by markers and scoped to `cursor/issue-*` workflow).
- **Cursor Cloud**: GitHub MCP must stay enabled on the Cuebox environment for workflow agent runs (dashboard HTTP PAT config).
- **Secrets**: no new GitHub Actions secrets required for agent MCP (PAT lives in Cursor dashboard). Optional: same PAT as `CURSOR_HANDOFF_GITHUB_TOKEN` for Actions fallback remains independent.
- **CI**: `verify-workflow-paths.sh` + skill doc lint only; no new application gates.

---

## Recommended implementation plan (for spec agent)

### Phase 1 — Docs + skills (low risk)

1. Add `workflow/cursor-workflow/MCP-GITHUB.md` (tool mapping, markers, fallback rules).
2. Update `WORKFLOW.md` §Visibility and `SETUP.md` §Cloud agent environment.
3. Update skills: `review-and-spec`, `planning`, `demo`, `babysit-pr`, `execute`, `workflow-review`.
4. Cross-link [#95](https://github.com/BlackLodgeLabs/cuebox/issues/95) for stalled/complete notification ownership.

### Phase 2 — Agent behavior (medium risk)

1. Spec/plan: MCP post on `*-needs-info`.
2. Demo/babysit: MCP post on `blocked`.
3. Demo: MCP PR summary comment on `demo-ready` / `blocked`.
4. Babysit: MCP-first read for PR state.

### Phase 3 — Optional hardening

1. Execute/create-pr: draft PR + PR body via MCP when Actions lag (feature-flag in skill: “only if `pr` null after spec-ready push”).
2. Add `scripts/verify-github-mcp-workflow-hints.sh` (static check that skills reference MCP-GITHUB.md).

---

## Per-stage workflow map (end-to-end)

| Stage | Skill | Handoff trigger (unchanged) | **Add MCP** |
|-------|-------|----------------------------|-------------|
| 1 | Human | Create issue | — |
| 2 | `review-and-spec` | Human `@cursoragent spec` | Read issue comments; post questions; set `spec-needs-info` label |
| 2b | `review-and-spec` | `continue spec` | Read answers; clear/update labels |
| 3 | `planning` | `spec-ready` → Action spawns | Post plan-needs-info questions; bug-repro blocked comments |
| 4 | `execute` | `plan-ready` | Issue comment if `pr` null; read PR/issue for context |
| 5 | `demo` | `execute-ready` | PR demo summary; blocked issue+PR comments |
| 6 | `create-pr` | `demo-ready` | Optional: `update_pull_request` body from `PR.md` |
| 7 | `babysit-pr` | `create-pr-ready` | Read checks/reviews; blocked issue+PR comments; **not** complete notification |
| 8 | Human | Merge | — |
| — | `workflow-review` | Human `@cursoragent workflow-review` | Read issue/PR/comment history via MCP |

**Unchanged in Actions:** spawn next agent, sync status comment from state, ensure draft PR at `spec-ready`, complete notifier, label sync on every push (dedupe with agent-set labels via same label names).

---

## References

- [WORKFLOW.md](../../cursor-workflow/WORKFLOW.md)
- [SETUP.md](../../cursor-workflow/SETUP.md)
- [RETROSPECTIVES.md](../../cursor-workflow/RETROSPECTIVES.md) — PAT fallback, label drift, “cannot post comments”
- [Issue #95 — Workflow communication updates](https://github.com/BlackLodgeLabs/cuebox/issues/95)
- [Issue #79 workflow review / HANDOFF-HARDENING-NOTES](https://github.com/BlackLodgeLabs/cuebox/blob/a36d91eb0889f86f25e2a98f530a900c83ef4408/workflow/issues/issue-79/WORKFLOW-REVIEW.md)
- [Cursor Cloud MCP capabilities](https://cursor.com/docs/cloud-agent/capabilities)

---

## Create this issue

```bash
gh issue create --repo BlackLodgeLabs/cuebox \
  --title "[Workflow]: Adopt GitHub MCP in Cursor workflow agents" \
  --body-file workflow/issues/issue-105/ISSUE-DESCRIPTION.md
```

Then comment **`@cursoragent spec`** on the new issue.

**Created:** https://github.com/BlackLodgeLabs/cuebox/issues/105
