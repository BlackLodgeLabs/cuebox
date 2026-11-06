# Issue #145: Mobile UI — recommendation ceremony 1→2→3 + history replay

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/145

**Integration base:** `feature/mobile-ui` (not `main`). Slice (a) / #141 (app shell) and slices (b)–(d) (#142–#144) are merged there. This branch is cut from `feature/mobile-ui` so the ceremony renders inside the new `AppShell`. Draft PR **must** target `feature/mobile-ui` (retarget if the handoff Action defaults to `main`).

## Summary

Refactor fresh recommendation results and history detail into a **mandatory 3-stage ceremony** (brief **D5**): Stage 1 singular winner → Stage 2 swipeable runners-up → Stage 3 durable session record. History detail **lands on stage 3** with optional **Replay** (1 → 2 → back to 3). Success criteria **A** (no dead ends; history→3; replay path) and **D** (ceremony quality) are **fail-if-missing**.

This is **slice (e)** of the mobile UI pass ([product brief](../../../documents/ui-mobile-product-brief.md)). Frontend-only; reuse the existing recommendation session payload. No ranking/engine changes.

## Problem

After the questionnaire, Cuebox dumps into a **single** `ResultsView`: winner card + runners-up grid + answer-summary sheet + actions on one page. That collapses the ritual the brief requires — the winner never gets singular focus, runners-up are not a swipe focus experience, and history detail cannot distinguish “ceremony” from “session record.”

Today:

| Surface | Behavior |
|---------|----------|
| `/recommend/results/[sessionId]` | Flat results: winner + all runners-up + where-to-watch icons on cards + optional profile sheet |
| `/history/[sessionId]` | Same `ResultsView` (with delete / new-recommendation actions) — not stage-3-first |

Where-to-watch icons and full explanation fields (synopsis, caveats, beat-alternatives) appear on the flat cards today; the brief requires short reasons only on stages 1–2, and where-to-watch + questionnaire summary **only** on stage 3.

## Acceptance criteria

- [ ] Fresh recommendation results use stages **1 → 2 → 3** with **Continue/Next only** between stages — **no skip**, no direct jump to stage 3 on first completion
- [ ] **Stage 1 — Winner:** singular focus; poster-led winner + **short** reasons only (key factors + short “why it matches”); must feel special (demo review — criterion **D**)
- [ ] **Stage 2 — Runners-up:** swipeable poster row; focused runner-up uses a **winner-like** layout (poster + short reasons)
- [ ] **Stage 3 — Session record:** all five films together with **full** metadata, full reasons, **where-to-watch**, questionnaire/answer summary, and deep links to film detail (`/watchlist/{filmId}`)
- [ ] Where-to-watch and questionnaire summary appear on **stage 3 only**, not stages 1–2
- [ ] **History detail** (`/history/[sessionId]`) **lands on stage 3**
- [ ] Stage 3 includes **Replay ceremony**: plays stages **1 → 2**, then returns to **3** (not a full 1→2→3 loop unless replay is started again)
- [ ] Ceremony has **no dead ends** (always a clear Next / Done / Replay path) — criterion **A**
- [ ] Motion: intentional ceremony transitions; honor `prefers-reduced-motion` (instant or crossfade fallback) — brief **D8** / criterion **F**
- [ ] Navigation / deep-link rules locked below are implemented and covered by tests
- [ ] Neo-Noir preserved; no FAB; no new brand system (brief **D1**)
- [ ] Unit + Playwright (mocked) covering: fresh 1→2→3, history→3, replay 1→2→3, reduced-motion path
- [ ] Primary Continue/Next/Replay/Done hit targets ~**≥44×44px**; no essential hover-only controls (criterion **C**)

## Navigation / deep-link / URL rules (locked)

| Situation | Behavior |
|-----------|----------|
| Fresh results after questionnaire | Enter **stage 1** |
| Advance stages | **Next/Continue only** — no skip control |
| Browser **Back** from stage 2 | → **stage 1** |
| Browser **Back** from stage 3 | → **leave** the results/history-detail route (prior app route: questionnaire completion entry, history list, Home, etc.) — **do not** force re-walking 3→2→1 |
| Browser **Back** during replay (stage 2) | → stage 1 of replay (same as fresh) |
| **Refresh** on `/recommend/results/{sessionId}` | Restore **stage 3** (session id is known; durable record is the safe landing) |
| **Refresh** on `/history/{sessionId}` | Stay on **stage 3** |
| Direct open of history detail URL | **Stage 3** |
| Direct open / bookmark of fresh-results URL with `?stage=1` or `?stage=2` | Honor stage only when navigating within an in-progress ceremony / replay; on cold load / refresh prefer stage 3 (above). Planning may implement as: cold load always stage 3 unless an in-session flag/replay mode is active |
| Replay from stage 3 | Stage 1 → Next → stage 2 → Next → **stage 3** (end). Replay again only if user taps Replay again |

### URL strategy (locked for plan)

Use a shared query param `?stage=1|2|3` on both `/recommend/results/[sessionId]` and `/history/[sessionId]`:

1. **Fresh entry** (post-questionnaire navigate): go to results URL with `stage=1` via `push` (or replace questionnaire → results stage 1 so Back from stage 1 leaves the flow).
2. **1 → 2:** `push` with `stage=2` so Back returns to stage 1.
3. **2 → 3:** `replace` with `stage=3` so the ceremony stack collapses — Back from stage 3 leaves the route (does not re-enter stage 2).
4. **History cold open:** `stage=3` (default when param missing).
5. **Fresh-results cold open / refresh:** default **`stage=3`** when param missing or on full page load; ignore stale `stage=1|2` on cold load unless planning finds a reliable same-document session flag — document the chosen cold-load guard in the plan.
6. **Replay:** set replay mode; `push`/`replace` as above for 1→2→3, ending on stage 3 with replay mode cleared.

Stage chrome (progress “1 / 2 / 3”, Next, Replay, Done) is client-driven from this URL + mode; do not invent a second parallel stage store that can desync from the URL.

## Scope

### In scope

| Area | Change |
|------|--------|
| `frontend/src/components/results-view.tsx` (and/or new ceremony components) | Split into stage 1 / 2 / 3 compositions; short vs full reason surfaces; swipe runners-up; stage chrome |
| `/recommend/results/[sessionId]` | Fresh ceremony entry at stage 1; wire URL stage + transitions |
| `/history/[sessionId]` | Land stage 3; Replay control; keep delete / history actions appropriate to stage 3 |
| Client state | Stage + replay mode synchronized with `?stage=` URL strategy above |
| Watch providers | Fetch/display on **stage 3 only** (remove from stage 1–2 layouts) |
| Questionnaire summary | Surface on stage 3 using existing `profile_summary` (narrative + structured); may keep sheet or inline section |
| Motion | Ceremony transitions + `prefers-reduced-motion` fallbacks |
| Tests | Unit for stage machine / rendering; Playwright mocked for 1→2→3, history→3, replay, reduced-motion |
| Docs | Optional one-line ceremony note in `DESIGN.md` if a composition rule needs documenting |

### Out of scope

- Ranking / recommendation engine / scoring changes
- Questionnaire question content / density (slice f — #146)
- Insights / Ask
- Developer Mode visual redesign (`?dev=1` / `DevModePanel` may remain as today)
- App shell, Home hub, watchlist grid, film detail (slices a–d — already on `feature/mobile-ui`)
- PWA, FAB, History tab, new brand / token palette
- API, DB, Alembic, `config.yaml` (unless planning finds a true payload gap — prefer UI-only)

## User flows / API changes

### Flow A — Fresh recommendation

1. User finishes questionnaire → navigate to `/recommend/results/{sessionId}?stage=1`.
2. **Stage 1:** poster-led winner; key factors + short why-it-matches; **Next** (no skip; no where-to-watch; no full metadata dump).
3. **Stage 2:** horizontal swipeable poster row of runners-up; focused item shows winner-like short layout; **Next**.
4. **Stage 3:** full session record — winner + all runners-up, full reasons/metadata, where-to-watch, questionnaire/answer summary, links to `/watchlist/{filmId}`; **Done** / History / New recommendation as appropriate; optional **Replay ceremony**.

### Flow B — History detail

1. User opens `/history/{sessionId}` (from History list or Home link) → **stage 3** immediately.
2. Optional **Replay ceremony** → stage 1 → 2 → back to stage 3.
3. Delete-from-history and other stage-3 actions remain available on the record view.

### Flow C — Back / refresh

As locked in the navigation table above.

### Composition rules (locked)

| Stage | Poster | Reasons | Where-to-watch | Questionnaire summary | Film deep links |
|-------|--------|---------|----------------|----------------------|-----------------|
| 1 | Dominant singular winner | Short only (key factors + short why) | No | No | Optional light link OK; do not turn stage 1 into a detail page |
| 2 | Swipe row + focused winner-like | Short only | No | No | Same as stage 1 for focused item |
| 3 | All five visible in a durable record layout | Full (incl. caveats / beat-alternatives / synopsis as today allows) | Yes | Yes | Required — each film deep-links to detail |

**Short reasons:** reuse `explanation.most_influential_factors` + `explanation.why_it_matches`. Omit synopsis, caveats, why-it-beat-alternatives, ratings rows that clutter the ritual if they fight singular focus — planning may keep a minimal title/year/director line under the poster.

**Stage 3 actions:** preserve useful exits — e.g. New recommendation, View history, Remove from history (history route), Replay. No dead end after Next from stage 2.

**Desktop (`md`+):** same three-stage flow (do not skip on wide screens). Stage 2 may show a wider carousel; metaphor stays ceremonial, not a flat dashboard of all cards.

### API changes

**None expected.** Reuse:

- `GET /api/v1/recommendations/{sessionId}` (winner, runners_up, explanations, constraint_relaxation, `profile_summary`)
- Existing watch-provider hooks (`useFilmsWatchProviders`) — call for stage 3 display only
- Film detail routes already used by `CardWatchlistLink`

## Data and integration notes

- Session payload already includes winner + runners-up + per-film `explanation` fields and optional `profile_summary` (`narrative_profile` + `structured_profile` from the questionnaire-derived profile). That is enough for stage 3 questionnaire/answer summary without a new API.
- If execute discovers `profile_summary` missing on some history sessions, degrade gracefully (hide summary section) and note in plan/demo — do not block the ceremony on a backfill.
- Constraint-relaxation banner: show on **stage 3** (durable record). Optional subtle cue on stage 1 only if it does not steal focus; default = stage 3.
- Shared component extraction is encouraged so results and history routes do not fork two ceremony implementations — e.g. `<RecommendationCeremony mode="fresh" | "history" />`.
- `DevModePanel` may remain mounted on both routes when `?dev=1`; do not redesign it.

## Open questions

_(none — issue + brief D5/A/D + owner note that #141 lives on `feature/mobile-ui` are sufficient; nav/URL rules locked above)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/145
- Product brief: [documents/ui-mobile-product-brief.md](../../../documents/ui-mobile-product-brief.md) (D5, D8, D10-A/D/F; build order §6 slice 5)
- Design system: [documents/DESIGN.md](../../../documents/DESIGN.md)
- Depends on: #141 (merged to `feature/mobile-ui` via PR #149)
- Sibling slices: #142 Home (merged), #143 watchlist (merged), #144 film detail (merged), #146 questionnaire / first-run
- Parent mobile UI initiative: PR #134
- Current surfaces: `frontend/src/components/results-view.tsx`, `frontend/src/app/recommend/results/[sessionId]/page.tsx`, `frontend/src/app/history/[sessionId]/page.tsx`
