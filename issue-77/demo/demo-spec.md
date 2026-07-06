# Demo spec — issue #77

Planning agent output. Demo agent follows this exactly.

**Note:** This issue is **workflow scaffolding only** — no Cuebox application (API/frontend/DB) changes. Docker stack is **not** required unless you want to sanity-check unrelated services still work.

## Preconditions

- Repository checked out on branch `cursor/issue-77-optimize-handoff-actions-perf-e7b1`
- `jq`, `bash`, `git` available on the VM
- No API keys required for mocked shell tests

### Seed steps

None — workflow tests use fixtures under `scripts/fixtures/cursor-workflow/`.

## Scenarios

### Scenario 1: Handoff shell tests pass

**Goal:** Prove new skip-discovery, shared cache, batched-write, and comment-cache tests pass alongside existing #70 regression cases.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh` from repo root.
2. Run `bash scripts/test-cursor-workflow-record-agent.sh`.
3. Run `bash scripts/verify-workflow-paths.sh`.

**Capture:**

- Terminal output: `workflow/issues/issue-77/demo/scenario-1-test-output.log` (redirect stdout+stderr)

**Pass criteria:**

- All three scripts exit 0.
- Log contains `test-cursor-workflow-handoff.sh: all cases passed` and `PASS: no legacy workflow paths found`.
- New test names visible in log: skip discovery, shared list cache, batched spawn, no duplicate sync, comment ID cache.

### Scenario 2: Skip-discovery predicate (plan-in-progress)

**Goal:** Demonstrate discovery is skipped when stage ≥ `plan-in-progress`.

**Steps:**

1. Copy `workflow/issues/issue-77/workflow.state.json` to a temp file (or use fixture once added by execute).
2. Run `scripts/cursor-workflow-should-discover-agents.sh <state-file>` with `MOCK_CURSOR_API=1`.
3. Confirm exit code 0 (skip).
4. Set stage to `spec-ready` and clear `agents.review-and-spec` in a copy; run again — exit code 1 (should discover).

**Capture:**

- Terminal output: `workflow/issues/issue-77/demo/scenario-2-skip-discovery.log`

**Pass criteria:**

- `plan-in-progress` state → skip (exit 0).
- `spec-ready` without spec agent → run discovery (exit 1).

### Scenario 3: Workflow documentation

**Goal:** Confirm performance optimizations are documented for operators.

**Steps:**

1. Open `workflow/cursor-workflow/WORKFLOW.md`.
2. Verify section covers: skip-discovery predicate, `CURSOR_AGENTS_LIST_CACHE`, batched spawn push, `status_comment_id`, sync dedup, cap count cache, expected run-time targets, resync `discover` input.

**Capture:**

- Screenshot: `workflow/issues/issue-77/demo/scenario-3-workflow-docs.png` (section visible)

**Pass criteria:**

- All listed topics present in WORKFLOW.md.

### Scenario 4: Before/after timing (GitHub Actions)

**Goal:** Document representative Action run times after optimization.

**Steps:**

1. After execute merges to the issue branch, identify three recent **cursor-workflow-handoff** workflow runs on the issue branch (or use runs triggered during execute/PR CI):
   - **Sync-only push** (state file unchanged or stage unchanged)
   - **Handoff spawn** (e.g. `spec-ready` → planning agent)
   - **Deferred spawn** (if observable; otherwise note "not triggered" and use admission-gate mock evidence from tests)
2. Record job duration (queue + execution) from GitHub Actions UI or `gh run view`.
3. Compare to baseline from issue #72 / #77 spec (2–10+ min before).

**Capture:**

- Markdown table: `workflow/issues/issue-77/demo/scenario-4-timing.md`

**Pass criteria:**

- Table includes scenario name, run URL or run ID, duration, and pass/fail vs targets:
  - Sync-only: &lt; 2 min (often &lt; 60s excluding queue)
  - Handoff spawn: dominated by POST + one push (not 3 pushes)
  - Resync dispatch: &lt; 60s without discovery
- If live runs unavailable on VM, document mock-test evidence and note "timings pending merge to main Actions scripts."

## Artifacts checklist

- [ ] `scenario-1-test-output.log`
- [ ] `scenario-2-skip-discovery.log`
- [ ] `scenario-3-workflow-docs.png`
- [ ] `scenario-4-timing.md`
- [ ] `demo-notes.md` with short narrative
- [ ] No secrets in logs or screenshots
