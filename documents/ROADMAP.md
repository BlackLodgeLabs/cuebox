# Cuebox product roadmap (pointer)

This document is a **direction pointer** for humans and agents. It is not a commitment, schedule, or implementation plan. Concrete feature shapes live in GitHub issues and in per-issue `workflow/issues/issue-NNN/SPEC.md` / `PLAN.md` once work is triaged.

**How to use this file**

- Read it when scoping adjacent work so new features fit the product direction.
- Prefer linked GitHub issues as the source of truth for *what* to build.
- Do not invent timelines, phase numbers, or scope beyond what issues and specs say.
- When a theme below is picked up, update this file lightly (status + links) rather than turning it into a long design doc.

Related docs: [PRD.md](PRD.md) (current product requirements), [Architecture.md](Architecture.md), [database-design.md](database-design.md), [api-contracts.md](api-contracts.md).

---

## Theme: Library insights

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

- **Dimensions (illustrative):** watchlist vs watched scope, release year/decade, runtime, genres, director, original language, country, community ratings (TMDB / etc.).
- **Operations:** `count`, `list`, `sum` / `avg`, histograms, `top_n`.
- **Ask tool layer:** a small allowlisted set (e.g. `query_films`) that maps natural language → validated filters → SQLAlchemy — never free-form SQL. Unsupported questions should refuse clearly rather than invent numbers.

Cast-heavy #51 scenarios may need schema work first (today metadata stores `director` more reliably than structured cast). Time-bounded “watched this year” style questions need first-class watch-event / diary data — [#93](#theme-watched-film-review) is the golden source for capturing that; [#115](#theme-cuebox-owned-library-lifecycle) makes watched/archived first-class in the UI. See also watch-status handling in [database-design.md](database-design.md).

### Suggested sequencing (not a schedule)

1. Shared film-stats / filter-aggregate API covering fields already in `film_metadata` / `films` for active watchlist scope.
2. Insights page for a subset of [#51](https://github.com/BlackLodgeLabs/cuebox/issues/51) cards that that API can answer.
3. Optional single-shot Ask UI on top of the same tools.
4. Enrich later: cast storage; watched-vs-watchlist comparison (depends on #115); user scores / `watched_at` from #93 for time-bounded and “what I actually watched” questions.

An optional Cuebox MCP would package the same tools for *external* agents; it is not required for an in-app Insights or Ask UI.

---

## Theme: Cuebox-owned library lifecycle

**Intent:** Cuebox becomes the source of truth for whether a film is on the active watchlist, watched, or archived. Letterboxd remains an optional bulk-ingest / RSS signal, not an authority for removals.

### Golden source

**[Issue #115 — Tabbed watchlist with Watched/Archived lists and manual status management](https://github.com/BlackLodgeLabs/cuebox/issues/115)** is the golden source for this theme. Key direction from the issue:

- Tabbed `/watchlist`: Watchlist / Watched / Archived
- Manual status transitions in UI + API (`active ↔ watched`, `active ↔ archived`; `watched ↮ archived`)
- CSV re-upload becomes **additive-only** (never remove or reclassify existing films)
- RSS diary poll still marks matched films watched

**Status:** Implementation is in review — [PR #116](https://github.com/BlackLodgeLabs/cuebox/pull/116) (`cursor/issue-115-tabbed-watchlist-watched-archived`). Prefer that PR / issue over inventing alternate status or CSV semantics.

**Out of scope in #115 (do not sneak in):** bulk status changes, new `watched_at` / `archived_at` columns, Letterboxd write-back, RSS add/remove feeds. Those belong to later issues (e.g. #93 for watch events / dates).

**Agent note:** Recommendation candidates already require `status = active`. Treat #115’s state machine and additive CSV as load-bearing product rules once merged.

---

## Theme: Watched film review

**Intent:** When a film is marked watched (initially via RSS), Cuebox should prompt a short post-watch review — user score, optional notes, and a watched date — before treating the watch as fully recorded. Support multiple watches per film later (many watch-events to one film).

### Golden source

**[Issue #93 — Review watched films](https://github.com/BlackLodgeLabs/cuebox/issues/93)** is the golden source. Key direction from the issue:

- RSS (or similar) moves a film into a **review** flow on the existing review page (separate heading from unmatched metadata)
- Capture: score out of 5 (half stars allowed), optional notes, watched date (pre-fill from RSS when available; user can edit)
- Persist those fields; show them on the film detail view when the film is watched
- Store watch data **many-to-one** with the film (rewatches are a future feature)

**Depends on / coordinates with:** #115’s watched/archived UX and status model once landed. Insights (#51 / Ask) gain real “watched this year” and personal-rating dimensions only after watch-event persistence exists — do not fake those answers from `films.updated_at` or RSS ledgers alone.

**Agent note:** #115 explicitly deferred `watched_at` columns; #93 is where personal watch history and ratings should land. Avoid one-off columns on `films` if the issue’s many-to-one watch-event shape is the intended model.

---

## Expanding this roadmap

As other product themes crystallize (beyond the sections above), add a short section here with:

1. One-paragraph intent
2. Link(s) to the controlling GitHub issue(s) — and open PR if one is in flight
3. Notes that help agents avoid conflicting designs

Keep sections short. Move detail into issues and specs.
