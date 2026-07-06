# Demo spec — issue #59: Manual Film Metadata Rematch

Planning agent artifact. Demo agent follows this exactly.

## Preconditions

- Full Docker stack running (`docker compose ps` — all four containers `Up`)
- Health checks pass:
  - `curl -sf http://localhost:8000/api/v1/health`
  - `curl -sf http://localhost:3000/api/v1/health`
- Seeded watchlist present (cloud Part 2 gate: ≥10 films with `enrichment_status: ready`)
- `TMDB_API_KEY` set in `.env` (required for live TMDB search in the modal)
- Pick a film that is `ready` with visible metadata (e.g. from watchlist) for Scenario 1

## Scenarios

### Scenario 1: Fix a wrong match on a ready film (Flow A)

**Goal:** Prove the Edit Film Match modal searches TMDB, rematches, and the detail page updates after enrichment.

**Steps:**

1. Open http://localhost:3000/watchlist
2. Click any `ready` film row to open `/watchlist/{id}`
3. Screenshot the detail page **before** rematch (note current poster/title/metadata)
4. Click **Edit Film Match**
5. Screenshot the open modal with search pre-filled from Letterboxd title
6. Adjust the search query if needed; wait for TMDB results to load
7. Select a different (or same) TMDB result and click **Confirm match**
8. Observe enriching state on the detail page (badge or loading note)
9. Wait until enrichment completes (`ready`) — up to ~30s
10. Screenshot the detail page **after** rematch showing updated metadata

**Capture:**

- Screenshot: `workflow/issues/issue-59/demo/scenario-1-detail-before.png`
- Screenshot: `workflow/issues/issue-59/demo/scenario-1-modal-search.png`
- Screenshot: `workflow/issues/issue-59/demo/scenario-1-detail-after.png`
- Screen recording (optional): `workflow/issues/issue-59/demo/scenario-1.mp4` (≤45s)

**Pass criteria:**

- **Edit Film Match** button visible on a `ready` film
- Modal opens with pre-filled search and scrollable results (poster, title, year)
- After confirm, film shows `enriching` then returns to `ready`
- Poster and/or synopsis reflect the chosen TMDB match
- No full page reload required for status/metadata update

---

### Scenario 2: Recover a failed film (Flow B)

**Goal:** Prove rematch works when metadata/semantic data is absent (`failed` state).

**Steps:**

1. Identify a `failed` film via watchlist filter or import a CSV row that fails auto-match (if none seeded, use API/dev tools to find one, or reject a review candidate first)
2. Open `/watchlist/{id}` for the failed film
3. Screenshot sparse detail page (no metadata card or empty enrichment message) with **Edit Film Match** still visible
4. Open modal, search, select a valid TMDB result, confirm
5. Wait for `ready`
6. Screenshot detail page with populated metadata and semantic profile

**Capture:**

- Screenshot: `workflow/issues/issue-59/demo/scenario-2-failed-before.png`
- Screenshot: `workflow/issues/issue-59/demo/scenario-2-ready-after.png`

**Pass criteria:**

- **Edit Film Match** visible on `failed` film
- Rematch transitions `failed → enriching → ready`
- Metadata and semantic profile sections populated after completion

---

### Scenario 3: Override review candidate (Flow C)

**Goal:** Prove review page links to film detail and manual rematch supersedes pending review.

**Steps:**

1. If no films in `review_required`, import a CSV title likely to need review (ambiguous title) or use an existing pending review from seed data
2. Open http://localhost:3000/review
3. Screenshot review card showing proposed match
4. Click through to `/watchlist/{film_id}` via the new film title link (or **Choose different match**)
5. Use **Edit Film Match** to pick a TMDB result **different** from the proposed candidate
6. Confirm rematch; wait for `ready`
7. Return to http://localhost:3000/review — film should no longer appear in the queue
8. Screenshot empty or reduced review list

**Capture:**

- Screenshot: `workflow/issues/issue-59/demo/scenario-3-review-card.png`
- Screenshot: `workflow/issues/issue-59/demo/scenario-3-review-cleared.png`

**Pass criteria:**

- Review page film title links to `/watchlist/{film_id}`
- After rematch, film absent from `/review` pending list
- Film detail shows user-selected metadata (`metadata_source` may show as manual in API; UI shows correct poster/title)

---

### Scenario 4: Entry from recommendation results (Flow D)

**Goal:** Prove existing watchlist links from results lead to rematch flow.

**Steps:**

1. Open http://localhost:3000/recommend and complete a recommendation (or open an existing history result)
2. On the results page, click the watchlist link on a recommended film card
3. Screenshot film detail opened from results with **Edit Film Match** visible

**Capture:**

- Screenshot: `workflow/issues/issue-59/demo/scenario-4-from-results.png`

**Pass criteria:**

- `CardWatchlistLink` navigates to `/watchlist/{id}`
- **Edit Film Match** available from results-derived navigation

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-59/demo/`
- [ ] `workflow/issues/issue-59/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets (API keys, tokens) visible in images or logs
- [ ] Optional recording kept under 45s if included
