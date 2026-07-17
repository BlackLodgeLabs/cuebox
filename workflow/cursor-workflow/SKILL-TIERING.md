# Skill tiering and config indirection

Late-stage workflow skills (`planning`, `execute`, `demo`, `create-pr`, `babysit-pr`) branch behavior by **issue tier** and resolve paths/URLs/gates from [workflow.config.yaml](workflow.config.yaml) via `scripts/cursor-workflow-config.sh`.

Precursor to [#122](https://github.com/BlackLodgeLabs/cuebox/issues/122) portable boundary — skills must not hard-code Cuebox strings.

## Tier definitions

| Tier | Scope | Examples |
|------|-------|----------|
| `workflow` | Changes limited to `.cursor/skills/`, `workflow/`, `scripts/cursor-workflow-*`, docs — **no** `api/` or `frontend/` product code | Skill trims, handoff docs, workflow regression |
| `application` | Everything else (default when uncertain) | UI features, API changes, enrichment, recommendations |

## Classification rules

**Authoritative at planning** — document in `PLAN.md` front matter (`**Tier:** workflow | application`) and `## PR seed`.

**Re-check** at execute, demo, create-pr, and babysit:

1. Read `PLAN.md` § PR seed / front matter tier
2. If planned or touched paths include `api/` or `frontend/` → `application`
3. When ambiguous → `application` (conservative)

## Config resolution

```bash
source scripts/cursor-workflow-config.sh
# or: bash scripts/cursor-workflow-config.sh get gates.workflow_regression
```

| Export | Config path | Purpose |
|--------|-------------|---------|
| `WORKFLOW_ARTIFACT_ROOT` | `paths.artifact_root` | `workflow/issues` |
| `WORKFLOW_REGRESSION_GATE` | `gates.workflow_regression` | Light-path demo/execute gate |
| `WORKFLOW_BASE_BRANCH` | `repository.base_branch` | Default git base branch |
| `WORKFLOW_BRANCH_PATTERN` | `repository.branch_pattern` | Issue branch naming |
| `WORKFLOW_LABEL_PREFIX` | `repository.label_prefix` | GitHub label prefix (`cursor`) |
| `WORKFLOW_ARCHIVE_BRANCH` | `repository.archive_branch` | Post-merge archive branch |
| `WORKFLOW_BRANCH_PREFIX` | derived | `${label_prefix}/issue-` for grep/API |
| `WORKFLOW_MAX_ACTIVE_AGENTS` | `orchestration.max_active_agents` | Handoff admission cap |
| `WORKFLOW_HANDOFF_PENDING_STALE_MINUTES` | `orchestration.handoff_pending_stale_minutes` | Stale `handoff_pending` lock |
| `WORKFLOW_DEFERRAL_COMMENT_COOLDOWN_MINUTES` | `orchestration.deferral_comment_cooldown_minutes` | Deferral comment throttle |
| `WORKFLOW_LATE_STAGE_RESUME` | `orchestration.late_stage_resume` | Opt-in late-stage `POST /runs` reuse |
| `WORKFLOW_PER_ISSUE_SPAWN_SERIALIZATION` | `orchestration.per_issue_spawn_serialization` | Per-issue same-skill in-flight dedup |
| `APP_DEFAULT_GATE` | `adapter.gates.application_default` | Full regression gate |
| `APP_HEALTH_URL_FRONTEND` | `adapter.environment.health_url_frontend` | Stack health (application tier) |
| `APP_HEALTH_URL_API` | `adapter.environment.health_url_api` | Stack health (application tier) |
| `APP_DATABASE_URL_HOST_TEST` | `adapter.environment.database_url_host_test` | Host pytest when compose up |
| `GITHUB_REPO_SLUG` | `repository.owner` + `repository.name` | PR URLs, raw.githubusercontent.com |
| `WORKFLOW_LOOP_LIMIT_BUGBOT` | `tiering.workflow_loop_limits.bugbot` | Babysit cap (workflow) |
| `WORKFLOW_LOOP_LIMIT_CI_AUTOFIX` | `tiering.workflow_loop_limits.ci_autofix` | Babysit cap (workflow) |
| `APPLICATION_LOOP_LIMIT_BUGBOT` | `tiering.application_loop_limits.bugbot` | Babysit cap (application) |
| `APPLICATION_LOOP_LIMIT_CI_AUTOFIX` | `tiering.application_loop_limits.ci_autofix` | Babysit cap (application) |

Skills reference `$WORKFLOW_REGRESSION_GATE`, `$APP_DEFAULT_GATE`, etc. — **not** literal `localhost:`, `verify-phase8-gates.sh`, or `BlackLodgeLabs/cuebox`.

## WORKFLOW.md excerpt map

Read [WORKFLOW.md](WORKFLOW.md) **only** via these sections — do not ingest the full file in late-stage skills.

| Skill / need | Sections |
|--------------|----------|
| All skills | `## Stages`, `## Branch and paths`, `## State file` |
| Planning | + `## Loop limits (babysit stage)`, `## GitHub labels` |
| Create-pr | + `## Visibility`, `## GitHub MCP adoption` (PR comment markers only) |
| Demo / babysit | + `## Human communication` (pass-back / blocked only) |

Link to this map from skills instead of requiring full `WORKFLOW.md` reads.

## PR seed contract

Every `PLAN.md` must include a `## PR seed` section (≤15 lines). Create-pr treats this as the **primary narrative** for Description / Changes / Gate evidence.

```markdown
## PR seed

**Tier:** workflow | application
**What / why:** …
**Key changes:** …
**Gate:** Workflow regression: verify-workflow-paths.sh exit 0 at <short-sha>
**How to test:** …
```

## Per-tier behavior

### Planning

| Tier | Bug reproduction | Demo-spec preconditions | Gate in PLAN |
|------|------------------|-------------------------|--------------|
| `workflow` | **Skip** stack bring-up and `bug-repro-*` | Script/doc grep only — no health URLs or Docker | `$WORKFLOW_REGRESSION_GATE` |
| `application` | Required for app bugs | Stack health via `$APP_HEALTH_URL_*` | `$APP_DEFAULT_GATE` or narrower per `run-gate-scripts` |

### Execute

| Tier | Default gate | SPEC read |
|------|--------------|-----------|
| `workflow` | `bash $WORKFLOW_REGRESSION_GATE` | Only when PLAN references acceptance criteria |
| `application` | `bash $APP_DEFAULT_GATE` unless PLAN specifies narrower gate | As needed per PLAN |

Do not run phase gates for `workflow` tier unless PLAN or touched paths require them.

### Demo

| Tier | Environment | Artifacts |
|------|-------------|-----------|
| `workflow` | **No** Docker/UI unless PLAN lists product scenarios | Run `bash $WORKFLOW_REGRESSION_GATE`; minimal `demo-notes.md` (date, SHA, tier, gate exit line) |
| `application` | Full stack; health via config vars | Screenshots/recordings per `demo-spec.md` |

### Create-pr

| Tier | Read first | Scenario Results |
|------|------------|------------------|
| All | `PLAN.md` § PR seed, § Definition of done; `demo-notes.md`; template; state; commit log | — |
| `workflow` | No full SPEC or WORKFLOW.md — link excerpt map above | "workflow tier — script verification only" when no screenshots; cite demo-notes gate line |
| `application` | Targeted SPEC excerpts as needed | Embed demo images (absolute raw URLs via `$GITHUB_REPO_SLUG`) |

### Babysit

| Tier | Loop limits | Early exit |
|------|-------------|------------|
| `workflow` | `bugbot: 1`, `ci_autofix: 1` (from config) | When CI green + no unresolved Bugbot must-fix → `complete` immediately |
| `application` | `bugbot: 3`, `ci_autofix: 2` | Standard fix cycles until clean or limit |

## Regression

`scripts/verify-workflow-paths.sh` registers config, resolver, this doc, PR-seed requirement, and grep guards on the five skills.
