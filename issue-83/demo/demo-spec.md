# Demo spec — issue #83: Harden fetch-depth / BEFORE_SHA

Planning agent output. Demo agent follows this exactly.

**Note:** This is workflow/infrastructure only — no Docker stack, API keys, or seeded watchlist required.

## Preconditions

- Repository checked out on branch `cursor/issue-83-harden-fetch-depth-before-sha`
- `bash`, `git`, and `jq` available on the VM
- Execute stage complete (helper script, YAML changes, and tests landed)

### Seed steps

None — all validation is local shell/git fixtures.

## Scenarios

### Scenario 1: Workflow paths gate passes

**Goal:** Confirm the full workflow path regression suite passes, including new handoff tests.

**Steps:**

1. From repo root, run:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
2. Confirm output ends with `PASS: no legacy workflow paths found`.

**Capture:**

- Log: `workflow/issues/issue-83/demo/scenario-1-verify-workflow-paths.log`

**Pass criteria:**

- Exit code 0
- Log shows `test-cursor-workflow-handoff.sh: all cases passed`
- No `FAIL:` lines

### Scenario 2: Multi-commit non-tip state change detected

**Goal:** Prove the push-diff helper detects `workflow.state.json` changes on commit 2 of a 3-commit push (the #79 failure mode).

**Steps:**

1. Run the handoff test suite:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh 2>&1 | tee /tmp/issue-83-handoff-tests.log
   ```
2. Confirm log contains `PASS: push diff non-tip state change` (exact test name as implemented).

**Capture:**

- Log: `workflow/issues/issue-83/demo/scenario-2-push-diff-state.log`

**Pass criteria:**

- New multi-commit state-change test passes
- Helper returns match when `BEFORE_SHA` = commit 1 and `AFTER_SHA` = commit 3 with state file changed only on commit 2

### Scenario 3: Multi-commit non-tip PR.md change detected

**Goal:** Prove `pr_md_changed` alignment — same guard logic detects `PR.md` on a non-tip commit.

**Steps:**

1. From scenario 2 log (or re-run tests), confirm `PASS: push diff non-tip pr md` (exact name as implemented).

**Capture:**

- Log: `workflow/issues/issue-83/demo/scenario-3-push-diff-pr-md.log` (may duplicate scenario-2 log if same test run)

**Pass criteria:**

- PR.md non-tip regression test passes

### Scenario 4: Handoff YAML uses full checkout

**Goal:** Static verification that checkout depth was hardened.

**Steps:**

1. Run:
   ```bash
   grep -n 'fetch-depth' .github/workflows/cursor-workflow-handoff.yml
   ```
2. Confirm both `handoff` and `resync-status` jobs show `fetch-depth: 0` (not `2`).

**Capture:**

- Log: `workflow/issues/issue-83/demo/scenario-4-fetch-depth.log`

**Pass criteria:**

- Exactly two `fetch-depth: 0` entries in the handoff workflow file
- No remaining `fetch-depth: 2` in that file

### Scenario 5: Helper script exists and is referenced

**Goal:** Confirm the DRY extraction landed and is wired into the gate.

**Steps:**

1. Verify script exists and is executable:
   ```bash
   test -x scripts/cursor-workflow-push-diff-includes.sh && echo OK
   ```
2. Verify handoff YAML references it:
   ```bash
   grep -F 'cursor-workflow-push-diff-includes.sh' .github/workflows/cursor-workflow-handoff.yml
   ```

**Capture:**

- Log: `workflow/issues/issue-83/demo/scenario-5-helper-wiring.log`

**Pass criteria:**

- Script exists, executable
- YAML contains at least one reference to the helper

## Artifacts checklist

- [ ] `scenario-1-verify-workflow-paths.log`
- [ ] `scenario-2-push-diff-state.log`
- [ ] `scenario-3-push-diff-pr-md.log` (or covered in scenario-2 combined log)
- [ ] `scenario-4-fetch-depth.log`
- [ ] `scenario-5-helper-wiring.log`
- [ ] `workflow/issues/issue-83/demo/demo-notes.md` — short narrative: what was validated, commit SHA, test command summary
- [ ] No secrets in logs

## Out of scope for demo

- Live GitHub Actions run (would require pushing and observing Actions UI)
- Docker stack / frontend / API smoke tests
- Concurrent spawn dedup (#84) or pass-back recovery (#86)
