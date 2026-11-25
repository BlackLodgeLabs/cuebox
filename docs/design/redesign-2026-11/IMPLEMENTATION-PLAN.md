# Cuebox redesign: implementation plan (draft for Craig)

- **v2**, 24 Nov 2026 at about 23:15 UK time. Updated after Designer · Figma's answers and the revised pack. v1 is kept at `/workspace/cuebox-redesign-plan.v1.md`.
- Research only. No issues, PRs, labels, branches or agents have been created.

**Sources checked:**
- Designer · Figma's pack at `/workspace/cuebox-handoff/`, as revised at 22:53–22:54 UK time:
  - README.md, all of §1–§10
  - CHECKLIST.md
  - tokens.css and tokens.json
  - all 26 PNGs in `screens/`
  - the README.txt in each `motion/00–07` folder
- Cuebox `main` at `a19c2a7` (merge of #179, 6 Nov 2026). There have been no commits to main since then.

## What changed in v2

1. **§3 rewritten.**
   - All the contradictions in the pack are now settled by Designer, and are listed as confirmed.
   - Four items are pending Craig. They don't block anything.
   - Four new data gaps were found while re-checking.
2. **Watchlist pills are now Unwatched / Watched / Archived.** There's no All pill. The line under the title shows the total for the current view, for example "239 unwatched".
3. **Tab bar:** Home, Watchlist, Recommend, More. **Home:** a Search films field in the header; then Where to watch, Get a pick for tonight, and Surprise me as a teal text link. **Stars:** amber.
4. **Questionnaire:** all 11 steps, one at a time.
5. **The create sheet needs a new API.**
   - A star tap creates a *finished* watch straight away.
   - The date and note are then saved with partial PATCH calls.
   - Today the only way to create a watch is a draft (status `pending_watch_review`), dated today, and then `POST /watch-review`, which needs both a score and a date.
   - A watched film can't go back to `pending_watch_review`, so there's no way at all to log another watch on it. "Log another watch" on the You tab needs this.
   - B1 now adds `POST /films/{id}/watches`, and makes PATCH partial.
6. **Close to this and Trailer are confirmed in scope.**
   - A new backend ticket, **B3**, covers a similar-films endpoint, TMDB trailers, and a TMDB-only film endpoint. Search results today don't carry enough for the lighter page: they have no backdrop, genres, runtime, score or trailer.
   - S11 is gone. Its UI is now part of S5 (film detail) and S3 (the not-on-watchlist page).
7. **New list fields.** Rating badges on the Watched grid need the user's score on list rows, and `FilmSummary` doesn't carry it. Rating sort uses the user's own rating on Watched. Both are added to B2.
8. **Film detail now includes:**
   - community scores as percentages
   - a sticky bottom bar: Trailer, Watch, Watched/Watched?, More
   - the not-on-watchlist page: Trailer, Add to watchlist, More
9. **Search now includes** the eye action (mark watched, which opens the create sheet) and the plus action (add). S6 wires up the eye.
10. **Runtime buckets** now follow Designer's proposal of ≤90 / 91–150 / >150 minutes, still pending Craig. v1 had 90 / 120.
11. **Dependencies re-checked:**
    - S3 now depends on B3 (Trailer).
    - S5 now depends on B3 (Trailer, Close to this).
    - S6 now also wires the Search eye.
    - Wave 1 grows to four backend/foundation tickets.
12. **New open item:** the locked header drops the pending-reviews badge, so §3.3 item 5 adds a default home for it under More (S10).
13. **The pack-fix item is closed.** The `tokens.css` reduced-motion rule is now inside `:root`, and the libraries are now described as additions.

---

## 1. The pack in brief

### Look
- **What it is:** a locked phone design on a 390×844 frame, direction "T2 Balance". Foundations were locked on 14 Nov and motion on 24 Nov. The pack is the source of truth; Figma is out of date.
- **Colour:**
  - Background `#0B0B0B`, surface `#171717`, danger `#C75B4A`.
  - Amber `#E07A28` is used for primary actions, "Cue", **stars and rating badges**, and is the only colour that may glow.
  - Teal `#2A9A94` is always flat. It's used for links, the active tab, selected chips, the "Saved" confirmation and taste ticks. Never for stars.
- **Type:** Big Shoulders 700 for titles (the wordmark uses opsz 72), Archivo for the UI, IBM Plex Mono for metadata.
- **Corners and spacing:** radius 12, 8 and 16px. Spacing 4, 8, 16, 24, 32 and 48.

### Screens
- **Shell.** Four tabs: Home, Watchlist, Recommend and More. History, Sync, Import and My services sit under More.
- **Home.**
  - Header: the wordmark, plus a **Search films** field that opens the cmdk card.
  - Today's feature: one watchlist film per day.
  - Below it: **Where to watch** (amber, opens a sheet), **Get a pick for tonight** (teal outline, starts the questionnaire), and **Surprise me** (teal text, opens a sheet with one random watchlist pick).
  - Four named poster rows, watchlist films only.
  - Arrival: the logo unfold at 0.85×, then the option-E iris.
- **Search.**
  - A cmdk card with two groups: On your watchlist, then Not on your watchlist.
  - An eye on a result marks it watched and opens the review sheet. A plus adds the film.
  - A film not on the watchlist opens a lighter page: hero, metadata, community scores, synopsis, and a bar with Trailer, Add to watchlist and More.
- **Recommend (Flow A).**
  - 11 steps, one at a time: genres, runtime, who you're with, mental effort, pacing, how you want to feel, look and feel, era, subtitles, how well-known, and optional notes.
  - There's no tab bar on the question screens.
  - Then the shuffle (420px/s), then the programme, with the Recommend tab selected.
- **Film detail.**
  - Community scores as whole percentages: TMDB ×10, RT as stored, Letterboxd ×20.
  - Tabs: Overview (synopsis, services, taste ticks), Watch (providers, with your services first), and You (watches, edit pencils, and **Close to this**, which shows unwatched watchlist films only).
  - A sticky bar: Trailer, Watch (amber; opens the first ready-to-play service), Watched / Watched?, and More.
  - The More sheet has Archive and Remove, with no confirm.
- **Review.**
  - **Create:** a star tap saves the watch straight away. "Saved" appears, then the date (empty, with Today and Pick a date, or left blank as unknown) and the note slide in. There's no Save button. Changes PATCH the same watch, and the note saves on blur.
  - **Edit:** a Save changes button.
  - **Delete:** a confirm box. Deleting a film's only watch keeps it watched.
  - The 1984 sentinel is never written.
- **Watchlist.**
  - Pills: Unwatched (`active`), Watched and Archived. No counts on the pills.
  - The line under the title shows the view total.
  - The Watched grid shows amber score badges.
  - Filter sheet: the On my services switch, genre, and Short / Medium / Long. Sort sheet: date added, title, year, runtime, rating.
  - Infinite scroll, 18 per page.
- **My services.** A full page that sorts Where to watch and drives the On my services filter.
- **History.** Ticket stubs, infinite scroll of 10, a dated programme at `/history/{id}`, and remove by swipe or long-press, then confirm.
- **Sync and Import.** Shared defaults only.

### Motion (unchanged in v2; all timings in README §6 and the tokens)
- **Home:** logo unfold 2035ms, then the iris from 1974ms over 760ms (smoothstep).
- **Shuffle:** constant 420px/s cruise, a 2.5s wind-down using `1-(1-u)^1.38` (about 761px), an amber highlight (80/120/400ms) and a 580ms expand.
- **Taste ticks:** 70ms per tick, 330ms fill, starting when 40% is in view, +90ms per row.
- **Star fill:** 70ms and 330ms, a 30% bounce over 190ms, "Saved" at +40ms over 220ms, glow at 35%.
- **Watchlist pill switch:** 400ms out and 600ms in, overlapping by 200ms.
- **App-wide:** sheets 800ms up and 700ms down; toasts 700 and 600ms, staying 2800ms; search 700 and 600ms from 96%; confirm 400ms from 92% with a 62% dim; press 4% over 120 and 200ms; screen changes are a 400ms crossfade.
- **History:** as above, with 10 per page and a 76px stub.
- **Reduced motion:** things appear at once, or fade over 300ms.

### §9 gaps
- **Pending Craig:**
  - My services wording
  - runtime buckets
  - which rating to sort by
  - how Home rows are filled
- **Still open:**
  - Sync and Import have no design pass.
  - No confirm on Archive or Remove from a film.
  - Toasts have no undo.
  - The date picker stays native.
  - No minimum shuffle cruise is locked.
  - Some mock content is stand-in.
  - Figma is out of date.

---

## 2. Where current main stands (gap table)

### Frontend stack
- **Framework:** Next.js 15, React 19, TanStack Query 5, Tailwind 3, Vitest and Playwright.
- **shadcn and Radix are present** (`components.json`, new-york style). The Radix packages installed are dialog, dropdown-menu, select, tabs, toast, checkbox, label, progress, radio-group, separator and slot.
- **Not installed on main** (the updated pack now lists them as additions to make during the build):
  - Vaul
  - Sonner
  - cmdk
  - NumberFlow
  - Framer Motion
  - Radix AlertDialog

  `frontend/package.json` lists none of them. The current sheet is `components/ui/sheet.tsx`, built on Radix Dialog, and the current toasts are Radix Toast (`components/ui/toast.tsx`, `toaster.tsx`). F2 adds all of them.
- **Fonts and theme today:**
  - Fonts are Cabin, Libre Franklin and Space Mono, loaded through `next/font/google` in `app/layout.tsx`.
  - The theme is "Modern Neo-Noir" (`src/styles/tokens.css`, `documents/DESIGN.md`).
  - Both get replaced.
- **Tab bar:** there are already four tabs: Home, Watchlist, Recommend and More (`components/app-shell.tsx`).
- **Pagination today:**
  - Watchlist uses Previous/Next with `offset` in the URL (`app/watchlist/watchlist-page-content.tsx`, around lines 364–378).
  - History uses Previous/Next with `limit=20` (`app/history/page.tsx`, lines 61–65 and 220–228).
- **The old ceremony is used in two places:**
  - `app/history/[sessionId]/page.tsx` renders `RecommendationCeremony`.
  - So does `app/recommend/results/[sessionId]/page.tsx`.
- **E2E specs that will need updating:**
  - `recommendation-ceremony.spec.ts`
  - `history-delete.spec.ts`
  - `design-smoke.spec.ts`
  - `watchlist-poster-grid.spec.ts`
  - `app-shell-mobile.spec.ts`
  - among others

### Agent workflow files on main
- **Docs:** `AGENTS.md`, `GLOSSARY.md`, `docs/agents/{issue-tracker,triage-labels,domain}.md` and `.github/ISSUE_TEMPLATE/feature_request.yml`.
- **Skills in `.cursor/skills/`:** grill-with-docs, to-spec, to-tickets, implement, implement-spec, tdd, code-review, triage, pr, run-gate-scripts, wayfinder, prototype, research and others.
- **`.github/workflows/implement-ready-for-agent.yml`:**
  - It runs on `issues: labeled` when the label is `ready-for-agent`, and only for issues, not PRs.
  - It POSTs `{issue, title, repo}` to the Cursor automation webhook and comments the agent link on the issue.
  - **The payload carries no base branch.** The base comes from the automation's own prompt, or from instructions in the issue.
  - **It does not check blockers.** Labelling a blocked ticket starts an agent straight away.
- **Native issue dependencies and sub-issues** are the documented way to record blocking (`docs/agents/issue-tracker.md`).
- **Cloud environment** (`.cursor/environment.json`): the snapshot is pinned as `bld-20260809-…`. Install runs `npm ci`, so adding new npm packages does not need a snapshot rebuild. AGENTS.md asks for a rebuild only for *major* lockfile shifts.
- **Integration-branch precedent:** the earlier mobile UI work used `feature/mobile-ui`.
  - Ticket PRs merged into that branch: #165, #176 (the ready-for-agent trial PR for issue #175) and #177.
  - The branch then merged to main in #178 (`git log --graph`).
  - `workflow/issues/issue-160/SPEC.md` shows ticket bodies stating "Integration base: `feature/mobile-ui`".

### API gap table

| Item | Verdict | Evidence on main |
|---|---|---|
| Films pagination with `limit` | **Supported** | `GET /films` takes `limit` (1–100, default 20) and `offset`, and returns `pagination.{total,limit,offset,has_more}` (`routers/v1/films.py` `list_films`; `PaginationMeta`). The view total under the title is `pagination.total`. |
| Pills Unwatched / Watched / Archived | **Supported** | The `status` filter accepts `active`, `watched` and `archived` (`_parse_film_status`). |
| History pagination, search and filter | **Supported** | `GET /recommendations` takes `limit`/`offset` (default 20), `search`, `date_from`/`date_to` and `watch_status`, and returns `pagination.has_more` (`routers/v1/recommendations.py`). |
| Open a past night | **Supported for data; partly for the layout** | `GET /recommendations/{session_id}` returns the winner, up to four runners-up, `created_at` and `profile_summary`. `FilmResult` has `poster_url` but no `backdrop_url` or `genres` (`schemas/recommendations.py`). The data is in `film_metadata` (`backdrop_url`, `genres`). |
| Delete a history night | **Supported** | `DELETE /recommendations/{session_id}` returns 204. |
| Sort by runtime | **Missing** | `_VALID_SORT_FIELDS = {"title","year","created_at","enrichment_status","watched_at"}` (`films.py:48`). `film_metadata.runtime` exists. |
| Sort by rating (own score on Watched, TMDB elsewhere, as proposed) | **Missing** | It isn't a sort field. `tmdb_rating` is filled from TMDB (`metadata_service.py:447`). The own rating is `film_watches.score`, one per watch, so it needs a per-film aggregate such as the latest rated watch. |
| Score badge on the Watched grid | **Missing** | `FilmSummary` has `latest_watched_at` and `pending_watch` but **no score** (`schemas/film_schemas.py:20–40`). It needs a latest-score field on list rows. |
| Genre and runtime filters | **Missing** | `list_films` has no genre or runtime parameter. The data exists: `film_metadata.genres` (JSONB) and `runtime`. |
| "On my services" filter and My services settings | **Missing (largest backend item)** | Nowhere stores the user's chosen services: no table, endpoint or config key, only `watch_providers.country_code`. Providers are fetched live from TMDB one film at a time (`services/watch_provider_service.py`), with no provider table. Filtering needs a per-film availability cache, a refresh, and an `on_my_services` filter on `GET /films`. |
| Create a watch with one star tap (create sheet; Search eye; "Log another watch") | **Missing** | Today the only way in is `POST /films/{id}/status` with `pending_watch_review`, which makes a draft watch dated **today** (`film_status_service.py`; `WatchReviewService.begin_manual_review`). Then `POST /films/{id}/watch-review` needs both `score` and `watched_at` (`CompleteWatchReviewRequest`). `watched → pending_watch_review` is rejected ("Cannot transition from watched to pending_watch_review"), so **a second watch can't be logged at all**. The current frontend has no "Log another watch". |
| PATCH a watch's date or note on its own (create-sheet autosave) | **Partly** | `PATCH /films/{film_id}/watches/{watch_id}` exists. But `UpdateWatchRequest` requires `score` and `watched_at` (`watch_review_schemas.py:28–31`), so it needs partial updates and a way to clear the date. |
| Watch with no date | **Missing** | `film_watches.watched_at` can't be null (`models.py:144`). `watched_at` is required in `FilmWatchBlock`, `CompleteWatchReviewRequest` and `UpdateWatchRequest` (`watch_review_schemas.py:14,24,30`) and in `FilmWatchSummary` (`film_schemas.py:101`). The sentinel `date(1984, 9, 28)` is in `services/watched_csv_parser.py:14`, and sorting treats it as "unknown" (`film_repository._is_unknown_watched_date`). |
| Delete a finalized watch | **Missing** | Only `DELETE /films/{id}/watch-review` (a pending draft) exists. Neither `WatchReviewService` nor `film_watch_repository` can delete a finished watch (only `delete_pending_for_film`). |
| Close to this (unwatched watchlist films only) | **Missing; the pattern exists** | There's no similar-films endpoint. Film embeddings exist (`film_embeddings`, pgvector), and the recommendation engine already runs `embedding <=> vector` similarity queries (`recommendation_service.py:457–462`). It needs `GET /films/{id}/similar?limit=` limited to `status=active`. |
| Trailer | **Missing** | Nothing in `api/app` mentions trailers or videos. `providers/tmdb.py` has search, details, keywords, credits and watch providers, but no `/videos`. It needs a TMDB videos lookup (YouTube key) on film detail and on TMDB-only results. |
| Community scores (%) | **Partly** | `FilmDetail` metadata has `tmdb_rating` (from TMDB) and `rotten_tomatoes_score` (from OMDb, `metadata_service.py:430`, only when OMDb is set up). **`letterboxd_rating` is never written anywhere in `api/app`**; the column exists, but only reads use it. So the Letterboxd % will always be blank. TMDB-only results (`TmdbSearchResultItem`) have no vote average. |
| Watch button opens "the first ready-to-play service" | **Partly** | `FilmWatchProvidersResponse` has one `link` per film (TMDB's watch page) and providers with id, name, logo and priority, but **no per-service deep link** (`schemas/watch_providers.py`). TMDB doesn't supply deep links. |
| The not-on-watchlist page (TMDB-only film) | **Partly** | `TmdbSearchResultItem` has only `tmdb_id`, title, year, `overview` and `poster_url` (`schemas/film_schemas.py:127–133`). There's no backdrop, genres, runtime, director, vote average or trailer, and no endpoint for one TMDB film by `tmdb_id`. `TmdbClient.get_movie_details` already gets most of these (`providers/tmdb.py:121`). |
| Surprise me (random pick) and Today's feature (one per day) | **Supported (in the app)** | `GET /films?status=active&limit=1&offset=k`, using `pagination.total`. Surprise picks a random `k`. Today's feature uses a `k` seeded by the UK date. No new endpoint is needed. |
| Where to watch, TMDB search, add to watchlist | **Supported** | `GET /films/{id}/watch-providers`, `GET /films/tmdb-search` and `POST /watchlist/films`. |
| Backdrops for the shuffle strip and Home feature | **Partly** | `backdrop_url` is on `FilmDetail` metadata only, not on `FilmSummary`. |

---

## 3. Design status

### 3.1 Confirmed by Designer · Figma (24 Nov, now in the pack)
1. **Watchlist pills:** Unwatched / Watched / Archived. No All pill, no counts. The line under the title shows the view total.
2. **Tabs:** four (Home, Watchlist, Recommend, More). Recommend runs the questionnaire, then the shuffle, then the programme.
3. **Stars and rating badges:** amber. Create-sheet glow at 35%. Teal only for Saved, links and the active tab. Taste ticks stay flat teal.
4. **Home:** Search films field; then Where to watch (amber sheet), Get a pick for tonight (teal outline, questionnaire), and Surprise me (teal text, sheet with one random pick).
5. **Questionnaire:** 11 steps, one at a time, then the shuffle, then the programme. No ceremony.
6. **Create sheet:** a star tap saves. The date (blank means unknown) and note follow, with autosave and no Save button. Edit keeps Save changes.
7. **In scope:** Close to this (You tab, unwatched only) and Trailer (detail bar and the not-on-watchlist page). Today's feature is one watchlist film per day.
8. **Pack fixes are done:** the tokens.css reduced-motion rule is inside `:root`, and the libraries are described as additions.

### 3.2 Pending Craig (not blockers)

Each is built in one place, behind a single constant or function, so the answer is a one-line change.

| Item | Proposed (Designer's recommendation, which I agree with) | Where it lands |
|---|---|---|
| My services wording | Keep both behaviours: services sort Where to watch, and the filter can hide films. The new line is in README §9. | S8 (the page copy) |
| Runtime buckets | Short ≤90, Medium 91–150, Long >150 minutes. No chip selected means runtime is ignored. | B2 (the filter) and S4 (the chips) |
| Rating sort | The user's own rating on Watched; TMDB on Unwatched and Archived. Nulls last. | B2 and S4 |
| Home row fill rule | Pick from the watchlist using genre, mood and runtime metadata. Rows may refresh. | S2 |

### 3.3 Data gaps found while re-checking (for Designer, low priority; my default is in brackets)
1. **Letterboxd community %.** The spec wants TMDB, RT and Letterboxd. Cuebox never stores a Letterboxd rating, and RT appears only when OMDb is set up. *(Default: show only the scores that exist, and hide a missing chip rather than show "—".)*
2. **"Watch opens the first ready-to-play service."** TMDB gives no per-service deep links, only one TMDB watch page per film. *(Default: open the Where to watch sheet with your services first. Each provider opens TMDB's watch page.)*
3. **How a trailer plays.** The spec doesn't say. *(Default: open the TMDB-listed YouTube trailer in a new tab or app. Hide the button when there's no trailer.)*
4. **Minimum shuffle cruise** isn't locked. *(Default: 2000ms, within "a couple of seconds".)*
5. **Pending reviews (metadata matches and watch reviews).** Today the header shows a review-count badge linking to `/review` (`app-shell.tsx`). The count comes from `GET /films/reviews/pending-count`, which adds up two queues: TMDB metadata matches awaiting confirmation, and pending watch reviews (synced watches that still need a rating). The locked header has no badge, and no screen shows this queue. *(Default: keep `/review` and list it under More as "Reviews" with a count, styled with the shared defaults.)*

---

## 4. Plan

### 4.1 Running it through the workflow with minimal input from Craig
1. **Branch and pack** (after Craig approves). Create `feature/redesign` from main, and commit the pack to it under `docs/design/redesign-2026-11/` (see §4.3).
2. **Parent issue.** One issue, "Cuebox redesign (design handoff 2026-11)", labelled `needs-triage`. It links the pack and this plan's gap table.
3. **Grill.** One cloud agent runs `/grill-with-docs` against the pack and the code.
   - I answer the small questions.
   - Design questions go to Designer · Figma.
   - Only §5 goes to Craig, and it's settled up front.
4. **Tickets.** `/to-tickets` publishes each ticket as a sub-issue with native blocked-by edges.
   - Each body has "## What to build" and a checkbox "## Acceptance criteria", taken from CHECKLIST.md.
   - Each body also says **"Base branch: `feature/redesign`. Open the PR against it, not main."**
   - **Important:** to-tickets adds `ready-for-agent` by default, and the Action doesn't check blockers, so every agent would start at once. I'll publish **without** the label, then label one wave at a time once its blockers have merged into `feature/redesign`.
5. **Build in waves (§4.2).** Each label starts one cloud agent.
   - I review each PR, check CI, and compare its Playwright screenshots at 390×844 against the PNGs.
   - I merge it into `feature/redesign` (Q1).
6. **Dev-instance testing.** Test `feature/redesign` on the homelab dev instance (:3001). Homelab SSH isn't set up yet (Q4).
7. **Final review.**
   - A final sweep ticket, then one PR from `feature/redesign` to main.
   - I send Craig a PR-ready summary: what it does, its tests, and whether it merges cleanly.
   - **Craig merges and deploys.**

### 4.2 Ticket breakdown and dependencies

Codes: **B** = backend-led, **F** = foundations, **S** = screen.

| # | Ticket | Delivers (short) | Blocked by |
|---|---|---|---|
| F1 | Foundations and app shell | Tokens wired into Tailwind and CSS variables. Big Shoulders, Archivo and IBM Plex Mono through `next/font/local`. Cabin, Libre Franklin, Space Mono and the Neo-Noir theme removed. shadcn primitives restyled. The **Cuebox.** wordmark. A header with a **Search films** field slot. Four-tab bar (Home, Watchlist, Recommend, More; teal, flat active tab). Hairlines. Updates the design-smoke and app-shell e2e specs. | — |
| F2 | Shared overlays and motion kit | Adds vaul, sonner, cmdk, framer-motion, @number-flow/react and @radix-ui/react-alert-dialog. Builds one shared set of components: Vaul sheet (800/700ms, 55% dim over 450ms, 120px drag); Sonner (700/600ms, 20px, 2800ms) replacing Radix Toast; the cmdk card shell (700/600ms from 96%); AlertDialog confirm (400ms, 92%, 62%); amber press (4%, 120/200ms); 400ms screen crossfade; NumberFlow at 400ms; the 300ms "More" reveal; a `useReducedMotion` contract; the infinite-scroll hook (600px trigger, `has_more`, flat teal spinner, 300ms fade with a 30ms stagger). | F1 |
| B1 | Watches: create on tap, partial PATCH, no date, delete (API) | `POST /films/{id}/watches` creates a **finished** manual watch from a score alone, with optional date and note. It works from active, pending or watched, marks the film watched, and makes "Log another watch" possible. A migration lets `watched_at` be null. PATCH becomes partial (send only the fields that change; an explicit null clears the date). The sentinel is never written. Null dates show as "Date unknown" and sort as dateless. `DELETE /films/{id}/watches/{watch_id}` keeps the film watched. Tests. | — |
| B2 | List and programme fields (API) | On `GET /films`: `sort=runtime`; `sort=rating` (own latest score on Watched, TMDB elsewhere, nulls last; one switch point, pending Craig); a `genres` filter; a `runtime` bucket filter (≤90 / 91–150 / >150, one constant, pending Craig); and `backdrop_url` plus the **latest score** added to `FilmSummary`. `backdrop_url` and `genres` added to `FilmResult`. Tests. | — |
| B3 | Close to this and Trailer (API) | `GET /films/{id}/similar?limit=` using pgvector against the film's embedding, limited to unwatched (`active`) watchlist films, excluding the film itself. A TMDB `/videos` lookup that adds an official YouTube trailer URL to film detail. A new `GET /films/tmdb/{tmdb_id}` for the lighter page: backdrop, genres, runtime, director, synopsis, TMDB vote average and trailer, built on the existing `get_movie_details`. Tests with mocked TMDB. | — |
| S1 | Programme layout component | The locked programme: backdrop hero, why-this-film, View your pick, and runners-up with provider names. A title prop ("Tonight's programme" or "Sat 14 Nov"), "From your pick at HH:MM · summary", and the settle animation (8px, 70ms, 300ms). | F2, B2 |
| S2 | Home | Layout per `home.png`. Today's feature (one watchlist film per UK day, picked in the app). **Where to watch** (amber sheet), **Get a pick for tonight** (teal outline, links to the questionnaire), **Surprise me** (teal text, sheet with a random pick and Another). Four named rows via one fill-rule function (pending Craig). The arrival motion, with the splash skipped under reduced motion. | F2, B2 |
| S3 | Search and the not-on-watchlist page | The cmdk card from the Search films field on Home and Watchlist. Groups: On your watchlist, then Not on your watchlist. The plus adds a film, with the toast "Added to watchlist". Watchlist hits open their detail page. TMDB-only hits open the lighter page: hero, metadata, community scores, synopsis, and a bar with Trailer, Add to watchlist and More. The old `/search` and `/watchlist/add` routes are replaced. The eye action is wired up in S6. | F2, B3 |
| S4 | Watchlist | Layout. View total under the title. Pills Unwatched / Watched / Archived with no counts. Amber score badges on the Watched grid. The overlapping crossfade (400/600/200ms). Infinite scroll of 18. Filter sheet (genre; Short / Medium / Long) with NumberFlow on "Show N films". Sort sheet (date added, title, year, runtime, rating). The On my services switch comes in S8. | F2, B2 |
| S5 | Film detail | Hero with community % chips (only those present). Overview, Watch (your services first, once S8 lands) and You tabs. Taste ticks (70/330ms, 40%, +90ms, flat teal). Synopsis "More". **Close to this** on the You tab. The sticky bar: Trailer, Watch (amber glow), Watched / Watched? (teal eye), and More. The More sheet (Archive and Remove, no confirm). | F2, B3 |
| S6 | Review | The create sheet: a star tap calls `POST /watches`, then the star-fill lock and Saved; the date (Today, Pick a date, blank) and note slide in; changes PATCH, and the note saves on blur. The edit sheet, with Save changes. "Delete this watch?" confirm. NumberFlow on the score. Wires up the You-tab pencils, "Log another watch", Watched? on the detail bar, and the **eye** in Search. | F2, B1, S3, S5 |
| S7 | Recommendation | The 11-step questionnaire, one per screen (with the "N of 11" counter, a teal progress bar and no tab bar). The shuffle: TMDB backdrops, 420px/s, cruising until the API returns plus a 2000ms minimum, a 2.5s wind-down, the amber highlight and the 580ms expand, into S1's programme with the Recommend tab selected. Reduced motion uses a 300ms crossfade. The ceremony is removed from `/recommend/results/[id]`. | S1 |
| S8 | My services and "On my services" | Settings storage and API for the chosen TMDB providers (GB). The full My services page under More (copy pending Craig). Where to watch and the Watch tab sort your services first. A per-film availability cache with a refresh, an `on_my_services` filter on `GET /films`, and the switch in the Filter sheet. | S4, S5 |
| S9 | History | Ticket stubs (76px, perforation, month labels, watched mark) and the "N nights" total. Search and the Filter sheet. Infinite scroll of 10. The 4% press with no amber. Swipe-left or long-press, then confirm, then `DELETE`. `/history/{id}` shows S1's programme titled with the date, with a 400ms crossfade, Back, and New pick. The ceremony and Previous/Next are removed. | S1 |
| S10 | More, Sync and Import | The More hub (History, My services, Sync, Import, plus the pending-reviews entry from §3.3 item 5), and Sync, Import and `/review` restyled with the shared defaults only. | F2 |
| Z | Acceptance and reduced-motion sweep | Every CHECKLIST.md item, the reduced-motion pass, a screenshot comparison against the PNGs, remaining e2e updates, removal of the dead ceremony and Neo-Noir code, and the `feature/redesign` → main PR. | All of the above |

### Dependencies re-checked in v2
- **S3 now waits on B3**, because the lighter page has a Trailer button.
- **S5 now waits on B3** (Trailer, Close to this).
- **S6 now waits on S3**, as well as S5 and B1, because it wires the Search eye into the create sheet. This stops S3 from depending on S6.
- **S8 now waits on S5 too**, because it changes the Watch tab's order.
- **Nothing depends on the four pending-Craig items.**

### Waves (at most about six agents at once)
- **Wave 1 (straight after approval):** F1, B1, B2 and B3, running in parallel.
- **Wave 2:** F2.
- **Wave 3:** S1, S2, S3, S4, S5 and S10, running in parallel.
- **Wave 4:** S6, S7 and S9, running in parallel; then S8 as soon as S4 and S5 have merged.
- **Wave 5:** Z.

**Critical path:** F1 → F2 → S1 → S7 or S9 → Z. That's five rounds; S6 and S8 fit in alongside. It's tight but realistic before the reset around 30 Nov, as long as merges into the feature branch don't wait on Craig (Q1).

**Keeping parallel PRs from clashing:** F1 and F2 own every shared file (package.json, tailwind config, globals, the app shell, `components/ui`). The backend tickets B1, B2 and B3 touch separate routers and services, but **B1 and B2 both touch `schemas/film_schemas.py` and the film presenter**. Whichever merges second rebases; the change is small.

### 4.3 How agents get the pack
- Commit it to `feature/redesign` under `docs/design/redesign-2026-11/`: README.md, CHECKLIST.md, the tokens, the screens, and the motion folders with their HTML testers, art and fonts.
- **Size:**
  - The full pack is about 63 MB: the MP4s are 9.4 MB, the PDF is 16 MB, and the screens are 14 MB.
  - Without the MP4s and PDF it's about 39 MB on disk. Git stores identical files only once, and the art and fonts are copied into every motion folder, so the real repo growth is about **21 MB**.
  - The repo's history is about 48 MB today.
- **Recommendation:** leave out the PDF (a duplicate of the README), the zips and the MP4s. Agents can't use video well, and the HTML testers plus §6 hold the same locked values.
- No Git LFS (`.gitattributes` covers only `*.sh`).
- F1 copies the four fonts into `frontend/`. Big Shoulders is a variable font with `opsz` 10–72, so the wordmark's opsz 72 works.
- Use the **revised** pack (22:53–22:54 UK time, 24 Nov), not any earlier copy.

---

## 5. Questions for Craig (minimum)

1. **Can I run the waves without checking back with you each time?** That covers creating `feature/redesign`, opening the parent issue and tickets, labelling each wave `ready-for-agent` once its blockers have merged, and merging reviewed ticket PRs into `feature/redesign` once CI is green and the screenshots match. You'd make the single final merge to main. *Recommend: yes.* Your merge and relabel rule still applies to main.
2. **Is it OK to commit the pack into the repo** without the MP4s and PDF (about 21 MB of repo growth)? *Recommend: yes.*
3. **Build "On my services" (S8) in this pass?** It's the one sizeable new backend piece: a saved services list plus a per-film availability cache. *Recommend: yes. It holds nothing else up.*
4. **Dev-instance testing:** while homelab SSH isn't ready, should I rely on CI and screenshot checks per ticket, plus one full test on :3001 before the final PR? *Recommend: yes.*

**Also waiting on Craig, through Designer** (not blockers; see §3.2): the My services wording, the runtime buckets (≤90 / 91–150 / >150), the rating sort (own rating on Watched, TMDB elsewhere), and how Home rows are filled. *Recommend: accept all four of Designer's proposals.*
