/* Andy PDF – úpravy PDF v prohlížeči. Created by Julius Andy Antoš. Licence MIT. */
"use strict";
const {PDFDocument, degrees, rgb, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList} = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";

/* ---------- pomocné funkce ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function b64ToBytes(b) { const s = atob(b); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
const plural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);
const pagesWord = n => `${n} ${plural(n, "stránka", "stránky", "stránek")}`;
function today() { const d = new Date(); return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); }
const dataUrlBytes = u => b64ToBytes(u.slice(u.indexOf(",") + 1));
const baseName = n => (n || "dokument").replace(/\.[^.]+$/, "");
const toHex = (r, g, b) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");

let toastTimer;
function toast(msg, opt = {}) {
  const t = $("#toast"); $("#toastMsg").textContent = msg; const b = $("#toastAct");
  if (opt.action) { b.hidden = false; b.textContent = opt.action; b.onclick = () => { t.hidden = true; opt.onAction(); }; } else b.hidden = true;
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, opt.ms || (opt.action ? 7000 : 4500));
}
function busy(msg) { $("#busyMsg").textContent = msg; $("#busy").hidden = false; }
function idle() { $("#busy").hidden = true; }

/* ---------- písma (přibalená, otevřené licence) ---------- */
const FONTS = [
  {id: "carlito", label: "Carlito (jako Calibri)"},
  {id: "sans", label: "Liberation Sans (jako Arial)"},
  {id: "serif", label: "Liberation Serif (jako Times New Roman)"},
  {id: "mono", label: "Liberation Mono (jako Courier New)"},
  {id: "caladea", label: "Caladea (jako Cambria)"},
  {id: "dejavu", label: "DejaVu Sans"},
  {id: "poppins", label: "Poppins"},
];
const DEFAULT_FONT = "carlito";
const slotOf = (b, i) => (b ? "B" : "") + (i ? "I" : "") || "R";
const fontCss = id => `"AF-${id}", sans-serif`;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Nelze načíst " + src)); document.head.appendChild(s); });
}
const fontBytesCache = {};
async function fontBytes(id, slot) {
  const k = `${id}-${slot}`;
  if (!(window.AndyFonts && window.AndyFonts[k])) await loadScript(`fonts/${k}.js`);
  return fontBytesCache[k] ??= b64ToBytes(window.AndyFonts[k]);
}
const cssFontPromises = {};
function ensureCssFont(id) {
  return cssFontPromises[id] ??= (async () => {
    for (const [slot, weight, style] of [["R", "400", "normal"], ["B", "700", "normal"], ["I", "400", "italic"], ["BI", "700", "italic"]]) {
      try { const ff = new FontFace("AF-" + id, (await fontBytes(id, slot)).slice().buffer, {weight, style}); await ff.load(); document.fonts.add(ff); }
      catch (e) { console.warn(e); }
    }
  })();
}
const fkCache = {};
async function measureText(text, size, id, bold, italic) {
  const k = `${id}-${slotOf(bold, italic)}`;
  const f = fkCache[k] ??= fontkit.create(await fontBytes(id, slotOf(bold, italic)));
  return f.layout(text).advanceWidth / f.unitsPerEm * size;
}
function fontMetrics(id, bold, italic) {
  const c = document.createElement("canvas").getContext("2d");
  c.font = `${italic ? "italic " : ""}${bold ? 700 : 400} 100px "AF-${id}"`;
  const m = c.measureText("ÁHgjý"), a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
  return (a > 0 && d >= 0) ? {asc: a / 100, desc: d / 100} : {asc: .9, desc: .25};
}
function fillFontSelect(sel, value) {
  sel.innerHTML = ""; for (const f of FONTS) { const o = document.createElement("option"); o.value = f.id; o.textContent = f.label; sel.appendChild(o); }
  sel.value = value || DEFAULT_FONT;
}
function mapPdfFont(name, generic) {
  const n = (name || "").replace(/^[A-Z]{6}\+/, ""), low = n.toLowerCase();
  const bold = /bold|black|heavy|semibold|demi/.test(low), italic = /italic|oblique/.test(low);
  let id = "sans";
  if (/calibri|carlito/.test(low)) id = "carlito";
  else if (/cambria|caladea/.test(low)) id = "caladea";
  else if (/courier|mono|consol/.test(low) || generic === "monospace") id = "mono";
  else if (/dejavu/.test(low)) id = "dejavu";
  else if (/poppins/.test(low)) id = "poppins";
  else if (/times|serif|georgia|garamond|roman|book/.test(low) && !/sans/.test(low)) id = "serif";
  else if (generic === "serif" && !/arial|helvet|sans|verdana|tahoma|segoe/.test(low)) id = "serif";
  return {id, bold, italic, name: n};
}

/* ---------- stav ---------- */
const S = {sources: new Map(), pages: [], sel: new Set(), tab: "pages", cur: 0, selAnno: null, anchor: null, formSrc: null, editMode: false,
  textDefaults: {font: DEFAULT_FONT, size: 12, color: "#1E1B2E", bold: false, italic: false, underline: false}};
const thumbCache = new Map(), lineCache = new Map();

async function openPdfjs(bytes) { return pdfjsLib.getDocument({data: bytes.slice(), isEvalSupported: false}).promise; }
async function addPdfBytes(bytes, name) {
  const pdf = await openPdfjs(bytes), info = [];
  for (let i = 1; i <= pdf.numPages; i++) { const pg = await pdf.getPage(i); const [x1, y1, x2, y2] = pg.view; info.push({W: x2 - x1, H: y2 - y1, rot: ((pg.rotate % 360) + 360) % 360}); }
  const src = {id: uid(), name, bytes, pdf, info, lib: null, ver: 0, form: undefined};
  S.sources.set(src.id, src);
  const added = info.map((_, i) => ({id: uid(), src: src.id, idx: i, rot: 0, annos: [], edits: []}));
  S.pages.push(...added);
  return added.length;
}
const getLib = src => src.lib ??= PDFDocument.load(src.bytes, {ignoreEncryption: true, updateMetadata: false});

async function handleFiles(files) {
  const list = [...files]; if (!list.length) return;
  busy("Načítám soubory…"); let added = 0;
  try {
    const imgs = [];
    for (const f of list) {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        try { added += await addPdfBytes(new Uint8Array(await f.arrayBuffer()), f.name); }
        catch (e) { console.warn(e); toast(e?.name === "PasswordException" ? `Soubor „${f.name}“ je chráněný heslem.` : `Soubor „${f.name}“ se nepodařilo otevřít.`, {ms: 8000}); }
      } else if (f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name)) imgs.push(f);
      else toast(`Soubor „${f.name}“ není PDF ani obrázek.`);
    }
    if (imgs.length) { const b = await imagesToPdf(imgs, "a4"); if (b) added += await addPdfBytes(b, imgs.length === 1 ? imgs[0].name : "Obrázky"); }
  } finally { idle(); renderAll(); }
  if (added) toast(`Přidáno: ${pagesWord(added)}.`);
}

/* ---------- obrázky ---------- */
async function loadImage(file) {
  try { return await createImageBitmap(file, {imageOrientation: "from-image"}); }
  catch { return await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("img")); im.src = URL.createObjectURL(file); }); }
}
function urlImage(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; }); }
function toCanvas(img, max, white) {
  const w0 = img.width, h0 = img.height, k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
  const x = c.getContext("2d"); if (white) { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); } x.drawImage(img, 0, 0, c.width, c.height); return c;
}
const canvasBytes = (c, type, q) => new Promise((res, rej) => c.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error("blob")), type, q));
const A4 = [595.28, 841.89];
async function imagesToPdf(files, mode) {
  const doc = await PDFDocument.create(); let n = 0;
  for (const f of files) {
    let im; try { im = await loadImage(f); } catch { toast(`Obrázek „${f.name}“ se nepodařilo načíst.`); continue; }
    const c = toCanvas(im, 2400, true), img = await doc.embedJpg(await canvasBytes(c, "image/jpeg", .88)), land = c.width > c.height;
    if (mode === "fit") { const W = land ? A4[1] : A4[0], H = W * c.height / c.width; doc.addPage([W, H]).drawImage(img, {x: 0, y: 0, width: W, height: H}); }
    else { const [W, H] = land ? [A4[1], A4[0]] : A4, m = 28, k = Math.min((W - 2 * m) / c.width, (H - 2 * m) / c.height), w = c.width * k, h = c.height * k;
      doc.addPage([W, H]).drawImage(img, {x: (W - w) / 2, y: (H - h) / 2, width: w, height: h}); }
    n++;
  }
  return n ? await doc.save() : null;
}

/* ---------- PDF z textu ---------- */
function wrap(text, font, size, maxW) {
  const out = []; let line = "";
  for (const word of text.replace(/\t/g, "    ").split(/ +/)) {
    const t = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(t, size) <= maxW) { line = t; continue; }
    if (line) out.push(line);
    let w = word;
    while (font.widthOfTextAtSize(w, size) > maxW && w.length > 1) { let k = w.length - 1; while (k > 1 && font.widthOfTextAtSize(w.slice(0, k), size) > maxW) k--; out.push(w.slice(0, k)); w = w.slice(k); }
    line = w;
  }
  out.push(line); return out;
}
async function textToPdf(o) {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const fr = await doc.embedFont(await fontBytes(o.font, "R"), {subset: false}), fb = await doc.embedFont(await fontBytes(o.font, "B"), {subset: false});
  const [PW, PH] = A4, M = 62, maxW = PW - 2 * M, ink = rgb(.09, .16, .23), acc = rgb(.17, .42, .69); let page, y;
  const newPage = () => { page = doc.addPage([PW, PH]); y = PH - M;
    if (o.header) { page.drawText(o.header, {x: M, y: PH - 42, size: 9.5, font: fb, color: acc}); page.drawLine({start: {x: M, y: PH - 48}, end: {x: PW - M, y: PH - 48}, thickness: .7, color: acc}); y = PH - M - 16; } };
  const write = (text, font, size, color, after) => { const lh = size * 1.38;
    for (const para of text.split(/\r?\n/)) for (const l of (para.trim() ? wrap(para, font, size, maxW) : [""])) { if (y - lh < M) newPage(); y -= lh; if (l) page.drawText(l, {x: M, y: y + lh * .27, size, font, color}); }
    y -= after; };
  newPage();
  if (o.title) write(o.title, fb, o.size + 8, ink, o.date ? 2 : 14);
  if (o.date) write(today(), fr, o.size - 1, rgb(.31, .38, .46), 14);
  if (o.body) write(o.body, fr, o.size, ink, 0);
  return doc.save();
}

/* ---------- geometrie ---------- */
function visToUT(vx, vy, r, W, H) { switch (r) { case 90: return {u: vy, t: H - vx}; case 180: return {u: W - vx, t: H - vy}; case 270: return {u: W - vy, t: vx}; default: return {u: vx, t: vy}; } }
function utToVis(u, t, r, W, H) { switch (r) { case 90: return {x: H - t, y: u}; case 180: return {x: W - u, y: H - t}; case 270: return {x: t, y: W - u}; default: return {x: u, y: t}; } }
function visToPdf(vx, vy, r, W, H, ox, oy) { const p = visToUT(vx, vy, r, W, H); return {x: ox + p.u, y: oy + H - p.t}; }

/* ---------- sestavení výsledného PDF ---------- */
async function buildPdf(pages, {numbers = false, annos = true} = {}) {
  const out = await PDFDocument.create(); out.registerFontkit(fontkit);
  const fonts = {};
  const getFont = async (id, b, i) => { const k = `${id}-${slotOf(b, i)}`; return fonts[k] ??= await out.embedFont(await fontBytes(id, slotOf(b, i)), {subset: false}); };
  const bySrc = new Map(); for (const p of pages) { if (!bySrc.has(p.src)) bySrc.set(p.src, []); bySrc.get(p.src).push(p.idx); }
  const copied = new Map(); for (const [sid, idxs] of bySrc) copied.set(sid, await out.copyPages(await getLib(S.sources.get(sid)), idxs));
  const ptr = new Map(), imgs = new Map();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i], k = ptr.get(p.src) || 0; ptr.set(p.src, k + 1); const pg = copied.get(p.src)[k]; out.addPage(pg);
    const inf = S.sources.get(p.src).info[p.idx], total = (inf.rot + p.rot) % 360; pg.setRotation(degrees(total));
    const box = pg.getCropBox(), W = box.width, H = box.height, ox = box.x, oy = box.y;
    for (const e of p.edits || []) {   // oprava textu: zakrýt původní a napsat nový
      const L = e.line, [x0, y0, x1, y1] = L.rect;
      pg.drawRectangle({x: x0, y: y0, width: x1 - x0, height: y1 - y0, color: hexRgb(L.bg), borderWidth: 0});
      if (e.text.trim()) pg.drawText(e.text, {x: L.origin[0], y: L.origin[1], size: e.size, font: await getFont(e.font, e.bold, e.italic), color: hexRgb(e.color), rotate: degrees(L.angle)});
    }
    if (annos) for (const a of p.annos) {
      const [aVW, aVH] = a.rot % 180 ? [H, W] : [W, H];
      if (a.type === "text") {
        await ensureCssFont(a.font);
        const font = await getFont(a.font, a.bold, a.italic), m = fontMetrics(a.font, a.bold, a.italic), col = hexRgb(a.color);
        const first = ((1.25 - (m.asc + m.desc)) / 2 + m.asc) * a.size;
        const lines = a.text.replace(/\t/g, "    ").split("\n");
        for (let li = 0; li < lines.length; li++) {
          const ln = lines[li]; if (!ln.trim()) continue;
          const bx = a.fx * aVW, by = a.fy * aVH + first + li * 1.25 * a.size, pt = visToPdf(bx, by, a.rot, W, H, ox, oy);
          pg.drawText(ln, {x: pt.x, y: pt.y, size: a.size, font, color: col, rotate: degrees(a.rot)});
          if (a.underline) { const w = font.widthOfTextAtSize(ln, a.size), uy = by + a.size * .12;
            pg.drawLine({start: visToPdf(bx, uy, a.rot, W, H, ox, oy), end: visToPdf(bx + w, uy, a.rot, W, H, ox, oy), thickness: Math.max(.5, a.size * .06), color: col}); }
        }
      } else {
        let img = imgs.get(a.src); if (!img) { img = await out.embedPng(dataUrlBytes(a.src)); imgs.set(a.src, img); }
        const w = a.fw * aVW, h = a.fh * aVH, pt = visToPdf(a.fx * aVW, a.fy * aVH + h, a.rot, W, H, ox, oy);
        pg.drawImage(img, {x: pt.x, y: pt.y, width: w, height: h, rotate: degrees(a.rot)});
      }
    }
    if (numbers) { const f = await getFont(DEFAULT_FONT, false, false), t = `${i + 1} / ${pages.length}`, [VW, VH] = total % 180 ? [H, W] : [W, H];
      const pt = visToPdf(VW / 2 - f.widthOfTextAtSize(t, 10) / 2, VH - 22, total, W, H, ox, oy);
      pg.drawText(t, {x: pt.x, y: pt.y, size: 10, font: f, color: rgb(.3, .3, .35), rotate: degrees(total)}); }
  }
  out.setProducer("Andy PDF"); out.setCreator("Andy PDF");
  return out.save();
}

/* ---------- ukládání a tisk ---------- */
function saveFile(filename, data) {
  const blob = new Blob([data], {type: filename.endsWith(".zip") ? "application/zip" : "application/pdf"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
const pdfName = n => { n = (n || "").trim().replace(/[\\/:*?"<>|]+/g, "-") || "dokument"; return /\.pdf$/i.test(n) ? n : n + ".pdf"; };
function defaultName() { const s = [...S.sources.values()]; return s.length === 1 ? baseName(s[0].name) + "-upraveno" : "dokument"; }
async function printDoc() {
  if (!S.pages.length) return;
  busy("Připravuji tisk…");
  try {
    const b = await buildPdf(S.pages, {numbers: $("#numbers").checked});
    const url = URL.createObjectURL(new Blob([b], {type: "application/pdf"})), fr = $("#printFrame");
    fr.onload = () => { idle(); setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { window.open(url, "_blank"); toast("Tisk spusťte v nově otevřené kartě (Ctrl+P)."); } }, 400); };
    fr.src = url;
    setTimeout(idle, 8000);
  } catch (e) { idle(); console.error(e); toast("Tisk se nepodařilo připravit."); }
}

/* ---------- náhledy ---------- */
const tq = []; let tBusy = false;
const thumbKey = p => { const s = S.sources.get(p.src); return `${p.src}:${p.idx}:${s ? s.ver : 0}`; };
async function pump() {
  if (tBusy) return; tBusy = true;
  while (tq.length) {
    const {key, src, idx} = tq.shift(); if (thumbCache.has(key)) continue; const s = S.sources.get(src); if (!s) continue;
    try { const pg = await s.pdf.getPage(idx + 1), v = pg.getViewport({scale: 1}), k = 300 / Math.max(v.width, v.height), vp = pg.getViewport({scale: k});
      const c = document.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
      await pg.render({canvasContext: x, viewport: vp}).promise; const url = c.toDataURL("image/jpeg", .82); thumbCache.set(key, url);
      $$(`img[data-key="${key}"]`).forEach(im => im.src = url);
    } catch (e) { console.warn(e); }
  }
  tBusy = false;
}
const ICON = {
  rl: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4v6h6"/><path d="M3.5 10A8.5 8.5 0 1 1 6 17"/></svg>',
  rr: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 4v6h-6"/><path d="M20.5 10A8.5 8.5 0 1 0 18 17"/></svg>',
  edit: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  left: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  tick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'
};
function renderGrid() {
  const g = $("#grid"), has = S.pages.length > 0; g.hidden = !has; $("#emptyPages").hidden = has; g.innerHTML = "";
  S.pages.forEach((p, i) => {
    const src = S.sources.get(p.src), key = thumbKey(p), sel = S.sel.has(p.id);
    const c = document.createElement("div"); c.className = "card" + (sel ? " sel" : ""); c.dataset.i = i; c.draggable = true; c.tabIndex = 0;
    c.setAttribute("role", "checkbox"); c.setAttribute("aria-checked", sel); c.setAttribute("aria-label", `Stránka ${i + 1}`);
    c.innerHTML = `<span class="selbox">${sel ? ICON.tick : ""}</span><div class="thumb"><img alt="" data-key="${key}"></div>
      <div class="cardinfo"><b></b><span></span></div>
      <div class="cardtools"><button class="ib" data-act="left" aria-label="Posunout dopředu" title="Posunout dopředu">${ICON.left}</button>
      <button class="ib" data-act="rl" aria-label="Otočit vlevo" title="Otočit vlevo">${ICON.rl}</button>
      <button class="ib" data-act="edit" aria-label="Upravit stránku" title="Upravit stránku">${ICON.edit}</button>
      <button class="ib" data-act="rr" aria-label="Otočit vpravo" title="Otočit vpravo">${ICON.rr}</button>
      <button class="ib" data-act="right" aria-label="Posunout dozadu" title="Posunout dozadu">${ICON.right}</button></div>`;
    $("b", c).textContent = `Strana ${i + 1}`; const sp = $(".cardinfo span", c); sp.textContent = `${baseName(src.name)} · ${p.idx + 1}`; sp.title = src.name;
    const img = $("img", c); img.style.transform = `rotate(${p.rot}deg)`; img.draggable = false;
    if (thumbCache.has(key)) img.src = thumbCache.get(key); else { img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw="; tq.push({key, src: p.src, idx: p.idx}); }
    const n = p.annos.length + (p.edits || []).length;
    if (n) { const m = document.createElement("span"); m.className = "mark"; m.textContent = `+${n}`; m.title = "Obsahuje úpravy"; $(".thumb", c).appendChild(m); }
    g.appendChild(c);
  });
  pump(); updatePagesPanel();
}
function updatePagesPanel() {
  const n = S.sel.size;
  $("#selInfo").textContent = n ? `Vybráno: ${pagesWord(n)}.` : "Kliknutím na stránku ji vyberete. Se Shiftem vyberete rozsah.";
  $$("[data-need-sel]").forEach(b => b.disabled = !n);
}
function updateHeader() {
  const n = S.pages.length; $("#count").textContent = n ? pagesWord(n) : ""; $("#saveBtn").disabled = !n; $("#printBtn").disabled = !n;
  $$("[data-need-pages]").forEach(b => b.disabled = !n);
}
function renderAll() {
  S.sel = new Set([...S.sel].filter(id => S.pages.some(p => p.id === id)));
  updateHeader();
  if (S.tab === "pages") renderGrid();
  if (S.tab === "insert") renderEditor();
  if (S.tab === "form") renderForm();
  updatePagesPanel();
}
const snapshot = () => ({pages: S.pages.map(p => ({...p, annos: p.annos.map(a => ({...a})), edits: (p.edits || []).map(e => ({...e}))})), sel: new Set(S.sel)});
const undoStack = [];
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 30) undoStack.shift(); }
function restore(s) { S.pages = s.pages; S.sel = s.sel; renderAll(); }
function undo() { const s = undoStack.pop(); if (s) { restore(s); toast("Vráceno zpět."); } }
function movePage(from, to) { if (to > from) to--; if (to === from || to < 0 || to >= S.pages.length) return; pushUndo(); const [p] = S.pages.splice(from, 1); S.pages.splice(to, 0, p); renderGrid(); }
function rotatePages(ids, d) { pushUndo(); for (const p of S.pages) if (ids.includes(p.id)) p.rot = (p.rot + d + 360) % 360; renderAll(); }

const grid = $("#grid"); let dragFrom = null, dropTo = null;
grid.addEventListener("click", e => {
  const c = e.target.closest(".card"); if (!c) return; const i = +c.dataset.i, p = S.pages[i], b = e.target.closest("button[data-act]");
  if (b) { const a = b.dataset.act;
    if (a === "rl") rotatePages([p.id], -90); else if (a === "rr") rotatePages([p.id], 90);
    else if (a === "edit") openEditor(i); else if (a === "left") movePage(i, i - 1); else if (a === "right") movePage(i, i + 2); return; }
  if (e.shiftKey && S.anchor != null) { const a = S.pages.findIndex(x => x.id === S.anchor); if (a >= 0) for (let k = Math.min(a, i); k <= Math.max(a, i); k++) S.sel.add(S.pages[k].id); }
  else { S.sel.has(p.id) ? S.sel.delete(p.id) : S.sel.add(p.id); S.anchor = p.id; }
  renderGrid(); $(`.card[data-i="${i}"]`)?.focus();
});
grid.addEventListener("dblclick", e => { const c = e.target.closest(".card"); if (c && !e.target.closest("button")) openEditor(+c.dataset.i); });
grid.addEventListener("keydown", e => { const c = e.target.closest(".card"); if (!c || e.target !== c) return;
  if (e.key === " ") { e.preventDefault(); c.click(); } else if (e.key === "Enter") { e.preventDefault(); openEditor(+c.dataset.i); } });
grid.addEventListener("dragstart", e => { const c = e.target.closest(".card"); if (!c) return; dragFrom = +c.dataset.i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "page"); });
grid.addEventListener("dragover", e => { if (dragFrom == null) return; e.preventDefault(); $$(".drop-before,.drop-after", grid).forEach(x => x.classList.remove("drop-before", "drop-after"));
  const c = e.target.closest(".card"); if (!c) return; const r = c.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2; c.classList.add(after ? "drop-after" : "drop-before"); dropTo = +c.dataset.i + (after ? 1 : 0); });
grid.addEventListener("drop", e => { if (dragFrom == null) return; e.preventDefault(); e.stopPropagation(); const f = dragFrom; dragFrom = null; if (dropTo != null) movePage(f, dropTo); });
grid.addEventListener("dragend", () => { dragFrom = null; dropTo = null; $$(".drop-before,.drop-after", grid).forEach(x => x.classList.remove("drop-before", "drop-after")); });

$("#selAll").onclick = () => { S.pages.forEach(p => S.sel.add(p.id)); renderGrid(); };
$("#selNone").onclick = () => { S.sel.clear(); renderGrid(); };
$("#rotL").onclick = () => rotatePages([...S.sel], -90);
$("#rotR").onclick = () => rotatePages([...S.sel], 90);
$("#delSel").onclick = () => { const snap = snapshot(), n = S.sel.size; S.pages = S.pages.filter(p => !S.sel.has(p.id)); S.sel.clear(); renderAll();
  toast(`Odstraněno: ${pagesWord(n)}.`, {action: "Vrátit zpět", onAction: () => restore(snap)}); };
$("#clearAll").onclick = () => { const snap = snapshot(); S.pages = []; S.sel.clear(); renderAll(); toast("Dokument je prázdný.", {action: "Vrátit zpět", onAction: () => restore(snap)}); };
$("#saveSel").onclick = async () => { busy("Připravuji PDF…");
  try { const b = await buildPdf(S.pages.filter(p => S.sel.has(p.id)), {numbers: $("#numbers").checked}); idle(); saveFile(pdfName(defaultName() + "-vyber"), b); } catch (e) { idle(); console.error(e); toast("PDF se nepodařilo vytvořit."); } };
$("#splitAll").onclick = async () => { busy("Rozděluji stránky…");
  try { const z = new JSZip(), base = defaultName(), w = String(S.pages.length).length;
    for (let i = 0; i < S.pages.length; i++) { $("#busyMsg").textContent = `Rozděluji stránky… ${i + 1} / ${S.pages.length}`; z.file(`${base}-strana-${String(i + 1).padStart(w, "0")}.pdf`, await buildPdf([S.pages[i]])); }
    const blob = await z.generateAsync({type: "blob"}); idle(); saveFile(base + "-stranky.zip", blob); }
  catch (e) { idle(); console.error(e); toast("Rozdělení se nepodařilo."); } };

$$("[data-pick]").forEach(b => b.addEventListener("click", () => $(b.dataset.pick === "imgs" ? "#fileImgs" : "#fileAny").click()));
$("#fileAny").onchange = e => { handleFiles(e.target.files); e.target.value = ""; };
$("#fileImgs").onchange = async e => { const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  busy("Vytvářím PDF z obrázků…");
  try { const b = await imagesToPdf(files, $('input[name="imgMode"]:checked').value); if (b) { const n = await addPdfBytes(b, files.length === 1 ? files[0].name : "Obrázky"); idle(); renderAll();
      toast(`Přidáno: ${pagesWord(n)}.`, {action: "Zobrazit stránky", onAction: () => setTab("pages")}); } else idle(); }
  catch (err) { idle(); console.error(err); toast("PDF z obrázků se nepodařilo vytvořit."); } };
let dragDepth = 0;
const isFileDrag = e => [...(e.dataTransfer?.types || [])].includes("Files");
document.addEventListener("dragenter", e => { if (isFileDrag(e)) { dragDepth++; document.body.classList.add("dragging"); } });
document.addEventListener("dragleave", e => { if (isFileDrag(e) && --dragDepth <= 0) { dragDepth = 0; document.body.classList.remove("dragging"); } });
document.addEventListener("dragover", e => { if (isFileDrag(e)) e.preventDefault(); });
document.addEventListener("drop", e => { if (!isFileDrag(e)) return; e.preventDefault(); dragDepth = 0; document.body.classList.remove("dragging"); handleFiles(e.dataTransfer.files); });

function setTab(t) {
  S.tab = t; $$(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  $$("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== t); $$("[data-ws]").forEach(w => w.hidden = w.dataset.ws !== t);
  renderAll(); if (t === "insert") renderProps();
}
$$(".tab").forEach(b => b.onclick = () => setTab(b.dataset.tab));

/* ---------- editor stránky ---------- */
const E = {token: 0, zoom: "width"};   // "width" | "page" | číslo v %
const UNIT = 96 / 72;                    // 100 % = skutečná velikost papíru
const ZOOM_STEPS = [25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500, 600, 800];
function openEditor(i) { S.cur = i; S.selAnno = null; setTab("insert"); }
async function renderEditor() {
  const stage = $("#stage"), has = S.pages.length > 0; stage.hidden = !has; $("#zoombar").hidden = !has; $("#emptyInsert").hidden = has;
  if (!has) { E.p = null; $("#pgLabel").textContent = "Stránka –"; renderProps(); return; }
  S.cur = clamp(S.cur, 0, S.pages.length - 1);
  const p = S.pages[S.cur], src = S.sources.get(p.src), inf = src.info[p.idx], total = (inf.rot + p.rot) % 360;
  const [VW, VH] = total % 180 ? [inf.H, inf.W] : [inf.W, inf.H];
  const avail = Math.max(260, stage.clientWidth - 16);
  let scale;
  if (E.zoom === "width") scale = avail / VW;
  else if (E.zoom === "page") { const ah = Math.max(200, window.innerHeight - stage.getBoundingClientRect().top - 48); scale = Math.min(avail / VW, ah / VH); }
  else scale = E.zoom / 100 * UNIT;
  updateZoomUi(scale / UNIT * 100);
  Object.assign(E, {p, total, VW, VH, scale, W: inf.W, H: inf.H});
  const box = $("#pagebox"); box.style.width = VW * scale + "px"; box.style.height = VH * scale + "px";
  $("#pgLabel").textContent = `Stránka ${S.cur + 1} z ${S.pages.length}`; $("#prevPg").disabled = S.cur === 0; $("#nextPg").disabled = S.cur === S.pages.length - 1;
  await Promise.all([...new Set(p.annos.filter(a => a.type === "text").map(a => a.font))].map(ensureCssFont));
  drawAnnos(); renderProps();
  const token = ++E.token; if (E.task) { try { E.task.cancel(); } catch {} E.task = null; }
  try {
    let pg;
    if ((p.edits || []).length) {   // náhled s opravami textu = stejný výsledek jako při uložení
      const b = await buildPdf([p], {annos: false}); if (token !== E.token) return;
      E.preview?.destroy?.(); E.preview = await openPdfjs(b); pg = await E.preview.getPage(1);
    } else pg = await src.pdf.getPage(p.idx + 1);
    if (token !== E.token) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), rs = Math.min(scale * dpr, Math.sqrt(25e6 / (VW * VH)));   // strop kvůli paměti
    const vp = pg.getViewport({scale: rs, rotation: total}), cv = $("#pagecanvas");
    cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height); const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height);
    E.task = pg.render({canvasContext: x, viewport: vp}); await E.task.promise;
  } catch (e) { if (e?.name !== "RenderingCancelledException") console.warn(e); }
  if (S.editMode && token === E.token) drawLineBoxes();
}
function drawAnnos() {
  const layer = $("#annolayer"); $$(".anno", layer).forEach(x => x.remove()); if (!S.editMode) $$(".lbox", layer).forEach(x => x.remove());
  const {p, total, scale, W, H} = E; if (!p) return;
  layer.classList.toggle("editing", S.editMode);
  for (const a of p.annos) {
    const el = document.createElement("div"); el.className = "anno" + (a.id === S.selAnno ? " sel" : ""); el.dataset.id = a.id;
    if (a.type === "text") { el.textContent = a.text || " "; Object.assign(el.style, {fontSize: a.size * scale + "px", color: a.color, fontWeight: a.bold ? 700 : 400,
      fontStyle: a.italic ? "italic" : "normal", textDecoration: a.underline ? "underline" : "none", fontFamily: fontCss(a.font)}); }
    else { const im = document.createElement("img"); im.src = a.src; im.alt = ""; el.appendChild(im); }
    if (a.rot === total) {
      el.style.left = a.fx * 100 + "%"; el.style.top = a.fy * 100 + "%";
      if (a.type === "image") { el.style.width = a.fw * 100 + "%"; el.style.height = a.fh * 100 + "%"; }
      if (a.id === S.selAnno) { const d = document.createElement("button"); d.className = "del"; d.setAttribute("aria-label", "Odstranit");
        d.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'; el.appendChild(d);
        if (a.type === "image") { const r = document.createElement("span"); r.className = "rz"; el.appendChild(r); } }
    } else {
      const [aVW, aVH] = a.rot % 180 ? [H, W] : [W, H], ut = visToUT(a.fx * aVW, a.fy * aVH, a.rot, W, H), v = utToVis(ut.u, ut.t, total, W, H);
      el.classList.add("locked"); el.style.left = v.x * scale + "px"; el.style.top = v.y * scale + "px"; el.style.transformOrigin = "0 0"; el.style.transform = `rotate(${(total - a.rot + 360) % 360}deg)`;
      if (a.type === "image") { el.style.width = a.fw * aVW * scale + "px"; el.style.height = a.fh * aVH * scale + "px"; }
    }
    layer.appendChild(el);
  }
}
const curAnno = () => E.p?.annos.find(a => a.id === S.selAnno);
function addAnno(a) { if (!E.p) return; pushUndo(); a.id = uid(); a.rot = E.total; E.p.annos.push(a); S.selAnno = a.id; if (S.editMode) setEditMode(false); drawAnnos(); renderProps(); }
function removeAnno(id) { if (!E.p) return; pushUndo(); E.p.annos = E.p.annos.filter(a => a.id !== id); S.selAnno = null; drawAnnos(); renderProps(); }
async function addTextAnno(text) { const d = S.textDefaults; await ensureCssFont(d.font);
  addAnno({type: "text", fx: .12, fy: .12 + (E.p.annos.length % 6) * .05, text, ...d}); setTimeout(() => $("#pText")?.select(), 0); }
function addImageAnno(src, pw, ph, fw) { const ar = (ph / pw) * (E.VW / E.VH); let w = fw, h = w * ar; if (h > .6) { h = .6; w = h / ar; }
  addAnno({type: "image", src, fx: (1 - w) / 2, fy: (1 - h) / 2, fw: w, fh: h, ar}); }
const layer = $("#annolayer");
layer.addEventListener("pointerdown", e => {
  if (S.editMode) return;
  const el = e.target.closest(".anno");
  if (!el) { if (S.selAnno) { S.selAnno = null; drawAnnos(); renderProps(); } return; }
  const a = E.p.annos.find(x => x.id === el.dataset.id); if (!a) return;
  e.preventDefault();
  if (e.target.closest(".del")) { removeAnno(a.id); return; }
  const resize = !!e.target.closest(".rz");
  if (S.selAnno !== a.id) { S.selAnno = a.id; drawAnnos(); renderProps(); }
  const t = $(`.anno[data-id="${a.id}"]`, layer), pw = E.VW * E.scale, ph = E.VH * E.scale, sx = e.clientX, sy = e.clientY, o = {...a}; let moved = false;
  const mv = ev => { const dx = (ev.clientX - sx) / pw, dy = (ev.clientY - sy) / ph; if (!moved) { pushUndo(); moved = true; }
    if (resize) { a.fw = clamp(o.fw + dx, .03, 1.2); a.fh = a.fw * a.ar; t.style.width = a.fw * 100 + "%"; t.style.height = a.fh * 100 + "%"; }
    else { a.fx = clamp(o.fx + dx, -.1, .97); a.fy = clamp(o.fy + dy, -.05, .98); t.style.left = a.fx * 100 + "%"; t.style.top = a.fy * 100 + "%"; } };
  const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); if (resize) renderProps(); };
  addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
});
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && S.pages.length) { e.preventDefault(); printDoc(); return; }
  if (S.tab !== "insert" || !S.selAnno || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || $("dialog[open]")) return;
  const a = curAnno(); if (!a || a.rot !== E.total) return; const st = e.shiftKey ? .02 : .004;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeAnno(a.id); }
  else if (e.key.startsWith("Arrow")) { e.preventDefault(); if (e.key === "ArrowLeft") a.fx -= st; if (e.key === "ArrowRight") a.fx += st; if (e.key === "ArrowUp") a.fy -= st; if (e.key === "ArrowDown") a.fy += st; drawAnnos(); }
});
const TEXT_COLORS = [["#1E1B2E", "Černá"], ["#1F3A8A", "Modrá"], ["#2B6CB0", "Světle modrá"], ["#B3261E", "Červená"], ["#2F6B4F", "Zelená"]];
function swatches(host, colors, value, onPick) {
  host.innerHTML = ""; for (const [c, n] of colors) { const b = document.createElement("button"); b.className = "sw"; b.type = "button"; b.style.background = c; b.setAttribute("role", "radio"); b.setAttribute("aria-label", n); b.title = n;
    b.setAttribute("aria-checked", c.toLowerCase() === (value || "").toLowerCase()); b.onclick = () => { $$(".sw", host).forEach(x => x.setAttribute("aria-checked", x === b)); onPick(c); }; host.appendChild(b); }
}
function renderProps() {
  const box = $("#props"), a = curAnno();
  if (!a) { box.innerHTML = '<h2>Úpravy</h2><p class="hint">Klikněte na vložený prvek na stránce a tady ho upravíte.</p>'; return; }
  if (a.rot !== E.total) { box.innerHTML = '<h2>Úpravy</h2><p class="hint">Tento prvek byl vložen před otočením stránky.</p>'; return; }
  if (a.type === "text") {
    box.innerHTML = `<h2>Upravit text</h2><label class="field"><span>Text</span><textarea id="pText" rows="3"></textarea></label>
      <label class="field"><span>Písmo</span><select id="pFont"></select></label>
      <div class="row"><label class="field" style="max-width:100px"><span>Velikost</span><input id="pSize" type="number" min="5" max="120" step="1"></label>
      <div class="styleb"><button type="button" data-st="bold" aria-label="Tučně" title="Tučně"><b>B</b></button><button type="button" data-st="italic" aria-label="Kurzíva" title="Kurzíva"><i>I</i></button><button type="button" data-st="underline" aria-label="Podtržení" title="Podtržení"><u>U</u></button></div></div>
      <div class="swatches" role="radiogroup" aria-label="Barva textu" id="pColors"></div>
      <button class="btn danger" id="pDel">Odstranit text</button>`;
    const set = async ch => { Object.assign(a, ch); Object.assign(S.textDefaults, ch); if (ch.font) await ensureCssFont(ch.font); drawAnnos(); };
    const ta = $("#pText"); ta.value = a.text; ta.oninput = () => { a.text = ta.value; drawAnnos(); };
    const fs = $("#pFont"); fillFontSelect(fs, a.font); fs.onchange = () => set({font: fs.value});
    const sz = $("#pSize"); sz.value = a.size; sz.oninput = () => { const v = +sz.value; if (v >= 4 && v <= 120) set({size: v}); };
    $$("[data-st]", box).forEach(b => { b.setAttribute("aria-pressed", !!a[b.dataset.st]); b.onclick = () => { const v = !a[b.dataset.st]; b.setAttribute("aria-pressed", v); set({[b.dataset.st]: v}); }; });
    swatches($("#pColors"), TEXT_COLORS, a.color, c => set({color: c}));
    const cp = document.createElement("input"); cp.type = "color"; cp.className = "colorpick"; cp.value = a.color; cp.title = "Jiná barva"; cp.setAttribute("aria-label", "Jiná barva");
    cp.oninput = () => { $$(".sw", box).forEach(x => x.setAttribute("aria-checked", false)); set({color: cp.value}); }; $("#pColors").appendChild(cp);
  } else {
    box.innerHTML = `<h2>Upravit obrázek</h2><label class="field"><span>Šířka</span><input id="pW" type="range" min="3" max="100" step="1"></label><button class="btn danger" id="pDel">Odstranit obrázek</button>`;
    const r = $("#pW"); r.value = Math.round(a.fw * 100); r.oninput = () => { a.fw = r.value / 100; a.fh = a.fw * a.ar; drawAnnos(); };
  }
  $("#pDel").onclick = () => removeAnno(a.id);
}
$("#prevPg").onclick = () => { S.cur--; S.selAnno = null; renderEditor(); };
$("#nextPg").onclick = () => { S.cur++; S.selAnno = null; renderEditor(); };
$("#addText").onclick = () => addTextAnno("Text");
$("#addDate").onclick = () => addTextAnno(today());
$("#addImg").onclick = () => $("#fileImgAnno").click();
$("#fileImgAnno").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { const c = toCanvas(await loadImage(f), 1600, false); addImageAnno(c.toDataURL("image/png"), c.width, c.height, .3); } catch { toast("Obrázek se nepodařilo načíst."); } };
let rT; new ResizeObserver(() => { if (S.tab !== "insert" || !E.p) return; clearTimeout(rT); rT = setTimeout(renderEditor, 150); }).observe($("#stage"));
$$("dialog [data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

/* ---------- přiblížení ---------- */
function updateZoomUi(pct) {
  E.pct = pct; const sel = $("#zSel"), r = Math.round(pct);
  sel.innerHTML = ""; const vals = [...new Set([50, 75, 100, 125, 150, 200, 300, 400, r])].sort((a, b) => a - b);
  for (const v of vals) { const o = document.createElement("option"); o.value = v; o.textContent = `${v} %`; sel.appendChild(o); }
  sel.value = r; $("#zFitW").setAttribute("aria-pressed", E.zoom === "width"); $("#zFitP").setAttribute("aria-pressed", E.zoom === "page");
}
function setZoom(z, anchor) {
  const st = $("#stage"), before = $("#pagebox").getBoundingClientRect();
  E.zoom = typeof z === "number" ? clamp(z, 10, 800) : z;
  renderEditor();
  if (anchor) {   // bod pod myší zůstane na místě
    const after = $("#pagebox").getBoundingClientRect(), fx = (anchor.x - before.left) / before.width, fy = (anchor.y - before.top) / before.height;
    st.scrollLeft += after.left + fx * after.width - anchor.x; st.scrollTop += after.top + fy * after.height - anchor.y;
  }
}
function stepZoom(dir) { const cur = E.pct || 100;
  setZoom(dir > 0 ? (ZOOM_STEPS.find(z => z > cur * 1.02) ?? 800) : ([...ZOOM_STEPS].reverse().find(z => z < cur / 1.02) ?? 25)); }
$("#zIn").onclick = () => stepZoom(1);
$("#zOut").onclick = () => stepZoom(-1);
$("#zFitW").onclick = () => setZoom("width");
$("#zFitP").onclick = () => setZoom("page");
$("#zSel").onchange = e => setZoom(+e.target.value);
$("#stage").addEventListener("wheel", e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  setZoom((E.pct || 100) * Math.exp(-clamp(e.deltaY, -100, 100) * .002), {x: e.clientX, y: e.clientY});
}, {passive: false});
document.addEventListener("keydown", e => {
  if (S.tab !== "insert" || !S.pages.length || !(e.ctrlKey || e.metaKey) || $("dialog[open]")) return;
  if (e.key === "+" || e.key === "=") { e.preventDefault(); stepZoom(1); }
  else if (e.key === "-") { e.preventDefault(); stepZoom(-1); }
  else if (e.key === "0") { e.preventDefault(); setZoom("width"); }
});

/* ---------- oprava existujícího textu ---------- */
function setEditMode(on) {
  S.editMode = on; const b = $("#editMode"); b.setAttribute("aria-pressed", on); b.textContent = on ? "Ukončit úpravu textu" : "Upravit existující text";
  $("#editHint").textContent = on ? "Klikněte na řádek, který chcete opravit. Opravené řádky jsou zeleně." : "Po zapnutí klikněte na řádek textu, který chcete opravit.";
  if (on) S.selAnno = null;
  renderEditor();
}
$("#editMode").onclick = () => setEditMode(!S.editMode);
const DIRS = {0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1]};
async function pageLines(p) {
  const src = S.sources.get(p.src), key = `${p.src}:${p.idx}:${src.ver}`;
  if (lineCache.has(key)) return lineCache.get(key);
  const pg = await src.pdf.getPage(p.idx + 1);
  try { await pg.getOperatorList(); } catch {}
  const tc = await pg.getTextContent(), items = [];
  for (const it of tc.items) {
    if (!it.str) continue;
    const [a, b, , , e, f] = it.transform, size = Math.hypot(a, b); if (!size) continue;
    const ang = ((Math.round(Math.atan2(b, a) * 180 / Math.PI) % 360) + 360) % 360; if (ang % 90) continue;
    let fname = ""; try { if (pg.commonObjs.has(it.fontName)) fname = pg.commonObjs.get(it.fontName)?.name || ""; } catch {}
    const [dx, dy] = DIRS[ang];
    items.push({str: it.str, e, f, size, ang, w: it.width, fname, generic: (tc.styles[it.fontName] || {}).fontFamily || "", s: e * dx + f * dy, t: -e * dy + f * dx});
  }
  items.sort((A, B) => A.ang - B.ang || B.t - A.t || A.s - B.s);
  const lines = []; let cur = null;
  for (const it of items) {
    if (cur && cur.ang === it.ang && Math.abs(cur.t - it.t) < cur.size * .3 && it.s - cur.sEnd < cur.size * 1.2 && it.s >= cur.sEnd - cur.size * .5) {
      if (it.s - cur.sEnd > cur.size * .15 && !cur.str.endsWith(" ") && !it.str.startsWith(" ")) cur.str += " ";
      cur.str += it.str; cur.sEnd = Math.max(cur.sEnd, it.s + it.w); cur.size = Math.max(cur.size, it.size);
    } else { cur = {...it, sStart: it.s, sEnd: it.s + it.w}; lines.push(cur); }
  }
  const out = [];
  for (const l of lines) {
    if (!l.str.trim()) continue;
    const [dx, dy] = DIRS[l.ang], nx = -dy, ny = dx, w = l.sEnd - l.sStart, s = l.size, pts = [];
    for (const k of [0, w]) for (const h of [-.28 * s, .92 * s]) pts.push([l.e + dx * k + nx * h, l.f + dy * k + ny * h]);
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const fm = mapPdfFont(l.fname, l.generic);
    out.push({key: `${l.ang}:${l.t.toFixed(1)}:${l.sStart.toFixed(1)}`, text: l.str.trim(), origin: [l.e, l.f], angle: l.ang, size: Math.round(s * 10) / 10, width: w,
      rect: [Math.min(...xs) - .5, Math.min(...ys) - .5, Math.max(...xs) + .5, Math.max(...ys) + .5], font: fm.id, bold: fm.bold, italic: fm.italic, fontName: fm.name});
  }
  lineCache.set(key, out); return out;
}
async function drawLineBoxes() {
  const layer = $("#annolayer"); $$(".lbox", layer).forEach(x => x.remove());
  const p = E.p; if (!p) return;
  const src = S.sources.get(p.src), pg = await src.pdf.getPage(p.idx + 1), vp = pg.getViewport({scale: 1, rotation: E.total});
  const lines = await pageLines(p), done = new Set((p.edits || []).map(e => e.line.key));
  if (!lines.length) toast("Na této stránce není text k úpravě – je to nejspíš sken. Opravu vložte tlačítkem Text.", {ms: 8000});
  for (const l of lines) {
    const [x0, y0, x1, y1] = l.rect, a = vp.convertToViewportPoint(x0, y0), b = vp.convertToViewportPoint(x1, y1);
    const el = document.createElement("div"); el.className = "lbox" + (done.has(l.key) ? " done" : ""); el.title = "Kliknutím opravíte tento řádek";
    Object.assign(el.style, {left: Math.min(a[0], b[0]) / vp.width * 100 + "%", top: Math.min(a[1], b[1]) / vp.height * 100 + "%",
      width: Math.abs(b[0] - a[0]) / vp.width * 100 + "%", height: Math.abs(b[1] - a[1]) / vp.height * 100 + "%"});
    el.onclick = () => openEditDialog(l, el);
    layer.appendChild(el);
  }
}
function sampleColors(el) {   // barva pozadí a textu z vykreslené stránky
  const cv = $("#pagecanvas"), box = $("#pagebox").getBoundingClientRect(), r = el.getBoundingClientRect(), k = cv.width / box.width;
  const x0 = Math.max(0, Math.floor((r.left - box.left) * k) - 3), y0 = Math.max(0, Math.floor((r.top - box.top) * k) - 3);
  const w = Math.min(cv.width - x0, Math.ceil(r.width * k) + 6), h = Math.min(cv.height - y0, Math.ceil(r.height * k) + 6);
  if (w < 3 || h < 3) return {bg: "#ffffff", fg: "#000000"};
  const d = cv.getContext("2d").getImageData(x0, y0, w, h).data, px = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const ring = []; for (let x = 0; x < w; x++) ring.push(px(x, 0), px(x, h - 1)); for (let y = 0; y < h; y++) ring.push(px(0, y), px(w - 1, y));
  const avg = i => ring.reduce((s, c) => s + c[i], 0) / ring.length, bg = [avg(0), avg(1), avg(2)];
  let best = null, bd = 0; for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) { const c = px(x, y), dd = Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]); if (dd > bd) { bd = dd; best = c; } }
  return {bg: toHex(...bg), fg: best && bd > 60 ? toHex(...best) : "#000000"};
}
let edLine = null, edEl = null;
async function openEditDialog(line, el) {
  const p = E.p, cur = (p.edits || []).find(e => e.line.key === line.key); edLine = line; edEl = el;
  if (!line.bg) { const c = sampleColors(el); line.bg = c.bg; line.fg = c.fg; }
  $("#edOrig").textContent = line.text; $("#edText").value = cur ? cur.text : line.text;
  fillFontSelect($("#edFont"), cur ? cur.font : line.font); $("#edSize").value = cur ? cur.size : line.size;
  $("#edB").setAttribute("aria-pressed", cur ? cur.bold : line.bold); $("#edI").setAttribute("aria-pressed", cur ? cur.italic : line.italic);
  $("#edColor").value = cur ? cur.color : line.fg; $("#edRestore").hidden = !cur;
  $("#dlgEdit").showModal(); $("#edText").select();
}
["#edB", "#edI"].forEach(id => $(id).onclick = e => { const b = e.currentTarget; b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"); });
async function commitEdit(mode) {
  const p = E.p, line = edLine; if (!p || !line) return;
  const rest = (p.edits || []).filter(e => e.line.key !== line.key);
  pushUndo();
  if (mode !== "restore") {
    const text = mode === "delete" ? "" : $("#edText").value, font = $("#edFont").value, bold = $("#edB").getAttribute("aria-pressed") === "true", italic = $("#edI").getAttribute("aria-pressed") === "true";
    let size = +$("#edSize").value || line.size;
    try { if ($("#edFit").checked && text.trim()) { const w = await measureText(text, size, font, bold, italic); if (w > line.width && line.width > 0) size = Math.max(4, Math.round(size * line.width / w * 100) / 100); } }
    catch (e) { console.warn(e); }
    rest.push({line: {...line}, text, size, font, bold, italic, color: $("#edColor").value});
  }
  p.edits = rest; $("#dlgEdit").close(); renderEditor();
}
$("#edOk").onclick = () => commitEdit("ok");
$("#edDel").onclick = () => commitEdit("delete");
$("#edRestore").onclick = () => commitEdit("restore");
$("#edText").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commitEdit("ok"); } });

/* ---------- podpis (kreslení) ---------- */
const pad = $("#sigpad"); let sigColor = "#1F2A6B", drawing = false, last = null, sigDirty = false;
function initPad() { const r = pad.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 3); pad.width = Math.round(r.width * d); pad.height = Math.round(r.height * d);
  const x = pad.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); x.lineCap = "round"; x.lineJoin = "round"; x.lineWidth = 2.6; x.strokeStyle = sigColor; x.fillStyle = sigColor; sigDirty = false; }
const padPt = e => { const r = pad.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
pad.addEventListener("pointerdown", e => { e.preventDefault(); drawing = true; last = padPt(e); pad.setPointerCapture(e.pointerId); const x = pad.getContext("2d"); x.beginPath(); x.arc(last.x, last.y, 1.3, 0, 7); x.fill(); sigDirty = true; });
pad.addEventListener("pointermove", e => { if (!drawing) return; const p = padPt(e), x = pad.getContext("2d"); x.beginPath(); x.moveTo(last.x, last.y); x.lineTo(p.x, p.y); x.stroke(); last = p; });
const endDraw = () => { drawing = false; }; pad.addEventListener("pointerup", endDraw); pad.addEventListener("pointercancel", endDraw);
$("#sigClear").onclick = initPad;
swatches($("#sigColors"), [["#1F2A6B", "Modrá"], ["#1E1B2E", "Černá"]], sigColor, c => { sigColor = c; const x = pad.getContext("2d"); x.strokeStyle = c; x.fillStyle = c; });
function trimCanvas(src) {
  const x = src.getContext("2d"), {width: w, height: h} = src, d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 20) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) return null; const m = 6; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const c = document.createElement("canvas"); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1; c.getContext("2d").drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height); return c;
}
$("#sigOk").onclick = () => {
  if (!sigDirty) { toast("Nejdřív se do pole podepište."); return; }
  const c = trimCanvas(pad); if (!c) return; const url = c.toDataURL("image/png");
  if ($("#sigKeep").checked) addMark("podpisy", $("#sigName").value.trim() || "Podpis", url);
  $("#dlgSig").close(); $("#dlgMarks").close(); addImageAnno(url, c.width, c.height, .26);
};

/* ---------- razítko (vytvoření) ---------- */
const STAMP_COLORS = [["#B3261E", "Červená"], ["#1F3A8A", "Modrá"], ["#2B6CB0", "Světle modrá"]]; let stColor = STAMP_COLORS[0][0];
function makeStamp(t1, t2, color) {
  const c = document.createElement("canvas"), x = c.getContext("2d"), f1 = `700 72px ${fontCss(DEFAULT_FONT)}`, f2 = `700 38px ${fontCss(DEFAULT_FONT)}`;
  x.font = f1; const w1 = x.measureText(t1).width; x.font = f2; const w2 = t2 ? x.measureText(t2).width : 0, p = 40;
  c.width = Math.ceil(Math.max(w1, w2, 120) + p * 2); c.height = t2 ? 72 + 38 + p * 2 + 16 : 72 + p * 2;
  const rr = (X, Y, W, H, R) => { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); x.stroke(); };
  x.globalAlpha = .9; x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 7; rr(5, 5, c.width - 10, c.height - 10, 20); x.lineWidth = 2.5; rr(17, 17, c.width - 34, c.height - 34, 12);
  x.textAlign = "center"; x.font = f1; x.fillText(t1, c.width / 2, p + 62); if (t2) { x.font = f2; x.fillText(t2, c.width / 2, p + 72 + 16 + 30); }
  return c;
}
function stampPreview() { const c = makeStamp($("#stText").value.trim() || "RAZÍTKO", $("#stText2").value.trim(), stColor), pv = $("#stampPreview"); pv.width = c.width; pv.height = c.height; pv.getContext("2d").drawImage(c, 0, 0); }
swatches($("#stColors"), STAMP_COLORS, stColor, c => { stColor = c; stampPreview(); });
$("#stText").oninput = stampPreview; $("#stText2").oninput = stampPreview;
$("#stOk").onclick = () => { const t1 = $("#stText").value.trim(); if (!t1) { toast("Napište text razítka."); return; }
  const c = makeStamp(t1, $("#stText2").value.trim(), stColor), url = c.toDataURL("image/png");
  if ($("#stKeep").checked) addMark("razitka", t1, url);
  $("#dlgStamp").close(); $("#dlgMarks").close(); addImageAnno(url, c.width, c.height, .3); };

/* ---------- uložené podpisy a razítka + sken ---------- */
const MK = {
  podpisy: {title: "Podpisy", one: "podpis", saved: "uložený", none: "žádný uložený", newBtn: "Nakreslit podpis…", frac: .26},
  razitka: {title: "Razítka", one: "razítko", saved: "uložené", none: "žádné uložené", newBtn: "Vytvořit razítko…", frac: .3},
};
const marksLoad = kind => { try { return JSON.parse(localStorage.getItem("andypdf:" + kind) || "[]"); } catch { return []; } };
function marksStore(kind, list) { try { localStorage.setItem("andypdf:" + kind, JSON.stringify(list)); return true; } catch { toast("Úložiště prohlížeče je plné – smažte některé uložené položky.", {ms: 8000}); return false; } }
function addMark(kind, name, src) { const l = marksLoad(kind); l.unshift({id: uid(), name, src}); marksStore(kind, l); }
let mkKind = "podpisy", mkSel = null;
function openMarks(kind) {
  mkKind = kind; const k = MK[kind]; $("#dmT").textContent = k.title; $("#mkNew").textContent = k.newBtn; $("#mkUse").textContent = `Vložit ${k.one}`;
  renderMarks(); $("#dlgMarks").showModal();
}
function renderMarks() {
  const k = MK[mkKind], list = marksLoad(mkKind), host = $("#marksList"); host.innerHTML = "";
  if (!list.some(m => m.id === mkSel)) mkSel = list[0]?.id || null;
  for (const m of list) {
    const it = document.createElement("div"); it.className = "markitem"; it.setAttribute("role", "option"); it.tabIndex = 0; it.setAttribute("aria-selected", m.id === mkSel);
    it.innerHTML = '<div class="checker"><img alt=""></div><span></span>'; $("img", it).src = m.src; $("span", it).textContent = m.name;
    it.onclick = () => { mkSel = m.id; renderMarks(); }; it.ondblclick = () => { mkSel = m.id; useMark(); };
    it.onkeydown = e => { if (e.key === "Enter") { mkSel = m.id; useMark(); } };
    host.appendChild(it);
  }
  $("#marksInfo").textContent = list.length ? `Vyberte ${k.saved} ${k.one} a klikněte na Vložit (dvojklik vloží hned).`
    : `Zatím tu není ${k.none} ${k.one}. Nahrajte sken nebo fotku (JPG, PNG nebo PDF) – bílé pozadí se odstraní a ${k.one} se uloží v tomto prohlížeči.`;
  ["#mkUse", "#mkRename", "#mkDel"].forEach(id => $(id).disabled = !mkSel);
}
async function useMark() { const m = marksLoad(mkKind).find(x => x.id === mkSel); if (!m) return; const im = await urlImage(m.src); $("#dlgMarks").close(); addImageAnno(m.src, im.width, im.height, MK[mkKind].frac); }
$("#mkUse").onclick = useMark;
$("#mkRename").onclick = () => { const l = marksLoad(mkKind), m = l.find(x => x.id === mkSel); if (!m) return; const n = prompt("Nový název:", m.name); if (n && n.trim()) { m.name = n.trim(); marksStore(mkKind, l); renderMarks(); } };
$("#mkDel").onclick = () => { const l = marksLoad(mkKind), m = l.find(x => x.id === mkSel); if (!m) return; if (confirm(`Smazat „${m.name}“?`)) { marksStore(mkKind, l.filter(x => x.id !== mkSel)); renderMarks(); } };
$("#mkNew").onclick = async () => { if (mkKind === "podpisy") { $("#dlgSig").showModal(); requestAnimationFrame(initPad); }
  else { await ensureCssFont(DEFAULT_FONT); if (!$("#stText2").value) $("#stText2").value = today(); $("#dlgStamp").showModal(); stampPreview(); } };
$("#addSig").onclick = () => openMarks("podpisy");
$("#addStamp").onclick = () => openMarks("razitka");
$("#mkScan").onclick = () => $("#fileScan").click();
let scanSrc = null, scanOut = null;
$("#fileScan").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      const pdf = await openPdfjs(new Uint8Array(await f.arrayBuffer())), pg = await pdf.getPage(1), vp = pg.getViewport({scale: 2.5});
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
      await pg.render({canvasContext: x, viewport: vp}).promise; scanSrc = toCanvas(c, 2400, false);
    } else scanSrc = toCanvas(await loadImage(f), 2400, false);
  } catch (err) { console.warn(err); toast("Soubor se nepodařilo načíst."); return; }
  $("#dcT").textContent = `${MK[mkKind].one[0].toUpperCase() + MK[mkKind].one.slice(1)} ze skenu`;
  $("#scanName").value = baseName(f.name); $("#scanOk").textContent = `Vložit ${MK[mkKind].one}`;
  refreshScan(); $("#dlgScan").showModal();
};
function cleanScan(src, remove, sens) {
  const w = src.width, h = src.height, d = src.getContext("2d").getImageData(0, 0, w, h), a = d.data;
  if (remove) {
    const hi = 248 - sens * .7, lo = hi - 70;
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], g = a[i + 1], b = a[i + 2], lum = r * .299 + g * .587 + b * .114, sat = Math.max(r, g, b) - Math.min(r, g, b);
      const al = Math.max(clamp((hi - lum) / (hi - lo), 0, 1), clamp((sat - 35) / 60, 0, 1)), st = Math.max(al, .35);
      a[i] = clamp(255 - (255 - r) / st, 0, 255); a[i + 1] = clamp(255 - (255 - g) / st, 0, 255); a[i + 2] = clamp(255 - (255 - b) / st, 0, 255); a[i + 3] = al * a[i + 3];
    }
  }
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").putImageData(d, 0, 0);
  return toCanvas(trimCanvas(c) || c, 1400, false);
}
let scanT;
function refreshScan() { if (!scanSrc) return; const small = toCanvas(scanSrc, 1400, false); scanOut = cleanScan(small, $("#scanRemove").checked, +$("#scanSens").value);
  const pv = $("#scanCanvas"); pv.width = scanOut.width; pv.height = scanOut.height; const x = pv.getContext("2d"); x.clearRect(0, 0, pv.width, pv.height); x.drawImage(scanOut, 0, 0); }
$("#scanSens").oninput = () => { clearTimeout(scanT); scanT = setTimeout(refreshScan, 120); };
$("#scanRemove").onchange = () => { $("#scanSens").disabled = !$("#scanRemove").checked; refreshScan(); };
$("#scanOk").onclick = () => { if (!scanOut) return; const url = scanOut.toDataURL("image/png");
  if ($("#scanKeep").checked) addMark(mkKind, $("#scanName").value.trim() || MK[mkKind].one, url);
  $("#dlgScan").close(); $("#dlgMarks").close(); addImageAnno(url, scanOut.width, scanOut.height, MK[mkKind].frac); };

/* ---------- uložení ---------- */
$("#saveBtn").onclick = () => { $("#saveName").value = defaultName(); const n = S.pages.reduce((s, p) => s + p.annos.length + (p.edits || []).length, 0);
  $("#saveInfo").textContent = `Uloží se ${pagesWord(S.pages.length)}` + (n ? ` a ${n} ${plural(n, "úprava", "úpravy", "úprav")}.` : "."); $("#dlgSave").showModal(); };
$("#saveGo").onclick = async () => { const name = pdfName($("#saveName").value); $("#dlgSave").close(); busy("Připravuji PDF…");
  try { const b = await buildPdf(S.pages, {numbers: $("#numbers").checked}); idle(); saveFile(name, b); } catch (e) { idle(); console.error(e); toast("PDF se nepodařilo vytvořit."); } };
$("#printBtn").onclick = printDoc;

/* ---------- formuláře ---------- */
function describeField(f) { const name = f.getName(); try {
  if (f instanceof PDFTextField) return {name, kind: "text", value: f.getText() || "", multi: f.isMultiline()};
  if (f instanceof PDFCheckBox) return {name, kind: "check", value: f.isChecked()};
  if (f instanceof PDFDropdown || f instanceof PDFOptionList) return {name, kind: "select", options: f.getOptions(), value: f.getSelected()[0] || ""};
  if (f instanceof PDFRadioGroup) return {name, kind: "radio", options: f.getOptions(), value: f.getSelected() || ""};
} catch (e) { console.warn(e); } return null; }
const prettyName = n => n.replace(/\[\d+\]/g, "").replace(/^.*\.(?=[^.]+$)/, "").replace(/_+/g, " ").trim() || n;
async function renderForm() {
  const area = $("#formArea"), live = new Set(S.pages.map(p => p.src));
  for (const s of S.sources.values()) { if (s.form !== undefined || !live.has(s.id)) continue; try { s.form = (await getLib(s)).getForm().getFields().map(describeField).filter(Boolean); } catch (e) { s.form = []; } }
  if (S.tab !== "form") return;
  const withForm = [...S.sources.values()].filter(s => live.has(s.id) && s.form?.length), sel = $("#formSrc");
  sel.innerHTML = ""; withForm.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
  $("#formSrcWrap").hidden = withForm.length < 2;
  if (!withForm.some(s => s.id === S.formSrc)) S.formSrc = withForm[0]?.id || null; sel.value = S.formSrc || "";
  $("#formApply").disabled = !S.formSrc; area.innerHTML = "";
  if (!S.formSrc) { const d = document.createElement("div"); d.className = "empty";
    d.innerHTML = S.pages.length ? '<h2>Žádná vyplnitelná pole</h2><p>Toto PDF nemá vyplnitelná pole. Text vložíte nebo opravíte v záložce Upravit a vložit.</p>' : '<h2>Zatím tu není žádný formulář</h2><p>Přidejte PDF formulář s poli k vyplnění.</p>';
    area.appendChild(d); return; }
  const s = S.sources.get(S.formSrc), card = document.createElement("div"); card.className = "formcard";
  const h = document.createElement("h2"); h.textContent = s.name; card.appendChild(h);
  s.form.forEach(fd => {
    const lab = document.createElement("label"); lab.className = "field"; const sp = document.createElement("span"); sp.textContent = prettyName(fd.name); sp.title = fd.name;
    if (fd.kind === "text") { lab.appendChild(sp); const inp = document.createElement(fd.multi ? "textarea" : "input"); if (fd.multi) lab.classList.add("full"); inp.value = fd.value; inp.oninput = () => fd.value = inp.value; lab.appendChild(inp); }
    else if (fd.kind === "check") { lab.className = "check"; lab.style.alignSelf = "end"; const c = document.createElement("input"); c.type = "checkbox"; c.checked = fd.value; c.onchange = () => fd.value = c.checked; lab.append(c, sp); }
    else if (fd.kind === "select") { lab.appendChild(sp); const se = document.createElement("select"); ["", ...fd.options].forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v || "–"; se.appendChild(o); }); se.value = fd.value; se.onchange = () => fd.value = se.value; lab.appendChild(se); }
    else { const fs = document.createElement("div"); fs.className = "field full"; fs.appendChild(sp); const rw = document.createElement("div"); rw.className = "radios"; const g = uid();
      fd.options.forEach(v => { const l = document.createElement("label"); l.className = "check"; const r = document.createElement("input"); r.type = "radio"; r.name = g; r.checked = fd.value === v; r.onchange = () => fd.value = v; l.append(r, document.createTextNode(" " + v)); rw.appendChild(l); });
      fs.appendChild(rw); card.appendChild(fs); return; }
    card.appendChild(lab);
  });
  area.appendChild(card);
}
$("#formSrc").onchange = e => { S.formSrc = e.target.value; renderForm(); };
$("#formApply").onclick = async () => {
  const s = S.sources.get(S.formSrc); if (!s) return; busy("Vyplňuji formulář…"); const bad = [];
  try { const d = await PDFDocument.load(s.bytes, {ignoreEncryption: true}); d.registerFontkit(fontkit); const font = await d.embedFont(await fontBytes(DEFAULT_FONT, "R"), {subset: false}), form = d.getForm();
    for (const fd of s.form) { let f; try { f = form.getField(fd.name); } catch { continue; }
      try { if (fd.kind === "text") f.setText(fd.value); else if (fd.kind === "check") fd.value ? f.check() : f.uncheck(); else if (fd.value) f.select(fd.value); else f.clear?.(); } catch { bad.push(prettyName(fd.name)); } }
    form.updateFieldAppearances(font); if ($("#formFlatten").checked) form.flatten();
    const out = await d.save(), old = s.pdf; s.pdf = await openPdfjs(out); s.bytes = out; old.destroy(); s.lib = null; s.ver++; s.form = undefined;
    idle(); renderAll(); toast(bad.length ? `Vyplněno, ale tato pole nešla uložit: ${bad.join(", ")}.` : "Formulář je vyplněný. Uložte ho tlačítkem Uložit PDF.", {ms: 7000});
  } catch (e) { idle(); console.error(e); toast("Formulář se nepodařilo vyplnit.", {ms: 8000}); }
};

/* ---------- nové PDF z textu ---------- */
fillFontSelect($("#cFont"), DEFAULT_FONT);
async function makeTextPdf() {
  const title = $("#cTitle").value.trim(), body = $("#cBody").value;
  if (!title && !body.trim()) { toast("Nejdřív napište nadpis nebo text."); $("#cBody").focus(); return null; }
  return textToPdf({title, body, header: $("#cHeader").value.trim(), size: +$("#cSize").value, date: $("#cDate").checked, font: $("#cFont").value});
}
$("#cMake").onclick = async () => { busy("Vytvářím PDF…"); try { const b = await makeTextPdf(); if (!b) { idle(); return; } const n = await addPdfBytes(b, ($("#cTitle").value.trim() || "Text") + ".pdf"); idle(); renderAll();
  toast(`Přidáno: ${pagesWord(n)}.`, {action: "Zobrazit stránky", onAction: () => setTab("pages")}); } catch (e) { idle(); console.error(e); toast("PDF se nepodařilo vytvořit."); } };
$("#cMakeSave").onclick = async () => { busy("Vytvářím PDF…"); try { const b = await makeTextPdf(); idle(); if (b) saveFile(pdfName($("#cTitle").value.trim() || "dokument"), b); } catch (e) { idle(); console.error(e); toast("PDF se nepodařilo vytvořit."); } };

window.addEventListener("beforeunload", e => { if (S.pages.length) { e.preventDefault(); e.returnValue = ""; } });
ensureCssFont(DEFAULT_FONT);
renderAll();
