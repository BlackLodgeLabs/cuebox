# Demo notes — issue #28: Hard delete past recommendations

- **Date:** 2026-07-03
- **Commit:** `0b4eed2e3154378722b8d69f72b4ec2f8999252b`
- **Branch:** `cursor/issue-28-hard-delete-past-recommendations`
- **Stack:** Docker Compose (`postgres`, `api`, `frontend`, `backup` all Up); health checks OK on ports 3000 and 8000.

## Preconditions

- Seeded 10 ready films via `python3 scripts/seed-dev-db.py` (DB had only 2 films after boot).
- Created two additional recommendation sessions via `POST /api/v1/recommendations` so three history cards were available for UI scenarios (original seeded session: The Matrix).

## Scenario 1: Delete from history list — **PASS**

Opened `/history` with three cards (Ready Film 4, Ready Film 3, The Matrix).

1. Captured list before delete (`scenario-1-history-list-before.png`).
2. Clicked trash control on first card (Ready Film 4) — did not navigate to detail.
3. Confirmation dialog showed: *"Are you sure you want to remove this from your history? This cannot be undone."* (`scenario-1-confirm-dialog.png`).
4. **Cancel** closed dialog; card remained.
5. Delete again → **Remove** — card disappeared without full page reload (`scenario-1-history-list-after.png`); two cards remained.

## Scenario 2: Delete from history detail — **PASS**

1. Opened Ready Film 3 detail from history (`scenario-2-detail-before.png`).
2. Clicked **Remove from history** and confirmed.
3. Redirected to `/history`; Ready Film 3 no longer listed (`scenario-2-history-after-redirect.png`). Only The Matrix remained.

## Scenario 3: API delete and exposure reversal — **PASS**

Used remaining session `c618464a-c80a-4bbf-8dee-db0ed68f3abb` (The Matrix). See `scenario-3-api-delete.log`.

| Step | Result |
|------|--------|
| `DELETE /recommendations/{session_id}` | `204` |
| `GET /recommendations/{session_id}` | `404` / `NOT_FOUND` |
| List excludes deleted session | `pagination.total` 1 → 0 |

## Scenario 4: Failed delete shows error (optional) — **PARTIAL / NOT REQUIRED**

Stopped API briefly and attempted delete from history list. Confirmation dialog hung ~5s then closed; **no error toast** appeared (console showed 500/404). Entry remained after API restart. Screenshot: `scenario-4-delete-error-toast.png` (browser devtools). This optional scenario is documented for awareness; Scenarios 1–3 (required) all passed. Error-toast UX may be a follow-up polish item, not a blocker for the core delete feature.

## Artifacts

| File | Description |
|------|-------------|
| `scenario-1-history-list-before.png` | History list with 3 cards |
| `scenario-1-confirm-dialog.png` | Irreversible confirmation copy |
| `scenario-1-history-list-after.png` | List after list-card delete |
| `scenario-2-detail-before.png` | Detail page with Remove control |
| `scenario-2-history-after-redirect.png` | `/history` after detail delete |
| `scenario-3-api-delete.log` | API status codes and list totals |
| `scenario-4-delete-error-toast.png` | Optional: API-down attempt (console) |

No secrets in images or logs.
