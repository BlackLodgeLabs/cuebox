# Cuebox mobile UI / IA evaluation

**Branch evaluated:** `feature/mobile-ui`  
**Viewport:** iPhone 14/15 — **390×844** CSS px @ 2x (`isMobile` / touch)  
**Data state:** Returning-user paths (seeded ready films + one live recommendation session + one pending metadata review)  
**Method:** Code review of shell/screens against [ui-mobile-product-brief.md](ui-mobile-product-brief.md) + Mobile UI / IA checklists; visual review via Playwright screenshots  
**Screenshots:** [ui-mobile-evaluation/screenshots/](ui-mobile-evaluation/screenshots/)

> Note: A circular **“N”** overlay on the Home tab in screenshots is the **Next.js dev indicator**, not a product UI element. Ignore it for product findings.

---

## Executive verdict

The mobile redesign **lands the brief’s structural IA** (bottom tabs, Home hub + picker, Review badge, poster-first watchlist, mandatory ceremony 1→2→3 with history→3 + replay). Fail-hard criteria **A / D / B** are **structurally met**.

Ceremony **quality** and **one-handed ergonomics** still have clear gaps: stage **Next** sits below the fold, “short reasons” are not short, questionnaire chips collide with the sticky footer, and several secondary actions are under 44px. Stage 3 reads as a durable record but ends in a **competing CTA cluster**.

| Brief ID | Criterion | Verdict |
|----------|-----------|---------|
| **A** | Flow efficiency | **Pass (soft)** — Home→Recommend ≤2 taps; picker works; ceremony has no Skip; history→3; replay 1→2→3. Soft: stage Next requires scroll; reasons on 1/2 are full-length. |
| **D** | Ceremony quality | **Pass (soft)** — Stages exist and differ; winner is poster-led; runners-up swipe + focus; stage 3 is the full record. Soft: first viewport of stage 1 is mostly poster; Next/reasons need scroll; stage 3 CTA hierarchy is muddy. |
| **B** | Poster-first watchlist | **Pass** — Poster + title only; `⋯` actions; filter sheet; status tabs; no cell metadata. |
| **C** | One-handed usability | **Partial** — Tabs/header/primary CTAs ≥44px; History link ~24px; picker actions `h-8` (32px); history delete 40×40. |
| **E** | First-run / Review | **Pass** (returning scope) — Review badge + `/review` work when pending. Import/settings remain clear, not ceremony-polished (per D7). |
| **F** | Atmosphere / a11y motion | **Partial** — Neo-Noir preserved; contrast strong; `prefers-reduced-motion` hides scanlines, but `.ceremony-reduced-motion` has **no CSS rules**. |

---

## Screen inventory (returning user)

| # | Screen | Route | Screenshot(s) |
|---|--------|-------|----------------|
| 1 | Home hub | `/` | `01-home.png`, `01b-home-with-review-badge.png` |
| 2 | Header search → Home picker | `/search` → `/?focus=search` | `02-search-focused.png`, `02b`–`02c-search-results*.png` |
| 3 | Watchlist grid + filter + ⋯ | `/watchlist` | `03-watchlist.png`, `03b-watchlist-filter-sheet.png`, `03c-watchlist-actions-menu.png` |
| 4 | Film detail | `/watchlist/[id]` | `04-film-detail.png`, `04b`–`04c` |
| 5 | Recommend questionnaire | `/recommend` | `05-recommend-step1.png`, `05b-recommend-step2.png` |
| 6 | Ceremony 1–3 | `/history/[id]?stage=` (armed via Replay) | `06-ceremony-stage1.png`, `06b`–`06g`, `06e-ceremony-default-landing.png` |
| 7 | History list | `/history` | `07-history-list.png` |
| 8 | History detail (stage 3) | `/history/[id]` | `08-*.png`, `08d-history-stage3-bottom.png` |
| 9 | Import | `/import` | `09-import.png` |
| 10 | Import job status | `/import/[jobId]` | `10-import-job-status.png` |
| 11 | Match review | `/review` | `11-match-review.png` |
| 12 | More → Sync settings | `/settings/sync` | `12-settings-sync.png`, `12b` |
| 13 | Developer Mode panel | `?dev=1` | `13-*.png` |

---

## Checklist scorecards

### Mobile UI Review Checklist

| Item | Status | Notes |
|------|--------|-------|
| **Ergonomics** — 44pt targets, thumb zone, spacing | **Partial** | Bottom tabs ~56×94; header search/review 44px; primary `min-h-11`. Failures: Home **History** link ~24px tall; library picker **View / Mark watched** = `Button size="sm"` → **32px**; history ✕ delete **40×40**; ceremony **Next** below fold (stage 1 `top≈1121` in 844 viewport). |
| **Hierarchy** — focal points, ≥16px text, 8pt grid | **Partial** | Clear H1s and primary CTAs. Body often 16px (`text-body-md`); labels/chips/`text-sm`/`text-xs` and **11px** tab labels sit under 16px. Stage 1 first paint is poster-heavy; reasons/CTA need scroll. |
| **Platform** — HIG/Material, safe areas, keyboard | **Partial** | Bottom `safe-area-inset-bottom` on tabs + main padding. **No top safe-area** on sticky header. Keyboard avoidance for search/questionnaire not specially handled beyond sticky footer. |
| **Edge cases** — loading / empty / error / long text | **Mostly pass** | Skeletons, `ErrorState`, empty watchlist tabs, review “All caught up”, disabled import/sync until file chosen. Long titles truncate on grid (`…`). Seed/missing posters show **broken `<img>`** in places vs explicit **NO POSTER** elsewhere — inconsistent fallback. |
| **Accessibility** — contrast, dynamic type, SR labels | **Partial** | Token contrast strong (foreground/bg ≈ **14:1**; muted ≈ **11:1**; secondary ≈ **11:1**). Shell/ceremony/watchlist have solid `aria-*`. Dynamic type / text scaling not specially supported (fixed Tailwind sizes). |
| **Feedback** — active/disabled, transitions | **Mostly pass** | Tab fill + color; chip selection; disabled primary buttons; focus rings; motion-reduce on shell/home. Ceremony reduced-motion class is a no-op in CSS. |

### Information Architecture Review Checklist

| Item | Status | Notes |
|------|--------|-------|
| **Wayfinding** — location, primary nav, Back | **Mostly pass** | Distinct bottom tabs; active state via filled icon + brighter label (subtle). Review / History / Import are **off-tab** — no secondary location chrome beyond page title. Film detail has `← Watchlist`. Browser back works; ceremony deep-link to 1\|2 **coerces to 3** unless gate armed (intentional). |
| **Taxonomy** — labels, user language | **Partial** | Home / Watchlist / Recommend / More are clear. Film detail exposes enrichment **Ready** + lifecycle **active** — technical. “More” lands on **Sync settings** with no More hub. |
| **Hierarchy** — depth vs breadth, grouping | **Mostly pass** | Home hub jobs match D4. Stage 3 groups record content well, then **overloads** exit actions (Done / New recommendation / View history / Replay / Remove / Answer summary). |
| **Search & discovery** | **Pass** | Inline Home picker + header search; library + TMDB merge; status-aware actions; watchlist filter sheet. Zero-query helper copy present (slightly redundant with page blurb). |
| **Task flows** | **Mostly pass** | Recommend from Home or tab; Review from badge; History from Home; watchlist ⋯ → actions; ceremony cross-link to film. Gaps: sticky/overlap in questionnaire; ceremony continue CTA not thumb-sticky. |

---

## Product brief gaps (beyond checklists)

| Decision / criterion | Gap |
|----------------------|-----|
| **D5 / A / D — short reasons on stages 1–2** | `ShortReasons` renders full `why_it_matches` with no truncation ([`ceremony-shared.tsx`](../frontend/src/components/ceremony/ceremony-shared.tsx)). |
| **D5 — ceremony ceremony feel** | Stage Next is inline at page bottom, not sticky above the tab bar — easy to miss on phone. |
| **D3 — More** | Tab label “More” routes straight to `/settings/sync` — no intermediate More menu (acceptable stub, weak IA label match). |
| **D8 — reduced motion** | `.ceremony-reduced-motion` applied in TSX/tests but **undefined in CSS**. |
| **D9 — Dev Mode** | Correctly out of visual scope; panel remains dense and easy to miss under stage 3 content on mobile (`?dev=1`). |
| **P1 picker polish** | Behavior correct; action buttons undersized for thumb; broken poster states hurt trust. |

---

## What works well

1. **App shell matches D3** — Home · Watchlist · Recommend · More; Review as header badge; search icon → `/search`; **no FAB**; History not a tab ([`app-shell.tsx`](../frontend/src/components/app-shell.tsx)).
2. **Home is a real hub** — Inline library/TMDB picker, full-width “Create a recommendation”, History entry, returning-user copy aligned with D4.
3. **Watchlist metaphor (B)** — 2-col poster grid, title below only, `more_horiz` actions, Filter sheet, Watchlist/Watched/Archived tabs.
4. **Ceremony structure (A/D)** — Mandatory 1→2→3 with Next only; history defaults to stage 3; Replay arms gate and walks 1→2→3; where-to-watch + answer summary live on stage 3.
5. **Primary touch targets** — Tabs, header icons, recommend CTA, ceremony `size="lg"` / `min-h-11` meet ~44px.
6. **Safe-area bottom** — Tab bar and questionnaire sticky footer account for `env(safe-area-inset-bottom)`.
7. **Contrast & Neo-Noir** — Dark surfaces, Cabin/Libre Franklin/Space Mono, chamfered primaries, lime/sulfur accents preserved; contrast ratios comfortably above 4.5:1 for core text/UI.
8. **Review flow** — Pending count badge; match review Accept / Reject / Choose different match with clear hierarchy.
9. **Import / sync completeness** — Disabled states until file chosen; job status progress; CSV + watched history + RSS under settings (D7 “clear not abandoned”).
10. **A11y basics** — Named primary nav, search/review labels, ceremony stage `aria-label`s / `aria-live` progress, watchlist action labels, focus-visible rings.

---

## What doesn't work well

1. **Ceremony Next is below the fold** — On stage 1, Next sits ~1121px down a 844px viewport; stage 2 also requires scroll. Continues the ritual only after discovering scroll — weak for thumb-zone and ceremony pacing.
2. **“Short reasons” are not short** — Stages 1–2 show full ranking prose; fights D5 singular focus and readable phone hierarchy.
3. **Questionnaire sticky footer overlaps chips** — Content wrapper is only `pb-4` while Back/Next are sticky above the tab bar; last chips render under the footer (`overlap: true` in measurement).
4. **Undersized secondary actions** — Picker **View / Mark watched** at **32px**; Home **History** text link **~24px**; history remove **40×40**.
5. **Stage 3 exit CTA soup** — Done, New recommendation, View history, Replay ceremony, Remove from history, View answer summary compete without a clear primary path ([`08d-history-stage3-bottom.png`](ui-mobile-evaluation/screenshots/08d-history-stage3-bottom.png)).
6. **More ≠ More** — Tab says More but opens Sync settings only; no grouping for future settings, about, etc.
7. **Off-tab wayfinding** — History, Review, Import have no active bottom-tab (by design) and little secondary chrome, so location relies entirely on the page title.
8. **Poster failure UX inconsistent** — Next/Image failures show browser broken-image + alt text; review cards use explicit “NO POSTER”. Seeded fake TMDB paths exaggerate this in evaluation, but production missing posters need a single graceful fallback.
9. **Film detail jargon** — Side-by-side **Ready** (enrichment) and **active** (lifecycle) badges are system language, not user language.
10. **Home copy density** — Two explanatory paragraphs about search before the field; System status accordion adds debug chrome to the nightly hub.
11. **History list filter stack** — Search + two date fields + status select consume a large first viewport before results.
12. **Reduced-motion gap** — Ceremony class hook without styles; motion-safe fade only partially covered.
13. **No top safe-area inset** on sticky header (notch / Dynamic Island on real devices).
14. **Tab label size 11px** — Acceptable as nav chrome, but fails the checklist’s “readable text min 16px” if applied strictly to all UI text.
15. **Active tab contrast is subtle** — Active `#e3e3de` vs inactive `#c3c8bd`; filled icon helps, but location can be easy to miss in low light.
16. **Developer Mode on mobile** — Out of redesign scope; still hard to discover under long stage-3 content when enabled.

---

## Potential work items (suggested Issues — not filed)

Use these as candidates for GitHub issues; **none were created** by this review.

1. **Sticky ceremony Continue/Next** — Pin Next (and stage progress) above the bottom tab bar with safe-area padding so stages 1–2 never hide the only forward action.
2. **Truncate / rewrite short reasons for stages 1–2** — Cap `why_it_matches` (e.g. 1–2 sentences or key factors only); keep full prose on stage 3.
3. **Questionnaire content bottom inset** — Add padding under chip lists equal to sticky footer + tab bar so options never sit under Back/Next.
4. **Bump picker & History touch targets to ≥44px** — Replace `size="sm"` picker actions; make Home History a button-sized control.
5. **Stage 3 action hierarchy** — One primary (Done or New recommendation), collapse secondary actions into a menu or progressive disclosure (Replay / Remove / Answer summary).
6. **More hub screen** — Intermediate More page with Sync (and room for future items) so the tab label matches the destination.
7. **Unified missing-poster component** — Shared `NO POSTER` / silhouette fallback for grid, picker, ceremony, history, detail (no broken-image icon).
8. **User-facing film status labels** — Map enrichment/lifecycle enums to plain language on film detail (or hide enrichment from non-dev surfaces).
9. **Home hub copy trim** — Single supporting sentence + picker helper; demote or relocate System status (e.g. under More).
10. **History filters progressive disclosure** — Collapse date/status filters behind a Filter control (match watchlist pattern) to free first viewport.
11. **Implement `.ceremony-reduced-motion` CSS** — Disable ceremony fades/transitions when reduced motion is requested (class already applied).
12. **Top safe-area on app header** — `pt-[env(safe-area-inset-top)]` (or equivalent) on sticky header for notched phones.
13. **Strengthen active tab affordance** — Stronger color, indicator bar, or larger filled icon difference for current tab.
14. **History delete target ≥44px** — Expand hit area around ✕ while keeping visual weight light.
15. **Review / History location chrome** — Optional subtle header subtitle or back-to-Home pattern so off-tab screens feel anchored.
16. **Keyboard audit pass** — Search input and questionnaire free-text steps: ensure focused fields scroll above keyboard + sticky chrome on iOS Chrome.
17. **Dev Mode mobile affordance** (optional / later) — Collapsible dock or clearer entry when `developer_mode` is on; still out of brief visual redesign, but blocks mobile debugging.

---

## Appendix: measurement notes

Captured with Playwright at 390×844:

| Control | Approx. size |
|---------|----------------|
| Bottom tab hit area | 94×56 |
| Header search | 44×44 |
| Header Review (icon+badge) | 70×44 |
| Home “Create a recommendation” | full width × 44+ |
| Home History link | ~358×24 |
| Picker View / Mark watched | ~56–109 × **32** |
| Ceremony Next | 98×44 but **y≈1121** on stage 1 |
| History remove | 40×40 |

**Contrast (approx., token pairs):** foreground/bg 14.4:1; muted/bg 10.9:1; secondary/bg 10.9:1; primary button text 10.9:1.

**Ceremony gate:** Unarmed `/recommend/results/{id}` or `/history/{id}?stage=1` → coerced to stage **3** ([`ceremony-gate.ts`](../frontend/src/lib/ceremony-gate.ts)). Fresh questionnaire submit arms gate and navigates to `?stage=1`. Replay arms gate the same way.

---

## Appendix: screenshot index

All files under `documents/ui-mobile-evaluation/screenshots/`:

- `01-home.png` / `01b-home-with-review-badge.png`
- `02-search-focused.png` / `02b-search-results.png` / `02c-search-results-detail.png`
- `03-watchlist.png` / `03b-watchlist-filter-sheet.png` / `03c-watchlist-actions-menu.png`
- `04-film-detail.png` / `04b-film-detail-full.png` / `04c-film-detail-mid.png`
- `05-recommend-step1.png` / `05b-recommend-step2.png`
- `06-ceremony-stage1.png` / `06b-ceremony-stage2.png` / `06c-ceremony-stage3.png` / `06d-ceremony-stage3-full.png` / `06e-ceremony-default-landing.png` / `06f-ceremony-stage1-scrolled.png` / `06g-ceremony-stage2-scrolled.png`
- `07-history-list.png`
- `08-history-detail-stage3.png` / `08b-history-replay-stage1.png` / `08c-history-stage3-before-replay.png` / `08d-history-stage3-bottom.png`
- `09-import.png` / `10-import-job-status.png` / `11-match-review.png`
- `12-settings-sync.png` / `12b-settings-sync-full.png`
- `13-dev-mode-panel.png` / `13b-dev-mode-panel-full.png` / `13c-dev-mode-scrolled.png`
