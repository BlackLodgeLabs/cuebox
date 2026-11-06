# Implementation plan — Issue #146

**Tier:** application  
**Issue type:** feature (mobile UI polish for questionnaire + first-run surfaces; not a bug)  
**Integration base:** `feature/mobile-ui` (draft PR **#156** currently targets `main` — **retarget to `feature/mobile-ui`** before/during execute; do not leave base as `main`)

## Overview

Polish first-run and supporting surfaces so they stay clear and complete on phone (brief **D7**, criterion **E**) without ceremony-level art direction:

| Surface | Goal |
|---------|------|
| `/recommend` | Tighter density; ≥44px primary controls; one title stack; progress + sticky/footer Next |
| `/import` + `/import/[jobId]` | Phone-first choose-file; readable aggregate progress; wrap failure URIs |
| `/review` | Thumb-sized Accept / Reject / choose-different (≥44px) |
| `/settings/sync` | Compact file pickers under AppShell; readable RSS/CSV copy |
| Errors | Align recommend submit + import upload with clear retry / reach copy |

Frontend-only. Reuse existing import / review / sync / questionnaire APIs. Preserve ceremony handoff `armCeremonyGate` → `/recommend/results/{id}?stage=1` (#145). Do not restyle ceremony stages.

## Reproduction findings

N/A — greenfield density polish (feature). Baseline confirmed by static read on this branch (mobile-ui lineage):

| Surface | Observed gap |
|---------|----------------|
| `recommend/page.tsx` | Duplicate page `h1` + `CardTitle`/`CardDescription`; outer `space-y-6`; Back/Next default `h-10`; radios `h-4 w-4` in `gap-2` rows; text-only “Step N of 11”; submit error is inline `text-sm text-destructive` only; submitting UI custom (not `LoadingState`) |
| `multi-select-chips.tsx` | `px-3 py-2` chips; no `min-h-11` / `min-h-[44px]` |
| `import/page.tsx` | `FileUpload` drag-first copy; Start import `h-10`; inline error only |
| `import/[jobId]/page.tsx` | Aggregate progress OK; failure URIs `font-mono` without `break-all`; CTAs default `h-10`; already uses `LoadingState` / `ErrorState` |
| `file-upload.tsx` | Tall `p-8` dropzone; helper says “Drag and drop… or click to browse” but only **Choose file** opens picker; Choose file `h-10` |
| `review/page.tsx` | Accept / Reject / Choose different / Letterboxd submit all `size="sm"` → `h-8` (32px) |
| `settings/sync/page.tsx` | Three stacked full `FileUpload` dropzones for watched/ratings/diary; CSV re-sync also full chrome; RSS uses `LoadingState` / `ErrorState` |
| Home empty (`page.tsx`) | **Import watchlist** already `size="lg"` → `/import` (#142) — preserve |
| Shell | Review badge → `/review`, More → `/settings/sync`, 44px tabs already covered by #141 tests — do not drop |

Shared touch patterns to reuse: `min-h-11` / `min-h-[44px]` from `app-shell.tsx`, `recommendation-ceremony.tsx`, film detail / watchlist slices.

## Root cause

N/A (feature). Product constraint: slices a–e polished nightly flows; first-run / supporting surfaces still fight one-handed use (undersized actions, vertical waste, desktop-leaning upload chrome, mono overflow).

## Locked decisions (from SPEC)

1. **Progress:** Keep step counter; add compact visual cue (thin bar or “N / 11”) — not ceremony chrome.
2. **Chrome:** One title stack per step; tighter phone spacing (`space-y-6` → denser).
3. **Nav:** Sticky/footer Back + Next above tab safe-area; ≥44px (`size="lg"` + `min-h-11` preferred).
4. **Chips / radios:** ≥44px hit rows; wrap (no horizontal scroll).
5. **Vocabulary:** No question content / order / validation changes.
6. **Submit:** Keep `armCeremonyGate` + `?stage=1`; polish “Finding your film…” for phone.
7. **Import:** Phone-first Choose file; drag secondary on narrow viewports; aggregate job progress only; wrap failures; no new per-film enrichment ticker.
8. **Review / Sync:** Behavior unchanged; density + hit targets only.
9. **Reach copy:** Prefer shared phrase **“Could not reach the API. Make sure the backend is running.”** (already on Home) for network/unreachable framing on touched recommend submit + import upload failures when the client cannot reach the API; keep `getErrorMessage` for coded API errors; keep invalid-CSV toast.
10. **Motion:** Optional subtle step transition only; honor `prefers-reduced-motion`.

## Files to change

| Path | Change | Rationale |
|------|--------|-----------|
| `frontend/src/app/recommend/page.tsx` | Density, single title, progress bar, sticky ≥44px nav, radio-row hit targets, clearer submit error + retry, phone submit loading | Criterion **C** / D7 |
| `frontend/src/components/multi-select-chips.tsx` | Raise chip min height (~≥44px) | Questionnaire chips |
| `frontend/src/components/file-upload.tsx` | Add compact / phone-first mode: emphasize Choose file (`min-h-11`); de-emphasize drag copy on narrow; optional reduced padding | Import + sync density |
| `frontend/src/app/import/page.tsx` | Wire compact upload; ≥44px Start import; clearer upload error + retry | First-run upload |
| `frontend/src/app/import/[jobId]/page.tsx` | Failure URI `break-all` / `min-w-0`; ≥44px CTAs; tighten density; keep aggregate progress | Criterion enrichment readability |
| `frontend/src/app/review/page.tsx` | Replace `size="sm"` resolve actions with `size="lg"` + `min-h-11`; single-column phone stack polish | Thumb resolve |
| `frontend/src/app/settings/sync/page.tsx` | Compact `FileUpload` for CSV + three watched files; readable descriptions (no aggressive truncate); ≥44px primary buttons; clear tab safe-area | More → sync |
| `frontend/src/app/recommend/page.test.tsx` | Extend: density/progress/nav hit targets; submit error retry; preserve `?stage=1` | Questionnaire smoke |
| `frontend/src/components/multi-select-chips.test.tsx` | **New** (or extend if present) | Chip min-height class |
| `frontend/src/components/file-upload.test.tsx` | Compact mode + Choose file primacy assertions | Upload regression |
| `frontend/src/app/review/page.test.tsx` | Assert resolve actions ≥44px classes | Review AC |
| `frontend/src/app/settings/sync/page.test.tsx` | Compact upload / no truncated essential copy as needed | Sync regression |
| `frontend/src/app/import/` tests | Add/extend unit coverage for job failure wrap + CTA sizes if missing | Import AC |
| `frontend/e2e/questionnaire-mobile.spec.ts` (or similar) | **New** mocked mobile smoke: progress + Next visible, primary controls ≥44px, no horizontal overflow | Spec tests AC |
| `frontend/e2e/app-shell-mobile.spec.ts` | Keep Review badge → `/review` and More → sync (do not drop) | Shell regression |
| `frontend/e2e/first-time-journey.spec.ts` / `design-smoke.spec.ts` / `pr-review-regression.spec.ts` | Soft update if selectors/copy change | Journey still green |
| `documents/DESIGN.md` | Optional one-line first-run density note only if a durable rule is needed | Docs |

**Explicitly unchanged:**

| Path | Why |
|------|-----|
| Ceremony / results / history stages | Slice e / #145 |
| `app-shell.tsx` tabs / Review badge / More | Slice a / #141 |
| Home hub composition beyond preserving Import CTA | Slice b / #142 |
| API / Alembic / `config.yaml` / questionnaire vocabulary / scoring | Out of scope |
| PWA, Insights/Ask, Developer Mode redesign | Out of scope |

## Implementation steps

### Step 1 — Shared upload compact mode

- Add optional prop e.g. `variant="default" | "compact"` (or `compact?: boolean`) on `FileUpload`.
- Compact: smaller padding (`p-4` / `gap-2`), smaller icon, phone-first copy (“Tap to choose a CSV” / Choose file primary), `Choose file` with `size="lg"` + `min-h-11`.
- Keep drag-and-drop working; de-emphasize drag wording on narrow via CSS (`md:` restore longer drag hint) or compact copy only.
- Update `file-upload.test.tsx`.

### Step 2 — Questionnaire density + controls

- Collapse duplicate headers: keep one title + description (page stack **or** card — prefer page stack; card content only for controls).
- Add thin progress bar (`value={(stepIndex+1)/STEPS.length*100}`) beside/under “Step N of 11”.
- Tighten wrappers (`space-y-4` / reduce CardHeader padding via class overrides).
- Sticky/footer action row: `sticky bottom-[calc(theme+tab safe-area)]` or equivalent above AppShell tab padding; Back + Next `size="lg" className="min-h-11"` (Next may be `flex-1`).
- `RadioOptions`: make each row `min-h-11` flex with larger clickable label area (keep RadioGroup API).
- Chips: `min-h-11` on chip buttons in `multi-select-chips.tsx`.
- Optional: `motion-safe:` short opacity/translate on step change; `motion-reduce:transition-none`.
- Submit error: prominent error block + **Try again** / re-enable Next (already re-enabled on failure — make retry obvious). For network/unreachable, use Home’s reach phrase when appropriate.
- Preserve `armCeremonyGate` + `router.replace(...?stage=1)`.

### Step 3 — Import + job status

- `/import`: compact `FileUpload`; Start import `w-full min-h-11`; clearer error + retry.
- `/import/[jobId]`: keep `LoadingState` / `ErrorState`; wrap failure URIs (`break-all`); failure toggle ≥44px; complete CTAs `min-h-11`; do **not** invent per-film enrichment feed.

### Step 4 — Review resolve actions

- Match + Letterboxd actions: drop `size="sm"`; use `size="lg"` + `min-h-11`; stack or wrap with comfortable gap on phone (`flex-col sm:flex-row` OK).
- Keep empty “All caught up”; no API changes.

### Step 5 — Settings sync density

- Pass compact `FileUpload` to CSV re-sync and three watched-history uploads.
- Preserve full RSS / CSV / watched copy (no aggressive `truncate`).
- Primary buttons `min-h-11`; ensure page clears bottom tabs (existing shell padding — verify no overlap).

### Step 6 — Tests + soft check

- Unit tests mapped below; new questionnaire mobile Playwright smoke at 390×844.
- Confirm `app-shell` unit + e2e still cover Review badge and More → sync.
- Soft-fix journey/design-smoke if labels change.

## Tests required

| Assertion | Type | Acceptance criterion |
|-----------|------|----------------------|
| Questionnaire: single title stack (no duplicate CardTitle of same step) | unit | Density / clarity |
| Progress cue present (“Step N of 11” + bar or equivalent) | unit | Progress + next AC |
| Back / Next / Get recommendation have `min-h-11` (or ≥44px class) | unit | ≥44px controls |
| MultiSelectChips options have `min-h-11` / ≥44px | unit | Chips AC |
| Radio option rows have ≥44px min-height class | unit | Radios AC |
| Submit failure shows error + retry affordance; loading clears | unit (extend existing) | D2 / F |
| Ceremony handoff still `?stage=1` after arm | unit (existing) | No ceremony regression |
| FileUpload compact: Choose file primary + `min-h-11`; invalid CSV toast unchanged | unit | Import upload |
| Import job failure URI renders with wrap class (`break-all`) | unit | Failure wrap |
| Import complete CTAs `min-h-11` | unit | Post-complete CTAs |
| Review Accept/Reject/Choose different `min-h-11` (not `h-8`/`sm`) | unit | Match review AC |
| Sync page still shows CSV / watched / RSS sections + compact uploads | unit | Sync AC |
| App shell: Review badge → `/review`; More → `/settings/sync`; 44px tabs | unit + e2e (existing — keep) | Shell unchanged |
| Mocked Playwright questionnaire @ 390×844: progress + Next visible; primary control bounding boxes ≥44; no horizontal overflow (`scrollWidth <= clientWidth`) | e2e mocked | Spec tests AC |
| `npx tsc --noEmit` + `npm run test:unit` | CI/local | Types + units green |
| Soft: first-time journey / design-smoke / pr-review-regression still pass | e2e as touched | Regression |

## Gate script

Frontend presentation change (no API). Execute should run:

```bash
source scripts/cursor-workflow-config.sh
cd frontend && npm run test:unit && npx tsc --noEmit
bash scripts/verify-phase6-gates.sh
```

Optional stronger pre-merge: `bash $APP_DEFAULT_GATE` (`scripts/verify-phase8-gates.sh`).

With mocked Playwright:

```bash
cd frontend && npx playwright test e2e/questionnaire-mobile.spec.ts e2e/app-shell-mobile.spec.ts
# soft as needed:
cd frontend && npx playwright test e2e/design-smoke.spec.ts e2e/pr-review-regression.spec.ts
```

**Host build gotcha:** stop compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Documentation updates

| File | Update |
|------|--------|
| `documents/DESIGN.md` | Optional one line on first-run / questionnaire density (sticky nav, ≥44px) only if execute adds a durable rule |
| `workflow/issues/issue-146/PLAN.md` / `demo/` | This plan + demo-spec |
| README / API docs | None |

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| PR #156 still based on `main` | Retarget to `feature/mobile-ui` immediately; SPEC requires it |
| Sticky footer overlaps AppShell tabs | Use bottom offset matching shell safe-area / `pb-*` already on main; visual check @ 390×844 |
| Compact FileUpload breaks sync controlled `selectedFile` | Keep existing controlled API; only add visual variant |
| Radio/chip hit targets break layout on desktop | `min-h-11` is fine on md+; wrap chips; no horizontal scroll |
| Ceremony handoff accidentally changed | Keep existing arm + `?stage=1` test |
| Reach-copy inconsistency | Lock Home phrase for network framing on touched pages |
| Journey E2E selector drift | Soft-update labels; keep Import / Review / Recommend flow |
| Over-polishing into ceremony motion | No ceremony-level motion; optional short step fade only |

**Rollback:** Revert frontend density commits on listed files; restore prior `size="sm"` / `FileUpload` chrome.

## Definition of done

- [ ] Questionnaire one-handed: denser layout, ≥44px Back/Next/chips/radio rows, progress + next clear, no horizontal overflow
- [ ] Import phone-first upload; job aggregates readable; failure URIs wrap; CTAs ≥44px
- [ ] Review resolve actions ≥44px; Review badge path unchanged
- [ ] Settings sync operable under shell with compact pickers; copy readable
- [ ] Recommend submit + import upload failures have clear retry / reach framing
- [ ] Ceremony entry still `?stage=1`; no ceremony restyle
- [ ] Neo-Noir preserved; no FAB; no new tokens; motion respects `prefers-reduced-motion`
- [ ] Unit + questionnaire mobile Playwright mapped above green; Phase 6 gate exit 0
- [ ] App-shell Review / More tests still pass
- [ ] Demo artifacts per `demo/demo-spec.md`
- [ ] Draft PR **#156** base is **`feature/mobile-ui`**
- [ ] `workflow.state.json` → `execute-ready` after execute (planning ends at `plan-ready`)

## PR seed

**Tier:** application  
**What / why:** Polish questionnaire density and first-run surfaces (import, review, sync) for one-handed phone use without ceremony-level art direction (mobile UI slice f / D7; criteria C + E + F).  
**Key changes:** Tighter `/recommend` chrome + ≥44px controls + progress; compact phone-first `FileUpload`; readable import job failures; thumb-sized review actions; denser sync under AppShell; shared reach/retry framing on touched errors.  
**Gate:** Phase 6 (`verify-phase6-gates.sh`) + `frontend` unit tests + questionnaire mobile Playwright smoke; optional Phase 8 full regression.  
**How to test:** Phone viewport: complete questionnaire steps (progress + Next sticky, chips/radios ≥44px) → ceremony `?stage=1`; empty Home → Import → job status wrap; Review badge resolve actions; More → sync compact uploads.  
**Base branch:** `feature/mobile-ui` (PR #156 — retarget if needed).
