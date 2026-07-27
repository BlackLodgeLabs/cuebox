# Implementation plan — Issue #144

**Tier:** application  
**Issue type:** feature (mobile film-detail reskin / poster-led recomposition; not a bug)  
**Integration base:** `feature/mobile-ui` (draft PR **#152** already targets this — do not retarget to `main`)

## Overview

Reskin `FilmDetailView` (`/watchlist/[filmId]`) into a **poster-led** phone screen per brief **D6/D7** and SPEC composition rules:

1. **Dominant poster** on the first viewport (large plane — not today’s `size="md"` inset over a backdrop banner with title/actions crammed into chrome)
2. **Title / year / enrichment / status** adjacent to or immediately under the poster — not a separate peer card
3. **Status actions** via existing `FilmStatusActions` `variant="detail"` (same #115 labels); bump hit targets to ~≥44px
4. **Single vertical scan** below: synopsis / key meta → where-to-watch → watch history → scores / tags / semantic → external links — prefer section hierarchy over a stack of equal `Card` peers
5. **Graceful empty paths** for enriching/failed/missing poster/null scores — no broken empty card shells
6. Preserve back-nav (`watchlistTab` / `?tab=` / status fallback), `?editMatch=1`, enrichment toasts, dialogs

No API, DB, or config changes. Do not edit watchlist grid (#143), Home (#142), AppShell (#141), or ceremony (#145).

**#143 note:** Poster grid (PR #151) is **not** on `feature/mobile-ui` yet. Prefer visual continuity (`NO POSTER` language, aspect 2/3 poster treatment) but **do not block** this slice. If #151 merges mid-flight, rebase onto `feature/mobile-ui` and reuse any `FilmPoster` `fill` size / shared tokens rather than duplicating.

## Reproduction findings

N/A — greenfield UX rewrite (feature). Baseline confirmed by static read of current tip:

- `film-detail-view.tsx` — full-bleed **backdrop banner** (`h-56`/`md:h-72`) with **small `FilmPoster` `size="md"`** (120×180) + title/badges/actions overlaid in banner chrome
- Below: equal **Card** stack — Overview (Letterboxd buried here), Watch history, Metadata (scores + TMDB/IMDb), then `WhereToWatchSection`, then Semantic profile Card; empty path is a centered **Card** (“Enrichment data is not available yet”)
- `FilmStatusActions` `variant="detail"` uses `Button size="sm"` (`h-8` ≈ 32px) — **below** criterion **C** (~≥44px)
- `watchlist/[filmId]/page.tsx` — loading uses `CardGridSkeleton`; wires tab, status transition, mark-watched dialog, enrichment toasts correctly
- Only host of `FilmDetailView` is `/watchlist/[filmId]` (no parallel detail route)
- Unit coverage today: `film-detail-view.null-score.test.tsx` only (unrated watch diary)

## Root cause

N/A (feature). Product constraint: phone-first poster metaphor continuity with watchlist (D6); current backdrop-overlay + peer-card dashboard fights D6/D7 and reads as competing chrome.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/components/film-detail-view.tsx` | **Rewrite composition** | Poster-led hero; section stack; promote external links; degrade empty paths |
| `frontend/src/components/film-status-actions.tsx` | Edit `detail` hit targets | `min-h-11` / ≥44px for criterion **C**; keep labels/rules; leave `table` (and future `menu` from #143) alone |
| `frontend/src/components/film-poster.tsx` | Edit if needed | Add `fill` (or equivalent fluid) size when #143 not yet merged — dominant poster frame; keep `NO POSTER` copy |
| `frontend/src/components/where-to-watch-section.tsx` | Light density/spacing only | Phone polish; **no** provider API / behavior changes |
| `frontend/src/app/watchlist/[filmId]/page.tsx` | Loading skeleton alignment | Prefer poster-shaped skeleton over `CardGridSkeleton` |
| `frontend/src/components/loading-state.tsx` | Optional helper | e.g. `FilmDetailSkeleton` (poster plane + lines) if cleaner than inline |
| `frontend/src/components/film-detail-view.null-score.test.tsx` | Extend | Keep null-score assertions; add layout/actions coverage **or** split into `film-detail-view.test.tsx` |
| `frontend/src/components/film-detail-view.test.tsx` | **New** (preferred) | Poster-led structure, back `href`, status actions, external links, enrichment-empty |
| `frontend/e2e/all-routes.spec.ts` | Touch only if selectors break | Route 11 already soft-matches `/watchlist/[filmId]` |
| `documents/DESIGN.md` | Optional one line | Film-detail poster-led rule only if a documented layout delta is needed |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| API / Alembic / `config.yaml` / api-contracts | No API changes |
| `watchlist-poster-grid.tsx` / filter sheet / watchlist page | Slice c / #143 |
| `app-shell.tsx`, Home `page.tsx` | #141 / #142 |
| Status machine transition rules | #115 preserved — presentation only |
| Watch-provider endpoints / hooks behavior | Density only |

## Implementation steps

### Step 1 — Poster-led hero (replace backdrop-overlay chrome)

Replace the relative backdrop banner + inset poster with a poster-forward first viewport:

```text
← Watchlist   (backHref unchanged)
[poster frame — aspect 2/3, dominant width on phone]
  FilmPoster size=fill|lg  (NO POSTER when missing)
Title (year)
Badges: enrichment + status (+ “Updating metadata…” when enriching)
Edit film match + FilmStatusActions (detail)
```

Locked rules:

| Element | Role |
|---------|------|
| Poster | Dominant first-viewport visual; **larger** than today’s md inset; not a small overlay on backdrop |
| Backdrop | Optional atmospheric secondary only — must **not** outrank the poster or force title/actions into cramped overlay; **acceptable to drop** full-bleed backdrop hero on phone |
| Title / year / status | Adjacent to or immediately under poster; **not** a separate peer card |
| Status actions | Always when handlers passed; ≥44px; same #115 labels |
| Cards | Allowed as section containers only when they aid scanning; hero must not be a card collage |

**Desktop (`md+`):** same metaphor; optional two-column (poster column + title/actions/meta column) without regressing to backdrop-overlay chrome or dense card dashboard.

**FilmPoster sizing:** If `fill` exists (after #143 rebase) use it inside an aspect-[2/3] frame (`w-full max-w-xs` phone / taller on desktop). If not, add `fill` here (compatible with #143) **or** use `lg` inside a wider frame — prefer `fill` so grid/detail share one fluid size.

### Step 2 — Detail status actions ≥44px

In `FilmStatusActions`, for `variant === "detail"` only:

- Use `size="lg"` and/or `className="min-h-11 …"` so primary status CTAs meet ~≥44px
- Keep archive confirm `Dialog` and all status→label mappings identical
- Do **not** invent a second status machine; do not change `table` styling (watchlist owns that / #143 `menu`)

Also ensure **Edit film match** on the detail page is ≥44px (not `size="sm"` alone).

### Step 3 — Vertical scan sections (demote peer Cards)

Reorder / regroup content below the hero into one scannable stack. Suggested order (SPEC user flow):

1. **Synopsis + key metadata** (director, runtime, language, country, original title) — section heading + content; omit empty fields; no empty Overview card when nothing to show
2. **Where to watch** — existing `WhereToWatchSection` (reachable without hunting); polish padding/gaps only
3. **Watch history** — keep pending “Complete review” affordance + edit watch diary; preserve null-score “Unrated · {date}” behavior
4. **Scores / genres / keywords** — omit null score rows (existing `ScoreRow` / metadata null guards); consistent em dash only where already used
5. **Semantic profile** — only when `semantic` present; omit empty tag groups (existing `TagGroup`)
6. **External links** — Letterboxd (`film.letterboxd_uri`), TMDB, IMDb when IDs exist — **clearly labeled and tappable**, not only buried inside a late Metadata card

Prefer plain section headings (`h2` / `text-h3` / label styles) over a stack of equal `Card` peers. Cards remain OK for where-to-watch / interactive clusters if they still feel like sections, not a dashboard collage.

**Enrichment not ready:**

- Keep enrichment `Badge` + enriching cue in the hero
- Omit or stub missing metadata/semantic blocks — **remove** the standalone empty Card that only says enrichment isn’t available (plain muted status line is fine)

### Step 4 — Page loading skeleton

In `watchlist/[filmId]/page.tsx`, replace `CardGridSkeleton` with a poster-shaped skeleton (poster plane + a few lines for title/actions). Keep error / not-found / toast / status wiring unchanged. Preserve `?editMatch=1` → `autoOpenEditMatch`.

### Step 5 — Unit tests

Extend null-score coverage and add focused layout/actions tests (new `film-detail-view.test.tsx` preferred; can extend the existing file if smaller):

1. **Poster-led structure** — dominant poster present (`alt` = title or NO POSTER); no reliance on backdrop-as-hero assertion if backdrop dropped; title/year rendered outside a competing card collage
2. **Back link `href`** — `watchlistTab` / status fallbacks: `active` → `/watchlist`; `watched`/`pending_watch_review` → `/watchlist?tab=watched`; `archived` → `/watchlist?tab=archived`; explicit `watchlistTab` wins
3. **Status actions** — when handlers passed, detail actions render for `active` (Mark watched / Archive); do not invent second machine
4. **Hit targets** — detail action buttons include `min-h-11` or `h-11` / `size="lg"` class tokens (criterion **C**)
5. **External links** — Letterboxd always; TMDB/IMDb when IDs present
6. **Enrichment-empty** — `metadata: null`, `semantic_profile: null` → no empty “card shell” copy that looks broken; enrichment status still visible
7. **Null scores** — preserve existing unrated watch assertion (no `null★` / `0★`)

Mock `next/image`, dialogs, `WhereToWatchSection`, and optionally partially mock `FilmStatusActions` only when testing structure without clicking transitions — prefer **not** mocking status actions when asserting presence/labels/classes.

### Step 6 — E2E (optional / light)

Playwright smoke optional: `all-routes.spec.ts` route 11 already soft-asserts the detail route. Update selectors only if markup changes break it. No new E2E file required unless execute wants a phone-viewport poster-led smoke (mocked film payload) — nice-to-have, not blocking.

### Step 7 — Docs (minimal)

Optional one-line film-detail poster-led note in `documents/DESIGN.md` next to existing watchlist/results guidance — only if execute introduces a durable composition rule. Default: skip. Do not rewrite the product brief.

### Step 8 — Motion / Neo-Noir

- 16px mobile content margins via AppShell `px-4` — avoid extra horizontal padding that fights the shell (hero may use full content width; do not reintroduce `-mx-4` backdrop bleed unless it stays secondary)
- Any enter/scroll motion must honor `prefers-reduced-motion` (D8)
- No essential hover-only actions; no new brand tokens / rebrand (D1)

## Tests required

| Test | Type | Acceptance criteria covered |
|------|------|----------------------------|
| Poster dominant; title/year under/adjacent; not md-inset-on-backdrop | unit | Poster-led first viewport |
| Back link href for tab + status fallbacks | unit | Back navigation |
| Status actions present with #115 labels when handlers passed | unit | Status actions consistency |
| Detail action / Edit match ≥44px class tokens | unit | Criterion **C**; no hover-only essentials |
| Letterboxd + TMDB + IMDb links when IDs exist | unit | External links clear |
| Enrichment null metadata/semantic — no broken empty card shell; status visible | unit | Graceful degrade |
| Unrated watch diary (null score) unchanged | unit | Missing scores / null-score regression |
| Where-to-watch section still mounted (mocked child OK) | unit | Where-to-watch reachable |
| `npx tsc --noEmit` + `npm run test:unit` | CI/local | Types + unit suite green |
| `all-routes` detail route still passes (if run) | e2e optional | Route smoke |

## Gate script

Frontend MVP presentation change (no API). Execute should run:

```bash
source scripts/cursor-workflow-config.sh
cd frontend && npm run test:unit && npx tsc --noEmit
bash scripts/verify-phase6-gates.sh
```

Optional stronger pre-merge: `bash $APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`).

With stack up (optional):

```bash
cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test e2e/all-routes.spec.ts
```

**Host build gotcha:** stop compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Documentation updates

| File | Update |
|------|--------|
| `documents/DESIGN.md` | Optional one-line film-detail poster-led note |
| `workflow/issues/issue-144/PLAN.md` / `demo/` | This plan + demo-spec |
| README / API docs | None |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| #143 merges mid-flight and conflicts on `FilmPoster` / `FilmStatusActions` | Rebase onto `feature/mobile-ui`; reuse `fill` / keep `detail` variant; do not touch grid components |
| Backdrop removal feels too stark on desktop | Optional subtle secondary backdrop or surface wash that does not outrank poster |
| Demoting Cards breaks visual rhythm vs rest of app | Use section headings + spacing; keep Cards only where interaction/scanning benefits |
| Detail `size="sm"` → `lg` changes layout wrapping | `flex-wrap` already present; demo on 390×844 |
| Null-score / watch-history regressions | Keep existing test; expand fixtures carefully |
| Where-to-watch polish accidentally changes API wiring | Spacing/class only; no hook/endpoint edits |
| PR base wrong (`main`) | PR #152 already targets `feature/mobile-ui` — do not retarget |

**Rollback:** Revert `film-detail-view.tsx` (+ status-actions detail classes, poster size, page skeleton) and test commits; prior backdrop+card layout returns.

## Definition of done

- [ ] Film detail is poster-led on phone (and same metaphor on `md+`); backdrop no longer dominates as competing hero chrome
- [ ] Status actions available via `FilmStatusActions` detail variant; #115 labels preserved; ≥44px hit targets
- [ ] Where-to-watch reachable; external links clear; back-nav tab rules preserved
- [ ] Enrichment-not-ready / missing poster / null scores degrade gracefully (no broken empty card shells)
- [ ] Neo-Noir tokens; 16px margins; `prefers-reduced-motion` for any new motion
- [ ] Unit tests mapped above green; Phase 6 gate exit 0
- [ ] Demo artifacts per `demo/demo-spec.md`
- [ ] `workflow.state.json` → `execute-ready` after execute (planning ends at `plan-ready`)
- [ ] Draft PR **#152** remains based on `feature/mobile-ui`

## PR seed

**Tier:** application  
**What / why:** Reskin film detail into a poster-led phone screen so metadata scans below a dominant poster instead of a backdrop-overlay + peer-card dashboard (mobile UI slice d / D6–D7).  
**Key changes:** Rewrite `FilmDetailView` composition; bump detail status-action hit targets; promote external links; poster-shaped loading skeleton; unit coverage for layout/actions/empty paths.  
**Gate:** Phase 6 (`verify-phase6-gates.sh`) + `frontend` unit tests; optional Phase 8 full regression.  
**How to test:** Open `/watchlist/{id}` at phone width — large poster first, status actions ≥44px, scroll to where-to-watch + Letterboxd/TMDB/IMDb; back link honors `?tab=`; enrichment-empty shows status without empty card shells.  
**Base branch:** `feature/mobile-ui` (PR #152).
