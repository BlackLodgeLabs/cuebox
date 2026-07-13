# Issue #111: Workflow human notifications (stalled, complete, agent communication)

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/111

## Summary

Introduce reliable, consistent human communication for the Cursor workflow across four scenarios: workflow complete, workflow stalled, genuine agent questions, and step failures (pass-back). Replace unreliable PAT `@cursoragent` fallback with Actions-owned stalled notifications; extend complete notifications to @mention both repo owner and issue author via a shared resolution helper; and update skills/docs so agents distinguish genuine product questions from code defects.

This is **issue 3 of 3** split from [#95](https://github.com/BlackLodgeLabs/cuebox/issues/95). Prerequisite: [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) (honest status labels on failed spawn) should land first so `pat_fallback` progress-label sync is not duplicated here.

## Problem

Operators and agents lack clear, timely GitHub communication when automation stops or needs human input:

| Symptom | Root cause |
|---------|------------|
| Complete notification only @mentions issue author | `cursor-workflow-notify-complete.sh` resolves author only |
| Terminal stalls are easy to miss | `pat_fallback()` posts filtered `@cursoragent` comments or nothing when `CURSOR_HANDOFF_GITHUB_TOKEN` is unset |
| False `*-in-progress` labels during stalls | Failed spawn paths historically synced progress labels (addressed in #110; verify here) |
| Agents conflate bugs with product questions | Skills lack explicit genuine-question vs pass-back rules |
| Deferral comments do not @mention anyone | Transient deferrals are passive; terminal deferrals end in PAT fallback |

Evidence: [issue #26 workflow review](https://github.com/BlackLodgeLabs/cuebox/blob/65697ccd41abda1a2f7261f92e6cb4234d6e2b80/workflow/issues/issue-26/WORKFLOW-REVIEW.md) (~7h stall with false `demo-in-progress`); [issue #99 workflow review](https://github.com/BlackLodgeLabs/cuebox/blob/81b08a2/workflow/issues/issue-99/WORKFLOW-REVIEW.md) (deferral + PAT comment; unclear trigger).

## Acceptance criteria

### Notification scripts (Actions-owned)

- [ ] `scripts/cursor-workflow-resolve-notify-targets.sh` resolves issue author + repo owner logins dynamically (no hardcoded usernames); deduplicates when same person
- [ ] `cursor-workflow-notify-complete.sh` @mentions **repo owner** and **issue author** via shared helper; existing idempotency marker `<!-- cursor-workflow-complete-notify:v1 -->` preserved; PR assignee behaviour unchanged
- [ ] `scripts/cursor-workflow-notify-stalled.sh` posts terminal failure notification with reason, recovery steps, idempotency marker `<!-- cursor-workflow-stalled-notify:v1 -->`
- [ ] Terminal defer reasons after `MAX_ATTEMPTS` (`execute-active`, `at-cap`, `api-400`, `pending-lock`) invoke stalled notifier — not only transient deferral comment
- [ ] `pat_fallback()` in `cursor-workflow-spawn-agent.sh` no longer posts `@cursoragent` comments — replaced by stalled notifier
- [ ] `cursor-workflow-passback-run.sh` removes PAT `@cursoragent` fallback; uses stalled notifier on failure
- [ ] Transient deferral comment behaviour unchanged (`cursor-workflow-post-deferral-comment.sh` — retry on next push)
- [ ] Honest status labels from [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) still hold: no `HANDOFF_PROGRESS_STAGE` sync on failed spawn
- [ ] New scripts registered in `cursor-workflow-load-scripts.sh` and `verify-workflow-paths.sh`

### Agent communication (MCP + skills)

- [ ] Skills updated (`review-and-spec`, `planning`, `demo`, `execute`, `babysit-pr`): genuine questions → MCP issue comment with @mentions + agent chat link + idempotency markers; step failures → pass-back only
- [ ] `workflow/cursor-workflow/WORKFLOW.md` documents all four communication scenarios; deprecates PAT fallback
- [ ] `workflow/cursor-workflow/SETUP.md` updated (secrets table, troubleshooting)
- [ ] `workflow/cursor-workflow/MCP-GITHUB.md` references `cursor-workflow-resolve-notify-targets.sh` as @mention source of truth
- [ ] `AGENTS.md` short pointer to communication rules

### Tests

- [ ] `scripts/test-cursor-workflow-handoff.sh` covers owner resolution, complete + stalled idempotency; updates #110 PAT-fallback tests to expect stalled notifier instead
- [ ] `bash scripts/verify-workflow-paths.sh` passes

## Scope

### In scope

| Area | Change |
|------|--------|
| `scripts/cursor-workflow-resolve-notify-targets.sh` | **New** — shared @mention target resolution |
| `scripts/cursor-workflow-notify-complete.sh` | Extend @mentions via helper |
| `scripts/cursor-workflow-notify-stalled.sh` | **New** — terminal failure notification |
| `scripts/cursor-workflow-spawn-agent.sh` | Replace `pat_fallback()` with stalled notifier |
| `scripts/cursor-workflow-passback-run.sh` | Stalled notifier on failure; remove PAT fallback |
| `scripts/cursor-workflow-load-scripts.sh` | Register new scripts |
| `scripts/verify-workflow-paths.sh` | Register new scripts |
| `scripts/test-cursor-workflow-handoff.sh` | New + updated tests |
| `.cursor/skills/{review-and-spec,planning,demo,execute,babysit-pr}/SKILL.md` | Genuine-question vs pass-back rules |
| `workflow/cursor-workflow/{WORKFLOW.md,SETUP.md,MCP-GITHUB.md}` | Documentation |
| `AGENTS.md` | Short pointer |

### Out of scope

- Clearing `active_skill` on `execute-ready` — [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109)
- False progress label fix (script-only) — [#110](https://github.com/BlackLodgeLabs/cuebox/issues/110) (prerequisite; verify only)
- Changing primary handoff path (`CURSOR_API_KEY` → `POST /v1/agents`)
- Replacing Actions status-comment sync or draft PR creation
- Org-level notify targets beyond `repo.owner.login`
- Application code, database, frontend

## User flows / API changes

No product UI or API changes. Operator and agent behaviour on GitHub:

### Communication scenarios

| Scenario | Trigger | Who acts | Notification |
|----------|---------|----------|--------------|
| **Complete** | `stage: complete` (babysit finished) | Human reviews PR | GitHub Action → `notify-complete.sh` |
| **Stalled** | Terminal handoff failure (retries exhausted, non-self-healing defer) | Human resumes manually | GitHub Action / spawn script → `notify-stalled.sh` |
| **Genuine question** | Agent cannot proceed without product/spec answer | Human replies on issue | Agent posts via MCP (best effort) |
| **Step failure** | Demo/execute finds bug or fixable defect | Previous agent (pass-back) | Pass-back in state + demo-notes only |

### Operators

1. **Complete:** Issue comment @mentions repo owner + issue author; links PR; assigns PR to issue author (once, idempotent marker)
2. **Stalled:** Issue comment @mentions repo owner + issue author with: issue #, branch, current `stage`, expected next skill, human-readable stall reason, manual recovery steps, optional link to last agent conversation from `workflow.state.json`
3. **Genuine questions:** Numbered questions on issue with both @mentions and agent chat link; `cursor:spec-needs-info` / `cursor:plan-needs-info` labels
4. **Step failures:** No human question; demo-notes pass-back section + `execute-passback` stage; Actions spawns pass-back via API

### Agents

1. **Genuine questions only** for product/spec ambiguity — never for code bugs, CI failures, or environment defects
2. Use MCP `add_issue_comment` with @mentions resolved via `issue_read` + repository metadata (or future helper parity); include `https://cursor.com/agents/<id>` link
3. **Pass-back:** set `stage`, `passback_to`, `passback_reason`; write `demo-notes.md`; push — do not ask human to fix
4. Babysit agents do **not** post complete notification (Actions owns it)

### `cursor-workflow-resolve-notify-targets.sh` contract

**Usage:**

```bash
# Output env vars (default) or JSON with --json
cursor-workflow-resolve-notify-targets.sh <issue-number> [--json]
```

**Resolves:**

- **Issue author** — `gh issue view <n> --json author -q '.author.login'`
- **Repo owner** — `gh api repos/{owner}/{repo}` → `.owner.login` (user or org login)

**Rules:**

- Emit `MENTIONS` line: `@author` only when author == owner; `@author @owner` when different
- Never hardcode GitHub usernames
- Exit non-zero if author cannot be resolved; warn (do not fail) if owner resolution fails and mention author only

**Consumers:** `notify-complete.sh`, `notify-stalled.sh`; skills reference same rules via MCP reads until they can shell-call the helper (document parity in `MCP-GITHUB.md`).

### `cursor-workflow-notify-stalled.sh` contract

**Usage:**

```bash
cursor-workflow-notify-stalled.sh <state-file> <reason> [expected-skill]
```

**When called:**

| Caller | Condition |
|--------|-----------|
| `cursor-workflow-spawn-agent.sh` | After `MAX_ATTEMPTS` exhausted for defer/post failure paths (replaces `pat_fallback`) |
| `cursor-workflow-passback-run.sh` | Pass-back API failed and no successful spawn |

**Terminal defer reasons** (post-retry, from `cursor-workflow-admission-gate.sh` / spawn logic):

| Reason | Why terminal | Recovery hint in body |
|--------|--------------|----------------------|
| `execute-active` | Execute finished at `execute-ready` but `active_skill` still `execute`; no further execute push expected | `@cursoragent use demo skill for issue NNN` (not re-run execute) — see [#109](https://github.com/BlackLodgeLabs/cuebox/issues/109) |
| `at-cap` | Global agent cap full after backoff | Wait for agents to finish or raise cap; workflow_dispatch resync |
| `api-400` | Cursor API quota/plan limit after retries | Check plan; workflow_dispatch resync |
| `pending-lock` | Pending-lock race unresolved after retries | workflow_dispatch resync |
| `missing-api-key` | No `CURSOR_API_KEY` and API spawn failed | Set `CURSOR_API_KEY` secret; workflow_dispatch resync |
| `passback-failed` | Pass-back `POST /v1/agents/{id}/runs` failed | Manual pass-back or spawn |

**Idempotency:** Check for `<!-- cursor-workflow-stalled-notify:v1 -->` in issue comments; if present, skip (same policy as complete notifier — one stalled notification per issue per stall episode). Repeated pushes with the same terminal stall do not spam.

**Body must include:**

1. @mentions (via helper)
2. Current `stage`, branch, expected next skill
3. Stall reason (human-readable)
4. Recovery steps:
   - Comment: `@cursoragent use <skill> skill for issue NNN on branch <branch>`
   - Or: Actions → **Cursor workflow handoff** → **Run workflow** with issue number
5. Optional: link to `agents.<skill>` from state (`https://cursor.com/agents/<id>`)
6. Marker as last line

**Does not:** call `cursor-workflow-sync-github-status.sh` with `HANDOFF_PROGRESS_STAGE` on failure.

### `cursor-workflow-notify-complete.sh` changes

- Source @mentions from `resolve-notify-targets.sh`
- Keep: PR link line, assign PR to issue author, marker `<!-- cursor-workflow-complete-notify:v1 -->`, exit 0 when `stage != complete`
- Example tone:

  > @issue-author @repo-owner — The cursor workflow for issue #NNN is complete. **PR #MMM** is ready for your final review.
  >
  > Branch: `cursor/issue-NNN-…` · Label: `cursor:complete`

### Spawn / pass-back script changes

**`pat_fallback()` removal:**

- Delete PAT `@cursoragent` comment posting
- Replace all `pat_fallback || true` call sites with `cursor-workflow-notify-stalled.sh` passing appropriate reason
- When `CURSOR_API_KEY` missing after retries: reason `missing-api-key`
- Preserve: no `HANDOFF_PROGRESS_STAGE` sync on failure (#110)
- Preserve: `cursor-workflow-post-deferral-comment.sh` on terminal paths for audit trail (passive, no @mentions) — stalled notifier is the human-visible alert

**`cursor-workflow-passback-run.sh`:**

- On API failure (non-409): call `notify-stalled.sh` with reason `passback-failed` instead of PAT comment
- Exit 1 when both API and notification fail (log warning if token missing)

### Skill updates (genuine question vs pass-back)

| Skill | Genuine question (MCP) | Step failure (pass-back) |
|-------|------------------------|--------------------------|
| `review-and-spec` | Numbered questions; `spec-needs-info`; marker `cursor-mcp-spec-questions:v1`; @mentions + agent link | N/A |
| `planning` | Numbered questions; `plan-needs-info`; marker `cursor-mcp-plan-questions:v1`; @mentions + agent link | N/A |
| `demo` | N/A (product ambiguity should be caught earlier) | `execute-passback`; demo-notes; no human question |
| `execute` | N/A | Fix defects; pass-back only via demo |
| `babysit-pr` | N/A | Loop limits → `blocked` with MCP comments (existing); not human fix requests |

**Genuine question comment template** (append marker last):

```markdown
@{author} @{owner} — I need clarification before proceeding on issue #NNN.

1. …
2. …

Reply on this issue, then comment `@cursoragent continue spec` (or `continue plan`).

If you need to chat more, talk to me [here](https://cursor.com/agents/<agent-id>).

<!-- cursor-mcp-spec-questions:v1 -->
```

**Pass-back** (demo skill — unchanged contract, made explicit):

1. Do **not** post "please fix" on issue
2. Write `## Pass-back to execute` in `demo-notes.md`
3. Set `stage: execute-passback`, `passback_to`, `passback_reason`
4. Push — Actions runs `passback-run.sh`
5. If pass-back API fails → stalled notifier, not human question

### Test plan (`test-cursor-workflow-handoff.sh`)

| Test | Assert |
|------|--------|
| `test_resolve_notify_targets_*` | Author + owner resolution; dedup when same login |
| `test_notify_complete_mentions_*` | Both @mentions in body; idempotent skip on second run |
| `test_notify_stalled_*` | Body contains reason, recovery, marker; idempotent skip |
| `test_spawn_stalled_no_progress_sync` | Replaces #110 `test_spawn_pat_fallback_*` — stalled notifier called, no PAT comment, no false progress sync |
| `test_passback_stalled_no_progress_sync` | Replaces #110 `test_passback_pat_fallback_*` — stalled notifier on API failure |

Mock `gh` patterns from existing handoff tests (`setup_mock_gh`).

## Data and integration notes

- **Application DB/API:** none
- **GitHub:** more issue comments on workflow issues (mitigated by idempotency markers)
- **Secrets:** stalled + complete notifiers use `GITHUB_TOKEN` / `GH_TOKEN` in Actions (existing); `CURSOR_HANDOFF_GITHUB_TOKEN` no longer required for PAT fallback (may remain for deferral comments until separately removed)
- **Prerequisite #110:** merge before or with this issue; tests renamed from PAT-fallback to stalled-notifier expectations
- **Coordination #105:** `MCP-GITHUB.md` @mention section updated to point at `resolve-notify-targets.sh` (replaces "until #95 lands" wording)
- **Coordination #109:** stalled `execute-active` recovery text references demo skill; clearing `active_skill` prevents the stall but is out of scope here

## Open questions (must be empty before plan-ready)

_None — issue body and [#95 split description](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/issues/issue-95/ISSUE-DESCRIPTION.md) provide sufficient detail._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/111
- Epic parent: https://github.com/BlackLodgeLabs/cuebox/issues/95
- Prerequisite: https://github.com/BlackLodgeLabs/cuebox/issues/110
- Related: https://github.com/BlackLodgeLabs/cuebox/issues/109 (active_skill clearing)
- MCP adoption: https://github.com/BlackLodgeLabs/cuebox/issues/105
- Evidence: [issue #26 review](https://github.com/BlackLodgeLabs/cuebox/blob/65697ccd41abda1a2f7261f92e6cb4234d6e2b80/workflow/issues/issue-26/WORKFLOW-REVIEW.md), [issue #99 review](https://github.com/BlackLodgeLabs/cuebox/blob/81b08a2/workflow/issues/issue-99/WORKFLOW-REVIEW.md)
- Current complete notifier: `scripts/cursor-workflow-notify-complete.sh`
- Current spawn fallback: `scripts/cursor-workflow-spawn-agent.sh` (`pat_fallback`)
