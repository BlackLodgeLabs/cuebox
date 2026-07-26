# Issue #142: Mobile UI — Home hub composition

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/142

**Integration base:** `feature/mobile-ui` (not `main`). Slice (a) / #141 already merged there; this branch is cut from that tip so Home composes inside the new `AppShell`. Draft PR **must** target `feature/mobile-ui`.

## Summary

Restyle and recompose the Home landing (`frontend/src/app/page.tsx`) into a phone-first **hub** that matches the mobile UI brief (**D1**, **D4**, **D7**, **D10-A**): inline film picker near the top, a primary **Create a recommendation** CTA (≤ 2 taps from Home), and a **History** quick link — not a dashboard of peer cards. Picker behavior from #140 stays unchanged; only composition, hierarchy, copy, and Neo-Noir polish move.

This is **slice (b)** of the mobile UI pass ([product brief](../../../documents/ui-mobile-product-brief.md)). Shell chrome is owned by #141 (done on `feature/mobile-ui`); do not rework tabs or the Review badge here.

## Problem

Home is the default landing and nightly hub, but the current returning-user layout still reads like a **dashboard of cards**:

- Peer cards for **Your watchlist**, **New recommendation**, and **History** (plus a conditional **Films need review** card)
- Recommend CTA copy is “New recommendation” / “Start questionnaire” rather than brief **Create a recommendation**
- Card-grid density competes with the inline picker and dilutes D4 job hierarchy
- Watchlist and Review are already primary destinations via **bottom tab** and **header badge** (#141); repeating them as Home cards fights the hub metaphor

Empty-watchlist Import CTA must remain obvious; detailed first-run polish is slice (f) / #146.

## Acceptance criteria

- [ ] Home is a **single hub composition** (not a multi-card dashboard): **inline film picker** near the top; primary **Create a recommendation** CTA; **History** quick link (History is **not** a tab — D3/D4)
- [ ] From Home, start a recommendation in **≤ 2 taps** (success criterion **A**): e.g. Home → tap **Create a recommendation** → `/recommend` (1 tap to enter the flow)
- [ ] Find/add/mark a film via the inline `LibrarySearchPicker` **without** separate Add vs Mark watched intent CTAs (already removed by #140; **do not reintroduce**)
- [ ] Picker copy reads as **find a film in your library or add one**, not open-ended discovery (placeholder / helper text; no “discover” / catalogue tone)
- [ ] Empty-watchlist first-run path remains obvious (**Import watchlist** primary CTA); do not regress empty state (slice f owns deeper polish)
- [ ] Review remains reachable via **shell badge** (#141); Home does **not** add a Review tab and does **not** keep a competing Review card as a first-viewport peer to Recommend/History
- [ ] Neo-Noir polish for the hub: density, hierarchy, **16px mobile margins**; no new brand tokens unless composition requires a documented delta in `DESIGN.md`
- [ ] Collapsed **System status** (if kept) does **not** dominate the first viewport (below the fold / visually secondary)
- [ ] **Tests:** Home hub layout smoke / unit coverage for primary CTAs (`Create a recommendation` → `/recommend`, History → `/history`) and picker presence (`data-testid="library-search-input"`) on returning-user Home; empty-state Import CTA still covered

## Scope

### In scope

| Area | Change |
|------|--------|
| `frontend/src/app/page.tsx` (and small Home-only helpers if extracted) | Recompose returning-user + empty layouts for hub hierarchy |
| Visual treatment of inline `LibrarySearchPicker` on Home | Spacing, emphasis, copy only — **behavior unchanged** from #140 |
| Recommend + History hierarchy | Primary CTA + secondary quick link (not equal peer cards) |
| Redundant Home cards | Remove or demote **View watchlist** and **Review now** cards so they do not compete with D4 jobs (Watchlist tab + Review badge already exist) |
| System status | Keep collapsed optionally; ensure it stays secondary |
| Tests | Unit and/or lightweight Playwright smoke for hub CTAs + picker presence |
| Docs | Optional one-line Home hub note in `DESIGN.md` only if composition introduces a documented layout rule |

### Out of scope

- Shell / bottom tabs / header Review badge / search icon (slice a — #141; already on `feature/mobile-ui`)
- Watchlist grid, film detail, ceremony, questionnaire density / first-run art direction (slices c–f — #143–#146)
- Changing picker merge/action APIs or `LibrarySearchPicker` result actions
- PWA / Insights / Ask
- API, DB, Alembic, `config.yaml`
- Rebrand or new token palette (D1)

## User flows / API changes

### Returning user (has watchlist)

1. Open app → Home (`/`) inside #141 `AppShell` (bottom tabs + header).
2. First viewport: short hub headline/support copy → **inline picker** → primary **Create a recommendation** → **History** quick link.
3. Type in picker → library + TMDB results with status-aware actions (unchanged #140 behavior).
4. Tap **Create a recommendation** → `/recommend` (questionnaire entry).
5. Tap **History** → `/history`.
6. Header search icon still focuses the same Home picker via `/search` (#140); not reimplemented here.
7. Review (if pending) via header badge only — no Home Review card competing in the hub stack.

### Empty watchlist

1. Home shows welcome + primary **Import watchlist** → `/import`.
2. No requirement to show the returning-user hub stack.
3. Collapsed System status may remain secondary; Import must remain the obvious first action.

### Composition rules (locked)

| Element | Role |
|---------|------|
| Inline `LibrarySearchPicker` | Job 1 — near top of returning-user hub |
| **Create a recommendation** | Job 2 — primary CTA (≥44px hit target), links `/recommend` |
| **History** | Job 3 — quick link (secondary visual weight), links `/history`; not a bottom tab |
| Watchlist | Via **Watchlist** tab only — no peer “View watchlist” card on Home |
| Review | Via **header badge** only — no peer Review card on Home |
| System status | Optional collapsed footer; must not own first viewport |

### Copy (locked direction)

- Primary CTA label: **Create a recommendation** (replace “New recommendation” / “Start questionnaire” on Home).
- Picker: reinforce library-or-add tone (e.g. placeholder/helper along “Find a film in your library or add one…”); keep existing `data-testid="library-search-input"`.
- Avoid discovery / browse-the-catalogue language.

### Layout / density

- Mobile content margins **16px** (brief §3 / design system).
- Single vertical composition; prefer no card grid of peer jobs.
- Chamfered primary button language from Neo-Noir for the Recommend CTA; History as text/link or lighter secondary control — not a twin primary card.
- Honor `prefers-reduced-motion` for any new motion (D8); no essential hover-only actions.

### API changes

**None.** Presentation / IA only on existing Home + picker.

## Data and integration notes

- **DB / migrations:** none
- **API:** none (reuse `useHasWatchlist`, `useWatchlistCount` only if still needed for empty vs returning; pending review count no longer required on Home if Review card is removed)
- **Routes:** `/`, `/recommend`, `/history`, `/import`, `/search` (alias unchanged)
- **#140 regression:** inline picker + `/search?focus=search` focus behavior must remain
- **#141 dependency:** compose inside bottom-tab shell; do not reintroduce History as a tab or a Review tab
- **Design system:** Cabin / Libre Franklin / Space Mono; tokens from `tokens.css`; Material Symbols via existing `Icon` if used
- **Git:** branch from `feature/mobile-ui`; PR base `feature/mobile-ui` (workflow Action defaults to `main` — retarget if needed)

## Open questions

_(none — issue body + brief D1/D4/D7/D10-A + note that #141 landed on `feature/mobile-ui` are sufficient to plan)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/142
- Product brief: [documents/ui-mobile-product-brief.md](../../../documents/ui-mobile-product-brief.md) (D1, D4 hub jobs, D7 nightly-first, D10-A)
- Design system: [documents/DESIGN.md](../../../documents/DESIGN.md)
- Prerequisite #140 (merged): Home inline picker + `/search` alias
- Prerequisite #141 (merged to `feature/mobile-ui` via PR #149): app shell
- Sibling slices: #143 (watchlist grid), #144 (film detail), #145 (ceremony), #146 (questionnaire / first-run)
- Current Home: `frontend/src/app/page.tsx`
- Picker: `frontend/src/components/library-search-picker.tsx`
