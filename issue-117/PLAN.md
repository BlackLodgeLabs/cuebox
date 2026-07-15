# Plan — Issue #117: Harden agents-list fetch ARG_MAX

## Overview

Fix `scripts/cursor-workflow-fetch-agents-list.sh` so large Cursor agents lists never hit Linux `ARG_MAX` via `jq --argjson`, and so client-side `prUrl` filtering actually shrinks the cache. Add a multi-MB / many-item regression in `scripts/test-cursor-workflow-handoff.sh`. Keep `scripts/verify-workflow-paths.sh` green.

**Reproduction (planning):** Against pre-fix revision `089d8aa`, an 8000-item mock page (~1.3 MB compact `.items`) caused exit **126** with `Argument list too long` at the final wrap line. The PR-filter `or (. == .)` kept all items. See `demo/bug-repro-notes.md`.

**Branch note:** Commit `9d590c5` already lands a SPEC-aligned fix + large-list test + `load-scripts` HEAD preference for the fetch script. Execute should **verify, gap-fill, and keep tests green** rather than rewrite from scratch. Do not revert `9d590c5` unless a cleaner approach is required.

## Reproduction findings

| Artifact | Finding |
|----------|---------|
| `demo/bug-repro-notes.md` | Full narrative + steps |
| `demo/bug-repro-api-response.json` | Structured exits / stderr / filter counts |
| `demo/bug-repro-fetch.err` | Pre-fix: `line 74: /usr/bin/jq: Argument list too long` |
| `demo/bug-repro-argjson.err` | Direct `--argjson` same failure |

| Case | Expected | Observed (pre-fix) |
|------|----------|----------------------|
| Large-list fetch | Exit 0, 8000 items | Exit 126, ARG_MAX |
| PR filter (3 items, 2 match) | 2 items | 3 items (no-op) |
| Post-`9d590c5` smoke | 8000 / 80 filtered | Pass |

## Root cause

1. **ARG_MAX:** After pagination, the script held the full array in a shell variable and passed it as `jq -n --argjson items "$all_items"`. On Linux (`ARG_MAX` ≈ 2 MiB on the planning VM), a multi-megabyte argv fails with exit 126.
2. **PR-filter no-op:** `or (. == .)` makes every object match, so filtering never shrinks the list even when `CURSOR_AGENTS_PR_URL` / state-derived `prUrl` is set.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `scripts/cursor-workflow-fetch-agents-list.sh` | Modify | Temp-file / stdin accumulation + wrap; remove `or (. == .)`; preserve cache/mock/empty-key/pagination |
| `scripts/cursor-workflow-load-scripts.sh` | Modify (optional but present in `9d590c5`) | Prefer `HEAD` copy of fetch script so issue-branch fix applies before merge to `main` |
| `scripts/test-cursor-workflow-handoff.sh` | Modify | Large-list ARG_MAX regression + PR-filter shrink assert; count-active can read cache |
| `scripts/fixtures/cursor-workflow/` | Add only if needed | Prefer generating the large list in-test (as `9d590c5` does) over committing multi-MB fixtures |
| `scripts/verify-workflow-paths.sh` | Verify only | Already registers fetch script; must stay green |
| `workflow/cursor-workflow/WORKFLOW.md` | Optional doc touch | Only if execute documents filter/fallback behavior change; not required for AC |
| Callers (`discover-agents`, `count-active-agents`) | Verify only | Must keep reading cache file path; no argv JSON assumption |

## Implementation steps

Ordered for small commits (skip steps already satisfied by `9d590c5` after verification):

1. **Confirm current fetch script contract**
   - Accumulate pages into a temp JSON array file (`jq -s 'add'` / process substitution), never `--argjson` with the full list on argv.
   - Final wrap: `jq '{items: .}' "$items_file" > "$CACHE"` (or stdin equivalent).
   - Preserve: early cache hit; `MOCK_CURSOR_API` + `MOCK_AGENTS_LIST_JSON`; missing `CURSOR_API_KEY` → `{"items":[]}`; `nextCursor` pagination; `MOCK_CURSOR_LIST_FETCH_COUNT_FILE` bump; stdout = cache path.
2. **Fix PR filter**
   - Drop `or (. == .)`.
   - Keep exact `prUrl` match and slug suffix match.
   - On filter `jq` failure: prefer **fail closed** (keep unfiltered only if documenting intentional fallback). Current `9d590c5` keeps unfiltered on filter jq failure via `if jq …; then mv; fi` — document that in the PR / leave as-is unless tests require fail-closed.
3. **`load-scripts` HEAD preference (recommended)**
   - Keep preferring `HEAD:scripts/cursor-workflow-fetch-agents-list.sh` so handoff self-hosts the fix before it lands on `main` (avoids loading broken main copy during dogfood).
4. **Regression tests**
   - Fake `curl` returning one multi-MB / 8000-item page under a real API path (`CURSOR_API_KEY` set, `MOCK_CURSOR_API` unset).
   - Assert fetch exit 0, `.items | length == 8000`.
   - Optionally document that direct `--argjson` hits ARG_MAX on this runner.
   - With `CURSOR_AGENTS_PR_URL` set to a sparse-matching URL, assert shrink (e.g. 80 of 8000).
   - Assert `cursor-workflow-count-active-agents.sh` can read the resulting cache (mock in-flight as needed).
5. **Gates**
   - `bash scripts/test-cursor-workflow-handoff.sh`
   - `bash scripts/verify-workflow-paths.sh`
6. **Do not** wire stalled notify (`#118`) or change demo push sequencing (`#119`).

## Tests required

| Test | Type | Acceptance criterion |
|------|------|----------------------|
| Large-list fetch completes without ARG_MAX; cache length matches | Unit (`test-cursor-workflow-handoff.sh`) | Rewrite avoids `--argjson` argv; pagination/cache preserved |
| Direct `--argjson` documents failure mode when runner ARG_MAX is typical | Unit (soft assert OK) | Grounds regression in reproduced bug |
| PR filter shrinks list when `CURSOR_AGENTS_PR_URL` set | Unit | Remove `or (. == .)` |
| `count-active-agents` reads large cache without error | Unit | Downstream admission/recovery can proceed |
| Mock path / empty key / cache hit still work | Existing unit coverage | Preserve behavior |
| `bash scripts/verify-workflow-paths.sh` | Path/regression gate | Script registered + executable |
| Full handoff suite `bash scripts/test-cursor-workflow-handoff.sh` | Suite | No regressions |

No product API/frontend/E2E or phase gate scripts are required (workflow-only).

## Gate script

Primary (no Docker/Postgres):

```bash
bash scripts/test-cursor-workflow-handoff.sh
bash scripts/verify-workflow-paths.sh
```

Use `run-gate-scripts` skill only for these two — **not** `verify-phase*-gates.sh`.

## Documentation updates

| File | Action |
|------|--------|
| `workflow/issues/issue-117/demo/*` | Already has bug-repro evidence; demo agent adds scenario outputs |
| `workflow/cursor-workflow/WORKFLOW.md` | Optional one-line note under shared agents list cache if filter behavior is clarified |
| Product `documents/` / `README.md` | **None** |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Temp-file accumulation slower on huge lists | Acceptable; correctness over argv |
| Filter fail-open vs fail-closed | Document; match intentional behavior in tests |
| `load-scripts` HEAD preference surprises runners without git HEAD | Fallback chain already tries `REF` then `HEAD` |
| Premature `9d590c5` incomplete | Execute re-runs gates; add missing asserts only |
| Rollback | Revert fetch + test + load-scripts commits on the issue branch |

## Definition of done

- [ ] Fetch script never passes the full agents array via `--argjson` / argv
- [ ] `or (. == .)` removed; PR filter shrinks when URL filter is active
- [ ] Cache / mock / empty-key / pagination / fetch-count / stdout path preserved
- [ ] Large-list regression in `test-cursor-workflow-handoff.sh` passes on a typical Linux `ARG_MAX`
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` passes
- [ ] `bash scripts/verify-workflow-paths.sh` passes
- [ ] No product code changes; `#118` / `#119` left alone
- [ ] Demo Scenario 0 can re-run the repro steps and show the fixed path
