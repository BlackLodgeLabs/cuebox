# Implementation plan — Issue #161

**Tier:** application  
**Issue type:** bug (thumb-ergonomics / sticky-chrome gaps on shipped `feature/mobile-ui` phone UI)  
**Integration base:** `feature/mobile-ui` (draft PR **#163** already targets it — do not retarget to `main`)

## Overview

Close one-handed and sticky-chrome defects from the phone review against brief criterion **C**: questionnaire content must clear sticky Back/Next + tab bar; library picker actions, Home History, and history-list remove must meet ≥44×44px; Home search and questionnaire free-text must scroll into view on focus so they stay usable above the keyboard.

Reproduction on 2026-07-30 (390×844, seeded watchlist + history) confirmed undersized targets and mid-scroll sticky chip overlap — see [Reproduction findings](#reproduction-findings) and `demo/bug-repro-notes.md`.

Preserve Neo-Noir tokens, no FAB, and questionnaire question content/order/validation. No API / DB / Developer Mode work. Sibling issues #158 / #160 stay out of scope; ceremony sticky (#159) already delivered the padding pattern to mirror.

## Reproduction findings

Evidence under `workflow/issues/issue-161/demo/` (`bug-repro-*`):

| Gap | Observed |
|-----|----------|
| **Home History thin link** | Height **24px** text `<a>`; Create CTA correctly **44px** (`bug-repro-screenshot-1-home-history.png`, `bug-repro-metrics.json`). |
| **Picker `size="sm"`** | View / Mark watched / Add to watchlist all **32px** tall (`h-8`) (`bug-repro-screenshot-2-picker-actions.png`). |
| **History remove** | **40×40** (`size="icon"`) (`bug-repro-screenshot-3-history-remove.png`). |
| **Questionnaire inset** | Wrapper `pb-4` → **16px** padding. Mid-scroll: Melodrama/Documentary overlap sticky by **44px**; `elementFromPoint` at sticky center = **Next**. Max-scroll last-chip clearance ~33px on Genres (not permanently trapped), but far below ceremony `pb-24` / sticky ~69px clearance model (`bug-repro-screenshot-4c-mid-scroll-sticky.png`). |
| **Keyboard / focus** | Search: one-shot `?focus=search` only. Notes textarea: no focus `scrollIntoView`. Real iOS keyboard not emulatable headless — manual demo required. |

## Root cause

1. **Questionnaire padding:** Sticky Back/Next was added with tab-bar `bottom-[calc(4.5rem+…)]`, but the page wrapper kept `pb-4`. Ceremony (#159) uses the same sticky formula with **`pb-24`** so content can scroll clear of the stuck footer; questionnaire did not get that clearance.
2. **Picker / History / remove:** Mobile density pass left these controls on compact `sm` / text-link / `icon` sizes while primary CTAs moved to `lg` / `min-h-11`.
3. **Keyboard:** Focus scroll exists only for the Home `?focus=search` deep-link; typing focus and notes free-text never call `scrollIntoView`.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/app/recommend/page.tsx` | Replace content wrapper `pb-4` with ceremony-class bottom clearance (`pb-24` or equivalent sticky-height + buffer); keep sticky chrome; add `onFocus` → `scrollIntoView({ block: "center" })` on notes `<Textarea>` (and any peer free-text if present) | Questionnaire inset + keyboard AC |
| `frontend/src/components/library-search-picker.tsx` | Row action buttons: `size="lg"` and/or `className="min-h-11"` (all View / status / TMDB add variants); prefer one consistent ≥44px treatment | Picker touch targets |
| `frontend/src/components/library-search-picker.tsx` (input) | `onFocus` → `scrollIntoView({ block: "center" })` on `data-testid="library-search-input"` (reuse Home pattern) | Keyboard AC for search |
| `frontend/src/app/page.tsx` | Replace History text `Link` with `Button asChild` outline/ghost/secondary `size="lg"` / `min-h-11` full-width; keep Create as sole filled primary | Home History ≥44px secondary |
| `frontend/src/app/history/page.tsx` | Expand remove hit area to ≥44×44 (`min-h-11 min-w-11`); keep ghost / light glyph | History remove AC |
| `frontend/src/app/recommend/page.test.tsx` | Assert content wrapper / sticky clearance class (`pb-24` or testid); notes focus calls scroll helper if extracted | Unit inset + keyboard hook |
| `frontend/src/app/page.test.tsx` | Assert History control has `min-h-11` / `h-11` class and remains secondary (not filled primary) | History target regression |
| `frontend/src/components/library-search-picker.test.tsx` | Assert row actions match `min-h-11` / `h-11` / `size` lg | Picker target regression |
| `frontend/src/app/history/page.test.tsx` (**new** — no page unit test today) or E2E-only if lighter | Assert remove control `min-h-11 min-w-11` (or measured class) | Remove target regression |
| `frontend/e2e/questionnaire-mobile.spec.ts` | Assert last chip clears sticky at max scroll / content padding; optional mid-scroll no permanent trap | E2E inset |
| `frontend/e2e/library-search-picker.spec.ts` (and/or home) | Assert View / Mark watched bounding boxes ≥44px; History link/button ≥44px tall | E2E targets |
| `frontend/e2e/history-delete.spec.ts` | Assert remove hit box ≥44×44 | E2E remove |
| `frontend/e2e/app-shell-mobile.spec.ts` or small new focus spec | Where automatable: focus search → `scrollIntoView` invoked / field in viewport | Keyboard automation |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| Questionnaire step definitions / validation | Out of scope |
| Ceremony sticky / #159 | Already delivered; mirror only |
| Shell / More hub / #158 | Sibling |
| Surface clarity / #160 | Sibling |
| `api/` / DB / sync | Frontend layout only |
| Neo-Noir tokens / FAB | Preserve design constraints |
| Developer Mode | Out of scope |

## Locked layout choices

| Decision | Choice |
|----------|--------|
| Questionnaire clearance | Mirror ceremony: keep sticky `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]`; change outer/content padding from `pb-4` → **`pb-24`** (or document equivalent `calc` if sticky height changes). Optional `data-testid="questionnaire-sticky-chrome"` for E2E. |
| Picker sizing | **One consistent ≥44px** at all breakpoints (`size="lg"` + `min-h-11` as needed). No phone-only split unless a layout regression appears. |
| Home History | Full-width `Button asChild variant="outline"` (or ghost/secondary) `size="lg" className="w-full min-h-11"` wrapping `Link href="/history"`. Create stays filled primary `size="lg"`. |
| History remove | `variant="ghost"` + `min-h-11 min-w-11` (drop reliance on `size="icon"` 40px). Glyph stays light ✕. |
| Keyboard | Reuse `scrollIntoView({ block: "center" })` on focus for search input + notes textarea. Do **not** invent a global keyboard framework. Manual iPhone Chrome demo for real VKB. |
| FAB | Never |

## Implementation steps

### Step 1 — Questionnaire inset

1. In `recommend/page.tsx`, change wrapper `pb-4` → `pb-24` (match `recommendation-ceremony.tsx`).
2. Confirm sticky class unchanged.
3. Unit/E2E: assert padding class and/or last-chip clearance above sticky at max scroll (390×844).

### Step 2 — Touch targets (picker, History, remove)

1. Bump all `LibrarySearchPicker` row action `size="sm"` → `size="lg"` (+ `min-h-11` if link/`asChild` needs it).
2. Home History → outline/ghost button ≥44px tall, secondary to Create.
3. History remove → ≥44×44 hit area, ghost visual weight.
4. Unit tests for class/`min-h-11`; Playwright bounding-box ≥44.

### Step 3 — Keyboard / focus scroll

1. On `library-search-input`, add `onFocus` scroll-into-view (keep existing `?focus=search` one-shot).
2. On notes `Textarea`, add the same on focus.
3. Extract a tiny helper (e.g. `scrollFieldIntoView(el)`) only if it avoids duplication without over-abstracting.
4. Automatable test: focus → element’s `getBoundingClientRect()` within viewport (or spy `scrollIntoView`). Manual demo for real keyboard.

### Step 4 — Gates / polish

1. Run targeted unit + Playwright suites.
2. Run `$APP_DEFAULT_GATE` (Phase 8) before execute-ready; host build gotcha: stop compose frontend + clear `frontend/.next` if needed.
3. No DESIGN.md rewrite required unless touch-target section is silent on History/picker — prefer a one-line note only if execute finds an existing mobile ergonomics subsection that lists these controls.

## Tests required

| Acceptance criterion | Test |
|----------------------|------|
| Questionnaire inset / no overlap | Unit: wrapper has `pb-24` (or clearance testid). E2E `questionnaire-mobile.spec.ts`: at 390×844, after scroll to end, last option chip `bottom` ≤ sticky `top`; sticky still above tab bar. |
| Picker actions ≥44×44 | Unit: action buttons match `/min-h-11\|h-11/`. E2E: View + Mark watched (and TMDB add if stubbed) `boundingBox().height/width ≥ 44`. |
| Home History ≥44px | Unit: History control classes include `min-h-11` / `h-11`; Create remains filled primary. E2E: History height ≥ 44. |
| History remove ≥44×44 | Unit/E2E: remove button ≥44×44. |
| Keyboard audit | Unit: focus handler invokes `scrollIntoView` (mock). E2E optional: focus search → input in viewport. **Manual demo** (Scenario 5): iPhone-class Chrome real keyboard for search + notes. |
| Design constraints | Snapshot/visual demo: no FAB; Neo-Noir; questions unchanged (existing questionnaire tests still pass). |

## Gate script

```bash
source scripts/cursor-workflow-config.sh
# Host pytest not required (frontend-only) unless execute touches api/
cd frontend && npm run test:unit && npx tsc --noEmit
cd frontend && npx playwright test \
  e2e/questionnaire-mobile.spec.ts \
  e2e/library-search-picker.spec.ts \
  e2e/history-delete.spec.ts \
  e2e/app-shell-mobile.spec.ts
# Host build gotcha with compose frontend:
# docker compose stop frontend && sudo rm -rf frontend/.next
bash "$APP_DEFAULT_GATE"   # scripts/verify-phase8-gates.sh
```

Narrower while iterating: Phase 6 / 6.5 + targeted Playwright. **Final execute handoff** expects `$APP_DEFAULT_GATE` exit 0 (or Phase 6.5 + documented frontend green if Phase 8 blocked by unrelated infra — prefer Phase 8).

## Documentation updates

| File | Update |
|------|--------|
| `workflow/issues/issue-161/PLAN.md` / `demo/` | This plan + demo-spec + bug-repro |
| `documents/DESIGN.md` | Only if an existing mobile ergonomics subsection should mention questionnaire `pb-24` parity / 44px History — otherwise skip |
| README / API docs | None |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| `pb-24` leaves large empty gap on short steps (e.g. notes) | Acceptable; matches ceremony; prefer consistency over per-step padding |
| Larger picker buttons wrap awkwardly on narrow rows | Already `flex-wrap`; verify at 390px in demo |
| History button competes with Create | Use outline/ghost, not filled primary |
| Focus scroll fights user scroll position | Use `block: "center"`; avoid scroll on every keypress |
| Real keyboard still covers sticky Next | Manual demo; if needed, temporary extra bottom padding while focused (prefer scroll-first) |
| Phase 8 host `.next` EACCES | Stop frontend container; `sudo rm -rf frontend/.next` before build |

**Rollback:** Revert the frontend layout/sizing/focus commits on the issue branch; no schema migrations.

## Definition of done

- [ ] Questionnaire content clears sticky Back/Next + tab bar (padding mirrors ceremony clearance)
- [ ] Library picker primary row actions ≥44×44px
- [ ] Home History ≥44px tall and visually secondary to Create a recommendation
- [ ] History remove hit area ≥44×44 with light visual weight
- [ ] Focus on Home search + notes (peer free-text) scrolls field into view; manual keyboard demo documented
- [ ] Neo-Noir preserved; no FAB; no questionnaire content/order/validation changes; no Dev Mode / API changes
- [ ] Tests mapped above green; `$APP_DEFAULT_GATE` (or agreed narrower + frontend) exit 0
- [ ] Demo artifacts per `demo/demo-spec.md`
- [ ] Draft PR **#163** remains based on **`feature/mobile-ui`**
- [ ] `workflow.state.json` → `plan-ready` after this planning run

## PR seed

**Tier:** application  
**What / why:** Fix phone thumb-ergonomics and sticky-chrome gaps — questionnaire content inset, ≥44px picker/History/remove targets, and focus scroll for search/notes.  
**Key changes:** `recommend/page.tsx` `pb-24` + notes focus scroll; `LibrarySearchPicker` `size="lg"`; Home History button; history remove `min-h-11 min-w-11`; unit + Playwright regressions.  
**Gate:** `$APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`) + targeted mobile Playwright specs.  
**How to test:** 390×844 — last genre chips clear sticky Next; picker/History/remove ≥44px; focus search/notes scrolls into view; manual iPhone keyboard check.  
**Base branch:** `feature/mobile-ui` (PR #163).
