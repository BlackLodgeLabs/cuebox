## Related Issue

[Issue #28 — Hard delete past recommendations from user history](https://github.com/BlackLodgeLabs/cuebox/issues/28)

Draft PR: https://github.com/BlackLodgeLabs/cuebox/pull/67

## Description

**What does this PR do?**

Adds user-initiated **hard delete** for individual recommendation history entries. Users can remove a past recommendation from `/history` (list card trash control) or `/history/[sessionId]` (detail **Remove from history** button). Each delete shows an irreversible confirmation dialog, calls `DELETE /recommendations/{session_id}`, and updates the UI without a full page reload (list) or redirects to `/history` (detail).

On the backend, deleting a session removes the `recommendation_sessions` row and, via existing `ON DELETE CASCADE`, all `recommendation_candidates` and `recommendation_results` for that session. Before the session row is removed, per-film **exposure counters are reversed** (`recommendation_count`, `winner_count`, `last_recommended_at`) so future diversity scoring treats deleted runs as if they never happened.

**Why is this the best approach?**

Exposure reversal mirrors the existing `increment_exposure` path in `recommendation_service.py`, using `recommendation_candidates` as the source of truth rather than only UI-visible winners/runners-up. No Alembic migration is needed — CASCADE FKs already exist. Session delete uses a SQL `DELETE` (not ORM cascade sync) to avoid SQLAlchemy stale-state errors when child rows are removed by the database. A shared `DeleteHistoryDialog` component keeps list and detail confirmation UX consistent.

## Changes Proposed

* **Exposure repository** (`api/app/repositories/recommendation_exposure_repository.py`): Add `decrement_exposure` and `recompute_last_recommended_at` helpers; floor counts at 0 and remove exposure rows when both counts reach 0.
* **Session repository** (`api/app/repositories/recommendation_session_repository.py`): Add `delete_by_id` using SQL `DELETE` for reliable cascade behavior.
* **Recommendation service** (`api/app/services/recommendation_service.py`): Add `delete_session` — load session + candidates, reverse exposure per film, recompute `last_recommended_at`, delete session, commit in one transaction.
* **API route** (`api/app/routers/v1/recommendations.py`): `DELETE /recommendations/{session_id}` → `204 No Content`; unknown session → `404 NOT_FOUND`.
* **Frontend API + hook** (`frontend/src/lib/api-client.ts`, `frontend/src/hooks/use-recommendations.ts`): `deleteRecommendation` client and `useDeleteRecommendation` mutation with React Query invalidation for `["recommendations", "history"]` and removal of `["recommendations", sessionId]`.
* **Shared dialog** (`frontend/src/components/delete-history-dialog.tsx`): Confirmation copy *"Are you sure you want to remove this from your history? This cannot be undone."*
* **History list** (`frontend/src/app/history/page.tsx`): Trash control on each card with `stopPropagation`; error toast wired on failure.
* **History detail** (`frontend/src/app/history/[sessionId]/page.tsx`): **Remove from history** button; redirect to `/history` on success; error toast on failure.
* **Tests**: Integration tests in `api/tests/test_integration_recommendation_history.py` (happy path, 404, cascade, exposure reversal, `last_recommended_at` recompute, list exclusion, dev routes 404, diversity scoring parity); hook unit test in `frontend/src/hooks/use-recommendations.test.tsx`; mocked Playwright E2E in `frontend/e2e/history-delete.spec.ts` with helpers in `frontend/e2e/helpers/history-delete-mocks.ts`.
* **Docs** (`documents/api-contracts.md` §8.2, `documents/PRD.md` §17): Document DELETE endpoint and clarify user-initiated delete vs no automatic pruning.

## Scenario Results

Demo run on cloud VM (2026-07-03, implementation at `bb479da`, demo at `447d1ac`). Full Docker stack (`postgres`, `api`, `frontend`, `backup` all Up). Seeded 10 ready films and created 2 additional recommendation sessions for 3 history cards. See `workflow/issues/issue-28/demo/demo-notes.md`.

| # | Scenario | Result |
|---|----------|--------|
| 1 — Delete from history list | **PASS** — Trash control (`aria-label="Remove from history"`), confirmation dialog, cancel preserves card, confirm removes card without full reload |
| 2 — Delete from history detail | **PASS** — Remove control on detail; redirect to `/history` with entry gone |
| 3 — API delete and exposure reversal | **PASS** — `DELETE` → 204; detail → 404; list `pagination.total` decreases |
| 4 — Failed delete shows error (optional) | **PARTIAL / GAP** — Entry remained when API was stopped, but error toast did not appear; dialog stayed open in pending state |

### Scenario 1 — Delete from history list

![History list before delete](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/demo/scenario-1-history-list-before.png)

![Confirmation dialog](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/demo/scenario-1-confirm-dialog.png)

![History list after delete](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/demo/scenario-1-history-list-after.png)

https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/demo/scenario-1-delete-list.mp4

### Scenario 2 — Delete from history detail

![Detail page before delete](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/demo/scenario-2-detail-before.png)

![History after redirect](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/demo/scenario-2-history-after-redirect.png)

### Scenario 3 — API delete

API log: `workflow/issues/issue-28/demo/scenario-3-api-delete.log` — `DELETE` returned `204`, detail returned `404 NOT_FOUND`, list `pagination.total` went from 1 to 0.

### Scenario 4 — Failed delete (optional)

![Delete error state when API unreachable](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-28-hard-delete-past-recommendations/workflow/issues/issue-28/demo/scenario-4-delete-error-toast.png)

## How to Test

### Checkout and stack

```bash
git checkout cursor/issue-28-hard-delete-past-recommendations
docker compose up -d
curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool
```

Ensure at least one history entry exists (cloud Part 2 seed or create via **New recommendation** questionnaire flow).

### UI — history list delete

1. Open http://localhost:3000/history
2. Click the trash icon on a card — verify you do **not** navigate to detail
3. Confirm dialog shows irreversible warning; click **Cancel** — card remains
4. Click trash again → **Remove** — card disappears without full page reload

### UI — history detail delete

1. Open a history entry at `/history/{sessionId}`
2. Click **Remove from history** and confirm
3. Verify redirect to `/history` and entry no longer listed

### API

```bash
SESSION_ID=$(curl -sf "http://localhost:3000/api/v1/recommendations?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['session_id'])")

curl -sf -o /dev/null -w "DELETE %{http_code}\n" -X DELETE \
  "http://localhost:3000/api/v1/recommendations/${SESSION_ID}"

curl -sf -o /dev/null -w "GET detail %{http_code}\n" \
  "http://localhost:3000/api/v1/recommendations/${SESSION_ID}"
```

Expect `DELETE 204` and `GET detail 404`.

### Automated tests

```bash
export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
export TEST_DATABASE_URL="$DATABASE_URL"

cd api && ruff check app tests
cd api && pytest tests/test_integration_recommendation_history.py -v -k delete

cd frontend && npm run test:unit
cd frontend && npx playwright test e2e/history-delete.spec.ts --grep "mocked API"

bash scripts/verify-phase5-gates.sh
bash scripts/verify-phase6-gates.sh
```

If host `npm run build` fails with `EACCES` while Compose frontend is running: `docker compose stop frontend && sudo rm -rf frontend/.next`, then rebuild.

## Known Issues / Notes for Reviewer

* **No schema migration** — existing `ON DELETE CASCADE` FKs are sufficient; `alembic upgrade head` on API restart is unchanged.
* **Exposure reversal is transactional** — all decrement/recompute steps and session delete commit together; rollback on any error.
* **Second DELETE returns 404** — session is gone after first delete (idempotent from user perspective).
* **Developer Mode** — `/dev/recommendations/{session_id}/*` naturally returns 404 after delete (no code change required).
* **`recommendation_profiles` preserved** — questionnaire cache may still be referenced by other sessions.
* **Delete not on results page** — out of scope per spec; users delete from history after navigating away.
* **Scenario 4 UX gap** — when the API container is fully unreachable (`docker compose stop api`), the delete dialog stays in a pending state instead of showing an error toast and dismissing. Mocked Playwright E2E covers the happy-path error toast with a 500 response; live API-down behavior is a known follow-up.
* **Pre-existing Playwright issue** — `e2e/dev-mode.spec.ts` "history detail shows dev panel" has a known strict-mode selector clash (unrelated to this feature).

## Checklist

- [ ] Acceptance criteria in `workflow/issues/issue-28/SPEC.md` met
- [ ] `DELETE /recommendations/{session_id}` returns 204 / 404 per spec
- [ ] Exposure reversal and `last_recommended_at` recompute verified by integration tests
- [ ] History list and detail UI with confirmation dialog reviewed
- [ ] `documents/api-contracts.md` §8.2 and PRD §17 updated
- [ ] Demo screenshots reviewed (no secrets in artifacts)
- [ ] `verify-phase5-gates.sh` and `verify-phase6-gates.sh` pass
- [ ] CI green on PR #67
