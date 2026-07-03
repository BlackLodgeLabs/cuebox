## Related Issue

[Issue #35 — View returns to final question before showing recommendation page](https://github.com/BlackLodgeLabs/cuebox/issues/35)

## Description

**What does this PR do?**

Fixes a questionnaire submit UX regression on `/recommend`: after the user taps **Get recommendation**, the **Finding your film…** loading screen now stays visible until navigation to `/recommend/results/{sessionId}` completes. Previously, React Query's `create.isPending` dropped to `false` as soon as the mutation settled — before `router.push` finished — causing the **Notes** step (step 11) to flash back on screen for a brief moment.

The fix adds local page state `isNavigatingToResults`, set at submit start and cleared only on API error, and gates the loading UI on `create.isPending || isNavigatingToResults`. Regression unit tests cover the post-success render path, error recovery, and double-submit protection.

**Why is this the best approach?**

The timing gap is between React Query's mutation lifecycle and Next.js client navigation — local page state is the appropriate layer rather than lengthening `isPending` in the hook. On successful navigation the component unmounts, so `isNavigatingToResults` does not need an explicit success-path reset. The existing `submittingRef` double-submit guard is preserved and extended to the new `isSubmitting` flag for button disables.

## Changes Proposed

* **`frontend/src/app/recommend/page.tsx`** (`fix(frontend)`): Add `isNavigatingToResults` state and `isSubmitting` derived flag; gate loading UI and button disables on `isSubmitting`; set navigation-pending before `mutateAsync`, clear on error only.
* **`frontend/src/app/recommend/page.test.tsx`** (new): Three unit tests — loading persists after mutation settles but before navigation; API failure returns to Notes with error; rapid double-click calls `postRecommendation` once.
* **Workflow artifacts**: Spec, plan, bug reproduction evidence (`demo/bug-repro-*`), demo spec, demo notes, screenshots, and screen recording under `workflow/issues/issue-35/`.

## Scenario Results

Demo run on Docker Compose stack (2026-07-03, commit `05421f4`). See `workflow/issues/issue-35/demo/demo-notes.md`.

| # | Scenario | Result |
|---|----------|--------|
| 0 — Bug fix verification | **PASS** — `sawLoading: true`, `sawNotesAfterLoading: false`, `sawResults: true` |
| 1 — Error path unchanged | **PASS** — Loading clears; user on Notes with "Recommendation failed. Please try again." |
| 2 — Double-submit protection | **PASS** — Single navigation; one session ID observed |

**Compare to pre-fix:** `bug-repro-notes.md` reported `sawNotesAfterLoading: true`; post-fix DOM observer confirms `false`.

### Scenario 0 — Bug fix verification (no Notes flash)

![Scenario 0 results page](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-35-view-returns-to-final-question/workflow/issues/issue-35/demo/scenario-0-fixed.png)

Screen recording of submit → results transition: [`scenario-0-fixed.mp4`](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-35-view-returns-to-final-question/workflow/issues/issue-35/demo/scenario-0-fixed.mp4)

### Scenario 1 — Error path unchanged

![Scenario 1 API error on Notes step](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-35-view-returns-to-final-question/workflow/issues/issue-35/demo/scenario-1-error.png)

### Scenario 2 — Double-submit protection

![Scenario 2 single session results](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/cursor/issue-35-view-returns-to-final-question/workflow/issues/issue-35/demo/scenario-2-single-session.png)

## How to Test

### Automated (primary)

```bash
# Checkout branch
git checkout cursor/issue-35-view-returns-to-final-question

# Type check and unit tests
cd frontend && npx tsc --noEmit
cd frontend && npm run test:unit

# Recommend page regression tests only
cd frontend && npm run test:unit -- src/app/recommend/page.test.tsx

# Full Phase 6 gate (tsc, build, unit tests, backend regression)
bash scripts/verify-phase6-gates.sh
```

**Host build note:** If the Compose frontend dev container is running, stop it and remove `frontend/.next` before host `npm run build` per AGENTS.md.

### Manual (Docker stack)

```bash
docker compose up -d
curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool
```

1. Open `http://localhost:3000/recommend`.
2. Complete the 11-step questionnaire (e.g. Horror → Next ×5 → Disturbed → Atmospheric → Next ×4).
3. On **Notes**, click **Get recommendation**.
4. Confirm **Finding your film…** stays visible until `/recommend/results/{sessionId}` loads — **Notes** must not flash between loading and results.
5. (Optional) Stop API (`docker compose stop api`), submit again, confirm error on Notes step and retry works after `docker compose start api`.

## Known Issues / Notes for Reviewer

* **Frontend-only change** — no API, database, or config changes.
* **No new Playwright E2E** — explicitly out of scope per spec; unit tests cover the render-timing regression. Existing `e2e/helpers/recommendation-journey.ts` waits for results URL only.
* **Pre-fix evidence** preserved at `workflow/issues/issue-35/demo/bug-repro-notes.md` and `bug-repro-screenshot.png` for comparison.
* **Results page loading** (`Loading recommendation…` on `/recommend/results/[sessionId]`) is separate and unchanged — acceptable per spec.

## Checklist

- [x] Acceptance criteria in `workflow/issues/issue-35/SPEC.md` met
- [x] `cd frontend && npx tsc --noEmit` passes
- [x] `cd frontend && npm run test:unit` passes (including `page.test.tsx`)
- [x] `bash scripts/verify-phase6-gates.sh` passes
- [x] Demo screenshots reviewed (no secrets in artifacts)
- [x] CI green on PR #65

## Gate evidence

- Phase 6 gate: `bash scripts/verify-phase6-gates.sh` exit 0 at `dd777a5` (2026-07-03, babysit-pr)
