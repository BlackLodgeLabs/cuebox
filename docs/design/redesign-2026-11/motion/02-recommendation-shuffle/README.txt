Recommendation shuffle — locked cruise is a constant 420px/s, with no speed breath.

The stills are TMDB backdrops, with no titles under the frames. After “Find my
pick”, the strip cruises at a constant 420px/s until the API has returned and
a short minimum cruise has played, then winds down over 2.5s with ease
1-(1-u)^1.38 (about 761px), lands on the pick, shows a brief amber highlight,
and expands into the programme over 580ms.

option-b.html and speed-test.html default to these locked values.
option-b.mp4 is a recording of the same locked motion. The clip uses an 8s
cruise as a compact example (not a locked floor), then lands on The Witch at
11.3s (clip 14s). In the app the cruise can run longer — typically 20–30s.

An earlier option-B recording used 260px/s with a gentle ±7% breath; that
version is not in this pack. Implement the 420px/s constant cruise.
