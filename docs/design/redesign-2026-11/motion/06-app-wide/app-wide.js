(() => {
  "use strict";

  const EASE = {
    cuebox: [0.16, 1, 0.3, 1],
    inOut: [0.45, 0, 0.55, 1],
    decel: [0, 0, 0.2, 1],
    emphasized: [0.2, 0, 0, 1],
    linear: [0, 0, 1, 1],
  };

  const DEFAULTS = {
    ease: "cuebox",
    speed: 1,
    sheetDur: 800,
    sheetClose: 700,
    sheetDim: 55,
    sheetDimFade: 450,
    sheetDismiss: 120,
    toastIn: 700,
    toastOut: 600,
    toastTravel: 20,
    toastStay: 2800,
    searchOpen: 700,
    searchClose: 600,
    searchScale: 96,
    dialogDur: 400,
    dialogScale: 92,
    dialogDim: 62,
    pressAmt: 4,
    pressDown: 120,
    pressUp: 200,
    screenDur: 400,
  };

  const STEPS = {
    speed: 0.25,
    sheetDur: 10, sheetClose: 10, sheetDim: 5, sheetDimFade: 10, sheetDismiss: 10,
    toastIn: 10, toastOut: 10, toastTravel: 2, toastStay: 100,
    searchOpen: 10, searchClose: 10, searchScale: 1,
    dialogDur: 10, dialogScale: 1, dialogDim: 5,
    pressAmt: 1, pressDown: 10, pressUp: 10,
    screenDur: 10,
  };
  const RANGES = {
    speed: [0.25, 2],
    sheetDur: [200, 800], sheetClose: [150, 700], sheetDim: [20, 90], sheetDimFade: [100, 800], sheetDismiss: [40, 240],
    toastIn: [150, 700], toastOut: [120, 600], toastTravel: [0, 48], toastStay: [800, 5000],
    searchOpen: [150, 700], searchClose: [120, 600], searchScale: [86, 100],
    dialogDur: [150, 700], dialogScale: [80, 100], dialogDim: [20, 90],
    pressAmt: [1, 12], pressDown: [40, 240], pressUp: [60, 360],
    screenDur: [150, 700],
  };

  const settings = { ...DEFAULTS };

  const reducedEl = document.getElementById("reduced");
  const phone = document.getElementById("phone");
  const caption = document.getElementById("caption");
  const finger = document.getElementById("finger");
  const scenes = {
    menu: document.getElementById("scene-menu"),
    home: document.getElementById("scene-home"),
    watchlist: document.getElementById("scene-watchlist"),
    review: document.getElementById("scene-review"),
  };
  const filterSheet = document.getElementById("filterSheet");
  const sheetDim = document.getElementById("sheetDim");
  const showFilmsBtn = document.getElementById("showFilmsBtn");
  const searchSheet = document.getElementById("searchSheet");
  const homeDim = document.getElementById("homeDim");
  const toast = document.getElementById("toast");
  const alertDim = document.getElementById("alertDim");
  const alertDialog = document.getElementById("alertDialog");
  const reviewSheet = document.getElementById("reviewSheet");

  let raf = 0;
  let live = null;
  let sheetOpen = 0;
  let searchOpenAmt = 0;
  let toastAmt = 0;
  let dialogAmt = 0;

  function reducedOn() {
    if (window.cueboxPolishForceMotion) return false;
    return !!reducedEl.checked;
  }
  function speedMul() {
    return Math.max(0.25, Number(settings.speed) || 1);
  }
  function cubicBezierY(x, p) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const [x1, y1, x2, y2] = p;
    if (x1 === 0 && x2 === 1 && y1 === 0 && y2 === 1) return x;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const u = 1 - t;
      const f = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t - x;
      if (Math.abs(f) < 1e-6) break;
      const df = 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
      t -= f / (df || 1e-6);
    }
    t = Math.min(1, Math.max(0, t));
    const u = 1 - t;
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
  }
  function easeAt(u) {
    const p = EASE[settings.ease] || EASE.cuebox;
    return cubicBezierY(Math.min(1, Math.max(0, u)), p);
  }

  function fmt(field, v) {
    if (field === "speed") return Number(v).toFixed(2);
    return String(Math.round(Number(v)));
  }
  function clampField(field, v) {
    const [lo, hi] = RANGES[field];
    const step = STEPS[field];
    let n = Number(v);
    n = Math.round(n / step) * step;
    if (n < lo) n = lo;
    if (n > hi) n = hi;
    if (field === "speed") n = Math.round(n * 100) / 100;
    return n;
  }
  function setReadout(field) {
    const el = document.getElementById(field + "Val");
    if (el) el.textContent = fmt(field, settings[field]);
  }

  function setCaption(text, on) {
    caption.textContent = text || "";
    caption.classList.toggle("on", !!on && !!text);
  }

  function fingerAt(el, amount) {
    if (!el || amount <= 0) {
      finger.style.opacity = "0";
      finger.style.transform = "scale(0.7)";
      return;
    }
    const pr = phone.getBoundingClientRect();
    const br = el.getBoundingClientRect();
    finger.style.left = (br.left - pr.left + br.width / 2) + "px";
    finger.style.top = (br.top - pr.top + br.height / 2) + "px";
    finger.style.opacity = String(0.15 + 0.85 * amount);
    finger.style.transform = `scale(${0.7 + 0.3 * amount})`;
  }

  function hideFinger() { fingerAt(null, 0); }

  function showScenes(map) {
    // map: { home: opacity, ... } missing = hidden
    for (const [name, el] of Object.entries(scenes)) {
      if (map[name] == null) {
        el.classList.remove("on");
        el.style.opacity = "";
        el.style.zIndex = "";
      } else {
        el.classList.add("on");
        el.style.opacity = String(map[name]);
        el.style.zIndex = map[name] >= 1 ? "2" : "1";
      }
    }
  }

  function resetOverlays() {
    applySheet(0);
    applySearch(0);
    applyToast(0);
    applyDialog(0);
    applyPress(0);
    hideFinger();
    reviewSheet.style.transform = "none";
    reviewSheet.style.opacity = "1";
    const reviewDim = document.getElementById("reviewDim");
    if (reviewDim) reviewDim.style.opacity = "0.55";
  }

  function applySheet(p, dragY = 0) {
    sheetOpen = p;
    const red = reducedOn();
    const e = easeAt(p);
    const h = filterSheet.offsetHeight || 420;
    const y = red ? 0 : (1 - e) * h + dragY;
    filterSheet.style.transform = `translateY(${Math.max(0, y)}px)`;
    filterSheet.style.opacity = red ? String(e) : "1";
    const dimP = red ? e : easeAt(p);
    const dim = (settings.sheetDim / 100) * dimP;
    sheetDim.style.opacity = String(dim);
    sheetDim.classList.toggle("on", p > 0.02);
    sheetDim.style.background = "rgb(0,0,0)";
  }

  function applySearch(p) {
    searchOpenAmt = p;
    const red = reducedOn();
    const e = easeAt(p);
    const scale = red ? 1 : (settings.searchScale / 100) + (1 - settings.searchScale / 100) * e;
    searchSheet.style.opacity = String(e);
    searchSheet.style.transform = `scale(${scale})`;
    searchSheet.classList.toggle("open", p > 0.02);
    homeDim.style.opacity = String(e * 0.72);
    homeDim.classList.toggle("on", p > 0.02);
    // Make room for a toast if it's showing
    const bump = 72 * toastAmt;
    searchSheet.style.top = (58 + bump) + "px";
    searchSheet.classList.toggle("with-toast", toastAmt > 0.2);
  }

  function applyToast(p) {
    toastAmt = p;
    const red = reducedOn();
    const e = easeAt(p);
    const travel = red ? 0 : settings.toastTravel;
    toast.style.opacity = String(e);
    toast.style.transform = `translateY(${(1 - e) * -travel}px)`;
    // Keep search tucked under the toast
    if (searchOpenAmt > 0) {
      const bump = 72 * p;
      searchSheet.style.top = (58 + bump) + "px";
    }
  }

  function applyDialog(p) {
    dialogAmt = p;
    const red = reducedOn();
    const e = easeAt(p);
    const sc = red ? 1 : (settings.dialogScale / 100) + (1 - settings.dialogScale / 100) * e;
    alertDialog.style.opacity = String(e);
    alertDialog.style.transform = `translateY(-50%) scale(${sc})`;
    alertDialog.classList.toggle("open", p > 0.02);
    alertDim.style.opacity = String(e * (settings.dialogDim / 100));
    alertDim.classList.toggle("on", p > 0.02);
  }

  function applyPress(p) {
    // p 0 idle, 0-1: 0-0.5 down, 0.5-1 up. Or pass a scale directly via {scale}
    const amt = settings.pressAmt / 100;
    let s = 1;
    if (p <= 0) s = 1;
    else if (p <= 0.5) s = 1 - amt * easeAt(p / 0.5);
    else s = (1 - amt) + amt * easeAt((p - 0.5) / 0.5);
    showFilmsBtn.style.transform = `scale(${s})`;
  }

  function applyScreen(p) {
    const e = easeAt(p);
    showScenes({ home: 1, watchlist: e });
    scenes.watchlist.style.zIndex = "3";
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    live = null;
  }

  function animate(from, to, dur, onUpdate, onDone) {
    stop();
    const ms = Math.max(1, (reducedOn() ? 300 : dur) / speedMul());
    const t0 = performance.now();
    live = "anim";
    const step = (now) => {
      if (live !== "anim") return;
      const u = Math.min(1, (now - t0) / ms);
      onUpdate(from + (to - from) * u);
      if (u < 1) raf = requestAnimationFrame(step);
      else {
        live = null;
        if (onDone) onDone();
      }
    };
    raf = requestAnimationFrame(step);
  }

  function playSheet({ autoClose } = {}) {
    setCaption("", false);
    resetOverlays();
    showScenes({ watchlist: 1 });
    applySheet(0);
    animate(0, 1, settings.sheetDur, applySheet, () => {
      if (autoClose) {
        setTimeout(() => {
          animate(1, 0, settings.sheetClose, applySheet);
        }, 200);
      }
    });
  }

  function playToast() {
    setCaption("", false);
    resetOverlays();
    showScenes({ home: 1 });
    applySearch(1);
    applyToast(0);
    animate(0, 1, settings.toastIn, applyToast, () => {
      const stay = (reducedOn() ? 800 : settings.toastStay) / speedMul();
      const token = Symbol("toast");
      playToast.token = token;
      if (playToast.tid) clearTimeout(playToast.tid);
      playToast.tid = setTimeout(() => {
        if (playToast.token !== token) return;
        animate(1, 0, settings.toastOut, applyToast);
      }, stay);
    });
  }

  function playSearch({ autoClose } = {}) {
    setCaption("", false);
    resetOverlays();
    showScenes({ home: 1 });
    applySearch(0);
    animate(0, 1, settings.searchOpen, applySearch, () => {
      if (autoClose) {
        setTimeout(() => animate(1, 0, settings.searchClose, applySearch), 200);
      }
    });
  }

  function playDialog({ autoClose } = {}) {
    setCaption("", false);
    resetOverlays();
    showScenes({ review: 1 });
    applyDialog(0);
    animate(0, 1, settings.dialogDur, applyDialog, () => {
      if (autoClose) {
        setTimeout(() => animate(1, 0, settings.dialogDur, applyDialog), 200);
      }
    });
  }

  function playPress() {
    setCaption("", false);
    resetOverlays();
    showScenes({ watchlist: 1 });
    applySheet(1);
    applyPress(0);
    const down = reducedOn() ? 0 : settings.pressDown;
    const up = reducedOn() ? 0 : settings.pressUp;
    if (reducedOn()) {
      applyPress(0);
      return;
    }
    animate(0, 0.5, down, applyPress, () => {
      animate(0.5, 1, up, applyPress, () => applyPress(0));
    });
  }

  function playScreen() {
    setCaption("", false);
    resetOverlays();
    showScenes({ home: 1, watchlist: 0 });
    animate(0, 1, settings.screenDur, applyScreen, () => {
      showScenes({ watchlist: 1 });
    });
  }

  const plays = { sheet: playSheet, toast: playToast, search: playSearch, dialog: playDialog, press: playPress, screen: playScreen };

  function goMenu() {
    stop();
    if (playToast.tid) clearTimeout(playToast.tid);
    resetOverlays();
    setCaption("", false);
    showScenes({ menu: 1 });
  }

  // Drag to dismiss
  let drag = null;
  function onSheetDown(ev) {
    if (sheetOpen < 0.98) return;
    if (!filterSheet.closest(".scene.on")) return;
    const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
    drag = { y0: y, dy: 0 };
    stop();
    ev.preventDefault();
  }
  function onSheetMove(ev) {
    if (!drag) return;
    const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
    drag.dy = Math.max(0, y - drag.y0);
    const h = filterSheet.offsetHeight || 420;
    applySheet(1, drag.dy);
    const dimFade = 1 - Math.min(1, drag.dy / h);
    sheetDim.style.opacity = String((settings.sheetDim / 100) * dimFade);
  }
  function onSheetUp() {
    if (!drag) return;
    const dy = drag.dy;
    drag = null;
    if (dy >= settings.sheetDismiss) {
      const h = filterSheet.offsetHeight || 420;
      const start = 1 - dy / h;
      animate(Math.max(0, start), 0, settings.sheetClose, (p) => applySheet(p));
    } else {
      // snap back — treat current y as a fake open progress
      const h = filterSheet.offsetHeight || 420;
      const start = 1 - dy / h;
      animate(Math.max(0, start), 1, 220, applySheet);
    }
  }
  filterSheet.addEventListener("pointerdown", onSheetDown);
  window.addEventListener("pointermove", onSheetMove);
  window.addEventListener("pointerup", onSheetUp);
  window.addEventListener("pointercancel", onSheetUp);

  document.getElementById("toMenu").addEventListener("click", goMenu);
  document.querySelectorAll("[data-play]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-play");
      if (plays[kind]) plays[kind]();
    });
  });
  document.querySelectorAll("[data-open-search]").forEach((el) => {
    el.addEventListener("click", () => playSearch());
  });
  document.querySelectorAll("[data-close-search]").forEach((el) => {
    el.addEventListener("click", () => animate(searchOpenAmt, 0, settings.searchClose, applySearch));
  });
  document.querySelectorAll("[data-open-sheet]").forEach((el) => {
    el.addEventListener("click", () => playSheet());
  });
  document.querySelectorAll("[data-open-dialog]").forEach((el) => {
    el.addEventListener("click", () => playDialog());
  });
  document.querySelectorAll("[data-close-dialog]").forEach((el) => {
    el.addEventListener("click", () => animate(dialogAmt, 0, settings.dialogDur, applyDialog));
  });
  document.querySelectorAll("[data-add-toast]").forEach((el) => {
    el.addEventListener("click", () => {
      if (searchOpenAmt < 1) applySearch(1);
      animate(0, 1, settings.toastIn, applyToast, () => {
        const token = Symbol("toast");
        playToast.token = token;
        playToast.tid = setTimeout(() => {
          if (playToast.token !== token) return;
          animate(1, 0, settings.toastOut, applyToast);
        }, settings.toastStay / speedMul());
      });
    });
  });
  document.querySelectorAll("[data-goto-watchlist]").forEach((el) => {
    el.addEventListener("click", () => {
      if (scenes.home.classList.contains("on")) playScreen();
    });
  });

  function bindField(field) {
    const input = document.getElementById(field);
    if (!input) return;
    const applyVal = (v) => {
      settings[field] = clampField(field, v);
      input.value = settings[field];
      setReadout(field);
    };
    input.addEventListener("input", () => applyVal(input.value));
    document.querySelectorAll(`button[data-field="${field}"]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        applyVal(Number(settings[field]) + Number(btn.dataset.dir) * STEPS[field]);
      });
    });
    setReadout(field);
  }
  Object.keys(STEPS).forEach(bindField);
  document.getElementById("ease").addEventListener("change", (e) => {
    settings.ease = e.target.value;
  });

  // Scripted MP4 tour
  function scriptTimes() {
    const cap = 0;
    const pre = 350;
    const holdSheet = 900;
    const gap = 350;
    const toastHold = 1400;
    const searchHold = 1000;
    const dialogHold = 1100;
    const pressHold = 700;
    const screenHold = 900;
    const postCap = 180;

    const sheetOpen = reducedOn() ? 300 : settings.sheetDur;
    const sheetClose = reducedOn() ? 300 : settings.sheetClose;
    const toastIn = reducedOn() ? 300 : settings.toastIn;
    const toastOut = reducedOn() ? 300 : settings.toastOut;
    const searchOpen = reducedOn() ? 300 : settings.searchOpen;
    const searchClose = reducedOn() ? 300 : settings.searchClose;
    const dialogDur = reducedOn() ? 300 : settings.dialogDur;
    const pressDown = reducedOn() ? 0 : settings.pressDown;
    const pressUp = reducedOn() ? 0 : settings.pressUp;
    const screenDur = reducedOn() ? 300 : settings.screenDur;

    let t = 0;
    const tSheetLabel = t;
    t += postCap;
    const tSheetPre = t;
    t += pre;
    const tSheetOpen = t;
    t += sheetOpen;
    const tSheetHold = t;
    t += holdSheet;
    const tSheetClose = t;
    t += sheetClose;
    t += gap;

    const tToastLabel = t;
    t += postCap;
    const tToastPre = t;
    t += pre;
    const tToastIn = t;
    t += toastIn;
    const tToastHold = t;
    t += toastHold;
    const tToastOut = t;
    t += toastOut;
    t += gap;

    const tSearchLabel = t;
    t += postCap;
    const tSearchPre = t;
    t += pre;
    const tSearchOpen = t;
    t += searchOpen;
    const tSearchHold = t;
    t += searchHold;
    const tSearchClose = t;
    t += searchClose;
    t += gap;

    const tDialogLabel = t;
    t += postCap;
    const tDialogPre = t;
    t += pre;
    const tDialogOpen = t;
    t += dialogDur;
    const tDialogHold = t;
    t += dialogHold;
    const tDialogClose = t;
    t += dialogDur;
    t += gap;

    const tPressLabel = t;
    t += postCap;
    const tPressPre = t;
    t += 500;
    const tPressDown = t;
    t += pressDown || 80;
    const tPressUp = t;
    t += pressUp || 80;
    t += pressHold;
    t += gap;

    const tScreenLabel = t;
    t += postCap;
    const tScreenPre = t;
    t += pre;
    const tScreenGo = t;
    t += screenDur;
    const tScreenHold = t;
    t += screenHold;

    return {
      tSheetLabel, tSheetPre, tSheetOpen, tSheetHold, tSheetClose,
      tToastLabel, tToastPre, tToastIn, tToastHold, tToastOut,
      tSearchLabel, tSearchPre, tSearchOpen, tSearchHold, tSearchClose,
      tDialogLabel, tDialogPre, tDialogOpen, tDialogHold, tDialogClose,
      tPressLabel, tPressPre, tPressDown, tPressUp,
      tScreenLabel, tScreenPre, tScreenGo, tScreenHold,
      duration: t,
      mid: tSheetHold + holdSheet / 2,
    };
  }

  function apply(t) {
    const S = scriptTimes();
    const tt = Math.max(0, t);
    hideFinger();

    function cap(name, on) { setCaption(name, on); }

    if (tt < S.tToastLabel) {
      cap("Bottom sheet", true);
      resetOverlays();
      showScenes({ watchlist: 1 });
      if (tt < S.tSheetOpen) applySheet(0);
      else if (tt < S.tSheetHold) applySheet((tt - S.tSheetOpen) / Math.max(1, S.tSheetHold - S.tSheetOpen));
      else if (tt < S.tSheetClose) applySheet(1);
      else applySheet(1 - (tt - S.tSheetClose) / Math.max(1, S.tToastLabel - S.tSheetClose > 0 ? settings.sheetClose : 1));
      // fix close end: from tSheetClose to tSheetClose+sheetClose
      if (tt >= S.tSheetClose) {
        const d = Math.max(1, (reducedOn() ? 300 : settings.sheetClose));
        applySheet(1 - Math.min(1, (tt - S.tSheetClose) / d));
      }
      return;
    }
    if (tt < S.tSearchLabel) {
      cap("Pop-up message", true);
      showScenes({ home: 1 });
      applySheet(0);
      applyDialog(0);
      applyPress(0);
      applySearch(1);
      if (tt < S.tToastIn) applyToast(0);
      else if (tt < S.tToastHold) applyToast((tt - S.tToastIn) / Math.max(1, S.tToastHold - S.tToastIn));
      else if (tt < S.tToastOut) applyToast(1);
      else {
        const d = Math.max(1, (reducedOn() ? 300 : settings.toastOut));
        applyToast(1 - Math.min(1, (tt - S.tToastOut) / d));
      }
      return;
    }
    if (tt < S.tDialogLabel) {
      cap("Search", true);
      showScenes({ home: 1 });
      applySheet(0);
      applyToast(0);
      applyDialog(0);
      if (tt < S.tSearchOpen) applySearch(0);
      else if (tt < S.tSearchHold) applySearch((tt - S.tSearchOpen) / Math.max(1, S.tSearchHold - S.tSearchOpen));
      else if (tt < S.tSearchClose) applySearch(1);
      else {
        const d = Math.max(1, (reducedOn() ? 300 : settings.searchClose));
        applySearch(1 - Math.min(1, (tt - S.tSearchClose) / d));
      }
      return;
    }
    if (tt < S.tPressLabel) {
      cap("Confirm box", true);
      showScenes({ review: 1 });
      applySheet(0);
      applySearch(0);
      applyToast(0);
      applyPress(0);
      if (tt < S.tDialogOpen) applyDialog(0);
      else if (tt < S.tDialogHold) applyDialog((tt - S.tDialogOpen) / Math.max(1, S.tDialogHold - S.tDialogOpen));
      else if (tt < S.tDialogClose) applyDialog(1);
      else {
        const d = Math.max(1, (reducedOn() ? 300 : settings.dialogDur));
        applyDialog(1 - Math.min(1, (tt - S.tDialogClose) / d));
      }
      return;
    }
    if (tt < S.tScreenLabel) {
      cap("Button press", true);
      showScenes({ watchlist: 1 });
      applySearch(0);
      applyToast(0);
      applyDialog(0);
      applySheet(1);
      if (tt < S.tPressDown) {
        applyPress(0);
        const u = (tt - S.tPressPre) / Math.max(1, S.tPressDown - S.tPressPre);
        fingerAt(showFilmsBtn, Math.min(1, u));
      } else if (tt < S.tPressUp) {
        const d = Math.max(1, S.tPressUp - S.tPressDown);
        applyPress(0.5 * Math.min(1, (tt - S.tPressDown) / d));
        fingerAt(showFilmsBtn, 1);
      } else {
        const d = Math.max(1, (reducedOn() ? 80 : settings.pressUp));
        const u = Math.min(1, (tt - S.tPressUp) / d);
        applyPress(0.5 + 0.5 * u);
        fingerAt(showFilmsBtn, 1 - u);
      }
      return;
    }
    cap("Changing screens", true);
    applySheet(0);
    applySearch(0);
    applyToast(0);
    applyDialog(0);
    applyPress(0);
    if (tt < S.tScreenGo) {
      showScenes({ home: 1 });
    } else if (tt < S.tScreenHold) {
      const d = Math.max(1, S.tScreenHold - S.tScreenGo);
      applyScreen(Math.min(1, (tt - S.tScreenGo) / d));
    } else {
      showScenes({ watchlist: 1 });
    }
  }

  function midTime() { return scriptTimes().mid; }
  function duration() { return scriptTimes().duration; }

  const params = new URLSearchParams(location.search);
  if (params.has("render")) document.documentElement.classList.add("render");

  window.cueboxDetail = { settings, apply, midTime, duration, stop, scriptTimes };

  function ready() {
    resetOverlays();
    showScenes({ menu: 1 });
    document.documentElement.dataset.polishReady = "1";
  }

  const fontReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontReady.then(() => {
    const urls = ["art/wicker-meadow.jpg", "art/witch-forest.jpg", "art/candle-dark.jpg", "art/old-house.jpg", "art/fog-woods.jpg", "art/fog-moor.jpg", "art/rain-street.jpg", "art/rain-neon.jpg", "art/coastal-cliffs.jpg", "art/fire-warm.jpg", "art/daisies.jpg", "art/neon-city.jpg"];
    Promise.all(urls.map((src) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = res;
      im.src = src;
    }))).then(() => requestAnimationFrame(() => requestAnimationFrame(ready)));
  });
})();
