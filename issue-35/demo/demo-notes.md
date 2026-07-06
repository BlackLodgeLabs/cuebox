# Demo notes — issue #35

**Date:** 2026-07-03  
**Commit:** `05421f4337383380839a661158b366862b759806`  
**Branch:** `cursor/issue-35-view-returns-to-final-question`  
**Stack:** Docker Compose (postgres, api, frontend, backup all Up)

## Summary

All three demo scenarios pass. The fix (`isNavigatingToResults` state gating the loading UI) prevents the **Notes** step from flashing between **Finding your film…** and the results page. Error handling and double-submit protection remain correct.

## Scenario 0: Bug fix verification — PASS

Completed the 11-step questionnaire (Horror → Next ×5 → Disturbed → Atmospheric → Next ×4) and clicked **Get recommendation**.

**DOM observer (16ms polling during transition):**

| Signal | Result |
|--------|--------|
| `sawLoading` | `true` — **Finding your film…** appeared |
| `sawNotesAfterLoading` | `false` — Notes step did **not** reappear after loading |
| `sawResults` | `true` — navigated to `/recommend/results/{sessionId}` |

**Artifacts:**

- `scenario-0-fixed.mp4` — screen recording of submit → results transition
- `scenario-0-fixed.png` — results page with **Your pick** (The Matrix)

**Compare to pre-fix:** `bug-repro-notes.md` reported `sawNotesAfterLoading: true`; post-fix observer confirms `false`.

## Scenario 1: Error path unchanged — PASS

Stopped API container (`docker compose stop api`), completed questionnaire to step 11, clicked **Get recommendation**.

| Check | Result |
|-------|--------|
| Loading screen clears | Yes |
| User on Notes step (step 11) | Yes |
| Error message visible | Yes — "Recommendation failed. Please try again." |
| **Get recommendation** clickable | Yes |

**Artifact:** `scenario-1-error.png`

API restored with `docker compose start api` before Scenario 2.

## Scenario 2: Double-submit protection — PASS

Rapid double-click on **Get recommendation** after completing questionnaire.

| Check | Result |
|-------|--------|
| Single navigation to results | Yes — one session ID observed |
| No duplicate sessions | Yes — `6c708fec-f021-4323-8c06-a41f4f2fe00e` |

**Artifact:** `scenario-2-single-session.png`

## Artifacts checklist

- [x] `scenario-0-fixed.mp4`
- [x] `scenario-0-fixed.png`
- [x] `scenario-1-error.png`
- [x] `scenario-2-single-session.png`
- [x] `demo-notes.md`
- [x] No secrets in images or logs

## Gate evidence

- Phase 6 gate: `bash scripts/verify-phase6-gates.sh` exit 0 at `dd777a5` (2026-07-03, babysit-pr)
