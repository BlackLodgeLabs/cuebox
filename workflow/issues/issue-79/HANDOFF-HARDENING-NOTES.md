# Handoff fix review — hardening notes (issue #79)

Context: the `BEFORE_SHA` shallow-checkout fix + `handoff-recovery` on `cursor/issue-79-workflow-review-skill` (commit `e459289`) addresses the immediate failure where issue #79 stuck at `plan-ready` without spawning execute.

---

## What is covered well

- **Root cause:** `fetch-depth: 2` + multi-commit push left `github.event.before` outside the clone; `cursor-workflow-ensure-before-sha.sh` should restore normal diff-based handoffs.
- **Safety net:** `cursor-workflow-handoff-recovery.sh` on sync-only pushes covers all five forward handoff stages when the target `agents.<skill>` slot is null (`spec-ready` → planning through `create-pr-ready` → babysit).

---

## Gaps / failure modes still possible

1. **`execute-ready` after `changes-requested` can spawn the wrong agent**  
   Recovery uses `prev_stage` to choose execute (with `--reopen`) vs demo. On sync-only pushes where `BEFORE_SHA` is unavailable, `prev_stage` may be empty → recovery spawns **demo** instead of **execute** for a post-review re-open.

2. **`execute-passback` not covered**  
   Pass-back (`POST /v1/agents/{id}/runs`) only runs when `state_changed=true` and `stage=execute-passback`. Recovery does not implement pass-back; a missed transition stays stuck until manual intervention.

3. **`spec-ready` / `plan-ready` recovery skips `ensure_pr_on_branch`**  
   Normal handoff creates/links a draft PR first. Recovery spawns directly; if `pr` is null from an earlier failure, prompts reference `Draft PR #null`.

4. **Fallback diff only inspects the tip commit**  
   When `BEFORE_SHA` cannot be fetched, `git diff-tree -r "$AFTER_SHA"` only sees the latest commit. A 3+ commit push where state changed in a non-tip commit may still report `state_changed=false` unless recovery catches a stuck handoff stage.

5. **False re-spawn if spawn succeeded but state write failed**  
   Recovery keys off `agents.<skill>` being null. If the API created an agent but `record-spawn-on-branch.sh` failed, a duplicate may spawn on the next push (`handoff_pending` mitigates for ~15 min only).

6. **Scripts on `main` until merge**  
   Actions load helpers from `origin/main` first. Other issue branches won't get recovery / `ensure-before-sha` until this merges (unless they carry the same scripts on HEAD).

7. **`PR.md` diff has the same `BEFORE_SHA` weakness (minor)**  
   `pr_md_changed` wasn't hardened the same way; PR body updates may lag on multi-commit pushes. Does not block handoffs.

8. **`workflow_dispatch` resync doesn't run recovery**  
   Manual resync only updates labels/comments. A stuck `plan-ready` issue still needs a push to the issue branch to trigger recovery.

---

## Suggested hardening (priority order)

1. **Increase `fetch-depth`** to `0` (full) or enough to cover typical multi-commit agent pushes — simplest way to eliminate the `BEFORE_SHA` class of bugs.
2. **Recovery for `execute-passback`** when `passback_to` and agent id are set but no run was started.
3. **Infer re-open without `prev_stage`** — e.g. if `agents.execute` exists and `loops.total_runs` was incremented, treat `execute-ready` as execute + `--reopen`.
4. **Call `ensure_pr_on_branch` from recovery** for `spec-ready` / `plan-ready`.
5. **Deduplicate prompts** — extract handoff prompt building into one shared script used by both `handoff()` and recovery to avoid drift.
6. **Harden `pr_md_changed`** the same way as `state_changed` (guard `BEFORE_SHA` / fetch before diff).

---

## Coverage summary

| Handoff type | Recovery covered? |
|--------------|-------------------|
| `spec-ready` → planning | Mostly (no ensure-PR) |
| `plan-ready` → execute | **Yes** |
| `execute-ready` → demo | Yes |
| `execute-ready` ← `changes-requested` → execute | **Partial** (needs `prev_stage`) |
| `demo-ready` → create-pr | Yes |
| `create-pr-ready` → babysit | Yes |
| `execute-passback` | **No** |
| `changes-requested` | N/A (intentional no spawn) |

---

## Why the Cloud Agent could not post this as an issue comment

Cloud Agents authenticate to GitHub with the **Cursor GitHub App integration token** (`ghs_*`). That token is scoped for git operations (clone, push) and limited API access. It does **not** include permission to create issue or PR comments (`Resource not accessible by integration`).

The handoff **GitHub Action** uses `GITHUB_TOKEN` / `CURSOR_HANDOFF_GITHUB_TOKEN` and *can* post comments — but those secrets are not injected into the Cloud Agent VM for security reasons.

**Workaround used here:** commit notes to `workflow/issues/issue-NNN/` and let the human (or a follow-up agent with MCP) post to GitHub.

---

## Would GitHub MCP give Cloud Agents more access?

**Yes — for the operations the MCP exposes**, when configured with a **Personal Access Token (PAT)** that has the right repository permissions.

| Capability | Integration token (`ghs_*`) | GitHub MCP + PAT |
|------------|----------------------------|------------------|
| Clone / push code | Yes | Yes (via git; MCP not required) |
| Post issue comments | **No** | **Yes** (`add_issue_comment`) |
| Create/update issues | No | Yes (`issue_write`, `create_issue`) |
| Read PR checks / reviews | Limited | Yes (MCP read tools) |
| Set issue labels | No | Yes (`update_issue`) |

A GitHub MCP server uses **your** PAT (classic `repo` scope, or fine-grained with explicit permissions), not the App integration token. That is why it can do things `gh issue comment` fails on inside a Cloud Agent.

### Caveats

- **Cloud Agent MCP is configured in the dashboard**, not reliably from repo `.cursor/mcp.json` alone. See [Cursor Cloud Agent docs — MCP support](https://cursor.com/docs/cloud-agent).
- **Paste the PAT directly** in the dashboard MCP config. `${env:VAR}` interpolation is **not** reliably available to MCP processes in Cloud Agents (secrets may exist on the VM but MCP won't see them).
- **Enable MCP per run** on [cursor.com/agents](https://cursor.com/agents) — toggle the GitHub MCP server on for the environment/run.
- **Reliability is still improving** — some users report Team MCP servers showing "connected" in the UI but not attached to the runtime. If tools are missing, retry or use Desktop Cursor locally where MCP is more mature.
- MCP does **not** replace `CURSOR_API_KEY` for spawning the next workflow agent — it complements GitHub-side operations (comments, triage, reading PR state).

---

## Setup: GitHub MCP for Cloud Agents (Cuebox)

Use this when you want Cloud Agents to post issue comments, read PR review threads, or triage without failing the task.

### 1. Create a fine-grained PAT

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Repository access:** Only select repositories → `BlackLodgeLabs/cuebox` (or "All repositories" if you prefer).
3. **Permissions** (minimum for workflow agent work):

   | Permission | Access | Why |
   |------------|--------|-----|
   | Metadata | Read | Required for all API calls |
   | Contents | Read | Read specs, plans, workflow files |
   | Issues | Read and write | Comments, labels, issue updates |
   | Pull requests | Read and write | PR comments, review context |

4. Copy the token (`github_pat_…`). Store it in a password manager.

You can use the **same PAT** as `CURSOR_HANDOFF_GITHUB_TOKEN` in GitHub Actions secrets (Issues + PRs read/write on this repo only). Keep one token per purpose if you prefer narrower blast radius.

### 2. Add GitHub MCP in Cursor dashboard

**Team / account admins:**

1. Open [cursor.com/dashboard](https://cursor.com/dashboard) → **Integrations** or **MCP** (or [cursor.com/agents](https://cursor.com/agents) → MCP dropdown).
2. **Add MCP server** → choose **GitHub** (official server) or **Custom MCP**.
3. For the **hosted GitHub MCP** (recommended — no Docker in Cloud VM):

   - URL: `https://api.githubcopilot.com/mcp/`
   - Auth: **Bearer token** / `Authorization: Bearer <YOUR_PAT>`
   - Paste the **actual PAT value** — do not use `${env:…}` placeholders.

4. For **stdio / Docker** GitHub MCP (works locally; awkward in Cloud):

   ```json
   {
     "mcpServers": {
       "github": {
         "command": "docker",
         "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
         "env": {
           "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_PAT>"
         }
       }
     }
   }
   ```

   Prefer the **HTTP hosted** server for Cloud Agents — the VM may not run Docker for MCP sidecars.

5. Save and verify the server shows as connected.

### 3. Attach MCP to the Cloud Agent environment

1. [cursor.com/agents](https://cursor.com/agents) → your **Cuebox** environment (or edit `.cursor/environment.json` snapshot in dashboard).
2. Under **MCP servers**, enable **GitHub** for this environment.
3. Confirm the toggle is **on** for each new Cloud Agent run that needs GitHub write access.

Repo-level `.cursor/mcp.json` is useful for **local Desktop** sessions but treat dashboard config as the source of truth for Cloud.

### 4. Verify in a Cloud Agent run

Start a short test agent on `main` and ask it to:

1. List available MCP tools (should include GitHub issue/PR tools).
2. Post a test comment on a scratch issue, or read issue #79 comments.

If `ListMcpResources` / MCP tools return empty while the dashboard shows connected, see [Cursor forum — Cloud Agents + MCP](https://forum.cursor.com/t/cloud-agents-mcp/152033) (known attachment issues; retry or escalate).

### 5. Document for agents (optional follow-up)

When MCP is live, update:

- `.cursor/skills/review-and-spec/SKILL.md` — "cannot post issue comments" becomes "use GitHub MCP `add_issue_comment` when configured".
- `workflow/cursor-workflow/SETUP.md` — cross-link this section.
- `AGENTS.md` — note MCP as optional for issue/PR interactions.

### 6. Security hygiene

- Use a **repo-scoped fine-grained PAT**, not a classic `repo` token with org-wide access.
- Rotate if leaked; update dashboard MCP config and `CURSOR_HANDOFF_GITHUB_TOKEN` together if shared.
- MCP PAT is **more powerful** than the integration token — only enable GitHub MCP on environments that need it.

---

## Posting this content to issue #79 manually

If MCP is not yet configured:

```bash
gh issue comment 79 --repo BlackLodgeLabs/cuebox \
  --body-file workflow/issues/issue-79/HANDOFF-HARDENING-NOTES.md
```

Requires a local `gh` login or PAT with Issues write — not the Cloud Agent integration token.
