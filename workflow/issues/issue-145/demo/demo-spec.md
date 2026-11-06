# Demo spec — issue #145

Application-tier recommendation ceremony (mobile UI slice e / D5). Demo agent captures stages 1→2→3, history→3, replay, and reduced-motion on the full Docker stack (mocked recommendation payload when the seeded history session lacks runners-up).

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health:
  - `curl -sf $APP_HEALTH_URL_FRONTEND` (from `source scripts/cursor-workflow-config.sh`)
  - `curl -sf $APP_HEALTH_URL_API`
- Part 2 seeded watchlist present (≥10 ready films)
- Branch: `cursor/issue-145-recommendation-ceremony` (or merged agent side-branch tip)
- Draft PR **#154** linked in `workflow.state.json` (**base must be `feature/mobile-ui`**)
- #141 shell present: bottom tabs + header search / Review badge

### Seed steps

1. Confirm history exists (stage 3 / live degrade path):

   ```bash
   curl -sf "http://localhost:3000/api/v1/recommendations?limit=5" | python3 -m json.tool
   ```

   Note a `session_id` (Part 2 often includes Matrix). **Inspect runners_up count** via:

   ```bash
   SESSION_ID=<id>
   curl -sf "http://localhost:3000/api/v1/recommendations/$SESSION_ID" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   print('winner', d['winner']['title'])
   print('runners', len(d.get('runners_up') or []))
   print('profile_summary', bool(d.get('profile_summary')))
   "
   ```

2. **Ceremony fixture (required for stage 2):** If live `runners_up` length is `< 2`, do **not** rely on that session for swipe captures. Use the mocked Playwright ceremony fixture (winner + four runners-up + explanations + `profile_summary`) — same approach as `e2e/helpers/watch-providers-mocks.ts` / `e2e/recommendation-ceremony.spec.ts`. Demo agent may either:
   - Run the mocked Playwright scenarios and save the listed screenshot filenames under `workflow/issues/issue-145/demo/`, **or**
   - Intercept `/api/v1/recommendations/{id}` in the browser session with a full five-film payload before navigating.

3. Phone viewport for primary captures: **390×844** (or Playwright `devices['iPhone 13']`). One desktop (`≥768px`) capture of stage 2/3 is enough to show the same ceremony metaphor (wider carousel OK — not a flat all-cards dashboard).

4. Fresh questionnaire → results path is optional for screenshots if API ranking keys are unavailable; **Replay from stage 3** (with armed gate + full mock payload) is the preferred way to capture stages 1 and 2 without a live ranking call.

5. For reduced-motion: emulate `prefers-reduced-motion: reduce` in Playwright (`page.emulateMedia({ reducedMotion: 'reduce' })`) or DevTools Rendering.

## Scenarios

### Scenario 1: Stage 1 — singular winner (phone)

**Goal:** Prove fresh/replay stage 1 is poster-led with **short** reasons only; no where-to-watch or questionnaire summary.

**Steps:**

1. Enter ceremony at stage 1 (Replay from a stage-3 session with full mock payload, or fresh questionnaire navigate to `?stage=1`).
2. At 390×844, confirm dominant winner poster, title, key factors + short why-it-matches.
3. Confirm **no** watch-provider icons, **no** answer-summary sheet/section, **no** skip control.
4. Confirm progress chrome (e.g. 1 / 2 / 3) and a **Next** control ≥44px tall.

**Capture:**

- Screenshot: `workflow/issues/issue-145/demo/scenario-1-stage1-winner.png`

**Pass criteria:**

- Singular winner focus; short reasons only
- No providers / questionnaire summary on stage 1
- Clear Next path (criterion **A**); Neo-Noir tokens

### Scenario 2: Stage 2 — swipeable runners-up (phone)

**Goal:** Runners-up are a swipe/scroll-snap row; focused item uses winner-like short layout (criterion **D**).

**Steps:**

1. From stage 1, tap **Next** → URL `stage=2`.
2. Confirm horizontal swipeable poster row with ≥2 runners-up (use mock fixture if live seed is empty).
3. Swipe/focus a non-first runner; confirm short reasons for the focused film.
4. Confirm still **no** where-to-watch / questionnaire summary; **Next** visible.

**Capture:**

- Screenshot: `workflow/issues/issue-145/demo/scenario-2-stage2-runners.png`

**Pass criteria:**

- Swipe/focus metaphor obvious
- Short reasons only on focused runner
- No providers on stage 2

### Scenario 3: Stage 3 — durable session record (phone)

**Goal:** Stage 3 reads as the full session record (criterion **D**).

**Steps:**

1. From stage 2, tap **Next** → URL `stage=3` (history stack should use `replace` so Back leaves the route).
2. Confirm winner + runners-up together with **full** reasons/metadata as designed.
3. Confirm **where-to-watch** present (icons or empty/error OK if section chrome is there).
4. Confirm questionnaire/answer summary when `profile_summary` exists (hide OK if absent — note in demo-notes).
5. Confirm film deep links toward `/watchlist/{filmId}` and exits: Replay + Done / History / New recommendation (history mode may show Remove).

**Capture:**

- Screenshot: `workflow/issues/issue-145/demo/scenario-3-stage3-record.png`

**Pass criteria:**

- Full record layout; providers + summary on stage 3 only
- No dead end after arriving from stage 2

### Scenario 4: History lands on stage 3

**Goal:** `/history/{sessionId}` opens at stage 3 without walking 1→2 first.

**Steps:**

1. Open `http://localhost:3000/history/{SESSION_ID}` (live or mocked) at 390×844.
2. Confirm immediate stage-3 record chrome (not stage 1 winner ritual).
3. Confirm **Replay ceremony** control visible.

**Capture:**

- Screenshot: `workflow/issues/issue-145/demo/scenario-4-history-stage3.png`

**Pass criteria:**

- Lands on stage 3; Replay available

### Scenario 5: Replay 1 → 2 → 3

**Goal:** Replay plays stages 1→2 then returns to 3 (not an endless loop).

**Steps:**

1. From history stage 3, tap **Replay ceremony**.
2. Confirm stage 1 → Next → stage 2 → Next → stage 3.
3. Confirm ceremony ends on stage 3; further 1→2 requires tapping Replay again.

**Capture:**

- Screenshot: `workflow/issues/issue-145/demo/scenario-5-replay-stage1.png` (during replay stage 1 is enough; optional second shot of return to 3)

**Pass criteria:**

- Replay path 1→2→3 once per activation (criterion **A**)

### Scenario 6: Cold load / refresh prefers stage 3

**Goal:** Hard navigation or refresh on `?stage=1` does not resume a stale ceremony.

**Steps:**

1. Open `/recommend/results/{SESSION_ID}?stage=1` as a cold load (no prior arming in the SPA session) **or** hard-reload while on stage 1.
2. Confirm UI lands on **stage 3** (URL rewritten to `stage=3` or equivalent coerce).

**Capture:**

- Screenshot: `workflow/issues/issue-145/demo/scenario-6-cold-load-stage3.png`

**Pass criteria:**

- Unarmed / refresh path shows durable stage 3, not stage 1

### Scenario 7: Reduced motion + desktop metaphor (optional combo)

**Goal:** `prefers-reduced-motion` still allows advancing; desktop keeps ceremony (not flat dashboard).

**Steps:**

1. Emulate reduced motion; advance 1→2→3 once — transitions are instant/crossfade, not large travel.
2. At `≥768px`, show stage 2 or 3 still as ceremony (wider carousel OK).

**Capture:**

- Screenshot: `workflow/issues/issue-145/demo/scenario-7-reduced-motion-or-desktop.png`

**Pass criteria:**

- Reduced-motion path usable; desktop does not skip stages

## Artifacts checklist

- [ ] `scenario-1-stage1-winner.png`
- [ ] `scenario-2-stage2-runners.png`
- [ ] `scenario-3-stage3-record.png`
- [ ] `scenario-4-history-stage3.png`
- [ ] `scenario-5-replay-stage1.png`
- [ ] `scenario-6-cold-load-stage3.png`
- [ ] `scenario-7-reduced-motion-or-desktop.png`
- [ ] `workflow/issues/issue-145/demo/demo-notes.md` with short narrative (date, SHA, tier, whether live vs mocked runners-up)
- [ ] No secrets in images or logs
