# Demo notes — issue #90

**Date:** 2026-07-08  
**Commit:** `7498c3d84edd43ee28171e9770a907277cbbd40f`  
**Branch:** `cursor/issue-90-harden-record-spawn-toctou` (demo run on `cursor/issue-90-pr-94-demo-agent-31f7`)  
**Environment:** Full Docker stack verified Up (postgres, api, frontend, backup); API and frontend health `ok`.

Workflow-script hardening demo — no UI scenarios; all tests use `MOCK_CURSOR_API=1` where POST is exercised.

## Scenario 1: Workflow path gate — PASS

Command: `bash scripts/verify-workflow-paths.sh`

- Exit code: 0
- No `FAIL:` lines in output
- Log: [scenario-1-verify-workflow-paths.log](./scenario-1-verify-workflow-paths.log)

## Scenario 2: Handoff test suite — PASS

Command: `bash scripts/test-cursor-workflow-handoff.sh`

- Exit code: 0
- Git-remote integration cases passed:
  - `PASS: git parallel pending+spawn exactly 1 POST`
  - `PASS: git record-spawn TOCTOU preserves bc-first`
  - `PASS: git record-spawn TOCTOU logged peer`
  - `PASS: git recovery rewind deferred spawn`
- Closing line: `test-cursor-workflow-handoff.sh: all cases passed`
- Log: [scenario-2-handoff-tests.log](./scenario-2-handoff-tests.log)

## Scenario 3: Record-spawn peer-abort behavior — PASS

Pre-seeded `/tmp/demo-state.json` with `agents.execute=bc-peer-demo`, then ran:

```bash
MOCK_CURSOR_API=1 scripts/cursor-workflow-record-spawn-on-branch.sh \
  /tmp/demo-state.json execute bc-late-demo cursor/issue-90-test
```

- `agents.execute` remained `bc-peer-demo` (late agent `bc-late-demo` did not overwrite)
- Stderr: `Peer agent already recorded for execute as bc-peer-demo (not bc-late-demo)`
- Log: [scenario-3-record-spawn-peer-abort.log](./scenario-3-record-spawn-peer-abort.log)

## Summary

All three scenarios passed. Record-spawn TOCTOU hardening, recovery branch-tip refetch, and real-git race tests behave as specified.
