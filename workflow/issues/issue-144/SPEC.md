# Issue #144: Mobile UI — film detail (poster-led)

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/144

**Integration base:** `feature/mobile-ui` (not `main`). Slice (a) / #141 is merged there; #142 Home hub is also on that tip. This branch is cut from `feature/mobile-ui` so film detail renders inside the new `AppShell`. Draft PR **must** target `feature/mobile-ui` (retarget if the handoff Action defaults to `main`). Prefer visual consistency with #143 (watchlist poster grid, PR #151) once that lands — rebase onto `feature/mobile-ui` after #151 merges if needed; do not block this slice on #143 merge.

## Summary

Reskin film detail (`FilmDetailView` on `/watchlist/[filmId]`) into a **poster-led** phone screen: dominant poster treatment, scannable metadata **below** (not a competing card-stack / chrome overlay), status actions consistent with watchlist ⋯ rules (#115 / #143), reachable where-to-watch and external links, and graceful degradation for enrichment-not-ready / missing poster / missing scores. This is **slice (d)** of the mobile UI pass ([product brief](../../../documents/ui-mobile-product-brief.md)).

Hard constraints: brief **D1**, **D6/D7** (poster-led metaphor continuity), **D8**, **D10-C/F**. Tighten Neo-Noir for mobile; do not rebrand. No new APIs or metadata fields.

## Problem

Film detail today is a **backdrop banner with a small poster overlay**, title/actions crammed into the banner chrome, then a **stack of Cards** (Overview, Watch history, Metadata, Semantic profile) plus `WhereToWatchSection`. On a phone that reads as a dashboard of peer cards and competing chrome — not a poster-forward library detail consistent with the watchlist metaphor (D6) and nightly scan job (D7).

Status actions already exist via `FilmStatusActions` (`variant="detail"`) and back navigation already restores the watchlist tab via `?tab=` / status-derived fallback. Those behaviors must stay; the layout and hierarchy must change.

## Acceptance criteria

- [ ] Film detail is **poster-led**: the poster is the dominant visual on the first viewport (large poster plane — not a small inset beside title chrome over a backdrop hero). Metadata, scores, synopsis, and secondary sections sit **below / around** the poster — not competing as equal card chrome in the hero
- [ ] **Status actions** remain available and consistent with watchlist ⋯ / #115 rules: mark watched / complete review / archive / restore (return to watchlist / re-enable) as applicable for `film.status`; reuse `FilmStatusActions` (detail variant or shared action set — no second status machine)
- [ ] Primary action hit targets ~**≥44×44px**; **no essential hover-only** actions (criterion **C**)
- [ ] **Where-to-watch** (`WhereToWatchSection`) remains reachable and usable on phone — keep existing providers UI; polish density/spacing only (no new provider APIs)
- [ ] **External links** remain clear and tappable: Letterboxd (`film.letterboxd_uri`), TMDB, IMDb when IDs exist
- [ ] **Degrade gracefully**:
  - Enrichment not ready / enriching / failed — show status clearly; omit or stub missing metadata/semantic blocks without empty card shells that look broken
  - Missing poster — existing `FilmPoster` “NO POSTER” (or equivalent) placeholder
  - Missing scores (TMDB / RT / LBX / watch diary nulls) — omit rows or show em dash consistently (preserve null-score behavior covered by existing tests)
- [ ] **Back navigation** returns to the appropriate watchlist tab when entered from watchlist: honor `watchlistTab` / `?tab=` from the page; fall back from `film.status` as today (`active` → `/watchlist`, `watched`/`pending_watch_review` → `?tab=watched`, `archived` → `?tab=archived`)
- [ ] Neo-Noir tokens / typography / icon language preserved (`documents/DESIGN.md`, `tokens.css`); mobile content margins **16px**
- [ ] Any new motion honors `prefers-reduced-motion` (brief **D8**)
- [ ] **Tests** updated for layout / actions regressions on `film-detail-view` (extend `film-detail-view.null-score.test.tsx` and/or add focused unit coverage for poster-led structure, status actions presence, back link `href`, external links, enrichment-empty path). Playwright smoke optional if existing route coverage already hits `/watchlist/[filmId]` — update selectors if markup changes

## Scope

### In scope

| Area | Change |
|------|--------|
| `frontend/src/components/film-detail-view.tsx` | Poster-led composition; reduce card-stack / backdrop-hero competition; density polish |
| `frontend/src/app/watchlist/[filmId]/page.tsx` | Only if wiring/props for tab back-nav or loading skeleton need alignment with the new layout |
| Status actions | Keep `FilmStatusActions` + `WatchReviewDialog` / `EditFilmMatchDialog` flows |
| Where-to-watch | Density/spacing polish of existing `WhereToWatchSection` usage |
| External links | Letterboxd / TMDB / IMDb remain visible and clear (may regroup out of buried Metadata card) |
| Loading / empty | Prefer poster-shaped skeleton over generic card-grid skeleton if touching the page loader |
| Tests | Update/add unit coverage for `FilmDetailView` layout + actions regressions |
| Docs | Optional one-line film-detail note in `DESIGN.md` only if a layout rule needs documenting |

### Out of scope

- Watchlist poster grid / filter sheet (slice c — #143 / PR #151) — do not edit grid components here; align visual language only
- Recommendation ceremony 1→2→3 (slice e — #145)
- Home hub / app shell (slices a–b — already on `feature/mobile-ui`)
- Questionnaire density / first-run (slice f — #146)
- New metadata fields, watch-provider APIs, or status-machine rule changes (#115)
- Developer Mode panel redesign
- PWA, Insights/Ask, rebrand / new token palette (D1)
- API, DB, Alembic, `config.yaml`

## User flows / API changes

### Open from watchlist grid / search

1. User taps a film from Watchlist (or opens `/watchlist/{id}` / `?tab=` / from search “View”) → film detail inside #141 `AppShell`.
2. First viewport: **dominant poster** + title/year + compact status/enrichment cues + status actions (thumb-reachable).
3. Scroll: synopsis / key metadata → where-to-watch → watch history (if any) → scores / tags / semantic profile as available → external links clear somewhere in the scannable stack (not only buried in a late Metadata card).
4. Tap **← Watchlist** (or equivalent back control) → correct tab via `backHref` rules above.
5. Status transitions behave as today (mark watched → pending + review dialog; archive confirm if already wired via actions; restore → `active`).

### Composition rules (locked)

| Element | Role |
|---------|------|
| Poster | Dominant first-viewport visual; larger than today’s `size="md"` inset-on-backdrop pattern |
| Backdrop | Optional atmospheric secondary only — must **not** outrank the poster or force title/actions into a cramped overlay; acceptable to drop full-bleed backdrop hero on phone if it fights poster-led hierarchy |
| Title / year / status | Adjacent to or immediately under poster; not a separate peer card |
| Status actions | Always available when handlers are passed; ≥44px; same #115 labels/rules as watchlist |
| Metadata / synopsis / scores / semantic | Below poster in a single vertical scan — prefer section hierarchy over stacked equal `Card` peers when that reads as a dashboard |
| Where-to-watch | Reachable without hunting; phone density OK |
| External links | Letterboxd / TMDB / IMDb clearly labeled when present |
| Cards | Allowed as interaction/section containers only when they aid scanning; hero must not be a card collage |

### Desktop (`md`+)

Same poster-led metaphor. May use a wider two-column arrangement (poster column + metadata column) **without** regressing to backdrop-overlay chrome or a dense card dashboard as the default.

### API changes

**None.** Reuse:

- `GET /api/v1/films/{id}`
- `POST /api/v1/films/{id}/status`
- Watch-review endpoints already used by dialogs
- Existing watch-provider endpoints via `WhereToWatchSection`

## Data and integration notes

- Frontend-only UI composition on existing film detail + watch-provider endpoints.
- Entry points that must keep working: `/watchlist/[filmId]`, `?tab=`, `?editMatch=1` auto-open edit dialog, enrichment polling toasts on the page.
- Shared detail routes: only `/watchlist/[filmId]` hosts `FilmDetailView` today — no parallel detail route to redesign unless one is discovered during execute (call out in plan if found).
- Visual continuity with #143: poster treatment / “NO POSTER” language should feel like the same library once #151 is on `feature/mobile-ui`.

## Open questions

_(none — issue + brief + sibling slice specs are sufficient)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/144
- Product brief: [documents/ui-mobile-product-brief.md](../../../documents/ui-mobile-product-brief.md) (D1, D6–D8, D10; build order §6 slice 4)
- Design system: [documents/DESIGN.md](../../../documents/DESIGN.md)
- Depends on: #141 (merged to `feature/mobile-ui`); prefer alongside/after #143 (PR #151)
- Sibling slices: #142 (Home, merged), #145 (ceremony), #146 (questionnaire / first-run)
- Status rules: #115
- Parent mobile UI initiative: PR #134
