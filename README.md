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

With the stack running, a **backup sidecar** dumps the database daily (default 03:00 UTC) to `./data/backups/` and keeps the two most recent files. See [documents/database-backup-restore.md](documents/database-backup-restore.md) for manual backups and restore.

## Deploying updates

Use this when Cuebox is already running on a server (for example a machine on your LAN) and you want to deploy a newer `main` branch.

From the repo root on the server:

```bash
bash scripts/deploy-update.sh
```

The script will:

1. Back up Postgres to `./data/backups/`
2. `git pull --ff-only origin main`
3. Warn if `.env` or `config.yaml` drift from the examples (merge new settings manually)
4. Rebuild images and restart the stack (`docker compose up --build -d`)
5. Verify API, frontend, and database health

**Preserved across deploys:** `.env`, `config.yaml`, the `postgres_data` Docker volume, and `./data/backups/`. **Do not** run `docker compose down -v` unless you intend to wipe the database.

### Common options

| Flag | Purpose |
|------|---------|
| `--ref <branch>` | Deploy a branch other than `main` |
| `--skip-backup` | Skip the pre-deploy backup (not recommended) |
| `--skip-pull` | Rebuild/restart only — no `git pull` |
| `--stop-services` | Stop API and frontend before rebuild (brief downtime) |
| `--health-host <ip>` | Health-check host when verifying from the server itself (default `localhost`) |
| `--allow-dirty` | Allow deploy with uncommitted local changes |

Examples:

```bash
# Standard LAN server update
bash scripts/deploy-update.sh

# Rebuild after local git checkout without pulling
bash scripts/deploy-update.sh --skip-pull

# Roll back code, then redeploy without pulling
git checkout <previous-sha>
bash scripts/deploy-update.sh --skip-pull
```

Database migrations run automatically when the API container starts (`alembic upgrade head`). If you still see missing-column errors after deploy, check `docker compose logs api`.

### Rollback

If an update breaks the app:

1. Check out the last known-good commit and redeploy without pulling:

   ```bash
   git log --oneline -5
   git checkout <previous-sha>
   bash scripts/deploy-update.sh --skip-pull
   ```

2. If the database was affected, restore from the backup created in step 1 of the deploy script. See [documents/database-backup-restore.md](documents/database-backup-restore.md).

### LAN access

Compose publishes port **3000** (frontend) and **8000** (API). From other devices on your network, open `http://<server-lan-ip>:3000`. Ensure the host firewall allows inbound traffic on those ports.

### Running multiple copies (dev + prod) on one host

To run a separate "dev" checkout (sample data, active development) alongside a "prod" checkout (your real watchlist) on the same machine, use a separate clone/directory per copy and set these in each copy's `.env`:

| Setting | Dev copy | Prod copy |
|---------|----------|-----------|
| `FRONTEND_MODE` | `development` (default) — `next dev`, hot reload | `production` — `next build` + `next start`, optimized |
| `FRONTEND_PORT` / `API_PORT` / `POSTGRES_PORT` | e.g. `3001` / `8001` / `5434` | defaults (`3000` / `8000` / `5433`) |

Each copy also needs its own `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` (or its own `postgres_data` volume via a distinct Compose project name, e.g. run `docker compose -p cuebox-dev up` in the dev checkout) so the two stacks don't share a database. Keep `FRONTEND_MODE=production` on the copy serving real data — `next dev` is slower and heavier and is meant for active iteration, not everyday use.

## Documentation

| Document | Purpose |
|----------|---------|
| [documents/ROADMAP.md](documents/ROADMAP.md) | Product direction pointer for upcoming themes (agents + humans) |
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
