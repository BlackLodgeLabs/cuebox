# Cloud agent setup — Tier 3: 2-film fixture import snapshot

This plan describes how to load the committed Letterboxd CSV fixture into a running stack, enrich both films to `ready`, and **save a cloud environment snapshot** so future agents can develop, test, and demo against real import data.

**Related:**

- [cloud-agent-part2-test-data.md](cloud-agent-part2-test-data.md) — Tier 2 synthetic seeding (no API keys)
- [AGENTS.md](../AGENTS.md) — Part 1 cloud boot verification

---

## What you end up with

| Film | Role in demos |
|------|----------------|
| **The Matrix** (1999) | Clean TMDB match → enriches to `ready` |
| **Ambiguous Title** (1981) | Triggers **metadata review** → match-review UX demos |

The CSV is already committed at `api/tests/fixtures/watchlist.csv`. You do **not** need the gitignored `letterboxd/watchlist.csv` if you set `CSV_PATH` to the committed fixture.

For recommendations and full journey demos, both films must reach `enrichment_status: ready`.

---

## Prerequisites

### API keys (required for live import)

Add as **Runtime Secrets** in [Cloud Agents dashboard → Environments](https://cursor.com/dashboard/cloud-agents#environments):

| Secret | Required for |
|--------|----------------|
| `TMDB_API_KEY` | Metadata matching on import |
| `OPENAI_API_KEY` | Semantic enrichment + embeddings (default `config.yaml` providers) |

`scripts/cloud-bootstrap-env.sh` mirrors these into `.env` on boot (Compose uses `env_file: .env`).

### Stack running with a fresh database

If you previously seeded Tier 2 data or ran other imports, reset the volume first:

```bash
docker compose down -v
docker compose up --build
```

Wait until health is green:

```bash
curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool
```

Expect `"status":"ok"` and `"database":"ok"`.

---

## Step 1 — Import the CSV

From the repo root (cloud VM or local machine with stack up):

```bash
export CSV_PATH=api/tests/fixtures/watchlist.csv
export API_BASE=http://localhost:8000/api/v1

IMPORT=$(curl -sf -F "file=@${CSV_PATH}" "${API_BASE}/import")
echo "$IMPORT" | python3 -m json.tool
JOB_ID=$(echo "$IMPORT" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
echo "Job ID: $JOB_ID"
```

Poll until the job completes:

```bash
until curl -sf "${API_BASE}/import/${JOB_ID}/status" | grep -q '"status":"complete"'; do
  echo "Import in progress..."
  sleep 2
done
curl -sf "${API_BASE}/import/${JOB_ID}/status" | python3 -m json.tool
```

---

## Step 2 — Accept metadata reviews

`Ambiguous Title` should appear in review-required. Accept all pending reviews via API:

```bash
python3 <<'PY'
import json
import urllib.request

base = "http://localhost:8000/api/v1"
reviews = json.load(urllib.request.urlopen(f"{base}/films/review-required"))
for item in reviews.get("data", []):
    rid = item["review_id"]
    title = item.get("title", "?")
    req = urllib.request.Request(f"{base}/reviews/{rid}/accept", method="POST")
    resp = json.load(urllib.request.urlopen(req))
    print(f"Accepted review for {title}: {resp.get('review_status')}")
PY
```

**UI alternative:** open `http://localhost:3000`, follow the import/review flow, and accept the match for **Ambiguous Title**.

---

## Step 3 — Wait for enrichment to `ready`

Both films need semantic enrichment (uses `OPENAI_API_KEY`):

```bash
python3 <<'PY'
import json
import time
import urllib.request

base = "http://localhost:8000/api/v1"
deadline = time.time() + 180

while time.time() < deadline:
    films = json.load(urllib.request.urlopen(f"{base}/films?limit=10")).get("data", [])
    statuses = {f["title"]: f["enrichment_status"] for f in films}
    print(statuses)
    if len(films) >= 2 and all(s == "ready" for s in statuses.values()):
        print("PASS: all films ready")
        break
    time.sleep(3)
else:
    raise SystemExit("FAIL: films did not reach ready within 3 minutes")
PY
```

---

## Step 4 — Verify before snapshotting

```bash
curl -sf "http://localhost:3000/api/v1/films?limit=10" | python3 -m json.tool

curl -sf http://localhost:3000/api/v1/films?limit=10 | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['pagination']['total'] == 2, d['pagination']
assert all(f['enrichment_status'] == 'ready' for f in d['data'])
print('PASS: 2 ready films')
"

curl -sf -o /dev/null -w "frontend HTTP %{http_code}\n" http://localhost:3000
```

Open `http://localhost:3000` — you should see **New recommendation** (not the empty-watchlist import CTA).

### Optional: add recommendation history for demos

Complete one questionnaire in the UI so **History** has a session to show in future demos.

---

## Step 5 — Save the cloud snapshot

Do this **in the same cloud VM session** where the import completed (while the `postgres_data` volume still holds the data):

1. Confirm stack is up and both films are `ready` (Step 4).
2. Go to [Cloud Agents dashboard → Environments](https://cursor.com/dashboard/cloud-agents#environments).
3. **Save a new snapshot** (or **Update with Agent**).
4. Copy the new snapshot ID (e.g. `snapshot-20260620-...`).
5. Update the top-level `"snapshot"` field in `.cursor/environment.json`:

```json
{
  "snapshot": "snapshot-20260620-YOUR-NEW-ID",
  ...
}
```

6. Commit and push `environment.json` to `main`.

Future agents booting from that snapshot get Postgres with the 2 imported films — **no re-import on each run**.

**Snapshot retention:** 90 days of inactivity; each use extends the window.

---

## One-shot script

Save as `scripts/load-fixture-watchlist.sh` for a repeatable load (optional implementation):

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CSV_PATH="${CSV_PATH:-api/tests/fixtures/watchlist.csv}"
API_BASE="${API_BASE:-http://localhost:8000/api/v1}"

[[ -f "$CSV_PATH" ]] || { echo "Missing CSV: $CSV_PATH" >&2; exit 1; }

echo "=== Importing ${CSV_PATH} ==="
JOB_ID=$(curl -sf -F "file=@${CSV_PATH}" "${API_BASE}/import" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

until curl -sf "${API_BASE}/import/${JOB_ID}/status" | grep -q '"status":"complete"'; do
  echo "Import in progress..."
  sleep 2
done

echo "=== Accepting pending reviews ==="
python3 <<PY
import json, urllib.request
base = "${API_BASE}"
reviews = json.load(urllib.request.urlopen(f"{base}/films/review-required"))
for item in reviews.get("data", []):
    req = urllib.request.Request(f"{base}/reviews/{item['review_id']}/accept", method="POST")
    urllib.request.urlopen(req)
    print(f"Accepted: {item.get('title', '?')}")
PY

echo "=== Waiting for enrichment ==="
python3 <<PY
import json, time, urllib.request
base = "${API_BASE}"
deadline = time.time() + 180
while time.time() < deadline:
    films = json.load(urllib.request.urlopen(f"{base}/films?limit=10")).get("data", [])
    statuses = {f["title"]: f["enrichment_status"] for f in films}
    print(statuses)
    if len(films) >= 2 and all(f["enrichment_status"] == "ready" for f in films):
        print("PASS: 2 ready films")
        break
    time.sleep(3)
else:
    raise SystemExit("FAIL: enrichment timeout")
PY
```

Usage after a fresh `docker compose up --build`:

```bash
bash scripts/load-fixture-watchlist.sh
```

---

## `smoke-test.sh` alternative

```bash
CSV_PATH=api/tests/fixtures/watchlist.csv bash scripts/smoke-test.sh
```

This imports and accepts one review, but also runs the **full pytest suite** and does **not** wait for semantic `ready`. Use it for API regression, not as the sole snapshot-prep step when you need recommendation demos.

---

## Pre-snapshot checklist

- [ ] `TMDB_API_KEY` and `OPENAI_API_KEY` in dashboard Secrets (mirrored to `.env`)
- [ ] Fresh DB: `docker compose down -v` then `up --build`
- [ ] Import `api/tests/fixtures/watchlist.csv`
- [ ] Accept review for **Ambiguous Title**
- [ ] Both films `enrichment_status: ready`
- [ ] `http://localhost:3000` shows watchlist with 2 films
- [ ] (Optional) One completed recommendation in History
- [ ] Save snapshot → update `environment.json` → commit

---

## Tier 2 vs Tier 3 snapshot

| Approach | Data source | Keys needed | Best for |
|----------|-------------|-------------|----------|
| **Tier 2** (`seed_ready_films`) | Synthetic ~10 films | None | Fast boot, no import UX |
| **Tier 3** (this plan) | Real 2-film CSV import | TMDB + OpenAI | Import, review, real metadata demos |

Use one approach per snapshot. For the committed Letterboxd fixture specifically, follow this Tier 3 plan.

---

## Agent verification prompt

After snapshot is saved, confirm on a fresh agent:

```
Verify Tier 3 fixture data is present from snapshot (no manual import):
1. GET /api/v1/films — expect 2 films, both enrichment_status ready
2. Walk through New recommendation → questionnaire → results at http://localhost:3000
3. Record a video demo including match-review flow context if reviewing import UX
Report pass/fail.
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Import job stuck | Missing `TMDB_API_KEY` | Add secret, restart API |
| Films not `ready` | Missing `OPENAI_API_KEY` | Add secret, restart API |
| No review prompt | TMDB matched cleanly | Check `GET /films/review-required` |
| Wrong film count | Old volume data | `docker compose down -v` and re-import |
| Snapshot has empty DB | Snapshot taken before import | Re-run Steps 1–5 in same session before saving |
