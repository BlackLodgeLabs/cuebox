# Cuebox mobile UI — product brief

Status: **Decisions locked** (fact-finding complete). Ready for a UI designer or design-implement pass after prerequisites below.

Audience: UI designer (human or agent) taking over visual/IA work for Cuebox’s phone-first experience.

Related docs: [DESIGN.md](DESIGN.md) (visual system), [PRD.md](PRD.md) (product requirements), [how-cuebox-works.md](how-cuebox-works.md), [ROADMAP.md](ROADMAP.md).

---

## 1. Product in one paragraph

Cuebox is a locally hosted, single-user app that helps someone decide **what to watch tonight from their own Letterboxd-derived watchlist**. It does not discover new films. The tone is a trusted film-loving friend, not a search engine. Recommendations may vary between runs. The app is used ~90% of the time on a phone.

---

## 2. Locked design decisions

### D1 — Scope of visual change

**Tighten Neo-Noir for mobile.** Keep existing tokens, typography, icon language, and cinematic vibe from [DESIGN.md](DESIGN.md). Redesign navigation, hierarchy, density, and phone layouts inside that system. Do not rebrand.

### D2 — Platform reality

**Mobile web in Chrome** over LAN or Tailscale. No PWA / add-to-home-screen requirements in this pass. Design for occasional slow or unreachable API (network hiccups); clear loading, retry, and “can’t reach Cuebox” states matter.

### D3 — Primary navigation

**Bottom tabs:** Home · Watchlist · Recommend · More  

- **More** → Settings (sync, etc.)
- **Review** (ambiguous metadata matches) → **top notification badge**, not a tab
- **No FAB**

### D4 — Hierarchy of jobs

**Home is the default landing** and acts as a hub of quick links:

1. **Add a film** → opens **search-picker** (see prerequisites)
2. **Create a recommendation** → Recommend flow
3. **Mark a film watched** → opens the **same search-picker** (Mark watched vs Add depending on whether the title is already on the list)
4. **History** → history list (History is **not** a bottom tab)

**Recommend** remains a primary product job: visible as both a Home CTA and its own tab.

### D5 — Results / recommendation ceremony

Fresh recommendations use a **mandatory 3-stage ceremony** (Continue/Next only between stages; **no skip**):

| Stage | Content |
|-------|---------|
| **1 — Winner** | Singular focus. Poster-led winner + **short** reasons only (key factors + short “why it matches”). Must feel special. |
| **2 — Runners-up** | Swipeable poster row. Focused runner-up uses a **winner-like** layout (poster + reasons). |
| **3 — Session record** | All five films together with **full** metadata, reasons, where-to-watch, questionnaire/answer summary, and deep access. |

**History** detail views **land on stage 3**. Stage 3 includes a control to **replay the ceremony**: stages **1 → 2**, then return to **3** (not a full 1→2→3 loop unless replay is started again).

Where-to-watch and questionnaire summary live on **stage 3**, not on the ceremony stages.

### D6 — Watchlist metaphor

**Poster-first grid** (posters are the primary visual asset app-wide when they don’t fight the job):

- Poster + **title below only**
- **⋯** on the poster (e.g. top-right) for actions: watched / archive / etc.
- **No metadata** on grid cells
- **Filter** control (top-right) opens a filter/sort menu driven by Cuebox-stored metadata
- Status tabs remain: Watchlist / Watched / Archived (product model per lifecycle work)

### D7 — What this pass optimizes for

**Nightly-first + solid first-run basics.** Hero polish on Home, ceremony, watchlist, film detail, recommend questionnaire. Import, enrichment progress, match review, and settings must be clear and complete—not abandoned—but need not match ceremony-level art direction.

### D8 — Accessibility & motion

**Atmosphere with escapes.** Keep Neo-Noir cinematic default (including grain/scanlines language). Honor `prefers-reduced-motion`. Maintain strong readability for titles and reason text on phone screens. No essential actions that exist only via hover/glow.

### D9 — v1 scope (this UI initiative)

**In scope — full primary app reskin:**

- App shell (tabs + Review badge)
- Home hub
- Recommend questionnaire (mobile density)
- Results ceremony 1→2→3 + history replay
- Watchlist poster grid + filter sheet
- Film detail (poster-led, consistent actions)
- Import / enrichment progress
- Match review
- Sync/settings under More

**Out of scope:**

- Insights / Ask ([ROADMAP.md](ROADMAP.md) / #51)
- PWA
- Developer Mode visual redesign
- Roadmap placeholder screens

**Prerequisite (must ship before this UI pass):** Home search-picker feature — see §5.

### D10 — Success criteria

Use **A–F as a checklist**. **Fail the pass** if **A, D, or B** are not met.

| ID | Criterion | Severity |
|----|-----------|----------|
| **A** | Flow efficiency: from Home, start a recommendation in ≤ 2 taps; ceremony 1→2→3 has no dead ends; History opens at stage 3; replay does 1→2 then back to 3 | **Fail if missing** |
| **D** | Ceremony quality: winner stage is singular; runners-up swipe focus is obvious; stage 3 clearly reads as the durable session record | **Fail if missing** |
| **B** | Poster-first clarity: watchlist is posters + titles only; actions via ⋯; filters reachable without breaking the grid metaphor | **Fail if missing** |
| **C** | One-handed usability: primary nav in thumb zone; key CTAs ~≥44px; no essential hover-only actions | Checklist |
| **E** | First-run not broken: empty→import obvious; enrichment progress understandable; Review badge visible when needed and opens review | Checklist |
| **F** | Atmosphere without harm: Neo-Noir preserved; reduced-motion honored; titles/reasons readable on phone | Checklist |

Also confirm: where-to-watch and full reasons live on stage 3 (per D5).

---

## 3. Design system constraints (sacred)

From [DESIGN.md](DESIGN.md) / `frontend/src/styles/tokens.css`:

- Theme: Modern Neo-Noir Cinema / Used Future
- Dark surfaces, tactical green + sulfurous lime accents
- Type: Cabin (headings), Libre Franklin (body), Space Mono (meta/technical)
- Icons: Material Symbols Outlined (filled only for active/selected)
- Soft industrial radii; chamfered primary buttons; avoid generic pill-heavy / purple-glow AI defaults
- Mobile-first breakpoint mindset (`md` ~768px); mobile margins 16px

Designers may refine **layout and component composition**; they should not replace the brand system unless a later decision explicitly reopens D1.

---

## 4. Screen / flow inventory for v1

| Surface | Role in this brief |
|---------|-------------------|
| Home | Default hub; quick links; Review badge |
| Watchlist | Poster grid; ⋯ actions; filter sheet; status tabs |
| Recommend | Questionnaire; entry to ceremony |
| Ceremony 1–2 | Fresh pick ritual |
| Stage 3 / History detail | Durable record + replay entry |
| History list | Reachable from Home (not a tab) |
| Film detail | Poster-led; status actions; metadata |
| Import + job status | First-run / rare; must be clear |
| Match review | Via top badge |
| More → Sync/settings | RSS, CSV, etc. |

---

## 5. Functional prerequisites (before UI review)

These are **product/API/UX features**, not pure visual redesign. Deliver them (or agreed stubs with real behavior) **before** the mobile UI pass starts so Home and watchlist actions are not fake.

### P1 — Home search-picker (required prerequisite)

From Home quick actions for **add film** and **mark watched**:

1. Open a **search / picker** UI.
2. Search **both TMDB and the user’s Cuebox watchlist** (combined results).
3. If the film is **already on the watchlist** → show **Mark watched** (and related status actions as appropriate).
4. If the film is **not** on the watchlist → show **Add to watchlist** (existing add-film capability wired into this picker).

Notes for implementation planning:

- Likely needs a unified search API or client merge of TMDB search + local film search.
- Must respect film lifecycle rules (active / watched / archived) already in the product.
- UI pass will **style and place** this picker; it should not invent the behavior.

### Other dependencies to verify before UI kickoff

- Watchlist status transitions and tabs behave as intended on current main (lifecycle model).
- Watch providers (“where to watch”) available for stage 3.
- History detail can reopen a full recommendation session payload (needed for stage 3 + ceremony replay).

---

## 6. Out of scope reminders

- Multi-user / auth
- Letterboxd write-back
- Insights dashboard / Ask
- Rebrand or new design-token theme
- Installable PWA
- Treating Desktop as the primary canvas (desktop may follow mobile patterns)

---

## 7. Suggested designer kickoff pack

1. This brief  
2. [DESIGN.md](DESIGN.md) + live app on a phone viewport (Chrome, LAN/Tailscale)  
3. Screenshots of current: Home, questionnaire step, results, watchlist, film detail, import, review  
4. Sample content: long vs short “why it matches”; missing poster; missing RT; enrichment-not-ready  
5. Confirmation that **P1 search-picker** is done or scheduled immediately before UI work  

### Expected design outputs

- Mobile wireframes: shell, Home, ceremony 1–2–3, watchlist grid + filter sheet, film detail  
- Hi-fi for those surfaces within Neo-Noir  
- Motion notes for ceremony (and reduced-motion fallback)  
- Redlines / token deltas only if composition requires them (not a new brand)

### For a Cursor agent specifically

Treat this document as **hard constraints**. Do not invent a new visual brand. Do not skip ceremony stages. Do not put metadata on watchlist grid cells. Do not add a FAB or a History tab. Fail the PR if success criteria **A, D, or B** are unmet.

---

## 8. Decision log (source)

| # | Topic | Choice |
|---|--------|--------|
| 1 | Visual scope | Tighten Neo-Noir for mobile |
| 2 | Platform | Chrome mobile via LAN/Tailscale; no PWA this pass |
| 3 | Nav | Bottom: Home, Watchlist, Recommend, More; Review = top badge; no FAB |
| 4 | Hierarchy | Home hub default; Recommend highly visible (CTA + tab); History via Home |
| 5 | Results | 3-stage ceremony; short reasons on 1; full record on 3; history→3; replay 1→2→3 |
| 6 | Watchlist | Poster + title grid; ⋯ actions; filter sheet; no cell metadata |
| 7 | Optimization | Nightly-first + solid first-run basics |
| 8 | A11y/motion | Atmosphere + reduced-motion/contrast guardrails |
| 9 | v1 scope | Full primary reskin; Home picker is **prerequisite**, not in-pass feature work |
| 10 | Success | Checklist A–F; fail on A/D/B |
