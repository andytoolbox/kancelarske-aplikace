/* Andy Kalkulačka – Created by Julius Andy Antoš. Licence MIT. */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem("andycalc:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("andycalc:" + k, JSON.stringify(v)); } catch {} }
};
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

/* ---------- čísla ---------- */
const round12 = x => x === 0 ? 0 : Number(x.toPrecision(12));
const nfFree = new Intl.NumberFormat("cs-CZ", {maximumFractionDigits: 10});
function fmt(x) {
  if (!isFinite(x)) return "–";
  const r = round12(x), a = Math.abs(r);
  if (a !== 0 && (a >= 1e15 || a < 1e-9)) { let [m, e] = r.toExponential(9).split("e"); m = m.replace(/\.?0+$/, ""); return `${m.replace(".", ",")} × 10^${+e}`; }
  return nfFree.format(r);
}
function plain(x) {   // pro vložení do výrazu
  const r = round12(x), s = String(r);
  if (s.includes("e")) { let [m, e] = r.toExponential(11).split("e"); m = m.replace(/\.?0+$/, ""); return `(${m.replace(".", ",")}×10^${+e})`; }
  return s.replace(".", ",");
}
const money = (x, d = 2) => isFinite(x) ? new Intl.NumberFormat("cs-CZ", {minimumFractionDigits: d, maximumFractionDigits: d}).format(x) : "–";
const czk = x => money(x) + " Kč";
const rnd = (x, d) => { const k = 10 ** d; return Math.round((x + Number.EPSILON * Math.sign(x)) * k) / k; };

/* ---------- výpočet výrazu (bez eval) ---------- */
const FUNCS = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "ln", "log", "sqrt", "abs", "exp"]);
function tokenize(src) {
  const s = src.replace(/[\s\u00a0\u202f]/g, "").replace(/[×·∙]/g, "*").replace(/[÷:]/g, "/").replace(/[−–—]/g, "-")
    .replace(/,/g, ".").replace(/²/g, "^2").replace(/³/g, "^3");
  const t = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const str = s.slice(i, j); if ((str.match(/\./g) || []).length > 1 || str === ".") throw new Error("Chybně zapsané číslo");
      t.push({k: "num", v: parseFloat(str)}); i = j; continue;
    }
    if (c === "π") { t.push({k: "const", v: Math.PI}); i++; continue; }
    if (c === "√") { t.push({k: "fn", v: "sqrt"}); i++; continue; }
    if (/[a-zA-Z]/.test(c)) {
      let j = i; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      const w = s.slice(i, j).toLowerCase();
      if (FUNCS.has(w)) t.push({k: "fn", v: w});
      else if (w === "pi") t.push({k: "const", v: Math.PI});
      else if (w === "e") t.push({k: "const", v: Math.E});
      else if (w === "ans") t.push({k: "ans"});
      else if (w === "x") t.push({k: "op", v: "*"});
      else throw new Error(`Neznámý výraz „${w}“`);
      i = j; continue;
    }
    if ("+-*/^%!()".includes(c)) { t.push({k: "op", v: c}); i++; continue; }
    throw new Error(`Neznámý znak „${c}“`);
  }
  return t;
}
function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error("Faktoriál jen pro celá kladná čísla");
  if (n > 170) throw new Error("Příliš velké číslo");
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}
function evaluate(src, opts = {}) {
  const deg = opts.deg ?? CALC.deg, ans = opts.ans ?? CALC.ans;
  const t = tokenize(src);
  if (!t.length) throw new Error("Prázdný výraz");
  let bal = 0; for (const k of t) { if (k.v === "(") bal++; if (k.v === ")") bal--; }
  while (bal-- > 0) t.push({k: "op", v: ")"});   // chybějící závorky doplnit
  let p = 0;
  const isOp = v => t[p] && t[p].k === "op" && t[p].v === v;
  const toRad = x => deg ? x * Math.PI / 180 : x, fromRad = x => deg ? x * 180 / Math.PI : x;
  const clean = x => Math.abs(x) < 1e-14 ? 0 : x;
  function fn(name, a) {
    switch (name) {
      case "sin": if (deg && a % 180 === 0) return 0; return clean(Math.sin(toRad(a)));
      case "cos": if (deg && (a - 90) % 180 === 0) return 0; return clean(Math.cos(toRad(a)));
      case "tan": if (deg && (a - 90) % 180 === 0) throw new Error("Tangens zde není definován"); if (deg && a % 180 === 0) return 0; return clean(Math.tan(toRad(a)));
      case "asin": if (Math.abs(a) > 1) throw new Error("Mimo definiční obor"); return fromRad(Math.asin(a));
      case "acos": if (Math.abs(a) > 1) throw new Error("Mimo definiční obor"); return fromRad(Math.acos(a));
      case "atan": return fromRad(Math.atan(a));
      case "ln": if (a <= 0) throw new Error("Logaritmus jen z kladných čísel"); return Math.log(a);
      case "log": if (a <= 0) throw new Error("Logaritmus jen z kladných čísel"); return Math.log10(a);
      case "sqrt": if (a < 0) throw new Error("Odmocnina ze záporného čísla"); return Math.sqrt(a);
      case "abs": return Math.abs(a);
      case "exp": return Math.exp(a);
    }
  }
  const startsPrimary = () => { const k = t[p]; return !!k && (k.k === "num" || k.k === "const" || k.k === "fn" || k.k === "ans" || (k.k === "op" && k.v === "(")); };
  function expr() {
    let L = term().v;
    while (isOp("+") || isOp("-")) { const o = t[p++].v, R = term(); const add = R.pct ? L * R.v : R.v; L = o === "+" ? L + add : L - add; }
    return {v: L};
  }
  function term() {
    const f = unary(); let v = f.v, n = 1;
    for (;;) {
      if (isOp("*") || isOp("/")) { const o = t[p++].v, r = unary(); if (o === "*") v *= r.v; else { if (r.v === 0) throw new Error("Dělení nulou"); v /= r.v; } n++; }
      else if (startsPrimary()) { v *= unary().v; n++; }
      else break;
    }
    return {v, pct: n === 1 && f.pct};
  }
  function unary() { if (isOp("-")) { p++; const r = unary(); return {v: -r.v, pct: r.pct}; } if (isOp("+")) { p++; return unary(); } return power(); }
  function power() { const b = postfix(); if (isOp("^")) { p++; const e = unary(); return {v: Math.pow(b.v, e.v), pct: false}; } return b; }
  function postfix() { let v = primary(), pct = false; while (isOp("!") || isOp("%")) { if (t[p++].v === "!") v = factorial(v); else { v /= 100; pct = true; } } return {v, pct}; }
  function primary() {
    const k = t[p]; if (!k) throw new Error("Výraz není dokončený");
    if (k.k === "num" || k.k === "const") { p++; return k.v; }
    if (k.k === "ans") { p++; return ans; }
    if (k.k === "op" && k.v === "(") { p++; const v = expr().v; if (!isOp(")")) throw new Error("Chybí závorka"); p++; return v; }
    if (k.k === "fn") { p++; return fn(k.v, postfix().v); }
    throw new Error(k.v === ")" ? "Výraz není dokončený" : `Nečekaný znak „${k.v}“`);
  }
  const r = expr().v;
  if (p < t.length) throw new Error(t[p].v === ")" ? "Přebývá závorka" : `Nečekaný znak „${t[p].v}“`);
  if (Number.isNaN(r)) throw new Error("Mimo definiční obor");
  if (!isFinite(r)) throw new Error("Příliš velké číslo");
  return r;
}
function numIn(el) {   // pole formuláře: číslo nebo výpočet
  const s = (el.value || "").trim(); if (!s) return NaN;
  try { return evaluate(s, {ans: CALC.ans}); } catch { return NaN; }
}

/* ---------- kalkulačka ---------- */
const CALC = {deg: store.get("deg", true), ans: store.get("ans", 0), mem: store.get("mem", null), justEval: false};
const exprEl = $("#expr"), resEl = $("#result");
if (matchMedia("(pointer: coarse)").matches) exprEl.setAttribute("inputmode", "none");
function showResult(text, cls) { resEl.textContent = text; resEl.className = "num" + (cls ? " " + cls : ""); }
function preview() {
  const s = exprEl.value.trim();
  if (!s) { showResult("0", "pre"); return; }
  try { showResult("= " + fmt(evaluate(s)), "pre"); } catch { showResult("", "pre"); }
}
function insert(txt) {
  if (CALC.justEval) {
    exprEl.value = /^[+\-−×÷*/^%!]/.test(txt) ? plain(CALC.ans) : "";
    CALC.justEval = false;
  }
  const s = exprEl.selectionStart ?? exprEl.value.length, e = exprEl.selectionEnd ?? s;
  exprEl.value = exprEl.value.slice(0, s) + txt + exprEl.value.slice(e);
  const c = s + txt.length; exprEl.setSelectionRange(c, c); exprEl.focus({preventScroll: true}); preview();
}
function currentValue() { if (CALC.justEval) return CALC.ans; try { return evaluate(exprEl.value); } catch { return NaN; } }
function equals() {
  const s = exprEl.value.trim(); if (!s) return;
  try {
    const v = evaluate(s);
    CALC.ans = v; store.set("ans", v); CALC.justEval = true;
    showResult(fmt(v)); addTape(s, v);
  } catch (e) { showResult(e.message, "bad"); }
}
function updateMem() { const m = $("#memInd"); if (CALC.mem == null) { m.hidden = true; } else { m.hidden = false; m.textContent = "M = " + fmt(CALC.mem); } store.set("mem", CALC.mem); }
function updateAngle() { $("#angleBtn").textContent = CALC.deg ? "DEG" : "RAD"; $("#angleBtn").title = CALC.deg ? "Úhly ve stupních – kliknutím přepnete na radiány" : "Úhly v radiánech – kliknutím přepnete na stupně"; store.set("deg", CALC.deg); preview(); }
$("#angleBtn").onclick = () => { CALC.deg = !CALC.deg; updateAngle(); };
$("#keys").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.ins != null) { insert(b.dataset.ins); return; }
  switch (b.dataset.act) {
    case "eq": equals(); break;
    case "ac": exprEl.value = ""; CALC.justEval = false; preview(); exprEl.focus(); break;
    case "back": {
      if (CALC.justEval) { CALC.justEval = false; }
      const s = exprEl.selectionStart ?? exprEl.value.length, en = exprEl.selectionEnd ?? s;
      if (s !== en) exprEl.value = exprEl.value.slice(0, s) + exprEl.value.slice(en);
      else if (s > 0) {
        const m = exprEl.value.slice(0, s).match(/(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|log\(|abs\(|exp\(|ln\(|√\(|Ans)$/);
        const n = m ? m[0].length : 1; exprEl.value = exprEl.value.slice(0, s - n) + exprEl.value.slice(s); exprEl.setSelectionRange(s - n, s - n);
      }
      exprEl.focus(); preview(); break;
    }
    case "inv": { const cur = CALC.justEval ? plain(CALC.ans) : exprEl.value.trim(); CALC.justEval = false; exprEl.value = cur ? `1/(${cur})` : "1/"; exprEl.focus(); preview(); break; }
    case "mc": CALC.mem = null; updateMem(); break;
    case "mr": if (CALC.mem != null) insert(plain(CALC.mem)); break;
    case "mplus": case "mminus": { const v = currentValue(); if (!isFinite(v)) { toast("Nejdřív spočítejte číslo."); break; }
      CALC.mem = (CALC.mem || 0) + (b.dataset.act === "mplus" ? v : -v); updateMem(); toast(`Paměť: ${fmt(CALC.mem)}`); break; }
  }
});
exprEl.addEventListener("input", () => { CALC.justEval = false; preview(); });
exprEl.addEventListener("keydown", e => {
  if (e.key === "Enter" || (e.key === "=" && !e.shiftKey)) { e.preventDefault(); equals(); }
  else if (e.key === "Escape") { exprEl.value = ""; CALC.justEval = false; preview(); }
  else if (CALC.justEval && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    e.preventDefault(); insert(e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key);
  }
});

/* ---------- páska ---------- */
let tape = store.get("tape", []);
function addTape(expr, value, label) {
  tape.push({e: expr, v: value, l: label || "", t: Date.now()});
  if (tape.length > 300) tape = tape.slice(-300);
  store.set("tape", tape); renderTape();
}
function renderTape() {
  const ul = $("#tapeList"); ul.innerHTML = "";
  if (!tape.length) { const li = document.createElement("li"); li.className = "tapeempty"; li.textContent = "Tady se budou zapisovat výpočty jako na pásku stolní kalkulačky."; ul.appendChild(li); }
  for (const it of tape) {
    const li = document.createElement("li"); li.title = "Kliknutím vložíte výsledek do kalkulačky";
    const e = document.createElement("div"); e.className = "e"; e.textContent = it.l ? `${it.l}: ${it.e}` : it.e;
    const r = document.createElement("div"); r.className = "r num"; r.textContent = "= " + fmt(it.v);
    const tt = document.createElement("div"); tt.className = "t"; tt.textContent = new Date(it.t).toLocaleString("cs-CZ", {day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit"});
    li.append(tt, e, r); li.onclick = () => { setTab("calc"); insert(plain(it.v)); };
    ul.appendChild(li);
  }
  ul.scrollTop = ul.scrollHeight;
  $("#tapeSum").textContent = fmt(tape.reduce((s, x) => s + (isFinite(x.v) ? x.v : 0), 0));
}
const tapeText = () => tape.map(x => `${x.l ? x.l + ": " : ""}${x.e}\n= ${fmt(x.v)}`).join("\n") + `\n----------\nΣ ${$("#tapeSum").textContent}`;
$("#tapeCopy").onclick = async () => { try { await navigator.clipboard.writeText(tapeText()); toast("Páska je zkopírovaná."); } catch { toast("Kopírování se nepodařilo."); } };
$("#tapeClear").onclick = () => { if (!tape.length || confirm("Vymazat celou pásku?")) { tape = []; store.set("tape", tape); renderTape(); } };
$("#tapePrint").onclick = () => {
  const pa = $("#printArea"); pa.innerHTML = `<h3>Páska – ${new Date().toLocaleString("cs-CZ")}</h3>`;
  for (const x of tape) { const d = document.createElement("div"); d.className = "pe"; d.innerHTML = '<div class="e"></div><div class="r"></div>'; $(".e", d).textContent = (x.l ? x.l + ": " : "") + x.e; $(".r", d).textContent = "= " + fmt(x.v); pa.appendChild(d); }
  const s = document.createElement("div"); s.className = "r"; s.style.marginTop = "8px"; s.textContent = "Σ " + $("#tapeSum").textContent; pa.appendChild(s);
  document.body.classList.add("printing"); window.print(); setTimeout(() => document.body.classList.remove("printing"), 500);
};

/* ---------- záložky ---------- */
function setTab(t) {
  $$(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  $$("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== t);
  store.set("tab", t); if (t === "calc") exprEl.focus({preventScroll: true});
  if (t === "conv") loadRates();
}
$$(".tab").forEach(b => b.onclick = () => setTab(b.dataset.tab));

/* ---------- DPH ---------- */
const VAT = {rate: 21, last: null};
const vatRate = () => (VAT.rate === "custom" ? numIn($("#vatCustom")) : VAT.rate) / 100;
function vatCalc(src) {
  if (src) VAT.last = src;
  const r = vatRate(), d = +$("#vatRound").value, f = {bez: $("#vBez"), dph: $("#vDph"), s: $("#vS")};
  const out = $("#vatOut");
  if (!VAT.last || !isFinite(r)) { out.innerHTML = '<span class="sub">Vyplňte kterékoli pole – ostatní se dopočítají. Do polí lze psát i výpočty, např. 1200*3.</span>'; return; }
  const v = numIn(f[VAT.last]); let bez, dph, s;
  if (!isFinite(v)) { for (const k in f) if (k !== VAT.last) f[k].value = ""; out.innerHTML = '<span class="sub">Zadejte částku.</span>'; VAT.res = null; return; }
  if (VAT.last === "bez") { bez = v; dph = rnd(bez * r, d); s = bez + dph; }
  else if (VAT.last === "s") { s = v; dph = rnd(s * r / (1 + r), d); bez = s - dph; }
  else { dph = v; if (r === 0) { out.innerHTML = '<span class="err">Při sazbě 0 % nelze počítat z DPH.</span>'; return; } bez = dph / r; s = bez + dph; }
  for (const k in f) if (k !== VAT.last) f[k].value = money(k === "bez" ? bez : k === "dph" ? dph : s);
  const pct = String(round12(r * 100)).replace(".", ",");
  out.innerHTML = `<div class="outrow"><span class="sub">${czk(bez)} + DPH ${pct} % ${czk(dph)}</span><span class="big num">${czk(s)}</span></div>`;
  VAT.res = {bez, dph, s, pct};
}
$("#vatRates").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  $$("#vatRates button").forEach(x => x.setAttribute("aria-pressed", x === b));
  VAT.rate = b.dataset.rate === "custom" ? "custom" : +b.dataset.rate; $("#vatCustomWrap").hidden = VAT.rate !== "custom"; vatCalc();
});
$("#vatCustom").addEventListener("input", () => vatCalc());
$("#vatRound").addEventListener("change", () => vatCalc());
$("#vBez").addEventListener("input", () => vatCalc("bez"));
$("#vDph").addEventListener("input", () => vatCalc("dph"));
$("#vS").addEventListener("input", () => vatCalc("s"));
$("#vatClear").onclick = () => { ["#vBez", "#vDph", "#vS"].forEach(id => $(id).value = ""); VAT.last = null; vatCalc(); };
$("#vatTape").onclick = () => { const r = VAT.res; if (!r) { toast("Nejdřív zadejte částku."); return; }
  addTape(`${money(r.bez)} + ${r.pct} % (${money(r.dph)})`, r.s, "DPH"); toast("Zapsáno na pásku."); };

/* ---------- procenta ---------- */
const PCT = [
  {t: "Kolik je X % z čísla", f: [["p", "Procent"], ["n", "Z čísla"]], c: ({p, n}) => { const v = n * p / 100; return [v, `${fmt(p)} % z ${fmt(n)} je`, `${fmt(p)} % z ${fmt(n)}`]; }},
  {t: "Kolik procent je část z celku", f: [["a", "Část"], ["n", "Celek"]], c: ({a, n}) => { if (!n) return null; const v = a / n * 100; return [v, `${fmt(a)} z ${fmt(n)} je`, `${fmt(a)} z ${fmt(n)} v %`, " %"]; }},
  {t: "Změna v procentech", f: [["a", "Původní hodnota"], ["b", "Nová hodnota"]], c: ({a, b}) => { if (!a) return null; const v = (b - a) / Math.abs(a) * 100; return [v, `${v >= 0 ? "Nárůst" : "Pokles"} o ${fmt(Math.abs(b - a))}, tj.`, `změna ${fmt(a)} → ${fmt(b)} v %`, " %", true]; }},
  {t: "Sleva", f: [["n", "Původní cena"], ["p", "Sleva %"]], c: ({n, p}) => { const s = n * p / 100, v = n - s; return [v, `Ušetříte ${money(s)}. Cena po slevě`, `${money(n)} − ${fmt(p)} %`]; }},
  {t: "Přirážka (zvýšení o %)", f: [["n", "Nákupní / původní cena"], ["p", "Přirážka %"]], c: ({n, p}) => { const v = n * (1 + p / 100); const m = v ? (v - n) / v * 100 : 0; return [v, `Marže z prodejní ceny ${fmt(rnd(m, 2))} %. Prodejní cena`, `${money(n)} + ${fmt(p)} %`]; }},
  {t: "Původní cena před slevou", f: [["v", "Cena po slevě"], ["p", "Sleva %"]], c: ({v, p}) => { if (p >= 100) return null; const n = v / (1 - p / 100); return [n, `Původní cena byla`, `${money(v)} po slevě ${fmt(p)} %`]; }},
];
function buildPct() {
  const host = $("#pctCards");
  PCT.forEach((cfg, i) => {
    const card = document.createElement("div"); card.className = "card";
    card.innerHTML = `<h2 style="font-size:1rem"></h2><div class="row"></div><div class="out"><span class="sub">Vyplňte obě pole.</span></div><div class="row" style="margin-top:8px"><button class="btn sm">Na pásku</button></div>`;
    $("h2", card).textContent = cfg.t;
    const row = $(".row", card), inputs = {};
    for (const [k, label] of cfg.f) { const l = document.createElement("label"); l.className = "field"; l.innerHTML = "<span></span><input inputmode='decimal' class='num'>"; $("span", l).textContent = label; row.appendChild(l); inputs[k] = $("input", l); }
    const out = $(".out", card); let last = null;
    const calc = () => {
      const vals = {}; for (const k in inputs) vals[k] = numIn(inputs[k]);
      if (Object.values(vals).some(v => !isFinite(v))) { out.innerHTML = '<span class="sub">Vyplňte obě pole.</span>'; last = null; return; }
      const r = cfg.c(vals); if (!r) { out.innerHTML = '<span class="err">Nelze spočítat (dělení nulou).</span>'; last = null; return; }
      const [v, lead, tapeLabel, unit = "", signed] = r;
      const txt = (signed && v > 0 ? "+" : "") + (unit ? fmt(rnd(v, 4)) : fmt(v)) + unit;
      out.innerHTML = `<div class="sub"></div><div class="big num"></div>`; $(".sub", out).textContent = lead; $(".big", out).textContent = txt;
      last = {v, tapeLabel};
    };
    Object.values(inputs).forEach(inp => inp.addEventListener("input", calc));
    $(".btn", card).onclick = () => { if (!last) { toast("Nejdřív vyplňte pole."); return; } addTape(last.tapeLabel, last.v, "Procenta"); toast("Zapsáno na pásku."); };
    host.appendChild(card);
  });
}

/* ---------- data a dny ---------- */
const DAY = 86400000;
const WD = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
const toT = s => { if (!s) return NaN; const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const toS = t => new Date(t).toISOString().slice(0, 10);
const czDate = t => { const d = new Date(t); return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`; };
const todayT = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}
const holCache = new Map();
function holidays(y) {
  if (holCache.has(y)) return holCache.get(y);
  const E = easter(y), list = [[0, 1, "Nový rok, Den obnovy samostatného českého státu"], [4, 1, "Svátek práce"], [4, 8, "Den vítězství"],
    [6, 5, "Den slovanských věrozvěstů Cyrila a Metoděje"], [6, 6, "Den upálení mistra Jana Husa"], [8, 28, "Den české státnosti"],
    [9, 28, "Den vzniku samostatného československého státu"], [10, 17, "Den boje za svobodu a demokracii"], [11, 24, "Štědrý den"],
    [11, 25, "1. svátek vánoční"], [11, 26, "2. svátek vánoční"]].map(([m, d, n]) => [Date.UTC(y, m, d), n]);
  if (y >= 2016) list.push([E - 2 * DAY, "Velký pátek"]);
  list.push([E + DAY, "Velikonoční pondělí"]);
  const map = new Map(list.sort((a, b) => a[0] - b[0])); holCache.set(y, map); return map;
}
const holidayName = t => holidays(new Date(t).getUTCFullYear()).get(t);
const isWeekend = t => { const w = new Date(t).getUTCDay(); return w === 0 || w === 6; };
const isWork = t => !isWeekend(t) && !holidayName(t);
function addMonths(t, n) {
  const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(day, last));
}
function ymdDiff(a, b) {   // a <= b
  let y = new Date(b).getUTCFullYear() - new Date(a).getUTCFullYear(), m = new Date(b).getUTCMonth() - new Date(a).getUTCMonth();
  let months = y * 12 + m; if (addMonths(a, months) > b) months--;
  const rest = Math.round((b - addMonths(a, months)) / DAY);
  return {years: Math.floor(months / 12), months: months % 12, totalMonths: months, days: rest};
}
const pl = (n, a, b, c) => `${n.toLocaleString("cs-CZ")} ${n === 1 ? a : n >= 2 && n <= 4 ? b : c}`;
function dayNote(t) { const h = holidayName(t); if (h) return `státní svátek (${h})`; if (isWeekend(t)) return WD[new Date(t).getUTCDay()]; return ""; }
function calcDiff() {
  let a = toT($("#dFrom").value), b = toT($("#dTo").value); const out = $("#diffOut");
  if (!isFinite(a) || !isFinite(b)) { out.innerHTML = '<span class="sub">Zadejte obě data.</span>'; return; }
  const neg = b < a; if (neg) [a, b] = [b, a];
  const incl = $("#dIncl").checked, days = Math.round((b - a) / DAY) + (incl ? 1 : 0);
  if (days > 200 * 366) { out.innerHTML = '<span class="err">Příliš dlouhé období.</span>'; return; }
  let work = 0, wend = 0, hol = 0;
  for (let t = incl ? a : a + DAY; t <= b; t += DAY) { if (isWeekend(t)) wend++; else if (holidayName(t)) hol++; else work++; }
  const ymd = ymdDiff(a, incl ? b + DAY : b);
  const parts = []; if (ymd.years) parts.push(pl(ymd.years, "rok", "roky", "let")); if (ymd.months) parts.push(pl(ymd.months, "měsíc", "měsíce", "měsíců")); if (ymd.days || !parts.length) parts.push(pl(ymd.days, "den", "dny", "dní"));
  out.innerHTML = `<div class="outrow"><span class="sub">${neg ? "Datum „Do“ je před „Od“. " : ""}Kalendářních dní</span><span class="big num">${days.toLocaleString("cs-CZ")}</span></div>
    <div class="outrow"><span class="sub">Pracovních dní (bez víkendů a státních svátků)</span><span class="big num">${work.toLocaleString("cs-CZ")}</span></div>
    <div class="sub" style="margin-top:6px">${parts.join(", ")} · ${pl(Math.floor(days / 7), "týden", "týdny", "týdnů")} a ${pl(days % 7, "den", "dny", "dní")} · víkendových dní ${wend}, svátků ve všední den ${hol}</div>`;
}
function calcAdd() {
  const t0 = toT($("#aDate").value), n = Math.abs(parseInt($("#aN").value, 10)), sign = +$("#aSign").value, unit = $("#aUnit").value, out = $("#addOut");
  if (!isFinite(t0) || !Number.isFinite(n)) { out.innerHTML = '<span class="sub">Zadejte datum a počet.</span>'; return; }
  if (n > 100000) { out.innerHTML = '<span class="err">Příliš velký počet.</span>'; return; }
  let t = t0;
  if (unit === "d") t = t0 + sign * n * DAY;
  else if (unit === "wk") t = t0 + sign * n * 7 * DAY;
  else if (unit === "m") t = addMonths(t0, sign * n);
  else if (unit === "y") t = addMonths(t0, sign * n * 12);
  else { let c = 0; while (c < n) { t += sign * DAY; if (isWork(t)) c++; } }
  const note = dayNote(t);
  let next = "";
  if (note && unit !== "w") { let u = t; while (!isWork(u)) u += DAY; next = `<div class="sub" style="margin-top:6px">Připadá na den volna (${note}). Nejbližší pracovní den: <b>${WD[new Date(u).getUTCDay()]} ${czDate(u)}</b>.</div>`; }
  out.innerHTML = `<div class="outrow"><span class="sub">Výsledné datum</span><span class="big num">${czDate(t)}</span></div><div class="sub">${WD[new Date(t).getUTCDay()]}</div>${next}`;
}
function isoWeek(t) {
  const dow = (new Date(t).getUTCDay() + 6) % 7, thu = t + (3 - dow) * DAY, y = new Date(thu).getUTCFullYear();
  const jan4 = Date.UTC(y, 0, 4), week1Mon = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY;
  return 1 + Math.floor((t - dow * DAY - week1Mon) / (7 * DAY));
}
function calcInfo() {
  const t = toT($("#iDate").value), out = $("#infoOut"); if (!isFinite(t)) { out.innerHTML = '<span class="sub">Zadejte datum.</span>'; return; }
  const d = new Date(t), y = d.getUTCFullYear(), doy = Math.round((t - Date.UTC(y, 0, 1)) / DAY) + 1, len = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const h = holidayName(t), diff = Math.round((t - todayT()) / DAY);
  const rel = diff === 0 ? "dnes" : diff > 0 ? `za ${pl(diff, "den", "dny", "dní")}` : `před ${pl(-diff, "dnem", "dny", "dny")}`;
  out.innerHTML = `<div class="outrow"><span class="big">${WD[d.getUTCDay()]}</span><span class="sub">${rel}</span></div>
    <table class="list" style="margin-top:6px"><tr><td>Týden v roce</td><td class="r">${isoWeek(t)}.</td></tr><tr><td>Den v roce</td><td class="r">${doy}. z ${len}</td></tr>
    <tr><td>Čtvrtletí</td><td class="r">${Math.floor(d.getUTCMonth() / 3) + 1}.</td></tr><tr><td>Pracovní den</td><td class="r">${isWork(t) ? "ano" : "ne"}</td></tr>
    ${h ? `<tr class="hl"><td colspan="2">Státní svátek: ${h}</td></tr>` : ""}</table>`;
}
function renderHolidays() {
  const y = parseInt($("#hYear").value, 10), tb = $("#holTable"); tb.innerHTML = "";
  if (!(y >= 1990 && y <= 2200)) { tb.innerHTML = '<tr><td class="sub">Zadejte rok mezi 1990 a 2200.</td></tr>'; return; }
  let workdays = 0; for (let t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 0, 1); t += DAY) if (isWork(t)) workdays++;
  for (const [t, n] of holidays(y)) { const tr = document.createElement("tr"); if (isWeekend(t)) tr.style.opacity = ".6"; tr.innerHTML = `<td class="num" style="white-space:nowrap">${czDate(t)}</td><td>${WD[new Date(t).getUTCDay()]}</td><td></td>`; tr.lastChild.textContent = n; tb.appendChild(tr); }
  const tr = document.createElement("tr"); tr.className = "hl"; tr.innerHTML = `<td colspan="3">Pracovních dní v roce ${y}: ${workdays}</td>`; tb.appendChild(tr);
}
function initDates() {
  const td = toS(todayT());
  $("#dFrom").value = td; $("#dTo").value = toS(Date.UTC(new Date().getFullYear(), 11, 31)); $("#aDate").value = td; $("#iDate").value = td; $("#hYear").value = new Date().getFullYear();
  ["#dFrom", "#dTo", "#dIncl"].forEach(id => $(id).addEventListener("input", calcDiff));
  ["#aDate", "#aSign", "#aN", "#aUnit"].forEach(id => $(id).addEventListener("input", calcAdd));
  $("#aPresets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#aSign").value = "1"; $("#aN").value = b.dataset.p; $("#aUnit").value = "d"; calcAdd(); });
  $("#iDate").addEventListener("input", calcInfo); $("#hYear").addEventListener("input", renderHolidays);
  calcDiff(); calcAdd(); calcInfo(); renderHolidays();
}

/* ---------- převody: měny ---------- */
const CUR = {rates: null, date: "", src: "", loading: false, last: null};
const curName = (() => { let dn = null; try { dn = new Intl.DisplayNames(["cs"], {type: "currency"}); } catch {} return c => { try { return dn ? dn.of(c) : c; } catch { return c; } }; })();
const TOP = ["CZK", "EUR", "USD", "GBP", "CHF", "PLN", "HUF", "JPY", "SEK", "NOK", "DKK", "CAD", "AUD", "CNY"];
function fillCurrencies() {
  const codes = Object.keys(CUR.rates || {CZK: 1, EUR: 0, USD: 0}).sort((a, b) => { const ia = TOP.indexOf(a), ib = TOP.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
  for (const [sel, def] of [[$("#cFrom"), store.get("cFrom", "EUR")], [$("#cTo"), store.get("cTo", "CZK")]]) {
    const cur = sel.value || def; sel.innerHTML = "";
    for (const c of codes) { const o = document.createElement("option"); o.value = c; o.textContent = `${c} – ${curName(c)}`; sel.appendChild(o); }
    sel.value = codes.includes(cur) ? cur : codes[0];
  }
}
async function loadRates(force) {
  const cached = store.get("rates", null);
  if (cached && !force && Date.now() - cached.fetched < 6 * 3600e3) { Object.assign(CUR, cached); fillCurrencies(); calcCur(); return; }
  if (CUR.loading) return; CUR.loading = true; $("#curInfo").textContent = "Načítám kurzy…";
  try {
    let src = "ČNB", res = await fetch("https://api.frankfurter.dev/v2/rates?base=CZK&providers=cnb");
    if (!res.ok) { src = "Frankfurter"; res = await fetch("https://api.frankfurter.dev/v2/rates?base=CZK"); }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json(), rates = {CZK: 1}; let date = "";
    const rows = Array.isArray(data) ? data : Object.entries(data.rates || {}).map(([quote, rate]) => ({quote, rate, date: data.date}));
    for (const r of rows) if (r.quote && r.rate > 0) { rates[r.quote.toUpperCase()] = r.rate; if ((r.date || "") > date) date = r.date; }
    if (Object.keys(rates).length < 3) throw new Error("Prázdná data");
    Object.assign(CUR, {rates, date, src, fetched: Date.now()}); store.set("rates", {rates, date, src, fetched: Date.now()});
  } catch (e) {
    console.warn(e);
    if (cached) Object.assign(CUR, cached);
    $("#curInfo").textContent = cached ? `Kurzy se nepodařilo aktualizovat (jste offline?). Používám uložené kurzy z ${czDate(toT(cached.date))}.` : "Kurzy se nepodařilo načíst (jste offline?). Můžete zadat vlastní kurz.";
  } finally { CUR.loading = false; fillCurrencies(); calcCur(); }
}
function calcCur() {
  const a = numIn($("#cAmt")), f = $("#cFrom").value, t = $("#cTo").value, out = $("#curOut");
  $("#cOwnLabel").textContent = `1 ${f} = ? ${t}`;
  store.set("cFrom", f); store.set("cTo", t);
  let rate = NaN;
  if ($("#cOwn").checked) rate = numIn($("#cOwnRate"));
  else if (CUR.rates && CUR.rates[f] && CUR.rates[t]) rate = CUR.rates[t] / CUR.rates[f];
  if (CUR.rates && CUR.date && !$("#curInfo").textContent.startsWith("Kurzy se nepodařilo")) $("#curInfo").textContent = `Kurzy ${CUR.src === "ČNB" ? "České národní banky" : "z veřejných zdrojů (Frankfurter)"} ze dne ${czDate(toT(CUR.date))}. Pouze orientační.`;
  if (!isFinite(a) || !isFinite(rate)) { out.innerHTML = `<span class="sub">${isFinite(a) ? "Kurz není k dispozici." : "Zadejte částku."}</span>`; CUR.last = null; return; }
  const v = a * rate, dec = t === "JPY" || t === "HUF" ? 0 : 2;
  out.innerHTML = `<div class="outrow"><span class="sub">${money(a, f === "JPY" || f === "HUF" ? 0 : 2)} ${f} =</span><span class="big num">${money(v, dec)} ${t}</span></div>
    <div class="sub">1 ${f} = ${fmt(rnd(rate, 6))} ${t} · 1 ${t} = ${fmt(rnd(1 / rate, 6))} ${f}${$("#cOwn").checked ? " (vlastní kurz)" : ""}</div>`;
  CUR.last = {a, f, t, v};
}
$("#cAmt").addEventListener("input", calcCur); $("#cFrom").addEventListener("change", calcCur); $("#cTo").addEventListener("change", calcCur);
$("#cSwap").onclick = () => { const a = $("#cFrom").value; $("#cFrom").value = $("#cTo").value; $("#cTo").value = a; calcCur(); };
$("#cOwn").addEventListener("change", () => { $("#cOwnWrap").hidden = !$("#cOwn").checked;
  if ($("#cOwn").checked && !$("#cOwnRate").value && CUR.rates) { const f = $("#cFrom").value, t = $("#cTo").value; if (CUR.rates[f] && CUR.rates[t]) $("#cOwnRate").value = String(rnd(CUR.rates[t] / CUR.rates[f], 4)).replace(".", ","); }
  calcCur(); });
$("#cOwnRate").addEventListener("input", calcCur);
$("#cRefresh").onclick = () => loadRates(true);
$("#cTape").onclick = () => { const l = CUR.last; if (!l) { toast("Nejdřív zadejte částku."); return; } addTape(`${money(l.a)} ${l.f} → ${l.t}`, l.v, "Měny"); toast("Zapsáno na pásku."); };

/* ---------- převody: jednotky ---------- */
const UNITS = {
  "Délka": [["mm", "milimetr", 1e-3], ["cm", "centimetr", 1e-2], ["dm", "decimetr", .1], ["m", "metr", 1], ["km", "kilometr", 1e3], ["in", "palec", .0254], ["ft", "stopa", .3048], ["yd", "yard", .9144], ["mi", "míle", 1609.344], ["nmi", "námořní míle", 1852]],
  "Plocha": [["mm²", "čtvereční milimetr", 1e-6], ["cm²", "čtvereční centimetr", 1e-4], ["dm²", "čtvereční decimetr", 1e-2], ["m²", "čtvereční metr", 1], ["a", "ar", 100], ["ha", "hektar", 1e4], ["km²", "čtvereční kilometr", 1e6], ["ft²", "čtvereční stopa", .09290304], ["ac", "akr", 4046.8564224]],
  "Objem": [["ml", "mililitr", 1e-3], ["cl", "centilitr", 1e-2], ["dl", "decilitr", .1], ["l", "litr", 1], ["hl", "hektolitr", 100], ["cm³", "kubický centimetr", 1e-3], ["m³", "kubický metr", 1000], ["gal US", "galon (USA)", 3.785411784], ["gal UK", "galon (britský)", 4.54609], ["pt UK", "pinta (britská)", .56826125]],
  "Hmotnost": [["mg", "miligram", 1e-6], ["g", "gram", 1e-3], ["dkg", "dekagram", 1e-2], ["kg", "kilogram", 1], ["q", "metrický cent", 100], ["t", "tuna", 1000], ["oz", "unce", .028349523125], ["lb", "libra", .45359237]],
  "Teplota": [["°C", "stupeň Celsia"], ["°F", "stupeň Fahrenheita"], ["K", "kelvin"]],
  "Čas": [["s", "sekunda", 1], ["min", "minuta", 60], ["h", "hodina", 3600], ["d", "den", 86400], ["týd", "týden", 604800], ["r", "rok (365 dní)", 31536000]],
  "Rychlost": [["m/s", "metr za sekundu", 1], ["km/h", "kilometr za hodinu", 1 / 3.6], ["mph", "míle za hodinu", .44704], ["kn", "uzel", 1852 / 3600]],
  "Energie": [["J", "joule", 1], ["kJ", "kilojoule", 1e3], ["cal", "kalorie", 4.184], ["kcal", "kilokalorie", 4184], ["Wh", "watthodina", 3600], ["kWh", "kilowatthodina", 3.6e6], ["MWh", "megawatthodina", 3.6e9]],
  "Data": [["B", "bajt", 1], ["kB", "kilobajt", 1e3], ["MB", "megabajt", 1e6], ["GB", "gigabajt", 1e9], ["TB", "terabajt", 1e12], ["KiB", "kibibajt", 1024], ["MiB", "mebibajt", 1048576], ["GiB", "gibibajt", 1073741824]],
};
const UDEF = {"Délka": ["m", "cm"], "Plocha": ["m²", "ha"], "Objem": ["l", "m³"], "Hmotnost": ["kg", "g"], "Teplota": ["°C", "°F"], "Čas": ["h", "min"], "Rychlost": ["km/h", "m/s"], "Energie": ["kWh", "kJ"], "Data": ["GB", "MB"]};
function tempConv(v, f, t) { const c = f === "°C" ? v : f === "°F" ? (v - 32) * 5 / 9 : v - 273.15; return t === "°C" ? c : t === "°F" ? c * 9 / 5 + 32 : c + 273.15; }
function uConv(cat, v, f, t) { if (cat === "Teplota") return tempConv(v, f, t); const U = UNITS[cat]; return v * U.find(u => u[0] === f)[2] / U.find(u => u[0] === t)[2]; }
let ULAST = null;
function fillUnits(keep) {
  const cat = $("#uCat").value, [df, dt] = UDEF[cat];
  for (const [sel, def] of [[$("#uFrom"), df], [$("#uTo"), dt]]) {
    sel.innerHTML = ""; for (const [id, name] of UNITS[cat]) { const o = document.createElement("option"); o.value = id; o.textContent = `${name} (${id})`; sel.appendChild(o); }
    sel.value = def;
  }
  calcUnit();
}
function calcUnit() {
  const cat = $("#uCat").value, v = numIn($("#uVal")), f = $("#uFrom").value, t = $("#uTo").value, out = $("#uOut"), all = $("#uAll");
  if (!isFinite(v)) { out.innerHTML = '<span class="sub">Zadejte hodnotu.</span>'; all.innerHTML = ""; ULAST = null; return; }
  if (cat === "Teplota" && tempConv(v, f, "K") < -1e-9) { out.innerHTML = '<span class="err">Teplota pod absolutní nulou neexistuje.</span>'; all.innerHTML = ""; ULAST = null; return; }
  const r = uConv(cat, v, f, t);
  out.innerHTML = `<div class="outrow"><span class="sub">${fmt(v)} ${f} =</span><span class="big num">${fmt(r)} ${t}</span></div>`;
  ULAST = {v, f, t, r};
  all.innerHTML = ""; for (const [id, name] of UNITS[cat]) { const tr = document.createElement("tr"); if (id === t) tr.className = "hl"; tr.innerHTML = `<td></td><td class="r"></td>`; tr.firstChild.textContent = name; tr.lastChild.textContent = `${fmt(uConv(cat, v, f, id))} ${id}`; all.appendChild(tr); }
}
function initUnits() {
  const cat = $("#uCat"); for (const k of Object.keys(UNITS)) { const o = document.createElement("option"); o.value = k; o.textContent = k; cat.appendChild(o); }
  cat.addEventListener("change", () => fillUnits()); $("#uVal").addEventListener("input", calcUnit); $("#uFrom").addEventListener("change", calcUnit); $("#uTo").addEventListener("change", calcUnit);
  $("#uSwap").onclick = () => { const a = $("#uFrom").value; $("#uFrom").value = $("#uTo").value; $("#uTo").value = a; calcUnit(); };
  $("#uTape").onclick = () => { if (!ULAST) { toast("Nejdřív zadejte hodnotu."); return; } addTape(`${fmt(ULAST.v)} ${ULAST.f} → ${ULAST.t}`, ULAST.r, "Převod"); toast("Zapsáno na pásku."); };
  fillUnits();
}

/* ---------- start ---------- */
updateAngle(); updateMem(); renderTape(); preview(); buildPct(); initDates(); initUnits(); fillCurrencies(); calcCur();
setTab(store.get("tab", "calc"));
