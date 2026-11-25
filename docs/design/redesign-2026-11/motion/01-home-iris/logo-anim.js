
    /**
     * Timing (1×), total 1730ms, snappy left-to-right reel cascade:
     *   0–150ms     hold the L6 icon
     *   150ms       C starts sliding left / shrinking; icon square drops away;
     *               first reel starts
     *   150 + n·190  reel n starts (u, e, b, o, x, then the full stop)
     *   each letter reel: 420ms drop (square passes, letter follows) + 90ms settle
     *   stop reel: same drop window, square shrinks onto the baseline and locks
     *   1610–1730ms brief hold on the final "Cuebox."
     *
     * Geometry of the start monogram is taken from the logo sheet, at the
     * 130px wordmark scale (same calibration as the previous prototype):
     *   L1 wordmark ink: (184,77) 342×106  within a 710×264 card
     *   L6 monogram C:   (266,51) 77×157   (Big Shoulders 800 @ 192px)
     *   L6 square:       (378,112) 58×58, radius ~21%
     * A +4px X nudge centres the monogram on the same stage as L1.
     */
    const HOLD = 150;
    const STAGGER = 190;
    const REEL = 420;
    const SETTLE = 90;
    const TAIL = 120;
    const N_REELS = 6; // u e b o x and the full stop
    const LAST_START = HOLD + (N_REELS - 1) * STAGGER; // 1100
    const LAST_LOCK = LAST_START + REEL + SETTLE;      // 1610
    const TOTAL = LAST_LOCK + TAIL;                    // 1730

    const DROP_EASE = "cubic-bezier(0.33, 0.0, 0.67, 1)";
    const C_EASE = "cubic-bezier(0.22, 0.82, 0.24, 1)";
    const SETTLE_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

    const FS_END = 130;
    const FS_START = 192;
    const WT_END = 700;
    const WT_START = 800;
    const OVERSHOOT = 0.05; // em, letter travels this far past the target before settling

    const L1_C = { x: 184, y: 77, w: 49, h: 106 };
    const L6_C = { x: 266 + 4, y: 51, w: 77, h: 157 };
    const L6_SQ = { x: 378 + 4, y: 112, w: 58, h: 58 };

    const LETTERS = [
      { id: "reel-u", letter: "u" },
      { id: "reel-e", letter: "e" },
      { id: "reel-b", letter: "b" },
      { id: "reel-o", letter: "o" },
      { id: "reel-x", letter: "x" },
    ];

    const params = new URLSearchParams(location.search);
    const frame = params.get("frame"); // "start" | "end" | "mid"
    const record = params.has("record");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      && !record && !frame;

    if (record) document.body.classList.add("record");
    if (frame) document.body.classList.add("frame");

    const SPEED_MIN = 0.1;
    const SPEED_MAX = 1;
    const SPEED_STEP = 0.05;
    const SPEED_DEFAULT = 0.85;

    function parseSpeed(raw) {
      const n = Number(raw);
      if (!Number.isFinite(n)) return SPEED_DEFAULT;
      const snapped = Math.round(n / SPEED_STEP) * SPEED_STEP;
      const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, snapped));
      return Math.round(clamped * 100) / 100;
    }

    function formatSpeed(rate) {
      const n = Math.round(rate * 100) / 100;
      const label = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
      return label + "×";
    }

    function playDuration(rate) {
      return Math.round(TOTAL / rate);
    }

    let speed = parseSpeed(params.get("speed") ?? SPEED_DEFAULT);
    let animations = [];

    const logo = document.getElementById("logo");
    const wordmark = document.getElementById("wordmark");
    const slotC = document.getElementById("slotC");
    const cLive = document.getElementById("cLive");
    const square = document.getElementById("square");
    const reelStop = document.getElementById("reel-stop");
    const stopDot = document.getElementById("stopDot");
    const periodProbe = document.getElementById("periodProbe");

    function relBox(el, origin) {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - origin.left,
        y: r.top - origin.top,
        w: r.width,
        h: r.height,
      };
    }

    /**
     * Left/top side-bearings of the C, as a fraction of font-size, measured
     * from the typographic box (line-height 1, top-left origin) to the ink.
     * Calibrated in Chromium for Big Shoulders opsz 72 at 700 and 800.
     */
    function bearings(weight) {
      return weight >= 800
        ? { l: 0.0365, t: 0.0781 }
        : { l: 0.0385, t: 0.0769 };
    }

    /**
     * Measure Big Shoulders 700 @ opsz 72: baseline in the 1em typographic
     * box, and the period's ink so the teal full stop can sit on the baseline
     * at typographic size. Canvas bounding-box metrics alone report the font
     * box (taller than 1em) for a ".", so the period is pixel-scanned.
     */
    function measurePeriod(fsEnd) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.font = `700 ${fsEnd}px "Big Shoulders"`;
      ctx.textBaseline = "alphabetic";
      const m = ctx.measureText(".");
      const fAscent = m.fontBoundingBoxAscent;
      const fDescent = m.fontBoundingBoxDescent;
      const halfLeading = (fsEnd - (fAscent + fDescent)) / 2;
      const baseline = halfLeading + fAscent;
      const advance = m.width;

      const pad = Math.ceil(fsEnd);
      canvas.width = pad * 2;
      canvas.height = pad * 2;
      ctx.font = `700 ${fsEnd}px "Big Shoulders"`;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff";
      const ox = pad, oy = pad;
      ctx.fillText(".", ox, oy);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0, hits = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (img[(y * canvas.width + x) * 4] > 20) {
            hits++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      // Fall back to a 0.15em square if the font has not painted yet.
      let inkW = fsEnd * 0.15, inkH = fsEnd * 0.15, inkLeft = (advance - inkW) / 2;
      if (hits > 0) {
        inkW = maxX - minX + 1;
        inkH = maxY - minY + 1;
        inkLeft = minX - ox;
      }
      // Use a square rounded-box at the period's ink width, sitting on the baseline.
      const side = Math.max(inkW, inkH);
      return {
        w: side,
        h: side,
        advance,
        inkLeft,
        baseline,
        inkTop: baseline - side,
      };
    }

    function geometry() {
      const origin = logo.getBoundingClientRect();
      const slot = relBox(slotC, origin);
      const fsEnd = parseFloat(getComputedStyle(logo).fontSize);
      const fsStart = fsEnd * (FS_START / FS_END);
      const scale = fsEnd / FS_END;

      const endB = bearings(WT_END);
      const slotInk = {
        x: slot.x + endB.l * fsEnd,
        y: slot.y + endB.t * fsEnd,
        w: L1_C.w * scale,
        h: L1_C.h * scale,
      };

      const startC = {
        x: slotInk.x + (L6_C.x - L1_C.x) * scale,
        y: slotInk.y + (L6_C.y - L1_C.y) * scale,
        w: L6_C.w * scale,
        h: L6_C.h * scale,
      };
      const endC = slotInk;

      const startSq = {
        x: slotInk.x + (L6_SQ.x - L1_C.x) * scale,
        y: slotInk.y + (L6_SQ.y - L1_C.y) * scale,
        w: L6_SQ.w * scale,
        h: L6_SQ.h * scale,
      };

      const period = measurePeriod(fsEnd);
      const stopSlot = relBox(reelStop, origin);
      const endDot = {
        w: period.w,
        h: period.h,
        x: stopSlot.x + (period.advance - period.w) / 2,
        y: stopSlot.y + period.inkTop,
      };

      // Shift that centres the monogram in the (wider, period-inclusive) logo box.
      const iconLeft = startC.x;
      const iconRight = startSq.x + startSq.w;
      const iconCenter = (iconLeft + iconRight) / 2;
      const startShift = (origin.width / 2) - iconCenter;

      // Travel: letter starts above the square, square starts fully above the
      // window (which extends 0.06em above the typographic top). typographic
      // y=0 is strip-local y=0 (the window's -0.06em is cancelled by strip top).
      const gap = 0.14;          // matches .reel-sq margin-top
      const sqEm = 58 / 130;     // icon square in em
      const parkPad = 0.28;      // keep parked squares fully above the window
      const startTY = -(1 + gap + sqEm + parkPad) * fsEnd;
      const overshootTY = OVERSHOOT * fsEnd;

      const strips = LETTERS.map((spec) => {
        const reel = document.getElementById(spec.id);
        const strip = reel.querySelector(".reel-strip");
        const letter = reel.querySelector(".reel-letter");
        const sq = reel.querySelector(".reel-sq");
        const win = reel.querySelector(".reel-window");
        const box = relBox(reel, origin);
        // Keep the dropping square inside the slot (x is narrower than the icon square).
        const fit = Math.min(sqEm * fsEnd, box.w * 0.88);
        sq.style.width = fit + "px";
        sq.style.height = fit + "px";
        return { reel, strip, letter, sq, win, box, fit };
      });

      return {
        origin, slot, scale, startC, endC, startSq, fsEnd, fsStart,
        period, stopSlot, endDot, startShift, strips, startTY, overshootTY, sqEm, gap,
      };
    }

    function applyC(ink, fontSize, weight, glow) {
      const b = bearings(weight);
      cLive.style.fontSize = fontSize + "px";
      cLive.style.fontWeight = String(weight);
      cLive.style.fontVariationSettings = `'wght' ${weight}, 'opsz' 72`;
      cLive.style.left = (ink.x - b.l * fontSize) + "px";
      cLive.style.top = (ink.y - b.t * fontSize) + "px";
      const glowPx = glow ? (0.169 * parseFloat(getComputedStyle(logo).fontSize)) : 0;
      cLive.style.filter = `drop-shadow(0 0 ${glowPx}px rgba(224, 122, 40, 0.45))`;
    }

    function applySquare(box, radius, opacity) {
      square.style.left = box.x + "px";
      square.style.top = box.y + "px";
      square.style.width = box.w + "px";
      square.style.height = box.h + "px";
      square.style.borderRadius = radius;
      square.style.opacity = String(opacity);
    }

    function placeEndC(g) {
      cLive.style.fontSize = g.fsEnd + "px";
      cLive.style.fontWeight = String(WT_END);
      cLive.style.fontVariationSettings = `'wght' ${WT_END}, 'opsz' 72`;
      cLive.style.left = g.slot.x + "px";
      cLive.style.top = g.slot.y + "px";
      cLive.style.filter = "drop-shadow(0 0 0px rgba(224, 122, 40, 0))";
    }

    function applyStopDot(g, mode) {
      // mode: "hidden" (parked above) | "end" (period on the baseline)
      const startW = g.sqEm * g.fsEnd;
      const endW = g.endDot.w;
      // Slot width at rest is the typographic period advance, so "Cuebox." spacing is natural.
      if (mode === "end") {
        reelStop.style.width = g.period.advance + "px";
        stopDot.style.width = endW + "px";
        stopDot.style.height = endW + "px";
        stopDot.style.left = "50%";
        stopDot.style.marginLeft = (-endW / 2) + "px";
        stopDot.style.top = g.period.inkTop + "px";
        stopDot.style.transform = "translateY(0) scale(1)";
        stopDot.style.opacity = "1";
      } else {
        reelStop.style.width = startW + "px";
        stopDot.style.width = startW + "px";
        stopDot.style.height = startW + "px";
        stopDot.style.left = "50%";
        stopDot.style.marginLeft = (-startW / 2) + "px";
        // Park fully above the stop window so nothing peeks at the start.
        stopDot.style.top = g.period.inkTop + "px";
        const drop = (g.period.inkTop + startW + 0.2 * g.fsEnd);
        stopDot.style.transform = `translateY(${-drop}px) scale(1)`;
        stopDot.style.opacity = "1";
      }
    }

    function setStart(g) {
      applyC(g.startC, g.fsStart, WT_START, true);
      applySquare(g.startSq, "21%", 1);
      logo.style.transform = `translateX(${g.startShift}px)`;
      g.strips.forEach((s) => {
        s.strip.style.transform = `translateY(${g.startTY}px)`;
      });
      applyStopDot(g, "hidden");
      clipWordmarkToC();
    }

    function setEnd(g) {
      placeEndC(g);
      applySquare(g.startSq, "21%", 0);
      logo.style.transform = "translateX(0)";
      g.strips.forEach((s) => {
        s.strip.style.transform = "translateY(0)";
      });
      applyStopDot(g, "end");
      clearClip();
    }

    function setReducedEnd(g) {
      setEnd(g);
    }

    function off(t) {
      return t / TOTAL;
    }

    let clipRaf = 0;
    function clipWordmarkToC() {
      // Flush layout so WAAPI's currentTime is reflected in boxes (needed after seek).
      void cLive.offsetWidth;
      const cR = cLive.getBoundingClientRect();
      const wR = wordmark.getBoundingClientRect();
      if (wR.width <= 0) return;
      // Hide anything still under the live C (stops "u" reading through the aperture).
      const left = Math.max(0, cR.right - wR.left);
      wordmark.style.clipPath = `inset(-20% -10% -20% ${left}px)`;
    }
    function clearClip() {
      wordmark.style.clipPath = "none";
    }
    function runClipLoop() {
      const tick = () => {
        clipWordmarkToC();
        const running = animations.some((a) => a.playState === "running");
        if (running) clipRaf = requestAnimationFrame(tick);
        else {
          clipRaf = 0;
          clipWordmarkToC();
        }
      };
      if (clipRaf) cancelAnimationFrame(clipRaf);
      clipRaf = requestAnimationFrame(tick);
    }

    function cancel() {
      animations.forEach((a) => a.cancel());
      animations = [];
      if (clipRaf) {
        cancelAnimationFrame(clipRaf);
        clipRaf = 0;
      }
    }

    function play(options = {}) {
      cancel();
      const g = geometry();
      // Always keyframe a 1× timeline (TOTAL ms). Speed is applied with
      // playbackRate so the slider can change mid-play without rebuilding.
      const rate = options.speed ?? speed;
      const duration = TOTAL;
      const iterations = options.iterations ?? 1;
      const delay = options.delay ?? 0;
      const endDelay = options.endDelay ?? 0;
      const timing = { duration, fill: "forwards", iterations, delay, endDelay, playbackRate: rate };

      if (reduced && !options.force) {
        setReducedEnd(g);
        return;
      }

      setStart(g);

      const h = off(HOLD);
      // Most of the slide/shrink is done by the time "u" locks, so letters
      // land in visible space; the last 8% continues through "b"/"o".
      const tFast = off(HOLD + REEL + SETTLE); // 660
      const cEnd = off(HOLD + 3 * STAGGER + REEL * 0.5); // ~930
      const startB = bearings(WT_START);
      const glowPx = 0.169 * g.fsEnd;
      const lerp = (a, b, p) => a + (b - a) * p;
      const PFAST = 0.97;
      const startLeft = (g.startC.x - startB.l * g.fsStart);
      const startTop = (g.startC.y - startB.t * g.fsStart);
      const midLeft = lerp(startLeft, g.slot.x, PFAST);
      const midTop = lerp(startTop, g.slot.y, PFAST);
      const midFs = lerp(g.fsStart, g.fsEnd, PFAST);
      const midWt = lerp(WT_START, WT_END, PFAST);
      const midGlow = lerp(glowPx, 0, PFAST);
      const midShift = lerp(g.startShift, 0, PFAST);

      const cAnim = cLive.animate(
        [
          {
            offset: 0,
            left: (g.startC.x - startB.l * g.fsStart) + "px",
            top: (g.startC.y - startB.t * g.fsStart) + "px",
            fontSize: g.fsStart + "px",
            fontWeight: String(WT_START),
            fontVariationSettings: `'wght' ${WT_START}, 'opsz' 72`,
            filter: `drop-shadow(0 0 ${glowPx}px rgba(224, 122, 40, 0.45))`,
            easing: "linear",
          },
          {
            offset: h,
            left: (g.startC.x - startB.l * g.fsStart) + "px",
            top: (g.startC.y - startB.t * g.fsStart) + "px",
            fontSize: g.fsStart + "px",
            fontWeight: String(WT_START),
            fontVariationSettings: `'wght' ${WT_START}, 'opsz' 72`,
            filter: `drop-shadow(0 0 ${glowPx}px rgba(224, 122, 40, 0.45))`,
            easing: C_EASE,
          },
          {
            offset: tFast,
            left: midLeft + "px",
            top: midTop + "px",
            fontSize: midFs + "px",
            fontWeight: String(midWt),
            fontVariationSettings: `'wght' ${midWt}, 'opsz' 72`,
            filter: `drop-shadow(0 0 ${midGlow}px rgba(224, 122, 40, 0.45))`,
            easing: "ease-out",
          },
          {
            offset: cEnd,
            left: g.slot.x + "px",
            top: g.slot.y + "px",
            fontSize: g.fsEnd + "px",
            fontWeight: String(WT_END),
            fontVariationSettings: `'wght' ${WT_END}, 'opsz' 72`,
            filter: "drop-shadow(0 0 0px rgba(224, 122, 40, 0))",
            easing: "ease-out",
          },
          {
            offset: 1,
            left: g.slot.x + "px",
            top: g.slot.y + "px",
            fontSize: g.fsEnd + "px",
            fontWeight: String(WT_END),
            fontVariationSettings: `'wght' ${WT_END}, 'opsz' 72`,
            filter: "drop-shadow(0 0 0px rgba(224, 122, 40, 0))",
          },
        ],
        timing
      );

      // Icon square drops away as the first reel starts, so it doesn't sit
      // over the letters that will land in its column.
      const sqExit = off(HOLD + 110);
      const sqAnim = square.animate(
        [
          {
            offset: 0,
            left: g.startSq.x + "px",
            top: g.startSq.y + "px",
            width: g.startSq.w + "px",
            height: g.startSq.h + "px",
            opacity: 1,
            easing: "linear",
          },
          {
            offset: h,
            left: g.startSq.x + "px",
            top: g.startSq.y + "px",
            width: g.startSq.w + "px",
            height: g.startSq.h + "px",
            opacity: 1,
            easing: "ease-in",
          },
          {
            offset: sqExit,
            left: g.startSq.x + "px",
            top: g.startSq.y + "px",
            width: g.startSq.w + "px",
            height: g.startSq.h + "px",
            opacity: 0,
            easing: "linear",
          },
          {
            offset: 1,
            left: g.startSq.x + "px",
            top: g.startSq.y + "px",
            width: g.startSq.w + "px",
            height: g.startSq.h + "px",
            opacity: 0,
          },
        ],
        timing
      );

      const shiftAnim = logo.animate(
        [
          { offset: 0, transform: `translateX(${g.startShift}px)`, easing: "linear" },
          { offset: h, transform: `translateX(${g.startShift}px)`, easing: C_EASE },
          { offset: tFast, transform: `translateX(${midShift}px)`, easing: "ease-out" },
          { offset: cEnd, transform: "translateX(0px)", easing: "ease-out" },
          { offset: 1, transform: "translateX(0px)" },
        ],
        timing
      );

      const stripAnims = g.strips.map((s, i) => {
        const t0 = off(HOLD + i * STAGGER);
        const tHit = off(HOLD + i * STAGGER + REEL);
        const tLock = off(HOLD + i * STAGGER + REEL + SETTLE);
        return s.strip.animate(
          [
            { offset: 0, transform: `translateY(${g.startTY}px)`, easing: "linear" },
            { offset: t0, transform: `translateY(${g.startTY}px)`, easing: DROP_EASE },
            { offset: tHit, transform: `translateY(${g.overshootTY}px)`, easing: SETTLE_EASE },
            { offset: tLock, transform: "translateY(0px)", easing: "linear" },
            { offset: 1, transform: "translateY(0px)" },
          ],
          timing
        );
      });

      // Sixth reel: the teal square drops in and shrinks to a full stop on the baseline.
      const stopT0 = off(LAST_START);
      const stopHit = off(LAST_START + REEL);
      const stopLock = off(LAST_LOCK);
      const startW = g.sqEm * g.fsEnd;
      const endW = g.endDot.w;
      const endSlotW = g.period.advance;
      const drop = g.period.inkTop + startW + 0.2 * g.fsEnd;
      // Keep the slot wide enough for the falling square, then shrink with the dot.
      const shrinkStart = off(LAST_START + REEL * 0.45);

      const stopWidthAnim = reelStop.animate(
        [
          { offset: 0, width: startW + "px", easing: "linear" },
          { offset: shrinkStart, width: startW + "px", easing: C_EASE },
          { offset: stopLock, width: endSlotW + "px", easing: "ease-out" },
          { offset: 1, width: endSlotW + "px" },
        ],
        timing
      );

      const stopDotAnim = stopDot.animate(
        [
          {
            offset: 0,
            width: startW + "px",
            height: startW + "px",
            marginLeft: (-startW / 2) + "px",
            top: g.period.inkTop + "px",
            transform: `translateY(${-drop}px) scale(1)`,
            easing: "linear",
          },
          {
            offset: stopT0,
            width: startW + "px",
            height: startW + "px",
            marginLeft: (-startW / 2) + "px",
            top: g.period.inkTop + "px",
            transform: `translateY(${-drop}px) scale(1)`,
            easing: DROP_EASE,
          },
          {
            offset: stopHit,
            width: endW + "px",
            height: endW + "px",
            marginLeft: (-endW / 2) + "px",
            top: g.period.inkTop + "px",
            transform: `translateY(${g.overshootTY}px) scale(1.08)`,
            easing: SETTLE_EASE,
          },
          {
            offset: stopLock,
            width: endW + "px",
            height: endW + "px",
            marginLeft: (-endW / 2) + "px",
            top: g.period.inkTop + "px",
            transform: "translateY(0px) scale(1)",
            easing: "linear",
          },
          {
            offset: 1,
            width: endW + "px",
            height: endW + "px",
            marginLeft: (-endW / 2) + "px",
            top: g.period.inkTop + "px",
            transform: "translateY(0px) scale(1)",
          },
        ],
        timing
      );

      animations = [cAnim, sqAnim, shiftAnim, ...stripAnims, stopWidthAnim, stopDotAnim];
      animations.forEach((a) => { a.playbackRate = rate; });
      runClipLoop();
      return animations[0].finished;
    }

    function setSpeed(rate, { restart = false } = {}) {
      speed = parseSpeed(rate);
      const slider = document.getElementById("speedSlider");
      const label = formatSpeed(speed);
      const ms = playDuration(speed);
      if (slider && slider.value !== String(speed)) slider.value = String(speed);
      const speedValue = document.getElementById("speedValue");
      const speedDuration = document.getElementById("speedDuration");
      if (speedValue) speedValue.textContent = label;
      if (speedDuration) speedDuration.textContent = ms + " ms";
      if (slider) slider.setAttribute("aria-valuetext", `${label}, ${ms} milliseconds per play`);
      animations.forEach((a) => { a.playbackRate = speed; });
      if (restart) play();
    }

    document.getElementById("replay")?.addEventListener("click", () => play());
    document.getElementById("speedSlider")?.addEventListener("input", (ev) => {
      setSpeed(ev.target.value);
    });

    window.addEventListener("resize", () => {
      cancel();
      const g = geometry();
      if (reduced || frame === "end") setEnd(g);
      else if (frame === "start") setStart(g);
      else if (frame === "mid") {
        play({ force: true, speed: 1 });
        seek(TOTAL / 2);
      } else setEnd(g);
    });

    function seek(ms) {
      if (!animations.length) play({ force: true, speed: 1 });
      animations.forEach((a) => { a.pause(); a.currentTime = ms; });
      clipWordmarkToC();
    }

    window.cueboxAnim = {
      play,
      geometry,
      setSpeed,
      get animations() { return animations; },
      get total() { return TOTAL; },
      get speed() { return speed; },
      seek,
    };

    async function start() {
      await document.fonts.ready;
      try {
        await document.fonts.load('700 64px "Big Shoulders"');
        await document.fonts.load('700 130px "Big Shoulders"');
        await document.fonts.load('800 192px "Big Shoulders"');
        await document.fonts.load('700 240px "Big Shoulders"');
      } catch (e) {}
      const g = geometry();
      setStart(g);
    }

    window.cueboxAnimReady = start();
  