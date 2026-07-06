## Related Issue

[#72 — Integrate TMDB Real-Time Watch Providers Data](https://github.com/BlackLodgeLabs/cuebox/issues/72)

Supersedes backlog item [#24](https://github.com/BlackLodgeLabs/cuebox/issues/24) for the Cursor multi-agent workflow.

## Description

**What does this PR do?**

Adds real-time UK (GB) **Where to Watch** availability by proxying TMDB's Watch Providers API through the backend. Users see grouped streaming, rental, purchase, and ad-supported options on film detail and condensed provider icons on recommendation result cards.

- **Backend:** `TmdbClient.get_movie_watch_providers` and `provider_logo_url`; `WatchProviderService` resolves `film_id` → `tmdb_id`, parses `results.GB` into categorized providers; `GET /films/{film_id}/watch-providers` with `404` / `422 UNPROCESSABLE` / `502|503 PROVIDER_ERROR` handling; `watch_providers.country_code: GB` in config.
- **Frontend:** `useFilmWatchProviders` and `useFilmsWatchProviders` (`staleTime: 0`); `WhereToWatchSection` on `/watchlist/[id]`; `WatchProviderIcons` on winner and runner-up cards in shared `ResultsView` (covers `/recommend/results/[sessionId]` and `/history/[sessionId]`).
- **Verification:** Backend unit and integration tests with mocked TMDB; frontend component tests and mocked Playwright; `documents/api-contracts.md` §4.6; new `scripts/verify-watch-providers-gates.sh` (feature gates + Phase 8 regression).

Provider data is fetched on screen load and **not** persisted to Postgres.

**Why is this the best approach?**

Streaming rights change frequently — storing provider lists during enrichment would go stale quickly. A backend proxy keeps `TMDB_API_KEY` server-side, reuses existing `film_metadata.tmdb_id` lookup, and follows the issue #59 rematch/search precedent (TMDB proxy + React Query hooks + integration tests). Parallel per-film fetches via `useQueries` (up to 5 films on results) are acceptable for v1; batch endpoint and TTL cache are deferred. History detail inherits icons automatically through shared `ResultsView` without duplicate wiring.

## Changes Proposed

* **API — config & errors** (`feat(api)`): `WatchProvidersConfig` with `country_code: GB` in `config.example.yaml` and `AppConfig`; `UNPROCESSABLE` error code for films without `tmdb_id`.
* **API — TMDB client & schemas** (`feat(api)`): `get_movie_watch_providers`, `provider_logo_url`; Pydantic schemas `WatchProviderItem`, `WatchProviderCategory`, `FilmWatchProvidersResponse`.
* **API — service & endpoint** (`feat(api)`): `WatchProviderService`; `GET /films/{film_id}/watch-providers` registered before `GET /{film_id}` on films router.
* **API — tests** (`test(api)`): `test_tmdb_watch_providers.py` (GB parsing, logo URLs, empty categories); `test_integration_watch_providers.py` (200/404/422/502 paths); extended `mock_providers.py` with `/watch/providers` fixture.
* **Frontend — hooks & types** (`feat(frontend)`): Watch-provider types, `getFilmWatchProviders` API client, `useFilmWatchProviders` / `useFilmsWatchProviders` with `staleTime: 0`.
* **Frontend — UI** (`feat(frontend)`): `WhereToWatchSection` (grouped categories, loading skeleton, empty UK, no-`tmdb_id` guidance, error/retry, JustWatch/TMDB attribution); `WatchProviderIcons` (dedupe, cap ~5–6 with `+N` overflow); wired into `film-detail-view.tsx` and `results-view.tsx`.
* **Frontend — tests** (`test(frontend)`): Hook, component, and mocked Playwright coverage in `watch-providers.spec.ts`.
* **Docs & gates** (`docs`): `documents/api-contracts.md` §4.6, `documents/sequence-diagrams.md` watch-provider flow; `scripts/verify-watch-providers-gates.sh`; `AGENTS.md` gate table entry.
* **Workflow artifacts**: Spec, plan, demo screenshots, and demo notes under `workflow/issues/issue-72/`.

## Scenario Results

Demo run on full Docker Compose (2026-07-05, commit `b099a80`). See `workflow/issues/issue-72/demo/demo-notes.md`. Live TMDB watch-provider fetches verified for UK (`GB`).

| # | Scenario | Flow | Result |
|---|----------|------|--------|
| 1 | Film detail Where to Watch | A | **PASS** — Stream, Rent, Buy categories with logos; JustWatch/TMDB attribution |
| 2 | Recommendation results provider icons | B | **PASS** — Winner card shows condensed icons; runners-up without UK providers omit row |
| 3 | History detail inherits results icons | C | **PASS** — Same icons via shared `ResultsView` |
| 4 | Empty UK providers fallback | — | **PASS** — HTTP 200 `categories: []`; UK empty-state copy |
| 5 | Film without TMDB match guidance | — | **PASS** — Guidance message with Edit film match affordance |

### Scenario 1 — Film detail Where to Watch (Flow A)

![Scenario 1 — Where to Watch on The Matrix](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-72-tmdb-watch-providers-real-time/workflow/issues/issue-72/demo/scenario-1-where-to-watch.png)

### Scenario 2 — Recommendation results provider icons (Flow B)

![Scenario 2 — provider icons on winner card](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-72-tmdb-watch-providers-real-time/workflow/issues/issue-72/demo/scenario-2-results-icons.png)

### Scenario 3 — History detail inherits results icons (Flow C)

![Scenario 3 — history detail provider icons](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-72-tmdb-watch-providers-real-time/workflow/issues/issue-72/demo/scenario-3-history-icons.png)

### Scenario 4 — Empty UK providers fallback

![Scenario 4 — empty UK message](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-72-tmdb-watch-providers-real-time/workflow/issues/issue-72/demo/scenario-4-empty-uk.png)

API response: [`scenario-4-api-response.json`](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-72-tmdb-watch-providers-real-time/workflow/issues/issue-72/demo/scenario-4-api-response.json)

### Scenario 5 — Film without TMDB match guidance

![Scenario 5 — no tmdb_id guidance](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-72-tmdb-watch-providers-real-time/workflow/issues/issue-72/demo/scenario-5-no-tmdb-id.png)

## How to Test

### Automated

```bash
git checkout cursor/issue-72-tmdb-watch-providers-real-time

# Watch providers feature gate (ephemeral Postgres on :5432; see AGENTS.md if compose is up)
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
bash scripts/verify-watch-providers-gates.sh
```

Gate script covers: API ruff; watch-provider unit tests (no DB); integration tests; frontend `tsc --noEmit`; frontend unit tests; mocked Playwright `watch-providers.spec.ts`; Phase 8 regression.

**Host build note:** If the Compose frontend dev container is running, stop it and remove `frontend/.next` before host `npm run build` steps inside Phase 8 regression (per AGENTS.md).

Targeted subsets:

```bash
cd api && ruff check app tests
cd api && pytest tests/test_tmdb_watch_providers.py tests/test_integration_watch_providers.py -v
cd frontend && npx tsc --noEmit
cd frontend && npm run test:unit -- src/hooks/use-watch-providers.test.tsx src/components/where-to-watch-section.test.tsx src/components/watch-provider-icons.test.tsx
cd frontend && npx playwright test e2e/watch-providers.spec.ts
```

### Manual (full stack)

1. Ensure config: `cp config.example.yaml config.yaml` and `cp .env.example .env`; set `TMDB_API_KEY` in `.env` for live provider data.
2. Start stack: `docker compose up`
3. Confirm health: `curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool`
4. **Flow A:** Open http://localhost:3000/watchlist → click a `ready` film with `tmdb_id` → scroll to **Where to Watch** (between Metadata and Semantic profile) → verify grouped categories with logos and JustWatch/TMDB attribution.
5. **Flow B:** Complete questionnaire or open `/recommend/results/{sessionId}` → verify condensed provider icons below ratings on winner card; runners-up without UK providers omit the icon row.
6. **Flow C:** Open http://localhost:3000/history → click a session → confirm same icons as results.
7. **Empty UK:** `curl -sf http://localhost:3000/api/v1/films/{id}/watch-providers` for a film returning `categories: []` → UI shows *"No streaming options currently listed for the UK."*
8. **No `tmdb_id`:** Open a `failed` film without metadata → **Where to Watch** shows *"Match TMDB metadata to see streaming options."* with **Edit film match** link.

## Known Issues / Notes for Reviewer

* **TMDB_API_KEY required** for live watch-provider data; CI and mocked Playwright tests do not need it.
* **No database migrations** — provider data is not persisted; only `film_metadata.tmdb_id` is read.
* **GB only** — `watch_providers.country_code: GB` in config; no country picker UI in v1.
* **Up to 5 parallel TMDB calls** on results page (winner + 4 runners-up); batch endpoint deferred.
* **`staleTime: 0`** on watch-provider queries — always refetch on mount for current rights.
* **Results cards** omit the icon row when no providers (no per-card empty message).
* **Developer Mode** raw JSON panel for watch providers is out of scope (optional follow-up).
* **No Alembic changes** — restart API after pull if needed (`docker compose restart api`).

## Checklist

- [x] Acceptance criteria in `workflow/issues/issue-72/SPEC.md` met
- [x] `bash scripts/verify-watch-providers-gates.sh` passes
- [x] `documents/api-contracts.md` §4.6 accurate
- [x] Demo screenshots reviewed (no secrets in artifacts)
- [x] CI green on draft PR #73

## Gate evidence

- [x] `Watch providers gate: bash scripts/verify-watch-providers-gates.sh exit 0 at dceaef1`
