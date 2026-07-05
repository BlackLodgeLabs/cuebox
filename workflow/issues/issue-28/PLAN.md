# Issue #28 — Implementation Plan: Hard delete past recommendations

## Overview

Add user-initiated hard delete for individual recommendation history entries. The backend exposes `DELETE /recommendations/{session_id}`, reverses per-film exposure counters before removing the session (so future diversity scoring treats deleted runs as if they never happened), and relies on existing `ON DELETE CASCADE` for candidates and results. The frontend adds delete controls on the history list and detail pages with a confirmation dialog, React Query cache updates, and error toasts on failure.

This is a **new feature** (not a bug fix). No bug reproduction was required.

## Classification

| Aspect | Decision |
|--------|----------|
| Type | Feature — new DELETE capability and UI |
| Schema migration | Not needed — CASCADE FKs already exist |
| Auth | None — single-user local model unchanged |

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `api/app/repositories/recommendation_exposure_repository.py` | Extend | `decrement_exposure`, `recompute_last_recommended_at` |
| `api/app/repositories/recommendation_session_repository.py` | Extend | `delete_by_id` |
| `api/app/services/recommendation_service.py` | Extend | `delete_session` orchestration |
| `api/app/routers/v1/recommendations.py` | Extend | `DELETE /{session_id}` → 204 |
| `api/tests/test_integration_recommendation_history.py` | Extend | Delete happy path, 404, cascade, exposure reversal |
| `api/tests/test_recommendation_delete_exposure.py` (new, optional) | Add | Focused exposure/`last_recommended_at` unit/integration tests if history file grows too large |
| `frontend/src/lib/api-client.ts` | Extend | `deleteRecommendation(sessionId)` |
| `frontend/src/hooks/use-recommendations.ts` | Extend | `useDeleteRecommendation` mutation |
| `frontend/src/hooks/use-recommendations.test.tsx` | Extend | Hook cache invalidation + session query removal |
| `frontend/src/components/delete-history-dialog.tsx` (new) | Add | Shared confirmation dialog (reusable from list + detail) |
| `frontend/src/app/history/page.tsx` | Modify | Delete control on cards; refactor card layout so delete does not navigate |
| `frontend/src/app/history/[sessionId]/page.tsx` | Modify | “Remove from history” button + redirect on success |
| `frontend/e2e/history-delete.spec.ts` (new) | Add | Mocked API confirm-and-remove on history list |
| `frontend/e2e/helpers/history-delete-mocks.ts` (new) | Add | Route mocks for history delete E2E |
| `documents/api-contracts.md` | Extend | §8.2 `DELETE /recommendations/{session_id}` |
| `documents/PRD.md` | Extend | §17 — user-initiated delete vs no auto-prune |

## Implementation steps

### Step 1 — Exposure repository helpers

In `recommendation_exposure_repository.py`:

1. **`decrement_exposure(db, *, film_id, is_winner)`**
   - Load row via `get_by_film_id`; no-op if missing (defensive).
   - Decrement `recommendation_count` by 1 (floor at 0).
   - Decrement `winner_count` by 1 when `is_winner` (floor at 0).
   - If both counts are 0 after decrement, `db.delete(row)`.
   - Else `db.flush()`.

2. **`recompute_last_recommended_at(db, *, film_id, exclude_session_id)`**
   - Query `MAX(recommendation_sessions.created_at)` for sessions where:
     - `recommendation_candidates.film_id = :film_id` (join on `session_id`), **or**
     - `recommendation_sessions.winner_film_id = :film_id` (covers winner-only edge case).
   - Exclude `exclude_session_id` (the session being deleted).
   - If max is `NULL`, set exposure row `last_recommended_at = NULL` (or skip if row was deleted in step 1).
   - Else set `last_recommended_at` to that max timestamp.

Use SQLAlchemy `select` + `func.max` with appropriate joins; keep logic in the repository layer.

### Step 2 — Session repository delete

In `recommendation_session_repository.py`:

```python
def delete_by_id(db: Session, session_id: uuid.UUID) -> bool:
    session = db.get(RecommendationSession, session_id)
    if session is None:
        return False
    db.delete(session)
    db.flush()
    return True
```

### Step 3 — Service `delete_session`

In `recommendation_service.py`:

```python
def delete_session(self, db: Session, session_id: uuid.UUID) -> None:
```

1. Load session via `get_by_id` (includes `candidates` via `selectinload`).
2. If `None`, raise `not_found("Recommendation session")`.
3. For each row in `session.candidates`:
   - `decrement_exposure(db, film_id=candidate.film_id, is_winner=candidate.film_id == session.winner_film_id)`.
4. For each distinct `film_id` from step 3:
   - `recompute_last_recommended_at(db, film_id=fid, exclude_session_id=session_id)`.
5. `delete_by_id(db, session_id)` (or `db.delete(session)`).
6. `db.commit()`.

**Transaction:** All steps in one transaction; rollback on any error.

**Winner film deleted from watchlist:** `session.winner_film_id` may be `NULL`; still decrement `recommendation_count` for all candidates; `is_winner` is always `False` when `winner_film_id` is `NULL`.

### Step 4 — API route

In `recommendations.py`:

```python
from fastapi import Response, status

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recommendation_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    recommendation_service: RecommendationService = Depends(get_recommendation_service),
) -> Response:
    recommendation_service.delete_session(db, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

`not_found` from service propagates via existing `AppError` handler → 404 `NOT_FOUND`.

**Idempotency:** Second delete returns 404 (session gone after first delete).

Developer Mode routes (`/dev/recommendations/{session_id}/*`) already call `DeveloperService` which raises `not_found("Recommendation session")` when session missing — no code change required.

### Step 5 — Frontend API client and hook

**`api-client.ts`:**

```typescript
export function deleteRecommendation(sessionId: string): Promise<void> {
  return fetchApi<void>(`/recommendations/${sessionId}`, { method: "DELETE" });
}
```

`fetchApi` already returns `undefined` on 204.

**`use-recommendations.ts` — `useDeleteRecommendation`:**

- `mutationFn`: `deleteRecommendation(sessionId)`.
- `onSuccess`: invalidate `["recommendations", "history"]`; `queryClient.removeQueries({ queryKey: ["recommendations", sessionId] })`.
- Export hook; wire `useToastOnError` in consuming components (or `onError` in hook — match `useRematchFilm` / `useCreateRecommendation` patterns).

### Step 6 — Shared delete confirmation dialog

Create `delete-history-dialog.tsx`:

- Props: `open`, `onOpenChange`, `onConfirm`, `isPending`.
- Copy: *“Are you sure you want to remove this from your history? This cannot be undone.”*
- Footer: Cancel (outline) + Remove (destructive variant).
- Pattern: `EditFilmMatchDialog` (`@/components/ui/dialog`).

### Step 7 — History list UI

Refactor `history/page.tsx` cards:

- Change from wrapping entire card in `<Link>` to:
  - `<Card>` with clickable area (`Link` or `onClick` + `router.push`) for navigation.
  - Separate `<Button variant="ghost" size="icon">` (or text “Remove”) with `aria-label="Remove from history"` in card header; `e.preventDefault(); e.stopPropagation()` on click.
- Local state: `deletingSessionId` + dialog open.
- On confirm: `mutate(sessionId)`; on success dialog closes; list refreshes via query invalidation (no full page reload).
- On error: `useToastOnError` — entry stays visible.

Use muted destructive styling per `documents/DESIGN.md` (`text-muted-foreground` hover or `variant="destructive"` sparingly).

### Step 8 — History detail UI

In `history/[sessionId]/page.tsx`:

- Add “Remove from history” button (outline or secondary) near page header.
- Same `DeleteHistoryDialog`.
- On success: `router.push("/history")`.
- On error: destructive toast; user stays on detail page.

### Step 9 — Documentation

**`documents/api-contracts.md`** — add §8.2 after §8.1:

- `DELETE /recommendations/{session_id}`
- Success: `204 No Content`
- Errors: `NOT_FOUND` 404
- Note exposure reversal behavior (brief)
- Idempotency: second delete → 404

**`documents/PRD.md`** §17 — after “No automatic pruning.” add:

> Users may manually remove individual history entries; removed sessions are permanently deleted and do not affect future recommendation diversity scoring.

### Step 10 — Tests

See **Tests required** below.

## Tests required

| Test | Type | Maps to acceptance criterion |
|------|------|------------------------------|
| `test_delete_recommendation_session_happy_path` | API integration | 204 on existing session |
| `test_delete_recommendation_session_not_found` | API integration | 404 unknown + second delete 404 |
| `test_delete_cascades_candidates_and_results` | API integration | CASCADE removes child rows |
| `test_delete_reverses_exposure_counts` | API integration | Counts decremented; row removed when both 0 |
| `test_delete_recomputes_last_recommended_at` | API integration | `last_recommended_at` from remaining session or NULL |
| `test_delete_excludes_from_history_list` | API integration | `GET /recommendations` total decreases |
| `test_delete_dev_routes_return_404` | API integration | `/dev/recommendations/{id}/*` 404 after delete |
| `test_delete_diversity_scoring_parity` | API integration | Exposure map after delete matches never-recommended baseline for affected films |
| `useDeleteRecommendation` invalidates history + removes session query | Frontend unit (vitest) | Cache invalidation |
| `history delete confirm removes card` | Playwright E2E (mocked API) | List UI confirm-and-remove |

### Integration test setup pattern

Reuse `test_integration_recommendation_history.py` fixtures:

1. `seed_ready_films(db_session, count=5)`.
2. `POST /recommendations` → capture `session_id`.
3. Query `recommendation_exposure` for candidate film IDs before delete.
4. `DELETE /recommendations/{session_id}` → assert 204.
5. Assert DB state: session/candidates/results gone; exposure counts reversed.
6. `GET /recommendations` → session not in list.
7. `GET /recommendations/{session_id}` → 404.

For `last_recommended_at` recompute: create **two** sessions sharing a candidate film; delete the newer session; assert `last_recommended_at` equals older session’s `created_at`.

For diversity parity: capture `recommendation_exposure_repository.get_map` for pipeline candidates before first run, after create, after delete — after delete should match pre-first-run (all zeros / no rows).

### Playwright E2E (mocked)

New `frontend/e2e/history-delete.spec.ts` with `test.describe("History delete (mocked API)")`:

- Mock `GET /api/v1/recommendations` with 1–2 history cards.
- Mock `DELETE /api/v1/recommendations/{id}` → 204.
- Navigate to `/history`, click remove control, confirm dialog, assert card removed from DOM.
- Follow `film-rematch.spec.ts` mock helper pattern.

## Gate script

Run before push (execute agent):

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"
bash scripts/verify-phase5-gates.sh   # recommendation domain
bash scripts/verify-phase6-gates.sh   # frontend tsc/build + regression
```

If frontend production build needed on host while compose is up:

```bash
docker compose stop frontend && sudo rm -rf frontend/.next
```

Optional full regression before babysit: `bash scripts/verify-phase8-gates.sh`.

Also run:

- `cd api && ruff check app tests`
- `cd frontend && npm run test:unit`
- `cd frontend && npx playwright test e2e/history-delete.spec.ts --grep "mocked API"`

## Documentation updates

| File | Change |
|------|--------|
| `documents/api-contracts.md` | §8.2 DELETE endpoint |
| `documents/PRD.md` | §17 user delete sentence |

No `README.md` change required unless execute discovers a user-facing setup impact (none expected).

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Exposure decrement out of sync with increment | Mirror `increment_exposure` using `recommendation_candidates` as source of truth |
| `last_recommended_at` wrong after partial deletes | Integration test with two sessions per film |
| List card click vs delete event bubbling | `stopPropagation` + separate button element |
| Check constraint `winner_count <= recommendation_count` violated | Floor counts at 0; decrement winner only when `is_winner` |
| Accidental data loss | Confirmation dialog with irreversible warning |

**Rollback:** Revert commits; no migration to roll back. Deleted data is not recoverable (by design).

## Definition of done

- [ ] `DELETE /recommendations/{session_id}` returns 204 / 404 per spec
- [ ] Session delete cascades candidates + results; exposure reversed correctly
- [ ] `last_recommended_at` recomputed from remaining sessions
- [ ] History list and detail UI with confirmation dialog and error toasts
- [ ] React Query cache updated without full page reload (list); redirect from detail
- [ ] `documents/api-contracts.md` §8.2 and PRD §17 updated
- [ ] Integration tests + frontend hook test + Playwright mocked E2E pass
- [ ] `verify-phase5-gates.sh` and `verify-phase6-gates.sh` pass
- [ ] No Alembic migration added
- [ ] Draft PR #67 updated via pushes to feature branch (no new PR)
