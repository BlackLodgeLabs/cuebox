# Demo notes — issue #28: Hard delete past recommendations

- **Date:** 2026-07-03
- **Commit:** `8494edbd21801df9bb6defc013890806d2bf7072`
- **Branch:** `cursor/issue-28-hard-delete-past-recommendations`
- **Stack:** Docker Compose (postgres, api, frontend, backup) — all Up; health checks OK

## Preconditions

- Seeded 10 ready films via `scripts/seed-dev-db.py` (DB had only 2 films on boot).
- Created 2 additional recommendation sessions via `POST /api/v1/recommendations` (live OpenAI) so 3 history cards were available for UI scenarios.
- Home page showed **New recommendation**; `pagination.total >= 1` on history API.

## Scenario results

### Scenario 1: Delete from history list — **PASS**

Opened `/history` with 3 cards: *Ready Film 2 (1992)*, *Ready Film 4 (1994)*, *The Matrix (1999)*.

- Trash control visible with `aria-label="Remove from history"`; clicking it did not navigate to detail.
- Confirmation dialog showed: *"Are you sure you want to remove this from your history? This cannot be undone."*
- **Cancel** closed dialog; card remained.
- **Remove** deleted *Ready Film 2* without full page reload; 2 cards remained.

| Artifact | Path |
|----------|------|
| Before | `scenario-1-history-list-before.png` |
| Dialog | `scenario-1-confirm-dialog.png` |
| After | `scenario-1-history-list-after.png` |
| Recording | `scenario-1-delete-list.mp4` |

### Scenario 2: Delete from history detail — **PASS**

- Opened detail for *Ready Film 4 (1994)*; **Remove from history** button visible.
- Confirmed delete → redirected to `/history`; entry gone; *The Matrix* remained.

| Artifact | Path |
|----------|------|
| Detail before | `scenario-2-detail-before.png` |
| After redirect | `scenario-2-history-after-redirect.png` |

### Scenario 3: API delete and exposure reversal — **PASS**

Deleted session `c618464a-c80a-4bbf-8dee-db0ed68f3abb` (*The Matrix*) via API:

- `DELETE` → **204**
- `GET /recommendations/{session_id}` → **404**
- List `pagination.total` went from 1 → 0; session excluded from `data`.

| Artifact | Path |
|----------|------|
| API log | `scenario-3-api-delete.log` |

### Scenario 4: Failed delete shows error (optional) — **PARTIAL / GAP**

Stopped API (`docker compose stop api`), attempted delete from history list with API down.

- Entry **remained** in the list (correct).
- **Error toast did not appear**; dialog stayed open in pending state while requests failed (Next.js proxy 502/500). Screenshot captures the stuck dialog state.

This optional scenario documents a UX gap when the API is fully unreachable — not a blocker for required scenarios 1–3.

| Artifact | Path |
|----------|------|
| Error state | `scenario-4-delete-error-toast.png` |

## Summary

Required scenarios **1–3 pass**. Hard delete works from history list, detail page, and API with correct confirmation copy, list updates, redirect, and 204/404 behavior.

Optional scenario 4 reveals missing user-visible error feedback when the API container is stopped (dialog hangs instead of toast + dismiss).
