# Issue #45: Set an auto database back up to run daily

## Summary

Add a daily, automated full backup of the Cuebox PostgreSQL database when running via Docker Compose, retain only the two most recent daily backups, and document how to restore from a backup file.

## Problem

Cuebox stores watchlist, enrichment, embedding, and recommendation history in Postgres (`postgres_data` Docker volume). There is no scheduled backup or retention policy today. A failed volume, accidental `docker compose down -v`, or corrupted database would lose user data with no recovery path beyond re-importing a Letterboxd CSV (which does not restore recommendation history, embeddings, or sync state).

Operators need:

1. Hands-off daily backups while the stack is running.
2. Bounded disk use (keep two days, drop older files).
3. Clear restore steps that work against the existing Compose setup.

## Acceptance criteria

- [ ] A backup job produces a **full** logical dump of the `cuebox` database (schema + data, including pgvector objects) without stopping the API or Postgres service.
- [ ] Backups run **once per calendar day** on a fixed schedule while Docker Compose is up (default: 03:00 UTC in the backup container).
- [ ] Each backup file is uniquely named (e.g. `cuebox-YYYY-MM-DD.dump`) and written to a host-visible directory (default: `./data/backups/`).
- [ ] After a successful daily backup, **at most two** daily backup files remain; any older daily backup files are deleted automatically.
- [ ] Backup artifacts are excluded from git (`.gitignore` entry for the backup directory).
- [ ] A restore guide (`documents/database-backup-restore.md`) documents end-to-end recovery: prerequisites, stopping dependent services if needed, restore command(s), verification (`psql` / health / film count), and notes on when a full volume reset vs. in-place restore is appropriate.
- [ ] README links to the restore guide from the Documentation table.
- [ ] Manual invocation is supported for testing and ad-hoc backups (`scripts/backup-db.sh` or documented `docker compose run` equivalent).
- [ ] Backup/retention logic is covered by at least one automated test or gate-script check (e.g. shell test with fixture files verifying retention deletes files older than the two newest daily dumps).

## Scope

### In scope

- Docker Compose–first implementation: a lightweight **backup sidecar service** (or equivalent Compose-integrated scheduler) that connects to the existing `postgres` service on the internal network.
- Shell script(s) under `scripts/` implementing `pg_dump`, gzip/custom-format output, filename convention, and retention pruning.
- Compose changes: backup service definition, env vars for schedule/retention paths, volume mount for `./data/backups/`.
- Documentation: dedicated restore guide + README cross-link.
- `.gitignore` for generated backup files.

### Out of scope

- Backups for non-Docker local development (API/Postgres run directly on the host without Compose).
- Remote/off-site backup targets (S3, B2, rsync to another machine).
- Application UI or API endpoints for backup status, download, or restore.
- Point-in-time recovery (WAL archiving) or continuous replication.
- Encrypting backup files at rest (operators may layer their own tooling).
- Changing Postgres backup strategy for Cursor Cloud agent snapshots (see `documents/cloud-agent-part2-test-data.md` — separate concern).

## User flows / API changes

**No user-facing UI or public API changes.** This is operator/infrastructure behavior only.

### Operator flows

1. **Normal operation:** User runs `docker compose up` (or detached). Backup service starts with the stack and runs the daily job on schedule. Backup files appear under `./data/backups/`.
2. **Manual backup:** User runs documented one-liner (e.g. `bash scripts/backup-db.sh` or `docker compose run --rm backup`) before upgrades or migrations.
3. **Restore after data loss:** User follows `documents/database-backup-restore.md` to load a chosen dump into Postgres and restart the API.

## Data and integration notes

### Backup mechanism

- Use `pg_dump` from a client image compatible with Postgres 16 (same major as `pgvector/pgvector:pg16`).
- Prefer **custom format** (`-Fc`) for compressed, restorable dumps; gzip plain SQL is acceptable if simpler but custom format is preferred for `pg_restore` flexibility.
- Connection: internal hostname `postgres`, credentials from existing `POSTGRES_*` env vars in `.env` / Compose.
- Dump must include all application tables, Alembic version, and pgvector extension data.

### Retention policy

- **“Two days worth”** means keep the **two most recent successful daily backup files** (by date embedded in filename or file mtime). When a third daily backup succeeds, delete the oldest file(s) until only two remain.
- Failed or partial dumps must not count toward retention and should not trigger deletion of good backups (script should write atomically: temp file then rename, or delete on failure).

### Compose integration

- Add a `backup` service that:
  - `depends_on: postgres`
  - Mounts `./data/backups` (or configurable `BACKUP_DIR`)
  - Runs cron (e.g. `supercronic`, `ofelia`, or minimal `crond` image) invoking the backup script daily
  - Restarts with the stack; no backup runs when Compose is stopped (acceptable for local-first single-user use)

### Restore

- Primary path: `pg_restore` (custom format) or `psql` (plain SQL) via `docker compose exec -T postgres` or one-shot `postgres` client container.
- Guide must cover restoring into an **empty** database (drop/recreate or fresh volume) vs. overwriting existing data.
- After restore, run API health check and spot-check film/recommendation counts.

### Environment variables (proposed)

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKUP_DIR` | `./data/backups` | Host path for dump files |
| `BACKUP_RETENTION_DAYS` | `2` | Max daily backups to keep |
| `BACKUP_CRON` | `0 3 * * *` | Daily schedule (UTC) |
| `POSTGRES_*` | (existing) | DB connection |

### Testing approach

- Unit/shell test: create fake dated backup files in a temp dir, run retention function, assert only two newest remain.
- Manual verification doc in plan/demo: run backup script, confirm file exists, run retention with three fixtures, confirm oldest removed.
- No requirement to run a full restore in CI (too heavy); restore steps are documented and manually verifiable in demo stage.

## Open questions (must be empty before plan-ready)

_None — defaults above are sufficient for planning._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/45
- Existing `pg_dump` reference: [documents/cloud-agent-part2-test-data.md](../../../documents/cloud-agent-part2-test-data.md) (data-only dev seed; full backup differs)
- Compose Postgres service: [docker-compose.yml](../../../docker-compose.yml)
