---
name: Frontend Visual Polish and Home Page Watchlist Card
overview: "Fix five frontend UI inconsistencies — Review nav typography, film detail backdrop alignment, TMDB/IMDb link copy, home watchlist overview card, and View History button styling — without API or backend changes."
type: bug/ux
todos:
  - id: fvp-nav-review-font
    content: "Align Review nav link active/inactive class map with standard NAV_ITEMS (text-foreground on active)"
    status: pending
  - id: fvp-backdrop-align
    content: "Add object-top to film detail backdrop Image so framing anchors to top of container"
    status: pending
  - id: fvp-metadata-links
    content: "Replace raw TMDB/IMDb ID anchor text with View on TMDB / View on IMDB"
    status: pending
  - id: fvp-watchlist-card
    content: "Add useWatchlistCount hook and watchlist overview card on home dashboard"
    status: pending
  - id: fvp-history-button
    content: "Restyle View history button to default mint fill (remove outline variant)"
    status: pending
  - id: fvp-tests
    content: "Add/update unit tests and optional E2E assertions for all five changes"
    status: pending
  - id: fvp-verify
    content: "Run frontend tsc, unit tests, and build; manual smoke on affected routes"
    status: pending
isProject: false
---

# Frontend Visual Polish and Home Page Watchlist Card — Implementation Plan

## Context

This plan addresses GitHub issue **\[bug/ux] Frontend Visual Polish and Home Page Watchlist Card Addition**. All changes are confined to the Next.js frontend; no API contract, database, or backend modifications are required.

The work restores consistency with the Modern Neo-Noir Cinema design system ([DESIGN.md](./DESIGN.md)) and improves home-dashboard discoverability of the watchlist.

---

## Affected Files (summary)

| Area | Primary file(s) | Supporting file(s) |
|------|-----------------|-------------------|
| Review nav font | `frontend/src/components/app-shell.tsx` | `frontend/src/components/app-shell.test.tsx` |
| Backdrop alignment | `frontend/src/components/film-detail-view.tsx` | — |
| Metadata link text | `frontend/src/components/film-detail-view.tsx` | — |
| Watchlist overview card | `frontend/src/app/page.tsx` | `frontend/src/hooks/use-films.ts`, `frontend/src/hooks/use-films.test.tsx` |
| View History button | `frontend/src/app/page.tsx` | — |

---

## 1. Navigation Font Fix (Review item)

### Problem

The conditional **Review** nav link in `app-shell.tsx` is styled separately from the standard `NAV_ITEMS` loop. When active, it applies `bg-accent shadow-glow` but omits `text-foreground`, which standard items receive. This can cause the label to inherit a different foreground color and appear visually inconsistent with Home, Watchlist, Recommend, etc.

### Current code

```52:69:frontend/src/components/app-shell.tsx
            {reviewCount > 0 && (
              <Link
                href="/review"
                className={cn(
                  "flex items-center gap-2 rounded px-3 py-2 text-label-md normal-case tracking-normal transition-all hover-glow",
                  pathname.startsWith("/review")
                    ? "bg-accent shadow-glow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
```

Standard nav items use:

```41:44:frontend/src/components/app-shell.tsx
                    "flex items-center gap-1.5 rounded px-3 py-2 text-label-md normal-case tracking-normal transition-all hover-glow",
                    active
                      ? "bg-accent text-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground",
```

Both already share the `text-label-md normal-case tracking-normal` base (Space Mono via `font-mono` in `globals.css`). The fix is to make the active/inactive branch identical.

### Steps

1. **Extract shared nav link base classes** into a constant (e.g. `NAV_LINK_BASE`) to avoid future drift between `NAV_ITEMS` and the Review link. Base classes: `"flex items-center gap-1.5 rounded px-3 py-2 text-label-md normal-case tracking-normal transition-all hover-glow"`.
2. **Extract active/inactive class helpers** or inline the same ternary both places:
   - Active: `"bg-accent text-foreground shadow-glow"`
   - Inactive: `"text-muted-foreground hover:text-foreground"`
3. **Apply to Review link**, keeping its `gap-2` only if needed for the count badge (minor; `gap-1.5` is acceptable and closer to standard nav).
4. **Ensure the Review label `<span>`** does not add font overrides; it should inherit `text-label-md` from the parent `Link`.
5. **Do not change** the `Badge` variant or the `Icon` fill logic.

### Verification

- With `reviewCount > 0`, navigate to `/review` and confirm Review label uses Space Mono at 14px semibold, matching other active nav items.
- Toggle between `/review` and `/watchlist`; active state typography should be indistinguishable from other nav entries.
- Extend `app-shell.test.tsx` to assert the Review link carries `text-foreground` (or the shared active class string) when pathname is `/review`.

---

## 2. Film Detail Backdrop Image Alignment

### Problem

The hero backdrop on `/watchlist/[filmId]` uses Next.js `Image` with `fill` and `object-cover`. Default `object-position` is `center`, which vertically centers cinematic backdrops and can crop important top framing (titles, faces, horizon lines).

### Current code

```71:77:frontend/src/components/film-detail-view.tsx
              <Image
                src={backdropUrl}
                alt=""
                fill
                priority
                className="object-cover"
              />
```

### Steps

1. Add **`object-top`** alongside `object-cover` on the backdrop `Image`:
   ```tsx
   className="object-cover object-top"
   ```
2. **Do not change** container height (`h-56 md:h-72`), gradient overlay, or poster overlay layout unless visual QA shows the gradient still reads well (it should; gradient is bottom-weighted).
3. **No `next.config.ts` changes** required — only CSS positioning.

### Verification

- Open a film detail page with a `backdrop_url` (TMDB widescreen image).
- Confirm the top portion of the image is visible; bottom may crop instead of center.
- Fallback path (no backdrop) should remain unchanged (`bg-surface-container-high`).

---

## 3. Metadata Link Text Optimization

### Problem

In the **Metadata** card, TMDB and IMDb outbound links display raw database IDs (`12345`, `tt1234567`) as click text. The **Overview** card already uses human-readable copy for Letterboxd (`View on Letterboxd`).

### Current code

```188:214:frontend/src/components/film-detail-view.tsx
                {metadata.tmdb_id !== null && (
                  ...
                      <a ...>
                        {metadata.tmdb_id}
                      </a>
                ...
                {metadata.imdb_id && (
                  ...
                      <a ...>
                        {metadata.imdb_id}
                      </a>
```

Letterboxd pattern (target):

```115:122:frontend/src/components/film-detail-view.tsx
                <a
                  href={film.letterboxd_uri}
                  ...
                >
                  View on Letterboxd
                </a>
```

### Steps

1. Replace TMDB anchor children with the literal string **`View on TMDB`**.
2. Replace IMDb anchor children with **`View on IMDB`** (per issue spec; keep the `<dt>` label as `IMDb` for consistency with existing copy).
3. **Preserve** `href` templates, `target="_blank"`, `rel="noreferrer"`, and `className="text-primary hover:underline"`.
4. **Optional:** add a `film-detail-view.test.tsx` smoke test rendering a film fixture and asserting link accessible names.

### Verification

- Film with both IDs shows "View on TMDB" and "View on IMDB" links; hrefs still resolve correctly.
- Ratings row (`TMDB: 7.5`) is unchanged — only the external ID links are affected.

---

## 4. Home Dashboard Watchlist Overview Card

### Problem

The home page (`/`) shows **New recommendation** and **History** cards when a watchlist exists, but no summary of the watchlist itself. Users must use header nav to reach `/watchlist`.

### Current home layout

```89:118:frontend/src/app/page.tsx
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="hover-glow">… New recommendation …</Card>
        <Card className="hover-glow">… History (outline button) …</Card>
      </div>
```

The watchlist table page already displays a total count via pagination:

```147:149:frontend/src/app/watchlist/watchlist-page-content.tsx
          {data
            ? `${data.pagination.total} film${data.pagination.total === 1 ? "" : "s"} on your watchlist`
            : "Browse films and enrichment data from your Letterboxd watchlist."}
```

It fetches with `on_watchlist: true` to exclude inactive entries.

### Steps

#### 4a. Add `useWatchlistCount` hook

In `frontend/src/hooks/use-films.ts`, add a hook mirroring `usePendingReviewCount`:

```ts
export function useWatchlistCount() {
  return useQuery({
    queryKey: ["films", "watchlist", "count"],
    queryFn: () => getFilms({ on_watchlist: true, limit: 1 }),
    select: (data) => data.pagination.total,
  });
}
```

- Uses `limit: 1` for a lightweight count-only fetch (same pattern as `useHasWatchlist` / `usePendingReviewCount`).
- **`on_watchlist: true`** ensures the count matches the `/watchlist` grid semantics.

#### 4b. Wire hook on home page

In `frontend/src/app/page.tsx`, inside the `hasWatchlist` branch:

```ts
const { data: watchlistCount = 0 } = useWatchlistCount();
```

Only call when `hasWatchlist` is true (hook can use `enabled: hasWatchlist` if passed as option, or rely on the branch guard — prefer `enabled` to avoid unnecessary fetches on the empty state).

#### 4c. Add overview card UI

Insert a new `Card` with `hover-glow` in the dashboard. Suggested placement: **first card in the grid** (before New recommendation / History), or a full-width card above the 2-column grid.

**Recommended structure** (matches existing card patterns):

| Element | Content |
|---------|---------|
| `CardTitle` | `Watchlist` |
| `CardDescription` | Short line, e.g. "Films imported from Letterboxd ready to browse." |
| Metric | Prominent count — e.g. `<p className="text-h2 font-mono">` or reuse `text-body-md` with bold count: **`{watchlistCount} films`** (pluralize: `film` vs `films`) |
| `Button` | Default mint, `asChild`, `className="w-full"`, link to `/watchlist` — label **`View watchlist`** or **`Browse watchlist`** |

**Layout options** (pick one during implementation):

- **Option A (simplest):** Change grid to `sm:grid-cols-2` with three cards; third wraps on its own row on desktop, or use `sm:grid-cols-3` when review banner is absent.
- **Option B (recommended):** Full-width watchlist card above the existing 2-column grid — clearest hierarchy for the new "overview metric" requirement.

Do **not** show this card on the empty-state (`!hasWatchlist`) branch.

#### 4d. Loading / error behavior

- While `watchlistCount` is loading, show a skeleton count or `—` in the metric; home page already blocks on `useHasWatchlist` loading, so the count query can load in parallel afterward.
- On count fetch error, omit the metric or show `—`; do not block the rest of the dashboard (match lenient patterns elsewhere).

### Verification

- Home with watchlist shows card with live count matching `/watchlist` header subtitle.
- Button navigates to `/watchlist`.
- Count updates after import/sync (React Query invalidation on existing `["films"]` keys should propagate if films are mutated elsewhere; if not, document that a manual refresh may be needed — no new invalidation logic required unless QA finds stale counts).

---

## 5. Home Button Style Alignment (View History)

### Problem

**View history** uses `variant="outline"` while **Start questionnaire** and **Review matches** use the default mint fill — breaking CTA consistency.

### Current code

```112:115:frontend/src/app/page.tsx
            <Button asChild variant="outline" className="w-full">
              <Link href="/history">View history</Link>
            </Button>
```

Default mint button (`frontend/src/components/ui/button.tsx`):

```tsx
"btn-chamfer bg-primary text-primary-foreground hover-glow active-flicker hover:bg-primary/90"
```

### Steps

1. Remove `variant="outline"` from the History card button (defaults to mint).
2. Keep `asChild` and `className="w-full"`.
3. **Do not change** the New recommendation or Review matches buttons.

### Verification

- Side-by-side visual check: History, New recommendation, and Review matches buttons share mint fill, chamfered corners, and hover glow.
- Outline variant remains available for secondary actions elsewhere; only this instance changes.

---

## 6. Testing Plan

| Change | Test type | File / approach |
|--------|-----------|-----------------|
| Review nav classes | Unit | Extend `frontend/src/components/app-shell.test.tsx` — mock `/review` pathname + `reviewCount > 0`, assert Review link has active classes including `text-foreground` |
| `useWatchlistCount` | Unit | Add case to `frontend/src/hooks/use-films.test.tsx` — mock `getFilms({ on_watchlist: true, limit: 1 })`, assert `select` returns `pagination.total` |
| Metadata link text | Unit (optional) | New `frontend/src/components/film-detail-view.test.tsx` with minimal `FilmDetail` fixture |
| Backdrop `object-top` | Unit (optional) | Assert `Image` className in film-detail-view test |
| Home watchlist card | Unit (optional) | Render home with mocked hooks; assert "View watchlist" link and count |
| E2E smoke | Playwright (optional) | Extend `e2e/design-smoke.spec.ts` or `e2e/all-routes.spec.ts` if stack is up |

**Regression commands** (from [AGENTS.md](../AGENTS.md)):

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run test:unit
cd frontend && npm run build
```

No new gate script is required; changes should pass existing Phase 6.5 design token checks.

---

## 7. Manual QA Checklist

1. **Nav:** Pending reviews visible → Review link matches other nav typography in default and active states.
2. **Film detail:** Backdrop anchors to top; poster/title overlay still readable.
3. **Film detail:** TMDB/IMDb links show friendly labels; open in new tab correctly.
4. **Home (with watchlist):** Watchlist card shows correct count; CTA opens `/watchlist`.
5. **Home:** View history button is mint-filled, consistent with Start questionnaire.
6. **Home (no watchlist):** Empty state unchanged — no watchlist card.
7. **Responsive:** Cards and nav readable at mobile (`sm`) breakpoints.

---

## 8. Implementation Order

Execute in this order to minimize merge conflicts and enable incremental verification:

1. **Review nav font** — isolated one-line class fix in `app-shell.tsx`
2. **Backdrop alignment** — single class in `film-detail-view.tsx`
3. **Metadata links** — same file, adjacent edit
4. **`useWatchlistCount` hook** — new hook + unit test
5. **Home page** — watchlist card + View history button (same file)
6. **Tests** — fill gaps from §6
7. **Run verification** — tsc, unit tests, build, manual QA

Estimated scope: **~6 files touched**, **~80–120 lines** including tests. No migrations, env vars, or Docker changes.

---

## 9. Out of Scope

- Backend pagination or new `/films/count` endpoint
- Watchlist card on empty-state home
- ESLint setup (`npm run lint` still prompts for config)
- Design token or typography token changes in `globals.css` / `DESIGN.md`
- Header nav restructuring (e.g. promoting Review into `NAV_ITEMS`)

---

## 10. Document Index

After implementation, optionally add a one-line entry to [roadmap.md](./roadmap.md) Document Index pointing to this plan. Not required for the bug fix itself.
