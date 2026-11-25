Watchlist filter switch and infinite scroll — locked option 2.

Locked values (already set as the defaults in option-2.html / option-2.js):
  fade out 400ms, fade in 600ms, overlap 200ms (a switch takes about 0.8s), ease-out.
  Infinite scroll: start loading 600px from the bottom, page size 18,
  new films fade in over 300ms, staggered 30ms, with a flat teal “Loading more” spinner (no glow).

The 600ms fetch delay in the mock is only to simulate the network. Do not build a fake delay into the app.

option-2.mp4 was recorded at these locked values.

Reduced motion: 300ms overlapping crossfade; a new batch fades together over 300ms, with no stagger.

Open option-2.html (needs this folder’s art/ and fonts/).
