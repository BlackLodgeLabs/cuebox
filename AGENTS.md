# AGENTS.md

Guidance for AI agents working in the Cuebox repository.

## Project overview

Locally hosted web app for picking films from a Letterboxd watchlist. Through Phase 7: Postgres schema, import/metadata/semantic enrichment pipeline, film embeddings (pgvector), watchlist sync (CSV + RSS), six-stage recommendation engine with profile caching and history, FastAPI API with gated Developer Mode (`/dev/*`), and full Next.js MVP UX styled with the Modern Neo-Noir Cinema design system ([documents/DESIGN.md](documents/DESIGN.md)).

Specs live under `documents/` (no root README yet).

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

For **local API/tests against the compose Postgres**, use `@localhost:5432` instead of `@postgres:5432`.

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
| Postgres | localhost:5432 (user/pass/db: `cuebox`) |

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
| Phase 2.5 gate script | `bash scripts/verify-phase2.5-gates.sh` (Postgres required; regression after Phase 3+ changes) |
| CI parity | PRs must pass GitHub Actions workflows `.github/workflows/api-ci.yml` and `.github/workflows/frontend-ci.yml` |
| Frontend types | `cd frontend && npx tsc --noEmit` |
| Frontend build | `cd frontend && npm run build` |
| Frontend unit tests | `cd frontend && npm run test:unit` (PR review regression coverage for hooks/components) |
| Frontend E2E | `cd frontend && PLAYWRIGHT_E2E_STACK=1 npm run test:e2e` (requires full stack running) |

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
- Frontend `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000/api/v1` (set in `docker-compose.yml` for the frontend service).
- No authentication — single-user, local-first design.
- After pulling frontend dependency changes, run `cd frontend && npm ci` (non-Docker) or rebuild/restart the frontend container (`docker compose up --build frontend`). The frontend dev container runs `npm ci` on start to keep its `node_modules` volume in sync with `package-lock.json`.
- On **Windows**, shell scripts must use LF line endings (enforced via `.gitattributes`). If you see `exec ./entrypoint.sh: no such file or directory`, re-checkout scripts (`git checkout -- api/entrypoint.sh`) or run `git add --renormalize .` after pulling the `.gitattributes` fix.
