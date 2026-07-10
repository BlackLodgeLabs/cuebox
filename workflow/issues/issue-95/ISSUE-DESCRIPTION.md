# Issue #95 — Workflow communication updates

**Use this file to replace the GitHub issue description:** https://github.com/BlackLodgeLabs/cuebox/issues/95

---

## Summary

Improve how the Cursor workflow communicates with humans on GitHub issues. Four distinct scenarios need clear, consistent behaviour:

1. **Workflow complete** — notify humans that the PR is ready for review.
2. **Workflow stalled** — notify humans when automation has stopped and cannot resume on its own.
3. **Genuine agent questions** — an agent needs product/spec clarification that cannot be answered from the repo.
4. **Step failures** — a stage found a defect or environment problem; the workflow should pass back to the previous agent, **not** ask a human to fix it.

All human-facing notifications must @mention the **repo owner** and the **issue author** (when different). Usernames must be resolved dynamically from the GitHub API — **no hardcoded** `@BlackLodgeLabs` or other account names — so this scaffold works in other repositories.

---

## Background

### What works today

- **`cursor-workflow-notify-complete.sh`** posts a one-time comment when `stage: complete`, @mentions the **issue author**, assigns the linked PR, and uses an idempotency marker (`<!-- cursor-workflow-complete-notify:v1 -->`).
- **Pass-back** (`execute-passback`, demo → execute) is documented in skills and `WORKFLOW.md`; demo writes `## Pass-back to execute` in `demo-notes.md` and sets `passback_to` / `passback_reason` in `workflow.state.json`.
- **Transient handoff deferral** (`cursor-workflow-post-deferral-comment.sh`) posts a passive comment when spawn is deferred (agent cap, pending-lock); automation retries on the next push.

### What does not work reliably

- **`pat_fallback()`** in `cursor-workflow-spawn-agent.sh` posts `@cursoragent …` via `CURSOR_HANDOFF_GITHUB_TOKEN` when API spawn retries are exhausted. [WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md) already warns: *"Do not rely on bot `@cursoragent` comments for handoffs (filtered by GitHub/Cursor)."* If the PAT secret is unset, there is often **no issue comment at all**.
- **Complete notification** only @mentions the issue author — not the repo owner.
- **Skills** tell agents they often cannot post issue comments (token limits) but do not define a standard pattern for when they *should* ask humans genuine questions on the issue.
- **Deferral comments** do not @mention anyone; a terminal stall after retries exhaust is easy to miss.

Evidence from [issue #99 workflow review](https://github.com/BlackLodgeLabs/cuebox/blob/81b08a2/workflow/issues/issue-99/WORKFLOW-REVIEW.md): deferral + `@cursoragent` comment at 23:18 UTC; fix landed ~12 hours later on a subsequent push — unclear whether the comment triggered anything.

---

## Communication scenarios

| Scenario | Trigger | Who acts | Notification |
|----------|---------|----------|--------------|
| **Complete** | `stage: complete` (babysit finished) | Human reviews PR | GitHub Action posts issue comment |
| **Stalled** | Handoff spawn retries exhausted / permanent API failure | Human resumes workflow manually | GitHub Action posts issue comment |
| **Genuine question** | Agent cannot proceed without product/spec answer | Human replies on issue | Agent posts issue comment (best effort) |
| **Step failure** | Demo/execute finds bug or fixable defect | Previous agent (pass-back) | No human question; pass-back in state + demo-notes |

---

## Shared requirement: dynamic owner resolution

Introduce a shared helper (e.g. `cursor-workflow-resolve-notify-targets.sh` or a function used by all notify scripts) that returns:

- **Issue author** — `gh issue view <n> --json author`
- **Repo owner** — `gh api repos/{owner}/{repo}` → `.owner.login` (works for user and org repos; for orgs this is the org login — document if org repos need a different “notify” target later)

Rules:

- @mention both when they differ; @mention once when they are the same person.
- Never hardcode GitHub usernames in scripts, skills, or workflow docs.
- Reuse this helper in complete, stalled, and any future notification scripts.

---

## 1. Workflow complete notification

**When:** GitHub Actions handoff runs and `workflow.state.json` has `stage: complete`.

**Extend** `cursor-workflow-notify-complete.sh`:

- @mention **repo owner** and **issue author** (via shared helper above).
- Keep existing behaviour: link to PR, assign PR to issue author, idempotent marker, post once.
- Example tone:

  > @issue-author @repo-owner — The cursor workflow for issue #NNN is complete. **PR #NNN** is ready for your final review.
  >
  > Branch: `cursor/issue-NNN-…` · Label: `cursor:complete`

**Agents:** Babysit agents must **not** post this comment themselves — the handoff Action owns it (already documented in `babysit-pr` skill).

---

## 2. Workflow stalled notification (terminal handoff failure)

**When:** `cursor-workflow-spawn-agent.sh` (or pass-back spawn) has exhausted retries and will not spawn the next agent — e.g.:

- Global agent cap (`CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS`) still full after backoff
- Pending-lock race unresolved after retries
- Cursor API 400 (quota/plan limit) after retries
- Missing `CURSOR_API_KEY` and no successful API spawn
- Other non-recoverable spawn errors after `MAX_ATTEMPTS`

**Do not** use this for **transient** deferrals that will retry on the next push — keep `cursor-workflow-post-deferral-comment.sh` as-is for those.

**Replace** `pat_fallback()` posting `@cursoragent …` with a new script, e.g. `cursor-workflow-notify-stalled.sh`:

- @mention **repo owner** and **issue author** (shared helper).
- Include: issue #, branch, current `stage`, expected next skill/stage, and **why** automation stopped (human-readable reason string).
- Include **manual recovery** steps:
  1. Comment on the issue: `@cursoragent use <skill> skill for issue NNN on branch <branch>` (human-triggered — the path that actually works).
  2. Or: Actions → **Cursor workflow handoff** → **Run workflow** (workflow_dispatch resync) with the issue number.
- Optionally link to the last agent conversation from `workflow.state.json` (`agents.<skill>` → `https://cursor.com/agents/<id>`).
- Idempotent HTML marker, e.g. `<!-- cursor-workflow-stalled-notify:v1 -->` — one stalled comment per issue per stall reason or per 30–60 minutes (define policy; avoid spam on repeated pushes).
- Post via `GITHUB_TOKEN` in Actions (same as complete notifier).

**Deprecate** PAT `@cursoragent` fallback in `pat_fallback()`, `cursor-workflow-passback-run.sh`, WORKFLOW.md, and SETUP.md — or remove entirely once stalled notification ships.

---

## 3. Genuine agent questions (human input required)

**When:** An agent cannot answer a question from the repo alone — typically:

- `review-and-spec` / `planning` clarifying product decisions (`spec-needs-info`, `plan-needs-info`)
- Ambiguous acceptance criteria that require human choice

**Not** for: bugs found during demo, CI failures, missing API keys in the environment, implementation defects — those use **pass-back** (below).

**Agent behaviour** (update all workflow skills: `review-and-spec`, `planning`, and document in `WORKFLOW.md` / `AGENTS.md`):

1. Post a comment on the GitHub issue (best effort; if the cloud agent token cannot post, commit questions to the branch and note in the PR that the human should check the issue — existing fallback).
2. @mention **repo owner** and **issue author** (agents should use `gh` to resolve both, or include resolved @handles in committed `SPEC.md` / issue reply text for the human to post).
3. Number clarifying questions clearly.
4. Include a link to the agent conversation, e.g.:

   > If you need to chat more about this, talk to me [here](https://cursor.com/agents/<agent-id>).

5. Set workflow state to the appropriate needs-info stage (`spec-needs-info`, `plan-needs-info`).
6. Ask the human to reply on the issue and comment `@cursoragent continue spec` or `@cursoragent continue plan`.

**Only genuine questions** — agents must not use this path to escalate code bugs, test failures, or demo environment issues.

---

## 4. Step failures — pass back, do not ask human

**When:** A stage fails due to a **defect or fixable problem** in code or workflow output — e.g.:

- Demo finds a UI bug or missing acceptance criterion in shipped code
- Execute left failing tests
- Demo environment issue that execute can fix (missing fallback, wrong seed data documented in demo-notes)

**Agent behaviour** (enforce in `demo`, `execute`, `babysit-pr` skills):

1. **Do not** post a “please fix this” question to the human on the issue.
2. Write failure details to `workflow/issues/issue-{NNN}/demo/demo-notes.md` under `## Pass-back to execute` (or equivalent section for other pass-back targets).
3. Set `workflow.state.json`:
   - `stage`: `execute-passback` (or future pass-back stages)
   - `passback_to`: target skill (e.g. `execute`)
   - `passback_reason`: short summary
4. Push — GitHub Actions spawns pass-back via Cursor API (`POST /v1/agents/{id}/runs`), not `@cursoragent` comment.
5. If pass-back API also fails after retries, fall through to **stalled notification** (§2), not a human question.

This matches existing demo pass-back design; this issue makes the distinction explicit and prevents agents from conflating “bug found” with “product question”.

---

## Implementation outline

| Area | Change |
|------|--------|
| `scripts/cursor-workflow-resolve-notify-targets.sh` | **New** — resolve issue author + repo owner logins |
| `scripts/cursor-workflow-notify-complete.sh` | @mention repo owner + issue author |
| `scripts/cursor-workflow-notify-stalled.sh` | **New** — terminal failure notification |
| `scripts/cursor-workflow-spawn-agent.sh` | Replace `pat_fallback()` with stalled notifier |
| `scripts/cursor-workflow-passback-run.sh` | Remove PAT `@cursoragent` fallback; use stalled notifier on failure |
| `scripts/cursor-workflow-load-scripts.sh` | Register new scripts |
| `scripts/test-cursor-workflow-handoff.sh` | Tests for owner resolution, complete + stalled idempotency |
| `workflow/cursor-workflow/WORKFLOW.md` | Document all four scenarios; deprecate PAT fallback |
| `workflow/cursor-workflow/SETUP.md` | Update secrets table; troubleshooting |
| `.cursor/skills/*/SKILL.md` | Genuine-question vs pass-back rules; link to agent chat when asking |
| `AGENTS.md` | Short pointer to communication rules |

---

## Acceptance criteria

- [ ] Complete notification @mentions **repo owner** and **issue author**; no hardcoded usernames.
- [ ] Stalled notification posts on terminal handoff failure with reason, recovery steps, and idempotency marker.
- [ ] `pat_fallback()` no longer posts `@cursoragent` comments (removed or gated off).
- [ ] Transient deferral comment behaviour unchanged (retry on next push).
- [ ] Shared owner-resolution helper used by complete and stalled scripts.
- [ ] Skills updated: genuine questions → issue comment with both @mentions + agent chat link; step failures → pass-back only.
- [ ] `scripts/test-cursor-workflow-handoff.sh` covers new behaviour.
- [ ] WORKFLOW.md and SETUP.md updated.

---

## Out of scope

- Changing the primary handoff path (`CURSOR_API_KEY` → `POST /v1/agents`) — it stays as-is.
- Cursor Automations dashboard backup prompts — optional, not part of this issue.
- Org-level “notify” targets beyond `repo.owner.login` (can be a follow-up if org repos need a specific human).
- Enabling cloud agents to reliably post GitHub issue comments without token changes — best-effort only.

---

## References

- Current complete notifier: `scripts/cursor-workflow-notify-complete.sh`
- Current spawn fallback: `scripts/cursor-workflow-spawn-agent.sh` (`pat_fallback`)
- Issue #99 workflow review (stalled handoff evidence): `workflow/issues/issue-99/WORKFLOW-REVIEW.md`
- Pass-back: `workflow/cursor-workflow/WORKFLOW.md` § pass-back / `execute-passback`
