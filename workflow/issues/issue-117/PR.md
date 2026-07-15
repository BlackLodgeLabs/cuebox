## Related Issue

Closes #117

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/117)

## Description

**What does this PR do?**

Handoff Actions for large Cursor accounts were failing with `jq: Argument list too long` (exit 126) when `scripts/cursor-workflow-fetch-agents-list.sh` wrapped the accumulated agents array via `jq -n --argjson items "$all_items"`. That blew Linux `ARG_MAX` on multi-megabyte lists. A separate PR-filter bug (`or (. == .)`) made every item match, so `CURSOR_AGENTS_PR_URL` / `prUrl` filtering never shrank the cached list.

This PR rewrites the fetch script to accumulate and wrap items via temp files / `jq` file input (never `--argjson` with the full list on argv), removes the filter no-op, prefers the `HEAD` copy of the fetch script in `load-scripts` so handoff can self-host the fix before merge to `main`, and adds a multi-MB / 8000-item regression in `scripts/test-cursor-workflow-handoff.sh`.

**Why is this the best approach?**

Temp-file / stdin accumulation preserves the existing cache contract (`{"items":[…]}`, mock path, empty-key → empty items, pagination) while eliminating the argv size limit. Fixing the filter no-op restores the intended shrink behavior that keeps recovery and babysit admission reading a smaller cache. Preferring `HEAD` for the fetch script lets dogfood handoffs load the fixed script from the issue branch before it lands on `main`. Stalled-notification wiring (#118) and demo single-push sequencing (#119) stay out of scope.

## Changes Proposed

* Rewrote `scripts/cursor-workflow-fetch-agents-list.sh` — page items accumulate into a temp JSON array (`jq -s 'add'`); final wrap is `jq '{items: .}' "$items_file"` (no `--argjson` argv)
* Removed PR-filter no-op `or (. == .)` so exact `prUrl` / slug-suffix match actually shrinks the cache; on filter `jq` failure, keep prior unfiltered fallback
* Updated `scripts/cursor-workflow-load-scripts.sh` — prefer `HEAD:scripts/cursor-workflow-fetch-agents-list.sh` so handoff self-hosts the fix before merge
* Extended `scripts/test-cursor-workflow-handoff.sh` — large-list ARG_MAX regression (8000 items), PR-filter shrink assert (80 matches), and `count-active-agents` can read the large cache
* Added workflow artifacts under `workflow/issues/issue-117/` — SPEC, PLAN, bug-repro evidence, demo-spec, and scenario logs

**Explicitly unchanged:** Cuebox API / frontend / DB; stalled notify (#118); demo push sequencing (#119); callers continue to read the cache file path.

## Scenario Results

Workflow-only change — no product UI. Demo re-ran the planning repro against the fixed fetch script and the handoff / path gates.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Bug fix verification (ARG_MAX + PR filter) | **PASS** | [scenario-0-fixed-fetch.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c6358480b9bccb7491bcff6fca444a79fc7a95c0/workflow/issues/issue-117/demo/scenario-0-fixed-fetch.log), [scenario-0-fixed-summary.json](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c6358480b9bccb7491bcff6fca444a79fc7a95c0/workflow/issues/issue-117/demo/scenario-0-fixed-summary.json) |
| 1 | Handoff unit regression suite | **PASS** | [scenario-1-handoff-tests.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c6358480b9bccb7491bcff6fca444a79fc7a95c0/workflow/issues/issue-117/demo/scenario-1-handoff-tests.log) |
| 2 | Workflow paths gate | **PASS** | [scenario-2-verify-workflow-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c6358480b9bccb7491bcff6fca444a79fc7a95c0/workflow/issues/issue-117/demo/scenario-2-verify-workflow-paths.log) |

Scenario 0 highlights (from `demo-notes.md` / summary JSON):

* Pre-fix / direct `jq --argjson` wrap on 8000-item page: **exit 126**, `Argument list too long`
* Fixed fetch unfiltered: **exit 0**, cache length **8000**
* Fixed fetch with `CURSOR_AGENTS_PR_URL=…/pull/121`: **exit 0**, cache length **80** (shrunk)
* No `Argument list too long` on the fixed path

Planning baseline: [bug-repro-notes.md](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/c6358480b9bccb7491bcff6fca444a79fc7a95c0/workflow/issues/issue-117/demo/bug-repro-notes.md)

## How to Test

1. Checkout this branch:
   ```bash
   git checkout cursor/issue-117-harden-agents-list-argmax-993a
   ```
2. Run the handoff unit suite (includes large-list / PR-filter / count-active coverage):
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
   Expect exit 0 and PASS lines for:
   - `large list reproduces ARG_MAX via --argjson`
   - `large list fetch completes without ARG_MAX (8000 items)`
   - `PR filter shrinks large list (80 matches)`
   - `count-active proceeds after large-list fetch`
3. Run workflow path verification:
   ```bash
   bash scripts/verify-workflow-paths.sh
   ```
4. Optional manual smoke (same shape as demo Scenario 0):
   ```bash
   # Use the suite’s fake-curl pattern, or inspect:
   grep -n 'argjson\|items_file\|{items: \.}' scripts/cursor-workflow-fetch-agents-list.sh
   ```
   Confirm final wrap uses file input and there is no `--argjson` with the full list.
5. Confirm product code untouched:
   ```bash
   git diff main -- api/ frontend/
   ```
   Expect empty diff.

**Docker stack not required** — workflow-script only.

## Known Issues / Notes for Reviewer

* Fix commit `9d590c5` landed before planning finished; execute verified it against plan DoD and made no further code changes.
* On filter `jq` failure the script still falls back to the unfiltered list (`if jq …; then mv; fi`) — intentional prior behavior, documented in PLAN.
* Companion issues left alone: stalled notify when recovery/fetch hard-fails ([#118](https://github.com/BlackLodgeLabs/cuebox/issues/118)); demo-ready single-push sequencing ([#119](https://github.com/BlackLodgeLabs/cuebox/issues/119)).
* Originating failure context: issue [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) workflow review / PR [#116](https://github.com/BlackLodgeLabs/cuebox/pull/116) Action runs that hit ARG_MAX during agents-list fetch.

## Gate evidence

- [x] `fix(workflow): avoid ARG_MAX in agents-list fetch` at `9d590c5` (implementation)
- [x] `bash scripts/test-cursor-workflow-handoff.sh` exit 0 at `a726b4b` (execute)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at a726b4b` (execute)
- [x] `bash scripts/test-cursor-workflow-handoff.sh` exit 0 at `c635848` (demo Scenario 1)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at c635848` (demo Scenario 2)
- [x] Demo Scenario 0 fixed path: unfiltered 8000 / filtered 80 / no ARG_MAX at `c635848`

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Workflow-only scope (no API/frontend/DB changes)
- [ ] Companions #118 / #119 left for follow-up
