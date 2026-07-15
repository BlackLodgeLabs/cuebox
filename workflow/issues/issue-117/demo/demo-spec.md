# Demo spec — issue #117

Demo agent follows this exactly. Workflow-script bug — **no Docker / Cuebox UI required**.

## Preconditions

- Repo checked out on issue branch `cursor/issue-117-harden-agents-list-argmax-993a` (or merged tip including execute commits).
- `jq`, `python3`, `bash` available (standard on the cloud VM).
- Product stack optional; health URLs not required for pass/fail.

### Seed steps

None (no database or watchlist state).

## Scenarios

### Scenario 0: Bug fix verification (ARG_MAX + PR filter)

**Goal:** Confirm the reproduced defect from `bug-repro-notes.md` is fixed.

**Steps:**

1. Read `workflow/issues/issue-117/demo/bug-repro-notes.md` for the pre-fix baseline (exit 126 / filter no-op).
2. Generate an 8000-item agents page (same shape as planning repro / `test_large_agents_list_no_argmax`).
3. Install a fake `curl` that writes that page to `-o` (current script) or stdout if testing a variant.
4. Run:
   ```bash
   export CURSOR_API_KEY=demo-key
   export GITHUB_REPOSITORY=BlackLodgeLabs/cuebox
   export CURSOR_AGENTS_LIST_CACHE=/tmp/cuebox-117-demo-cache.json
   rm -f "$CURSOR_AGENTS_LIST_CACHE"
   unset MOCK_CURSOR_API CURSOR_AGENTS_PR_URL
   bash scripts/cursor-workflow-fetch-agents-list.sh
   jq '.items | length' "$CURSOR_AGENTS_LIST_CACHE"
   ```
5. Re-run with:
   ```bash
   rm -f "$CURSOR_AGENTS_LIST_CACHE"
   export CURSOR_AGENTS_PR_URL=https://github.com/BlackLodgeLabs/cuebox/pull/121
   bash scripts/cursor-workflow-fetch-agents-list.sh
   jq '.items | length' "$CURSOR_AGENTS_LIST_CACHE"
   ```
6. Optionally show that the old `--argjson` wrap still fails on this runner (documents root cause), without using it in the fixed script.

**Capture:**

- Log excerpt: `workflow/issues/issue-117/demo/scenario-0-fixed-fetch.log` (commands + exit codes + item counts)
- Optional JSON summary: `workflow/issues/issue-117/demo/scenario-0-fixed-summary.json`

**Pass criteria:**

- Fetch exits **0**; unfiltered cache length **8000** (or whatever the demo fixture uses if execute changes the count — must be large enough that pre-fix `--argjson` would ARG_MAX).
- With `CURSOR_AGENTS_PR_URL` set to the sparse-matching URL, cache length **shrinks** (e.g. 80) — not equal to the full list.
- No `Argument list too long` on the fixed path.

### Scenario 1: Handoff unit regression suite

**Goal:** Prove the automated regression gate covers the fix.

**Steps:**

1. Run `bash scripts/test-cursor-workflow-handoff.sh` and capture stdout/stderr.
2. Confirm lines for large-list / PR-filter / count-active (or equivalent PASS messages from execute’s test names).

**Capture:**

- `workflow/issues/issue-117/demo/scenario-1-handoff-tests.log`

**Pass criteria:**

- Script exit code **0**.
- Large-list / PR-filter related tests **PASS**.

### Scenario 2: Workflow paths gate

**Goal:** Path registration remains green.

**Steps:**

1. Run `bash scripts/verify-workflow-paths.sh`.

**Capture:**

- `workflow/issues/issue-117/demo/scenario-2-verify-workflow-paths.log`

**Pass criteria:**

- Exit code **0**.
- `cursor-workflow-fetch-agents-list.sh` still listed / executable.

## Artifacts checklist

- [ ] `scenario-0-fixed-fetch.log` (+ optional `scenario-0-fixed-summary.json`)
- [ ] `scenario-1-handoff-tests.log`
- [ ] `scenario-2-verify-workflow-paths.log`
- [ ] `demo-notes.md` with short narrative (no secrets)
- [ ] Planning `bug-repro-*` evidence left in place for before/after comparison
