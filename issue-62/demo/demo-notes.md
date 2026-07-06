# Demo notes — issue #62

**Date:** 2026-07-02  
**Commit:** `cd4e7dc`  
**Branch:** `cursor/issue-62-harden-cursor-workflow-state-pass-back`  
**Environment:** Workflow-only (no Docker stack)

## Scenario results

| # | Scenario | Result | Artifact |
|---|----------|--------|----------|
| 1 | Workflow regression gates pass | PASS | [scenario-1-gates-pass.png](./scenario-1-gates-pass.png) |
| 2 | Execute-passback fixture and preserved agent ID | PASS | [scenario-2-passback-fixture.png](./scenario-2-passback-fixture.png) |
| 3 | Merge helper preserves remote agents | PASS | [scenario-3-merge-preserve.png](./scenario-3-merge-preserve.png) |
| 4 | Status comment pass-back rendering | PASS | [scenario-4-status-passback.png](./scenario-4-status-passback.png) |
| 5 | Skill and doc cross-check | PASS | [scenario-5-skill-grep.png](./scenario-5-skill-grep.png) |

## Evidence

### Scenario 1 — Workflow regression gates

Both scripts exited 0:

- `bash scripts/test-cursor-workflow-merge-state.sh` → `All merge-state tests passed`
- `bash scripts/verify-workflow-paths.sh` → `PASS: no legacy workflow paths found`

**Workflow regression:** `verify-workflow-paths.sh` exit 0 at `cd4e7dc`

### Scenario 2 — Execute-passback fixture

Fixture `fixture-execute-passback-state.json` documents:

- `stage`: `execute-passback`
- `passback_to`: `execute`
- `passback_reason`: non-empty string
- `agents.execute`: `bc-00000000-0000-0000-0000-000000000001` (non-null)

Merge-state tests still pass after fixture inspection.

### Scenario 3 — Merge helper preserves remote agents

`test-cursor-workflow-merge-state.sh` reports PASS for:

- `case1 agents.execute` — remote `bc-exec-123` preserved when local only updates stage
- `case3 passback_to` / `case3 passback_reason` — remote pass-back fields preserved

### Scenario 4 — Status comment pass-back rendering

No `GH_TOKEN` on cloud VM; used local preview script `render-status-preview.sh` against the fixture. Output includes:

```
| **Pass-back target** | execute ([`bc-00000000-0000-0000-0000-000000000001`](https://cursor.com/agents/bc-00000000-0000-0000-0000-000000000001)) |
| **Pass-back reason** | Demo scenario: merge helper dropped agents.execute on prior issue run |
```

### Scenario 5 — Skill and doc cross-check

Six skill files reference `cursor-workflow-merge-state.sh`:

- `review-and-spec`, `planning`, `execute`, `demo`, `create-pr`, `babysit-pr`

`WORKFLOW.md` mentions both `execute-passback` and `changes-requested` stages.

## Notes

- No secrets in artifacts or logs.
- Helper scripts in this directory (`render-status-preview.sh`, `render-terminal-screenshot.py`) were used for dry-run preview and terminal capture only.
