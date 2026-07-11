## Related Issue

Closes #26

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/26)

## Description

**What does this PR do?**

Fixes five frontend UI inconsistencies on the Cuebox home dashboard and film detail pages:

1. **Review nav typography** — Active Review link now includes `text-foreground`, matching other nav items.
2. **Film detail backdrop** — Hero backdrop uses top-weighted crop (`object-top`) instead of center crop.
3. **Metadata links** — TMDB and IMDb anchors display **View on TMDB** / **View on IMDB** instead of raw IDs.
4. **Home watchlist overview** — New full-width card shows live watchlist count and a **View watchlist** CTA.
5. **View history button** — History CTA uses primary mint fill, consistent with peer home actions.

**Why is this the best approach?**

All fixes are surgical frontend-only changes: class/string updates in existing components, one new `useWatchlistCount` hook mirroring `usePendingReviewCount`, and targeted unit tests. No API or schema changes — `GET /films?on_watchlist=true` already provides the count via `pagination.total`.

## Changes Proposed

* **`app-shell.tsx`** — Add `text-foreground` to active Review nav class mapping.
* **`film-detail-view.tsx`** — Add `object-top` on backdrop `Image`; replace TMDB/IMDb link text with action labels.
* **`page.tsx`** — Add **Your watchlist** overview card with count and CTA; remove `variant="outline"` from **View history** button.
* **`use-films.ts`** — New `useWatchlistCount` hook via `getFilms({ on_watchlist: true, limit: 1 })`.
* **`app-shell.test.tsx`** — Assert active Review link includes `text-foreground`.
* **`use-films.test.tsx`** — Test `useWatchlistCount` query key and `on_watchlist` param.

## Scenario Results

| # | Scenario | Result |
|---|----------|--------|
| 0 | Bug fix verification (all 5 defects) | ✅ PASS |
| 1 | Review nav active typography | ✅ PASS (mocked `review-required` API; live DB has 0) |
| 2 | Film detail backdrop + metadata links | ✅ PASS |
| 3 | Home watchlist overview card | ✅ PASS (count matches API: 2) |
| 4 | View history primary button | ✅ PASS |

### Home dashboard — watchlist card + mint history button

![Fixed home dashboard](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-26-frontend-visual-polish-cdf5/workflow/issues/issue-26/demo/scenario-0-fixed-home.png)

### Film detail — top crop + metadata links

![Fixed film detail](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-26-frontend-visual-polish-cdf5/workflow/issues/issue-26/demo/scenario-0-fixed-film-detail.png)

![Metadata links](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-26-frontend-visual-polish-cdf5/workflow/issues/issue-26/demo/scenario-2-metadata-links.png)

### Review nav — active typography

![Active Review nav](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-26-frontend-visual-polish-cdf5/workflow/issues/issue-26/demo/scenario-1-review-nav.png)

### Watchlist overview card

![Watchlist card](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-26-frontend-visual-polish-cdf5/workflow/issues/issue-26/demo/scenario-3-watchlist-card.png)

### View history primary button

![History button](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-26-frontend-visual-polish-cdf5/workflow/issues/issue-26/demo/scenario-4-history-button.png)

Full narrative: `workflow/issues/issue-26/demo/demo-notes.md`. Pre-fix repro artifacts (`bug-repro-*.png`) retained for before/after comparison.

## How to Test

1. Checkout this branch: `git checkout cursor/issue-26-frontend-visual-polish-cdf5`
2. Start the stack: `docker compose up`
3. Open `http://localhost:3000/` — confirm **Your watchlist** card shows live count and **View watchlist** CTA; **View history** uses mint primary fill.
4. Open a film with backdrop (e.g. `/watchlist/b3714da2-1efd-4fc5-9768-12cfa12abcd4`) — hero crops from top; Metadata links read **View on TMDB** / **View on IMDB**.
5. If review-required films exist, visit `/review` — active Review nav matches other active nav items.
6. Run unit tests: `cd frontend && npm run test:unit`
7. Run types: `cd frontend && npx tsc --noEmit`

## Known Issues / Notes for Reviewer

* Review nav is only visible when `review-required` count > 0. Demo used mocked API for active-state screenshot; live seeded DB has zero review-required films.
* `useWatchlistCount` invalidates via existing `["films"]` prefix invalidation on add/remove/sync — no new invalidation hooks required.

## Gate evidence

- [x] Frontend unit tests: `npm run test:unit` — 34 passed at `a5201b4`
- [x] Frontend types: `npx tsc --noEmit` exit 0 at `a5201b4`
- [x] Demo scenarios: all 5 pass — see `workflow/issues/issue-26/demo/demo-notes.md`

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated as needed
- [ ] Demo artifacts reviewed
- [ ] No secrets in commits or demo images
