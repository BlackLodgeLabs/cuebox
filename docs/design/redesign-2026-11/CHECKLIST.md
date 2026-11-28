# Cuebox acceptance checklist

Use this while implementing. Locked values are in `README.md` §6 and `tokens/`.

## Foundations and shell

- [ ] Cuebox tokens are used throughout. No default shadcn grey, no Inter, no IBM Plex Sans.
- [ ] Wordmark is **Cuebox.** — “Cue” amber, “box” and the full stop teal.
- [ ] Only amber glows (`0 0 18px rgba(224, 122, 40, 0.5)` or the specified variant). Teal is flat, with no glow and no wash.
- [ ] Radius 12px default, 8px poster tiles, 16px sheets and dialogs.
- [ ] Spacing follows 4 / 8 / 16 / 24 / 32 / 48.
- [ ] Hairline rules between sections. No mono index on Home.
- [ ] Tab bar: Home, Watchlist, Recommend, More. Active tab is teal and flat.
- [ ] `prefers-reduced-motion: reduce` is honoured on every motion below.

## Home

- [ ] Layout matches `screens/home.png`.
- [ ] Today’s feature is a single daily film, not a carousel or spinner.
- [ ] Header has a Search films field that opens the cmdk card. Where to watch (amber, glow allowed) opens a Vaul sheet. Get a pick for tonight (teal-outline) starts the 11-step questionnaire. Surprise me (teal text) opens a Vaul sheet. Sheets 800ms up / 700ms down.
- [ ] Arrival is the 0.85× logo unfold, then the option-E iris (80ms beat, 760ms smoothstep iris, wordmark fade 600ms, sections rise 6px / 70ms / 300ms).
- [ ] Reduced motion skips the splash and shows the settled Home at once.

## Search

- [ ] Search is a cmdk card on Home and Watchlist, not a sheet. 700ms open / 600ms close, from 96% scale.
- [ ] A film already on the watchlist opens usual detail.
- [ ] A film not on the watchlist opens the lighter page (`screens/detail-add.png`) with Add to watchlist.
- [ ] Adding shows a Sonner toast “Added to watchlist” (700ms in, 600ms out, stays 2800ms).
- [ ] Reduced motion: 300ms fade, no scale or travel.

## Recommendation

- [ ] Questionnaire is 11 steps, one at a time (Flow A). The pack shows 1, 2 and 11 of 11 (`reco-genres.png`, `reco-runtime.png`, `reco-notes.png`), then the shuffle, then `reco-programme.png`.
- [ ] Strip uses TMDB backdrops with no titles under the frames.
- [ ] Cruise is a constant **420px/s**, no breath, until the API has returned and a short minimum cruise has played.
- [ ] Slow-down is 2.5s, ease `1-(1-u)^1.38`, about 761px.
- [ ] Winner gets the amber highlight (80 / 120 / 400ms, opacity 0.95, specified shadow), then expands to the programme in 580ms, then settles 8px / 70ms / 300ms.
- [ ] Reduced motion: 300ms crossfade from notes to the settled programme. No travel, glow or expand.

## Film detail

- [ ] Overview / Watch / You match `detail-overview.png`, `detail-watch.png`, `detail-you.png`.
- [ ] Taste ticks: 70ms delay, 330ms ease-out fill, glow off, trigger at 40% in view, rows +90ms. Teal fill stays flat.
- [ ] Synopsis “More” is a 300ms height and fade.
- [ ] You-tab pencils edit an existing review. Rating badges only appear when the user has rated that watch.
- [ ] More sheet matches `detail-more-sheet.png` and uses the shared sheet timings.
- [ ] The not-on-watchlist page matches `detail-add.png` (Trailer, Add to watchlist, More; no Close to this).
- [ ] Bottom bar includes Trailer. Close to this on your watchlist sits on the You tab and shows only unwatched films.
- [ ] Reduced motion: 300ms fade of the finished ticks together, no stagger or travel.

## Review

- [ ] Stars and Watched-grid rating badges are amber `#E07A28`. Create sheet matches `review-ready.png` / `review-saved.png`. A star tap fills up to that rating and saves the watch immediately; date and note then appear and have no Save button (note autosaves on blur).
- [ ] Star fill: 70ms delay, 330ms ease-out, 30% bounce over 190ms, Saved after 40ms fading in over 220ms, amber glow on at 35%.
- [ ] Edit (`review-edit.png`) does not save on tap. The user presses Save changes.
- [ ] “Delete this watch?” matches `review-delete.png` (400ms, 92% scale, 62% dim).
- [ ] Deleting a film’s only watch does not change the film’s status (it stays watched).
- [ ] A manual watch can have no date. The 1984-09-28 sentinel is never written on a new or edited manual watch.
- [ ] NumberFlow on the score is 400ms ease-out; reduced motion shows the settled figure.
- [ ] Reduced motion on the fill: 300ms crossfade, no bounce or glow.

## Watchlist

- [ ] Layout matches `watchlist-unwatched.png` / `watchlist-watched.png`. Total sits under the title. Pills have no counts.
- [ ] Pills are Unwatched (`active`), Watched, Archived (`archived`). There is no All pill.
- [ ] Filter and Sort are Vaul sheets matching `watchlist-filter.png` and `watchlist-sort.png`.
- [ ] Switching pills: 400ms out, 600ms in, 200ms overlap, ease-out.
- [ ] No next-page button. Next page of 18 loads when the user is 600px from the bottom, if `has_more` is true.
- [ ] “Loading more” is a flat teal spinner. New films fade in over 300ms, staggered 30ms.
- [ ] Reduced motion: 300ms overlapping crossfade; a new batch fades together over 300ms, no stagger.


## History

- [ ] Layout matches `screens/history.png`. Ticket stubs show the date, artwork, title, year, mood line and a watched mark. Month labels are on. Stub width is 76px, with perforation.
- [ ] Search and Filter (date range and watch status) are present. Filter is a Vaul sheet at 800ms up / 700ms down.
- [ ] No Previous / Next. Next page of 10 loads when the user is 600px from the bottom, if `has_more` is true.
- [ ] “Loading more” is a flat teal spinner. New tickets fade in over 300ms, staggered 30ms.
- [ ] Opening `/history/{id}` (or tapping a ticket) shows the locked programme layout titled with the date (see `screens/history-programme.png`), not the old three-stage ceremony, and does not replay the shuffle. 400ms crossfade. Back returns to History.
- [ ] Remove is swipe-left to reveal Remove, or a long-press. Both go through the confirm box (400ms, 92% scale, 62% dim) before the entry is deleted.
- [ ] A normal tap only shrinks the ticket by 4% (120ms in / 200ms out). No amber outline, glow or fill on press. The Remove rail stays hidden until a swipe.
- [ ] Reduced motion: no ticket press; 300ms fade to the programme; a new batch fades together over 300ms, no stagger.

## Sync and Import

- [ ] No dedicated design pass. Shared foundations and app-wide motion defaults only. Treat as a placeholder to revisit if the app is ever opened to other users.

## App-wide

- [ ] All Vaul sheets: 800ms up, 700ms down, 55% dim over 450ms, drag-to-dismiss 120px.
- [ ] All toasts: 700ms in, 600ms out, 20px travel, stay 2800ms.
- [ ] Confirm dialogs: 400ms, 92% scale, 62% dim.
- [ ] Amber primary buttons press 4% in 120ms and release in 200ms.
- [ ] Tab and film-page changes use a 400ms crossfade.
- [ ] Reduced motion: 300ms fade, no travel or scale.

## Behaviour and API

- [ ] `GET /films` is called with `limit=18` and `offset` for infinite scroll, using `pagination.has_more`.
- [ ] History list uses `GET /recommendations` with `limit=10` and `offset`, and `pagination.has_more`.
- [ ] Opening a history session uses `GET /recommendations/{session_id}` and renders the locked dated programme, not the old ceremony.
- [ ] Removing a history night uses the confirm box, then `DELETE /recommendations/{session_id}`.
- [ ] Any new API work needed for “On my services”, genre/runtime filters, runtime/rating sort, nullable `watched_at`, or deleting a finalized watch is agreed and documented, not silently invented.
