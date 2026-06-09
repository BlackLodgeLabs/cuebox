---
name: Phase 6 — Frontend (MVP UX)
overview: "Build the complete user-facing Next.js application for import, match review, questionnaire, results, history, and sync settings — with verification gates, incremental roadmap checkbox updates, and AGENTS.md structural review."
depends_on: Phases 4 and 5 (complete)
todos:
  # ── Baseline & infrastructure ─────────────────────────────────────────────
  - id: p6-baseline-gates
    content: "Confirm Phases 2.5–5 gate scripts and API CI still pass before frontend work begins"
    status: pending
  - id: p6-shadcn-setup
    content: "Install shadcn/ui primitives (button, card, input, progress, toast, dialog, sheet, badge, skeleton, select, checkbox, radio-group, textarea, separator)"
    status: pending
  - id: p6-api-types
    content: "Extend frontend/src/types/api.ts with import, film, review, sync, recommendation, and history types per api-contracts"
    status: pending
  - id: p6-api-client
    content: "Extend api-client.ts — multipart upload helper, all v1 endpoints, user-friendly error message map for every ErrorCode"
    status: pending
  - id: p6-react-query-hooks
    content: "React Query hooks — use-import, use-films, use-reviews, use-recommendations, use-sync; polling for import status (2–5s refetchInterval)"
    status: pending
  - id: p6-layout-nav
    content: "App shell — shared layout, top/side navigation, loading skeletons, error boundaries, toast provider"
    status: pending
  # ── Pages & flows ─────────────────────────────────────────────────────────
  - id: p6-home-empty-state
    content: "Home / routing hub — detect empty watchlist (GET /films or import history); prompt CSV upload vs returning-user CTAs"
    status: pending
  - id: p6-import-flow
    content: "Import flow — file upload, POST /import, redirect to /import/[jobId], poll status, progress bar, failure summary, link to review"
    status: pending
  - id: p6-match-review
    content: "Match review page — GET /films/review-required, candidate display, accept/reject via review endpoints"
    status: pending
  - id: p6-questionnaire-vocab
    content: "Controlled vocabulary module — genres (hierarchy), emotional outcomes, visual/tonal vibes per PRD §11 + api-contracts Appendix C"
    status: pending
  - id: p6-questionnaire-wizard
    content: "Questionnaire wizard — 10 steps one-at-a-time, No Preference validation, notes max 1000 chars, POST /recommendations"
    status: pending
  - id: p6-results-screen
    content: "Results screen — winner + 4 runners-up, structured explanations, constraint relaxation banner, answer summary drawer"
    status: pending
  - id: p6-history
    content: "History list + detail — GET /recommendations with search/date/watch_status filters; card grid; session detail view"
    status: pending
  - id: p6-sync-settings
    content: "Sync settings — POST /sync/csv re-upload, PUT /sync/rss username, GET /sync/rss/status display"
    status: pending
  # ── Verification & docs ───────────────────────────────────────────────────
  - id: p6-frontend-lint
    content: "Frontend quality gate — npx tsc --noEmit (and npm run lint if ESLint initialized during Phase 6)"
    status: pending
  - id: p6-gate-script
    content: "Add scripts/verify-phase6-gates.sh — tsc, optional Playwright E2E against docker compose stack, manual journey checklist"
    status: pending
  - id: p6-verify-gates
    content: "Run verify-phase6-gates.sh plus Phases 2.5–5 regression gate scripts; confirm API CI green"
    status: pending
  - id: p6-update-roadmap
    content: "Check off Phase 6 task checklist and verification gate in documents/roadmap.md; update overview to Phase 6 complete / Phase 7 next"
    status: pending
  - id: p6-document-index
    content: "Add phase-6-plan.md to roadmap Document Index Phase plans row"
    status: pending
  - id: agents-md-review
    content: "Review AGENTS.md for structural changes (compose, env vars, lint/test, bootstrap, hello-world, project overview)"
    status: pending
isProject: false
---

# Phase 6 — Frontend (MVP UX)

## Context

**Phases 4 and 5 are complete.** The FastAPI backend exposes import/enrichment, match review, sync (CSV + RSS), and the full recommendation pipeline with history. The frontend today is a **minimal health dashboard** only (`frontend/src/app/page.tsx` polls `GET /health`).

**Phase 6 goal:** Deliver all user journeys from [PRD.md §4](./PRD.md) and [sequence-diagrams.md §11](./sequence-diagrams.md) through the browser — without Developer Mode (Phase 7).

**Authoritative references:**

| Document | Purpose |
|----------|---------|
| [`documents/roadmap.md`](./roadmap.md) | Phase 6 task checklist + verification gate |
| [`documents/phase-4-5-plan.md`](./phase-4-5-plan.md) | Gate script pattern, roadmap update procedure, AGENTS.md review template |
| [`documents/PRD.md`](./PRD.md) | §4 journeys, §11 questionnaire, §16–17 results & history UX |
| [`documents/api-contracts.md`](./api-contracts.md) | §3 Import, §4–5 Films/Reviews, §6 Sync, §7–8 Recommendations |
| [`documents/sequence-diagrams.md`](./sequence-diagrams.md) | §1–§2 import/poll, §4 review, §5–§6 sync, §8–§9 recommend/history, §11 first-time user |
| [`scripts/verify-phase4-gates.sh`](../scripts/verify-phase4-gates.sh) | Baseline regression (must stay green) |
| [`scripts/verify-phase5-gates.sh`](../scripts/verify-phase5-gates.sh) | Baseline regression (must stay green) |

### Current scaffold state

| Path | State |
|------|-------|
| `frontend/src/app/page.tsx` | Health check only — no routing hub |
| `frontend/src/lib/api-client.ts` | `fetchApi`, `ApiClientError`, `getHealth` only |
| `frontend/src/types/api.ts` | `ErrorCode`, `HealthResponse` only |
| `frontend/src/components/` | `providers.tsx` (React Query) only — **no shadcn/ui components installed** |
| `frontend/components.json` | shadcn configured (`new-york` style) but `src/components/ui/` empty |
| `frontend/package.json` | Next 15, React 19, TanStack Query, Tailwind — no toast/form libs beyond CVA |
| App routes | Only `/` — no `/import`, `/review`, `/recommend`, `/history`, `/settings/sync` |
| `scripts/verify-phase6-gates.sh` | **Does not exist yet** |
| `.github/workflows/api-ci.yml` | API-only CI — no frontend workflow yet |

### Dependency graph

```mermaid
flowchart TD
    BASE[0. Baseline gates 2.5–5] --> INFRA[1. Shared infrastructure]
    INFRA --> HOME[2. Home / empty state]
    INFRA --> IMPORT[3. Import flow]
    IMPORT --> REVIEW[4. Match review]
    REVIEW --> Q[5. Questionnaire + vocab]
    Q --> RESULTS[6. Results screen]
    RESULTS --> HIST[7. History]
    INFRA --> SYNC[8. Sync settings]
    HOME --> GATES[9. Verification gates]
    HIST --> GATES
    SYNC --> GATES
    GATES --> ROAD[10. Roadmap update]
    ROAD --> AGENTS[11. AGENTS.md review]
```

### Baseline inventory (branch start)

Before any UI work, confirm backend regression is green:

```bash
bash scripts/verify-phase2.5-gates.sh
bash scripts/verify-phase3-gates.sh
bash scripts/verify-phase4-gates.sh
bash scripts/verify-phase5-gates.sh
cd frontend && npx tsc --noEmit
```

Mark todo `p6-baseline-gates` complete only when all five commands succeed.

---

## Implementation Slices

### Slice 1 — Shared infrastructure (`p6-shadcn-setup` … `p6-layout-nav`)

**shadcn/ui setup**

```bash
cd frontend
npx shadcn@latest add button card input progress toast dialog sheet badge skeleton select checkbox radio-group textarea separator label tabs
```

Add `Toaster` to root layout; configure React Query defaults (`staleTime`, `retry` for idempotent GETs).

**API client extensions** (`frontend/src/lib/api-client.ts`)

| Function | Endpoint | Notes |
|----------|----------|-------|
| `postImport(file)` | `POST /import` | `multipart/form-data`; omit JSON Content-Type |
| `getImportStatus(jobId)` | `GET /import/{job_id}/status` | Poll target |
| `getFilms(params?)` | `GET /films` | Watchlist presence / counts |
| `getReviewRequired(params?)` | `GET /films/review-required` | Paginated |
| `acceptReview(reviewId)` | `POST /reviews/{id}/accept` | |
| `rejectReview(reviewId)` | `POST /reviews/{id}/reject` | |
| `postRecommendation(body)` | `POST /recommendations` | Sync; show loading overlay (≤30s) |
| `getRecommendation(sessionId)` | `GET /recommendations/{id}` | |
| `listRecommendations(params?)` | `GET /recommendations` | History filters |
| `postSyncCsv(file)` | `POST /sync/csv` | Multipart |
| `putSyncRss(username)` | `PUT /sync/rss` | |
| `getSyncRssStatus()` | `GET /sync/rss/status` | |

**Error envelope UX** — map every `ErrorCode` from api-contracts §2 to a user-facing string in `frontend/src/lib/error-messages.ts`:

| Code | User message (example) |
|------|------------------------|
| `VALIDATION_ERROR` | Show field-level details from `error.details` |
| `INVALID_CSV_FORMAT` | Explain required Letterboxd columns |
| `WATCHLIST_SIZE_EXCEEDED` | 500-film limit |
| `NO_PREFERENCE_CONFLICT` | Cannot mix "No Preference" with other selections |
| `INSUFFICIENT_CANDIDATES` | No ready films match; suggest relaxing preferences or importing more |
| `ENRICHMENT_NOT_READY` | Films still enriching; link to import status |
| `NOT_FOUND` | Generic not-found |
| `PROVIDER_ERROR` / `INTERNAL_ERROR` | Retry suggestion |

Toast on mutation failure; inline errors on forms.

**React Query hooks** (per roadmap suggested structure):

| Hook file | Responsibility |
|-----------|----------------|
| `frontend/src/hooks/use-import.ts` | `useImportUpload`, `useImportStatus(jobId)` with `refetchInterval: (q) => q.state.data?.status === 'running' ? 3000 : false` |
| `frontend/src/hooks/use-films.ts` | `useFilms`, `useReviewRequired` |
| `frontend/src/hooks/use-reviews.ts` | `useAcceptReview`, `useRejectReview` mutations |
| `frontend/src/hooks/use-recommendations.ts` | `useCreateRecommendation`, `useRecommendation`, `useRecommendationHistory` |
| `frontend/src/hooks/use-sync.ts` | `useSyncCsv`, `useSyncRssConfig`, `useSyncRssStatus` |

**Layout & navigation**

- `frontend/src/components/app-shell.tsx` — header with nav links: Home, Recommend, History, Settings
- Responsive container; active route highlight
- Shared `LoadingState`, `ErrorState` components
- Gate: `npx tsc --noEmit` passes

**Roadmap checkboxes (incremental):** Shared Infrastructure section (4 items).

---

### Slice 2 — Home / empty state (`p6-home-empty-state`)

**Route:** `frontend/src/app/page.tsx` (replace health-only page)

**Logic:**

1. On load, `GET /films?status=active&limit=1` (or count endpoint pattern) to detect watchlist presence.
2. **Empty state:** CTA to `/import` with brief explanation (first-time user journey step 1).
3. **Returning user:** CTAs for "New Recommendation" (`/recommend`) and "View History" (`/history`).
4. Optionally retain a collapsed system health indicator (API/DB status) for debugging — not the primary UX.
5. Surface pending review count badge if `GET /films/review-required` total > 0 → link `/review`.

**Roadmap checkbox:** Home / empty state.

---

### Slice 3 — Import flow (`p6-import-flow`)

| Route | File |
|-------|------|
| `/import` | `frontend/src/app/import/page.tsx` |
| `/import/[jobId]` | `frontend/src/app/import/[jobId]/page.tsx` |

**Upload page:**

- Drag-and-drop + file picker; accept `.csv` only
- Validate client-side: non-empty file, `.csv` extension
- `POST /import` → on `202`, `router.push(/import/${job_id})`
- Handle `INVALID_CSV_FORMAT`, `WATCHLIST_SIZE_EXCEEDED` inline

**Status page:**

- Poll `GET /import/{job_id}/status` every 2–5 seconds while `status === 'running'`
- Progress bar: `processed_films / total_films` (handle `total_films === null` during parse)
- Show `failed_films`, expandable `failure_summary`
- On `complete`: CTA to `/review` if review-required films exist, else `/recommend`
- On `failed`: error summary + retry link to `/import`

**Roadmap checkboxes:** Import flow (all sub-bullets).

---

### Slice 4 — Match review (`p6-match-review`)

**Route:** `frontend/src/app/review/page.tsx`

- Fetch `GET /films/review-required` with pagination
- Card per film: Letterboxd title/year, candidate poster (`candidate_payload.poster_url`), director, confidence score (formatted %)
- Accept → `POST /reviews/{review_id}/accept` → invalidate review query
- Reject → `POST /reviews/{review_id}/reject` → remove from list
- Empty state: "All matches resolved" with link to `/recommend`
- Loading skeletons per card

**Roadmap checkbox:** Match review (all sub-bullets).

---

### Slice 5 — Questionnaire (`p6-questionnaire-vocab`, `p6-questionnaire-wizard`)

**Vocabulary module:** `frontend/src/lib/questionnaire-vocabulary.ts`

Curate controlled lists aligned with [PRD §11](./PRD.md) and [api-contracts Appendix C](./api-contracts.md):

- **Genres:** hierarchical structure (Genre → Subgenre → Microgenre) as nested data; flat selection sends labels in `genres[]` per API contract
- **Emotional outcomes:** Inspired, Comforted, Terrified, Mind-blown, Emotionally wrecked, Amused, Disturbed, Unsettled, etc.
- **Visual/tonal vibes:** Gritty, Bright, Cozy, Arty, Atmospheric, etc.
- Single-select enums: runtime, viewing_context, thinking_effort, pacing, era, subtitle_preference, obscurity_preference

> **Note:** PRD gives examples, not an exhaustive taxonomy. Start with a curated list covering test fixtures (`Horror`, `Folk Horror`, `Disturbed`, `Atmospheric`) and expand pragmatically. Document source in file header.

**Route:** `frontend/src/app/recommend/page.tsx`

- Multi-step wizard (10 questions + optional notes step)
- One question per screen with Back/Next
- Multi-select chips for Q1, Q6, Q7 with **client-side** `No Preference` exclusivity (mirror backend `NO_PREFERENCE_CONFLICT`)
- Notes textarea: `maxLength={1000}` with counter
- Submit → `POST /recommendations` with loading state (warn user: may take up to 30s)
- On success → `router.push(/recommend/results/${session_id})`
- Handle `INSUFFICIENT_CANDIDATES`, `NO_PREFERENCE_CONFLICT`, `VALIDATION_ERROR`

**Roadmap checkboxes:** Questionnaire (all sub-bullets).

---

### Slice 6 — Results screen (`p6-results-screen`)

**Route:** `frontend/src/app/recommend/results/[sessionId]/page.tsx`

- Load session via `GET /recommendations/{session_id}` (or pass state from POST response)
- **Winner card:** poster, title, year, runtime, director, Letterboxd/RT ratings
- **Explanation sections:** `why_it_matches`, `most_influential_factors`, `why_it_beat_alternatives`, `caveats`
- **Runners-up grid:** 4 cards with poster + condensed explanation
- **Constraint relaxation:** banner when `constraint_relaxation` non-null
- **Answer summary:** Sheet/dialog showing questionnaire recap + notes (from session's profile data or client-held form state)
- Actions: "New Recommendation", "View History"

**Roadmap checkbox:** Results screen (all sub-bullets).

---

### Slice 7 — History (`p6-history`)

**Routes:**

| Route | Purpose |
|-------|---------|
| `frontend/src/app/history/page.tsx` | List + filters |
| `frontend/src/app/history/[sessionId]/page.tsx` | Detail (reuse results layout) |

**List page:**

- `GET /recommendations` with `search`, `date_from`, `date_to`, `watch_status` query params
- Card grid: poster, title, year, preference_summary excerpt, created_at, watch_status badge
- Search input (debounced), date range pickers, watch status filter
- Pagination via `pagination.has_more` / offset

**Detail page:**

- `GET /recommendations/{session_id}` — same presentation as results screen

**Roadmap checkbox:** History (all sub-bullets).

---

### Slice 8 — Sync settings (`p6-sync-settings`)

**Route:** `frontend/src/app/settings/sync/page.tsx`

- **CSV re-sync:** file upload → `POST /sync/csv`; show diff summary from response (added/removed/watched counts per api-contracts §6.1)
- **RSS config:** username input → `PUT /sync/rss`; display validation errors
- **RSS status:** `GET /sync/rss/status` — show configured username, `last_polled_at`, `last_poll_status`, poll error message if any
- Optional: `refetchInterval` on status while configured

**Roadmap checkbox:** Sync settings (all sub-bullets).

---

## Roadmap Checkbox Mapping

Map implementation slices to [`documents/roadmap.md`](./roadmap.md) Phase 6 checkboxes. Update **incrementally** — same commit as the feature when possible.

### Shared Infrastructure

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| API client with base URL config and error envelope parsing | `p6-api-client`, `p6-api-types` |
| React Query hooks for all endpoints | `p6-react-query-hooks` |
| Shared layout, navigation, loading/error states | `p6-layout-nav`, `p6-shadcn-setup` |
| Toast notifications for API errors | `p6-layout-nav`, `p6-api-client` |

### Pages & Flows

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| Home / empty state | `p6-home-empty-state` |
| Import flow | `p6-import-flow` |
| Match review | `p6-match-review` |
| Questionnaire | `p6-questionnaire-vocab`, `p6-questionnaire-wizard` |
| Results screen | `p6-results-screen` |
| History | `p6-history` |
| Sync settings | `p6-sync-settings` |

### Verification Gate

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| First-time user journey completable end-to-end through UI | `p6-verify-gates` |
| Import → poll → review → questionnaire → results → history | `p6-verify-gates` |
| Sync settings update watchlist state correctly | `p6-verify-gates` |
| Error states display user-friendly messages for all API error codes | `p6-api-client`, `p6-verify-gates` |

---

## Verification Gates

### Gate script: `scripts/verify-phase6-gates.sh`

Create following the pattern of `verify-phase5-gates.sh`. Proposed gates:

| Gate | Command / check | Pass criteria |
|------|-----------------|---------------|
| **1** | `cd frontend && npx tsc --noEmit` | Zero type errors |
| **2** | `cd frontend && npm run build` | Production build succeeds |
| **3** | ESLint (if added) | `npm run lint` passes; skip if still unconfigured |
| **4** | Backend regression | `verify-phase2.5` through `verify-phase5` scripts pass |
| **5** | E2E journey (Playwright recommended) | Scripted first-time user flow against `docker compose up` stack |
| **6** | Error UX audit | Manual or Playwright: trigger each `ErrorCode` path; confirm toast/inline message |

**Gate 5 — E2E setup (recommended):**

```bash
cd frontend
npm init playwright@latest   # or add @playwright/test devDependency
```

Test fixture: use `letterboxd/watchlist.csv` (gitignored locally) or commit a minimal `frontend/e2e/fixtures/watchlist-small.csv` (≤5 films) for CI.

Journey steps to automate:

1. Upload CSV at `/import`
2. Wait for import status `complete` on `/import/[jobId]`
3. Resolve any review-required films at `/review` (may be zero with high-confidence fixture)
4. Complete questionnaire at `/recommend`
5. Assert winner visible on `/recommend/results/[sessionId]`
6. Assert session appears on `/history`
7. Upload sync CSV at `/settings/sync` (optional second fixture)

**Gate 6 — error paths:** Use API mocks or seed data to trigger `WATCHLIST_SIZE_EXCEEDED`, `NO_PREFERENCE_CONFLICT`, `INSUFFICIENT_CANDIDATES` where feasible.

### Combined regression (required before marking Phase 6 complete)

```bash
bash scripts/verify-phase2.5-gates.sh
bash scripts/verify-phase3-gates.sh
bash scripts/verify-phase4-gates.sh
bash scripts/verify-phase5-gates.sh
bash scripts/verify-phase6-gates.sh
cd api && DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  TEST_DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  pytest tests/ -v
cd frontend && npx tsc --noEmit
```

Confirm GitHub Actions `.github/workflows/api-ci.yml` passes on push. Consider adding `.github/workflows/frontend-ci.yml` (tsc + build) if not added during implementation — document in AGENTS.md if so.

### Manual hello-world verification

With `docker compose up` and provider keys configured for live recommendations:

1. http://localhost:3000 — empty state or returning-user hub (not health-only)
2. Complete first-time journey per sequence-diagrams §11
3. History shows saved session
4. Sync settings page loads RSS status

---

## Roadmap Update Procedure

Update [`documents/roadmap.md`](./roadmap.md) **incrementally** per slice. Do not mark verification gates complete before `verify-phase6-gates.sh` passes.

### During implementation (per slice)

1. Complete slice work and run slice gate(s) (`tsc`, slice-specific E2E if available).
2. Mark matching Phase 6 **Task Checklist** items `- [x]` using the [checkbox mappings](#roadmap-checkbox-mapping) above.
3. Commit: `phase-6: <slice> — roadmap checkboxes`.
4. Push; confirm CI green before next slice.
5. Mark corresponding plan frontmatter todo(s) `completed`.

### Final pass (`p6-update-roadmap`, `p6-document-index`)

Only after `verify-phase6-gates.sh` and combined regression pass:

1. Mark all remaining Phase 6 Task Checklist and Verification Gate checkboxes `- [x]`.
2. Update **Overview** (line ~11):

```markdown
**Current state:** Phase 6 complete. Full MVP UX covers import, match review, questionnaire, results, history, and sync settings. Next up: Phase 7 — Developer Mode.
```

3. Add this plan to **Document Index** Phase plans row:

```markdown
| Phase plans | ... , [phase-6-plan.md](./phase-6-plan.md) |
```

4. Mark all plan frontmatter todos `completed`.
5. Commit: `phase-6: complete — roadmap overview and plan todos updated`.

### Commit discipline

- Prefix commits with `phase-6:`.
- Include roadmap checkbox updates in the same commit as the feature they document.
- Never mark verification gates complete before the gate script passes.

---

## AGENTS.md Review (final step)

After all gates pass and the roadmap overview is updated, review [`AGENTS.md`](../AGENTS.md) for stale or missing guidance.

### When to update AGENTS.md

| Change in Phase 6 | AGENTS.md section to update |
|-------------------|----------------------------|
| New compose service or port | **Running the stack** — service table, URL, port |
| New required env var (e.g. `NEXT_PUBLIC_*` beyond existing) | **First-time config** or **Gotchas** |
| `scripts/verify-phase6-gates.sh` added | **Lint and test** — add gate script row |
| `.github/workflows/frontend-ci.yml` added | **Lint and test** — add frontend CI row; CI parity note |
| ESLint initialized (`npm run lint` works) | **Lint and test** — replace `tsc --noEmit`-only note with `npm run lint` |
| Playwright E2E added | **Lint and test** — document `npx playwright test` command and Postgres/stack prerequisite |
| Hello-world verification changes (health-only → full UX) | **Hello-world verification** — describe empty state, import CTA, journey steps |
| Project overview phase statement | **Project overview** — "Through Phase 6: …" |
| Docker/bootstrap change (frontend Dockerfile, compose volume) | **Docker daemon** / **Running the stack** / **Local development** |
| New frontend dev dependency install step | **Local (non-Docker) development** — frontend section |

### Review checklist

Run through each item; update AGENTS.md only where repo behaviour actually changed:

- [ ] **Compose services / ports** — unchanged unless new services added to `docker-compose.yml` (expected: still `frontend:3000`, `api:8000`, `postgres:5432`)
- [ ] **Required env vars** — `NEXT_PUBLIC_API_URL` still defaults correctly; document any new vars
- [ ] **Lint / test commands** — table includes `verify-phase6-gates.sh`, `npx tsc --noEmit`, optional `npm run lint` / Playwright
- [ ] **Docker / bootstrap** — frontend `npm ci` still required for local dev; note if E2E needs compose stack running
- [ ] **New standard commands** — gate script, frontend build, E2E documented
- [ ] **Hello-world verification** — updated from API health card to MVP journey description
- [ ] **Cursor Cloud instructions** — still accurate for nested Docker / `fuse-overlayfs`
- [ ] **Project overview** — reflects Phase 6 frontend capabilities

If no structural changes apply, note in the final PR: "AGENTS.md reviewed — no updates required."

Mark plan todo `agents-md-review` complete after this review.

---

## Recommended PR Slicing

Implementation can land as one PR following this plan, or as stacked PRs:

| Slice | Contents | Gates |
|-------|----------|-------|
| **6a — Infrastructure** | shadcn, api-client, types, hooks, layout, toasts | Gate 1 |
| **6b — Import + review** | Home empty state, import flow, match review | Gate 1 + manual import path |
| **6c — Recommend flow** | Vocabulary, questionnaire, results | Gate 1 + manual recommend path |
| **6d — History + sync** | History list/detail, sync settings | Gate 1 |
| **6e — Gates + docs** | `verify-phase6-gates.sh`, Playwright E2E, roadmap, AGENTS.md | All gates |

Merge order: 6a → 6b → 6c → 6d → 6e (each rebased on `main` if split across PRs).

---

## Deliverables Summary

| Deliverable | Path |
|-------------|------|
| API types | `frontend/src/types/api.ts` |
| API client | `frontend/src/lib/api-client.ts` |
| Error messages | `frontend/src/lib/error-messages.ts` |
| Questionnaire vocabulary | `frontend/src/lib/questionnaire-vocabulary.ts` |
| React Query hooks | `frontend/src/hooks/use-*.ts` |
| App shell & UI | `frontend/src/components/app-shell.tsx`, `frontend/src/components/ui/*` |
| Pages | `frontend/src/app/**` per roadmap suggested structure |
| Gate script | `scripts/verify-phase6-gates.sh` |
| E2E tests (recommended) | `frontend/e2e/*.spec.ts` |
| Frontend CI (optional) | `.github/workflows/frontend-ci.yml` |
| Roadmap | `documents/roadmap.md` — Phase 6 checked off |
| Agent guidance | `AGENTS.md` — updated if structural changes apply |
| This plan | `documents/phase-6-plan.md` |

---

## Exit Criteria

Phase 6 is **done** when:

1. All todos in this plan frontmatter are `completed`
2. `bash scripts/verify-phase6-gates.sh` passes (all gates)
3. `bash scripts/verify-phase2.5-gates.sh` through `verify-phase5-gates.sh` still pass (regression)
4. `documents/roadmap.md` Phase 6 checklist and Verification Gate sections are fully checked off
5. Roadmap overview reflects Phase 6 complete / Phase 7 next
6. Document Index includes `phase-6-plan.md`
7. `AGENTS.md` reviewed and updated if structural changes apply
8. GitHub Actions CI green on push
9. First-time user journey completable through UI per sequence-diagrams §11
10. Changes committed, pushed, and PR ready for review

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Genre vocabulary undefined in specs | Curate `questionnaire-vocabulary.ts` from PRD examples + test fixtures; iterate if scoring mismatches reported |
| `POST /recommendations` takes up to 30s | Full-page loading state; disable double-submit; consider progress copy |
| Import polling race (`total_films` null) | Show indeterminate progress until parse completes |
| No frontend CI today | Add `frontend-ci.yml` or extend gate script; document in AGENTS.md |
| E2E flakiness on enrichment wait | Use small CSV fixture; gate script sets generous timeout; mock providers in test stack if needed |
| Poster images blocked by TMDB hotlink rules | Use `next/image` with `images.remotePatterns` in `next.config.ts` for `image.tmdb.org` |
| shadcn + React 19 compatibility | Pin component versions; run `npm run build` in Gate 2 |
