## Related Issue

Closes #140

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/140)

## Description

**What does this PR do?**

Puts library + TMDB search on the returning-user Home hub, removes the dual intent CTAs (**Add a film** / **Mark watched**), aliases `/search` to `/?focus=search`, adds a global header search affordance, and adds TMDB **Add & mark watched** (add → poll enrichment ready → open `WatchReviewDialog`).

Issue #136 shipped `LibrarySearchPicker` on a standalone `/search` page with two Home CTAs that only differed by `?intent=`. Those entry points were redundant because the picker already exposes status-aware actions per hit. This change collapses search into one Home surface with a unified **Find a film…** placeholder.

**Post-execute revision (PR feedback):**

1. Header **Search** sits after primary nav (Home…Settings) and before conditional **Review**.
2. Local `watched` hits expose **View** + **Return to watchlist** (`watched` → `active` via the existing status API, same as the Watched tab).

**Why is this the best approach?**

Keep the shared picker component, drop the intent prop and standalone search chrome, and route header / `/search` / `/watchlist/add` through the same Home focus alias. No API, schema, or film status-machine changes — enrichment polling mirrors the existing add-then-navigate path so mark-watched never races enrichment. The revision keeps Search out of the primary nav cluster and reuses the Watched-tab status transition for return-to-watchlist.

## Changes Proposed

* Updated `frontend/src/app/page.tsx` — embed `LibrarySearchPicker` above New recommendation / History; handle `?focus=search` (focus + scroll, then clear param); remove dual intent cards
* Updated `frontend/src/components/library-search-picker.tsx` — remove `intent` / `SearchPickerIntent`; unified **Find a film…**; optional `autoFocus`; TMDB **Add & mark watched** with enrichment poll before status transition; post-review stay + refetch; **Return to watchlist** on `watched` hits (`d8f80cb`)
* Simplified `frontend/src/app/search/page.tsx` to server `redirect("/?focus=search")`
* Slimmed `frontend/src/app/watchlist/add/page.tsx` to `redirect("/search")` (no intent)
* Added AppShell header magnifying-glass link (**Search films** → `/search`) in `frontend/src/components/app-shell.tsx`; ordered after Settings and before Review (`d8f80cb`)
* Pointed watchlist **Add film** to `/search` in `watchlist-page-content.tsx`
* Updated unit tests (`library-search-picker.test.tsx`, `app-shell.test.tsx`) and Playwright E2E (`library-search-picker.spec.ts`, `watchlist-add.spec.ts`)
* Noted Home hosting + `/search` alias in `documents/api-contracts.md`
* Fix: clear pending add id before toast to avoid Maximum update depth on Home enrichment completion (`6f544ea`)
* Updated SPEC/PLAN with short revision notes for the two post-execute feedback items

**Explicitly unchanged:** API routes, Alembic, film status machine, empty-watchlist Import hub (no picker), mobile bottom-tab shell.

## Scenario Results

Application-tier demo on Docker Compose (seeded watchlist, 12 ready films). All exercised scenarios passed.

| # | Scenario | Result | Artifact |
|---|----------|--------|----------|
| 1 | Home inline picker | **PASS** | screenshot below |
| 2 | `/search` alias focuses Home | **PASS** | screenshot below |
| 3 | Header search icon | **PASS** | screenshot below |
| 4 | TMDB actions (Add + Add & mark watched) | **PASS** | screenshot below |
| 5 | Empty-watchlist focus no-op | **SKIPPED** | preserve Part 2 seed; covered by unit/E2E |

![Scenario 1 — Home inline picker](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/1ef896ffb617be350d52fb649f265cfd03e01bc5/workflow/issues/issue-140/demo/scenario-1-home-inline-picker.png)

![Scenario 2 — /search alias focuses Home](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/1ef896ffb617be350d52fb649f265cfd03e01bc5/workflow/issues/issue-140/demo/scenario-2-search-alias-focus.png)

![Scenario 3 — Header search icon](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/1ef896ffb617be350d52fb649f265cfd03e01bc5/workflow/issues/issue-140/demo/scenario-3-header-search.png)

![Scenario 4 — TMDB actions](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/1ef896ffb617be350d52fb649f265cfd03e01bc5/workflow/issues/issue-140/demo/scenario-4-tmdb-actions.png)

### Lite demo — SPEC/PLAN revision (`d8f80cb`)

Post-execute feedback only (2026-07-26). Both revision items **PASS**.

| Change | Result | Artifact |
|--------|--------|----------|
| A — Header Search after Settings, before Review | **PASS** | screenshot below |
| B — Watched hit **View** + **Return to watchlist** | **PASS** | screenshot below |

![Revision A — Header Search order](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/fcfd8900d5d907dc5c450049d305e22017638f09/workflow/issues/issue-140/demo/revision-a-header-search-order.png)

![Revision B — Return to watchlist](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/fcfd8900d5d907dc5c450049d305e22017638f09/workflow/issues/issue-140/demo/revision-b-return-to-watchlist.png)

- Nav order after brand: Home → Watchlist → Recommend → History → Settings → **Search** → **Review**.
- Query `Ready Film 1` (`watched`) → **Watched** badge, **View**, and **Return to watchlist**.

## How to Test

1. Checkout this branch:
   ```bash
   git checkout cursor/issue-140-home-inline-search-8d81
   ```
2. Start the stack (seeded watchlist expected for returning-user Home):
   ```bash
   docker compose up
   ```
3. Open `http://localhost:3000` — confirm inline **Find a film…** above New recommendation / History; no dual intent CTAs.
4. Search a library title (e.g. `Matrix`) — library hit shows **View** / **Mark watched**; TMDB hits may also appear.
5. Navigate to `/search` — should land on Home with the search field focused; URL clears `focus` after focus.
6. Confirm header order: Home → Watchlist → Recommend → History → Settings → **Search** → **Review** (when Review is shown). Header **Search films** lands on Home picker via `/search`.
7. Search a watched library film — confirm **View** and **Return to watchlist** (status → `active`).
8. Search a TMDB-only title (requires `TMDB_API_KEY`) — confirm **Add to watchlist** and **Add & mark watched**; mark-watched opens review dialog after enrichment is ready.
9. Optional empty-hub check: empty watchlist + `/?focus=search` shows Import CTA only (focus no-op).
10. Run Phase 6 gates:
    ```bash
    bash scripts/verify-phase6-gates.sh
    ```

## Known Issues / Notes for Reviewer

* Scenario 5 (empty-watchlist focus no-op) was skipped in the live demo to preserve the Part 2 seeded volume; behavior is covered by execute unit/E2E.
* Optional `scenario-4-add-mark-watched.mp4` was not captured; live demo showed both TMDB buttons for an out-of-library query; mocked Playwright covers the enrichment → dialog path.
* Follow-up fix `6f544ea` clears `pendingFilmId` before toast/navigate to prevent a React update-depth loop when enrichment completes on Home.
* Post-execute revision `d8f80cb` + lite demo `fcfd890` cover header Search order and **Return to watchlist**; SPEC/PLAN include short revision notes.
* No migrations. Restart frontend after pull if needed (`docker compose up --build frontend`).

## Gate evidence

- [x] `Phase 6: scripts/verify-phase6-gates.sh exit 0 at 6f544ea` (execute)
- [x] Demo scenarios 1–4 PASS at `1ef896f` / demo commit `8f5ae0a` (see `workflow/issues/issue-140/demo/demo-notes.md`)
- [x] Lite demo revision A–B PASS at `fcfd890` (base fix `d8f80cb`)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Demo screenshots reviewed
