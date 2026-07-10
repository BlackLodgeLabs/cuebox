# Demo notes — issue #91

**Date:** 2026-07-08  
**Commit:** `cc2f7cd6e863180d209e9f32550698bdb29563ee`  
**Branch:** `cursor/issue-91-prevent-demo-spawn-before-execute-ready`  
**Environment:** Cloud VM with full Docker stack (postgres, api, frontend, backup all Up); health checks OK on `:3000` and `:8000`.

## Summary

All five demo scenarios passed. The admission gate correctly blocks or defers demo spawn while execute is in progress or still active, proceeds when execute is complete, and re-open paths remain unaffected.

## Scenario results

### Scenario 1: Demo blocked during execute-in-progress — **PASS**

- Gate decision: `skip:execute-in-progress`
- Spawn log: `Spawn skipped: execute-in-progress`
- POST count: 0

See [scenario-1-gate-skip.log](./scenario-1-gate-skip.log).

### Scenario 2: Demo deferred when execute still active at execute-ready — **PASS**

- Gate decision: `defer:execute-active`
- Spawn logs show `Spawn deferred (execute-active)` (not "spawning demo")
- Recovery: `Handoff recovery deferred (execute-ready → demo): defer:execute-active`
- POST count: 0

Reproduces the issue #84 failure mode where `stage=execute-ready` with `active_skill=execute` must not spawn demo.

See [scenario-2-defer-execute-active.log](./scenario-2-defer-execute-active.log).

### Scenario 3: Demo proceeds when execute cycle complete — **PASS**

- Gate decision: `proceed`
- Recovery log: `Handoff recovery: spawning demo for issue #91 (stage=execute-ready)`
- Full suite confirms POST count = 1

See [scenario-3-proceed.log](./scenario-3-proceed.log).

### Scenario 4: Workflow path regression — **PASS**

- `bash scripts/verify-workflow-paths.sh` exit code 0
- No FAIL lines; `PASS: no legacy workflow paths found`

See [scenario-4-verify-workflow-paths.log](./scenario-4-verify-workflow-paths.log).

### Scenario 5: Re-open path unaffected — **PASS**

All three reopen inference assertions passed in the full handoff suite:

- `reopen inference agents+demo spawns execute`
- `reopen inference agents+demo not demo`
- `reopen inference prev_stage spawns execute`

See [scenario-5-reopen.log](./scenario-5-reopen.log).

## Commands run

```bash
export CURSOR_WORKFLOW_PENDING_DRY_RUN=1
export CURSOR_WORKFLOW_TEST_MODE=1
export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
bash scripts/test-cursor-workflow-handoff.sh
bash scripts/verify-workflow-paths.sh
```

## Artifacts

| File | Description |
|------|-------------|
| `scenario-1-gate-skip.log` | Gate skip during execute-in-progress |
| `scenario-2-defer-execute-active.log` | Defer when execute still active |
| `scenario-3-proceed.log` | Happy path demo spawn |
| `scenario-4-verify-workflow-paths.log` | Workflow path regression |
| `scenario-5-reopen.log` | Re-open inference tests |

No secrets captured in logs.
