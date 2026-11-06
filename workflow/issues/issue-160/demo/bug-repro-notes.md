# Bug reproduction notes — Issue #160

**Date:** 2026-07-31  
**Commit SHA (planning start):** `d81d564` (agent side-branch `cursor/issue-160-pr-165-plan-agent-23cf`; base issue branch `cursor/issue-160-mobile-surface-clarity-ccba`)  
**Environment:** Docker Compose stack Up (`postgres`, `api`, `frontend`, `backup`); health `status=ok` / `database=ok` on both `$APP_HEALTH_URL_API` and `$APP_HEALTH_URL_FRONTEND`  
**Viewport:** 390×844 (iPhone 12 Pro Chrome device mode)  
**Seed:** Tier-3-style fixture DB — 2 films (The Matrix `ready`/`active` with poster; Ambiguous Title `failed`/`active` with `poster_url: null`) + 1 history session (Matrix)

## Steps taken

1. Confirmed stack health via compose + config health URLs.
2. Opened `/` at 390×844 — confirmed returning-user hub and **System status** under CTAs.
3. Opened `/history` — confirmed permanent search + date_from + date_to + watch-status select above results.
4. Opened Matrix film detail — confirmed enrichment **Ready** badge beside raw lifecycle **active**.
5. Opened `/watchlist` — confirmed Ambiguous Title uses intentional **NO POSTER** placeholder (null path OK).
6. Opened Ambiguous Title detail — **NO POSTER** + **Failed** + **active** jargon badges.
7. Code-read `FilmPoster` (no `onError`) and ceremony stages (raw `next/image` + local null branches). Forced a load-failure visual by swapping the Matrix poster node to a raw `<img>` with a 404 URL (Next/Image `src` is not reliably mutable from console) to show browser broken-image chrome vs the null placeholder.

## Expected vs actual

| Gap | Expected | Actual (observed) |
|-----|----------|-------------------|
| Missing / failed posters | One Cuebox placeholder on all listed surfaces; never browser broken-image UI | Null `src` → **NO POSTER** placeholder (`bug-repro-null-poster.png`). Load failure: `FilmPoster` has **no** `onError` / failed state; ceremony winner/runners-up/record still use raw `Image` without error fallback. Forced 404 `<img>` showed browser broken-image icon next to null **NO POSTER** (`bug-repro-broken-poster-load-clean.png`). |
| Film detail status | User-facing lifecycle only; no enrichment enum badges | Matrix: **Ready** + **active** (`bug-repro-film-detail-jargon.png`). Ambiguous Title: **Failed** + **active** (`bug-repro-film-detail-null-poster.png`). Toasts on film page still titled “Enrichment complete/failed”. |
| Home System status | Removed from empty + returning Home | Returning Home shows **System status** accordion control under History (`bug-repro-home-system-status.png`). `HealthPanel` + `getHealth` query still wired in `page.tsx`. |
| Home copy | One supporting sentence + picker `helperText` | Observed one H1 supporting sentence + picker helper — already meets trim AC; keep as-is unless residual duplicate essay appears after shell merges. |
| History filters | Date/status behind **Filter**; results higher in first viewport | Permanent flex-wrap stack of search + 2 date inputs + status select above the Matrix history card (`bug-repro-history-filters.png`). No Filter sheet. |

## Artifacts

| File | Purpose |
|------|---------|
| `bug-repro-home-system-status.png` | System status still on returning Home |
| `bug-repro-history-filters.png` | Permanent date/status filter stack above results |
| `bug-repro-film-detail-jargon.png` | Ready + active on Matrix detail |
| `bug-repro-null-poster.png` | Watchlist null → intentional NO POSTER (good path) |
| `bug-repro-film-detail-null-poster.png` | Null poster + Failed/active on Ambiguous Title detail |
| `bug-repro-broken-poster-load-clean.png` | Forced load-failure → browser broken-image vs NO POSTER |
| `bug-repro-broken-poster-load.png` | Same with DevTools/console context |

## Code confirmation (static)

- `frontend/src/components/film-poster.tsx` — null → placeholder; non-null → `next/image` with **no** `onError` / client failed state. No dedicated unit test file for `FilmPoster`.
- `frontend/src/components/ceremony/ceremony-stage-winner.tsx`, `ceremony-stage-runners-up.tsx`, `ceremony-stage-record.tsx` (`WinnerRecordCard`) — raw `Image` + local **NO POSTER** branches; runners-up/record winner path not on shared `FilmPoster` (record runners already use `FilmPoster`).
- `frontend/src/components/film-detail-view.tsx` — `formatEnrichmentStatus` badge + raw `{film.status}` badge.
- `frontend/src/app/watchlist/[filmId]/page.tsx` — toasts “Enrichment complete” / “Enrichment failed”.
- `frontend/src/app/page.tsx` — `HealthPanel` labeled **System status** on both empty and returning paths; `useQuery(["health"])`.
- `frontend/src/app/history/page.tsx` — inline date/status controls; watchlist Filter pattern lives in `watchlist-page-content.tsx` + `watchlist-filter-sheet.tsx` (precedent to mirror with a History-specific sheet).

## Notes for plan / execute

- Harden `FilmPoster` with client `failed` state + `onError`; migrate ceremony raw poster sites; keep one placeholder treatment (keep **NO POSTER** or quieter “No poster” — pick one consistently).
- Film detail: hide enrichment badge; map lifecycle enums → locked user labels; soften film-page enrichment toasts.
- Home: delete `HealthPanel` + health query if unused on the page; do **not** move health to More.
- History: compact search may stay visible; date_from / date_to / watch_status behind Filter bottom sheet with active indicator; reuse Sheet primitives, not overload `WatchlistFilterSheet`.
- No API / DB / ceremony sticky / More hub / Dev Mode redesign.
- PR base remains **`feature/mobile-ui`** (draft PR #165).
