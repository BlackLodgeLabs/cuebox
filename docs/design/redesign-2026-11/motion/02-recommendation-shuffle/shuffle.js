/**
 * Recommendation polish clock, in wall-clock milliseconds.
 *
 * Option A is the short minimum path (result ready after 800ms of scrolling).
 * Option B is the revised path: no frame titles, a slower cruise, and a
 * 20s wait that matches a typical API time. The slow-down only starts
 * once the winning film is known. See the Developer comment and notes.md.
 *
 * Shared front:
 *   0–480      notes screen, at rest
 *   480–620    “Find my pick” presses
 *   620–880    notes fade, the film strip fades in (already moving)
 *
 * Option A:
 *   800–1600   fast scroll at 2000px/s
 *   1600–2500  decelerates and lands on The Witch
 *   2500–      amber highlight, expand into the programme, settle
 *   clip 5000
 *
 * Option B (locked values; compact example):
 *   800–8800    cruise at a constant 420px/s (no breath)
 *   8800–11300  decelerates and lands on The Witch
 *   11300–      amber highlight, expand into the programme, settle
 *   clip 14000
 *
 * In the app the cruise continues until the API has returned and a
 * short minimum has played. This clip uses an 8s cruise as a compact
 * example of the locked speed and wind-down, not as a locked floor.
 */
const option = document.body.dataset.option || "a";
const isB = option === "b";

const HOLD = 480;
const PRESS_AT = 480;
const PRESS_DUR = 140;
const LEAVE_AT = 620;
const LEAVE_DUR = 260;
const FAST_START = 800;
const FAST_DUR = isB ? 8000 : 800; // compact example of the loopable wait; extend while the API is in flight
const SLOW_START = FAST_START + FAST_DUR;
const SLOW_DUR = isB ? 2500 : 900;
const LAND = SLOW_START + SLOW_DUR; // A 2500, B 11300
const GLOW_PEAK = 80;          // ms after land
const GLOW_FADE = 400;
const EXPAND_START = LAND + 280; // A 2780, B 11580
const EXPAND_DUR = 580;
const SETTLE_START = LAND + 480; // A 2980, B 11780
const SETTLE_DUR = 300;
const SETTLE_STAGGER = 70;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPEED_PX_S = isB ? 420 : 2000;
const SLOW_POWER = isB ? 1.38 : 2.2; // start velocity matches the cruise
const BREATH_AMP = 0;                // locked: constant cruise, no breath
const BREATH_PERIOD = 8000;
const CLIP = isB ? 14000 : 5000;

const COPIES = 6;
const FILMS_A = [
  { title: "The Wicker Man", src: "art/wicker-meadow.jpg", pos: "center 42%" },
  { title: "Lamb", src: "art/old-house.jpg", pos: "center 40%" },
  { title: "Midsommar", src: "art/daisies.jpg", pos: "center 45%" },
  { title: "The Innocents", src: "art/fog-woods.jpg", pos: "center 40%" },
  { title: "Burning", src: "art/fire-warm.jpg", pos: "center 40%" },
  { title: "Carnival of Souls", src: "art/fog-moor.jpg", pos: "center 40%" },
  { title: "Under the Skin", src: "art/rain-neon.jpg", pos: "center 40%" },
  { title: "Portrait of a Lady on Fire", src: "art/coastal-cliffs.jpg", pos: "center 50%" },
  { title: "The Witch", src: "art/witch-forest.jpg", pos: "center 40%", winner: true },
];

const FILMS_B_LIBRARY = {
  wicker:     { title: "The Wicker Man", src: "art/wicker-meadow.jpg", pos: "center 42%" },
  lamb:       { title: "Lamb", src: "art/old-house.jpg", pos: "center 40%" },
  midsommar:  { title: "Midsommar", src: "art/daisies.jpg", pos: "center 45%" },
  innocents:  { title: "The Innocents", src: "art/fog-woods.jpg", pos: "center 40%" },
  burning:    { title: "Burning", src: "art/fire-warm.jpg", pos: "center 40%" },
  carnival:   { title: "Carnival of Souls", src: "art/fog-moor.jpg", pos: "center 40%" },
  skin:       { title: "Under the Skin", src: "art/rain-neon.jpg", pos: "center 40%" },
  portrait:   { title: "Portrait of a Lady on Fire", src: "art/coastal-cliffs.jpg", pos: "center 50%" },
  cinema:     { title: "Cinema Paradiso", src: "art/cinema.jpg", pos: "center 40%" },
  eraserhead: { title: "Eraserhead", src: "art/rain-street.jpg", pos: "center 40%" },
  lighthouse: { title: "The Lighthouse", src: "art/candle-dark.jpg", pos: "center 40%" },
  titane:     { title: "Titane", src: "art/neon-city.jpg", pos: "center 40%" },
  witch:      { title: "The Witch", src: "art/witch-forest.jpg", pos: "center 40%", winner: true },
};

// Four different orders, Witch spaced through, so 20s does not look like a short loop.
const FILMS_B_ORDER = [
  "wicker","lamb","midsommar","innocents","burning","carnival","witch","skin","portrait","cinema","eraserhead","lighthouse","titane",
  "cinema","innocents","titane","wicker","eraserhead","portrait","lighthouse","lamb","witch","carnival","midsommar","burning","skin",
  "lighthouse","skin","lamb","cinema","carnival","titane","innocents","witch","eraserhead","midsommar","wicker","portrait","burning",
  "portrait","burning","lighthouse","carnival","skin","midsommar","cinema","titane","lamb","innocents","witch","eraserhead","wicker",
  "eraserhead","titane","wicker","portrait","carnival","lighthouse","skin","midsommar","burning","cinema","lamb","innocents","witch",
];

const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function lerp(a, b, p) { return a + (b - a) * p; }

function easeOutProgress(t, start, dur, power = 3) {
  if (t <= start) return 0;
  if (t >= start + dur) return 1;
  const p = (t - start) / dur;
  return 1 - Math.pow(1 - p, power);
}

function easeOutCubic(t, start, dur) {
  return easeOutProgress(t, start, dur, 3);
}

function midTime() {
  // Chosen frame is at rest, amber highlight near its peak.
  return LAND + GLOW_PEAK;
}

/**
 * Pixels travelled during `elapsedMs` of cruise, including the optional breath.
 * v = SPEED * (1 + A * sin(2π t / P)), phased so v = SPEED at t = 0 and t = FAST_DUR.
 */
function cruiseTravel(elapsedMs) {
  const t = Math.max(0, elapsedMs) / 1000;
  if (!BREATH_AMP) return SPEED_PX_S * t;
  const P = BREATH_PERIOD / 1000;
  const w = (2 * Math.PI) / P;
  return SPEED_PX_S * (t + (BREATH_AMP / w) * (1 - Math.cos(w * t)));
}

/*
 * Developer — wiring this to a real request
 * ------------------------------------------
 * 1. On “Find my pick”, start the cruise immediately. Translate the
 *    strip at SPEED_PX_S (option B: a constant 420px/s, no breath).
 *    Loop with modulo of the repeating strip width.
 *    This phase can run for any length of time — typically 20–30s.
 * 2. Do not start the slow-down until BOTH are true:
 *      - the API has returned the winning film, and
 *      - at least the minimum cruise has played (800ms in A, and in
 *        production a short floor so a quick response still shuffles).
 * 3. Once you know the winner, pick the next copy of that still that
 *    is at least slowDistance ahead of the current position (see
 *    path.slowDist). Animate translateX to the value that centres
 *    that still, using 1 - (1 - u)^SLOW_POWER over SLOW_DUR. That
 *    ease is tuned so the starting velocity matches the cruise, with
 *    no visible jump.
 * 4. Then run the amber pulse, the expand into the hero, and the settle.
 * 5. If prefers-reduced-motion is set, skip the strip and crossfade
 *    from the notes screen to the programme (300ms, same ease-out).
 */
let path = null;
let layoutReady = false;

function filmList() {
  if (!isB) {
    const list = [];
    for (let c = 0; c < COPIES; c++) {
      FILMS_A.forEach((film, i) => list.push({ ...film, copy: c, index: i }));
    }
    return list;
  }
  return FILMS_B_ORDER.map((key, i) => ({ ...FILMS_B_LIBRARY[key], copy: 0, index: i }));
}

function buildStrip() {
  const strip = document.getElementById("strip");
  strip.innerHTML = "";
  const frag = document.createDocumentFragment();
  filmList().forEach((film, i) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    if (film.winner) cell.dataset.winner = "1";
    cell.dataset.copy = String(film.copy);
    cell.dataset.index = String(i);
    const win = document.createElement("div");
    win.className = "window";
    const img = document.createElement("img");
    img.src = film.src;
    img.alt = film.title;
    img.style.objectPosition = film.pos;
    win.appendChild(img);
    if (!isB) {
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = film.title;
      cell.append(win, label);
    } else {
      cell.append(win);
    }
    const glow = document.createElement("div");
    glow.className = "glow";
    glow.setAttribute("aria-hidden", "true");
    cell.append(glow);
    frag.appendChild(cell);
  });
  strip.appendChild(frag);
}

function measurePath() {
  const phone = document.getElementById("phone");
  const strip = document.getElementById("strip");
  const winners = [...strip.querySelectorAll(".cell[data-winner='1']")];
  if (!winners.length) return null;
  const pr = phone.getBoundingClientRect();
  // A: third copy. B: fourth Witch, after ~20s of cruise plus the slow-down.
  const landCell = isB
    ? winners[Math.min(3, winners.length - 1)]
    : winners[Math.min(2, winners.length - 1)];
  const still = landCell.querySelector(".window");
  const sr = still.getBoundingClientRect();
  const stillCx = sr.left + sr.width / 2 - pr.left;
  const phoneCx = 390 / 2;
  const xEnd = phoneCx - stillCx;

  const slowDist = (SPEED_PX_S * (SLOW_DUR / 1000)) / SLOW_POWER;
  const xSlowStart = xEnd + slowDist;
  const fastDist = cruiseTravel(FAST_DUR);
  const xFastStart = xSlowStart + fastDist;

  const landRect = {
    x: (390 - sr.width) / 2,
    y: sr.top - pr.top,
    w: sr.width,
    h: sr.height,
    r: 1,
  };

  const winner = document.getElementById("winner");
  const wr = winner.getBoundingClientRect();
  const heroRect = {
    x: wr.left - pr.left,
    y: wr.top - pr.top,
    w: wr.width,
    h: wr.height,
    r: 12,
  };

  return {
    xFastStart,
    xSlowStart,
    xEnd,
    slowDist,
    fastDist,
    landRect,
    heroRect,
    landCell,
    loopW: strip.scrollWidth,
  };
}

function xAt(t) {
  if (!path) return 0;
  if (t <= FAST_START) return path.xFastStart;
  if (t < SLOW_START) {
    return path.xFastStart - cruiseTravel(t - FAST_START);
  }
  if (t >= LAND) return path.xEnd;
  const u = (t - SLOW_START) / SLOW_DUR;
  const p = 1 - Math.pow(1 - u, SLOW_POWER);
  return path.xSlowStart + (path.xEnd - path.xSlowStart) * p;
}

function glowAt(t) {
  if (t < LAND - 80) return 0;
  if (t < LAND + GLOW_PEAK) {
    return easeOutCubic(t, LAND - 80, 80 + GLOW_PEAK) * 0.95;
  }
  const fadeStart = LAND + GLOW_PEAK;
  if (t < fadeStart + 120) return 0.95;
  return 0.95 * (1 - easeOutCubic(t, fadeStart + 120, GLOW_FADE));
}

function apply(wallMs) {
  const reduced = reducedQuery.matches && !window.cueboxPolishForceMotion;
  const notes = document.getElementById("notes");
  const stage = document.getElementById("stage");
  const prog = document.getElementById("progLayer");
  const strip = document.getElementById("strip");
  const flyer = document.getElementById("flyer");
  const btn = document.getElementById("findBtn");
  const settles = [...document.querySelectorAll("[data-settle]")];
  const winner = document.getElementById("winner");

  if (reduced) {
    const t = clamp(wallMs, 0, CLIP);
    const p = easeOutCubic(t, 0, 300);
    if (notes) notes.style.opacity = String(1 - p);
    if (stage) stage.style.opacity = "0";
    if (flyer) flyer.style.opacity = "0";
    if (prog) {
      prog.style.opacity = String(p);
      prog.style.pointerEvents = p > 0.9 ? "auto" : "none";
    }
    settles.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    if (winner) winner.style.opacity = "1";
    if (btn) btn.style.transform = "";
    return;
  }

  const t = clamp(wallMs, 0, CLIP);
  if (!path) return;

  const leaveP = easeOutCubic(t, LEAVE_AT, LEAVE_DUR);
  if (notes) {
    notes.style.opacity = String(1 - leaveP);
    notes.style.transform = `translateY(${lerp(0, -8, leaveP)}px)`;
    notes.style.pointerEvents = leaveP > 0.9 ? "none" : "auto";
  }
  if (btn) {
    if (t >= PRESS_AT && t < LEAVE_AT) {
      const pr = easeOutCubic(t, PRESS_AT, PRESS_DUR);
      const down = pr < 0.55 ? pr / 0.55 : 1 - (pr - 0.55) / 0.45;
      btn.style.transform = `scale(${lerp(1, 0.975, down)})`;
    } else {
      btn.style.transform = "";
    }
  }

  const stageP = easeOutCubic(t, LEAVE_AT, LEAVE_DUR);
  if (stage) {
    stage.style.opacity = String(stageP);
    stage.style.transform = `translateY(${lerp(14, 0, stageP)}px)`;
  }

  const x = xAt(t);
  if (strip) {
    strip.style.transform = `translate3d(${x}px, 0, 0)`;
    // Option A only: a hint of motion blur while the reel is fast.
    // Option B is slow enough that the stills should stay sharp.
    let blur = 0;
    if (!isB) {
      if (t >= FAST_START && t < SLOW_START) blur = 0.55;
      else if (t >= SLOW_START && t < LAND) {
        const u = (t - SLOW_START) / SLOW_DUR;
        blur = 0.55 * (1 - u) * (1 - u);
      }
    }
    strip.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
  }

  const g = glowAt(t);
  if (path.landCell) {
    const glowEl = path.landCell.querySelector(".glow");
    if (glowEl) glowEl.style.opacity = String(Math.max(0, g));
  }

  const copyFade = easeOutCubic(t, EXPAND_START, 220);
  const stageCopy = document.querySelector(".stage-copy");
  if (stageCopy) stageCopy.style.opacity = String(1 - copyFade);

  const expP = easeOutCubic(t, EXPAND_START, EXPAND_DUR);
  const stripFade = easeOutCubic(t, EXPAND_START, 240);

  if (flyer && path.landRect && path.heroRect) {
    if (t < EXPAND_START || expP <= 0) {
      flyer.style.opacity = "0";
    } else {
      const r = {
        x: lerp(path.landRect.x, path.heroRect.x, expP),
        y: lerp(path.landRect.y, path.heroRect.y, expP),
        w: lerp(path.landRect.w, path.heroRect.w, expP),
        h: lerp(path.landRect.h, path.heroRect.h, expP),
        rad: lerp(path.landRect.r, path.heroRect.r, expP),
      };
      flyer.style.left = `${r.x}px`;
      flyer.style.top = `${r.y}px`;
      flyer.style.width = `${r.w}px`;
      flyer.style.height = `${r.h}px`;
      flyer.style.borderRadius = `${r.rad}px`;
      const handoff = easeOutCubic(t, EXPAND_START + EXPAND_DUR - 140, 140);
      flyer.style.opacity = String(1 - handoff);
    }
  }

  if (strip) {
    if (t >= EXPAND_START) {
      strip.style.opacity = String(1 - stripFade);
    } else {
      strip.style.opacity = "1";
    }
  }

  const progIn = easeOutCubic(t, EXPAND_START + 80, EXPAND_DUR - 80);
  if (prog) {
    prog.style.opacity = t >= EXPAND_START ? "1" : "0";
    prog.style.pointerEvents = progIn > 0.95 ? "auto" : "none";
  }
  if (winner) {
    const handoff = easeOutCubic(t, EXPAND_START + EXPAND_DUR - 140, 140);
    winner.style.opacity = String(t >= EXPAND_START ? handoff : 0);
  }

  const tabbar = document.querySelector('[data-settle="tabbar"]');
  if (tabbar) {
    const p = easeOutCubic(t, EXPAND_START + 80, 280);
    tabbar.style.opacity = String(p);
    tabbar.style.transform = "none";
  }

  const settleItems = [
    document.querySelector('[data-settle="head"]'),
    document.querySelector('[data-settle="sub"]'),
    document.querySelector('[data-settle="copy"]'),
    document.querySelector('[data-settle="why"]'),
    document.querySelector('[data-settle="btn"]'),
    document.querySelector('[data-settle="runners"]'),
  ];
  settleItems.forEach((el, i) => {
    if (!el) return;
    const start = SETTLE_START + i * SETTLE_STAGGER;
    const p = easeOutCubic(t, start, SETTLE_DUR);
    el.style.opacity = String(p);
    el.style.transform = `translateY(${lerp(8, 0, p)}px)`;
  });

  if (t >= CLIP) {
    if (notes) notes.style.opacity = "0";
    if (stage) stage.style.opacity = "0";
    if (flyer) flyer.style.opacity = "0";
    if (prog) prog.style.opacity = "1";
    if (winner) winner.style.opacity = "1";
  }
}

let raf = 0;
let playing = false;
let startedAt = 0;

function playFrom(startMs = 0) {
  cancelAnimationFrame(raf);
  playing = true;
  startedAt = performance.now() - startMs;
  const tick = (now) => {
    const t = now - startedAt;
    apply(t);
    if (t < CLIP) raf = requestAnimationFrame(tick);
    else {
      apply(CLIP);
      playing = false;
    }
  };
  raf = requestAnimationFrame(tick);
}

function stop() {
  playing = false;
  cancelAnimationFrame(raf);
}

window.cueboxPolish = {
  apply,
  playFrom,
  stop,
  get playing() { return playing; },
  duration: CLIP,
  midTime,
  option,
  get path() { return path; },
  constants: {
    HOLD, PRESS_AT, PRESS_DUR, LEAVE_AT, LEAVE_DUR,
    FAST_START, FAST_DUR, SLOW_START, SLOW_DUR, LAND,
    GLOW_PEAK, GLOW_FADE, EXPAND_START, EXPAND_DUR,
    SETTLE_START, SETTLE_DUR, SETTLE_STAGGER,
    SPEED_PX_S, SLOW_POWER, BREATH_AMP, BREATH_PERIOD, EASE, CLIP,
  },
};

async function boot() {
  buildStrip();
  await document.fonts.ready;
  const imgs = [...document.images];
  await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const prog = document.getElementById("progLayer");
  const notes = document.getElementById("notes");
  const prevProg = prog.style.opacity;
  const prevNotes = notes.style.opacity;
  prog.style.opacity = "1";
  prog.style.visibility = "visible";
  notes.style.visibility = "hidden";
  path = measurePath();
  prog.style.opacity = prevProg;
  notes.style.visibility = "";
  notes.style.opacity = prevNotes;
  layoutReady = true;

  const params = new URLSearchParams(location.search);
  const frame = params.get("frame");
  if (frame === "start") apply(0);
  else if (frame === "end") apply(CLIP);
  else if (frame === "mid") apply(midTime());
  else if (params.has("seek")) apply(Number(params.get("seek")) || 0);
  else if (reducedQuery.matches) apply(CLIP);
  else playFrom(0);

  document.documentElement.dataset.polishReady = "1";
}

boot();

document.getElementById("phone")?.addEventListener("click", () => playFrom(0));
