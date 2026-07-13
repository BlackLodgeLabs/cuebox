# Demo spec — issue #111

Workflow-only change (no product UI). Demo agent validates shared @mention resolution, complete/stalled notifications, PAT fallback removal, and #110 regression (no false progress sync on failure).

## Preconditions

- Full Docker stack **not required**
- Branch: `cursor/issue-111-workflow-human-notifications` (draft PR **#114**)
- `workflow/issues/issue-111/PLAN.md` implemented on branch
- Prerequisite #110 merged (included on branch base)

### Seed steps

None (no database state required).

## Scenarios

### Scenario 1: Resolve notify targets

**Goal:** Shared helper resolves author and owner; deduplicates when same login.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh` — confirm `test_resolve_notify_targets_*` tests PASS.
2. Optionally run resolver directly with mock `gh` (if exposed in test fixtures).

**Capture:**

- Log: `workflow/issues/issue-111/demo/scenario-1-resolve-targets.log` (test output excerpt)

**Pass criteria:**

- Dedup and distinct-author/owner cases PASS
- No hardcoded usernames in script source (`grep` for known test usernames only in fixtures)

### Scenario 2: Complete notification — dual @mentions

**Goal:** `notify-complete.sh` @mentions repo owner and issue author via helper; idempotent skip on second run.

**Steps:**

1. Run handoff test suite — confirm `test_notify_complete_mentions_both` (or equivalent name from PLAN) PASS.
2. Grep `scripts/cursor-workflow-notify-complete.sh` for `resolve-notify-targets` usage.

**Capture:**

- Log: `workflow/issues/issue-111/demo/scenario-2-complete-notify.log`

**Pass criteria:**

- Test PASS; marker `<!-- cursor-workflow-complete-notify:v1 -->` preserved
- PR assignee behavior unchanged (author only)

### Scenario 3: Stalled notification replaces PAT fallback

**Goal:** Terminal spawn failure posts stalled notification, not `@cursoragent` PAT comment; no false progress sync.

**Steps:**

1. Confirm `scripts/cursor-workflow-spawn-agent.sh` has **no** `pat_fallback` function.
2. Run `bash scripts/test-cursor-workflow-handoff.sh` — confirm `test_spawn_stalled_no_progress_sync` PASS.
3. Assert log does **not** contain `Posted handoff comment` (PAT); contains stalled notification or mock comment with `cursor-workflow-stalled-notify:v1`.

**Capture:**

- Log: `workflow/issues/issue-111/demo/scenario-3-spawn-stalled.log`

**Pass criteria:**

- Stalled notifier invoked; `CURSOR_WORKFLOW_SYNC_CALL_COUNT=0`; stage unchanged in fixture

### Scenario 4: Pass-back failure uses stalled notifier

**Goal:** Pass-back API failure calls stalled notifier; no PAT comment; no false `execute-in-progress` sync.

**Steps:**

1. Confirm `scripts/cursor-workflow-passback-run.sh` has no `CURSOR_HANDOFF_GITHUB_TOKEN` `@cursoragent` block.
2. Run handoff tests — confirm `test_passback_stalled_no_progress_sync` PASS.
3. Confirm success path still syncs `execute-in-progress` (existing `test_passback_recovery` or equivalent PASS).

**Capture:**

- Log: `workflow/issues/issue-111/demo/scenario-4-passback-stalled.log`

**Pass criteria:**

- Stalled on failure; success regression PASS

### Scenario 5: Stalled notifier idempotency and body content

**Goal:** Stalled script includes reason, recovery steps, and idempotency marker.

**Steps:**

1. Run `test_notify_stalled_*` tests in handoff suite.
2. Grep `scripts/cursor-workflow-notify-stalled.sh` for marker `<!-- cursor-workflow-stalled-notify:v1 -->` and `resolve-notify-targets`.

**Capture:**

- Log: `workflow/issues/issue-111/demo/scenario-5-stalled-idempotency.log`

**Pass criteria:**

- Tests PASS; second run skips duplicate notification

### Scenario 6: Workflow path verification

**Goal:** Repository workflow checks pass with new scripts registered.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh` — exit 0.
2. Grep `scripts/cursor-workflow-load-scripts.sh` for `notify-stalled` and `resolve-notify-targets`.

**Capture:**

- Log: `workflow/issues/issue-111/demo/scenario-6-verify-paths.log`

**Pass criteria:**

- Full verify-workflow-paths PASS including embedded handoff tests

### Scenario 7: Documentation and skills spot-check

**Goal:** Four communication scenarios documented; skills distinguish genuine questions from pass-back.

**Steps:**

1. Grep `workflow/cursor-workflow/WORKFLOW.md` for stalled notification and four scenarios (complete, stalled, genuine question, step failure).
2. Grep `workflow/cursor-workflow/MCP-GITHUB.md` for `resolve-notify-targets` (no "Until #95 lands").
3. Grep `.cursor/skills/planning/SKILL.md` and `review-and-spec/SKILL.md` for genuine-question markers (`cursor-mcp-plan-questions:v1`, `cursor-mcp-spec-questions:v1`).
4. Grep `.cursor/skills/demo/SKILL.md` for pass-back rules without human question posting.

**Capture:**

- Notes in `demo-notes.md` (no screenshot required)

**Pass criteria:**

- All greps succeed; PAT fallback marked deprecated/removed in WORKFLOW.md

## Artifacts checklist

- [ ] `scenario-1-resolve-targets.log` through `scenario-6-verify-paths.log` saved under `workflow/issues/issue-111/demo/`
- [ ] `workflow/issues/issue-111/demo/demo-notes.md` with date, commit SHA, scenario pass/fail table
- [ ] No secrets in logs
