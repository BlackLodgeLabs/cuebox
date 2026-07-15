# Demo spec — issue #118

## Preconditions

- This change affects Cursor workflow shell helpers only; no application UI, database seed data, or Docker stack is required.
- Run from the repository root with `bash`, `jq`, `git`, and the test harness dependencies available.
- Use the implemented issue branch containing the expanded mocked handoff tests.

### Seed steps

None. All scenarios use the mocked Cursor API and GitHub CLI harness in `scripts/test-cursor-workflow-handoff.sh`.

## Scenarios

### Scenario 1: Agent-list failure is terminal and notified

**Goal:** Demonstrate that failed agent-list fetch/count prerequisites do not silently defer or admit a spawn.

**Steps:**

1. Run:

   ```bash
   bash scripts/test-cursor-workflow-handoff.sh \
     | tee workflow/issues/issue-118/demo/scenario-1-handoff-tests.log
   ```

2. Verify the captured output includes passing assertions for:
   - terminal recovery failures across supported ready stages;
   - an active-agent count failure;
   - the stable `agents-list-fetch-failed` reason and stalled-notification marker;
   - correct expected next skill;
   - no agent POST or false progress state after a terminal prerequisite failure;
   - notification-post failure still preserving the terminal exit.
3. Note the relevant passing assertions in `demo-notes.md`.

**Capture:**

- `workflow/issues/issue-118/demo/scenario-1-handoff-tests.log`
- `workflow/issues/issue-118/demo/demo-notes.md`

**Pass criteria:**

- The shell suite exits zero after its internal assertions pass.
- Its forced-failure tests prove recovery/direct admission returns failure while ordinary deferrals and skips retain their existing non-terminal behavior.

### Scenario 2: Workflow path and documentation regression

**Goal:** Confirm the full workflow harness and operator documentation remain valid after the handoff change.

**Steps:**

1. Run:

   ```bash
   bash scripts/verify-workflow-paths.sh \
     | tee workflow/issues/issue-118/demo/scenario-2-workflow-gate.log
   ```

2. Confirm the log reports all workflow-path and nested handoff-shell checks passing.
3. In `demo-notes.md`, reference the `agents-list-fetch-failed` troubleshooting guidance in `workflow/cursor-workflow/WORKFLOW.md` and `workflow/cursor-workflow/SETUP.md`.

**Capture:**

- `workflow/issues/issue-118/demo/scenario-2-workflow-gate.log`
- `workflow/issues/issue-118/demo/demo-notes.md`

**Pass criteria:**

- `verify-workflow-paths.sh` exits zero.
- The gate verifies the handoff test suite and documentation keyword contract.

## Artifacts checklist

- [ ] `workflow/issues/issue-118/demo/scenario-1-handoff-tests.log`
- [ ] `workflow/issues/issue-118/demo/scenario-2-workflow-gate.log`
- [ ] `workflow/issues/issue-118/demo/demo-notes.md`
- [ ] No secrets, API keys, or unredacted environment output in committed artifacts.
