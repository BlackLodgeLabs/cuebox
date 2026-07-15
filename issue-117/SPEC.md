# Issue #117 — Harden agents-list fetch ARG_MAX

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/117

## Summary

Rewrite `scripts/cursor-workflow-fetch-agents-list.sh` so large Cursor agents lists never hit Linux `ARG_MAX` via `jq --argjson`, and fix the PR-filter no-op that keeps the full payload. Add a multi-MB / many-item regression in handoff unit tests so recovery and babysit spawn paths stay reliable.

## Problem

Handoff Actions for issue [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) / PR [#116](https://github.com/BlackLodgeLabs/cuebox/pull/116) failed with:

```text
cursor-workflow-fetch-agents-list.sh: line 74: /usr/bin/jq: Argument list too long
```

Root causes in `scripts/cursor-workflow-fetch-agents-list.sh`:

1. **ARG_MAX blow-up** — After pagination, the script builds `{items: …}` with `jq -n --argjson items "$all_items"`. When `$all_items` is multi-megabyte JSON, the shell passes it on argv and Linux rejects the call (`Argument list too long`).
2. **PR-filter no-op** — Client-side filter includes `or (. == .)`, so every item matches and filtering never shrinks the cached list even when `prUrl` / `CURSOR_AGENTS_PR_URL` is set.

Impact observed:

| Failure | Symptom |
|---------|---------|
| `demo-ready` handoff recovery | Fetch failure masked by `\|\| true` → green Action run, no create-pr spawn |
| `create-pr-ready` → babysit | Hard job failure (exit 126) before admission/spawn |

**Evidence:** [issue #115 WORKFLOW-REVIEW.md](https://github.com/BlackLodgeLabs/cuebox/blob/2ea2eb23634b1e3b4ee9aa547fd7338388886ad0/workflow/issues/issue-115/WORKFLOW-REVIEW.md) · [RETROSPECTIVES.md](https://github.com/BlackLodgeLabs/cuebox/blob/12f3932f8dc4425b73efa17555b5e365bc3d8a77/workflow/cursor-workflow/RETROSPECTIVES.md) · Action runs [29271594646](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29271594646), [29279362038](https://github.com/BlackLodgeLabs/cuebox/actions/runs/29279362038).

## Acceptance criteria

- [ ] Rewrite `scripts/cursor-workflow-fetch-agents-list.sh` so accumulated items are written via **stdin or a temp file** (e.g. `jq -n --slurpfile` / `jq '{items: .}' < items.json`) — **never** `--argjson` with the full list on argv
- [ ] Remove the PR-filter no-op `or (. == .)` so `prUrl` filtering actually shrinks the cached list
- [ ] Pagination + cache behavior preserved (`CURSOR_AGENTS_LIST_CACHE`, `MOCK_CURSOR_API` / `MOCK_AGENTS_LIST_JSON` path, empty-key → `{"items":[]}`, stdout prints cache path)
- [ ] Regression fixture: mock a multi-MB / many-item agents list; assert fetch completes without ARG_MAX and downstream admission/recovery can still read the cache (or fail loudly — stalled notify is [#118](https://github.com/BlackLodgeLabs/cuebox/issues/118))
- [ ] `bash scripts/test-cursor-workflow-handoff.sh` covers the large-list case
- [ ] `bash scripts/verify-workflow-paths.sh` passes

## Scope

### In scope

| Area | Change |
|------|--------|
| `scripts/cursor-workflow-fetch-agents-list.sh` | File/stdin-based item accumulation + final wrap; fix PR filter |
| Callers (`discover-agents`, `count-active-agents`) | Only if they assume argv-safe inline JSON; prefer keep reading cache file |
| `scripts/test-cursor-workflow-handoff.sh` + fixtures under `scripts/fixtures/cursor-workflow/` | Large-list / ARG_MAX regression; PR-filter shrink assertion if practical |
| `scripts/verify-workflow-paths.sh` | Remains green (script already registered) |

### Out of scope

- Stalled-notification wiring when recovery/fetch hard-fails — [#118](https://github.com/BlackLodgeLabs/cuebox/issues/118)
- Demo skill push sequencing (`demo-ready` single-push) — [#119](https://github.com/BlackLodgeLabs/cuebox/issues/119)
- Application code (API / frontend / DB)
- Changing Cursor API pagination contract beyond making client-side `prUrl` filter correct
- Removing `|| true` masking on recovery callers (may be addressed under #118 if needed; this issue’s bar is: fetch itself must not ARG_MAX)

## User flows / API changes

No product UI or Cuebox API changes.

### Operators

1. Handoff Actions with large Cursor account agent lists no longer die mid-fetch with `jq: Argument list too long`.
2. When a PR URL filter is active, the cached list is reduced to matching agents (not the full account list).
3. Recovery (`demo-ready` → create-pr) and babysit spawn (`create-pr-ready`) can reach admission/spawn instead of aborting during list fetch.

### Agents

No skill prompt changes. Spawn path becomes reliable again for large accounts.

## Technical notes (for planning / execute)

Current failure site (line ~74):

```bash
jq -n --argjson items "$all_items" '{items: $items}' > "$CACHE"
```

Preferred direction (illustrative, not prescribed API):

1. Append each page’s `.items` into a temp JSON array file using `jq` with process substitution / `--slurpfile` / stdin — never embed the full array in a shell variable passed as `--argjson`.
2. Final write: `jq '{items: .}' < accumulated.json > "$CACHE"` (or equivalent).
3. PR filter: drop `or (. == .)`; keep exact `prUrl` match and slug suffix match; on filter jq failure, preserve prior behavior of falling back to unfiltered list **only if** that remains intentional — prefer failing closed or documenting the fallback in the plan.
4. Preserve: early cache hit, mock path, missing `CURSOR_API_KEY` → empty items, pagination via `nextCursor`, `MOCK_CURSOR_LIST_FETCH_COUNT_FILE` increment.

### Suggested regression shape

- Generate (or ship a compressed fixture expanded in the test) a mock `{"items":[…]}` large enough that `--argjson` on argv would exceed typical `getconf ARG_MAX` (often ~2MB argv budget; use several MB of items to be safe).
- Under `MOCK_CURSOR_API=1` + `MOCK_AGENTS_LIST_JSON=<large fixture>`, run `cursor-workflow-fetch-agents-list.sh` and assert exit 0, cache exists, `jq '.items | length'` matches.
- Optionally assert `count-active-agents` / a thin recovery helper can read the cache without error.
- Assert PR filter without `or (. == .)` drops non-matching items when `CURSOR_AGENTS_PR_URL` is set (can use a small dedicated fixture).

## Data and integration notes

- **None** for product data stores.
- **Integration surface:** Cursor Cloud Agents list API (`GET /v1/agents`) as already used by handoff; cache file contract `{"items":[…]}` consumed by discover + count-active.
- Companion order: **#117 first**, then **#118**; **#119** can proceed in parallel.

## Open questions

_(none — issue body is sufficient to plan)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/117
- Companion: [#118](https://github.com/BlackLodgeLabs/cuebox/issues/118) (stalled notify), [#119](https://github.com/BlackLodgeLabs/cuebox/issues/119) (demo single-push)
- Originating review: issue #115 `WORKFLOW-REVIEW.md` / PR #116
- Workflow docs: [WORKFLOW.md](../../cursor-workflow/WORKFLOW.md) § Performance optimizations (shared agents list cache)
