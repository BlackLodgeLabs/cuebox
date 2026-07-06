## Related Issue

[Issue #59 — Allow manual rematching/editing of film metadata](https://github.com/BlackLodgeLabs/cuebox/issues/59)

Supersedes backlog item [#23](https://github.com/BlackLodgeLabs/cuebox/issues/23) for the Cursor workflow.

## Description

**What does this PR do?**

Adds a user-facing **Edit Film Match** flow so anyone can search TMDB, pick the correct movie for a watchlist entry, and have Cuebox replace stored metadata and regenerate semantic profiles and embeddings.

- **Backend:** `GET /films/{film_id}/tmdb-search` proxies TMDB movie search with pagination (`page`, `limit` up to 20 per page); `POST /films/{film_id}/rematch` applies a user-selected `tmdb_id`, persists full metadata (`metadata_source: tmdb_manual`, `match_confidence: 1.0`), reconciles pending review rows, and enqueues the existing semantic/embedding pipeline.
- **Frontend:** `EditFilmMatchDialog` on `/watchlist/[id]` (visible for all enrichment states), debounced TMDB search with **Previous/Next** page controls, rematch mutation with React Query cache invalidation, and polling while `enriching`. Review page links to film detail for Flow C.
- **Verification:** Integration tests for rematch from `ready`, `failed`, and `review_required` plus conflict cases; mocked Playwright E2E; `api-contracts.md` §4.4–4.5.

**Why is this the best approach?**

The implementation mirrors the proven `accept_review` pattern: reuse `MetadataService._persist_metadata` and `run_semantic_pipeline_for_film` rather than a new enrichment path. No schema migrations — existing `film_metadata`, `metadata_match_reviews`, and enrichment enums suffice. Guards return `409 CONFLICT` during in-flight `matching`/`enriching` and when the chosen `tmdb_id`/`imdb_id` belongs to another film. Letterboxd-sourced fields (`title`, `year`, `letterboxd_uri`) stay unchanged; only TMDB-linked metadata is replaced. TMDB pagination is proxied through the API so the modal can browse multi-page result sets without client-side caps.

## Changes Proposed

* **API — TMDB search & rematch** (`feat(api)`): Extend `TmdbSearchResult` with `poster_path`; add repository helpers for duplicate `tmdb_id`/`imdb_id` detection and `resolve_pending_for_film`; implement `MetadataService.search_tmdb` and `rematch_film`; wire `GET /films/{id}/tmdb-search` and `POST /films/{id}/rematch` (202 Accepted) on `films.py`.
* **API — TMDB search pagination** (`feat(rematch)`): Proxy TMDB `page` param through `GET /films/{id}/tmdb-search` with `pagination` metadata; return up to 20 results per page (was capped at 10 on page 1 only); update `api-contracts.md` §4.4.
* **API — tests** (`test(api)`): New `test_integration_rematch.py` covering ready/failed/review transitions, enriching conflict, duplicate `tmdb_id`, search proxy, and pagination; shared `wait_for_film_status` helper; rematch included in Phase 8 gate; health test isolation fix for `.env` provider keys.
* **Docs** (`docs`): `documents/api-contracts.md` §4.4 Search TMDB, §4.5 Rematch, and rematch state diagram.
* **Frontend — Edit Film Match UI**: New `EditFilmMatchDialog` (modal search, year filter, scrollable results, confirm, page navigation); `FilmDetailView` CTA for all enrichment states; `watchlist/[filmId]/page.tsx` enrichment polling and success/failure toasts.
* **Frontend — API layer**: Types, `searchTmdb`/`rematchFilm` client methods, `useTmdbSearch`/`useRematchFilm` hooks with `page` param, `useFilm` `pollWhileEnriching` option.
* **Frontend — review entry point**: `review/page.tsx` film title link and **Choose different match** button to `/watchlist/{film_id}`.
* **Frontend — E2E** (`test(e2e)`): Mocked Playwright coverage in `film-rematch.spec.ts` with `film-rematch-mocks.ts` helper (includes pagination mocks).
* **Workflow artifacts**: Spec, plan, demo screenshots, and demo notes under `workflow/issues/issue-59/`.

## Scenario Results

Demo run on full Docker Compose (2026-06-30, commit `c0876a2`). See `workflow/issues/issue-59/demo/demo-notes.md`.

| Scenario | Flow | Result |
|----------|------|--------|
| 1 — Fix wrong match on ready film | A | **PASS** — The Matrix rematched via paginated search (query **Star**, page 2 of 4, 75 results); enriching → ready ~5s; metadata updated |
| 2 — Recover failed film | B | **PASS** — Ambiguous Title (`failed`) rematched to WCCW Christmas Star Wars '81; metadata and semantic profile populated |
| 3 — Override review candidate | C | **SKIP** — `/review` showed “All matches resolved” (no pending reviews in environment); prior captures retained |
| 4 — Entry from recommendation results | D | **PASS** — History card watchlist link opens detail with **Edit Film Match** visible |

### Scenario 1 — Fix wrong match on ready film (Flow A)

![Scenario 1 before](demo/scenario-1-detail-before.png)

![Scenario 1 modal with pagination](demo/scenario-1-modal-search.png)

![Scenario 1 after](demo/scenario-1-detail-after.png)

### Scenario 2 — Recover failed film (Flow B)

![Scenario 2 before](demo/scenario-2-failed-before.png)

![Scenario 2 after](demo/scenario-2-ready-after.png)

### Scenario 3 — Override review candidate (Flow C)

Prior run captures (review queue empty in latest demo):

![Scenario 3 review card](demo/scenario-3-review-card.png)

![Scenario 3 cleared](demo/scenario-3-review-cleared.png)

### Scenario 4 — Entry from recommendation results (Flow D)

![Scenario 4 from results](demo/scenario-4-from-results.png)

## How to Test

### Automated

```bash
# API lint + integration (ephemeral Postgres on :5432; see AGENTS.md if compose is up)
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
cd api && ruff check app tests
cd api && pytest tests/test_integration_rematch.py -v

# Frontend types + mocked E2E
cd frontend && npx tsc --noEmit
cd frontend && npx playwright test e2e/film-rematch.spec.ts

# Full regression (optional)
bash scripts/verify-phase8-gates.sh
```

### Manual (full stack)

1. Checkout this branch: `git checkout cursor/issue-59-manual-film-metadata-rematch`
2. Ensure config: `cp config.example.yaml config.yaml` and `cp .env.example .env`; set `TMDB_API_KEY` in `.env` for live search.
3. Start stack: `docker compose up` (or use cloud bootstrap scripts).
4. Confirm health: `curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool`
5. **Flow A:** Open http://localhost:3000/watchlist → click a `ready` film → **Edit Film Match** → search TMDB (try a broad query like **Star** to exercise pagination) → use **Next** if needed → confirm → verify enriching badge then updated metadata (~5–30s).
6. **Flow B:** Open a `failed` film detail → **Edit Film Match** → rematch → verify `ready` with populated metadata.
7. **Flow C:** Open http://localhost:3000/review → click film title → **Edit Film Match** with a different TMDB pick → confirm film leaves review queue (requires a pending review candidate).
8. **Flow D:** Open a history/recommendation result → click watchlist link on a card → verify **Edit Film Match** on detail page.

## Known Issues / Notes for Reviewer

* **TMDB_API_KEY required** for live modal search; CI and mocked Playwright tests do not need it.
* **No Alembic migrations** — restart API container after pull so existing schema is used (`docker compose restart api`).
* **Same `tmdb_id` rematch** on the same film is allowed and re-triggers enrichment (refresh semantic/embeddings).
* **Recommendation history snapshots** are unchanged; detail pages show current metadata for the film ID.
* **Letterboxd fields** (`title`, `year`, `letterboxd_uri`) are never edited — only TMDB-linked metadata changes.
* **Scenario 3** was skipped in the latest demo because the seeded environment had no pending review items; prior screenshots from 2026-06-28 document the review-override flow.
* TMDB search pagination shows **Page X of Y (N results)** with **Previous** / **Next** controls; rematch from page 2+ verified end-to-end.

## Checklist

- [ ] Acceptance criteria in `workflow/issues/issue-59/SPEC.md` met
- [ ] `ruff check app tests` passes
- [ ] `pytest tests/test_integration_rematch.py` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npx playwright test e2e/film-rematch.spec.ts` passes
- [ ] `documents/api-contracts.md` §4.4–4.5 accurate
- [ ] Demo screenshots reviewed (no secrets in artifacts)
- [ ] Phase 8 gate / CI green on PR
