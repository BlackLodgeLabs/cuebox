# AGENTS.md

Guidance for AI agents working in the Cuebox repository.

## Project overview

Locally hosted web app for picking films from a Letterboxd watchlist. Through Phase 8: Postgres schema, import/metadata/semantic enrichment pipeline, film embeddings (pgvector), watchlist sync (CSV + RSS), six-stage recommendation engine with profile caching and history, FastAPI API with gated Developer Mode (`/dev/*`), full Next.js MVP UX styled with the Modern Neo-Noir Cinema design system ([documents/DESIGN.md](documents/DESIGN.md)), integration/NFR validation, and root [README.md](README.md).

Specifications live under `documents/`; see [README.md](README.md) for human setup and quick start.

## Cursor Cloud specific instructions

### Docker daemon

Docker is **not** pre-installed on fresh Cloud VMs. If `docker` is unavailable:

1. Start `dockerd` manually (systemd may not run in the VM): `sudo dockerd > /tmp/dockerd.log 2>&1 &`
2. Ensure socket access: `sudo chmod 666 /var/run/docker.sock` (or add user to `docker` group)
3. Storage driver: `fuse-overlayfs` is required in nested VMs (`/etc/docker/daemon.json`)

### First-time config (not committed)

```bash
cp config.example.yaml config.yaml
cp .env.example .env
```

For **Docker Compose**, set in `.env`:

```
DATABASE_URL=postgresql+psycopg://cuebox:cuebox@postgres:5432/cuebox
```

Cloud agents run `scripts/cloud-bootstrap-env.sh` during `install` (via `.cursor/environment.json`) to create `.env` from `.env.example` and set that `DATABASE_URL` automatically. Dashboard **Secrets** for `TMDB_API_KEY`, `OPENAI_API_KEY`, etc. are mirrored into `.env` when present in the VM environment. `scripts/cloud-ensure-docker.sh` starts `dockerd` if needed and `chmod`s `/var/run/docker.sock` before waiting on `docker info` (the VM user is not in the `docker` group). The stack terminal runs `scripts/cloud-start-stack.sh`, which calls `cloud-ensure-docker.sh` then `docker compose up --build`.

For **local API/tests against the compose Postgres**, use `@localhost:5433` on the host (`5433:5432` in `docker-compose.yml`). Gate scripts use a separate ephemeral Postgres container on `localhost:5432`.

### Cloud environment verification (Part 1 gate)

After boot, confirm without manual fixes:

```bash
docker compose ps
curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool
curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool
curl -sf -o /dev/null -w "frontend HTTP %{http_code}\n" http://localhost:3000
```

Pass criteria: all three containers `Up`; both health URLs return `"status":"ok"` and `"database":"ok"`; frontend HTTP 200. Provider keys may show `"error"` until dashboard secrets are set — that is expected for Part 1.

Optional: add your dashboard snapshot ID as a top-level `"snapshot"` field in `.cursor/environment.json` (not inside `terminals`).

### Running the stack

Preferred path (all three services):

```bash
docker compose up
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API health | http://localhost:8000/api/v1/health |
| OpenAPI docs | http://localhost:8000/docs |
| Postgres | localhost:5433 on host (`5433:5432` in compose; user/pass/db: `cuebox`) |

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
| PRD success criteria audit | `bash scripts/verify-prd-success-criteria.sh` |
| Live stack smoke test | `bash scripts/smoke-test.sh` (requires `docker compose up` and `letterboxd/watchlist.csv`) |
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

1. http://localhost:3000 — **Cuebox** dark UI; empty watchlist shows **Import watchlist** CTA; returning users see **New recommendation** and **History** links.
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
- After pulling frontend dependency changes, run `cd frontend && npm ci` (non-Docker) or rebuild/restart the frontend container (`docker compose up --build frontend`). The frontend dev container runs `npm ci` on start to keep its `node_modules` volume in sync with `package-lock.json`.
- After pulling **API schema/migration** changes, restart the API container so `entrypoint.sh` runs `alembic upgrade head` (`docker compose restart api`). Compose mounts `api/alembic` into the container; if you still see missing-column errors, run `docker compose up --build api`.
- Optional: `RUN_SLOW_PERF=1` with `pytest tests/test_integration_recommendation.py::test_recommendation_large_watchlist_under_30_seconds` for a 100-film recommendation benchmark (mocked providers).
- On **Windows**, shell scripts must use LF line endings (enforced via `.gitattributes`). If you see `exec ./entrypoint.sh: no such file or directory`, re-checkout scripts (`git checkout -- api/entrypoint.sh`) or run `git add --renormalize .` after pulling the `.gitattributes` fix.
