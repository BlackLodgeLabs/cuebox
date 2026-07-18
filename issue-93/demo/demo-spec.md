# Demo spec — issue #93: Review watched films

Planning agent artifact. Demo agent follows this exactly.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health checks pass:
  - `curl -sf http://localhost:3000/api/v1/health`
  - `curl -sf http://localhost:8000/api/v1/health`
- Seeded watchlist present (cloud Part 2 gate): at least 10 films with `enrichment_status = ready`
- API keys may show `error` on health — not required for this demo

### Seed steps

1. Confirm seeded data:
   ```bash
   curl -sf "http://localhost:3000/api/v1/films?status=active&limit=1" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   assert d['pagination']['total'] >= 5, 'Need active films'
   print('PASS: active films present')
   "
   ```
2. Pick one active film for manual mark-watched (note title for demo notes).
3. For RSS scenario, use API to simulate pending watch review (execute should expose test helper or use integration test fixture):
   ```bash
   # After implementation: transition a second film to pending_watch_review via API
   # e.g. POST /api/v1/films/{id}/status {"status":"pending_watch_review"}
   # with optional pending watch record pre-filled via RSS test path
   ```
   Demo agent: if no live RSS credentials, create pending state via `POST /films/{id}/status` + pending watch record using the dev API (document film title in demo-notes).

## Scenarios

### Scenario 1: Manual mark watched — complete review

**Goal:** Prove Flow A — mark watched opens dialog, save creates watch record and transitions to `watched`.

**Steps:**

1. Open http://localhost:3000/watchlist?tab=active
2. On a film row, click **Mark watched**
3. Confirm review dialog opens with today's date and empty score
4. Select 3.5 stars, confirm date, add note "Great rewatch"
5. Click **Save**
6. Navigate to **Watched** tab — film appears with score and watched date
7. Open film detail — **Watch history** shows the entry

**Capture:**

- Screenshot: `workflow/issues/issue-93/demo/scenario-1-dialog.png` (dialog open with score selected)
- Screenshot: `workflow/issues/issue-93/demo/scenario-1-watched-tab.png` (film on Watched tab with data)
- Screenshot: `workflow/issues/issue-93/demo/scenario-1-detail-history.png` (watch history on detail page)

**Pass criteria:**

- Dialog requires score and date before save enables
- Film status is `watched` after save
- Watch history shows score, date, and notes snippet
- Film no longer on Active tab

### Scenario 2: Manual mark watched — cancel revert

**Goal:** Prove Flow B — cancel returns film to active watchlist with no watch record.

**Steps:**

1. On Active tab, click **Mark watched** on a different film
2. Close dialog via **Cancel** or overlay dismiss (do not save)
3. Confirm film remains on Active tab only
4. Open film detail — no watch history section

**Capture:**

- Screenshot: `workflow/issues/issue-93/demo/scenario-2-cancel.png` (film still on Active tab after cancel)

**Pass criteria:**

- Film status restored to `active`
- Film not on Watched tab or Review page watch queue
- No watch records on film detail

### Scenario 3: Review page — two sections + combined badge

**Goal:** Prove `/review` shows both metadata and watch review queues; nav badge sums both.

**Steps:**

1. Ensure at least one film in `pending_watch_review` (from Scenario seed or RSS simulation)
2. If metadata review films exist in seed data, note combined count; otherwise watch queue alone is sufficient
3. Open http://localhost:3000/review
4. Confirm page heading **Review** with subtitle covering match + diary work
5. Confirm **Watched films to review** section with pending film card
6. Check nav **Review** link badge reflects combined pending count
7. Click watch-review card → dialog opens with any RSS pre-fills
8. Complete review → card disappears from section

**Capture:**

- Screenshot: `workflow/issues/issue-93/demo/scenario-3-review-page.png` (two sections or watch section visible)
- Screenshot: `workflow/issues/issue-93/demo/scenario-3-nav-badge.png` (badge with count)

**Pass criteria:**

- Watch review section lists `pending_watch_review` films
- Incomplete indicator visible on Watched tab for pending film (before complete)
- Badge count includes watch review queue
- Completing review removes film from queue

### Scenario 4: Edit watch record on film detail

**Goal:** Prove Flow D — edit existing watch record after initial save.

**Steps:**

1. Open film detail for a `watched` film from Scenario 1
2. In **Watch history**, click **Edit** on the record
3. Change score to 4.5 stars and update notes
4. Save
5. Confirm list refreshes with updated values

**Capture:**

- Screenshot: `workflow/issues/issue-93/demo/scenario-4-edit-dialog.png`
- Screenshot: `workflow/issues/issue-93/demo/scenario-4-updated-history.png`

**Pass criteria:**

- PATCH succeeds; UI shows updated score and notes
- Film remains `watched`

### Scenario 5: Metadata match review regression

**Goal:** Confirm existing metadata review flow unchanged.

**Steps:**

1. If seed data includes a film with `enrichment_status = review_required`, open http://localhost:3000/review
2. Confirm **Match review** section still renders TMDB accept/reject cards
3. If no review-required films in seed, note in demo-notes: "No review_required films in seed — regression covered by `verify-phase8-gates.sh`"

**Capture:**

- Screenshot: `workflow/issues/issue-93/demo/scenario-5-metadata-review.png` (if available)
- Otherwise: note gate pass in `demo-notes.md`

**Pass criteria:**

- Metadata match review cards and actions work as before
- No layout regression when only metadata queue has items

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-93/demo/`
- [ ] `workflow/issues/issue-93/demo/demo-notes.md` with short narrative, commit SHA, and films used
- [ ] No secrets in images or logs
