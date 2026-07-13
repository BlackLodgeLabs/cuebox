# Demo spec — Issue #115: Tabbed watchlist with Watched/Archived lists and manual status management

Planning agent output for demo stage. Follow exactly on the cloud VM with full Docker stack.

## Preconditions

- `docker compose ps` — all four services Up (`postgres`, `api`, `frontend`, `backup`)
- Health checks pass:
  - `curl -sf http://localhost:3000/api/v1/health`
  - `curl -sf http://localhost:8000/api/v1/health`
- Seeded watchlist present (Part 2 gate): at least 10 films with `enrichment_status=ready`
- Frontend: http://localhost:3000
- API: http://localhost:8000

### Seed steps

No custom seed beyond Part 2 bootstrap. For scenarios that need a film in watched/archived state, use the UI or API during the scenario (Scenario 2–3). Optionally pick a seeded film by listing:

```bash
curl -sf "http://localhost:3000/api/v1/films?on_watchlist=true&limit=3" | python3 -m json.tool
```

## Scenarios

### Scenario 1: Tabbed watchlist navigation and counts

**Goal:** Prove three tabs exist, URL sync works, and count badges reflect API totals.

**Steps:**

1. Open http://localhost:3000/watchlist
2. Confirm tabs **Watchlist**, **Watched**, **Archived** with numeric badges.
3. Note Watchlist tab count matches subtitle film count.
4. Click **Watched** — URL becomes `/watchlist?tab=watched` (other query params may persist).
5. Click **Archived** — URL becomes `/watchlist?tab=archived`.
6. Click **Watchlist** — URL returns to `/watchlist` or `?tab=active`.
7. Apply a title filter on Watchlist tab; confirm filters still work and pagination resets on tab change.

**Capture:**

- Screenshot: `workflow/issues/issue-115/demo/scenario-1-tabs.png`

**Pass criteria:**

- Three tabs visible with count badges sourced from list totals.
- Tab selection updates URL `tab` param.
- Watchlist tab shows active films with existing filter/sort behavior.

---

### Scenario 2: Manual mark watched and archive (Watchlist tab)

**Goal:** Prove manual status actions on active films and immediate list exclusion.

**Steps:**

1. On **Watchlist** tab, pick a film (note title).
2. Use row action **Mark watched** (watch icon) — film disappears from Watchlist tab.
3. Open **Watched** tab — film appears with **Removed** date column populated.
4. Return to **Watchlist**, pick another film.
5. Use **Archive** action — confirm dialog explains soft archive (not delete) — confirm.
6. Film disappears from Watchlist; appears on **Archived** tab.

**Capture:**

- Screenshot: `workflow/issues/issue-115/demo/scenario-2-archive-dialog.png` (confirmation dialog)
- Screenshot: `workflow/issues/issue-115/demo/scenario-2-watched-archived-tabs.png` (both tabs showing moved films)

**Pass criteria:**

- Mark watched and archive work from table row without page reload errors.
- Archive requires confirmation.
- Films appear on correct tabs with Removed date.

---

### Scenario 3: Restore from Watched and Archived tabs

**Goal:** Prove restore to active watchlist and forbidden cross-transitions are blocked.

**Steps:**

1. On **Watched** tab, use **Return to watchlist** on the film from Scenario 2.
2. Confirm film reappears on **Watchlist** tab.
3. On **Archived** tab, use **Re-enable on watchlist** on archived film.
4. Confirm film on **Watchlist** tab.
5. (API check) Attempt forbidden transition via curl on a watched film:

```bash
FILM_ID="<watched-film-uuid>"
curl -sf -X POST "http://localhost:8000/api/v1/films/${FILM_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"archived"}' -w "\nHTTP %{http_code}\n" || true
```

Expect HTTP 409.

**Capture:**

- Screenshot: `workflow/issues/issue-115/demo/scenario-3-restore-watchlist.png`
- API response log: `workflow/issues/issue-115/demo/scenario-3-forbidden-409.json` (status code + body)

**Pass criteria:**

- Restore actions return films to Watchlist tab.
- `watched → archived` returns 409.

---

### Scenario 4: Film detail status actions and back link

**Goal:** Prove detail view actions and `?tab=` back navigation.

**Steps:**

1. From **Watchlist** tab, open a film detail (`/watchlist/{id}?tab=active`).
2. Confirm status actions visible (mark watched / archive).
3. Click back link — returns to `/watchlist?tab=active`.
4. Mark film watched from detail page.
5. Open same film from **Watched** tab — back link returns to `/watchlist?tab=watched`.
6. Confirm **Edit match** still available on watched film detail.

**Capture:**

- Screenshot: `workflow/issues/issue-115/demo/scenario-4-detail-back-link.png`

**Pass criteria:**

- Detail actions match tab-appropriate transitions.
- Back link includes correct `tab` query param.
- Edit match remains available on non-active status.

---

### Scenario 5: Additive-only CSV re-sync

**Goal:** Prove CSV re-upload does not remove or reclassify existing films.

**Steps:**

1. Note current active watchlist count and one film title on Watchlist tab.
2. Open http://localhost:3000/settings/sync
3. Upload a CSV containing **only new films** (or use `letterboxd/watchlist.csv` trimmed to a subset plus one new row if available). Alternatively upload a CSV that **omits** an existing active film.
4. Run sync — results show `added` / `unchanged` / `failed` only (no removed/watched counts).
5. Confirm the omitted film **still appears** on Watchlist tab (not archived).
6. Confirm any genuinely new URI appears on Watchlist after enrichment.

**Capture:**

- Screenshot: `workflow/issues/issue-115/demo/scenario-5-sync-settings-results.png`
- Screenshot: `workflow/issues/issue-115/demo/scenario-5-film-still-active.png`

**Pass criteria:**

- Sync results UI shows additive-only fields.
- Films missing from CSV remain on watchlist unchanged.
- New URIs are added.

---

### Scenario 6: Recommendation exclusion after manual watched

**Goal:** Prove watched films are excluded from recommendation candidates (regression).

**Steps:**

1. Mark a `ready` film as watched (UI or API).
2. Start a new recommendation from home page — complete questionnaire.
3. Confirm the watched film does **not** appear in results.

**Capture:**

- Screenshot: `workflow/issues/issue-115/demo/scenario-6-recommendation-excludes-watched.png`

**Pass criteria:**

- Watched film absent from recommendation results.

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-115/demo/`
- [ ] `workflow/issues/issue-115/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets in images or logs
