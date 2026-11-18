"use strict";
const D = window.__DATA__;
const Y = [2027, 2028, 2029, 2030];
const SC = ["pess", "real", "opt"];
const PH = ["prove", "partner", "sell", "scale"];
const KEY = "binus-roadmap-v2";
let P = D.products.slice();
let BY = {};
function refreshProducts() {
  const rem = S.removed || [];
  P = D.products.filter(p => rem.indexOf(p.slug) < 0).concat(S.custom || []);
  BY = {};
  D.products.concat(S.custom || []).forEach(p => { BY[p.slug] = p; });
}
const SRC = {};
D.sources.forEach((s, i) => { SRC[s.k] = { n: i + 1, t: s.t, u: s.u }; });

/* ---------------- state ---------------- */
function defState() {
  return { v: 2, lang: "en", scen: "real", hidden: [], gshift: 0, tl: {}, rev: {}, scores: {},
    w: { d: [1, 1, 1, 1, 1, 1], m: [1, 1, 1, 1, 1], split: 50 }, schemes: {}, addSchemes: [], fund: {}, links: {}, custom: [], removed: [], qtext: {}, facts: {} };
}
let S = defState();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) S = Object.assign(defState(), JSON.parse(raw));
} catch (e) { /* storage unavailable */ }
migrate();
function migrate() {
  if ((S.v || 2) < 3) { S.scores = {}; S.w = defState().w; S.v = 3; }
  S.facts = S.facts || {};
  S.simple = !!S.simple;
  if (!S.w || S.w.m.length !== 5 || S.w.d.length !== 6) S.w = defState().w;
}
refreshProducts();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

/* ---------------- text helpers ---------------- */
function T(k) { const u = D.ui[S.lang] || D.ui.en; return (k in u) ? u[k] : (D.ui.en[k] || k); }
function L(o) { if (o == null) return ""; if (typeof o === "string") return o; return o[S.lang] || o.en || ""; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function cite(s) {
  return esc(s).replace(/\[([a-z0-9]+)\]/g, (m, k) => {
    const x = SRC[k];
    if (!x) return m;
    return `<a class="cite" href="#/sources/${x.n}" data-tip="${esc("[" + x.n + "] " + x.t)}">[${x.n}]</a>`;
  });
}
function LC(o) { return cite(L(o)); }
function num(v, d) {
  const n = Number(v) || 0;
  return n.toLocaleString(S.lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
}
function rpj(v) { return "Rp" + num(Math.round(v)) + " " + (S.lang === "id" ? "juta" : "juta"); }
function rpBig(v) {
  if (Math.abs(v) >= 1000) return "Rp" + num(v / 1000, 2) + (S.lang === "id" ? " miliar" : " billion");
  return "Rp" + num(Math.round(v)) + (S.lang === "id" ? " juta" : " million");
}
function ql(q) {
  if (q == null) return T("not_before");
  if (q < 0) return T("before2027");
  if (q > 15) return T("after2030");
  return "Q" + (q % 4 + 1) + " " + (2027 + Math.floor(q / 4));
}
function short(p) { return L(p.short); }
function pathName(id) { const x = D.pathways.find(p => p.id === id); return x ? L(x.name) : id; }

/* ---------------- model ---------------- */
function isHidden(p) { return S.hidden.indexOf(p.slug) >= 0; }
function shown() { return P.filter(p => !isHidden(p)); }
function inP(slug) { return P.some(p => p.slug === slug); }
function goal(p, i) { const o = S.qtext[p.slug]; return o && o[i] != null ? o[i] : p.q[i]; }
function tl(p) {
  const o = S.tl[p.slug] || {};
  return {
    seg: o.seg || p.seg,
    gates: o.gates || p.gates,
    first: Object.assign({}, p.first, o.first || {}),
    qs: o.qs || 0,
    edited: !!S.tl[p.slug],
  };
}
function firstEff(p, sc) { const f = tl(p).first[sc]; return f == null ? null : f + S.gshift; }
function streams(p) {
  const o = S.rev[p.slug];
  if (!o) return p.streams;
  return p.streams.map((s, i) => {
    const x = o[i] || {};
    const r = Object.assign({}, s);
    if (x.price != null) r.price = x.price;
    if (x.rate != null) r.rate = x.rate;
    if (s.u) {
      r.u = {};
      SC.forEach(sc => { r.u[sc] = Object.assign({}, s.u[sc], (x.u && x.u[sc]) || {}); });
    }
    return r;
  });
}
function rawIncome(p, ds) {
  const st = streams(p);
  const out = Y.map(() => [0, 0]);
  Y.forEach((y, yi) => {
    st.forEach(s => {
      if (s.k === "u") {
        const n = +(s.u[ds][y] || 0);
        out[yi][0] += s.price * s.rate * n;
        if (s.r && s.rate < 1) out[yi][1] += s.price * n;
      } else {
        const ref = st[s.ref].u[ds];
        let cum = 0;
        Y.forEach(z => { if (s.incl ? z <= y : z < y) cum += +(ref[z] || 0); });
        out[yi][0] += s.price * s.rate * Math.floor(cum / s.per);
      }
    });
  });
  return out;
}
const _inc = {};
function incomeKey(p, sc) { return p.slug + "|" + sc; }
function clearCache() { for (const k in _inc) delete _inc[k]; }
function income(p, sc) {
  const key = incomeKey(p, sc);
  if (_inc[key]) return _inc[key];
  const zero = { y: Y.map(() => [0, 0]), tot: 0, ptot: 0, after: 0, first: null };
  const t = tl(p);
  const f = t.first[sc];
  if (f == null) return (_inc[key] = zero);
  let ds = sc, f0 = p.first[sc];
  if (f0 == null) {
    ds = p.first.opt != null ? "opt" : (p.first.real != null ? "real" : (p.first.pess != null ? "pess" : null));
    if (!ds) return (_inc[key] = Object.assign({}, zero, { first: f + S.gshift }));
    f0 = p.first[ds];
  }
  const d = f + S.gshift - f0;
  const raw = rawIncome(p, ds);
  const q = [];
  for (let i = 0; i < 16; i++) q.push([0, 0]);
  const fy0 = Math.floor(f0 / 4);
  raw.forEach((v, yi) => {
    const start = yi === fy0 ? f0 % 4 : 0;
    const n = 4 - start;
    for (let k = start; k < 4; k++) { q[yi * 4 + k][0] += v[0] / n; q[yi * 4 + k][1] += v[1] / n; }
  });
  const out = [];
  for (let i = 0; i < 16; i++) out.push([0, 0]);
  let after = 0;
  for (let i = 0; i < 16; i++) {
    const j = i + d;
    if (j >= 16) { after += q[i][0]; continue; }
    if (j < 0) continue;
    out[j][0] += q[i][0]; out[j][1] += q[i][1];
  }
  if (d < 0) for (let j = Math.max(0, 16 + d); j < 16; j++) { out[j][0] += q[15][0]; out[j][1] += q[15][1]; }
  const yv = Y.map((y, yi) => [0, 1, 2, 3].reduce((a, k) => [a[0] + out[yi * 4 + k][0], a[1] + out[yi * 4 + k][1]], [0, 0]));
  const tot = yv.reduce((a, v) => a + v[0], 0);
  const ptot = yv.reduce((a, v) => a + v[1], 0);
  return (_inc[key] = { y: yv, tot, ptot, after, first: f + S.gshift });
}
function earns(p, sc) { const f = firstEff(p, sc); return f != null && f <= 15 && income(p, sc).tot > 0.5; }

/* ---- facts, rubric scores and TKT ---- */
const IPL = { none: 1, claimed: 2, secret: 2, filed: 3, registered: 3, copyright: 3, granted: 4, granteddoc: 5 };
const PTL = { none: 1, candidate: 2, mou: 3, nego: 4, active: 5, agreement: 5 };
function facts(p) {
  const base = p.facts || { tkt: 4, src: "est", ev: [0, 0, 0, 0], ip: "none", partner: "none", reg: 3, m: [3, 3, 3, 3], mb: [] };
  const o = S.facts[p.slug] || {};
  const f = Object.assign({}, base, o);
  f.ev = (o.ev || base.ev).slice();
  f.m = (o.m || base.m).slice();
  f.cash = o.cash != null ? o.cash : (p.cash ? p.cash[1] : 0);
  f.edited = !!S.facts[p.slug];
  return f;
}
function tktNow(p) { return facts(p).tkt; }
function nOpps(p) { return (p.comps || []).filter(c => c.opp && !/^Benchmark/.test(c.opp.en)).length; }
function m5Level(p, f) {
  const engaged = PTL[f.partner] >= 3;
  const n = nOpps(p) + (engaged ? 1 : 0);
  if (n >= 4 && engaged) return 5;
  return n >= 3 ? 4 : n === 2 ? 3 : n === 1 ? 2 : 1;
}
function scores(p) {
  const f = facts(p), t = f.tkt;
  const cash = +f.cash || 0;
  const d = [t <= 3 ? 1 : t <= 5 ? 2 : t === 6 ? 3 : t === 7 ? 4 : 5,
    Math.min(5, 1 + f.ev.reduce((a, x) => a + (x ? 1 : 0), 0)),
    IPL[f.ip] || 1, PTL[f.partner] || 1, +f.reg || 3,
    cash <= 200 ? 5 : cash <= 400 ? 4 : cash <= 800 ? 3 : cash <= 1500 ? 2 : 1];
  const m = f.m.slice(0, 4).map(x => Math.min(5, Math.max(1, +x || 3))).concat([m5Level(p, f)]);
  return { d, m, f };
}
function tktStages(p) {
  const t = tl(p), now = tktNow(p), tgt = (D.tktTarget || {})[p.pathway] || [6, 8, 9, 9];
  const out = {}; let prev = now;
  PH.forEach((ph, i) => {
    const segs = t.seg.filter(s => s[2] === ph);
    if (!segs.length) return;
    const v = Math.max(prev, tgt[i], now);
    out[ph] = { tkt: v, start: Math.min(...segs.map(s => s[0])) + S.gshift, end: Math.max(...segs.map(s => s[1])) + S.gshift };
    prev = v;
  });
  return out;
}
function wavg(v, w) { let a = 0, b = 0; v.forEach((x, i) => { a += x * w[i]; b += w[i]; }); return b ? a / b : 0; }
function prio(p) {
  const s = scores(p);
  const dd = wavg(s.d, S.w.d), mm = wavg(s.m, S.w.m);
  const sp = S.w.split / 100;
  const pr = sp * dd + (1 - sp) * mm;
  const q = dd >= 3 ? (mm >= 3 ? "do" : "small") : (mm >= 3 ? "partner" : "park");
  return { d: dd, m: mm, p: pr, q };
}
function rankMap() {
  const arr = shown().map(p => [p.slug, prio(p).p]).sort((a, b) => b[1] - a[1]);
  const r = {}; arr.forEach((x, i) => { r[x[0]] = i + 1; }); return r;
}
function schemes() {
  const base = D.schemes.map(s => Object.assign({}, s, S.schemes[s.id] || {}));
  return base.concat(S.addSchemes.map(s => Object.assign({}, s, S.schemes[s.id] || {})));
}
function schemeName(id) { const s = schemes().find(x => x.id === id); return s ? L(s.name) : id; }
function lines(p) { return S.fund[p.slug] || p.fund; }
function fundSum(p) {
  let aw = 0, pi = 0, n = 0;
  lines(p).forEach(l => { if (l.st === "rejected") return; n++; if (l.st === "awarded") aw += +l.a || 0; else pi += +l.a || 0; });
  const need = p.cash;
  return { aw, pi, n, need, uns: Math.max(0, need[0] - aw), gap: Math.max(0, need[0] - aw - pi) };
}
function links(p) { return S.links[p.slug] || p.links; }

/* ---------------- UI state (not saved) ---------------- */
const U = { tlEditing: false, scoresOpen: false, rubricOpen: false, wOpen: false, basis: "", sort: { k: "p", dir: -1 }, pf: "", pp: "", ph: false, panel: null, last: "", anim: false, kpiPrev: null };
const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ICON = {
  search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>',
  gear: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"/></svg>',
};
const VIEWS = {};
const POST = [];
const TABS = [["overview", "tab_overview"], ["products", "tab_products"], ["priority", "tab_priority"], ["funding", "tab_funding"], ["guide", "tab_guide"], ["sources", "tab_sources"]];
const PTABS = [["plan", "pd_plan"], ["gtm", "pd_gtm"], ["revenue", "pd_revenue"], ["partners", "pd_partners"], ["resources", "pd_resources"], ["risks", "pd_risks"], ["links", "pd_links"]];

function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const parts = h.split("/");
  return { v: (TABS.some(t => t[0] === parts[0]) || parts[0] === "add") ? parts[0] : "overview", a: parts[1] || "", b: parts[2] || "" };
}

/* ---------------- chrome ---------------- */
function segCtl(el, items, cur, act, label, still) {
  const key = items.map(x => x[0] + ":" + x[1]).join("|");
  if (el.dataset.k !== key) {
    el.innerHTML = '<span class="thumb" aria-hidden="true"></span>' + items.map(([v, lab]) => `<button type="button" data-act="${act}" data-v="${v}">${esc(lab)}</button>`).join("");
    el.dataset.k = key;
  }
  el.setAttribute("aria-label", label);
  el.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === cur));
  placeThumb(el, '[aria-pressed="true"]', ".thumb", still);
}
function placeThumb(el, sel, th, still) {
  const b = el.querySelector(sel), t = el.querySelector(th);
  if (!t) return;
  if (!b) { t.style.opacity = 0; t._r = null; return; }
  const x = b.offsetLeft, y = b.offsetTop, w = b.offsetWidth, h = b.offsetHeight;
  const prev = t._r;
  t.style.opacity = 1;
  t.style.width = w + "px"; t.style.height = h + "px";
  t.style.transform = `translate(${x}px, ${y}px)`;
  t._r = [x, y, w, h];
  if (still || !prev || REDUCED || !t.animate || !el.offsetParent || (prev[0] === x && prev[2] === w)) return;
  /* liquid morph: the pill stretches toward its target, squeezes, then settles */
  const [x0, , w0] = prev, right = x > x0;
  const lead = 0.78, lag = 0.22;
  const ml = x0 + (x - x0) * (right ? lag : lead), mr = (x0 + w0) + ((x + w) - (x0 + w0)) * (right ? lead : lag);
  const ov = right ? 3 : -3;
  t.animate([
    { transform: `translate(${x0}px, ${y}px)`, width: w0 + "px" },
    { transform: `translate(${ml}px, ${y}px) scaleY(0.86)`, width: (mr - ml) + "px", offset: 0.42 },
    { transform: `translate(${x + ov}px, ${y}px) scaleY(1.04)`, width: w + "px", offset: 0.78 },
    { transform: `translate(${x}px, ${y}px)`, width: w + "px" },
  ], { duration: 560, easing: "cubic-bezier(.25,.8,.25,1)" });
}
function renderChrome(r, still) {
  document.documentElement.lang = S.lang;
  document.title = T("title");
  document.body.classList.toggle("simple", !!S.simple);
  byId("b-title").textContent = T("brand_t");
  byId("b-sub").textContent = T("brand_s");
  const q = byId("q");
  q.placeholder = T("search_open"); q.setAttribute("aria-label", T("search_ph"));
  byId("searchbtn").setAttribute("aria-label", T("search_open"));
  segCtl(byId("langctl"), [["en", "EN"], ["id", "ID"]], S.lang, "lang", "Language / Bahasa", still);
  byId("setbtn").innerHTML = ICON.gear + `<span class="sr">${esc(T("settings"))}</span>`;
  byId("setbtn").setAttribute("title", T("settings"));
  const tabs = byId("tabs");
  const tkey = S.lang;
  if (tabs.dataset.k !== tkey) {
    tabs.innerHTML = '<span class="tab-ind" aria-hidden="true"></span>' + TABS.map(([k]) => `<a href="#/${k}" data-tab="${k}">${esc(T("nav_" + k))}</a>`).join("");
    tabs.dataset.k = tkey;
  }
  const curTab = r.v === "add" ? "products" : r.v;
  tabs.querySelectorAll("a").forEach(a => { if (a.dataset.tab === curTab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  placeThumb(tabs, '[aria-current="page"]', ".tab-ind", still);
  const act = tabs.querySelector('[aria-current="page"]');
  if (act && tabs.scrollWidth > tabs.clientWidth && (act.offsetLeft < tabs.scrollLeft || act.offsetLeft + act.offsetWidth > tabs.scrollLeft + tabs.clientWidth)) tabs.scrollTo({ left: Math.max(0, act.offsetLeft - 16), behavior: REDUCED ? "auto" : "smooth" });
  const hf = byId("hiddenflag");
  hf.hidden = !S.hidden.length;
  hf.textContent = S.hidden.length ? S.hidden.length + " " + T("hidden_note") : "";
  byId("scen-l").textContent = T("scenario");
  segCtl(byId("scenctl"), SC.map(s => [s, T(s)]), S.scen, "scen", T("scenario"), still);
  const sw = byId("simplectl");
  sw.setAttribute("aria-pressed", !!S.simple);
  sw.setAttribute("title", T(S.simple ? "simplify_on" : "simplify_off"));
  sw.querySelector(".lab").textContent = T("simplify");
}
function byId(id) { return document.getElementById(id); }

function render() {
  const go = () => doRender();
  if (U.anim && !REDUCED && document.startViewTransition) {
    try {
      const vt = document.startViewTransition(go);
      [vt.ready, vt.finished, vt.updateCallbackDone].forEach(p => p && p.catch(() => {}));
      return;
    } catch (e) { /* fall through */ }
  }
  go();
}
function doRender() {
  refreshProducts();
  document.body.classList.toggle("simple", !!S.simple);
  clearCache();
  const r = route();
  renderChrome(r);
  const ae = document.activeElement;
  const fid = ae && ae.id && ae !== document.body ? ae.id : null;
  let sel = null;
  try { if (fid && ae.selectionStart != null) sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { sel = null; }
  const m = byId("main");
  const view = (S.simple && SIMPLE[r.v]) || VIEWS[r.v] || VIEWS.overview;
  m.innerHTML = view(r);
  if (fid && fid !== "q") {
    const el = byId(fid);
    if (el) { el.focus({ preventScroll: true }); try { if (sel && el.setSelectionRange) el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* */ } }
  }
  if (r.v === "sources" && r.a) {
    const li = byId("src-" + r.a);
    if (li) { li.classList.add("hl"); li.scrollIntoView({ block: "center" }); }
  }
  if (U.panel) renderPanel();
  const key = r.v + "/" + r.a;
  if (U.anim && !REDUCED) { m.classList.remove("enter"); void m.offsetWidth; m.classList.add("enter"); clearTimeout(doRender._t); doRender._t = setTimeout(() => m.classList.remove("enter"), 1100); }
  U.anim = false;
  if (key !== U.last && !(r.v === "sources" && r.a)) window.scrollTo(0, 0);
  U.last = key;
  POST.forEach(f => f());
}
function countUp() {
  const els = [...document.querySelectorAll("[data-count]")];
  const vals = els.map(e => +e.dataset.count);
  const prev = U.kpiPrev;
  U.kpiPrev = vals;
  if (!prev || prev.length !== vals.length || REDUCED) return;
  const t0 = performance.now(), dur = 650;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    els.forEach((el, i) => { const v = prev[i] + (vals[i] - prev[i]) * e; el.textContent = el.dataset.fmt === "rp" ? rpBig(v) : el.dataset.fmt === "frac" ? Math.round(v) + " / " + el.dataset.of : num(v); });
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
POST.push(countUp);
function disclaimer(short) {
  const d = D.disclaimer;
  if (short) return `<p class="disc-s"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 9v5M10 6.2v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>${LC(d.short)} <a href="#/sources" data-act="mjumpgo" data-k="disc">${esc(T("read_more"))}</a></span></p>`;
  return `<aside class="disc glass" aria-label="${esc(L(d.title))}"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 9v5M10 6.2v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><div><b>${esc(L(d.title))}</b><p>${LC(d.body)}</p></div></aside>`;
}
function scenNote() {
  return `<p class="scen-note"><b>${esc(T(S.scen))}.</b> ${esc(T("scen_" + S.scen))}</p>`;
}

/* ---------------- timeline ---------------- */
function tlHead() {
  return `<div class="tl-h"><div></div><div class="tl-years">${Y.map(y => `<div class="tl-y"><b>${y}</b><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span></div>`).join("")}</div></div>`;
}
function tlRow(p, opts) {
  const t = tl(p), g = S.gshift, nm = short(p), stg = tktStages(p);
  let h = "";
  const segs = t.seg.map(s => [s[0] + g, s[1] + g, s[2]]).filter(s => s[1] >= 0 && s[0] <= 15).map(s => [Math.max(0, s[0]), Math.min(15, s[1]), s[2]]);
  segs.forEach((s, i) => {
    const cls = "tseg ph-" + s[2] + (i === 0 ? " st" : "") + (i === segs.length - 1 ? " en" : "");
    const tip = `${nm}: ${T("phase_" + s[2])}, ${ql(s[0])} - ${ql(s[1])}. ${T("target_tkt")} ${stg[s[2]] ? stg[s[2]].tkt : ""}`;
    h += `<span class="${cls}" style="left:${(s[0] / 16 * 100).toFixed(3)}%;width:${((s[1] - s[0] + 1) / 16 * 100).toFixed(3)}%" data-tip="${esc(tip)}"></span>`;
  });
  t.gates.forEach(gt => {
    const q = gt[0] + g;
    if (q < 0 || q > 15) return;
    h += `<span class="tgate" style="left:${((q + 1) / 16 * 100).toFixed(3)}%" data-tip="${esc(nm + ": " + T("gate") + ", " + ql(q) + ". " + L(gt[1]))}"></span>`;
  });
  let outLabel = "";
  SC.forEach(sc => {
    if (sc === S.scen) return;
    const f = firstEff(p, sc);
    if (f == null || f > 15) return;
    const fx = Math.max(0, f);
    h += `<span class="tmo" style="left:${((fx + 0.5) / 16 * 100).toFixed(3)}%" data-tip="${esc(nm + ": " + T("first_income") + ", " + T(sc) + ": " + ql(f))}"></span>`;
  });
  const f = firstEff(p, S.scen);
  if (f != null && f <= 15) {
    const fx = Math.max(0, f);
    h += `<span class="tmile" style="left:${((fx + 0.5) / 16 * 100).toFixed(3)}%" data-tip="${esc(nm + ": " + T("first_income") + ", " + T(S.scen) + ": " + ql(f))}"></span>`;
  } else {
    outLabel = `<span class="tout" data-tip="${esc(nm + ": " + T("first_income") + ", " + T(S.scen) + ": " + ql(f))}">${esc(f == null ? T("not_before") : T("after2030"))}</span>`;
  }
  const ed = opts && opts.noEdit ? "" : `<span class="tl-ed"><button type="button" data-act="shift" data-slug="${p.slug}" data-d="-1" aria-label="${esc(T("earlier") + ": " + nm)}" data-tip="${esc(T("earlier"))}">&#9664;</button><button type="button" data-act="shift" data-slug="${p.slug}" data-d="1" aria-label="${esc(T("later") + ": " + nm)}" data-tip="${esc(T("later"))}">&#9654;</button><button type="button" data-act="drawer" data-slug="${p.slug}" aria-label="${esc(T("edit_phase") + ": " + nm)}" data-tip="${esc(T("edit_phase"))}">&#9998;</button></span>`;
  return `<div class="tl-r${isHidden(p) ? " hid" : ""}"><div class="tl-l"><span class="tl-no">${p.id}</span><a href="#/products/${p.slug}">${esc(nm)}</a>${t.edited ? `<span class="edited" title="${esc(T("edited"))}">*</span>` : ""}<span class="tl-tkt" data-tip="${esc(T("tkt_now") + ": " + tktNow(p))}">${tktNow(p)}</span>${ed}</div><div class="tl-t">${h}${outLabel}</div></div>`;
}
function legend() {
  return `<div class="legend">${PH.map(ph => `<span><i class="lg-ph ph-${ph}"></i>${esc(T("phase_" + ph))}</span>`).join("")}<span><i class="lg-d"></i>${esc(T("first_sel"))}</span><span><i class="lg-o"></i>${esc(T("first_other"))}</span><span><i class="lg-g"></i>${esc(T("gate"))}</span></div>`;
}
function timeline(list) {
  let rows = "";
  D.pathways.forEach(pw => {
    const ps = list.filter(p => p.pathway === pw.id);
    if (!ps.length) return;
    rows += `<div class="tl-g">${esc(L(pw.name))}</div>` + ps.map(p => tlRow(p)).join("");
  });
  const gs = S.gshift;
  const bar = `<div class="tlbar">${legend()}<div class="ctl noprint">${U.tlEditing ? `<span class="gshift">${esc(T("shift_all"))} <button type="button" class="btn sm" data-act="gshift" data-d="-1" aria-label="${esc(T("earlier"))}">&#9664;</button><b>${gs > 0 ? "+" : ""}${gs} ${esc(T("quarters"))}</b><button type="button" class="btn sm" data-act="gshift" data-d="1" aria-label="${esc(T("later"))}">&#9654;</button></span>` : ""}<a class="btn sm" href="#/add">${esc(T("add_product"))}</a><button type="button" class="btn sm${U.tlEditing ? " primary" : ""}" data-act="tledit" aria-pressed="${U.tlEditing}">${esc(U.tlEditing ? T("done_editing") : T("edit_tl"))}</button></div></div>`;
  return `<div class="tlbox glass${U.tlEditing ? " editing" : ""}">${bar}<div class="tlscroll"><div class="tl" role="img" aria-label="${esc(T("ov_h"))}">${tlHead()}${rows}</div></div></div>`;
}

/* ---------------- charts ---------------- */
function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return steps.find(x => m <= x) * p;
}
function hbar(x, y, w, h, r) {
  if (w <= 0) return "";
  r = Math.min(r, w, h / 2);
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`;
}
function vbar(x, y0, w, h, r) {
  if (h <= 0) return "";
  r = Math.min(r, w / 2, h);
  return `M${x},${y0}v-${h - r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
}
function chartByProduct(list) {
  const rows = list.map(p => {
    const v = income(p, S.scen).tot;
    const all = SC.map(s => income(p, s).tot);
    return { p, v, lo: Math.min.apply(null, all), hi: Math.max.apply(null, all), all };
  }).sort((a, b) => (b.v - a.v) || (b.hi - a.hi));
  const W = 660, L0 = 178, R0 = 64, rh = 25, top = 6;
  const H = top + rows.length * rh + 26;
  const mx = niceMax(Math.max(1, ...rows.map(r => r.hi)));
  const sx = v => (v / mx) * (W - L0 - R0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T("rev_by_product"))}">`;
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const x = L0 + sx(mx * f);
    s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${H - 22}" stroke="#E8EEF4"/><text class="ax" x="${x}" y="${H - 7}" text-anchor="middle">${num(mx * f)}</text>`;
  });
  rows.forEach((r, i) => {
    const y = top + i * rh;
    const cy = y + rh / 2;
    let nm = short(r.p);
    if (nm.length > 26) nm = nm.slice(0, 25) + "…";
    const tip = `${short(r.p)}. ${SC.map((sc, k) => T(sc) + ": " + rpj(r.all[k])).join("; ")}`;
    s += `<g class="row"><rect class="hit" x="0" y="${y}" width="${W}" height="${rh}" data-tip="${esc(tip)}"/>`;
    s += `<text class="lab" x="${L0 - 8}" y="${cy + 4}" text-anchor="end">${esc(nm)}</text>`;
    if (r.hi <= 0.5) {
      s += `<text class="val" x="${L0 + 4}" y="${cy + 4}">${esc(T("not_before"))}</text></g>`;
      return;
    }
    s += `<path class="bar" d="${hbar(L0, cy - 6, sx(r.v), 12, 4)}" fill="#1E86C8" pointer-events="none"/>`;
    if (r.hi - r.lo > 0.5) {
      const x1 = L0 + sx(r.lo), x2 = L0 + sx(r.hi);
      s += `<g pointer-events="none" stroke="#46566F" stroke-width="1.5"><line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}"/><line x1="${x1}" y1="${cy - 5}" x2="${x1}" y2="${cy + 5}"/><line x1="${x2}" y1="${cy - 5}" x2="${x2}" y2="${cy + 5}"/></g>`;
    }
    s += `<text class="val" x="${L0 + sx(Math.max(r.v, r.hi)) + 6}" y="${cy + 4}" pointer-events="none">${num(r.v)}</text></g>`;
  });
  return s + "</svg>";
}
function chartByYear(list) {
  const vals = SC.reduce((o, sc) => { o[sc] = Y.map((y, yi) => list.reduce((a, p) => a + income(p, sc).y[yi][0], 0)); return o; }, {});
  const W = 600, H = 300, L0 = 52, B = 30, T0 = 22;
  const mx = niceMax(Math.max(1, ...SC.map(sc => Math.max.apply(null, vals[sc]))));
  const sy = v => (v / mx) * (H - B - T0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T("rev_by_year"))}">`;
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const y = H - B - sy(mx * f);
    s += `<line x1="${L0}" y1="${y}" x2="${W - 8}" y2="${y}" stroke="#E8EEF4"/><text class="ax" x="${L0 - 6}" y="${y + 4}" text-anchor="end">${num(mx * f)}</text>`;
  });
  const bw = 64, step = (W - L0 - 8) / 4;
  Y.forEach((y, i) => {
    const cx = L0 + step * i + step / 2;
    const v = vals[S.scen][i];
    const lo = Math.min(...SC.map(sc => vals[sc][i])), hi = Math.max(...SC.map(sc => vals[sc][i]));
    const tip = `${y}. ${SC.map(sc => T(sc) + ": " + rpj(vals[sc][i])).join("; ")}`;
    s += `<rect class="hit" x="${cx - step / 2}" y="${T0 - 10}" width="${step}" height="${H - B - T0 + 10}" data-tip="${esc(tip)}"/>`;
    s += `<path d="${vbar(cx - bw / 2, H - B, bw, sy(v), 4)}" fill="#1E86C8" pointer-events="none"/>`;
    if (hi - lo > 0.5) {
      const y1 = H - B - sy(lo), y2 = H - B - sy(hi);
      s += `<g pointer-events="none" stroke="#46566F" stroke-width="1.5"><line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}"/><line x1="${cx - 6}" y1="${y1}" x2="${cx + 6}" y2="${y1}"/><line x1="${cx - 6}" y1="${y2}" x2="${cx + 6}" y2="${y2}"/></g>`;
    }
    s += `<text class="val" x="${cx}" y="${H - B - sy(Math.max(v, hi)) - 6}" text-anchor="middle" pointer-events="none">${num(v)}</text>`;
    s += `<text class="lab" x="${cx}" y="${H - 10}" text-anchor="middle">${y}</text>`;
  });
  return s + "</svg>";
}

/* ---------------- overview ---------------- */
VIEWS.overview = () => {
  const sh = shown();
  const cnt = {}, tot = {}, t30 = {};
  SC.forEach(sc => {
    cnt[sc] = sh.filter(p => earns(p, sc)).length;
    tot[sc] = sh.reduce((a, p) => a + income(p, sc).tot, 0);
    t30[sc] = sh.reduce((a, p) => a + income(p, sc).y[3][0], 0);
  });
  const sc = S.scen;
  const rng = (o, f) => `${esc(T("pess"))} ${f(o.pess)} &middot; ${esc(T("opt"))} ${f(o.opt)}`.replace(" &middot; ", ", ");
  return `<div class="vhead"><div><h1>${esc(T("ov_h"))}</h1><p class="lede">${esc(T("ov_intro"))}</p></div>${scenNote()}</div>
  ${disclaimer(false)}
  <div class="kpis">
   <div class="kpi glass lq"><b data-count="${cnt[sc]}" data-fmt="frac" data-of="${sh.length}">${cnt[sc]} / ${sh.length}</b><span>${esc(T("kpi_products"))}</span><em>${rng(cnt, v => v)}</em></div>
   <div class="kpi glass lq"><b data-count="${tot[sc]}" data-fmt="rp">${rpBig(tot[sc])}</b><span>${esc(T("kpi_total"))}</span><em>${rng(tot, rpBig)}</em></div>
   <div class="kpi glass lq"><b data-count="${t30[sc]}" data-fmt="rp">${rpBig(t30[sc])}</b><span>${esc(T("kpi_2030"))}</span><em>${rng(t30, rpBig)}</em></div>
  </div>
  <p class="note">${esc(T("kpi_note"))}</p>
  ${timeline(sh)}
  <div class="two sec">
   <div class="card glass chart"><h2>${esc(T("rev_by_product"))}</h2><p class="note" style="margin-bottom:8px">${esc(T("rp_juta"))}. ${esc(T("range_note"))}</p>${chartByProduct(sh)}</div>
   <div class="card glass chart"><h2>${esc(T("rev_by_year"))}</h2><p class="note" style="margin-bottom:8px">${esc(T("rp_juta"))}. ${esc(T("range_note"))}</p>${chartByYear(sh)}
    <div class="tw" style="margin-top:12px"><table><thead><tr><th>${esc(T("scenario"))}</th>${Y.map(y => `<th class="n">${y}</th>`).join("")}<th class="n">${esc(T("total"))}</th></tr></thead><tbody>
    ${SC.map(s => `<tr${s === sc ? ' class="sel"' : ""}><td>${esc(T(s))}</td>${Y.map((y, yi) => `<td class="n">${num(sh.reduce((a, p) => a + income(p, s).y[yi][0], 0))}</td>`).join("")}<td class="n"><b>${num(tot[s])}</b></td></tr>`).join("")}
    </tbody></table></div></div>
  </div>`;
};

/* ---------------- priority ---------------- */
function scatter(list) {
  const W = 520, H = 440, L0 = 52, B = 46, T0 = 16, R0 = 16;
  const sx = v => L0 + (v - 1) / 4 * (W - L0 - R0);
  const sy = v => H - B - (v - 1) / 4 * (H - B - T0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T("doability") + " / " + T("market"))}">`;
  const mx = sx(3), my = sy(3);
  s += `<rect x="${mx}" y="${T0}" width="${W - R0 - mx}" height="${my - T0}" fill="#EDF7F1"/>`;
  s += `<rect x="${L0}" y="${T0}" width="${mx - L0}" height="${my - T0}" fill="#EEF5FC"/>`;
  s += `<rect x="${mx}" y="${my}" width="${W - R0 - mx}" height="${H - B - my}" fill="#FFF8EE"/>`;
  s += `<rect x="${L0}" y="${my}" width="${mx - L0}" height="${H - B - my}" fill="#F4F6F8"/>`;
  [1, 2, 3, 4, 5].forEach(v => {
    s += `<line x1="${sx(v)}" y1="${T0}" x2="${sx(v)}" y2="${H - B}" stroke="${v === 3 ? "#9FB6CB" : "#E2EAF2"}"/><text class="ax" x="${sx(v)}" y="${H - B + 16}" text-anchor="middle">${v}</text>`;
    s += `<line x1="${L0}" y1="${sy(v)}" x2="${W - R0}" y2="${sy(v)}" stroke="${v === 3 ? "#9FB6CB" : "#E2EAF2"}"/><text class="ax" x="${L0 - 8}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
  });
  s += `<text class="lab" x="${(L0 + W - R0) / 2}" y="${H - 8}" text-anchor="middle">${esc(T("doability"))} &#8594;</text>`;
  s += `<text class="lab" transform="translate(14 ${(T0 + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(T("market"))} &#8594;</text>`;
  const ql_ = [["q_do", W - R0 - 8, T0 + 16, "end"], ["q_partner", L0 + 8, T0 + 16, "start"], ["q_small", W - R0 - 8, H - B - 8, "end"], ["q_park", L0 + 8, H - B - 8, "start"]];
  ql_.forEach(([k, x, y, a]) => { s += `<text class="ax" x="${x}" y="${y}" text-anchor="${a}" style="font-weight:650">${esc(T(k))}</text>`; });
  const pts = [];
  const offs = [[0, 0], [16, -9], [-16, 9], [16, 9], [-16, -9], [0, 18], [0, -18]];
  list.forEach(p => {
    const r = prio(p);
    let x = sx(r.d), y = sy(r.m), k = 0;
    while (k < offs.length - 1 && pts.some(q => Math.hypot(q.x - (sx(r.d) + offs[k][0]), q.y - (sy(r.m) + offs[k][1])) < 18)) k++;
    x = sx(r.d) + offs[k][0]; y = sy(r.m) + offs[k][1];
    pts.push({ x, y, p, r });
  });
  pts.forEach(o => {
    const tip = `${o.p.id} ${short(o.p)}. ${T("doability")} ${num(o.r.d, 1)}, ${T("market")} ${num(o.r.m, 1)}, ${T("priority")} ${num(o.r.p, 2)}`;
    s += `<a href="#/products/${o.p.slug}" aria-label="${esc(tip)}"><g data-tip="${esc(tip)}"><circle cx="${o.x}" cy="${o.y}" r="10" fill="#1B2A4A" stroke="#fff" stroke-width="2"/><text x="${o.x}" y="${o.y + 3.5}" text-anchor="middle" fill="#fff" style="font-size:9.5px;font-weight:700">${o.p.id}</text></g></a>`;
  });
  return s + "</svg>";
}
function prioTable(list) {
  const rk = rankMap();
  const rows = list.map(p => ({ p, r: prio(p), f: firstEff(p, S.scen), inc: income(p, S.scen).tot, rank: rk[p.slug], t: tktNow(p) }));
  const k = U.sort.k, dir = U.sort.dir;
  const val = o => k === "name" ? short(o.p).toLowerCase() : k === "d" ? o.r.d : k === "m" ? o.r.m : k === "tkt" ? o.t : k === "first" ? (o.f == null ? 99 : o.f) : k === "inc" ? o.inc : o.r.p;
  rows.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || a.rank - b.rank; });
  const th = (key, lab, n) => `<th class="${n ? "n" : ""}"><button type="button" class="sort" data-act="sort" data-k="${key}" ${U.sort.k === key ? `aria-sort="${dir > 0 ? "ascending" : "descending"}"` : ""}>${esc(lab)}</button></th>`;
  return `<div class="tw glass pad0"><table><thead><tr><th class="n">#</th>${th("name", T("product"))}${th("tkt", "TKT", 1)}${th("d", T("doability"), 1)}${th("m", T("market"), 1)}${th("p", T("priority"), 1)}<th>${esc(T("quadrant"))}</th>${th("first", T("first_income"))}${th("inc", T("income_short"), 1)}<th>${esc(T("next_action"))}</th><th></th></tr></thead><tbody>
  ${rows.map(o => `<tr><td class="n">${o.rank}</td><td style="min-width:170px"><a href="#/products/${o.p.slug}">${esc(short(o.p))}</a><div class="small muted">${esc(pathName(o.p.pathway))}</div></td><td class="n">${o.t}</td><td class="n">${num(o.r.d, 1)}</td><td class="n">${num(o.r.m, 1)}</td><td class="n"><b>${num(o.r.p, 2)}</b></td><td><span class="qchip q-${o.r.q}">${esc(T("q_" + o.r.q))}</span></td><td style="white-space:nowrap">${esc(ql(o.f))}</td><td class="n">${num(o.inc)}</td><td class="small" style="min-width:260px">${LC(o.p.next)}</td><td><button type="button" class="btn sm ghost" data-act="basis" data-slug="${o.p.slug}">${esc(T("why_score"))}</button></td></tr>`).join("")}
  </tbody></table></div>`;
}
function rubricTable() {
  const row = (c, code) => `<tr><td><b>${code}</b> ${esc(L(c.name))}</td>${c.levels.map(l => `<td class="small">${esc(L(l))}</td>`).join("")}</tr>`;
  return `<div class="tw glass pad0"><table class="rubric"><thead><tr><th>${esc(T("criterion"))}</th>${[5, 4, 3, 2, 1].map(n => `<th>${n}</th>`).join("")}</tr></thead><tbody>
  <tr class="grp-row"><td colspan="6">${esc(T("doability"))}</td></tr>${D.rubric.d.map((c, i) => row(c, "D" + (i + 1))).join("")}
  <tr class="grp-row"><td colspan="6">${esc(T("market"))}</td></tr>${D.rubric.m.map((c, i) => row(c, "M" + (i + 1))).join("")}
  </tbody></table></div><p class="note">${esc(T("rubric_note"))}</p>`;
}
const IP_KEYS = ["none", "claimed", "secret", "filed", "registered", "granted", "granteddoc"];
const PT_KEYS = ["none", "candidate", "mou", "nego", "active"];
const EV_KEYS = ["ev_proto", "ev_users", "ev_tested", "ev_cost"];
function ptKey(f) { return f.partner === "agreement" ? "active" : f.partner; }
function basisRows(p, edit) {
  const s = scores(p), f = s.f, rb = D.rubric;
  const lvl = (c, n) => L(c.levels[5 - n]);
  const sel = (id, opts, cur, on, extra) => `<select class="inp" id="${id}" data-on="${on}" data-slug="${p.slug}" ${extra || ""}>${opts.map(([v, lab]) => `<option value="${v}"${String(v) === String(cur) ? " selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
  const src = f.src === "bridge" ? T("tkt_bridge") : T("tkt_est");
  const Dc = [
    [edit ? sel("bf-tkt", [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, "TKT " + n]), f.tkt, "fact", 'data-f="tkt"') : esc("TKT " + f.tkt), esc(src) + (f.tb ? ". " + LC(f.tb) : "")],
    [edit ? EV_KEYS.map((k, i) => `<label class="chk"><input type="checkbox" data-on="factev" data-slug="${p.slug}" data-i="${i}" id="bf-ev-${i}" ${f.ev[i] ? "checked" : ""}>${esc(T(k))}</label>`).join("") : esc(EV_KEYS.filter((k, i) => f.ev[i]).map(k => T(k)).join(", ") || T("none")), ""],
    [edit ? sel("bf-ip", IP_KEYS.map(k => [k, T("ip_" + k)]), f.ip, "fact", 'data-f="ip"') : esc(T("ip_" + f.ip)), ""],
    [edit ? sel("bf-pt", PT_KEYS.map(k => [k, T("pt_" + k)]), ptKey(f), "fact", 'data-f="partner"') : esc(T("pt_" + ptKey(f))), ""],
    [edit ? sel("bf-reg", [5, 4, 3, 2, 1].map(n => [n, n + ". " + lvl(rb.d[4], n)]), f.reg, "fact", 'data-f="reg"') : esc(lvl(rb.d[4], f.reg)), ""],
    [edit ? `<input class="inp num" type="number" min="0" step="any" id="bf-cash" value="${f.cash}" data-on="fact" data-f="cash" data-slug="${p.slug}"> <span class="small muted">Rp juta</span>` : esc(rpj(f.cash)), esc(T("cash_basis"))],
  ];
  const Mc = [0, 1, 2, 3].map(i => [edit ? sel("bf-m" + i, [5, 4, 3, 2, 1].map(n => [n, n + ". " + lvl(rb.m[i], n)]), s.m[i], "factm", `data-i="${i}"`) : esc(lvl(rb.m[i], s.m[i])), f.mb && f.mb[i] ? LC(f.mb[i]) : ""]);
  Mc.push([esc(lvl(rb.m[4], s.m[4])), esc(T("m5_auto").replace("{n}", nOpps(p)).replace("{p}", T("pt_" + ptKey(f))))]);
  const row = (code, c, n, cell, basis) => `<tr><td class="crit"><b>${code}</b> ${esc(L(c.name))}</td><td class="n"><span class="lv lv${n}">${n}</span></td><td>${cell}</td><td class="small muted">${basis}</td></tr>`;
  const pr = prio(p);
  return `<div class="tw"><table class="basis"><thead><tr><th>${esc(T("criterion"))}</th><th class="n">${esc(T("score"))}</th><th>${esc(T("recorded_fact"))}</th><th>${esc(T("basis"))}</th></tr></thead><tbody>
   <tr class="grp-row"><td colspan="4">${esc(T("doability"))}: ${num(pr.d, 2)}</td></tr>${rb.d.map((c, i) => row("D" + (i + 1), c, s.d[i], Dc[i][0], Dc[i][1])).join("")}
   <tr class="grp-row"><td colspan="4">${esc(T("market"))}: ${num(pr.m, 2)}</td></tr>${rb.m.map((c, i) => row("M" + (i + 1), c, s.m[i], Mc[i][0], Mc[i][1])).join("")}
  </tbody></table></div>`;
}
function basisEditor() {
  const sh = shown();
  const slug = BY[U.basis] && inP(U.basis) ? U.basis : (sh[0] || P[0]).slug;
  const p = BY[slug], pr = prio(p);
  return `<section class="card glass sec" id="basis-box"><div class="tlbar"><div><h2 style="margin:0">${esc(T("edit_basis"))}</h2><p class="note">${esc(T("basis_help"))}</p></div><div class="ctl"><select class="inp" id="basis-sel" data-on="basissel" aria-label="${esc(T("product"))}">${sh.map(x => `<option value="${x.slug}"${x.slug === slug ? " selected" : ""}>${x.id} ${esc(short(x))}</option>`).join("")}</select>${S.facts[slug] ? `<button type="button" class="btn sm" data-act="factreset" data-slug="${slug}">${esc(T("reset_product"))}</button>` : ""}</div></div>
  <p class="small" style="margin:6px 0 10px"><span class="qchip q-${pr.q}">${esc(T("q_" + pr.q))}</span> ${esc(T("priority"))} <b>${num(pr.p, 2)}</b></p>${basisRows(p, true)}</section>`;
}
function quadLists(list) {
  const g = { do: [], partner: [], small: [], park: [] };
  list.forEach(p => g[prio(p).q].push(p));
  const box = k => `<div class="qbox glass q-${k}-b"><h3><span class="qchip q-${k}">${esc(T("q_" + k))}</span> <span class="muted small">${g[k].length}</span></h3><p class="small muted">${esc(T("qd_" + k))}</p><ul class="clean small">${g[k].sort((a, b) => prio(b).p - prio(a).p).map(p => `<li><a href="#/products/${p.slug}">${p.id} ${esc(short(p))}</a></li>`).join("") || `<li class="muted">-</li>`}</ul></div>`;
  return `<div class="qgrid4">${box("partner")}${box("do")}${box("park")}${box("small")}</div>`;
}
function prioOut() {
  const sh = shown();
  return `<div class="prio"><div class="card glass chart">${scatter(sh)}</div>${quadLists(sh)}</div><div class="sec">${prioTable(sh)}</div>`;
}
VIEWS.priority = () => {
  const w = S.w;
  const wl = (arr, key) => arr.map((c, i) => `<div><label for="w-${key}-${i}">${esc(L(c.name))}</label><span><input type="range" min="0" max="3" step="1" id="w-${key}-${i}" value="${w[key][i]}" data-in="w" data-t="${key}" data-i="${i}"> <b id="wv-${key}-${i}">${w[key][i]}</b></span></div>`).join("");
  return `<div class="vhead"><div><h1>${esc(T("pr_h"))}</h1><p class="lede">${esc(T("pr_intro"))}</p></div>${scenNote()}</div>
  <div class="ctlbox glass">
   <div class="rng"><label for="w-split">${esc(T("weight_split"))}</label><input type="range" id="w-split" min="0" max="100" step="5" value="${w.split}" data-in="split"><b id="wv-split">${w.split}% / ${100 - w.split}%</b><span class="muted small">${esc(T("doability"))} / ${esc(T("market"))}</span></div>
   <div class="btnrow"><button type="button" class="btn sm${U.rubricOpen ? " primary" : ""}" data-act="rubricopen" aria-expanded="${U.rubricOpen}">${esc(T("rubric_h"))}</button><button type="button" class="btn sm${U.scoresOpen ? " primary" : ""}" data-act="scoresopen" aria-expanded="${U.scoresOpen}">${esc(T("edit_basis"))}</button><button type="button" class="btn sm${U.wOpen ? " primary" : ""}" data-act="wopen" aria-expanded="${U.wOpen}">${esc(T("criteria_w"))}</button><button type="button" class="btn sm ghost" data-act="wreset">${esc(T("reset_weights"))}</button></div>
   ${U.wOpen ? `<div class="two"><div><h4>${esc(T("doability"))}</h4><div class="wgrid" style="grid-template-columns:1fr">${wl(D.rubric.d, "d")}</div></div><div><h4>${esc(T("market"))}</h4><div class="wgrid" style="grid-template-columns:1fr">${wl(D.rubric.m, "m")}</div></div></div>` : ""}
  </div>
  ${U.rubricOpen ? `<section class="sec"><h2>${esc(T("rubric_h"))}</h2><p class="lede" style="margin-bottom:10px">${esc(T("rubric_intro"))}</p>${rubricTable()}</section>` : ""}
  ${U.scoresOpen ? basisEditor() : ""}
  <div id="prio-out" class="sec">${prioOut()}</div>
  <p class="note">${esc(T("prio_note"))}</p>`;
};

/* ---------------- products ---------------- */
function prodMatches(p, q) {
  if (!q) return true;
  const hay = [p.name.en, p.name.id, L(p.short), p.lead.en, p.id, ...p.partners.map(x => x[1].en), ...p.comps.map(c => c.name.en + " " + c.name.id)].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(tk => hay.indexOf(tk) >= 0);
}
function plistUl(cur) {
  let h = "";
  D.pathways.forEach(pw => {
    if (U.pp && U.pp !== pw.id) return;
    const ps = P.filter(p => p.pathway === pw.id && (U.ph || !isHidden(p) || p.slug === cur) && prodMatches(p, U.pf));
    if (!ps.length) return;
    h += `<li class="pg">${esc(L(pw.name))}</li>` + ps.map(p => `<li><a href="#/products/${p.slug}" class="${isHidden(p) ? "hid" : ""}" ${p.slug === cur ? 'aria-current="page"' : ""}><span class="tl-no">${p.id}</span><span class="pl-n">${esc(short(p))}</span><span class="pl-t" title="TKT">${tktNow(p)}</span></a></li>`).join("");
  });
  return h || `<li class="muted small">${esc(T("no_results"))}</li>`;
}
function qopts(sel, none, lo, hi) {
  lo = Math.min(lo == null ? 0 : lo, sel == null ? 0 : sel); hi = Math.max(hi == null ? 15 : hi, sel == null ? 0 : sel);
  let h = none ? `<option value=""${sel == null ? " selected" : ""}>${esc(T("none"))}</option>` : "";
  for (let q = lo; q <= hi; q++) h += `<option value="${q}"${q === sel ? " selected" : ""}>${esc(ql(q))}</option>`;
  return h;
}
function phaseAt(p, q) {
  const t = tl(p);
  for (const s of t.seg) if (q >= s[0] + S.gshift && q <= s[1] + S.gshift) return s[2];
  return null;
}
function tktPath(p) {
  const stg = tktStages(p), f = facts(p);
  const src = f.src === "bridge" ? T("tkt_bridge") : T("tkt_est");
  let h = `<div class="tk now"><span>${esc(T("tkt_now"))}</span><b>TKT ${f.tkt}</b><small>${esc(src)}</small></div>`;
  PH.forEach(ph => { const s = stg[ph]; if (!s) return; h += `<div class="tk-arrow" aria-hidden="true"></div><div class="tk ph-${ph}-t"><span>${esc(T("phase_" + ph))}</span><b>TKT ${s.tkt}</b><small>${esc(ql(Math.max(0, s.start)))} - ${esc(ql(Math.min(15, s.end)))}</small></div>`; });
  return `<div class="tkpath" role="list" aria-label="${esc(T("tkt_path"))}">${h}</div><p class="note">${esc(T("tkt_path_note"))}</p>`;
}
function planTab(p) {
  const t = tl(p), off = t.qs + S.gshift;
  const fsel = firstEff(p, S.scen);
  const stg = tktStages(p);
  let grid = `<div class="qgrid"><div></div>${[1, 2, 3, 4].map(q => `<div class="qh">Q${q}</div>`).join("")}`;
  Y.forEach((y, yi) => {
    grid += `<div class="yh">${y}</div>`;
    for (let k = 0; k < 4; k++) {
      const q = yi * 4 + k, i = q - off, ph = phaseAt(p, q);
      const txt = i >= 0 && i < 16 ? L(goal(p, i)) : "";
      const gates = t.gates.filter(g => g[0] + S.gshift === q).map(g => `<span class="gt">${esc(T("gate"))}: ${esc(L(g[1]))}</span>`).join("");
      const fi = fsel === q ? `<span class="fi">&#9670; ${esc(T("first_income"))} (${esc(T(S.scen))})</span>` : "";
      grid += `<div class="qc${ph ? " ph-" + ph + "-b" : ""}${txt ? "" : " mt"}"><span class="pt">${ph ? `<span>${esc(T("phase_" + ph))}</span><span class="pt-tkt">TKT ${stg[ph] ? stg[ph].tkt : ""}</span>` : "&nbsp;"}</span><span class="qn">Q${k + 1}</span>${U.goalEdit && i >= 0 && i < 16 ? `<textarea class="inp" rows="3" id="qt-${p.slug}-${i}" data-on="qtext" data-slug="${p.slug}" data-i="${i}" aria-label="${esc(T("goal") + " " + ql(q))}">${esc(txt)}</textarea>` : (txt ? LC(goal(p, i)) : "&nbsp;")}${gates}${fi}</div>`;
    }
  });
  grid += "</div>";
  const before = [], after = [];
  p.q.forEach((g, i) => { const q = i + off; if (q < 0) before.push([i, goal(p, i)]); if (q > 15) after.push([i, goal(p, i)]); });
  const orig = i => ql(i);
  const mv = (arr, lab) => arr.length ? `<div class="moved"><h4>${esc(lab)}</h4><ul class="clean">${arr.map(([i, g]) => `<li><span class="muted">${esc(T("goal"))} ${esc(orig(i))}:</span> ${LC(g)}</li>`).join("")}</ul></div>` : "";
  return `<div class="two"><div class="card glass"><h3>${esc(T("now"))}</h3><p>${LC(p.now)}</p></div><div class="card glass"><h3>${esc(T("route"))}</h3><p>${LC(p.path)}</p><p class="small muted">${esc(pathName(p.pathway))}</p></div></div>
  <h3 class="sec">${esc(T("tkt_path"))}</h3>${tktPath(p)}
  <div class="tlbox glass"><div class="tlbar">${legend()}<div class="ctl noprint"><button type="button" class="btn sm" data-act="shift" data-slug="${p.slug}" data-d="-1">&#9664; ${esc(T("earlier"))}</button><button type="button" class="btn sm" data-act="shift" data-slug="${p.slug}" data-d="1">${esc(T("later"))} &#9654;</button><button type="button" class="btn sm" data-act="drawer" data-slug="${p.slug}">${esc(T("edit_phase"))}</button></div></div><div class="tlscroll"><div class="tl">${tlHead()}${tlRow(p, { noEdit: true })}</div></div></div>
  <div class="tlbar sec"><h3 style="margin:0">${esc(T("quarter_goals"))}${S.qtext[p.slug] ? `<span class="edited">${esc(T("edited"))}</span>` : ""}</h3><div class="ctl noprint"><button type="button" class="btn sm${U.goalEdit ? " primary" : ""}" data-act="goaledit">${esc(U.goalEdit ? T("done_editing") : T("edit_goals"))}</button>${S.qtext[p.slug] ? `<button type="button" class="btn sm" data-act="goalreset" data-slug="${p.slug}">${esc(T("reset_goals"))}</button>` : ""}</div></div>${grid}${mv(before, T("goal_earlier"))}${mv(after, T("goal_after"))}
  <div class="two sec"><div class="card glass"><h3>${esc(T("inventor_asks"))}</h3><ul class="clean">${p.asks.map(a => `<li>${LC(a)}</li>`).join("")}</ul></div><div class="card glass"><h3>${esc(T("kpi_count"))}</h3><p>${LC(p.kpi)}</p></div></div>`;
}
function gtmTab(p) {
  const g = p.gtm;
  if (!g) return `<p class="muted">${esc(T("no_gtm"))}</p>`;
  const card = (k, ic) => `<div class="card glass gcard"><span class="gic" aria-hidden="true">${ic}</span><h3>${esc(T("g_" + k))}</h3><p>${LC(g[k])}</p></div>`;
  return `<p class="lede" style="margin-bottom:12px">${esc(T("gtm_intro"))}</p>
  <div class="gtm4">${card("target", "1")}${card("channel", "2")}${card("offer", "3")}${card("proof", "4")}</div>
  <h3 class="sec">${esc(T("g_moves"))}</h3>
  <ol class="moves">${g.moves.map(m => `<li class="glass"><span class="when">${esc(m[0])}</span><span>${LC(m[1])}</span></li>`).join("")}</ol>
  <div class="card glass sec skills"><h3>${esc(T("g_skills"))}</h3><p>${LC(D.skills[p.pathway] || "")}</p><p class="small muted">${LC({ en: T("g_pphk"), id: T("g_pphk") })}</p></div>`;
}
function revenueTab(p) {
  const st = streams(p), sc = S.scen;
  const inc = {}; SC.forEach(s => { inc[s] = income(p, s); });
  const hasPartner = SC.some(s => inc[s].ptot > 0.5);
  const t = tl(p);
  const d = (t.first[sc] != null && p.first[sc] != null) ? t.first[sc] + S.gshift - p.first[sc] : 0;
  let tbl = `<div class="tw"><table><thead><tr><th>${esc(T("year"))}</th>${SC.map(s => `<th class="n${s === sc ? " sc-col" : ""}">${esc(T("income_binus"))}: ${esc(T(s))}</th>`).join("")}${hasPartner ? `<th class="n">${esc(T("partner_sales"))} (${esc(T(sc))})</th>` : ""}</tr></thead><tbody>`;
  Y.forEach((y, yi) => {
    tbl += `<tr><td>${y}</td>${SC.map(s => `<td class="n${s === sc ? " sc-col" : ""}">${num(inc[s].y[yi][0])}</td>`).join("")}${hasPartner ? `<td class="n">${num(inc[sc].y[yi][1])}</td>` : ""}</tr>`;
  });
  tbl += `<tr><td><b>${esc(T("total"))}</b></td>${SC.map(s => `<td class="n${s === sc ? " sc-col" : ""}"><b>${num(inc[s].tot)}</b></td>`).join("")}${hasPartner ? `<td class="n"><b>${num(inc[sc].ptot)}</b></td>` : ""}</tr></tbody></table></div>`;
  const notes = [];
  if (d) notes.push(T("shift_applied").replace("{n}", (d > 0 ? "+" : "") + d));
  if (inc[sc].after > 0.5) notes.push(T("after_note").replace("{v}", num(inc[sc].after)));
  let ed = "";
  if (!st.length) ed = `<p class="muted">${esc(T("no_income_plan"))}</p>`;
  st.forEach((s, i) => {
    const lab = L(s.label);
    let inner = `<label>${esc(s.k === "r" ? T("price_rec") : T("price"))}<input class="inp num" type="number" step="any" min="0" id="rv-${p.slug}-${i}-price" value="${s.price}" data-on="rev" data-slug="${p.slug}" data-i="${i}" data-f="price"></label>`;
    if (s.r) inner += `<label>${esc(s.k === "r" ? L(s.unit) + " (%)" : T("rate"))}<input class="inp num" type="number" step="any" min="0" max="100" id="rv-${p.slug}-${i}-rate" value="${+(s.rate * 100).toFixed(2)}" data-on="rev" data-slug="${p.slug}" data-i="${i}" data-f="rate"></label>`;
    if (s.k === "u") inner += Y.map(y => `<label>${y} (${esc(L(s.unit))})<input class="inp num" type="number" step="1" min="0" id="rv-${p.slug}-${i}-${y}" value="${+(s.u[sc][y] || 0)}" data-on="rev" data-slug="${p.slug}" data-i="${i}" data-f="u" data-y="${y}"></label>`).join("");
    else inner += `<span class="small muted">${esc(T("rec_note"))}</span>`;
    ed += `<div class="stream"><div class="stream-h"><b>${esc(lab)}</b><span class="small muted">${esc(T("income_formula_" + (s.k === "r" ? "r" : (s.r ? "royalty" : "unit"))))}</span></div><div class="sgrid">${inner}</div></div>`;
  });
  const sroi = p.sroi ? `<h3 class="sec">${esc(T("sroi"))}</h3><div class="tw"><table><thead><tr><th>${esc(T("outcome"))}</th><th>${esc(T("indicator"))}</th><th>${esc(T("proxy"))}</th></tr></thead><tbody>${p.sroi.map(r => `<tr>${r.map(c => `<td>${LC(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="note">${esc(T("sroi_note"))}</p>` : "";
  return `<h3>${esc(T("income_binus"))} (${esc(T("rp_juta"))})</h3><div class="glass pad0 tw">${tbl}</div>${notes.map(n => `<p class="note">${esc(n)}</p>`).join("")}
  <div class="sec"><div class="tlbar"><h3 style="margin:0">${esc(T("edit_assumptions"))}: ${esc(T(sc))}${S.rev[p.slug] ? `<span class="edited">${esc(T("edited"))}</span>` : ""}</h3>${S.rev[p.slug] ? `<button type="button" class="btn sm noprint" data-act="revreset" data-slug="${p.slug}">${esc(T("reset_product"))}</button>` : ""}</div><p class="note" style="margin-bottom:10px">${esc(T("rev_help"))}</p>${ed}</div>
  <div class="two sec"><div class="card glass"><h3>${esc(T("assumptions"))}</h3><ul class="clean">${p.assume.map(a => `<li>${LC(a)}</li>`).join("")}${st.length ? `<li>${esc(T("real_assume"))}</li>` : ""}</ul>${S.rev[p.slug] ? `<p class="note">${esc(T("assume_edited"))}</p>` : ""}</div><div class="card glass"><h3>${esc(T("kpi_count"))}</h3><p>${LC(p.kpi)}</p></div></div>${sroi}`;
}
function partnersTab(p) {
  const st = { comm: "st_comm", fail: "st_fail", res: "st_res", pat: "st_pat", prog: "st_prog", todo: "st_todo" };
  return `<div class="tw"><table><thead><tr><th>${esc(T("role"))}</th><th>${esc(T("who"))}</th><th>${esc(T("why_them"))}</th></tr></thead><tbody>${p.partners.map(r => `<tr><td><b>${LC(r[0])}</b></td><td>${LC(r[1])}</td><td>${LC(r[2])}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">${esc(T("cand_note"))}</p>
  <h3 class="sec">${esc(T("comparables"))}</h3><p class="note" style="margin-bottom:10px">${esc(T("comp_intro"))}</p>
  ${p.custom ? `<p class="nextact">${esc(T("comp_todo"))}</p>` : ""}<div class="comps">${p.comps.map(c => `<div class="comp glass"><span class="st st-${c.status}">${esc(T(st[c.status]))}</span><h3>${esc(L(c.name))}</h3><p>${LC(c.what)}</p><p><span class="muted">${esc(T("lesson"))}:</span> ${LC(c.lesson)}</p>${c.opp ? (/^Benchmark/.test(c.opp.en) ? `<p class="small muted">${LC(c.opp)}</p>` : `<div class="opp"><b>${esc(T("opportunity"))}</b>${LC(c.opp)}</div>`) : ""}</div>`).join("")}</div>`;
}
function resourcesTab(p) {
  const fs = fundSum(p), ls = lines(p);
  const yrs = Y.concat([2031]);
  const stOpts = sel => ["planned", "submitted", "awarded", "rejected"].map(s => `<option value="${s}"${s === sel ? " selected" : ""}>${esc(T("f_" + s))}</option>`).join("");
  const scOpts = sel => schemes().map(s => `<option value="${s.id}"${s.id === sel ? " selected" : ""}>${esc(L(s.name))}</option>`).join("");
  const rows = ls.map((l, i) => `<tr><td><select class="inp" id="fl-${p.slug}-${i}-s" data-on="fund" data-slug="${p.slug}" data-i="${i}" data-f="s" aria-label="${esc(T("scheme"))}">${scOpts(l.s)}</select></td><td><select class="inp" id="fl-${p.slug}-${i}-y" data-on="fund" data-slug="${p.slug}" data-i="${i}" data-f="y" aria-label="${esc(T("year"))}">${yrs.map(y => `<option${y === +l.y ? " selected" : ""}>${y}</option>`).join("")}</select></td><td class="n"><input class="inp num" type="number" min="0" step="any" id="fl-${p.slug}-${i}-a" value="${l.a}" data-on="fund" data-slug="${p.slug}" data-i="${i}" data-f="a" aria-label="${esc(T("amount"))}"></td><td><select class="inp" id="fl-${p.slug}-${i}-st" data-on="fund" data-slug="${p.slug}" data-i="${i}" data-f="st" aria-label="${esc(T("status_f"))}">${stOpts(l.st)}</select></td><td><button type="button" class="btn sm warn noprint" data-act="funddel" data-slug="${p.slug}" data-i="${i}">${esc(T("remove"))}</button></td></tr>`).join("");
  const mx = Math.max(fs.need[1], fs.aw + fs.pi, 1);
  return `<div class="two"><div class="card glass"><h3>${esc(T("res_needed"))}</h3><dl class="kv"><dt>${esc(T("cash"))}</dt><dd>${LC(p.res.cash)}</dd><dt>${esc(T("cash_src"))}</dt><dd>${LC(p.res.sources)}</dd><dt>${esc(T("inkind"))}</dt><dd>${LC(p.res.inkind)}</dd><dt>${esc(T("people"))}</dt><dd>${LC(p.res.people)}</dd></dl></div>
  <div class="card glass"><h3>${esc(T("fund_position"))}</h3><dl class="kv"><dt>${esc(T("need"))}</dt><dd>${rpj(fs.need[0])} - ${rpj(fs.need[1])}</dd><dt>${esc(T("awarded"))}</dt><dd>${rpj(fs.aw)}</dd><dt>${esc(T("pipeline"))}</dt><dd>${rpj(fs.pi)}</dd><dt>${esc(T("unsecured"))}</dt><dd>${fs.uns ? rpj(fs.uns) : esc(T("covered"))}</dd><dt>${esc(T("gap"))}</dt><dd><b style="color:${fs.gap ? "var(--bad)" : "var(--good)"}">${fs.gap ? rpj(fs.gap) : esc(T("covered"))}</b></dd></dl>
  <div class="bar-need" role="img" aria-label="${esc(T("awarded") + " " + rpj(fs.aw) + ", " + T("pipeline") + " " + rpj(fs.pi))}"><i class="aw" style="width:${fs.aw / mx * 100}%"></i><i class="pi" style="left:${fs.aw / mx * 100}%;width:${fs.pi / mx * 100}%"></i></div><p class="note">${esc(T("bar_legend"))}</p></div></div>
  <h3 class="sec">${esc(T("funding_plan"))}</h3>
  <div class="tw"><table><thead><tr><th>${esc(T("scheme"))}</th><th>${esc(T("year"))}</th><th class="n">${esc(T("amount"))}</th><th>${esc(T("status_f"))}</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="muted">${esc(T("no_lines"))}</td></tr>`}</tbody></table></div>
  <div class="btnrow noprint"><button type="button" class="btn sm" data-act="fundadd" data-slug="${p.slug}">${esc(T("add_line"))}</button>${S.fund[p.slug] ? `<button type="button" class="btn sm" data-act="fundreset" data-slug="${p.slug}">${esc(T("reset_product"))}</button>` : ""}<a class="btn sm" href="#/funding">${esc(T("see_schemes"))}</a></div>
  <h3 class="sec">${esc(T("helix"))}</h3><div class="helix4">${["binus", "gov", "industry", "community"].map(k => `<div><b>${esc(T(k))}</b>${LC(p.helix[k])}</div>`).join("")}</div>`;
}
function risksTab(p) {
  const sw = k => `<div class="glass sw-${k}"><h4>${esc(T(k))}</h4><ul class="clean">${p.swot[k].map(x => `<li>${LC(x)}</li>`).join("")}</ul></div>`;
  return `${p.permit ? `<div class="card glass" style="margin-bottom:12px"><h3>${esc(T("permits_apply"))}</h3><p>${LC(p.permit)}</p></div>` : ""}<div class="swot">${sw("pros")}${sw("cons")}${sw("opps")}${sw("threats")}</div>
  <h3 class="sec">${esc(T("checks"))}</h3><div class="tw"><table><thead><tr><th>${esc(T("when"))}</th><th>${esc(T("pass_if"))}</th><th>${esc(T("if_not"))}</th></tr></thead><tbody>${p.gl.map(g => `<tr><td style="white-space:nowrap"><b>${LC(g[0])}</b></td><td>${LC(g[1])}</td><td>${LC(g[2])}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">${esc(T("gate_note"))}</p>
  <div class="tlbar sec"><h3 style="margin:0">${esc(T("score_breakdown"))}</h3><a class="btn sm noprint" href="#/priority" data-act="basisgo" data-slug="${p.slug}">${esc(T("edit_basis"))}</a></div>${basisRows(p, false)}`;
}
function linksTab(p) {
  const ls = links(p);
  return `<h3>${esc(T("links"))}</h3>${ls.length ? `<ul class="linklist">${ls.map((l, i) => `<li><span><b>${esc(L(l.label))}</b><br><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url)}</a></span><button type="button" class="btn sm warn noprint" data-act="linkdel" data-slug="${p.slug}" data-i="${i}">${esc(T("remove"))}</button></li>`).join("")}</ul>` : `<p class="muted">${esc(T("no_links"))}</p>`}
  <div class="addrow noprint"><input class="inp" id="nl-label" placeholder="${esc(T("link_label"))}" aria-label="${esc(T("link_label"))}"><input class="inp" id="nl-url" type="url" placeholder="https://" aria-label="${esc(T("link_url"))}"><button type="button" class="btn sm primary" data-act="linkadd" data-slug="${p.slug}">${esc(T("add_link"))}</button></div>
  <h3 class="sec">${esc(T("share_h"))}</h3><p class="small muted">${esc(T("share_help"))}</p><div class="btnrow noprint">${PTABS.map(([k, lab]) => `<button type="button" class="btn sm" data-act="copylink" data-slug="${p.slug}" data-tab="${k}">${esc(T(lab))}</button>`).join("")}</div>`;
}
VIEWS.products = r => {
  let slug = r.a;
  if (!inP(slug)) slug = (shown()[0] || P[0] || {}).slug;
  if (!slug) return `<h1>${esc(T("no_products"))}</h1><p><a class="btn primary" href="#/add">${esc(T("add_product"))}</a></p>`;
  const tab = PTABS.some(t => t[0] === r.b) ? r.b : "plan";
  const p = BY[slug];
  const inc = SC.map(s => income(p, s).tot);
  const pr = prio(p), rk = rankMap()[slug];
  const fsel = firstEff(p, S.scen);
  const panels = { plan: planTab, gtm: gtmTab, revenue: revenueTab, partners: partnersTab, resources: resourcesTab, risks: risksTab, links: linksTab };
  const list = `<aside class="plist glass" aria-label="${esc(T("pd_list"))}"><a class="btn sm primary" href="#/add" style="width:100%;text-align:center;margin-bottom:8px">${esc(T("add_product"))}</a><input class="inp" id="pf" type="search" value="${esc(U.pf)}" placeholder="${esc(T("filter_list"))}" aria-label="${esc(T("filter_list"))}" data-in="pf">
   <select class="inp" id="pp" data-on="pp" aria-label="${esc(T("pathway"))}"><option value="">${esc(T("filter_path"))}</option>${D.pathways.map(pw => `<option value="${pw.id}"${U.pp === pw.id ? " selected" : ""}>${esc(L(pw.name))}</option>`).join("")}</select>
   ${S.hidden.length ? `<label class="chk small"><input type="checkbox" id="phid" data-on="phid" ${U.ph ? "checked" : ""}>${esc(T("show_hidden"))}</label>` : ""}
   <ul id="plist-ul">${plistUl(slug)}</ul></aside>`;
  const msel = `<a class="btn sm primary plist-sel" href="#/add" style="text-align:center;margin-bottom:8px">${esc(T("add_product"))}</a><select class="inp plist-sel" id="psel" data-on="psel" aria-label="${esc(T("pd_list"))}">${P.map(x => `<option value="${x.slug}"${x.slug === slug ? " selected" : ""}>${x.id} ${esc(short(x))}${isHidden(x) ? " (" + esc(T("hidden")) + ")" : ""}</option>`).join("")}</select>`;
  const others = SC.filter(s => s !== S.scen).map(s => `${T(s)}: ${ql(firstEff(p, s))}`).join(", ");
  const head = `<div class="ph"><div class="ph-top"><div><div class="ph-chips"><span class="chip">${p.id}</span><span class="chip">${esc(pathName(p.pathway))}</span>${p.custom ? `<span class="chip" style="color:var(--blue-d)">${esc(T("added_tag"))}</span>` : ""}${isHidden(p) ? `<span class="chip" style="color:var(--warn)">${esc(T("hidden"))}</span>` : ""}</div><h1>${esc(L(p.name))}</h1><p class="lead">${esc(L(p.lead))}</p></div>
   <div class="btnrow noprint"><button type="button" class="btn sm" data-act="copylink" data-slug="${slug}" data-tab="${tab}">${esc(T("copy_link"))}</button><button type="button" class="btn sm" data-act="print">${esc(T("print"))}</button><button type="button" class="btn sm" data-act="hidetoggle" data-slug="${slug}">${esc(isHidden(p) ? T("unhide_product") : T("hide_product"))}</button>${p.custom ? `<a class="btn sm" href="#/add/${slug}">${esc(T("edit_details"))}</a>` : ""}<button type="button" class="btn sm warn" data-act="removeprod" data-slug="${slug}">${esc(T("remove_product"))}</button></div></div>
   <div class="facts"><div class="fact glass"><span>${esc(T("first_income"))} (${esc(T(S.scen))})</span><b>${esc(ql(fsel))}</b><small>${esc(others)}</small></div>
   <div class="fact glass"><span>${esc(T("income_binus"))} 2027-2030 (${esc(T(S.scen))})</span><b>${rpj(inc[SC.indexOf(S.scen)])}</b><small>${esc(T("range"))}: ${num(Math.min(...inc))} - ${num(Math.max(...inc))}</small></div>
   <div class="fact glass"><span>${esc(T("tkt_now"))}</span><b>TKT ${tktNow(p)}</b><small>${esc(facts(p).src === "bridge" ? T("tkt_bridge") : T("tkt_est"))}</small></div>
   <div class="fact glass"><span>${esc(T("priority"))}</span><b><span class="qchip q-${pr.q}">${esc(T("q_" + pr.q))}</span> ${isHidden(p) ? "" : "#" + rk}</b><small>${esc(T("doability"))} ${num(pr.d, 1)}, ${esc(T("market"))} ${num(pr.m, 1)}</small></div></div>
   <p class="nextact"><b>${esc(T("next_action"))}:</b> ${LC(p.next)}</p>${disclaimer(true)}</div>`;
  const tabs = `<nav class="ptabs glass" role="tablist">${PTABS.map(([k, lab]) => `<a role="tab" href="#/products/${slug}/${k}" aria-selected="${k === tab}">${esc(T(lab))}</a>`).join("")}</nav>`;
  const body = PTABS.map(([k, lab]) => `<section class="tp${k === tab ? " on" : ""}" role="tabpanel" aria-label="${esc(T(lab))}"><h2 class="ptitle">${esc(T(lab))}</h2>${panels[k](p)}</section>`).join("");
  return `<div class="pv">${list}<div class="pmain">${msel}${head}${tabs}${body}</div></div>`;
};

/* ---------------- funding ---------------- */
VIEWS.funding = () => {
  const sh = shown(), scs = schemes();
  const srow = s => {
    const f = (k, w, num_) => `<input class="inp${num_ ? " num" : ""}" ${num_ ? 'type="number" min="0" step="any"' : ""} id="sch-${s.id}-${k}" value="${esc(k === "max" ? (s.max || "") : L(s[k]))}" data-on="scheme" data-id="${s.id}" data-f="${k}" aria-label="${esc(T(k === "max" ? "max" : k) + ": " + L(s.name))}"${w ? ` style="min-width:${w}px"` : ""}>`;
    const added = S.addSchemes.some(x => x.id === s.id);
    return `<tr><td>${f("name", 270)}</td><td class="n">${f("max", 0, 1)}</td><td>${f("tkt", 50)}</td><td>${f("cycle", 250)}</td><td><textarea class="inp" rows="2" id="sch-${s.id}-notes" data-on="scheme" data-id="${s.id}" data-f="notes" style="min-width:260px" aria-label="${esc(T("notes"))}">${esc(L(s.notes).replace(/\s?\[[a-z0-9]+\]/g, ""))}</textarea></td><td>${added ? `<button type="button" class="btn sm warn" data-act="schemedel" data-id="${s.id}">${esc(T("remove"))}</button>` : ""}</td></tr>`;
  };
  let tot = { need0: 0, need1: 0, aw: 0, pi: 0, gap: 0, uns: 0 };
  const prow = p => {
    const fs = fundSum(p);
    tot.need0 += fs.need[0]; tot.need1 += fs.need[1]; tot.aw += fs.aw; tot.pi += fs.pi; tot.gap += fs.gap; tot.uns += fs.uns;
    const mx = Math.max(fs.need[1], fs.aw + fs.pi, 1);
    return `<tr><td><a href="#/products/${p.slug}/resources">${esc(short(p))}</a></td><td class="n">${num(fs.need[0])} - ${num(fs.need[1])}</td><td class="n">${num(fs.aw)}</td><td class="n">${num(fs.pi)}</td><td class="n">${num(fs.uns)}</td><td class="n" style="color:${fs.gap ? "var(--bad)" : "var(--good)"}">${fs.gap ? num(fs.gap) : esc(T("covered"))}</td><td><div class="bar-need"><i class="aw" style="width:${fs.aw / mx * 100}%"></i><i class="pi" style="left:${fs.aw / mx * 100}%;width:${fs.pi / mx * 100}%"></i></div></td><td class="n">${fs.n}</td></tr>`;
  };
  const prows = sh.map(prow).join("");
  const mat = {};
  sh.forEach(p => lines(p).forEach(l => {
    if (l.st === "rejected") return;
    const k = l.s; mat[k] = mat[k] || {}; const c = mat[k][l.y] = mat[k][l.y] || [0, 0]; c[0] += +l.a || 0; c[1]++;
  }));
  const yrs = Y.concat([2031]);
  const used = scs.filter(s => mat[s.id]);
  const cell = c => c ? `${num(c[0])} <span class="muted">(${c[1]})</span>` : "";
  const coltot = yrs.map(y => used.reduce((a, s) => { const c = mat[s.id][y]; return c ? [a[0] + c[0], a[1] + c[1]] : a; }, [0, 0]));
  return `<div class="vhead"><div><h1>${esc(T("fu_h"))}</h1><p class="lede">${esc(T("fu_intro"))}</p></div></div>
  <h2>${esc(T("fu_summary"))}</h2>
  <div class="tw glass pad0"><table><thead><tr><th>${esc(T("product"))}</th><th class="n">${esc(T("need"))}</th><th class="n">${esc(T("awarded"))}</th><th class="n">${esc(T("pipeline"))}</th><th class="n">${esc(T("unsecured"))}</th><th class="n">${esc(T("gap"))}</th><th>${esc(T("position"))}</th><th class="n">${esc(T("lines"))}</th></tr></thead><tbody>${prows}
  <tr><td><b>${esc(T("total"))}</b></td><td class="n"><b>${num(tot.need0)} - ${num(tot.need1)}</b></td><td class="n"><b>${num(tot.aw)}</b></td><td class="n"><b>${num(tot.pi)}</b></td><td class="n"><b>${num(tot.uns)}</b></td><td class="n"><b>${num(tot.gap)}</b></td><td></td><td></td></tr></tbody></table></div>
  <p class="note">${esc(T("rp_juta"))}. ${esc(T("bar_legend"))} ${esc(T("fund_note"))}</p>
  <h2 class="sec">${esc(T("by_scheme_year"))}</h2>
  <div class="tw glass pad0"><table><thead><tr><th>${esc(T("scheme"))}</th>${yrs.map(y => `<th class="n">${y === 2031 ? "2031+" : y}</th>`).join("")}</tr></thead><tbody>${used.map(s => `<tr><td>${esc(L(s.name))}</td>${yrs.map(y => `<td class="n">${cell(mat[s.id][y])}</td>`).join("")}</tr>`).join("")}<tr><td><b>${esc(T("total"))}</b></td>${coltot.map(c => `<td class="n"><b>${cell(c[1] ? c : null)}</b></td>`).join("")}</tr></tbody></table></div>
  <p class="note">${esc(T("rp_juta"))}. ${esc(T("matrix_note"))}</p>
  <h2 class="sec">${esc(T("schemes_h"))}</h2><p class="note" style="margin-bottom:8px">${esc(T("schemes_help"))}</p>
  <div class="tw glass pad0"><table><thead><tr><th>${esc(T("name"))}</th><th class="n">${esc(T("max"))}</th><th>${esc(T("tkt"))}</th><th>${esc(T("cycle"))}</th><th>${esc(T("notes"))}</th><th></th></tr></thead><tbody>${scs.map(srow).join("")}</tbody></table></div>
  <div class="btnrow"><button type="button" class="btn sm" data-act="schemeadd">${esc(T("add_scheme"))}</button>${Object.keys(S.schemes).length || S.addSchemes.length ? `<button type="button" class="btn sm" data-act="schemereset">${esc(T("reset_schemes"))}</button>` : ""}</div>
  <h3 class="sec">${esc(T("scheme_sources"))}</h3><ul class="clean small">${D.schemes.map(s => `<li><b>${esc(L(s.name))}</b>: ${LC(s.notes)}</li>`).join("")}</ul>`;
};

/* ---------------- guide ---------------- */
VIEWS.guide = () => {
  const paths = D.pathways.map(pw => `<div class="path glass"><h3>${esc(L(pw.name))}</h3><p class="who">${esc(L(pw.who))}</p><p class="small">${LC(pw.idea)}</p><ol>${pw.steps.map(s => `<li>${esc(L(s))}</li>`).join("")}</ol><p class="small"><b>${esc(T("g_skills"))}:</b> ${esc(L(D.skills[pw.id] || ""))}</p><p class="ex">${P.filter(p => p.pathway === pw.id).map(p => `<a href="#/products/${p.slug}">${esc(short(p))}</a>`).join(", ")}</p></div>`).join("");
  return `<div class="vhead"><div><h1>${esc(T("gd_h"))}</h1><p class="lede">${esc(T("gd_intro"))}</p></div></div>
  <h2>${esc(T("gd_pathways"))}</h2><div class="paths">${paths}</div>
  <h2 class="sec">${esc(T("gd_start"))}</h2><ul class="clean">${D.checklist.map(c => `<li>${esc(L(c))}</li>`).join("")}</ul>
  <h2 class="sec">${esc(T("gd_permits"))}</h2><div class="tw glass pad0"><table><thead><tr><th>${esc(T("type"))}</th><th>${esc(T("required"))}</th><th>${esc(T("applies_to"))}</th></tr></thead><tbody>${D.regulatory.map(r => `<tr><td><b>${esc(L(r.type))}</b></td><td>${LC(r.req)}</td><td>${esc(L(r.applies))}</td></tr>`).join("")}</tbody></table></div>
  <h2 class="sec">${esc(T("gd_helix"))}</h2><div class="tw glass pad0"><table><tbody>${D.helix.map(h => `<tr><td style="width:180px"><b>${esc(L(h.who))}</b></td><td>${LC(h.role)}</td></tr>`).join("")}</tbody></table></div>`;
};

/* ---------------- sources ---------------- */
VIEWS.sources = () => `<div class="vhead"><div><h1>${esc(T("src_h"))}</h1><p class="lede">${esc(T("src_intro"))}</p></div></div>
  <ol class="srcs">${D.sources.map((s, i) => `<li id="src-${i + 1}"><span class="sn">${i + 1}.</span><span>${esc(s.t)}<br><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.u.replace(/^https?:\/\//, "").slice(0, 90))}</a></span></li>`).join("")}</ol>`;

/* ---------------- side panel: settings or timeline editor ---------------- */
function renderPanel() {
  const pn = byId("panel");
  let title = "", body = "";
  if (U.panel === "settings") {
    title = T("settings");
    body = `<p class="small muted">${esc(T("saved_note"))}</p><h3>${esc(T("show_products"))}</h3>
    <div class="btnrow"><button type="button" class="btn sm" data-act="showall">${esc(T("show_all"))}</button><button type="button" class="btn sm" data-act="hideall">${esc(T("hide_all"))}</button></div>
    ${D.pathways.map(pw => `<div class="grp">${esc(L(pw.name))}</div>${P.filter(p => p.pathway === pw.id).map(p => `<label class="chk"><input type="checkbox" id="hc-${p.slug}" data-on="hide" data-slug="${p.slug}" ${isHidden(p) ? "" : "checked"}><span><span class="muted">${p.id}</span> ${esc(short(p))}</span></label>`).join("")}`).join("")}
    <div class="btnrow sec"><a class="btn sm primary" href="#/add" data-act="close">${esc(T("add_product"))}</a></div>
    ${(S.removed || []).length ? `<h3 class="sec">${esc(T("removed_h"))}</h3>${S.removed.map(s => BY[s] ? `<div class="chk" style="justify-content:space-between"><span><span class="muted">${BY[s].id}</span> ${esc(short(BY[s]))}</span><button type="button" class="btn sm" data-act="restore" data-slug="${s}">${esc(T("restore"))}</button></div>` : "").join("")}` : ""}
    <h3 class="sec">${esc(T("data_h"))}</h3>
    <div class="btnrow"><button type="button" class="btn sm" data-act="export">${esc(T("export"))}</button><button type="button" class="btn sm" data-act="import">${esc(T("import"))}</button><button type="button" class="btn sm warn" data-act="resetall">${esc(T("reset_all"))}</button></div>
    <p class="small muted">${esc(T("export_help"))}</p>`;
  } else if (U.panel && U.panel.slug) {
    const p = BY[U.panel.slug], t = tl(p);
    title = T("edit_phase") + ": " + short(p);
    const ph = sel => PH.map(x => `<option value="${x}"${x === sel ? " selected" : ""}>${esc(T("phase_" + x))}</option>`).join("");
    const lo = Math.min(0, ...t.seg.map(s => s[0])), hi = Math.max(15, ...t.seg.map(s => s[1]));
    body = `<p class="small muted">${esc(T("drawer_hint"))}${S.gshift ? " " + esc(T("gshift_note").replace("{n}", (S.gshift > 0 ? "+" : "") + S.gshift)) : ""}</p>
    <div class="btnrow"><span class="small" style="align-self:center">${esc(T("shift_this"))}</span><button type="button" class="btn sm" data-act="shift" data-slug="${p.slug}" data-d="-1">&#9664; ${esc(T("earlier"))}</button><button type="button" class="btn sm" data-act="shift" data-slug="${p.slug}" data-d="1">${esc(T("later"))} &#9654;</button></div>
    <h3 class="sec">${esc(T("first_by_scen"))}</h3>
    ${SC.map(sc => `<div class="frow"><label for="fi-${sc}">${esc(T(sc))}</label><select class="inp" id="fi-${sc}" data-on="first" data-slug="${p.slug}" data-sc="${sc}">${qopts(t.first[sc], true, lo, hi)}</select></div>`).join("")}
    <h3 class="sec">${esc(T("phases"))}</h3>
    <div class="drow small muted"><span>${esc(T("phase"))}</span><span>${esc(T("start"))}</span><span>${esc(T("end"))}</span><span></span></div>
    ${t.seg.map((s, i) => `<div class="drow"><select class="inp" id="sg-${i}-p" data-on="seg" data-slug="${p.slug}" data-i="${i}" data-f="2" aria-label="${esc(T("phase"))}">${ph(s[2])}</select><select class="inp" id="sg-${i}-a" data-on="seg" data-slug="${p.slug}" data-i="${i}" data-f="0" aria-label="${esc(T("start"))}">${qopts(s[0], false, lo, hi)}</select><select class="inp" id="sg-${i}-b" data-on="seg" data-slug="${p.slug}" data-i="${i}" data-f="1" aria-label="${esc(T("end"))}">${qopts(s[1], false, lo, hi)}</select><button type="button" class="btn sm warn" data-act="segdel" data-slug="${p.slug}" data-i="${i}" aria-label="${esc(T("remove"))}">&#215;</button></div>`).join("")}
    <div class="btnrow"><button type="button" class="btn sm" data-act="segadd" data-slug="${p.slug}">${esc(T("add_phase"))}</button></div>
    <h3 class="sec">${esc(T("checks"))}</h3>
    ${t.gates.map((g, i) => `<div class="grow"><select class="inp" id="gt-${i}-q" data-on="gate" data-slug="${p.slug}" data-i="${i}" data-f="0" aria-label="${esc(T("when"))}">${qopts(g[0], false, lo, hi)}</select><input class="inp" id="gt-${i}-l" value="${esc(L(g[1]))}" data-on="gate" data-slug="${p.slug}" data-i="${i}" data-f="1" aria-label="${esc(T("gate"))}"><button type="button" class="btn sm warn" data-act="gatedel" data-slug="${p.slug}" data-i="${i}" aria-label="${esc(T("remove"))}">&#215;</button></div>`).join("")}
    <div class="btnrow"><button type="button" class="btn sm" data-act="gateadd" data-slug="${p.slug}">${esc(T("add_gate"))}</button></div>
    <div class="btnrow sec"><button type="button" class="btn sm warn" data-act="tlreset" data-slug="${p.slug}" ${t.edited ? "" : "disabled"}>${esc(T("reset_product"))}</button><a class="btn sm" href="#/products/${p.slug}/plan" data-act="close">${esc(T("open_plan"))}</a></div>`;
  }
  const ae = document.activeElement, fid = ae && ae.id && pn.contains(ae) ? ae.id : null;
  pn.innerHTML = `<div class="panel-h"><h2 id="panel-h" style="margin:0">${esc(title)}</h2><button type="button" class="iconbtn" data-act="close" aria-label="${esc(T("close"))}">&#215;</button></div><div class="panel-b">${body}</div>`;
  pn.classList.add("on"); byId("scrim").classList.add("on");
  if (fid && byId(fid)) byId(fid).focus(); else if (!pn.contains(document.activeElement)) pn.querySelector("[data-act=close]").focus();
}
function openPanel(what, opener) { U.panel = what; U.opener = opener || null; renderPanel(); }
function closePanel() {
  U.panel = null; byId("panel").classList.remove("on"); byId("scrim").classList.remove("on");
  if (U.opener && document.body.contains(U.opener)) U.opener.focus();
}

/* ---------------- mutations ---------------- */
function changed() { save(); clearTimeout(changed._t); changed._t = setTimeout(render, 0); }
function tlMut(slug, fn) {
  const p = BY[slug], t = tl(p);
  const o = { seg: t.seg.map(s => s.slice()), gates: t.gates.map(g => [g[0], g[1]]), first: Object.assign({}, t.first), qs: t.qs };
  fn(o);
  S.tl[slug] = o; changed();
}
function toast(msg) {
  const t = byId("toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2200);
}
function copyText(txt) {
  const ok = () => toast(T("copied"));
  const fallback = () => {
    const ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); ok(); } catch (e) { toast(txt); }
    document.body.removeChild(ta);
  };
  try { navigator.clipboard.writeText(txt).then(ok, fallback); } catch (e) { fallback(); }
}

const ACT = {
  simple: () => { S.simple = !S.simple; U.anim = true; changed(); },
  searchopen: () => { const n = byId("nav"); n.classList.toggle("searching"); if (n.classList.contains("searching")) byId("q").focus(); },
  lang: b => { if (S.lang === b.dataset.v) return; S.lang = b.dataset.v; U.anim = true; changed(); },
  scen: b => { if (S.scen === b.dataset.v) return; S.scen = b.dataset.v; U.anim = true; changed(); },
  basis: b => { U.scoresOpen = true; U.basis = b.dataset.slug; render(); setTimeout(() => { const el = byId("basis-box"); if (el) el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); }, 30); },
  basisgo: b => { U.scoresOpen = true; U.basis = b.dataset.slug; U.jumpBasis = true; location.hash = "#/priority"; },
  factreset: b => { delete S.facts[b.dataset.slug]; changed(); },
  rubricopen: () => { U.rubricOpen = !U.rubricOpen; render(); },
  mjumpgo: b => { U.jumpTo = b.dataset.k; if (route().v === "sources") { const el = byId("m-" + b.dataset.k); if (el) el.scrollIntoView({ behavior: "smooth" }); } else location.hash = "#/sources"; },
  settings: b => openPanel("settings", b),
  close: () => closePanel(),
  drawer: b => openPanel({ slug: b.dataset.slug }, b),
  tledit: () => { U.tlEditing = !U.tlEditing; render(); },
  gshift: b => { S.gshift += +b.dataset.d; changed(); },
  shift: b => { const d = +b.dataset.d; tlMut(b.dataset.slug, o => { o.seg.forEach(s => { s[0] += d; s[1] += d; }); o.gates.forEach(g => { g[0] += d; }); SC.forEach(sc => { if (o.first[sc] != null) o.first[sc] += d; }); o.qs += d; }); },
  segadd: b => tlMut(b.dataset.slug, o => { const last = o.seg[o.seg.length - 1]; const a = last ? last[1] + 1 : 0; o.seg.push([a, Math.max(a, 15), "scale"]); }),
  segdel: b => tlMut(b.dataset.slug, o => { o.seg.splice(+b.dataset.i, 1); }),
  gateadd: b => tlMut(b.dataset.slug, o => { o.gates.push([7, T("gate")]); }),
  gatedel: b => tlMut(b.dataset.slug, o => { o.gates.splice(+b.dataset.i, 1); }),
  tlreset: b => { delete S.tl[b.dataset.slug]; changed(); },
  hidetoggle: b => { const s = b.dataset.slug; const i = S.hidden.indexOf(s); if (i >= 0) S.hidden.splice(i, 1); else S.hidden.push(s); changed(); },
  showall: () => { S.hidden = []; changed(); },
  hideall: () => { S.hidden = P.map(p => p.slug); changed(); },
  export: () => {
    const blob = new Blob([JSON.stringify({ app: "binus-roadmap", v: 2, saved: new Date().toISOString(), state: S }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "binus-roadmap-settings.json";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(T("export_done"));
  },
  import: () => byId("importfile").click(),
  resetall: () => { if (confirm(T("reset_confirm"))) { const l = S.lang; S = defState(); S.lang = l; changed(); } },
  copylink: b => copyText(location.href.split("#")[0] + "#/products/" + b.dataset.slug + "/" + (b.dataset.tab || "plan")),
  print: () => window.print(),
  revreset: b => { delete S.rev[b.dataset.slug]; changed(); },
  fundadd: b => { const p = BY[b.dataset.slug]; const ls = lines(p).map(l => Object.assign({}, l)); ls.push({ s: "pib", y: 2027, a: 0, st: "planned" }); S.fund[p.slug] = ls; changed(); },
  funddel: b => { const p = BY[b.dataset.slug]; const ls = lines(p).map(l => Object.assign({}, l)); ls.splice(+b.dataset.i, 1); S.fund[p.slug] = ls; changed(); },
  fundreset: b => { delete S.fund[b.dataset.slug]; changed(); },
  linkadd: b => {
    const lab = byId("nl-label").value.trim(); let url = byId("nl-url").value.trim();
    if (!url) { byId("nl-url").focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const p = BY[b.dataset.slug]; const ls = links(p).slice(); ls.push({ label: lab || url, url }); S.links[p.slug] = ls; changed();
  },
  linkdel: b => { const p = BY[b.dataset.slug]; const ls = links(p).slice(); ls.splice(+b.dataset.i, 1); S.links[p.slug] = ls; changed(); },
  schemeadd: () => { const id = "u" + Date.now().toString(36); S.addSchemes.push({ id, name: T("new_scheme"), max: 0, tkt: "", cycle: "", notes: "" }); changed(); },
  schemedel: b => { S.addSchemes = S.addSchemes.filter(s => s.id !== b.dataset.id); delete S.schemes[b.dataset.id]; changed(); },
  schemereset: () => { S.schemes = {}; S.addSchemes = []; changed(); },
  sort: b => { const k = b.dataset.k; if (U.sort.k === k) U.sort.dir *= -1; else U.sort = { k, dir: k === "name" || k === "first" ? 1 : -1 }; render(); },
  scoresopen: () => { U.scoresOpen = !U.scoresOpen; render(); },
  wopen: () => { U.wOpen = !U.wOpen; render(); },
  wreset: () => { S.w = defState().w; changed(); },
  scorereset: () => { S.scores = {}; changed(); },
  go: b => { closeSearch(); byId("q").value = ""; location.hash = "#/products/" + b.dataset.slug; },
};

function factSet(slug, fn) {
  const o = S.facts[slug] = Object.assign({}, S.facts[slug] || {});
  fn(o, facts(BY[slug]));
  changed();
}
const ON = {
  fact: el => factSet(el.dataset.slug, o => { const f = el.dataset.f; o[f] = (f === "tkt" || f === "reg" || f === "cash") ? Math.max(0, +el.value || 0) : el.value; }),
  factev: el => factSet(el.dataset.slug, (o, cur) => { const ev = cur.ev.slice(); ev[+el.dataset.i] = el.checked ? 1 : 0; o.ev = ev; }),
  factm: el => factSet(el.dataset.slug, (o, cur) => { const m = cur.m.slice(); m[+el.dataset.i] = +el.value; o.m = m; }),
  basissel: el => { U.basis = el.value; render(); },
  hide: el => { const s = el.dataset.slug; S.hidden = S.hidden.filter(x => x !== s); if (!el.checked) S.hidden.push(s); changed(); },
  first: el => tlMut(el.dataset.slug, o => { o.first[el.dataset.sc] = el.value === "" ? null : +el.value; }),
  seg: el => tlMut(el.dataset.slug, o => { const f = +el.dataset.f; o.seg[+el.dataset.i][f] = f === 2 ? el.value : +el.value; const s = o.seg[+el.dataset.i]; if (s[1] < s[0]) { if (f === 0) s[1] = s[0]; else s[0] = s[1]; } o.seg.sort((a, b) => a[0] - b[0]); }),
  gate: el => tlMut(el.dataset.slug, o => { const f = +el.dataset.f; o.gates[+el.dataset.i][f] = f === 0 ? +el.value : el.value; }),
  rev: el => {
    const s = el.dataset.slug, i = +el.dataset.i, f = el.dataset.f;
    let v = parseFloat(String(el.value).replace(",", "."));
    if (!isFinite(v) || v < 0) v = 0;
    const o = S.rev[s] = S.rev[s] || {};
    const x = o[i] = o[i] || {};
    if (f === "price") x.price = v;
    else if (f === "rate") x.rate = Math.min(v, 100) / 100;
    else { x.u = x.u || {}; x.u[S.scen] = x.u[S.scen] || {}; x.u[S.scen][el.dataset.y] = Math.round(v); }
    changed();
  },
  score: el => {
    const p = BY[el.dataset.slug], sc = scores(p);
    const o = { d: sc.d.slice(), m: sc.m.slice() };
    let v = Math.round(+el.value); if (!(v >= 1)) v = 1; if (v > 5) v = 5;
    o[el.dataset.t][+el.dataset.i] = v; S.scores[p.slug] = o; changed();
  },
  fund: el => {
    const p = BY[el.dataset.slug]; const ls = lines(p).map(l => Object.assign({}, l));
    const f = el.dataset.f; ls[+el.dataset.i][f] = f === "a" ? Math.max(0, +el.value || 0) : f === "y" ? +el.value : el.value;
    S.fund[p.slug] = ls; changed();
  },
  scheme: el => {
    const id = el.dataset.id, f = el.dataset.f;
    const add = S.addSchemes.find(s => s.id === id);
    const v = f === "max" ? (+el.value || 0) : el.value;
    if (add) add[f] = v; else { S.schemes[id] = S.schemes[id] || {}; S.schemes[id][f] = v; }
    changed();
  },
  pp: el => { U.pp = el.value; render(); },
  phid: el => { U.ph = el.checked; render(); },
  psel: el => { location.hash = "#/products/" + el.value; },
};
const IN = {
  split: el => { S.w.split = +el.value; save(); byId("wv-split").textContent = `${S.w.split}% / ${100 - S.w.split}%`; byId("prio-out").innerHTML = prioOut(); },
  w: el => { S.w[el.dataset.t][+el.dataset.i] = +el.value; save(); byId("wv-" + el.dataset.t + "-" + el.dataset.i).textContent = el.value; byId("prio-out").innerHTML = prioOut(); },
  pf: el => { U.pf = el.value; const r = route(); byId("plist-ul").innerHTML = plistUl(BY[r.a] ? r.a : (shown()[0] || P[0]).slug); },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (b && ACT[b.dataset.act]) {
    if (b.tagName === "A" && b.dataset.act !== "close") e.preventDefault();
    ACT[b.dataset.act](b, e);
  }
  if (!e.target.closest(".search")) closeSearch();
});
document.addEventListener("change", e => { const el = e.target.closest("[data-on]"); if (el && ON[el.dataset.on]) ON[el.dataset.on](el); });
document.addEventListener("input", e => { const el = e.target.closest("[data-in]"); if (el && IN[el.dataset.in]) IN[el.dataset.in](el); });
byId("scrim").addEventListener("click", closePanel);
byId("importfile").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const o = JSON.parse(rd.result); const st = o.state || o;
      if (typeof st !== "object" || Array.isArray(st)) throw new Error("bad");
      S = Object.assign(defState(), st); changed(); toast(T("import_done"));
    } catch (err) { toast(T("import_bad")); }
    e.target.value = "";
  };
  rd.readAsText(f);
});

/* ---------------- search ---------------- */
let sIdx = -1;
function searchHits(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const toks = q.split(/\s+/);
  const out = [];
  P.forEach(p => {
    const name = (p.name.en + " " + p.name.id + " " + p.short.en + " " + p.short.id + " " + p.id).toLowerCase();
    const lead = p.lead.en.toLowerCase();
    const partners = p.partners.map(x => x[1].en).join(" ").toLowerCase();
    const comps = p.comps.map(c => c.name.en + " " + c.name.id).join(" ").toLowerCase();
    const all = name + " " + lead + " " + partners + " " + comps + " " + L(p.now).toLowerCase();
    if (!toks.every(t => all.indexOf(t) >= 0)) return;
    let score = 0, why = "";
    if (toks.every(t => name.indexOf(t) >= 0)) score = 3;
    else if (toks.every(t => lead.indexOf(t) >= 0)) { score = 2; why = L(p.lead); }
    else if (toks.every(t => partners.indexOf(t) >= 0)) { score = 1.5; why = T("why_partner") + ": " + p.partners.map(x => L(x[1])).find(w => toks.every(t => w.toLowerCase().indexOf(t) >= 0)) || ""; }
    else if (toks.every(t => comps.indexOf(t) >= 0)) { score = 1.2; why = T("comparables") + ": " + L((p.comps.find(c => toks.every(t => (c.name.en + " " + c.name.id).toLowerCase().indexOf(t) >= 0)) || {}).name); }
    else { score = 1; why = L(p.lead); }
    out.push({ p, score, why });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
function renderSearch() {
  const q = byId("q").value, box = byId("sres");
  if (!q.trim()) { closeSearch(); return; }
  const hits = searchHits(q);
  sIdx = hits.length ? 0 : -1;
  box.innerHTML = hits.length ? hits.map((h, i) => `<button type="button" role="option" data-act="go" data-slug="${h.p.slug}" aria-selected="${i === 0}"><span class="sn">${h.p.id} ${esc(short(h.p))}${isHidden(h.p) ? ` <span class="muted small">(${esc(T("hidden"))})</span>` : ""}</span><span class="sm">${esc((h.why || L(h.p.lead)).slice(0, 110))}</span></button>`).join("") : `<div class="none">${esc(T("no_results"))}</div>`;
  box.classList.add("on");
  byId("q").setAttribute("aria-expanded", "true");
}
function closeSearch() { byId("sres").classList.remove("on"); byId("q").setAttribute("aria-expanded", "false"); }
byId("q").addEventListener("input", renderSearch);
byId("q").addEventListener("focus", () => { if (byId("q").value.trim()) renderSearch(); });
byId("q").addEventListener("keydown", e => {
  const opts = [...byId("sres").querySelectorAll("button")];
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (!opts.length) return; e.preventDefault();
    sIdx = (sIdx + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
    opts.forEach((o, i) => o.setAttribute("aria-selected", i === sIdx));
  } else if (e.key === "Enter") {
    if (opts[sIdx]) { e.preventDefault(); ACT.go(opts[sIdx]); byId("q").blur(); }
  } else if (e.key === "Escape") { closeSearch(); byId("q").blur(); }
});
document.addEventListener("keydown", e => {
  if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); byId("q").focus(); }
  if (e.key === "Escape" && U.panel) closePanel();
});

/* ---------------- tooltip ---------------- */
const tip = byId("tip");
function showTip(el, x, y) {
  const t = el.getAttribute("data-tip"); if (!t) return;
  tip.textContent = t; tip.style.display = "block";
  const r = tip.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
  tip.style.left = Math.max(8, left) + "px"; tip.style.top = Math.max(8, top) + "px";
}
document.addEventListener("mouseover", e => { const el = e.target.closest("[data-tip]"); if (el) showTip(el, e.clientX, e.clientY); else tip.style.display = "none"; });
document.addEventListener("mousemove", e => { if (tip.style.display === "block") { const el = e.target.closest("[data-tip]"); if (el) showTip(el, e.clientX, e.clientY); } });
document.addEventListener("focusin", e => { const el = e.target.closest("[data-tip]"); if (el) { const r = el.getBoundingClientRect(); showTip(el, r.left, r.bottom); } });
document.addEventListener("focusout", () => { tip.style.display = "none"; });
window.addEventListener("scroll", () => { tip.style.display = "none"; }, { passive: true });

window.addEventListener("hashchange", () => { U.anim = true; render(); });
window.addEventListener("resize", () => { clearTimeout(window._rz); window._rz = setTimeout(() => { renderChrome(route(), true); LIQ.scan(); }, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { renderChrome(route(), true); LIQ.scan(); });
POST.push(() => {
  if (U.jumpBasis && route().v === "priority") { U.jumpBasis = false; const el = byId("basis-box"); if (el) el.scrollIntoView({ block: "start" }); }
  if (U.jumpTo && route().v === "sources") { const el = byId("m-" + U.jumpTo); U.jumpTo = null; if (el) setTimeout(() => el.scrollIntoView({ block: "start" }), 30); }
});
window.addEventListener("beforeprint", () => { tip.style.display = "none"; });

/* ================= add / edit / remove products ================= */
const tt = (en, id) => ({ en, id });
const TYPES = {
  food: tt("Processed food or drink", "Pangan atau minuman olahan"),
  herbal: tt("Herbal medicine or supplement", "Obat bahan alam atau suplemen"),
  medical: tt("Medical device or health software", "Alat kesehatan atau perangkat lunak kesehatan"),
  device: tt("Machine, appliance or electronic device", "Mesin, peralatan, atau perangkat elektronik"),
  software: tt("Software, app or data service", "Perangkat lunak, aplikasi, atau layanan data"),
  material: tt("Material or craft product", "Material atau produk kerajinan"),
  design: tt("Architecture or built environment", "Arsitektur atau lingkungan binaan"),
  social: tt("Education or community programme", "Program pendidikan atau komunitas"),
  other: tt("Other", "Lainnya"),
};
const TYPE_PATH = { food: "P1", herbal: "P1", material: "P1", medical: "P4", device: "P2", software: "P3", social: "P3", design: "P5", other: "P1" };
const MODELS = {
  royalty: tt("Licence: upfront fee plus royalty on the licensee's sales", "Lisensi: biaya awal dan royalti dari penjualan pemegang lisensi"),
  share: tt("Licence: share of the partner's subscriptions", "Lisensi: bagi hasil langganan mitra"),
  direct: tt("Direct sales by BINUS Creates", "Penjualan langsung oleh BINUS Creates"),
  service: tt("Packages with yearly renewals (BINUS Creates)", "Paket dengan perpanjangan tahunan (BINUS Creates)"),
  design: tt("Design licence fee per project", "Biaya lisensi desain per proyek"),
  none: tt("No income planned yet", "Belum ada pendapatan yang direncanakan"),
};
const PRICE_LAB = {
  royalty: tt("Licensee net price per unit (Rp juta)", "Harga bersih pemegang lisensi per unit (Rp juta)"),
  share: tt("Partner price per site per year (Rp juta)", "Harga mitra per lokasi per tahun (Rp juta)"),
  direct: tt("Price per unit sold (Rp juta)", "Harga per unit terjual (Rp juta)"),
  service: tt("Package price per new site (Rp juta)", "Harga paket per lokasi baru (Rp juta)"),
  design: tt("Licence fee per project (Rp juta)", "Biaya lisensi per proyek (Rp juta)"),
  none: tt("Price (Rp juta)", "Harga (Rp juta)"),
};
const VOL_LAB = {
  royalty: tt("Units sold in 2030, optimistic", "Unit terjual pada 2030, optimis"),
  share: tt("Paying sites in 2030, optimistic", "Lokasi berbayar pada 2030, optimis"),
  direct: tt("Units sold in 2030, optimistic", "Unit terjual pada 2030, optimis"),
  service: tt("New sites in 2030, optimistic", "Lokasi baru pada 2030, optimis"),
  design: tt("Projects licensed in 2030, optimistic", "Proyek berlisensi pada 2030, optimis"),
  none: tt("Volume", "Volume"),
};
const IPS = { none: tt("None yet", "Belum ada"), secret: tt("Trade secret", "Rahasia dagang"), filed: tt("Patent filed", "Paten diajukan"), copyright: tt("Copyright or design registered", "Hak cipta atau desain terdaftar"), granted: tt("Patent or PVT granted", "Paten atau PVT diberikan") };
const PARTS = { none: tt("None yet", "Belum ada"), candidate: tt("Candidates identified", "Kandidat sudah teridentifikasi"), mou: tt("LoI or MoU signed", "LoI atau MoU ditandatangani"), agreement: tt("Agreement signed", "Perjanjian ditandatangani") };
const EVID = {
  proto: tt("Working prototype", "Prototipe berfungsi"),
  users: tt("Tested with real users or in the field", "Sudah diuji dengan pengguna nyata atau di lapangan"),
  tested: tt("Published or independently tested results", "Hasil terpublikasi atau diuji pihak independen"),
  cost: tt("Unit cost or bill of materials known", "Biaya per unit atau daftar komponen diketahui"),
};

/* phase lengths by pathway: prove [low TRL<=4, mid 5-6, high 7+], partner, sell */
const PLEN = { P1: [[6, 4, 1], 4, 3], P2: [[7, 4, 2], 4, 4], P3: [[4, 2, 1], 1, 4], P4: [[10, 8, 6], 4, 3], P5: [[4, 3, 2], 4, 3] };
const GOALS = {
  P1: {
    prove: [tt("Confirm IP status, inventors and owner. Document the formula and process as SOP or trade secret.", "Pastikan status HKI, inventor, dan pemilik. Dokumentasikan formula dan proses sebagai SOP atau rahasia dagang."),
      tt("Shelf life, safety and composition tests at an accredited lab.", "Uji umur simpan, keamanan, dan komposisi di laboratorium terakreditasi."),
      tt("User or sensory panel. Fix the claim wording the regulator allows.", "Panel pengguna atau sensoris. Tetapkan kalimat klaim yang diizinkan regulator."),
      tt("Pilot batch at a contract manufacturer. Estimate the cost of goods.", "Produksi pilot di maklon. Perkirakan harga pokok."),
      tt("Licensing pack: evidence summary, process SOP, term sheet.", "Paket lisensi: ringkasan bukti, SOP proses, term sheet.")],
    partner: [tt("Shortlist 3 to 5 licensees. List on BPOM BRIDGE where relevant.", "Daftar pendek 3 sampai 5 calon pemegang lisensi. Tayangkan di BPOM BRIDGE bila relevan."),
      tt("Term sheets with the strongest candidates.", "Term sheet dengan kandidat terkuat."),
      tt("Licence signed: upfront fee, royalty base and quarterly reporting.", "Lisensi ditandatangani: biaya awal, dasar royalti, dan laporan kuartalan."),
      tt("Licensee files permits (BPOM, halal or others) and scales up.", "Pemegang lisensi mengurus izin (BPOM, halal, atau lainnya) dan meningkatkan skala.")],
    sell: [tt("Market launch with the licensee. First royalty.", "Peluncuran ke pasar bersama pemegang lisensi. Royalti pertama."),
      tt("First quarterly royalty report reviewed.", "Laporan royalti kuartalan pertama ditinjau."),
      tt("Channel review with the licensee: what sells and where.", "Tinjauan saluran bersama pemegang lisensi: apa yang laku dan di mana."),
      tt("Second channel or region.", "Saluran atau wilayah kedua.")],
    scale: [tt("Second licence in another category or region.", "Lisensi kedua di kategori atau wilayah lain."),
      tt("Royalty audit and licence review.", "Audit royalti dan tinjauan lisensi."),
      tt("Line extension or improved version with the licensee.", "Perluasan lini atau versi perbaikan bersama pemegang lisensi."),
      tt("Export check through the licensee.", "Cek ekspor melalui pemegang lisensi."),
      tt("Annual review: renew, expand or stop.", "Tinjauan tahunan: perpanjang, perluas, atau hentikan.")],
  },
  P2: {
    prove: [tt("Confirm IP, inventors and the full bill of materials.", "Pastikan HKI, inventor, dan daftar komponen lengkap."),
      tt("Performance validation: failure rate, safety and energy use.", "Validasi kinerja: tingkat kegagalan, keselamatan, dan pemakaian energi."),
      tt("Trials with 3 or more real users. Measure time or cost saved.", "Uji coba dengan 3 pengguna nyata atau lebih. Ukur waktu atau biaya yang dihemat."),
      tt("Freeze the design. Cost per unit at target volume.", "Bekukan desain. Biaya per unit pada volume sasaran."),
      tt("Go or no-go on unit cost and user feedback. Shortlist manufacturers.", "Lanjut atau berhenti berdasarkan biaya unit dan masukan pengguna. Daftar pendek produsen.")],
    partner: [tt("Licence term sheet with a manufacturer.", "Term sheet lisensi dengan produsen."),
      tt("Design for production with the manufacturer.", "Rancang untuk produksi bersama produsen."),
      tt("Certification: SNI, TKDN, and Komdigi if wireless.", "Sertifikasi: SNI, TKDN, dan Komdigi jika nirkabel."),
      tt("Pre-series units built and tested.", "Unit pra-seri dibuat dan diuji.")],
    sell: [tt("Launch to first buyers. First royalty or sale.", "Peluncuran ke pembeli pertama. Royalti atau penjualan pertama."),
      tt("Service and spare-parts plan.", "Rencana layanan dan suku cadang."),
      tt("e-Katalog listing if public buyers are targeted.", "Penayangan e-Katalog jika menyasar pembeli pemerintah."),
      tt("Second production batch.", "Batch produksi kedua.")],
    scale: [tt("Cost-down redesign.", "Rancang ulang untuk menekan biaya."), tt("New buyer segment or region.", "Segmen pembeli atau wilayah baru."),
      tt("Service contracts and renewals.", "Kontrak layanan dan perpanjangan."), tt("Licence review.", "Tinjauan lisensi."),
      tt("Annual review: renew, expand or stop.", "Tinjauan tahunan: perpanjang, perluas, atau hentikan.")],
  },
  P3: {
    prove: [tt("Confirm ownership of code, data and content. Data protection check (UU PDP).", "Pastikan kepemilikan kode, data, dan konten. Cek perlindungan data (UU PDP)."),
      tt("Field test with real users: accuracy, usage or impact measured.", "Uji lapangan dengan pengguna nyata: akurasi, pemakaian, atau dampak diukur."),
      tt("One package, one price, one support SOP.", "Satu paket, satu harga, satu SOP dukungan.")],
    partner: [tt("Channel partner selected: a firm or funder that already reaches the customer.", "Mitra saluran dipilih: perusahaan atau pemberi dana yang sudah menjangkau pelanggan.")],
    sell: [tt("First paid customers.", "Pelanggan berbayar pertama."), tt("Usage data and support review.", "Tinjauan data pemakaian dan dukungan."),
      tt("Renewal offer to first customers.", "Tawaran perpanjangan ke pelanggan pertama."), tt("Price review.", "Tinjauan harga.")],
    scale: [tt("Second channel partner or region.", "Mitra saluran atau wilayah kedua."), tt("Version 2 based on usage data.", "Versi 2 berdasarkan data pemakaian."),
      tt("Renewals.", "Perpanjangan."), tt("Impact or outcome report.", "Laporan dampak atau hasil."),
      tt("Annual review: spin-off, licence or keep in BINUS Creates.", "Tinjauan tahunan: spin-off, lisensi, atau tetap di BINUS Creates.")],
  },
  P4: {
    prove: [tt("Fix the intended use and claims. Confirm data and model ownership.", "Tetapkan tujuan penggunaan dan klaim. Pastikan kepemilikan data dan model."),
      tt("Quality and risk files. Ethical clearance through BINUS Conscience.", "Berkas mutu dan risiko. Persetujuan etik melalui BINUS Conscience."),
      tt("Prospective validation study starts at 2 or more sites.", "Studi validasi prospektif dimulai di 2 lokasi atau lebih."),
      tt("Interim analysis.", "Analisis antara."), tt("Enrolment continues.", "Perekrutan peserta berlanjut."),
      tt("Repeatability and inter-device tests.", "Uji keterulangan dan antarperangkat."),
      tt("Final analysis against pre-set thresholds.", "Analisis akhir terhadap ambang yang ditetapkan sebelumnya."), tt("Go or no-go.", "Lanjut atau berhenti.")],
    partner: [tt("Licensee selected: a company able to hold the marketing authorization.", "Pemegang lisensi dipilih: perusahaan yang dapat memegang izin edar."),
      tt("Authorization dossier prepared (Kepmenkes 951/2026 for AI software).", "Dosier izin edar disiapkan (Kepmenkes 951/2026 untuk perangkat lunak AI)."),
      tt("Marketing authorization filed by the licensee.", "Izin edar diajukan oleh pemegang lisensi."), tt("Licence signed: upfront fee.", "Lisensi ditandatangani: biaya awal.")],
    sell: [tt("Paid launch in one clinic or hospital network.", "Peluncuran berbayar di satu jaringan klinik atau rumah sakit."),
      tt("First subscription or royalty income.", "Pendapatan langganan atau royalti pertama."), tt("Post-market performance monitoring.", "Pemantauan kinerja pascapasar.")],
    scale: [tt("Public health channel through Dinkes.", "Saluran kesehatan masyarakat melalui Dinkes."), tt("Update under change control.", "Pembaruan dengan kendali perubahan."),
      tt("Second region.", "Wilayah kedua."), tt("Renewals.", "Perpanjangan."), tt("Annual review.", "Tinjauan tahunan.")],
  },
  P5: {
    prove: [tt("Settle co-author rights. Confirm the rights holder.", "Bereskan hak rekan pencipta. Pastikan pemegang hak."),
      tt("Engineer and cost the design: BIM, systems, cost per unit.", "Hitung teknis dan biaya desain: BIM, sistem, biaya per unit."),
      tt("Permit check and design variants.", "Cek perizinan dan varian desain.")],
    partner: [tt("Developer MoU for a show unit.", "MoU dengan pengembang untuk unit contoh."), tt("Construction drawings with the developer.", "Gambar kerja bersama pengembang."),
      tt("Build the show unit.", "Bangun unit contoh."), tt("Sensors installed; monitoring starts.", "Sensor dipasang; pemantauan dimulai.")],
    sell: [tt("First design licence.", "Lisensi desain pertama."), tt("12-month monitoring report.", "Laporan pemantauan 12 bulan."), tt("Second licence.", "Lisensi kedua.")],
    scale: [tt("Design variants.", "Varian desain."), tt("Licences in more projects.", "Lisensi di proyek tambahan."),
      tt("Training for developer teams.", "Pelatihan untuk tim pengembang."), tt("Review.", "Tinjauan.")],
  },
};
const FILLER = {
  prove: tt("Close gaps from the last review; update the evidence file.", "Tutup kekurangan dari tinjauan terakhir; perbarui berkas bukti."),
  partner: tt("Follow up partner negotiations and permit work.", "Tindak lanjuti negosiasi mitra dan pengurusan izin."),
  sell: tt("Track sales and customer feedback.", "Pantau penjualan dan masukan pelanggan."),
};
const GATE = {
  P1: [tt("Test results meet the spec", "Hasil uji memenuhi spesifikasi"), tt("Shelf life, safety and panel results meet the target spec.", "Umur simpan, keamanan, dan hasil panel memenuhi spesifikasi sasaran."), tt("Reformulate before any licensee outreach.", "Reformulasi sebelum mendekati calon pemegang lisensi.")],
  P2: [tt("Unit cost and user feedback", "Biaya unit dan masukan pengguna"), tt("Failure rate, safety and unit cost meet targets; users would buy at the target price.", "Tingkat kegagalan, keselamatan, dan biaya unit memenuhi target; pengguna bersedia membeli pada harga sasaran."), tt("Stay in research or license the design as open hardware.", "Tetap di tahap riset atau lisensikan desain sebagai open hardware.")],
  P3: [tt("Field accuracy or impact", "Akurasi atau dampak lapangan"), tt("Field data shows the accuracy or impact customers need.", "Data lapangan menunjukkan akurasi atau dampak yang dibutuhkan pelanggan."), tt("Fix the product before selling packages.", "Perbaiki produk sebelum menjual paket.")],
  P4: [tt("Clinical thresholds", "Ambang klinis"), tt("Pre-registered accuracy thresholds are met across subgroups.", "Ambang akurasi yang didaftarkan sebelumnya terpenuhi di semua subkelompok."), tt("Extend the study or pivot to a research tool; no licensing.", "Perpanjang studi atau beralih menjadi alat riset; tidak ada lisensi.")],
  P5: [tt("Design costed and permits clear", "Desain terhitung dan izin jelas"), tt("Cost per unit fits the target buyer and permits are clear.", "Biaya per unit sesuai pembeli sasaran dan perizinan jelas."), tt("Redesign before approaching developers.", "Rancang ulang sebelum mendekati pengembang.")],
};
const KPI_T = {
  P1: tt("Counts as Product Commercialized when the first licence is signed and paid.", "Dihitung sebagai Product Commercialized saat lisensi pertama ditandatangani dan dibayar."),
  P2: tt("Counts when the manufacturing licence is signed and first units are sold.", "Dihitung saat lisensi manufaktur ditandatangani dan unit pertama terjual."),
  P3: tt("Counts on the first paid customer or site.", "Dihitung saat pelanggan atau lokasi berbayar pertama."),
  P4: tt("Counts when the licence is signed and paid, usually after authorization work starts.", "Dihitung saat lisensi ditandatangani dan dibayar, biasanya setelah pengurusan izin edar dimulai."),
  P5: tt("Counts on the first design licence.", "Dihitung saat lisensi desain pertama."),
};
const HELIX_T = {
  binus: tt("RTT confirms IP and leads partner matching and licensing; BINUS Creates contracts and collects income; KMI tells the story.", "RTT memastikan HKI dan memimpin pencocokan mitra serta lisensi; BINUS Creates mengontrak dan menagih pendapatan; KMI menyampaikan ceritanya."),
  gov: { food: tt("BPOM and BPJPH; Kemdiktisaintek funding.", "BPOM dan BPJPH; pendanaan Kemdiktisaintek."), herbal: tt("BPOM (jamu, OHT, fitofarmaka); Kemdiktisaintek funding.", "BPOM (jamu, OHT, fitofarmaka); pendanaan Kemdiktisaintek."),
    medical: tt("Kemenkes (marketing authorization, SATUSEHAT); Kemdiktisaintek funding.", "Kemenkes (izin edar, SATUSEHAT); pendanaan Kemdiktisaintek."), device: tt("Kemenperin (SNI, TKDN); Komdigi if wireless; LKPP e-Katalog.", "Kemenperin (SNI, TKDN); Komdigi jika nirkabel; e-Katalog LKPP."),
    software: tt("Data protection rules (UU PDP); public buyers through e-Katalog.", "Aturan pelindungan data (UU PDP); pembeli pemerintah melalui e-Katalog."), social: tt("Pemda, Dinas Pendidikan or village governments as buyers and partners.", "Pemda, Dinas Pendidikan, atau pemerintah desa sebagai pembeli dan mitra."),
    design: tt("Kementerian PKP housing programmes; Pemda building approvals.", "Program perumahan Kementerian PKP; perizinan bangunan Pemda."), material: tt("Kemenperin craft programmes; BRIN funding and labs.", "Program kerajinan Kemenperin; pendanaan dan laboratorium BRIN."), other: tt("[ISI]", "[ISI]") },
  industry: { P1: tt("Licensee manufactures and sells; contract manufacturer runs pilots.", "Pemegang lisensi memproduksi dan menjual; maklon menjalankan produksi pilot."), P2: tt("Manufacturer builds and sells; buyers and service partners.", "Produsen membuat dan menjual; pembeli dan mitra layanan."), P3: tt("Channel partners and paying customers.", "Mitra saluran dan pelanggan berbayar."), P4: tt("Health-tech or device licensee; hospital groups.", "Pemegang lisensi health-tech atau alat kesehatan; grup rumah sakit."), P5: tt("Developers and system suppliers.", "Pengembang dan pemasok sistem.") },
  community: tt("Users who test and adopt it; related associations and media.", "Pengguna yang menguji dan mengadopsi; asosiasi terkait dan media."),
};
const PERMIT_T = {
  food: D.regulatory[0].req, herbal: D.regulatory[1].req, medical: D.regulatory[2].req, device: D.regulatory[3].req,
  software: D.regulatory[5].req, social: D.regulatory[5].req,
  design: tt("Building approval (PBG) through the local government for each project.", "Persetujuan bangunan gedung (PBG) dari pemerintah daerah untuk setiap proyek."),
  material: tt("No product permit expected; check labelling and consumer protection rules.", "Tidak ada izin produk khusus; cek aturan label dan perlindungan konsumen."),
  other: tt("[ISI] Check which permits apply.", "[ISI] Cek izin yang berlaku."),
};

const GTM_CH = {
  P1: tt("Direct pitches to manufacturers with permits in the category; BPOM BRIDGE for food and herbal formulas; industry associations.", "Presentasi langsung ke produsen yang punya izin di kategori ini; BPOM BRIDGE untuk formula pangan dan herbal; asosiasi industri."),
  P2: tt("Manufacturer R&D teams; first buyers through associations and procurement; e-Katalog for public buyers.", "Tim R&D produsen; pembeli pertama melalui asosiasi dan pengadaan; e-Katalog untuk pembeli pemerintah."),
  P3: tt("A channel partner that already reaches the customer; paid pilots; public or CSR programmes.", "Mitra saluran yang sudah menjangkau pelanggan; uji coba berbayar; program pemerintah atau CSR."),
  P4: tt("Specialist societies and teaching hospitals; health-tech firms that can hold the permit; Kemenkes sandbox.", "Perhimpunan spesialis dan rumah sakit pendidikan; perusahaan health-tech yang dapat memegang izin; sandbox Kemenkes."),
  P5: tt("Developer associations (REI); IAI; housing and urban programmes.", "Asosiasi pengembang (REI); IAI; program perumahan dan perkotaan."),
};
const GTM_OF = {
  royalty: tt("Licence with upfront fee and royalty, plus the evidence file.", "Lisensi dengan biaya awal dan royalti, beserta berkas bukti."),
  share: tt("Licence with revenue share on subscriptions.", "Lisensi dengan bagi hasil langganan."),
  direct: tt("Product sold by BINUS Creates with support.", "Produk dijual BINUS Creates beserta dukungan."),
  service: tt("Package with installation, training and yearly renewal.", "Paket dengan pemasangan, pelatihan, dan perpanjangan tahunan."),
  design: tt("Design licence per project after a monitored pilot.", "Lisensi desain per proyek setelah contoh yang dipantau."),
  none: tt("[ISI] Offer to be defined.", "[ISI] Penawaran belum ditentukan."),
};
function spreadGoals(items, L, filler) {
  const out = [];
  if (L <= 0) return out;
  const n = items.length;
  if (L >= n) {
    const pos = items.map((_, k) => Math.round(k * (L - 1) / Math.max(1, n - 1)));
    for (let q = 0; q < L; q++) {
      const k = pos.indexOf(q);
      out.push(k >= 0 ? items[k] : filler);
    }
  } else {
    for (let q = 0; q < L; q++) {
      const a = Math.floor(q * n / L), b = Math.floor((q + 1) * n / L);
      const grp = items.slice(a, b);
      out.push(tt(grp.map(g => g.en).join(" "), grp.map(g => g.id).join(" ")));
    }
  }
  return out;
}
function rampUnits(V, first, factor, counts) {
  const u = {};
  if (first == null || first > 15 || !(V > 0)) return u;
  const fy = Math.floor(first / 4), n = 4 - fy;
  const shares = { 1: [1], 2: [0.4, 1], 3: [0.2, 0.55, 1], 4: [0.12, 0.35, 0.65, 1] }[n];
  shares.forEach((s, k) => {
    let v = V * factor * s;
    if (k === 0) v *= (4 - first % 4) / 4;
    v = counts ? Math.max(1, Math.round(v)) : (v < 20 ? Math.max(1, Math.round(v)) : Math.round(v / (v < 1000 ? 1 : 10)) * (v < 1000 ? 1 : 10));
    u[2027 + fy + k] = v;
  });
  return u;
}
function oneIn(first) { const o = {}; if (first != null && first <= 15) o[2027 + Math.floor(first / 4)] = 1; return o; }
function slugify(s) { return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 40) || "product"; }

function generateProduct(inp, prev) {
  const pw = inp.pathway, trl = +inp.trl || 4;
  const g = trl <= 4 ? 0 : trl <= 6 ? 1 : 2;
  const pl = PLEN[pw];
  let a = pl[0][g], pa = pl[1], se = pl[2];
  if (inp.partner === "agreement") pa = pw === "P3" ? 0 : 1;
  else if (inp.partner === "mou") pa = Math.max(pw === "P3" ? 0 : 1, pa - 1);
  const b = a + pa, c = b + se;
  const seg = [[0, a - 1, "prove"]];
  if (pa > 0) seg.push([a, b - 1, "partner"]);
  seg.push([b, c - 1, "sell"]);
  if (c <= 15) seg.push([c, 15, "scale"]);
  const fo = b, fr = b + 1, fp = b + (pw === "P4" ? 4 : 2);
  const first = { opt: fo, real: fr, pess: fp };
  const G = GOALS[pw];
  let q = [].concat(spreadGoals(G.prove, a, FILLER.prove), spreadGoals(G.partner, pa, FILLER.partner), spreadGoals(G.sell, se, FILLER.sell));
  let k = 0;
  while (q.length < 16) { q.push(G.scale[k % G.scale.length]); k++; }
  q = q.slice(0, 16);
  const gq = a - 1;
  const gates = gq >= 0 && gq <= 15 ? [[gq, GATE[pw][0]]] : [];
  const gl = gates.length ? [[tt(ql(gq), ql(gq)), GATE[pw][1], GATE[pw][2]]] : [];

  /* revenue */
  const price = +inp.price || 0, rate = (+inp.rate || 0) / 100, up = +inp.upfront || 0, V = +inp.volume || 0;
  const unitL = tt(inp.unit || "units", inp.unit || "unit");
  const streams = [];
  const triple = (counts) => ({ pess: rampUnits(V, first.pess, 0.5, counts), real: rampUnits(V, first.real, 0.75, counts), opt: rampUnits(V, first.opt, 1, counts) });
  const feeS = () => up > 0 ? streams.push({ k: "u", label: tt("Upfront licence fee", "Biaya lisensi awal"), unit: tt("licences", "lisensi"), price: up, rate: 1, r: false, u: { pess: oneIn(first.pess), real: oneIn(first.real), opt: oneIn(first.opt) } }) : 0;
  const m = inp.model;
  if (m === "royalty" && price > 0 && V > 0) { streams.push({ k: "u", label: tt("Royalty on licensee sales", "Royalti dari penjualan pemegang lisensi"), unit: unitL, price, rate: rate || 0.03, r: true, u: triple(false) }); feeS(); }
  else if (m === "share" && price > 0 && V > 0) { streams.push({ k: "u", label: tt("Share of partner subscriptions", "Bagi hasil langganan mitra"), unit: unitL, price, rate: rate || 0.1, r: true, u: triple(false) }); feeS(); }
  else if (m === "direct" && price > 0 && V > 0) streams.push({ k: "u", label: tt("Sales by BINUS Creates", "Penjualan oleh BINUS Creates"), unit: unitL, price, rate: 1, r: false, u: triple(true) });
  else if (m === "service" && price > 0 && V > 0) {
    streams.push({ k: "u", label: tt("New site packages", "Paket lokasi baru"), unit: unitL, price, rate: 1, r: false, u: triple(true) });
    if (+inp.renewal > 0) streams.push({ k: "r", label: tt("Renewals of earlier sites", "Perpanjangan lokasi lama"), unit: tt("renewal rate", "tingkat perpanjangan"), price: +inp.renewal, rate: 0.7, ref: 0, incl: false, per: 1, r: true });
  } else if (m === "design" && price > 0 && V > 0) streams.push({ k: "u", label: tt("Project design licences", "Lisensi desain per proyek"), unit: tt("projects", "proyek"), price, rate: 1, r: false, u: triple(true) });
  const noInc = !streams.length;
  if (noInc) { first.opt = first.real = first.pess = null; }
  const assume = [];
  if (!noInc) {
    const pr = num(price, price < 1 ? 3 : 0);
    if (m === "royalty") assume.push(tt(`Royalty ${num(rate * 100 || 3, 1)}% of the licensee's net sales; net price Rp${pr} juta per unit.`, `Royalti ${num(rate * 100 || 3, 1)}% dari penjualan bersih pemegang lisensi; harga bersih Rp${pr} juta per unit.`));
    if (m === "share") assume.push(tt(`BINUS receives ${num(rate * 100 || 10, 1)}% of a Rp${pr} juta per site per year subscription.`, `BINUS menerima ${num(rate * 100 || 10, 1)}% dari langganan Rp${pr} juta per lokasi per tahun.`));
    if (m === "direct" || m === "service" || m === "design") assume.push(tt(`Price Rp${pr} juta per ${L(unitL)}; income shown is sales before cost.`, `Harga Rp${pr} juta per ${L(unitL)}; pendapatan yang ditampilkan adalah penjualan sebelum biaya.`));
    if (up > 0 && (m === "royalty" || m === "share")) assume.push(tt(`Upfront licence fee Rp${num(up)} juta in the first income year.`, `Biaya lisensi awal Rp${num(up)} juta pada tahun pendapatan pertama.`));
    if (m === "service" && +inp.renewal > 0) assume.push(tt(`Renewal Rp${num(+inp.renewal)} juta per site per year; 70% of earlier sites renew.`, `Perpanjangan Rp${num(+inp.renewal)} juta per lokasi per tahun; 70% lokasi lama memperpanjang.`));
    assume.push(tt(`Optimistic: ${num(V)} ${L(unitL)} in 2030, ramping up from first income. Realistic: 75% of that, one quarter later. Pessimistic: 50%, ${pw === "P4" ? "four" : "two"} quarters later.`,
      `Optimis: ${num(V)} ${unitL.id} pada 2030, naik bertahap sejak pendapatan pertama. Realistis: 75% dari itu, satu kuartal lebih lambat. Pesimis: 50%, ${pw === "P4" ? "empat" : "dua"} kuartal lebih lambat.`));
    assume.push(tt("Generated from the product profile. Replace with real terms once a partner signs.", "Dihasilkan dari profil produk. Ganti dengan ketentuan nyata setelah mitra menandatangani."));
  } else assume.push(tt("No income planned yet. Add a business model in the product details when it is clear.", "Belum ada pendapatan yang direncanakan. Tambahkan model bisnis di rincian produk jika sudah jelas."));

  /* scores */
  const ev = inp.evid || [];
  const d = [trl <= 3 ? 1 : trl <= 5 ? 2 : trl === 6 ? 3 : trl === 7 ? 4 : 5,
    Math.min(5, 1 + ev.length),
    { none: 1, secret: 2, filed: 3, copyright: 3, granted: 4 }[inp.ip] || 1,
    { none: 1, candidate: 2, mou: 3, agreement: 5 }[inp.partner] || 1,
    { food: 4, herbal: 3, medical: 1, device: 3, software: 4, material: 5, design: 3, social: 5, other: 3 }[inp.type] || 3,
    0];
  const cmax = +inp.cashMax || 0;
  d[5] = cmax <= 200 ? 5 : cmax <= 400 ? 4 : cmax <= 800 ? 3 : cmax <= 1500 ? 2 : 1;
  const mS = (inp.m || [3, 3, 3, 3]).slice(0, 4).map(x => Math.min(5, Math.max(1, +x || 3)));
  const regL = { food: 4, herbal: 3, medical: 1, device: 3, software: 5, material: 5, design: 4, social: 5, other: 3 }[inp.type] || 3;
  const factsObj = { tkt: trl, src: "est", ev: ["proto", "users", "tested", "cost"].map(k => ev.indexOf(k) >= 0 ? 1 : 0),
    ip: { none: "none", secret: "secret", filed: "filed", copyright: "registered", granted: "granted" }[inp.ip] || "none",
    partner: { none: "none", candidate: "candidate", mou: "mou", agreement: "active" }[inp.partner] || "none",
    reg: regL, m: mS, mb: [0, 1, 2, 3].map(() => tt("Rated in the product form.", "Dinilai di formulir produk.")), tb: tt("Entered in the product form; confirm with the research team.", "Diisi di formulir produk; pastikan dengan tim peneliti.") };

  /* funding suggestion */
  const cmin = +inp.cashMin || 0;
  const main = pw === "P4" ? (trl >= 6 ? "pengujian" : "pib") : pw === "P3" ? (inp.type === "social" ? "csr" : "pib") : pw === "P5" ? "dortek" : (trl >= 6 ? "dortek" : "riim");
  const round10 = x => Math.round(x / 10) * 10;
  const fund = cmin > 0 ? [{ s: main, y: pw === "P4" && trl >= 6 ? 2028 : 2027, a: round10(cmin * 0.7), st: "planned" },
    { s: inp.partner !== "none" ? "partner" : "pib", y: 2027, a: round10(cmin * 0.3), st: "planned" }] : [];

  /* partners */
  const known = (inp.partners || "").trim(), cust = (inp.customers || "").trim();
  const P_ = {
    P1: [[tt("Licensee candidates", "Kandidat pemegang lisensi"), known || "[ISI]", tt("They own production, permits and buyers in this category.", "Mereka punya produksi, izin, dan pembeli di kategori ini.")],
      [tt("Contract manufacturer", "Maklon"), tt("GMP or HACCP-certified contract manufacturers", "Maklon bersertifikat GMP atau HACCP"), tt("Pilot batches before licensing.", "Produksi pilot sebelum lisensi.")]],
    P2: [[tt("Manufacturer", "Produsen"), known || tt("[ISI] Indonesian manufacturers or contract manufacturers in this category", "[ISI] Produsen atau maklon Indonesia di kategori ini"), tt("Tooling, certification and after-sales capacity.", "Cetakan, sertifikasi, dan kapasitas purnajual.")],
      [tt("First buyers", "Pembeli pertama"), cust || "[ISI]", tt("Early paying users who validate the price.", "Pengguna berbayar awal yang memvalidasi harga.")]],
    P3: [[tt("Channel partner", "Mitra saluran"), known || "[ISI]", tt("Already sells to or funds the customer.", "Sudah menjual ke atau mendanai pelanggan.")],
      [tt("First customers", "Pelanggan pertama"), cust || "[ISI]", tt("Paid pilots that prove the value.", "Uji coba berbayar yang membuktikan nilainya.")]],
    P4: [[tt("Clinical", "Klinis"), tt("Teaching hospitals and specialist societies; BINUS Medical School", "Rumah sakit pendidikan dan perhimpunan spesialis; BINUS Medical School"), tt("Study sites and reference standard.", "Lokasi studi dan standar acuan.")],
      [tt("Licensee candidates", "Kandidat pemegang lisensi"), known || tt("[ISI] Health-tech or medical device companies able to hold the permit", "[ISI] Perusahaan health-tech atau alat kesehatan yang dapat memegang izin"), tt("A company must hold the marketing authorization.", "Harus ada perusahaan yang memegang izin edar.")]],
    P5: [[tt("Developers", "Pengembang"), known || tt("[ISI] Housing developers and REI members", "[ISI] Pengembang perumahan dan anggota REI"), tt("Land for a show unit and buyers.", "Lahan untuk unit contoh dan pembeli.")],
      [tt("Professional", "Profesi"), tt("IAI (Indonesian Institute of Architects)", "IAI (Ikatan Arsitek Indonesia)"), tt("Standards and promotion.", "Standar dan promosi.")]],
  }[pw].slice();
  if (cust && pw === "P1") P_.push([tt("Target customers", "Pelanggan sasaran"), cust, tt("Who the licensee will sell to.", "Kepada siapa pemegang lisensi akan menjual.")]);
  if (inp.type === "food" || inp.type === "herbal") P_.push([tt("Matchmaking", "Pencocokan"), tt("BPOM BRIDGE", "BPOM BRIDGE"), tt("Lists finished formulas for industry pick-up.", "Menawarkan formula jadi untuk diambil industri.")]);
  const partners = P_.map(r => r.map(x => typeof x === "string" ? tt(x, x) : x));

  /* swot */
  const pros = [], cons = [];
  if (ev.indexOf("proto") >= 0) pros.push(tt("A working prototype exists.", "Prototipe yang berfungsi sudah ada."));
  if (ev.indexOf("users") >= 0) pros.push(tt("Already tested with real users or in the field.", "Sudah diuji dengan pengguna nyata atau di lapangan."));
  if (ev.indexOf("tested") >= 0) pros.push(tt("Published or independently tested results.", "Hasil terpublikasi atau diuji pihak independen."));
  if (inp.ip === "granted") pros.push(tt("IP granted.", "HKI sudah diberikan."));
  if (inp.partner === "mou" || inp.partner === "agreement") pros.push(tt("A partner is already engaged.", "Mitra sudah terlibat."));
  if (trl >= 7) pros.push(tt(`High technical readiness (TRL ${trl}).`, `Kesiapan teknologi tinggi (TRL ${trl}).`));
  if (trl <= 4) cons.push(tt(`Early readiness (TRL ${trl}); most evidence is still to build.`, `Kesiapan masih awal (TRL ${trl}); sebagian besar bukti masih harus dibangun.`));
  if (inp.ip === "none") cons.push(tt("IP not yet protected.", "HKI belum dilindungi."));
  if (ev.indexOf("cost") < 0) cons.push(tt("Unit cost not yet known.", "Biaya per unit belum diketahui."));
  if (inp.partner === "none") cons.push(tt("No partner yet.", "Belum ada mitra."));
  const opps = inp.opp ? [tt(inp.opp, inp.opp)] : [tt("[ISI] Market or policy opportunity with a source.", "[ISI] Peluang pasar atau kebijakan beserta sumbernya.")];
  const thr = { P1: tt("Copycats once the product is on shelf; trade secret and the licensee's brand matter.", "Peniru setelah produk ada di rak; rahasia dagang dan merek pemegang lisensi menentukan."), P2: tt("Imported products may undercut on price.", "Produk impor bisa lebih murah."), P3: tt("Free or open-source alternatives.", "Alternatif gratis atau sumber terbuka."), P4: tt("Clinical validation and authorization can take years.", "Validasi klinis dan izin edar bisa memakan waktu bertahun-tahun."), P5: tt("Maintenance falls on residents or users; abandoned systems hurt the story.", "Perawatan jatuh ke penghuni atau pengguna; sistem yang terbengkalai merusak cerita.") };
  const threats = [thr[pw]];
  if (inp.type === "medical") threats.push(tt("No diagnosis or treatment claims before authorization.", "Tidak boleh ada klaim diagnosis atau pengobatan sebelum izin edar."));
  if (inp.type === "food" || inp.type === "herbal") threats.push(tt("BPOM limits health claims.", "BPOM membatasi klaim kesehatan."));
  threats.push(tt("[ISI] Competitors to verify through a comparables search.", "[ISI] Pesaing yang perlu diverifikasi lewat penelusuran pembanding."));

  const comps = (inp.comps || "").split(/\n+/).map(s => s.trim()).filter(Boolean).map(nm => ({ name: tt(nm, nm), status: "todo", what: tt("[ISI] What it is, status and price.", "[ISI] Apa produknya, status, dan harganya."), lesson: tt("[ISI]", "[ISI]"), opp: null }));
  const pwo = D.pathways.find(x => x.id === pw);
  const strip = s => s.replace(/\s*\[[a-z0-9]+\]/g, "");
  const path = tt(strip(pwo.idea.en) + (cust ? " Target customers: " + cust + "." : ""), strip(pwo.idea.id) + (cust ? " Pelanggan sasaran: " + cust + "." : ""));
  const name = inp.name.trim(), shortN = (inp.short || "").trim() || name;
  return {
    custom: true, input: inp, id: prev ? prev.id : nextId(), slug: prev ? prev.slug : uniqueSlug(name), pathway: pw,
    name: tt(name, name), short: tt(shortN, shortN), lead: tt(inp.lead || "[ISI]", inp.lead || "[ISI]"),
    now: tt(inp.now || "[ISI]", inp.now || "[ISI]"), path, seg, gates, first, q, streams, assume, sroi: null,
    kpi: KPI_T[pw], partners,
    res: { cash: cmax ? tt(`Rp${num(cmin)}-${num(cmax)} juta over 2027-2030.`, `Rp${num(cmin)}-${num(cmax)} juta selama 2027-2030.`) : tt("[ISI]", "[ISI]"),
      sources: tt(fund.map(f => schemeName(f.s)).join("; ") || "[ISI]", fund.map(f => schemeName(f.s)).join("; ") || "[ISI]"),
      inkind: tt(inp.lab || "[ISI] Labs, facilities and student support.", inp.lab || "[ISI] Laboratorium, fasilitas, dan dukungan mahasiswa."),
      people: tt("Inventor team; RTT Commercialization Section; IP Section.", "Tim inventor; Seksi Komersialisasi RTT; Seksi HKI.") },
    helix: { binus: HELIX_T.binus, gov: HELIX_T.gov[inp.type] || HELIX_T.gov.other, industry: HELIX_T.industry[pw], community: HELIX_T.community },
    swot: { pros: pros.length ? pros : [tt("[ISI]", "[ISI]")], cons: cons.length ? cons : [tt("[ISI]", "[ISI]")], opps, threats },
    comps, gl,
    asks: [tt("Inventor and contributor list.", "Daftar inventor dan kontributor."), tt("IP documents or filing numbers.", "Dokumen HKI atau nomor permohonan."), tt("Current test data and evidence file.", "Data uji dan berkas bukti terkini."), tt("Cost or bill of materials.", "Biaya atau daftar komponen.")],
    links: inp.url ? [{ label: tt("Product page", "Halaman produk"), url: inp.url }] : [],
    scores: { d, m: mS.concat([1]) }, facts: factsObj, next: q[0], cash: [cmin, cmax || cmin], fund, permit: PERMIT_T[inp.type] || PERMIT_T.other,
    gtm: { target: cust ? tt(cust, cust) : tt("[ISI] Target customers and partners.", "[ISI] Pelanggan dan mitra sasaran."),
      channel: GTM_CH[pw], offer: GTM_OF[m] || GTM_OF.none,
      proof: GATE[pw][1],
      moves: [0, 1, 2].map(i => [ql(i), q[i]]) },
  };
}
function nextId() {
  const ids = D.products.concat(S.custom || []).map(p => parseInt(p.id, 10)).filter(n => !isNaN(n));
  return String(Math.max(16, ...ids) + 1).padStart(2, "0");
}
function uniqueSlug(name) {
  let base = "x-" + slugify(name), s = base, k = 2;
  while (BY[s]) s = base + "-" + k++;
  return s;
}

/* ---------------- form ---------------- */
VIEWS.add = r => {
  const prev = r.a && BY[r.a] && BY[r.a].custom ? BY[r.a] : null;
  const v = prev ? prev.input : { type: "food", pathway: "P1", trl: 5, ip: "none", partner: "none", evid: [], model: "royalty", rate: 3, upfront: 50, m: [3, 3, 3, 3, 3] };
  const val = k => esc(v[k] == null ? "" : v[k]);
  const opt = (obj, sel) => Object.keys(obj).map(k => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(L(obj[k]))}</option>`).join("");
  const fld = (id, lab, inner, help) => `<label class="fld" for="af-${id}"><span>${esc(lab)}</span>${inner}${help ? `<small>${esc(help)}</small>` : ""}</label>`;
  const inp = (id, type, extra) => `<input class="inp" id="af-${id}" name="${id}" type="${type || "text"}" value="${val(id)}" ${extra || ""}>`;
  const ta = (id, rows, ph) => `<textarea class="inp" id="af-${id}" name="${id}" rows="${rows}" placeholder="${esc(ph || "")}">${val(id)}</textarea>`;
  const mk = v.model || "royalty";
  return `<div class="vhead"><div><h1>${esc(prev ? T("edit_product_h") : T("add_product_h"))}</h1><p class="lede">${esc(T("add_intro"))}</p></div></div>
  <form id="addform" class="addform" data-slug="${prev ? prev.slug : ""}" novalidate>
   <fieldset><legend>${esc(T("af_basics"))}</legend><div class="fgrid">
    ${fld("name", T("af_name") + " *", inp("name", "text", 'required maxlength="120"'))}
    ${fld("short", T("af_short"), inp("short", "text", 'maxlength="40"'), T("af_short_h"))}
    ${fld("lead", T("af_lead"), inp("lead"))}
    ${fld("url", T("af_url"), inp("url", "url", 'placeholder="https://"'))}
    <div class="span2">${fld("now", T("now"), ta("now", 2, T("af_now_ph")))}</div>
   </div></fieldset>
   <fieldset><legend>${esc(T("af_route"))}</legend><div class="fgrid">
    ${fld("type", T("af_type"), `<select class="inp" id="af-type" name="type" data-on="aftype">${opt(TYPES, v.type)}</select>`, T("af_type_h"))}
    ${fld("pathway", T("pathway"), `<select class="inp" id="af-pathway" name="pathway">${D.pathways.map(p => `<option value="${p.id}"${p.id === v.pathway ? " selected" : ""}>${esc(L(p.name))}</option>`).join("")}</select>`)}
    ${fld("trl", T("af_trl"), `<select class="inp" id="af-trl" name="trl">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<option${n === +v.trl ? " selected" : ""}>${n}</option>`).join("")}</select>`, T("af_trl_h"))}
    ${fld("ip", T("af_ip"), `<select class="inp" id="af-ip" name="ip">${opt(IPS, v.ip)}</select>`)}
    ${fld("partner", T("af_partner"), `<select class="inp" id="af-partner" name="partner">${opt(PARTS, v.partner)}</select>`)}
    <div class="fld"><span>${esc(T("af_evid"))}</span>${Object.keys(EVID).map(k => `<label class="chk"><input type="checkbox" name="evid" value="${k}"${(v.evid || []).indexOf(k) >= 0 ? " checked" : ""}>${esc(L(EVID[k]))}</label>`).join("")}</div>
   </div></fieldset>
   <fieldset><legend>${esc(T("af_money"))}</legend><div class="fgrid">
    <div class="span2">${fld("model", T("af_model"), `<select class="inp" id="af-model" name="model" data-on="afmodel">${opt(MODELS, mk)}</select>`)}</div>
    ${fld("price", L(PRICE_LAB[mk]), inp("price", "number", 'min="0" step="any"'))}
    <div data-show="royalty share">${fld("rate", T("af_rate"), inp("rate", "number", 'min="0" max="100" step="any"'))}</div>
    <div data-show="royalty share">${fld("upfront", T("af_upfront"), inp("upfront", "number", 'min="0" step="any"'))}</div>
    <div data-show="service">${fld("renewal", T("af_renewal"), inp("renewal", "number", 'min="0" step="any"'))}</div>
    ${fld("volume", L(VOL_LAB[mk]), inp("volume", "number", 'min="0" step="1"'))}
    ${fld("unit", T("af_unit"), inp("unit", "text", 'placeholder="packs, units, sites"'))}
    ${fld("cashMin", T("af_cashmin"), inp("cashMin", "number", 'min="0" step="any"'))}
    ${fld("cashMax", T("af_cashmax"), inp("cashMax", "number", 'min="0" step="any"'))}
   </div></fieldset>
   <fieldset><legend>${esc(T("af_market"))}</legend><p class="note" style="margin-bottom:8px">${esc(T("af_market_h"))}</p><div class="fgrid">
    ${D.rubric.m.slice(0, 4).map((c, i) => `<div class="span2">${fld("m" + i, L(c.name), `<select class="inp" id="af-m${i}" name="m${i}">${[5, 4, 3, 2, 1].map(n => `<option value="${n}"${n === (+(v.m || [])[i] || 3) ? " selected" : ""}>${n}. ${esc(L(c.levels[5 - n]))}</option>`).join("")}</select>`)}</div>`).join("")}
    <div class="span2">${fld("opp", T("af_opp"), ta("opp", 2, T("af_opp_ph")))}</div>
   </div></fieldset>
   <fieldset><legend>${esc(T("af_people"))}</legend><div class="fgrid">
    ${fld("customers", T("af_customers"), ta("customers", 2))}
    ${fld("partners", T("af_partners"), ta("partners", 2), T("af_partners_h"))}
    ${fld("comps", T("af_comps"), ta("comps", 3, T("af_comps_ph")), T("af_comps_h"))}
    ${fld("lab", T("af_lab"), ta("lab", 3))}
   </div></fieldset>
   <p class="note">${esc(prev ? T("af_regen_note") : T("af_note"))}</p>
   <p class="aferr" id="af-err" role="alert"></p>
   <div class="btnrow"><button type="submit" class="btn primary">${esc(prev ? T("af_save") : T("af_create"))}</button><a class="btn" href="${prev ? "#/products/" + prev.slug : "#/products"}">${esc(T("cancel"))}</a></div>
  </form>`;
};
function readForm(f) {
  const g = n => { const el = f.elements[n]; return el ? el.value.trim() : ""; };
  const o = {};
  ["name", "short", "lead", "url", "now", "type", "pathway", "ip", "partner", "model", "unit", "opp", "customers", "partners", "comps", "lab"].forEach(k => { o[k] = g(k); });
  ["trl", "price", "rate", "upfront", "renewal", "volume", "cashMin", "cashMax"].forEach(k => { const x = parseFloat(g(k).replace(",", ".")); o[k] = isFinite(x) && x >= 0 ? x : 0; });
  o.evid = [...f.querySelectorAll('input[name="evid"]:checked')].map(x => x.value);
  o.m = [0, 1, 2, 3].map(i => +g("m" + i) || 3);
  if (o.url && !/^https?:\/\//i.test(o.url)) o.url = "https://" + o.url;
  if (o.cashMax && o.cashMin > o.cashMax) { const t = o.cashMin; o.cashMin = o.cashMax; o.cashMax = t; }
  return o;
}
function syncModel(f) {
  const mk = f.elements.model.value;
  f.querySelectorAll("[data-show]").forEach(el => { el.style.display = el.dataset.show.split(" ").indexOf(mk) >= 0 ? "" : "none"; });
  const pl = f.querySelector('label[for="af-price"] span'), vl = f.querySelector('label[for="af-volume"] span');
  if (pl) pl.textContent = L(PRICE_LAB[mk]); if (vl) vl.textContent = L(VOL_LAB[mk]);
  ["price", "volume", "unit"].forEach(k => { const el = f.querySelector('label[for="af-' + k + '"]'); if (el) el.style.display = mk === "none" ? "none" : ""; });
}
document.addEventListener("submit", e => {
  const f = e.target;
  if (f.id !== "addform") return;
  e.preventDefault();
  const o = readForm(f);
  const err = byId("af-err");
  if (!o.name) { err.textContent = T("af_err_name"); f.elements.name.focus(); return; }
  if (o.model !== "none" && (!o.price || !o.volume)) { err.textContent = T("af_err_money"); (o.price ? f.elements.volume : f.elements.price).focus(); return; }
  const prevSlug = f.dataset.slug, prev = prevSlug ? BY[prevSlug] : null;
  const p = generateProduct(o, prev);
  S.custom = S.custom || [];
  if (prev) {
    S.custom = S.custom.map(x => x.slug === prev.slug ? p : x);
    ["tl", "rev", "scores", "qtext", "facts"].forEach(k => { delete S[k][prev.slug]; });
    if (!S.fund[prev.slug]) delete S.fund[prev.slug];
  } else S.custom.push(p);
  save();
  location.hash = "#/products/" + p.slug + "/plan";
  toast(prev ? T("af_saved") : T("af_created"));
});
Object.assign(ON, {
  aftype: el => { const f = el.form; if (f && f.elements.pathway) f.elements.pathway.value = TYPE_PATH[el.value] || "P1"; },
  afmodel: el => syncModel(el.form),
  qtext: el => { const o = S.qtext[el.dataset.slug] = S.qtext[el.dataset.slug] || {}; o[+el.dataset.i] = el.value; save(); },
});
Object.assign(ACT, {
  goaledit: () => { U.goalEdit = !U.goalEdit; render(); },
  goalreset: b => { delete S.qtext[b.dataset.slug]; changed(); },
  removeprod: b => {
    const p = BY[b.dataset.slug];
    if (p.custom) {
      if (!confirm(T("confirm_delete").replace("{n}", short(p)))) return;
      S.custom = S.custom.filter(x => x.slug !== p.slug);
      ["tl", "rev", "scores", "fund", "links", "qtext", "facts"].forEach(k => { delete S[k][p.slug]; });
      toast(T("deleted"));
    } else {
      if (!confirm(T("confirm_remove").replace("{n}", short(p)))) return;
      S.removed = (S.removed || []).concat([p.slug]);
      toast(T("removed_toast"));
    }
    S.hidden = S.hidden.filter(x => x !== p.slug);
    save(); location.hash = "#/products";
    render();
  },
  restore: b => { S.removed = (S.removed || []).filter(x => x !== b.dataset.slug); changed(); },
});
POST.push(() => { const f = byId("addform"); if (f) syncModel(f); });


/* ================= method page ================= */
const M = (en, id) => ({ en, id });
const METHOD = [
  { k: "disc", h: M("Status of this roadmap", "Status peta jalan ini"), p: [
    M("This is a working draft by the Technology Transfer unit of BINUS RTT. It is a starting proposal, not a commitment by BINUS or by the researchers. Every plan must be finalized with its research team, according to their availability (kesibukan) and direction (arahan).", "Ini draf kerja dari unit Technology Transfer BINUS RTT. Isinya usulan awal, bukan komitmen BINUS maupun peneliti. Setiap rencana perlu difinalkan bersama tim penelitinya, sesuai kesibukan dan arahan mereka."),
    M("A product's TKT is not enough to reach the market. Researchers also need commercialization skills: IP strategy, business models, partner negotiation, regulation and evidence for buyers. BINUS builds these through PPHK (Peningkatan Pemahaman Hilirisasi dan Komersialisasi) [pphk]; the first batch in 2025 certified 18 of 40 participants after assessment [pphk2]. Participation in PPHK is listed in every product's asks, and the skills each pathway needs are shown on each product's go-to-market tab.", "TKT produk saja tidak cukup untuk sampai ke pasar. Peneliti juga perlu kemampuan komersialisasi: strategi HKI, model bisnis, negosiasi mitra, regulasi, dan bukti untuk pembeli. BINUS membangunnya melalui PPHK (Peningkatan Pemahaman Hilirisasi dan Komersialisasi) [pphk]; batch pertama pada 2025 meluluskan 18 dari 40 peserta setelah penilaian [pphk2]. Keikutsertaan dalam PPHK dicantumkan di kebutuhan setiap produk, dan kemampuan yang dibutuhkan tiap jalur ditampilkan di tab strategi pasar setiap produk."),
  ]},
  { k: "basis", h: M("Where the content comes from", "Asal isi peta jalan"), p: [
    M("The 16 original products, their inventors and their current status come from the BINUS Innovation Master Catalogue 2026 and BINUS BRIDGE pages. Where the catalogue and BRIDGE disagree (for example on accuracy figures), the roadmap names the conflict instead of choosing one. Four products were added in November 2026: the portable autoclave from RTT's information on the PT Graha Teknomedika partnership [gtm], PRALANG from its BRIDGE listing [bridgepralang], ManalagiCare from its own site [manalagi], and InDRI from its published paper and project site [indripaper] [indrisite]. Their missing details are marked [ISI].", "16 produk awal, inventornya, dan status terkininya berasal dari BINUS Innovation Master Catalogue 2026 dan halaman BINUS BRIDGE. Jika katalog dan BRIDGE berbeda (misalnya angka akurasi), peta jalan menyebut perbedaannya, bukan memilih salah satu. Empat produk ditambahkan pada November 2026: autoklaf portabel dari informasi RTT tentang kemitraan dengan PT Graha Teknomedika [gtm], PRALANG dari halaman BRIDGE-nya [bridgepralang], ManalagiCare dari situsnya sendiri [manalagi], dan InDRI dari makalah dan situs proyeknya [indripaper] [indrisite]. Detail yang belum ada ditandai [ISI]."),
    M("Market data, regulations, funding schemes, prices and similar products come from the public sources listed below, researched in October and November 2026. Official sources (ministries, BPOM, BRIN, Kemdiktisaintek, DJKI, patent offices) were used first; news and company pages only where no official source exists.", "Data pasar, regulasi, skema pendanaan, harga, dan produk serupa berasal dari sumber publik di bawah, diriset pada Oktober dan November 2026. Sumber resmi (kementerian, BPOM, BRIN, Kemdiktisaintek, DJKI, kantor paten) diutamakan; berita dan halaman perusahaan dipakai hanya jika tidak ada sumber resmi."),
    M("Bracketed numbers in the text link to these sources. Plans, prices, volumes and scores without a number are planning assumptions made for this roadmap, explained in the sections that follow.", "Angka dalam kurung siku di teks merujuk ke sumber tersebut. Rencana, harga, volume, dan skor tanpa nomor adalah asumsi perencanaan untuk peta jalan ini, dijelaskan di bagian-bagian berikut."),
    M("Information still missing is marked [ISI]. Nothing was invented to fill a gap: named partners are candidates to approach unless the text says they already work with BINUS.", "Informasi yang belum ada ditandai [ISI]. Tidak ada yang dikarang untuk mengisi kekosongan: mitra yang disebut adalah kandidat, kecuali disebutkan sudah bekerja sama dengan BINUS."),
  ]},
  { k: "pathway", h: M("How each product got its pathway", "Cara menentukan jalur setiap produk"), p: [
    M("Each product follows one of five routes to market, chosen by what is being sold and who can legally sell it: recipes and materials are licensed to manufacturers (P1); machines need a manufacturer to build and certify them (P2); software and deployments are sold as yearly services (P3); health devices and medical software must pass clinical validation before anyone can license them, under Kepmenkes 951/2026 [kmk951] (P4); designs are licensed after a built and monitored pilot (P5).", "Setiap produk mengikuti satu dari lima jalur ke pasar, ditentukan oleh apa yang dijual dan siapa yang boleh menjualnya secara hukum: resep dan material dilisensikan ke produsen (P1); mesin butuh produsen untuk membuat dan menyertifikasinya (P2); perangkat lunak dan implementasi dijual sebagai layanan tahunan (P3); alat kesehatan dan perangkat lunak medis wajib lolos validasi klinis sebelum bisa dilisensikan, sesuai Kepmenkes 951/2026 [kmk951] (P4); desain dilisensikan setelah ada contoh terbangun yang dipantau (P5)."),
    M("Starting a company is not the default. A spin-off is only discussed in the last year of a plan, and only where a product sells directly and keeps renewing.", "Mendirikan perusahaan bukan pilihan utama. Spin-off baru dibahas di tahun terakhir rencana, dan hanya untuk produk yang dijual langsung dan terus diperpanjang pelanggan."),
  ]},
  { k: "timeline", h: M("How the timeline was set", "Cara menyusun linimasa"), p: [
    M("Every product moves through four phases: prove and protect, partner and certify, first sales and pilots, then scale. Phase lengths come from the work each step needs (tests, permits, partner negotiation) at the product's current readiness, checked against how long similar products took (for example DermaSensor's eight years from first FDA meeting to clearance [dermasensor] [dermasensor2]).", "Setiap produk melewati empat fase: buktikan dan lindungi, gandeng mitra dan sertifikasi, penjualan pertama dan uji coba, lalu perluasan. Lama fase ditentukan oleh pekerjaan yang dibutuhkan setiap langkah (uji, izin, negosiasi mitra) pada kesiapan produk saat ini, dibandingkan dengan lama produk serupa (misalnya DermaSensor butuh delapan tahun dari pertemuan pertama dengan FDA sampai izin [dermasensor] [dermasensor2])."),
    M("Each plan has at least one go or no-go check: a date, a pass condition and what happens if it fails. The timeline and income assume each check is passed; the Risks tab says what changes if it is not.", "Setiap rencana punya minimal satu titik keputusan: tanggal, syarat lolos, dan apa yang terjadi jika gagal. Linimasa dan pendapatan mengasumsikan setiap titik keputusan lolos; tab Risiko menjelaskan apa yang berubah jika tidak."),
    M("First income is the first quarter in which money reaches BINUS: a licence fee, a royalty or a BINUS Creates sale. A signed MoU or a free deployment does not count.", "Pendapatan pertama adalah kuartal pertama saat uang masuk ke BINUS: biaya lisensi, royalti, atau penjualan BINUS Creates. MoU yang ditandatangani atau implementasi gratis tidak dihitung."),
  ]},
  { k: "tkt", h: M("How TKT is shown", "Cara TKT ditampilkan"), p: [
    M("Each product shows its current TKT and the TKT it should reach at the end of each phase. Current TKT comes from BINUS BRIDGE where it is listed (PediDERM, kidney detector, PRALANG). For the others it is an RTT estimate from the evidence in the catalogue, using the national TKT levels, and is marked as estimated until the research team confirms it.", "Setiap produk menampilkan TKT saat ini dan TKT yang perlu dicapai di akhir setiap fase. TKT saat ini diambil dari BINUS BRIDGE jika tercantum (PediDERM, detektor ginjal, PRALANG). Untuk produk lain, angkanya adalah estimasi RTT dari bukti di katalog dengan memakai tingkat TKT nasional, dan ditandai sebagai estimasi sampai tim peneliti memastikannya."),
    M("Targets by pathway, at the end of each phase (prove, partner, first sales, scale): formula licences and devices 6, 8, 9, 9; services and clinical products 7, 8, 9, 9; designs 6, 7, 8, 9. A product already above a target keeps its current level. In BINUS RTT's framework, downstreaming starts at TKT 4 and commercialization usually at TKT 7 [hilirisasi].", "Target per jalur di akhir setiap fase (pembuktian, mitra, penjualan pertama, perluasan): lisensi formula dan perangkat 6, 8, 9, 9; layanan dan produk klinis 7, 8, 9, 9; desain 6, 7, 8, 9. Produk yang sudah di atas target mempertahankan tingkatnya. Dalam kerangka BINUS RTT, hilirisasi dimulai pada TKT 4 dan komersialisasi biasanya pada TKT 7 [hilirisasi]."),
  ]},
  { k: "scen", h: M("How the three scenarios differ", "Perbedaan tiga skenario"), p: [
    M("Optimistic: every check is passed on time and partners sign quickly. Pessimistic: partner deals and permits take longer and volumes are smaller; some health products earn nothing before 2031.", "Optimis: semua titik keputusan lolos tepat waktu dan mitra cepat menandatangani. Pesimis: kesepakatan mitra dan izin lebih lama, volume lebih kecil; sebagian produk kesehatan tidak menghasilkan pendapatan sebelum 2031."),
    M("Realistic is calculated, not judged separately: volumes are halfway between the other two (rounded down for small counts), and first income falls halfway between their dates, rounded to the later quarter. Upfront licence fees follow whichever scenario starts in the same year. A product with no pessimistic income has no realistic income either.", "Realistis dihitung, bukan dinilai terpisah: volume berada di tengah antara dua skenario lain (dibulatkan ke bawah untuk jumlah kecil), dan pendapatan pertama jatuh di tengah kedua tanggalnya, dibulatkan ke kuartal yang lebih lambat. Biaya lisensi awal mengikuti skenario yang dimulai pada tahun yang sama. Produk tanpa pendapatan pesimis juga tidak punya pendapatan realistis."),
  ]},
  { k: "rev", h: M("How income was calculated", "Cara menghitung pendapatan"), p: [
    M("Income to BINUS means licence fees, royalties and BINUS Creates sales. It is revenue, not profit: production, staff and service costs are not deducted. For licences, the licensee's own sales are shown separately as partner sales.", "Pendapatan BINUS berarti biaya lisensi, royalti, dan penjualan BINUS Creates. Ini omzet, bukan laba: biaya produksi, staf, dan layanan tidak dikurangkan. Untuk lisensi, penjualan pemegang lisensi ditampilkan terpisah sebagai penjualan mitra."),
    M("Formulas: royalty = units x licensee net price x royalty rate; direct sales = units x price; service renewals = earlier units x renewal price x renewal rate. Royalty rates of 3 to 5% follow common industry ranges for food and manufactured goods [royaltyind]. Prices come from quotes in the catalogue (for example MAYA's Rp38 juta) or from similar products on the market; volumes are planning assumptions.", "Rumus: royalti = unit x harga bersih pemegang lisensi x tarif royalti; penjualan langsung = unit x harga; perpanjangan layanan = unit tahun sebelumnya x harga perpanjangan x tingkat perpanjangan. Tarif royalti 3 sampai 5% mengikuti kisaran umum industri pangan dan barang manufaktur [royaltyind]. Harga berasal dari penawaran di katalog (misalnya MAYA Rp38 juta) atau produk serupa di pasar; volume adalah asumsi perencanaan."),
    M("When a timeline is moved, each year's income is spread evenly over the quarters it is earned in, shifted by the same number of quarters, and added up again by year. Income pushed past 2030 drops out of the totals and is flagged. When a product is moved earlier, the last quarter's level continues to the end of 2030.", "Jika linimasa digeser, pendapatan setiap tahun dibagi rata ke kuartal saat pendapatan itu diperoleh, digeser sebanyak kuartal yang sama, lalu dijumlahkan lagi per tahun. Pendapatan yang terdorong melewati 2030 keluar dari total dan ditandai. Jika produk digeser lebih awal, tingkat kuartal terakhir berlanjut sampai akhir 2030."),
    M("Social products also list what to measure for social return (SROI). No SROI ratio is claimed until pilot data exists.", "Produk sosial juga mencantumkan apa yang diukur untuk nilai sosial (SROI). Tidak ada rasio SROI yang diklaim sebelum ada data uji coba."),
  ]},
  { k: "prio", h: M("How priority is scored", "Cara menghitung prioritas"), p: [
    M("Scores are not typed in. Each product has recorded facts (its TKT, which evidence exists, IP status, partner status, the permit needed before first income, cash need, and cited market evidence), and a fixed rubric turns each fact into a level from 1 to 5. The rubric is below; the same rubric applies to every product, including ones added later.", "Skor tidak diketik langsung. Setiap produk punya fakta yang tercatat (TKT, bukti yang ada, status HKI, status mitra, izin yang dibutuhkan sebelum pendapatan pertama, kebutuhan dana, dan bukti pasar yang dikutip), lalu rubrik tetap mengubah setiap fakta menjadi tingkat 1 sampai 5. Rubriknya ada di bawah; rubrik yang sama berlaku untuk semua produk, termasuk yang ditambahkan kemudian."),
    M("Six doability criteria are calculated directly from the facts. Four market criteria are levels chosen against written definitions, each with its cited basis shown next to it. The fifth market criterion counts identified partnership opportunities automatically. Each side is a weighted average; the priority score combines them, 50/50 by default. A side scoring 3.0 or more counts as strong, which sets the group: do now, partner to unlock, quick but small, or prove first.", "Enam kriteria kemudahan eksekusi dihitung langsung dari fakta. Empat kriteria pasar adalah tingkat yang dipilih berdasarkan definisi tertulis, masing-masing dengan dasar kutipannya. Kriteria pasar kelima menghitung peluang kemitraan yang teridentifikasi secara otomatis. Setiap sisi adalah rata-rata berbobot; skor prioritas menggabungkan keduanya, 50/50 secara bawaan. Sisi dengan nilai 3,0 atau lebih dianggap kuat, dan ini menentukan kelompok: kerjakan sekarang, perlu mitra, cepat tapi kecil, atau buktikan dulu."),
    M("To change a score, change the fact behind it in the score basis editor (for example, a signed agreement or a new test result). Every edit is marked, so the ranking always shows what it rests on.", "Untuk mengubah skor, ubah fakta di baliknya di editor dasar skor (misalnya perjanjian yang ditandatangani atau hasil uji baru). Setiap perubahan ditandai, sehingga peringkat selalu menunjukkan dasarnya."),
  ], extra: "rubric" },
  { k: "gtm", h: M("How the go-to-market strategy was built", "Cara menyusun strategi pasar"), p: [
    M("Each product's strategy answers four questions in order: who to win first (users and partners), how to reach them (channels where they already gather or buy, such as associations, procurement platforms, matchmaking programmes and events), what to offer them, and what proof will convince them. Three dated first moves turn it into work for the next quarters.", "Strategi setiap produk menjawab empat pertanyaan secara berurutan: siapa yang dimenangkan lebih dulu (pengguna dan mitra), bagaimana menjangkaunya (saluran tempat mereka sudah berkumpul atau membeli, seperti asosiasi, platform pengadaan, program pencocokan, dan pameran), apa yang ditawarkan, dan bukti apa yang meyakinkan mereka. Tiga langkah awal bertanggal mengubahnya menjadi pekerjaan untuk kuartal berikutnya."),
    M("Partners come first where they hold what BINUS lacks: production, permits, distribution or a budget. Outreach waits for the proof named in the strategy; going to partners without it wastes the first meeting.", "Mitra diprioritaskan jika mereka memiliki yang tidak dimiliki BINUS: produksi, izin, distribusi, atau anggaran. Pendekatan menunggu bukti yang disebut dalam strategi; mendatangi mitra tanpa bukti itu membuang pertemuan pertama."),
  ]},
  { k: "fund", h: M("How funding was planned", "Cara merencanakan pendanaan"), p: [
    M("Cash needs are ranges for the work in each plan (tests, pilots, certification, validation studies), not quotes. Each product is matched to schemes by its readiness level and type, using the current official guides: for example Dorongan Teknologi needs TKT 6 to 8 and partner co-funding [dortek], and Pengujian Produk funds up to two years of accredited testing or clinical trials [pengujian].", "Kebutuhan dana adalah rentang untuk pekerjaan dalam setiap rencana (uji, uji coba, sertifikasi, studi validasi), bukan penawaran harga. Setiap produk dicocokkan dengan skema berdasarkan tingkat kesiapan dan jenisnya, memakai panduan resmi terkini: misalnya Dorongan Teknologi mensyaratkan TKT 6 sampai 8 dan pendanaan bersama mitra [dortek], dan Pengujian Produk mendanai uji terakreditasi atau uji klinis paling lama dua tahun [pengujian]."),
    M("Funding lines are plans, not submissions. 'Not yet secured' compares the minimum need with awarded money only; 'gap after pipeline' assumes every planned or submitted line is won. Scheme limits and dates change every call and should be updated here when a new guide is published.", "Baris pendanaan adalah rencana, bukan pengajuan. 'Belum didanai' membandingkan kebutuhan minimum dengan dana yang sudah didanai saja; 'kekurangan setelah proses' mengasumsikan semua baris yang direncanakan atau diajukan berhasil. Batas dana dan tanggal skema berubah setiap panggilan dan perlu diperbarui di sini saat panduan baru terbit."),
  ]},
  { k: "comp", h: M("How partners and similar products were chosen", "Cara memilih mitra dan produk serupa"), p: [
    M("Partners were picked for a clear reason to work with BINUS: they make, certify, buy, fund or distribute this kind of product. Existing BINUS partners are named as such; everyone else is a candidate.", "Mitra dipilih karena ada alasan jelas untuk bekerja dengan BINUS: mereka memproduksi, menyertifikasi, membeli, mendanai, atau mendistribusikan produk sejenis. Mitra BINUS yang sudah ada disebut demikian; selain itu adalah kandidat."),
    M("Similar products were searched for in each product's market, including ones that failed, because failures show what to avoid. Each is labelled on the market, failed or paused, research or pilot, patent, or programme. A partnership opportunity is highlighted only where the company already does something BINUS needs (manufacturing, distribution, licensing in or out, a test site); the rest are benchmarks.", "Produk serupa dicari di pasar setiap produk, termasuk yang gagal, karena kegagalan menunjukkan apa yang perlu dihindari. Masing-masing diberi label sudah di pasar, gagal atau berhenti, riset atau uji coba, paten, atau program. Peluang kemitraan hanya disorot jika perusahaan itu sudah melakukan sesuatu yang dibutuhkan BINUS (produksi, distribusi, lisensi masuk atau keluar, lokasi uji); sisanya sebagai pembanding."),
  ]},
  { k: "gen", h: M("How plans for added products are generated", "Cara rencana produk tambahan dibuat"), p: [
    M("Products added through the form get a rule-based first draft, made in the browser without AI or extra research. The rules are below. Every generated part can be edited, and anything that needs research is marked [ISI].", "Produk yang ditambahkan lewat formulir mendapat draf awal berbasis aturan, dibuat di browser tanpa AI atau riset tambahan. Aturannya ada di bawah. Semua bagian yang dihasilkan bisa diubah, dan bagian yang perlu riset ditandai [ISI]."),
    M("Optimistic first income starts with the sales phase. Realistic is one quarter later at 75% of the volumes; pessimistic is two quarters later (four for clinical products) at 50%. Volumes ramp up to the 2030 figure entered: 12%, 35%, 65% and 100% over four selling years, with the first year cut to the quarters actually selling.", "Pendapatan pertama skenario optimis dimulai bersama fase penjualan. Realistis satu kuartal lebih lambat dengan 75% volume; pesimis dua kuartal lebih lambat (empat untuk produk klinis) dengan 50%. Volume naik bertahap sampai angka 2030 yang diisi: 12%, 35%, 65%, dan 100% selama empat tahun penjualan, dengan tahun pertama dihitung sesuai kuartal yang benar-benar berjualan."),
    M("Doability scores are calculated from the answers: TRL 1-3 = 1, 4-5 = 2, 6 = 3, 7 = 4, 8-9 = 5; evidence = 1 plus one per item ticked; IP none 1, trade secret 2, filed or copyright 3, granted 4; partner none 1, candidates 2, LoI or MoU 3, agreement 5; regulatory load set by product type; cash need up to Rp200 juta = 5, 400 = 4, 800 = 3, 1,500 = 2, above = 1. Four market levels are chosen in the form against the rubric; the fifth is counted from identified partners.", "Skor kemudahan eksekusi dihitung dari jawaban: TRL 1-3 = 1, 4-5 = 2, 6 = 3, 7 = 4, 8-9 = 5; bukti = 1 ditambah satu per butir yang dicentang; HKI belum ada 1, rahasia dagang 2, diajukan atau hak cipta 3, diberikan 4; mitra belum ada 1, kandidat 2, LoI atau MoU 3, perjanjian 5; beban regulasi menurut jenis produk; kebutuhan dana sampai Rp200 juta = 5, 400 = 4, 800 = 3, 1.500 = 2, di atasnya = 1. Empat tingkat pasar dipilih di formulir berdasarkan rubrik; yang kelima dihitung dari mitra yang teridentifikasi."),
    M("Suggested funding: 70% of the minimum cash need from the main scheme for the pathway and readiness (RIIM below TKT 6, Dorongan Teknologi from TKT 6, Pengujian Produk for clinical products from TKT 6, CSR for community programmes), and 30% from the partner or an internal grant. Permits are taken from the permit table for the product type.", "Saran pendanaan: 70% dari kebutuhan dana minimum dari skema utama sesuai jalur dan kesiapan (RIIM di bawah TKT 6, Dorongan Teknologi mulai TKT 6, Pengujian Produk untuk produk klinis mulai TKT 6, CSR untuk program komunitas), dan 30% dari mitra atau hibah internal. Perizinan diambil dari tabel perizinan sesuai jenis produk."),
  ], extra: "plen" },
  { k: "limits", h: M("What this roadmap is not", "Batasan peta jalan ini"), p: [
    M("It is a planning tool, not a forecast or a valuation. Income figures show what each plan could earn if its assumptions hold; they are not targets agreed with partners.", "Ini alat perencanaan, bukan prakiraan atau valuasi. Angka pendapatan menunjukkan apa yang bisa dihasilkan setiap rencana jika asumsinya terpenuhi; angka ini bukan target yang disepakati dengan mitra."),
    M("No partner named here has been contacted for this roadmap. Regulations, scheme rules and market figures were correct when researched and should be rechecked before a proposal or a contract.", "Belum ada mitra yang disebut di sini yang dihubungi untuk peta jalan ini. Regulasi, aturan skema, dan data pasar benar saat diriset dan perlu dicek ulang sebelum proposal atau kontrak."),
  ]},
];
function plenTable() {
  return `<div class="tw glass pad0" style="margin-top:8px"><table><thead><tr><th>${esc(T("pathway"))}</th><th class="n">${esc(T("m_prove"))} TRL 1-4</th><th class="n">TRL 5-6</th><th class="n">TRL 7-9</th><th class="n">${esc(T("phase_partner"))}</th><th class="n">${esc(T("phase_sell"))}</th></tr></thead><tbody>${D.pathways.map(pw => { const r = PLEN[pw.id]; return `<tr><td>${esc(L(pw.name))}</td><td class="n">${r[0][0]}</td><td class="n">${r[0][1]}</td><td class="n">${r[0][2]}</td><td class="n">${r[1]}</td><td class="n">${r[2]}</td></tr>`; }).join("")}</tbody></table></div><p class="note">${esc(T("m_plen_note"))}</p>`;
}
VIEWS.sources = () => `<div class="vhead"><div><h1>${esc(T("src_h"))}</h1><p class="lede">${esc(T("src_intro"))}</p></div></div>
  <nav class="mtoc glass" aria-label="${esc(T("m_toc"))}"><ol>${METHOD.map(s => `<li><a href="#m-${s.k}" data-act="mjump" data-k="${s.k}">${esc(L(s.h))}</a></li>`).join("")}<li><a href="#src-list" data-act="mjump" data-k="list">${esc(T("m_list"))}</a></li></ol></nav>
  <div class="method">${METHOD.map(s => `<section id="m-${s.k}" class="${s.k === "disc" ? "glass mdisc" : ""}"><h2>${esc(L(s.h))}</h2>${s.p.map(x => `<p>${LC(x)}</p>`).join("")}${s.extra === "plen" ? plenTable() : ""}${s.extra === "rubric" ? rubricTable() : ""}</section>`).join("")}</div>
  <h2 class="sec" id="m-list">${esc(T("m_list"))}</h2>
  <ol class="srcs glass">${D.sources.map((s, i) => `<li id="src-${i + 1}"><span class="sn">${i + 1}.</span><span>${esc(s.t)}<br><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.u.replace(/^https?:\/\//, "").slice(0, 90))}</a></span></li>`).join("")}</ol>`;
Object.assign(ACT, {
  mjump: b => { const el = byId("m-" + b.dataset.k); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); },
});

/* ---------------- Simplify mode: plain-language versions of each page ---------------- */
const SIMPLE = {};
const QORDER = ["do", "partner", "small", "park"];
function fill(s, o) { return s.replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m)); }
function readyWord(t) { return T(t <= 3 ? "s_r1" : t <= 5 ? "s_r2" : t <= 7 ? "s_r3" : "s_r4"); }
function meter(t) {
  let s = `<span class="meter" role="img" aria-label="TKT ${t} / 9">`;
  for (let i = 1; i <= 9; i++) s += `<i class="${i <= t ? "on" : ""}"></i>`;
  return s + "</span>";
}
function plain(s) { return String(s || "").replace(/\s?\[[a-z0-9]+\]/g, "").replace(/\s+\./g, "."); }
function firstSentence(s) { const m = plain(s).match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : plain(s); }
function sText(p, k) {
  if (p.simple && p.simple[k]) return L(p.simple[k]);
  if (k === "what") return firstSentence(L(p.now));
  if (k === "who") return p.gtm && p.gtm.target ? firstSentence(L(p.gtm.target)) : "";
  return plain(L(p.next));
}
function firstYear(p, sc) { const f = firstEff(p, sc); return f == null || f > 15 ? null : 2027 + Math.floor(f / 4); }
function sChip(p, extra) { return `<a class="pchip" href="#/products/${p.slug}"><span class="pchip-n">${p.id}</span>${esc(short(p))}${extra || ""}</a>`; }
function sHead(h, l) {
  return `<header class="hero s-hero"><span class="s-tag">${esc(T("s_tag"))}</span><h1>${esc(h)}</h1>${l ? `<p class="lede">${esc(l)}</p>` : ""}</header>`;
}
function sFoot() {
  return `<div class="s-foot">${disclaimer(true)}<button type="button" class="btn" data-act="simple">${esc(T("s_full"))}</button></div>`;
}
function groups(list) {
  const g = { do: [], partner: [], small: [], park: [] };
  list.forEach(p => g[prio(p).q].push(p));
  QORDER.forEach(k => g[k].sort((a, b) => prio(b).p - prio(a).p));
  return g;
}

SIMPLE.overview = () => {
  const sh = shown(), sc = S.scen;
  const e = sh.filter(p => earns(p, sc)).length;
  const tot = sh.reduce((a, p) => a + income(p, sc).tot, 0);
  const cols = [2027, 2028, 2029, 2030, null].map(y => ({ y, ps: sh.filter(p => firstYear(p, sc) === y) }));
  const g = groups(sh);
  return `${sHead(fill(T("s_ov_h"), { n: sh.length }), fill(T("s_ov_l"), { scen: T(sc).toLowerCase(), e, rp: rpBig(tot) }))}
  <div class="kpis s-kpis">
   <div class="kpi lq glass"><b data-count="${sh.length}">${sh.length}</b><span>${esc(T("s_k_products"))}</span></div>
   <div class="kpi lq glass"><b data-count="${e}">${e}</b><span>${esc(T("s_k_earn"))}</span></div>
   <div class="kpi lq glass"><b data-count="${tot}" data-fmt="rp">${rpBig(tot)}</b><span>${esc(T("s_k_money"))}</span></div>
  </div>
  <section class="sec"><h2 class="h2">${esc(T("s_when_h"))}</h2><p class="sub">${esc(T("s_when_l"))}</p>
   <div class="s-years">${cols.map(c => `<div class="s-year glass${c.y ? "" : " later"}"><div class="s-year-h"><b>${c.y || esc(T("s_later"))}</b><span>${c.ps.length}</span></div><div class="s-year-b">${c.ps.map(p => sChip(p)).join("")}</div></div>`).join("")}</div>
  </section>
  <section class="sec"><h2 class="h2">${esc(T("s_focus_h"))}</h2><p class="sub">${esc(T("s_focus_l"))}</p>
   <div class="s-groups">${QORDER.map(k => `<div class="s-group glass q-${k}-b"><div class="s-group-h"><span class="qdot q-${k}"></span><h3>${esc(T("s_q_" + k))}</h3><span class="cnt">${g[k].length}</span></div><p>${esc(T("s_qd_" + k))}</p><div class="chips">${g[k].map(p => sChip(p)).join("")}</div></div>`).join("")}</div>
  </section>
  <section class="sec"><h2 class="h2">${esc(T("s_read_h"))}</h2>
   <ol class="s-steps">${[1, 2, 3].map(i => `<li class="glass"><span class="s-num">${i}</span><p>${esc(T("s_read" + i))}</p></li>`).join("")}</ol>
  </section>${sFoot()}`;
};

SIMPLE.products = r => {
  const list = shown().length ? shown() : P;
  let slug = r.a;
  if (!inP(slug)) slug = (list[0] || {}).slug;
  if (!slug) return VIEWS.products(r);
  const p = BY[slug], sc = S.scen, pr = prio(p), t = tktNow(p);
  const i = Math.max(0, list.findIndex(x => x.slug === slug));
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  const fy = firstYear(p, sc), inc = income(p, sc).tot;
  return `<div class="s-prod">
   <div class="s-nav">
    <a class="iconbtn" href="#/products/${prev.slug}" aria-label="${esc(T("s_prev"))}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
    <select class="inp" id="spsel" data-on="psel" aria-label="${esc(T("s_pick"))}">${list.map(x => `<option value="${x.slug}"${x.slug === slug ? " selected" : ""}>${x.id} ${esc(short(x))}</option>`).join("")}</select>
    <a class="iconbtn" href="#/products/${next.slug}" aria-label="${esc(T("s_next"))}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
   </div>
   <header class="hero s-hero"><span class="s-tag">${esc(T("s_tag"))}</span><span class="chip">${esc(pathName(p.pathway))}</span><h1>${esc(L(p.name))}</h1><p class="lede">${esc(sText(p, "what"))}</p></header>
   <div class="s-grid">
    <div class="s-cell glass"><span class="s-lab">${esc(T("s_who"))}</span><p>${esc(sText(p, "who"))}</p></div>
    <div class="s-cell glass"><span class="s-lab">${esc(T("s_ready"))}</span>${meter(t)}<p><b>${esc(readyWord(t))}</b> <span class="muted">TKT ${esc(fill(T("s_of9"), { t }))}</span></p></div>
    <div class="s-cell glass lq"><span class="s-lab">${esc(T("s_earn"))}</span><b class="s-big">${fy ? esc(ql(firstEff(p, sc))) : esc(T("s_none"))}</b><p class="muted small">${esc(T(sc))}</p></div>
    <div class="s-cell glass lq"><span class="s-lab">${esc(T("s_money"))}</span><b class="s-big">${inc > 0.5 ? rpj(inc) : "Rp0"}</b><p class="muted small">${esc(T(sc))}</p></div>
   </div>
   <div class="s-row glass q-${pr.q}-b"><span class="s-lab">${esc(T("s_status"))}</span><div><h3><span class="qdot q-${pr.q}"></span>${esc(T("s_q_" + pr.q))}</h3><p>${esc(T("s_qd_" + pr.q))}</p></div></div>
   <div class="s-row glass"><span class="s-lab">${esc(T("s_step"))}</span><div><p class="s-step">${esc(sText(p, "step"))}</p></div></div>
   <div class="s-foot">${disclaimer(true)}<button type="button" class="btn primary" data-act="simple">${esc(T("s_full_plan"))}</button></div>
  </div>`;
};

SIMPLE.priority = () => {
  const g = groups(shown());
  return `${sHead(T("s_pr_h"), T("s_pr_l"))}
  <div class="s-groups big">${QORDER.map(k => `<div class="s-group glass q-${k}-b"><div class="s-group-h"><span class="qdot q-${k}"></span><h3>${esc(T("s_q_" + k))}</h3><span class="cnt">${g[k].length}</span></div><p>${esc(T("s_qd_" + k))}</p><ul class="s-list">${g[k].map(p => `<li><a href="#/products/${p.slug}"><span class="pchip-n">${p.id}</span><span class="s-list-t"><b>${esc(short(p))}</b><small>${esc(sText(p, "what"))}</small></span></a></li>`).join("")}</ul></div>`).join("")}</div>
  <p class="sub sec">${esc(T("s_focus_l"))}</p>${sFoot()}`;
};

SIMPLE.funding = () => {
  const sh = shown();
  let need0 = 0, need1 = 0, aw = 0, pi = 0, uns = 0;
  const rows = sh.map(p => { const f = fundSum(p); need0 += f.need[0]; need1 += f.need[1]; aw += f.aw; pi += f.pi; uns += f.uns; return { p, f }; });
  const top = rows.slice().sort((a, b) => b.f.need[1] - a.f.need[1]).slice(0, 6);
  const mx = Math.max(1, ...top.map(x => x.f.need[1]));
  const unitW = (rpBig(need1).match(/\s(\S+)$/) || ["", ""])[1];
  const rng = `Rp${num(need0 / 1000, 1)}-${num(need1 / 1000, 1)} ${unitW}`;
  const rp0 = v => v > 0.5 ? rpBig(v) : "Rp0";
  return `${sHead(T("s_fu_h"), T("s_fu_l"))}
  <div class="kpis s-kpis">
   <div class="kpi lq glass"><b>${esc(rng)}</b><span>${esc(T("s_fu_need"))}</span></div>
   <div class="kpi lq glass"><b>${rp0(aw)}</b><span>${esc(T("s_fu_sec"))}</span></div>
   <div class="kpi lq glass"><b data-count="${uns}" data-fmt="rp">${rpBig(uns)}</b><span>${esc(T("s_fu_uns"))}</span></div>
  </div>
  <p class="sub">${esc(fill(T("s_fu_note"), { pi: rpBig(pi) }))}</p>
  <section class="sec"><h2 class="h2">${esc(T("s_fu_top"))}</h2>
   <div class="s-bars glass">${top.map(({ p, f }) => `<a class="s-bar" href="#/products/${p.slug}"><span class="s-bar-l">${esc(short(p))}</span><span class="s-bar-t"><i style="width:${f.need[1] / mx * 100}%"></i></span><span class="s-bar-v">${rpj(f.need[1])}</span></a>`).join("")}</div>
  </section>${sFoot()}`;
};

SIMPLE.guide = () => `${sHead(T("s_gd_h"), T("s_gd_l"))}
  <ol class="s-paths">${D.pathways.map((pw, i) => `<li class="glass"><span class="s-num">${i + 1}</span><div><h3>${esc(L(pw.name))}</h3><p>${esc(T("s_" + pw.id.toLowerCase()))}</p><div class="chips">${P.filter(p => p.pathway === pw.id && !isHidden(p)).map(p => sChip(p)).join("")}</div></div></li>`).join("")}</ol>${sFoot()}`;

SIMPLE.sources = () => `${sHead(T("s_src_h"), T("s_src_l"))}
  <ol class="s-steps col">${[1, 2, 3, 4, 5].map(i => `<li class="glass"><span class="s-num">${i}</span><p>${esc(T("s_m" + i))}</p></li>`).join("")}</ol>
  <div class="s-foot">${disclaimer(true)}<button type="button" class="btn primary" data-act="simple">${esc(T("s_src_more"))}</button></div>`;

/* ---------------- liquid glass: edge refraction, specular light ---------------- */
const LIQ = (() => {
  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const chromium = brands.some(b => /Chromium/.test(b.brand));
  const enabled = chromium && !REDUCED && !!window.CSS && CSS.supports("backdrop-filter", "blur(2px)");
  if (enabled) document.documentElement.classList.add("lq-refract");
  const NS = "http://www.w3.org/2000/svg";
  const cache = {};
  let seq = 0;
  /* displacement map for a rounded rectangle: content near the rim is pulled
     inward, like light bending through the curved edge of a glass slab */
  function mapURL(w, h, r, bezel) {
    const sc = Math.min(1, 220 / Math.max(w, h)) || 1;
    const cw = Math.max(8, Math.round(w * sc)), ch = Math.max(8, Math.round(h * sc));
    const cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(cw, ch), d = img.data;
    const hw = w / 2, hh = h / 2, rr = Math.min(r, hw, hh);
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const x = (i + 0.5) / sc - hw, y = (j + 0.5) / sc - hh;
        const ax = Math.abs(x), ay = Math.abs(y);
        const qx = ax - (hw - rr), qy = ay - (hh - rr);
        let nx = 0, ny = 0, dist;
        if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = qx / l * Math.sign(x); ny = qy / l * Math.sign(y); dist = rr - l; }
        else if (qx > qy) { nx = Math.sign(x); dist = hw - ax; }
        else { ny = Math.sign(y); dist = hh - ay; }
        const t = Math.max(0, Math.min(1, dist / bezel));
        const m = dist < bezel ? Math.pow(1 - t, 2.4) : 0;
        const k = (j * cw + i) * 4;
        d[k] = 128 - nx * m * 127; d[k + 1] = 128 - ny * m * 127; d[k + 2] = 128; d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL("image/png");
  }
  function el(tag, at) { const e = document.createElementNS(NS, tag); Object.keys(at).forEach(k => e.setAttribute(k, at[k])); return e; }
  function filterFor(w, h, r, bezel, scale) {
    const key = [w, h, r, bezel, scale].join("x");
    if (cache[key]) return cache[key];
    const id = "lq" + (++seq);
    const f = el("filter", { id, x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
    f.appendChild(el("feImage", { href: mapURL(w, h, r, bezel), x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none", result: "map" }));
    f.appendChild(el("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale, xChannelSelector: "R", yChannelSelector: "G" }));
    document.querySelector("#lq-defs defs").appendChild(f);
    cache[key] = id;
    return id;
  }
  function apply(n) {
    const w = Math.round(n.offsetWidth), h = Math.round(n.offsetHeight);
    if (!w || !h) return;
    const key = w + "x" + h;
    if (n.dataset.lqk === key) return;
    n.dataset.lqk = key;
    const r = Math.min(parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0, w / 2, h / 2);
    const bezel = Math.min(+n.dataset.bezel || 24, w / 2, h / 2);
    const scale = +n.dataset.refract || 40;
    n.style.setProperty("--lq", `url(#${filterFor(w, h, r, bezel, scale)})`);
  }
  const ro = enabled && "ResizeObserver" in window ? new ResizeObserver(es => es.forEach(e => apply(e.target))) : null;
  function scan() {
    if (!enabled) return;
    document.querySelectorAll(".lq").forEach(n => { if (!n._lq) { n._lq = 1; if (ro) ro.observe(n); } apply(n); });
  }
  /* a soft highlight follows the pointer across glass surfaces */
  if (window.matchMedia && matchMedia("(hover: hover)").matches && !REDUCED) {
    let raf = 0, ev = null;
    document.addEventListener("pointermove", e => {
      ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const t = ev.target && ev.target.closest && ev.target.closest(".glass, .lq, .btn, .iconbtn");
        if (!t) return;
        const b = t.getBoundingClientRect();
        t.style.setProperty("--mx", (ev.clientX - b.left).toFixed(0) + "px");
        t.style.setProperty("--my", (ev.clientY - b.top).toFixed(0) + "px");
      });
    }, { passive: true });
  }
  return { scan, enabled };
})();
POST.push(LIQ.scan);

/* ---------------- start ---------------- */
render();
