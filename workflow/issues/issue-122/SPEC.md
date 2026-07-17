# Issue #122: Harden portable workflow boundary before Callsheet extraction

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/122

## Summary

The embedded Cursor workflow is ready to become a reusable product (**Callsheet**), but portable orchestration is still mixed with Cuebox-specific gate commands, Docker/demo assumptions, cloud environment setup, and path-validation assertions. This change hardens the **core/adapter boundary in Cuebox first** so a future extraction produces a versionable portable core, a small per-application adapter, and a stable update contract.

**Precursor:** [#126](https://github.com/BlackLodgeLabs/cuebox/issues/126) (merged) introduced `workflow.config.yaml`, `cursor-workflow-config.sh`, skill tiering, and grep guards that forbid hard-coded Cuebox strings in late-stage skills. #122 completes the boundary: expand the configuration contract, isolate Cuebox integration behind a documented adapter, split regression coverage, and add explicit workflow-state schema versioning.

**Downstream:** [CALLSHEET-EXTRACTION-PLAN.md](../../cursor-workflow/CALLSHEET-EXTRACTION-PLAN.md) depends on this issue; it does not prescribe #122 implementation details.

## Problem

Portable workflow behavior and Cuebox application behavior are intertwined in ways that block safe extraction:

| Area | Today | Risk for Callsheet |
|------|-------|-------------------|
| **Configuration** | `workflow.config.yaml` covers paths, gates, environment URLs, and tier loop limits only ([#126](https://github.com/BlackLodgeLabs/cuebox/issues/126)) | Base branch, branch pattern, label prefix, archive branch, agent cap, stale-lock duration, and deferral timing remain hard-coded in scripts and Actions |
| **Orchestration scripts** | `cursor-workflow-sync-github-status.sh`, `cursor-workflow-ensure-draft-pr.sh`, `cursor-workflow-archive-completed-issue.sh`, `cursor-workflow-delete-stale-branches.sh`, etc. embed `cursor/issue-*`, `cursor:*`, `workflow/archive`, `main` | Portable core would ship Cuebox naming and repo assumptions |
| **Regression checks** | `scripts/verify-workflow-paths.sh` mixes portable handoff/schema/skill checks with Cuebox-only assertions (e.g. `documents/cloud-agent-part2-test-data.md`, `RETROSPECTIVES.md` indexing specific Cuebox issues) | Callsheet CI cannot run “workflow regression” without a Docker stack or Cuebox docs tree |
| **State schema** | `workflow.state.json` template has no `schema_version`; validation is ad hoc in `verify-workflow-paths.sh` | Installer/updater cannot detect incompatible state or migrate safely |
| **Documentation** | `WORKFLOW.md` and skills reference config indirection; adapter ownership is implicit | Future installer operators lack a contract for “core owns” vs “application preserves” |

Existing Cuebox workflow behavior must remain intact: state merge, handoffs, label/status synchronization, draft PR lifecycle, recovery, pass-back, post-merge archival, and gate coverage.

## Acceptance criteria

- [ ] **Single configuration contract** — `workflow/cursor-workflow/workflow.config.yaml` (or a clearly named successor file in the same directory) defines all portable conventions currently hard-coded across workflow scripts, Actions, skills, and documentation:
  - `repository.base_branch` (default `main`)
  - `repository.branch_pattern` (default `cursor/issue-{issue}-{slug}`)
  - `repository.label_prefix` (default `cursor`)
  - `repository.archive_branch` (default `workflow/archive`)
  - `orchestration.max_active_agents` (default `8`; env override `CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS` preserved)
  - `orchestration.handoff_pending_stale_minutes` (default `15`)
  - `orchestration.deferral_comment_cooldown_minutes` (default `30`)
  - Existing keys from #126: `paths.*`, `gates.workflow_regression`, `tiering.*_loop_limits`
  - Documented **adapter-owned** keys (not portable): `gates.application_default`, `gates.application_ci_workflows`, `environment.*`, cloud bootstrap references
- [ ] **Cuebox adapter documented and isolated** — `workflow/cursor-workflow/ADAPTER.md` (or equivalent) lists every Cuebox-owned input: phase gate scripts, CI workflow names (`api-ci`, `frontend-ci`), Docker/demo requirements, health URLs, Cloud environment bootstrap (`scripts/cloud-*.sh`, `documents/cloud-agent-*.md`), and database test URLs. Portable scripts/skills/Actions resolve orchestration values via `cursor-workflow-config.sh`, not literals.
- [ ] **Regression split** — portable workflow checks run without Cuebox application infrastructure; Cuebox integration checks run separately; **both pass** in this repository:
  - Portable: `scripts/verify-workflow-portable.sh` (new) or refactored subset — handoff script presence, state schema, skill merge-state references, config resolver, template keys, shell unit tests under `scripts/test-cursor-workflow-*.sh` that do not require Cuebox product paths
  - Cuebox integration: `scripts/verify-workflow-cuebox-adapter.sh` (new) or refactored subset — adapter doc presence, application gate wiring, cloud-agent doc links, Cuebox-specific retrospective/index expectations
  - `scripts/verify-workflow-paths.sh` remains the **workflow-tier** entry point (invokes portable + adapter checks, or documents the split while preserving the same command for skills/CI)
- [ ] **State schema version** — `workflow/cursor-workflow/templates/workflow.state.json` includes `"schema_version": 1` (or current). `workflow/cursor-workflow/STATE-SCHEMA.md` documents:
  - required/optional fields and semantics
  - compatibility policy (patch/minor/major per [CALLSHEET-EXTRACTION-PLAN.md](../../cursor-workflow/CALLSHEET-EXTRACTION-PLAN.md))
  - migration rules for `schema_version` bumps (idempotent migration helper or documented manual steps for v1→v2)
  - validation registered in portable regression checks
- [ ] **Behavior preserved** — no regressions to:
  - `cursor-workflow-merge-state.sh` monotonic stage rules
  - handoff spawn, `handoff_pending`, admission cap, deferral, babysit/handoff recovery
  - label/status sync (`cursor-workflow-sync-github-status.sh`)
  - draft PR at `spec-ready`, `PR.md` sync, complete/stalled notifications
  - post-merge archive to `workflow/archive`, side-branch cleanup, housekeeping
  - skill tiering and gate evidence conventions from #126
- [ ] **Core/adapter documentation** — `WORKFLOW.md` (or `workflow/README.md`) describes:
  - what the portable core owns (orchestration, templates, state contract, portable tests)
  - what the application adapter owns (gates, demo stack, CI discovery, environment verification)
  - inputs a future Callsheet installer must **generate** vs **preserve** on update
- [ ] **Dogfood** — this workflow run posts an MCP spec-ready comment on issue #122 before the `spec-ready` state push

## Scope

### In scope

| Area | Current | Target |
|------|---------|--------|
| `workflow.config.yaml` | Partial (#126) | Full portable contract + adapter section |
| `cursor-workflow-config.sh` | Exports paths, gates, env, tier limits | Export orchestration keys; `get` subcommand for all contract paths |
| Handoff/sync/archive scripts | Hard-coded `cursor/`, `main`, `workflow/archive` | Read from config resolver |
| `.github/workflows/cursor-workflow-*.yml` | Branch filter `cursor/issue-*`, `ref: main` | Config-driven or documented adapter overrides where YAML cannot source shell config |
| `verify-workflow-paths.sh` | Monolithic | Split portable vs Cuebox adapter assertions |
| State template + validation | No version field | `schema_version` + `STATE-SCHEMA.md` + tests |
| Skills | Config indirection (#126) | Reference expanded contract keys where branch/label/archive semantics matter |
| Tests | `test-cursor-workflow-config.sh` | Extend for new keys; add schema validation test |

**Suggested file layout (planning may adjust):**

```text
workflow/cursor-workflow/
  workflow.config.yaml      # portable + adapter sections
  ADAPTER.md                # Cuebox adapter contract (new)
  STATE-SCHEMA.md           # schema version + migration policy (new)
  CONFIG.md                 # optional: human-readable contract index (new)
scripts/
  verify-workflow-portable.sh
  verify-workflow-cuebox-adapter.sh
  verify-workflow-paths.sh    # orchestrates both (workflow-tier gate)
  cursor-workflow-migrate-state.sh   # optional v1 helper if needed
```

### Out of scope

- Creating the Callsheet repository or publishing a release
- Renaming workflow paths, labels, branches, or scripts to “Callsheet” branding
- Building the Callsheet installer/update CLI (`callsheet install`, `callsheet update`, etc.)
- Changing Cuebox product behavior (API, frontend, database, provider integrations) except where required to document the adapter
- Orchestration reliability hardening tracked in [#127](https://github.com/BlackLodgeLabs/cuebox/issues/127) (dedup spawns, idempotent resume) — may land in parallel but is not a dependency for the config boundary
- v2 configurable pipeline design ([#68](https://github.com/BlackLodgeLabs/cuebox/issues/68))

## User flows / API changes

No Cuebox application UI or API changes.

### Maintainers / operators

1. **Configuration** — edit `workflow.config.yaml` adapter section for Cuebox gates, health URLs, and CI workflow names; portable keys change only when adopting a new Callsheet release or intentionally adjusting conventions.
2. **Regression** — run `bash scripts/verify-workflow-paths.sh` for workflow issues (unchanged command); optionally run portable-only checks in isolation when developing Callsheet core.
3. **State files** — new issues get `schema_version` in `workflow.state.json`; existing in-flight issue branches without the field are treated as version 1 via migration policy (no broken handoffs).
4. **Documentation** — `ADAPTER.md` is the checklist for “what Cuebox must supply” when installing Callsheet later.

### Agents

- Late-stage skills continue to `source scripts/cursor-workflow-config.sh` for gates and paths; planning classifies workflow vs application tier per `SKILL-TIERING.md`.
- No change to handoff triggers, MCP adoption ([#105](https://github.com/BlackLodgeLabs/cuebox/issues/105)), or `workflow.state.json` as the handoff contract.

## Data and integration notes

- **GitHub:** Labels remain `cursor:*`; branch pattern remains `cursor/issue-{NNN}-{slug}`; archive branch remains `workflow/archive` — values move into config, not renamed.
- **GitHub Actions:** Handoff/post-merge/housekeeping workflows continue to trigger on the configured branch pattern; YAML may use env vars set from a small bootstrap step that reads config.
- **Cursor Cloud Agents:** Agent cap and deferral behavior unchanged; values sourced from config with existing env override.
- **Database / external APIs:** None.
- **Backward compatibility:** Adding `schema_version` to the template must not break merge-state or handoff Action parsing; missing `schema_version` on existing state files defaults to `1`.

## Open questions (must be empty before plan-ready)

_None — issue body and precursor #126 provide sufficient detail. Planning may choose exact file names (`ADAPTER.md` vs `workflow.config.adapter.yaml`) and whether portable/adapter split is two scripts or one script with modes._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/122
- Callsheet extraction plan: [workflow/cursor-workflow/CALLSHEET-EXTRACTION-PLAN.md](../../cursor-workflow/CALLSHEET-EXTRACTION-PLAN.md)
- Skill tiering / config precursor: [workflow/cursor-workflow/SKILL-TIERING.md](../../cursor-workflow/SKILL-TIERING.md), [#126](https://github.com/BlackLodgeLabs/cuebox/issues/126)
- Related (out of scope here): [#127](https://github.com/BlackLodgeLabs/cuebox/issues/127) orchestration reliability, [#68](https://github.com/BlackLodgeLabs/cuebox/issues/68) v2 pipeline
