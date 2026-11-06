# Implementation plan — Issue #142

**Tier:** application  
**Issue type:** feature (Home hub recomposition / IA polish; not a bug)

## Overview

Restyle and recompose `frontend/src/app/page.tsx` so returning-user Home is a single phone-first **hub** (brief **D1 / D4 / D7 / D10-A**), not a dashboard of peer cards:

1. Short hub headline + support copy
2. Inline `LibrarySearchPicker` near the top (Job 1) — behavior unchanged from #140
3. Primary **Create a recommendation** CTA → `/recommend` (Job 2; ≤ 2 taps / success criterion A)
4. Secondary **History** quick link → `/history` (Job 3; not a tab — D3/D4)

Remove competing Home cards for **Your watchlist** / **View watchlist** and **Films need review** / **Review now** (Watchlist tab + header Review badge already exist via #141). Empty-watchlist **Import watchlist** path stays obvious; deeper first-run polish is #146.

Compose inside the existing #141 `AppShell` (`px-4` = 16px mobile margins). No API/DB/config changes. Draft PR **#150** base is already `feature/mobile-ui`.

## Reproduction findings

N/A — feature recomposition. Baseline confirmed by static read of `frontend/src/app/page.tsx` on `feature/mobile-ui` tip:

- Returning user: `Card` for watchlist count + dual `sm:grid-cols-2` cards (**New recommendation** / **History**) + conditional Review card
- CTA copy still **Start questionnaire** / **View history** / **View watchlist**
- Picker placeholder still **Find a film…** (needs library-or-add tone)

## Root cause

N/A (feature). Product constraint: Home should be a nightly hub with clear D4 job hierarchy; peer cards dilute Recommend/History and duplicate shell destinations.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/app/page.tsx` | **Rewrite returning-user + light empty polish** | Hub stack; remove peer cards; new CTA/link hierarchy; drop unused `usePendingReviewCount` / `useWatchlistCount` |
| `frontend/src/components/library-search-picker.tsx` | **Copy-only** (optional props or default placeholder/helper) | Reinforce “find in library or add” tone; keep `data-testid="library-search-input"` and all merge/action behavior |
| `frontend/src/app/page.test.tsx` | **New** | Unit coverage for hub CTAs, picker presence, empty Import, no Review/Watchlist peer cards |
| `frontend/src/components/library-search-picker.test.tsx` | Edit if picker defaults/props change | Placeholder / helper assertions |
| `frontend/e2e/library-search-picker.spec.ts` | Edit | New CTA labels; hub vertical order; no dual intent CTAs; placeholder |
| `frontend/e2e/watchlist-add.spec.ts` | Edit | Drop “View watchlist” / watchlist-count card assertions; align Home CTA names |
| `frontend/e2e/app-shell-mobile.spec.ts` | Smoke-check only | Ensure Home still shows picker; no new shell work |
| `documents/DESIGN.md` | Optional one line | Home hub composition rule only if a documented layout delta is needed |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| `frontend/src/components/app-shell.tsx` | #141 owns shell / tabs / Review badge |
| Picker result actions / merge APIs | Out of scope |
| API / Alembic / `config.yaml` | Presentation only |
| Slices c–f (#143–#146) | Sibling work |

## Implementation steps

### Step 1 — Returning-user hub layout

Replace the card grid in `HomePageContent` (`hasWatchlist === true`) with a single vertical composition:

```text
<div className="mx-auto max-w-lg (or max-w-2xl) space-y-*">
  <header>  short h1 + support (hub, not dashboard)
  <LibrarySearchPicker … />   <!-- near top; Job 1 -->
  <Button asChild size="lg" className="w-full min-h-11">  <!-- ≥44px; btn-chamfer via default -->
    <Link href="/recommend">Create a recommendation</Link>
  </Button>
  <Link href="/history" className="… secondary / link weight">History</Link>
  <HealthPanel … />  <!-- collapsed; secondary; after hub jobs -->
</div>
```

Locked rules:

| Element | Role |
|---------|------|
| Inline picker | Job 1 — near top |
| **Create a recommendation** | Job 2 — primary chamfered CTA → `/recommend` |
| **History** | Job 3 — text/link or lighter secondary; **not** a twin primary card → `/history` |
| Watchlist | Tab only — **no** “View watchlist” card |
| Review | Header badge only — **no** Home Review card |
| System status | Optional collapsed footer; must not own first viewport |

Copy direction:

- Replace Home headline/support that implies “browse cards”; keep short hub language (e.g. keep or lightly tighten “What do you want to watch?” + one support sentence naming find / recommend / history).
- Primary CTA label exactly: **Create a recommendation**
- History accessible name: **History** (or “View history” only if needed for a11y — prefer brief **History** per SPEC)

Remove imports/usages no longer needed: `usePendingReviewCount`, `useWatchlistCount`, `Card*` / `Badge` if unused, `CardGridSkeleton` only if still used for loading.

Preserve:

- `Suspense` + loading / error paths
- `/?focus=search` → focus `[data-testid="library-search-input"]` + `router.replace("/", { scroll: false })`
- `LibrarySearchPicker autoFocus={focusSearch}`

### Step 2 — Picker copy (behavior untouched)

Update Home-facing picker tone to library-or-add (no discovery/catalogue language):

**Preferred (minimal surface):** add optional props on `LibrarySearchPicker`, e.g. `placeholder` and/or `helperText`, passed from Home:

- Placeholder example: `Find a film in your library or add one…`
- Helper example: reinforce library + TMDB / add — avoid “discover” / browse-the-catalogue

**Alternative:** change picker defaults globally to the same tone (still copy-only) and update `library-search-picker.test.tsx` + e2e placeholders.

Do **not** reintroduce separate Add vs Mark watched entry CTAs. Do **not** change result row actions or merge logic.

### Step 3 — Empty watchlist

Keep welcome + primary **Import watchlist** → `/import` obvious. Card wrapper may stay (first-run polish is #146) as long as Import remains the clear first action. No requirement to show the returning-user hub stack. Keep collapsed System status secondary.

### Step 4 — Density / motion / Neo-Noir

- Rely on AppShell `px-4` for **16px** mobile margins; avoid extra horizontal padding that fights the shell.
- Prefer no peer card grid; primary CTA uses existing `Button` default (`btn-chamfer`).
- Any new motion (e.g. subtle CTA transition) must honor `prefers-reduced-motion` (D8); no essential hover-only actions.
- No new brand tokens unless composition truly requires a documented `DESIGN.md` delta (default: none).

### Step 5 — Unit tests (`page.test.tsx`)

New Home unit file (React Testing Library + existing query wrappers / hook mocks pattern from other `app/*/page.test.tsx`):

1. Returning user: `data-testid="library-search-input"` present
2. Link **Create a recommendation** → `href="/recommend"`
3. Link **History** → `href="/history"`
4. No links/cards: **View watchlist**, **Review now**, **Start questionnaire**, **New recommendation** (as Home peer CTAs)
5. Empty watchlist: **Import watchlist** → `/import`; picker absent
6. Optional: vertical order smoke (picker above Recommend CTA) if easy in jsdom

### Step 6 — E2E updates

- `library-search-picker.spec.ts`: rename assertions from `Start questionnaire` / `View history` to **Create a recommendation** / **History**; keep picker-above-CTA Y-order; update placeholder; empty Import case still green; dual intent CTAs still absent.
- `watchlist-add.spec.ts` “home shows inline search…”: remove **View watchlist** / “12 films on your watchlist” card expectations; assert hub CTAs + picker instead.
- Grep e2e for stale Home strings; leave results-view “New recommendation” alone (not Home).

### Step 7 — Docs (minimal)

Optional one-line Home hub note in `DESIGN.md` next to the existing App chrome IA bullet — only if execute wants a documented composition rule. Do not rewrite the product brief or ROADMAP.

## Tests required

| Test | Type | Acceptance criteria covered |
|------|------|----------------------------|
| Returning Home: picker + Create a recommendation → `/recommend` + History → `/history` | unit | Hub composition; ≤2 taps entry; History quick link |
| No View watchlist / Review now peer cards on Home | unit | Review via badge only; Watchlist via tab only |
| Empty Home: Import watchlist primary; no picker | unit + e2e | Empty path not regressed |
| Picker `data-testid="library-search-input"`; no Add/Mark watched intent CTAs | unit + e2e | #140 behavior; picker presence |
| Picker placeholder/helper library-or-add tone | unit + e2e | Picker copy |
| Picker above Recommend CTA (Y order) | e2e | Inline picker near top |
| `/search` / `?focus=search` still focuses Home picker | e2e (existing) | #140 regression |
| `npx tsc --noEmit` + `npm run test:unit` | CI/local | Types + unit suite green |

## Gate script

Frontend MVP presentation change (no API). Execute should run:

```bash
source scripts/cursor-workflow-config.sh
cd frontend && npm run test:unit && npx tsc --noEmit
bash scripts/verify-phase6-gates.sh
```

Optional stronger pre-merge: `bash $APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`).

With stack up, also:

```bash
cd frontend && PLAYWRIGHT_E2E_STACK=1 npx playwright test \
  e2e/library-search-picker.spec.ts \
  e2e/watchlist-add.spec.ts \
  e2e/app-shell-mobile.spec.ts
```

**Host build gotcha:** stop compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Documentation updates

| File | Update |
|------|--------|
| `documents/DESIGN.md` | Optional one-line Home hub composition note |
| `workflow/issues/issue-142/PLAN.md` / `demo/` | This plan + demo-spec |
| README / API docs | None |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| E2E/unit selectors still expect old CTA strings | Grep/update Home-specific strings; leave non-Home “New recommendation” alone |
| Removing Review card hides pending reviews | Intentional — header badge (#141) is the path; demo confirms badge still works |
| Picker default copy change breaks shared tests | Prefer Home props **or** update picker unit + e2e in same commit |
| Over-scoping into shell / ceremony / first-run art | Strict out-of-scope; only Home + copy props + tests |
| Empty-state regression | Keep Import primary; e2e empty case |
| PR base wrong (`main`) | PR #150 already targets `feature/mobile-ui` — do not retarget to `main` |

**Rollback:** Revert `page.tsx` (+ picker copy props if any) and test commits; prior card dashboard returns.

## Definition of done

- [x] Returning Home is a single hub stack: picker → **Create a recommendation** → **History** (no peer card grid)
- [x] One tap from Home to `/recommend` via primary CTA (≤ 2 taps criterion A)
- [x] No Home **View watchlist** or **Review now** peer cards
- [x] Picker library-or-add copy; `data-testid="library-search-input"` preserved; no dual intent CTAs
- [x] Empty Import CTA still obvious
- [x] System status secondary / not first-viewport dominant
- [x] Unit + E2E coverage mapped above green
- [x] `bash scripts/verify-phase6-gates.sh` exit 0
- [ ] Demo artifacts per `demo/demo-spec.md`
- [x] `workflow.state.json` → `execute-ready` after execute (planning ends at `plan-ready`)

## PR seed

**Tier:** application  
**What / why:** Recompose Home into a phone-first hub (inline picker + Create a recommendation + History) so D4 jobs are clear and shell destinations are not duplicated as peer cards.  
**Key changes:** Rewrite `page.tsx` hub layout; picker copy-only tone; remove Watchlist/Review Home cards; unit + e2e hub coverage.  
**Gate:** Phase 6 (`verify-phase6-gates.sh`) + `frontend` unit tests; optional Phase 8 full regression.  
**How to test:** Open `/` with seeded watchlist — picker near top, **Create a recommendation** → `/recommend`, **History** → `/history`; empty DB shows **Import watchlist**; Review only via header badge.  
**Base branch:** `feature/mobile-ui` (PR #150).
