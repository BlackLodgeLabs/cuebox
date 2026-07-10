## Related Issue

Closes #99

[Link to GitHub Issue](https://github.com/BlackLodgeLabs/cuebox/issues/99)

## Description

**What does this PR do?**

Adds an in-app flow to search TMDB, pick a film, resolve its Letterboxd identity, and add it to the active watchlist with full metadata and semantic enrichment. Entry points on **Home** and **Watchlist** link to a dedicated `/watchlist/add` route. Letterboxd identity is resolved via the public `https://letterboxd.com/tmdb/{tmdb_id}` redirect, with a slug-probe fallback when Cloudflare blocks datacenter IPs. Unresolved films land in a **Letterboxd URI resolution** review queue where the user pastes a valid Letterboxd film URL.

**Why is this the best approach?**

- Reuses existing TMDB search, metadata persist, enrichment pipeline, and review patterns from issue #59.
- Keeps `letterboxd_uri` as the canonical identity (no synthetic IDs).
- `films.add_source = 'manual'` lets CSV sync preserve manual adds while RSS lifecycle events still apply by URI.
- Manual adds are exempt from the 500-film cap per product decision; CSV/RSS caps unchanged.

## Changes Proposed

* **API:** `GET /films/tmdb-search` global TMDB search; `POST /watchlist/films` to add/restore films; `POST /reviews/{id}/resolve-letterboxd` for paste-to-resolve.
* **API:** `letterboxd_resolver.py` — redirect resolution plus slug-probe fallback using `data-tmdb-id` on film pages.
* **API:** `watchlist_add_service.py` — orchestrates duplicate detection, restore archived/watched, review stub creation, and enrichment enqueue.
* **API:** Migration `0006_manual_watchlist_add` — `films.add_source`, `metadata_match_reviews.review_type`.
* **API:** CSV diff skips `add_source='manual'` films from removal set.
* **Frontend:** `/watchlist/add` page with TMDB search, confirm, enriching poll, and inline duplicate/conflict messages.
* **Frontend:** Home third CTA “Add film to watchlist”; Watchlist header “Add film” button.
* **Frontend:** Review page extension for `letterboxd_uri` reviews with paste input.
* **Tests:** `test_integration_watchlist_add.py`, `test_letterboxd_resolver.py`, frontend unit + E2E specs.
* **Docs:** `api-contracts.md`, `sequence-diagrams.md` updated.

## Scenario Results

| # | Scenario | Result |
|---|----------|--------|
| 1 | Happy path — add from Home | PASS |
| 2 | Watchlist add button | PASS |
| 3 | Already on watchlist | PASS |
| 4 | Letterboxd review paste | PASS |
| 5 | Restore archived | PASS |

![Home with three CTAs](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f08551c02e16526ee6199800962b84e6fa0e4f29/workflow/issues/issue-99/demo/scenario-1-home-cta.png)

![TMDB search results on /watchlist/add](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f08551c02e16526ee6199800962b84e6fa0e4f29/workflow/issues/issue-99/demo/scenario-1-search-results.png)

![Fight Club on watchlist with Ready status](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f08551c02e16526ee6199800962b84e6fa0e4f29/workflow/issues/issue-99/demo/scenario-1-added-ready.png)

![Watchlist Add film button](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f08551c02e16526ee6199800962b84e6fa0e4f29/workflow/issues/issue-99/demo/scenario-2-watchlist-button.png)

![Duplicate detection for The Matrix](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f08551c02e16526ee6199800962b84e6fa0e4f29/workflow/issues/issue-99/demo/scenario-3-duplicate.png)

![Letterboxd URI paste review card](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f08551c02e16526ee6199800962b84e6fa0e4f29/workflow/issues/issue-99/demo/scenario-4-review-paste.png)

![Film ready after Letterboxd paste](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f08551c02e16526ee6199800962b84e6fa0e4f29/workflow/issues/issue-99/demo/scenario-4-after-resolve.png)

![Restore archived Fight Club](https://raw.githubusercontent.com/BlackLodgeLabs/cuebox/f08551c02e16526ee6199800962b84e6fa0e4f29/workflow/issues/issue-99/demo/scenario-5-restored.png)

## How to Test

1. Checkout branch: `git checkout cursor/issue-99-add-film-to-watch-list`
2. Copy config: `cp config.example.yaml config.yaml && cp .env.example .env` — set `TMDB_API_KEY` and `OPENAI_API_KEY`
3. Start stack: `docker compose up --build`
4. Confirm migration: API container runs `alembic upgrade head` (includes `0006_manual_watchlist_add`)
5. **Home CTA:** Open http://localhost:3000 — with a seeded watchlist, confirm three cards: New recommendation → Add film to watchlist → History
6. **Add flow:** Open http://localhost:3000/watchlist/add — search TMDB, select a film, click Add to watchlist; wait for `ready`
7. **Duplicate:** Re-add a film already on the watchlist — inline “Already on your watchlist” with link
8. **Review paste:** If Letterboxd redirect fails, film appears on http://localhost:3000/review with paste input; submit a valid Letterboxd film URL
9. **API tests:**
   ```bash
   export DATABASE_URL=postgresql+psycopg://cuebox:cuebox@localhost:5432/cuebox
   export TEST_DATABASE_URL="$DATABASE_URL"
   cd api && pytest tests/test_integration_watchlist_add.py tests/test_letterboxd_resolver.py -v
   ```
10. **Full regression:** `bash scripts/verify-phase8-gates.sh`

## Known Issues / Notes for Reviewer

* Letterboxd `/tmdb/{id}` redirect is blocked by Cloudflare from server/datacenter IPs; slug-probe fallback handles common titles. Obscure titles may still require manual paste on `/review`.
* Manual adds are exempt from the 500 active watchlist cap; active watchlist may exceed 500.
* `films.add_source = 'manual'` protects manual adds from CSV removal; RSS watched/remove events still apply when matched by `letterboxd_uri`.

## Gate evidence

- [ ] `Phase 8 gate exit 0 at f08551c`
- [ ] `pytest tests/test_integration_watchlist_add.py tests/test_letterboxd_resolver.py` — 20 passed at f08551c
- [ ] `npx tsc --noEmit` and `npm run test:unit` — passed via Phase 8 gate at f08551c
