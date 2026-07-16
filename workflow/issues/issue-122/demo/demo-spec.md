# Demo spec — issue #122

Planning agent output. Demo agent follows exactly.

**Tier:** workflow — no Docker stack or application UI required.

## Preconditions

- Repository checkout on branch `cursor/issue-122-harden-portable-workflow-boundary` (or merged equivalent) at execute-complete SHA
- `source scripts/cursor-workflow-config.sh` succeeds
- No API keys or running containers required

### Seed steps

None — verification is script and documentation only.

## Scenarios

### Scenario 1: Workflow regression gate (entry point)

**Goal:** Confirm the workflow-tier gate still passes end-to-end after the portable/adapter split.

**Steps:**

1. `cd` to repository root.
2. Run `bash scripts/verify-workflow-paths.sh`.
3. Capture exit code and final line of output.

**Capture:**

- Log: `workflow/issues/issue-122/demo/scenario-1-verify-workflow-paths.log`

**Pass criteria:**

- Exit code `0`
- Log contains `PASS:` from both portable and adapter sub-checks (or consolidated PASS line if orchestrator prints one summary)

### Scenario 2: Portable checks run in isolation

**Goal:** Prove portable regression does not depend on Cuebox Docker stack or application gates.

**Steps:**

1. Run `bash scripts/verify-workflow-portable.sh`.
2. Confirm it does not invoke `verify-phase8-gates.sh` or require `docker compose`.

**Capture:**

- Log: `workflow/issues/issue-122/demo/scenario-2-verify-workflow-portable.log`

**Pass criteria:**

- Exit code `0`
- Log shows config resolver, state schema, and handoff script tests passed

### Scenario 3: Cuebox adapter checks

**Goal:** Confirm Cuebox-specific integration assertions are isolated and pass.

**Steps:**

1. Run `bash scripts/verify-workflow-cuebox-adapter.sh`.
2. Verify `workflow/cursor-workflow/ADAPTER.md` exists (listed in log or `test -f`).

**Capture:**

- Log: `workflow/issues/issue-122/demo/scenario-3-verify-workflow-cuebox-adapter.log`

**Pass criteria:**

- Exit code `0`
- `ADAPTER.md` present; cloud-agent doc and application gate references validated

### Scenario 4: Configuration contract

**Goal:** New orchestration keys resolve via config.

**Steps:**

1. `source scripts/cursor-workflow-config.sh`
2. Assert exports: `WORKFLOW_BASE_BRANCH=main`, `WORKFLOW_LABEL_PREFIX=cursor`, `WORKFLOW_ARCHIVE_BRANCH=workflow/archive`, `WORKFLOW_MAX_ACTIVE_AGENTS=8`
3. Run `bash scripts/test-cursor-workflow-config.sh` and `bash scripts/test-cursor-workflow-state-schema.sh`

**Capture:**

- Log: `workflow/issues/issue-122/demo/scenario-4-config-and-schema.log`

**Pass criteria:**

- All assertions match Cuebox defaults
- Both test scripts exit `0`

### Scenario 5: State schema migration

**Goal:** Idempotent migration adds `schema_version` when missing.

**Steps:**

1. Copy `workflow/cursor-workflow/templates/workflow.state.json` to a temp file.
2. `jq 'del(.schema_version)'` on the copy.
3. Run `bash scripts/cursor-workflow-migrate-state.sh <copy>`.
4. Verify `jq '.schema_version' <copy>` prints `1`.
5. Re-run migrate; confirm no duplicate changes.

**Capture:**

- Log: `workflow/issues/issue-122/demo/scenario-5-state-migration.log`

**Pass criteria:**

- After first run: `schema_version` is `1`
- Second run: idempotent (no error, value still `1`)

## Artifacts checklist

- [ ] `scenario-1-verify-workflow-paths.log`
- [ ] `scenario-2-verify-workflow-portable.log`
- [ ] `scenario-3-verify-workflow-cuebox-adapter.log`
- [ ] `scenario-4-config-and-schema.log`
- [ ] `scenario-5-state-migration.log`
- [ ] `workflow/issues/issue-122/demo/demo-notes.md` with date, commit SHA, tier `workflow`, and gate exit summary
- [ ] No secrets in logs
