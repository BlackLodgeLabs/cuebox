# Demo spec — issue #90

Workflow-script hardening only. **No Docker stack required.**

## Preconditions

- Repository checked out on branch `cursor/issue-90-harden-record-spawn-toctou` with execute commits applied
- `bash`, `git`, `jq` available on PATH
- No API keys required (tests use `MOCK_CURSOR_API=1` where POST is exercised)

### Seed steps

None — tests create ephemeral temp git remotes and fixtures inline.

## Scenarios

### Scenario 1: Workflow path gate

**Goal:** Confirm workflow file layout and script registration remain valid after changes.

**Steps:**

1. From repo root: `bash scripts/verify-workflow-paths.sh`
2. Capture full stdout/stderr

**Capture:**

- Log: `workflow/issues/issue-90/demo/scenario-1-verify-workflow-paths.log`

**Pass criteria:**

- Exit code 0
- No `FAIL:` lines in output

### Scenario 2: Handoff test suite (including new git-remote cases)

**Goal:** Prove record-spawn TOCTOU fix, recovery branch-tip refetch, and real-git race tests pass.

**Steps:**

1. From repo root: `bash scripts/test-cursor-workflow-handoff.sh 2>&1 | tee /tmp/handoff-test.log`
2. Confirm new cases G–I (or whatever names execute used) report `PASS`
3. Confirm closing line: `test-cursor-workflow-handoff.sh: all cases passed`

**Capture:**

- Log: `workflow/issues/issue-90/demo/scenario-2-handoff-tests.log` (copy from `/tmp/handoff-test.log`)

**Pass criteria:**

- Exit code 0
- Log contains `PASS:` for git-remote integration cases (parallel pending race, record-spawn TOCTOU, recovery rewind)
- Log contains `all cases passed`

### Scenario 3: Record-spawn peer-abort behavior (spot check)

**Goal:** Show pre-write refetch prevents overwrite when peer already recorded (mock path).

**Steps:**

1. Create temp state file with `agents.execute=bc-peer-demo`
2. Run with `MOCK_CURSOR_API=1`:
   ```bash
   scripts/cursor-workflow-record-spawn-on-branch.sh \
     /tmp/demo-state.json execute bc-late-demo cursor/issue-90-test
   ```
3. Verify state still has `bc-peer-demo` and stderr mentions peer already recorded

**Capture:**

- Log: `workflow/issues/issue-90/demo/scenario-3-record-spawn-peer-abort.log`

**Pass criteria:**

- `agents.execute` remains `bc-peer-demo`
- Log contains `Peer agent already recorded`

## Artifacts checklist

- [ ] `scenario-1-verify-workflow-paths.log`
- [ ] `scenario-2-handoff-tests.log`
- [ ] `scenario-3-record-spawn-peer-abort.log`
- [ ] `workflow/issues/issue-90/demo/demo-notes.md` with short narrative of what was run and outcomes
- [ ] No secrets in logs
