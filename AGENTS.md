# AGENTS.md

Guidance for AI agents working in the Cuebox repository.

## Project overview

Locally hosted web app for picking films from a Letterboxd watchlist. Through Phase 8: Postgres schema, import/metadata/semantic enrichment pipeline, film embeddings (pgvector), watchlist sync (CSV + RSS), six-stage recommendation engine with profile caching and history, FastAPI API with gated Developer Mode (`/dev/*`), full Next.js MVP UX styled with the Modern Neo-Noir Cinema design system ([documents/DESIGN.md](documents/DESIGN.md)), integration/NFR validation, and root [README.md](README.md).

Specifications live under `documents/`; see [README.md](README.md) for human setup and quick start. Product direction (themes, not schedules) lives in [documents/ROADMAP.md](documents/ROADMAP.md) — consult it when scoping features that may overlap upcoming work.

## Cursor Cloud specific instructions

### Docker daemon

Cloud `install` runs [`scripts/cloud-install.sh`](scripts/cloud-install.sh), which calls [`scripts/cloud-ensure-docker.sh`](scripts/cloud-ensure-docker.sh) to **apt-install** `docker.io`, `docker-compose-v2`, and `fuse-overlayfs` when missing, write `/etc/docker/daemon.json` (`storage-driver: fuse-overlayfs` for nested VMs), prefer `iptables-legacy`, disable `bridge-nf-call-iptables` (required for container-to-container traffic on nested Cloud VMs), start `dockerd` (systemd is often unavailable), and `chmod 666` the Docker socket (the VM user is not in the `docker` group).

Manual fallback if `docker` is still unavailable:

1. `bash scripts/cloud-ensure-docker.sh`
2. Or: `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`

### When to rebuild + re-pin the Cloud snapshot

The `"snapshot"` field in [`.cursor/environment.json`](.cursor/environment.json) pins the prebuilt Cloud image agents boot from (install bake: Docker, deps, Playwright, warmed Compose images). **Normal app/feature work does not need a rebuild** — agents get code from git.

After you change Cloud bootstrap and a **promotable** environment build from `main` succeeds, update `"snapshot"` to that build’s id (e.g. `bld-YYYYMMDD-…`) and merge. Dashboard UI may not expose build logs; ask an agent to fetch them via Cloud diagnostics if needed.

**Rebuild from `main`, verify Part 1 (and Part 2 if data/bootstrap changed), then re-pin `"snapshot"` when your work did any of:**

| Trigger | Examples |
|---------|----------|
| Cloud install / start scripts | [`scripts/cloud-install.sh`](scripts/cloud-install.sh), [`scripts/cloud-ensure-docker.sh`](scripts/cloud-ensure-docker.sh), [`scripts/cloud-start-stack.sh`](scripts/cloud-start-stack.sh), [`scripts/cloud-bootstrap-env.sh`](scripts/cloud-bootstrap-env.sh), [`scripts/agent-bootstrap.sh`](scripts/agent-bootstrap.sh) |
| `.cursor/environment.json` bootstrap | `install`, `start`, or `terminals` commands (not app source alone) |
| Heavy baked dependencies | Major Node/Python lockfile shifts that agents must re-install slowly; Playwright browser/dep changes; Compose base images that should be pre-warmed |
| Fresh agents fail Part 1/2 | Docker missing, nested networking broken, stack won’t healthy, seed/bootstrap broken |
| Baked test-data tier change | Switch Tier 2 ↔ Tier 3 (or empty DB) and want that baked into the boot image — see [documents/cloud-agent-part2-test-data.md](documents/cloud-agent-part2-test-data.md) |
| Base VM / Cursor image drift | OS or nested-Docker behavior changes so the current pin no longer boots healthy |

**Do not rebuild/re-pin for:** ordinary API/frontend/feature PRs, docs-only changes, or workflow skill edits that do not touch the Cloud install path above.

### First-time config (not committed)

```bash
cp config.example.yaml config.yaml
cp .env.example .env
```

For **Docker Compose**, set in `.env`:

```
DATABASE_URL=postgresql+psycopg://cuebox:cuebox@postgres:5432/cuebox
```

Cloud agents run `scripts/cloud-install.sh` during `install` (via `.cursor/environment.json`): bootstrap `.env`/`config.yaml`, install/start Docker, `pip install -e ".[dev]"`, `npm ci`, Playwright Chromium, and warm Compose images. Dashboard **Secrets** for `TMDB_API_KEY`, `OPENAI_API_KEY`, etc. are mirrored into `.env` when present in the VM environment. `start` re-runs `cloud-ensure-docker.sh`. The stack terminal runs `scripts/cloud-start-stack.sh`, which ensures Docker, starts Compose in detached mode, runs `scripts/agent-bootstrap.sh` to seed the database when empty, then follows container logs in the foreground.

For **local API/tests against the compose Postgres**, use `@localhost:5433` on the host (`5433:5432` in `docker-compose.yml`). Gate scripts use a separate ephemeral Postgres container on `localhost:5432`.

### Cloud environment verification (Part 1 gate)

After boot, confirm without manual fixes:

```bash
docker compose ps
curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool
curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool
curl -sf -o /dev/null -w "frontend HTTP %{http_code}\n" http://localhost:3000
```

Pass criteria: all four containers (`postgres`, `api`, `frontend`, `backup`) `Up`; both health URLs return `"status":"ok"` and `"database":"ok"`; frontend HTTP 200. Provider keys may show `"error"` until dashboard secrets are set — that is expected for Part 1. If Compose is not up yet (stack terminal still starting), `docker compose up -d` then re-check.

The boot image pin lives in [`.cursor/environment.json`](.cursor/environment.json) `"snapshot"` — see [When to rebuild + re-pin the Cloud snapshot](#when-to-rebuild--re-pin-the-cloud-snapshot).

**Part 2 (persistent test data):** see [documents/cloud-agent-part2-test-data.md](documents/cloud-agent-part2-test-data.md).

**Tier 3 (2-film CSV import snapshot):** see [documents/cloud-agent-tier3-fixture-import-plan.md](documents/cloud-agent-tier3-fixture-import-plan.md).
### Cloud environment verification (Part 2 gate)

After Part 1 passes, confirm seeded watchlist data is present (no API keys required):

```bash
docker compose ps

curl -sf "http://localhost:3000/api/v1/films?limit=5" | python3 -m json.tool

curl -sf http://localhost:3000/api/v1/films?limit=1 | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['pagination']['total'] >= 10
assert d['data'][0]['enrichment_status'] == 'ready'
print('PASS: ready films present')
"
```

Pass criteria: at least 10 films with `enrichment_status` of `ready`; the home page at http://localhost:3000 shows **New recommendation** (not the empty-watchlist import CTA). To re-seed manually on an empty volume: `python3 scripts/seed-dev-db.py`. To reset and re-seed: `docker compose down -v` then restart the stack.

### Running the stack

Preferred path (all services):

```bash
docker compose up
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API health | http://localhost:8000/api/v1/health |
| OpenAPI docs | http://localhost:8000/docs |
| Postgres | localhost:5433 on host (`5433:5432` in compose; user/pass/db: `cuebox`) |
| Backups | `./data/backups/` on host (daily `pg_dump`, two-file retention) |

The **backup** sidecar runs [supercronic](https://github.com/aptible/supercronic) with default schedule `0 3 * * *` UTC. Manual dump: `bash scripts/backup-db.sh`. Restore: [documents/database-backup-restore.md](documents/database-backup-restore.md).

The API container runs `alembic upgrade head` then `uvicorn` via `api/entrypoint.sh`. The API process also starts an APScheduler RSS poll job (every 900s) when the app boots; it no-ops until `PUT /sync/rss` configures a username.

### Local (non-Docker) development

- **API**: `cd api && pip install -e ".[dev]"` then `alembic upgrade head && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` (requires Postgres with pgvector on `DATABASE_URL`)
- **Frontend**: `cd frontend && npm ci && npm run dev`
- Add `~/.local/bin` to `PATH` after `pip install` so `pytest`, `ruff`, `alembic`, and `uvicorn` are found.

### Lint and test

| Check | Command |
|-------|---------|
| API lint | `cd api && ruff check app tests` |
| API full test suite | `cd api && DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox TEST_DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox pytest tests/ -v` |
| API unit tests (no DB) | `cd api && pytest tests/test_health.py tests/test_tmdb_normalization.py tests/test_http_retry.py tests/test_semantic_*.py tests/test_embedding_*.py tests/test_csv_sync_diff.py tests/test_rss_parser.py tests/test_profile_canonicalization.py tests/test_questionnaire_validation.py tests/test_scoring_service.py` |
| Phase 3 gate script | `bash scripts/verify-phase3-gates.sh` (Postgres required; mocked OpenAI/Ollama/Voyage) |
| Phase 4 gate script | `bash scripts/verify-phase4-gates.sh` (Postgres required; CSV/RSS sync) |
| Phase 5 gate script | `bash scripts/verify-phase5-gates.sh` (Postgres required; recommendation pipeline) |
| Phase 6 gate script | `bash scripts/verify-phase6-gates.sh` (frontend tsc/build + backend regression; optional Playwright E2E with `PLAYWRIGHT_E2E_STACK=1` and `docker compose up`) |
| Phase 6.5 gate script | `bash scripts/verify-phase6.5-gates.sh` (design token audit + Phase 6 regression) |
| Phase 7 gate script | `bash scripts/verify-phase7-gates.sh` (Developer Mode API tests + Phase 6.5 regression) |
| Phase 8 gate script | `bash scripts/verify-phase8-gates.sh` (integration suite, NFR timing, PRD audit, Phase 7 regression) |
| Watch providers gate script | `bash scripts/verify-watch-providers-gates.sh` (watch-provider tests + Phase 8 regression) |
| PRD success criteria audit | `bash scripts/verify-prd-success-criteria.sh` |
| Live stack smoke test | `bash scripts/smoke-test.sh` (requires `docker compose up` and `letterboxd/watchlist.csv`) |
| Backup retention test | `bash scripts/test-backup-retention.sh` (no Docker or Postgres required) |
| Workflow path regression | `bash scripts/verify-workflow-paths.sh` (no Docker or Postgres required) |
| Phase 2.5 gate script | `bash scripts/verify-phase2.5-gates.sh` (Postgres required; regression after Phase 3+ changes) |
| CI parity | PRs must pass GitHub Actions workflows `.github/workflows/api-ci.yml` and `.github/workflows/frontend-ci.yml` |
| Frontend types | `cd frontend && npx tsc --noEmit` |
| Frontend build | `cd frontend && npm run build` |
| Frontend unit tests | `cd frontend && npm run test:unit` (PR review regression coverage for hooks/components) |
| Frontend E2E | `cd frontend && PLAYWRIGHT_E2E_STACK=1 npm run test:e2e` (requires full stack running) |
| Developer Mode E2E (mocked) | `cd frontend && npx playwright test e2e/dev-mode.spec.ts --grep "mocked API"` (starts `next dev` automatically) |
| Developer Mode E2E (full stack) | `cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test e2e/dev-mode.spec.ts --grep "full stack"` (requires `developer_mode: true` in `config.yaml`) |

`npm run lint` in `frontend/` currently prompts for ESLint setup (no config committed yet); use `tsc --noEmit` until ESLint is initialized.

### Hello-world verification

With `docker compose up`:

1. http://localhost:3000 — **Cuebox** dark UI; empty watchlist shows **Import watchlist** CTA; returning users (or cloud agents after Part 2 bootstrap) see **New recommendation** and **History** links.
2. Complete the first-time journey: import CSV → poll status → review matches (if any) → questionnaire → results → history.
3. Sync settings at http://localhost:3000/settings/sync show RSS status.
4. Collapsed **System status** on the home page still exposes API/database health for debugging.
5. Optional: set `developer_mode: true` in `config.yaml`, restart the API, then open a results or history detail page with `?dev=1` (or press `Ctrl+Shift+D` / `Cmd+Shift+D`) to view the Developer Mode trace panel.

Provider keys (TMDB, OpenAI, etc.) show `error` on the health endpoint until set in `.env`; live recommendations require `OPENAI_API_KEY` when OpenAI providers are selected in `config.yaml`.

### Gotchas

- `.env` and `config.yaml` are gitignored; agents must create them from examples. Copy `config.example.yaml` after Phase 3 changes to pick up `enrichment.inter_film_delay_seconds`. Set `developer_mode: true` in `config.yaml` to enable `/dev/*` endpoints and the hidden frontend dev panel; default is `false`.
- `OPENAI_API_KEY` is required for live semantic/embedding/ranking runs when `config.yaml` selects OpenAI providers. CI and gate scripts pass without it (mocked HTTP). Optional: `OLLAMA_BASE_URL` (Ollama semantic), `VOYAGE_API_KEY` (Voyage embeddings).
- Frontend API calls use same-origin `/api/v1` (Next.js rewrites proxy to the API). Docker Compose sets `API_UPSTREAM_URL=http://api:8000` on the frontend service.
- No authentication — single-user, local-first design.
- The frontend container's run mode is controlled by `FRONTEND_MODE` in `.env`: `development` (default) runs `next dev`; `production` runs `next build && next start`. Cloud agent bootstrap defaults to `development` (unset), which is correct for iterating on code. `FRONTEND_PORT`/`API_PORT`/`POSTGRES_PORT` override the host ports Compose publishes, for running more than one stack (e.g. a dev + prod copy) on one host — see [README.md](README.md#running-multiple-copies-dev--prod-on-one-host).
- After pulling frontend dependency changes, run `cd frontend && npm ci` (non-Docker) or rebuild/restart the frontend container (`docker compose up --build frontend`). The frontend dev container runs `npm ci` on start to keep its `node_modules` volume in sync with `package-lock.json`.
- After pulling **API schema/migration** changes, restart the API container so `entrypoint.sh` runs `alembic upgrade head` (`docker compose restart api`). Compose mounts `api/alembic` into the container; if you still see missing-column errors, run `docker compose up --build api`.
- Optional: `RUN_SLOW_PERF=1` with `pytest tests/test_integration_recommendation.py::test_recommendation_large_watchlist_under_30_seconds` for a 100-film recommendation benchmark (mocked providers).
- On **Windows**, shell scripts must use LF line endings (enforced via `.gitattributes`). If you see `exec ./entrypoint.sh: no such file or directory`, re-checkout scripts (`git checkout -- api/entrypoint.sh`) or run `git add --renormalize .` after pulling the `.gitattributes` fix.
- **Running host pytest / `verify-*-gates.sh` while `docker compose up` is live:** the Compose `.env` sets `DATABASE_URL=...@postgres:5432` (a Compose-internal hostname), and importing `app.main` calls `load_dotenv()`, so a host `pytest` inherits the unresolvable `postgres` host. Export `DATABASE_URL`/`TEST_DATABASE_URL` to a reachable URL first, e.g. `export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox; export TEST_DATABASE_URL=$DATABASE_URL`. The gate's Gate 2 ("no DB" unit tests) runs *before* the gate starts its own Postgres, so it also needs a Postgres already listening on `localhost:5432`; the gate reuses any container already publishing 5432 (use a separate ephemeral `pgvector/pgvector:pg16` on 5432 — not the seeded Compose DB on 5433, which the autouse fixture would truncate).
- **Host frontend production build vs the running dev container:** the Compose `frontend` dev container writes root-owned files into the bind-mounted host `frontend/.next`, so a host `npm run build` (and Phase 8 Gate 7 / Phase 7 regression) fails with `EACCES`. Before building on the host, `docker compose stop frontend` and `sudo rm -rf frontend/.next`, then `docker compose up -d frontend` afterward. Playwright E2E gates need the chromium browser binary (`npx playwright install chromium` plus its apt system deps) which the snapshot is expected to carry.
- The mocked Playwright test `e2e/dev-mode.spec.ts` "history detail shows dev panel" currently fails on a pre-existing strict-mode selector clash (heading `The Wicker Man` matches both the `h1` title and the `h3` card `The Wicker Man (1973)`); this is unrelated to environment setup.

## Cursor issue workflow (multi-agent)

GitHub issue → spec → plan → execute → demo → create-pr → babysit → human review. **Setup:** [workflow/cursor-workflow/SETUP.md](workflow/cursor-workflow/SETUP.md). **Stages:** [workflow/cursor-workflow/WORKFLOW.md](workflow/cursor-workflow/WORKFLOW.md). **Skill tiering:** [workflow/cursor-workflow/SKILL-TIERING.md](workflow/cursor-workflow/SKILL-TIERING.md). **Human communication** (complete, stalled, genuine questions, pass-back): [workflow/cursor-workflow/WORKFLOW.md#human-communication](workflow/cursor-workflow/WORKFLOW.md#human-communication). **GitHub MCP:** [workflow/cursor-workflow/MCP-GITHUB.md](workflow/cursor-workflow/MCP-GITHUB.md) — tool mapping, idempotency markers, fallback when MCP unavailable. **State merge / pass-back / handoff hardening (`handoff_pending`, 8 in-flight run cap, babysit recovery):** [workflow/cursor-workflow/WORKFLOW.md#state-merge](workflow/cursor-workflow/WORKFLOW.md#state-merge). **Handoff performance (skip discovery, list cache, batched writes):** [workflow/cursor-workflow/WORKFLOW.md#performance-optimizations-issue-77](workflow/cursor-workflow/WORKFLOW.md#performance-optimizations-issue-77). **Cap diagnostic (Windows):** `.\scripts\cursor-workflow-list-agents.ps1` — counts `RUNNING`/`CREATING` runs, not `ACTIVE` workspaces after `FINISHED`.

| You do | Skill |
|--------|-------|
| `@cursoragent spec` on issue | `review-and-spec` |
| `@cursoragent continue spec` | `review-and-spec` |
| Handoff (automated) | `planning` → `execute` → `demo` → `create-pr` → `babysit-pr` |
| `@cursoragent workflow-review` on issue (optional) | `workflow-review` ([#79](https://github.com/BlackLodgeLabs/cuebox/issues/79)) |

- Skills: `.cursor/skills/{review-and-spec,planning,execute,demo,create-pr,babysit-pr,run-gate-scripts,workflow-review}/SKILL.md`
- Retrospectives index: [workflow/cursor-workflow/RETROSPECTIVES.md](workflow/cursor-workflow/RETROSPECTIVES.md)
- Specs: `workflow/issues/issue-NNN/SPEC.md`
- Plans: `workflow/issues/issue-NNN/PLAN.md`
- Demo spec + artifacts: `workflow/issues/issue-NNN/demo/`
- State / handoffs: `workflow/issues/issue-NNN/workflow.state.json` + `.github/workflows/cursor-workflow-handoff.yml`
- Pre-PR gates: `run-gate-scripts` skill
