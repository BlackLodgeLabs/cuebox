# Bug reproduction notes — Issue #161

**Date:** 2026-07-30  
**Commit SHA (planning start):** `e7588f5` (agent side-branch `cursor/issue-161-pr-163-plan-agent-315a`; base issue branch `cursor/issue-161-thumb-ergonomics-sticky-chrome-4647`)  
**Environment:** Docker Compose stack Up (`postgres`, `api`, `frontend`, `backup`); health `status=ok` / `database=ok` on both `$APP_HEALTH_URL_API` and `$APP_HEALTH_URL_FRONTEND`  
**Viewport:** 390×844 (iPhone-class Chrome UA, `isMobile` + touch)  
**Seed:** 2 ready films + existing history session (Matrix) — enough for Home returning-user, picker, history remove, questionnaire

## Steps taken

1. Confirmed stack health via compose + config health URLs.
2. Opened `/` at 390×844 — measured **History** link vs **Create a recommendation**; searched `a` and measured picker row actions.
3. Opened `/history` — measured Remove (✕) hit box.
4. Opened `/recommend` Genres — scrolled mid-list and to max; measured chip vs sticky Back/Next overlap and content `padding-bottom`.
5. Advanced questionnaire to **Notes** — focused textarea; confirmed no focus `scrollIntoView` hook.
6. Saved geometry JSON + screenshots under this `demo/` folder.

## Expected vs actual

| Gap | Expected | Actual (observed) |
|-----|----------|-------------------|
| Home History ≥44px | Secondary control ≥44px tall | Text `<a>` **History** height **24px** (`bug-repro-screenshot-1-home-history.png`). Create CTA correctly **44px**. |
| Picker actions ≥44×44 | View / Mark watched / TMDB add ≥44px | All measured **32px** height (`h-8` / `size="sm"`) — View 32×56, Mark watched 32×109, Add to watchlist 32×122 (`bug-repro-screenshot-2-picker-actions.png`). |
| History remove ≥44×44 | ✕ hit area ≥44×44 | **40×40** (`size="icon"` → `h-10 w-10`) (`bug-repro-screenshot-3-history-remove.png`). |
| Questionnaire inset | Chips clear sticky Back/Next + tab bar; content padding matches sticky clearance model (ceremony `pb-24`) | Content wrapper class `… pb-4` → computed **`padding-bottom: 16px`**. Mid-scroll (`scrollY=200`): Melodrama/Documentary overlap sticky by **44px**; `elementFromPoint` at sticky center hits **Next** (chips untappable under chrome). Max-scroll last chip clearance **~33px** (not permanently trapped on Genres, but padding far below ceremony `pb-24` / sticky height ~69px). |
| Keyboard / focus | Focus Home search + notes keeps field (+ essential actions) reachable above keyboard | Home: one-shot `scrollIntoView` only for `?focus=search` — **no** `onFocus` while typing. Notes textarea: **no** focus scroll handler (`hasOnFocusScrollHandler: false`). Headless cannot open iOS keyboard; code + focus geometry documented for manual demo. |

## Artifacts

| File | Purpose |
|------|---------|
| `bug-repro-metrics.json` | Geometry for History, picker, remove, questionnaire overlap, notes focus |
| `bug-repro-screenshot-1-home-history.png` | History text link vs primary CTA |
| `bug-repro-screenshot-2-picker-actions.png` | Undersized View / Mark watched |
| `bug-repro-screenshot-3-history-remove.png` | 40×40 remove control |
| `bug-repro-screenshot-4-questionnaire-overlap.png` | Genres + sticky Back/Next + tab bar |
| `bug-repro-screenshot-4b-questionnaire-full.png` | Full-page genres |
| `bug-repro-screenshot-4c-mid-scroll-sticky.png` | Mid-scroll chips under sticky Next |
| `bug-repro-screenshot-4d-max-scroll.png` | Max scroll clearance check |
| `bug-repro-screenshot-5-notes-focus.png` | Notes step + sticky Get recommendation |

## Code confirmation (static)

- `frontend/src/app/recommend/page.tsx` — outer wrapper `pb-4`; sticky `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]`; notes `<Textarea>` has no focus scroll.
- `frontend/src/components/recommendation-ceremony.tsx` — content uses `pb-24` with the same sticky bottom pattern (**mirror target** for questionnaire inset).
- `frontend/src/components/library-search-picker.tsx` — row actions `Button size="sm"` (View, Mark watched, Complete review, Return to watchlist, Add to watchlist, Add & mark watched).
- `frontend/src/app/page.tsx` — History is underlined text `Link`; search focus scroll only for `?focus=search`.
- `frontend/src/app/history/page.tsx` — remove `Button size="icon"`.
- `frontend/src/components/ui/button.tsx` — `sm: h-8`, `icon: h-10 w-10`, `lg: h-11` (44px).

## Notes for plan / execute

- Prefer **one consistent ≥44px** treatment for picker actions (`size="lg"` / `min-h-11`) rather than a phone-only breakpoint split unless layout breaks on desktop.
- Home History: `Button asChild` outline/ghost/secondary, `size="lg"` / `min-h-11`, still visually secondary to filled Create CTA.
- History remove: keep `variant="ghost"`; expand hit via `min-h-11 min-w-11` (or drop `size="icon"` and set explicit mins).
- Questionnaire: replace content `pb-4` with ceremony-class clearance (`pb-24` or equivalent sticky-height + buffer on the scroll container). Do **not** remove sticky chrome or add a FAB.
- Keyboard: extend existing `scrollIntoView({ block: "center" })` to `onFocus` for `library-search-input` and notes textarea (and any peer free-text). Manual iPhone Chrome demo required for real keyboard occlusion.
- No API / DB / questionnaire content-order-validation changes.
