# Cuebox adapter contract

The portable **Callsheet core** (orchestration scripts, templates, state schema, portable regression) is application-agnostic. **Cuebox** supplies an **adapter** layer: application gates, CI workflow names, health URLs, cloud bootstrap, and database test URLs.

Resolve portable values via `scripts/cursor-workflow-config.sh`. Adapter-owned keys live under `adapter` in [workflow.config.yaml](workflow.config.yaml).

## Cuebox-owned inputs

| Area | Config path / artifact | Notes |
|------|------------------------|-------|
| Application gate | `adapter.gates.application_default` → `scripts/verify-phase8-gates.sh` | Full regression for application-tier issues |
| CI workflows | `adapter.gates.application_ci_workflows` → `api-ci`, `frontend-ci` | GitHub Actions workflow names |
| Health URLs | `adapter.environment.health_url_frontend`, `health_url_api` | Demo / stack verification |
| Host test DB | `adapter.environment.database_url_host_test` | Host pytest when Docker Compose is up |
| Cloud bootstrap | `scripts/cloud-bootstrap-env.sh`, `scripts/cloud-ensure-docker.sh`, `scripts/cloud-start-stack.sh` | Cursor Cloud VM setup |
| Cloud agent docs | `documents/cloud-agent-part2-test-data.md`, `documents/cloud-agent-tier3-fixture-import-plan.md` | Part 1/2/3 verification |
| Docker Compose | `docker-compose.yml`, `config.yaml`, `.env` | Demo stack (application tier) |
| Product code | `api/`, `frontend/` | Out of portable core scope |

## GitHub Actions branch filter

Workflow YAML `on.push.branches` cannot be runtime-dynamic. Default filter: `cursor/issue-*` (matches `repository.branch_pattern`). When changing `branch_pattern` in config, **manually update**:

- `.github/workflows/cursor-workflow-handoff.yml`
- Any other workflow that triggers on issue branches

Bootstrap step (handoff, post-merge, housekeeping):

```yaml
- name: Load workflow config
  run: |
    source scripts/cursor-workflow-config.sh
    echo "WORKFLOW_BASE_BRANCH=$WORKFLOW_BASE_BRANCH" >> "$GITHUB_ENV"
    echo "WORKFLOW_ARCHIVE_BRANCH=$WORKFLOW_ARCHIVE_BRANCH" >> "$GITHUB_ENV"
    echo "WORKFLOW_LABEL_PREFIX=$WORKFLOW_LABEL_PREFIX" >> "$GITHUB_ENV"
```

## Installer generate vs preserve

When extracting **Callsheet** into a reusable installer:

| Generate from templates | Preserve on update |
|-------------------------|-------------------|
| Portable scripts (`cursor-workflow-*.sh` except adapter hooks) | `workflow.config.yaml` **adapter** section |
| `workflow/cursor-workflow/templates/*` | `config.yaml`, `.env`, `docker-compose.yml` |
| `STATE-SCHEMA.md`, portable docs | Application gate scripts (`verify-phase*-gates.sh`) |
| `verify-workflow-portable.sh` | Cloud bootstrap scripts and docs |
| Default `repository.*` and `orchestration.*` keys | CI workflow files (`.github/workflows/api-ci.yml`, etc.) |

## Regression split

| Script | Scope |
|--------|-------|
| `scripts/verify-workflow-portable.sh` | Portable core — no Docker or Cuebox product tree |
| `scripts/verify-workflow-cuebox-adapter.sh` | This checklist + Cuebox-specific doc/index assertions |
| `scripts/verify-workflow-paths.sh` | Workflow-tier entry (runs both) |

See also [CONFIG.md](CONFIG.md) and [SKILL-TIERING.md](SKILL-TIERING.md).
