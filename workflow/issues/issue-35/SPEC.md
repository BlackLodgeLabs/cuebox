# Issue #35: View returns to final question before showing recommendation page

## Summary

Fix a questionnaire submit UX regression on `/recommend`: after the user taps **Get recommendation**, the **Finding your film…** loading screen should remain visible until navigation to `/recommend/results/{sessionId}` completes. The final **Notes** step must not flash back on screen between loading and results.

## Problem

On the recommendation questionnaire (`frontend/src/app/recommend/page.tsx`), submitting the last step triggers `useCreateRecommendation().mutateAsync`, which shows a loading state while `create.isPending` is true:

```139:150:frontend/src/app/recommend/page.tsx
  if (create.isPending) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="text-h1">Finding your film…</h1>
        ...
      </div>
    );
  }
```

When the API call succeeds, `isPending` drops to `false` **before** `router.push(...)` finishes loading the results route. React re-renders the questionnaire at step 11 (**Notes** — the final question) for a brief period, then the results page appears. This is jarring and makes the app feel broken.

The component already tracks `submittingRef` to prevent double-submit, but that ref is not used to gate the loading UI after a successful mutation.

**Expected:** Loading → results (seamless).

**Actual:** Loading → final question flash → results.

## Acceptance criteria

- [ ] After the user submits the questionnaire on the last step, the **Finding your film…** screen stays visible until the browser navigates to `/recommend/results/{sessionId}`.
- [ ] The **Notes** step (or any other questionnaire step) is **not** visible between the loading screen and the results page under normal success paths.
- [ ] On API failure, the loading screen clears, the user remains on the questionnaire (last step), and the existing submit error message is shown so they can retry.
- [ ] Double-submit protection is preserved (rapid clicks on **Get recommendation** do not create duplicate sessions).
- [ ] A frontend unit test covers the post-success render path: when the mutation resolves but navigation has not completed, the loading UI is still shown (not the questionnaire).
- [ ] `cd frontend && npx tsc --noEmit` passes.
- [ ] `cd frontend && npm run test:unit` passes (including the new/updated test).

## Scope

### In scope

- **Frontend state management** on `frontend/src/app/recommend/page.tsx` to keep the loading UI visible from submit start through successful navigation (e.g. a `hasSubmitted` / `isNavigating` boolean set before `mutateAsync`, cleared only on error or unmount).
- **Unit test** for the recommend page submit → loading → navigate flow (mock `useCreateRecommendation` and `useRouter`).
- Minor reuse of existing loading copy (**Finding your film…**) — no copy or design changes required unless needed for test selectors.

### Out of scope

- Backend recommendation API changes (latency, response shape).
- Results page loading UX (`/recommend/results/[sessionId]` already shows **Loading recommendation…** while fetching session data — that is separate and acceptable).
- Questionnaire content, validation, or step count changes.
- Playwright E2E for this bug (unit coverage is sufficient for a render-timing fix; full-stack E2E already waits for results URL in `e2e/helpers/recommendation-journey.ts` without asserting the intermediate flash).
- Broader navigation/loading patterns across other pages.

## User flows / API changes

### Flow — successful recommendation (fixed)

1. User completes all 11 questionnaire steps on `/recommend`.
2. User clicks **Get recommendation** on the **Notes** step.
3. UI immediately shows **Finding your film…** (unchanged copy).
4. `POST /api/v1/recommendations` runs (existing API; no contract change).
5. On success, UI **remains** on **Finding your film…** while `router.push(/recommend/results/{session_id})` runs.
6. Results page loads and shows **Your pick** (existing behavior).

### Flow — failed recommendation (unchanged intent)

1. Steps 1–4 as above.
2. API returns an error.
3. Loading screen clears; user sees the **Notes** step with the existing error message (`submitError`).
4. User can edit notes or click **Get recommendation** again.

### API changes

None.

## Data and integration notes

- No database, sync, or provider integration impact.
- `useCreateRecommendation` (`frontend/src/hooks/use-recommendations.ts`) and `postRecommendation` API client remain unchanged.
- React Query mutation lifecycle (`isPending` true → false on settle) is the root timing issue; the fix should not rely on lengthening `isPending` in the hook — local page state is the appropriate layer.

## Open questions (must be empty before plan-ready)

_None._

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/35
- Affected page: `frontend/src/app/recommend/page.tsx`
- Results destination: `frontend/src/app/recommend/results/[sessionId]/page.tsx`
