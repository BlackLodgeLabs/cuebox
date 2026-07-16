# Implementation plan — Issue #126

Pre-#122 skill trims and portability prep: tier late-stage workflow skills, add config indirection, and enforce a light path for workflow-only issues.

**Tier:** `workflow` (authoritative — no `api/` or `frontend/` product changes in scope)

## Overview

Workflow-only issues (#103, #105) already document “no Docker stack” in PLAN/demo-spec prose, but skills still default to full-stack demo, phase-8 gates, and broad `WORKFLOW.md` ingestion. Agents must infer the lighter path from scattered instructions.

Execute will:

1. Add **`workflow/cursor-workflow/workflow.config.yaml`** and **`scripts/cursor-workflow-config.sh`** — committed config entry point and shell resolver exporting `$WORKFLOW_*`, `$APP_*`, and `$GITHUB_REPO_SLUG` variables.
2. Add **`workflow/cursor-workflow/SKILL-TIERING.md`** — classification rules (`workflow` vs `application`), `WORKFLOW.md` excerpt map, PR-seed contract, and tier-aware loop limits.
3. Update **five skills** (`planning`, `execute`, `demo`, `create-pr`, `babysit-pr`) to reference config variables, classify tier, and branch behavior.
4. Extend **`scripts/verify-workflow-paths.sh`** (and a focused unit test script) to register config, resolver, tiering doc, PR-seed requirement, and grep guards for hard-coded Cuebox strings in the five skills.
5. Leave **orchestrator, state schema, and handoff YAML** unchanged (#127 / #122 handle those separately).

**Dogfood:** This issue’s planning agent set `tier: workflow`; demo should use the light path (single `verify-workflow-paths.sh` run + minimal `demo-notes.md`).

## Reproduction findings

Not an application bug — workflow efficiency gap. Confirmed by static review of current skills and prior workflow-only issues:

| Symptom | Evidence |
|---------|----------|
| Demo always assumes Docker + health URLs | `.cursor/skills/demo/SKILL.md` § Environment: `docker compose ps`, `localhost:3000/8000` |
| Planning may bring up stack for docs work | `.cursor/skills/planning/SKILL.md` § Bug reproduction: stack health checks (correct for app bugs, not workflow tier) |
| Execute defaults to phase 8 gate | `.cursor/skills/execute/SKILL.md` § Tests: `verify-phase8-gates.sh` default |
| Create-pr reads full SPEC + PLAN + no PR seed | `.cursor/skills/create-pr/SKILL.md` § Read first: full SPEC, PLAN, no PR seed section |
| Babysit uniform loop limits | `.cursor/skills/babysit-pr/SKILL.md`: `bugbot: 3`, `ci_autofix: 2` for all tiers |
| Hard-coded Cuebox strings in skills | Grep: `localhost:`, `verify-phase8`, `postgresql+psycopg` in planning/execute/demo skills |
| Prose-only light path | `workflow/issues/issue-105/demo/demo-spec.md` says “Docker not required” but demo skill does not enforce |

No stack bring-up or bug reproduction performed (workflow tier; per SPEC and planning skill classification).

## Root cause

Skills were authored for a single “full product issue” path. Workflow/docs issues share the same skill contracts, so agents over-read context, start Docker, and run heavy gates unless PLAN prose explicitly overrides — which is easy to miss and not regression-tested.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `workflow/cursor-workflow/workflow.config.yaml` | **New** | Committed config: paths, repo slug, gates, health URLs, tier loop limits |
| `scripts/cursor-workflow-config.sh` | **New** | Resolver: `source` or `get <dot.path>`; exports env vars for skills |
| `workflow/cursor-workflow/SKILL-TIERING.md` | **New** | Tier classification, excerpt map, PR seed contract, tier behaviors |
| `.cursor/skills/planning/SKILL.md` | Edit | Stage excerpts not full WORKFLOW.md; skip stack/bug-repro for `workflow` tier; emit PR seed + tier front matter |
| `.cursor/skills/execute/SKILL.md` | Edit | Tier-aware default gate; PLAN-only reads; config vars for DB URL / gates |
| `.cursor/skills/demo/SKILL.md` | Edit | `workflow` tier light path via config gate; no Docker unless PLAN requires |
| `.cursor/skills/create-pr/SKILL.md` | Edit | PR seed first; targeted PLAN excerpts; link excerpt map not full WORKFLOW.md |
| `.cursor/skills/babysit-pr/SKILL.md` | Edit | Tier-aware loop limits + early-exit when CI green and Bugbot quiet |
| `scripts/test-cursor-workflow-config.sh` | **New** | Offline unit tests for resolver keys and exports |
| `scripts/verify-workflow-paths.sh` | Edit | Register config, resolver, SKILL-TIERING, PR-seed checks, skill grep guards |
| `workflow/cursor-workflow/WORKFLOW.md` | Edit (minor) | Cross-link `SKILL-TIERING.md` and config; note tiering is skill-enforced |
| `AGENTS.md` | Edit (optional) | One-line cross-link to `SKILL-TIERING.md` in workflow section |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| `.github/workflows/cursor-workflow-handoff.yml` | Spec: no orchestrator changes |
| `scripts/cursor-workflow-spawn-agent.sh` | Handoff spawn logic (#127) |
| `.cursor/skills/review-and-spec/SKILL.md` | Out of scope (cross-link only if trivial) |
| `.cursor/skills/workflow-review/SKILL.md` | Out of scope |
| `.cursor/skills/run-gate-scripts/SKILL.md` | Out of scope (may reference config in a follow-up) |
| `api/`, `frontend/`, `docker-compose.yml` | No product changes |

## Implementation steps

### Step 1 — Config file and resolver

Create `workflow/cursor-workflow/workflow.config.yaml` per SPEC illustrative shape:

- `version: 1`
- `paths.artifact_root`, `paths.workflow_docs`, `paths.skills_root`
- `repository.owner`, `repository.name`
- `gates.workflow_regression`, `gates.application_default`
- `environment.health_url_frontend`, `environment.health_url_api`, `environment.database_url_host_test`
- `tiering.workflow_loop_limits` (`bugbot: 1`, `ci_autofix: 1`)
- `tiering.application_loop_limits` (`bugbot: 3`, `ci_autofix: 2`)

Create `scripts/cursor-workflow-config.sh`:

```bash
# Usage:
#   source scripts/cursor-workflow-config.sh
#   bash scripts/cursor-workflow-config.sh get gates.workflow_regression
```

Behavior:

1. Resolve config path relative to repo root (`workflow/cursor-workflow/workflow.config.yaml`).
2. Parse YAML (prefer `yq` if available; fallback to small embedded Python/`jq`+`ruby` pattern consistent with repo — no new heavy deps if avoidable).
3. On `source`: export documented variables, e.g.:
   - `WORKFLOW_ARTIFACT_ROOT`
   - `WORKFLOW_REGRESSION_GATE`
   - `APP_DEFAULT_GATE`
   - `APP_HEALTH_URL_FRONTEND`
   - `APP_HEALTH_URL_API`
   - `APP_DATABASE_URL_HOST_TEST`
   - `GITHUB_REPO_SLUG` (`owner/name`)
   - `WORKFLOW_LOOP_LIMIT_BUGBOT`, `WORKFLOW_LOOP_LIMIT_CI_AUTOFIX` (workflow tier)
   - `APPLICATION_LOOP_LIMIT_BUGBOT`, `APPLICATION_LOOP_LIMIT_CI_AUTOFIX`
4. On `get <path>`: print single value (for scripts/skills).
5. Exit non-zero if config missing or key absent.

### Step 2 — `SKILL-TIERING.md`

Create `workflow/cursor-workflow/SKILL-TIERING.md` with:

1. **Tier definitions**
   - `workflow`: changes limited to `.cursor/skills/`, `workflow/`, `scripts/cursor-workflow-*`, docs — no `api/` or `frontend/` product code.
   - `application`: everything else (default when uncertain).
2. **Classification rules** (authoritative at planning; re-check at execute/demo/create-pr/babysit):
   - PLAN front matter `**Tier:** workflow | application`
   - Fallback: if planned/touched paths include `api/` or `frontend/` → `application`
   - When ambiguous → `application`
3. **`WORKFLOW.md` excerpt map** (link targets — do not ingest full file):

   | Skill / need | Sections |
   |--------------|----------|
   | All skills | `## Stages`, `## Branch and paths`, `## State file` |
   | Planning | + `## Loop limits (babysit stage)`, `## GitHub labels` |
   | Create-pr | + `## Visibility`, `## GitHub MCP adoption` (PR comment markers only) |
   | Demo / babysit | + `## Human communication` (pass-back / blocked only) |

4. **PR seed contract** — required `## PR seed` section in every `PLAN.md` (≤15 lines).
5. **Per-tier behavior summary** — demo light path, babysit early-exit, execute gate defaults.

### Step 3 — Planning skill

Update `.cursor/skills/planning/SKILL.md`:

1. Add **Read first**: `SKILL-TIERING.md`, `workflow.config.yaml` (via resolver); read `WORKFLOW.md` **only** via excerpt map sections.
2. **Classify tier** after reading SPEC; document in PLAN front matter and PR seed.
3. **Bug reproduction**: required only for `application` tier app bugs; **skip** stack bring-up and `bug-repro-*` for `workflow` tier.
4. **Outputs**: require `## PR seed` section in every `PLAN.md` (template in SKILL-TIERING.md).
5. **Demo-spec**: for `workflow` tier, preconditions must **not** include health URLs or Docker; scenarios are script/doc grep based.
6. Replace hard-coded health URLs with config variable references (`$APP_HEALTH_URL_FRONTEND`, etc.) in application-tier sections only.

### Step 4 — Execute skill

Update `.cursor/skills/execute/SKILL.md`:

1. **Read first**: `PLAN.md` (implementation steps, gate script, tier); read `SPEC.md` **only** when PLAN references acceptance criteria; `SKILL-TIERING.md` for tier re-check.
2. **Default gate**:
   - `workflow` tier → `bash $WORKFLOW_REGRESSION_GATE` (resolve via config)
   - `application` tier → `bash $APP_DEFAULT_GATE` unless PLAN specifies narrower gate
3. **Scope**: implement PLAN steps only; do not re-read full SPEC by default.
4. Replace hard-coded `DATABASE_URL` example with `$APP_DATABASE_URL_HOST_TEST` from config.
5. Document: do not run phase gates unless PLAN or touched paths require them.

### Step 5 — Demo skill

Update `.cursor/skills/demo/SKILL.md`:

1. **Classify tier** from PLAN front matter / PR seed.
2. **`workflow` tier light path** (default when tier is workflow):
   - Do **not** start Docker or browse UI unless PLAN explicitly lists product scenarios
   - Run `bash $WORKFLOW_REGRESSION_GATE` (via config)
   - Write minimal `demo-notes.md`: date, SHA, tier=`workflow`, gate exit line, log excerpt
   - Batched `demo-ready` push (existing pattern)
3. **`application` tier**: existing full-stack path; health URLs from config vars.
4. Remove literal `localhost:` strings — use config exports.

### Step 6 — Create-pr skill

Update `.cursor/skills/create-pr/SKILL.md`:

1. **Read first** (narrowed):
   - `PLAN.md` § **PR seed**, § Definition of done
   - `demo/demo-notes.md`
   - `templates/PR.md`
   - `workflow.state.json`
   - Commit log
   - Do **not** require full `SPEC.md` or full `WORKFLOW.md` — link `SKILL-TIERING.md` excerpt map for stage context
2. PR seed is **primary narrative** for Description / Changes / Gate evidence.
3. Resolve `{owner}/{repo}` via `$GITHUB_REPO_SLUG` or config, not hard-coded slug.
4. Scenario Results: for `workflow` tier with no screenshots, state “workflow tier — script verification only” and cite demo-notes gate line.

### Step 7 — Babysit-pr skill

Update `.cursor/skills/babysit-pr/SKILL.md`:

1. Read tier from `PLAN.md` PR seed / front matter.
2. **`workflow` tier loop limits** (from config): `bugbot: 1`, `ci_autofix: 1`.
3. **`workflow` tier early-exit**: when CI green + no unresolved Bugbot must-fix → mark ready immediately (`complete`); do not enter further fix cycles.
4. **`application` tier**: preserve existing limits (3/2) and behavior.
5. Replace hard-coded gate evidence examples with config-relative wording.

### Step 8 — Regression and verification script

Create `scripts/test-cursor-workflow-config.sh`:

- Config file exists and parses
- `get gates.workflow_regression` returns `scripts/verify-workflow-paths.sh`
- `source` exports expected variables with correct values
- Invalid key exits non-zero

Extend `scripts/verify-workflow-paths.sh`:

1. Assert `workflow.config.yaml`, `cursor-workflow-config.sh`, `SKILL-TIERING.md` exist.
2. Run `test-cursor-workflow-config.sh`.
3. Assert `planning` skill mentions PR seed and SKILL-TIERING / excerpt map.
4. Assert five skills reference `cursor-workflow-config.sh` or config variables (not literal `localhost:`, `verify-phase8-gates.sh`, `BlackLodgeLabs/cuebox`).
5. Assert `workflow/issues/issue-126/PLAN.md` contains `## PR seed` (dogfood this issue).

Optional minor `WORKFLOW.md` / `AGENTS.md` cross-links.

## Tests required

| Test | Type | Maps to acceptance criterion |
|------|------|------------------------------|
| `scripts/test-cursor-workflow-config.sh` | Unit (offline) | Config resolver contract |
| `scripts/verify-workflow-paths.sh` (extended) | Regression | Portable regression; registers new artifacts; skill grep guards |
| Manual grep: five skills lack `localhost:`, `verify-phase8`, `BlackLodgeLabs/cuebox` | Static | Config entry point — no hard-coded Cuebox strings |
| Dogfood: issue #126 demo light path | Demo (execute stage) | Demo light path for workflow tier |
| Application tier unchanged | Regression (documented) | Existing behavior for `application` tier — execute must not remove full-stack demo instructions |

No API, frontend, or Postgres tests required (workflow-only scope).

## Gate script

**Primary (workflow tier):** `bash scripts/verify-workflow-paths.sh`

Execute and babysit re-runs the same gate after fixes. Do **not** run `verify-phase8-gates.sh` for this issue.

## Documentation updates

| File | Update |
|------|--------|
| `workflow/cursor-workflow/SKILL-TIERING.md` | New — primary doc |
| `workflow/cursor-workflow/workflow.config.yaml` | New — config contract |
| `workflow/cursor-workflow/WORKFLOW.md` | Short cross-link to tiering + config |
| `AGENTS.md` | Optional one-line link to `SKILL-TIERING.md` |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Application issues accidentally classified `workflow` | Conservative rule: `api/`/`frontend/` → `application`; ambiguous → `application` |
| Config resolver breaks on minimal CI images | Shell test + verify-workflow-paths; prefer stdlib YAML parse |
| Babysit early-exit hides real Bugbot issues | Early-exit only when no **must-fix** items; first fix cycle still allowed within reduced caps |
| Skills still reference old literals via examples | verify-workflow-paths grep guard on five skills |

**Rollback:** Revert branch; no DB migrations or product impact.

## Definition of done

- [ ] `workflow.config.yaml` and `cursor-workflow-config.sh` committed and tested
- [ ] `SKILL-TIERING.md` documents classification, excerpt map, PR seed, tier behaviors
- [ ] Five skills updated: tier branching, config indirection, narrowed reads
- [ ] `verify-workflow-paths.sh` extended; exits 0
- [ ] Grep guard: zero `localhost:`, `verify-phase8-gates.sh`, `BlackLodgeLabs/cuebox` in five skills
- [ ] This issue’s `PLAN.md` includes PR seed (dogfood)
- [ ] Demo-spec is script-based (no Docker preconditions)
- [ ] No changes to handoff YAML, state schema, `api/`, or `frontend/`
- [ ] Application-tier skill paths documented and preserved in SKILL-TIERING.md

## PR seed

**Tier:** workflow

**What / why:** Late-stage workflow skills over-read context and assume full Docker/product gates even for docs-only issues. Add tier classification, a committed config entry point, and enforce a light demo/babysit path for `workflow` tier — precursor to #122 portable boundary.

**Key changes:** `workflow.config.yaml` + `cursor-workflow-config.sh`; `SKILL-TIERING.md`; tier-aware updates to planning/execute/demo/create-pr/babysit skills; extended `verify-workflow-paths.sh`.

**Gate:** Workflow regression: `verify-workflow-paths.sh` exit 0 at `<short-sha>`

**How to test:**

1. `source scripts/cursor-workflow-config.sh && echo $WORKFLOW_REGRESSION_GATE $GITHUB_REPO_SLUG`
2. `bash scripts/test-cursor-workflow-config.sh`
3. `bash scripts/verify-workflow-paths.sh`
4. Grep five skills for hard-coded `localhost:`, `verify-phase8`, `BlackLodgeLabs/cuebox` — expect zero matches
5. Confirm `workflow/issues/issue-126/demo/demo-spec.md` has no Docker/health URL preconditions
