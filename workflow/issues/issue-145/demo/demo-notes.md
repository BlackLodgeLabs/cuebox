# Demo notes — issue #145

- **Date:** 2026-07-27T18:08:00Z
- **Commit:** `docs(workflow): demo evidence for issue #145` on `cursor/issue-145-pr-154-demo-agent-e57f` tip (see `git log -1`)
- **Branch:** `cursor/issue-145-pr-154-demo-agent-e57f` (base `cursor/issue-145-recommendation-ceremony`)
- **PR:** #154 (base `feature/mobile-ui`)
- **Tier:** application
- **Viewport (phone):** 390×844 (iPhone 13 metrics on Chromium)
- **Viewport (desktop / scenario 7):** 1280×800 with `prefers-reduced-motion: reduce`
- **Fixture:** Playwright route mock — winner + **four** runners-up + explanations + `profile_summary` (live Part 2 Matrix session `c618464a-c80a-4bbf-8dee-db0ed68f3abb` has **0** runners-up, so stage-2 swipe captures use the mock per demo-spec)

## Preconditions

- `docker compose ps`: postgres, api, frontend, backup **Up**
- Health API + frontend proxy: `"status":"ok"`, `"database":"ok"`; frontend HTTP 200
- Part 2 seed: volume previously had 2 films; ran `python3 scripts/seed-dev-db.py` → **12** films, ≥10 ready; history list includes Matrix
- #141 shell present: Cuebox header search + bottom tabs (Home / Watchlist / Recommend / More)

## Scenario results

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Stage 1 — singular winner (phone) | **PASS** | [scenario-1-stage1-winner.png](scenario-1-stage1-winner.png) |
| 2 | Stage 2 — swipeable runners-up (phone) | **PASS** | [scenario-2-stage2-runners.png](scenario-2-stage2-runners.png) |
| 3 | Stage 3 — durable session record (phone) | **PASS** | [scenario-3-stage3-record.png](scenario-3-stage3-record.png) |
| 4 | History lands on stage 3 | **PASS** | [scenario-4-history-stage3.png](scenario-4-history-stage3.png) |
| 5 | Replay 1 → 2 → 3 | **PASS** | [scenario-5-replay-stage1.png](scenario-5-replay-stage1.png) |
| 6 | Cold load / refresh prefers stage 3 | **PASS** | [scenario-6-cold-load-stage3.png](scenario-6-cold-load-stage3.png) |
| 7 | Reduced motion + desktop metaphor | **PASS** | [scenario-7-reduced-motion-or-desktop.png](scenario-7-reduced-motion-or-desktop.png) |

### Scenario 1 — Stage 1 winner

- Replay-armed entry → `?stage=1`; progress **1 / 3**
- Dominant poster plane (NO POSTER placeholder for mock), **TOP PICK**, short **Key factors** + **Why it matches** only
- No watch-provider icons; no answer-summary sheet; no skip control
- **Next** control visible, measured height ≥44px (`min-h-11`)

### Scenario 2 — Stage 2 runners-up

- **Next** from stage 1 → `?stage=2`; progress **2 / 3**
- Horizontal snap carousel with four runners; focused **Ceremony Runner 2** after tapping second poster
- Focus panel shows short reasons only; still no providers / questionnaire summary; **Next** visible

### Scenario 3 — Stage 3 record

- **Next** → `?stage=3` (replace); full-page capture shows winner + four runners-up with full reasons/metadata
- Watch-provider icons asserted present on stage 3 (`data-testid=watch-provider-icons`); **View answer summary** present (`profile_summary` in mock)
- Exits: **Done**, **Replay ceremony**, **Remove from history** (history mode), plus New recommendation / View history links
- Film deep-link chrome present (“View … in watchlist”)

### Scenario 4 — History → stage 3

- Cold open `/history/{mockSessionId}` lands at **3 / 3** record chrome (not stage-1 ritual)
- **Replay ceremony** control present (asserted; same chrome as scenario 3 exits)

### Scenario 5 — Replay

- From history stage 3, **Replay ceremony** → stage 1 (`?stage=1`); capture shows winner ritual
- Automation continued Next → stage 2 → Next → stage 3; further 1→2 requires Replay again

### Scenario 6 — Cold load coerce

- Unarmed `/recommend/results/{id}?stage=1` rewrites to `?stage=3`
- Capture shows fresh-mode **Your pick** chrome at stage **3 / 3** (durable record, not ceremony start)

### Scenario 7 — Reduced motion + desktop

- Desktop 1280×800 with `emulateMedia({ reducedMotion: 'reduce' })`
- `data-reduced-motion="true"` on ceremony root; advance 1→2→3 then Replay to stage 2
- Capture: stage **2 / 3** wider carousel (four posters) — ceremony metaphor retained, not a flat all-cards dashboard

## Narrative

Recommendation results are no longer a single flat dump: fresh/replay walks a poster-led winner (short reasons) → swipe runners-up → full session record with providers, answer summary, and exits. History opens at the durable stage-3 record; cold/unarmed `?stage=1` coerces back to stage 3. Live seed history lacks runners-up, so demo evidence uses the five-film mocked payload required by the demo spec.

## Notes for babysit / create-pr

- Capture helper was a local Playwright script against the running Compose frontend (`PLAYWRIGHT_E2E_STACK=1`); not committed
- Mock posters are intentionally null (NO POSTER) — layout/pass criteria do not require live TMDB art
- PR #154 base is already `feature/mobile-ui` (confirmed)

## Babysit notes

- 2026-07-27: PR #154 ready for review after Frontend CI success on `fe4992a`; mergeable CLEAN; no Bugbot review threads / must-fix items.
- Cursor Bugbot check suite remained `queued` (no check run) across all PR #154 commits — same pattern as #143/#151; not treated as a required blocking check (mergeStateStatus CLEAN).
- Vercel suite also stayed queued (not required for this local-first app).
- Loops at complete: bugbot=0/3, ci_autofix=0/2, total_runs=6/10.
- No CI autofix or Bugbot fix cycles needed.
