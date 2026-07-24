# Scenario 6 — Cap unchanged

Watched import via `POST /api/v1/sync/watched` succeeded (HTTP 200) without `WATCHLIST_SIZE_EXCEEDED`.

Response snippet:

```json
{
  "films_seen": 10,
  "films_created": 0,
  "watches_created": 0,
  "watches_skipped_duplicate": 11,
  "pending_review": 0,
  "enrichment_job_id": null,
  "failures": []
}
```

Active watchlist cap remains `MAX_ACTIVE_WATCHLIST = 500` in `api/app/services/sync_service.py` and is enforced on CSV watchlist sync / transitions into active — not on watched-history import. Imported watched films are not counted toward the active 500.
