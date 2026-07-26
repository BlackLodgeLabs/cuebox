# Implementation plan — Issue #141

**Tier:** application  
**Issue type:** feature (mobile app-shell IA rewrite; not a bug)

## Overview

Rewrite `AppShell` from a five-item top horizontal nav (Home · Watchlist · Recommend · History · Settings + Search + Review) into the phone-first chrome locked in [documents/ui-mobile-product-brief.md](../../../documents/ui-mobile-product-brief.md) **D3**:

1. **Slim top header** — Cuebox brand (→ `/`) · search icon (`aria-label="Search films"` → `/search`) · conditional Review notification badge (`fact_check` + `Badge` when pending count > 0 → `/review`)
2. **Fixed bottom tab bar** — **Home · Watchlist · Recommend · More** (Material Symbols Outlined via existing `Icon`; filled only when active)
3. **More** → `/settings/sync` (Settings is not its own tab; icon is `more_horiz`, not `settings`)
4. **History is not a tab** — remains reachable via Home / `/history` routes only
5. **Safe-area / bottom padding** so `<main>` content is never obscured by the tab bar
6. **No FAB**; Neo-Noir tokens preserved; any new motion honors `prefers-reduced-motion`

**Desktop (`md`+):** keep the **same** bottom-tab + header chrome at all breakpoints (SPEC recommended default) so phone and desktop share one IA and History/Settings never reappear as peer primary tabs.

No API, DB, or config changes. Do not regress #140 (`/search` alias + header search label/href).

## Reproduction findings

N/A — greenfield chrome rewrite (feature). Current baseline confirmed by static read of `frontend/src/components/app-shell.tsx`: top `NAV_ITEMS` includes History and Settings as peers; Review sits in the primary nav row; no bottom tabs or safe-area padding.

## Root cause

N/A (feature). Product constraint: ~90% phone use; current top strip conflicts with brief **D3** / **D4**.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/components/app-shell.tsx` | **Rewrite** | Bottom tabs + header chrome, active-state rules, safe-area padding |
| `frontend/src/components/app-shell.test.tsx` | **Rewrite / expand** | Cover new IA: tabs, More→settings, Review badge, search, active states, no History tab |
| `frontend/e2e/pr-review-regression.spec.ts` | Edit if needed | Home link assertion should still pass; tighten if selectors break |
| `frontend/e2e/app-shell-mobile.spec.ts` | **New** (optional but preferred) | Playwright coverage for tab active states, More, Review badge, search |
| `frontend/src/app/globals.css` | Edit if needed | Optional reduced-motion helper for tab active transition; only if shell adds new motion classes |
| `documents/DESIGN.md` | Optional short note | Document that app chrome is bottom-tab + header (D3) — only if a one-paragraph IA note is missing |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| API / Alembic / `config.yaml` | Frontend-only |
| `/search` page, Home picker, Review / History / Settings **page** content | Routes stay; chrome only |
| Home hub (#142), watchlist grid (#143), film detail (#144), ceremony (#145), questionnaire (#146) | Sibling slices |

## Implementation steps

### Step 1 — Shell structure

Replace top-nav-only layout in `app-shell.tsx` with:

```text
<div min-h-screen>
  <header fixed/sticky top>  Brand | search | Review?
  <main class="main-scanlines" + bottom padding>
  <nav fixed bottom>  Home | Watchlist | Recommend | More
</div>
```

- Header: keep Cuebox `text-h2 font-heading` brand link; icon-only search (`Icon name="search"`, `aria-label="Search films"`, `href="/search"`); Review link only when `usePendingReviewCount()` > 0, with `Badge` count and accessible name including count (e.g. existing `"Review 3"` pattern).
- Bottom nav: four `Link`s with icon + short visible label; `min-h-[44px]` / `min-w-[44px]` (or equivalent padding) for thumb targets.
- Tab bar: `fixed inset-x-0 bottom-0`, `border-t border-border bg-card`, `padding-bottom: env(safe-area-inset-bottom)`, `z-` above content.
- Main: add bottom padding ≈ tab bar height + safe-area (e.g. `pb-[calc(4.5rem+env(safe-area-inset-bottom))]` or token-aligned equivalent) so last content scrolls clear of tabs.
- Preserve `main-scanlines` on `<main>`.

### Step 2 — Active-state rules

| Route | Active tab |
|-------|------------|
| `pathname === "/"` | Home |
| `pathname.startsWith("/watchlist")` | Watchlist |
| `pathname.startsWith("/recommend")` | Recommend |
| `pathname.startsWith("/settings")` | More |
| `/history`, `/review`, `/films/…`, `/import`, `/search` redirect target, etc. | **No** bottom tab forced active |

Review header control: filled `fact_check` + active styles when `pathname.startsWith("/review")`. Search never uses filled-as-tab styling.

Icons (Material Symbols Outlined names already used in shell):

| Tab / control | `name` |
|---------------|--------|
| Home | `home` |
| Watchlist | `bookmark` |
| Recommend | `movie` |
| More | `more_horiz` |
| Search | `search` |
| Review | `fact_check` |

### Step 3 — Motion & a11y

- Optional subtle active-state `transition-*` is fine; wrap in `@media (prefers-reduced-motion: reduce)` (disable or shorten) — brief **D8**.
- Do not rely on `hover-glow` alone for essential affordances; tabs/search/Review must work on touch without hover.
- No FAB.

### Step 4 — Unit tests

Rewrite `app-shell.test.tsx` with pathname mock variants (e.g. `vi.mock` factory + mutable `pathname` / per-describe mocks):

1. Renders exactly four bottom tabs: Home, Watchlist, Recommend, More — **no** History or Settings tab labels.
2. More → `href="/settings/sync"`.
3. Active: `/` → Home; `/watchlist` → Watchlist; `/recommend/...` → Recommend; `/settings/sync` → More; `/history` → none of the four forced active.
4. Search: `getByRole("link", { name: "Search films" })` → `/search` ( #140 regression).
5. Review badge: when count > 0, link to `/review` with count in accessible name; when count = 0, Review link absent.
6. Hit-target smoke: tab links expose sufficient padding / min size classes (assert class tokens or computed style if practical in jsdom).

### Step 5 — E2E

- Keep `pr-review-regression` Home `/` assertion green.
- Add `frontend/e2e/app-shell-mobile.spec.ts` (mocked API, can run without stack keys):
  - Bottom tabs order and labels
  - More navigates to settings sync heading
  - Mock `pending-count` → Review badge visible → click → `/review`
  - Search icon → lands on Home with search focus (`/?focus=search` via `/search`)
  - Viewport ~390×844 for phone chrome screenshots if useful for demo
- Update any spec that assumed five top-nav peers or “Settings” as a primary nav label (grep for `/history` nav or Settings nav in e2e — currently Home page “View history” is fine).

### Step 6 — Docs (minimal)

- Optional one-paragraph note under DESIGN.md navigation / IA that primary chrome is bottom tabs Home·Watchlist·Recommend·More + header search/Review — only if execute finds no existing D3 pointer.
- Do **not** rewrite sibling slice docs or ROADMAP.

## Tests required

| Test | Type | Acceptance criteria covered |
|------|------|----------------------------|
| Four bottom tabs; no History/Settings peers | unit | Bottom tabs IA; History not a tab; More ≠ Settings tab |
| More → `/settings/sync` | unit + e2e | More navigates to Settings |
| Active states per route table | unit | Active-state rules |
| Review badge visibility + `/review` | unit + e2e | Review as header badge |
| Search → `/search` + `aria-label` | unit + e2e | Header search; no #140 regression |
| No FAB in shell | unit (query absence) or code review | No FAB |
| Tab min hit target ~44px | unit (class/style) and/or e2e bounding box | Criterion C |
| `prefers-reduced-motion` if new motion CSS added | unit/css grep or visual | D8 |
| Existing `pr-review-regression` Home link | e2e (stack) | Home stays `/` with badge |
| `npx tsc --noEmit` + `npm run test:unit` | CI/local | Types + unit suite green |

## Gate script

Frontend MVP chrome change (no API). Execute should run:

```bash
source scripts/cursor-workflow-config.sh
cd frontend && npm run test:unit && npx tsc --noEmit
bash scripts/verify-phase6-gates.sh
```

Optional stronger pre-merge: `bash $APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`).

With stack up, also:

```bash
cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test e2e/app-shell-mobile.spec.ts e2e/pr-review-regression.spec.ts e2e/library-search-picker.spec.ts
```

**Host build gotcha:** stop compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Documentation updates

| File | Update |
|------|--------|
| `documents/DESIGN.md` | Optional one-paragraph chrome IA note (bottom tabs + header) |
| `workflow/issues/issue-141/PLAN.md` / demo | This plan + demo-spec (already) |
| README / API docs | None |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Content hidden behind fixed tabs | Explicit `main` bottom padding + safe-area; demo scrolls to last content |
| #140 search regression | Preserve href/label; unit + picker e2e |
| Desktop users lose History peer tab | Intentional per D3/D4; History remains on Home + `/history` |
| E2E selectors break on “Settings” vs “More” | Grep/update nav assertions; page headings unchanged |
| Over-scoping into Home/watchlist redesign | Strict out-of-scope list; only `app-shell` + tests |
| Safe-area unsupported in some browsers | `env(safe-area-inset-bottom)` with `0` fallback |

**Rollback:** Revert `app-shell.tsx` + test commits; prior top-nav chrome returns.

## Definition of done

- [ ] Bottom tabs Home · Watchlist · Recommend · More with filled-only-when-active icons
- [ ] More → `/settings/sync`; Settings/History not bottom tabs
- [ ] Header: Cuebox + Search films → `/search` + Review badge when count > 0 → `/review`
- [ ] No FAB; ≥44px tab hit targets; Neo-Noir tokens preserved
- [ ] Main content clear of tab bar (padding + safe-area)
- [ ] Desktop shares same four-destination IA (no History/Settings peer tabs)
- [ ] Unit + E2E coverage mapped above green
- [ ] `bash scripts/verify-phase6-gates.sh` exit 0
- [ ] Demo artifacts per `demo/demo-spec.md`
- [ ] `workflow.state.json` → `execute-ready` after execute (planning ends at `plan-ready`)

## PR seed

**Tier:** application  
**What / why:** Phone-first AppShell — bottom tabs (Home · Watchlist · Recommend · More) + header search/Review badge so later mobile slices share one IA (brief D3).  
**Key changes:** Rewrite `app-shell.tsx`; expand unit/E2E; safe-area main padding; remove History/Settings as primary peers.  
**Gate:** Phase 6 (`verify-phase6-gates.sh`) + `frontend` unit tests; optional Phase 8 full regression.  
**How to test:** Open `/` on a ~390px viewport — four bottom tabs; More → settings; with pending reviews, header badge → `/review`; search icon → Home picker via `/search`.
