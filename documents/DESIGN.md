---
name: Modern Neo-Noir Cinema
colors:
  surface: '#121411'
  surface-dim: '#121411'
  surface-bright: '#383a36'
  surface-container-lowest: '#0d0f0c'
  surface-container-low: '#1a1c19'
  surface-container: '#1e201d'
  surface-container-high: '#292b27'
  surface-container-highest: '#333532'
  on-surface: '#e3e3de'
  on-surface-variant: '#c3c8bd'
  inverse-surface: '#e3e3de'
  inverse-on-surface: '#2f312e'
  outline: '#8d9288'
  outline-variant: '#434840'
  surface-tint: '#aed0a3'
  primary: '#aed0a3'
  on-primary: '#1b3717'
  primary-container: '#486641'
  on-primary-container: '#c0e2b4'
  inverse-primary: '#486641'
  secondary: '#cccc5c'
  on-secondary: '#323200'
  secondary-container: '#717100'
  on-secondary-container: '#f6f681'
  tertiary: '#aed0a3'
  on-tertiary: '#1b3717'
  tertiary-container: '#486641'
  on-tertiary-container: '#c0e2b4'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c9ecbd'
  primary-fixed-dim: '#aed0a3'
  on-primary-fixed: '#052104'
  on-primary-fixed-variant: '#314e2b'
  secondary-fixed: '#e8e875'
  secondary-fixed-dim: '#cccc5c'
  on-secondary-fixed: '#1d1d00'
  on-secondary-fixed-variant: '#494900'
  tertiary-fixed: '#c9ecbd'
  tertiary-fixed-dim: '#aed0a3'
  on-tertiary-fixed: '#052104'
  on-tertiary-fixed-variant: '#314e2b'
  background: '#121411'
  on-background: '#e3e3de'
  surface-variant: '#333532'
typography:
  h1-desktop:
    fontFamily: Cabin
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  h1-mobile:
    fontFamily: Cabin
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  h2:
    fontFamily: Cabin
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Libre Franklin
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Libre Franklin
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  title-lg:
    fontFamily: Space Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  margin-mobile: 16px
  margin-desktop: 48px
  max-width: 1280px
---

# Cuebox Design System
## Core Philosophy
- **Theme Name:** The Modern Neo-Noir Cinema / Used Future
- **Vibe:** Ultra-dark, minimalist, atmospheric dark mode built for focused, late-night cinematic evaluation. Inspired by the brutalist, high-contrast, utilitarian aesthetics of *Alien* and *Blade Runner*.
- **Visual Style:** High-contrast typography paired with dark, desaturated surface structures. The UI utilizes a stark juxtaposition between clean, readable headers and raw, unformatted monospace technical data to create a tactical, immersive experience.

## Design Tokens
### Color Palette
- `--color-bg-main`: `#111411` (Deep Space Black - Main application viewport background)
- `--color-bg-surface-low`: `#1a1c19` (Slate Charcoal - Base content containers and neutral anchor)
- `--color-bg-surface-high`: `#282a27` (Elevated Slate - Highlighted cards and modal sheets)
- `--color-seed-brand`: `#486641` (Deep Tactical Green - The core DNA of the system's atmospheric tone)
- `--color-accent-primary`: `#486641` (Deep Tactical Green - Primary branding and atmospheric foundation)
- `--color-accent-secondary`: `#cccc5c` (Sulfurous Lime - High-visibility highlights, focus rings, and critical interactive feedback)
- `--color-accent-tertiary`: `#aed0a3` (Pale Tactical Mint - Primary call-to-actions, active states, and core tactical interface elements)
- `--color-text-primary`: `#e2e3dd` (Pure Off-White - High-priority header elements, titles, and structural labels)
- `--color-text-secondary`: `#c2c8bd` (Muted Grey-Green - Body text, LLM narrative summaries, and detailed explanations)
- `--color-error`: `#ffb4ab` (Harsh Red - Warning markers and destructive actions)
- `--color-outline`: `#424840` (Translucent Olive-Grey - Subtle dividers and card borders)

### Typography
- **Headings & Main Titles (`h1`, `h2`):** `Cabin` (Modern sans-serif with excellent legibility and a clean cinematic presence)
  - `h1` (Desktop): `40px` size, `48px` line-height, `-0.02em` tracking, `700` weight
  - `h1` (Mobile): `32px` size, `38px` line-height, `700` weight
  - `h2`: `24px` size, `32px` line-height, `600` weight
- **Body Text & Paragraphs (`p`, list items):** `Libre Franklin` (Classic, highly versatile sans-serif offering premium micro-legibility for extensive AI explanation blocks)
  - `body-lg`: `18px` size, `28px` line-height, `400` weight
  - `body-md`: `16px` size, `24px` line-height, `400` weight
- **Metadata & Technical UI (`span`, tag lists, scores, runtime):** `Space Mono` (Harsh, utilitarian monospace engineered for precise hardware-like readouts)
  - `title-lg`: `20px` size, `28px` line-height, `0.01em` tracking, `600` weight
  - `label-md`: `14px` size, `20px` line-height, `0.05em` tracking, `600` weight

## Component Layout & Shapes
- **Spacing Scale:** Multiples of 8px (`xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 32px`) to guarantee geometric balance. Desktop margins are `48px` and mobile margins are `16px`.
- **Breakpoints:** Mobile-first architecture transitioning to desktop layouts at `md: 768px`. Maximum container width is locked at `1280px` (`max-w-7xl`).
- **Hardware Borders (Sci-Fi Brutalism):** Avoid fully rounded pills. Utilize soft industrial `4px` (`rounded-DEFAULT`) corners on all container frames and image wrappers to maintain a durable feel. Primary interaction buttons utilize CSS `clip-path` to create chamfered (angled cut-off) corners.
- **Outlines:** Thin `1px` crisp borders utilizing translucent variations of `--color-outline` to separate UI segments without adding visual clutter.

## Interactive States & Environmental Effects
- **Hover States (Hardware Activation):** Interactive cards and primary elements emit a subtle, focused glow using `--color-accent-tertiary` to mimic status lights on a terminal.
- **Active/Pressed States (Neon Flicker):** Elements experience a simulated power-drain effect. Upon click, button fill opacity drops to `70%` combined with a harsh inner shadow, mimicking a flickering light or a tactile hardware depress.
- **Disabled States:** Elements shift to `50%` opacity, desaturate to greyscale, and apply a `cursor-not-allowed` property, visually communicating an offline or disconnected terminal state.
- **Environmental Texture (The Used Future):** The main application viewport (`<main>`) applies a fixed, subtle CSS film grain or horizontal CRT scanline overlay. This breaks up perfect pixels, establishing a gritty, analog, and deeply cinematic atmosphere.

### Results screen (`results-view.tsx`)
- **Winner card:** two-column layout — full-height poster column flush to the left edge; text column with TOP PICK badge, title, director/runtime, TMDB/RT scores, synopsis, key factors, then why it matches (plus why it beat alternatives and caveats when present).
- **Ratings row:** `Space Mono` (`font-mono`); display **TMDB** (0–10, one decimal) and **RT** (`%` or `—`). Letterboxd is not shown on results cards (film detail still shows all ratings).
- **Key factor tags:** `Badge variant="secondary"` (lime secondary tokens).
- **Runners-up grid:** standard cards with `hover-glow`; same ratings row as winner.
- **Card navigation:** full-card hit target via a positioned overlay `Link` with a concise `aria-label` (e.g. “View {title} in watchlist”); explanation text stays outside the link’s accessible name. Page-level actions (answer summary, new recommendation) remain separate controls.

## Iconography
- **Library:** Material Symbols Outlined.
- **Base Rules:** Outlined by default (`font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`), switching to filled (`'FILL' 1`) strictly for active/selected navigation states or pressed toggles.
