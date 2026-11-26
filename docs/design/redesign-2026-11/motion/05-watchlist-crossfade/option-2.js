(() => {
  "use strict";

  const EASE = {
    cuebox: [0.16, 1, 0.3, 1],
    inOut: [0.45, 0, 0.55, 1],
    decel: [0, 0, 0.2, 1],
    emphasized: [0.2, 0, 0, 1],
    linear: [0, 0, 1, 1],
  };

  const STAR = `<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5 14.4 9l5.8.6-4.4 3.8 1.3 5.6L12 16.2 6.9 19l1.3-5.6L3.8 9.6 9.6 9 12 3.5Z"/></svg>`;

  const TYPES = ["t2", "t3", "t4", "t5", "t6", "t7"];

  function initial(title) {
    const t = String(title).replace(/^(The|A|An)\s+/i, "");
    return t.charAt(0).toUpperCase();
  }

  function typo(title, i) {
    return { title, type: TYPES[i % TYPES.length], init: initial(title) };
  }

  function still(title, img) {
    return { title, img: "art/" + img };
  }

  function watched(title, rating, imgOrType, init) {
    const film = imgOrType && String(imgOrType).includes(".")
      ? still(title, imgOrType)
      : typo(title, TYPES.indexOf(imgOrType) >= 0 ? TYPES.indexOf(imgOrType) : 0);
    if (imgOrType && !String(imgOrType).includes(".") && TYPES.includes(imgOrType)) {
      film.type = imgOrType;
      film.init = init || initial(title);
    }
    if (rating) film.rating = rating;
    return film;
  }

  const UNWATCHED_SEED = [
    still("The Witch", "witch-forest.jpg"),
    still("The Lighthouse", "candle-dark.jpg"),
    still("Lamb", "old-house.jpg"),
    still("The Innocents", "fog-woods.jpg"),
    still("Carnival of Souls", "fog-moor.jpg"),
    still("Eraserhead", "rain-street.jpg"),
    still("Under the Skin", "rain-neon.jpg"),
    still("Portrait of a Lady on Fire", "coastal-cliffs.jpg"),
    still("Burning", "fire-warm.jpg"),
    still("Cinema Paradiso", "cinema.jpg"),
    still("Titane", "neon-city.jpg"),
    typo("Saint Maud", 0),
    typo("A Ghost Story", 1),
    typo("Petite Maman", 2),
    typo("Aftersun", 3),
    typo("The Zone of Interest", 4),
    typo("Past Lives", 5),
    typo("Decision to Leave", 0),
  ];

  const UNWATCHED_EXTRA = [
    "The Night of the Hunter", "Nosferatu", "Hereditary", "The Babadook", "Raw",
    "Suspiria", "The Descent", "Don't Look Now", "Picnic at Hanging Rock", "The Others",
    "The Devil's Backbone", "Pan's Labyrinth", "The Orphanage", "The Invitation", "It Follows",
    "Possession", "Repulsion", "The Beyond", "Black Sunday", "Eyes Without a Face",
    "Hour of the Wolf", "Häxan", "Vampyr", "Onibaba", "Kwaidan",
    "Kuroneko", "Audition", "Pulse", "Ringu", "Dark Water",
    "The Host", "Memoria", "The Souvenir", "After Yang", "First Reformed",
    "Mandy", "Color Out of Space", "The Northman", "The Empty Man", "The Lodge",
    "Relic", "His House", "Censor", "She Dies Tomorrow", "The Killing of a Sacred Deer",
    "The Favourite", "Poor Things", "The Piano", "Force Majeure", "The Square",
    "Triangle of Sadness", "Another Round", "The Worst Person in the World", "Drive My Car", "Shoplifters",
    "Parasite", "Memories of Murder", "Oldboy", "The Handmaiden", "I Saw the Devil",
    "Train to Busan", "Cure", "Perfect Blue", "Paprika", "Millennium Actress",
    "Spirited Away", "Princess Mononoke", "My Neighbor Totoro", "Grave of the Fireflies", "Akira",
    "The Seventh Seal", "Persona", "Wild Strawberries", "Through a Glass Darkly", "Cries and Whispers",
    "Mulholland Drive", "Blue Velvet", "Eraserhead", "Lost Highway", "Inland Empire",
  ].map((title, i) => typo(title, (i + 1) % 6));

  const WATCHED_SEED = [
    watched("The Wicker Man", "4.5", "wicker-meadow.jpg"),
    watched("Midsommar", "4", "daisies.jpg"),
    watched("2001: A Space Odyssey", "5", "t3", "2"),
    watched("Hellraiser", "3.5", "t5", "H"),
    watched("Seven Samurai", "5", "t4", "S"),
    watched("Sid and Nancy", null, "t6", "S"),
    watched("Groundhog Day", "4", "t3", "G"),
    watched("12 Years a Slave", "4.5", "t7", "1"),
    watched("The Lady Vanishes", "4", "t2", "L"),
  ];

  const WATCHED_EXTRA = [
    ["The Exorcist", "5"], ["Rosemary's Baby", "4.5"], ["Halloween", "4"],
    ["Carrie", "4"], ["The Shining", "5"], ["Don't Breathe", "3"],
    ["Get Out", "4.5"], ["Us", "4"], ["Nope", "3.5"],
    ["The Silence of the Lambs", "5"], ["Se7en", "4.5"], ["Zodiac", "4.5"],
    ["There Will Be Blood", "5"], ["The Master", "4"], ["Phantom Thread", "4.5"],
    ["Punch-Drunk Love", "4"], ["Boogie Nights", "4.5"], ["Magnolia", "4"],
    ["Heat", "5"], ["Collateral", "4"], ["The Insider", "4"],
    ["Amadeus", "5"], ["Barry Lyndon", "5"], ["A Clockwork Orange", "4.5"],
    ["Dr. Strangelove", "5"], ["Paths of Glory", "5"], ["The Killing", "4"],
    ["Fargo", "4.5"], ["No Country for Old Men", "5"], ["The Big Lebowski", "4.5"],
    ["Paris, Texas", "5"], ["Wings of Desire", "4.5"], ["Until the End of the World", "3.5"],
    ["Yi Yi", "5"], ["A Brighter Summer Day", "4.5"], ["Crouching Tiger, Hidden Dragon", "4.5"],
    ["In the Mood for Love", "5"], ["Chungking Express", "4.5"], ["Fallen Angels", "4"],
    ["The Godfather", "5"], ["The Godfather Part II", "5"], ["Apocalypse Now", "5"],
    ["Goodfellas", "5"], ["Casino", "4"], ["The Irishman", "4"],
    ["Taxi Driver", "5"], ["Raging Bull", "5"], ["The King of Comedy", "4.5"],
    ["Alien", "5"], ["Aliens", "4.5"], ["Blade Runner", "5"],
    ["Blade Runner 2049", "4.5"], ["Arrival", "4.5"], ["Dune", "4"],
    ["Moonlight", "5"], ["If Beale Street Could Talk", "4.5"], ["Barry", "3.5"],
    ["Tár", "4.5"], ["Anatomy of a Fall", "4.5"], ["Zone of Interest", "4"],
  ].map(([title, rating], i) => {
    const f = typo(title, i % 6);
    f.rating = rating;
    return f;
  });

  const ARCHIVED = [
    "Plan 9 from Outer Space", "Reefer Madness", "Manos: The Hands of Fate", "The Room",
    "Troll 2", "Birdemic", "The Happening", "Cats", "Battlefield Earth", "Gigli",
    "Showgirls", "Crossroads", "Movie 43", "Disaster Movie", "Epic Movie",
    "Meet the Spartans", "Date Movie", "Vampires Suck", "Jack and Jill", "The Love Guru",
    "Holmes & Watson", "Morbius", "Madame Web", "Fantastic Four", "Batman & Robin",
    "The Last Airbender", "After Earth", "Jupiter Ascending", "Gods of Egypt", "John Carter",
    "Wild Wild West", "Howard the Duck", "The Adventures of Pluto Nash", "Cutthroat Island",
    "Ishtar", "Heaven's Gate", "The Bonfire of the Vanities", "Town & Country",
    "Hudson Hawk", "Stop! Or My Mom Will Shoot", "Leonard Part 6", "Mac and Me",
    "Cool as Ice", "Glitter", "From Justin to Kelly", "Norbit", "The Master of Disguise",
    "Baby Geniuses", "Superbabies", "Box Office Poison", "The Swarm",
  ].map((title, i) => typo(title, i % 6));

  const LISTS = {
    unwatched: { label: "unwatched", total: 239, seed: UNWATCHED_SEED, extra: UNWATCHED_EXTRA },
    watched: { label: "watched", total: 412, seed: WATCHED_SEED, extra: WATCHED_EXTRA },
    archived: { label: "archived", total: 36, seed: [], extra: ARCHIVED.slice(0, 36) },
  };

  function catalog(key) {
    const L = LISTS[key];
    return L.seed.concat(L.extra);
  }

  function previewTotal(key) {
    return catalog(key).length;
  }

  const DEFAULTS = {
    out: 400,
    in: 600,
    overlap: 200,
    ease: "cuebox",
    batch: 300,
    stagger: 30,
    fetch: 600,
    trigger: 600,
    page: 18,
    speed: 1,
  };

  const STEPS = {
    out: 10, in: 10, overlap: 10, batch: 10, stagger: 5,
    fetch: 50, trigger: 50, page: 3, speed: 0.25,
  };
  const RANGES = {
    out: [0, 400], in: [0, 600], overlap: [-200, 200], batch: [80, 600],
    stagger: [0, 120], fetch: [0, 2000], trigger: [100, 1200], page: [6, 36],
    speed: [0.25, 2],
  };

  const settings = { ...DEFAULTS };

  const phone = document.getElementById("phone");
  const scroller = document.getElementById("scroller");
  const grid = document.getElementById("grid");
  const gridOut = document.getElementById("gridOut");
  const countEl = document.getElementById("count");
  const pillsEl = document.getElementById("pills");
  const loader = document.getElementById("loader");
  const spinner = document.getElementById("spinner");
  const endcap = document.getElementById("endcap");
  const finger = document.getElementById("finger");
  const reducedEl = document.getElementById("reduced");

  let currentList = "unwatched";
  let shown = 0;
  let fading = false;
  let fetchTimer = null;
  let loading = false;
  let raf = 0;
  let animStart = 0;
  let liveMode = "idle"; // idle | fade | fetch | batch
  let liveFrom = "unwatched";
  let liveTo = "unwatched";
  let liveShownBefore = 0;
  let liveT0 = 0;

  function reducedOn() {
    if (window.cueboxPolishForceMotion) return false;
    return !!reducedEl.checked;
  }

  function speedMul() {
    return Math.max(0.25, Number(settings.speed) || 1);
  }

  function easeCss() {
    const p = EASE[settings.ease] || EASE.cuebox;
    return `cubic-bezier(${p[0]}, ${p[1]}, ${p[2]}, ${p[3]})`;
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
    const p = reducedOn() ? EASE.cuebox : (EASE[settings.ease] || EASE.cuebox);
    return cubicBezierY(Math.min(1, Math.max(0, u)), p);
  }

  function fadeTimes() {
    if (reducedOn()) return { out: 300, inn: 300, overlap: 300, total: 300 };
    const out = Number(settings.out);
    const inn = Number(settings.in);
    const overlap = Number(settings.overlap);
    const total = Math.max(out, inn, out + inn - overlap, 1);
    return { out, inn, overlap, total };
  }

  function batchTimes(count) {
    if (reducedOn()) return { fade: 300, stagger: 0, total: 300, count };
    const fade = Number(settings.batch);
    const stagger = Number(settings.stagger);
    const n = Math.max(0, count);
    const total = n <= 0 ? 0 : fade + Math.max(0, n - 1) * stagger;
    return { fade, stagger, total, count: n };
  }

  function fetchMs() {
    return reducedOn() ? Math.min(Number(settings.fetch), 300) : Number(settings.fetch);
  }

  function fmt(field, v) {
    if (field === "speed") return Number(v).toFixed(2);
    if (field === "overlap") return String(Math.round(Number(v)));
    return String(Math.round(Number(v)));
  }

  function setReadout(field) {
    const el = document.getElementById(field + "Val");
    if (el) el.textContent = fmt(field, settings[field]);
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

  function tileHTML(film) {
    let art;
    if (film.img) {
      art = `<img src="${film.img}" alt="">`;
    } else {
      art = `<div class="poster-type ${film.type || "t2"}"><span class="init">${film.init || initial(film.title)}</span></div>`;
    }
    const rating = film.rating
      ? `<span class="rating" aria-label="${film.rating} out of 5">${STAR}${film.rating}</span>`
      : "";
    return `<article class="tile"><div class="art">${art}${rating}</div><h3>${escapeHtml(film.title)}</h3></article>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function filmsSlice(key, start, end) {
    return catalog(key).slice(start, end);
  }

  function renderTiles(el, films) {
    el.innerHTML = films.map(tileHTML).join("");
  }

  function setCount(key) {
    const L = LISTS[key];
    countEl.textContent = `${L.total} ${L.label}`;
  }

  function setPills(key) {
    pillsEl.querySelectorAll(".chip").forEach((btn) => {
      const on = btn.dataset.list === key;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function setLoader(on, rot) {
    loader.classList.toggle("on", !!on);
    if (on) {
      spinner.style.transform = `rotate(${rot || 0}deg)`;
    } else {
      spinner.style.transform = "rotate(0deg)";
    }
  }

  function setEndcap(on) {
    endcap.classList.toggle("on", !!on);
  }

  function cancelFetch() {
    if (fetchTimer) {
      cancelAnimationFrame(fetchTimer);
      fetchTimer = null;
    }
    loading = false;
    setLoader(false);
  }

  function fillGrid(key, count) {
    currentList = key;
    shown = Math.min(count, previewTotal(key));
    renderTiles(grid, filmsSlice(key, 0, shown));
    grid.style.opacity = "1";
    gridOut.hidden = true;
    gridOut.innerHTML = "";
    setCount(key);
    setPills(key);
    setEndcap(shown >= previewTotal(key));
    setLoader(false);
  }

  function resetToUnwatched() {
    cancelFetch();
    fading = false;
    liveMode = "idle";
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    scroller.scrollTop = 0;
    fillGrid("unwatched", settings.page);
    maybeLoadMore();
  }

  function nearBottom() {
    const remain = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    return remain <= Number(settings.trigger);
  }

  function maybeLoadMore() {
    if (fading || loading) return;
    if (shown >= previewTotal(currentList)) {
      setEndcap(true);
      return;
    }
    if (!nearBottom()) return;
    startFetch();
  }

  function startFetch() {
    if (loading || fading) return;
    if (shown >= previewTotal(currentList)) return;
    loading = true;
    setEndcap(false);
    setLoader(true, 0);
    const start = performance.now();
    const delay = fetchMs() / speedMul();
    const tick = () => {
      if (!loading) return;
      const elapsed = performance.now() - start;
      spinner.style.transform = `rotate(${(elapsed / 700) * 360}deg)`;
      if (elapsed >= delay) {
        fetchTimer = null;
        appendBatch();
        return;
      }
      fetchTimer = requestAnimationFrame(tick);
    };
    fetchTimer = requestAnimationFrame(tick);
  }

  function appendBatch() {
    const page = Number(settings.page);
    const next = filmsSlice(currentList, shown, shown + page);
    if (!next.length) {
      loading = false;
      setLoader(false);
      setEndcap(true);
      return;
    }
    const times = batchTimes(next.length);
    const startIndex = shown;
    const html = next.map(tileHTML).join("");
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const added = [...wrap.children];
    added.forEach((el) => {
      el.style.opacity = "0";
      grid.appendChild(el);
    });
    shown += next.length;
    setLoader(false);
    loading = false;
    liveMode = "batch";
    liveShownBefore = startIndex;
    const t0 = performance.now();
    liveT0 = t0;
    const dur = times.total / speedMul();
    const step = (now) => {
      if (liveMode !== "batch") return;
      const u = dur <= 0 ? 1 : Math.min(1, (now - t0) / dur);
      applyBatchOpacity(added, (now - t0) * speedMul());
      if (u < 1) {
        raf = requestAnimationFrame(step);
      } else {
        liveMode = "idle";
        added.forEach((el) => { el.style.opacity = "1"; });
        setEndcap(shown >= previewTotal(currentList));
        maybeLoadMore();
      }
    };
    raf = requestAnimationFrame(step);
  }

  function applyBatchOpacity(els, localMs) {
    const times = batchTimes(els.length);
    els.forEach((el, i) => {
      const start = i * times.stagger;
      const u = times.fade <= 0 ? 1 : Math.min(1, Math.max(0, (localMs - start) / times.fade));
      el.style.opacity = String(easeAt(u));
    });
  }

  function crossfadeTo(nextKey, { fromScript } = {}) {
    if (fading) return;
    if (nextKey === currentList && !fromScript) return;
    cancelFetch();
    if (raf) cancelAnimationFrame(raf);
    const fromKey = currentList;
    const fromShown = shown;
    const fromFilms = filmsSlice(fromKey, 0, fromShown);
    renderTiles(gridOut, fromFilms);
    gridOut.hidden = false;
    gridOut.style.opacity = "1";
    fillGrid(nextKey, settings.page);
    // fillGrid would hide gridOut — restore
    gridOut.hidden = false;
    gridOut.style.opacity = "1";
    grid.style.opacity = "0";
    currentList = nextKey;
    setCount(nextKey);
    setPills(nextKey);
    scroller.scrollTop = 0;
    fading = true;
    liveMode = "fade";
    liveFrom = fromKey;
    liveTo = nextKey;
    const times = fadeTimes();
    const dur = times.total / speedMul();
    const t0 = performance.now();
    liveT0 = t0;
    const step = (now) => {
      if (liveMode !== "fade") return;
      const local = (now - t0) * speedMul();
      applyCrossfade(local, times);
      if (local >= times.total) {
        finishFade();
      } else {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
  }

  function applyCrossfade(local, times) {
    const outStart = 0;
    const inStart = Math.max(0, times.out - times.overlap);
    const outU = times.out <= 0 ? 1 : Math.min(1, Math.max(0, (local - outStart) / times.out));
    const inU = times.inn <= 0 ? 1 : Math.min(1, Math.max(0, (local - inStart) / times.inn));
    gridOut.style.opacity = String(1 - easeAt(outU));
    grid.style.opacity = String(easeAt(inU));
  }

  function finishFade() {
    fading = false;
    liveMode = "idle";
    gridOut.hidden = true;
    gridOut.innerHTML = "";
    gridOut.style.opacity = "1";
    grid.style.opacity = "1";
    maybeLoadMore();
  }

  pillsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    crossfadeTo(btn.dataset.list);
  });

  scroller.addEventListener("scroll", () => {
    if (document.documentElement.classList.contains("render")) return;
    maybeLoadMore();
  }, { passive: true });

  document.getElementById("replay").addEventListener("click", () => {
    resetToUnwatched();
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
        const dir = Number(btn.dataset.dir);
        applyVal(Number(settings[field]) + dir * STEPS[field]);
      });
    });
  }

  ["out", "in", "overlap", "batch", "stagger", "fetch", "trigger", "page", "speed"].forEach(bindField);
  document.getElementById("ease").addEventListener("change", (e) => {
    settings.ease = e.target.value;
  });

  function easeInOut(u) {
    return cubicBezierY(u, [0.45, 0, 0.55, 1]);
  }

  function scriptTimes() {
    // Uses current settings (MP4 render uses defaults + reduced off)
    const fade = fadeTimes();
    const page = Number(settings.page);
    const batch = batchTimes(page); // next page is a full page unless remaining is less
    const fetch = Number(settings.fetch);
    const holdA = 700;
    const tap1 = 280;
    const holdB = 900;
    const tap2 = 280;
    const holdC = 700;
    const scrollDur = 2400;
    const holdEnd = 1200;
    const t0 = 0;
    const tTap1 = holdA;
    const tFade1 = tTap1 + tap1;
    const tHoldB = tFade1 + fade.total;
    const tTap2 = tHoldB + holdB;
    const tFade2 = tTap2 + tap2;
    const tHoldC = tFade2 + fade.total;
    const tScroll = tHoldC + holdC;
    const tFetch = tScroll + scrollDur;
    const tBatch = tFetch + fetch;
    const tEndHold = tBatch + batch.total;
    const duration = tEndHold + holdEnd;
    return {
      fade, batch, fetch, page,
      holdA, tap1, holdB, tap2, holdC, scrollDur, holdEnd,
      tTap1, tFade1, tHoldB, tTap2, tFade2, tHoldC, tScroll, tFetch, tBatch, tEndHold, duration,
    };
  }

  let metrics = { tileH: 219, rowGap: 12, padTop: 4, padBot: 24, scrollerH: 546, content1: 1336 };

  function measure() {
    const prevScroll = scroller.scrollTop;
    const prevShown = shown;
    const prevList = currentList;
    fillGrid("unwatched", settings.page);
    scroller.scrollTop = 0;
    const tile = grid.querySelector(".tile");
    if (tile) metrics.tileH = tile.getBoundingClientRect().height;
    metrics.scrollerH = scroller.clientHeight;
    metrics.content1 = scroller.scrollHeight;
    // restore if needed
    if (prevList !== "unwatched" || prevShown !== settings.page) {
      fillGrid(prevList, prevShown);
    }
    scroller.scrollTop = prevScroll;
  }

  function triggerScrollTop() {
    const content = metrics.content1;
    const client = metrics.scrollerH;
    const trigger = Number(settings.trigger);
    return Math.max(0, content - client - trigger);
  }

  function yLoader() {
    return Math.max(0, metrics.content1 + 56 - metrics.scrollerH);
  }

  function yReveal() {
    return yLoader() + 2 * (metrics.tileH + metrics.rowGap);
  }

  function fingerAtPill(key, amount) {
    const btn = pillsEl.querySelector(`[data-list="${key}"]`);
    if (!btn || amount <= 0) {
      finger.style.opacity = "0";
      finger.style.transform = "scale(0.7)";
      return;
    }
    const pr = phone.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const x = br.left - pr.left + br.width / 2;
    const y = br.top - pr.top + br.height / 2;
    finger.style.left = x + "px";
    finger.style.top = y + "px";
    finger.style.opacity = String(0.15 + 0.85 * amount);
    finger.style.transform = `scale(${0.7 + 0.3 * amount})`;
  }

  function apply(t) {
    const S = scriptTimes();
    const tt = Math.max(0, t);

    function showList(key, count, scrollTop, { outFilms, outOp, inOp, loaderOn, loaderRot, batchLocal } = {}) {
      currentList = key;
      shown = count;
      setCount(key);
      setPills(key);
      renderTiles(grid, filmsSlice(key, 0, count));
      grid.style.opacity = inOp == null ? "1" : String(inOp);
      if (outFilms && outFilms.length) {
        renderTiles(gridOut, outFilms);
        gridOut.hidden = false;
        gridOut.style.opacity = String(outOp == null ? 1 : outOp);
      } else {
        gridOut.hidden = true;
        gridOut.innerHTML = "";
      }
      const tiles = [...grid.querySelectorAll(".tile")];
      if (batchLocal != null && S.batch.count) {
        const start = Math.max(0, tiles.length - S.page);
        applyBatchOpacity(tiles.slice(start), batchLocal);
      } else {
        tiles.forEach((el) => { el.style.opacity = "1"; });
      }
      setLoader(!!loaderOn, loaderRot || 0);
      const reachedEnd = count >= previewTotal(key) && !loaderOn && (batchLocal == null || batchLocal >= S.batch.total);
      setEndcap(reachedEnd);
      scroller.scrollTop = scrollTop || 0;
    }

    if (tt < S.tTap1) {
      showList("unwatched", S.page, 0);
      fingerAtPill("watched", 0);
      return;
    }
    if (tt < S.tFade1) {
      showList("unwatched", S.page, 0);
      const u = (tt - S.tTap1) / S.tap1;
      fingerAtPill("watched", u < 0.55 ? u / 0.55 : 1 - (u - 0.55) / 0.45);
      return;
    }
    if (tt < S.tHoldB) {
      const local = tt - S.tFade1;
      const times = S.fade;
      const inStart = Math.max(0, times.out - times.overlap);
      const outU = times.out <= 0 ? 1 : Math.min(1, Math.max(0, local / times.out));
      const inU = times.inn <= 0 ? 1 : Math.min(1, Math.max(0, (local - inStart) / times.inn));
      showList("watched", S.page, 0, {
        outFilms: filmsSlice("unwatched", 0, S.page),
        outOp: 1 - easeAt(outU),
        inOp: easeAt(inU),
      });
      fingerAtPill("watched", 0);
      return;
    }
    if (tt < S.tTap2) {
      showList("watched", S.page, 0);
      fingerAtPill("unwatched", 0);
      return;
    }
    if (tt < S.tFade2) {
      showList("watched", S.page, 0);
      const u = (tt - S.tTap2) / S.tap2;
      fingerAtPill("unwatched", u < 0.55 ? u / 0.55 : 1 - (u - 0.55) / 0.45);
      return;
    }
    if (tt < S.tHoldC) {
      const local = tt - S.tFade2;
      const times = S.fade;
      const inStart = Math.max(0, times.out - times.overlap);
      const outU = times.out <= 0 ? 1 : Math.min(1, Math.max(0, local / times.out));
      const inU = times.inn <= 0 ? 1 : Math.min(1, Math.max(0, (local - inStart) / times.inn));
      showList("unwatched", S.page, 0, {
        outFilms: filmsSlice("watched", 0, S.page),
        outOp: 1 - easeAt(outU),
        inOp: easeAt(inU),
      });
      fingerAtPill("unwatched", 0);
      return;
    }
    if (tt < S.tScroll) {
      showList("unwatched", S.page, 0);
      fingerAtPill("unwatched", 0);
      return;
    }
    if (tt < S.tFetch) {
      const u = easeInOut((tt - S.tScroll) / S.scrollDur);
      const y = yLoader() * u;
      const trig = triggerScrollTop();
      const loadingNow = y >= trig;
      const rot = loadingNow ? ((tt - S.tScroll) / 700) * 360 : 0;
      showList("unwatched", S.page, y, { loaderOn: loadingNow, loaderRot: rot });
      return;
    }
    if (tt < S.tBatch) {
      const rot = ((tt - S.tScroll) / 700) * 360;
      showList("unwatched", S.page, yLoader(), { loaderOn: true, loaderRot: rot });
      return;
    }
    if (tt < S.tEndHold) {
      const local = tt - S.tBatch;
      const u = S.batch.total <= 0 ? 1 : Math.min(1, local / S.batch.total);
      const y = yLoader() + (yReveal() - yLoader()) * easeInOut(u);
      showList("unwatched", S.page * 2, y, { batchLocal: local });
      return;
    }
    showList("unwatched", S.page * 2, yReveal());
  }

  function midTime() {
    const S = scriptTimes();
    // Mid of the new-batch fade — the distinctive new moment.
    return S.tBatch + S.batch.total / 2;
  }

  function duration() {
    return scriptTimes().duration;
  }

  function stop() {
    cancelFetch();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    fading = false;
    liveMode = "idle";
  }

  const params = new URLSearchParams(location.search);
  if (params.has("render")) document.documentElement.classList.add("render");

  window.cueboxDetail = {
    settings,
    apply,
    midTime,
    duration,
    stop,
    measure,
    scriptTimes,
  };

  function ready() {
    measure();
    resetToUnwatched();
    document.documentElement.dataset.polishReady = "1";
  }

  const imgs = [...document.querySelectorAll("img")];
  const fontReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontReady.then(() => {
    // Seed images may not be in the DOM yet; preload art used on page 1.
    const urls = UNWATCHED_SEED.concat(WATCHED_SEED).map((f) => f.img).filter(Boolean);
    const unique = [...new Set(urls)];
    Promise.all(unique.map((src) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = res;
      im.src = src;
    }))).then(() => {
      // first paint so measure is accurate
      fillGrid("unwatched", settings.page);
      requestAnimationFrame(() => requestAnimationFrame(ready));
    });
  });
})();
