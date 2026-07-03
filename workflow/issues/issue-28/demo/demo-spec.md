# Demo spec — issue #28: Hard delete past recommendations

Planning agent output. Demo agent follows this exactly.

## Preconditions

- Full Docker stack running (`docker compose ps` — `postgres`, `api`, `frontend`, `backup` all Up)
- Health checks pass:
  - `curl -sf http://localhost:3000/api/v1/health`
  - `curl -sf http://localhost:8000/api/v1/health`
- Seeded watchlist with at least one recommendation history entry (cloud Part 2 gate)
  - Home page shows **New recommendation** (not empty-watchlist CTA)
  - `curl -sf "http://localhost:3000/api/v1/recommendations?limit=1"` returns `pagination.total >= 1`

### Seed steps

If history is empty after stack boot:

1. Confirm films: `curl -sf "http://localhost:3000/api/v1/films?limit=1" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['pagination']['total']>=5"`
2. Create a recommendation via UI: **New recommendation** → complete questionnaire → submit (requires `OPENAI_API_KEY` in `.env` for live run), **or** use existing seeded history from Part 2 bootstrap.

For API-only verification without live OpenAI, demo agent may use `curl` against an integration-tested stack only if execute has already seeded history in the DB; prefer UI path when keys are available.

## Scenarios

### Scenario 1: Delete from history list

**Goal:** Prove list UI shows delete control, confirmation dialog, and removes entry without full page reload.

**Steps:**

1. Open http://localhost:3000/history
2. Note the count of history cards and the title of the first card.
3. Click the delete/remove control on one card (trash icon or equivalent) — verify navigation to detail does **not** occur.
4. Confirm the dialog shows copy equivalent to: *“Are you sure you want to remove this from your history? This cannot be undone.”*
5. Click **Cancel** — dialog closes; card still visible.
6. Click delete again → **Confirm** / **Remove**.
7. Wait for the card to disappear; page should not perform a full browser reload.

**Capture:**

- Screenshot: `workflow/issues/issue-28/demo/scenario-1-history-list-before.png` (before delete)
- Screenshot: `workflow/issues/issue-28/demo/scenario-1-confirm-dialog.png` (dialog open)
- Screenshot: `workflow/issues/issue-28/demo/scenario-1-history-list-after.png` (card removed)
- Optional screen recording: `workflow/issues/issue-28/demo/scenario-1-delete-list.mp4` (under 30s)

**Pass criteria:**

- Delete control visible on history card with accessible label.
- Confirmation dialog appears with irreversible warning.
- After confirm, deleted card is gone; remaining cards still render.
- Cancel does not call delete (card remains).

### Scenario 2: Delete from history detail

**Goal:** Prove detail page delete control redirects to `/history` after success.

**Steps:**

1. Open http://localhost:3000/history and click a card to open detail (or navigate directly to `/history/{sessionId}`).
2. Click **Remove from history** (or equivalent).
3. Confirm in the dialog.
4. Verify redirect to `/history` and the deleted entry no longer appears in the list.

**Capture:**

- Screenshot: `workflow/issues/issue-28/demo/scenario-2-detail-before.png`
- Screenshot: `workflow/issues/issue-28/demo/scenario-2-history-after-redirect.png`

**Pass criteria:**

- Detail page shows remove control.
- After confirm, user lands on `/history` without the deleted entry.

### Scenario 3: API delete and exposure reversal (backend)

**Goal:** Prove DELETE endpoint works and session is gone from API.

**Steps:**

1. `curl -sf "http://localhost:3000/api/v1/recommendations?limit=5" | python3 -m json.tool` — note a `session_id` and `pagination.total`.
2. `curl -sf -o /dev/null -w "%{http_code}\n" -X DELETE "http://localhost:3000/api/v1/recommendations/{session_id}"` — expect `204`.
3. `curl -sf "http://localhost:3000/api/v1/recommendations/{session_id}"` — expect 404 (or non-2xx with `NOT_FOUND`).
4. `curl -sf "http://localhost:3000/api/v1/recommendations?limit=5" | python3 -c "import sys,json; d=json.load(sys.stdin); assert not any(i['session_id']=='{session_id}' for i in d['data'])"` — session excluded from list.

**Capture:**

- Save API output: `workflow/issues/issue-28/demo/scenario-3-api-delete.log` (redact secrets; include status codes and list total before/after)

**Pass criteria:**

- DELETE returns 204.
- Detail returns 404 after delete.
- List no longer includes deleted `session_id`.

### Scenario 4: Failed delete shows error (optional)

**Goal:** Prove UI handles delete failure gracefully.

**Steps:**

1. If feasible without code changes: stop API container briefly (`docker compose stop api`), attempt delete from history list, observe error toast, confirm entry remains.
2. Restart API (`docker compose start api`).

**Capture:**

- Screenshot: `workflow/issues/issue-28/demo/scenario-4-delete-error-toast.png` (if scenario is run)

**Pass criteria:**

- Destructive toast or error state shown; entry not removed from UI.

Skip if stopping API is disruptive to other scenarios; note skip in `demo-notes.md`.

## Artifacts checklist

- [ ] All screenshots listed above saved under `workflow/issues/issue-28/demo/`
- [ ] `workflow/issues/issue-28/demo/demo-notes.md` with short narrative of what was shown
- [ ] No secrets in images or logs
- [ ] Scenarios 1–3 are required; Scenario 4 is optional
