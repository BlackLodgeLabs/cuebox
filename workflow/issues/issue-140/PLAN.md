# Implementation plan — Issue #140

**Tier:** application

Home embeds the shared library+TMDB search picker inline; `/search` becomes a focus alias; header gains a global search icon; TMDB hits gain **Add & mark watched**.

## Overview

Issue #136 shipped `LibrarySearchPicker` on a standalone `/search` page with two Home CTAs that only differ by `?intent=`. This plan collapses that into one returning-user Home surface, removes intent, and wires deep links (header, `/search`, `/watchlist/add`) through `/?focus=search`.

Execute will:

1. Embed `LibrarySearchPicker` on the returning-user Home hub (above recommendation / History cards); remove dual intent CTAs.
2. Drop `intent` / `SearchPickerIntent` / intent-based placeholder, autofocus, and button emphasis; unified placeholder **Find a film…**.
3. Convert `/search` to a server redirect to `/?focus=search`; slim `/watchlist/add` to `redirect("/search")`.
4. Home honors `?focus=search` (focus + scrollIntoView when picker present), then `router.replace` clears the param.
5. Add AppShell header magnifying-glass link (**Search films** → `/search`).
6. TMDB-only rows: **Add to watchlist** (unchanged) + **Add & mark watched** (add → poll enrichment ready → `pending_watch_review` → `WatchReviewDialog` with `cancelOnDismiss: true`).
7. Update unit/E2E tests and a light doc note in `documents/api-contracts.md`.

No API, schema, or status-machine changes. Not a bug — feature placement on top of #136; skip `bug-repro-*`.

## Reproduction findings

N/A (feature). Static review of current code:

| Current behavior | Path |
|------------------|------|
| Dual Home CTAs → `/search?intent=add\|mark-watched` | `frontend/src/app/page.tsx` |
| Full picker UI on `/search` with intent parsing | `frontend/src/app/search/page.tsx` |
| `intent` drives placeholder, autofocus, emphasis, post-review nav | `frontend/src/components/library-search-picker.tsx` |
| TMDB row only has **Add to watchlist** | `SearchHitRow` in same file |
| No header search control | `frontend/src/components/app-shell.tsx` |
| Watchlist **Add film** → `/search?intent=add` | `watchlist-page-content.tsx` |
| `/watchlist/add` → `/search?intent=add` | `watchlist/add/page.tsx` |

## Root cause

N/A — intentional UX follow-up: intent entry points are redundant because the picker already exposes all status-aware actions per hit.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/app/page.tsx` | Embed picker on returning-user hub; remove dual CTAs; handle `?focus=search` | AC: inline Home search + focus alias |
| `frontend/src/components/library-search-picker.tsx` | Remove `intent`; unified copy; optional `autoFocus`; TMDB **Add & mark watched**; post-review stay/refetch | Core picker simplification + new action |
| `frontend/src/app/search/page.tsx` | Server `redirect("/?focus=search")` only | Alias route; drop client UI |
| `frontend/src/app/watchlist/add/page.tsx` | `redirect("/search")` (no intent) | Preserve alias chain |
| `frontend/src/components/app-shell.tsx` | Header search `Link` → `/search`, `aria-label="Search films"`, Material Symbol `search` | Global affordance |
| `frontend/src/app/watchlist/watchlist-page-content.tsx` | **Add film** → `/search` | Same destination as alias |
| `frontend/src/components/library-search-picker.test.tsx` | Drop intent fixtures; assert unified placeholder; cover **Add & mark watched** | Unit AC mapping |
| `frontend/src/components/app-shell.test.tsx` | Assert Search films → `/search` | Header AC |
| `frontend/e2e/library-search-picker.spec.ts` | Rewrite Home / redirect / TMDB chain scenarios | E2E AC mapping |
| `frontend/e2e/watchlist-add.spec.ts` | Update Home CTA absence, `/watchlist/add` → Home focus chain, watchlist link | Regression from #136 paths |
| `documents/api-contracts.md` | Note picker lives on Home; `/search` is alias | Doc accuracy (§4.7) |

Optional (only if execute finds Home focus awkward without it): small Home unit test file or shared `data-testid="library-search-input"` already asserted via E2E.

**Explicitly unchanged:** API routes, Alembic, film status machine, empty-watchlist Import hub (no picker), mobile bottom-tab shell.

## Implementation steps

### Step 1 — Simplify `LibrarySearchPicker`

1. Remove `SearchPickerIntent` type and `intent` prop.
2. Placeholder: **Find a film…**; `aria-label` can stay **Library and TMDB search** (or align to “Find a film” — prefer keeping stable test label unless E2E updated together).
3. Add optional `autoFocus?: boolean` (default false). Home passes true when focusing.
4. Expose a stable focus target: `data-testid="library-search-input"` on the `Input` (and/or `id="library-search-input"`) so Home can `scrollIntoView` + `.focus()` after mount when `?focus=search`.
5. Remove `emphasizeMarkWatched` from `SearchHitRow` — library **Mark watched** / **Complete review** use a single secondary/default style (match current non-intent look: `secondary` for those actions is fine).
6. `handleReviewSuccessNavigate`: always stay put + `libraryQuery.refetch()` (and invalidate as today). Drop `router.push("/")` branch — Home is already the host; old `/search` mark-watched redirect is obsolete.
7. Keep **Add to watchlist** path unchanged (`setPendingFilmId` → poll → toast → `/watchlist/{id}`).

### Step 2 — TMDB **Add & mark watched**

1. Add button next to **Add to watchlist** on TMDB-only rows.
2. New handler (suggested name `handleAddAndMarkWatched`):
   - Call `addToWatchlist` with `tmdb_id`.
   - **`already_on_watchlist`:** fetch film (or use returned `film_id` + `getFilm`); if `active` → `openMarkWatchedDialog`; if `pending_watch_review` → `openCompleteReviewDialog`; if `watched` → reuse existing already-on-watchlist messaging (no forced re-mark).
   - **`review_required`:** same as add path (pending review message / toast) — do not force mark-watched.
   - **`restored` / new enriching film:** do **not** navigate to detail. Set pending id in a distinct mode (e.g. `pendingMarkWatchedFilmId`) and poll with existing `useFilm(..., { pollWhileEnriching: true })`.
   - When `enrichment_status === "ready"` and film is `active`, call status transition → open `WatchReviewDialog` with `cancelOnDismiss: true`. Clear pending mode. Toast lightly (“Ready to review…” optional).
   - When enrichment `failed`: toast destructive; do not open dialog; leave film on watchlist (same honesty as add path).
3. **Enrichment race (required):** never `PUT .../status` to `pending_watch_review` until enrichment is `ready` (or film already existed as `active`). Prefer polling (mirrors add-then-navigate). Do not invent API changes unless polling proves insufficient — then stop and document in execute notes / pass-back.
4. Disable both TMDB buttons while add or mark-watched chain is in flight (`isAddPending` already covers enriching add; extend for mark-watched pending).

### Step 3 — Home hub layout + focus

1. Returning-user branch of `page.tsx`:
   - Keep heading copy (minor tweak OK: mention finding a film).
   - Place `<LibrarySearchPicker autoFocus={…} />` near the top — **above** New recommendation and History cards.
   - Suggested order: heading → picker → Your watchlist card → grid of New recommendation + History only → pending-review banner → health.
   - Remove **Add film to watchlist** and **Mark watched** cards entirely.
2. Focus handling (client):
   - `useSearchParams` + `useRouter`.
   - When `focus=search` and `hasWatchlist`: after picker mounts, focus input + `scrollIntoView({ block: "center" })`, then `router.replace("/", { scroll: false })` (or replace with stripped params) so refresh does not re-steal focus.
   - When `focus=search` and empty hub: no-op (Import CTA only); still clear param to avoid sticky URL.
3. Empty / loading / error Home paths unchanged (no picker on empty).

### Step 4 — `/search` alias + `/watchlist/add`

1. Replace `search/page.tsx` with a server component:

   ```ts
   import { redirect } from "next/navigation";
   export default function SearchPage() {
     redirect("/?focus=search");
   }
   ```

   Ignore any legacy `intent` query (do not forward it).

2. `watchlist/add/page.tsx`: `redirect("/search")` so the chain remains `/watchlist/add` → `/search` → `/?focus=search`.

### Step 5 — AppShell header search

1. Add a `Link` (icon-only on small screens is fine) using `<Icon name="search" />`, `aria-label="Search films"` (visible text optional; accessible name required), `href="/search"`.
2. Place it in the header row — e.g. before or after nav items, visually consistent with existing nav `hover-glow` / muted styles; do not treat it as a primary nav “active” route for `/`.
3. Material Symbols `search` works with existing `Icon` (string name; no registry change).

### Step 6 — Watchlist **Add film** link

Update `watchlist-page-content.tsx` href from `/search?intent=add` to `/search`.

### Step 7 — Tests

See **Tests required** below. Commit test updates with the code they cover.

### Step 8 — Docs

Update `documents/api-contracts.md` §4.7 blurb: picker is embedded on Home; `/search` redirects to `/?focus=search`; `/watchlist/add` still chains through `/search`.

## Tests required

| Acceptance criterion | Test |
|----------------------|------|
| Home embeds picker; dual CTAs gone | E2E `library-search-picker.spec.ts`: Home shows search input / “Find a film”; no **Add a film** / **Mark watched** intent links; picker above recommendation/history |
| `intent` removed | Unit: render without intent; placeholder **Find a film…**; no emphasize variants |
| `/search` redirect-only | E2E: `goto("/search")` and `goto("/search?intent=mark-watched")` end at `/` or `/?focus=search` then cleared to `/` with focused input (returning-user stubs) |
| Home `?focus=search` | E2E: `goto("/?focus=search")` focuses `library-search-input`; URL cleared |
| Header search icon | Unit `app-shell.test.tsx`: link **Search films** → `/search`; E2E optional click → lands on Home focused |
| TMDB **Add & mark watched** | Unit: mock add → ready film → status PUT `pending_watch_review` → dialog heading; E2E mocked chain preferred |
| TMDB **Add to watchlist** unchanged | Existing E2E add + enrichment poll → detail (retarget from `/watchlist/add` through redirect to Home picker) |
| Watchlist **Add film** → `/search` | E2E `watchlist-add.spec.ts` href assert |
| Empty / loading / partial-error / enriching | Keep/adapt unit cases in `library-search-picker.test.tsx` |
| Empty-watchlist Home | E2E or unit: Import CTA only; `/?focus=search` does not crash / does not show picker |

Commands (execute):

```bash
cd frontend && npm run test:unit
cd frontend && npx tsc --noEmit
# Mocked Playwright (no full stack required for these specs if they use route mocks):
cd frontend && npx playwright test e2e/library-search-picker.spec.ts e2e/watchlist-add.spec.ts
```

## Gate script

**Primary (narrower, frontend MVP):** `bash scripts/verify-phase6-gates.sh`

Resolve via config: this is the appropriate narrow gate for frontend-only product UI (`run-gate-scripts` table). Full `$APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`) is optional pre-merge insurance if execute time allows; babysit may still see Phase 8 CI elsewhere.

Cloud gotchas: export host `DATABASE_URL`/`TEST_DATABASE_URL` to `localhost:5432` ephemeral Postgres for gate DB tests; stop compose frontend + clear `frontend/.next` before host `npm run build` if the bind-mounted `.next` is root-owned.

## Documentation updates

- `documents/api-contracts.md` — §4.7 consumer description (Home + `/search` alias)
- No README change required unless execute finds user-facing setup mentions of dual CTAs (none today)

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Enrichment race on **Add & mark watched** | Poll until `ready` before status transition; mirror add path |
| Focus steal on every Home visit | Clear `focus` via `replace` after one-shot focus |
| Empty watchlist + `/search` | Focus no-op; Import CTA unchanged |
| Playwright URL timing after redirect chain | Assert final Home + input focus with generous wait; stub watchlist presence |
| Layout shift / long result list on Home | Keep existing `max-h-[32rem]` scroll on results |

Rollback: revert the PR branch; `/search` page and dual CTAs return.

## Definition of done

- [ ] Returning-user Home shows inline `LibrarySearchPicker` above recommendation/History; dual intent cards gone
- [ ] Empty Home unchanged (Import only); focus param no-ops
- [ ] `intent` prop/type removed; unified **Find a film…**
- [ ] `/search` (with or without intent) redirects to `/?focus=search`; `/watchlist/add` → `/search`
- [ ] Home focuses/scrolls picker then clears `focus` from URL
- [ ] Header **Search films** → `/search`
- [ ] TMDB **Add to watchlist** + **Add & mark watched** with poll-before-status behavior
- [ ] Watchlist **Add film** → `/search`
- [ ] Unit + Playwright tests updated and passing
- [ ] `bash scripts/verify-phase6-gates.sh` exit 0
- [ ] `documents/api-contracts.md` updated
- [ ] Draft PR #147 updated with commits (do not open a new PR)

## PR seed

**Tier:** application  
**What / why:** Put library+TMDB search on returning-user Home, drop dual intent CTAs, alias `/search` to Home focus, add header search, and TMDB **Add & mark watched**.  
**Key changes:** `page.tsx` embeds picker; `library-search-picker.tsx` loses `intent` and gains mark-watched chain; `/search` redirect; AppShell search icon; test + api-contracts updates.  
**Gate:** Phase 6: `scripts/verify-phase6-gates.sh` exit 0 at `<short-sha>`  
**How to test:** Seeded Home → search inline; header / `/search` / `/watchlist/add` focus field; TMDB **Add & mark watched** opens review dialog after enrichment.
