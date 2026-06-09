# AGENTS.md

Guidance for AI agents working in the Cuebox (Film Picker) repository.

## Project overview

Locally hosted web app for picking films from a Letterboxd watchlist. Through Phase 5: Postgres schema, import/metadata/semantic enrichment pipeline, film embeddings (pgvector), watchlist sync (CSV + RSS), six-stage recommendation engine with profile caching and history, FastAPI API, minimal Next.js health dashboard.

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
| Phase 2.5 gate script | `bash scripts/verify-phase2.5-gates.sh` (Postgres required; regression after Phase 3+ changes) |
| CI parity | PRs must pass GitHub Actions workflow `.github/workflows/api-ci.yml` |
| Frontend types | `cd frontend && npx tsc --noEmit` |

`npm run lint` in `frontend/` currently prompts for ESLint setup (no config committed yet); use `tsc --noEmit` until ESLint is initialized.

### Hello-world verification

Load http://localhost:3000 — the homepage should show **API: ok**, **Database: ok**, and **Version 1.0.0**. Provider keys (TMDB, OpenAI, etc.) show `error` until set in `.env`; that is expected in Phase 1.

### Gotchas

- `.env` and `config.yaml` are gitignored; agents must create them from examples. Copy `config.example.yaml` after Phase 3 changes to pick up `enrichment.inter_film_delay_seconds`.
- `OPENAI_API_KEY` is required for live semantic/embedding/ranking runs when `config.yaml` selects OpenAI providers. CI and gate scripts pass without it (mocked HTTP). Optional: `OLLAMA_BASE_URL` (Ollama semantic), `VOYAGE_API_KEY` (Voyage embeddings).
- Frontend `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000/api/v1` (set in `docker-compose.yml` for the frontend service).
- No authentication — single-user, local-first design.
