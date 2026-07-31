# Issue #160: Mobile UI follow-up — surface clarity (posters, status labels, Home/History)

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/160

**Integration base:** `feature/mobile-ui` (not `main`). Draft PR must target `feature/mobile-ui`.

## Summary

Close returning-user **surface clarity / trust** gaps from phone review of `feature/mobile-ui`: unify missing-poster fallback (no broken-image UI), replace film-detail system jargon with user-facing status presentation, trim Home hub copy and **remove System status** entirely, and move History date/status filters behind a **Filter** control so results appear higher in the first viewport. Preserve Neo-Noir and poster+title-only watchlist cells.

## Problem

Returning-user screens on `feature/mobile-ui` are structurally correct, but phone review ([`documents/ui-mobile-evaluation.md`](../../../documents/ui-mobile-evaluation.md) on the evaluation branch; findings mirrored in #160) found clarity and trust gaps:

| Gap | Evidence |
|-----|----------|
| **Inconsistent missing posters** | Null `src` shows explicit **NO POSTER** via [`FilmPoster`](../../../frontend/src/components/film-poster.tsx), but failed / bad URLs still render raw `next/image` broken-image + alt. Ceremony stages ([`ceremony-stage-winner.tsx`](../../../frontend/src/components/ceremony/ceremony-stage-winner.tsx), runners-up, record) duplicate null fallbacks with raw `Image` and no `onError` |
| **Film detail jargon** | Side-by-side enrichment **Ready** badge + raw lifecycle **`active`** badge — system language ([`film-detail-view.tsx`](../../../frontend/src/components/film-detail-view.tsx)) |
| **Home copy + System status** | Returning hub already has one supporting sentence + picker helper, but **System status** accordion (`HealthPanel`) still sits under CTAs on both empty and returning Home ([`page.tsx`](../../../frontend/src/app/page.tsx)) and competes with the nightly hub |
| **History filter stack** | Search + date-from + date-to + status select all permanent above results ([`history/page.tsx`](../../../frontend/src/app/history/page.tsx)) — eats first viewport on phone |

Sibling follow-ups (#159 ceremony, #161 thumb ergonomics, #158 shell/More hub) do not own these surfaces; stay out of ceremony sticky/reasons, More hub contents, and Dev Mode redesign.

## Acceptance criteria

- [ ] **Shared missing-poster fallback:** Watchlist grid, library picker, ceremony stages (winner / runners-up / record), history cards, film detail, and review cards use one shared poster component (harden [`FilmPoster`](../../../frontend/src/components/film-poster.tsx) or equivalent). Null **and** load-error posters show a consistent Cuebox placeholder — **no** browser broken-image icon UI.
- [ ] **Film detail status is user-facing:** Enrichment enum badges (**Ready** / **Failed** / etc.) are **not** shown on the normal film-detail surface. Lifecycle state uses plain language (see [Film detail status](#film-detail-status)). Lifecycle **actions** (Mark watched, Archive, Complete review, etc.) remain clear and unchanged in capability.
- [ ] **Home copy trim:** Returning-user Home keeps **one** supporting sentence under the H1 plus the picker `helperText` — no second search essay / duplicate explanatory paragraph. Empty-watchlist welcome copy may stay distinct (first-run).
- [ ] **System status removed from Home:** No System status accordion (or equivalent health panel) on empty or returning Home. Do **not** relocate it to More in this issue.
- [ ] **History Filter disclosure:** Date range + watch-status filters live behind a **Filter** control (progressive disclosure, watchlist-like). Results appear higher in the first viewport. Compact title **search** may remain always visible.
- [ ] **Design constraints:** Neo-Noir tokens preserved; watchlist grid remains **poster + title only** (no metadata creeping back onto cells).
- [ ] **Tests:** Cover poster fallback (null + error path) / shared usage on listed surfaces; Home has no “System status”; History filter disclosure (closed by default → open sheet/panel → apply/clear; results chrome above the fold when filters closed).

## Scope

### In scope

- Harden / unify `FilmPoster` (null + `onError` fallback) and migrate ceremony / any remaining raw poster `Image` call sites on the listed surfaces to it.
- Film detail status labeling: hide enrichment badges on non-dev detail; user-facing lifecycle label; soften enrichment toasts on the film page if they still say “Enrichment …”.
- Home: remove `HealthPanel` / System status from both empty and returning paths; confirm returning copy is one supporting sentence + picker helper (trim if any residual duplicate essay remains).
- History list: Filter control + sheet/panel for date_from / date_to / watch_status; keep existing API query params; optional compact always-visible search.
- Unit / component tests (and light page tests) for the above.

### Out of scope

- Moving System status to More (or any new health destination) — **remove only** from Home.
- New history filter dimensions or API query params beyond existing search / date_from / date_to / watch_status.
- Ceremony short reasons / sticky Next / stage-3 CTA hierarchy (#159).
- More hub / safe-area header / active tab (#158).
- Thumb targets / questionnaire sticky inset / keyboard (#161) except incidental if shared components are touched.
- Developer Mode redesign or mobile Dev Mode affordance.
- Watchlist cell metadata; changing watchlist filter dimensions.
- Backend / API / DB / sync / enrichment pipeline changes.

## User flows / API changes

### Missing poster

1. Film with `poster_url: null` → shared Cuebox placeholder (no broken `<img>`).
2. Film with non-null URL that fails to load → same placeholder (via `onError` / failed-state), not browser broken-image chrome.
3. Surfaces: watchlist grid, Home/library picker rows, ceremony winner / runners-up / record posters, history list cards, film detail hero, review match cards (and peer review list posters).

### Film detail status

1. User opens `/watchlist/[id]` as a normal user.
2. Sees title/year, poster (or placeholder), and a **user-facing lifecycle** label — not raw `active` / `pending_watch_review`.
3. Does **not** see enrichment badges such as **Ready**, **Pending**, **Failed**.
4. While `enrichment_status === "enriching"`, may see a short non-badge hint such as “Updating metadata…” (already present) — keep user language.
5. Lifecycle actions remain available and labeled as today (Mark watched, Archive, etc.).
6. Optional: completion/failure toasts on the film page use user language (“Film details updated” / “Couldn’t update film details”) instead of “Enrichment complete/failed”.

### Home

1. Returning user on `/` sees H1, one supporting sentence, picker (+ helper), Create a recommendation, History — **no** System status control.
2. Empty watchlist Home likewise has **no** System status.
3. Health / provider debug remains available via API docs / existing non-Home paths if any; this issue does not add a replacement UI.

### History Filter

1. User opens `/history`.
2. First viewport prioritizes header + compact search (if kept) + **Filter** control + result cards (or empty/loading) — not a permanent stack of two date inputs + status select.
3. Tap **Filter** → sheet/panel with date from, date to, and watch status (same options: All / Watched / Unwatched).
4. Apply / Clear updates the existing list query; Filter control can show an active affordance when non-default filters are set (mirror watchlist Filter button behavior).
5. Search behavior and pagination unchanged aside from layout.

### API changes

None. Frontend-only. Existing `enrichment_status` / `status` fields and history list query params are sufficient.

## Locked design decisions

### Poster fallback

| Decision | Value |
|----------|-------|
| Component | Harden existing `FilmPoster` (preferred over a second parallel component) |
| Null `src` | Cuebox placeholder (may keep or refine the current “NO POSTER” treatment; must be intentional UI, not empty/broken) |
| Load failure | Same placeholder via `onError` (client failed state) — never leave broken-image chrome |
| Ceremony | Replace raw `next/image` + local “NO POSTER” branches with `FilmPoster` |
| Watchlist cells | Continue poster + title only; placeholder must not add metadata text beyond the shared fallback |

Placeholder copy/visual may stay “NO POSTER” or become a quieter silhouette / “No poster” label — plan picks one consistent treatment; do not invent decorative collage cards.

### Film detail status

| Decision | Value |
|----------|-------|
| Enrichment badge on detail | **Hide** on normal (non-dev) film detail |
| Enriching hint | Keep short user copy (“Updating metadata…”) when enriching |
| Lifecycle badge labels | Map enums → user language (locked below) |
| Dev Mode | No redesign; do not require surfacing enrichment on detail for this issue |

**Lifecycle label map (display only):**

| `status` | User-facing label |
|----------|-------------------|
| `active` | On watchlist |
| `pending_watch_review` | Needs watch review |
| `watched` | Watched |
| `archived` | Archived |

Action button labels stay as today. Do not change watchlist tab names in this issue.

### Home copy + System status

| Decision | Value |
|----------|-------|
| Returning supporting copy | Keep a **single** sentence under the H1 (current “Find a film in your library…” is fine if still accurate after shell merges) |
| Picker helper | Keep one `helperText` line on `LibrarySearchPicker` |
| System status | **Delete** from Home (empty + returning); remove `HealthPanel` and health query if unused elsewhere on the page |
| More hub | Do **not** add System status there in this issue |

### History Filter pattern

| Decision | Value |
|----------|-------|
| Disclosure | Bottom sheet (or equivalent) opened by a **Filter** button — match watchlist progressive disclosure, not a permanent inline stack |
| Always visible | Compact title search **may** remain outside the sheet |
| Inside Filter | `date_from`, `date_to`, `watch_status` only |
| Defaults | Empty dates + `all` status; Clear resets to defaults |
| Active indicator | Filter control indicates when non-default filters applied (badge / filled style / aria — mirror watchlist) |

Reuse shared Sheet UI primitives where practical (`WatchlistFilterSheet` is enrichment/sort-specific — prefer a small History-specific sheet rather than overloading watchlist filters).

## Data and integration notes

- **No** DB, API, sync, embedding, or enrichment pipeline changes.
- Frontend files likely touched: `film-poster.tsx` (+ tests), ceremony stage poster call sites, `film-detail-view.tsx` (+ tests), `app/page.tsx` (+ `page.test.tsx`), `history/page.tsx` (+ `page.test.tsx`), optional new `history-filter-sheet` component, review cards only if not already on `FilmPoster`.
- `formatEnrichmentStatus` may remain for watchlist Filter sheet / internal use — film detail simply stops displaying it.
- **PR base:** `feature/mobile-ui`. Workflow handoff’s default `--base main` must not be used for this issue’s draft PR; create/retarget to `feature/mobile-ui` (same as #158 / #159 / #161).

## Open questions

_(none — product decisions locked above for planning)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/160
- Evaluation source: `documents/ui-mobile-evaluation.md` (evaluation branch / issue body)
- Related follow-ups: #159 (ceremony), #161 (thumb ergonomics), #158 (shell / More hub)
- Poster today: [`frontend/src/components/film-poster.tsx`](../../../frontend/src/components/film-poster.tsx)
- Film detail: [`frontend/src/components/film-detail-view.tsx`](../../../frontend/src/components/film-detail-view.tsx)
- Home: [`frontend/src/app/page.tsx`](../../../frontend/src/app/page.tsx)
- History: [`frontend/src/app/history/page.tsx`](../../../frontend/src/app/history/page.tsx)
- Watchlist Filter precedent: [`frontend/src/components/watchlist-filter-sheet.tsx`](../../../frontend/src/components/watchlist-filter-sheet.tsx)
- Design system: [`documents/DESIGN.md`](../../../documents/DESIGN.md)
