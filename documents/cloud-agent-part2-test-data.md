# Cloud agent setup — Part 2: persistent test data

This document continues **Part 1** (cloud environment boot — see [AGENTS.md](../AGENTS.md) § Cloud environment verification). Part 1 is complete when a fresh cloud agent passes that gate without manual fixes.

Part 2 adds **pre-loaded watchlist data with metadata, semantic profiles, and embeddings** so agents can test UI flows, run recommendations, and record video demos **without live API keys or waiting for import/enrichment**.

---

## Goals

| Goal | Outcome |
|------|---------|
| Ready films on boot | Watchlist populated with `enrichment_status = ready` |
| No provider keys required | Seeded data bypasses TMDB/OpenAI for default agent workflows |
| Repeatable agent UX | Every cloud agent sees the same data for regression and demos |
| Optional live import | CSV smoke path still available when secrets are configured |
| Video evidence | Agents can walk through questionnaire → results on real data |

---

## Test data tiers

Use all three; they serve different purposes.

```mermaid
flowchart TB
  subgraph tier1 [Tier 1 — Automated regression]
    A[verify-phase8-gates.sh] --> B[Ephemeral Postgres + mocked pytest]
  end
  subgraph tier2 [Tier 2 — UI demos / Part 2 default]
    C[docker compose up] --> D[seed-dev-db on empty DB]
    D --> E[Agent walks localhost:3000]
  end
  subgraph tier3 [Tier 3 — Live import validation]
    F[api/tests/fixtures/watchlist.csv] --> G[POST /import + TMDB key]
    G --> H[Real metadata matching]
  end
```

| Tier | Purpose | API keys? | Persists across agent runs? |
|------|---------|-----------|----------------------------|
| 1 | Fast backend regression | No | No (pytest truncates tables) |
| 2 | UI demos, recommendations, video evidence | No | Yes (Postgres `postgres_data` volume + snapshot) |
| 3 | Validate real import/enrichment | Yes (`TMDB`, `OPENAI`) | Yes (if captured in snapshot) |

**Part 2 implements Tier 2.** Tiers 1 and 3 already exist.

---

## Prerequisites (Part 1 complete)

Confirm before starting Part 2 implementation:

- [ ] `.cursor/environment.json` committed with `snapshot`, `install`, `start`, and `stack` terminal
- [ ] `scripts/cloud-bootstrap-env.sh`, `cloud-ensure-docker.sh`, `cloud-start-stack.sh` in place
- [ ] Fresh cloud agent **PASS** on:
  - `docker compose ps` — all three services `Up`
  - `http://localhost:3000/api/v1/health` — `"database":"ok"`
  - `http://localhost:3000` — HTTP 200

Provider keys showing `"error"` in health is expected until dashboard secrets are set.

---

## Implementation overview

Part 2 adds three artifacts:

| Artifact | Role |
|----------|------|
| `scripts/seed-dev-db.py` | Inserts ready films via existing `seed_ready_films()` |
| `scripts/agent-bootstrap.sh` | Waits for stack, seeds DB if empty |
| `.cursor/environment.json` update | Run bootstrap before or after stack start |

Existing building blocks (do not duplicate):

- `api/tests/helpers/seed_ready_films.py` — creates films with metadata, semantic profiles, embeddings, watchlist entries
- `api/tests/fixtures/watchlist.csv` — 2-film CSV for live import smoke tests (Tier 3)
- `scripts/cloud-bootstrap-env.sh` — `.env` + `DATABASE_URL` (Part 1)

---

## Step 1 — Add `scripts/seed-dev-db.py`

Create a small CLI that seeds the **running Compose Postgres** from the host:

```python
#!/usr/bin/env python3
"""Seed the dev database with ready films for cloud agent / UI testing."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from app.database.session import SessionLocal, init_engine
from tests.helpers.seed_ready_films import seed_ready_films

# Host port for Compose Postgres (5433:5432 in docker-compose.yml)
DEFAULT_URL = "postgresql+psycopg://cuebox:cuebox@localhost:5433/cuebox"
COUNT = int(os.environ.get("SEED_FILM_COUNT", "10"))


def main() -> None:
    url = os.environ.get("DATABASE_URL", DEFAULT_URL)
    # When run from host against Compose, rewrite docker hostname to localhost:5433
    if "@postgres:" in url:
        url = url.replace("@postgres:5432", "@localhost:5433")
    init_engine(url)
    with SessionLocal() as db:
        films = seed_ready_films(db, count=COUNT)
    print(f"Seeded {len(films)} ready films")


if __name__ == "__main__":
    main()
```

Make executable: `chmod +x scripts/seed-dev-db.py`

**Default count:** 10 films — enough for recommendation diversity without a large DB.

---

## Step 2 — Add `scripts/agent-bootstrap.sh`

Idempotent bootstrap: wait for API health, seed only when the `films` table is empty.

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/cloud-bootstrap-env.sh

echo "Waiting for API health..."
for _ in $(seq 1 120); do
  if curl -sf http://localhost:8000/api/v1/health 2>/dev/null | grep -q '"database":"ok"'; then
    break
  fi
  sleep 2
done

film_count=$(docker compose exec -T postgres psql -U cuebox -d cuebox -tAc "SELECT count(*) FROM films" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [[ "${film_count:-0}" == "0" ]]; then
  echo "Seeding dev database..."
  python3 scripts/seed-dev-db.py
  echo "Dev DB seeded."
else
  echo "DB already has ${film_count} films — skipping seed."
fi
```

Make executable: `chmod +x scripts/agent-bootstrap.sh`

**Behaviour:**

- First boot on empty volume → seeds 10 ready films
- Subsequent boots → skips seed (data retained in `postgres_data` volume)
- After snapshot restore → same seeded data available immediately

---

## Step 3 — Wire bootstrap into the cloud boot path

Update `scripts/cloud-start-stack.sh` to run bootstrap after Compose is healthy:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/cloud-ensure-docker.sh

docker compose up --build -d

bash scripts/agent-bootstrap.sh

# Follow logs in foreground for the stack terminal
exec docker compose up
```

Alternative: keep `docker compose up` only in the terminal and run `agent-bootstrap.sh` from `install` — but that races the stack. **Preferred:** bootstrap after `docker compose up -d` in `cloud-start-stack.sh`.

---

## Step 4 — Optional dashboard secrets (Tier 3 / live features)

Not required for Tier 2 seeding. Add when you want live import, enrichment, or real recommendations:

| Secret (dashboard) | Purpose |
|--------------------|---------|
| `TMDB_API_KEY` | Live CSV import metadata matching |
| `OPENAI_API_KEY` | Live semantic enrichment and ranking |
| `OMDB_API_KEY` | Optional metadata fallback |

`scripts/cloud-bootstrap-env.sh` mirrors these into `.env` when present in the VM environment.

Live import smoke test (Tier 3):

```bash
CSV_PATH=api/tests/fixtures/watchlist.csv bash scripts/smoke-test.sh
```

Full Tier 3 snapshot workflow (2-film fixture → cloud snapshot): [cloud-agent-tier3-fixture-import-plan.md](cloud-agent-tier3-fixture-import-plan.md).

---

## Step 5 — Enable developer mode (optional, recommended for demos)

In `config.yaml` (or `config.example.yaml` copied at bootstrap):

```yaml
developer_mode: true
```

Restart API after change: `docker compose restart api`

Agents can then demo the trace panel on results/history (`?dev=1` or `Ctrl+Shift+D`).

---

## Step 6 — Capture a new environment snapshot

After Part 2 scripts are implemented and verified once:

1. Start a cloud agent from the branch with seeded data
2. Confirm watchlist and recommendations work at `http://localhost:3000`
3. In [Cloud Agents dashboard → Environments](https://cursor.com/dashboard/cloud-agents#environments), save a **new snapshot**
4. Update the top-level `"snapshot"` field in `.cursor/environment.json` with the new ID

Snapshot retention: 90 days of inactivity; each use extends the window.

**What persists in the snapshot:**

- Docker images, `node_modules`, pip packages
- `postgres_data` volume with seeded films (if snapshot taken after seed)

**What resets each agent run:**

- Git working tree (fresh clone at target branch)
- Running processes (restarted via `terminals`)

---

## Step 7 — Optional SQL dump (faster hydration)

If seeding on every fresh volume is too slow, commit a small data-only dump:

```bash
# After seeding once
docker compose exec -T postgres pg_dump -U cuebox -d cuebox \
  --data-only \
  --table=films --table=film_metadata --table=film_semantic_profiles \
  --table=film_embeddings --table=watchlist_entries --table=import_jobs \
  > fixtures/dev-db-seed.sql
```

Restore in `agent-bootstrap.sh` when `films` count is 0:

```bash
docker compose exec -T postgres psql -U cuebox -d cuebox < fixtures/dev-db-seed.sql
```

Regenerate when Alembic migrations change schema. Keep the file small (< few MB).

---

## Part 2 verification gate

Run on a **fresh cloud agent** (empty `postgres_data` or first seed):

```bash
# Stack up
docker compose ps

# Data present
curl -sf "http://localhost:3000/api/v1/films?limit=5" | python3 -m json.tool

# Ready for recommendations
curl -sf http://localhost:3000/api/v1/films?limit=1 | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['pagination']['total'] >= 1
assert d['data'][0]['enrichment_status'] == 'ready'
print('PASS: ready films present')
"
```

### UI walkthrough (manual or computer use)

1. Open `http://localhost:3000` — should show **New recommendation** (not empty watchlist CTA)
2. Start questionnaire → complete → view results
3. Open **History** — session appears

### Agent verification prompt

```
Verify Part 2 test data is loaded. Confirm:
1. GET /api/v1/films returns at least 10 films with enrichment_status ready
2. Walk through New recommendation → questionnaire → results at http://localhost:3000
3. Record a video demo of the results screen
Report pass/fail. Do not seed manually unless the DB is empty and bootstrap failed.
```

---

## Testing matrix (all parts)

| Goal | Command | Keys needed | Video? |
|------|---------|-------------|--------|
| Part 1 boot gate | See [AGENTS.md](../AGENTS.md) | No | No |
| Part 2 seed gate | `agent-bootstrap.sh` + films check above | No | Optional |
| Backend regression | `bash scripts/verify-phase8-gates.sh` | No | No |
| Live import smoke | `CSV_PATH=api/tests/fixtures/watchlist.csv bash scripts/smoke-test.sh` | `TMDB_API_KEY` | No |
| UI demo for PR | Browser walkthrough at `:3000` | No (Tier 2) | Yes (cloud agent artifact) |

---

## Video demo instructions for agents

Add to task prompts when you want evidence in PRs:

```
Implement [feature]. When done:
1. Confirm Part 2 data is loaded (watchlist not empty)
2. Open http://localhost:3000 and walk through [specific flow]
3. Verify [expected behaviour] on screen
4. Run bash scripts/verify-phase8-gates.sh for regression
5. Open a PR with your changes
```

**Requirements for video artifacts:**

- Computer use enabled (Enterprise: dashboard → Security)
- Network allowlist includes `cloud-agent-artifacts.s3.us-east-1.amazonaws.com` if using egress restrictions
- Optional: enable **Allow posting artifacts to GitHub** on PRs

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty watchlist after boot | Bootstrap raced stack or seed skipped | Ensure `agent-bootstrap.sh` runs after API healthy |
| `seed-dev-db.py` connection refused | Wrong host port | Use `@localhost:5433` from host |
| Films present but not `ready` | Partial import, not seed | Truncate volume: `docker compose down -v`, reboot |
| Recommendations fail | No ready films | Re-run `python3 scripts/seed-dev-db.py` |
| Provider `error` in health | No secrets | Expected for Tier 2; add secrets for Tier 3 |

---

## File checklist (Part 2 implementation PR)

- [ ] `scripts/seed-dev-db.py`
- [ ] `scripts/agent-bootstrap.sh`
- [ ] `scripts/cloud-start-stack.sh` — call bootstrap after `docker compose up -d`
- [ ] `AGENTS.md` — link to this doc + Part 2 verification commands
- [ ] Optional: `fixtures/dev-db-seed.sql`
- [ ] Optional: new snapshot ID in `.cursor/environment.json`
- [ ] Optional: `developer_mode: true` in bootstrap `config.yaml` copy

---

## Related documents

| Document | Purpose |
|----------|---------|
| [AGENTS.md](../AGENTS.md) | Agent commands, Part 1 gate, lint/test matrix |
| [Architecture.md](Architecture.md) | API proxy, enrichment pipeline |
| [api-contracts.md](api-contracts.md) | REST endpoints used by UI |
| [manual-testing-plan.md](../.cursor/docs/plans/manual-testing-plan.md) | Broader manual test scenarios |
