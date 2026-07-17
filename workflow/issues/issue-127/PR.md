## Related Issue

Closes #127

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/127)

## Description

**What does this PR do?**

Hardens the v1 Cursor workflow orchestrator so a single issue run completes reliably without manual nudges. Dogfood runs exposed duplicate same-skill spawns from concurrent handoff runs and side-branch pushes, optimistic `*-in-progress` labels before spawn confirmation, stalled recovery when in-job backoff exhausts, and cold-start context reload across late stages.

This PR closes the remaining orchestration reliability gaps (building on #84, #90, #91, #109, #111, #117, #118, #119) before Callsheet extraction (#122). Scope is workflow scripts, GitHub Actions, and docs only — no `api/` or `frontend/` changes.

**Why is this the best approach?**

Rather than adding more ad-hoc guards per incident, this consolidates four complementary mechanisms:

1. **Per-issue same-skill serialization** — admission gate queries the agents list so only one RUNNING/CREATING run per issue + skill can spawn.
2. **Canonical branch guard** — handoff Action exits early when `GITHUB_REF` ≠ `workflow.state.json` `.branch`, so agent side-branches never trigger label sync or spawn.
3. **Honest labels** — `HANDOFF_PROGRESS_STAGE` applies only after confirmed spawn (`CURSOR_WORKFLOW_SPAWN_CONFIRMED=1` or agent-committed `*-in-progress` in state).
4. **Durable deferred re-queue** — `handoff_deferred` marker + scheduled retry workflow when cap/transient failures exhaust in-job backoff.

Optional late-stage resume (`POST /v1/agents/{id}/runs`) is config-gated and defaults off, preserving existing cold-start behaviour until operators opt in.

## Changes Proposed

* **Config and schema** — `orchestration.late_stage_resume` and `orchestration.per_issue_spawn_serialization` in `workflow.config.yaml`; exported via `cursor-workflow-config.sh`; `handoff_deferred` documented in `STATE-SCHEMA.md`
* **Per-issue serialization** — new `cursor-workflow-count-in-flight-for-issue.sh`; extended `cursor-workflow-admission-gate.sh` with `defer:same-skill-in-flight`
* **Canonical branch guard** — `.github/workflows/cursor-workflow-handoff.yml` skips sync/spawn when push ref ≠ canonical branch
* **Honest labels** — `cursor-workflow-spawn-agent.sh` syncs labels only after `record-spawn-on-branch.sh`; `cursor-workflow-sync-github-status.sh` gates `HANDOFF_PROGRESS_STAGE` override
* **Duplicate handoff skip** — `cursor-workflow-handoff-recovery.sh` logs `skip:duplicate-handoff` when `agents.<target>` already set at tip
* **Durable re-queue** — `cursor-workflow-record-deferred-handoff.sh`, `cursor-workflow-clear-deferred-handoff.sh`, new `.github/workflows/cursor-workflow-retry-deferred.yml`
* **Late-stage resume** — `cursor-workflow-resume-agent-run.sh`; `spawn-agent.sh` uses `POST /runs` when `WORKFLOW_LATE_STAGE_RESUME=true` (default off)
* **Operator docs** — new `workflow/cursor-workflow/OPERATIONS.md`; extended `WORKFLOW.md`, `SETUP.md`
* **Skills** — minor single-push finalize notes in `demo`, `create-pr`, `babysit-pr` skills
* **Tests** — extended `scripts/test-cursor-workflow-handoff.sh` with all issue #127 acceptance cases
* **Prerequisite fix** — `cursor-workflow-config.sh` bundled in handoff Actions load path (14a6db9)

**Substantive commits:**

| SHA | Subject |
|-----|---------|
| `757bd06` | feat(workflow): add orchestration config keys for issue #127 |
| `6c53fe0` | feat(workflow): harden handoff orchestration for issue #127 |
| `12e6a40` | docs(workflow): operator checklist and issue #127 orchestration notes |
| `00c6279` | test(workflow): issue #127 handoff hardening acceptance cases |
| `92050e2` | docs(workflow): demo evidence for issue #127 |

## Scenario Results

Workflow tier — script verification only (no application UI screenshots per `demo-spec.md`).

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Handoff regression suite passes | **PASS** | [scenario-1-handoff-tests.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/92050e2d814109ec4edc6b384423d2a48067bf67/workflow/issues/issue-127/demo/scenario-1-handoff-tests.log) |
| 2 | Workflow path and portable gates | **PASS** | [scenario-2-gates.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/92050e2d814109ec4edc6b384423d2a48067bf67/workflow/issues/issue-127/demo/scenario-2-gates.log) |
| 3 | Canonical branch guard (mocked) | **PASS** | [scenario-3-canonical-guard.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/92050e2d814109ec4edc6b384423d2a48067bf67/workflow/issues/issue-127/demo/scenario-3-canonical-guard.log) |
| 4 | Honest labels on defer | **PASS** | [scenario-4-honest-labels.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/92050e2d814109ec4edc6b384423d2a48067bf67/workflow/issues/issue-127/demo/scenario-4-honest-labels.log) |
| 5 | Operator documentation exists | **PASS** | [scenario-5-operations-doc.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/92050e2d814109ec4edc6b384423d2a48067bf67/workflow/issues/issue-127/demo/scenario-5-operations-doc.log) |
| 6 | Deferred handoff marker | **PASS** | [scenario-6-deferred-marker.log](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/92050e2d814109ec4edc6b384423d2a48067bf67/workflow/issues/issue-127/demo/scenario-6-deferred-marker.log) |

**Acceptance coverage (scenario 1 log):** canonical branch guard, side-branch push ignored, same-skill in-flight defer, duplicate handoff skip, defer honest labels, deferred marker written/cleared, late-stage resume `/runs` — all PASS.

## How to Test

1. Checkout this branch: `git checkout cursor/issue-127-v1-hardening-orchestration-reliability-68f4`
2. Source config: `source scripts/cursor-workflow-config.sh`
3. Run handoff acceptance suite:
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh
   ```
   Expect exit 0 and `test-cursor-workflow-handoff.sh: all cases passed`.
4. Run workflow regression gates:
   ```bash
   bash scripts/verify-workflow-paths.sh
   bash scripts/verify-workflow-portable.sh
   ```
   Both must exit 0.
5. Verify canonical branch guard (mocked):
   ```bash
   bash scripts/test-cursor-workflow-handoff.sh 2>&1 | grep -E 'canonical branch guard|side-branch push ignored'
   ```
6. Verify operator docs registered:
   ```bash
   test -f workflow/cursor-workflow/OPERATIONS.md
   grep -q OPERATIONS.md workflow/cursor-workflow/WORKFLOW.md
   ```
7. Optional — late-stage resume path with mocked API:
   ```bash
   MOCK_CURSOR_API=1 WORKFLOW_LATE_STAGE_RESUME=true bash scripts/test-cursor-workflow-handoff.sh 2>&1 | grep late-stage
   ```
8. Confirm no application code changes:
   ```bash
   git diff main -- api/ frontend/
   ```
   Expect empty diff.

**Docker stack not required** — workflow-tier scope only.

## Known Issues / Notes for Reviewer

* Initial parallel demo run of scenario 1 hit a flaky `reopen inference agents+demo` failure (pending-lock race under concurrent load). Clean sequential re-run passed; artifacts reflect the passing run.
* `late_stage_resume` defaults to `false` in `workflow.config.yaml` — opt-in only; 409 busy defers like pass-back.
* Side-branch agent workspaces (`cursor/issue-127-pr-130-*-agent-*`) must merge to the canonical branch before handoff triggers; the canonical guard intentionally ignores side-branch pushes.
* Scheduled deferred retry (`.github/workflows/cursor-workflow-retry-deferred.yml`) respects the global 8-run cap; defers again and keeps `handoff_deferred` marker when at cap.
* Human fallback documented in `SETUP.md`: `@cursoragent use <skill> skill for issue NNN` or Actions → handoff resync.
* Draft PR #130 was created at spec-ready; execute and demo commits land on the canonical branch — no new PR opened.

## Gate evidence

- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at 00c6279` (execute)
- [x] `test-cursor-workflow-handoff.sh exit 0 at 00c6279` (execute)
- [x] `verify-workflow-portable.sh exit 0 at 00c6279` (execute)
- [x] `Workflow regression: verify-workflow-paths.sh exit 0 at 92050e2` (demo)
- [x] `test-cursor-workflow-handoff.sh: all cases passed exit 0 at 92050e2` (demo)
- [x] `verify-workflow-portable.sh exit 0 at 92050e2` (demo)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] No changes under `api/` or `frontend/`
