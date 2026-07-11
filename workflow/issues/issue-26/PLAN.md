# Implementation plan — issue #26: Frontend Visual Polish and Home Watchlist Card

## Overview

Five small, frontend-only UX fixes on the home dashboard and film detail pages. No API or schema changes. Work is grounded in live reproduction (`demo/bug-repro-notes.md`) and static code review: four defects confirmed in the running stack; the watchlist overview card is a missing feature to add.

Approach: surgical class/string changes in three components, one new React Query hook mirroring `usePendingReviewCount`, a home-page card block, and targeted unit tests. Phase 6 gate (`verify-phase6-gates.sh`) covers regression; optional E2E assertion for the new home card.

## Reproduction findings

| # | Issue | Reproduced | Evidence |
|---|-------|------------|----------|
| 1 | Review nav active typography | Yes (mocked review count) | `bug-repro-review-nav-active.png` |
| 2 | Backdrop top crop | Yes | `bug-repro-film-detail.png` |
| 3 | TMDB/IMDb link labels | Yes | `bug-repro-metadata-links.png` |
| 4 | Home watchlist overview | Yes (absent) | `bug-repro-home-dashboard.png` |
| 5 | View history outline button | Yes | `bug-repro-home-dashboard.png` |

Full narrative: [demo/bug-repro-notes.md](demo/bug-repro-notes.md).

## Root cause

| Item | Root cause |
|------|------------|
| Review nav | Active branch in `app-shell.tsx` omits `text-foreground` |
| Backdrop | `object-cover` without `object-top` on hero `Image` |
| TMDB/IMDb links | Anchor text set to raw IDs instead of action labels |
| Watchlist card | Not implemented; count API already exists |
| History button | Explicit `variant="outline"` on History CTA |

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `frontend/src/components/app-shell.tsx` | Edit | Add `text-foreground` to active Review nav classes |
| `frontend/src/components/film-detail-view.tsx` | Edit | `object-top` on backdrop; label strings for TMDB/IMDb links |
| `frontend/src/app/page.tsx` | Edit | Watchlist overview card; remove `variant="outline"` on History |
| `frontend/src/hooks/use-films.ts` | Add hook | `useWatchlistCount` via `getFilms({ on_watchlist: true, limit: 1 })` |
| `frontend/src/components/app-shell.test.tsx` | Extend | Assert Review active link includes `text-foreground` |
| `frontend/src/hooks/use-films.test.tsx` | Extend | Test `useWatchlistCount` query key and `on_watchlist` param |
| `frontend/e2e/watchlist-add.spec.ts` | Optional extend | Assert watchlist overview card on mocked home |

## Implementation steps

### Step 1: Review nav active state (`app-shell.tsx`)

Change active Review class from:

```ts
? "bg-accent shadow-glow"
```

to:

```ts
? "bg-accent text-foreground shadow-glow"
```

Match standard `NAV_ITEMS` active mapping exactly.

### Step 2: Film detail polish (`film-detail-view.tsx`)

1. Backdrop `Image`: `className="object-cover object-top"`.
2. TMDB link child: `View on TMDB` (href unchanged).
3. IMDb link child: `View on IMDB` (href unchanged; spec uses "IMDB" capitalization).

### Step 3: `useWatchlistCount` hook (`use-films.ts`)

```ts
export function useWatchlistCount() {
  return useQuery({
    queryKey: ["films", "watchlist-count"],
    queryFn: () => getFilms({ on_watchlist: true, limit: 1 }),
    select: (data) => data.pagination.total,
  });
}
```

Existing `useAddToWatchlist` and import/sync hooks already invalidate `["films"]`, which prefixes-match this key — no invalidation changes required unless audit finds a gap.

### Step 4: Home page (`page.tsx`)

1. Import and call `useWatchlistCount()` in returning-user branch.
2. Insert full-width `Card` **above** the `sm:grid-cols-3` grid (below page heading):
   - Title: **Your watchlist**
   - Description: `{count} film on your watchlist` / `{count} films on your watchlist` (singular/plural)
   - CTA: default `Button` → `/watchlist` labeled **View watchlist**
3. Handle loading: skeleton or omit count until resolved (match existing home loading patterns — prefer showing card with loading text or defer card until count known; keep simple).
4. Remove `variant="outline"` from History card button (line 128).

Layout: `max-w-2xl` container unchanged; new card uses same `Card` / `hover-glow` patterns as peers.

### Step 5: Unit tests

**`app-shell.test.tsx`**
- Add test: when `usePathname` is `/review` and `reviewCount > 0`, Review link has class containing `text-foreground` (and active peers for contrast).

**`use-films.test.tsx`**
- Mock `getFilms` returning `{ pagination: { total: 12 } }`.
- Assert `useWatchlistCount` calls `getFilms({ on_watchlist: true, limit: 1 })` and selects `12`.

**Optional `film-detail-view` test** — only if a small test file exists or assertions fit an existing pattern; not required if E2E/demo covers link text (keep scope minimal).

### Step 6: Optional E2E (`watchlist-add.spec.ts`)

In `home shows add film CTA...` test, extend mocked `films?limit=1` route or add `on_watchlist=true` handler returning `pagination.total: 12`. Assert:
- Heading or text **Your watchlist**
- Link **View watchlist** → `/watchlist`

## Tests required

| Acceptance criterion | Test |
|---------------------|------|
| Review nav font on active `/review` | `app-shell.test.tsx` — active Review link classes |
| Backdrop top alignment | Manual/demo screenshot; optional DOM class assertion if component test added |
| TMDB/IMDb link text | Demo scenario 2; optional component test for link accessible names |
| Home watchlist overview card | `use-films.test.tsx` hook; demo scenario 3; optional E2E |
| View history mint button | Demo scenario 4; optional Playwright `toHaveClass` / visual compare |

**Regression commands (execute):**

```bash
cd frontend && npm run test:unit
cd frontend && npx tsc --noEmit
bash scripts/verify-phase6-gates.sh   # primary gate — frontend MVP + backend regression
```

If design-token-sensitive changes creep in, also run `bash scripts/verify-phase6.5-gates.sh`. No API gate needed.

## Gate script

**Primary:** `bash scripts/verify-phase6-gates.sh`

Before host `npm run build` if compose frontend is running:

```bash
docker compose stop frontend && sudo rm -rf frontend/.next
```

## Documentation updates

None required. Spec and DESIGN.md already document tokens; no README changes.

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Extra `GET /films` on home load | `limit: 1` + React Query cache; same pattern as `useHasWatchlist` |
| `object-top` on short/wide backdrops | Acceptable trade-off per spec; only affects hero |
| Singular/plural copy edge case (`0` films) | Card only renders when `hasWatchlist`; count should be ≥ 1 |
| E2E mock routes miss `on_watchlist` query | Extend existing home E2E mocks explicitly |

Rollback: revert the five frontend files; no migrations.

## Definition of done

- [ ] All five acceptance criteria in SPEC.md satisfied
- [ ] `useWatchlistCount` implemented and tested
- [ ] `app-shell.test.tsx` covers Review active `text-foreground`
- [ ] `npm run test:unit` and `npx tsc --noEmit` pass
- [ ] `bash scripts/verify-phase6-gates.sh` passes
- [ ] Demo scenarios in `demo/demo-spec.md` capturable on fixed build
- [ ] No API, schema, or config changes
- [ ] Draft PR #101 receives commits on `cursor/issue-26-frontend-visual-polish-cdf5`
