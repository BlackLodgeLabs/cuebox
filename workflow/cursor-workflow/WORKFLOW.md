# Cursor multi-agent issue workflow

Reusable pipeline: GitHub issue → spec → plan → execute → demo → create-pr → babysit → human review.

## Stages

| Stage | Trigger | Agent skill | Output |
|-------|---------|-------------|--------|
| 1 | You create issue | — | GitHub issue |
| 2 | You comment `@cursoragent spec` | `review-and-spec` | Branch + `workflow/issues/issue-NNN/SPEC.md` |
| 2b | You comment `@cursoragent continue spec` | `review-and-spec` | Resume after clarifications |
| 3 | Handoff (`spec-ready`) | `planning` | `workflow/issues/issue-NNN/PLAN.md`, `workflow/issues/issue-NNN/demo/demo-spec.md`; for app bugs, `demo/bug-repro-*` evidence first |
| 4 | Handoff (`plan-ready`) | `execute` | Code, docs, pushes to **existing draft PR** |
| 5 | Handoff (`execute-ready`) | `demo` | Artifacts under `workflow/issues/issue-NNN/demo/` |
| 6 | Handoff (`demo-ready`) | `create-pr` | `workflow/issues/issue-NNN/PR.md` → draft PR body |
| 7 | Handoff (`create-pr-ready`) | `babysit-pr` | PR marked ready; loops until clean or blocked |
| 8 | GitHub notification | You | Final review and merge |

## Branch and paths

All workflow artifacts live under `workflow/`:

```text
workflow/
  cursor-workflow/          # docs, templates, automation prompts
    templates/              # demo-spec and workflow.state.json starters
  issues/
    issue-{NNN}/
      SPEC.md               # feature spec (review-and-spec)
      PLAN.md               # implementation plan (planning)
      PR.md                 # PR description (create-pr; synced to GitHub PR body)
      workflow.state.json   # handoff contract (every stage updates)
      demo/                 # demo-spec.md, demo-notes.md, bug-repro-* (planning), screenshots, recordings
```

- **Branch:** `cursor/issue-{NNN}-{slug}` (slug from issue title, lowercase, hyphens)
- **Base branch:** `main`
- **PR:** One long-lived **draft** PR opened by GitHub Actions at `spec-ready` (not by cloud agents); execute pushes commits; **create-pr** writes `PR.md` (Actions syncs body); babysit marks it **ready for review**

Copy [templates/demo-spec.md](templates/demo-spec.md) and [templates/workflow.state.json](templates/workflow.state.json) when bootstrapping manually.

## State file

`workflow/issues/issue-{NNN}/workflow.state.json` is the handoff contract. Cloud agents update `stage` and push; the GitHub Action reads it on every push to `cursor/issue-*` branches.

Handoff stages (trigger next agent): `spec-ready`, `plan-ready`, `execute-ready`, `demo-ready`, `create-pr-ready`.

Pass-back handoff: `execute-passback` (with `passback_to` set) — continues the same execute agent via `POST /v1/agents/{id}/runs`.

Re-open handoff: `changes-requested` → `execute-ready` (two-step: first push sets `changes-requested`, follow-up push sets `execute-ready`).

Progress stages: `spec-in-progress`, `plan-in-progress`, `execute-in-progress`, `demo-in-progress`, `create-pr-in-progress`, `babysit-in-progress`.

Terminal stages: `complete`, `blocked`, `spec-needs-info`, `plan-needs-info`.

### In-progress commit rule

Every skill must commit the matching `*-in-progress` stage **before** substantive work (spec file, plan, code, demo artifacts, PR.md, babysit fixes). Run the merge helper first (see below).

## State merge

Before committing `workflow.state.json`, always run:

```bash
bash scripts/cursor-workflow-merge-state.sh workflow/issues/issue-{NNN}/workflow.state.json
```

This fetches `origin/<branch>` and deep-merges with local edits:

- **Monotonic stage:** `stage` = higher rank of remote and local (never regress e.g. `create-pr-ready` → `demo-ready` when merging agent side-branches)
- **Remote wins unless local non-null override:** `agents` (per key), `pr`, `active_agent_id`, `passback_to`, `passback_reason`
- **`handoff_pending`:** fresh remote lock wins; stale locks (>15 minutes) treated as null; local explicit `null` clears
- **`loops`:** per-counter **max** of remote and local (counters only increment; preserves Action-recorded totals when agents commit stale loop values)
- **Always from local:** `issue`, `branch`

Prevents agents from clobbering `agents.*`, `pr`, loop counters, and forward `stage` recorded by GitHub Actions.

### Agent side-branch merges

Before merging a cloud-agent side branch (`cursor/issue-NNN-pr-MMM-*-agent-*` or any `*-agent-*` branch) into the main issue branch, always run the merge helper on `workflow.state.json` so `stage`, `agents`, and `loops` do not regress from stale side-branch state.

### `handoff_pending` lock

Optional object in `workflow.state.json` set by the handoff Action immediately before `POST /v1/agents`:

| Field | Purpose |
|-------|---------|
| `skill` | Target skill being spawned |
| `started_at` | ISO8601 lock time |
| `attempt` | Defer/retry counter |

Cleared on successful agent record, explicit deferral, or after **15 minutes** (stale lock). While fresh, duplicate spawns for the same issue/skill are blocked.

### Global agent cap and deferral

The handoff Action enforces a maximum of **8** concurrent in-flight Cloud Agent **runs** for this repository (`CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS`, overridable in tests). `cursor-workflow-count-active-agents.sh` counts latest runs with status `RUNNING` or `CREATING` that target `github.com/<owner>/<repo>` — not durable agent workspaces that remain `ACTIVE` after `FINISHED`. When at cap or on Cursor API 400 (plan limit), the Action **defers** with backoff and posts at most one issue comment per 30 minutes — it does not fail the workflow run.

### Babysit recovery

When `stage` is `create-pr-ready`, the linked PR is still draft, and `agents.babysit-pr` is null, the Action spawns babysit even on **sync-only** pushes (no `workflow.state.json` change). Self-heals missed handoffs from quota exhaustion or lost transitions.

### Agent conversation links

`workflow.state.json` includes an `agents` object with one entry per workflow stage:

| Key | Stage |
|-----|-------|
| `review-and-spec` | Initial `@cursoragent spec` run |
| `review-and-spec-continued` | `@cursoragent continue spec` (only set when clarifications were needed) |
| `planning` | Handoff from `spec-ready` |
| `execute` | Handoff from `plan-ready` |
| `demo` | Handoff from `execute-ready` |
| `create-pr` | Handoff from `demo-ready` |
| `babysit-pr` | Handoff from `create-pr-ready` |

Handoff stages record the agent id when `POST /v1/agents` succeeds. Spec agents are backfilled by `scripts/cursor-workflow-discover-agents.sh` (branch match via Cursor API). The issue status comment renders each as a link to `https://cursor.com/agents/{id}`.

## Loop limits (babysit stage)

| Counter | Max |
|---------|-----|
| `loops.bugbot` | 3 |
| `loops.ci_autofix` | 2 |
| `loops.total_runs` | 10 |

When any limit is exceeded: set `stage` to `blocked`, add label `cursor:blocked`, post summary on issue + PR, stop.

## GitHub labels

Create these on the repository. **Agents do not set them reliably** — `.github/workflows/cursor-workflow-handoff.yml` syncs labels from `workflow.state.json` on **every push** to a `cursor/issue-*` branch (using `GITHUB_TOKEN`).

| Label | Purpose |
|-------|---------|
| `cursor:spec-needs-info` | Spec agent waiting on your answers |
| `cursor:spec-in-progress` | Spec agent running |
| `cursor:spec-ready` | Spec committed; planning queued |
| `cursor:plan-needs-info` | Planning agent waiting on your answers (bug repro blocked) |
| `cursor:plan-in-progress` | Planning agent running |
| `cursor:plan-ready` | Plan committed; execute queued |
| `cursor:execute-in-progress` | Execute agent running |
| `cursor:execute-ready` | Code/tests done; demo queued |
| `cursor:demo-in-progress` | Demo agent running |
| `cursor:demo-ready` | Demo artifacts committed; create-pr queued |
| `cursor:create-pr-in-progress` | Create PR agent running |
| `cursor:create-pr-ready` | PR.md committed; babysit queued |
| `cursor:babysit-in-progress` | Babysit agent running |
| `cursor:changes-requested` | Post-complete scope added; PR returned to draft |
| `cursor:execute-passback` | Demo found code defect; pass-back to execute agent |
| `cursor:complete` | Babysit finished; ready for your review |
| `cursor:blocked` | Loop limit or unrecoverable failure |

## Visibility (where to see the current stage)

1. **GitHub issue** — pinned-style **status comment** (updated automatically; look for `Cursor workflow — issue #NNN`)
2. **GitHub issue labels** — `cursor:*` label matches stage
3. **Branch** — `workflow/issues/issue-NNN/workflow.state.json` → `"stage"` field
4. **Actions** — workflow run **Cursor workflow handoff** on each push to `cursor/issue-*`
5. **Issue status comment → Agent conversations** — direct links to each cloud agent run (`https://cursor.com/agents/bc-…`); handoff stages are recorded when spawned; spec agents are discovered via the Cursor API when `CURSOR_API_KEY` is set

**Manual resync** (e.g. issue already mid-flight): Actions → Cursor workflow handoff → **Run workflow** → enter issue number `45`.

Cloud agents cannot post labels/comments; **do not rely on them for status**. Push `workflow.state.json` instead.

## GitHub Action: `cursor-workflow-handoff`

Workflow file: [`.github/workflows/cursor-workflow-handoff.yml`](../../.github/workflows/cursor-workflow-handoff.yml)

### Triggers

| Event | When it runs |
|-------|----------------|
| **Push** | Any commit pushed to a branch matching `cursor/issue-*` |
| **workflow_dispatch** | Manual run from Actions tab (resync labels/comment; optionally ensure draft PR) |

Cloud agents push to `cursor/issue-{NNN}-*` branches during every stage (spec, plan, execute, demo, create-pr, babysit). The Action runs on **each of those pushes**, not only when `workflow.state.json` changes.

### What it does on every push

1. **Resolve issue number** from the branch name (`cursor/issue-45-…` → `45`).
2. **Load** `workflow/issues/issue-{NNN}/workflow.state.json` from the pushed commit.
3. **Sync GitHub issue status** via `scripts/cursor-workflow-sync-github-status.sh`:
   - Remove all existing `cursor:*` labels on the issue
   - Add the label matching the current `stage` (e.g. `cursor:execute-in-progress`)
   - Create or update the **Cursor workflow — issue #NNN** status comment (stage, skill, branch, PR, loop counters, per-stage agent conversation links)
4. **Handoff** (spawn next cloud agent) **only when**:
   - `workflow.state.json` changed in this push, **and**
   - `stage` changed to a handoff value: `spec-ready`, `plan-ready`, `execute-ready`, `demo-ready`, or `create-pr-ready`
   - **Exception:** `execute-ready` from `changes-requested` spawns **execute** (not demo)
   - **Pass-back:** `execute-passback` with `passback_to` set calls `POST /v1/agents/{id}/runs` (not `POST /v1/agents`)
   - **Re-open:** `changes-requested` converts PR to draft and increments `loops.total_runs` — does **not** spawn an agent until a follow-up push sets `execute-ready`
   - **Admission gate:** dedup against `agents.<skill>`, `handoff_pending` lock, and global 8 in-flight run cap before `POST /v1/agents` (via `cursor-workflow-spawn-agent.sh`)
   - **Babysit recovery:** on sync-only pushes, if `create-pr-ready` + draft PR + no `agents.babysit-pr` → spawn babysit (`cursor-workflow-babysit-recovery.sh`)
5. **Update draft PR body** when `workflow/issues/issue-{NNN}/PR.md` changes in the push (`scripts/cursor-workflow-update-pr-body.sh`)

Handoff uses `CURSOR_API_KEY` to call `POST https://api.cursor.com/v1/agents` with the next skill prompt via `cursor-workflow-spawn-agent.sh` (admission gate, pending lock, deferral on cap/API 400). Pass-back uses `POST https://api.cursor.com/v1/agents/{id}/runs` to continue the same agent conversation. If defer/retry exhausts, it falls back to `CURSOR_HANDOFF_GITHUB_TOKEN` posting an `@cursoragent` comment.

**Deployment note:** Workflow helper scripts are loaded from `main` in Actions. New pass-back and `changes-requested` behavior does not take effect until this work merges to `main`.

### Stage-specific handoff behavior

| New `stage` | Action |
|-------------|--------|
| `spec-ready` | Ensure draft PR exists; record PR number in `workflow.state.json`; spawn **planning** agent |
| `plan-ready` | Ensure draft PR if missing; spawn **execute** agent |
| `execute-ready` | Spawn **demo** agent |
| `demo-ready` | Spawn **create-pr** agent |
| `create-pr-ready` | Spawn **babysit-pr** agent |
| `execute-ready` (from `changes-requested`) | Spawn **execute** agent (post-complete re-open) |

Progress stages (`*-in-progress`), pass-back (`execute-passback`), re-open (`changes-requested`), and terminal stages (`complete`, `blocked`, `spec-needs-info`, `plan-needs-info`) sync labels only — no forward agent spawn (except pass-back runs API).

When `workflow/issues/issue-{NNN}/PR.md` is committed or updated, the Action sets the linked draft PR description from that file (requires `"pr"` in state). Demo screenshots in `PR.md` must use absolute `raw.githubusercontent.com` URLs — relative `demo/...` paths break when rendered on the PR page (see create-pr skill).

When `stage` is `complete`, `scripts/cursor-workflow-notify-complete.sh` also @mentions the issue author (once) and assigns the linked PR to them. Babysit agents do not post issue comments.

### Draft PR creation

At `spec-ready`, the Action creates a draft PR (if none exists) using `GITHUB_TOKEN`. Cloud agents cannot create PRs; they push commits and the open draft PR updates automatically. The PR number is written back to `workflow.state.json` on the branch.

### Manual resync (`workflow_dispatch`)

Use when labels or the status comment are out of date, or a draft PR was never linked:

1. Actions → **Cursor workflow handoff** → **Run workflow**
2. Enter the issue number
3. Optionally enable **ensure draft PR**

The resync job loads `workflow.state.json` from the remote issue branch and runs the same label/comment sync.

### Required secrets

| Secret | Purpose |
|--------|---------|
| `CURSOR_API_KEY` | Spawn next cloud agent (recommended) |
| `CURSOR_HANDOFF_GITHUB_TOKEN` | PAT fallback for `@cursoragent` handoff comments |

Workflow helper scripts are always loaded from `main` in Actions so issue branches do not need to carry the latest script versions.

## Human triggers (only you)

- Start spec: `@cursoragent spec` (or `@cursoragent use review-and-spec`)
- Resume spec: `@cursoragent continue spec`
- Resume plan: `@cursoragent continue plan` (when planning is blocked on bug-repro clarifications)
- Do **not** rely on bot `@cursoragent` comments for handoffs (filtered by GitHub/Cursor).

Automated stages 3–7 use the handoff Action or Cursor Automations (see [SETUP.md](SETUP.md)).
