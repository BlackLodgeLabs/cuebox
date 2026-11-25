App-wide shared motion — locked 24 Nov 2026.

Locked values that differ from the original recommended defaults
(already set as the defaults in app-wide.html / app-wide.js):
  Bottom sheets: 800ms up, 700ms down.
  Toasts: 700ms enter, 600ms exit.
  Search: 700ms open, 600ms close.

Everything else stays on the recommended defaults:
  ease-out throughout; sheet dim 55% fading over 450ms; drag-to-dismiss 120px;
  toast travels 20px and stays 2800ms; search opens from 96% scale;
  confirm boxes 400ms from 92% scale with 62% dim;
  amber button press 4% scale-down, 120ms in / 200ms out;
  screen changes 400ms crossfade; NumberFlow 400ms.

app-wide.mp4 was recorded at these locked values. The clip shortens the toast’s stay to 1400ms so the pass fits in one go; the tester default and the lock remain 2800ms.

Reduced motion: 300ms fade, no travel or scale. NumberFlow shows the settled figure at once.

Open app-wide.html (needs this folder’s art/ and fonts/).
