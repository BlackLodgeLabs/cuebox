# Implementation plan — Issue #160

**Tier:** application  
**Issue type:** bug (returning-user surface clarity / trust gaps on shipped `feature/mobile-ui` phone UI)  
**Integration base:** `feature/mobile-ui` (draft PR **#165** already targets it — do not retarget to `main`)

## Overview

Close phone-review clarity gaps on returning-user surfaces: unify missing- and failed-poster fallbacks through hardened `FilmPoster`, replace film-detail enrichment/lifecycle jargon with user-facing labels, remove Home **System status**, and move History date/status filters behind a watchlist-like **Filter** disclosure so results sit higher in the first viewport.

Reproduction on 2026-07-31 (390×844, fixture watchlist + history) confirmed each gap — see [Reproduction findings](#reproduction-findings) and `demo/bug-repro-notes.md`. Preserve Neo-Noir tokens and poster+title-only watchlist cells. No API / DB / More-hub / ceremony-sticky / Dev Mode work.

## Reproduction findings

Evidence under `workflow/issues/issue-160/demo/` (`bug-repro-*`):

| Gap | Observed |
|-----|----------|
| **Null poster OK** | Ambiguous Title watchlist + detail show intentional **NO POSTER** (`bug-repro-null-poster.png`, `bug-repro-film-detail-null-poster.png`). |
| **Load-error gap** | `FilmPoster` has no `onError` / failed state; ceremony winner / runners-up / record winner still use raw `next/image`. Forced 404 `<img>` showed browser broken-image icon beside null **NO POSTER** (`bug-repro-broken-poster-load-clean.png`). |
| **Film detail jargon** | Matrix: **Ready** + **active**; Ambiguous Title: **Failed** + **active** (`bug-repro-film-detail-jargon.png`, `bug-repro-film-detail-null-poster.png`). Film-page toasts still say “Enrichment complete/failed”. |
| **Home System status** | Returning hub still exposes **System status** under History (`bug-repro-home-system-status.png`); `HealthPanel` on empty + returning paths. |
| **Home copy** | One supporting sentence + picker helper already present — trim AC met; do not add essays. |
| **History filter stack** | Search + 2 date inputs + status select permanently above results (`bug-repro-history-filters.png`). |

## Root cause

1. **Poster fallback split:** `FilmPoster` only special-cases falsy `src`. Non-null failing URLs keep rendering `Image` with no client error state. Ceremony stages duplicate null placeholders with raw `Image` instead of the shared component.
2. **Film detail labels:** Detail view renders `formatEnrichmentStatus` + raw `film.status` enums for operators, not readers.
3. **Home debug chrome:** `HealthPanel` / health query left on the nightly hub after the mobile hub redesign.
4. **History chrome density:** Filters were added as a permanent flex-wrap row; watchlist already solved the same problem with Filter + bottom sheet progressive disclosure.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/components/film-poster.tsx` | Client component: track `failed` when `onError` fires; reset failed when `src` changes; null **or** failed → shared Cuebox placeholder (keep **NO POSTER** text for consistency with current cells, or quieter “No poster” — **pick one** and use everywhere). Optional `priority` / `sizes` / `fill` props if ceremony needs them without forking. | Shared null + error fallback AC |
| `frontend/src/components/film-poster.test.tsx` (**new**) | Unit: null → placeholder; valid src → image; `fireEvent.error` on image → same placeholder (no broken chrome). | Poster regression |
| `frontend/src/components/ceremony/ceremony-stage-winner.tsx` | Replace raw `Image` / local NO POSTER with `FilmPoster` (`size="fill"` or equivalent in existing aspect box). | Ceremony winner AC |
| `frontend/src/components/ceremony/ceremony-stage-runners-up.tsx` | Same migration for carousel posters. | Ceremony runners AC |
| `frontend/src/components/ceremony/ceremony-stage-record.tsx` | Migrate `WinnerRecordCard` raw poster to `FilmPoster`; leave runners already on `FilmPoster`. | Ceremony record AC |
| `frontend/src/components/film-detail-view.tsx` | Remove enrichment badge from normal detail; show mapped lifecycle label only; keep “Updating metadata…” when enriching. | User-facing status AC |
| `frontend/src/lib/film-status-label.ts` (**new**, or colocated helper) | Map `active`→On watchlist, `pending_watch_review`→Needs watch review, `watched`→Watched, `archived`→Archived (+ unit tests). | Locked lifecycle labels |
| `frontend/src/app/watchlist/[filmId]/page.tsx` | Soften toasts: “Film details updated” / “Couldn’t update film details” (drop “Enrichment …” titles). | Optional toast AC |
| `frontend/src/components/film-detail-view.test.tsx` | Assert no Ready/Failed enrichment badge; assert “On watchlist” (etc.) for statuses; null poster still placeholder. | Detail status regression |
| `frontend/src/app/page.tsx` | Remove `HealthPanel`, health `useQuery`, and related imports/state from empty + returning paths. | System status removed AC |
| `frontend/src/app/page.test.tsx` | Assert `queryByText(/System status/i)` null for returning + empty; keep hub CTA assertions; do not require health mock if unused. | Home regression |
| `frontend/src/components/history-filter-sheet.tsx` (**new**) | Bottom `Sheet` with date_from, date_to, watch_status (All/Watched/Unwatched); Apply / Clear; draft state while open (mirror watchlist sheet pattern). Do **not** overload `WatchlistFilterSheet`. | History Filter AC |
| `frontend/src/app/history/page.tsx` | Keep compact title search always visible; add Filter button (active style when non-default dates/status); open sheet; remove permanent date/status row. | Browse-first first viewport |
| `frontend/src/app/history/page.test.tsx` | Closed: no date inputs / status select in document (or not visible); Filter button present; open → controls; apply/clear behavior; search may remain. | History disclosure regression |
| `frontend/e2e/*` (optional light) | If an existing mobile/home/history Playwright file is cheap to extend: Home has no System status; History Filter opens sheet. Prefer unit coverage if E2E environment flaky. | AC tests |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| `api/` / DB / sync / enrichment pipeline | Frontend-only |
| Watchlist cell metadata / filter dimensions | Out of scope; cells stay poster + title |
| `formatEnrichmentStatus` / watchlist Filter sheet enrichment UI | Still valid for watchlist filters |
| Ceremony sticky / short reasons / Done primacy (#159) | Sibling |
| More hub / shell (#158) | Sibling — do not relocate System status to More |
| Thumb ergonomics (#161) | Sibling except incidental shared hits |
| Developer Mode redesign | Out of scope |
| Neo-Noir tokens / FAB | Preserve design constraints |

## Locked implementation choices

| Decision | Choice |
|----------|--------|
| Placeholder copy | Keep **`NO POSTER`** (already on watchlist/detail) for one consistent treatment — do not invent collage cards. |
| FilmPoster API | Prefer hardening existing component; add `onError` → local `failed` state; reset on `src` change. Add optional props only if ceremony `fill`/`priority`/`sizes` need them without layout regression. |
| Lifecycle labels | Exact map from SPEC (display only). |
| Enrichment on detail | **Hide** badge entirely on normal detail; keep enriching hint string. |
| Home health | **Delete** from Home only; no More destination. |
| History disclosure | Bottom sheet via shared `Sheet` primitives; Filter button mirrors watchlist (`filtersActive` → `border-primary text-primary`); Clear → empty dates + `all`. |
| Search on History | Remains always visible and compact. |

## Implementation steps

### Step 1 — Harden `FilmPoster` + ceremony migration

1. Convert/ensure client boundary; add failed state + `onError`; shared placeholder for `!src \|\| failed`.
2. Unit tests for null + error path.
3. Replace ceremony winner / runners-up / record-winner raw posters with `FilmPoster`.
4. Smoke existing consumers (watchlist grid, picker, history cards, review, film detail) — no metadata creep onto watchlist cells.

### Step 2 — Film detail user-facing status

1. Add `formatFilmStatusLabel` (or equivalent) with locked map + unit test.
2. Update `FilmDetailView`: drop enrichment badge; show lifecycle label; keep enriching hint + status actions unchanged.
3. Soften film-page enrichment toasts.
4. Extend `film-detail-view.test.tsx`.

### Step 3 — Home: remove System status

1. Delete `HealthPanel` + health query from `page.tsx` (empty + returning).
2. Update `page.test.tsx` to assert absence of System status; drop health mock if unused.
3. Confirm returning copy remains one supporting sentence + picker helper.

### Step 4 — History Filter sheet

1. Add `history-filter-sheet.tsx` (date_from, date_to, watch_status only).
2. Refactor `history/page.tsx`: Filter button + sheet; keep search; preserve existing query params / pagination / delete.
3. Extend `history/page.test.tsx` for closed-by-default disclosure + apply/clear + active affordance.

### Step 5 — Gates / polish

1. `cd frontend && npm run test:unit && npx tsc --noEmit`.
2. Optional targeted Playwright if added.
3. Run `$APP_DEFAULT_GATE` (Phase 8) before execute-ready; host build gotcha: stop compose frontend + clear `frontend/.next` if needed.
4. No DESIGN.md rewrite unless execute finds an existing poster/filter subsection that should note History Filter — prefer minimal or skip.

## Tests required

| Acceptance criterion | Test |
|----------------------|------|
| Shared missing-poster fallback (null + error) | Unit `film-poster.test.tsx`: null placeholder; error → same placeholder. Ceremony unit/smoke: stages render `FilmPoster` / no raw broken path for null. Existing watchlist/detail “NO POSTER” tests still pass. |
| Film detail user-facing status | Unit: no enrichment Ready/Failed badge; `active`→On watchlist (and other map rows); enriching hint retained; actions still present. |
| Home copy trim | Unit: single supporting sentence present; no second essay node if any residual. |
| System status removed from Home | Unit: returning + empty — `queryByText(/System status/i)` null. |
| History Filter disclosure | Unit: closed → no permanent date/status controls; Filter opens sheet; Apply/Clear update query props; active style when non-default. |
| Design constraints | Demo + existing watchlist grid tests: poster + title only; Neo-Noir tokens untouched. |
| Toast language (optional AC) | Unit or light assert on toast titles if testable via page hook; else demo Scenario 2 note. |

## Gate script

```bash
source scripts/cursor-workflow-config.sh
# Frontend-only change set — prefer FE unit + tsc first; full Phase 8 at execute-ready:
cd frontend && npm run test:unit && npx tsc --noEmit
# Host build gotcha: docker compose stop frontend && sudo rm -rf frontend/.next
bash "$APP_DEFAULT_GATE"   # scripts/verify-phase8-gates.sh
```

Optional Playwright (if execute adds coverage):

```bash
cd frontend && npx playwright test e2e/ —grep "history|home|poster"   # only files execute actually adds/extends
```

Narrower intermediate OK while iterating; **final execute handoff** expects `$APP_DEFAULT_GATE` exit 0 (or Phase 6.5/7 FE subset + documented Phase 8 if infra-blocked — prefer Phase 8).

## Documentation updates

| File | Update |
|------|--------|
| `documents/DESIGN.md` | Only if an existing mobile/poster section should note History Filter / shared poster — otherwise **none** |
| `README.md` | None |
| Workflow artifacts | `PLAN.md`, `demo/demo-spec.md`, `demo/bug-repro-*` (this planning pass) |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Ceremony `fill`/`priority` layout regression when switching to `FilmPoster` | Extend `FilmPoster` props carefully; visual demo Scenario 1; keep aspect wrappers. |
| History Filter Apply/Clear draft vs live state bugs | Mirror watchlist sheet draft-on-open pattern; unit tests for apply/clear. |
| Accidental More-hub / health relocation | Explicit out of scope — delete Home panel only. |
| Sibling branch conflicts (#158/#159/#161) on Home/history/ceremony | Rebase on `feature/mobile-ui`; keep diffs scoped to listed files. |
| Rollback | Revert frontend commits on issue branch; no migrations. |

## Definition of done

- [x] `FilmPoster` handles null **and** load error with one placeholder; ceremony listed stages migrated
- [x] Film detail shows user lifecycle labels; enrichment badges gone; actions unchanged
- [x] Home has no System status (empty + returning); copy stays one sentence + helper
- [x] History date/status behind Filter sheet; search may stay; results higher when filters closed
- [x] Unit tests map to each AC; `tsc --noEmit` + `test:unit` green
- [x] `$APP_DEFAULT_GATE` green (or documented narrower + reason)
- [ ] Demo artifacts per `demo/demo-spec.md`
- [x] Draft PR **#165** remains based on **`feature/mobile-ui`**

## PR seed

**Tier:** application  
**What / why:** Fix mobile surface clarity — shared poster fallback (null + error), user-facing film-detail status, remove Home System status, History Filter disclosure.  
**Key changes:** Harden `FilmPoster` + ceremony migration; lifecycle label map on detail; delete Home `HealthPanel`; `HistoryFilterSheet` progressive disclosure.  
**Gate:** Application default: `bash $APP_DEFAULT_GATE` (Phase 8) exit 0 at execute tip.  
**How to test:** Phone 390×844 — watchlist null/error posters; film detail labels; Home without System status; History Filter closed → results up, open → date/status apply/clear.  
**Base:** `feature/mobile-ui` (PR #165).  
