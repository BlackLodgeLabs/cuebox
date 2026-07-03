# Demo spec — issue #62: Harden cursor workflow (state, pass-back, gates)

Planning agent output. Demo agent follows this exactly.

**Note:** This issue is **workflow scaffolding only**. The full Docker stack is **not** required. No browser UI scenarios.

## Preconditions

- Repository checked out on branch `cursor/issue-62-harden-cursor-workflow-state-pass-back`
- `jq` and `bash` available on the VM
- No API keys required

### Seed steps

_Not applicable — no scenarios depend on non-default DB or watchlist state._

## Scenarios

### Scenario 1: Workflow regression gates pass

**Goal:** Prove merge-state tests and extended `verify-workflow-paths.sh` exit 0 on the current branch.

**Steps:**

1. `cd` to repository root
2. Run `bash scripts/test-cursor-workflow-merge-state.sh`
3. Run `bash scripts/verify-workflow-paths.sh`
4. Record short SHA: `git rev-parse --short HEAD`

**Capture:**

- Screenshot: `workflow/issues/issue-62/demo/scenario-1-gates-pass.png` (terminal showing both commands with `PASS` / exit 0)

**Pass criteria:**

- Both scripts exit 0
- Output includes merge-state PASS and `PASS: no legacy workflow paths found` (or extended PASS messages from new checks)

### Scenario 2: Execute-passback fixture and preserved agent ID

**Goal:** Demonstrate `execute-passback` state shape with populated `agents.execute` and pass-back fields (acceptance: dry-run demonstration).

**Steps:**

1. Confirm `workflow/issues/issue-62/demo/fixture-execute-passback-state.json` exists on the branch (created by execute if missing; demo may create from template below)
2. Run merge-state preservation check:
   ```bash
   bash scripts/test-cursor-workflow-merge-state.sh
   ```
3. Inspect fixture JSON: `stage` is `execute-passback`, `passback_to` is `execute`, `passback_reason` is non-empty, `agents.execute` is a non-null agent ID string

**Fixture minimum (if execute did not add file):**

```json
{
  "issue": 62,
  "branch": "cursor/issue-62-harden-cursor-workflow-state-pass-back",
  "pr": 63,
  "stage": "execute-passback",
  "passback_to": "execute",
  "passback_reason": "Demo scenario: merge helper dropped agents.execute on prior issue run",
  "agents": {
    "execute": "bc-00000000-0000-0000-0000-000000000001"
  }
}
```

**Capture:**

- Screenshot: `workflow/issues/issue-62/demo/scenario-2-passback-fixture.png` (terminal `jq` pretty-print of fixture or test output)

**Pass criteria:**

- Fixture documents pass-back fields and non-null `agents.execute`
- Merge-state tests still pass

### Scenario 3: Merge helper preserves remote agents

**Goal:** Prove `cursor-workflow-merge-state.sh` keeps remote `agents.execute` when local only updates `stage`.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-merge-state.sh` (covers this case in fixtures)
2. Optionally run merge helper manually against a temp copy if execute added a documented example in `demo-notes.md`

**Capture:**

- Screenshot: `workflow/issues/issue-62/demo/scenario-3-merge-preserve.png` (test output showing agents preserved)

**Pass criteria:**

- Test script reports PASS for agent-preservation case

### Scenario 4: Status comment pass-back rendering

**Goal:** Verify `cursor-workflow-sync-github-status.sh` renders `passback_to` and `passback_reason` when set.

**Steps:**

1. If `GH_TOKEN` or `GITHUB_TOKEN` is available: run sync against Scenario 2 fixture and capture issue comment (optional live sync)
2. **Otherwise (expected on cloud VM):** run a local dry-run by invoking the script's comment body generation path, or document expected markdown in `demo-notes.md` by running:
   ```bash
   PASSBACK_TO=execute PASSBACK_REASON="Demo pass-back" \
     bash -c 'source scripts/cursor-workflow-sync-github-status.sh 2>/dev/null || true'
   ```
   Preferred: execute adds a small `scripts/cursor-workflow-render-status-preview.sh` wrapper; if present, run it against the fixture.
3. Confirm output or `demo-notes.md` includes **Pass-back target** and **Pass-back reason** lines

**Capture:**

- Screenshot: `workflow/issues/issue-62/demo/scenario-4-status-passback.png` (preview output or GitHub issue comment crop without secrets)

**Pass criteria:**

- Pass-back fields visible in rendered status comment body or documented equivalent in `demo-notes.md`

### Scenario 5: Skill and doc cross-check

**Goal:** Confirm all six workflow skills mention the merge helper (acceptance: skills document merge helper).

**Steps:**

1. `grep -l cursor-workflow-merge-state.sh .cursor/skills/*/SKILL.md`
2. Confirm six files listed (review-and-spec, planning, execute, demo, create-pr, babysit-pr)
3. `grep -E 'changes-requested|execute-passback' workflow/cursor-workflow/WORKFLOW.md`

**Capture:**

- Screenshot: `workflow/issues/issue-62/demo/scenario-5-skill-grep.png`

**Pass criteria:**

- Six skill files match
- `WORKFLOW.md` mentions both new stages

## Artifacts checklist

- [ ] `scenario-1-gates-pass.png`
- [ ] `scenario-2-passback-fixture.png`
- [ ] `scenario-3-merge-preserve.png`
- [ ] `scenario-4-status-passback.png`
- [ ] `scenario-5-skill-grep.png`
- [ ] `workflow/issues/issue-62/demo/demo-notes.md` with date, commit SHA, scenario pass/fail table, and gate evidence line: `Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>`
- [ ] No secrets in images or logs
