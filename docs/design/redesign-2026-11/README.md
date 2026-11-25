# Cuebox developer handoff

This pack is the source of truth for implementing the locked Cuebox design in [BlackLodgeLabs/cuebox](https://github.com/BlackLodgeLabs/cuebox). Cuebox is a private, single-user, phone-first film watchlist app, with a Next.js frontend and a Python API.

Please work from this pack, not from the Figma file. Figma was used only as a holding place earlier in the process, and it is behind the locked screens and motion described here.

Interactive mocks and tokens live alongside this README. The HTML testers are set to the locked values, and the reference videos in this pack were recorded at those values (the Recommendation shuffle is the locked 420px/s constant cruise, not the earlier 260px/s recording). If a clip ever differs, the notes in `motion/` say so clearly; trust this document and the tester defaults.

---

## 1. Purpose and how to use this pack

The job is to bring the locked visual design and motion into the real app. Use shadcn/Radix restyled with Cuebox tokens, and add Sonner, Vaul, cmdk, NumberFlow and Framer Motion as you build — these are the recommended libraries, not packages already installed on `main`.

| Folder | What it is |
| --- | --- |
| `README.md` | This brief |
| `README.html` / `Cuebox-handoff.pdf` | The same brief, laid out for a quick read |
| `tokens/tokens.css` and `tokens/tokens.json` | Colours, type, radii, spacing, and every locked motion value |
| `screens/` | Final phone PNGs of each locked screen (including History), plus an overview contact sheet |
| `motion/` | Reference MP4s and offline HTML testers (with `art/` and `fonts/` so they run from a file path) |
| `CHECKLIST.md` | Acceptance criteria per screen |
| `draft-message-to-developer.txt` | A short unsent note Craig can use when he is ready to share this pack |

To try a motion mock, open the HTML file in that folder in a desktop browser. Each folder has a short `README.txt` of its own, including any difference between a video and the locked values.

Phone frame used throughout: **390 × 844 CSS pixels**. Status bar 54px, header 52px, tab bar 90px. Videos were rendered at 2× (780 × 1688), 60fps, H.264.

---

## 2. Suggested order of work

1. **Tokens and foundations.** Wire `tokens.css` (or the JSON) into the frontend. Swap default shadcn grey and Inter for Cuebox colour and type. Do not ship the default theme.
2. **App shell.** Status bar area, header, tab bar, typography, buttons, hairline rules, the wordmark.
3. **Shared overlays.** Vaul sheets, Sonner toasts, cmdk search, confirm dialogs, amber button-press, tab and page crossfades, NumberFlow. Get these right once, then every screen can use them.
4. **Home and Search.**
5. **Watchlist**, including infinite scroll in place of a next-page control.
6. **Film detail**, including the More sheet and the lighter “not on your watchlist” page.
7. **Review**, create, saved, edit and delete.
8. **Recommendation** (the shuffle, then the programme).
9. **History** (under More): the ticket-stub list, infinite scroll, and opening a past night as a dated programme.
10. **Settings / My services.**
11. **Sync and Import** (also under More) have no design pass — use the shared foundations and app-wide motion defaults. See §5.
12. **Reduced-motion pass** and the acceptance checklist in `CHECKLIST.md`.

The one-off motion moments (Home iris, Recommendation shuffle, taste ticks, star fill, Watchlist crossfade, and History’s list-to-programme path) stay as specified. Do not replace the one-off moments with the shared 400ms screen fade, except where a lock already uses that fade (History opening a past night).

---

## 3. Foundations

Locked 14 November 2026, direction **T2 Balance**.

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| `--cb-bg` | `#0B0B0B` | App background |
| `--cb-surface` | `#171717` | Cards, bars, sheets, fields |
| `--cb-text` | `#F3EDE4` | Primary text |
| `--cb-muted` | `#A39E96` | Secondary text |
| `--cb-accent` | `#E07A28` | Amber. Primary actions, the word “Cue”, review stars, watchlist rating badges, and the only colour that may glow |
| `--cb-teal` | `#2A9A94` | Links, the active tab, selected chips, progress, teal-outline secondary buttons, small icons, a short hairline under section headers, the letters “box” and the full stop in the wordmark, and the “Saved” confirmation. Not used for stars or rating badges |
| `--cb-divider` | `#2A2A2A` | Hairlines and rules |
| `--cb-ink` | `#0B0B0B` | Text on an amber fill |
| `--cb-danger` | `#C75B4A` | Delete and other destructive actions |

**Glow rule:** only amber may glow. Standard glow is `0 0 18px rgba(224, 122, 40, 0.5)`. Teal stays flat — no glow, and no teal wash behind a section.

### Type

Three families, bundled with the app (the files are in each motion folder’s `fonts/`):

- **Big Shoulders** (weight 700) for titles and the wordmark. The wordmark uses display optical size (`opsz` 72).
- **Archivo** for UI and body.
- **IBM Plex Mono** for kickers and metadata, often uppercase with letter-spacing around `0.06em`.

Do not use Inter, and do not use IBM Plex Sans (that was an unused early option).

| Role | Size | Family |
| --- | --- | --- |
| Film title on a detail or review hero | 40px | Big Shoulders 700 |
| Programme title, large sheet titles | 36px | Big Shoulders 700 |
| Page titles (Watchlist and similar) | 28px | Big Shoulders 700 |
| Wordmark, sheet titles, mid headings | 22px | Big Shoulders 700 |
| Section headers, card titles | 18px | Big Shoulders 700 |
| Smaller headings, list titles | 16px | Big Shoulders 700 |
| Primary UI and synopsis | 15px | Archivo 500 |
| Buttons, secondary body | 14px | Archivo 500–600 |
| Captions, chips, “More” | 13px | Archivo 500 |
| Tab bar labels | 11px | Archivo 500 |
| Kickers and metadata | 11px | IBM Plex Mono |
| Badges and small labels | 10px | IBM Plex Mono |

### Corners and spacing

- Default radius **12px** (buttons, fields, chips, search card, toasts).
- Poster tiles and small images **8px**.
- Sheets and confirm dialogs **16px**.
- Spacing scale: **4 / 8 / 16 / 24 / 32 / 48**.
- Hairline rules between sections. No mono index numbers on Home.

### Wordmark

**Cuebox.** — “Cue” is amber, “box” and the full stop are teal.

---

## 4. Component mapping

These are the **recommended libraries to add** and restyle with Cuebox tokens. They are not installed on `main` yet; add them as part of the build. Do not invent a second component set. Confirm boxes should use shadcn / Radix AlertDialog (also to be added).

| Pattern | Library | Notes |
| --- | --- | --- |
| Buttons, tabs, inputs, chips | shadcn / Radix, restyled | 12px radius, Cuebox colour and Archivo. No default grey, no Inter |
| Bottom sheets | **Vaul** | Review create/edit, Watchlist Filter and Sort, More on a film, Surprise me, Where to watch on Home |
| Pop-up messages | **Sonner** | For example “Added to watchlist”. No undo toast was designed |
| Find-a-film search | **cmdk** | A card on Home and Watchlist, not a bottom sheet |
| Confirm boxes | shadcn / Radix **AlertDialog** | “Delete this watch?” is the designed example |
| Rolling numbers | **NumberFlow** | Review score, “Show N films”. 400ms, same ease-out. Reduced motion shows the settled figure |
| Screen and one-off motion | **Framer Motion** | Use the tokens and snippets in §6 |

My services is a **full page**, not a sheet. There is no dropdown or popover in the locked designs. The date picker can stay the native control unless you introduce a custom calendar, in which case use a Vaul sheet.

---

## 5. Screen-by-screen spec

All of the PNGs below are in `screens/`, at the 390 × 844 phone crop. `screens/overview.png` is a contact sheet of the main states.

### Home — `home.png`

A quiet daily home, not a dashboard. No stats or counts.

- Header: the Cuebox wordmark on the left and a **Search films** field beside it (not a standalone icon-only button). Tapping the field opens the cmdk search card. See Search below.
- **Today’s feature** is one film from the watchlist, chosen by app logic, and it changes once a day. It is not a carousel and has no spinner or numbered index. A plain Archivo caption labels it (“Today’s feature · from your watchlist”).
- Actions under the feature, in this order:
  - **Where to watch** — amber fill, glow allowed. Opens a Vaul sheet of providers.
  - **Get a pick for tonight** — full-width teal-outline button. Starts the 11-step recommendation questionnaire (the same flow as the Recommend tab).
  - **Surprise me** — smaller teal text action under that button (not a teal-outline button). Opens a Vaul sheet with one random watchlist pick. See `home-surprise.png`.
- Themed poster rails below, watchlist-only, with Big Shoulders headings, a short teal hairline, and a “See all” link. The locked mock uses **Folk dread**, **Slow-burn unease**, **Quiet heartbreak** and **Under 90 minutes**. They may refresh over time; that is not labelled on the screen. How a film is assigned to a named rail was not locked — see §9.
- Tab bar: **Home, Watchlist, Recommend, More** (four tabs). The active tab is teal and flat. Recommend opens the 11-step questionnaire, then the shuffle and the programme (the programme is shown with Recommend selected). History, Sync, Import and My services sit under More.

Arrival motion is the signed-off logo unfold, then the option-E iris from the teal full stop. See §6.1.

### Search — `home-search.png`, `home-search-added.png`

Search is opened from the **Search films** field in the header on Home and Watchlist. It is a **cmdk card** that fades in over the current screen, not a bottom sheet and not a new tab.

- Field, results grouped **On your watchlist** then **Not on your watchlist**, then a clear empty or no-match state. An eye marks a watchlist hit as watched (opens the review sheet); a plus adds a catalogue hit to the watchlist.
- A result already on the watchlist opens the usual film detail.
- A result **not** on the watchlist opens a lighter film page (`detail-add.png`) with an **Add to watchlist** amber button. After adding, a Sonner toast says “Added to watchlist” (`home-search-added.png`).

### Recommendation — `reco-genres.png`, `reco-runtime.png`, `reco-notes.png`, `reco-cueing.png`, `reco-programme.png`

This is **Flow A**: eleven questions, **one at a time**, then the film-strip shuffle, then **Tonight’s programme**. Do not treat the three PNGs in this pack as the whole questionnaire — they are representative screens only (`reco-genres.png` is 1 of 11, `reco-runtime.png` is 2 of 11, `reco-notes.png` is 11 of 11, with “Find my pick”). The other eight steps use the same one-at-a-time layout (large cards or chips, a teal progress bar, and “N of 11” in IBM Plex Mono). There is no tab bar on the question screens.

The eleven steps, from the product vocabulary, are: (1) genres, (2) runtime, (3) who you’re with, (4) mental effort, (5) pacing, (6) how you want to feel, (7) look and feel, (8) era, (9) subtitles, (10) how well-known, (11) optional notes (max 1000 characters). Runtime options are ≤ 90 minutes, ≤ 120 minutes, ≤ 150 minutes, and No limit. There is no streaming-service question in this flow.

On “Find my pick”, the notes screen gives way to the film-strip shuffle (the motion moment), which lands on a winner and expands into the **programme** — a single recommended film, presented in a phone with the Recommend tab selected, a short why-this-film note, runners-up, and actions back to detail / watchlist. Do not use the old three-stage ceremony.

The stills in the strip are **TMDB backdrops**, with no titles under the frames. The locked path is option B with a constant 420px/s cruise. See §6.2. `reco-cueing.png` is a mid-shuffle still.

### Film detail — `detail-overview.png`, `detail-watch.png`, `detail-you.png`, `detail-add.png`, `detail-more-sheet.png`

A film the user already has opens as a backdrop hero, title, and three tabs: **Overview**, **Watch**, and **You**.

- Community scores under the title are whole-number percentages for **TMDB**, **Rotten Tomatoes** and **Letterboxd** (in the mock: 75%, 90%, 76%). Convert stored scores for display: TMDB `vote_average` × 10, Letterboxd × 20, RT already a percentage, rounded to the nearest whole percent. These are catalogue scores, not the user’s own rating.
- Overview: synopsis with a “More” height reveal (300ms), services, metadata, and the taste-tick chart (the locked motion moment, §6.3). Taste ticks are **teal and flat** — they are not stars.
- Watch: where to watch, providers, with the user’s services sorted first.
- You: the user’s watches and ratings, with a pencil to edit an existing review. **Close to this on your watchlist** sits on this tab and shows only **unwatched** watchlist films. It is in scope; it is not on the not-on-watchlist page.
- A sticky bottom bar: **Trailer**, **Watch** (amber fill and glow; on the Watch tab it should open the first ready-to-play service), **Watched** / **Watched?** (teal eye; “Watched” if already logged, “Watched?” if not), and **More**. Trailer is in scope.
- More (the “…” control) opens a Vaul sheet: archive, remove, and other film actions (`detail-more-sheet.png`). Archive and Remove have **no confirmation** in the locked mocks — if you add one, it would be a new decision.
- If the film is **not** on the watchlist (`detail-add.png`), the page is lighter: hero, metadata, community scores and synopsis. There are no Overview / Watch / You tabs, no taste chart and no Close to this. The bottom bar is Trailer, **Add to watchlist** (amber, in place of Watched) and More.

A hero backdrop and a watchlist poster are different images. Do not try to morph a poster into the backdrop (that idea was explored and dropped).

### Review — `review-ready.png`, `review-saved.png`, `review-edit.png`, `review-delete.png`

- Stars (create, edit, and the rating badges on the Watched grid) are **amber** `#E07A28`, not teal. Teal is used for the “Saved” confirmation only. On create, the locked motion also uses a soft amber glow at 35% intensity. See §6.4.
- **Create** is a Vaul sheet. At first it shows only the stars and “Tap a star to save”. Tapping a star fills up to that rating and **saves the watch immediately**. A teal “Saved” confirmation follows, and then the **date and note slide in, both optional**. There is **no Save button** on create. Changing the date or the note after that first save patches the same watch (the note autosaves on blur). The date starts empty, with **Today** and **Pick a date** chips; leaving it blank keeps the watch undated. This is the locked motion moment. See §6.4 and `review-saved.png`.
- **Edit** (`review-edit.png`) does **not** save on tap, and does **not** autosave the date or note. The user changes the rating, date or note and presses **Save changes**. That amber button may glow; it is a primary action.
- **Delete this watch?** is a confirm dialog (`review-delete.png`). Deleting a film’s only watch must **not** change the film’s status — it stays watched.

Date: a new or edited manual watch must be allowed to have **no date**. Do not write the Letterboxd-import sentinel `1984-09-28` onto a manual watch. See §7.

### Watchlist — `watchlist-unwatched.png`, `watchlist-watched.png`, `watchlist-filter.png`, `watchlist-sort.png`

- Title “Watchlist”, with the **total for the current view** on the line under the title (for example “239 unwatched”, “412 watched”). The filter pills themselves have **no counts**.
- Pills: **Unwatched** (API status `active`), **Watched** (`watched`), **Archived** (`archived`). There is no “All” pill.
- On the Watched grid, an **amber** star badge and the user’s score sit on the poster when that watch has been rated. An unrated film (Sid and Nancy in the mock) has no badge. A score with an unknown date still shows the badge.
- The header has the same **Search films** field as Home, opening the same cmdk card.
- Filter and Sort open Vaul sheets. Filter includes an **On my services** switch, genre chips, and **Short / Medium / Long** runtime chips (see §9 for the minute ranges, which were proposed in the locked notes but not separately confirmed).
- Switching pills uses a calm overlapping crossfade (option 2). See §6.5.
- There is **no next-page button**. When the user reaches 600px from the bottom, the next page of 18 films loads on its own. A flat teal “Loading more” spinner is shown, then the new posters fade in.

### Settings / My services — `settings-my-services.png`

A full page, not a sheet, under the **More** tab, alongside History, Sync and Import. The user chooses the services used to **sort** the Watch tab / Where to watch (subscriptions first) and by the Watchlist **On my services** filter.

The locked PNG (`settings-my-services.png`) still says “It never hides a film.” That copy is **stale**: it dates from before the Watchlist filter existed, and it contradicts the filter toggle, which does hide films that are not on a saved service. Keep both behaviours; a recommended replacement line is in §9, pending Craig.

### History — `history.png`, `history-programme.png`

History sits under the **More** tab. It is a newest-first list of past recommendation nights, and the way back to a previous Tonight’s Programme.

Each night is a **ticket stub**: the date on the stub, the winner’s artwork, title and year, a one-line mood summary, and a small watched mark (Watched, Unwatched or Archived). Light month labels sit above groups of tickets. The stub is **76px** wide, with a perforated edge.

- Search and a Filter button (date range and watch status) sit above the list. Filter opens a Vaul sheet using the locked app-wide sheet timings.
- There is **no Previous / Next**. When the user reaches 600px from the bottom, the next page of **10** nights loads on its own. A flat teal “Loading more” spinner is shown, then the new tickets fade in (300ms, 30ms stagger) — the same infinite-scroll pattern as the Watchlist, with a smaller page because tickets are taller than posters.
- **Opening a past night:** `/history/{id}` (and a tap on a ticket) must open the locked programme layout, titled with the date (for example “Sat 14 Nov”), not “Tonight’s programme” and not the old three-stage ceremony. Skip the questionnaire and the film-strip shuffle. The ticket artwork does not morph into the programme still (they are different crops). Back returns to History. “New pick” stays available. The change uses the shared **400ms** screen crossfade.
- **Removing a night:** swipe the ticket left to reveal a Remove action, or long-press the ticket. Both go through the locked confirm box (“Remove this night?”). A normal tap only shrinks the ticket by 4% and then opens the programme. There is **no amber outline, glow or fill on press**. The rust Remove rail stays hidden behind the ticket until the user is swiping or the rail is revealed.
- Taste of the motion: see §6.7.

### Sync and Import (under More) — no design pass

Sync and Import were not given a design pass. They should use the shared foundations (colour, type, corners, spacing) and the app-wide motion defaults (sheets, toasts, confirms, button press, screen fades). Treat them as a **placeholder to revisit** if the app is ever opened to other users. Do not invent a new look for them without asking.

---

## 6. Motion spec

Shared easing, unless a lock says otherwise:

```css
--cb-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
```

```js
const easeOut = [0.16, 1, 0.3, 1]; // Framer Motion
```

**Reduced motion, default contract:** things appear at once, or fade over **300ms**. No travel, scale or glow, unless a screen’s lock says otherwise. Honour `prefers-reduced-motion: reduce`.

### 6.1 Home — option E, iris from the teal full stop

The signed-off **logo unfold** plays first, at **0.85×** of the original timing: **1730ms at 1× = 2035ms wall-clock**. The wordmark locks at **1610ms at 1× = 1894ms wall-clock**. Files: `motion/00-logo-unfold/`.

Then:

| Step | Value |
| --- | --- |
| Beat after the wordmark locks | 80ms |
| Iris starts | 1974ms wall-clock |
| Iris duration | 760ms |
| Iris easing | ease-in-out / smoothstep, Framer `[0.42, 0, 0.58, 1]` |
| Soft edge | 1.25px → 12px (a soft mask, **not** a glow) |
| Wordmark fade | starts 80ms after the iris starts, lasts 600ms |
| Title, header and tab bar | from 2674ms |
| The rest of the page | from 2734ms, rises 6px, 70ms stagger, 300ms each, ease-out |

**Reduced motion:** skip the splash entirely. Show the settled wordmark and all sections at once. No fade, travel or iris.

Reference: `motion/01-home-iris/option-e.html` and `option-e.mp4` (this recording already matches the locked option).

```js
const irisEase = [0.42, 0, 0.58, 1];

// Iris mask radius, 0–1 progress `u`, smoothstep:
const s = u * u * (3 - 2 * u);
```

### 6.2 Recommendation — constant 420px/s cruise

| Step | Value |
| --- | --- |
| Cruise | **constant 420px/s**, no speed breath |
| Loop | keep cruising until the API has returned **and** a short minimum cruise has played |
| Slow-down | 2.5s, ease `1 - (1 - u)^1.38` |
| Slow-down distance | about **761px** (`(420 × 2.5) / 1.38`) |
| Land | on the winning film |
| Amber highlight | 80ms rise, 120ms hold, 400ms fade, opacity 0.95, `box-shadow: 0 0 18px rgba(224, 122, 40, 0.45)` |
| Expand to the programme hero | 580ms |
| Programme settle | 8px rise, 70ms stagger, 300ms each, ease-out |

Stills are TMDB backdrops. No titles under the frames.

**Minimum cruise:** a fast API response must still shuffle for a short time, so the user sees the motion. An exact floor was not locked. A couple of seconds is enough; agree a number if you need a hard value.

**Reduced motion:** 300ms crossfade from the notes screen to the settled programme. No travel, glow or expand.

**About the files:** `motion/02-recommendation-shuffle/option-b.html`, `option-b.mp4` and `speed-test.html` use the locked values: film stills with no titles, a constant **420px/s** cruise (no breath), then a 2.5s wind-down (`1-(1-u)^1.38`) onto the pick, a brief amber highlight, and a 580ms expand into the programme. The reference clip uses an **8s cruise** as a compact example, then lands on The Witch at 11.3s (clip 14s). In the app the cruise continues until the API has returned and a short minimum has played — the 8s is not a locked floor.

```js
const CRUISE = 420;      // px / s
const SLOW_MS = 2500;
const SLOW_POWER = 1.38;
const slowDist = (CRUISE * (SLOW_MS / 1000)) / SLOW_POWER; // ≈ 761

function slowEase(u) {
  return 1 - Math.pow(1 - u, SLOW_POWER);
}
```

### 6.3 Film detail — taste ticks (option 1)

| Setting | Locked value |
| --- | --- |
| Per-tick delay | 70ms |
| Fill duration | 330ms |
| Easing | ease-out |
| Amber glow | **off** |
| Trigger | when 40% of the chart is in view |
| Row delay | +90ms between rows |
| Tick colour | teal, and **flat** (no glow) |

The longest designed row (Complexity 6.5) takes about 1020ms after the trigger.

**Reduced motion:** 300ms fade of the finished ticks together. No stagger, travel, or eased auto-scroll.

**About the files:** `motion/03-film-detail-ticks/option-1.html` and `option-1.mp4` use these locked values.

```js
const tickTransition = (i) => ({
  duration: 0.33,
  delay: i * 0.07,
  ease: [0.16, 1, 0.3, 1],
});
```

### 6.4 Review — star fill (option 1, create sheet only)

| Setting | Locked value |
| --- | --- |
| Per-star delay | 70ms |
| Fill duration | 330ms |
| Easing | ease-out |
| Bounce on the last star | 30% overshoot over 190ms |
| “Saved” delay | 40ms after the bounce |
| “Saved” fade | 220ms |
| Amber glow | **on**, at 35% intensity |

Edit review still does not save on tap.

**Reduced motion:** 300ms crossfade. No bounce, no glow.

**About the files:** `motion/04-review-star-fill/option-1.html` and `option-1.mp4` use these locked values.

### 6.5 Watchlist — crossfade and infinite scroll (option 2)

| Setting | Locked value |
| --- | --- |
| Fade out | 400ms |
| Fade in | 600ms |
| Overlap | 200ms (the new grid starts 200ms before the old one has gone) |
| Total switch | about 800ms |
| Easing | ease-out |
| Infinite-scroll trigger | 600px from the bottom of the list |
| Page size | 18 |
| New-batch fade | 300ms |
| New-batch stagger | 30ms |
| Loading indicator | a flat teal “Loading more” spinner, no glow |

The 600ms “fetch delay” in the tester is only a fake network wait. Do not build a fake delay into the app — wait on the real request.

**Reduced motion:** a 300ms overlapping crossfade. A new batch fades together over 300ms, with no stagger.

**About the files:** `motion/05-watchlist-crossfade/option-2.html` and `option-2.mp4` use these locked values.

```js
// Filter switch. Out and in overlap by 200ms, so the whole change is 800ms.
const watchlistSwitch = {
  out: { opacity: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  in:  { opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 } },
};
```

### 6.6 App-wide shared patterns

Locked 24 November 2026. Ease-out on all of these.

| Pattern | Locked values |
| --- | --- |
| Bottom sheets (Vaul) | **800ms** up, **700ms** down. Backdrop dim 55%, dim fade 450ms. Drag-to-dismiss 120px |
| Toasts (Sonner) | **700ms** enter, **600ms** exit. Travels 20px. Stays 2800ms |
| Search (cmdk card) | **700ms** open, **600ms** close, from 96% scale |
| Confirm dialogs | 400ms, from 92% scale, 62% dim |
| Amber button press | 4% scale-down, 120ms in, 200ms out |
| Changing screens (tabs, opening a film) | 400ms crossfade |
| NumberFlow | 400ms, same ease. Reduced motion shows the settled figure |
| Synopsis “More” | 300ms height and fade |

**Reduced motion:** 300ms fade, no travel or scale.

**About the files:** `motion/06-app-wide/app-wide.html` and `app-wide.mp4` use these locked values. The clip shortens the toast’s stay to 1400ms so the pass fits in one go; the tester default and the lock remain 2800ms.

```js
export const cueboxEase = [0.16, 1, 0.3, 1];

export const sheetTransition = {
  open:  { duration: 0.8, ease: cueboxEase },
  close: { duration: 0.7, ease: cueboxEase },
};

export const toastTransition = {
  enter: { duration: 0.7, ease: cueboxEase },
  exit:  { duration: 0.6, ease: cueboxEase },
};

export const searchTransition = {
  open:  { duration: 0.7, ease: cueboxEase },
  close: { duration: 0.6, ease: cueboxEase },
};
```

Use the CSS variables in `tokens/tokens.css` so these numbers live in one place.

### 6.7 History — ticket stubs (option 1)

| Setting | Locked value |
| --- | --- |
| Ticket press | 4% scale-down, 120ms in / 200ms out (shared button press) |
| Opening a past night | 400ms crossfade to the locked programme, titled with the date |
| Infinite-scroll trigger | 600px from the bottom of the list |
| Page size | **10** nights |
| New-batch fade | 300ms, 30ms stagger |
| Loading indicator | a flat teal “Loading more” spinner, no glow |
| Month labels | on |
| Perforation on the stub | on |
| Stub width | **76px** |
| Filter sheet | 800ms up / 700ms down (shared) |
| Remove | swipe left to reveal Remove, or long-press; both use the shared confirm box (400ms, 92% scale, 62% dim) |
| Press feedback | scale only — **no amber** outline, glow or fill |

The 600ms “fetch delay” in the tester is only a fake network wait. Do not build a fake delay into the app.

**Reduced motion:** no ticket press (scale stays at 1); a 300ms fade between the list and the programme; a new batch fades together over 300ms, with no stagger.

**About the files:** `motion/07-history/option-1.html` and `option-1.mp4` use these locked values, including the fix that hides the Remove rail until a swipe.

```js
const EASE = [0.16, 1, 0.3, 1];

// Ticket press is scale only. Do not show the Remove rail on a tap.
<motion.article className="ticket" whileTap={{ scale: 0.96 }}
  transition={{ duration: 0.12, ease: EASE }} />

// History out, dated programme in. No poster-to-still morph.
<motion.div animate={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} />
<motion.div animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: EASE }} />
```

---

## 7. Behaviour changes and API notes

These are product behaviours the locked design expects, including a few that the current API may not fully support. The notes below were checked against a local copy of the repo. Please confirm against current `main` before adding or changing endpoints, and do not invent routes that are not needed.

### Watchlist infinite scroll

Replace any next-page control with infinite scroll.

`GET /films` already paginates with `limit` (default **20**, allowed 1–100), `offset`, and `pagination.has_more` (plus `pagination.total`). Call it with **`limit=18`** to match the lock, and request the next page when the user is 600px from the bottom and `has_more` is true.

Existing list filters and sorts that the design can already use: `status` / `statuses`, `search`, `year` / `year_from` / `year_to`, `sort` of `title`, `year`, `created_at`, `watched_at` (and `enrichment_status`), plus `sort_dir`. In the UI, Unwatched is API status `active`, Watched is `watched`, and Archived is `archived`.

The total under the title is the current query’s `pagination.total`. Because the pills no longer show counts, a separate counts endpoint is not required for this design.

### List filters and sorts that need API support

Flag these as work to agree and implement. They are **not** already on `GET /films` in the copy that was checked:

- Filter **“On my services”**. This depends on Settings → My services, and needs the list endpoint (or an agreed equivalent) to honour the user’s chosen providers.
- Filter by **genre** and by **runtime**, if you are implementing those rows of the Filter sheet as shown. Runtime chips in the locked PNG are Short / Medium / Long; proposed minute ranges are in §9.
- Sort by **runtime** and by **rating**. Date added, title and year already exist (`created_at`, `title`, `year`). Which rating to sort by was never locked — see §9.

### Review dates and deleting a watch

- **Nullable `watched_at`:** a manually created or edited watch must be allowed to have no date. Do not write `1984-09-28` (the Letterboxd-import sentinel) onto a new or edited manual watch. In the copy that was checked, `UpdateWatchRequest.watched_at` is still a required `date`.
- **Delete a finalized watch:** the create flow can leave a watch the user may later want to remove. In the copy that was checked, `DELETE /films/{film_id}/watch-review` exists for a pending draft, and `PATCH /films/{film_id}/watches/{watch_id}` exists, but a dedicated delete of a finalized watch (for example `DELETE /films/{film_id}/watches/{watch_id}`) was not found. If it is still missing, it needs adding. Deleting a film’s only watch must **not** change the film’s status — it stays watched.
- Edit review does not auto-save the rating, date or note — the user presses Save changes. On create, the star tap saves the watch at once; the date and note that then appear have no Save button, and changes patch the same watch (the note autosaves on blur).


### History list, open and remove

`GET /recommendations` already returns a paginated history list (limit/offset, default 20) with the winner’s poster, title, year, preference summary, created date, and the winner’s current watch status. Search by title and filters for date range and watch status already exist. `GET /recommendations/{session_id}` returns the winner, up to four runners-up, explanations, and the profile summary needed for the dated programme. `DELETE /recommendations/{session_id}` removes an entry.

For this design:

- Call the list with **`limit=10`**, and use infinite scroll (trigger 600px from the bottom) instead of Previous / Next.
- Opening `/history/{id}` (or the equivalent session route in the app) **must** land on the locked programme layout with a date title (for example “Sat 14 Nov”). Do not open the old three-stage ceremony, and do not replay the shuffle.
- Remove is swipe-left to reveal Remove, or a long-press. Both must go through the confirm box before calling `DELETE`.
- The list endpoint currently returns a poster URL, not a backdrop. If the ticket shows a poster and the programme a backdrop, do not morph one into the other.

### Other behaviours already implied by the screens

- One-tap **Add to watchlist** from the lighter TMDB-only detail page, with a Sonner toast.
- Surprise me and Where to watch are Vaul sheets, not new pages. “Get a pick for tonight” and the Recommend tab start the 11-step questionnaire.
- Search is the header **Search films** field, opening the cmdk card, on Home and Watchlist.
- Trailer (bottom bar) and **Close to this on your watchlist** (You tab, unwatched films only) are in scope.
- `GET /films/{film_id}/watch-providers` already exists for Where to watch.
- TMDB search already exists (`/films/tmdb-search` in the copy that was checked).

---

## 8. Acceptance checklist

A short, testable copy also lives in `CHECKLIST.md`. Use that while implementing. The important bars:

- Tokens match §3. Only amber glows. Teal is flat. No default shadcn grey or Inter.
- Each screen matches its PNG in layout, type, and colour, at 390 × 844.
- Each motion moment matches the locked table in §6, including reduced motion.
- Shared overlays use the app-wide timings in §6.6.
- Tab bar is Home, Watchlist, Recommend, More.
- Watchlist pills are Unwatched / Watched / Archived (no All). Infinite scroll (18, trigger 600px), not a next-page button.
- History pages in with infinite scroll (10, trigger 600px). `/history/{id}` opens the dated programme, not the old ceremony. Remove is swipe-left or long-press, both through the confirm box, with no amber on press.
- Recommendation is 11 questions, one at a time, then the shuffle, then the programme.
- Stars and watchlist rating badges are amber. Create review saves the watch on a star tap; date and note then autosave (no Save button). Edit review uses Save changes.
- Manual watches can have no date, and never receive the 1984 sentinel.
- Sync and Import use shared defaults only.
- Reduced motion is honoured on every moment above.

---

## 9. Gaps and open questions

These were never fully designed, or were left as a later decision. Do not invent a look for them without asking.

### Open questions for Craig

These were not locked in the earlier decisions. The recommendations below are for Craig to confirm; they are not instructions to invent a new design.

- **My services wording.** The locked PNG says “It never hides a film,” but the Watchlist “On my services” toggle does hide films. Recommendation: keep both behaviours (the list sorts Where to watch, and the filter can narrow the Watchlist) and change the line to: “Used to sort Where to watch, so your subscriptions come first, and by the On my services filter on the Watchlist. You can change this whenever you like.” The PNG is stale until that copy is confirmed.
- **Runtime filter buckets.** The locked Filter sheet shows Short, Medium and Long, but the exact minute cuts were only proposed in the notes. Recommendation: Short ≤ 90 minutes, Medium 91–150 minutes, Long over 150 minutes (close to the questionnaire’s ≤ 90 / ≤ 150), and leave a chip unselected to ignore runtime.
- **Sort by rating.** The Sort sheet includes rating, but which score to use was never decided (personal score vs TMDB, Rotten Tomatoes or Letterboxd). Recommendation: on Watched, sort by the user’s own rating; on Unwatched and Archived, sort by TMDB (Letterboxd ratings are not stored on list rows today).
- **How Home rails are filled.** Today’s feature is one watchlist film, once a day, and the four named rails are watchlist-only, but the rule for putting a film in “Folk dread” or “Quiet heartbreak” was not locked. Recommendation: pick from the watchlist using each film’s genre, mood and runtime metadata, and allow the rails to refresh over time.

### Other gaps

- **Sync and Import** (under More) had no design pass. Use the shared foundations and app-wide motion defaults, and treat them as a placeholder to revisit if the app is ever opened to other users.
- **Archive / Remove confirmations on a film** (the More sheet on Film detail) were not designed. The locked mocks have no confirm on those actions. This is separate from **History**, where Remove *does* go through the confirm box.
- **No undo** on toasts.
- **Date picker:** native, unless a custom calendar is introduced (then a Vaul sheet).
- **Minimum cruise** on Recommendation: no exact floor was locked. See §6.2.
- Some mock posters, scores and trailers are stand-ins. Use real TMDB artwork and real user data in the app. The Watchlist tester also used plain text tiles for extra films when artwork was missing — the real app should always show posters. Some later History tickets use typographic stand-in artwork for the same reason.
- **Figma is not up to date** and is not the source of truth.

---

## 10. File map

```
cuebox-handoff/
  README.md
  README.html
  Cuebox-handoff.pdf
  CHECKLIST.md
  draft-message-to-developer.txt
  tokens/tokens.css
  tokens/tokens.json
  screens/                  final phone PNGs and overview.png
  motion/
    00-logo-unfold/
    01-home-iris/           option-e.html, option-e.mp4
    02-recommendation-shuffle/   option-b.html, option-b.mp4, speed-test.html
    03-film-detail-ticks/   option-1.html, option-1.mp4
    04-review-star-fill/    option-1.html, option-1.mp4
    05-watchlist-crossfade/ option-2.html, option-2.mp4
    06-app-wide/            app-wide.html, app-wide.mp4
    07-history/             option-1.html, option-1.mp4
```

Open any HTML tester from its own folder so the relative `art/` and `fonts/` paths resolve.
