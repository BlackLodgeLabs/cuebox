# Demo spec — issue #86: Handoff recovery hardening

Planning agent replaces template per issue. Demo agent follows this exactly.

## Preconditions

- **No Docker stack required** — this change is GitHub Actions / shell workflow scripts only.
- Repository checkout on the issue branch with script changes from execute.
- `bash` and `jq` available (standard cloud VM).

### Environment setup

```bash
cd /workspace   # or repo root
export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
export CURSOR_WORKFLOW_PENDING_DRY_RUN=1
export CURSOR_WORKFLOW_TEST_MODE=1
```

## Scenarios

### Scenario 1: Workflow path regression gate

**Goal:** Confirm workflow file layout and keyword assertions still pass after changes.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh`
2. Capture stdout/stderr.

**Capture:**

- Log: `workflow/issues/issue-86/demo/scenario-1-verify-workflow-paths.log`

**Pass criteria:**

- Exit code 0.
- Log contains no `FAIL:` lines.
- Grep confirms `resync-status` step references `cursor-workflow-handoff-recovery.sh`.

### Scenario 2: Mock handoff test suite

**Goal:** Prove all four recovery gaps have automated regression coverage.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh`
2. Capture full output.

**Capture:**

- Log: `workflow/issues/issue-86/demo/scenario-2-test-handoff.log`

**Pass criteria:**

- Exit code 0; ends with `test-cursor-workflow-handoff.sh: OK` (or equivalent success line).
- Log shows PASS for new tests (names may vary; must include evidence of):
  - Pass-back recovery (`execute-passback` → runs API, not new agent)
  - Re-open inference (`execute-ready` with prior demo agent → execute `--reopen`)
  - Ensure PR on `spec-ready` / `plan-ready` recovery when `pr` null
  - Forward `execute-ready` still spawns demo when `agents.demo` null

### Scenario 3: Pass-back recovery (focused)

**Goal:** Show recovery script handles `execute-passback` without creating a new agent.

**Steps:**

1. Run only the pass-back recovery test function if the suite supports isolation; otherwise grep Scenario 2 log for pass-back PASS lines.
2. Optionally run recovery manually with fixture:

```bash
export MOCK_CURSOR_API=1
export MOCK_ACTIVE_AGENT_COUNT=0
state=$(mktemp)
cp scripts/fixtures/cursor-workflow/state-passback-recovery.json "$state"
WF=scripts scripts/cursor-workflow-handoff-recovery.sh 86 cursor/issue-86-handoff-recovery-gaps "$state"
```

**Capture:**

- Log excerpt: `workflow/issues/issue-86/demo/scenario-3-passback-recovery.log`

**Pass criteria:**

- Recovery logs pass-back run (not `Handoff recovery: spawning` with a forward skill).
- No new `agents.*` key created via `POST /v1/agents`.

### Scenario 4: Re-open inference (focused)

**Goal:** Show `execute-ready` recovery spawns execute (not demo) when re-open is inferred.

**Steps:**

1. Run recovery with re-open fixture:

```bash
export MOCK_CURSOR_API=1
export MOCK_ACTIVE_AGENT_COUNT=0
export MOCK_CURSOR_POST_CODE=201
state=$(mktemp)
cp scripts/fixtures/cursor-workflow/state-reopen-recovery.json "$state"
WF=scripts scripts/cursor-workflow-handoff-recovery.sh 86 cursor/issue-86-handoff-recovery-gaps "$state" ""
```

**Capture:**

- Log: `workflow/issues/issue-86/demo/scenario-4-reopen-recovery.log`

**Pass criteria:**

- Log contains `Handoff recovery: spawning execute` (not demo).
- Admission gate received `--reopen` (visible in spawn log or test PASS).

### Scenario 5: Ensure draft PR on early recovery

**Goal:** Show `spec-ready` recovery links a PR before building the planning prompt.

**Steps:**

1. Run recovery with null-pr fixture and mock ensure:

```bash
export MOCK_CURSOR_API=1
export MOCK_ENSURE_DRAFT_PR=99
state=$(mktemp)
cp scripts/fixtures/cursor-workflow/state-spec-ready-null-pr.json "$state"
WF=scripts scripts/cursor-workflow-handoff-recovery.sh 86 cursor/issue-86-handoff-recovery-gaps "$state"
jq -r '.pr' "$state"
```

**Capture:**

- Log: `workflow/issues/issue-86/demo/scenario-5-ensure-pr.log`
- Note the `pr` value printed by `jq`

**Pass criteria:**

- State file `pr` equals `99` after recovery.
- Spawn prompt log references `PR #99`, not `PR #null`.

## Artifacts checklist

- [ ] `scenario-1-verify-workflow-paths.log`
- [ ] `scenario-2-test-handoff.log`
- [ ] `scenario-3-passback-recovery.log`
- [ ] `scenario-4-reopen-recovery.log`
- [ ] `scenario-5-ensure-pr.log`
- [ ] `workflow/issues/issue-86/demo/demo-notes.md` with date, commit SHA, scenario pass/fail summary
- [ ] No secrets in logs
