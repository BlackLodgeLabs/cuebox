# Demo notes — issue #45

- **Date:** 2026-06-23
- **Commit:** `df09d9e9e95d36e624437ba36d6fedece4f9c6ac`
- **Stack:** Full Docker Compose (`postgres`, `api`, `frontend`, `backup` all Up)
- **Seed data:** 2 films in `cuebox` database (`enrichment_status` ready)

## Scenario results

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Backup service runs with stack | **PASS** | Four services Up; supercronic started in backup logs; API health `status: ok`, `database: ok` |
| 2 | Manual backup produces dated dump | **PASS** | `cuebox-2026-06-23.dump` (68K) created; API health unchanged after backup |
| 3 | Retention keeps two newest backups | **PASS** | `scripts/test-backup-retention.sh` exited 0; prune left ≤2 `cuebox-*.dump` files |
| 4 | Restore guide complete and linked | **PASS** | `documents/database-backup-restore.md` has prerequisites, stop services, restore, verification, volume-reset notes; README Documentation table links to guide |
| 5 | Restore into disposable database (optional) | **PASS** | Restored dump into `cuebox_restore_test`; film count = 2; test DB dropped |

## Findings for babysit

**Manual backup wrapper:** `bash scripts/backup-db.sh` and `docker compose run --rm backup /usr/local/bin/backup-db.sh` hang because `backup/entrypoint.sh` always `exec`s supercronic and ignores the command override. Manual backup succeeds via:

```bash
docker compose exec -T backup /usr/local/bin/backup-db.sh
```

Restore commands in the guide correctly use host stdin redirect (`< backups/cuebox-*.dump`) into the `postgres` container.

## Artifacts

- `scenario-1-compose-ps.png` — `docker compose ps` + backup logs
- `scenario-1-health-ok.png` — API health JSON
- `scenario-2-backup-ls.png` — film count, backup, `ls -lh backups/`
- `scenario-2-health-after-backup.png` — API health after backup
- `scenario-3-retention-test-pass.png` — retention test PASS
- `scenario-3-two-files-remain.png` — ≤2 dump files after prune
- `scenario-4-restore-doc.png` — restore guide headings
- `scenario-4-readme-link.png` — README Documentation table row
- `scenario-5-restore-verify.png` — test DB restore + `pg_restore --list`

No secrets captured in artifacts.
