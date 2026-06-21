---
name: run-gate-scripts
description: Run Cuebox phase verification gate scripts (verify-phase*-gates.sh) and related PRD/smoke checks. Use when validating changes, fixing CI failures, running regression tests, or when the user mentions gates, phase verification, or pre-PR checks. Works on cloud agents and local dev.
paths:
  - "scripts/verify-*-gates.sh"
  - "scripts/verify-prd-success-criteria.sh"
  - "scripts/smoke-test.sh"
  - "api/**"
  - "frontend/**"
---

# Run gate scripts

Run the appropriate `scripts/verify-*-gates.sh` gate for the area you changed. Gates are the repo's canonical regression harness; prefer them over ad-hoc test commands when validating a PR.

## Pick the right gate

| If you changed… | Run |
| --- | --- |
| Anything before merge / full regression | `bash scripts/verify-phase8-gates.sh` |
| Developer Mode (`/dev/*`, dev panel) | `bash scripts/verify-phase7-gates.sh` |
| Design tokens / UI polish | `bash scripts/verify-phase6.5-gates.sh` |
| Frontend MVP pages, hooks, components | `bash scripts/verify-phase6-gates.sh` |
| Recommendation engine, scoring, history | `bash scripts/verify-phase5-gates.sh` |
| CSV/RSS sync | `bash scripts/verify-phase4-gates.sh` |
| Semantic enrichment, embeddings pipeline | `bash scripts/verify-phase3-gates.sh` |
| Schema/import/metadata after Phase 3+ edits | `bash scripts/verify-phase2.5-gates.sh` |
| PRD success criteria only | `bash scripts/verify-prd-success-criteria.sh` |

Phase 8 chains Phase 7 (which chains 6.5 → 6 → 2.5–5). Use a narrower gate when the change is scoped; use Phase 8 for final validation.

## Before running

1. **Repo root** — all commands run from the workspace root.
2. **Config files** — ensure `config.yaml` and `.env` exist (`cp config.example.yaml config.yaml` and `cp .env.example .env` if missing). Cloud VMs usually have these from `scripts/cloud-bootstrap-env.sh`.
3. **Dependencies** — API: `cd api && pip install -e ".[dev]"`. Frontend: `cd frontend && npm ci`. Cloud install step handles this.
4. **Docker** — gate scripts start or reuse an ephemeral Postgres on **host port 5432** (`pgvector/pgvector:pg16`). On cloud VMs, run `bash scripts/cloud-ensure-docker.sh` if `docker` is unavailable.

## Run

```bash
bash scripts/verify-phase8-gates.sh
```

Replace `phase8` with the target phase as needed. Read gate output sequentially; fix the first `FAIL` before re-running.

### Optional gates

```bash
# Full-stack Playwright E2E (requires docker compose up)
PLAYWRIGHT_E2E_STACK=1 bash scripts/verify-phase6-gates.sh

# Live stack smoke (requires compose + letterboxd/watchlist.csv)
RUN_SMOKE_TEST=1 bash scripts/verify-phase8-gates.sh
```

## Cloud / compose gotchas

**DATABASE_URL conflict while `docker compose up` is running:** Compose `.env` sets `DATABASE_URL=...@postgres:5432`. Host pytest/gates need a reachable URL. Export before running gates:

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
```

Gate scripts manage their own Postgres on `localhost:5432`. Do **not** point gates at the seeded Compose DB on `localhost:5433` — the autouse test fixture would truncate seeded data.

**Frontend production build (Phase 6+ / Phase 8 Gate 7):** If the Compose frontend dev container is running, it may leave root-owned files in `frontend/.next` and cause `EACCES` on host `npm run build`:

```bash
docker compose stop frontend
sudo rm -rf frontend/.next
# run the gate
docker compose up -d frontend   # restore after
```

**Provider keys:** Gates use mocked HTTP for OpenAI/TMDB/Voyage where possible. Missing API keys in `.env` is expected and should not fail gates.

**No DB unit tests:** Several gates run unit tests before starting Postgres. If Gate 2 fails with a hostname resolution error for `postgres`, unset or override `DATABASE_URL` as shown above.

## On failure

1. Note which gate number failed (e.g. `=== Gate 3: Integration suite ===`).
2. Re-run only the failing pytest subset or sub-gate if obvious from output; otherwise re-run the whole phase script after the fix.
3. For API lint failures: `cd api && ruff check app tests`.
4. For frontend type errors: `cd frontend && npx tsc --noEmit`.
5. See [AGENTS.md](../../../AGENTS.md) for full lint/test tables and additional gotchas.

## Quick checks outside gates

| Check | Command |
| --- | --- |
| API lint | `cd api && ruff check app tests` |
| API unit (no DB) | `cd api && pytest tests/test_health.py tests/test_scoring_service.py -v` (see AGENTS.md for full list) |
| Frontend types | `cd frontend && npx tsc --noEmit` |
| Frontend unit tests | `cd frontend && npm run test:unit` |
| Stack health (cloud Part 1) | `curl -sf http://localhost:3000/api/v1/health` |
