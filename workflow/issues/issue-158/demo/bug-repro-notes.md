# Bug reproduction notes — Issue #158

**Date:** 2026-07-30  
**Commit SHA (planning start):** `635701f` (agent side-branch `cursor/issue-158-pr-164-plan-agent-8724`; base issue branch `cursor/issue-158-shell-wayfinding-8cee`)  
**Environment:** Docker Compose stack Up (`postgres`, `api`, `frontend`, `backup`); health `status=ok` / `database=ok` on both `$APP_HEALTH_URL_API` and `$APP_HEALTH_URL_FRONTEND`  
**Viewport:** 390×844 (iPhone-class, `isMobile` + touch)  
**Seed:** Part 2 seeded watchlist + history (returning-user Home); no API keys required for shell chrome

## Steps taken

1. Confirmed stack health via compose + config health URLs.
2. Opened `/` at 390×844 — inspected bottom tabs, active vs inactive computed colors, sticky header padding / classes, viewport meta.
3. Tapped **More** — observed navigation to Sync settings (not a hub).
4. Opened `/history`, `/import`, `/review` — inspected `main` for ← Home / off-tab location chrome (none).
5. Opened `/more` — confirmed 404.
6. Opened a watchlist film detail — captured `← Watchlist` as the light chrome precedent.
7. Saved metrics JSON + screenshots under this `demo/` folder.

## Expected vs actual

| Gap | Expected | Actual (observed) |
|-----|----------|-------------------|
| More hub | More opens `/more` hub listing Sync, Import, History | More `href` is **`/settings/sync`**; lands on **Sync settings** (`bug-repro-screenshot-2-more-lands-on-sync.png`). `/more` returns **404** (`bug-repro-screenshot-6-more-route-missing.png`). |
| Top safe-area | Sticky header pads `env(safe-area-inset-top)` | Header `paddingTop: 0px`; no `safe-area-inset-top` in class/style. Viewport meta = `width=device-width, initial-scale=1` (**no `viewport-fit=cover`**). Bottom tab bar already uses `pb-[env(safe-area-inset-bottom,0px)]`. |
| Stronger active tab | Active clearly distinct (accent / indicator / weight — ≥2 of locked affordances) | Active `text-foreground` `#e3e3de` vs inactive `text-muted-foreground` `#c3c8bd` only; filled icon helps. Euclidean RGB distance **~53**; no top/bottom accent bar, no accent token on label, both `fontWeight: 400`. |
| Off-tab chrome | Review / History / Import show compact ← Home strip + title | `main` on History/Import has **zero** back links — title (+ subtitle) only. Review empty state has Recommend CTA only, no ← Home. Film detail precedent: `← Watchlist` `min-h-11` muted link (`bug-repro-screenshot-7-film-detail-back-precedent.png`). |

## Artifacts

| File | Purpose |
|------|---------|
| `bug-repro-metrics.json` | More href, header padding, tab colors, viewport meta, off-tab main links, film-detail back |
| `bug-repro-screenshot-1-home-tabs.png` | Home + D3 tabs; subtle active Home |
| `bug-repro-screenshot-2-more-lands-on-sync.png` | More → Sync settings (not hub) |
| `bug-repro-screenshot-3-history-no-offtab-chrome.png` | History title only; no ← Home |
| `bug-repro-screenshot-4-import-no-offtab-chrome.png` | Import title only; no ← Home |
| `bug-repro-screenshot-5-review-no-offtab-chrome.png` | Review empty state; no ← Home strip |
| `bug-repro-screenshot-6-more-route-missing.png` | `/more` → 404 |
| `bug-repro-screenshot-7-film-detail-back-precedent.png` | `← Watchlist` light chrome to mirror |

## Code confirmation (static)

- `frontend/src/components/app-shell.tsx` — More tab `href: "/settings/sync"`; `isActive` = `pathname.startsWith("/settings")`; sticky `<header>` has no top safe-area; active tab classes = `text-foreground` vs `text-muted-foreground` only.
- `frontend/src/app/layout.tsx` — `metadata` has no `viewport-fit=cover` (Next default viewport lacks it).
- No `/more` page under `frontend/src/app/`.
- `frontend/src/app/{review,history,import}/**` — page headers are `h1` (+ optional subtitle); no shared off-tab chrome helper.
- `frontend/src/components/film-detail-view.tsx` — `← Watchlist` `inline-flex min-h-11 … text-muted-foreground` (**mirror target**).
- Tests encode current broken IA: `app-shell.test.tsx` and `e2e/app-shell-mobile.spec.ts` assert More → `/settings/sync`.

## Notes for plan / execute

- Hub path locked to `/more`; More `isActive` must include `/more` **and** `/settings/*`; Import/History stay off-tab (no forced More active).
- Active tab: implement **at least two** of accent label+filled icon, persistent indicator, clearer weight — prefer Neo-Noir tokens (`text-primary` / accent tertiary / border accent), keep ≥44px hit targets.
- Off-tab: shared compact strip with ≥44px **← Home** → `/`; apply on `/review`, `/history`, `/history/[sessionId]` (around ceremony page chrome, not inside stage UI), `/import`, `/import/[jobId]`.
- Safe-area: pad sticky header (or inner bar) with `env(safe-area-inset-top)`; add `viewport-fit=cover` via Next.js viewport export if still missing.
- No API/DB; preserve D3 tabs, Review badge, Neo-Noir, no FAB, no History tab.
- Draft PR **#164** base must remain **`feature/mobile-ui`**.
