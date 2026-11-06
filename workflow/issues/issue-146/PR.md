## Related Issue

Closes #146

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/146)

## Description

**What does this PR do?**

Polishes questionnaire density and first-run surfaces (import, review, sync) for one-handed phone use (mobile UI slice **f** / brief **D7**; success criteria **C** + **E** + **F**). No ceremony-level art direction — this slice keeps `#145` handoff (`armCeremonyGate` → `/recommend/results/{id}?stage=1`) and does not restyle ceremony stages.

| Surface | Phone goal |
|---------|------------|
| `/recommend` | Single title stack; sticky Back/Next ≥44px; progress (Step N of 11 + bar); chips/radio rows ≥44px; no horizontal overflow |
| `/import` + `/import/[jobId]` | Phone-first Choose file; aggregate job progress; failure URIs wrap; CTAs ≥44px |
| `/review` | Accept / Reject / Choose different match ≥44px; Review badge path unchanged |
| `/settings/sync` | Compact pickers under AppShell; CSV / watched / RSS operable and readable |

**Why is this the best approach?**

Density and hit-target fixes belong on the existing first-run routes rather than a new shell or ceremony motion. Reusing `FileUpload` with a `compact` variant keeps sync’s controlled `selectedFile` API intact while making Choose file primary on narrow viewports. Shared reach/retry framing on recommend submit and import upload failures matches Home network copy without inventing new error taxonomy. Frontend-only; draft PR **#156** stays based on `feature/mobile-ui` (do not retarget to `main`).

## Changes Proposed

* Tightened `/recommend` chrome: progress (`Step N of 11` + thin bar), sticky ≥44px Back/Next above the tab bar, denser step body, radio rows and chips at `min-h-11`
* Added `FileUpload` `variant="compact"` (phone-first “Tap to choose a CSV” / Choose file primary; drag copy remains on `md+`)
* Import upload + job status: denser card padding, `break-all` failure URIs, ≥44px Start import / Review matches / Get recommendation CTAs, reach + Try again on upload failure
* Review resolve actions stacked full-width on phone at ≥44px (`Accept` / `Reject` / `Choose different match`)
* Sync settings: compact pickers + denser cards/CTAs for CSV re-sync, watched history, and RSS
* Shared API reach message on recommend submit and import upload errors
* Tests: unit coverage for recommend / import / review / sync / `FileUpload` / chips; new `e2e/questionnaire-mobile.spec.ts` (exact Next button name to avoid Dev Tools clash)
* Workflow artifacts: `SPEC.md`, `PLAN.md`, `demo/demo-spec.md`, `demo/demo-notes.md`, and eight scenario screenshots under `workflow/issues/issue-146/demo/`

**Explicitly unchanged:** API / Alembic / `config.yaml` / ranking; AppShell (#141), Home (#142), watchlist grid (#143), film detail (#144), ceremony stages (#145); no FAB; no new design tokens.

## Scenario Results

Application-tier UI demo on Compose stack (phone 390×844, Playwright `devices['iPhone 13']`). Scenarios 2/3/6 use route mocks where noted in `demo-notes.md`; 1/4/5 use live stack routes.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Questionnaire density + progress + Next (phone) | **PASS** | screenshots below |
| 2 | Import upload + job progress (phone) | **PASS** | screenshots below |
| 3 | Match review resolve actions (phone) | **PASS** | screenshot below |
| 4 | More → Sync/settings density (phone) | **PASS** | screenshot below |
| 5 | Reduced-motion step change | **PASS** | screenshot below |
| 6 | Ceremony handoff unchanged (smoke) | **PASS** | screenshot below |

![Scenario 1 — Questionnaire phone](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4834f7cf9323c36d1aea08de4a0018cc9c2faa40/workflow/issues/issue-146/demo/scenario-1-questionnaire-phone.png)

![Scenario 1 — Questionnaire chips](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4834f7cf9323c36d1aea08de4a0018cc9c2faa40/workflow/issues/issue-146/demo/scenario-1-questionnaire-chips.png)

![Scenario 2 — Import upload](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4834f7cf9323c36d1aea08de4a0018cc9c2faa40/workflow/issues/issue-146/demo/scenario-2-import-upload.png)

![Scenario 2 — Import job status](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4834f7cf9323c36d1aea08de4a0018cc9c2faa40/workflow/issues/issue-146/demo/scenario-2-import-job-status.png)

![Scenario 3 — Review actions](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4834f7cf9323c36d1aea08de4a0018cc9c2faa40/workflow/issues/issue-146/demo/scenario-3-review-actions.png)

![Scenario 4 — Settings sync](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4834f7cf9323c36d1aea08de4a0018cc9c2faa40/workflow/issues/issue-146/demo/scenario-4-settings-sync.png)

![Scenario 5 — Reduced motion](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4834f7cf9323c36d1aea08de4a0018cc9c2faa40/workflow/issues/issue-146/demo/scenario-5-reduced-motion.png)

![Scenario 6 — Ceremony handoff](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/4834f7cf9323c36d1aea08de4a0018cc9c2faa40/workflow/issues/issue-146/demo/scenario-6-ceremony-handoff.png)

## How to Test

1. Checkout the PR branch:
   ```bash
   git checkout cursor/issue-146-questionnaire-first-run
   ```
2. Start the stack:
   ```bash
   docker compose up
   ```
   Confirm health: `curl -sf http://localhost:3000/api/v1/health` → `"status":"ok"`, `"database":"ok"`. Seed if needed: `python3 scripts/seed-dev-db.py`.
3. Questionnaire (phone viewport ~390×844): open `/recommend`
   - Single step title; progress **Step N of 11** + bar; sticky **Back** / **Next** ≥44px
   - Chips and radio rows ≥44px; no horizontal overflow
   - Complete steps → lands on `/recommend/results/{id}?stage=1` (ceremony stage 1 chrome unchanged)
4. Import: open `/import` → phone-first **Tap to choose a CSV** / **Choose file** + **Start import** ≥44px → job page shows aggregates; long failure URIs wrap; CTAs ≥44px
5. Review: header **Review** badge → `/review` → Accept / Reject / Choose different match each ≥44px
6. Sync: **More** → `/settings/sync` → compact CSV / watched / RSS pickers operable; copy readable
7. Reduced motion (optional): OS/browser `prefers-reduced-motion: reduce` → advance a questionnaire step without ceremony-level motion
8. Unit + questionnaire mobile Playwright (optional local):
   ```bash
   cd frontend && npm run test:unit -- --run \
     src/app/recommend/page.test.tsx \
     src/app/import/page.test.tsx \
     src/app/import/\[jobId\]/page.test.tsx \
     src/app/review/page.test.tsx \
     src/app/settings/sync/page.test.tsx \
     src/components/file-upload.test.tsx \
     src/components/multi-select-chips.test.tsx
   cd frontend && npx playwright test e2e/questionnaire-mobile.spec.ts e2e/app-shell-mobile.spec.ts
   ```
9. Gate (PLAN / execute):
   ```bash
   bash scripts/verify-phase6-gates.sh
   ```
   Host build gotcha: stop Compose frontend and `sudo rm -rf frontend/.next` before host `npm run build` (AGENTS.md).

## Known Issues / Notes for Reviewer

* Capture helper was a local Playwright script against Compose (`PLAYWRIGHT_E2E_STACK=1`); not committed.
* Scenario 2a empty-home Import CTA skipped (would require emptying Part 2 volume); home already links Import watchlist → `/import` per #142 coverage.
* Scenario 2/3 used mocked job status / pending review list where live seeded data lacked failures or pending matches; Scenario 6 mocked recommendation create for ceremony handoff smoke.
* Phase 8 full regression (`verify-phase8-gates.sh`) is optional per PLAN; execute marked Phase 6 + frontend unit/tsc + questionnaire mobile Playwright green at execute-ready (`50ada92`).
* No migrations or config changes; restart frontend only if the Compose bind mount has not picked up density changes.
* **Base branch is `feature/mobile-ui`**, not `main` — do not retarget PR #156.

## Gate evidence

- [x] Phase 6 gate + frontend unit/tsc + questionnaire mobile Playwright smoke green at execute-ready (`50ada92`) — per execute commit message
- [x] Demo: six scenarios PASS (phone 390×844) — `demo/demo-notes.md`
- [x] `Workflow regression: scripts/verify-workflow-paths.sh exit 0` at `13bbc64` (create-pr-in-progress)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated where applicable
- [ ] No secrets or credentials committed
- [ ] Phone questionnaire / import / review / sync verified against demo screenshots
