# Implementation plan — Issue #158

**Tier:** application  
**Issue type:** bug (shell / wayfinding gaps on shipped `feature/mobile-ui` phone UI)  
**Integration base:** `feature/mobile-ui` (draft PR **#164** already targets it — do not retarget to `main`)

## Overview

Close app-shell wayfinding defects from phone review against brief **D3**: More currently dumps users on Sync; the sticky header ignores top safe-area; active tabs are near-muted; Review / History / Import lack light return chrome.

Reproduction on 2026-07-30 (390×844, seeded watchlist) confirmed all four gaps — see [Reproduction findings](#reproduction-findings) and `demo/bug-repro-notes.md`.

Preserve locked D3 tabs (Home · Watchlist · Recommend · More), Review as header badge, Neo-Noir tokens, no FAB, no History tab. No API / DB / sync protocol / sibling #159–#161 surface work.

## Reproduction findings

Evidence under `workflow/issues/issue-158/demo/` (`bug-repro-*`):

| Gap | Observed |
|-----|----------|
| **More ≠ More** | More `href` = `/settings/sync`; tap lands on Sync settings. `/more` → **404** (`bug-repro-screenshot-2`, `-6`). |
| **No top safe-area** | Sticky header `paddingTop: 0`; no `safe-area-inset-top` class. Viewport meta lacks `viewport-fit=cover` (`bug-repro-metrics.json`). |
| **Subtle active tab** | Active `#e3e3de` vs inactive `#c3c8bd` only; RGB distance ~53; no accent bar / weight / primary tint (`bug-repro-screenshot-1`). |
| **Weak off-tab chrome** | History / Import `main` has **no** back links (title only). Review empty state has Recommend CTA only. Film detail `← Watchlist` (`min-h-11`) is the precedent (`bug-repro-screenshot-3`–`5`, `-7`). |

## Root cause

1. **More hub missing:** Bottom-tab config hard-codes More → `/settings/sync` as a Sync shortcut; no `/more` route exists.
2. **Header safe-area asymmetry:** Tab bar pads `safe-area-inset-bottom`; sticky header never got the matching top inset; root viewport meta never set `viewport-fit=cover`.
3. **Active affordance under-specified in implementation:** Only `text-foreground` vs `text-muted-foreground` + filled icon — below the locked “≥2 of 3” bar (accent, indicator, weight).
4. **Off-tab pages title-only:** Review / History / Import never adopted the film-detail light back strip; no shared helper.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/app/more/page.tsx` (**new**) | More hub: single-purpose destination list — Sync → `/settings/sync`, Import → `/import`, History → `/history` (order locked); Neo-Noir link rows, optional one-line supporting copy; no card dashboard | Hub AC |
| `frontend/src/components/app-shell.tsx` | More `href` → `/more`; `isActive` → `/more` \|\| `/more/*` \|\| `/settings*`; sticky header (or inner bar) `pt-[env(safe-area-inset-top,0px)]` (keep sticky); active tab: **≥2** of accent/`text-primary` + filled icon, top/bottom accent indicator, stronger mono weight | Routing + safe-area + active tab |
| `frontend/src/app/layout.tsx` | Export Next.js `viewport` (or metadata) with `viewportFit: "cover"` if still missing after header pad | iOS env() insets |
| `frontend/src/components/off-tab-page-header.tsx` (**new**, name flexible) | Shared compact strip: ≥44px `← Home` → `/` + page title (+ optional subtitle); mirror `film-detail-view` lightness | Off-tab chrome AC |
| `frontend/src/app/review/page.tsx` | Use shared header on loaded + empty states | Off-tab Review |
| `frontend/src/app/history/page.tsx` | Use shared header above filters/list | Off-tab History list |
| `frontend/src/app/history/[sessionId]/page.tsx` | Light ← Home (or shared header) outside ceremony stage UI — do not restyle ceremony internals | Off-tab History detail |
| `frontend/src/app/import/page.tsx` | Use shared header | Off-tab Import |
| `frontend/src/app/import/[jobId]/page.tsx` | Shared ← Home; optional Import-parent link OK if Home remains | Off-tab Import status |
| `frontend/src/components/app-shell.test.tsx` | Update More href `/more`; active matrix includes `/more` + `/settings/sync`; assert Import/History not More-active; safe-area class on header; active tab classes include accent and/or indicator and/or weight beyond muted pair | Unit shell |
| `frontend/src/app/more/page.test.tsx` (**new**) | Hub lists Sync / Import / History with correct hrefs and order | Unit hub |
| `frontend/src/components/off-tab-page-header.test.tsx` (**new**) | ← Home ≥44px / `min-h-11`, href `/`, title rendered | Unit chrome |
| Page tests (`review` / `history` / `import` / `[jobId]` / `[sessionId]` as needed) | Assert ← Home present | Off-tab regression |
| `frontend/e2e/app-shell-mobile.spec.ts` | More → `/more` (not Sync); hub destinations; More active on hub + settings; Sync still reachable; header safe-area class; stronger active affordance; optional off-tab chrome checks | E2E shell |
| Optional small E2E additions on history/import/review routes | ← Home visible at 390×844 | E2E off-tab |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| Sync page capabilities / API | Destination only; no new settings features |
| Tab set / Review badge / Search | D3 locked |
| Ceremony / questionnaire / picker (#159 / #161) | Sibling |
| Surface clarity (#160) | Sibling |
| `api/` / DB / sync protocol | Frontend routing / shell only |
| FAB / History as fifth tab | Design constraints |

## Locked implementation choices

| Decision | Choice |
|----------|--------|
| Hub path | `/more` (More tab `href`) |
| More `isActive` | `pathname === "/more" \|\| pathname.startsWith("/more/") \|\| pathname.startsWith("/settings")` |
| Sync path | Keep `/settings/sync` contents in place |
| Hub UI | Link rows (not cards); order **Sync → Import → History**; structure so future rows can append |
| Active tab | Implement **(1) accent/`text-primary` label + filled icon** and **(2) persistent top hairline or bottom accent bar** on the active control; optional stronger mono weight as bonus. Inactive stay `text-muted-foreground`. Keep `min-h/w-[44px]`. |
| Off-tab chrome | Shared helper; `← Home` / “Back to Home” → `/`; `min-h-11`; title; no second nav bar / multi-segment breadcrumbs |
| History detail | Place chrome above/around `RecommendationCeremony`, not inside stage steps |
| Safe-area | `pt-[env(safe-area-inset-top,0px)]` on sticky `<header>` (prefer outer sticky element so background extends under notch); add `viewportFit: "cover"` |
| Search off-tab | Optional — only if shared helper is reused; keep minimal |

## Implementation steps

### Step 1 — More hub + shell routing

1. Add `frontend/src/app/more/page.tsx` with Sync / Import / History destination rows.
2. Point More tab at `/more`; update `isActive` per locked matrix.
3. Update unit + E2E assertions that currently expect `/settings/sync`.
4. Confirm Sync page still reachable from hub and retains CSV / watched / RSS UI.

### Step 2 — Header top safe-area + viewport-fit

1. Pad sticky header with `env(safe-area-inset-top)`.
2. Export Next.js viewport with `viewportFit: "cover"` if meta still lacks it.
3. Unit: assert header class/style includes safe-area-top; do not regress bottom tab safe-area.

### Step 3 — Stronger active tab

1. Apply accent label + filled icon and a persistent indicator (top hairline or bottom accent bar) using existing tokens (`text-primary`, border/primary, etc.).
2. Unit: active link classes no longer solely `text-foreground` vs muted; assert indicator/accent markers; inactive remain muted; hit targets ≥44px.

### Step 4 — Off-tab location chrome

1. Add shared `OffTabPageHeader` (or equivalent).
2. Wire Review / History list / Import list; History detail + Import job status for consistency.
3. Unit/E2E: ← Home present, href `/`, `min-h-11`.

### Step 5 — Gates / polish

1. Run targeted unit + `app-shell-mobile` Playwright.
2. Run `$APP_DEFAULT_GATE` before execute-ready; host build gotcha: stop compose frontend + clear `frontend/.next` if needed.
3. No DESIGN.md rewrite required unless an existing mobile shell subsection should note More hub / safe-area — prefer skip.

## Tests required

| Acceptance criterion | Test |
|----------------------|------|
| More hub destinations | Unit `more/page.test.tsx`: Sync / Import / History hrefs + order. E2E: More → `/more`; three links visible/working. |
| Sync unchanged | E2E/unit: hub Sync → `/settings/sync`; heading Sync settings; existing sync page tests still pass. |
| More active on hub + settings | Unit matrix: `/more`, `/settings/sync` → More `aria-current=page`; `/import`, `/history` → More **not** active. |
| Top safe-area | Unit: header class matches `/safe-area-inset-top/`. Optional E2E class assert. |
| Stronger active tab | Unit: active has accent and/or indicator class markers beyond `text-foreground`; inactive muted; ≥44px. |
| Off-tab chrome | Unit on Review/History/Import (+ nested as covered): ← Home → `/`, `min-h-11`. E2E smoke optional. |
| Design constraints | Existing shell tests: 4 tabs, no History tab, no FAB, Review badge unchanged. |

## Gate script

```bash
source scripts/cursor-workflow-config.sh
cd frontend && npm run test:unit && npx tsc --noEmit
cd frontend && npx playwright test e2e/app-shell-mobile.spec.ts
# Host build gotcha with compose frontend:
# docker compose stop frontend && sudo rm -rf frontend/.next
bash "$APP_DEFAULT_GATE"   # scripts/verify-phase8-gates.sh
```

Narrower while iterating: Phase 6 / 6.5 + targeted unit/Playwright. **Final execute handoff** expects `$APP_DEFAULT_GATE` exit 0 (or Phase 6.5 + documented frontend green if Phase 8 blocked by unrelated infra — prefer Phase 8).

## Documentation updates

| File | Update |
|------|--------|
| `workflow/issues/issue-158/PLAN.md` / `demo/` | This plan + demo-spec + bug-repro |
| `documents/DESIGN.md` | Skip unless an existing mobile shell subsection should mention More hub / top safe-area |
| README / API docs | None |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Users bookmarked More→Sync deep link | Sync URL unchanged; hub is additive |
| Accent bar fights tab hit layout | Keep indicator inside the 44px control; verify at 390×844 |
| `viewport-fit=cover` changes desktop/browser chrome | Standard Next viewport export; verify sticky header still works |
| History detail chrome clashes with ceremony | Place strip outside ceremony; do not edit stage UI |
| Import job “Try again” / Review CTAs compete with ← Home | Keep Home as primary chrome; leave existing CTAs |
| Phase 8 host `.next` EACCES | Stop frontend container; `sudo rm -rf frontend/.next` before build |
| E2E still expects More→Sync | Update `app-shell-mobile.spec.ts` in same PR |

**Rollback:** Revert frontend shell/route/header commits on the issue branch; no schema migrations.

## Definition of done

- [ ] More opens `/more` hub with Sync, Import, History (locked order)
- [ ] Sync remains `/settings/sync` with existing CSV / watched / RSS capabilities
- [ ] More `aria-current` on hub + `/settings/*`; not forced on Import/History
- [ ] Sticky header clears top safe-area; bottom tab safe-area preserved; `viewport-fit=cover` if needed
- [ ] Active tab uses ≥2 locked affordances (accent + indicator at minimum)
- [ ] Review / History / Import (list + nested as scoped) show ← Home chrome
- [ ] Neo-Noir preserved; no FAB; no extra primary tabs; Review stays header badge
- [ ] Tests mapped above green; `$APP_DEFAULT_GATE` (or agreed narrower + frontend) exit 0
- [ ] Demo artifacts per `demo/demo-spec.md`
- [ ] Draft PR **#164** remains based on **`feature/mobile-ui`**
- [ ] `workflow.state.json` → `plan-ready` after this planning run

## PR seed

**Tier:** application  
**What / why:** Fix phone shell wayfinding — More hub, header top safe-area, stronger active tab, and off-tab ← Home chrome on Review/History/Import.  
**Key changes:** `/more` hub; `app-shell` routing + safe-area + active affordance; shared off-tab header; unit + `app-shell-mobile` E2E updates.  
**Gate:** `$APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`) + targeted shell Playwright.  
**How to test:** 390×844 — More→hub→Sync; header clears notch; active tab obvious; History/Import/Review show ← Home.  
**Base branch:** `feature/mobile-ui` (PR #164).
