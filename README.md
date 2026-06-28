# Cuebox

Cuebox is a locally hosted web app that helps you pick what to watch from your Letterboxd watchlist. Import your watchlist, answer a short questionnaire, and get a ranked recommendation with explanations — all running on your machine via Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- API keys (see `.env.example`):
  - `TMDB_API_KEY` — metadata matching during import
  - `OPENAI_API_KEY` — required when OpenAI providers are selected in `config.yaml` (default)

Optional: `OMDB_API_KEY`, `VOYAGE_API_KEY`, `OLLAMA_BASE_URL` depending on your provider configuration.

## Quick start

1. Copy configuration templates:

```bash
cp config.example.yaml config.yaml
cp .env.example .env
```

2. Edit `.env` with your API keys. For Docker Compose, use:

```
DATABASE_URL=postgresql+psycopg://cuebox:cuebox@postgres:5432/cuebox
```

3. Start the stack:

```bash
docker compose up
```

4. Open the app:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API health | http://localhost:8000/api/v1/health |
| OpenAPI docs | http://localhost:8000/docs |

5. Import your Letterboxd watchlist CSV, complete any metadata match review, run the questionnaire, and view results and history.

After pulling updates that include database migrations, restart the API so migrations apply:

```bash
docker compose restart api
```

If you still see missing-column errors, rebuild the API image: `docker compose up --build api`.

With the stack running, a **backup sidecar** dumps the database daily (default 03:00 UTC) to `./backups/` and keeps the two most recent files. See [documents/database-backup-restore.md](documents/database-backup-restore.md) for manual backups and restore.

## Documentation

| Document | Purpose |
|----------|---------|
| [documents/roadmap.md](documents/roadmap.md) | Implementation phases and verification gates |
| [documents/PRD.md](documents/PRD.md) | Product requirements and success criteria |
| [documents/DESIGN.md](documents/DESIGN.md) | Modern Neo-Noir Cinema design system |
| [documents/api-contracts.md](documents/api-contracts.md) | REST API v1 reference |
| [documents/Architecture.md](documents/Architecture.md) | Technical architecture |
| [documents/cloud-agent-part2-test-data.md](documents/cloud-agent-part2-test-data.md) | Cursor Cloud agent test data (Tier 2 seeding) |
| [documents/database-backup-restore.md](documents/database-backup-restore.md) | Daily Postgres backups and restore procedure |
| [AGENTS.md](AGENTS.md) | Agent and CI development guide |

## Testing

Run the Phase 8 verification gates (unit regression, integration suite, NFR timing assertions, PRD audit, and Phase 7 regression):

```bash
bash scripts/verify-phase8-gates.sh
```

Requires Docker for the Postgres test container. Optional flags:

- `PLAYWRIGHT_E2E_STACK=1` — full-stack Playwright E2E (requires `docker compose up`)
- `RUN_SMOKE_TEST=1` — live API smoke test against a running stack
- `RUN_SLOW_PERF=1` — 100-film recommendation benchmark (`pytest` only)

### Live stack smoke test

With `docker compose up`, `config.yaml`, `.env`, and a Letterboxd export at `letterboxd/watchlist.csv`:

```bash
bash scripts/smoke-test.sh
```

Override the CSV path with `CSV_PATH=/path/to/watchlist.csv` if needed.

## Fixtures

Place a Letterboxd watchlist export at `letterboxd/watchlist.csv` for manual smoke testing. This path is gitignored.

## Developer Mode

Set `developer_mode: true` in `config.yaml` and restart the API to enable `/dev/*` endpoints and the hidden frontend trace panel (`?dev=1` or `Ctrl+Shift+D` on results/history pages).
