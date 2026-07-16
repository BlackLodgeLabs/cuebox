# Issue #122 — Implementation plan

**Tier:** workflow

## Overview

Harden the portable core / Cuebox adapter boundary so orchestration conventions, regression checks, and state schema are config-driven and documented — without changing observable workflow behavior (branch names, `cursor:*` labels, handoffs, recovery, or gate commands skills already use).

Precursor [#126](https://github.com/BlackLodgeLabs/cuebox/issues/126) added partial `workflow.config.yaml` and skill tiering. This plan completes the contract: expand config with orchestration keys, route script literals through `cursor-workflow-config.sh`, split monolithic `verify-workflow-paths.sh` into portable vs adapter checks, add `schema_version` + `STATE-SCHEMA.md`, and document adapter ownership in `ADAPTER.md`.

**Approach:** config-first refactor in small commits — config + resolver → script consumers → regression split → schema/docs → skill/doc touch-ups. GitHub Actions `on.push.branches` cannot be runtime-dynamic; document adapter override for branch-pattern changes and add a bootstrap step that exports config-derived env vars for shell steps.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `workflow/cursor-workflow/workflow.config.yaml` | Extend | Add `repository.base_branch`, `branch_pattern`, `label_prefix`, `archive_branch`; `orchestration.*`; `adapter` section documenting Cuebox-owned keys |
| `scripts/cursor-workflow-config.sh` | Extend | Export orchestration vars; preserve env overrides (`CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS`, etc.); `get` subcommand for all new paths |
| `scripts/cursor-workflow-load-scripts.sh` | Refactor | `FETCH_BRANCH` from `repository.base_branch` |
| `scripts/cursor-workflow-archive-completed-issue.sh` | Refactor | `ARCHIVE_BRANCH` from config |
| `scripts/cursor-workflow-delete-stale-branches.sh` | Refactor | Branch prefix/regex from config (`label_prefix` + pattern) |
| `scripts/cursor-workflow-sync-github-status.sh` | Refactor | Label prefix for `cursor:*` → `${LABEL_PREFIX}:*` |
| `scripts/cursor-workflow-strip-cursor-labels.sh` | Refactor | Label prefix from config |
| `scripts/cursor-workflow-strip-labels-from-pr.sh` | Refactor | Label prefix from config |
| `scripts/cursor-workflow-housekeeping.sh` | Refactor | Label prefix from config |
| `scripts/cursor-workflow-admission-gate.sh` | Refactor | Cap + stale minutes from config (env override preserved) |
| `scripts/cursor-workflow-refetch-state.sh` | Refactor | Stale minutes from config |
| `scripts/cursor-workflow-merge-state.sh` | Refactor | Stale minutes from config |
| `scripts/cursor-workflow-record-handoff-pending.sh` | Refactor | Stale minutes from config |
| `scripts/cursor-workflow-post-deferral-comment.sh` | Refactor | Cooldown from config |
| `scripts/verify-workflow-portable.sh` | **New** | Portable regression subset (no Cuebox product paths) |
| `scripts/verify-workflow-cuebox-adapter.sh` | **New** | Cuebox adapter assertions (docs, gates, cloud-agent, retrospectives) |
| `scripts/verify-workflow-paths.sh` | Refactor | Orchestrate portable + adapter; preserve as `$WORKFLOW_REGRESSION_GATE` entry point |
| `scripts/cursor-workflow-migrate-state.sh` | **New** | Idempotent v0→v1: add `schema_version: 1` when missing |
| `scripts/cursor-workflow-validate-state.sh` | **New** | Shared schema validation (template + tracked state files) |
| `scripts/test-cursor-workflow-config.sh` | Extend | Assert new config keys and exports |
| `scripts/test-cursor-workflow-state-schema.sh` | **New** | Template + migration + default-missing-version behavior |
| `workflow/cursor-workflow/templates/workflow.state.json` | Extend | `"schema_version": 1` |
| `workflow/cursor-workflow/STATE-SCHEMA.md` | **New** | Field semantics, compatibility policy, v1 migration |
| `workflow/cursor-workflow/ADAPTER.md` | **New** | Cuebox adapter contract (gates, CI, Docker, cloud bootstrap) |
| `workflow/cursor-workflow/CONFIG.md` | **New** (optional) | Human index: portable vs adapter keys |
| `workflow/cursor-workflow/WORKFLOW.md` | Extend | Core/adapter ownership; installer generate vs preserve |
| `workflow/cursor-workflow/SKILL-TIERING.md` | Extend | New config exports table |
| `.github/workflows/cursor-workflow-handoff.yml` | Extend | Bootstrap step sourcing config; document branch filter |
| `.github/workflows/cursor-workflow-post-merge.yml` | Extend | Bootstrap step; archive branch from config in shell steps |
| `.github/workflows/cursor-workflow-housekeeping.yml` | Extend | Bootstrap step if shell steps need label prefix |
| `workflow/issues/issue-122/workflow.state.json` | Extend | Add `schema_version: 1` when finalize plan-ready |

## Implementation steps

### 1. Configuration contract

1. Extend `workflow.config.yaml`:
   ```yaml
   repository:
     base_branch: main
     branch_pattern: cursor/issue-{issue}-{slug}
     label_prefix: cursor
     archive_branch: workflow/archive
   orchestration:
     max_active_agents: 8
     handoff_pending_stale_minutes: 15
     deferral_comment_cooldown_minutes: 30
   adapter:
     gates:
       application_default: scripts/verify-phase8-gates.sh
       application_ci_workflows: [api-ci, frontend-ci]
     environment: { ... existing environment keys ... }
   ```
2. Move `gates.application_default` and `environment.*` under documented `adapter` (keep top-level aliases or resolver fallbacks so existing `get gates.application_default` and exports keep working — no skill changes required).
3. Extend `cursor-workflow-config.sh` exports:
   - `WORKFLOW_BASE_BRANCH`, `WORKFLOW_BRANCH_PATTERN`, `WORKFLOW_LABEL_PREFIX`, `WORKFLOW_ARCHIVE_BRANCH`
   - `WORKFLOW_MAX_ACTIVE_AGENTS`, `WORKFLOW_HANDOFF_PENDING_STALE_MINUTES`, `WORKFLOW_DEFERRAL_COMMENT_COOLDOWN_MINUTES`
   - Helper: derive `WORKFLOW_BRANCH_PREFIX` (`${label_prefix}/issue-`) for grep/API matching
4. Env override precedence unchanged: `CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS`, `CURSOR_WORKFLOW_PENDING_STALE_MINUTES`, `CURSOR_WORKFLOW_DEFERRAL_COMMENT_MINUTES` win over config when set.

### 2. Script consumers

Refactor orchestration scripts to `source scripts/cursor-workflow-config.sh` at startup and replace literals:

| Literal today | Config source |
|---------------|---------------|
| `main` in load-scripts | `repository.base_branch` |
| `workflow/archive` | `repository.archive_branch` |
| `cursor/issue-` refs | `WORKFLOW_BRANCH_PREFIX` or pattern-derived regex |
| `cursor:` labels | `${WORKFLOW_LABEL_PREFIX}:` |
| `8`, `15`, `30` defaults | `orchestration.*` |

Keep behavior identical for Cuebox defaults. Update unit tests (`test-cursor-workflow-strip-cursor-labels.sh`, `test-cursor-workflow-delete-stale-branches.sh`, `test-cursor-workflow-handoff.sh`) to source config or set test env vars.

### 3. State schema version

1. Add `"schema_version": 1` to `templates/workflow.state.json`.
2. Write `STATE-SCHEMA.md`:
   - **v1 fields:** required (`issue`, `branch`, `stage`, `agents`, `loops`), optional (`pr`, `active_skill`, `active_agent_id`, `passback_*`, `handoff_pending`, `status_comment_id`, `updated_at`, `schema_version`)
   - **Compatibility:** patch = doc-only; minor = backward-compatible fields; major = breaking (requires migration + coordinated release per CALLSHEET-EXTRACTION-PLAN)
   - **Missing `schema_version`:** treated as `1` (pre-v1 in-flight branches)
3. Implement `cursor-workflow-migrate-state.sh <file>` — idempotent: if `schema_version` absent, set to `1`; no-op when already `1`.
4. Implement `cursor-workflow-validate-state.sh` — jq checks for required keys, `agents`/`loops` shape, valid `schema_version` (default 1).
5. Optionally call migrate in `cursor-workflow-merge-state.sh` before merge (non-destructive, logged when applied).

### 4. Regression split

**`verify-workflow-portable.sh`** (runs without Docker / Cuebox product tree):

- Legacy path grep guards
- State schema validation via `cursor-workflow-validate-state.sh`
- Template includes `schema_version`, pass-back fields, `handoff_pending`
- Skills reference `cursor-workflow-merge-state.sh`
- Handoff script presence + executable checks
- Portable doc keywords in `WORKFLOW.md` / `SETUP.md` (handoff, recovery, MCP)
- `load-scripts.sh` vs handoff YAML cross-check
- PR template / create-pr skill gate evidence
- Config artifacts + `test-cursor-workflow-config.sh`
- Skill grep guards (forbidden Cuebox literals in late-stage skills)
- Shell unit tests: handoff, record-agent, linked-issues, strip-labels, delete-stale-branches, mcp-github, state-schema, config
- `gh api` curl-flag guard on `cursor-workflow-*.sh`

**`verify-workflow-cuebox-adapter.sh`**:

- `ADAPTER.md` exists and lists: phase gates, `api-ci`/`frontend-ci`, health URLs, `scripts/cloud-*.sh`, `documents/cloud-agent-*.md`, host test DB URL
- `documents/cloud-agent-part2-test-data.md` and tier3 fixture doc present
- `RETROSPECTIVES.md` indexes issues #28, #59
- `AGENTS.md` workflow-review cross-link
- Config adapter section references `verify-phase8-gates.sh`
- Post-merge workflow file present

**`verify-workflow-paths.sh`:**

```bash
bash scripts/verify-workflow-portable.sh
bash scripts/verify-workflow-cuebox-adapter.sh
```

### 5. Documentation

1. **`ADAPTER.md`** — checklist of Cuebox-owned inputs; what Callsheet installer must **preserve** on update vs **generate** from templates.
2. **`CONFIG.md`** (if added) — table of portable vs adapter keys with `get` paths.
3. **`WORKFLOW.md`** — new § Core and adapter: portable core owns orchestration/templates/state/portable tests; adapter owns gates, demo stack, CI discovery, cloud bootstrap. Note: GitHub Actions branch filters must match `repository.branch_pattern` manually when changed.
4. **`SKILL-TIERING.md`** — extend config exports table.

### 6. GitHub Actions

1. Add reusable bootstrap step early in handoff/post-merge/housekeeping jobs:
   ```yaml
   - name: Load workflow config
     run: |
       source scripts/cursor-workflow-config.sh
       echo "WORKFLOW_BASE_BRANCH=$WORKFLOW_BASE_BRANCH" >> "$GITHUB_ENV"
       echo "WORKFLOW_ARCHIVE_BRANCH=$WORKFLOW_ARCHIVE_BRANCH" >> "$GITHUB_ENV"
       echo "WORKFLOW_LABEL_PREFIX=$WORKFLOW_LABEL_PREFIX" >> "$GITHUB_ENV"
   ```
2. Keep `on.push.branches: ['cursor/issue-*']` matching config default; document in `ADAPTER.md` that changing `branch_pattern` requires editing workflow YAML triggers (GitHub limitation).
3. `cursor-workflow-load-scripts.sh` already loads from `origin/main` — switch hard-coded `main` to config value.

### 7. Issue state dogfood

Add `"schema_version": 1` to `workflow/issues/issue-122/workflow.state.json` in the plan-ready commit.

## Tests required

| Test | Maps to acceptance criterion |
|------|------------------------------|
| `test-cursor-workflow-config.sh` — new keys + exports | Single configuration contract |
| `test-cursor-workflow-state-schema.sh` — template v1, missing version defaults, migrate idempotent | State schema version |
| `test-cursor-workflow-handoff.sh` — admission cap/stale from config | Behavior preserved (cap/deferral) |
| `test-cursor-workflow-strip-cursor-labels.sh` — label prefix from config | Label sync preserved |
| `test-cursor-workflow-delete-stale-branches.sh` — branch prefix from config | Post-merge cleanup preserved |
| `verify-workflow-portable.sh` exit 0 | Portable regression split |
| `verify-workflow-cuebox-adapter.sh` exit 0 | Cuebox adapter isolated |
| `verify-workflow-paths.sh` exit 0 | Workflow-tier entry point unchanged |
| Existing handoff/merge/MCP shell tests still pass | Behavior preserved |

No new API/frontend tests — workflow tier only.

## Gate script

```bash
source scripts/cursor-workflow-config.sh
bash "$WORKFLOW_REGRESSION_GATE"   # scripts/verify-workflow-paths.sh
```

Execute must run after each substantive commit batch; both portable and adapter sub-scripts must pass.

## Documentation updates

- `workflow/cursor-workflow/ADAPTER.md` (new)
- `workflow/cursor-workflow/STATE-SCHEMA.md` (new)
- `workflow/cursor-workflow/CONFIG.md` (new, optional index)
- `workflow/cursor-workflow/WORKFLOW.md` — core/adapter section
- `workflow/cursor-workflow/SKILL-TIERING.md` — config exports
- `workflow/cursor-workflow/SETUP.md` — reference config keys for cap/deferral (replace hard-coded mentions where helpful)

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Script refactor changes label/branch matching | Unit tests + identical config defaults; grep for remaining literals in portable check |
| Actions bootstrap breaks handoff | Bootstrap is additive; shell steps already source scripts from main |
| `schema_version` breaks merge-state/handoff jq | Default missing to 1; migration is additive only |
| Split regression misses an assertion | Keep `verify-workflow-paths.sh` as superset orchestrator; diff check counts before/after split |
| Config resolver failure in Actions | Fail fast with clear message; YAML keeps working defaults in branch filter |

**Rollback:** Revert commits; `workflow.config.yaml` defaults preserve current behavior. In-flight state files without `schema_version` continue to work (default 1).

## Definition of done

- [ ] `workflow.config.yaml` defines all portable orchestration keys per spec; adapter section documents Cuebox-owned keys
- [ ] `cursor-workflow-config.sh` exports new keys; `get` works for all contract paths
- [ ] Orchestration scripts read config (no remaining hard-coded `main`, `workflow/archive`, `cursor:` in portable scripts — except documented YAML filter)
- [ ] `ADAPTER.md` lists every Cuebox-owned input
- [ ] `verify-workflow-portable.sh` and `verify-workflow-cuebox-adapter.sh` exist; `verify-workflow-paths.sh` invokes both
- [ ] Template has `schema_version: 1`; `STATE-SCHEMA.md` documents fields, policy, v1 migration
- [ ] `cursor-workflow-migrate-state.sh` idempotent; validation in portable regression
- [ ] `WORKFLOW.md` describes core vs adapter ownership and installer generate/preserve contract
- [ ] `bash scripts/verify-workflow-paths.sh` exit 0
- [ ] No changes to `api/` or `frontend/` product code
- [ ] Handoff, merge-state, label sync, draft PR, recovery, post-merge archive behavior unchanged (existing shell tests green)

## PR seed

**Tier:** workflow
**What / why:** Complete the portable core / Cuebox adapter boundary (#122) so Callsheet extraction can ship a versionable orchestration core without Cuebox gate/Docker assumptions baked into portable scripts.
**Key changes:** Expand `workflow.config.yaml` + resolver; config-drive orchestration scripts; split `verify-workflow-paths.sh` into portable + adapter checks; add `schema_version`, `STATE-SCHEMA.md`, `ADAPTER.md`.
**Gate:** Workflow regression: `verify-workflow-paths.sh` exit 0 (portable + adapter sub-checks).
**How to test:** `bash scripts/verify-workflow-paths.sh`; optionally `bash scripts/verify-workflow-portable.sh` alone on a machine without Docker.
