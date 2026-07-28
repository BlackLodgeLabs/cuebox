# Issue #146: Mobile UI — questionnaire density + first-run surfaces

**GitHub:** https://github.com/BlackLodgeLabs/cuebox/issues/146

**Integration base:** `feature/mobile-ui` (not `main`). Slices (a)–(e) / #141–#145 are merged there (app shell, Home hub, watchlist grid, film detail, recommendation ceremony). This branch is cut from `feature/mobile-ui` so questionnaire / import / review / settings content sits inside the new `AppShell`. Draft PR **must** target `feature/mobile-ui` (retarget if the handoff Action defaults to `main`).

## Summary

Polish first-run and supporting surfaces so they stay **clear and complete** (brief **D7**, success criterion **E**) without ceremony-level art direction: phone-usable **Recommend questionnaire** density (criterion **C**), understandable **Import** + job progress, **Match review** resolve actions reachable via the Review badge, and **More → Sync/settings** layout that works under the shell. Frontend-only; reuse existing import / review / sync / questionnaire APIs.

This is **slice (f)** of the mobile UI pass ([product brief](../../../documents/ui-mobile-product-brief.md)).

## Problem

Nightly flows (Home, ceremony, watchlist, film detail) now have hero polish on `feature/mobile-ui`. First-run and supporting surfaces still fight one-handed phone use:

| Surface | Today (gaps) |
|---------|----------------|
| `/recommend` | 11-step questionnaire with duplicated page + card headers; `space-y-6` vertical waste; Back/Next default `h-10` (**40px**); radio rows and genre chips below ~44px; text-only “Step N of 11”; no sticky progress/next chrome |
| `/import` + `/import/[jobId]` | Home empty → Import CTA is clear; upload dropzone is desktop-leaning; job page shows **aggregate** progress only; failure URIs in `font-mono` risk horizontal overflow |
| `/review` | Reachable via #141 Review badge; Accept / Reject / “Choose different match” use `size="sm"` (**32px**) — undersized for thumb |
| `/settings/sync` | More → sync works; three tall `FileUpload` cards + long descriptions make a wall of chrome under the tab bar; copy is not truncated today but density/scroll hurts clarity |
| Errors | Mixed: some routes use `ErrorState` + retry; recommend submit and import upload use inline errors without shared “can’t reach” framing (D2) |

Ceremony handoff after questionnaire already navigates to `/recommend/results/{id}?stage=1` (#145) — this slice must not change ceremony stages.

## Acceptance criteria

- [ ] **Recommend questionnaire** usable one-handed on phone: tighter vertical density; primary controls (Next/Back, chips, radio rows) hit targets ~**≥44×44px**; no horizontal overflow; clear progress + next affordance
- [ ] **Import** flow: empty Home → Import CTA remains obvious; upload + status polling understandable on phone (dropzone/copy sized for touch, not desktop-only “drag and drop” primacy)
- [ ] **Enrichment / job progress** readable on phone: running/complete/failed states and counts are plain-language; failure lists wrap (no cryptic mono overflow); do **not** invent a new per-film enrichment feed unless an existing job/films payload already exposes it for cheap UI surfacing
- [ ] **Match review** (`/review`): reachable from Review badge (#141 — already wired); list + Accept / Reject / choose-different actions clear; primary actions ≥44px
- [ ] **More → Sync/settings** (`/settings/sync`): layout works under AppShell (tab safe-area); RSS / CSV / watched-import sections operable; long copy remains readable (no unreadably truncated labels)
- [ ] Loading / retry / reachability states remain clear on these surfaces (brief **D2** / criterion **F** readability): prefer shared `LoadingState` / `ErrorState` patterns where a page already uses them; align recommend submit + import upload failures so retry is obvious when the API is unreachable
- [ ] Atmosphere preserved (Neo-Noir / Used Future) but **no ceremony-level motion** required; any motion added honors `prefers-reduced-motion` (instant or crossfade fallback)
- [ ] Neo-Noir preserved; no FAB; no new brand / token palette (brief **D1**)
- [ ] **Tests:** questionnaire mobile smoke (density / ≥44px primary controls / no overflow / progress+next); import / review / settings regression coverage as touched; shell Review badge → `/review` and More → sync remain covered (existing `app-shell` tests — do not drop)

## Composition / density rules (locked)

### Questionnaire (`/recommend`)

| Rule | Decision |
|------|----------|
| Progress | Keep step counter; add a compact visual progress cue (e.g. thin bar or “N / 11”) — not ceremony-stage chrome |
| Chrome | Collapse duplicate page `h1` + card header into **one** title stack per step; reduce vertical rhythm (`space-y-6` → tighter phone spacing) |
| Navigation | Back + Next (final: Get recommendation) always visible without hunting — prefer sticky/footer action row above the tab bar safe-area when it improves one-handed reach; hit targets ≥44px |
| Chips / radios | Raise chip and radio-row hit areas to ~≥44px height; keep wrap layout (no horizontal scroll) |
| Vocabulary | Do **not** change question content, order, or validation rules — density/layout/copy framing only |
| Submit | Keep existing submit → results `?stage=1` handoff; polish loading (“Finding your film…”) for phone clarity |
| Motion | Optional subtle step transition only; honor `prefers-reduced-motion` |

### Import + job status

| Rule | Decision |
|------|----------|
| Empty Home CTA | Preserve primary **Import watchlist** path from #142 hub empty state — polish only if copy/layout regresses clarity |
| Upload | Phone-first: emphasize **Choose file** / tap-to-select; drag-and-drop secondary or de-emphasized on narrow viewports |
| Job page | Keep aggregate progress (processed / failed / duplicates / total) as the primary signal; plain-language titles already used (“Enriching films…”) — tighten density and wrapping |
| Failures | `failure_summary` / Letterboxd URIs must wrap (`break-all` / similar); expandable details remain |
| Per-film enrichment | **Do not** build a live per-film enrichment ticker unless execute discovers an existing client-ready list on the job status payload. Criterion E is satisfied by clear job aggregates + next CTAs (Review matches / Get recommendation) |
| Post-complete CTAs | Keep Review matches (when pending) and Get recommendation; ≥44px |

### Match review (`/review`)

| Rule | Decision |
|------|----------|
| Entry | Rely on #141 Review badge; also keep import-complete “Review matches” link |
| Actions | Accept / Reject / Choose different match (and Letterboxd submit) ≥44px; single-column phone stack; avoid cramped `sm` button clusters |
| Cards | Poster + title/proposed/confidence remain; polish spacing for thumb; empty “All caught up” stays |
| Behavior | No API or match-resolution rule changes |

### More → Sync (`/settings/sync`)

| Rule | Decision |
|------|----------|
| Sections | Keep CSV re-sync, watched-history import, RSS username/status — same capabilities |
| Density | Reduce stacked full-height dropzone chrome where possible (compact file pickers on phone); preserve readable descriptions (no aggressive `truncate` that hides essential RSS/CSV copy) |
| Shell | Content must clear bottom tabs + safe-area; More tab remains active on `/settings/*` |

### Errors / loading (D2)

| Surface | Locked approach |
|---------|-----------------|
| Import status, review, sync RSS | Keep `LoadingState` / `ErrorState` + retry |
| Recommend submit failure | Surface clear error + retry affordance (not only a buried inline line) |
| Import upload failure | Clear error; keep toast for invalid file type |
| Reach copy | Prefer consistent user-facing wording (“Could not reach Cuebox” or existing “Could not reach the API…”) — pick one shared phrase in plan/execute and apply on touched pages |

## Scope

### In scope

| Area | Change |
|------|--------|
| `frontend/src/app/recommend/page.tsx` (+ small extracted helpers if needed) | Density, progress, ≥44px controls, sticky/footer Next optional, error clarity |
| `frontend/src/components/multi-select-chips.tsx` | Chip hit-target / density for questionnaire |
| `frontend/src/app/import/page.tsx`, `import/[jobId]/page.tsx`, `file-upload.tsx` | Phone-first upload + readable job progress / failure wrapping |
| `frontend/src/app/review/page.tsx` | Mobile list/action polish; ≥44px resolve actions |
| `frontend/src/app/settings/sync/page.tsx` | Density under shell; readable RSS/CSV copy |
| Shared loading/error | Align touched pages with `LoadingState` / `ErrorState` patterns |
| Tests | Questionnaire mobile smoke; update unit/e2e regressions for import/review/settings as layout copy changes |
| Docs | Optional one-line note in `DESIGN.md` only if a density rule needs documenting |

### Out of scope

- Recommendation ceremony 1→2→3 / history replay (slice e — #145) — do not restyle stages here
- Watchlist grid / film detail / Home hub composition (slices b–d — #142–#144) beyond preserving empty→Import CTA
- App shell tabs / Review badge / More routing (slice a — #141) — already on `feature/mobile-ui`; rely on them
- New sync features, RSS/CSV API changes, enrichment pipeline behavior, Alembic, `config.yaml`
- Questionnaire vocabulary / scoring / recommendation engine changes
- PWA, Insights/Ask, Developer Mode redesign
- Rebrand or new token palette (D1)
- Ceremony-level motion or hero art direction on first-run surfaces

## User flows / API changes

### Flow A — New user first-run

1. Empty Home → **Import watchlist** (obvious primary CTA).
2. `/import` → choose CSV → start → `/import/{jobId}` polling shows understandable progress.
3. On complete → **Review matches** (if pending) and/or **Get recommendation**.
4. User is ready to recommend when enrichment/import is complete (existing readiness rules unchanged).

### Flow B — Ambiguous matches on phone

1. Review badge visible when pending count > 0 (#141).
2. Tap badge → `/review`.
3. Resolve each item with Accept / Reject / Choose different match (thumb-sized); empty state when done.

### Flow C — Returning user questionnaire → ceremony

1. Recommend tab → `/recommend`.
2. Complete steps one-handed (progress + Next clear; ≥44px controls).
3. Submit → existing handoff to ceremony stage 1 (`/recommend/results/{sessionId}?stage=1` from #145).

### Flow D — More → sync/settings

1. More tab → `/settings/sync`.
2. CSV re-sync, watched import, and RSS configure/status remain fully operable; copy readable; no content hidden behind tabs.

### API changes

**None.** Reuse:

- Questionnaire / recommendation create endpoints already used by `use-recommendations`
- `POST /import`, `GET /import/{jobId}` (status polling)
- Review accept/reject / Letterboxd resolve / watch-review endpoints
- Sync CSV / RSS endpoints on settings
- `GET /films/reviews/pending-count` (shell badge — unchanged)

## Data and integration notes

- Frontend-only UI density / clarity on existing APIs.
- Must remain coherent with #141 shell (Review badge, More → settings, tab safe-area) and #142 empty Home → Import.
- Ceremony entry after questionnaire must stay on #145 URL/stage contract.
- No DB, Alembic, provider, or `config.yaml` changes.

## Open questions

_(none — issue + brief + merged slices a–e on `feature/mobile-ui` + sibling specs are sufficient)_

## Links

- GitHub issue: https://github.com/BlackLodgeLabs/cuebox/issues/146
- Product brief: [documents/ui-mobile-product-brief.md](../../../documents/ui-mobile-product-brief.md) (D1, D7–D8, D10 **E**/**C**/**F**; build order §6 slice 6)
- Design system: [documents/DESIGN.md](../../../documents/DESIGN.md)
- Depends on: #141 (shell + Review badge + More); prefer after #142 (empty→import) — **both merged** to `feature/mobile-ui`
- Sibling slices on `feature/mobile-ui`: #142 Home, #143 watchlist, #144 film detail, #145 ceremony
- Parent mobile UI initiative: PR #134
