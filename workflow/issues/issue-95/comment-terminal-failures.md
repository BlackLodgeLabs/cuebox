# Draft comment for GitHub issue #95

Post this on https://github.com/BlackLodgeLabs/cuebox/issues/95

---

## Addition: terminal handoff failures (workflow stalled notification)

Following review of issue #99 / PR #100, the current **backup when the handoff Action cannot spawn the next agent** is unreliable and should be included in this issue.

### Problem today

When `cursor-workflow-spawn-agent.sh` exhausts retries (agent cap, pending-lock race, Cursor API 400, missing `CURSOR_API_KEY`, etc.), it falls back to `pat_fallback()` — posting an `@cursoragent …` comment on the issue via `CURSOR_HANDOFF_GITHUB_TOKEN`.

This backup does **not** work reliably:

- [WORKFLOW.md](https://github.com/BlackLodgeLabs/cuebox/blob/main/workflow/cursor-workflow/WORKFLOW.md) already says: *"Do not rely on bot `@cursoragent` comments for handoffs (filtered by GitHub/Cursor)."*
- If `CURSOR_HANDOFF_GITHUB_TOKEN` is unset, there is often **no issue comment at all** — only a workflow warning.
- The existing deferral comment (`cursor-workflow-post-deferral-comment.sh`) is passive ("will retry on next push") and does **not** @mention anyone, so a genuine stall is easy to miss.

On issue #99 we saw this pattern: deferral + `@cursoragent` comment at 23:18 UTC; the actual fix landed ~12 hours later on a subsequent push — unclear whether the comment triggered anything.

### Proposed change (include in this issue)

Add a **terminal failure / workflow stalled** notification, mirroring the success path in `cursor-workflow-notify-complete.sh`:

| Situation | Current | Proposed |
|-----------|---------|----------|
| Transient (cap, pending-lock) | Deferral comment + auto-retry on next push | **Keep** as-is |
| Terminal (retries exhausted, no API key, spawn permanently failed) | `@cursoragent` via PAT fallback | **Replace** with owner @mention + recovery steps |
| Success (`stage: complete`) | @mention issue author | **Extend** per this issue — also @mention repo owner |

**Stalled notification should:**

1. @mention **repo owner** and **issue author** (same resolution logic as complete notification — no hardcoded usernames; derive from GitHub API).
2. State issue #, branch, expected next stage/skill, and **why** automation stopped (cap, API 400, missing secret, retries exhausted).
3. Give **manual recovery** steps, e.g.:
   - Human comments `@cursoragent use <skill> skill for issue NNN` on the issue (the path that actually works).
   - Or run **workflow_dispatch** resync on the Cursor workflow handoff Action.
4. Be **idempotent** (HTML comment marker, like `cursor-workflow-complete-notify:v1`).
5. Optionally link to the last agent conversation if one exists in `workflow.state.json`.

**Implementation sketch:** new `cursor-workflow-notify-stalled.sh`, called from `pat_fallback()` in `cursor-workflow-spawn-agent.sh` (or replace `pat_fallback` entirely). Update WORKFLOW.md / SETUP.md to document that PAT `@cursoragent` fallback is deprecated in favour of owner notification.

### Scope alignment with this issue

This fits the broader "communication updates" goal:

- **Complete** → notify repo owner + issue owner (already in issue description).
- **Stalled / terminal failure** → same audience, same dynamic owner resolution.
- **Genuine questions** → agent posts comment tagging both owners + agent chat link (already in issue description).
- **Step failures (e.g. demo bug)** → pass back to previous agent, not ask human (unchanged).

The stalled notification is specifically for when **automation itself has stopped** and needs human intervention to resume — distinct from agents asking product/spec questions.
