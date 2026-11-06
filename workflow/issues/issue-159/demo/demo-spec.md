# Demo spec — issue #159

Application-tier ceremony quality follow-up (sticky Next, short reasons, Done primacy, reduced-motion CSS). Demo agent verifies the bugs in `bug-repro-notes.md` are fixed on the full Docker stack.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` Up)
- Health (after `source scripts/cursor-workflow-config.sh`):
  - `curl -sf $APP_HEALTH_URL_FRONTEND`
  - `curl -sf $APP_HEALTH_URL_API`
- Branch tip includes execute changes for #159; draft PR **#162** base **`feature/mobile-ui`**
- Phone viewport for primary captures: **390×844**

### Seed steps

1. Confirm a history session exists:

   ```bash
   curl -sf "http://localhost:3000/api/v1/recommendations?limit=5" | python3 -m json.tool
   ```

2. Inspect explanation shape (after execute, new runs should include short; legacy seed may lack it):

   ```bash
   SESSION_ID=<id>
   curl -sf "http://localhost:3000/api/v1/recommendations/$SESSION_ID" | python3 -c "
   import sys, json
   d = json.load(sys.stdin)
   e = d['winner']['explanation']
   print('short', e.get('why_it_matches_short'))
   print('full_len', len(e.get('why_it_matches') or ''))
   print('runners', len(d.get('runners_up') or []))
   "
   ```

3. **Ceremony fixture (required for stage 2 + short assertions):** Prefer mocked Playwright / route interception with winner + ≥2 runners-up, both carrying distinct `why_it_matches` vs `why_it_matches_short` (extend `e2e/helpers/ceremony-mocks.ts`). Live Matrix seed often has `runners_up: []` and may lack short — OK for Scenario 0 sticky on stage 1 and stage-3 hierarchy; **not** sufficient alone for stage-2 sticky or short-vs-full proof.

4. Reduced-motion: `page.emulateMedia({ reducedMotion: 'reduce' })` or DevTools Rendering.

## Scenarios

### Scenario 0: Bug fix verification (sticky Next + CTA soup baseline)

**Goal:** Confirm reproduced defects from `bug-repro-notes.md` are fixed.

**Steps:**

1. Open history detail for a session with a tall poster (live Matrix OK) → Replay → stage 1 at 390×844, `scrollY=0`.
2. Confirm **Next** (and progress `1 / 3`) visible in the first viewport above the bottom tab bar without scrolling past the poster.
3. Open stage 3 (history land or advance). Confirm **Done** is the only filled primary; New recommendation / Replay / Remove / history / answer summary are demoted (outline/ghost or under More) — not a peer filled cluster.

**Capture:**

- Screenshot: `workflow/issues/issue-159/demo/scenario-0-stage1-sticky-next.png`
- Screenshot: `workflow/issues/issue-159/demo/scenario-0-stage3-done-primary.png`

**Pass criteria:**

- Next reachable at scrollY=0 (contrast `bug-repro-screenshot-2-stage1-below-fold.png`)
- Done sole filled primary (contrast `bug-repro-screenshot-1c-stage3-actions.png`)

### Scenario 1: Short reasons on stages 1–2 (mocked payload)

**Goal:** Stages 1–2 show upstream short why + factors; not full prose.

**Steps:**

1. Load ceremony with mock payload where `why_it_matches_short` ≠ `why_it_matches` (and full why is clearly longer).
2. Stage 1: assert short text visible under Key factors; full long string **absent**.
3. Stage 2: focused runner shows its short why; full long string absent; providers still absent.

**Capture:**

- Screenshot: `workflow/issues/issue-159/demo/scenario-1-stage1-short-reasons.png`
- Screenshot: `workflow/issues/issue-159/demo/scenario-1-stage2-short-reasons.png`

**Pass criteria:**

- Short field rendered; full `why_it_matches` not shown on 1–2

### Scenario 2: Full record on stage 3

**Goal:** Stage 3 keeps full why / beat-alternatives / caveats / where-to-watch / answer summary.

**Steps:**

1. Advance to stage 3 (same mock session).
2. Confirm full `why_it_matches` visible; providers section present; answer summary reachable via demoted control.

**Capture:**

- Screenshot: `workflow/issues/issue-159/demo/scenario-2-stage3-full-record.png`

**Pass criteria:**

- Full reasons present on stage 3; Done still primary exit

### Scenario 3: Legacy fallback (missing short)

**Goal:** Missing/blank `why_it_matches_short` does not crash and does not dump full why on 1–2.

**Steps:**

1. Intercept detail payload with `why_it_matches_short: null` (or omitted) but factors present.
2. Open stage 1 via Replay.
3. Confirm factors show; full why paragraph omitted; Next still works.

**Capture:**

- Screenshot: `workflow/issues/issue-159/demo/scenario-3-legacy-fallback.png`

**Pass criteria:**

- No crash; factors only; no full why on stage 1

### Scenario 4: Reduced motion

**Goal:** `.ceremony-reduced-motion` has real effect.

**Steps:**

1. Emulate `prefers-reduced-motion: reduce`.
2. Replay to stage 1; confirm `data-reduced-motion="true"` and `.ceremony-reduced-motion` present.
3. Confirm stylesheet contains rules for `.ceremony-reduced-motion` (or computed animation/transition none as planned).

**Capture:**

- Screenshot: `workflow/issues/issue-159/demo/scenario-4-reduced-motion.png`

**Pass criteria:**

- Class applied; CSS rules exist (contrast `bug-repro-metrics.json` `cssRuleCount: 0`)

### Scenario 5: Sticky Next on stage 2 (mocked multi-runner)

**Goal:** Stage 2 sticky chrome works when content is tall.

**Steps:**

1. Use mock with ≥2 runners + short reasons.
2. At stage 2, `scrollY=0`, confirm Next (+ progress) visible above tab bar.

**Capture:**

- Screenshot: `workflow/issues/issue-159/demo/scenario-5-stage2-sticky-next.png`

**Pass criteria:**

- Next in first viewport on stage 2

## Artifacts checklist

- [ ] All screenshots listed above under `workflow/issues/issue-159/demo/`
- [ ] `workflow/issues/issue-159/demo/demo-notes.md` with date, commit SHA, tier, pass/fail per scenario, gate line
- [ ] No secrets in images or logs
- [ ] Keep planning `bug-repro-*` artifacts for before/after contrast
