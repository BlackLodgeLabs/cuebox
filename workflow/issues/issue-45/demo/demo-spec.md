# Demo spec — issue #45: Daily auto database backup

Planning agent output. Demo agent follows this exactly.

## Preconditions

- Full Docker stack running after execute merges backup service (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` all **Up**)
- Part 2 seed data present (≥10 films, `enrichment_status: ready`) unless backup-only verification suffices
- Health checks pass:
  - `curl -sf http://localhost:8000/api/v1/health`
  - `curl -sf http://localhost:3000/api/v1/health`
- Repo root has writable `./backups/` directory (created by compose mount or `.gitkeep`)
- No secrets in screenshots (mask `.env` if visible)

## Scenarios

### Scenario 1: Backup service runs with the stack

**Goal:** Prove the backup sidecar starts alongside existing services without breaking health.

**Steps:**

1. Run `docker compose ps` and confirm four services including `backup` are **Up**.
2. Run `docker compose logs backup --tail=20` and confirm supercronic started (no crash loop).
3. Run `curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool` and confirm `"status":"ok"` and `"database":"ok"`.

**Capture:**

- Screenshot: `workflow/issues/issue-45/demo/scenario-1-compose-ps.png` (terminal showing `docker compose ps` with backup Up)
- Screenshot: `workflow/issues/issue-45/demo/scenario-1-health-ok.png` (health JSON or browser network panel)

**Pass criteria:**

- `backup` container is **Up** and not restarting
- API health remains ok with backup service present

---

### Scenario 2: Manual backup produces a dated dump file

**Goal:** Prove full logical backup works on demand without stopping Postgres or API.

**Steps:**

1. Note current film count: `docker compose exec -T postgres psql -U cuebox -d cuebox -tAc "SELECT count(*) FROM films"`.
2. Run manual backup per plan docs (e.g. `docker compose run --rm backup /usr/local/bin/backup-db.sh` or host wrapper).
3. List `./backups/`: `ls -lh backups/`.
4. Confirm new file matches `cuebox-YYYY-MM-DD.dump` and size is > 0.
5. Re-run health check; confirm API still ok.

**Capture:**

- Screenshot: `workflow/issues/issue-45/demo/scenario-2-backup-ls.png` (ls showing dated `.dump` file and size)
- Screenshot: `workflow/issues/issue-45/demo/scenario-2-health-after-backup.png`

**Pass criteria:**

- At least one non-empty `cuebox-*.dump` in `./backups/`
- API/database health unchanged after backup
- Film count query succeeded before backup (establishes DB had data)

---

### Scenario 3: Retention keeps only two newest backups

**Goal:** Prove pruning removes older daily files after a successful backup.

**Steps:**

1. Run automated test: `bash scripts/test-backup-retention.sh` and capture PASS output.
2. Optionally (if Scenario 2 created one file): create two additional small fixture files with older dates in `./backups/` (e.g. `touch backups/cuebox-2020-01-01.dump`), run backup script again or invoke retention-only mode, then `ls backups/` and confirm at most two `cuebox-*.dump` files remain.

**Capture:**

- Screenshot: `workflow/issues/issue-45/demo/scenario-3-retention-test-pass.png` (terminal showing PASS from test script)
- Screenshot: `workflow/issues/issue-45/demo/scenario-3-two-files-remain.png` (ls showing ≤2 dump files after prune)

**Pass criteria:**

- `scripts/test-backup-retention.sh` exits 0
- After retention, no more than two `cuebox-*.dump` files in `./backups/`

---

### Scenario 4: Restore guide is complete and linked

**Goal:** Prove documentation deliverables exist and README points operators to recovery steps.

**Steps:**

1. Open `documents/database-backup-restore.md` and confirm sections: prerequisites, stop services, restore commands, verification, volume reset vs in-place notes.
2. Open README Documentation table and confirm link to restore guide.
3. Optionally run one non-destructive command from the guide (e.g. `pg_restore --list` on the dump file) to show the dump is valid custom format.

**Capture:**

- Screenshot: `workflow/issues/issue-45/demo/scenario-4-restore-doc.png` (restore guide headings visible)
- Screenshot: `workflow/issues/issue-45/demo/scenario-4-readme-link.png` (README table row)

**Pass criteria:**

- Restore guide file exists with end-to-end recovery steps
- README links to `documents/database-backup-restore.md`

---

### Scenario 5 (optional): Restore into disposable database

**Goal:** Validate dump is restorable without destroying the seeded dev DB.

**Only run if time permits.** Use a throwaway DB name or temporary compose override — do **not** wipe the Part 2 seeded `cuebox` database used by the demo stack.

**Steps:**

1. Create temp DB: `docker compose exec -T postgres createdb -U cuebox cuebox_restore_test`.
2. `pg_restore` the dump into `cuebox_restore_test` per restore guide.
3. Verify: `psql -c "SELECT count(*) FROM films"` on test DB > 0.
4. Drop test DB: `docker compose exec -T postgres dropdb -U cuebox cuebox_restore_test`.

**Capture:**

- Screenshot: `workflow/issues/issue-45/demo/scenario-5-restore-verify.png`

**Pass criteria:**

- Restore into test DB succeeds; film count > 0; test DB dropped afterward

## Artifacts checklist

- [ ] `scenario-1-compose-ps.png`
- [ ] `scenario-1-health-ok.png`
- [ ] `scenario-2-backup-ls.png`
- [ ] `scenario-2-health-after-backup.png`
- [ ] `scenario-3-retention-test-pass.png`
- [ ] `scenario-3-two-files-remain.png`
- [ ] `scenario-4-restore-doc.png`
- [ ] `scenario-4-readme-link.png`
- [ ] (optional) `scenario-5-restore-verify.png`
- [ ] `workflow/issues/issue-45/demo/demo-notes.md` — short narrative of scenarios run and outcomes
- [ ] No API keys, passwords, or `.env` secrets in images or demo-notes
