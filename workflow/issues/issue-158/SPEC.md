# Issue #158: Mobile UI follow-up — shell & wayfinding (More hub, safe area, active tab)

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/158

**Integration base:** `feature/mobile-ui` (not `main`). Draft PR must target `feature/mobile-ui`.

## Summary

Close app-shell wayfinding gaps found in phone review on `feature/mobile-ui`: replace the More→Sync shortcut with a **More hub**, add **top safe-area** to the sticky header, strengthen **active tab** contrast, and give off-tab **Review / History / Import** light location chrome. Preserve the locked D3 tab set (Home · Watchlist · Recommend · More), Review as header badge, Neo-Noir, and no FAB.

## Problem

App shell IA on `feature/mobile-ui` matches brief **D3** structurally (tabs + Review badge + search), but phone review ([`documents/ui-mobile-evaluation.md`](../../../documents/ui-mobile-evaluation.md) on the evaluation branch; findings mirrored in #158) found wayfinding gaps:

| Gap | Evidence |
|-----|----------|
| **More ≠ More** | More tab `href` is `/settings/sync` ([`app-shell.tsx`](../../../frontend/src/components/app-shell.tsx)) — label says More, destination is Sync only |
| **No top safe-area** | Sticky header has no `env(safe-area-inset-top)`; bottom tabs already pad `safe-area-inset-bottom` |
| **Subtle active tab** | Active `#e3e3de` vs inactive `#c3c8bd` (near-muted); filled icon helps but location is easy to miss |
| **Weak off-tab chrome** | Review / History / Import rely on page title only; no secondary location / back pattern (unlike film detail’s `← Watchlist`) |

Sibling follow-ups (#159 ceremony, #161 thumb ergonomics) do not own shell IA; #160 owns surface clarity (posters, Home copy, History filters) — stay out of those.

## Acceptance criteria

- [ ] **More hub:** More tab opens a **More hub** screen (not Sync directly). Hub lists at least **Sync**, **Import**, and **History** as destinations.
- [ ] **Sync destination unchanged:** Sync link opens the existing sync settings page (`/settings/sync`) with current CSV / watched history / RSS capabilities — no new settings features.
- [ ] **More active state:** More tab `aria-current="page"` (and visual active affordance) applies on the hub **and** on nested settings routes under `/settings/*`. Import and History remain off-tab (no forced More active) so they get off-tab chrome instead.
- [ ] **Top safe-area:** Sticky app header content clears the status / notch area via `env(safe-area-inset-top)` (or equivalent). Bottom safe-area behavior on the tab bar remains.
- [ ] **Stronger active tab:** Active bottom tab is clearly distinguishable from inactive tabs — stronger than the current near-muted `text-foreground` vs `text-muted-foreground` pair alone (see [Active tab affordance](#active-tab-affordance)).
- [ ] **Off-tab location chrome:** Review (`/review`), History (`/history`, including detail), and Import (`/import`, including job status) show light wayfinding chrome so users know they left the primary tab stack and can return predictably (see [Off-tab chrome](#off-tab-chrome)).
- [ ] **Design constraints:** Neo-Noir tokens preserved; no new brand; no extra primary tabs; Review stays a header badge (not a tab); no FAB; no History tab.
- [ ] **Tests:** Cover More hub destinations + More active on hub/settings; Sync still reachable with existing capabilities; header top safe-area class/style regression; stronger active-tab affordance regression; off-tab chrome on Review / History / Import.

## Scope

### In scope

- New More hub route/page wired to the More tab (replace direct `/settings/sync` href).
- Hub links: Sync → `/settings/sync`, Import → `/import`, History → `/history`.
- Sticky header top safe-area inset.
- Stronger active bottom-tab visual affordance (and matching unit assertions).
- Light wayfinding chrome on Review / History / Import (list + nested job/detail routes as needed for consistency).
- Unit / component tests (extend [`app-shell.test.tsx`](../../../frontend/src/components/app-shell.test.tsx) and page tests); optional mocked Playwright if plan needs phone viewport proof for safe-area / hub.

### Out of scope

- New settings features beyond routing / hub (no About, Dev Mode entry, Theme, etc. required for this issue — hub may be structured so future items can append later).
- Ceremony / questionnaire / picker ergonomics (#159 / #161).
- Surface clarity: posters, status labels, Home copy, System status relocation, History filter disclosure (#160).
- Developer Mode UI / mobile Dev Mode affordance.
- Moving Review into the tab bar; adding History as a fifth tab; introducing a FAB.
- Backend / API / DB / sync protocol changes.

## User flows / API changes

### More hub

1. User taps **More** in the bottom tab bar.
2. Lands on More hub (default route for the tab — see [Route](#more-hub-route)).
3. Hub presents three primary destinations (order locked):
   1. **Sync** — existing sync settings (CSV / watched history / RSS)
   2. **Import** — existing import flow
   3. **History** — existing recommendation history list
4. Tapping Sync opens `/settings/sync` with unchanged capabilities.
5. While on hub or `/settings/*`, More remains the active tab (`aria-current="page"`).
6. Tapping Import or History leaves the More stack; those screens show off-tab chrome; More is **not** forced active.

### Header safe-area

1. On a notched / Dynamic Island device (or with non-zero `safe-area-inset-top`), Cuebox brand + Search / Review header controls clear the system status area.
2. Header remains sticky; bottom tab safe-area padding unchanged.

### Active tab

1. On Home / Watchlist / Recommend / More (when active), the current tab is obvious at a glance vs inactive peers.
2. Off-tab routes (Review, History, Import, Search, film detail, etc.) do not force a false-active primary tab (existing behavior for `/history` preserved).

### Off-tab return

1. From Review / History / Import, user sees light location chrome (back-to-Home or equivalent).
2. Return path is predictable: primary chrome control navigates to **Home** (`/`) unless a tighter parent makes more sense (e.g. Import job status may also keep an Import-parent affordance — plan may combine Home return with optional parent breadcrumb, but Home must remain available).

### API changes

None — frontend routing / shell only.

## Locked design decisions

### More hub route

| Decision | Value |
|----------|-------|
| Hub path | `/more` |
| More tab `href` | `/more` (not `/settings/sync`) |
| More `isActive` | `pathname === "/more" \|\| pathname.startsWith("/more/") \|\| pathname.startsWith("/settings")` |
| Sync path | Keep `/settings/sync` (no relocate of sync page contents) |
| Hub UI | Single-purpose list/stack of destinations (Sync, Import, History) — Neo-Noir, not a card dashboard; one section, clear labels; optional one-line supporting copy per row |

Do **not** invent extra primary tabs. Hub may use simple link rows (watchlist/settings list patterns already in the design system) rather than new marketing cards.

### Active tab affordance

Active tab must be stronger than label color alone. Implement **at least two** of:

1. Accent / primary-tinted label + filled icon (not near-muted foreground only)
2. Persistent indicator (top hairline / underline / bottom accent bar on the active tab control)
3. Clearer weight contrast (e.g. active label uses stronger mono weight or accent token vs inactive `text-muted-foreground`)

Inactive tabs stay muted. Preserve ≥44px hit targets. Prefer existing design tokens from [`documents/DESIGN.md`](../../../documents/DESIGN.md) — no new brand palette.

### Off-tab chrome

Apply a shared light pattern on:

- `/review`
- `/history` and `/history/[sessionId]` (ceremony chrome already owns stage UI; list/detail page headers still need the location strip where the page title lives)
- `/import` and `/import/[jobId]`

**Locked pattern:** compact page-header strip with:

1. A ≥44px **← Home** (or “Back to Home”) control linking to `/`
2. Clear page title (existing titles OK)
3. Optional one-line subtitle only if it clarifies section without clutter (not required if title is unambiguous)

Film detail’s existing `← Watchlist` pattern is the precedent — mirror that lightness; do not add a second nav bar or breadcrumb trail of many segments.

Search (`/search`) is optional for this issue (not named in acceptance criteria); if touched only because of a shared chrome helper, keep changes minimal.

### Header top safe-area

- Apply `env(safe-area-inset-top)` padding on the sticky `<header>` (or its inner bar) so brand/actions clear the inset.
- Ensure `viewport-fit=cover` (or equivalent) remains set if required for env() insets to apply on iOS — verify against current root layout / metadata; add only if missing.
- Do not break sticky positioning or header height hit targets.

## Data and integration notes

- **No** DB, API, sync, or enrichment changes.
- Frontend-only: [`app-shell.tsx`](../../../frontend/src/components/app-shell.tsx), new `/more` page, Review / History / Import page headers (shared helper preferred), `globals.css` / layout meta if needed for safe-area, tests.
- Update shell unit tests that currently assert More → `/settings/sync` and active-path matrix.
- **PR base:** `feature/mobile-ui`. Workflow handoff’s default `--base main` must not be used for this issue’s draft PR; create/retarget to `feature/mobile-ui` (same as #159 / #161).

## Open questions

_(none — product decisions locked above for planning)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/158
- Evaluation source: `documents/ui-mobile-evaluation.md` (evaluation branch / issue body)
- Related follow-ups: #159 (ceremony), #161 (thumb ergonomics), #160 (surface clarity)
- Shell today: [`frontend/src/components/app-shell.tsx`](../../../frontend/src/components/app-shell.tsx)
- Design system: [`documents/DESIGN.md`](../../../documents/DESIGN.md)
