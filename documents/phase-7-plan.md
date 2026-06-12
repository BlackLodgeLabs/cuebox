---
name: Phase 7 — Developer Mode
overview: "Implement internal observability for recommendation debugging — gated /dev API endpoints, developer service, and a hidden frontend dev panel on results/history detail — with verification gates, incremental roadmap checkbox updates, and AGENTS.md structural review."
depends_on: Phase 6.5 (complete)
todos:
  # ── Baseline ──────────────────────────────────────────────────────────────
  - id: p7-baseline-gates
    content: "Confirm verify-phase6.5-gates.sh (and Phases 2.5–6 regression) pass before Phase 7 work begins"
    status: pending
  - id: p7-gap-analysis
    content: "Confirm persistence gaps — tokens_input/tokens_output and profile_cache_hit not yet stored on recommendation_sessions"
    status: pending
  # ── Backend — persistence & schemas ─────────────────────────────────────────
  - id: p7-migration-session-observability
    content: "Alembic migration — add tokens_input, tokens_output, profile_cache_hit to recommendation_sessions; persist in recommendation_service.create"
    status: pending
  - id: p7-dev-schemas
    content: "Pydantic response schemas for api-contracts §9.1–9.5 in api/app/schemas/developer.py"
    status: pending
  - id: p7-developer-service
    content: "developer_service.py — aggregate retrieval, scoring, AI, film match, and system versions from existing tables"
    status: pending
  - id: p7-dev-router
    content: "api/app/routers/v1/dev.py — five GET endpoints; config gate returns 404 when developer_mode false; mount on v1 router"
    status: pending
  - id: p7-backend-tests
    content: "Unit + integration tests — dev endpoints 200 when enabled, 404 when disabled; full trace payload for completed session"
    status: pending
  # ── Frontend — types, hooks, UI ───────────────────────────────────────────
  - id: p7-api-types
    content: "Extend frontend/src/types/api.ts with DevRetrieval, DevScoring, DevAI, DevFilmMatch, DevSystemVersions types"
    status: pending
  - id: p7-api-client
    content: "Extend api-client.ts with getDevRetrieval, getDevScoring, getDevAI, getDevFilmMatch, getDevSystemVersions"
    status: pending
  - id: p7-dev-hooks
    content: "React Query hooks — use-dev-mode.ts with lazy fetch per tab; probe enabled state via GET /dev/system/versions"
    status: pending
  - id: p7-dev-entry
    content: "Hidden entry — keyboard shortcut (e.g. Ctrl+Shift+D) or ?dev=1 URL param; only activates when backend returns 200 on versions probe"
    status: pending
  - id: p7-dev-panel
    content: "frontend/src/components/dev-mode/ — tabbed panel (Retrieval, Scoring, AI, Versions) embedded in results + history detail pages"
    status: pending
  - id: p7-dev-styling
    content: "Style dev panel with design system — mono readouts, elevated surface, terminal-like tables; no new routes"
    status: pending
  # ── Verification & docs ───────────────────────────────────────────────────
  - id: p7-gate-script
    content: "Add scripts/verify-phase7-gates.sh — dev API tests, 404 gate, frontend tsc/build, Phase 6.5 regression"
    status: pending
  - id: p7-verify-gates
    content: "Run verify-phase7-gates.sh plus full regression chain; confirm API CI and frontend CI green"
    status: pending
  - id: p7-update-roadmap
    content: "Check off Phase 7 task checklist and verification gate in documents/roadmap.md; update overview to Phase 7 complete / Phase 8 next"
    status: pending
  - id: p7-document-index
    content: "Add phase-7-plan.md to roadmap Document Index Phase plans row"
    status: pending
  - id: p7-agents-md
    content: "Review AGENTS.md for structural changes (developer_mode config, gate script, hello-world dev panel note)"
    status: pending
isProject: false
---

# Phase 7 — Developer Mode

## Context

**Phase 6.5 is complete.** Cuebox delivers the full MVP UX with the Modern Neo-Noir Cinema design system. The backend recommendation pipeline (Phases 3–5) already persists rich observability data in `recommendation_profiles`, `recommendation_sessions`, `recommendation_candidates`, `film_metadata`, and `system_versions`.

**Phase 7 goal:** Expose that data through gated `/dev/*` API endpoints and a hidden frontend dev panel for recommendation debugging — per [PRD.md §20](./PRD.md), [Architecture.md §21](./Architecture.md), [sequence-diagrams.md §10](./sequence-diagrams.md), and [api-contracts.md §9](./api-contracts.md).

**Authoritative references:**

| Document | Purpose |
|----------|---------|
| [`documents/roadmap.md`](./roadmap.md) | Phase 7 task checklist + verification gate |
| [`documents/api-contracts.md`](./api-contracts.md) | §9 Developer Mode — request/response shapes |
| [`documents/sequence-diagrams.md`](./sequence-diagrams.md) | §10 Developer Mode observability flow |
| [`documents/database-design.md`](./database-design.md) | §4.9–4.10 sessions/candidates; §4.12 system_versions |
| [`documents/DESIGN.md`](./DESIGN.md) | Dev panel should use existing tokens (mono readouts, elevated surfaces) |
| [`scripts/verify-phase6.5-gates.sh`](../scripts/verify-phase6.5-gates.sh) | Regression baseline (must stay green) |

### Current vs target gap summary

| Area | Today | Phase 7 target |
|------|-------|----------------|
| **Config** | `developer_mode: false` in `config.yaml`; loaded by `AppConfig` | All `/dev/*` routes return `404` when `false` |
| **API** | No `/dev` router or `developer_service.py` | Five GET endpoints per api-contracts §9 |
| **Persistence** | Candidates store retrieval/scoring traces; session stores version metadata | Also persist `tokens_input`, `tokens_output`, `profile_cache_hit` on session (see gap below) |
| **Frontend** | Results/history detail use `ResultsView` only | Tabbed dev panel when mode enabled + user activates hidden entry |
| **Tests** | Phase 5 integration tests verify candidate observability at DB level | Dedicated dev endpoint integration tests + gate script |

### Persistence gaps (must address in Slice 7a)

Phase 5 stores most observability data, but two api-contracts §9 fields are **not yet persisted**:

| Field | Contract location | Current state |
|-------|-------------------|---------------|
| `tokens_input` / `tokens_output` | §9.3 AI detail | Returned by `RankingResult` but discarded after `recommendation_service.create` |
| `profile_cache_hit` | §9.1 retrieval trace | Returned on `POST /recommendations` only; `get_session` hardcodes `false`; not stored on session |

**Resolution:** Alembic migration adding nullable `tokens_input INTEGER`, `tokens_output INTEGER`, `profile_cache_hit BOOLEAN` to `recommendation_sessions`. Update `recommendation_session_repository.create` and `recommendation_service.create` to persist values from `RankingResult` and `RecommendationProfileResult`.

Historical sessions created before migration will return `null`/`false` for these fields — acceptable for dev tooling.

### Current scaffold inventory

| Path | State |
|------|-------|
| `api/app/core/config.py` | `developer_mode: bool` on `AppConfig` — **unused by routers** |
| `api/app/routers/v1/__init__.py` | No dev router mounted |
| `api/app/services/recommendation_service.py` | Full pipeline; observability in DB |
| `api/app/database/models.py` | `RecommendationSession`, `RecommendationCandidate`, `FilmMetadata`, `SystemVersion` |
| `api/app/repositories/system_version_repository.py` | Active version queries — reuse in dev service |
| `config.example.yaml` | `developer_mode: false` |
| `frontend/src/app/recommend/results/[sessionId]/page.tsx` | Results only — no dev panel |
| `frontend/src/app/history/[sessionId]/page.tsx` | Same pattern |
| `frontend/src/lib/api-client.ts` | No `/dev` methods |
| `frontend/src/types/api.ts` | No dev types |
| `frontend/src/components/dev-mode/` | **Does not exist** (roadmap suggests this path) |

---

## Implementation Slices

Prefix commits: `phase-7:`.

### Slice 7a — Session observability persistence (`p7-migration-session-observability`)

1. Alembic migration `0004_session_observability.py` (or next sequential number).
2. Extend RecommendationSession model + recommendation_session_repository.create. Also add the missing film relationship on RecommendationCandidate (and optionally the corresponding back-reference on Film) to simplify loading film titles.
3. In `recommendation_service.create`, pass `ranking_result.tokens_*` and `profile.profile_cache_hit`.
4. Update get_session to return the stored profile_cache_hit instead of the hardcoded false.

**Slice gate:** `cd api && alembic upgrade head && pytest tests/test_integration_recommendation.py -v` (existing E2E still passes).

---

### Slice 7b — Developer service + schemas (`p7-dev-schemas`, `p7-developer-service`)

Create `api/app/schemas/developer.py` matching api-contracts §9 response shapes.

Create `api/app/services/developer_service.py`:

| Method | Data sources |
|--------|--------------|
| `get_retrieval_trace(session_id)` | `recommendation_sessions` + `recommendation_profiles` + `recommendation_candidates` (join `films` for titles); `retrieval_candidate_limit` from `get_app_config().recommendation` |
| `get_scoring_detail(session_id)` | Session `scoring_version`, `weight_set`; weights from `get_app_config().scoring`; candidates with `score_breakdown`, `raw_score`, `final_score`, `llm_rank` |
| `get_ai_detail(session_id)` | Session ranking/semantic/embedding fields + config providers; `tokens_*` from session columns |
| `get_film_match(film_id)` | `film_metadata` — `tmdb_id`, `imdb_id`, `match_confidence`, `metadata_source`; film `enrichment_status` |
| `get_system_versions()` | `system_version_repository` — all active versions |

Raise `not_found` when session/film missing (same as other services).

**Slice gate:** Unit tests on `developer_service` with in-memory DB fixtures (or repository mocks).

---

### Slice 7c — Dev router + config gate (`p7-dev-router`)

Create `api/app/routers/v1/dev.py`:

```
GET /dev/recommendations/{session_id}/retrieval
GET /dev/recommendations/{session_id}/scoring
GET /dev/recommendations/{session_id}/ai
GET /dev/films/{film_id}/match
GET /dev/system/versions
```

**Config gate pattern** — dependency or decorator:

```python
def require_developer_mode() -> None:
    if not get_app_config().developer_mode:
        raise not_found("Not found")  # 404, not 403 — per api-contracts
```

Apply to **all** `/dev/*` routes (including `/dev/films/{film_id}/match` for consistency with roadmap, even though §9.4 only documents film-not-found).

Mount in `api/app/routers/v1/__init__.py` with `prefix="/dev"`.

**Slice gate:** `pytest tests/test_developer_mode.py -v` covering:
- Each endpoint returns `200` with expected keys when `developer_mode: true` and session exists
- Each endpoint returns `404` when `developer_mode: false`
- Unknown `session_id` / `film_id` returns `404` when enabled

---

### Slice 7d — Frontend types, client, hooks (`p7-api-types`, `p7-api-client`, `p7-dev-hooks`)

**Types** (`frontend/src/types/api.ts`): Add interfaces mirroring §9.1–9.5 JSON.

**API client** (`frontend/src/lib/api-client.ts`): Five `fetchApi` wrappers under `/dev/...`.

**Hooks** (`frontend/src/hooks/use-dev-mode.ts`):

- `useDevModeEnabled()` — probe `GET /dev/system/versions`; treat `404` as disabled (no error toast)
- `useDevRetrieval(sessionId, enabled)` — lazy per tab
- `useDevScoring(sessionId, enabled)`
- `useDevAI(sessionId, enabled)`
- `useDevSystemVersions(enabled)`

Use `enabled: false` until user opens dev panel to avoid unnecessary requests.

**Slice gate:** `cd frontend && npx tsc --noEmit`.

---

### Slice 7e — Dev panel UI (`p7-dev-entry`, `p7-dev-panel`, `p7-dev-styling`)

**Hidden entry** (choose one primary, support both):

| Mechanism | Behaviour |
|-----------|-----------|
| Keyboard shortcut | `Ctrl+Shift+D` (or `Cmd+Shift+D` on macOS) toggles panel when `useDevModeEnabled()` is true |
| URL param | `?dev=1` on results/history detail auto-opens panel when backend dev mode enabled |

Do **not** show dev UI chrome when probe returns `404` — panel stays absent for normal users.

**Components** (`frontend/src/components/dev-mode/`):

| Component | Responsibility |
|-----------|----------------|
| `dev-mode-provider.tsx` | Context: `isOpen`, `setOpen`, `isEnabled` from probe |
| `dev-mode-panel.tsx` | Collapsible section below `ResultsView` on results + history detail pages |
| `dev-retrieval-tab.tsx` | Profile hash, narrative, embedding metadata, candidate similarity table |
| `dev-scoring-tab.tsx` | Weight set, weights bar chart or table, per-candidate breakdown |
| `dev-ai-tab.tsx` | Provider/model/version readouts, token counts |
| `dev-versions-tab.tsx` | Active system version registry |

Use existing shadcn `Tabs`, `Card`, `Badge`; Space Mono for numeric/metadata readouts per DESIGN.md.

**Integration points:**

- `frontend/src/app/recommend/results/[sessionId]/page.tsx`
- `frontend/src/app/history/[sessionId]/page.tsx`

Wrap pages with `DevModeProvider`; render `DevModePanel sessionId={...}` after `ResultsView`.

**Slice gate:** Manual check — set `developer_mode: true` in `config.yaml`, complete a recommendation, open results with `?dev=1`, verify all four tabs load data.

---

### Slice 7f — Gate script, roadmap, AGENTS.md (`p7-gate-script`, `p7-verify-gates`, `p7-update-roadmap`, `p7-agents-md`)

See [Verification Gates](#verification-gates) and [Roadmap Update Procedure](#roadmap-update-procedure) below.

---

## Roadmap Checkbox Mapping

### Backend

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| Gate all `/dev/*` routes on `developer_mode: true`; return `404` when disabled | `p7-dev-router`, `p7-backend-tests` |
| `GET /dev/recommendations/{session_id}/retrieval` | `p7-dev-schemas`, `p7-developer-service`, `p7-dev-router` |
| `GET /dev/recommendations/{session_id}/scoring` | same |
| `GET /dev/recommendations/{session_id}/ai` | same + `p7-migration-session-observability` |
| `GET /dev/films/{film_id}/match` | same |
| `GET /dev/system/versions` | same |

### Frontend

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| Hidden Dev Mode entry (keyboard shortcut or URL param when config enabled) | `p7-dev-entry`, `p7-dev-hooks` |
| Tabs: Retrieval, Scoring, AI, Versions | `p7-dev-panel`, `p7-dev-styling` |

### Verification gate (roadmap)

| Roadmap item | Plan todo(s) |
|--------------|--------------|
| Dev endpoints return full trace data for completed session | `p7-backend-tests`, `p7-verify-gates` |
| Dev endpoints return `404` when `developer_mode: false` | `p7-backend-tests` |
| Frontend dev panel renders retrieval, scoring, and AI data | `p7-dev-panel`, manual / optional Playwright |

---

## Verification Gates

### Gate script: `scripts/verify-phase7-gates.sh`

| Gate | Check |
|------|-------|
| 1 | `cd api && ruff check app tests` |
| 2 | `cd api && pytest tests/test_developer_mode.py -v` (new; Postgres required) |
| 3 | Dev mode disabled — assert all `/dev/*` return `404` (in same test file or dedicated test) |
| 4 | `cd frontend && npx tsc --noEmit` |
| 5 | `cd frontend && npm run build` |
| 6 | `bash scripts/verify-phase6.5-gates.sh` (full frontend + backend regression) |
| 7 | Optional Playwright — dev panel smoke when `PLAYWRIGHT_E2E_STACK=1` and `developer_mode: true` in test config |

### Combined regression (required before marking Phase 7 complete)

```bash
bash scripts/verify-phase2.5-gates.sh
bash scripts/verify-phase3-gates.sh
bash scripts/verify-phase4-gates.sh
bash scripts/verify-phase5-gates.sh
bash scripts/verify-phase6-gates.sh
bash scripts/verify-phase6.5-gates.sh
bash scripts/verify-phase7-gates.sh
cd api && DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  TEST_DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox \
  pytest tests/ -v
cd frontend && npx tsc --noEmit
```

Confirm GitHub Actions `.github/workflows/api-ci.yml` and `.github/workflows/frontend-ci.yml` pass on push.

### Manual hello-world verification

With `developer_mode: true` in `config.yaml` and `docker compose up`:

1. Complete a recommendation journey (import → questionnaire → results).
2. On `/recommend/results/{sessionId}?dev=1` — dev panel visible with four tabs populated.
3. Repeat on `/history/{sessionId}?dev=1`.
4. Set `developer_mode: false`, restart API — dev panel hidden; `/dev/system/versions` returns `404`.
5. Normal users (no shortcut, no `?dev=1`) see unchanged results UI.

---

## Roadmap Update Procedure

Update [`documents/roadmap.md`](./roadmap.md) **incrementally** per slice. Do not mark verification gates complete before `verify-phase7-gates.sh` passes.

### During implementation (per slice)

1. Complete slice work and run slice gate(s).
2. Mark matching Phase 7 **Task Checklist** items `- [x]` using the [checkbox mappings](#roadmap-checkbox-mapping) above.
3. Commit: `phase-7: <slice> — roadmap checkboxes`.
4. Push; confirm CI green before next slice.
5. Mark corresponding plan frontmatter todo(s) `completed`.

### Final pass (`p7-update-roadmap`, `p7-document-index`)

Only after `verify-phase7-gates.sh` and combined regression pass:

1. Mark all remaining Phase 7 Task Checklist and Verification Gate checkboxes `- [x]`.
2. Update **Overview** (line ~11):

```markdown
**Current state:** Phase 7 complete. Developer Mode exposes recommendation internals via gated `/dev` API and a hidden frontend dev panel. Next up: Phase 8 — Integration, NFR Validation & Polish.
```

3. Add this plan to **Document Index** Phase plans row:

```markdown
| Phase plans | ... , [phase-7-plan.md](./phase-7-plan.md) |
```

4. Mark all plan frontmatter todos `completed`.
5. Commit: `phase-7: complete — roadmap overview and plan todos updated`.

### Commit discipline

- Prefix commits with `phase-7:`.
- Include roadmap checkbox updates in the same commit as the feature they document.
- Never mark verification gates complete before the gate script passes.

---

## AGENTS.md Review (final step)

After all gates pass and the roadmap overview is updated, review [`AGENTS.md`](../AGENTS.md) for stale or missing guidance.

### When to update AGENTS.md

| Change in Phase 7 | AGENTS.md section to update |
|-------------------|----------------------------|
| New compose service or port | **Running the stack** — service table (expected: unchanged — still `frontend:3000`, `api:8000`, `postgres:5432`) |
| `developer_mode` in `config.yaml` becomes operationally significant | **First-time config** or **Gotchas** — document enabling dev mode for debugging; default remains `false` |
| New required env var | **First-time config** or **Gotchas** (expected: no new env vars — dev mode is config-only) |
| `scripts/verify-phase7-gates.sh` added | **Lint and test** — add gate script row |
| Dev panel manual verification steps | **Hello-world verification** — optional bullet for `developer_mode: true` + `?dev=1` |
| Project overview phase statement | **Project overview** — "Through Phase 7: …" |
| New API test file pattern | **Lint and test** — note `test_developer_mode.py` if added to CI collect |
| ESLint initialized during Phase 7 | **Lint and test** — replace `tsc --noEmit`-only note with `npm run lint` |
| Docker/bootstrap change | **Docker daemon** / **Running the stack** / **Local development** |

### Review checklist

Run through each item; update AGENTS.md only where repo behaviour actually changed:

- [ ] **Compose services / ports** — unchanged unless new services added to `docker-compose.yml`
- [ ] **Required env vars** — `developer_mode` lives in `config.yaml`, not `.env`; document if agents need to toggle it for dev panel testing
- [ ] **Lint / test commands** — table includes `verify-phase7-gates.sh`
- [ ] **Docker / bootstrap** — API restart required after `config.yaml` change (volume-mounted in compose)
- [ ] **New standard commands** — gate script documented
- [ ] **Hello-world verification** — note optional dev panel check
- [ ] **Cursor Cloud instructions** — still accurate
- [ ] **Project overview** — reflects Phase 7 developer observability

If no structural changes apply beyond the gate script and gotcha about `developer_mode`, note in the final PR: "AGENTS.md reviewed — minimal updates (gate script + developer_mode gotcha)."

Mark plan todo `p7-agents-md` complete after this review.

---

## Recommended PR Slicing

| Slice | Contents | Gates |
|-------|----------|-------|
| **7a — Persistence** | Migration, session columns, recommendation_service wiring | Phase 5 integration test |
| **7b–7c — Backend API** | schemas, developer_service, dev router, tests | `test_developer_mode.py` |
| **7d–7e — Frontend** | types, client, hooks, dev panel on results/history | `tsc`, manual dev panel |
| **7f — Gates + docs** | `verify-phase7-gates.sh`, roadmap, AGENTS.md | All gates |

Merge order: 7a → 7b–7c → 7d–7e → 7f (can combine 7b+7c and 7d+7e into single PRs if preferred).

---

## Deliverables Summary

| Deliverable | Path |
|-------------|------|
| Session observability migration | `api/alembic/versions/0004_*.py` |
| Dev schemas | `api/app/schemas/developer.py` |
| Developer service | `api/app/services/developer_service.py` |
| Dev router | `api/app/routers/v1/dev.py` |
| Dev tests | `api/tests/test_developer_mode.py` |
| Frontend dev types | `frontend/src/types/api.ts` |
| API client extensions | `frontend/src/lib/api-client.ts` |
| Dev hooks | `frontend/src/hooks/use-dev-mode.ts` |
| Dev panel components | `frontend/src/components/dev-mode/*` |
| Page integration | `frontend/src/app/recommend/results/[sessionId]/page.tsx`, `frontend/src/app/history/[sessionId]/page.tsx` |
| Gate script | `scripts/verify-phase7-gates.sh` |
| Roadmap | `documents/roadmap.md` — Phase 7 checked off |
| Agent guidance | `AGENTS.md` — updated if structural changes apply |
| This plan | `documents/phase-7-plan.md` |

---

## Exit Criteria

Phase 7 is **done** when:

1. All todos in this plan frontmatter are `completed`
2. `bash scripts/verify-phase7-gates.sh` passes (all gates)
3. `bash scripts/verify-phase2.5-gates.sh` through `verify-phase6.5-gates.sh` still pass (regression)
4. `documents/roadmap.md` Phase 7 checklist and Verification Gate sections are fully checked off
5. Roadmap overview reflects Phase 7 complete / Phase 8 next
6. Document Index includes `phase-7-plan.md`
7. `AGENTS.md` reviewed and updated if structural changes apply
8. GitHub Actions CI green on push
9. Dev panel displays retrieval, scoring, and AI data for a completed session when `developer_mode: true`
10. All `/dev/*` endpoints return `404` when `developer_mode: false`
11. Changes committed, pushed, and PR ready for review

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Token usage not persisted | Slice 7a migration before dev AI endpoint ships |
| `profile_cache_hit` lost on history reload | Persist on session; fix `get_session` to read stored value |
| Frontend cannot read `config.yaml` | Probe `GET /dev/system/versions`; no health contract change required |
| Dev panel leaks to normal users | Double gate: backend 404 + frontend hides UI unless probe succeeds and user activates entry |
| Large candidate tables in UI | Paginate or scroll within tab; show `candidates_returned` count |
| api-contracts §9.4 omits dev-mode-disabled 404 | Gate `/dev/films/*` anyway for consistency with roadmap and other dev routes |
