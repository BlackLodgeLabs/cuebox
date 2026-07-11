## Related Issue

Closes #26

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/26)

## Description

**What does this PR do?**

Fixes five frontend UI inconsistencies on the Cuebox home dashboard and film detail pages, aligned with the Modern Neo-Noir Cinema design system (`documents/DESIGN.md`):

1. **Review nav typography** — Active Review link now includes `text-foreground`, matching Home, Watchlist, Recommend, History, and Settings.
2. **Film detail backdrop** — Hero backdrop uses top-weighted crop (`object-top` with `object-cover`) instead of default center crop.
3. **Metadata links** — TMDB and IMDb anchors display **View on TMDB** / **View on IMDB** instead of raw database IDs.
4. **Home watchlist overview** — New full-width **Your watchlist** card shows live watchlist count and a **View watchlist** CTA (returning-user layout only).
5. **View history button** — History CTA uses primary mint fill, consistent with **Start questionnaire** and **Add a film**.

**Why is this the best approach?**

All fixes are surgical frontend-only changes: class/string updates in three existing components, one new `useWatchlistCount` hook mirroring `usePendingReviewCount`, and targeted unit tests. No API or schema changes — `GET /films?on_watchlist=true` already provides the count via `pagination.total`, and existing `["films"]` query invalidation covers cache updates on add/remove/sync.

## Changes Proposed

* **`frontend/src/components/app-shell.tsx`** — Add `text-foreground` to active Review nav class mapping (`bg-accent text-foreground shadow-glow`).
* **`frontend/src/components/film-detail-view.tsx`** — Add `object-top` on backdrop `Image`; replace TMDB/IMDb anchor text with **View on TMDB** / **View on IMDB**.
* **`frontend/src/app/page.tsx`** — Add **Your watchlist** overview card above the three-column action grid; remove `variant="outline"` from **View history** button.
* **`frontend/src/hooks/use-films.ts`** — New `useWatchlistCount` hook via `getFilms({ on_watchlist: true, limit: 1 })` with `select: (data) => data.pagination.total`.
* **`frontend/src/components/app-shell.test.tsx`** — Assert active Review link includes `text-foreground` when pathname is `/review`.
* **`frontend/src/hooks/use-films.test.tsx`** — Test `useWatchlistCount` query key and `on_watchlist` parameter.

## Scenario Results

| # | Scenario | Result |
|---|----------|--------|
| 0 | Bug fix verification (all 5 defects) | ✅ PASS |
| 1 | Review nav active typography | ✅ PASS (mocked `review-required` API; live DB has 0) |
| 2 | Film detail backdrop + metadata links | ✅ PASS |
| 3 | Home watchlist overview card | ✅ PASS (count matches API: 2) |
| 4 | View history primary button | ✅ PASS |

### Home dashboard — watchlist card + mint history button

![Fixed home dashboard](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b2f016d0e2a156db5b481d4dede092f5aaa9f72b/workflow/issues/issue-26/demo/scenario-0-fixed-home.png)

### Film detail — top crop + metadata links

![Fixed film detail](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b2f016d0e2a156db5b481d4dede092f5aaa9f72b/workflow/issues/issue-26/demo/scenario-0-fixed-film-detail.png)

![Top-aligned backdrop](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b2f016d0e2a156db5b481d4dede092f5aaa9f72b/workflow/issues/issue-26/demo/scenario-2-film-hero.png)

![Metadata links](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b2f016d0e2a156db5b481d4dede092f5aaa9f72b/workflow/issues/issue-26/demo/scenario-2-metadata-links.png)

### Review nav — active typography

![Active Review nav](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b2f016d0e2a156db5b481d4dede092f5aaa9f72b/workflow/issues/issue-26/demo/scenario-1-review-nav.png)

### Watchlist overview card

![Watchlist card](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b2f016d0e2a156db5b481d4dede092f5aaa9f72b/workflow/issues/issue-26/demo/scenario-3-watchlist-card.png)

### View history primary button

![History button](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/b2f016d0e2a156db5b481d4dede092f5aaa9f72b/workflow/issues/issue-26/demo/scenario-4-history-button.png)

Full narrative: `workflow/issues/issue-26/demo/demo-notes.md`. Pre-fix repro artifacts (`bug-repro-*.png`, `bug-repro-notes.md`) retained for before/after comparison.

## How to Test

1. Checkout this branch: `git checkout cursor/issue-26-frontend-visual-polish-cdf5`
2. Start the stack: `docker compose up`
3. Open `http://localhost:3000/` — confirm **Your watchlist** card shows live count and **View watchlist** CTA; **View history** uses mint primary fill (not outline).
4. Open a film with backdrop (e.g. `/watchlist/b3714da2-1efd-4fc5-9768-12cfa12abcd4`) — hero crops from top; Metadata links read **View on TMDB** / **View on IMDB**.
5. If review-required films exist, visit `/review` — active Review nav matches other active nav items. (Seeded DB has zero review-required films; use import or API mock to exercise this path.)
6. Run unit tests: `cd frontend && npm run test:unit`
7. Run types: `cd frontend && npx tsc --noEmit`
8. Regression gate: `bash scripts/verify-phase6-gates.sh` (stop compose frontend and `sudo rm -rf frontend/.next` before host build if needed)

## Known Issues / Notes for Reviewer

* Review nav is only visible when `review-required` count > 0. Demo used mocked API for active-state screenshot; live seeded DB has zero review-required films.
* `useWatchlistCount` invalidates via existing `["films"]` prefix invalidation on add/remove/sync — no new invalidation hooks required.
* Watchlist overview card renders only when `hasWatchlist === true` (returning-user layout); empty-state import CTA screen is unchanged.

## Gate evidence

- [x] Frontend unit tests: `npm run test:unit` — 34 passed at `7de102f`
- [x] Frontend types: `npx tsc --noEmit` exit 0 at `d7c9433`
- [x] Demo scenarios: all 5 pass at `315606e` — see `workflow/issues/issue-26/demo/demo-notes.md`

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated as needed
- [ ] Demo artifacts reviewed
- [ ] No secrets in commits or demo images
