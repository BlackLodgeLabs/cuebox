# Issue #99 demo notes

## Pass-back to execute

Demo on the cloud VM surfaced two bugs in the manual watchlist add flow:

### Bug 1 — every add lands in Letterboxd review

**Symptom:** Adding any TMDB pick (e.g. Fight Club, TMDB id `550`) returned `review_required` instead of enriching.

**Root cause:** `GET https://letterboxd.com/tmdb/{id}` is blocked by Cloudflare (`403`) from server/datacenter IPs. The resolver returned `None`, so `_create_review_required_stub` ran for every film. Browsers on residential networks still get the redirect.

**Fix:** Keep redirect as primary path; when it fails, probe accessible film pages at `/film/{slug}/` using slug candidates from the TMDB title/year and confirm via `data-tmdb-id` in the HTML. Verified: Fight Club resolves to `https://letterboxd.com/film/fight-club/` without the `/tmdb/550` shortcut.

### Bug 2 — duplicate / retry UX

**Symptom:** Re-adding a film stuck in review produced a generic conflict or duplicate review rows with no clear next step.

**Fix:** Return the existing pending `letterboxd_uri` review when the same TMDB id is submitted again; surface `film_id` on metadata conflicts; add inline messages on `/watchlist/add` linking to the film detail page and `/review`.

## Test TMDB ids

| Title | TMDB id | Expected Letterboxd URI |
|-------|---------|------------------------|
| The Matrix | 603 | `https://letterboxd.com/film/the-matrix/` |
| Fight Club | 550 | `https://letterboxd.com/film/fight-club/` |

## Demo status

Happy-path add with slug fallback should now reach `enriching` → `ready` on the VM without manual Letterboxd paste when the slug probe succeeds.
