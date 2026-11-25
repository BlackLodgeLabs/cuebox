/**
 * Home polish clock, in wall-clock milliseconds.
 *
 * The signed-off logo unfold is 1730ms at 1×. It plays at 0.85×, so it
 * lasts 2035ms of wall time, matching the prototype's default.
 *
 *   0–2035   logo unfold on the splash (1× timeline 0–1730)
 *   1894     wordmark locks (1610ms at 1×)
 *   2035     120ms tail has finished
 *
 * A–C: 2035–2255 splash fades (220ms). B/C content motion starts after that.
 * D:   2035      wordmark dissolves into the warming, sharpening still.
 * E:   1974      iris opens from the locked full stop (80ms after lock).
 */
const SPEED = 0.85;
const LOGO_1X = 1730;
const LOGO_LOCK_1X = 1610;
const LOGO_WALL = Math.round(LOGO_1X / SPEED);       // 2035
const LOGO_LOCK_WALL = Math.round(LOGO_LOCK_1X / SPEED); // 1894
const SPLASH_FADE = 220;
const CONTENT_AT = LOGO_WALL;
const SETTLE_DELAY = SPLASH_FADE;
const SETTLE_DUR = 300;
const SETTLE_STAGGER = 70;
const SETTLE_Y = 10;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const WARM_DUR = 800;
const WARM_PEAK = 320;
const BLUR_FROM = 7;
const BLUR_DUR = 560;
const DISSOLVE_START = LOGO_WALL; // 2035 — after the signed-off tail
const DISSOLVE_BG = 400;
const DISSOLVE_LOGO = 600;
const IRIS_HOLD = 80; // short beat on the locked wordmark, then the period opens
const IRIS_START = LOGO_LOCK_WALL + IRIS_HOLD; // 1974
const IRIS_DUR = 760;
const IRIS_SOFT = 12;
const IRIS_WORDMARK_DELAY = 80;
const IRIS_WORDMARK_FADE = 600;
const TITLE_DELAY_D = 420;
const REST_DELAY_D = 500;
const TITLE_DELAY_E = 700;
const REST_DELAY_E = 760;

const option = document.body.dataset.option || "a";
const CLIP = (option === "d" || option === "e") ? 4000 : 3800;
const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function easeOutProgress(t, start, dur) {
  if (t <= start) return 0;
  if (t >= start + dur) return 1;
  const p = (t - start) / dur;
  // Approximate cubic-bezier(0.16, 1, 0.3, 1) with a strong ease-out.
  return 1 - Math.pow(1 - p, 3);
}

function easeIrisProgress(t, start, dur) {
  if (t <= start) return 0;
  if (t >= start + dur) return 1;
  const p = (t - start) / dur;
  // Smoothstep (ease-in-out) so the window stays at the period long enough to read,
  // then opens, then eases as it fills the screen.
  return p * p * (3 - 2 * p);
}

function lerp(a, b, p) { return a + (b - a) * p; }

function midTime() {
  if (option === "a") return Math.round((LOGO_1X / 2) / SPEED); // 1018
  if (option === "b") return CONTENT_AT + SETTLE_DELAY + 90; // 2345
  if (option === "c") return CONTENT_AT + SETTLE_DELAY + WARM_PEAK; // 2575
  if (option === "d") return DISSOLVE_START + 160; // wordmark over a dim, slightly soft, warming still
  return IRIS_START + 190; // a clear circular window from the period, wordmark still readable
}

function periodCenter() {
  const phone = document.getElementById("phone");
  const dot = document.getElementById("stopDot");
  if (!phone || !dot) return null;
  const pr = phone.getBoundingClientRect();
  const dr = dot.getBoundingClientRect();
  if (dr.width < 2 || dr.height < 2) return null;
  return {
    x: dr.left + dr.width / 2 - pr.left,
    y: dr.top + dr.height / 2 - pr.top,
    r0: Math.hypot(dr.width / 2, dr.height / 2) + 0.5,
  };
}

function clearMask(el) {
  if (!el) return;
  el.style.maskImage = "";
  el.style.webkitMaskImage = "";
  el.style.maskSize = "";
  el.style.webkitMaskSize = "";
}

function setMask(el, x, y, r, soft) {
  const inner = Math.max(0, r - soft);
  const image = `radial-gradient(circle at ${x}px ${y}px, transparent ${inner}px, #000 ${r}px)`;
  el.style.maskImage = image;
  el.style.webkitMaskImage = image;
}

function fadeSettle(el, t, start, y = 6) {
  if (!el) return;
  const p = easeOutProgress(t, start, SETTLE_DUR);
  el.style.opacity = String(p);
  el.style.transform = `translateY(${lerp(y, 0, p)}px)`;
}

function restSections() {
  return [...document.querySelectorAll("[data-settle]")].filter((el) => !el.classList.contains("hero"));
}

function applyWarm(t, start, img, warm) {
  const warmP = easeOutProgress(t, start, WARM_DUR);
  const blurP = easeOutProgress(t, start, BLUR_DUR);
  const brightness = lerp(0.42, 1, warmP);
  const blur = lerp(BLUR_FROM, 0, blurP);
  if (img) img.style.filter = `blur(${blur.toFixed(2)}px) brightness(${brightness})`;
  let glow = 0;
  if (t >= start) {
    const gAge = t - start;
    if (gAge <= WARM_PEAK) {
      glow = easeOutProgress(t, start, WARM_PEAK) * 0.9;
    } else {
      const fall = easeOutProgress(t, start + WARM_PEAK, WARM_DUR - WARM_PEAK);
      glow = 0.9 * (1 - fall);
    }
  }
  if (warm) warm.style.opacity = String(glow);
}

function apply(wallMs) {
  const reduced = reducedQuery.matches && !window.cueboxPolishForceMotion;
  const splash = document.getElementById("splash");
  const splashBg = document.getElementById("splashBg");
  const logo = document.getElementById("logo");
  const stopDot = document.getElementById("stopDot");
  const sections = [...document.querySelectorAll("[data-settle]")];
  const img = document.querySelector(".hero > img");
  const warm = document.querySelector(".hero .warm");
  const copy = document.querySelector(".hero-copy");
  const tabbar = document.querySelector(".tabbar");
  const hdr = document.querySelector(".hdr");
  const hero = document.querySelector(".hero[data-settle]");

  if (reduced) {
    if (splash) splash.style.opacity = "0";
    if (splashBg) { splashBg.style.opacity = "0"; clearMask(splashBg); }
    if (logo) logo.style.opacity = "";
    if (stopDot) stopDot.style.opacity = "";
    sections.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    if (copy) { copy.style.opacity = "1"; copy.style.transform = "none"; }
    if (img) img.style.filter = "brightness(1)";
    if (warm) warm.style.opacity = "0";
    if (tabbar) { tabbar.style.opacity = "1"; tabbar.style.transform = "none"; }
    if (hdr) { hdr.style.opacity = "1"; hdr.style.transform = "none"; }
    return;
  }

  const t = clamp(wallMs, 0, CLIP);

  const logoT = clamp(t * SPEED, 0, LOGO_1X);
  if (window.cueboxAnim) window.cueboxAnim.seek(logoT);

  if (option === "d") {
    // No slab fade. Black lifts on its own; the wordmark melts over the still.
    if (splash) splash.style.opacity = "1";
    const bgP = easeOutProgress(t, DISSOLVE_START, DISSOLVE_BG);
    const logoP = easeOutProgress(t, DISSOLVE_START, DISSOLVE_LOGO);
    if (splashBg) {
      clearMask(splashBg);
      splashBg.style.opacity = String(1 - bgP);
    }
    if (logo) logo.style.opacity = String(1 - logoP);
    if (stopDot) stopDot.style.opacity = "";
    if (t >= DISSOLVE_START + DISSOLVE_LOGO && splash) splash.style.opacity = "0";

    applyWarm(t, DISSOLVE_START, img, warm);

    if (hero) { hero.style.opacity = "1"; hero.style.transform = "none"; }
    fadeSettle(hdr, t, DISSOLVE_START + TITLE_DELAY_D, 0);
    fadeSettle(tabbar, t, DISSOLVE_START + TITLE_DELAY_D, 0);
    fadeSettle(copy, t, DISSOLVE_START + TITLE_DELAY_D, 6);
    restSections().forEach((el, i) => {
      fadeSettle(el, t, DISSOLVE_START + REST_DELAY_D + i * SETTLE_STAGGER, 6);
    });
    return;
  }

  if (option === "e") {
    if (splash) splash.style.opacity = "1";
    const irisP = easeIrisProgress(t, IRIS_START, IRIS_DUR);
    const markP = easeOutProgress(t, IRIS_START + IRIS_WORDMARK_DELAY, IRIS_WORDMARK_FADE);
    // Period fill clears quickly so the still can show through the opening.
    const dotP = easeOutProgress(t, IRIS_START, 80);

    if (t < IRIS_START) {
      if (splashBg) { splashBg.style.opacity = "1"; clearMask(splashBg); }
      if (logo) logo.style.opacity = "1";
      if (stopDot) stopDot.style.opacity = "";
    } else {
      const geo = periodCenter();
      if (splashBg && geo) {
        splashBg.style.opacity = "1";
        const maxR = Math.hypot(
          Math.max(geo.x, 390 - geo.x),
          Math.max(geo.y, 844 - geo.y)
        ) + IRIS_SOFT + 8;
        const r = lerp(geo.r0, maxR, irisP);
        // Feather grows with the hole so the first window stays a crisp full stop.
        const soft = lerp(1.25, IRIS_SOFT, irisP);
        setMask(splashBg, geo.x, geo.y, r, soft);
      }
      if (stopDot) stopDot.style.opacity = String(1 - dotP);
      if (logo) logo.style.opacity = String(1 - markP);
    }

    if (irisP >= 1 && splash) {
      splash.style.opacity = "0";
      if (splashBg) { splashBg.style.opacity = "0"; clearMask(splashBg); }
    }

    // Still is sharp and fully lit as soon as the iris shows it. No teal glow.
    if (img) img.style.filter = "brightness(1)";
    if (warm) warm.style.opacity = "0";
    if (hero) { hero.style.opacity = "1"; hero.style.transform = "none"; }

    fadeSettle(hdr, t, IRIS_START + TITLE_DELAY_E, 0);
    fadeSettle(tabbar, t, IRIS_START + TITLE_DELAY_E, 0);
    fadeSettle(copy, t, IRIS_START + TITLE_DELAY_E, 6);
    restSections().forEach((el, i) => {
      fadeSettle(el, t, IRIS_START + REST_DELAY_E + i * SETTLE_STAGGER, 6);
    });
    return;
  }

  // A–C: splash fades as a single slab after the logo tail.
  let splashOp = 1;
  if (t >= CONTENT_AT) {
    splashOp = 1 - easeOutProgress(t, CONTENT_AT, SPLASH_FADE);
  }
  if (splash) splash.style.opacity = String(splashOp);
  if (splashBg) { splashBg.style.opacity = ""; clearMask(splashBg); }
  if (logo) logo.style.opacity = "";
  if (stopDot) stopDot.style.opacity = "";

  const chromeP = easeOutProgress(t, CONTENT_AT, SPLASH_FADE);
  if (option === "a") {
    if (hdr) hdr.style.opacity = "1";
    if (tabbar) tabbar.style.opacity = "1";
    sections.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    if (copy) { copy.style.opacity = "1"; copy.style.transform = "none"; }
    if (img) img.style.filter = "brightness(1)";
    if (warm) warm.style.opacity = "0";
    return;
  }

  if (hdr) hdr.style.opacity = String(chromeP);
  if (tabbar) tabbar.style.opacity = String(chromeP);

  const motionStart = CONTENT_AT + SETTLE_DELAY;

  if (option === "b") {
    sections.forEach((el, i) => {
      const start = motionStart + i * SETTLE_STAGGER;
      const p = easeOutProgress(t, start, SETTLE_DUR);
      el.style.opacity = String(p);
      el.style.transform = `translateY(${lerp(SETTLE_Y, 0, p)}px)`;
    });
    if (copy) { copy.style.opacity = ""; copy.style.transform = ""; }
    if (img) img.style.filter = "brightness(1)";
    if (warm) warm.style.opacity = "0";
    return;
  }

  // Option C — projector warm-up on the hero still, the rest fades in.
  const warmP = easeOutProgress(t, motionStart, WARM_DUR);
  const brightness = lerp(0.42, 1, warmP);
  if (img) img.style.filter = `brightness(${brightness})`;
  let glow = 0;
  if (t >= motionStart) {
    const gAge = t - motionStart;
    if (gAge <= WARM_PEAK) {
      glow = easeOutProgress(t, motionStart, WARM_PEAK) * 0.9;
    } else {
      const fall = easeOutProgress(t, motionStart + WARM_PEAK, WARM_DUR - WARM_PEAK);
      glow = 0.9 * (1 - fall);
    }
  }
  if (warm) warm.style.opacity = String(glow);

  const others = [
    { el: copy, delay: 160, y: 6 },
    ...sections.filter((el) => !el.classList.contains("hero")).map((el, i) => ({
      el, delay: 230 + i * SETTLE_STAGGER, y: 6,
    })),
  ];
  others.forEach(({ el, delay, y }) => {
    if (!el) return;
    const p = easeOutProgress(t, motionStart + delay, SETTLE_DUR);
    el.style.opacity = String(p);
    el.style.transform = `translateY(${lerp(y, 0, p)}px)`;
  });
  if (hero) {
    hero.style.opacity = "1";
    hero.style.transform = "none";
  }
}

let raf = 0;
let playing = false;
let startedAt = 0;
let pausedAt = 0;

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
      pausedAt = CLIP;
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
  periodCenter,
  constants: {
    SPEED, LOGO_1X, LOGO_WALL, LOGO_LOCK_WALL, SPLASH_FADE,
    SETTLE_DELAY, SETTLE_DUR, SETTLE_STAGGER, SETTLE_Y, EASE,
    WARM_DUR, WARM_PEAK, BLUR_FROM, BLUR_DUR,
    DISSOLVE_START, DISSOLVE_BG, DISSOLVE_LOGO,
    IRIS_HOLD, IRIS_START, IRIS_DUR, IRIS_SOFT, IRIS_WORDMARK_DELAY, IRIS_WORDMARK_FADE,
    TITLE_DELAY_D, REST_DELAY_D, TITLE_DELAY_E, REST_DELAY_E,
    CLIP, CONTENT_AT,
  },
};

async function boot() {
  await window.cueboxAnimReady;
  window.cueboxAnim.play({ force: true, speed: 1 });
  window.cueboxAnim.seek(0);

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

document.getElementById("phone")?.addEventListener("click", () => {
  playFrom(0);
});
