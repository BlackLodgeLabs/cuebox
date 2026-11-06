# Issue #141: Mobile UI — app shell (bottom tabs, header, Review badge)

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/141

## Summary

Rewrite the Cuebox `AppShell` chrome for phone-first use: a fixed **bottom tab bar** (Home · Watchlist · Recommend · More), a slim **top header** (Cuebox brand + search icon + conditional Review badge), and safe-area padding so content is never hidden behind the tabs. This is **slice (a)** of the mobile UI pass ([product brief](../../../documents/ui-mobile-product-brief.md)); every later slice renders inside this chrome.

Hard constraints from the brief (D1–D10) apply. Do not invent a new visual brand — tighten Neo-Noir for mobile only. Prerequisites **#140** (header search + `/search` alias) and the brief on `main` are already satisfied.

## Problem

Cuebox is used ~90% of the time on a phone. The current `AppShell` (`frontend/src/components/app-shell.tsx`) uses a **top horizontal nav** with five labeled destinations (Home, Watchlist, Recommend, History, Settings) plus a conditional Review link and a Search control. That layout:

- Crowds primary destinations into a hard-to-reach top strip on phones
- Treats **History** and **Settings** as peer primary tabs (conflicts with brief **D3** / **D4**)
- Puts **Review** in the primary nav row instead of a notification-style badge (**D3**)

Slice (a) establishes the durable chrome IA so later slices (#142–#146) do not rework navigation again.

## Acceptance criteria

- [ ] **Bottom tabs** on phone viewports: **Home · Watchlist · Recommend · More** using Material Symbols Outlined via existing `Icon`; **filled only when active**
- [ ] **More** navigates to Settings (`/settings/sync`); Settings is **not** its own bottom tab
- [ ] **History is not a bottom tab** — remains reachable via existing Home / route links; no fifth tab
- [ ] **Review** is a **header notification badge** (not a tab): visible only when `usePendingReviewCount` / pending count **> 0**; tap opens `/review`; count shown with existing `Badge`
- [ ] **Header search icon** (magnifying glass, `aria-label="Search films"`) present on all primary shell screens; navigates to `/search` (alias behavior from #140) — **do not regress #140**
- [ ] **No FAB**
- [ ] Primary tab hit targets are thumb-friendly (**~≥44×44px**); no essential hover-only actions (success criterion **C**)
- [ ] Desktop (`md`+): may keep the same bottom-tab chrome or a compact top bar, but **must not** reintroduce History or Settings as peer primary tabs conflicting with **D3**
- [ ] Neo-Noir tokens / typography / icon language preserved (`documents/DESIGN.md`, `frontend/src/styles/tokens.css`)
- [ ] Any new shell motion honors `prefers-reduced-motion` (brief **D8**)
- [ ] **Tests:** unit and/or Playwright coverage for tab active states, More → settings, Review badge visibility + navigation, search icon → `/search`

## Scope

### In scope

| Area | Change |
|------|--------|
| `frontend/src/components/app-shell.tsx` | Rewrite to bottom-tab + header chrome |
| `frontend/src/components/app-shell.test.tsx` | Update / expand for new IA |
| Active states | `/` → Home; `/watchlist*` → Watchlist; `/recommend*` → Recommend; `/settings/*` → More |
| Review badge | Reuse `usePendingReviewCount` → `/films/reviews/pending-count` |
| Header search | Preserve #140 magnifying glass → `/search` |
| Layout | Safe area / bottom padding so `<main>` content is not obscured by the tab bar |
| Desktop | Documented adaptation that still obeys D3 (four primary destinations only) |
| E2E | Update any specs that assert the old five-item top nav order |

### Out of scope

- Home hub content redesign (slice b — #142)
- Watchlist poster grid / filter sheet (slice c — #143)
- Film detail reskin (slice d — #144)
- Results ceremony 1→2→3 (slice e — #145)
- Questionnaire density / first-run polish (slice f — #146)
- PWA, Insights/Ask, Developer Mode visual redesign, rebrand
- New settings index page (optional later); More targets existing `/settings/sync`
- Changing Review / Search / History **page** content (routes stay; only chrome changes)
- API / DB / config changes

## User flows / API changes

### Phone (default)

1. Fixed **bottom tab bar** with four items: Home, Watchlist, Recommend, More.
2. Current route highlights the matching tab (icon filled + active styles); More is active on any `/settings/*` path.
3. **Header** (top): Cuebox brand (links Home) · search icon · Review badge when pending count > 0.
4. Tap **More** → `/settings/sync`.
5. Tap **Review badge** → `/review`.
6. Tap **search** → `/search` (redirects to Home with picker focused per #140).
7. History remains available via existing Home links / `/history` routes — **not** via the tab bar.

### Desktop (`md`+)

Recommended default for this slice: **keep the same bottom-tab + header chrome** at all breakpoints so phone and desktop share one IA. Acceptable alternative: a compact top bar that still exposes only Home / Watchlist / Recommend / More (+ header search + Review badge) — never History or Settings as additional primary peers.

### Active-state rules

| Route prefix | Active tab |
|--------------|------------|
| `/` (exact) | Home |
| `/watchlist` | Watchlist |
| `/recommend` | Recommend |
| `/settings` | More |
| `/history`, `/review`, `/films/…`, etc. | No bottom tab forced active (header Review may show active styles when on `/review`) |

### Icon language (Material Symbols Outlined)

Reuse existing names where already in `AppShell`:

| Destination | Icon `name` | Notes |
|-------------|-------------|-------|
| Home | `home` | filled when active |
| Watchlist | `bookmark` | filled when active |
| Recommend | `movie` | filled when active |
| More | `more_horiz` | filled when active; Settings gear is **not** the tab icon |
| Search (header) | `search` | never filled as a tab |
| Review (header) | `fact_check` | filled when on `/review`; badge count adjacent |

### Hit targets & a11y

- Each bottom tab is a link with visible label (icon + short text) and **≥44px** minimum touch target (padding and/or `min-h`/`min-w`).
- Do not rely on hover-only affordances for tab switching, Review, or Search.
- Preserve accessible names: e.g. Search `aria-label="Search films"`; Review link includes count in accessible name when badge visible.

### Layout / safe area

- Bottom tab bar is `position: fixed` (or sticky equivalent) spanning the viewport bottom.
- `<main>` (or shell content wrapper) gains bottom padding ≈ tab bar height + `env(safe-area-inset-bottom)` so last content is scrollable above the bar.
- Header remains at top; existing `main-scanlines` / Neo-Noir atmosphere on main content stays.

### Motion

- Optional subtle active-state transition is fine if it respects `prefers-reduced-motion` (disable or shorten transitions when reduced motion is requested). No decorative motion required for this slice.

### API changes

**None.** Frontend-only shell change.

## Data and integration notes

- **DB / migrations:** none
- **API:** reuses `GET /films/reviews/pending-count` via `usePendingReviewCount`
- **Routes:** existing `/`, `/watchlist`, `/recommend`, `/settings/sync`, `/search`, `/review`, `/history`
- **#140 regression surface:** header search link `href="/search"` + label `"Search films"` must remain; `/search` alias and Home inline picker behavior unchanged
- **Design system:** Cabin / Libre Franklin / Space Mono; Material Symbols Outlined; tokens from `tokens.css` — no new brand colors or icon library

## Open questions

_(none — issue + brief D1–D10 are sufficient to plan)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/141
- Product brief: [documents/ui-mobile-product-brief.md](../../../documents/ui-mobile-product-brief.md) (D3 primary nav, D8 a11y/motion, D10 criterion C/E/F)
- Design system: [documents/DESIGN.md](../../../documents/DESIGN.md)
- Prerequisite #140 (closed): Home inline picker + header search
- Sibling slices: #142 (Home hub), #143 (watchlist grid), #144 (film detail), #145 (ceremony), #146 (questionnaire / first-run)
- Current shell: `frontend/src/components/app-shell.tsx`
