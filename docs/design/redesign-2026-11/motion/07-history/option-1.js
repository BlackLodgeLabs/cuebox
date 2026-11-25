(function () {
  const EASE = [0.16, 1, 0.3, 1];
  const DEFAULTS = {
    pressAmt: 4,
    pressDown: 120,
    pressUp: 200,
    fade: 400,
    batch: 300,
    stagger: 30,
    trigger: 600,
    fetch: 600,
    page: 10,
    stub: 76,
    months: true,
    perf: true,
    speed: 1,
  };

  const FILMS = [
    { id: "witch", title: "The Witch", year: 2015, date: "2026-11-14", dow: "Sat", mon: "Nov", day: "14", month: "November 2026", status: "unwatched", mood: "Slow, unsettling, under two hours.", src: "art/witch-forest.jpg", pos: "center 42%", meta: "2015 · Folk horror · 92m · Netflix", why: "The same folk dread you rated highly in The Wicker Man, in a tighter 92 minutes.", time: "20:41",
      runners: [
        { title: "Lamb", year: 2021, meta: "2021 · Folk horror · 106m", hook: "A childless couple adopt something that isn’t quite a lamb.", svc: "MUBI", src: "art/old-house.jpg" },
        { title: "Burning", year: 2018, meta: "2018 · Mystery · 148m", hook: "A delivery boy, an old friend, and a stranger with a strange hobby.", svc: "MUBI", src: "art/fire-warm.jpg" },
        { title: "Under the Skin", year: 2013, meta: "2013 · Sci-fi · 108m", hook: "An alien drifts through Glasgow in the back of a white van.", svc: "Prime Video", src: "art/rain-neon.jpg" },
        { title: "Portrait of a Lady on Fire", year: 2019, meta: "2019 · Romance · 122m", hook: "A painter, a reluctant bride, and a portrait made in secret.", svc: "BBC iPlayer", src: "art/coastal-cliffs.jpg" },
      ]},
    { id: "lamb", title: "Lamb", year: 2021, date: "2026-11-12", dow: "Thu", mon: "Nov", day: "12", month: "November 2026", status: "unwatched", mood: "Folk horror, seeking unease.", src: "art/old-house.jpg", pos: "center 40%", meta: "2021 · Folk horror · 106m · MUBI", why: "A quiet, rural dread that sits next to The Witch, with a stranger family at its centre.", time: "21:05",
      runners: [
        { title: "The Witch", year: 2015, meta: "2015 · Folk horror · 92m", hook: "A Puritan family is undone at the edge of a New England wood.", svc: "Netflix", src: "art/witch-forest.jpg" },
        { title: "The Wicker Man", year: 1973, meta: "1973 · Folk horror · 88m", hook: "A policeman arrives on a remote island looking for a missing girl.", svc: "BFI Player", src: "art/wicker-meadow.jpg" },
      ]},
    { id: "skin", title: "Under the Skin", year: 2013, date: "2026-11-09", dow: "Mon", mon: "Nov", day: "09", month: "November 2026", status: "watched", mood: "Strange, cool, a little alien.", src: "art/rain-neon.jpg", pos: "center 45%", meta: "2013 · Sci-fi · 108m · Prime Video", why: "A chilly, word-light mood piece that still has a decent plot to follow.", time: "19:12" },
    { id: "burning", title: "Burning", year: 2018, date: "2026-11-07", dow: "Sat", mon: "Nov", day: "07", month: "November 2026", status: "unwatched", mood: "Slow burn mystery, atmospheric vibes.", src: "art/fire-warm.jpg", pos: "center 48%", meta: "2018 · Mystery · 148m · MUBI", why: "The long fuse and the late heat you asked for, without tipping into a puzzle box.", time: "22:18" },
    { id: "wicker", title: "The Wicker Man", year: 1973, date: "2026-11-04", dow: "Wed", mon: "Nov", day: "04", month: "November 2026", status: "watched", mood: "Folk dread, rural, unsettled.", src: "art/wicker-meadow.jpg", pos: "center 40%", meta: "1973 · Folk horror · 88m · BFI Player", why: "The bright daylight folk horror that still unnerves you years later.", time: "20:03" },
    { id: "maud", title: "Saint Maud", year: 2019, date: "2026-11-01", dow: "Sun", mon: "Nov", day: "01", month: "November 2026", status: "unwatched", mood: "Faith, fever, a tight 84 minutes.", initials: "SM", meta: "2019 · Horror · 84m", why: "A short, feverish character study with the unease you asked for.", time: "18:40" },
    { id: "portrait", title: "Portrait of a Lady on Fire", year: 2019, date: "2026-10-30", dow: "Fri", mon: "Oct", day: "30", month: "October 2026", status: "watched", mood: "Quiet, painterly, hidden gems.", src: "art/coastal-cliffs.jpg", pos: "center 35%", meta: "2019 · Romance · 122m · BBC iPlayer", why: "A held gaze and a coastline, closer to a hidden gem than a mainstream romance.", time: "21:27" },
    { id: "mid", title: "Midsommar", year: 2019, date: "2026-10-27", dow: "Tue", mon: "Oct", day: "27", month: "October 2026", status: "watched", mood: "Folk horror in broad daylight.", initials: "M", meta: "2019 · Folk horror · 148m", why: "Daylight folk horror, a companion to The Wicker Man rather than a jump-scare.", time: "20:14" },
    { id: "mulholland", title: "Mulholland Drive", year: 2001, date: "2026-10-24", dow: "Sat", mon: "Oct", day: "24", month: "October 2026", status: "unwatched", mood: "Dream logic, neon, a decent plot to hold.", src: "art/cinema.jpg", pos: "center 40%", meta: "2001 · Mystery · 147m", why: "A Hollywood night-drive that still gives you a story to hold onto.", time: "22:02" },
    { id: "lighthouse", title: "The Lighthouse", year: 2019, date: "2026-10-21", dow: "Wed", mon: "Oct", day: "21", month: "October 2026", status: "watched", mood: "Gritty, windswept, two men and a lamp.", src: "art/candle-dark.jpg", pos: "center 40%", meta: "2019 · Horror · 109m", why: "Salt, soot and cabin fever, in a tighter frame than it first appears.", time: "19:48" },
    { id: "ritual", title: "The Ritual", year: 2017, date: "2026-10-18", dow: "Sun", mon: "Oct", day: "18", month: "October 2026", status: "unwatched", mood: "Woods, unease, under two hours.", src: "art/fog-woods.jpg", pos: "center 42%", meta: "2017 · Horror · 94m", why: "A hiking party and a wrong turn, kept under two hours as you asked.", time: "20:33" },
    { id: "others", title: "The Others", year: 2001, date: "2026-10-15", dow: "Thu", mon: "Oct", day: "15", month: "October 2026", status: "watched", mood: "Slow burn, a house in the fog.", src: "art/fog-moor.jpg", pos: "center 40%", meta: "2001 · Horror · 104m", why: "A fog-bound house and a plot that pays off without rushing.", time: "21:11" },
    { id: "picnic", title: "Picnic at Hanging Rock", year: 1975, date: "2026-10-10", dow: "Sat", mon: "Oct", day: "10", month: "October 2026", status: "unwatched", mood: "Sunlit, unsettled, a vanished afternoon.", src: "art/daisies.jpg", pos: "center 35%", meta: "1975 · Mystery · 115m", why: "Heat-haze mystery rather than gore, and it still leaves you unsettled.", time: "16:20" },
    { id: "lost", title: "Lost Highway", year: 1997, date: "2026-10-06", dow: "Tue", mon: "Oct", day: "06", month: "October 2026", status: "archived", mood: "Night drives and double lives.", src: "art/neon-city.jpg", pos: "center 45%", meta: "1997 · Thriller · 134m", why: "Neon and identity-swap dread, a little longer than your usual cap.", time: "23:05" },
    { id: "drive", title: "Drive", year: 2011, date: "2026-10-02", dow: "Fri", mon: "Oct", day: "02", month: "October 2026", status: "watched", mood: "Cool, tight, a night in the city.", src: "art/rain-street.jpg", pos: "center 40%", meta: "2011 · Thriller · 100m", why: "A quiet driver and a short, stylish night, well under two hours.", time: "21:44" },
    { id: "possession", title: "Possession", year: 1981, date: "2026-09-26", dow: "Sat", mon: "Sep", day: "26", month: "September 2026", status: "unwatched", mood: "Marriage, mania, a raw nerve.", initials: "P", meta: "1981 · Horror · 124m", why: "A split marriage that turns cosmic, for a night when you wanted something raw.", time: "20:50" },
    { id: "dontlook", title: "Don’t Look Now", year: 1973, date: "2026-09-21", dow: "Mon", mon: "Sep", day: "21", month: "September 2026", status: "watched", mood: "Grief in a winter city, slow burn.", initials: "DL", meta: "1973 · Thriller · 110m", why: "Venice in the off-season, and a slow dread that never tips into a rush.", time: "19:30" },
    { id: "suspiria", title: "Suspiria", year: 1977, date: "2026-09-17", dow: "Thu", mon: "Sep", day: "17", month: "September 2026", status: "watched", mood: "Colour, coven, a dance school.", initials: "S", meta: "1977 · Horror · 98m", why: "A vivid, shorter nightmare, more atmosphere than plot-puzzle.", time: "22:15" },
    { id: "innocents", title: "The Innocents", year: 1961, date: "2026-09-12", dow: "Sat", mon: "Sep", day: "12", month: "September 2026", status: "unwatched", mood: "A haunted house, quietly told.", initials: "TI", meta: "1961 · Horror · 100m", why: "A black-and-white ghost story that still works as a slow burn.", time: "18:05" },
    { id: "onibaba", title: "Onibaba", year: 1964, date: "2026-09-08", dow: "Tue", mon: "Sep", day: "08", month: "September 2026", status: "watched", mood: "Reeds, war, a hole in the ground.", initials: "O", meta: "1964 · Horror · 103m", why: "A spare folk tale with the grit and atmosphere you asked for.", time: "20:22" },
    { id: "valerie", title: "Valerie and Her Week of Wonders", year: 1970, date: "2026-09-03", dow: "Thu", mon: "Sep", day: "03", month: "September 2026", status: "unwatched", mood: "Dreamy, folk, a coming-of-age.", initials: "V", meta: "1970 · Fantasy · 77m", why: "A short, sunlit folk dream — a hidden gem under 90 minutes.", time: "17:48" },
    { id: "witch2", title: "Häxan", year: 1922, date: "2026-08-28", dow: "Fri", mon: "Aug", day: "28", month: "August 2026", status: "watched", mood: "Vintage witchcraft, a curiosity.", initials: "H", meta: "1922 · Documentary · 105m", why: "An early, strange history of witchcraft, for a quieter night.", time: "19:00" },
    { id: "nosferatu", title: "Nosferatu", year: 1922, date: "2026-08-22", dow: "Sat", mon: "Aug", day: "22", month: "August 2026", status: "archived", mood: "Silent dread, shadows on a wall.", initials: "N", meta: "1922 · Horror · 94m", why: "The original shadow on the wall, short and unmistakable.", time: "21:10" },
    { id: "vapors", title: "Vampyr", year: 1932, date: "2026-08-16", dow: "Sun", mon: "Aug", day: "16", month: "August 2026", status: "unwatched", mood: "Fog, silence, a village at dusk.", initials: "V", meta: "1932 · Horror · 73m", why: "A short, fog-bound night, almost a dream more than a plot.", time: "20:08" },
  ];

  const settings = { ...DEFAULTS };
  const params = new URLSearchParams(location.search);
  const isRender = params.has("render");
  if (isRender) document.documentElement.classList.add("render");

  const phone = document.getElementById("phone");
  const scroller = document.getElementById("scroller");
  const listEl = document.getElementById("list");
  const loader = document.getElementById("loader");
  const endcap = document.getElementById("endcap");
  const countEl = document.getElementById("count");
  const searchEl = document.getElementById("search");
  const filterBtn = document.getElementById("filterBtn");
  const histView = document.getElementById("history-view");
  const progView = document.getElementById("programme-view");
  const dim = document.getElementById("dim");
  const sheet = document.getElementById("sheet");
  const alertDim = document.getElementById("alertDim");
  const alertBox = document.getElementById("alert");
  const finger = document.getElementById("finger");
  const reducedEl = document.getElementById("reduced");
  const monthsEl = document.getElementById("months");
  const perfEl = document.getElementById("perf");

  let filtered = FILMS.slice();
  let shown = 0;
  let loading = false;
  let hasMore = true;
  let view = "history"; // history | programme
  let openFilm = null;
  let pendingRemove = null;
  let sheetOpen = false;
  let alertOpen = false;
  let clockRaf = 0;
  let clockStart = 0;
  let clockPaused = false;
  let filters = { dateFrom: "", dateTo: "", watchStatus: "all" };

  const fields = {
    pressAmt: { el: document.getElementById("pressAmt"), val: document.getElementById("pressAmtVal"), step: 1, digits: 0 },
    pressDown: { el: document.getElementById("pressDown"), val: document.getElementById("pressDownVal"), step: 10, digits: 0 },
    pressUp: { el: document.getElementById("pressUp"), val: document.getElementById("pressUpVal"), step: 10, digits: 0 },
    fade: { el: document.getElementById("fade"), val: document.getElementById("fadeVal"), step: 10, digits: 0 },
    batch: { el: document.getElementById("batch"), val: document.getElementById("batchVal"), step: 10, digits: 0 },
    stagger: { el: document.getElementById("stagger"), val: document.getElementById("staggerVal"), step: 5, digits: 0 },
    trigger: { el: document.getElementById("trigger"), val: document.getElementById("triggerVal"), step: 50, digits: 0 },
    fetch: { el: document.getElementById("fetch"), val: document.getElementById("fetchVal"), step: 50, digits: 0 },
    page: { el: document.getElementById("page"), val: document.getElementById("pageVal"), step: 1, digits: 0 },
    stub: { el: document.getElementById("stub"), val: document.getElementById("stubVal"), step: 2, digits: 0 },
    speed: { el: document.getElementById("speed"), val: document.getElementById("speedVal"), step: 0.25, digits: 2 },
  };

  function reducedOn() {
    if (window.cueboxPolishForceMotion) return false;
    return !!(reducedEl && reducedEl.checked);
  }

  function bezierEase(u, x1, y1, x2, y2) {
    let t = u;
    for (let i = 0; i < 8; i++) {
      const x = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t - u;
      const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
      if (Math.abs(dx) < 1e-6) break;
      t = Math.max(0, Math.min(1, t - x / dx));
    }
    return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  }
  function easeAt(u) {
    u = Math.max(0, Math.min(1, u));
    return bezierEase(u, EASE[0], EASE[1], EASE[2], EASE[3]);
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function fadeDur() { return reducedOn() ? 300 : Number(settings.fade); }
  function batchDur() { return reducedOn() ? 300 : Number(settings.batch); }
  function staggerDur() { return reducedOn() ? 0 : Number(settings.stagger); }
  function fetchDur() { return reducedOn() ? Math.min(Number(settings.fetch), 300) : Number(settings.fetch); }
  function pressAmt() { return reducedOn() ? 0 : Number(settings.pressAmt) / 100; }
  function pressDown() { return reducedOn() ? 0 : Number(settings.pressDown); }
  function pressUp() { return reducedOn() ? 0 : Number(settings.pressUp); }

  function applyLook() {
    phone.style.setProperty("--stub-w", settings.stub + "px");
    phone.classList.toggle("perf", !!settings.perf);
    document.body.classList.toggle("hide-months", !settings.months);
  }

  function matchFilters(film) {
    const q = (searchEl.value || "").trim().toLowerCase();
    if (q && !film.title.toLowerCase().includes(q)) return false;
    if (filters.watchStatus !== "all" && film.status !== filters.watchStatus) return false;
    if (filters.dateFrom && film.date < filters.dateFrom) return false;
    if (filters.dateTo && film.date > filters.dateTo) return false;
    return true;
  }

  function initials(film) {
    return film.initials || film.title.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  function statusLabel(s) {
    return s === "watched" ? "Watched" : s === "archived" ? "Archived" : "Unwatched";
  }

  function ticketHTML(film, index) {
    const art = film.src
      ? `<div class="art"><img src="${film.src}" alt="" style="object-position:${film.pos || "center"}"></div>`
      : `<div class="art stand-in" aria-hidden="true"><span>${initials(film)}</span></div>`;
    return `<div class="ticket-wrap" data-id="${film.id}" data-index="${index}">
      <button type="button" class="remove-rail" data-remove="${film.id}">Remove</button>
      <article class="ticket" tabindex="0" data-open="${film.id}">
        <div class="stub"><span class="dow">${film.dow}</span><span class="day">${film.day}</span><span class="mon">${film.mon}</span></div>
        ${art}
        <div class="body">
          <h3>${film.title}</h3>
          <p class="year">${film.year}</p>
          <p class="mood">${film.mood}</p>
        </div>
        <span class="mark ${film.status === "watched" ? "watched" : ""}">${statusLabel(film.status)}</span>
      </article>
    </div>`;
  }

  function renderList(reset) {
    filtered = FILMS.filter(matchFilters);
    countEl.textContent = filtered.length === 1 ? "1 night" : `${filtered.length} nights`;
    if (reset) {
      listEl.innerHTML = "";
      shown = 0;
      hasMore = filtered.length > 0;
      endcap.classList.remove("on");
      loader.classList.remove("on");
      loading = false;
    }
    const page = Number(settings.page);
    const next = filtered.slice(shown, shown + page);
    let html = "";
    let lastMonth = reset ? "" : (listEl.querySelector(".month:last-of-type") ? null : "");
    // Determine last month already in the list
    const existingMonths = listEl.querySelectorAll(".month");
    let prevMonth = existingMonths.length ? existingMonths[existingMonths.length - 1].dataset.month : "";
    next.forEach((film, i) => {
      if (settings.months && film.month !== prevMonth) {
        const first = !prevMonth && shown === 0 && i === 0;
        html += `<div class="month${first ? " first" : ""}" data-month="${film.month}"><i></i>${film.month}</div>`;
        prevMonth = film.month;
      }
      html += ticketHTML(film, shown + i);
    });
    if (html) listEl.insertAdjacentHTML("beforeend", html);
    shown += next.length;
    hasMore = shown < filtered.length;
    if (!hasMore) endcap.classList.add("on");
    else endcap.classList.remove("on");
    return next;
  }

  function fadeInBatch(nodes, t0) {
    const fade = batchDur();
    const st = staggerDur();
    nodes.forEach((node, i) => {
      const wrap = node.closest ? node : null;
    });
    const tickets = Array.from(listEl.querySelectorAll(".ticket-wrap, .month")).slice(-nodes.length);
    // fade only the new ticket wraps; months appear at once
    const wraps = [];
    // last `next.length` ticket-wraps
  }

  function revealNew(newFilms) {
    const wraps = Array.from(listEl.querySelectorAll(".ticket-wrap")).slice(-newFilms.length);
    const fade = batchDur();
    const st = staggerDur();
    wraps.forEach((el, i) => {
      el.style.opacity = "0";
      const delay = i * st;
      const run = () => {
        el.style.transition = `opacity ${fade}ms var(--ease-out)`;
        el.style.opacity = "1";
      };
      if (delay === 0) run();
      else setTimeout(run, delay / (settings.speed || 1));
    });
  }

  function maybeLoad() {
    if (loading || !hasMore || view !== "history") return;
    const remain = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (remain > Number(settings.trigger)) return;
    loading = true;
    loader.classList.add("on");
    const wait = fetchDur() / (settings.speed || 1);
    setTimeout(() => {
      if (!loading) return;
      const added = renderList(false);
      loader.classList.remove("on");
      loading = false;
      revealNew(added);
    }, wait);
  }

  function programmeHTML(film) {
    const hero = film.src
      ? `<img src="${film.src}" alt="" style="object-position:${film.pos || "center 40%"}">`
      : `<div class="stand-hero">${initials(film)}</div>`;
    const runners = (film.runners || []).map((r) => {
      const img = r.src
        ? `<img src="${r.src}" alt="">`
        : `<div class="stand-run">${(r.title || "?").slice(0, 2)}</div>`;
      return `<li>${img}<div><h4>${r.title}</h4><p class="meta">${r.meta || ""}</p><p class="hook">${r.hook || ""}</p><p class="svc">${r.svc || ""}</p></div></li>`;
    }).join("");
    const dateTitle = `${film.dow} ${film.day} ${film.mon}`;
    const sub = `From your pick at ${film.time || "20:00"} · ${film.mood.replace(/\.$/, "").toLowerCase()}`;
    return `
      <button type="button" class="prog-back" id="progBack" aria-label="Back to History">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>
        History
      </button>
      <div class="prog-head">
        <div><h2>${dateTitle}</h2><i class="underline"></i></div>
      </div>
      <p class="prog-sub">${sub}</p>
      <article class="winner">${hero}<div class="wc"><p class="kicker">Your pick</p><h3>${film.title}</h3><p class="meta">${film.meta || film.year}</p></div></article>
      <p class="why">${film.why || film.mood}</p>
      <button class="btn-secondary" type="button" data-pick="${film.id}">View your pick</button>
      ${runners ? `<p class="runners-label">Runners-up</p><ol class="runners">${runners}</ol>` : ""}
      <div class="prog-foot">
        <button type="button" class="quiet" id="newPick">New pick</button>
      </div>`;
  }

  function setViewOpacity(hist, prog) {
    histView.style.opacity = String(hist);
    progView.style.opacity = String(prog);
    progView.classList.toggle("open", prog > 0.5);
    progView.setAttribute("aria-hidden", prog > 0.5 ? "false" : "true");
  }

  function openProgramme(film, animate) {
    openFilm = film;
    progView.innerHTML = programmeHTML(film);
    progView.scrollTop = 0;
    const dur = animate ? fadeDur() : 0;
    view = "programme";
    if (!animate) {
      setViewOpacity(0, 1);
      return;
    }
    histView.style.transition = `opacity ${dur}ms var(--ease-out)`;
    progView.style.transition = `opacity ${dur}ms var(--ease-out)`;
    setViewOpacity(0, 1);
  }

  function backToHistory(animate) {
    const dur = animate ? fadeDur() : 0;
    view = "history";
    histView.style.transition = `opacity ${dur}ms var(--ease-out)`;
    progView.style.transition = `opacity ${dur}ms var(--ease-out)`;
    setViewOpacity(1, 0);
    setTimeout(() => { if (view === "history") progView.innerHTML = ""; }, dur + 20);
  }

  function pressThenOpen(ticketEl, film) {
    const down = pressDown() / (settings.speed || 1);
    const up = pressUp() / (settings.speed || 1);
    const amt = pressAmt();
    ticketEl.style.transition = `transform ${down}ms var(--ease-out)`;
    ticketEl.style.transform = `scale(${1 - amt})`;
    setTimeout(() => {
      ticketEl.style.transition = `transform ${up}ms var(--ease-out)`;
      ticketEl.style.transform = "scale(1)";
      setTimeout(() => openProgramme(film, true), up);
    }, down);
  }

  function closeSheet(instant) {
    const dur = instant || reducedOn() ? (instant ? 0 : 300) : 700;
    dim.style.transition = `opacity ${Math.min(dur, 450)}ms var(--ease-out)`;
    sheet.style.transition = `transform ${dur}ms var(--ease-out)`;
    dim.style.opacity = "0";
    dim.classList.remove("on");
    sheet.style.transform = "translateY(110%)";
    sheetOpen = false;
  }
  function openSheet() {
    const dur = reducedOn() ? 300 : 800;
    dim.style.transition = `opacity 450ms var(--ease-out)`;
    if (reducedOn()) dim.style.transition = `opacity 300ms var(--ease-out)`;
    sheet.style.transition = `transform ${dur}ms var(--ease-out)`;
    dim.classList.add("on");
    dim.style.opacity = reducedOn() ? "0.55" : "0.55";
    sheet.style.transform = "translateY(0)";
    sheetOpen = true;
  }

  function openAlert(film) {
    pendingRemove = film;
    document.getElementById("alertCopy").textContent =
      `“${film.title}” will be deleted from History. This does not change the film on your watchlist.`;
    const dur = reducedOn() ? 300 : 400;
    alertDim.classList.add("on");
    alertDim.style.transition = `opacity ${dur}ms var(--ease-out)`;
    alertBox.style.transition = `opacity ${dur}ms var(--ease-out), transform ${dur}ms var(--ease-out)`;
    alertDim.style.opacity = "0.62";
    alertBox.classList.add("open");
    alertBox.style.opacity = "1";
    alertBox.style.transform = "translateY(-50%) scale(1)";
    alertOpen = true;
  }
  function closeAlert() {
    const dur = reducedOn() ? 300 : 400;
    alertDim.style.transition = `opacity ${dur}ms var(--ease-out)`;
    alertBox.style.transition = `opacity ${dur}ms var(--ease-out), transform ${dur}ms var(--ease-out)`;
    alertDim.style.opacity = "0";
    alertBox.style.opacity = "0";
    alertBox.style.transform = "translateY(-50%) scale(0.92)";
    alertBox.classList.remove("open");
    setTimeout(() => alertDim.classList.remove("on"), dur);
    alertOpen = false;
    pendingRemove = null;
  }

  // Swipe / long-press
  let pointer = null;
  function onPointerDown(e, wrap) {
    if (view !== "history") return;
    const ticket = wrap.querySelector(".ticket");
    pointer = {
      wrap, ticket,
      id: wrap.dataset.id,
      x: e.clientX, y: e.clientY,
      dx: 0,
      start: Date.now(),
      swiping: false,
      long: setTimeout(() => {
        if (!pointer) return;
        pointer.longFired = true;
        const film = FILMS.find((f) => f.id === pointer.id);
        if (film) openAlert(film);
      }, 520),
    };
    ticket.style.transition = "none";
  }
  function onPointerMove(e) {
    if (!pointer) return;
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      clearTimeout(pointer.long);
    }
    if (dx < -8 && Math.abs(dx) > Math.abs(dy)) {
      pointer.swiping = true;
      pointer.wrap.classList.add("is-swiping");
      pointer.dx = clamp(dx, -96, 0);
      pointer.ticket.style.transform = `translateX(${pointer.dx}px)`;
    }
  }
  function onPointerUp(e) {
    if (!pointer) return;
    clearTimeout(pointer.long);
    const { wrap, ticket, id, swiping, dx, longFired } = pointer;
    pointer = null;
    if (longFired) {
      ticket.style.transform = "";
      wrap.classList.remove("is-swiping", "is-revealed");
      return;
    }
    if (swiping) {
      if (dx < -56) {
        wrap.classList.add("is-revealed", "is-swiping");
        ticket.style.transition = "transform 200ms var(--ease-out)";
        ticket.style.transform = "translateX(-88px)";
        const film = FILMS.find((f) => f.id === id);
        setTimeout(() => {
          ticket.style.transform = "";
          wrap.classList.remove("is-revealed", "is-swiping");
          if (film) openAlert(film);
        }, 180);
      } else {
        ticket.style.transition = "transform 200ms var(--ease-out)";
        ticket.style.transform = "";
        wrap.classList.remove("is-swiping", "is-revealed");
      }
      return;
    }
    const film = filtered.find((f) => f.id === id) || FILMS.find((f) => f.id === id);
    if (film && e.type !== "pointercancel") pressThenOpen(ticket, film);
  }

  listEl.addEventListener("pointerdown", (e) => {
    const rail = e.target.closest("[data-remove]");
    if (rail) return;
    const wrap = e.target.closest(".ticket-wrap");
    if (wrap) onPointerDown(e, wrap);
  });
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  listEl.addEventListener("click", (e) => {
    const rail = e.target.closest("[data-remove]");
    if (rail) {
      e.preventDefault();
      const film = FILMS.find((f) => f.id === rail.getAttribute("data-remove"));
      if (film) openAlert(film);
    }
  });

  progView.addEventListener("click", (e) => {
    if (e.target.closest("#progBack")) backToHistory(true);
  });

  scroller.addEventListener("scroll", () => { if (!clockPaused && !isRender) maybeLoad(); }, { passive: true });

  searchEl.addEventListener("input", () => {
    renderList(true);
    scroller.scrollTop = 0;
  });
  filterBtn.addEventListener("click", openSheet);
  dim.addEventListener("click", () => closeSheet(false));
  document.getElementById("sheetClear").addEventListener("click", () => {
    filters = { dateFrom: "", dateTo: "", watchStatus: "all" };
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    document.getElementById("watchStatus").value = "all";
    filterBtn.classList.remove("on");
    renderList(true);
    closeSheet(false);
  });
  document.getElementById("sheetApply").addEventListener("click", () => {
    filters = {
      dateFrom: document.getElementById("dateFrom").value,
      dateTo: document.getElementById("dateTo").value,
      watchStatus: document.getElementById("watchStatus").value,
    };
    filterBtn.classList.toggle("on", !!(filters.dateFrom || filters.dateTo || filters.watchStatus !== "all"));
    renderList(true);
    closeSheet(false);
  });
  document.getElementById("alertCancel").addEventListener("click", closeAlert);
  alertDim.addEventListener("click", closeAlert);
  document.getElementById("alertRemove").addEventListener("click", () => {
    if (pendingRemove) {
      const i = FILMS.findIndex((f) => f.id === pendingRemove.id);
      if (i >= 0) FILMS.splice(i, 1);
    }
    closeAlert();
    renderList(true);
  });

  function readSettings() {
    Object.keys(fields).forEach((k) => {
      const f = fields[k];
      settings[k] = Number(f.el.value);
      f.val.textContent = k === "speed" ? settings[k].toFixed(2) : String(settings[k]);
    });
    settings.months = monthsEl.checked;
    settings.perf = perfEl.checked;
    applyLook();
  }
  Object.keys(fields).forEach((k) => {
    const f = fields[k];
    f.el.addEventListener("input", readSettings);
    document.querySelectorAll(`[data-field="${k}"]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = Number(btn.dataset.dir);
        const min = Number(f.el.min), max = Number(f.el.max);
        f.el.value = String(clamp(Number(f.el.value) + dir * f.step, min, max));
        readSettings();
      });
    });
  });
  monthsEl.addEventListener("change", readSettings);
  perfEl.addEventListener("change", readSettings);

  /* ---------- Demo clock for Replay / MP4 ---------- */
  // Times in ms at 1× (see duration())
  const DEMO = {
    hold: 900,
    scrollDur: 1700,
    fetchAtPad: 80, // loader already visible near end of scroll
    afterBatchHold: 800,
    scrollBack: 1000,
    afterTop: 200,
    progHold: 2200,
    endHold: 900,
  };

  function demoTimes() {
    const fetch = fetchDur();
    const batchTotal = batchDur() + Math.max(0, Number(settings.page) - 1) * staggerDur();
    const press = pressDown() + 80 + pressUp();
    const fade = fadeDur();
    const t0 = 0;
    const tScroll = DEMO.hold;
    const tLoader = tScroll + DEMO.scrollDur;
    const tBatch = tLoader + fetch;
    const tBatchEnd = tBatch + batchTotal;
    const tBack = tBatchEnd + DEMO.afterBatchHold;
    const tTop = tBack + DEMO.scrollBack;
    const tPress = tTop + DEMO.afterTop;
    const tFade = tPress + press;
    const tProg = tFade + fade;
    const tBackFade = tProg + DEMO.progHold;
    const tEnd = tBackFade + fade + DEMO.endHold;
    return { tScroll, tLoader, tBatch, tBatchEnd, tBack, tTop, tPress, tFade, tProg, tBackFade, tEnd, press, fade, fetch, batchTotal };
  }

  function targetScroll() {
    // Scroll far enough that remain <= trigger, leaving a little room
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    return max;
  }

  function setFinger(x, y, on) {
    if (!on) {
      finger.style.opacity = "0";
      finger.hidden = true;
      return;
    }
    finger.hidden = false;
    finger.style.left = x + "px";
    finger.style.top = y + "px";
    finger.style.opacity = "1";
    finger.style.transform = "scale(1)";
  }

  function ticketCenter(el) {
    const pr = phone.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - pr.left + r.width / 2, y: r.top - pr.top + r.height / 2 };
  }

  function apply(t) {
    clockPaused = true;
    phone.classList.add("paused");
    closeSheet(true);
    if (alertOpen) {
      alertDim.style.opacity = "0";
      alertBox.style.opacity = "0";
      alertBox.classList.remove("open");
      alertDim.classList.remove("on");
      alertOpen = false;
    }

    const times = demoTimes();
    // Ensure first page is rendered from a clean state once, then second page exists for later times
    const needSecond = t >= times.tBatch;
    const expectShown = needSecond
      ? Math.min(FILMS.length, Number(settings.page) * 2)
      : Math.min(FILMS.length, Number(settings.page));
    if (listEl.dataset.clock !== "1" || Number(listEl.dataset.shown) !== expectShown) {
      searchEl.value = "";
      filters = { dateFrom: "", dateTo: "", watchStatus: "all" };
      filterBtn.classList.remove("on");
      filtered = FILMS.slice();
      renderList(true);
      const firstMax = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      listEl.dataset.firstMax = String(firstMax);
      if (needSecond) renderList(false);
      listEl.dataset.clock = "1";
      listEl.dataset.shown = String(shown);
    }
    const firstMax = Number(listEl.dataset.firstMax || targetScroll());

    const wraps = Array.from(listEl.querySelectorAll(".ticket-wrap"));
    const first = wraps[0];
    const page = Number(settings.page);
    const second = wraps.slice(page);

    histView.style.transition = "none";
    progView.style.transition = "none";
    wraps.forEach((w) => { w.style.transition = "none"; w.style.opacity = "1"; });
    if (first) {
      const ticket = first.querySelector(".ticket");
      ticket.style.transition = "none";
      ticket.style.transform = "scale(1)";
    }

    const maxScroll = firstMax;
    let scroll = 0;
    let loaderOn = false;
    let histOp = 1, progOp = 0;
    let fingerOn = false, fx = 195, fy = 420;
    let scale = 1;
    let showProg = false;

    if (t < times.tScroll) {
      scroll = 0;
    } else if (t < times.tLoader) {
      const u = easeAt((t - times.tScroll) / DEMO.scrollDur);
      scroll = u * maxScroll;
      fingerOn = true;
      fx = 300;
      fy = 620;
    } else if (t < times.tBatch) {
      scroll = maxScroll;
      loaderOn = true;
      fingerOn = true;
      fx = 300; fy = 700;
      const spin = document.querySelector("#loader .spinner");
      if (spin) spin.style.transform = "rotate(" + ((t / 800) * 360) % 360 + "deg)";
    } else if (t < times.tBatchEnd) {
      scroll = maxScroll;
      loaderOn = false;
      const local = t - times.tBatch;
      second.forEach((w, i) => {
        const start = i * staggerDur();
        const u = clamp((local - start) / batchDur(), 0, 1);
        w.style.opacity = String(easeAt(u));
      });
      fingerOn = true;
      fx = 300; fy = 700;
    } else if (t < times.tBack) {
      scroll = maxScroll;
      second.forEach((w) => { w.style.opacity = "1"; });
    } else if (t < times.tTop) {
      const u = easeAt((t - times.tBack) / DEMO.scrollBack);
      scroll = maxScroll * (1 - u);
      fingerOn = true;
      fx = 200; fy = 280;
      second.forEach((w) => { w.style.opacity = "1"; });
    } else if (t < times.tPress) {
      scroll = 0;
    } else if (t < times.tFade) {
      scroll = 0;
      const local = t - times.tPress;
      const down = pressDown();
      const hold = 80;
      const up = pressUp();
      const amt = pressAmt();
      if (local < down) scale = 1 - amt * easeAt(local / Math.max(1, down));
      else if (local < down + hold) scale = 1 - amt;
      else scale = 1 - amt * (1 - easeAt((local - down - hold) / Math.max(1, up)));
      if (first) first.querySelector(".ticket").style.transform = `scale(${scale})`;
      fingerOn = true;
      if (first) {
        const c = ticketCenter(first);
        fx = c.x; fy = c.y;
      }
    } else if (t < times.tProg) {
      scroll = 0;
      const u = easeAt((t - times.tFade) / Math.max(1, times.fade));
      histOp = 1 - u;
      progOp = u;
      showProg = true;
      if (first) first.querySelector(".ticket").style.transform = "scale(1)";
    } else if (t < times.tBackFade) {
      scroll = 0;
      histOp = 0; progOp = 1;
      showProg = true;
    } else if (t < times.tBackFade + times.fade) {
      scroll = 0;
      const u = easeAt((t - times.tBackFade) / Math.max(1, times.fade));
      histOp = u;
      progOp = 1 - u;
      showProg = true;
    } else {
      scroll = 0;
      histOp = 1; progOp = 0;
      showProg = false;
    }

    if (showProg && openFilm !== FILMS[0]) {
      openProgramme(FILMS[0], false);
    }
    if (showProg && !progView.innerHTML) openProgramme(FILMS[0], false);
    if (!showProg && progOp === 0 && t >= times.tBackFade + times.fade) {
      view = "history";
    } else if (showProg) {
      view = "programme";
    } else {
      view = "history";
    }

    loader.classList.toggle("on", loaderOn);
    if (loaderOn) {
      scroll = Math.max(scroll, scroller.scrollHeight - scroller.clientHeight);
    }
    scroller.scrollTop = scroll;
    endcap.classList.toggle("on", shown >= filtered.length && !loaderOn && t >= times.tBatchEnd);
    setViewOpacity(histOp, progOp);
    if (fingerOn) setFinger(fx, fy, true);
    else setFinger(0, 0, false);
  }

  function stop() {
    if (clockRaf) cancelAnimationFrame(clockRaf);
    clockRaf = 0;
    clockPaused = false;
    phone.classList.remove("paused");
    finger.style.opacity = "0";
    finger.hidden = true;
  }

  function playLive() {
    stop();
    // Reset interactive state and run the same demo with rAF, then leave it interactive
    searchEl.value = "";
    filters = { dateFrom: "", dateTo: "", watchStatus: "all" };
    filterBtn.classList.remove("on");
    listEl.dataset.clock = "";
    renderList(true);
    scroller.scrollTop = 0;
    setViewOpacity(1, 0);
    progView.innerHTML = "";
    view = "history";
    applyLook();

    const times = demoTimes();
    const speed = settings.speed || 1;
    clockStart = performance.now();
    const tick = (now) => {
      const t = (now - clockStart) * speed;
      if (t >= times.tEnd) {
        apply(times.tEnd);
        stop();
        // Restore interactive list at rest
        listEl.dataset.clock = "";
        renderList(true);
        scroller.scrollTop = 0;
        setViewOpacity(1, 0);
        progView.innerHTML = "";
        view = "history";
        wrapsReset();
        return;
      }
      apply(t);
      clockRaf = requestAnimationFrame(tick);
    };
    clockRaf = requestAnimationFrame(tick);
  }

  function wrapsReset() {
    listEl.querySelectorAll(".ticket-wrap").forEach((w) => {
      w.style.opacity = "";
      w.style.transition = "";
      const t = w.querySelector(".ticket");
      if (t) { t.style.transform = ""; t.style.transition = ""; }
    });
    histView.style.transition = "";
    progView.style.transition = "";
  }

  function midTime() { return 500; }
  function duration() { return demoTimes().tEnd; }

  document.getElementById("replay").addEventListener("click", playLive);

  window.cueboxDetail = {
    apply,
    stop,
    duration,
    midTime,
    demoTimes,
    settings,
    play: playLive,
  };

  applyLook();
  renderList(true);
  setViewOpacity(1, 0);

  const ready = () => {
    const imgs = Array.from(phone.querySelectorAll("img"));
    const pending = imgs.filter((img) => !img.complete);
    if (pending.length) {
      Promise.all(pending.map((img) => new Promise((res) => {
        img.addEventListener("load", res, { once: true });
        img.addEventListener("error", res, { once: true });
      }))).then(() => { document.documentElement.dataset.polishReady = "1"; });
    } else {
      document.documentElement.dataset.polishReady = "1";
    }
  };
  document.fonts.ready.then(ready);

  if (params.has("seek")) {
    // renderer will call apply
  }
})();
