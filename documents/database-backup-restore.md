# Database backup and restore

Cuebox runs a **backup sidecar** with Docker Compose that dumps the full Postgres database once per day (default 03:00 UTC) into `./data/backups/`. Only the two most recent daily dumps are kept.

## Prerequisites

- Docker Compose stack with the `backup` service running (`docker compose ps` shows `postgres`, `api`, `frontend`, and `backup` as **Up**).
- A backup file under `./data/backups/` named `cuebox-YYYY-MM-DD.dump` (custom `pg_dump` format).

## Manual backup

From the repo root:

```bash
bash scripts/backup-db.sh
```

This runs `pg_dump` inside the backup container and writes a dated file to `./data/backups/`. The API and Postgres services stay online.

Equivalent:

```bash
docker compose run --rm backup /usr/local/bin/backup-db.sh
```

## When to restore

| Situation | Approach |
|-----------|----------|
| Corrupted data, bad migration, accidental deletes | **In-place restore** into the existing `cuebox` database (see below). Stop the API first. |
| Fresh start or `docker compose down -v` wiped the volume | **Volume reset**: `docker compose down -v`, `docker compose up -d`, then restore into the empty database. |
| Testing a dump without touching live data | Restore into a **temporary database** (see optional test restore at the end). |

Backups are **logical dumps** (schema + data, including pgvector). They are not point-in-time recovery; you restore to the state captured at dump time.

## Restore (in-place)

### 1. Stop dependent services

Stop the API so it does not write while you restore:

```bash
docker compose stop api frontend
```

Postgres can stay running; `pg_dump` / `pg_restore` work against a live server.

### 2. Choose a backup file

```bash
ls -lh data/backups/
```

Example: `data/backups/cuebox-2026-06-23.dump`

### 3. Restore into `cuebox`

Replace the date in the filename with your chosen dump:

```bash
docker compose exec -T postgres pg_restore \
  --clean --if-exists \
  -U cuebox -d cuebox \
  < data/backups/cuebox-2026-06-23.dump
```

`--clean --if-exists` drops existing objects before recreating them. Expect harmless errors for objects that did not exist (e.g. extensions).

If you prefer a completely empty database first:

```bash
docker compose exec -T postgres psql -U cuebox -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cuebox' AND pid <> pg_backend_pid();"
docker compose exec -T postgres dropdb -U cuebox cuebox
docker compose exec -T postgres createdb -U cuebox -O cuebox cuebox
docker compose exec -T postgres pg_restore -U cuebox -d cuebox < data/backups/cuebox-2026-06-23.dump
```

### 4. Restart the stack

```bash
docker compose up -d
```

### 5. Verify

```bash
curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool
docker compose exec -T postgres psql -U cuebox -d cuebox -c "SELECT count(*) FROM films;"
curl -sf "http://localhost:3000/api/v1/films?limit=1" | python3 -m json.tool
```

Confirm `"status":"ok"`, `"database":"ok"`, a sensible film count, and that the UI loads watchlist data.

## Volume reset + restore

When the Postgres volume is gone:

```bash
docker compose down -v
docker compose up -d postgres
# Wait for postgres healthy, then restore (no --clean needed on empty DB):
docker compose exec -T postgres pg_restore -U cuebox -d cuebox < data/backups/cuebox-2026-06-23.dump
docker compose up -d
```

Run API migrations only if restore did not include the `alembic_version` table; a full `-Fc` dump normally includes it.

## Inspect a dump (non-destructive)

```bash
docker compose exec -T postgres pg_restore --list < data/backups/cuebox-2026-06-23.dump | head
```

## Optional: restore into a test database

Do not use this on the production `cuebox` DB during normal operation:

```bash
docker compose exec -T postgres createdb -U cuebox cuebox_restore_test
docker compose exec -T postgres pg_restore -U cuebox -d cuebox_restore_test < data/backups/cuebox-2026-06-23.dump
docker compose exec -T postgres psql -U cuebox -d cuebox_restore_test -c "SELECT count(*) FROM films;"
docker compose exec -T postgres dropdb -U cuebox cuebox_restore_test
```

## Configuration

Set in `.env` (see `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKUP_RETENTION_DAYS` | `2` | Number of daily dumps to keep |
| `BACKUP_CRON` | `0 3 * * *` | Cron schedule (UTC) in the backup container |
| `BACKUP_DIR` | `/backups` (container) | Mount target; host path is `./data/backups/` |

### Cross-platform deployment

The backup image installs [supercronic](https://github.com/aptible/supercronic) for the host CPU at **build** time (`amd64` on Windows/macOS Intel, `arm64` on Raspberry Pi and Apple Silicon). Build on the machine that will run the stack:

```bash
docker compose build backup
docker compose up -d backup
```

If you build on one architecture and deploy the image elsewhere, use multi-platform build (e.g. `docker buildx build --platform linux/arm64`) or rebuild on the target host. Other services (`api`, `frontend`, `postgres`) use multi-arch base images and do not need special handling.

On Windows, keep shell scripts checked out with LF line endings; CRLF in `entrypoint.sh` can break container startup (the frontend Dockerfile already avoids this pattern).

## Retention

After each **successful** backup, files matching `cuebox-*.dump` in `./data/backups/` are sorted by date in the filename; all but the two newest are deleted. Failed partial dumps are removed and do not trigger pruning.

Automated check: `bash scripts/test-backup-retention.sh`
