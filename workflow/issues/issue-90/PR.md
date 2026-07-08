## Related Issue

Closes #90

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/90)

## Description

**What does this PR do?**

Hardens the Cursor workflow handoff scripts against race conditions that caused duplicate agent spawns during PR #88 dogfood. When two handoff runs overlapped at `create-pr-ready`, `record-spawn-on-branch.sh` could read `agents.<skill>=null` and then overwrite a peer's agent id on push (TOCTOU). Recovery could also spawn again when `actions/checkout` pinned the job to the trigger SHA while a newer branch tip already recorded the spawn.

This PR adds a pre-write refetch in `record-spawn-on-branch.sh` (abort exit 0 when a different peer id is already set), forces branch-tip agent refetch in recovery via `refetch-state --agents-from-tip`, and adds real-git integration tests (cases G–I) that exercise parallel pending/spawn races and recovery checkout rewind — not just JSON overlay mocks.

**Why is this best approach?**

Abort-before-overwrite on a fresh branch-tip read closes the TOCTOU without changing the spawn API contract. Recovery reads `agents` from `origin/<branch>` at tip rather than trusting the trigger-SHA working tree, which matches how operators expect dedup to behave. Real temp bare-remote fixtures catch git push ordering that mocked overlays cannot simulate, while cases A–F remain unchanged for #84 regression coverage.

## Changes Proposed

* **`scripts/cursor-workflow-record-spawn-on-branch.sh`** — Re-fetch `origin/<branch>` immediately before the jq write; exit 0 with peer message when `agents.<skill>` is already set to a different id; treat push non-fast-forward as a lost race.
* **`scripts/cursor-workflow-handoff-recovery.sh`** — Force-fetch branch tip and call `refetch-state` with `--agents-from-tip` before admission gate so recovery does not spawn when tip already records the target skill.
* **`scripts/cursor-workflow-refetch-state.sh`** — Add `--agents-from-tip` mode to prefer remote `agents` from `git show origin/<branch>:<path>` when available.
* **`scripts/fixtures/cursor-workflow/git-remote-test-lib.sh`** — New helper for temp bare-remote git fixtures.
* **`scripts/test-cursor-workflow-handoff.sh`** — Cases G–I: parallel pending+spawn race, record-spawn TOCTOU, recovery checkout rewind (real git, not JSON overlay).
* **`workflow/cursor-workflow/WORKFLOW.md`** — Document pre-write refetch and recovery branch-tip semantics.
* **`workflow/cursor-workflow/RETROSPECTIVES.md`** — Link `record-spawn` git race and recovery checkout rewind pattern rows to issue #90 / PR #94.

## Scenario Results

Workflow-script hardening only — no UI changes. Demo evidence is log-based.

| Scenario | Result | Evidence |
|----------|--------|----------|
| 1. Workflow path gate (`verify-workflow-paths.sh`) | PASS | [scenario-1-verify-workflow-paths.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/af4348193cdeb3c97a487bd88821aad2631390ea/workflow/issues/issue-90/demo/scenario-1-verify-workflow-paths.log) |
| 2. Handoff test suite incl. git-remote cases G–I | PASS | [scenario-2-handoff-tests.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/af4348193cdeb3c97a487bd88821aad2631390ea/workflow/issues/issue-90/demo/scenario-2-handoff-tests.log) |
| 3. Record-spawn peer-abort spot check | PASS | [scenario-3-record-spawn-peer-abort.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/af4348193cdeb3c97a487bd88821aad2631390ea/workflow/issues/issue-90/demo/scenario-3-record-spawn-peer-abort.log) |

Key assertions from scenario 2:

- `PASS: git parallel pending+spawn exactly 1 POST`
- `PASS: git record-spawn TOCTOU preserves bc-first`
- `PASS: git record-spawn TOCTOU logged peer`
- `PASS: git recovery rewind deferred spawn`

## How to Test

1. Checkout the branch: `git checkout cursor/issue-90-harden-record-spawn-toctou`
2. Run workflow path gate: `bash scripts/verify-workflow-paths.sh` — expect exit 0, no `FAIL:` lines.
3. Run handoff integration suite: `bash scripts/test-cursor-workflow-handoff.sh` — expect exit 0 and closing line `test-cursor-workflow-handoff.sh: all cases passed`.
4. Optional spot check for peer-abort behavior:
   ```bash
   jq '.agents.execute = "bc-peer-demo"' workflow/issues/issue-90/workflow.state.json > /tmp/demo-state.json
   MOCK_CURSOR_API=1 scripts/cursor-workflow-record-spawn-on-branch.sh \
     /tmp/demo-state.json execute bc-late-demo cursor/issue-90-test
   ```
   Expect stderr `Peer agent already recorded for execute as bc-peer-demo (not bc-late-demo)` and `agents.execute` unchanged.

No Docker stack, API keys, or application migrations required.

## Known Issues / Notes for Reviewer

* Workflow infrastructure only — no application, database, or frontend changes.
* `.github/workflows/cursor-workflow-handoff.yml` was intentionally left unchanged; recovery script hardening is sufficient per plan.
* Issue #86 recovery gaps (`execute-passback`, `changes-requested`, etc.) are out of scope and should inherit these spawn/record semantics after this lands.
* Demo logs are under `workflow/issues/issue-90/demo/`; no secrets in captured output.

## Gate evidence

- [x] Workflow regression: `verify-workflow-paths.sh` exit 0 at `7498c3d`
- [x] Workflow regression: `test-cursor-workflow-handoff.sh` exit 0 at `7498c3d` (cases A–I, incl. real-git G–I)

## Checklist

- [ ] Acceptance criteria in issue #90 spec are met
- [ ] No application code or schema changes
- [ ] Demo logs reviewed under `workflow/issues/issue-90/demo/`
