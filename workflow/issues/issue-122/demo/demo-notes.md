# Demo notes — issue #122

**Date:** 2026-07-17  
**Tier:** workflow  
**Commit:** `604d827` (execute-complete; demo evidence in this commit)
**Branch:** `cursor/issue-122-harden-portable-workflow-boundary`

## Summary

Workflow-tier demo completed on the cloud VM. No Docker stack or application UI required. All five scenarios from `demo-spec.md` passed.

## Gate exit

```
bash scripts/verify-workflow-paths.sh → exit 0
PASS: portable workflow regression
PASS: Cuebox adapter regression
PASS: no legacy workflow paths found
```

## Scenarios

| # | Scenario | Result | Log |
|---|----------|--------|-----|
| 1 | Workflow regression gate (entry point) | PASS | `scenario-1-verify-workflow-paths.log` |
| 2 | Portable checks in isolation | PASS | `scenario-2-verify-workflow-portable.log` |
| 3 | Cuebox adapter checks | PASS | `scenario-3-verify-workflow-cuebox-adapter.log` |
| 4 | Configuration contract | PASS | `scenario-4-config-and-schema.log` |
| 5 | State schema migration | PASS | `scenario-5-state-migration.log` |

### Scenario highlights

- **Scenario 1:** `verify-workflow-paths.sh` orchestrates both portable and adapter sub-checks; final lines confirm `PASS: portable workflow regression` and `PASS: Cuebox adapter regression`.
- **Scenario 2:** `verify-workflow-portable.sh` exits 0 without invoking `verify-phase8-gates.sh` or `docker compose`.
- **Scenario 3:** `ADAPTER.md` present; Cuebox adapter regression passes.
- **Scenario 4:** Config exports match Cuebox defaults (`main`, `cursor`, `workflow/archive`, `8`); `test-cursor-workflow-config.sh` and `test-cursor-workflow-state-schema.sh` pass.
- **Scenario 5:** `cursor-workflow-migrate-state.sh` adds `schema_version: 1` when missing; second run is idempotent.

## Environment

- No API keys or running containers required
- Verification is script and documentation only
