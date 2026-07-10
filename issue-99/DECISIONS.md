# Issue #99 — Product decisions log

Recorded from spec Q&A (2026-07-09). Use when commenting on the GitHub issue or resuming `@cursoragent continue spec`.

## Q1 — Film identity

- User picks TMDB result in UI.
- Resolve `letterboxd_uri` via public redirect: `https://letterboxd.com/tmdb/{tmdb_id}` (no Letterboxd API).
- Failures or ambiguous results → review queue; user pastes Letterboxd film URL manually.

## Q2 — Sync behavior

| Sync | Behavior |
|------|----------|
| **CSV** | Manual adds **persist** — not removed when absent from export. |
| **RSS** | Full lifecycle applies when matched by `letterboxd_uri` (add, remove, **watched**). |

Example: add in Cuebox → add on Letterboxd → watch on Letterboxd → RSS marks watched before next CSV sync.

## Q3 — UI entry

- Dedicated route: **`/watchlist/add`**
- **Home:** “Add film to watchlist” between New recommendation and History.
- **Watchlist:** add button.
- Both link to the same route.

## Q4 — Duplicate on active watchlist

**(a)** Message + link to existing film detail; no duplicate row.

## Q5 — Previously archived or watched

**(a)** Restore — reuse film row, `status → active`, reactivate watchlist entry.  
Future watched-list / “add as watched” features are **out of scope** for this issue.

## Q6 — 500-film cap

**(b)** Manual adds **exempt** from cap. CSV import and RSS add remain capped at 500.
