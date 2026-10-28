/* Andy Kalendář – Created by Julius Andy Antoš. Licence MIT. Jmeniny: namedays-cs (MIT, Roman Ožana). */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const store = {
  get(k, d) { try { const v = localStorage.getItem("andycal:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("andycal:" + k, JSON.stringify(v)); return true; } catch { toast("Uložení se nepodařilo – úložiště prohlížeče je plné."); return false; } }
};
let toastT;
function toast(msg, opt = {}) {
  const t = $("#toast"); $("#toastMsg").textContent = msg; const b = $("#toastAct");
  if (opt.action) { b.hidden = false; b.textContent = opt.action; b.onclick = () => { t.hidden = true; opt.onAction(); }; } else b.hidden = true;
  t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, opt.action ? 7000 : 3000);
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

/* ---------- data ---------- */
const DAY = 86400000;
const toT = s => { if (!s) return NaN; const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const toS = t => new Date(t).toISOString().slice(0, 10);
const todayT = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
const Y = t => new Date(t).getUTCFullYear(), M = t => new Date(t).getUTCMonth(), D = t => new Date(t).getUTCDate();
const dow = t => (new Date(t).getUTCDay() + 6) % 7;   // 0 = pondělí
const MONTHS = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
const MONTHS_G = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
const WD = ["pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"];
const WD_S = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const longDate = t => `${D(t)}. ${MONTHS_G[M(t)]} ${Y(t)}`;
function addMonths(t, n) { const y = Y(t), m = M(t) + n, d = D(t); const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return Date.UTC(y, m, Math.min(d, last)); }
function isoWeek(t) {
  const w = dow(t), thu = t + (3 - w) * DAY, y = Y(thu), jan4 = Date.UTC(y, 0, 4), week1Mon = jan4 - dow(jan4) * DAY;
  return 1 + Math.floor((t - w * DAY - week1Mon) / (7 * DAY));
}
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}
const yearCache = new Map();
function yearInfo(y) {   // státní svátky a významné dny
  if (yearCache.has(y)) return yearCache.get(y);
  const E = easter(y), hol = new Map([[Date.UTC(y, 0, 1), "Nový rok, Den obnovy samostatného českého státu"], [Date.UTC(y, 4, 1), "Svátek práce"], [Date.UTC(y, 4, 8), "Den vítězství"],
    [Date.UTC(y, 6, 5), "Den slovanských věrozvěstů Cyrila a Metoděje"], [Date.UTC(y, 6, 6), "Den upálení mistra Jana Husa"], [Date.UTC(y, 8, 28), "Den české státnosti"],
    [Date.UTC(y, 9, 28), "Den vzniku samostatného československého státu"], [Date.UTC(y, 10, 17), "Den boje za svobodu a demokracii"], [Date.UTC(y, 11, 24), "Štědrý den"],
    [Date.UTC(y, 11, 25), "1. svátek vánoční"], [Date.UTC(y, 11, 26), "2. svátek vánoční"], [E + DAY, "Velikonoční pondělí"]]);
  if (y >= 2016) hol.set(E - 2 * DAY, "Velký pátek");
  const nthSun = (m, n) => { let t = Date.UTC(y, m, 1); while (dow(t) !== 6) t += DAY; return t + (n - 1) * 7 * DAY; };
  const lastSun = m => { let t = Date.UTC(y, m + 1, 0); while (dow(t) !== 6) t -= DAY; return t; };
  let adv1 = Date.UTC(y, 11, 3); while (dow(adv1) !== 6) adv1 -= DAY;
  const sig = new Map([[E - 46 * DAY, "Popeleční středa"], [E, "Velikonoční neděle"], [nthSun(4, 2), "Den matek"], [nthSun(5, 3), "Den otců"],
    [lastSun(2), "Změna času na letní"], [lastSun(9), "Změna času na zimní"], [adv1, "1. adventní neděle"], [adv1 + 7 * DAY, "2. adventní neděle"],
    [adv1 + 14 * DAY, "3. adventní neděle"], [adv1 + 21 * DAY, "4. adventní neděle"], [Date.UTC(y, 1, 14), "Valentýn"], [Date.UTC(y, 2, 8), "Mezinárodní den žen"],
    [Date.UTC(y, 11, 31), "Silvestr"]]);
  const info = {hol, sig}; yearCache.set(y, info); return info;
}
const holiday = t => yearInfo(Y(t)).hol.get(t);
const significant = t => S.showSig ? yearInfo(Y(t)).sig.get(t) : undefined;
const nameday = t => (window.JMENINY || {})[toS(t).slice(5)] || [];
const isWeekend = t => dow(t) >= 5;

/* ---------- stav ---------- */
const S = {view: store.get("view", "month"), cur: todayT(), sel: todayT(), events: store.get("events", []), tasks: store.get("tasks", []), showSig: store.get("showSig", true)};
const saveEvents = () => store.set("events", S.events);
const saveTasks = () => store.set("tasks", S.tasks);
const COLORS = [["#2B6CB0", "Modrá"], ["#2F855A", "Zelená"], ["#C05621", "Oranžová"], ["#B3261E", "Červená"], ["#6B46C1", "Fialová"], ["#4A5568", "Šedá"]];

/* ---------- výskyty událostí ---------- */
function occurs(ev, t) {
  const s = toT(ev.date); if (t < s) return false;
  if ((ev.ex || []).includes(toS(t))) return false;
  if (ev.until && t > toT(ev.until)) return false;
  switch (ev.rep) {
    case "daily": return true;
    case "weekdays": return !isWeekend(t);
    case "weekly": return Math.round((t - s) / DAY) % 7 === 0;
    case "biweekly": return Math.round((t - s) / DAY) % 14 === 0;
    case "monthly": { const want = D(s), last = new Date(Date.UTC(Y(t), M(t) + 1, 0)).getUTCDate(); return D(t) === Math.min(want, last); }
    case "yearly": { if (M(t) !== M(s)) return false; const last = new Date(Date.UTC(Y(t), M(t) + 1, 0)).getUTCDate(); return D(t) === Math.min(D(s), last); }
    default: { const e = ev.end ? toT(ev.end) : s; return t <= e; }
  }
}
function eventsOn(t) {
  return S.events.filter(ev => occurs(ev, t)).sort((a, b) => (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || (a.from || "").localeCompare(b.from || "") || a.title.localeCompare(b.title, "cs"));
}
const tasksOn = t => S.tasks.filter(k => k.due === toS(t));
const timeText = ev => ev.allDay ? "celý den" : `${ev.from || ""}${ev.to ? "–" + ev.to : ""}`;
const REP_TEXT = {daily: "každý den", weekdays: "každý pracovní den", weekly: "každý týden", biweekly: "každé 2 týdny", monthly: "každý měsíc", yearly: "každý rok"};

/* ---------- vykreslení ---------- */
function render() {
  $$(".seg [data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === S.view));
  document.body.classList.toggle("view-fond", S.view === "fond");
  $("#showSig").checked = S.showSig;
  const v = $("#view"); v.innerHTML = "";
  if (S.view === "month") renderMonth(v); else if (S.view === "week") renderWeek(v); else if (S.view === "fond") renderFond(v); else renderYear(v);
  renderDay(); renderTasks();
  store.set("view", S.view);
}
function dayClasses(t, base) {
  const c = [base]; if (dow(t) === 6) c.push("sun"); if (dow(t) === 5) c.push("sat"); if (holiday(t)) c.push("hol");
  if (t === todayT()) c.push("today"); if (t === S.sel) c.push("sel"); return c.join(" ");
}
function renderMonth(host) {
  const first = Date.UTC(Y(S.cur), M(S.cur), 1), start = first - dow(first) * DAY;
  $("#title").textContent = `${MONTHS[M(S.cur)]} ${Y(S.cur)}`;
  const wrap = document.createElement("div"); wrap.className = "month";
  wrap.innerHTML = `<div class="ptitle">${MONTHS[M(S.cur)]} ${Y(S.cur)}</div><div class="mhead"><div title="Týden">T</div>${WD_S.map((d, i) => `<div class="${i === 6 ? "sun" : ""}">${d}</div>`).join("")}</div>`;
  const grid = document.createElement("div"); grid.className = "mgrid";
  const weeks = Math.ceil((Math.round((Date.UTC(Y(S.cur), M(S.cur) + 1, 0) - start) / DAY) + 1) / 7);
  document.body.style.setProperty("--weeks", weeks);
  for (let w = 0; w < weeks; w++) {
    const wk = document.createElement("div"); wk.className = "wk"; wk.textContent = isoWeek(start + w * 7 * DAY); grid.appendChild(wk);
    for (let i = 0; i < 7; i++) {
      const t = start + (w * 7 + i) * DAY, cell = document.createElement("div");
      cell.className = dayClasses(t, "cell") + (M(t) !== M(S.cur) ? " other" : ""); cell.dataset.t = t; cell.tabIndex = 0;
      const names = nameday(t), hol = holiday(t), sig = significant(t);
      cell.setAttribute("aria-label", `${WD[dow(t)]} ${longDate(t)}${hol ? ", " + hol : ""}${names.length ? ", svátek má " + names.join(", ") : ""}`);
      let html = `<div class="dtop"><span class="dn">${D(t)}</span><span class="nm" title="${esc(names.join(", "))}">${esc(names.join(", "))}</span></div>`;
      if (hol) html += `<div class="holname">${esc(hol)}</div>`;
      if (sig) html += `<div class="sig">${esc(sig)}</div>`;
      const evs = eventsOn(t), tks = tasksOn(t), items = [];
      for (const ev of evs) items.push(ev.allDay ? `<button class="chip" data-ev="${ev.id}" data-t="${t}" style="background:${ev.color}">${esc(ev.title)}</button>`
        : `<button class="chip timed" data-ev="${ev.id}" data-t="${t}" style="--c:${ev.color}"><b>${esc(ev.from || "")}</b> ${esc(ev.title)}</button>`);
      for (const k of tks) items.push(`<button class="chip task${k.done ? " done" : ""}" data-task="${k.id}">${k.done ? "☑" : "☐"} ${esc(k.title)}</button>`);
      const maxItems = hol || sig ? 2 : 3;
      html += `<div class="chips">${items.slice(0, maxItems).join("")}${items.length > maxItems ? `<span class="more">+ ${items.length - maxItems} další</span>` : ""}</div>`;
      cell.innerHTML = html; grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid); host.appendChild(wrap);
}
function renderWeek(host) {
  const start = S.cur - dow(S.cur) * DAY, end = start + 6 * DAY;
  $("#title").textContent = M(start) === M(end) ? `${D(start)}.–${D(end)}. ${MONTHS_G[M(end)]} ${Y(end)}` : `${D(start)}. ${MONTHS_G[M(start)]} – ${D(end)}. ${MONTHS_G[M(end)]} ${Y(end)}`;
  const pt = document.createElement("div"); pt.className = "ptitle"; pt.textContent = `${isoWeek(start)}. týden · ${$("#title").textContent}`; host.appendChild(pt);
  const wrap = document.createElement("div"); wrap.className = "week";
  for (let i = 0; i < 7; i++) {
    const t = start + i * DAY, box = document.createElement("div"); box.className = dayClasses(t, "wday"); box.dataset.t = t; box.tabIndex = 0;
    const names = nameday(t), hol = holiday(t), sig = significant(t);
    let html = `<div class="whead"><span class="dn">${D(t)}</span><span class="wdname">${WD[dow(t)]}</span><span class="nm">${esc(names.join(", "))}</span></div>`;
    if (hol) html += `<div class="holname">${esc(hol)}</div>`;
    if (sig) html += `<div class="sig">${esc(sig)}</div>`;
    for (const ev of eventsOn(t)) html += `<div class="witem" data-ev="${ev.id}" data-t="${t}"><span class="dot" style="background:${ev.color}"></span><span class="tm">${esc(timeText(ev))}</span><span><b>${esc(ev.title)}</b>${ev.place ? ` <span class="pl">· ${esc(ev.place)}</span>` : ""}</span></div>`;
    for (const k of tasksOn(t)) html += `<div class="witem" data-task="${k.id}"><span class="tm">${k.done ? "☑ hotovo" : "☐ úkol"}</span><span style="${k.done ? "text-decoration:line-through;color:var(--muted)" : ""}">${esc(k.title)}</span></div>`;
    html += `<div class="lines" aria-hidden="true"></div>`;
    box.innerHTML = html; wrap.appendChild(box);
  }
  const key = toS(start), notes = store.get("notes", {}), nb = document.createElement("div"); nb.className = "wnotes";
  nb.innerHTML = `<h3>Poznámky k týdnu</h3><textarea aria-label="Poznámky k týdnu" placeholder="Sem si pište poznámky k tomuto týdnu…"></textarea>`;
  const ta = $("textarea", nb); ta.value = notes[key] || "";
  ta.addEventListener("input", () => { const n = store.get("notes", {}); if (ta.value.trim()) n[key] = ta.value; else delete n[key]; store.set("notes", n); });
  ta.addEventListener("click", e => e.stopPropagation());
  wrap.appendChild(nb);
  host.appendChild(wrap);
}
function renderYear(host) {
  const y = Y(S.cur); $("#title").textContent = String(y);
  const pt = document.createElement("div"); pt.className = "ptitle"; pt.textContent = `Kalendář ${y}`; host.appendChild(pt);
  const wrap = document.createElement("div"); wrap.className = "year";
  const busy = new Set(); for (let t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 0, 1); t += DAY) if (eventsOn(t).length || tasksOn(t).some(k => !k.done)) busy.add(t);
  for (let m = 0; m < 12; m++) {
    const first = Date.UTC(y, m, 1), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), box = document.createElement("div"); box.className = "ym";
    let html = `<h3 data-month="${m}">${MONTHS[m]}</h3><div class="yg">${WD_S.map((d, i) => `<div class="h${i === 6 ? " sun" : ""}">${d}</div>`).join("")}`;
    html += "<div></div>".repeat(dow(first));
    for (let d = 1; d <= days; d++) {
      const t = Date.UTC(y, m, d), hol = holiday(t), names = nameday(t);
      const cls = ["d"]; if (dow(t) === 6) cls.push("sun"); if (hol) cls.push("hol"); if (t === todayT()) cls.push("today"); if (busy.has(t)) cls.push("has");
      html += `<div class="${cls.join(" ")}" data-t="${t}" title="${esc(`${WD[dow(t)]} ${longDate(t)}${hol ? " – " + hol : ""}${names.length ? " · " + names.join(", ") : ""}`)}">${d}</div>`;
    }
    box.innerHTML = html + "</div>"; wrap.appendChild(box);
  }
  host.appendChild(wrap);
}
function renderDay() {
  const t = S.sel, p = $("#dayPanel"), names = nameday(t), hol = holiday(t), sig = significant(t), rel = Math.round((t - todayT()) / DAY);
  const relText = rel === 0 ? "dnes" : rel === 1 ? "zítra" : rel === -1 ? "včera" : rel > 0 ? `za ${rel} ${rel < 5 ? "dny" : "dní"}` : `před ${-rel} dny`;
  let html = `<div><div class="daytitle">${WD[dow(t)]} ${D(t)}. ${MONTHS_G[M(t)]}</div><div class="daysub">${Y(t)} · ${isoWeek(t)}. týden · ${relText}</div></div>`;
  html += `<div>${names.length ? `Svátek má <b>${esc(names.join(", "))}</b>` : '<span class="daysub">Bez jmenin</span>'}</div>`;
  if (hol) html += `<div class="tagred">Státní svátek: ${esc(hol)}</div>`;
  if (sig) html += `<div style="color:var(--sat)">${esc(sig)}</div>`;
  const evs = eventsOn(t), tks = tasksOn(t);
  html += '<div class="dlist">';
  for (const ev of evs) html += `<div class="ditem" data-ev="${ev.id}" data-t="${t}" tabindex="0"><span class="bar" style="background:${ev.color}"></span><div><div class="t">${esc(ev.title)}</div><div class="m">${esc(timeText(ev))}${ev.place ? " · " + esc(ev.place) : ""}${ev.rep && ev.rep !== "none" ? " · ↻ " + REP_TEXT[ev.rep] : ""}</div>${ev.note ? `<div class="m">${esc(ev.note)}</div>` : ""}</div></div>`;
  for (const k of tks) html += `<label class="task${k.done ? " done" : ""}"><input type="checkbox" data-done="${k.id}" ${k.done ? "checked" : ""}><span class="tt">${esc(k.title)}</span></label>`;
  if (!evs.length && !tks.length) html += '<p class="hint">Na tento den nic naplánováno.</p>';
  html += `</div><div class="actions" style="justify-content:flex-start"><button class="btn sm primary" id="dayAddEv">+ Událost</button><button class="btn sm" id="dayAddTask">+ Úkol na tento den</button></div>`;
  p.innerHTML = html;
  $("#dayAddEv").onclick = () => openEvent(null, t);
  $("#dayAddTask").onclick = () => { $("#taskDue").value = toS(t); $("#taskTitle").focus(); };
}
function renderTasks() {
  const host = $("#taskList"), today = todayT(), groups = {late: [], today: [], soon: [], none: [], done: []};
  for (const k of S.tasks) {
    if (k.done) groups.done.push(k);
    else if (!k.due) groups.none.push(k);
    else { const d = toT(k.due); (d < today ? groups.late : d === today ? groups.today : groups.soon).push(k); }
  }
  const byDue = (a, b) => (a.due || "").localeCompare(b.due || "");
  const sec = (key, title, cls) => { const list = groups[key].sort(byDue); if (!list.length) return ""; return `<div class="tgroup"><h3 class="${cls || ""}">${title} (${list.length})</h3>${list.map(taskRow).join("")}</div>`; };
  let html = sec("late", "Po termínu", "late") + sec("today", "Dnes") + sec("soon", "Nadcházející") + sec("none", "Bez termínu");
  if (!html) html = '<p class="hint">Žádné nedokončené úkoly. Napište úkol výše a stiskněte Enter.</p>';
  if (groups.done.length) html += `<details><summary>Hotové (${groups.done.length})</summary>${groups.done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).map(taskRow).join("")}</details>`;
  host.innerHTML = html;
}
function taskRow(k) {
  const due = k.due ? `${D(toT(k.due))}. ${M(toT(k.due)) + 1}.` : "";
  return `<div class="task${k.done ? " done" : ""}"><input type="checkbox" data-done="${k.id}" ${k.done ? "checked" : ""} aria-label="Hotovo: ${esc(k.title)}"><span class="tt">${esc(k.title)}</span>${due ? `<button class="td" data-goto="${k.due}" style="border:0;background:none;cursor:pointer;padding:0" title="Ukázat v kalendáři">${due}</button>` : ""}<button class="x" data-deltask="${k.id}" aria-label="Smazat úkol" title="Smazat">×</button></div>`;
}

/* ---------- pracovní fond ---------- */
const FOND = Object.assign({weekly: 40, custom: 30, uvazek: 100, mode: "fond"}, store.get("fond", {}));
const nfH = new Intl.NumberFormat("cs-CZ", {maximumFractionDigits: 2});
const fH = x => nfH.format(Math.round(x * 100) / 100);
function dayHours() { const w = FOND.weekly === "custom" ? +FOND.custom || 0 : +FOND.weekly; return w / 5 * (Math.min(Math.max(+FOND.uvazek || 0, 0), 100) / 100); }
function stats(a, b) {   // a, b včetně
  const r = {kal: 0, wend: 0, mf: 0, hol: 0, work: 0};
  for (let t = a; t <= b; t += DAY) { r.kal++; if (isWeekend(t)) r.wend++; else { r.mf++; if (holiday(t)) r.hol++; else r.work++; } }
  const h = dayHours(); r.days = FOND.mode === "fond" ? r.mf : r.work; r.hours = r.days * h; r.fondH = r.mf * h; r.workH = r.work * h; r.holH = r.hol * h;
  return r;
}
const monthEnd = (y, m) => Date.UTC(y, m + 1, 0);
function fondRows(y) {
  const months = [...Array(12).keys()].map(m => ({label: MONTHS[m], kind: "m", m, a: Date.UTC(y, m, 1), b: monthEnd(y, m)}));
  const rows = [];
  const q = i => ({label: `${i + 1}. čtvrtletí`, kind: "q", a: Date.UTC(y, i * 3, 1), b: monthEnd(y, i * 3 + 2)});
  const h = i => ({label: `${i + 1}. pololetí`, kind: "h", a: Date.UTC(y, i * 6, 1), b: monthEnd(y, i * 6 + 5)});
  for (let i = 0; i < 4; i++) { rows.push(...months.slice(i * 3, i * 3 + 3), q(i)); if (i % 2 === 1) rows.push(h((i - 1) / 2)); }
  rows.push({label: `Rok ${y}`, kind: "y", a: Date.UTC(y, 0, 1), b: Date.UTC(y, 11, 31)});
  return rows;
}
const decades = (y, m) => [[1, 10], [11, 20], [21, new Date(monthEnd(y, m)).getUTCDate()]].map(([f, l]) => ({f, l, ...stats(Date.UTC(y, m, f), Date.UTC(y, m, l))}));
function weeksOf(y) {
  const out = []; let mon = Date.UTC(y, 0, 1) - dow(Date.UTC(y, 0, 1)) * DAY;
  while (mon <= Date.UTC(y, 11, 31)) {
    const sun = mon + 6 * DAY, a = Math.max(mon, Date.UTC(y, 0, 1)), b = Math.min(sun, Date.UTC(y, 11, 31));
    const st = stats(a, b), hols = []; for (let t = a; t <= b; t += DAY) if (!isWeekend(t) && holiday(t)) hols.push(t);
    out.push({n: isoWeek(mon), mon, sun, a, b, part: a !== mon || b !== sun, hols, ...st}); mon += 7 * DAY;
  }
  return out;
}
function renderFond(host) {
  const y = Y(S.cur), h = dayHours(), year = stats(Date.UTC(y, 0, 1), Date.UTC(y, 11, 31)), modeFond = FOND.mode === "fond";
  $("#title").textContent = `Pracovní fond ${y}`;
  const unitLabel = modeFond ? "fond" : "k odpracování";
  let html = `<div class="ptitle">Fond pracovní doby ${y}</div>
  <div class="fset">
    <label class="field"><span>Týdenní pracovní doba</span><select id="fWeekly"><option value="40">40 h (8 h denně)</option><option value="38.75">38,75 h (7,75 h denně)</option><option value="37.5">37,5 h (7,5 h denně)</option><option value="custom">Vlastní…</option></select></label>
    <label class="field" id="fCustomWrap" ${FOND.weekly === "custom" ? "" : "hidden"} style="max-width:120px"><span>Hodin týdně</span><input id="fCustom" type="number" min="1" max="60" step="0.25" value="${FOND.custom}"></label>
    <label class="field" style="max-width:120px"><span>Úvazek %</span><input id="fUvazek" type="number" min="1" max="100" step="5" value="${FOND.uvazek}"></label>
    <div><div class="field" style="margin-bottom:4px"><span>Počítat</span></div><div class="seg" role="group" aria-label="Způsob výpočtu">
      <button data-fmode="fond" aria-pressed="${modeFond}">Fond pracovní doby</button><button data-fmode="work" aria-pressed="${!modeFond}">Jen odpracované dny</button></div></div>
    <button class="btn" id="fCsv">Export do Excelu (CSV)</button>
    <p class="note">${modeFond ? "Fond pracovní doby: pracovní dny pondělí–pátek včetně státních svátků, které na ně připadají (svátek se do fondu započítává)." : "Jen odpracované dny: pracovní dny pondělí–pátek bez státních svátků – kolik dní a hodin se skutečně odpracuje."} Denní pracovní doba: <b>${fH(h)} h</b>.</p>
  </div>
  <div class="fsum">
    <div class="main"><b>${fH(year.hours)} h</b><span>${modeFond ? "Fond pracovní doby" : "K odpracování"} za rok</span></div>
    <div><b>${year.days}</b><span>${modeFond ? "Pracovních dnů (vč. svátků)" : "Odpracovaných dnů"}</span></div>
    <div><b>${year.hol}</b><span>Svátků v pracovní dny (${fH(year.holH)} h)</span></div>
    <div><b>${modeFond ? fH(year.workH) : fH(year.fondH)} h</b><span>${modeFond ? `K odpracování bez svátků (${year.work} dní)` : `Fond vč. svátků (${year.mf} dní)`}</span></div>
    <div><b>${year.wend}</b><span>Víkendových dnů</span></div>
    <div><b>${year.kal}</b><span>Kalendářních dnů</span></div>
  </div>
  <h2 class="fh2">Roční plánovací kalendář</h2><div class="fyear">`;
  for (let m = 0; m < 12; m++) {
    const first = Date.UTC(y, m, 1), last = new Date(monthEnd(y, m)).getUTCDate(), ms = stats(first, monthEnd(y, m)), dk = decades(y, m);
    html += `<div class="fm"><h3>${MONTHS[m]} <small>${ms.days} d · ${fH(ms.hours)} h</small></h3><div class="yg">${WD_S.map((d, i) => `<div class="h${i === 6 ? " sun" : ""}">${d}</div>`).join("")}${"<div></div>".repeat(dow(first))}`;
    for (let d = 1; d <= last; d++) {
      const t = Date.UTC(y, m, d), hol = holiday(t), cls = ["d"];
      if (dow(t) === 6) cls.push("sun"); if (hol) cls.push("hol"); else if (!isWeekend(t)) cls.push("work"); if (t === todayT()) cls.push("today");
      html += `<div class="${cls.join(" ")}" title="${esc(`${WD[dow(t)]} ${longDate(t)}${hol ? " – " + hol : ""}`)}">${d}</div>`;
    }
    html += `</div><div class="dek">${dk.map(x => `<div><i>${x.f}.–${x.l}.</i>${x.days} d · ${fH(x.hours)} h</div>`).join("")}</div></div>`;
  }
  html += `</div><h2 class="fh2 brk">Měsíce, dekády, čtvrtletí a pololetí</h2><div class="fwrap"><table class="ftable"><thead><tr><th>Období</th><th>Kal. dny</th><th>Víkendy</th><th>Svátky v prac. dny</th><th>${modeFond ? "Prac. dny" : "Odprac. dny"}</th><th>Hodiny (${unitLabel})</th><th>1. dekáda</th><th>2. dekáda</th><th>3. dekáda</th></tr></thead><tbody>`;
  for (const r of fondRows(y)) {
    const st = stats(r.a, r.b), dk = r.kind === "m" ? decades(y, r.m) : null;
    html += `<tr class="${r.kind === "m" ? "" : r.kind}"><td>${r.label}</td><td>${st.kal}</td><td>${st.wend}</td><td class="${st.hol && r.kind === "m" ? "hl" : ""}">${st.hol}</td><td>${st.days}</td><td><b>${fH(st.hours)}</b></td>${dk ? dk.map(x => `<td class="muted">${x.days} d · ${fH(x.hours)} h</td>`).join("") : "<td></td><td></td><td></td>"}</tr>`;
  }
  html += `</tbody></table></div><h2 class="fh2">Týdny</h2><div class="weeks">`;
  for (const w of weeksOf(y)) {
    html += `<div class="wkc${w.part ? " part" : ""}${w.hols.length ? " holw" : ""}" title="${esc(w.hols.map(t => `${D(t)}. ${M(t) + 1}. ${holiday(t)}`).join("\n"))}"><b>${w.n}. týden</b><div class="r"><span>${D(w.mon)}. ${M(w.mon) + 1}.–${D(w.sun)}. ${M(w.sun) + 1}.</span></div>
      <div class="r"><span>${modeFond ? "Prac. dny" : "Odprac."}</span><strong>${w.days}</strong></div><div class="r"><span>Hodiny</span><strong>${fH(w.hours)}</strong></div>${w.hols.length ? `<div class="r" style="color:var(--red)"><span>Svátky</span><strong style="color:var(--red)">${w.hols.length}</strong></div>` : ""}${w.part ? `<div class="r"><span>jen dny v roce ${y}</span></div>` : ""}</div>`;
  }
  html += `</div>`;
  host.innerHTML = html;
  $("#fWeekly").value = String(FOND.weekly);
  const saveF = () => { store.set("fond", FOND); render(); };
  $("#fWeekly").onchange = e => { FOND.weekly = e.target.value === "custom" ? "custom" : +e.target.value; saveF(); };
  $("#fCustom").onchange = e => { FOND.custom = Math.min(60, Math.max(1, +e.target.value || 40)); saveF(); };
  $("#fUvazek").onchange = e => { FOND.uvazek = Math.min(100, Math.max(1, +e.target.value || 100)); saveF(); };
  $$("[data-fmode]").forEach(b => b.onclick = () => { FOND.mode = b.dataset.fmode; saveF(); });
  $("#fCsv").onclick = () => exportFondCsv(y);
}
function exportFondCsv(y) {
  const h = dayHours(), n = x => String(Math.round(x * 100) / 100).replace(".", ","), L = [];
  L.push(`Fond pracovní doby ${y};Týdenní pracovní doba ${n(FOND.weekly === "custom" ? FOND.custom : FOND.weekly)} h;Úvazek ${FOND.uvazek} %;Denně ${n(h)} h`, "");
  L.push("Období;Kalendářní dny;Víkendové dny;Svátky v pracovní dny;Pracovní dny vč. svátků (fond);Dny k odpracování;Fond (h);K odpracování (h)");
  for (const r of fondRows(y)) { const st = stats(r.a, r.b); L.push([r.label, st.kal, st.wend, st.hol, st.mf, st.work, n(st.fondH), n(st.workH)].join(";")); }
  L.push("", "Měsíc;Dekáda;Pracovní dny vč. svátků;Dny k odpracování;Fond (h);K odpracování (h)");
  for (let m = 0; m < 12; m++) for (const x of decades(y, m)) L.push([MONTHS[m], `${x.f}.–${x.l}.`, x.mf, x.work, n(x.fondH), n(x.workH)].join(";"));
  L.push("", "Týden;Od;Do;Pracovní dny vč. svátků;Dny k odpracování;Fond (h);K odpracování (h);Svátky");
  for (const w of weeksOf(y)) L.push([w.n, toS(w.a), toS(w.b), w.mf, w.work, n(w.fondH), n(w.workH), w.hols.map(t => holiday(t)).join(", ")].join(";"));
  download(`fond-pracovni-doby-${y}.csv`, "\ufeff" + L.join("\r\n") + "\r\n", "text/csv;charset=utf-8");
  toast("Soubor CSV uložen – otevřete ho v Excelu.");
}

/* ---------- ovládání ---------- */
function move(dir) {
  if (S.view === "month") S.cur = addMonths(Date.UTC(Y(S.cur), M(S.cur), 1), dir);
  else if (S.view === "week") S.cur += dir * 7 * DAY;
  else S.cur = Date.UTC(Y(S.cur) + dir, 0, 1);
  render();
}
$("#prev").onclick = () => move(-1);
$("#next").onclick = () => move(1);
$("#today").onclick = () => { S.cur = S.sel = todayT(); render(); };
$$(".seg [data-view]").forEach(b => b.onclick = () => { S.view = b.dataset.view; S.cur = S.sel; render(); });
$("#showSig").onchange = e => { S.showSig = e.target.checked; store.set("showSig", S.showSig); render(); };
function selectDay(t) { S.sel = t; if (S.view === "month" && M(t) !== M(S.cur)) S.cur = t; render(); }
$("#view").addEventListener("click", e => {
  const ev = e.target.closest("[data-ev]"); if (ev) { e.stopPropagation(); S.sel = +ev.dataset.t; openEvent(ev.dataset.ev, +ev.dataset.t); render(); return; }
  const tk = e.target.closest("[data-task]"); if (tk) { e.stopPropagation(); toggleTask(tk.dataset.task); return; }
  const mh = e.target.closest("[data-month]"); if (mh) { S.cur = Date.UTC(Y(S.cur), +mh.dataset.month, 1); S.view = "month"; render(); return; }
  const d = e.target.closest("[data-t]"); if (!d) return;
  const t = +d.dataset.t;
  if (S.view === "year") { S.sel = t; S.cur = t; S.view = "month"; render(); return; }
  selectDay(t);
});
$("#view").addEventListener("dblclick", e => { if (e.target.closest("[data-ev],[data-task]")) return; const d = e.target.closest(".cell,.wday"); if (d) openEvent(null, +d.dataset.t); });
$("#view").addEventListener("keydown", e => {
  const d = e.target.closest(".cell,.wday"); if (!d) return;
  if (e.key === "Enter") { e.preventDefault(); openEvent(null, +d.dataset.t); }
  else if (e.key === " ") { e.preventDefault(); selectDay(+d.dataset.t); }
});
document.addEventListener("keydown", e => {
  if ($("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (e.key === "ArrowLeft" && e.altKey) move(-1); else if (e.key === "ArrowRight" && e.altKey) move(1);
  else if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey) { S.cur = S.sel = todayT(); render(); }
  else if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openEvent(null, S.sel); }
});
$("#dayPanel").addEventListener("click", e => { const ev = e.target.closest("[data-ev]"); if (ev) openEvent(ev.dataset.ev, +ev.dataset.t); });
$("#dayPanel").addEventListener("change", e => { const c = e.target.closest("[data-done]"); if (c) toggleTask(c.dataset.done); });

/* ---------- úkoly ---------- */
function addTask() {
  const title = $("#taskTitle").value.trim(); if (!title) { $("#taskTitle").focus(); return; }
  S.tasks.push({id: uid(), title, due: $("#taskDue").value || "", done: false, created: Date.now()}); saveTasks();
  $("#taskTitle").value = ""; $("#taskDue").value = ""; render(); $("#taskTitle").focus();
}
function toggleTask(id) { const k = S.tasks.find(x => x.id === id); if (!k) return; k.done = !k.done; k.doneAt = k.done ? Date.now() : null; saveTasks(); render(); }
$("#taskAdd").onclick = addTask;
$("#taskTitle").addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });
$("#taskList").addEventListener("change", e => { const c = e.target.closest("[data-done]"); if (c) toggleTask(c.dataset.done); });
$("#taskList").addEventListener("click", e => {
  const del = e.target.closest("[data-deltask]");
  if (del) { const i = S.tasks.findIndex(x => x.id === del.dataset.deltask); if (i < 0) return; const [k] = S.tasks.splice(i, 1); saveTasks(); render();
    toast("Úkol smazán.", {action: "Vrátit zpět", onAction: () => { S.tasks.splice(i, 0, k); saveTasks(); render(); }}); return; }
  const g = e.target.closest("[data-goto]"); if (g) { const t = toT(g.dataset.goto); S.sel = S.cur = t; if (S.view === "year") S.view = "month"; render(); }
});

/* ---------- dialog události ---------- */
let editing = null, editingT = null, eColor = COLORS[0][0];
function colorPicker(sel) {
  const host = $("#eColors"); host.innerHTML = "";
  for (const [c, n] of COLORS) { const b = document.createElement("button"); b.type = "button"; b.style.background = c; b.title = n; b.setAttribute("aria-label", n); b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", c === sel); b.onclick = () => { eColor = c; $$("#eColors button").forEach(x => x.setAttribute("aria-checked", x === b)); }; host.appendChild(b); }
}
function syncEventForm() {
  const all = $("#eAllDay").checked, rep = $("#eRep").value;
  $("#eTimes").hidden = all; $("#eUntilWrap").hidden = rep === "none"; $("#eEndWrap").hidden = !all || rep !== "none";
  $("#eRepHint").hidden = !(editing && rep !== "none");
}
function openEvent(id, t) {
  editing = id ? S.events.find(e => e.id === id) : null; editingT = t ?? S.sel;
  const ev = editing || {title: "", date: toS(editingT), end: "", allDay: false, from: "09:00", to: "10:00", place: "", note: "", rep: "none", until: "", color: COLORS[0][0]};
  $("#deT").textContent = editing ? "Upravit událost" : "Nová událost";
  $("#eTitle").value = ev.title; $("#eDate").value = ev.date; $("#eEnd").value = ev.end || ""; $("#eAllDay").checked = !!ev.allDay;
  $("#eFrom").value = ev.from || "09:00"; $("#eTo").value = ev.to || ""; $("#ePlace").value = ev.place || ""; $("#eNote").value = ev.note || "";
  $("#eRep").value = ev.rep || "none"; $("#eUntil").value = ev.until || ""; eColor = ev.color; colorPicker(eColor);
  $("#eDelete").hidden = !editing; syncEventForm();
  $("#dlgEvent").showModal(); $("#eTitle").focus();
}
["#eAllDay", "#eRep"].forEach(id => $(id).addEventListener("change", syncEventForm));
$("#eRep").addEventListener("change", () => { if ($("#eRep").value === "yearly") $("#eAllDay").checked = true; syncEventForm(); });
$("#eSave").onclick = () => {
  const title = $("#eTitle").value.trim(), date = $("#eDate").value;
  if (!title) { $("#eTitle").focus(); toast("Napište název události."); return; }
  if (!date) { $("#eDate").focus(); toast("Zadejte datum."); return; }
  const allDay = $("#eAllDay").checked, rep = $("#eRep").value;
  let end = allDay && rep === "none" ? $("#eEnd").value : ""; if (end && end < date) end = "";
  let until = rep !== "none" ? $("#eUntil").value : ""; if (until && until < date) until = "";
  const from = allDay ? "" : $("#eFrom").value, to = allDay ? "" : $("#eTo").value;
  if (!allDay && from && to && to < from) { toast("Konec je dřív než začátek."); return; }
  const data = {title, date, end, allDay, from, to, place: $("#ePlace").value.trim(), note: $("#eNote").value.trim(), rep, until, color: eColor};
  if (editing) Object.assign(editing, data); else S.events.push({id: uid(), ex: [], ...data});
  saveEvents(); $("#dlgEvent").close(); S.sel = toT(date); if (S.view !== "year") S.cur = S.sel; render(); toast(editing ? "Událost upravena." : "Událost přidána.");
};
$("#eTitle").addEventListener("keydown", e => { if (e.key === "Enter") $("#eSave").click(); });
function deleteEvent(all) {
  const ev = editing; if (!ev) return;
  const snap = JSON.parse(JSON.stringify(S.events));
  if (all) S.events = S.events.filter(e => e.id !== ev.id); else { ev.ex = [...(ev.ex || []), toS(editingT)]; }
  saveEvents(); $("#dlgDelete").close(); $("#dlgEvent").close(); render();
  toast(all ? "Událost smazána." : "Událost smazána pro tento den.", {action: "Vrátit zpět", onAction: () => { S.events = snap; saveEvents(); render(); }});
}
$("#eDelete").onclick = () => { if (editing && editing.rep && editing.rep !== "none") $("#dlgDelete").showModal(); else deleteEvent(true); };
$("#delOne").onclick = () => deleteEvent(false);
$("#delAll").onclick = () => deleteEvent(true);
$("#newEvent").onclick = () => openEvent(null, S.sel);
$$("dialog [data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

/* ---------- tisk ---------- */
$("#printBtn").onclick = () => {
  document.body.classList.add("p-" + S.view);
  const ori = S.view === "year" || S.view === "fond" ? "portrait" : "landscape";
  const st = document.createElement("style"); st.id = "pageOri"; st.textContent = `@page{size:A4 ${ori};margin:10mm}`; document.head.appendChild(st);
  window.print();
  setTimeout(() => { document.body.classList.remove("p-month", "p-week", "p-year", "p-fond"); st.remove(); }, 600);
};

/* ---------- záloha a export ---------- */
const menu = $("#moreMenu");
$("#moreBtn").onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; $("#moreBtn").setAttribute("aria-expanded", !menu.hidden); };
document.addEventListener("click", e => { if (!menu.hidden && !e.target.closest(".menuwrap")) { menu.hidden = true; $("#moreBtn").setAttribute("aria-expanded", "false"); } });
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 20000);
}
$("#mExport").onclick = () => { menu.hidden = true; download(`kalendar-zaloha-${toS(todayT())}.json`, JSON.stringify({app: "Andy Kalendář", version: 1, saved: new Date().toISOString(), events: S.events, tasks: S.tasks, notes: store.get("notes", {})}, null, 1), "application/json"); toast("Záloha uložena do Stažených souborů."); };
$("#mImport").onclick = () => { menu.hidden = true; $("#importFile").click(); };
$("#importFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.events) || !Array.isArray(data.tasks)) throw new Error("format");
    const evIds = new Set(S.events.map(x => x.id)), tIds = new Set(S.tasks.map(x => x.id));
    const ne = data.events.filter(x => x && x.id && x.title && x.date && !evIds.has(x.id)), nt = data.tasks.filter(x => x && x.id && x.title && !tIds.has(x.id));
    S.events.push(...ne); S.tasks.push(...nt); saveEvents(); saveTasks();
    if (data.notes && typeof data.notes === "object") { const n = store.get("notes", {}); for (const [k, v] of Object.entries(data.notes)) if (!n[k] && typeof v === "string") n[k] = v; store.set("notes", n); }
    render();
    toast(`Obnoveno: ${ne.length} událostí a ${nt.length} úkolů (stávající zůstaly).`);
  } catch { toast("Soubor není platná záloha Andy Kalendáře."); }
};
function icsText(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function icsFold(line) { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); }
$("#mIcs").onclick = () => {
  menu.hidden = true;
  if (!S.events.length) { toast("Zatím nemáte žádné události."); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const d8 = s => s.replace(/-/g, ""), lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Andy Kalendar//CS", "CALSCALE:GREGORIAN"];
  const RR = {daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY", biweekly: "FREQ=WEEKLY;INTERVAL=2", monthly: "FREQ=MONTHLY", yearly: "FREQ=YEARLY"};
  for (const ev of S.events) {
    lines.push("BEGIN:VEVENT", `UID:${ev.id}@andy-kalendar`, `DTSTAMP:${stamp}`, icsFold(`SUMMARY:${icsText(ev.title)}`));
    if (ev.allDay) { lines.push(`DTSTART;VALUE=DATE:${d8(ev.date)}`, `DTEND;VALUE=DATE:${d8(toS(toT(ev.end || ev.date) + DAY))}`); }
    else { const f = (ev.from || "09:00").replace(":", ""), t = (ev.to || ev.from || "10:00").replace(":", ""); lines.push(`DTSTART:${d8(ev.date)}T${f}00`, `DTEND:${d8(ev.date)}T${t}00`); }
    const lastDay = D(toT(ev.date)) === new Date(Date.UTC(Y(toT(ev.date)), M(toT(ev.date)) + 1, 0)).getUTCDate() && D(toT(ev.date)) > 28;
    if (ev.rep && RR[ev.rep]) lines.push(`RRULE:${RR[ev.rep]}${ev.rep === "monthly" && lastDay ? ";BYMONTHDAY=-1" : ""}${ev.until ? ";UNTIL=" + d8(ev.until) + (ev.allDay ? "" : "T235959") : ""}`);
    for (const x of ev.ex || []) lines.push(ev.allDay ? `EXDATE;VALUE=DATE:${d8(x)}` : `EXDATE:${d8(x)}T${(ev.from || "09:00").replace(":", "")}00`);
    if (ev.place) lines.push(icsFold(`LOCATION:${icsText(ev.place)}`));
    if (ev.note) lines.push(icsFold(`DESCRIPTION:${icsText(ev.note)}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  download(`kalendar-${toS(todayT())}.ics`, lines.join("\r\n") + "\r\n", "text/calendar");
  toast("Soubor .ics uložen – otevřete ho v Outlooku nebo importujte do Google Kalendáře.");
};
$("#mClearDone").onclick = () => { menu.hidden = true; const done = S.tasks.filter(k => k.done); if (!done.length) { toast("Žádné hotové úkoly."); return; }
  const snap = [...S.tasks]; S.tasks = S.tasks.filter(k => !k.done); saveTasks(); render();
  toast(`Smazáno ${done.length} hotových úkolů.`, {action: "Vrátit zpět", onAction: () => { S.tasks = snap; saveTasks(); render(); }}); };

render();
