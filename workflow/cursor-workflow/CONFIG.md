# Workflow configuration index

Single source of truth: [workflow.config.yaml](workflow.config.yaml). Resolve via `scripts/cursor-workflow-config.sh`.

## Portable keys (Callsheet core)

| Config path | Export | Default |
|-------------|--------|---------|
| `paths.artifact_root` | `WORKFLOW_ARTIFACT_ROOT` | `workflow/issues` |
| `paths.workflow_docs` | `WORKFLOW_DOCS` | `workflow/cursor-workflow` |
| `paths.skills_root` | `WORKFLOW_SKILLS_ROOT` | `.cursor/skills` |
| `repository.owner` | `GITHUB_REPO_OWNER` | (adapter) |
| `repository.name` | `GITHUB_REPO_NAME` | (adapter) |
| `repository.base_branch` | `WORKFLOW_BASE_BRANCH` | `main` |
| `repository.branch_pattern` | `WORKFLOW_BRANCH_PATTERN` | `cursor/issue-{issue}-{slug}` |
| `repository.label_prefix` | `WORKFLOW_LABEL_PREFIX` | `cursor` |
| `repository.archive_branch` | `WORKFLOW_ARCHIVE_BRANCH` | `workflow/archive` |
| — | `WORKFLOW_BRANCH_PREFIX` | `${label_prefix}/issue-` |
| `orchestration.max_active_agents` | `WORKFLOW_MAX_ACTIVE_AGENTS` | `8` (env: `CURSOR_WORKFLOW_MAX_ACTIVE_AGENTS`) |
| `orchestration.handoff_pending_stale_minutes` | `WORKFLOW_HANDOFF_PENDING_STALE_MINUTES` | `15` (env: `CURSOR_WORKFLOW_PENDING_STALE_MINUTES`) |
| `orchestration.deferral_comment_cooldown_minutes` | `WORKFLOW_DEFERRAL_COMMENT_COOLDOWN_MINUTES` | `30` (env: `CURSOR_WORKFLOW_DEFERRAL_COMMENT_MINUTES`) |
| `gates.workflow_regression` | `WORKFLOW_REGRESSION_GATE` | `scripts/verify-workflow-paths.sh` |
| `tiering.workflow_loop_limits.*` | `WORKFLOW_LOOP_LIMIT_*` | bugbot/ci caps |
| `tiering.application_loop_limits.*` | `APPLICATION_LOOP_LIMIT_*` | bugbot/ci caps |

## Adapter keys (Cuebox-owned)

| Config path | Export | Purpose |
|-------------|--------|---------|
| `adapter.gates.application_default` | `APP_DEFAULT_GATE` | Phase 8 full regression |
| `adapter.environment.health_url_frontend` | `APP_HEALTH_URL_FRONTEND` | Stack health |
| `adapter.environment.health_url_api` | `APP_HEALTH_URL_API` | Stack health |
| `adapter.environment.database_url_host_test` | `APP_DATABASE_URL_HOST_TEST` | Host pytest |

`get gates.application_default` and `get environment.*` resolve adapter paths with top-level fallbacks for backward compatibility.

See [ADAPTER.md](ADAPTER.md) for the full Cuebox checklist.
