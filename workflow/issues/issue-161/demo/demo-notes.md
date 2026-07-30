# Demo notes — issue #161

- **Date:** 2026-07-30T10:10:00Z
- **Commit:** `585e3d2` (`585e3d2ffad8ebed8b2999d9404d39b9b139a771`) — demo evidence tip
- **Branch:** `cursor/issue-161-pr-163-demo-agent-fa70` → canonical `cursor/issue-161-thumb-ergonomics-sticky-chrome-4647`
- **PR:** #163 (base `feature/mobile-ui`)
- **Tier:** application
- **Viewport:** 390×844 (Playwright `devices['iPhone 13']`)
- **Stack:** Compose `postgres`, `api`, `frontend`, `backup` Up; health API + frontend proxy `"status":"ok"` / `"database":"ok"`; frontend HTTP 200
- **Seed:** 2 films (The Matrix ready + Ambiguous Title); 1 history session (Matrix) — enough for Home, picker, history remove, questionnaire
- **Gate:** `bash scripts/verify-workflow-paths.sh` → **PASS: no legacy workflow paths found** (exit 0)
- **Metrics:** [demo-metrics.json](demo-metrics.json)

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Bug fix verification (targets + inset) | **PASS** | [scenario-0-home-history-44.png](scenario-0-home-history-44.png), [scenario-0-picker-actions-44.png](scenario-0-picker-actions-44.png), [scenario-0-history-remove-44.png](scenario-0-history-remove-44.png), [scenario-0-questionnaire-clearance.png](scenario-0-questionnaire-clearance.png) |
| 1 | Questionnaire sticky chrome usable | **PASS** | [scenario-1-sticky-next-usable.png](scenario-1-sticky-next-usable.png) |
| 2 | Home History secondary weight | **PASS** | [scenario-2-home-cta-hierarchy.png](scenario-2-home-cta-hierarchy.png) |
| 3 | Focus scroll — Home search | **PASS** | [scenario-3-search-focus-scroll.png](scenario-3-search-focus-scroll.png) |
| 4 | Focus scroll — questionnaire notes | **PASS** | [scenario-4-notes-focus-scroll.png](scenario-4-notes-focus-scroll.png) |
| 5 | Manual keyboard audit (iPhone-class) | **PASS*** | [scenario-5-keyboard-search.png](scenario-5-keyboard-search.png), [scenario-5-keyboard-notes.png](scenario-5-keyboard-notes.png) |
| 6 | Design constraints smoke | **PASS** | [scenario-6-no-fab-noir.png](scenario-6-no-fab-noir.png) |

\*Scenario 5: real virtual keyboard **manual / blocked in VM** (headless Chromium). Relied on Scenarios 3–4 focus-scroll hooks + screenshots; no permanent dead-end observed without VKB.

### Scenario 0 — Bug fix verification

Contrast planning `bug-repro-*` baselines:

| Gap | Before (bug-repro) | After (demo) |
|-----|--------------------|--------------|
| Home History | **24px** text `<a>` | **44px** full-width outline `Button asChild` (`min-h-11`) |
| Create CTA | 44px filled primary | Still **44px** filled primary (sole primary) |
| Picker View | **32px** | **44×100** |
| Picker Mark watched | **32px** | **44×162** |
| History remove | **40×40** | **44×44** |
| Questionnaire padding | `pb-4` → 16px | `pb-24` → **96px**; `data-testid="questionnaire-sticky-chrome"` present |
| Mid-scroll trap | Melodrama/Documentary overlapped sticky by 44px; `elementFromPoint` = Next | `overlappingChips: []` at `scrollY=200`; sticky Next still hit-tested at chrome center (expected) |
| Max-scroll last chip | Urban Fantasy clearance ~33px | Urban Fantasy clearance **33px** above sticky; sticky above tab bar; ceremony-class bottom padding in place |

### Scenario 1 — Sticky Next usable

- Back/Next both **44px**; sticky chrome `top≈427` above tab bar
- Selected late chip **Urban Fantasy**; Next in viewport and tappable

### Scenario 2 — Home CTA hierarchy

- Create: filled `bg-primary` 44px; History: outline secondary 44px full-width
- Tap History → `/history` (nav OK)

### Scenario 3 — Search focus scroll

- Click `library-search-input` → `scrollIntoView({ block: "center" })` logged; focused box `y≈301` visible in 390×844 viewport

### Scenario 4 — Notes focus scroll

- Advanced Genres → … → Notes (step 11/11)
- Focused `questionnaire-notes`; textarea + sticky **Get recommendation** (44px) both in viewport

### Scenario 5 — Keyboard (VM limitation)

- Headless VM cannot open iPhone-class virtual keyboard
- Documented as **manual / blocked in VM**; Scenarios 3–4 green with focus-scroll hooks

### Scenario 6 — Design constraints

- Dark Neo-Noir body `rgb(18, 20, 17)`; no FAB (`fabCount=0`)
- Step 1 title still **Genres**; Notes remains optional free-text (placeholder unchanged)

## Narrative

Thumb-ergonomics and sticky-chrome gaps from the phone review are closed on the full stack: Home History is a ≥44px outline secondary under the sole filled Create CTA; library picker View / Mark watched and history remove meet ≥44×44; questionnaire content uses ceremony-class `pb-24` so chips are not permanently trapped under sticky Back/Next; focus `scrollIntoView({ block: "center" })` keeps Home search and Notes reachable. Real VKB remains a manual iPhone Chrome check outside this VM.

## Notes for babysit / create-pr

- Capture helper was a local Playwright script against the running Compose frontend; not committed
- Planning `bug-repro-*` artifacts retained for before/after contrast
- PR #163 base confirmed `feature/mobile-ui`
- No secrets in images or notes
- No production code changes in this demo run
