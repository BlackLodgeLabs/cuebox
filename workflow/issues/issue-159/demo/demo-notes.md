# Demo notes — issue #159

- **Date:** 2026-07-29T20:07:30Z
- **Commit:** `e48dd7c` (`e48dd7c1cdba77a0007c0bb446ab84b812d2169a`) — demo evidence tip on `cursor/issue-159-ceremony-quality-405d`
- **Branch:** `cursor/issue-159-pr-162-demo-agent-1570` → pushed to issue branch `cursor/issue-159-ceremony-quality-405d`
- **PR:** #162 (base `feature/mobile-ui`)
- **Tier:** application
- **Viewport:** 390×844 (Playwright `devices['iPhone 13']`)
- **Stack:** Compose `postgres`, `api`, `frontend`, `backup` Up; health API + frontend proxy `"status":"ok"` / `"database":"ok"`; frontend HTTP 200
- **Seed:** Live Matrix history session `c618464a-c80a-4bbf-8dee-db0ed68f3abb` (tall poster; `runners_up: []`; no `why_it_matches_short` — legacy shape)
- **Mocks:** Ceremony fixture (winner + 2 runners) with distinct `why_it_matches` vs `why_it_matches_short`; legacy variant with `why_it_matches_short: null`
- **Gate:** `bash scripts/verify-workflow-paths.sh` → **PASS: no legacy workflow paths found** (exit 0)

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 0 | Sticky Next (stage 1 live) + Done sole primary (stage 3) | **PASS** | [scenario-0-stage1-sticky-next.png](scenario-0-stage1-sticky-next.png), [scenario-0-stage3-done-primary.png](scenario-0-stage3-done-primary.png) |
| 1 | Short reasons on stages 1–2 (mocked) | **PASS** | [scenario-1-stage1-short-reasons.png](scenario-1-stage1-short-reasons.png), [scenario-1-stage2-short-reasons.png](scenario-1-stage2-short-reasons.png) |
| 2 | Full record on stage 3 | **PASS** | [scenario-2-stage3-full-record.png](scenario-2-stage3-full-record.png) |
| 3 | Legacy fallback (missing short) | **PASS** | [scenario-3-legacy-fallback.png](scenario-3-legacy-fallback.png) |
| 4 | Reduced motion CSS effect | **PASS** | [scenario-4-reduced-motion.png](scenario-4-reduced-motion.png) |
| 5 | Sticky Next on stage 2 (mocked multi-runner) | **PASS** | [scenario-5-stage2-sticky-next.png](scenario-5-stage2-sticky-next.png) |

### Scenario 0 — Bug fix verification

- Live Matrix Replay → stage 1 at `scrollY=0`: **Next** `top≈716px` / height **44px** inside sticky chrome (`ceremony-sticky-chrome` `top≈703`); progress **1 / 3** visible above tab bar — contrast `bug-repro-screenshot-2-stage1-below-fold.png` (Next was `top=1149`)
- Stage 3: **Done** sole `bg-primary`; **More** / **Replay** outline; **New recommendation** absent until More opens — contrast `bug-repro-screenshot-1c-stage3-actions.png`
- Live full why omitted on stage 1 (`fullWhyCount=0`) despite missing short (legacy-safe)

### Scenario 1 — Short reasons

- Mock: short `"Folk horror mood fit."` / `"Overlapping vibes."` ≠ long full strings
- Stage 1: short under Key factors (`theme fit`, `pacing`); full long string **absent**; sticky **Next** still in viewport
- Stage 2: focused runner short why + `semantic fit`; full runner prose absent; no watch-provider icons

### Scenario 2 — Full record

- Stage 3 shows full `why_it_matches` prose; providers present (`watch-provider-icons`); beat-alternatives / caveats in payload; **Done** primary exit; secondaries under **More**

### Scenario 3 — Legacy fallback

- Intercepted detail with `why_it_matches_short: null`; factors (`theme fit`, `pacing`) shown; full why paragraph omitted; **Next** sticky + operable

### Scenario 4 — Reduced motion

- `emulateMedia({ reducedMotion: 'reduce' })` → `data-reduced-motion="true"` + `.ceremony-reduced-motion`
- Stylesheet scan: **cssRuleCount=4** (contrast `bug-repro-metrics.json` `cssRuleCount: 0`)

### Scenario 5 — Stage 2 sticky

- Mock with ≥2 runners; stage 2 at `scrollY=0`: **Next** in viewport (`top≈716`) with progress **2 / 3** above tab bar

## Narrative

Ceremony quality gaps from planning repro are closed on the full stack: sticky Continue/Next stays thumb-reachable on stages 1–2 above the tab bar; stages 1–2 render upstream short why (or factors-only when short is missing) without dumping full prose; stage 3 keeps the full record with **Done** as the only filled primary; `.ceremony-reduced-motion` now has real CSS rules.

## Notes for babysit / create-pr

- Capture helper was a local Playwright script against the running Compose frontend; not committed
- Planning `bug-repro-*` artifacts retained for before/after contrast
- Volume had 2 ready films (Tier-3-like); Matrix history session sufficient for live Scenario 0; Scenarios 1–5 used route mocks
- PR #162 base confirmed `feature/mobile-ui`
- No secrets in images or notes
