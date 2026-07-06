# Bug reproduction notes — issue #35

**Date:** 2026-07-03  
**Commit:** `dd06e3b17f5d7975b4759e5b6b95f3b0d9486b3b`  
**Branch:** `cursor/issue-35-view-returns-to-final-question`

## Environment

- Docker stack running (`docker compose ps` — all four services Up)
- Health: `http://localhost:3000/api/v1/health` → `status: ok`, `database: ok`
- Seeded watchlist: 2 films with `enrichment_status: ready` (Part 2 tier-3 fixture)
- Provider keys available (embedding, semantic, ranking all `ok`)

## Reproduction steps

1. Open `http://localhost:3000/recommend`.
2. Complete the 11-step questionnaire:
   - Genres: **Horror** → Next
   - Steps 2–5 (runtime, viewing context, thinking effort, pacing): Next × 4
   - Emotional outcomes: **Disturbed** → Next
   - Visual & tonal vibes: **Atmospheric** → Next
   - Steps 9–10 (era, subtitles, obscurity): Next × 3
3. On step 11 (**Notes**), click **Get recommendation**.
4. Observe UI during the transition to results.

## Expected behavior

After clicking **Get recommendation**, the **Finding your film…** loading screen should remain visible continuously until the browser navigates to `/recommend/results/{sessionId}`. The **Notes** step must not reappear.

## Actual behavior

1. **Finding your film…** appears while `POST /api/v1/recommendations` is in flight (`create.isPending === true`).
2. When the API returns success, `isPending` becomes `false` **before** `router.push(...)` completes.
3. React re-renders the questionnaire at step 11 (**Notes**) for a brief interval.
4. Navigation then completes and the results page loads.

## Evidence

| Artifact | Description |
|----------|-------------|
| `bug-repro-screenshot.png` | Captured **Notes** step (Step 11 of 11) during the post-success / pre-navigation window |
| Playwright observer (planning) | `{ "sawLoading": true, "sawNotesAfterLoading": true }` — confirms Notes heading appeared after loading heading |

## Root cause (code)

In `frontend/src/app/recommend/page.tsx`, the loading UI is gated solely on `create.isPending` (line 139). After `mutateAsync` resolves in `handleSubmit`, `isPending` drops to `false` while `router.push` is still pending, so the questionnaire branch re-renders at the last step. `submittingRef` prevents double-submit but does not keep the loading screen visible.

## Notes

- The flash is brief (milliseconds to low hundreds of ms) but user-visible and jarring.
- Failure path is unaffected: `submittingRef` is reset in the `catch` block and loading clears correctly on error.
