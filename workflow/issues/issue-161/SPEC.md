# Issue #161: Mobile UI follow-up — thumb ergonomics & sticky chrome

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/161

**Integration base:** `feature/mobile-ui` (not `main`). Draft PR must target `feature/mobile-ui`.

## Summary

Close one-handed / sticky-chrome gaps from the phone review of `feature/mobile-ui` against brief criterion **C** and checklist ergonomics: questionnaire content must clear sticky Back/Next + tab bar; library picker row actions, Home **History**, and history-list remove must meet ≥44×44px touch targets; Home search and questionnaire free-text must remain usable above the on-screen keyboard. Preserve Neo-Noir, no FAB, and questionnaire question content/order/validation.

## Problem

Phone review on `feature/mobile-ui` ([`documents/ui-mobile-evaluation.md`](../../../documents/ui-mobile-evaluation.md) on the evaluation branch; findings mirrored in #161) found thumb-zone and sticky-chrome defects:

| Gap | Evidence |
|-----|----------|
| **Questionnaire sticky overlaps chips** | Content wrapper is only `pb-4` while Back/Next are sticky above the tab bar (`sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`); last genre/option chips render under the footer (`overlap: true` in measurement) — [`recommend/page.tsx`](../../../frontend/src/app/recommend/page.tsx) |
| **Undersized picker actions** | `LibrarySearchPicker` row actions use `Button size="sm"` (`h-8` ≈ **32px**) for View / Mark watched / Complete review / Return to watchlist / TMDB add variants — [`library-search-picker.tsx`](../../../frontend/src/components/library-search-picker.tsx) |
| **Home History is a thin text link** | Returning-user Home renders History as an underlined text `Link` (~**24px** tall), not a ≥44px control; primary CTA is correctly `size="lg"` / `min-h-11` — [`page.tsx`](../../../frontend/src/app/page.tsx) |
| **History remove under 44pt** | List remove uses `Button size="icon"` (`h-10 w-10` = **40×40**) — [`history/page.tsx`](../../../frontend/src/app/history/page.tsx), [`button.tsx`](../../../frontend/src/components/ui/button.tsx) |
| **Keyboard / focus risk** | Home search and questionnaire free-text (`notes` textarea) can sit under the on-screen keyboard and/or sticky chrome on iPhone-class Chrome; Home already has a one-shot `scrollIntoView` for `?focus=search`, but focus-while-typing + sticky footer clearance still needs an audit |

Sibling ceremony sticky Next / short reasons / stage-3 Done (#159) is **out of scope** (merged into `feature/mobile-ui`). Shell More hub / safe-area header (#158) and surface clarity (#160) are separate follow-ups.

## Acceptance criteria

- [ ] **Questionnaire inset:** Chip/option lists (and other step content) clear the sticky Back/Next row **and** the bottom tab bar — adequate bottom inset / scroll padding so no control is permanently trapped under the footer. Sticky chrome pattern itself may stay; content padding must match sticky height + tab bar + `safe-area-inset-bottom` (same clearance model as ceremony sticky chrome after #159).
- [ ] **Library picker actions ≥44×44px:** Primary row actions in `LibrarySearchPicker` (View, Mark watched, Complete review, Return to watchlist, Add to watchlist, Add & mark watched, and any peer status/add variants on those rows) hit ≥**44×44px** on phone (e.g. `size="lg"` / `min-h-11` / equivalent). Desktop may keep denser sizing only if phone breakpoint still meets 44px; prefer one consistent ≥44px treatment unless plan proves a breakpoint split is needed.
- [ ] **Home History ≥44px tall:** Home **History** control is ≥44px tall (button or equivalent — outline/ghost/secondary is fine). Remains **secondary** to **Create a recommendation** (that CTA stays the sole filled primary / stronger visual weight).
- [ ] **History remove ≥44px hit area:** History list remove (✕) hit area ≥44×44px. Visual weight may stay light (ghost/icon); expand hit target via `min-h-11 min-w-11` (or padding / invisible hit box) without making the glyph look like a primary CTA.
- [ ] **Keyboard audit:** Focusing Home library search and questionnaire free-text (`notes` step, and any other free-text inputs in the questionnaire flow) keeps the focused field and essential actions (sticky Next / Get recommendation when applicable) visible above the keyboard on iPhone-class Chrome — via scroll-into-view on focus and/or layout adjustments. No permanent dead-end where the field or primary forward action is unreachable while the keyboard is open.
- [ ] **Design / product constraints:** Neo-Noir tokens preserved; no FAB; no questionnaire question content, order, or validation rule changes; no Developer Mode work.
- [ ] **Tests:** Cover touch-target sizes (picker actions, Home History, history remove) and questionnaire inset / no-overlap (content bottom padding vs sticky footer). Keyboard behavior covered where automatable (e.g. focus → `scrollIntoView` / class hooks); otherwise documented as manual demo steps in the demo spec.

## Scope

### In scope

- `/recommend` questionnaire sticky footer vs content inset / scroll padding.
- `LibrarySearchPicker` action sizing on Home (and the same component wherever it renders those row actions).
- Home History CTA sizing / control type (still secondary to Create a recommendation).
- History list delete hit target.
- Mobile keyboard / focus scroll behavior for Home search + questionnaire free-text steps.
- Unit / component / Playwright coverage for targets and inset; manual keyboard demo steps if automation is insufficient.

### Out of scope

- Ceremony sticky Next / short reasons / stage 3 CTAs / reduced-motion (#159 — already delivered on `feature/mobile-ui`).
- More hub / tab chrome / safe-area header / active-tab affordance (#158).
- Surface clarity: posters, status labels, Home copy trim, System status removal, History filters progressive disclosure (#160).
- Changing questionnaire questions, step order, or validation rules.
- Developer Mode / Dev Mode mobile affordance.
- Replacing Neo-Noir tokens or introducing a FAB.
- Backend / API / DB / sync changes.

## User flows / API changes

### Questionnaire (sticky clearance)

1. User opens `/recommend` and advances to a multi-select chip step with many options (e.g. genres / vibes).
2. Scrolls to the last chips — every chip remains tappable above the sticky Back/Next row; sticky row remains above the bottom tab bar with safe-area padding.
3. Taps a late-list chip, then taps **Next** without hunting under chrome.

Content bottom padding (or equivalent scroll-padding) must be ≥ sticky footer height + tab bar clearance already accounted by sticky `bottom-[calc(4.5rem+…)]` so the last interactive control clears both layers.

### Home library search picker

1. Returning user on `/` searches; library and TMDB hits show row actions.
2. **View**, **Mark watched**, and TMDB add variants are easy thumb targets (≥44px) without precision tapping.

### Home History

1. Returning user sees **Create a recommendation** as the primary full-width CTA.
2. **History** below it is an intentional ≥44px-tall control (button-styled link or `Button asChild`), visually secondary (outline/ghost/muted), still one clear tap to `/history`.

### History list remove

1. On `/history`, each card’s remove (✕) is tappable with a ≥44×44 hit area.
2. Confirm dialog / delete behavior unchanged — only hit target sizing.

### Keyboard (search + free-text)

1. Focus Home library search (`data-testid="library-search-input"`) on phone Chrome — field scrolls into view; user can type without the caret permanently under the keyboard.
2. On questionnaire `notes` (and any other free-text step), focusing the field keeps it and sticky **Next** / **Get recommendation** reachable (scroll and/or temporary layout adjustment). Prefer reusing/extending existing focus `scrollIntoView` patterns rather than inventing a new global keyboard framework unless plan shows necessity.

### API changes

None. Frontend layout / component sizing only.

## Layout / sizing notes

| Surface | Current | Target |
|---------|---------|--------|
| Questionnaire content | `pb-4` only | Bottom padding / scroll-padding clearing sticky Back/Next + tab bar + safe-area (mirror ceremony content padding approach where practical) |
| Picker row actions | `size="sm"` (`h-8`) | ≥44px (`min-h-11` / `size="lg"` or equivalent) |
| Home History | Text `Link` ~24px | ≥44px tall control; secondary to Create a recommendation |
| History remove | `size="icon"` 40×40 | Hit area ≥44×44; light visual weight OK |
| Keyboard | Partial Home `?focus=search` scroll | Focus scroll / layout for search + notes (and peer free-text) so field + essential actions stay above keyboard |

Sticky Back/Next already uses:

```text
sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]
```

Do not remove that pattern; fix the **content** clearance underneath it. No FAB.

## Data and integration notes

- **None** — no schema, API, ranking, Letterboxd, or TMDB sync changes.
- Branch from / PR into **`feature/mobile-ui`** (integration base for this evaluation batch). Do not retarget the draft PR to `main`.
- Evaluation source doc lives on the evaluation branch (`documents/ui-mobile-evaluation.md`); product brief remains [`documents/ui-mobile-product-brief.md`](../../../documents/ui-mobile-product-brief.md) on `feature/mobile-ui`.

## Open questions

_(none — issue acceptance criteria, scope, and user-visible behavior are sufficient to plan)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/161
- Related batch (delivery order 2 of 4): #159 ceremony quality (done), #158 shell & wayfinding, #160 surface clarity
- Source review: `documents/ui-mobile-evaluation.md` (evaluation branch); product brief: `documents/ui-mobile-product-brief.md`
- Integration base: `feature/mobile-ui`
