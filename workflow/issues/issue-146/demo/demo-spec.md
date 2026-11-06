# Demo spec — issue #146

Application-tier first-run / questionnaire density polish (mobile UI slice f / D7). Demo agent captures phone screenshots of recommend, import, review, and sync on the full Docker stack. No bug Scenario 0 (feature).

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health:
  - `curl -sf $APP_HEALTH_URL_FRONTEND` (from `source scripts/cursor-workflow-config.sh`)
  - `curl -sf $APP_HEALTH_URL_API`
- Branch: `cursor/issue-146-questionnaire-first-run` (or merged agent side-branch tip)
- Draft PR **#156** linked in `workflow.state.json` (**base must be `feature/mobile-ui`**)
- #141 shell present: bottom tabs + Review badge + More → `/settings/sync`
- Phone viewport for primary captures: **390×844** (or Playwright `devices['iPhone 13']`)

### Seed steps

1. **Part 2 seeded watchlist** (≥10 ready films) for questionnaire + sync screens:

   ```bash
   curl -sf "http://localhost:3000/api/v1/films?limit=1" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   assert d['pagination']['total'] >= 10
   assert d['data'][0]['enrichment_status'] == 'ready'
   print('PASS: ready films present')
   "
   ```

2. **Pending reviews (Scenario 3):** Prefer live pending matches if present:

   ```bash
   curl -sf "http://localhost:3000/api/v1/films/reviews/pending-count" | python3 -m json.tool
   ```

   If count is `0`, use mocked Playwright/route interception for `/review` (Accept/Reject visible) — same approach as other mobile-slice demos. Do **not** invent backend data.

3. **Import job status (Scenario 2):** Prefer a real or recently completed job from fixture CSV if available (`letterboxd/watchlist.csv` or Tier 3 fixture). If live import would mutate the seeded DB undesirably, navigate to `/import` for upload chrome and use mocked job status payload for failure-wrap / complete CTAs (include a long `letterboxd_uri` in `failure_summary`).

4. **Empty Home Import CTA (Scenario 2a optional):** Only if demo can temporarily show empty watchlist without destroying the Part 2 volume long-term; otherwise cite unit/e2e evidence that `/` empty state still links **Import watchlist** → `/import` and skip the screenshot.

5. Reduced-motion (optional Scenario 5): `page.emulateMedia({ reducedMotion: 'reduce' })`.

## Scenarios

### Scenario 1: Questionnaire density + progress + Next (phone)

**Goal:** Prove `/recommend` is one-handed: single title stack, progress cue, ≥44px Back/Next, chips/radios usable, no horizontal overflow.

**Steps:**

1. Open http://localhost:3000/recommend at 390×844.
2. Confirm one title for the current step (no duplicate page h1 + card title of the same text).
3. Confirm progress cue (“Step N of 11” and/or thin bar) and sticky/footer **Next** (and **Back** when not on step 1).
4. Measure Back/Next (and at least one chip or radio row on a multi-select / radio step) bounding boxes ≥44px tall.
5. Confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth` (no horizontal overflow).
6. Advance 1–2 steps; optional subtle transition must not break reduced-motion if Scenario 5 is run.

**Capture:**

- Screenshot: `workflow/issues/issue-146/demo/scenario-1-questionnaire-phone.png`
- Optional: `workflow/issues/issue-146/demo/scenario-1-questionnaire-chips.png` (genre or vibe step showing chip hit targets)

**Pass criteria:**

- Clear progress + next affordance
- Primary controls ≥44px
- No duplicate header waste; Neo-Noir tokens; no ceremony-stage chrome

### Scenario 2: Import upload + job progress (phone)

**Goal:** Phone-first upload and readable job aggregates / failure wrapping.

**Steps:**

1. Open http://localhost:3000/import at 390×844.
2. Confirm Choose file / tap-to-select is primary (drag copy secondary or compact); Choose file / Start import ≥44px.
3. Open an import job page (`/import/{jobId}` live or mocked) showing running or complete state with aggregate counts.
4. If failures exist (or mocked), expand failure details and confirm long Letterboxd URIs wrap (no mono horizontal overflow).
5. On complete, confirm Review matches and/or Get recommendation CTAs ≥44px when shown.

**Capture:**

- Screenshot: `workflow/issues/issue-146/demo/scenario-2-import-upload.png`
- Screenshot: `workflow/issues/issue-146/demo/scenario-2-import-job-status.png`

**Pass criteria:**

- Upload understandable on phone
- Aggregate progress plain-language; failures wrap
- No per-film enrichment ticker invented

### Scenario 3: Match review resolve actions (phone)

**Goal:** Review list + Accept / Reject / Choose different are thumb-sized and reachable via Review badge.

**Steps:**

1. From any shell page with pending count > 0, tap **Review** badge → `/review` (or open `/review` with mocked pending items).
2. At 390×844, confirm poster + title/confidence readable.
3. Confirm Accept / Reject / Choose different match (and Letterboxd submit if shown) ≥44px tall.
4. Confirm layout is single-column friendly (not cramped `sm` clusters).

**Capture:**

- Screenshot: `workflow/issues/issue-146/demo/scenario-3-review-actions.png`

**Pass criteria:**

- Primary resolve actions ≥44px
- Review badge path still works
- Neo-Noir; no API behavior change required for pass

### Scenario 4: More → Sync/settings density (phone)

**Goal:** Sync page works under AppShell with compact pickers and readable copy.

**Steps:**

1. Tap **More** tab → `/settings/sync` at 390×844.
2. Confirm CSV re-sync, watched-history import, and RSS sections are all present and operable chrome.
3. Confirm file pickers are compact (not three full desktop dropzones dominating the viewport).
4. Confirm RSS/CSV descriptions are readable (not aggressively truncated).
5. Confirm content clears the bottom tab bar (no obscured primary buttons).

**Capture:**

- Screenshot: `workflow/issues/issue-146/demo/scenario-4-settings-sync.png`

**Pass criteria:**

- All three capabilities visible
- Compact density under shell
- Essential copy readable

### Scenario 5 (optional): Reduced-motion step change

**Goal:** Any step transition honors `prefers-reduced-motion`.

**Steps:**

1. Emulate reduced motion; open `/recommend`; tap Next once.
2. Confirm step advances without long/parallax motion (instant or short crossfade only).

**Capture:**

- Screenshot: `workflow/issues/issue-146/demo/scenario-5-reduced-motion.png` (optional)

**Pass criteria:**

- No ceremony-level motion; reduced-motion safe

### Scenario 6: Ceremony handoff unchanged (smoke)

**Goal:** Questionnaire submit still lands on ceremony stage 1 (do not restyle ceremony).

**Steps:**

1. Prefer mocked recommendation create → navigate expectation, or live submit if `OPENAI_API_KEY` available.
2. Confirm URL contains `/recommend/results/` and `stage=1`.
3. Confirm stage-1 ceremony chrome from #145 still appears (singular winner) — one screenshot enough.

**Capture:**

- Screenshot: `workflow/issues/issue-146/demo/scenario-6-ceremony-handoff.png`

**Pass criteria:**

- Handoff contract preserved (`?stage=1`); no ceremony redesign in this slice

## Artifacts checklist

- [ ] `scenario-1-questionnaire-phone.png` (+ optional chips shot)
- [ ] `scenario-2-import-upload.png`
- [ ] `scenario-2-import-job-status.png`
- [ ] `scenario-3-review-actions.png`
- [ ] `scenario-4-settings-sync.png`
- [ ] Optional: `scenario-5-reduced-motion.png`
- [ ] `scenario-6-ceremony-handoff.png`
- [ ] `workflow/issues/issue-146/demo/demo-notes.md` with short narrative (date, SHA, viewport, seed/mocks used)
- [ ] No secrets in images or logs
