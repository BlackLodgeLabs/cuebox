# Implementation plan — Issue #45: Daily auto database backup

## Overview

Add a lightweight Docker Compose **backup sidecar** that runs `pg_dump` on a daily cron schedule (default 03:00 UTC), writes full custom-format dumps to a host-mounted `./data/backups/` directory, and prunes older files so only the two most recent successful daily backups remain. Core logic lives in a reusable shell script (`scripts/backup-db.sh`) with a testable retention function; the backup container runs [supercronic](https://github.com/aptible/supercronic) against that script. A restore guide documents recovery via `pg_restore` against the existing Compose Postgres service. No API, frontend, or schema changes.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `scripts/backup-db.sh` | **Add** | `pg_dump`, atomic write, filename convention, retention pruning; callable manually and from cron |
| `scripts/test-backup-retention.sh` | **Add** | Automated retention test with fixture files (acceptance criterion) |
| `backup/Dockerfile` | **Add** | Minimal image: Postgres 16 client tools + supercronic |
| `backup/entrypoint.sh` | **Add** | Start supercronic with configurable `BACKUP_CRON` |
| `docker-compose.yml` | **Modify** | Add `backup` service: `depends_on: postgres`, mount `./data/backups`, env vars |
| `.gitignore` | **Modify** | Ignore `data/backups/` (generated dumps) |
| `data/backups/.gitkeep` | **Add** | Preserve directory in git without committing dumps |
| `.env.example` | **Modify** | Document optional `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, `BACKUP_CRON`, `PGHOST` |
| `documents/database-backup-restore.md` | **Add** | End-to-end restore guide |
| `README.md` | **Modify** | Link restore guide in Documentation table; brief mention of daily backups |
| `AGENTS.md` | **Modify** | Note backup service in stack table / running stack section |
| `workflow/issues/issue-45/demo/demo-spec.md` | **Add** | Demo scenarios for execute-ready handoff |
| `workflow/issues/issue-45/workflow.state.json` | **Modify** | Stage → `plan-ready` |

## Implementation steps

### Step 1 — Backup shell script (`scripts/backup-db.sh`)

1. `set -euo pipefail`; resolve `BACKUP_DIR` (default `/backups` in container, overridable), `BACKUP_RETENTION_DAYS` (default `2`), Postgres connection from `PGHOST`/`POSTGRES_*` env (defaults: `postgres`, `cuebox`/`cuebox`/`cuebox`).
2. **Dump:** `pg_dump -Fc -h "$PGHOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB"` to a temp file `cuebox-YYYY-MM-DD.dump.tmp` in `BACKUP_DIR`.
3. **Atomic rename:** on success, `mv` temp → `cuebox-YYYY-MM-DD.dump`; on failure, remove temp and exit non-zero (failed partials must not trigger retention).
4. **Retention:** extract `prune_old_backups()` function that:
   - Lists files matching `cuebox-*.dump` in `BACKUP_DIR`
   - Sorts by date in filename (fallback: mtime)
   - Deletes all but the `BACKUP_RETENTION_DAYS` newest
   - Is callable when sourced with `BACKUP_RETENTION_ONLY=1` for tests
5. Log start/finish and file size to stdout.

**Commit:** `feat(backup): add pg_dump script with retention pruning`

### Step 2 — Retention test (`scripts/test-backup-retention.sh`)

1. Create temp dir; touch fixture files `cuebox-2026-01-01.dump`, `cuebox-2026-01-02.dump`, `cuebox-2026-01-03.dump`.
2. Source retention function from `backup-db.sh` with `BACKUP_RETENTION_DAYS=2`.
3. Assert only `cuebox-2026-01-02.dump` and `cuebox-2026-01-03.dump` remain; exit 0/1 with clear PASS/FAIL messages.
4. Make executable; runnable without Docker or Postgres.

**Commit:** `test(backup): add retention pruning shell test`

### Step 3 — Backup container (`backup/`)

1. **Dockerfile:** `FROM postgres:16-alpine`; install supercronic binary; copy `scripts/backup-db.sh` and `backup/entrypoint.sh`; `chmod +x`.
2. **entrypoint.sh:** write crontab line `"$BACKUP_CRON /usr/local/bin/backup-db.sh"` to a file; `exec supercronic` on it. Default `BACKUP_CRON=0 3 * * *`.
3. Ensure `PGHOST=postgres` and `BACKUP_DIR=/backups` are set in Compose environment.

**Commit:** `feat(backup): add supercronic sidecar image`

### Step 4 — Docker Compose integration

1. Add `backup` service:
   - `build: ./backup`
   - `depends_on: [postgres]`
   - `env_file: .env`
   - `environment`: `PGHOST=postgres`, `BACKUP_DIR=/backups`, `BACKUP_RETENTION_DAYS`, `BACKUP_CRON` with defaults
   - `volumes`: `./data/backups:/backups`
   - `restart: unless-stopped`
2. No changes to `postgres`, `api`, or `frontend` services (dump runs online; no service stop required).

**Commit:** `feat(backup): wire backup service into docker compose`

### Step 5 — Gitignore and directory

1. Add `data/backups/` to `.gitignore`.
2. Add `data/backups/.gitkeep` so the mount path exists on fresh clones.

**Commit:** `chore(backup): gitignore backup artifacts`

### Step 6 — Documentation

1. **`documents/database-backup-restore.md`:**
   - Prerequisites (Compose stack, backup file location)
   - When to use full volume reset vs in-place restore
   - Stop API (optional but recommended) before restore
   - Restore commands: drop/recreate DB or `pg_restore --clean --if-exists` via `docker compose exec -T postgres`
   - Verification: `curl` health, `psql` film count, spot-check history
   - Manual backup: `bash scripts/backup-db.sh` (via `docker compose run --rm backup /usr/local/bin/backup-db.sh` or documented wrapper)
2. **README.md:** add row to Documentation table; one sentence under Quick start about automatic daily backups.
3. **`.env.example`:** optional backup vars with comments.
4. **AGENTS.md:** mention fourth container in stack verification; note `./data/backups/` retention.

**Commit:** `docs(backup): restore guide and README cross-links`

### Step 7 — Manual host wrapper (optional thin script)

If useful, add a one-liner wrapper `scripts/backup-db.sh` at repo root that delegates to `docker compose run --rm backup /usr/local/bin/backup-db.sh` when not already inside the container (detect via `PGHOST` or `CUEBOX_IN_BACKUP_CONTAINER`). Keeps spec’s “manual invocation” ergonomic on the host.

**Commit:** (same as Step 1 or small follow-up)

## Tests required

| Acceptance criterion | Test / verification |
|---------------------|---------------------|
| Full logical dump (schema + data, pgvector) without stopping services | **Demo Scenario 2:** run manual backup against live stack; assert non-empty `cuebox-*.dump`; stack health still `ok` during/after |
| Daily schedule at 03:00 UTC while Compose is up | **Compose review:** `backup` service runs supercronic with `BACKUP_CRON=0 3 * * *`; **Demo Scenario 1:** `docker compose ps` shows `backup` Up |
| Unique dated filenames in `./data/backups/` | **Demo Scenario 2:** file matches `cuebox-YYYY-MM-DD.dump` pattern |
| At most two backups after successful run | **`scripts/test-backup-retention.sh`** (automated); **Demo Scenario 3:** three fixture files → prune → two remain |
| `data/backups/` in `.gitignore` | **Execute:** `git check-ignore -v data/backups/cuebox-test.dump` returns match |
| Restore guide + README link | **Manual/doc review:** file exists; README table row; **Demo Scenario 4:** follow restore pre-checks (dry-run or verify doc commands parse) |
| Manual invocation supported | **Demo Scenario 2:** documented command produces dump |
| Automated retention test | **`bash scripts/test-backup-retention.sh`** in execute + optional gate hook |

**Not in CI:** full `pg_restore` against live volume (too heavy, mutates data). Covered in demo spec as optional Scenario 5 with disposable test volume if time permits.

## Gate script

This change is infrastructure/docs only (no API or frontend code). Before push:

1. **`bash scripts/test-backup-retention.sh`** — new feature test (must pass).
2. **`bash scripts/verify-phase8-gates.sh`** — full regression to ensure Compose/stack docs changes do not break existing gates.

Export host DB URLs if Compose stack is running (per AGENTS.md gotchas):

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
```

Optional quick smoke after Compose change:

```bash
docker compose ps   # postgres, api, frontend, backup all Up
curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool
```

## Documentation updates

| File | Update |
|------|--------|
| `documents/database-backup-restore.md` | New — primary deliverable |
| `README.md` | Documentation table + brief backup note |
| `.env.example` | `BACKUP_*` and `PGHOST` for backup container |
| `AGENTS.md` | Stack service count, backup dir, manual backup command |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| `pg_dump` fails mid-write corrupts retention | Atomic temp-then-rename; failed dumps deleted; retention only after success |
| Backup container adds compose build time | Small Alpine image; only rebuilds when `backup/` changes |
| Disk fill if retention breaks | Retention runs after every successful dump; test guards logic |
| Cloud agent `./data/backups/` on bind mount | Retention caps at 2 files; negligible footprint |
| Restore overwrites live data | Guide stresses stopping API and choosing fresh volume vs in-place |
| `docker compose up` now starts 4 services | Backup is passive; no port conflicts |

**Rollback:** remove `backup` service from `docker-compose.yml`, delete `backup/` image context, revert scripts; existing data unaffected. Remove `./data/backups/` manually if desired.

## Definition of done

- [ ] `scripts/backup-db.sh` dumps full DB in custom format with atomic writes and retention
- [ ] `scripts/test-backup-retention.sh` passes locally without Docker
- [ ] `backup` Compose service runs supercronic on `0 3 * * *` UTC default
- [ ] `./data/backups/` host mount receives dated `.dump` files; `data/backups/` gitignored
- [ ] `documents/database-backup-restore.md` complete; README links to it
- [ ] Manual backup documented and working via Compose
- [ ] `bash scripts/verify-phase8-gates.sh` passes
- [ ] Demo spec scenarios executable on cloud VM with full stack
- [ ] Draft PR opened by execute stage (not planning)
