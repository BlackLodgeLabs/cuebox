# Cloud agent test data — Tier 3 (2-film CSV import snapshot)

Optional snapshot for testing the **real import → review → enrichment** path on a tiny fixture. For default cloud agent work, use [Tier 2](cloud-agent-part2-test-data.md) instead.

**Fixture:** `api/tests/fixtures/watchlist.csv` (2 films)

| Film | Demo role |
|------|-----------|
| **The Matrix** (1999) | Clean TMDB match → `ready` |
| **Ambiguous Title** (1981) | Metadata **review** UX |

---

## Prerequisites

| Secret | Purpose |
|--------|---------|
| `TMDB_API_KEY` | Metadata matching |
| `OPENAI_API_KEY` | Semantic enrichment + embeddings |

Add as Cursor Cloud **Runtime Secrets**; `scripts/cloud-bootstrap-env.sh` mirrors them to `.env`.

**Fresh DB** (no Tier 2 seed):

```bash
docker compose down -v
docker compose up --build
```

Wait for `"database":"ok"` on `http://localhost:8000/api/v1/health`.

---

## Setup steps

### 1. Import CSV

```bash
export CSV_PATH=api/tests/fixtures/watchlist.csv
export API_BASE=http://localhost:8000/api/v1

IMPORT=$(curl -sf -F "file=@${CSV_PATH}" "${API_BASE}/import")
JOB_ID=$(echo "$IMPORT" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

until curl -sf "${API_BASE}/import/${JOB_ID}/status" | grep -q '"status":"complete"'; do sleep 2; done
```

### 2. Accept metadata reviews

```bash
python3 <<'PY'
import json, urllib.request
base = "http://localhost:8000/api/v1"
for item in json.load(urllib.request.urlopen(f"{base}/films/review-required")).get("data", []):
    req = urllib.request.Request(f"{base}/reviews/{item['review_id']}/accept", method="POST")
    print(urllib.request.urlopen(req).read().decode())
PY
```

### 3. Wait for enrichment

```bash
python3 <<'PY'
import json, time, urllib.request
base = "http://localhost:8000/api/v1"
for _ in range(60):
    films = json.load(urllib.request.urlopen(f"{base}/films?limit=10")).get("data", [])
    if len(films) >= 2 and all(f["enrichment_status"] == "ready" for f in films):
        print("PASS: 2 ready films"); break
    time.sleep(3)
else:
    raise SystemExit("FAIL: enrichment timeout")
PY
```

### 4. Save snapshot

1. Confirm http://localhost:3000 shows 2 films.
2. Save Cursor Cloud environment snapshot.
3. Update `snapshot` in `.cursor/environment.json` and commit.

---

## Tier 2 vs Tier 3

| | Tier 2 | Tier 3 (this doc) |
|--|--------|-------------------|
| Data | Synthetic ~10 films | Real 2-film import |
| Keys | None | TMDB + OpenAI |
| Best for | General dev/demos | Import + review UX |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Import stuck | Check `TMDB_API_KEY`; restart API |
| Not `ready` | Check `OPENAI_API_KEY` |
| Wrong film count | `docker compose down -v` and re-import |
| Empty snapshot | Re-run steps 1–3 before saving |
