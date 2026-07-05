# Demo spec — issue #35

Planning agent artifact. Demo agent follows this exactly.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` all Up)
- Health checks pass:
  - `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`
  - `curl -sf http://localhost:8000/api/v1/health` → `"status":"ok"`
- Seeded watchlist with at least 2 ready films (default cloud Part 2 / tier-3 fixture)

### Seed steps

No extra seeding required if Part 2 gate passes:

```bash
curl -sf http://localhost:3000/api/v1/films?limit=1 | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['pagination']['total'] >= 2
assert d['data'][0]['enrichment_status'] == 'ready'
print('PASS')
"
```

## Scenarios

### Scenario 0: Bug fix verification

**Goal:** Confirm the Notes step no longer flashes after submit (reproduction from `bug-repro-notes.md`).

**Steps:**

1. Open `http://localhost:3000/recommend`.
2. Complete the questionnaire:
   - Genres: **Horror** → **Next**
   - Steps 2–5: **Next** × 4
   - Emotional outcomes: **Disturbed** → **Next**
   - Visual & tonal vibes: **Atmospheric** → **Next**
   - Steps 9–10: **Next** × 3
3. On **Notes** (step 11), click **Get recommendation**.
4. Watch the transition carefully (or use a short screen recording at 60fps if helpful).
5. Confirm navigation lands on `/recommend/results/{sessionId}` with **Your pick** (or results loading state).

**Capture:**

- Screen recording (recommended): `workflow/issues/issue-35/demo/scenario-0-fixed.mp4` (capture the submit → results transition, ≤30s)
- Screenshot after results load: `workflow/issues/issue-35/demo/scenario-0-fixed.png`

**Pass criteria:**

- **Finding your film…** stays visible from click until the results route loads.
- **Notes** step (heading "Notes", step 11 UI) does **not** appear between loading and results.
- Results page loads successfully.

**Compare to:** `bug-repro-notes.md` and `bug-repro-screenshot.png` (pre-fix showed Notes during transition).

### Scenario 1: Error path unchanged

**Goal:** API failure still returns user to Notes with an error message.

**Steps:**

1. Temporarily break recommendation (e.g. stop API container: `docker compose stop api`) **or** use browser devtools to block `POST /api/v1/recommendations` with a 500 response.
2. Open `http://localhost:3000/recommend`, complete questionnaire through step 11 (same selections as Scenario 0).
3. Click **Get recommendation**.
4. Observe UI after the request fails.
5. Restore API if stopped: `docker compose start api`.

**Capture:**

- Screenshot: `workflow/issues/issue-35/demo/scenario-1-error.png`

**Pass criteria:**

- Loading screen clears after failure.
- User remains on **Notes** step (step 11).
- Error message visible (existing `submitError` copy).
- **Get recommendation** button is clickable for retry.

### Scenario 2: Double-submit protection

**Goal:** Rapid clicks do not create duplicate sessions.

**Steps:**

1. Restore API if needed; open `http://localhost:3000/recommend` and complete questionnaire to step 11.
2. Rapidly double-click **Get recommendation** (or triple-click).
3. Wait for navigation to results.
4. Check browser network tab or history: only one recommendation session created for this submit.

**Capture:**

- Screenshot of results page: `workflow/issues/issue-35/demo/scenario-2-single-session.png`

**Pass criteria:**

- Only one navigation to `/recommend/results/{sessionId}` occurs.
- No duplicate sessions visible in **History** for the same submit attempt.

## Artifacts checklist

- [ ] `scenario-0-fixed.mp4` or `scenario-0-fixed.png` saved under `workflow/issues/issue-35/demo/`
- [ ] `scenario-1-error.png` saved
- [ ] `scenario-2-single-session.png` saved
- [ ] `workflow/issues/issue-35/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets in images or logs
