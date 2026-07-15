# Bug reproduction — issue #117

**Date:** 2026-07-15  
**Planning commit (notes):** `d2981d0` (plan-in-progress)  
**Pre-fix script revision:** `089d8aa` (`scripts/cursor-workflow-fetch-agents-list.sh` before `9d590c5`)  
**Environment:** Cloud agent VM; `getconf ARG_MAX` = **2097152**; no Docker/product stack required (workflow scripts only)

## Classification

Workflow / GitHub Actions infra bug (not Cuebox app UI/API). Reproduced by exercising the handoff fetch script under a mocked large Cursor agents list.

## Steps taken

1. Checked out the pre-fix script from `089d8aa` into a temp path.
2. Generated an 8000-item agents page (~1.3 MB compact JSON for `.items`) with a fake `curl` that returns that page (no pagination).
3. Set `CURSOR_API_KEY`, `GITHUB_REPOSITORY`, and a fresh `CURSOR_AGENTS_LIST_CACHE`.
4. Ran the pre-fix fetch script.
5. Separately ran `jq -n --argjson items "$(…)" '{items: $items}'` on the same compact array.
6. For the PR-filter no-op: ran the filter expression with and without `or (. == .)` on a 3-item fixture (2 matching `pull/121`, 1 matching `pull/999`).
7. Sanity-checked the current (post-`9d590c5`) script on the same large page with and without `CURSOR_AGENTS_PR_URL`.

## Expected vs actual

| Check | Expected | Actual (pre-fix) |
|-------|----------|-------------------|
| Large-list fetch | Exit 0; cache `{"items":[…]}` with 8000 items | **Exit 126**; stderr: `fetch-broken.sh: line 74: /usr/bin/jq: Argument list too long` |
| Direct `--argjson` wrap | N/A (documents root cause) | **Exit 126**; `Argument list too long` |
| PR filter with `or (. == .)` | Shrink to matching `prUrl` only (2 of 3) | **Keeps all 3** (no-op) |
| PR filter without no-op | 2 of 3 | 2 of 3 |

## Post-fix smoke (already on branch)

Commit `9d590c5` was already on the issue branch before planning. Against the same 8000-item mock:

- Fixed fetch: **exit 0**, **8000** items in cache
- With `CURSOR_AGENTS_PR_URL=…/pull/121`: **80** items (every 100th row)

## Artifacts

| File | Contents |
|------|----------|
| `bug-repro-api-response.json` | Structured summary (exits, stderr, filter counts) |
| `bug-repro-argjson.err` | Direct `--argjson` stderr |
| `bug-repro-fetch.err` | Pre-fix script stderr (line 74 ARG_MAX) |
| `bug-repro-summary.env` | Key/value summary for quick grep |

## Environment notes

- Product Docker stack was **not** required; failure is shell/`jq` argv length.
- Matches production Action failures cited in the issue (`Argument list too long` at the final wrap line).
- Premature fix `9d590c5` already implements the SPEC direction; planning still captured evidence against the broken revision for demo Scenario 0.
