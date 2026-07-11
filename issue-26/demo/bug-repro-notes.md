# Bug reproduction notes — issue #26

**Date:** 2026-07-11  
**Commit SHA:** `de208089c5b501de8e79d95c8c97e6917465b390`  
**Environment:** Docker Compose stack (frontend :3000, API :8000); DB seeded with 2 films (The Matrix ready, Ambiguous Title failed).

## Summary

Reproduced four of five spec defects in the running app. The missing home watchlist overview card is a **gap** (feature not present) rather than broken behavior — confirmed by absence on the returning-user dashboard. Review nav typography defect reproduced with mocked `review-required` API (seed DB has zero review-required films).

## 1. Review nav active typography

**Steps:**
1. Mock `GET /api/v1/films/review-required` to return `pagination.total: 1` (Playwright route).
2. Navigate to `http://localhost:3000/review`.
3. Compare active **Review** link to active **Watchlist** (navigate to `/watchlist` for contrast).

**Expected:** Active Review link uses `bg-accent text-foreground shadow-glow` like other nav items.

**Actual:** Active Review link has `bg-accent shadow-glow` but omits `text-foreground` in `app-shell.tsx` (lines 57–58). Screenshot: `bug-repro-review-nav-active.png`. Active Review text renders with muted foreground compared to peer nav items.

**Root cause (code):** Conditional class omits `text-foreground` on active state.

## 2. Film detail backdrop crop

**Steps:**
1. Open `http://localhost:3000/watchlist/b3714da2-1efd-4fc5-9768-12cfa12abcd4` (The Matrix, TMDB backdrop present).
2. Inspect hero `<Image>` classes in DOM / screenshot.

**Expected:** Backdrop cropped from top (`object-top` or equivalent).

**Actual:** `className="object-cover"` only — default center crop. Screenshot: `bug-repro-film-detail.png` (hero uses center-weighted framing).

**Root cause (code):** Missing `object-top` on backdrop `Image` in `film-detail-view.tsx`.

## 3. TMDB / IMDb metadata link text

**Steps:**
1. Same film detail page → scroll to **Metadata** card.
2. Observe TMDB and IMDb anchor text.

**Expected:** **View on TMDB** and **View on IMDB** (Letterboxd pattern: **View on Letterboxd**).

**Actual:** Link text is raw `603` and `tt0133093`. Screenshot: `bug-repro-metadata-links.png`.

**Root cause (code):** Anchor children use `{metadata.tmdb_id}` / `{metadata.imdb_id}` instead of label strings.

## 4. Missing home watchlist overview card

**Steps:**
1. Open `http://localhost:3000/` (returning user — `hasWatchlist === true`, 2 films in DB).
2. Observe dashboard layout below heading.

**Expected:** Full-width card with watchlist count and **View watchlist** CTA above the three-column action grid.

**Actual:** Only three cards (New recommendation, Add film, History). No watchlist summary. API supports count via `GET /films?on_watchlist=true&limit=1` → `pagination.total: 2`. Screenshot: `bug-repro-home-dashboard.png`.

**Root cause:** Feature not implemented — no `useWatchlistCount` hook or overview card in `page.tsx`.

## 5. View history button style

**Steps:**
1. Same home page screenshot.
2. Compare **View history** button to **Start questionnaire** and **Add a film**.

**Expected:** Mint primary fill (`variant` default / `bg-primary`).

**Actual:** **View history** uses `variant="outline"` (transparent with border). Adjacent CTAs use default primary mint. Visible in `bug-repro-home-dashboard.png`.

**Root cause (code):** `page.tsx` line 128 — explicit `variant="outline"`.

## Artifacts

| File | Description |
|------|-------------|
| `bug-repro-home-dashboard.png` | Home dashboard — outline history button, no watchlist card |
| `bug-repro-film-detail.png` | Film detail hero + metadata section |
| `bug-repro-metadata-links.png` | Raw TMDB id link text `603` |
| `bug-repro-review-nav-active.png` | Review nav active without `text-foreground` |

## Notes

- Live DB has `review-required` total `0`; Review nav only appears when count > 0. Demo should mock or seed review-required films for nav scenario.
- `capture-repro.mjs` is a one-off Playwright helper (not production code); may be removed after demo or kept for reference.
