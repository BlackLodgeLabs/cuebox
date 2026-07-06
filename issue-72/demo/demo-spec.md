# Demo spec — issue #72: TMDB Real-Time Watch Providers

Planning agent artifact. Demo agent follows this exactly.

## Preconditions

- Full Docker stack running (`docker compose ps` — all four containers `Up`)
- Health checks pass:
  - `curl -sf http://localhost:8000/api/v1/health`
  - `curl -sf http://localhost:3000/api/v1/health`
- Seeded watchlist present (cloud Part 2 gate: ≥10 films with `enrichment_status: ready`)
- `TMDB_API_KEY` set in `.env` (required for live watch-provider data from TMDB)
- Pick a `ready` film with a linked `tmdb_id` (e.g. from watchlist) for Scenarios 1–2

### Seed steps

Default Part 2 seed is sufficient. If watchlist is empty:

```bash
python3 scripts/seed-dev-db.py
```

To find a film with providers, query the API after stack boot:

```bash
curl -sf "http://localhost:3000/api/v1/films?limit=5&enrichment_status=ready" | python3 -m json.tool
```

## Scenarios

### Scenario 1: Film detail Where to Watch (Flow A)

**Goal:** Prove the film detail page shows a grouped **Where to Watch** section with UK provider logos and JustWatch attribution.

**Steps:**

1. Open http://localhost:3000/watchlist
2. Click a `ready` film with metadata to open `/watchlist/{id}`
3. Scroll to the **Where to Watch** card (between Metadata and Semantic profile)
4. Screenshot the populated section showing at least one category (Stream, Rent, Buy, or Free with Ads) with provider logos and names
5. Verify JustWatch/TMDB attribution text appears in the card footer

**Capture:**

- Screenshot: `workflow/issues/issue-72/demo/scenario-1-where-to-watch.png`

**Pass criteria:**

- **Where to Watch** card visible on a `ready` film with `tmdb_id`
- Providers grouped by category with logos and names
- JustWatch/TMDB attribution present in footer
- No full-page error; loading skeleton transitions to content

---

### Scenario 2: Recommendation results provider icons (Flow B)

**Goal:** Prove recommendation result cards show condensed streaming platform icons.

**Steps:**

1. Open http://localhost:3000/recommend (or use an existing history session if faster)
2. Complete the questionnaire to reach `/recommend/results/{sessionId}` (or open a recent history result)
3. Screenshot the winner card showing small provider icons below the ratings row
4. If runners-up are present, confirm at least one runner-up card also shows icons (or omits the row when no providers)

**Capture:**

- Screenshot: `workflow/issues/issue-72/demo/scenario-2-results-icons.png`
- Screen recording (optional): `workflow/issues/issue-72/demo/scenario-2.mp4` (≤30s)

**Pass criteria:**

- Winner card displays provider logo icons below TMDB/RT ratings
- Icons are visually condensed (not full detail layout)
- Cards without UK providers omit the icon row (no broken empty box)
- User can click through to film detail for full **Where to Watch** section

---

### Scenario 3: History detail inherits results icons (Flow C)

**Goal:** Prove history detail reuses `ResultsView` and shows the same provider icons.

**Steps:**

1. Open http://localhost:3000/history
2. Click a past recommendation session to open `/history/{sessionId}`
3. Screenshot the detail page showing provider icons on the winner card (same layout as Scenario 2)

**Capture:**

- Screenshot: `workflow/issues/issue-72/demo/scenario-3-history-icons.png`

**Pass criteria:**

- History detail shows provider icons identically to recommendation results
- No additional wiring or duplicate fetch errors in browser console

---

### Scenario 4: Empty UK providers fallback

**Goal:** Prove graceful empty-state when TMDB returns no GB providers.

**Steps:**

1. Identify a film that returns empty `categories` (may require API inspection: `curl -sf http://localhost:8000/api/v1/films/{id}/watch-providers`)
2. If no naturally empty film is available in seed data, use a mocked Playwright run or document the API response in `demo-notes.md` and screenshot the UI after execute wires the empty-state copy
3. Open `/watchlist/{id}` for that film
4. Screenshot the **Where to Watch** card showing: *"No streaming options currently listed for the UK."*

**Capture:**

- Screenshot: `workflow/issues/issue-72/demo/scenario-4-empty-uk.png`
- Optional API capture: `workflow/issues/issue-72/demo/scenario-4-api-response.json` (redact keys)

**Pass criteria:**

- Empty-state message displayed; no broken layout or spinner stuck loading
- HTTP 200 with `categories: []` from backend (verify via curl if needed)

---

### Scenario 5: Film without TMDB match guidance

**Goal:** Prove helpful message when film has no `tmdb_id`.

**Steps:**

1. Find or create a film without TMDB metadata (e.g. `failed` or `review_required` state without `tmdb_id`, or import a row that fails auto-match)
2. Open `/watchlist/{id}` for that film
3. Screenshot the **Where to Watch** section showing guidance to match TMDB metadata (e.g. *"Match TMDB metadata to see streaming options."*)

**Capture:**

- Screenshot: `workflow/issues/issue-72/demo/scenario-5-no-tmdb-id.png`

**Pass criteria:**

- Guidance message shown instead of provider logos or a generic error
- **Edit Film Match** affordance reachable from the same page (issue #59 flow)

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-72/demo/`
- [ ] `workflow/issues/issue-72/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets (API keys, tokens) visible in images or logs
- [ ] Optional recording kept under 30s if included
