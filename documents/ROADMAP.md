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

Cast-heavy #51 scenarios may need schema work first (today metadata stores `director` more reliably than structured cast). Time-bounded “watched this year” style questions need first-class watch-event / diary data that Cuebox does not fully persist yet — see watch-status handling in [database-design.md](database-design.md).

### Suggested sequencing (not a schedule)

1. Shared film-stats / filter-aggregate API covering fields already in `film_metadata` / `films` for active watchlist scope.
2. Insights page for a subset of [#51](https://github.com/BlackLodgeLabs/cuebox/issues/51) cards that that API can answer.
3. Optional single-shot Ask UI on top of the same tools.
4. Enrich later: cast storage, watched-vs-watchlist comparison, diary/`watched_at` for time-bounded viewing questions.

An optional Cuebox MCP would package the same tools for *external* agents; it is not required for an in-app Insights or Ask UI.

---

## Expanding this roadmap

As other product themes crystallize (beyond recommendations + insights), add a short section here with:

1. One-paragraph intent
2. Link(s) to the controlling GitHub issue(s)
3. Notes that help agents avoid conflicting designs

Keep sections short. Move detail into issues and specs.
