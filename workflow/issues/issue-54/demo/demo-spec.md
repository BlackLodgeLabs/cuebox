# Demo spec — issue #54: Smarter recommendations based on mood

Planning agent artifact. Demo agent follows this exactly.

## Preconditions

- Full Docker stack running:

  ```bash
  docker compose ps
  curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool
  curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool
  ```

- Seeded watchlist present (Part 2 gate): at least 10 films with `enrichment_status: ready`
- Home page shows **New recommendation** (not empty-watchlist import CTA)
- `OPENAI_API_KEY` in `.env` for live recommendation ranking (or confirm mocked stack if execute documents otherwise)

## Scenarios

### Scenario 1: Home page mood presets visible

**Goal:** Proves the Mood quick pick section appears with named presets when the watchlist is populated.

**Steps:**

1. Open http://localhost:3000/
2. Confirm page heading **What do you want to watch?**
3. Confirm a **Mood quick pick** section appears between the header and the New recommendation / History cards
4. Confirm **6** preset options are visible (e.g. Cozy night in, Adrenaline rush, Deep & arty, Scare me, Feel-good escape, Dark & unsettling)
5. Confirm **Customize instead** (or equivalent) link points to `/recommend`

**Capture:**

- Screenshot: `workflow/issues/issue-54/demo/scenario-1-home-mood-presets.png`

**Pass criteria:**

- Six presets visible, styled with dark neo-noir cards/chips (`hover-glow`, readable labels)
- Empty-watchlist import CTA is **not** shown (watchlist gate passed)
- New recommendation and History cards still present below presets

---

### Scenario 2: Mood quick pick end-to-end

**Goal:** Proves a preset triggers recommendation without the wizard and lands on results with quick-pick context.

**Steps:**

1. From http://localhost:3000/, click preset **Scare me** (or **Cozy night in** if Scare me errors)
2. Confirm loading state: **Finding your film…** and copy mentioning up to 30 seconds
3. Wait for redirect to `/recommend/results/{session_id}`
4. Confirm a winner film card renders with title and explanation
5. Navigate to http://localhost:3000/history
6. Open the most recent session detail (or confirm list row shows preference summary referencing the mood / quick pick)

**Capture:**

- Screenshot: `workflow/issues/issue-54/demo/scenario-2-loading.png` (loading state after preset click)
- Screenshot: `workflow/issues/issue-54/demo/scenario-2-results.png` (results page with winner)
- Screenshot: `workflow/issues/issue-54/demo/scenario-2-history.png` (history entry showing quick-pick context)
- Optional screen recording: `workflow/issues/issue-54/demo/scenario-2-quick-pick.mp4` (preset click through results, ≤45s)

**Pass criteria:**

- No visit to `/recommend` wizard during quick pick
- Results page loads within 30 seconds
- History or session detail reflects quick pick (notes / preference summary mentions preset label, e.g. `Quick pick: Scare me`)

---

### Scenario 3: Full questionnaire still available

**Goal:** Proves the existing 11-step wizard path is unchanged.

**Steps:**

1. Open http://localhost:3000/
2. Click **Start questionnaire** on the New recommendation card (or **Customize instead** from mood section)
3. Confirm URL is `/recommend` and step indicator shows **Step 1 of 11**
4. Do not complete the wizard; capture first step only

**Capture:**

- Screenshot: `workflow/issues/issue-54/demo/scenario-3-full-questionnaire.png`

**Pass criteria:**

- Wizard shows Genres as step 1 of 11
- No regression to questionnaire vocabulary or navigation chrome

---

### Scenario 4: Developer Mode trace (optional)

**Goal:** Shows `visual_tonal_fit` in Stage 3 breakdown when developer mode enabled.

**Preconditions:** `developer_mode: true` in `config.yaml`; API container restarted.

**Steps:**

1. Complete Scenario 2 quick pick
2. On results page, append `?dev=1` to URL (or press Ctrl+Shift+D)
3. Expand scoring / trace panel if collapsed
4. Confirm `visual_tonal_fit` appears in candidate score breakdown

**Capture:**

- Screenshot: `workflow/issues/issue-54/demo/scenario-4-dev-trace-visual-tonal-fit.png`

**Pass criteria:**

- Breakdown includes `visual_tonal_fit` key with numeric value

Skip this scenario if developer mode is not enabled in the demo environment; note skip reason in `demo-notes.md`.

## Artifacts checklist

- [ ] `scenario-1-home-mood-presets.png`
- [ ] `scenario-2-loading.png`
- [ ] `scenario-2-results.png`
- [ ] `scenario-2-history.png`
- [ ] `scenario-3-full-questionnaire.png`
- [ ] Optional: `scenario-2-quick-pick.mp4`, `scenario-4-dev-trace-visual-tonal-fit.png`
- [ ] `workflow/issues/issue-54/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets in images or logs
