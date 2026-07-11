# Demo notes — issue #26: Frontend Visual Polish

**Date:** 2026-07-11  
**Commit SHA:** `d7c94337c329db49e332cdf81b9cc2ccf2b6ce2a` (execute); demo artifacts committed on same branch  
**Environment:** Docker Compose (frontend :3000, API :8000); seeded DB with 2 watchlist films (The Matrix ready, Ambiguous Title failed).

## Summary

All five spec fixes verified on the running stack. Screenshots captured per `demo-spec.md`. Review nav active typography validated with mocked `review-required` API (live DB has zero review-required films).

## Scenario results

| Scenario | Result | Notes |
|----------|--------|-------|
| 0 — Bug fix verification | **PASS** | All five defects fixed vs `bug-repro-notes.md` |
| 1 — Review nav typography | **PASS** | Active Review link includes `text-foreground` (mocked API; see below) |
| 2 — Backdrop + metadata links | **PASS** | `object-top` on hero; **View on TMDB** / **View on IMDB** labels |
| 3 — Watchlist overview card | **PASS** | Card shows "2 films on your watchlist"; matches API `pagination.total: 2` |
| 4 — View history button | **PASS** | `bg-primary` mint fill, not outline |

## Scenario 0: Bug fix verification

**Home (`scenario-0-fixed-home.png`):**

- **Your watchlist** card present above the three-column action grid with count and **View watchlist** CTA.
- **View history** uses primary mint (`bg-primary text-primary-foreground`), consistent with **Start questionnaire** and **Add a film**.

**Film detail (`scenario-0-fixed-film-detail.png`):**

- Hero image uses `object-cover object-top` (top-weighted crop).
- Metadata links display human-readable labels (see Scenario 2).

**Review nav (`scenario-0-fixed-review-nav.png`):**

- Active Review link uses `bg-accent text-foreground shadow-glow` (mocked `review-required` count).

## Scenario 1: Review nav active typography

Live DB has `review-required` total `0`; Review nav is hidden without films pending review. Demo used Playwright route mock (`GET /api/v1/films/review-required`) with a full `ReviewRequiredFilm` payload so `/review` renders and the nav shows active state.

**Verification:** Active Review link classes include `text-foreground`; matches other active nav items (`bg-accent text-foreground shadow-glow`).

**Capture:** `scenario-1-review-nav.png`

## Scenario 2: Film detail backdrop and metadata links

**Film:** The Matrix (`/watchlist/b3714da2-1efd-4fc5-9768-12cfa12abcd4`)

- Hero (`scenario-2-film-hero.png`): top-aligned crop via `object-top`.
- Metadata (`scenario-2-metadata-links.png`):
  - TMDB: **View on TMDB** → `https://www.themoviedb.org/movie/603`
  - IMDb: **View on IMDB** → `https://www.imdb.com/title/tt0133093`

## Scenario 3: Home watchlist overview card

- Card visible with copy **2 films on your watchlist** (API: `GET /films?on_watchlist=true&limit=1` → `pagination.total: 2`).
- **View watchlist** navigates to `/watchlist`.

**Capture:** `scenario-3-watchlist-card.png`

## Scenario 4: View history primary button

**View history** button uses default primary variant (`bg-primary`), visually aligned with peer CTAs in the action cards row.

**Capture:** `scenario-4-history-button.png`

## Artifacts

| File | Description |
|------|-------------|
| `scenario-0-fixed-home.png` | Fixed home dashboard with watchlist card + mint history button |
| `scenario-0-fixed-film-detail.png` | Fixed film detail page |
| `scenario-0-fixed-review-nav.png` | Fixed active Review nav typography |
| `scenario-1-review-nav.png` | Review nav active state (mocked API) |
| `scenario-2-film-hero.png` | Top-aligned backdrop crop |
| `scenario-2-metadata-links.png` | Human-readable TMDB/IMDb links |
| `scenario-3-watchlist-card.png` | Watchlist overview card |
| `scenario-4-history-button.png` | Primary mint View history button |

Pre-fix repro artifacts (`bug-repro-*.png`, `bug-repro-notes.md`) retained for before/after comparison.
