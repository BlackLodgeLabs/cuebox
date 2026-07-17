# Cursor issue workflow — setup guide

One-time setup to run the 8-stage pipeline (spec → plan → execute → demo → create-pr → babysit → your review).

Copy `workflow/cursor-workflow/`, `.cursor/skills/{review-and-spec,planning,execute,demo,create-pr,babysit-pr,run-gate-scripts}/`, `.github/workflows/cursor-workflow-handoff.yml`, and `.github/ISSUE_TEMPLATE/cursor_feature.yml` to reuse in other repositories. Adjust `main` if your default branch differs.

## Architecture

```text
You: create issue → @cursoragent spec
        ↓
review-and-spec skill → branch + spec → push workflow.state.json (spec-ready)
        ↓
GitHub Action (CURSOR_API_KEY) → planning cloud agent
        ↓
plan-ready → execute → draft PR → execute-ready → demo → demo-ready → create-pr → create-pr-ready → babysit-pr → complete (ready for review)
        ↓
You: GitHub PR review notification → merge
```

Human gates: **spec start** (`@cursoragent spec`), **spec resume** (`@cursoragent continue spec`), and **plan resume** (`@cursoragent continue plan` when bug reproduction is blocked).

Automated handoffs: stages 3–7 via `.github/workflows/cursor-workflow-handoff.yml` when `workflow/issues/issue-NNN/workflow.state.json` is pushed with a handoff `stage`.

**State merge:** Before committing `workflow.state.json`, agents run `bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-NNN/workflow.state.json` to preserve remote `agents`, `pr`, loop counters, and monotonic `stage`. See [WORKFLOW.md](WORKFLOW.md#state-merge).

**Agent cap:** The handoff Action never spawns when **8** or more Cloud Agent runs are already **in flight** (`RUNNING`/`CREATING`) for this repo. Default cap is `orchestration.max_active_agents` in [workflow.config.yaml](workflow.config.yaml) (override: `CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS`). Finished runs (`FINISHED`) do not count — agent workspaces may stay `ACTIVE` in the Cursor API after work completes. At cap or on API 400, it defers with backoff and posts a single deferral comment per 30 minutes (`orchestration.deferral_comment_cooldown_minutes`; override: `CURSOR_WORKFLOW_DEFERRAL_COMMENT_MINUTES`) — the Action does not exit with failure.

**Babysit recovery:** If a branch is stuck at `create-pr-ready` with a draft PR but no `agents.babysit-pr`, the next push (even sync-only) self-heals by spawning babysit. Pass-back (`execute-passback`) and manual **Resync** (Actions → Cursor workflow handoff) also run recovery — see [WORKFLOW.md](WORKFLOW.md#handoff-recovery).

**`handoff_pending`:** Per-issue spawn lock in `workflow.state.json`; prevents duplicate forward spawns. Stale after `orchestration.handoff_pending_stale_minutes` (default 15; override: `CURSOR_WORKFLOW_PENDING_STALE_MINUTES`).

---

## 1. Cursor account and billing

- [ ] Paid Cursor plan with **Cloud Agents** enabled
- [ ] **On-demand usage** enabled (required for reliable GitHub agent triggers)
- [ ] You are the only person who will `@cursoragent` on issues (per your preference)

## 2. GitHub App integration

1. [Cursor Dashboard → Integrations](https://cursor.com/dashboard?tab=integrations) → connect **GitHub**
2. Grant access to this repository (read/write: code, issues, PRs, checks)
3. Confirm you can comment `@cursoragent` on a test issue and get a response

**Trusted commenter:** only your GitHub user should trigger agents on private repos.

## 3. Repository secrets

Add in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Required | Purpose |
|--------|----------|---------|
| `CURSOR_API_KEY` | **Recommended** | Handoff Action calls `POST https://api.cursor.com/v1/agents` to spawn the next agent |

Create the API key: [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) (personal/user key).

| Secret | Optional | Purpose |
|--------|----------|---------|
| `CURSOR_HANDOFF_GITHUB_TOKEN` | Deferral comments | Fine-grained GitHub PAT for `cursor-workflow-post-deferral-comment.sh` when `GITHUB_TOKEN` lacks issue-comment scope in custom runners |

Use API key path in production. Terminal spawn/pass-back failures post **stalled notifications** via `GITHUB_TOKEN` (`cursor-workflow-notify-stalled.sh`) — not PAT `@cursoragent` comments (removed in issue #111).

### Draft pull requests

Cloud agents **cannot** open PRs (`gh pr create` fails in the VM). **GitHub Actions** creates the draft PR when `stage` reaches `spec-ready`, using `GITHUB_TOKEN` (`pull-requests: write`).

- Execute and later agents **push commits only** to the linked branch
- `workflow.state.json` → `"pr"` is set by the Action
- **Stuck without a PR?** Actions → **Cursor workflow handoff** → Run workflow → issue number → enable **ensure draft PR**
- **Stuck mid-flight?** Same manual resync also runs handoff recovery (spawn retry) after syncing labels/comments

Workflow scripts are always loaded from `main` in Actions (into `/tmp/cursor-workflow-scripts`), so issue branches created before #48 still work.

## 4. GitHub labels

Create labels (Settings → Labels):

| Label | Color suggestion | When |
|-------|------------------|------|
| `cursor:spec-needs-info` | `#FBCA04` | Spec agent waiting on you |
| `cursor:plan-needs-info` | `#FBCA04` | Planning agent waiting on you (bug repro) |
| `cursor:spec-ready` | `#0E8A16` | Spec done |
| `cursor:plan-ready` | `#0E8A16` | Plan done |
| `cursor:execute-ready` | `#0E8A16` | Code + draft PR done |
| `cursor:demo-ready` | `#0E8A16` | Demo artifacts done |
| `cursor:create-pr-in-progress` | `#1D76DB` | Create PR agent running |
| `cursor:create-pr-ready` | `#0E8A16` | PR.md committed |
| `cursor:changes-requested` | `#D93F0B` | Post-complete scope added |
| `cursor:execute-passback` | `#1D76DB` | Demo pass-back to execute |
| `cursor:complete` | `#5319E7` | Babysit done |
| `cursor:blocked` | `#B60205` | Loop limit or failure |

Agents add/remove these; labels help you see state at a glance.

**GitHub MCP (preferred):** Workflow Cloud Agents should have **GitHub MCP** enabled in the Cursor dashboard (HTTP MCP → `https://api.githubcopilot.com/mcp/`). Agents post human-visible comments and set labels immediately via MCP; see [MCP-GITHUB.md](MCP-GITHUB.md). When MCP is unavailable, labels and the **status comment** are still synced by GitHub Actions on **every push** to `cursor/issue-*` branches. Create all labels in the table in [WORKFLOW.md](WORKFLOW.md) (including `cursor:*-in-progress`).

### Visibility checklist

- [ ] All `cursor:*` labels created (see WORKFLOW.md)
- [ ] Handoff workflow has `permissions: issues: write` (in repo after merge)
- [ ] On issue #N, look for comment **"Cursor workflow — issue #N"** after the next state push
- [ ] To backfill issue #45 now: Actions → **Cursor workflow handoff** → Run workflow → issue `45`

## 5. Cloud agent environment

In [cursor.com/dashboard](https://cursor.com/dashboard) → **Cloud Agents** → environment for this repo:

- [ ] Connect repository
- [ ] **Install command** matches `.cursor/environment.json` `install` (or your stack bootstrap)
- [ ] **Start command** / snapshot includes Docker + Node + Python
- [ ] **Secrets** mirrored for demos/tests: `TMDB_API_KEY`, `OPENAI_API_KEY`, etc. (as needed)
- [ ] Stack terminal or snapshot verifies Part 1 + Part 2 gates from `AGENTS.md`
- [ ] **GitHub MCP** enabled (dashboard HTTP MCP → `https://api.githubcopilot.com/mcp/`) — required for workflow agents to post comments and labels immediately
- [ ] Verify MCP offline: `bash scripts/test-cursor-workflow-mcp-github.sh`
- [ ] Verify MCP live (optional): `GetMcpTools` → `github` ready; `add_issue_comment` with `<!-- cursor-mcp-test:v1 -->` on a test issue (see [MCP-GITHUB.md](MCP-GITHUB.md))

Demo and execute agents assume **full Docker stack** (frontend :3000, API :8000).

### Post-complete changes (`changes-requested`)

When scope is added after `complete`:

```text
complete → changes-requested (PR → draft, total_runs++) → execute-ready → execute → demo → create-pr → babysit → complete
```

1. Update SPEC/PLAN if needed
2. Push `stage: changes-requested` (Action converts PR to draft; no agent spawned)
3. Push `stage: execute-ready` in a follow-up commit (Action spawns execute)

### Pass-back (`execute-passback`)

When demo finds a code defect:

1. Demo writes `## Pass-back to execute` in `demo-notes.md`
2. Sets `stage: execute-passback`, `passback_to: execute`, `passback_reason: <summary>`
3. Action calls `POST /v1/agents/{execute_id}/runs` (same conversation, not a new agent)
4. On 409 `agent_busy`, re-push after the current run completes

## 6. Bugbot (step 6)

- [ ] Enable **Bugbot** on the repository ([Cursor GitHub integration](https://cursor.com/docs/integrations/github))
- [ ] Babysit skill reacts to Bugbot + CI + review threads (loop limits: Bugbot 3, CI 2, total 10)

## 7. Branch protection (recommended)

On `main`:

- Require PR before merge
- Require status checks (your CI workflows)
- Do **not** block draft PRs from cloud agents if your policy allows bot pushes to `cursor/issue-*` branches

## 8. Enable the handoff workflow

Merge `.github/workflows/cursor-workflow-handoff.yml` to `main`.

Verify:

```bash
# After a test push to cursor/issue-* with stage spec-ready in workflow.state.json
# Actions tab → "Cursor workflow handoff" should spawn the next agent
```

## 9. Optional: Cursor Automations (backup)

If you prefer dashboard automations instead of (or alongside) the GitHub Action, create automations at [cursor.com/automations](https://cursor.com/automations). Copy prompts from [automation-prompts/](automation-prompts/).

**Note:** Issue **label** triggers may be limited; the GitHub Action + API key is the supported handoff path in this scaffold.

## 10. Skills discovery

Skills live in `.cursor/skills/` (committed — see `.gitignore` exceptions). After merge:

- Cursor Settings → Rules → Skills → confirm all six appear
- Cloud agent on this repo should list them in Agent Decides

Cross-reference in root `AGENTS.md` points agents to this workflow.

## 11. Housekeeping (stale agent branches)

Cloud agents push ephemeral side-branches (`cursor/issue-NNN-pr-MMM-<skill>-agent-<id>`) during handoff. These are not PR heads, so GitHub `delete_branch_on_merge` does not remove them. Post-merge automation deletes branches scoped to each merged PR; use a one-time sweep for pre-existing orphans.

**Drift report:** Actions → **Cursor workflow housekeeping** → Run workflow (default inputs). The report flags stale agent side-branches when present.

**One-time sweep:** Same workflow → set `sweep_stale_agent_branches: true` → Run workflow. Deletes all `cursor/issue-*-pr-*-agent-*` branches whose embedded PR is already merged. Preview with:

```bash
bash scripts/cursor-workflow-delete-stale-branches.sh --sweep-merged --dry-run
```

---


## Daily usage

### Start a feature

1. Create issue (use **Cursor feature** template)
2. Comment: `@cursoragent spec`
3. If agent asks questions → answer in issue → `@cursoragent continue spec`
4. Wait for automated stages (watch Actions + PR)
5. Receive GitHub notification when PR is **ready for review**
6. Inspect `workflow/issues/issue-NNN/`, code, checks → approve → merge

### If blocked (`cursor:blocked`)

Read issue + PR comments for loop counters. Fix manually or:

1. Reset/adjust `workflow/issues/issue-NNN/workflow.state.json` if appropriate
2. Comment `@cursoragent` with explicit skill + issue number to resume

**Deferred handoff retry:** When in-job backoff exhausts, `handoff_deferred` is written to the branch. The scheduled workflow **Cursor workflow retry deferred** (`.github/workflows/cursor-workflow-retry-deferred.yml`, every 15 minutes) re-runs recovery. Manual fallback:

```text
@cursoragent use <skill> skill for issue NNN
```

Or **Actions → Cursor workflow handoff → Run workflow** with the issue number. See [OPERATIONS.md](OPERATIONS.md).

### Manual stage override

On any stage you can comment:

```text
@cursoragent use execute skill for issue 42 on branch cursor/issue-42-my-feature
```

---

## Customization

| Knob | Location |
|------|----------|
| Loop limits | Skills `babysit-pr`, `workflow.state.json` schema |
| Gate script default | Skill `execute` → `run-gate-scripts` |
| Handoff prompts | `.github/workflows/cursor-workflow-handoff.yml` |
| Paths | `WORKFLOW.md` |
| Base branch | Skills + workflow (default `main`) |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `@cursoragent` does nothing | Reconnect GitHub integration; enable on-demand billing |
| Handoff Action fails | Set `CURSOR_API_KEY`; check API key permissions |
| Next agent never starts | Confirm `stage` is `spec-ready` / `plan-ready` / etc.; push includes `workflow.state.json` |
| Bot handoff ignored | Use API key, not cursor-bot comment |
| Demo fails | `docker compose ps`; health curls; see `AGENTS.md` |
| Pass-back 409 agent busy | Re-push `workflow.state.json` after execute run completes |
| Stalled notification missing | Check issue comments for `<!-- cursor-workflow-stalled-notify:v1 -->` (idempotent — one per stall episode); verify `GITHUB_TOKEN` in Actions; run workflow_dispatch to resync |
| Stalled `agents-list-fetch-failed` notification | Inspect the failed Action log for the Cursor agent-list curl/jq/count error, restore the dependency, then retry **Cursor workflow handoff** with workflow_dispatch |
| Agent links show "—" in status comment | Agent clobbered state — run merge helper before state commits; see [WORKFLOW.md#state-merge](workflow/cursor-workflow/WORKFLOW.md#state-merge) |

See also [WORKFLOW.md](WORKFLOW.md).
