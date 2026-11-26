# Motion references

Each folder is a self-contained mock. Open the HTML file from inside that folder so `art/` and `fonts/` resolve. A short `README.txt` in the folder repeats the locked values and, where it matters, how the MP4 differs from the lock.

The interactive HTML testers in this pack have their slider defaults set to the locked values. Reference MP4s in this pack were recorded at those values unless a row below says otherwise. Trust `../README.md` §6 and the tester defaults if a clip ever differs.

| Folder | Moment | HTML | MP4 vs lock |
| --- | --- | --- | --- |
| `00-logo-unfold` | Logo unfold at 0.85× | `index.html` | Matches |
| `01-home-iris` | Option E iris from the teal full stop | `option-e.html` | Matches |
| `02-recommendation-shuffle` | 420px/s cruise, 2.5s wind-down, stills, no titles | `option-b.html`, `speed-test.html` | Matches the lock. The clip uses an 8s cruise as a compact example (lands at 11.3s, clip 14s). |
| `03-film-detail-ticks` | Taste ticks, 70 / 330, glow off | `option-1.html` | Matches |
| `04-review-star-fill` | Star fill, bounce 30%/190ms, glow on 35% | `option-1.html` | Matches |
| `05-watchlist-crossfade` | 400 / 600 / 200 overlap, infinite scroll | `option-2.html` | Matches |
| `06-app-wide` | Sheets 800/700, toasts 700/600, search 700/600 | `app-wide.html` | Matches. The clip shortens toast stay to 1400ms (lock is 2800ms). |
| `07-history` | Ticket stubs, page 10, dated programme, swipe/long-press Remove | `option-1.html` | Matches the lock, including the Remove-rail press fix. |

Reduced-motion preview is a checkbox on each tester.
