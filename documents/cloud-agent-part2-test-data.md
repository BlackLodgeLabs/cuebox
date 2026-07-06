# Cloud agent test data — Tier 2 (Part 2)

Part **1** is stack health (Docker, API, frontend). See [AGENTS.md](../AGENTS.md) § Cloud environment verification (Part 1 gate).

Part **2** adds **pre-loaded watchlist data** so cloud agents can demo UI flows and run recommendations **without API keys or CSV import**.

---

## What Tier 2 provides

| | |
|--|--|
| **Films** | ~10 synthetic titles (`Ready Film 0`, …) with metadata, semantic profiles, embeddings |
| **Status** | All `enrichment_status: ready` |
| **Keys** | None required |
| **Persistence** | Postgres `postgres_data` volume; optional Cursor Cloud snapshot |

---

## How it runs (automatic)

```text
cloud-start-stack.sh → agent-bootstrap.sh → seed-dev-db.py (if films table empty)
```

| Script | Role |
|--------|------|
| `scripts/cloud-start-stack.sh` | Compose up + bootstrap |
| `scripts/agent-bootstrap.sh` | Wait for health; seed if `films` count is 0 |
| `scripts/seed-dev-db.py` | Inserts films via `api/tests/helpers/seed_ready_films.py` |

Host Postgres port: **5433** (`5433:5432` in `docker-compose.yml`).

---

## Part 2 verification gate

```bash
docker compose ps

curl -sf "http://localhost:3000/api/v1/films?limit=5" | python3 -m json.tool

curl -sf http://localhost:3000/api/v1/films?limit=1 | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['pagination']['total'] >= 10
assert d['data'][0]['enrichment_status'] == 'ready'
print('PASS: ready films present')
"
```

**UI:** http://localhost:3000 shows **New recommendation** (not the empty-watchlist import CTA).

---

## Manual re-seed

```bash
docker compose down -v && docker compose up --build -d
# agent-bootstrap runs seed automatically on empty DB

# Or explicitly:
python3 scripts/seed-dev-db.py
```

---

## Test data tiers (summary)

| Tier | Purpose | Keys? | Persists? |
|------|---------|-------|-----------|
| **1** | `pytest` / gate scripts (ephemeral DB) | No | No |
| **2** | UI demos on cloud VM (this doc) | No | Yes (volume / snapshot) |
| **3** | Real CSV import path — see [cloud-agent-tier3-fixture-import-plan.md](cloud-agent-tier3-fixture-import-plan.md) | TMDB + OpenAI | Yes (if snapshot saved) |

Use **one** snapshot approach (Tier 2 **or** Tier 3), not both in the same volume.
