# Demo notes — issue #117

**Date:** 2026-07-15  
**Demo commit:** (see git tip on `cursor/issue-117-pr-121-demo-agent-2bf0`)  
**Issue branch tip synced:** `cursor/issue-117-harden-agents-list-argmax-993a`  
**Fix under test:** `9d590c5` (`scripts/cursor-workflow-fetch-agents-list.sh` — file-input wrap, no `--argjson`)  
**Environment:** Cloud agent VM; Docker Compose stack Up (postgres/api/frontend/backup); health ok. Product UI not exercised (workflow-script bug per demo-spec).

## Scenario results

| Scenario | Result | Evidence |
|----------|--------|----------|
| 0 — Bug fix verification (ARG_MAX + PR filter) | **PASS** | `scenario-0-fixed-fetch.log`, `scenario-0-fixed-summary.json` |
| 1 — Handoff unit regression suite | **PASS** | `scenario-1-handoff-tests.log` |
| 2 — Workflow paths gate | **PASS** | `scenario-2-verify-workflow-paths.log` |

### Scenario 0

- Pre-fix baseline unchanged in `bug-repro-notes.md` (exit 126 / PR-filter no-op).
- Old `jq --argjson` wrap on 8000-item page: **exit 126**, `Argument list too long` (documents root cause).
- Fixed fetch unfiltered: **exit 0**, cache length **8000**.
- Fixed fetch with `CURSOR_AGENTS_PR_URL=…/pull/121`: **exit 0**, cache length **80** (shrunk).
- No `Argument list too long` on the fixed path.

### Scenario 1

`bash scripts/test-cursor-workflow-handoff.sh` → **exit 0**. Key lines:

- `PASS: large list reproduces ARG_MAX via --argjson`
- `PASS: large list fetch completes without ARG_MAX (8000 items)`
- `PASS: PR filter shrinks large list (80 matches)`
- `PASS: count-active proceeds after large-list fetch`
- `test-cursor-workflow-handoff.sh: all cases passed`

### Scenario 2

`bash scripts/verify-workflow-paths.sh` → **exit 0**.  
`cursor-workflow-fetch-agents-list.sh` remains listed in the handoff scripts inventory and is executable.

## Artifacts checklist

- [x] `scenario-0-fixed-fetch.log` + `scenario-0-fixed-summary.json`
- [x] `scenario-1-handoff-tests.log`
- [x] `scenario-2-verify-workflow-paths.log`
- [x] `demo-notes.md` (this file)
- [x] Planning `bug-repro-*` evidence left in place

## Stack note

Full Docker stack was running for this demo agent (user/cloud requirement). Scenarios themselves are workflow-script only and do not depend on Cuebox UI or DB seed.
