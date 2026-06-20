# Manual Testing Plan

Post-build sign-off checklist for Cuebox. Use this after automated verification passes and the Docker stack is running with **real API keys** and your own Letterboxd watchlist export.

## Scope

This plan covers checks that **cannot be fully validated by CI or gate scripts alone**:

- Live provider integrations (TMDB, OpenAI, etc.)
- Real Letterboxd CSV ingestion and enrichment at production scale
- Subjective UX quality (copy, layout, explanations, responsiveness)
- End-to-end flows that depend on your watchlist content (match review, constraint relaxation, etc.)

### Already covered automatically (run first)

Complete these before manual testing. They do **not** need repeating here:

| Check | Command |
|-------|---------|
| Phase 8 gates (lint, integration suite, NFR timing, PRD audit, frontend build, Phase 7 regression) | `bash scripts/verify-phase8-gates.sh` |
| Full API test suite | `cd api && DATABASE_URL=… TEST_DATABASE_URL=… pytest tests/ -v` |
| Frontend types and unit tests | `cd frontend && npx tsc --noEmit && npm run test:unit` |
| Optional full-stack Playwright E2E (5-film fixture, mocked journey) | `PLAYWRIGHT_E2E_STACK=1 cd frontend && npm run test:e2e` |
| Optional API smoke (import job, health, review accept via curl) | `bash scripts/smoke-test.sh` |

Playwright E2E uses a tiny fixture (`frontend/e2e/fixtures/watchlist-small.csv`) with mocked or accelerated providers. Manual testing uses **your real watchlist** and live keys.

---

## Prerequisites

1. **Build and gates green** — `bash scripts/verify-phase8-gates.sh` exits successfully.
2. **Configuration** — from the repo root:
   ```bash
   cp config.example.yaml config.yaml
   cp .env.example .env
   ```
   Edit `.env` with at least `TMDB_API_KEY` and `OPENAI_API_KEY` (default `config.yaml` uses OpenAI for semantic enrichment, embeddings, and ranking). For Docker Compose, set:
   ```
   DATABASE_URL=postgresql+psycopg://cuebox:cuebox@postgres:5432/cuebox
   ```
3. **Fresh install** — start with an empty database so you exercise the true first-time journey:
   ```bash
   docker compose down -v
   docker compose up
   ```
4. **Watchlist export** — export your Letterboxd watchlist as CSV (Settings → Data → Export your data). Save it as `letterboxd/watchlist.csv` or note the path for upload. Use a watchlist with enough variety (genres, years, runtimes) to get meaningful recommendations.
5. **Browser** — use a desktop browser (Chrome or Firefox recommended). Keep one tab open for the whole run unless a test says otherwise.
6. **Time** — allow 15–45 minutes for enrichment on a medium watchlist (depends on film count and provider rate limits).

### Sign-off

Record **Pass / Fail / N/A** and brief notes for each test.

| # | Test | Pass | Notes |
|---|------|------|-------|
| 1 | Environment and first launch | | |
| 2 | Import watchlist | | |
| 3 | Import progress | | |
| 4 | Metadata match review | | |
| 5 | Home after import | | |
| 6 | Recommendation questionnaire | | |
| 7 | Results screen | | |
| 8 | Recommendation history | | |
| 9 | Second recommendation | | |
| 10 | Sync settings | | |
| 11 | Navigation and layout | | |
| 12 | Session persistence | | |
| 13 | Developer Mode (optional) | | |

---

## Test sequence

Follow tests **in order**. Each step builds on the previous one. None of the required tests should force you to wipe the database or re-import a different watchlist mid-run.

---

### 1. Environment and first launch

**Goal:** Confirm the stack is healthy with live keys and the empty-state UI is correct.

**Steps:**

1. Open http://localhost:3000
2. Confirm the page shows **Welcome to Cuebox**, a short description, and an **Import watchlist** button.
3. Confirm the dark neo-noir theme loads (dark background, **Cuebox** wordmark in the header, no light-theme flash).
4. Expand **System status** at the bottom of the page.
5. Confirm **API** and **DB** show `ok`, and a version string is visible.
6. Open http://localhost:8000/api/v1/health in a second tab (or use curl).
7. Confirm `status` and `database` are `ok`, and `providers.embedding`, `providers.semantic_enrichment`, and `providers.ranking` are all `ok` (not `error`).

**Pass if:** Empty-state home renders correctly; API health reports all providers `ok`.

**Fail if:** Provider keys show `error`, the frontend cannot reach the API, or the database is unreachable.

---

### 2. Import watchlist

**Goal:** Upload your real Letterboxd export and receive an immediate job ID.

**Steps:**

1. Click **Import watchlist** (or go to http://localhost:3000/import).
2. Read the on-page instructions. Confirm they mention Letterboxd export columns (Date, Title, Year, Letterboxd URI).
3. Select your Letterboxd CSV file using the file picker or drag-and-drop.
4. Click **Start import**.
5. Confirm you are redirected to `/import/{jobId}` within about one second (no long blocking spinner on the upload button).

**Pass if:** Redirect to the import status page happens immediately after upload.

**Fail if:** Upload hangs, returns an inline error for a valid Letterboxd CSV, or never navigates to a job page.

---

### 3. Import progress

**Goal:** Monitor live enrichment until the job completes.

**Steps:**

1. On the import status page, confirm the heading shows **Enriching films…** while the job runs.
2. Watch the progress bar and **processed / total** counter update over time (page polls automatically; no manual refresh required).
3. When complete, confirm the heading changes to **Import complete** and the description says all films were processed.
4. Review the summary counters (**Processed**, **Failed**, **Duplicates skipped**, **Total**). Numbers should be internally consistent (`Processed` ≈ `Total` minus duplicates; `Failed` should be low or zero for a standard export).
5. If **Failed** > 0, expand **Show failure details** and spot-check that each entry shows a Letterboxd URI and a human-readable reason.
6. Note the primary call-to-action when complete: either **Review matches (N)** or **Get a recommendation**.

**Pass if:** Job reaches **Import complete**; progress was visible during the run; failure count is acceptable for your export (ideally zero).

**Fail if:** Job stays stuck on **Enriching films…** for an unreasonable time with no counter movement, ends in **Import failed**, or processed count does not match your CSV.

> **Do not** re-upload a different CSV or run sync until Test 10. Continue with the CTA shown on this page.

---

### 4. Metadata match review

**Goal:** Resolve ambiguous TMDB matches so all intended films become recommendable.

**Steps:**

1. If the import page offered **Review matches**, click it (or use the **Review** nav item if a badge appears). If no review was needed, go to http://localhost:3000/review and confirm **All matches resolved** — then skip to Test 5.
2. For each pending film card, confirm you see:
   - Your imported title and year
   - Proposed TMDB title, year, director (if available), and poster
   - A confidence percentage
3. For each film, click **Accept** when the proposed match looks correct.
4. If a proposed match is clearly wrong, click **Reject** for that film only (rejected films are excluded from recommendations until re-imported). Prefer **Accept** when unsure so you do not lose recommendable titles.
5. When the queue is empty, confirm **All matches resolved** and click **Get a recommendation** (or return to Home).

**Pass if:** All films you care about are accepted (or only deliberately rejected mismatches remain); review badge clears from the header.

**Fail if:** Accept/Reject buttons error, cards fail to load, or accepted films still block recommendations later.

---

### 5. Home after import

**Goal:** Confirm the app treats you as a returning user with a populated watchlist.

**Steps:**

1. Go to http://localhost:3000 (Home nav).
2. Confirm the heading is **What do you want to watch?** (not the first-time welcome).
3. Confirm two cards: **New recommendation** → **Start questionnaire**, and **History** → **View history**.
4. Confirm there is **no** “Films need review” warning card (unless you intentionally left rejections in Test 4).
5. Expand **System status** again; API and DB should still be `ok`.

**Pass if:** Returning-user home state is shown with recommendation and history entry points.

---

### 6. Recommendation questionnaire

**Goal:** Complete the full 11-step wizard with validation checks, optional notes, and a live recommendation request.

**Steps:**

1. Click **Start questionnaire** (or Recommend in the nav).
2. **Validation (Genres step):** Click **Next** without selecting anything. Confirm an inline error asks you to select at least one genre or No Preference.
3. Select **Horror** and **Next**. Click **Back** to Genres and confirm your selection persisted.
4. **Validation (No Preference):** Select **No Preference** and one other genre. Click **Next**; confirm an error that No Preference cannot be combined with other genres. Clear to a valid selection before continuing.
5. Complete the remaining steps, exercising at least one choice on each screen:
   - Runtime, Viewing context, Thinking effort, Pacing
   - Emotional outcomes (pick at least one)
   - Visual & tonal vibes (pick at least one)
   - Era, Subtitles, Obscurity
6. On **Notes**, enter a short free-text note (e.g. “Something slow-burn and atmospheric”).
7. Click **Get recommendation**.
8. Confirm the **Finding your film…** holding screen appears with the “up to 30 seconds” message.
9. Confirm you land on `/recommend/results/{sessionId}` within 30 seconds.

**Pass if:** Validation messages work; Back preserves answers; submission completes within 30 seconds and navigates to results.

**Fail if:** Submission errors, hangs beyond 30 seconds, or returns a user-visible error without recovery.

---

### 7. Results screen

**Goal:** Validate PRD success criterion #18 — one winner, four runners-up, and structured reasoning — in the live UI.

**Steps:**

1. Confirm the page heading is **Your pick** with a timestamp.
2. **Winner card:**
   - **Top pick** badge, poster, title, year, director, runtime
   - **Synopsis** (film overview text)
   - **TMDB** and **Rotten Tomatoes** scores (show `—` when unavailable; Letterboxd is not shown on this screen)
   - **Why it matches** prose (readable, specific to your questionnaire — not generic placeholder text)
   - **Key factors** badges
   - **Why it beat alternatives** (winner only, when present)
   - **Caveats** (when present)
3. **Runners-up section:** Confirm exactly **four** runner-up cards (or fewer only if your watchlist is very small — note if so). Each should have title, poster, TMDB/RT scores, and **Why it matches** text.
4. Click the **Top pick** card and confirm navigation to `/watchlist/[filmId]` for that film. Return to results and click a runner-up card — same behavior.
5. If a yellow **Some constraints were relaxed** banner appears, read it — the listed relaxations should make sense for your answers.
6. Click **View answer summary**. Confirm a narrative profile and structured JSON reflect your questionnaire (including notes if provided). Close the sheet.
7. Click **View history** and confirm you see the session you just created (continue to Test 8 for detail).

**Pass if:** One clear winner, up to four runners-up with explanations, TMDB/RT ratings (no Letterboxd on results cards), clickable cards to watchlist detail, and the answer summary matches your inputs. Explanations feel coherent and watchlist-specific — including key factors and why-it-beat-alternatives on the winner after the page reloads (GET round-trip).

**Fail if:** Missing winner, empty or truncated winner explanations after reload, obvious hallucinated titles not in your watchlist, ratings show Letterboxd instead of TMDB, cards are not clickable, or broken layout.

---

### 8. Recommendation history

**Goal:** Audit past sessions via list, filters, and detail view.

**Steps:**

1. On http://localhost:3000/history, confirm your new session appears with poster, winner title, preference summary, and date.
2. Click the session card. Confirm the detail page shows the winner title as the heading and the same results content as Test 7 (winner, runners-up, explanations).
3. On the detail page, confirm **New recommendation** and **View history** action buttons are present.
4. Return to the history list. In **Search by title**, type part of the winner’s title; confirm the list filters after a short debounce.
5. Set **date from** to today’s date; confirm the session still appears.
6. Set **Watch status** to **Unwatched** (or **All statuses** if status is unset); confirm sensible results.
7. If you have more than 20 sessions, use **Next** / **Previous** pagination; otherwise confirm pagination buttons are disabled appropriately.

**Pass if:** List and detail match the results page; search and date filters work; navigation between list and detail is smooth.

---

### 9. Second recommendation

**Goal:** Confirm returning-user flow works without re-importing and produces a distinct session.

**Steps:**

1. From Home or history, start a **New recommendation**.
2. Choose a clearly different mood (e.g. **Comedy**, short runtime, **Lighthearted** emotional outcome).
3. Submit and wait for results.
4. Confirm a **new** results URL (`sessionId` differs from Test 7).
5. Confirm the winner is plausible for the new preferences (exact title may vary between runs — that is expected).
6. Open **History** and confirm **two** sessions are listed, newest first.

**Pass if:** Second recommendation completes successfully and both sessions appear in history.

**Fail if:** Second run errors, reuses the same session, or shows films that contradict your stated preferences with no relaxation banner explanation.

---

### 10. Sync settings

**Goal:** Configure sync options and verify non-destructive re-sync against the **same** export used in Test 2.

**Steps:**

1. Go to http://localhost:3000/settings/sync (Settings in the nav).
2. **RSS sync:**
   - Enter your Letterboxd username.
   - Click **Save RSS config** and confirm no error.
   - In **RSS status**, confirm **Configured: Yes**, your username, poll interval **900s** (15 minutes), and **Last polled** updates after a short wait (background job runs every 15 minutes; refresh the page after ~1 minute to see if a poll occurred).
3. **CSV re-sync (same file):**
   - Upload the **same** CSV file you used in Test 2.
   - Click **Sync watchlist**.
   - Confirm **Sync complete** with counts dominated by **Unchanged** (Added/Removed/Watched should be 0 unless you changed Letterboxd since Test 2).
4. Return to Home and confirm you can still start a new recommendation without re-importing.

**Pass if:** RSS config saves and status displays; re-sync with the same file does not disrupt your watchlist or force a full re-ingestion.

**Fail if:** Sync reports unexpected mass Added/Removed, breaks recommendations, or RSS config fails to persist.

> **Avoid** uploading a different CSV or a export with removed films during this sign-off run — that would require a new ingestion path.

---

### 11. Navigation and layout

**Goal:** Manual design-system walkthrough not fully covered by Playwright visual smoke.

**Steps:**

1. At **1280px** browser width, visit each route and confirm readable layout without horizontal scroll:
   - `/`, `/import`, `/review`, `/recommend`, `/history`, `/settings/sync`, and one results/history detail URL from earlier tests.
2. Resize to **375px** width (mobile). Confirm:
   - Header nav shows icons; labels may hide on small screens.
   - Cards stack vertically; buttons remain tappable.
   - Questionnaire **Back** / **Next** remain usable.
3. On any page, confirm hover states on cards (subtle glow) and chamfered primary buttons match the dark theme described in [DESIGN.md](./DESIGN.md).
4. Confirm the main content area uses the scanline texture overlay (subtle; visible on large empty areas).

**Pass if:** All nine routes are usable at desktop and mobile widths without broken layout.

---

### 12. Session persistence

**Goal:** Confirm deep links and refresh behave correctly after the journey above.

**Steps:**

1. Copy the results URL from Test 7 (`/recommend/results/{sessionId}`). Open it in a new tab; confirm results load without re-running the questionnaire.
2. Copy a history detail URL (`/history/{sessionId}`). Refresh the page; confirm the same session reloads.
3. Use the browser **Back** button from results to the questionnaire; confirm you do not accidentally resubmit (you should see the questionnaire, not a duplicate POST).

**Pass if:** Bookmarked URLs reload correctly; browser navigation does not corrupt state.

---

### 13. Developer Mode (optional)

**Goal:** Inspect recommendation internals when `developer_mode` is enabled. Skip if you keep the default `developer_mode: false`.

**Steps:**

1. Set `developer_mode: true` in `config.yaml`. Restart the API container (`docker compose restart api`).
2. Open a results or history detail page from Tests 7–8 with `?dev=1` appended to the URL.
3. Confirm the **Developer Mode** panel appears with tabs: **Retrieval**, **Scoring**, **AI**, **Versions**.
4. Click through each tab; confirm real trace data loads (profile hash, candidate films, scoring signals, token counts, version metadata).
5. Remove `?dev=1`, focus the main content, press `Ctrl+Shift+D` (or `Cmd+Shift+D` on macOS). Confirm the panel toggles open and closed.
6. Set `developer_mode: false` and restart the API. Reload with `?dev=1`; confirm the panel does **not** appear.

**Pass if:** Panel shows live trace data when enabled and is hidden when disabled.

---

## Out of scope for this run

The following are valuable but **intentionally excluded** so a single pass does not require re-ingestion or infrastructure teardown:

| Item | Why excluded | Where covered |
|------|----------------|---------------|
| Provider swap via `config.yaml` only (PRD #22) | Requires API restart and a second config | Change providers in `config.yaml`, restart API, confirm recommendations still work |
| Empty watchlist / `INSUFFICIENT_CANDIDATES` error UX | Would require removing all films | Integration tests + deliberate edge-case session |
| Stopping Docker to test API-down error state | Disrupts live run | `frontend` unit tests; optional manual tear-down |
| Large watchlist performance benchmark | Optional slow test | `RUN_SLOW_PERF=1 pytest …test_recommendation_large_watchlist_under_30_seconds` |
| Re-import after rejected reviews | Could force re-ingestion | Phase 2 gate notes; separate regression session |

---

## Troubleshooting

| Symptom | Things to check |
|---------|------------------|
| Providers show `error` on `/health` | `OPENAI_API_KEY`, `TMDB_API_KEY` in `.env`; API container restarted after editing `.env` |
| Import stuck at 0 processed | TMDB key valid; API logs (`docker compose logs api`) |
| Recommendation timeout | OpenAI key and quota; watchlist has films with `enrichment_status = ready` |
| No films in results | Pending reviews unresolved; all candidates filtered by subtitle/runtime constraints |
| RSS never polls | Username saved; wait up to 15 minutes or check API logs for scheduler errors |

---

## Related documents

- [README.md](../README.md) — setup and quick start
- [PRD.md](./PRD.md) — success criteria (§23)
- [DESIGN.md](./DESIGN.md) — visual specification
- [AGENTS.md](../AGENTS.md) — automated gate commands
