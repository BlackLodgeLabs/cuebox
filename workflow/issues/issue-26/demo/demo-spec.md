# Demo spec — issue #26: Frontend Visual Polish

Planning agent artifact. Demo agent follows this exactly after execute completes.

## Preconditions

- Full Docker stack running (`docker compose ps` — all four services Up)
- Health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`
- Seeded watchlist with at least one **ready** film with TMDB metadata (cloud Part 2 gate or `python3 scripts/seed-dev-db.py`)
- Film with backdrop + `tmdb_id` + `imdb_id` for detail scenarios (e.g. The Matrix in default seed)

### Seed steps

If home shows empty import CTA instead of returning-user dashboard:

```bash
python3 scripts/seed-dev-db.py
# or: docker compose down -v && bash scripts/cloud-start-stack.sh
```

For **Review nav** scenario (Review link only visible when `review-required` count > 0): either import a CSV that yields review-required films, or use browser devtools to confirm mocked count in E2E; on live stack without review films, skip Scenario 1 visual compare and note "N/A — zero review-required in DB" in `demo-notes.md`.

## Scenarios

### Scenario 0: Bug fix verification

**Goal:** Confirm all five reproduced defects are fixed (see `bug-repro-notes.md`).

**Steps:**

1. Open `http://localhost:3000/` — verify watchlist overview card present; **View history** is mint primary (not outline).
2. Open a film detail URL with backdrop (e.g. `/watchlist/<ready-film-id>`) — hero uses top-weighted crop; Metadata links read **View on TMDB** / **View on IMDB**.
3. If review-required films exist (or API mocked): open `/review` — active **Review** nav matches other active nav typography.

**Capture:**

- Screenshot: `workflow/issues/issue-26/demo/scenario-0-fixed-home.png`
- Screenshot: `workflow/issues/issue-26/demo/scenario-0-fixed-film-detail.png`
- Screenshot (if applicable): `workflow/issues/issue-26/demo/scenario-0-fixed-review-nav.png`

**Pass criteria:**

- Observed behavior matches expected behavior in `bug-repro-notes.md` (inverse of each "Actual" row).

---

### Scenario 1: Review nav active typography

**Goal:** Active Review link matches Home/Watchlist active styling.

**Steps:**

1. Ensure `GET /api/v1/films/review-required` returns `pagination.total >= 1` (seed or import).
2. Navigate to `http://localhost:3000/review`.
3. Compare active **Review** link to active **Watchlist** link (visit `/watchlist` in second tab or sequentially).

**Capture:**

- Screenshot: `workflow/issues/issue-26/demo/scenario-1-review-nav.png`

**Pass criteria:**

- Active Review link has mint/accent background and **foreground** (non-muted) label text, consistent with other active nav items.

---

### Scenario 2: Film detail backdrop and metadata links

**Goal:** Top-aligned backdrop and human-readable external links.

**Steps:**

1. Open `http://localhost:3000/watchlist/<film-with-backdrop>`.
2. Scroll to **Metadata** card.
3. Confirm TMDB and IMDb link visible text; click opens correct external URL in new tab (spot-check href in devtools).

**Capture:**

- Screenshot: `workflow/issues/issue-26/demo/scenario-2-film-hero.png` (hero crop)
- Screenshot: `workflow/issues/issue-26/demo/scenario-2-metadata-links.png`

**Pass criteria:**

- Hero image cropped from top (not center-only composition).
- Links display **View on TMDB** and **View on IMDB**; hrefs `https://www.themoviedb.org/movie/{id}` and `https://www.imdb.com/title/{id}`.

---

### Scenario 3: Home watchlist overview card

**Goal:** Returning users see live watchlist count and shortcut.

**Steps:**

1. Open `http://localhost:3000/` (returning-user layout).
2. Note count in **Your watchlist** card matches `curl -sf 'http://localhost:3000/api/v1/films?on_watchlist=true&limit=1' | jq .pagination.total`.
3. Click **View watchlist** → lands on `/watchlist`.

**Capture:**

- Screenshot: `workflow/issues/issue-26/demo/scenario-3-watchlist-card.png`

**Pass criteria:**

- Card visible above three-column grid; correct singular/plural copy; CTA navigates to `/watchlist`.

---

### Scenario 4: View history primary button

**Goal:** History CTA matches peer mint buttons on home.

**Steps:**

1. On `http://localhost:3000/`, locate History card.
2. Visually compare **View history** to **Start questionnaire** and **Add a film**.

**Capture:**

- Screenshot: `workflow/issues/issue-26/demo/scenario-4-history-button.png` (crop to action cards row)

**Pass criteria:**

- **View history** uses primary mint fill (`bg-primary`), not outline border style.

---

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-26/demo/`
- [ ] `workflow/issues/issue-26/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets in images or logs
- [ ] Pre-fix repro artifacts (`bug-repro-*.png`, `bug-repro-notes.md`) preserved for before/after comparison in PR
