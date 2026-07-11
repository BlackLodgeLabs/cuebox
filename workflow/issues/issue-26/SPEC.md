# Issue #26: [bug/ux] Frontend Visual Polish and Home Page Watchlist Card Addition

## Summary

Fix five frontend UI inconsistencies on the Cuebox home dashboard and film detail pages: align the **Review** nav item typography with other nav links, top-align film backdrop images, replace raw TMDB/IMDb ID link text with human-readable labels, add a watchlist overview metric card on the home page, and restyle the **View history** button to the primary mint CTA style.

All changes are frontend-only; no API or database work is required.

## Problem

Several UI elements deviate from the Modern Neo-Noir Cinema design system (`documents/DESIGN.md`) or present poor UX:

1. **Review nav typography** — When the conditional **Review** nav link is active, it omits `text-foreground` on the active state while standard nav items include it. The active Review link can appear with muted text color and inconsistent weight/rendering compared to Home, Watchlist, Recommend, History, and Settings.

   ```56:59:frontend/src/components/app-shell.tsx
   pathname.startsWith("/review")
     ? "bg-accent shadow-glow"
     : "text-muted-foreground hover:text-foreground",
   ```

   Standard nav active state for comparison:

   ```42:44:frontend/src/components/app-shell.tsx
   active
     ? "bg-accent text-foreground shadow-glow"
     : "text-muted-foreground hover:text-foreground",
   ```

2. **Film detail backdrop crop** — The hero backdrop on `/watchlist/[filmId]` uses `object-cover` without `object-position`, defaulting to center crop. Poster/backdrop art loses important top framing (titles, faces, composition).

   ```84:89:frontend/src/components/film-detail-view.tsx
   <Image
     src={backdropUrl}
     alt=""
     fill
     priority
     className="object-cover"
   />
   ```

3. **Metadata external links** — TMDB and IMDb anchors in the Metadata card render raw database identifiers (`12345`, `tt1234567`) as click text instead of action labels. Letterboxd already uses **View on Letterboxd**.

   ```215:237:frontend/src/components/film-detail-view.tsx
   {metadata.tmdb_id}
   ...
   {metadata.imdb_id}
   ```

4. **Missing watchlist overview on home** — Returning users with a watchlist see recommendation, add-film, and history cards but no at-a-glance watchlist count or shortcut to `/watchlist`. The watchlist page already displays `pagination.total` with `on_watchlist: true`; the home dashboard lacks an equivalent summary.

5. **View history button style** — The History card CTA uses `variant="outline"` while peer home actions (**Start questionnaire**, **Add a film**, **Review matches**) use the default primary mint fill.

   ```128:130:frontend/src/app/page.tsx
   <Button asChild variant="outline" className="w-full">
     <Link href="/history">View history</Link>
   </Button>
   ```

## Acceptance criteria

- [ ] **Review nav font** — When `/review` is active, the Review nav link uses the same class mapping as other nav items: `text-label-md normal-case tracking-normal` with `bg-accent text-foreground shadow-glow` on active and `text-muted-foreground hover:text-foreground` on inactive. Visual appearance matches Home/Watchlist/etc. in both states (Space Mono via `text-label-md` / `font-mono`).
- [ ] **Backdrop top alignment** — Film detail hero backdrop images are cropped from the **top** (e.g. `object-top` with `object-cover`, or equivalent). No vertical centering that clips top composition on typical widescreen backdrops.
- [ ] **TMDB/IMDb link text** — Metadata card outbound links display **View on TMDB** and **View on IMDB** (matching Letterboxd's **View on Letterboxd** pattern). `href` values remain unchanged (`https://www.themoviedb.org/movie/{id}`, `https://www.imdb.com/title/{id}`).
- [ ] **Home watchlist overview card** — On `/`, when the user has a watchlist (`hasWatchlist === true`), a dedicated overview card shows the live count of films on the active watchlist and a CTA button linking to `/watchlist`. Count updates when watchlist mutations invalidate film queries (add/remove/sync). Card is visible only in the returning-user layout (not on the empty-state import CTA screen).
- [ ] **View history mint button** — The History card button on `/` uses the default primary (mint) button variant — no `variant="outline"`. Visually consistent with **Start questionnaire** and **Add a film** on the same page.

## Scope

### In scope

- `frontend/src/components/app-shell.tsx` — Review nav active-state class fix.
- `frontend/src/components/film-detail-view.tsx` — Backdrop `object-position`; TMDB/IMDb link label strings.
- `frontend/src/app/page.tsx` — Watchlist overview card; History button variant.
- `frontend/src/hooks/use-films.ts` — New `useWatchlistCount` hook (mirrors `usePendingReviewCount`).
- Unit tests in `frontend/src/components/app-shell.test.tsx` and `frontend/src/hooks/use-films.test.tsx`.
- Optional: update `e2e/watchlist-add.spec.ts` or home E2E if assertions cover home card layout.

### Out of scope

- Backend/API changes (`GET /films` already supports `on_watchlist` filter and `pagination.total`).
- Redesign of the home page grid column count beyond accommodating the new card.
- Empty-state home page (`!hasWatchlist`) — no watchlist card when there is no watchlist.
- Letterboxd link text (already correct).
- Film detail mobile negative-margin hero bleed (`-mx-4`) — separate from backdrop vertical crop.
- Loading Space Mono weight 600 in `layout.tsx` — only address if Review fix alone is insufficient after QA.

## User flows / API changes

### Flow 1: Review nav (any page with review badge)

1. User has films requiring metadata review (`reviewCount > 0`).
2. **Review** appears in the header nav with a count badge.
3. User navigates to `/review`.
4. **Review** nav item is highlighted with the same typography and colors as other active nav items.

### Flow 2: Film detail backdrop and metadata links

1. User opens `/watchlist/[filmId]` for a film with a TMDB backdrop URL.
2. Hero image shows top-aligned crop within the fixed-height container (`h-56 md:h-72`).
3. In the Metadata card, TMDB and IMDb links read **View on TMDB** / **View on IMDB** and open the correct external URLs in a new tab.

### Flow 3: Home watchlist overview (returning user)

1. User lands on `/` with at least one film on the watchlist.
2. A watchlist overview card displays e.g. **12 films on your watchlist** (singular/plural handled) and a button such as **View watchlist** → `/watchlist`.
3. After adding a film via `/watchlist/add`, returning to `/` shows an updated count (via React Query invalidation on `["films"]` keys).

### Flow 4: Home history CTA

1. User on `/` with a watchlist sees the History card.
2. **View history** button uses mint primary styling, consistent with adjacent action cards.

### API usage (no new endpoints)

`useWatchlistCount` should call existing `getFilms({ on_watchlist: true, limit: 1 })` and select `pagination.total`, following the `usePendingReviewCount` pattern:

```104:109:frontend/src/hooks/use-films.ts
export function usePendingReviewCount() {
  return useQuery({
    queryKey: ["films", "review-required", "count"],
    queryFn: () => getReviewRequired({ limit: 1 }),
    select: (data) => data.pagination.total,
  });
}
```

Proposed hook:

```ts
export function useWatchlistCount() {
  return useQuery({
    queryKey: ["films", "watchlist-count"],
    queryFn: () => getFilms({ on_watchlist: true, limit: 1 }),
    select: (data) => data.pagination.total,
  });
}
```

### Layout recommendation

Place the watchlist overview card **full-width above** the existing three-column action grid (`sm:grid-cols-3`), below the page heading. This keeps the metric prominent without forcing a four-column grid on small breakpoints. Card structure should match existing home `Card` + `CardHeader` + `CardContent` + mint `Button` patterns.

Example content:

| Element | Value |
|---------|-------|
| Title | Your watchlist |
| Description | `{count} film(s) on your watchlist` |
| CTA | **View watchlist** → `/watchlist` |

## Data and integration notes

- **Watchlist count semantics** — `on_watchlist: true` filters to films currently on the user's active watchlist (same as `/watchlist` page). Count excludes removed/off-watchlist films.
- **Cache invalidation** — Existing `useAddToWatchlist` invalidates `queryKey: ["films"]`, which covers `["films", "watchlist-count"]`. Verify CSV import and sync flows also invalidate `["films"]` (they should via existing import/sync hooks).
- **Design tokens** — Nav: `text-label-md` → Space Mono, 14px/600 (`documents/DESIGN.md`). Primary button: `bg-primary` mint `#aed0a3`, chamfer via `btn-chamfer` (`frontend/src/components/ui/button.tsx` default variant).
- **No auth or env changes.**

## Open questions (must be empty before plan-ready)

_None — issue body and codebase exploration provide sufficient detail._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/26
- Design system: `documents/DESIGN.md`
- Prior exploration plan (non-authoritative): referenced in issue comment on PR #33 / `documents/frontend-visual-polish-plan.md` (may exist on another branch)
