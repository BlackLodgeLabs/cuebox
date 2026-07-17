## Related Issue

Closes #122

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/122)

## Description

**What does this PR do?**

Completes the portable core / Cuebox adapter boundary so Callsheet extraction can ship a versionable orchestration core without Cuebox gate, Docker, or cloud-bootstrap assumptions baked into portable scripts. Building on [#126](https://github.com/BlackLodgeLabs/cuebox/pull/128), this change expands `workflow.config.yaml` with orchestration keys, routes script literals through `cursor-workflow-config.sh`, splits monolithic `verify-workflow-paths.sh` into portable vs adapter checks, adds `schema_version` + `STATE-SCHEMA.md`, and documents adapter ownership in `ADAPTER.md`.

**Why is this the best approach?**

A config-first refactor in small commits keeps observable workflow behavior unchanged (branch names, `cursor:*` labels, handoffs, recovery, gate commands skills already use) while making the boundary explicit and testable. Portable regression runs without Docker or Cuebox product paths; Cuebox integration checks run separately. `verify-workflow-paths.sh` remains the workflow-tier entry point so skills and CI need no changes. GitHub Actions branch filters cannot be runtime-dynamic — bootstrap steps export config-derived env vars and `ADAPTER.md` documents manual YAML updates when `branch_pattern` changes.

## Changes Proposed

* Expanded `workflow/cursor-workflow/workflow.config.yaml` — `repository.*` (base branch, branch pattern, label prefix, archive branch), `orchestration.*` (agent cap, stale-lock, deferral cooldown), documented `adapter` section for Cuebox-owned keys
* Extended `scripts/cursor-workflow-config.sh` — exports new orchestration vars; `get` subcommand for all contract paths; env overrides preserved
* Refactored orchestration scripts to source config — admission gate, archive, delete-stale-branches, housekeeping, load-scripts, merge-state, refetch-state, record-handoff-pending, post-deferral-comment, strip-labels, sync-github-status
* Added `scripts/verify-workflow-portable.sh` — portable regression subset (no Cuebox product paths or Docker)
* Added `scripts/verify-workflow-cuebox-adapter.sh` — Cuebox adapter assertions (docs, gates, cloud-agent, retrospectives)
* Refactored `scripts/verify-workflow-paths.sh` — orchestrates portable + adapter; preserved as `$WORKFLOW_REGRESSION_GATE` entry point
* Added `scripts/cursor-workflow-migrate-state.sh` and `scripts/cursor-workflow-validate-state.sh` — idempotent v0→v1 migration and shared schema validation
* Added `workflow/cursor-workflow/STATE-SCHEMA.md`, `ADAPTER.md`, `CONFIG.md` — field semantics, compatibility policy, adapter contract
* Extended `workflow/cursor-workflow/WORKFLOW.md` and `SKILL-TIERING.md` — core/adapter ownership and config exports
* Added `schema_version: 1` to `templates/workflow.state.json`; migrate hook in merge-state
* Extended `.github/workflows/cursor-workflow-*.yml` — bootstrap step sourcing config exports
* Added `scripts/test-cursor-workflow-state-schema.sh`; extended `test-cursor-workflow-config.sh`
* Demo artifacts under `workflow/issues/issue-122/demo/` — five scenario logs and `demo-notes.md`

**Explicitly unchanged:** `api/`, `frontend/`, handoff spawn logic, label/status sync semantics, draft PR lifecycle, post-merge archive behavior.

## Scenario Results

Workflow tier — script verification only (no Docker stack or application UI).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Workflow regression gate (entry point) | **PASS** | [scenario-1-verify-workflow-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c853791e1b8b89f72c76923fecfa27dd7ad823fe/workflow/issues/issue-122/demo/scenario-1-verify-workflow-paths.log) |
| 2 | Portable checks in isolation | **PASS** | [scenario-2-verify-workflow-portable.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c853791e1b8b89f72c76923fecfa27dd7ad823fe/workflow/issues/issue-122/demo/scenario-2-verify-workflow-portable.log) |
| 3 | Cuebox adapter checks | **PASS** | [scenario-3-verify-workflow-cuebox-adapter.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c853791e1b8b89f72c76923fecfa27dd7ad823fe/workflow/issues/issue-122/demo/scenario-3-verify-workflow-cuebox-adapter.log) |
| 4 | Configuration contract | **PASS** | [scenario-4-config-and-schema.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c853791e1b8b89f72c76923fecfa27dd7ad823fe/workflow/issues/issue-122/demo/scenario-4-config-and-schema.log) |
| 5 | State schema migration | **PASS** | [scenario-5-state-migration.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c853791e1b8b89f72c76923fecfa27dd7ad823fe/workflow/issues/issue-122/demo/scenario-5-state-migration.log) |

Gate exit from demo:

```
bash scripts/verify-workflow-paths.sh → exit 0
PASS: portable workflow regression
PASS: Cuebox adapter regression
PASS: no legacy workflow paths found
```

## How to Test

1. Checkout this branch: `git checkout cursor/issue-122-harden-portable-workflow-boundary`
2. Run the workflow regression gate (portable + adapter):
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
3. Run portable checks alone (no Docker required):
   ```bash
   bash scripts/verify-workflow-portable.sh
   ```
4. Run Cuebox adapter checks:
   ```bash
   bash scripts/verify-workflow-cuebox-adapter.sh
   ```
5. Verify config contract exports match Cuebox defaults:
   ```bash
   source scripts/cursor-workflow-config.sh
   test "$WORKFLOW_BASE_BRANCH" = "main"
   test "$WORKFLOW_LABEL_PREFIX" = "cursor"
   test "$WORKFLOW_ARCHIVE_BRANCH" = "workflow/archive"
   test "$WORKFLOW_MAX_ACTIVE_AGENTS" = "8"
   bash scripts/test-cursor-workflow-config.sh
   bash scripts/test-cursor-workflow-state-schema.sh
   ```
6. Verify state migration is idempotent:
   ```bash
   cp workflow/cursor-workflow/templates/workflow.state.json /tmp/test-state.json
   jq 'del(.schema_version)' /tmp/test-state.json > /tmp/test-state-v0.json
   bash scripts/cursor-workflow-migrate-state.sh /tmp/test-state-v0.json
   jq -e '.schema_version == 1' /tmp/test-state-v0.json
   bash scripts/cursor-workflow-migrate-state.sh /tmp/test-state-v0.json  # second run no-op
   ```
7. Confirm new documentation exists:
   ```bash
   test -f workflow/cursor-workflow/ADAPTER.md
   test -f workflow/cursor-workflow/STATE-SCHEMA.md
   grep -q 'core and adapter' workflow/cursor-workflow/WORKFLOW.md
   ```

**Docker stack not required** — workflow-only scope.

## Known Issues / Notes for Reviewer

* GitHub Actions `on.push.branches` filters (`cursor/issue-*`) must be edited manually if `repository.branch_pattern` changes — documented in `ADAPTER.md` (GitHub limitation).
* Missing `schema_version` in in-flight state files is treated as `1`; migration is additive only.
* Config resolver env overrides (`CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS`, `CURSOR_WORKFLOW_PENDING_STALE_MINUTES`, `CURSOR_WORKFLOW_DEFERRAL_COMMENT_MINUTES`) take precedence over YAML defaults.
* Precursor [#126](https://github.com/BlackLodgeLabs/cuebox/pull/128) must be merged first (already on `main`).

## Gate evidence

- [ ] `Workflow regression: verify-workflow-paths.sh exit 0 at e2b9030` (execute)
- [ ] `Workflow regression: verify-workflow-paths.sh exit 0 at c853791` (demo)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] No changes to `api/` or `frontend/` product code
