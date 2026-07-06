# Issue #72 — Implementation Plan: TMDB Real-Time Watch Providers

## Overview

Add real-time UK (GB) streaming availability by proxying TMDB's Watch Providers API through the backend. Film detail (`/watchlist/[id]`) gains a grouped **Where to Watch** card; recommendation results and history detail show condensed provider icons on each card via shared `ResultsView`. Provider data is fetched on screen load with `staleTime: 0` and is **not** persisted to Postgres.

**Approach:** Extend `TmdbClient` with `get_movie_watch_providers`; add `WatchProviderService` and `GET /films/{film_id}/watch-providers`; build frontend hooks (`useFilmWatchProviders`, `useFilmsWatchProviders`) and UI components (`WhereToWatchSection`, `WatchProviderIcons`). Follow the issue #59 rematch/search precedent for TMDB proxy + integration tests + React Query hooks.

**Classification:** Greenfield feature — no bug reproduction required.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `api/app/providers/tmdb.py` | Add `get_movie_watch_providers`, `provider_logo_url` | TMDB `/watch/providers` client |
| `api/app/schemas/watch_providers.py` | **New** — `WatchProviderItem`, `WatchProviderCategory`, `FilmWatchProvidersResponse` | Typed API response |
| `api/app/schemas/errors.py` | Add `UNPROCESSABLE` to `ErrorCode` | 422 when film has no `tmdb_id` |
| `api/app/services/watch_provider_service.py` | **New** — resolve film → `tmdb_id`, call TMDB, normalize GB categories | Business logic |
| `api/app/dependencies.py` | Add `get_watch_provider_service` | FastAPI DI |
| `api/app/routers/v1/films.py` | Add `GET /{film_id}/watch-providers` before `GET /{film_id}` | HTTP surface |
| `api/app/core/config.py` | Add `WatchProvidersConfig` with `country_code: GB` | Configurable region default |
| `config.example.yaml` | Add `watch_providers.country_code: GB` | Operator config |
| `api/tests/mock_providers.py` | Add `/watch/providers` handler with GB fixture data | Integration test mocks |
| `api/tests/test_tmdb_watch_providers.py` | **New** — unit tests for client parsing | GB parsing, empty categories, logo URLs |
| `api/tests/test_integration_watch_providers.py` | **New** — endpoint integration tests | 200/404/422/502 paths |
| `documents/api-contracts.md` | Add §4.6 Watch Providers | Contract documentation |
| `documents/sequence-diagrams.md` | Add watch-provider fetch flow diagram | Architecture traceability |
| `scripts/verify-watch-providers-gates.sh` | **New** — feature gate + Phase 8 regression | Pre-PR verification |
| `AGENTS.md` | Add gate script to lint/test table | Operator docs |
| `frontend/src/types/api.ts` | Add watch-provider types | TypeScript parity |
| `frontend/src/lib/api-client.ts` | Add `getFilmWatchProviders` | API client |
| `frontend/src/hooks/use-watch-providers.ts` | **New** — `useFilmWatchProviders`, `useFilmsWatchProviders` | React Query layer |
| `frontend/src/components/where-to-watch-section.tsx` | **New** — grouped detail card | Film detail UX |
| `frontend/src/components/watch-provider-icons.tsx` | **New** — condensed icon row | Results card UX |
| `frontend/src/components/film-detail-view.tsx` | Wire `WhereToWatchSection` after Metadata card | Entry point |
| `frontend/src/components/results-view.tsx` | Wire `WatchProviderIcons` below `RatingsRow` | Results + history UX |
| `frontend/src/hooks/use-watch-providers.test.tsx` | **New** — hook tests | `staleTime: 0`, `useQueries` |
| `frontend/src/components/where-to-watch-section.test.tsx` | **New** — component tests | Loading, populated, empty, error |
| `frontend/src/components/watch-provider-icons.test.tsx` | **New** — component tests | Dedupe, cap, omit empty |
| `frontend/e2e/helpers/dev-api-mocks.ts` | Add watch-providers mock response | Playwright isolation |
| `frontend/e2e/watch-providers.spec.ts` | **New** — mocked Playwright tests | E2E coverage |

## Implementation steps

### Step 1 — Config and error code (commit 1)

1. Add `WatchProvidersConfig` model to `api/app/core/config.py`:
   ```python
   class WatchProvidersConfig(BaseModel):
       country_code: str = "GB"
   ```
   Wire as `watch_providers: WatchProvidersConfig` on `AppConfig`.
2. Add to `config.example.yaml`:
   ```yaml
   watch_providers:
     country_code: GB
   ```
3. Add `UNPROCESSABLE = "UNPROCESSABLE"` to `ErrorCode` in `api/app/schemas/errors.py`.

### Step 2 — TMDB client and schemas (commit 2)

1. In `api/app/providers/tmdb.py`:
   - Add frozen `@dataclass TmdbWatchProviderEntry` (`provider_id`, `provider_name`, `logo_path`, `display_priority`).
   - Add `@dataclass TmdbWatchProvidersResult` (`link: str | None`, `flatrate`, `rent`, `buy`, `ads` lists).
   - Implement `get_movie_watch_providers(tmdb_id)` → `GET {TMDB_BASE_URL}/movie/{tmdb_id}/watch/providers`; parse `results[country_code]` (default from config at service layer; client accepts `country_code` param).
   - Add `provider_logo_url(path, size="w92")` static helper using `https://image.tmdb.org/t/p/{size}{logo_path}`.
2. Create `api/app/schemas/watch_providers.py`:
   - `WatchProviderItem`: `provider_id`, `provider_name`, `logo_url`, `display_priority`
   - `WatchProviderCategory`: `type` (`flatrate`|`rent`|`buy`|`ads`), `label` (`Stream`|`Rent`|`Buy`|`Free with Ads`), `providers: list[WatchProviderItem]`
   - `FilmWatchProvidersResponse`: `film_id`, `tmdb_id`, `country_code`, `link`, `categories` (omit empty groups)

### Step 3 — WatchProviderService (commit 3)

Create `api/app/services/watch_provider_service.py`:

1. Constructor: `WatchProviderService(provider_service: ProviderService, config: AppConfig)`.
2. `async def get_watch_providers(self, db, film_id: UUID, *, country_code: str | None = None)`:
   - Resolve `country_code` from arg → `config.watch_providers.country_code` → `"GB"`.
   - Load film via `film_repository.get_by_id` → `404 NOT_FOUND` if missing.
   - Load `film_metadata` via `film_metadata_repository.get_by_film_id` → `422 UNPROCESSABLE` if no row or `tmdb_id` is `None` (message: *"Match TMDB metadata to see streaming options."*).
   - Get `TmdbClient` from `provider_service.get_tmdb_client()` → `503 PROVIDER_ERROR` if key missing.
   - Call `tmdb.get_movie_watch_providers(tmdb_id)`; on `httpx.HTTPError` → `502 PROVIDER_ERROR`.
   - Map GB arrays to categories; sort providers by `display_priority`; build `logo_url` via `TmdbClient.provider_logo_url`.
   - Return `200` with `categories: []` when GB exists but all four arrays are empty (frontend shows UK empty-state).
3. Add `get_watch_provider_service` to `api/app/dependencies.py`.

### Step 4 — Router endpoint (commit 4)

In `api/app/routers/v1/films.py`, register **before** `GET /{film_id}` (same tier as `tmdb-search` / `rematch`):

```python
@router.get("/{film_id}/watch-providers", response_model=FilmWatchProvidersResponse)
async def get_film_watch_providers(
    film_id: UUID,
    country: str | None = None,
    db: Session = Depends(get_db),
    watch_provider_service: WatchProviderService = Depends(get_watch_provider_service),
):
    return await watch_provider_service.get_watch_providers(db, film_id, country_code=country)
```

Route order after change:

1. `GET ""`
2. `GET "/review-required"`
3. `GET "/{film_id}/tmdb-search"`
4. `POST "/{film_id}/rematch"`
5. `GET "/{film_id}/watch-providers"` ← new
6. `GET "/{film_id}"`

### Step 5 — Backend tests and mocks (commit 5)

1. Extend `api/tests/mock_providers.py`:
   - Add `/watch/providers` branch in `mock_provider_handler`.
   - Fixture for `MATRIX_TMDB_ID` (603): GB with `flatrate` (Netflix, Disney+), `rent`, `buy`.
   - Fixture for empty GB (all arrays empty) on a secondary ID.
   - Ensure `partial_http_failure` profile excludes `/watch/providers` from blanket 500.
2. `api/tests/test_tmdb_watch_providers.py` (unit, no DB):
   - Parses all four GB monetization arrays.
   - Omits missing arrays; handles empty GB object.
   - `provider_logo_url` builds correct `image.tmdb.org` URL.
3. `api/tests/test_integration_watch_providers.py`:
   - `test_watch_providers_returns_gb_categories` — 200 with categorized providers for seeded ready film.
   - `test_watch_providers_not_found` — 404 unknown `film_id`.
   - `test_watch_providers_no_tmdb_id` — 422 `UNPROCESSABLE` for unmatched film.
   - `test_watch_providers_empty_gb` — 200 with `categories: []`.
   - `test_watch_providers_tmdb_error` — 502 on mocked TMDB failure.

### Step 6 — API documentation (commit 6)

1. `documents/api-contracts.md` — new **§4.6 Get Film Watch Providers**:
   - Path, optional `country` query param, response shape, error table (`NOT_FOUND` 404, `UNPROCESSABLE` 422, `PROVIDER_ERROR` 502/503).
2. `documents/sequence-diagrams.md` — mermaid sequence for film detail and results parallel fetch flows.

### Step 7 — Frontend types and API client (commit 7)

1. Add to `frontend/src/types/api.ts`:
   - `WatchProviderItem`, `WatchProviderCategory`, `FilmWatchProvidersResponse`.
2. Add `getFilmWatchProviders(filmId, params?: { country?: string })` to `api-client.ts` → `GET /films/${filmId}/watch-providers`.

### Step 8 — React Query hooks (commit 8)

Create `frontend/src/hooks/use-watch-providers.ts`:

1. `useFilmWatchProviders(filmId)`:
   - `queryKey: ["films", filmId, "watch-providers"]`
   - `enabled: Boolean(filmId)`
   - `staleTime: 0` — always refetch on mount.
2. `useFilmsWatchProviders(filmIds: string[])`:
   - `useQueries` from `@tanstack/react-query` — one query per `film_id`.
   - Return `Map<filmId, { data, isLoading, isError }>` for card lookup.
   - Cap at 5 IDs (winner + 4 runners-up).

### Step 9 — WhereToWatchSection component (commit 9)

Create `frontend/src/components/where-to-watch-section.tsx`:

1. Props: `filmId: string`, optional `hasTmdbId: boolean` (from `FilmDetail.metadata?.tmdb_id` or film enrichment state).
2. Uses `useFilmWatchProviders(filmId)`.
3. **Loading:** skeleton rows matching `CardGridSkeleton` / design tokens.
4. **No `tmdb_id`:** static message *"Match TMDB metadata to see streaming options."* with link to **Edit Film Match** (no API call).
5. **422 from API:** same guidance message.
6. **Populated:** `Card` titled **Where to Watch** with subsections:
   - Stream (`flatrate`), Rent (`rent`), Buy (`buy`), Free with Ads (`ads`) — only non-empty groups.
   - Each provider: `next/image` logo (`w92`) + `provider_name`; use existing `image.tmdb.org` remote pattern.
7. **Empty categories:** *"No streaming options currently listed for the UK."*
8. **Error:** inline `ErrorState` with retry (reuse pattern from watchlist page).
9. **Footer:** JustWatch/TMDB attribution; optional link to `link` field when present.

Wire into `film-detail-view.tsx` between Metadata card (line ~244) and Semantic profile card (line ~246).

### Step 10 — WatchProviderIcons component (commit 10)

Create `frontend/src/components/watch-provider-icons.tsx`:

1. Props: `providers: WatchProviderItem[]` or lookup from `useFilmsWatchProviders` map.
2. Dedupe by `provider_id` across categories; prefer order `flatrate` > `ads` > `rent` > `buy`.
3. Render up to 5–6 logos at `w45` size; `+N` overflow badge if more.
4. Omit entirely when no providers (no empty-state text on cards).
5. `aria-label` per icon with provider name.

### Step 11 — ResultsView integration (commit 11)

In `frontend/src/components/results-view.tsx`:

1. `ResultsView` collects `film_id` from `data.winner` + `data.runners_up`.
2. Call `useFilmsWatchProviders(filmIds)` at parent level.
3. Pass provider data to `WinnerResultCard` and `RunnerResultCard`.
4. Insert `WatchProviderIcons` below `RatingsRow` in both card types (lines ~145, ~191).
5. History detail (`/history/[sessionId]`) inherits automatically via shared `ResultsView`.

### Step 12 — Frontend tests (commit 12)

| File | Coverage |
|------|----------|
| `use-watch-providers.test.tsx` | Single query, `useQueries` parallelism, `staleTime: 0`, disabled when no `filmId` |
| `where-to-watch-section.test.tsx` | Loading skeleton, populated categories, empty UK, no-`tmdb_id` guidance, error+retry |
| `watch-provider-icons.test.tsx` | Dedupe across categories, cap+overflow, omit when empty |
| Extend `results-view.test.tsx` if present | Icons render on winner/runner cards |

### Step 13 — Playwright E2E (mocked API) (commit 13)

1. Extend `frontend/e2e/helpers/dev-api-mocks.ts` with `GET .../watch-providers` fixture (GB flatrate logos).
2. New `frontend/e2e/watch-providers.spec.ts`:
   - Film detail shows **Where to Watch** with provider logos (mocked).
   - Film detail shows UK empty-state when `categories: []`.
   - Results page shows provider icons on winner card (mocked session + watch-providers).

### Step 14 — Gate script and AGENTS.md (commit 14)

Create `scripts/verify-watch-providers-gates.sh`:

```bash
# Gate 1: API ruff
# Gate 2: Watch providers unit tests (no DB)
# Gate 3: Watch providers integration tests (ephemeral Postgres)
# Gate 4: Frontend tsc --noEmit
# Gate 5: Frontend unit tests (watch-provider components/hooks)
# Gate 6: Playwright watch-providers (mocked API)
# Gate 7: Phase 8 regression (verify-phase8-gates.sh)
```

Update `AGENTS.md` gate table with `verify-watch-providers-gates.sh` entry.

## Tests required

| Acceptance criterion | Test type | Location |
|---------------------|-----------|----------|
| Backend calls TMDB `/watch/providers` via `TmdbClient` | Unit | `test_tmdb_watch_providers.py` |
| `TMDB_API_KEY` server-side only | Code review | No frontend TMDB calls |
| GB localization default | Unit + integration | `test_tmdb_watch_providers.py`, `test_integration_watch_providers.py` |
| All four monetization arrays parsed | Unit | `test_tmdb_watch_providers.py` |
| `GET /films/{film_id}/watch-providers` resolves `tmdb_id` | Integration | `test_integration_watch_providers.py` |
| Film detail **Where to Watch** grouped card | Component + Playwright | `where-to-watch-section.test.tsx`, `watch-providers.spec.ts` |
| Results condensed icons on cards | Component + Playwright | `watch-provider-icons.test.tsx`, `watch-providers.spec.ts` |
| History detail same icons via `ResultsView` | Component | `results-view` tests (shared component) |
| Empty GB fallback message | Component + integration | `where-to-watch-section.test.tsx`, `test_integration_watch_providers.py` |
| No `tmdb_id` guidance message | Component + integration | `where-to-watch-section.test.tsx`, `test_integration_watch_providers.py` |
| JustWatch/TMDB attribution on detail | Component | `where-to-watch-section.test.tsx` |
| `api-contracts.md` documents endpoint | Doc review | `documents/api-contracts.md` |
| TMDB errors mocked | Integration | `test_integration_watch_providers.py` |
| Frontend `tsc --noEmit` | Gate | `verify-watch-providers-gates.sh` |

## Gate script

Execute agent runs before final push:

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
bash scripts/verify-watch-providers-gates.sh
```

If Compose frontend is running, stop it and clear `frontend/.next` before Gate 4 production build steps inside Phase 8 regression (per AGENTS.md gotcha).

Additionally:

```bash
cd api && ruff check app tests
cd frontend && npx tsc --noEmit
```

## Documentation updates

| File | Update |
|------|--------|
| `documents/api-contracts.md` | §4.6 Watch Providers endpoint |
| `documents/sequence-diagrams.md` | Watch-provider fetch sequence |
| `AGENTS.md` | Gate table entry for `verify-watch-providers-gates.sh` |
| `README.md` | No change required (feature is self-explanatory in UI) |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Up to 5 parallel TMDB calls on results page | Acceptable for v1; `request_with_retry` handles 429; batch endpoint deferred |
| Film without `tmdb_id` | `422` + detail guidance; omit icons on results cards |
| Missing `TMDB_API_KEY` | `503 PROVIDER_ERROR`; CI uses mocks |
| Duplicate provider in rent + buy | Dedupe by `provider_id` on results icons |
| JustWatch attribution omitted | Required footer on detail section; component test asserts presence |
| Stale streaming rights | `staleTime: 0` refetch on every mount |
| TMDB logo hotlink failures | `next/image` with `onError` fallback to provider name text |

**Rollback:** Revert branch commits. No migrations to roll back. No DB columns added.

## Definition of done

- [ ] `TmdbClient.get_movie_watch_providers` and `provider_logo_url` implemented
- [ ] `GET /films/{film_id}/watch-providers` registered before `GET /{film_id}`; documented in `api-contracts.md` §4.6
- [ ] `WatchProviderService` resolves `film_id` → `tmdb_id`; returns GB categories; handles 404/422/502/503
- [ ] `watch_providers.country_code: GB` in `config.example.yaml` and `AppConfig`
- [ ] `WhereToWatchSection` on film detail with grouped categories, attribution, empty/error states
- [ ] `WatchProviderIcons` on recommendation results and history detail cards
- [ ] `staleTime: 0` on watch-provider React Query hooks
- [ ] Backend unit + integration tests pass with mocked TMDB
- [ ] Frontend component tests and mocked Playwright pass
- [ ] `scripts/verify-watch-providers-gates.sh` passes including Phase 8 regression
- [ ] `AGENTS.md` gate table updated
- [ ] No open questions in SPEC
