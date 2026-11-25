History — ticket stubs (option 1), locked.

Each past recommendation night is a cinema ticket: the date on the stub, the
winner’s artwork, title, year, a one-line mood summary, and a small watched
mark. Month labels group the list. The stub is 76px wide, with a perforated
edge.

Open option-1.html in a desktop browser, from this folder, so art/ and fonts/
resolve. The sliders are already set to the locked values.

Locked values
-------------
Shared (already locked app-wide or on Watchlist):
  Ticket press          4% scale-down, 120ms in / 200ms out
  Screen crossfade      400ms, ease-out
  Infinite scroll       trigger 600px from the bottom
  Page size             10 nights
  New-batch fade        300ms, 30ms stagger
  Loading more          flat teal spinner, no glow
  Filter sheet          800ms up / 700ms down, 55% dim over 450ms
  Confirm box           400ms, from 92% scale, 62% dim

History-only (now locked as built):
  Month labels          on
  Perforation           on
  Stub width            76px

The 600ms fetch delay in the tester is a stand-in for the network. Do not
build a fake delay into the app.

Behaviour
---------
- /history/{id} must open the locked Tonight’s Programme layout, titled with
  the date (for example “Sat 14 Nov”), not the old three-stage ceremony.
  Do not replay the film-strip shuffle, and do not morph the ticket artwork
  into the programme still.
- Infinite scroll of 10 nights per page replaces Previous / Next.
- To remove a night: swipe the ticket left to reveal Remove, or long-press
  the ticket. Both go through the confirm box. A normal tap only shrinks
  the ticket slightly, then opens the programme. There is no amber outline,
  glow or fill on press. (An earlier recording showed the rust Remove rail
  peeking out behind a pressed ticket; that rail stays hidden until a swipe.)

Reduced motion: no ticket press (scale stays at 1), a 300ms fade between
the list and the programme, and a new batch fading in together over 300ms
with no stagger.

The reference video option-1.mp4 was recorded at these locked values, after
the Remove-rail press fix.
