# Demo notes — issue #83

**Date:** 2026-07-07  
**Commit:** `73699f1894875cdac0a29f9f874b81e828b723f3`  
**Branch:** `cursor/issue-83-harden-fetch-depth-before-sha`  
**Environment:** Full Docker stack running (postgres, api, frontend, backup all Up; health endpoints OK). Demo validation itself is workflow/shell-only per spec.

## Summary

Validated fetch-depth hardening (`fetch-depth: 0`), DRY push-diff helper extraction, and multi-commit non-tip `BEFORE_SHA`/`AFTER_SHA` detection for `workflow.state.json` and `PR.md` — the #79 failure mode.

## Scenarios

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Workflow paths gate | **PASS** | [scenario-1-verify-workflow-paths.log](./scenario-1-verify-workflow-paths.log) — exit 0, `test-cursor-workflow-handoff.sh: all cases passed`, `PASS: no legacy workflow paths found` |
| 2 | Multi-commit non-tip state change | **PASS** | [scenario-2-push-diff-state.log](./scenario-2-push-diff-state.log) — `PASS: push diff detects non-tip state change across full range` |
| 3 | Multi-commit non-tip PR.md change | **PASS** | [scenario-3-push-diff-pr-md.log](./scenario-3-push-diff-pr-md.log) — `PASS: push diff detects non-tip PR.md change across full range` |
| 4 | Handoff YAML full checkout | **PASS** | [scenario-4-fetch-depth.log](./scenario-4-fetch-depth.log) — two `fetch-depth: 0` entries (lines 44, 360); zero `fetch-depth: 2` |
| 5 | Helper script wired | **PASS** | [scenario-5-helper-wiring.log](./scenario-5-helper-wiring.log) — `scripts/cursor-workflow-push-diff-includes.sh` executable; referenced twice in handoff YAML |

## Commands run

```bash
bash scripts/verify-workflow-paths.sh
bash scripts/test-cursor-workflow-handoff.sh
grep -n 'fetch-depth' .github/workflows/cursor-workflow-handoff.yml
test -x scripts/cursor-workflow-push-diff-includes.sh
grep -F 'cursor-workflow-push-diff-includes.sh' .github/workflows/cursor-workflow-handoff.yml
```

## Stack verification (precondition)

```bash
docker compose ps          # all four services Up
curl http://localhost:8000/api/v1/health   # status ok, database ok
curl http://localhost:3000/api/v1/health  # status ok, database ok
curl http://localhost:3000                # HTTP 200
```

No secrets in logs or artifacts.
