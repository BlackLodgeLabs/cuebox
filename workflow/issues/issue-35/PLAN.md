# Implementation plan — issue #35

## Overview

Fix a frontend render-timing regression on `/recommend`: after a successful questionnaire submit, keep the **Finding your film…** loading screen visible until Next.js navigation to `/recommend/results/{sessionId}` completes. Introduce local page state (e.g. `isNavigatingToResults`) set at submit start and cleared only on API error, so the UI no longer depends solely on React Query's `isPending`, which becomes `false` before `router.push` finishes.

## Reproduction findings

Reproduced on the live Docker stack (commit `dd06e3b`). See:

- [`demo/bug-repro-notes.md`](demo/bug-repro-notes.md)
- [`demo/bug-repro-screenshot.png`](demo/bug-repro-screenshot.png)

**Observed:** After **Get recommendation**, loading appears, then **Notes** (step 11) flashes before results. Playwright DOM polling returned `sawLoading: true`, `sawNotesAfterLoading: true`.

## Root cause

`RecommendPage` renders the loading screen only when `create.isPending` is true:

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

`handleSubmit` awaits `mutateAsync`, then calls `router.push`. On success, React Query sets `isPending` to `false` synchronously on settle, triggering a re-render of the questionnaire at `stepIndex === 10` (Notes) until the route transition unmounts the page.

## Files to change

| Path | Change type | Rationale |
|------|-------------|-----------|
| `frontend/src/app/recommend/page.tsx` | Modify | Add `isNavigatingToResults` state; gate loading UI on `create.isPending \|\| isNavigatingToResults`; set before submit, clear on error only |
| `frontend/src/app/recommend/page.test.tsx` | Add | Regression test for post-success / pre-navigation render path |
| `workflow/issues/issue-35/workflow.state.json` | Modify | Handoff to execute (`plan-ready`) |

## Implementation steps

### 1. Add navigation-pending state (`page.tsx`)

- Add `const [isNavigatingToResults, setIsNavigatingToResults] = useState(false)`.
- In `handleSubmit`, before `mutateAsync`:
  - Keep existing `submittingRef` guard.
  - `setIsNavigatingToResults(true)`.
- On success: call `router.push(...)` — **do not** clear `isNavigatingToResults` (component unmounts on navigation).
- On error (`catch`): `setIsNavigatingToResults(false)`, `submittingRef.current = false`, existing `setSubmitError` logic unchanged.

### 2. Gate loading UI

Replace the loading condition:

```tsx
if (create.isPending || isNavigatingToResults) {
  return ( /* Finding your film… */ );
}
```

No copy or layout changes required.

### 3. Preserve double-submit protection

- `handleNext` / `handleSubmit` guards: extend to also check `isNavigatingToResults` where `create.isPending` is checked (Back button disable, early return on last step).
- `submittingRef` remains the primary guard against duplicate `mutateAsync` calls.

### 4. Add unit test (`page.test.tsx`)

Create `frontend/src/app/recommend/page.test.tsx` following patterns from `settings/sync/page.test.tsx`:

- Mock `next/navigation` `useRouter` with a `push` that does **not** resolve/unmount immediately.
- Mock `@/hooks/use-recommendations` `useCreateRecommendation` with controllable `isPending` and `mutateAsync`.
- Render `RecommendPage` wrapped in `createQueryWrapper().Wrapper` (or minimal provider if hook is fully mocked).
- Navigate to last step (click through or set initial state via test helpers).
- Click **Get recommendation**.
- Simulate mutation settle: set mock `isPending` to `false` while `push` has not completed.
- **Assert:** `Finding your film…` is still visible; `Notes` step heading / **Get recommendation** button are **not** visible.

Additional test cases (same file):

| Test | Maps to acceptance criterion |
|------|------------------------------|
| API error clears loading and shows `submitError` on Notes step | Error path unchanged |
| Rapid double-click on **Get recommendation** calls `mutateAsync` once | Double-submit protection |

### 5. Run frontend checks locally

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run test:unit
```

## Tests required

| Test | Type | Acceptance criterion |
|------|------|----------------------|
| Loading UI persists when `isPending` false but navigation pending | Unit (`page.test.tsx`) | AC: no Notes flash after success; loading until navigate |
| Error path shows Notes + error, loading cleared | Unit (`page.test.tsx`) | AC: API failure behavior unchanged |
| Double-submit calls mutation once | Unit (`page.test.tsx`) | AC: duplicate sessions prevented |
| `npx tsc --noEmit` | Type check | AC: types pass |
| `npm run test:unit` | Unit suite | AC: all unit tests pass |

No new Playwright E2E (explicitly out of scope per spec; existing journey helper waits for results URL only).

## Gate script

Run before push (frontend-only change):

```bash
bash scripts/verify-phase6-gates.sh
```

This covers `tsc`, frontend build, `npm run test:unit`, and backend regression. Skip full Phase 8 unless babysit requests it.

**Host build note:** If the Compose frontend dev container is running, stop it and remove `frontend/.next` before host `npm run build` per AGENTS.md.

## Documentation updates

None required. No API, config, or user-facing copy changes beyond the bug fix.

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| `isNavigatingToResults` stuck `true` if navigation fails silently | Low risk — Next.js `router.push` typically completes or errors; on error path we already clear state. If needed, add `useEffect` cleanup on unmount (navigation success unmounts anyway). |
| Over-broad loading gate hides error UI | Only clear `isNavigatingToResults` in `catch`; error path never sets navigation success. |

**Rollback:** Revert the single commit on `page.tsx` and remove the new test file.

## Definition of done

- [ ] `isNavigatingToResults` (or equivalent) gates loading UI from submit through successful navigation
- [ ] Notes step does not render between loading and results on success path
- [ ] API error clears loading and shows existing error on Notes step
- [ ] Double-submit protection preserved
- [ ] `frontend/src/app/recommend/page.test.tsx` regression test passes
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd frontend && npm run test:unit` passes
- [ ] `bash scripts/verify-phase6-gates.sh` passes
- [ ] Demo agent can verify Scenario 0 (no Notes flash) per `demo/demo-spec.md`
