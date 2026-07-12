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

- **Monotonic stage:** `stage` = higher rank of remote and local (never regress e.g. `create-pr-ready` → `demo-ready` when merging agent side-branches). Planning stages rank above spec: `spec-ready` (20) < `plan-in-progress` (25) < `plan-ready` (28) < `execute-in-progress` (30). Loop-back stages rank above the stage they replace: `*-needs-info` above `*-in-progress`, `execute-passback` above `demo-in-progress`, `changes-requested` above `complete`. Explicit resume transitions (e.g. `spec-needs-info` → `spec-in-progress`, `changes-requested` → `execute-ready` → `execute-in-progress`) allow local lower-ranked stages to win when expected.
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

### Handoff recovery

When any handoff `stage` (`spec-ready` through `create-pr-ready`) has no recorded agent for the target skill, the Action spawns on **sync-only** pushes via `cursor-workflow-handoff-recovery.sh`. Covers shallow-checkout misses where `github.event.before` was not fetched and the state diff was skipped.

**Handoff recovery coverage:**

| Stage | Recovery action | Notes |
|-------|-----------------|-------|
| `spec-ready` | Spawn planning; **ensure draft PR** | |
| `plan-ready` | Spawn execute; **ensure draft PR if null** | |
| `execute-ready` | Spawn demo **or** execute (`--reopen`) | Re-open inferred via `cursor-workflow-infer-reopen.sh`; execute agent must clear `active_skill` on finalize (issue #109); defense-in-depth allows demo at `execute-ready` even with stale `active_skill=execute` |
| `demo-ready` | Spawn create-pr | |
| `create-pr-ready` | Spawn babysit-pr (draft PR check) | |
| `execute-passback` | **`POST /v1/agents/{id}/runs`** | No new agent; uses `cursor-workflow-passback-run.sh` |
| Manual resync | Same as above | After label/comment sync in `resync-status` job |

Pass-back recovery reuses the existing execute agent (`POST /v1/agents/{id}/runs`), not `POST /v1/agents`. Re-open after `changes-requested` is inferred from `prev_stage`, prior cycle agents (`agents.demo` + `agents.execute`), or recent git history of `workflow.state.json`.

### Checkout depth and `BEFORE_SHA`

Push and resync jobs use `fetch-depth: 0` (full history) so `github.event.before` (`BEFORE_SHA`) and intermediate commits are available for `git diff` across multi-commit agent pushes. Shared detection lives in `cursor-workflow-push-diff-includes.sh` (used for both `state_changed` and `pr_md_changed`). `cursor-workflow-ensure-before-sha.sh` remains defense-in-depth for edge cases (force-push, unusual runner state).

## Performance optimizations (issue #77)

Handoff Actions run time is reduced by skipping redundant Cursor API scans, deduplicating status syncs, and batching git state writes.

### Skip discovery

`cursor-workflow-should-discover-agents.sh` skips `cursor-workflow-discover-agents.sh` when:

- `agents.review-and-spec` and `agents.review-and-spec-continued` are both set, **or**
- `stage` rank is **≥ `plan-in-progress`** (25) — handoff-recorded agents do not need API backfill.

Discovery still runs for early spec stages missing `review-and-spec`. When `pr` is known, the agents list may include a `prUrl` filter.

**Resync** (`workflow_dispatch`) skips discovery by default. Enable the **discover** input to force backfill.

### Shared agents list cache

| Env / file | Purpose |
|------------|---------|
| `CURSOR_AGENTS_LIST_CACHE` | Path to JSON written once per job (default `$RUNNER_TEMP/cursor-agents-list.json`) |
| Written by | `cursor-workflow-fetch-agents-list.sh` on first list need |
| Read by | `count-active-agents`, `discover-agents` (when run) |

### Batched spawn writes

Successful spawns use `cursor-workflow-record-spawn-on-branch.sh` — one branch push records `agents.<skill>`, `active_agent_id`, `active_skill`, `handoff_pending: null`, optional `status_comment_id`, and `updated_at`.

In-job pending lock: `CURSOR_WORKFLOW_PENDING_SKILL` env (not a branch push) blocks duplicate POST within the same job.

### Cross-run spawn dedup (issue #84)

Before `POST /v1/agents`, `cursor-workflow-spawn-agent.sh` orchestrates:

1. **Re-fetch** remote `workflow.state.json` from `origin/<branch>` via `cursor-workflow-refetch-state.sh` (overlays `agents`, `handoff_pending`, `stage`, `pr`, `loops`).
2. **Admission gate** — skip if peer recorded `agents.<skill>`; defer on fresh peer `handoff_pending`; for **demo** target, skip when `stage=execute-in-progress` or stage rank &lt; `execute-ready`, defer when `active_skill=execute` **and** stage rank &lt; `execute-ready` (issue #91 / #109 — at `execute-ready`, stage rank wins over stale skill lock).
3. **Branch pending lock** — `cursor-workflow-record-handoff-pending.sh set` pushes `handoff_pending` to the branch (production) or local state (mock/dry-run) **before** the API call.
4. **Re-fetch + second gate** — peer wins (`skip:agent-already-recorded`) or holds lock (`defer:pending-lock`); holder proceeds with `CURSOR_WORKFLOW_WE_HOLD_LOCK=1`.
5. **POST** once, then `record-spawn-on-branch.sh` clears pending and records `agents.<skill>` (first-wins if peer already recorded a different id).

**Pre-write refetch (issue #90):** In production, `record-spawn-on-branch.sh` re-fetches `origin/<branch>` and re-reads `agents.<skill>` immediately before the jq write. If a peer recorded a different id during the write window, the run logs and exits 0 without overwrite. Push non-fast-forward is treated as a lost race (re-fetch, abort if peer won).

**Recovery branch-tip refetch (issue #90):** `cursor-workflow-handoff-recovery.sh` force-fetches `origin/<branch>` and calls `refetch-state.sh --agents-from-tip` before admission. Recovery never spawns when branch tip already records the target skill, even if the job's checked-out `workflow.state.json` (trigger SHA) lacks it.

If `record-spawn-on-branch.sh` fails after a successful POST, branch `handoff_pending` remains until stale (15 minutes) or recovery re-records — subsequent spawns defer on `pending-lock`. Handoff recovery uses the same refetch + gate path (no local-only bypass).

**Admission gate stdout (demo preconditions, issue #91):**

| stdout | Meaning |
|--------|---------|
| `skip:execute-in-progress` | Demo blocked — execute stage in progress |
| `skip:stage-not-ready` | Demo blocked — stage rank below `execute-ready` |
| `defer:execute-active` | Demo deferred — `active_skill=execute` while stage rank &lt; `execute-ready` (not at terminal execute stage; issue #109) |

`spawn-agent.sh` handles `defer:*` with backoff retry within the job; `skip:*` exits without POST.

### Execute finalize (`active_skill` clearing, issue #109)

On successful execute completion (including pass-back resume), the execute agent must set `stage: execute-ready` with `active_skill: null` (and optionally `active_agent_id: null`) in `workflow.state.json` before push — mirroring planning's `plan-ready` finalize. If the agent forgets, defense-in-depth admission still allows demo spawn at `execute-ready` (stage rank ≥ `execute-ready` wins over stale `active_skill=execute`). During active execute (`execute-in-progress`), demo remains blocked.

### Status comment ID (`status_comment_id`)

After the first status comment create, `status_comment_id` is stored in `workflow.state.json`. Subsequent syncs use `PATCH /issues/comments/{id}`; paginated search runs only on PATCH 404.

### Sync dedup

`CURSOR_WORKFLOW_SYNCED=1` after the first successful sync in a job. Callers skip redundant syncs unless `HANDOFF_PROGRESS_STAGE` (or other `HANDOFF_*` overrides) require a refresh. The duplicate `spec-ready` sync in the handoff YAML was removed.

### Cap count cache

`CURSOR_WORKFLOW_IN_FLIGHT_COUNT` / `CURSOR_WORKFLOW_IN_FLIGHT_COUNT_FILE` is set on the first admission-gate cap check per job (effective TTL: job lifetime). Deferral retries reuse the cached count instead of re-paginating agents.

### Checkout and setup

- Full checkout (`fetch-depth: 0`) for push/resync jobs; scripts load from `origin/main` via `cursor-workflow-load-scripts.sh`.
- `apt-get install` runs only when `jq` or `gh` is missing on the runner.

### Expected run-time targets

| Scenario | Target |
|----------|--------|
| Sync-only push (no stage change) | &lt; 2 min (often &lt; 60s excluding queue) |
| Handoff spawn | Dominated by Cursor API POST + one push |
| Resync dispatch (no discover) | &lt; 60s |

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

When GitHub MCP is configured (see [MCP-GITHUB.md](MCP-GITHUB.md)), agents **can** post human-visible comments and set labels immediately. Push `workflow.state.json` is still required for stage transitions — Actions remain authoritative for the pinned status comment and handoff spawns.

## GitHub MCP adoption

Canonical guide: [MCP-GITHUB.md](MCP-GITHUB.md) — tool mapping, idempotency markers, @mentions, availability check, fallback policy.

| Stage | Skill | MCP (add) | Actions (unchanged) |
|-------|-------|-----------|---------------------|
| 2 / 2b | `review-and-spec` | Read comments (`issue_read`); post questions (`add_issue_comment`); `spec-needs-info` label (`issue_write`) | Spawn planning at `spec-ready`; draft PR; label sync on push |
| 3 | `planning` | `plan-needs-info` questions + label | Spawn execute at `plan-ready` |
| 4 | `execute` | Issue comment when `pr` is null | Spawn demo; label sync |
| 5 | `demo` | PR scenario summary; `blocked` issue+PR comments | Spawn create-pr; pass-back spawn |
| 6 | `create-pr` | Optional: `update_pull_request` body from `PR.md` (phase 2) | Sync PR body from `PR.md`; spawn babysit |
| 7 | `babysit-pr` | Read checks/reviews; `blocked` comments; mark ready (`update_pull_request` draft=false) | Complete notification |
| — | `workflow-review` | MCP forensics (issues, PRs, checks, comments) | — |

**Actions remain authoritative for:** handoff spawn (`POST /v1/agents`), pinned status comment (`status_comment_id`), draft PR at `spec-ready`, complete/stalled notifications.

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
   - **Handoff recovery:** on sync-only pushes, if a handoff `stage` has no recorded target agent → spawn via `cursor-workflow-handoff-recovery.sh` (includes babysit on `create-pr-ready`)
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

### Create-pr push batching (issue #92)

Each push to a `cursor/issue-*` branch with a handoff `stage` can trigger `.github/workflows/cursor-workflow-handoff.yml`. Rapid successive pushes at `create-pr-ready` widened the TOCTOU window for overlapping babysit spawns in [#79](https://github.com/BlackLodgeLabs/cuebox/issues/79) and [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) dogfood.

**Expected push pattern:** 1–2 pushes total per create-pr run:

1. Optional early `create-pr-in-progress` push (progress signal only; **no `PR.md`**).
2. **One** handoff-triggering push with complete `PR.md` + `workflow.state.json` at `stage: create-pr-ready`.

Agents must resolve demo image SHA URLs **before** that final push: draft `PR.md` locally → commit → `git rev-parse HEAD` → embed SHA in URLs → `git commit --amend` if URLs changed → single push. See the create-pr skill **batched final push** sequence. Do **not** push a follow-up commit to fix demo image SHAs after `create-pr-ready`.

This complements [#84](https://github.com/BlackLodgeLabs/cuebox/issues/84) / [#90](https://github.com/BlackLodgeLabs/cuebox/issues/90) spawn dedup and admission-gate hardening; it does not replace them.

The `create-pr-ready` row in the stage table above expects a single batched push per agent run (not multiple `create-pr-ready` pushes within seconds).

When `stage` is `complete`, `scripts/cursor-workflow-notify-complete.sh` also @mentions the issue author (once) and assigns the linked PR to them. Babysit agents do not post issue comments.

### Post-merge cleanup (automated)

When a PR with `Closes #NNN` / `Fixes #NNN` merges to `main`, [`.github/workflows/cursor-workflow-post-merge.yml`](../../.github/workflows/cursor-workflow-post-merge.yml):

1. GitHub auto-closes the linked issue (from `Closes`/`Fixes` in the PR body)
2. Strips all `cursor:*` labels from linked issues
3. Moves `workflow/issues/issue-N/` to `issue-N/` on the [`workflow/archive`](https://github.com/BlackLodgeLabs/cuebox/tree/workflow/archive) branch
4. Deletes `cursor/issue-*-pr-{PR}-*` agent side-branches (and the merged PR head branch when it still exists and matches `^cursor/issue-`)

`PR.md` must include `Closes #NNN` (see create-pr skill). Demo image URLs should use **commit SHA** so PR embeds survive archive.

### Optional workflow review (human-triggered)

After babysit completes (or post-merge on a closed issue), comment **`@cursoragent workflow-review`** to produce `WORKFLOW-REVIEW.md` and update [RETROSPECTIVES.md](RETROSPECTIVES.md). **Not** spawned by the handoff Action in v1.

| Comment | Behavior |
|---------|----------|
| `@cursoragent workflow-review` | Review the issue the comment is on |
| `@cursoragent workflow review for issue NNN` | Review issue NNN explicitly |
| `@cursoragent use workflow-review skill for issue NNN` | Same as above |

**Post-merge:** fetch `workflow/archive` and read `issue-N/` paths; index link targets `workflow/archive/issue-N/WORKFLOW-REVIEW.md`.

**Link policy:** pre-merge reviews link via commit SHA; post-merge via `workflow/archive` branch — not `main` paths that will move on archive.

Skill: [`.cursor/skills/workflow-review/SKILL.md`](../../.cursor/skills/workflow-review/SKILL.md). Index: [RETROSPECTIVES.md](RETROSPECTIVES.md).

### Draft PR creation

At `spec-ready`, the Action creates a draft PR (if none exists) using `GITHUB_TOKEN`. Cloud agents cannot create PRs; they push commits and the open draft PR updates automatically. The PR number is written back to `workflow.state.json` on the branch.

### Manual resync (`workflow_dispatch`)

Use when labels or the status comment are out of date, or a draft PR was never linked:

1. Actions → **Cursor workflow handoff** → **Run workflow**
2. Enter the issue number
3. Optionally enable **ensure draft PR**
4. Optionally enable **discover** to backfill spec agent links (default: labels/comment only)

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
