# Cuebox product roadmap (pointer)

This document is a **direction pointer** for humans and agents. It is not a commitment, schedule, or implementation plan. Concrete feature shapes live in GitHub issues and in per-issue `workflow/issues/issue-NNN/SPEC.md` / `PLAN.md` once work is triaged.

**How to use this file**

- Read it when scoping adjacent work so new features fit the product direction.
- Prefer linked GitHub issues as the source of truth for *what* to build.
- Do not invent timelines, phase numbers, or scope beyond what issues and specs say.
- When a theme below is picked up or shipped, update this file lightly (status + links) rather than turning it into a long design doc.
- Shipped themes stay in [Shipped themes](#shipped-themes) with the PR that landed them — do not re-open those product rules without a new issue.

Related docs: [PRD.md](PRD.md) (current product requirements), [Architecture.md](Architecture.md), [database-design.md](database-design.md), [api-contracts.md](api-contracts.md), [ui-mobile-product-brief.md](ui-mobile-product-brief.md) (phone-first UI pass).

---

## Upcoming themes

### Theme: Mobile UI (phone-first Neo-Noir)

**Intent:** Cuebox is used ~90% of the time on a phone. Tighten Neo-Noir for mobile — navigation, hierarchy, density, and phone layouts — without rebranding. Nightly recommend + find/add/mark film are the hero jobs; first-run (import, enrichment, match review, settings) must stay clear and complete.

### Golden source

**[documents/ui-mobile-product-brief.md](ui-mobile-product-brief.md)** (landed in [PR #134](https://github.com/BlackLodgeLabs/cuebox/pull/134)) locks design decisions D1–D10. Treat the brief as hard constraints. Implementation is sliced across open issues:

| Slice | Issue | Focus |
|-------|-------|--------|
| (a) App shell | [#141](https://github.com/BlackLodgeLabs/cuebox/issues/141) | Bottom tabs (Home · Watchlist · Recommend · More); Review as header badge; keep header search icon from #140 |
| (b) Home hub | [#142](https://github.com/BlackLodgeLabs/cuebox/issues/142) | Compose Home around inline picker + Create recommendation + History (≤ 2 taps to recommend) |
| (c) Watchlist grid | [#143](https://github.com/BlackLodgeLabs/cuebox/issues/143) | Poster-first grid, ⋯ actions, filter sheet; keep Watchlist / Watched / Archived tabs |
| (d) Film detail | [#144](https://github.com/BlackLodgeLabs/cuebox/issues/144) | Poster-led detail; status / review actions consistent with #115 / #93 |
| (e) Ceremony | [#145](https://github.com/BlackLodgeLabs/cuebox/issues/145) | Mandatory results 1→2→3; History lands on stage 3; replay 1→2→3 |
| (f) First-run / density | [#146](https://github.com/BlackLodgeLabs/cuebox/issues/146) | Questionnaire density; import / review / settings under the new shell |

**Prerequisites (shipped):** Home search-picker [#136](https://github.com/BlackLodgeLabs/cuebox/issues/136) ([PR #138](https://github.com/BlackLodgeLabs/cuebox/pull/138)) and inline Home + header search [#140](https://github.com/BlackLodgeLabs/cuebox/issues/140) ([PR #147](https://github.com/BlackLodgeLabs/cuebox/pull/147)). Do not reinvent picker merge/action behavior in the UI slices — style and compose it.

**Out of scope for this pass:** Insights / Ask (#51), PWA, Developer Mode visual redesign, rebrand.

**Agent note:** Start with #141 (shell). Prefer #142 after shell so Home hub and tabs stay coherent. Ceremony (#145) and watchlist grid (#143) are fail-if-missing for brief success criteria A/D and B.

---

### Theme: Library insights

**Intent:** Help the user understand their Cuebox library (especially the active watchlist) through analytics — both always-on summaries and occasional natural-language questions.

This is adjacent to, not a replacement for, the core recommendation journey (questionnaire → pick a film). Insights answer “what’s in my list?”; recommendations answer “what should I watch right now?”

### Golden source for fixed insights

**[Issue #51 — Create an Insights Page](https://github.com/BlackLodgeLabs/cuebox/issues/51)** is the golden source for the canned analytics / dashboard request. Treat the issue body as the authoritative list of scenarios (runtime totals and filters, decade/year trends, genre distribution, cast & crew frequencies, popularity/ratings mix, language & origin). Specs and plans for Insights work should defer to #51 and only narrow or sequence that list — not redefine it.

### Two surfaces, one foundation

| Surface | Role | Uses LLM? |
|---------|------|-----------|
| **Insights page (fixed)** | Permanent cards/charts for high-value, repeatable stats | No — deterministic aggregations and filters |
| **Ask (natural language)** | One question at a time over the same library data | Yes — tool-calling over allowlisted queries, then a grounded answer |

Design these **together at the data/query layer**, ship them as **separate UX**:

```text
                 ┌─ Insights page ── fixed cards / charts
Film stats API ──┤
                 └─ Ask box ──────── NL → tool call → same API → short answer
```

- Dashboard tiles cover questions worth seeing every visit (the #51 scenarios).
- Ask covers compositional / one-off questions the dashboard cannot preview (e.g. “how many 90s Korean films are on my watchlist?”).
- Common ask patterns can later be promoted to permanent tiles; niche tiles can stay ask-only.

Do **not** AI-generate the Insights page on every load. LLM cost and flakiness buy nothing for #51’s aggregations.

### Shared capabilities (not a question catalog)

Agents (and product) should think in **dimensions and operations**, not every English phrasing:

- **Dimensions (illustrative):** watchlist vs watched scope, release year/decade, runtime, genres, director, original language, country, community ratings (TMDB / etc.), personal scores / `watched_at` from `film_watches`.
- **Operations:** `count`, `list`, `sum` / `avg`, histograms, `top_n`.
- **Ask tool layer:** a small allowlisted set (e.g. `query_films`) that maps natural language → validated filters → SQLAlchemy — never free-form SQL. Unsupported questions should refuse clearly rather than invent numbers.

Cast-heavy #51 scenarios may need schema work first (today metadata stores `director` more reliably than structured cast). Time-bounded “watched this year” and personal-rating questions can use `film_watches` from [#93](#shipped-watched-film-review) (plus Letterboxd import from [#89](#shipped-letterboxd-watched-history-import)); watched-vs-watchlist scope uses [#115](#shipped-cuebox-owned-library-lifecycle) status tabs. See watch-status and `film_watches` in [database-design.md](database-design.md).

### Suggested sequencing (not a schedule)

1. Shared film-stats / filter-aggregate API covering fields already in `film_metadata` / `films` for active watchlist scope.
2. Insights page for a subset of [#51](https://github.com/BlackLodgeLabs/cuebox/issues/51) cards that that API can answer.
3. Optional single-shot Ask UI on top of the same tools.
4. Enrich later: cast storage; watched-vs-watchlist comparison; user scores / `watched_at` dimensions from `film_watches` (foundations already on main via #115 / #93 / #89).

An optional Cuebox MCP would package the same tools for *external* agents; it is not required for an in-app Insights or Ask UI.

---

### Theme: Rewatches (multiple watches per film)

**Intent:** Let the user record another watch of a film that is already `watched` — from search/picker and from film detail watch history — without inventing a second status machine. The `film_watches` many-to-one shape from #93 already supports multiple completed rows; product UI to *trigger* a rewatch is still open.

### Golden source

**[Issue #139 — Allow multiple watches of a film](https://github.com/BlackLodgeLabs/cuebox/issues/139)** is the golden source (thin issue today: add controls on search and under watch history on the film detail view). Specs should lock:

- How rewatch interacts with `pending_watch_review` / score+date dialog
- Whether the film stays `watched` (expected) vs any status bounce
- Idempotency / duplicate `watched_at` rules (import already unique on completed `(film_id, watched_at)`)

**Depends on:** shipped watch-review model (#93 / [PR #131](https://github.com/BlackLodgeLabs/cuebox/pull/131)) and library search-picker (#136 / #140).

**Agent note:** Prefer adding a completed `film_watches` row (or a short pending-review path that finalizes to another completed row) over new columns on `films`. Do not conflate with Insights (#51) or mobile ceremony (#145).

---

### Theme: LLM model selection in Settings

**Intent:** Let the user choose which LLM model(s) power recommendation (and related AI steps) from Settings, persist the choice, and use it for subsequent runs until changed.

### Golden source

**[Issue #132 — Add LLM Model Selection to Settings](https://github.com/BlackLodgeLabs/cuebox/issues/132)** is the golden source. Direction from the issue:

- Settings dropdown(s) for models used by AI components
- Single selection per control; save explicitly
- Future recommendations honor the saved model until the user changes it again
- Available models (and cost) are part of the data/integration surface

**Agent note:** Today providers/models are largely driven by `config.yaml` / env. Specs should decide what becomes user-overridable vs operator config, and how the choice maps onto existing semantic / embedding / ranking providers without breaking gate scripts that mock HTTP.

---

### Theme: Local stack resilience (Windows / Docker Compose)

**Intent:** Keep the locally hosted stack reachable after Docker Desktop restarts and overnight idle — restart policies and a stable (non-`--reload`) API mode for unattended Compose use.

### Golden source

**[Issue #61 — Harden Docker Compose resilience on Windows](https://github.com/BlackLodgeLabs/cuebox/issues/61)** is the golden source (`restart: unless-stopped` on core services; separate stable vs reload API; short ops docs).

**Agent note:** Ops/docs theme, not a UX surface. Do not change backup schedule/retention or remove bind mounts for local dev as part of #61.

---

## Shipped themes

Themes below are on `main`. Keep the product rules; open a new issue to extend them.

### Shipped: Cuebox-owned library lifecycle

**Intent (delivered):** Cuebox is the source of truth for whether a film is on the active watchlist, watched, or archived. Letterboxd remains optional bulk-ingest / RSS signal, not an authority for removals.

| | |
|--|--|
| **Issue** | [#115](https://github.com/BlackLodgeLabs/cuebox/issues/115) |
| **PR** | [#116](https://github.com/BlackLodgeLabs/cuebox/pull/116) (merged 2026-07-15) |

**What landed:** Tabbed `/watchlist` (Watchlist / Watched / Archived); `POST /films/{id}/status` state machine (`active ↔ watched` path later refined by #93; `active ↔ archived`; `watched ↮ archived`); additive-only CSV re-upload; RSS diary still marks matched films watched.

**Still out of scope unless a new issue says otherwise:** bulk status changes, Letterboxd write-back, RSS add/remove feeds.

---

### Shipped: Watched film review

**Intent (delivered):** When a film is marked watched (manual or RSS), Cuebox captures a short diary entry — score, watched date, optional notes — via `pending_watch_review` and many-to-one `film_watches` before treating the watch as complete.

| | |
|--|--|
| **Issue** | [#93](https://github.com/BlackLodgeLabs/cuebox/issues/93) |
| **PR** | [#131](https://github.com/BlackLodgeLabs/cuebox/pull/131) (merged 2026-07-18) |

**What landed:** `pending_watch_review` status; `film_watches` table; manual Mark watched → review dialog (cancel reverts to `active`); RSS pre-fill from `watchedDate` / `memberRating`; `/review` second section + combined pending-count badge; Watched tab incomplete indicator; film detail watch history with edit.

**Follow-ons:** Rewatch trigger UI → [#139](https://github.com/BlackLodgeLabs/cuebox/issues/139). Insights time/score dimensions → [#51](https://github.com/BlackLodgeLabs/cuebox/issues/51).

---

### Shipped: Letterboxd watched history import

**Intent (delivered):** Bulk-import Letterboxd `watched.csv` + `ratings.csv` + `diary.csv` into Cuebox watch records, separate from watchlist CSV/RSS sync.

| | |
|--|--|
| **Issue** | [#89](https://github.com/BlackLodgeLabs/cuebox/issues/89) |
| **PR** | [#133](https://github.com/BlackLodgeLabs/cuebox/pull/133) (merged 2026-07-24) |

**What landed:** Settings → Sync **Import watched history**; `POST /sync/watched`; merge rules (title+year, diary Watched Date, default date, null scores for unrated); idempotent completed watches; diary-without-score → review queue; active 500-cap unchanged for watchlist sync only.

---

### Shipped: Library search-picker (Home + header)

**Intent (delivered):** Find a film in the library or on TMDB and act (add, mark watched, complete review, view) without separate Add vs Mark watched Home CTAs; global header search reaches the same picker.

| | |
|--|--|
| **Issues** | [#136](https://github.com/BlackLodgeLabs/cuebox/issues/136), [#140](https://github.com/BlackLodgeLabs/cuebox/issues/140) |
| **PRs** | [#138](https://github.com/BlackLodgeLabs/cuebox/pull/138) (merged 2026-07-24), [#147](https://github.com/BlackLodgeLabs/cuebox/pull/147) (merged 2026-07-26) |

**What landed:** Combined library + TMDB `LibrarySearchPicker`; status-aware actions; TMDB **Add & mark watched**; inline picker on returning-user Home; `/search` → Home focus alias; header magnifying-glass icon.

**Follow-on:** Mobile UI slices style/compose this surface ([#141](https://github.com/BlackLodgeLabs/cuebox/issues/141)–[#142](https://github.com/BlackLodgeLabs/cuebox/issues/142)); do not replace the behavior.

---

## Expanding this roadmap

As other product themes crystallize (beyond the sections above), add a short section under **Upcoming themes** with:

1. One-paragraph intent
2. Link(s) to the controlling GitHub issue(s) — and open PR if one is in flight
3. Notes that help agents avoid conflicting designs

When a theme ships, move it to **Shipped themes** with issue + merged PR links and a short “what landed” summary. Keep sections short. Move detail into issues and specs.
