# Demo notes — issue #54

**Date:** 2026-06-28  
**Commit:** `45c66b4b04fe6ff36b76aebdfc2ceed986af77c1`  
**Branch:** `cursor/issue-54-smarter-recommendations-based-on-mood`  
**Stack:** Full Docker Compose (postgres, api, frontend, backup) with seeded Part 2 watchlist and live `OPENAI_API_KEY`.

## Environment note

Local `config.yaml` was missing the new `visual_tonal_fit` scoring weight from issue #54, which caused API startup failure (`Field required` Pydantic validation). Updated from `config.example.yaml` and restarted the API container before running scenarios. This is a local env fix only (`config.yaml` is gitignored).

## Scenario results

| Scenario | Result | Notes |
|----------|--------|-------|
| 1 — Home mood presets | **PASS** | Heading "What do you want to watch?"; Mood quick pick shows all 6 presets (Cozy night in, Adrenaline rush, Deep & arty, Scare me, Feel-good escape, Dark & unsettling); Customize instead link present; New recommendation and History cards below; no empty-watchlist import CTA. |
| 2 — Quick pick E2E | **PASS** | Clicked **Scare me**; loading copy "Finding your film…" / up to 30 seconds; redirected to `/recommend/results/d3b8c18c-7b8b-4871-af56-28e0a6e74a8` in ~20s; winner **The Matrix (1999)** with explanation; history shows session with quick-pick context. No `/recommend` wizard visit. |
| 3 — Full questionnaire | **PASS** | Start questionnaire → `/recommend`, Step 1 of 11, Genres step with full vocabulary grid. |
| 4 — Dev trace (optional) | **PASS** | `developer_mode: true`; history detail with `?dev=1` shows Scoring tab with **VISUAL_TONAL_FIT: 0.13** and per-candidate breakdown including `visual_tonal_fit`. |

## Artifacts

- `scenario-1-home-mood-presets.png`
- `scenario-2-loading.png`
- `scenario-2-results.png`
- `scenario-2-history.png`
- `scenario-3-full-questionnaire.png`
- `scenario-4-dev-trace-visual-tonal-fit.png`

Optional screen recording (`scenario-2-quick-pick.mp4`) not captured; static screenshots cover all pass criteria.

## Narrative

Issue #54 adds a **Mood quick pick** row on the home page so users can skip the 11-step wizard when they already know their mood. Six neo-noir preset chips map to existing questionnaire vocabulary and POST directly to the recommendation API. The **Scare me** preset completed in ~20 seconds and surfaced The Matrix with horror/atmosphere-aligned copy. The full questionnaire path is unchanged (Step 1 of 11 / Genres). Developer Mode confirms the new Stage 3 **`visual_tonal_fit`** signal (weight 0.13) in the scoring breakdown.
