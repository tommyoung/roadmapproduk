"use strict";
const D = window.__DATA__;
const Y = [2027, 2028, 2029, 2030];
const SC = ["pess", "real", "opt"];
const PH = ["prove", "partner", "sell", "scale"];
const KEY = "binus-roadmap-v2";
const P = D.products;
const BY = {};
P.forEach(p => { BY[p.slug] = p; });
const SRC = {};
D.sources.forEach((s, i) => { SRC[s.k] = { n: i + 1, t: s.t, u: s.u }; });

/* ---------------- state ---------------- */
function defState() {
  return { v: 2, lang: "en", scen: "real", hidden: [], gshift: 0, tl: {}, rev: {}, scores: {},
    w: { d: [1, 1, 1, 1, 1, 1], m: [1, 1, 1, 1, 1], split: 50 }, schemes: {}, addSchemes: [], fund: {}, links: {} };
}
let S = defState();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) S = Object.assign(defState(), JSON.parse(raw));
} catch (e) { /* storage unavailable */ }
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

function scores(p) { const o = S.scores[p.slug] || {}; return { d: o.d || p.scores.d, m: o.m || p.scores.m }; }
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
const U = { tlEditing: false, scoresOpen: false, wOpen: false, sort: { k: "p", dir: -1 }, pf: "", pp: "", ph: false, panel: null, last: "" };

const ICON = {
  search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>',
  gear: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"/></svg>',
};
const VIEWS = {};
const TABS = [["overview", "tab_overview"], ["priority", "tab_priority"], ["products", "tab_products"], ["funding", "tab_funding"], ["guide", "tab_guide"], ["sources", "tab_sources"]];
const PTABS = [["plan", "pd_plan"], ["revenue", "pd_revenue"], ["partners", "pd_partners"], ["resources", "pd_resources"], ["risks", "pd_risks"], ["links", "pd_links"]];

function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const parts = h.split("/");
  return { v: TABS.some(t => t[0] === parts[0]) ? parts[0] : "overview", a: parts[1] || "", b: parts[2] || "" };
}

/* ---------------- chrome ---------------- */
function renderChrome(r) {
  document.documentElement.lang = S.lang;
  document.title = T("title");
  byId("b-title").textContent = T("title");
  byId("b-sub").textContent = T("subtitle");
  const q = byId("q");
  q.placeholder = T("search_ph"); q.setAttribute("aria-label", T("search_ph"));
  byId("langctl").innerHTML = ["en", "id"].map(l => `<button type="button" data-act="lang" data-v="${l}" aria-pressed="${S.lang === l}">${l.toUpperCase()}</button>`).join("");
  byId("langctl").setAttribute("aria-label", "Language / Bahasa");
  byId("setbtn").innerHTML = ICON.gear + `<span>${esc(T("settings"))}</span>`;
  byId("tabs").innerHTML = TABS.map(([k, lab]) => `<a href="#/${k}" ${r.v === k ? 'aria-current="page"' : ""}>${esc(T(lab))}</a>`).join("") +
    (S.hidden.length ? `<button type="button" class="hiddenflag" data-act="settings" style="border:0;background:none;cursor:pointer">${S.hidden.length} ${esc(T("hidden_note"))}</button>` : "");
  byId("scen-l").textContent = T("scenario");
  byId("scenctl").setAttribute("aria-label", T("scenario"));
  byId("scenctl").innerHTML = SC.map(s => `<button type="button" data-act="scen" data-v="${s}" aria-pressed="${S.scen === s}">${esc(T(s))}</button>`).join("");
}
function byId(id) { return document.getElementById(id); }

function render() {
  clearCache();
  const r = route();
  renderChrome(r);
  const ae = document.activeElement;
  const fid = ae && ae.id && ae !== document.body ? ae.id : null;
  let sel = null;
  try { if (fid && ae.selectionStart != null) sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { sel = null; }
  const m = byId("main");
  m.innerHTML = (VIEWS[r.v] || VIEWS.overview)(r);
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
  if (key !== U.last && !(r.v === "sources" && r.a)) window.scrollTo(0, 0);
  U.last = key;
}

function scenNote() {
  return `<p class="scen-note"><b>${esc(T(S.scen))}.</b> ${esc(T("scen_" + S.scen))}</p>`;
}

/* ---------------- timeline ---------------- */
function tlHead() {
  return `<div class="tl-h"><div></div><div class="tl-years">${Y.map(y => `<div class="tl-y"><b>${y}</b><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span></div>`).join("")}</div></div>`;
}
function tlRow(p, opts) {
  const t = tl(p), g = S.gshift, nm = short(p);
  let h = "";
  const segs = t.seg.map(s => [s[0] + g, s[1] + g, s[2]]).filter(s => s[1] >= 0 && s[0] <= 15).map(s => [Math.max(0, s[0]), Math.min(15, s[1]), s[2]]);
  segs.forEach((s, i) => {
    const cls = "tseg ph-" + s[2] + (i === 0 ? " st" : "") + (i === segs.length - 1 ? " en" : "");
    const tip = `${nm}: ${T("phase_" + s[2])}, ${ql(s[0])} - ${ql(s[1])}`;
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
  return `<div class="tl-r${isHidden(p) ? " hid" : ""}"><div class="tl-l"><span class="tl-no">${p.id}</span><a href="#/products/${p.slug}">${esc(nm)}</a>${t.edited ? `<span class="edited" title="${esc(T("edited"))}">*</span>` : ""}${ed}</div><div class="tl-t">${h}${outLabel}</div></div>`;
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
  const bar = `<div class="tlbar">${legend()}<div class="ctl noprint">${U.tlEditing ? `<span class="gshift">${esc(T("shift_all"))} <button type="button" class="btn sm" data-act="gshift" data-d="-1" aria-label="${esc(T("earlier"))}">&#9664;</button><b>${gs > 0 ? "+" : ""}${gs} ${esc(T("quarters"))}</b><button type="button" class="btn sm" data-act="gshift" data-d="1" aria-label="${esc(T("later"))}">&#9654;</button></span>` : ""}<button type="button" class="btn sm${U.tlEditing ? " primary" : ""}" data-act="tledit" aria-pressed="${U.tlEditing}">${esc(U.tlEditing ? T("done_editing") : T("edit_tl"))}</button></div></div>`;
  return `<div class="tlbox${U.tlEditing ? " editing" : ""}">${bar}<div class="tlscroll"><div class="tl" role="img" aria-label="${esc(T("ov_h"))}">${tlHead()}${rows}</div></div></div>`;
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
  <div class="kpis">
   <div class="kpi"><b>${cnt[sc]} / ${sh.length}</b><span>${esc(T("kpi_products"))}</span><em>${rng(cnt, v => v)}</em></div>
   <div class="kpi"><b>${rpBig(tot[sc])}</b><span>${esc(T("kpi_total"))}</span><em>${rng(tot, rpBig)}</em></div>
   <div class="kpi"><b>${rpBig(t30[sc])}</b><span>${esc(T("kpi_2030"))}</span><em>${rng(t30, rpBig)}</em></div>
  </div>
  <p class="note">${esc(T("kpi_note"))}</p>
  ${timeline(sh)}
  <div class="two sec">
   <div class="card chart"><h2>${esc(T("rev_by_product"))}</h2><p class="note" style="margin-bottom:8px">${esc(T("rp_juta"))}. ${esc(T("range_note"))}</p>${chartByProduct(sh)}</div>
   <div class="card chart"><h2>${esc(T("rev_by_year"))}</h2><p class="note" style="margin-bottom:8px">${esc(T("rp_juta"))}. ${esc(T("range_note"))}</p>${chartByYear(sh)}
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
  const rows = list.map(p => ({ p, r: prio(p), f: firstEff(p, S.scen), inc: income(p, S.scen).tot, rank: rk[p.slug] }));
  const k = U.sort.k, dir = U.sort.dir;
  const val = o => k === "name" ? short(o.p).toLowerCase() : k === "d" ? o.r.d : k === "m" ? o.r.m : k === "first" ? (o.f == null ? 99 : o.f) : k === "inc" ? o.inc : o.r.p;
  rows.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || a.rank - b.rank; });
  const th = (key, lab, n) => `<th class="${n ? "n" : ""}"><button type="button" class="sort" data-act="sort" data-k="${key}" ${U.sort.k === key ? `aria-sort="${dir > 0 ? "ascending" : "descending"}"` : ""}>${esc(lab)}</button></th>`;
  return `<div class="tw"><table><thead><tr><th class="n">#</th>${th("name", T("product"))}${th("d", T("doability"), 1)}${th("m", T("market"), 1)}${th("p", T("priority"), 1)}<th>${esc(T("quadrant"))}</th>${th("first", T("first_income"))}${th("inc", T("income_short"), 1)}<th>${esc(T("next_action"))}</th></tr></thead><tbody>
  ${rows.map(o => `<tr><td class="n">${o.rank}</td><td style="min-width:170px"><a href="#/products/${o.p.slug}">${esc(short(o.p))}</a><div class="small muted">${esc(pathName(o.p.pathway))}</div></td><td class="n">${num(o.r.d, 1)}</td><td class="n">${num(o.r.m, 1)}</td><td class="n"><b>${num(o.r.p, 2)}</b></td><td><span class="qchip q-${o.r.q}">${esc(T("q_" + o.r.q))}</span></td><td>${esc(ql(o.f))}</td><td class="n">${num(o.inc)}</td><td class="small" style="min-width:280px">${esc(L(o.p.next))}</td></tr>`).join("")}
  </tbody></table></div>`;
}
function scoreEditor(list) {
  const hd = (arr, pfx) => arr.map((c, i) => `<th class="n" title="${esc(L(c))}"><span data-tip="${esc(L(c))}">${pfx}${i + 1}</span></th>`).join("");
  return `<div class="scorebox card"><div class="tlbar"><h3 style="margin:0">${esc(T("edit_scores"))}</h3><button type="button" class="btn sm" data-act="scorereset">${esc(T("reset_scores"))}</button></div>
  <p class="note">${esc(T("score_help"))}</p>
  <div class="small" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px 16px;margin:8px 0">${D.criteria.d.map((c, i) => `<span><b>D${i + 1}</b> ${esc(L(c))}</span>`).join("")}${D.criteria.m.map((c, i) => `<span><b>M${i + 1}</b> ${esc(L(c))}</span>`).join("")}</div>
  <div class="tw"><table><thead><tr><th>${esc(T("product"))}</th>${hd(D.criteria.d, "D")}${hd(D.criteria.m, "M")}</tr></thead><tbody>
  ${list.map(p => { const s = scores(p); return `<tr><td>${esc(short(p))}${S.scores[p.slug] ? `<span class="edited">${esc(T("edited"))}</span>` : ""}</td>${s.d.map((v, i) => `<td class="n"><input class="inp tiny" type="number" min="1" max="5" step="1" id="sc-${p.slug}-d-${i}" value="${v}" data-on="score" data-slug="${p.slug}" data-t="d" data-i="${i}" aria-label="${esc(short(p) + " D" + (i + 1))}"></td>`).join("")}${s.m.map((v, i) => `<td class="n"><input class="inp tiny" type="number" min="1" max="5" step="1" id="sc-${p.slug}-m-${i}" value="${v}" data-on="score" data-slug="${p.slug}" data-t="m" data-i="${i}" aria-label="${esc(short(p) + " M" + (i + 1))}"></td>`).join("")}</tr>`; }).join("")}
  </tbody></table></div></div>`;
}
function quadLists(list) {
  const g = { do: [], partner: [], small: [], park: [] };
  list.forEach(p => g[prio(p).q].push(p));
  const box = k => `<div class="qbox q-${k}-b"><h3><span class="qchip q-${k}">${esc(T("q_" + k))}</span> <span class="muted small">${g[k].length}</span></h3><p class="small muted">${esc(T("qd_" + k))}</p><ul class="clean small">${g[k].sort((a, b) => prio(b).p - prio(a).p).map(p => `<li><a href="#/products/${p.slug}">${p.id} ${esc(short(p))}</a></li>`).join("") || `<li class="muted">-</li>`}</ul></div>`;
  return `<div class="qgrid4">${box("partner")}${box("do")}${box("park")}${box("small")}</div>`;
}
function prioOut() {
  const sh = shown();
  return `<div class="prio"><div class="card chart">${scatter(sh)}</div>${quadLists(sh)}</div><div class="sec">${prioTable(sh)}</div>`;
}
VIEWS.priority = () => {
  const w = S.w;
  const wl = (arr, key) => arr.map((c, i) => `<div><label for="w-${key}-${i}">${esc(L(c))}</label><span><input type="range" min="0" max="3" step="1" id="w-${key}-${i}" value="${w[key][i]}" data-in="w" data-t="${key}" data-i="${i}"> <b id="wv-${key}-${i}">${w[key][i]}</b></span></div>`).join("");
  return `<div class="vhead"><div><h1>${esc(T("pr_h"))}</h1><p class="lede">${esc(T("pr_intro"))}</p></div>${scenNote()}</div>
  <div class="ctlbox">
   <div class="rng"><label for="w-split">${esc(T("weight_split"))}</label><input type="range" id="w-split" min="0" max="100" step="5" value="${w.split}" data-in="split"><b id="wv-split">${w.split}% / ${100 - w.split}%</b><span class="muted small">${esc(T("doability"))} / ${esc(T("market"))}</span></div>
   <div class="btnrow"><button type="button" class="btn sm" data-act="wopen" aria-expanded="${U.wOpen}">${esc(T("criteria_w"))}</button><button type="button" class="btn sm" data-act="scoresopen" aria-expanded="${U.scoresOpen}">${esc(U.scoresOpen ? T("hide_scores") : T("edit_scores"))}</button><button type="button" class="btn sm" data-act="wreset">${esc(T("reset_weights"))}</button></div>
   ${U.wOpen ? `<div class="two"><div><h4>${esc(T("doability"))}</h4><div class="wgrid" style="grid-template-columns:1fr">${wl(D.criteria.d, "d")}</div></div><div><h4>${esc(T("market"))}</h4><div class="wgrid" style="grid-template-columns:1fr">${wl(D.criteria.m, "m")}</div></div></div>` : ""}
  </div>
  <div id="prio-out">${prioOut()}</div>
  ${U.scoresOpen ? scoreEditor(shown()) : ""}
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
    h += `<li class="pg">${esc(L(pw.name))}</li>` + ps.map(p => `<li><a href="#/products/${p.slug}" class="${isHidden(p) ? "hid" : ""}" ${p.slug === cur ? 'aria-current="page"' : ""}><span class="tl-no">${p.id}</span><span>${esc(short(p))}</span></a></li>`).join("");
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
function planTab(p) {
  const t = tl(p), off = t.qs + S.gshift;
  const fsel = firstEff(p, S.scen);
  let grid = `<div class="qgrid"><div></div>${[1, 2, 3, 4].map(q => `<div class="qh">Q${q}</div>`).join("")}`;
  Y.forEach((y, yi) => {
    grid += `<div class="yh">${y}</div>`;
    for (let k = 0; k < 4; k++) {
      const q = yi * 4 + k, i = q - off, ph = phaseAt(p, q);
      const txt = i >= 0 && i < 16 ? L(p.q[i]) : "";
      const gates = t.gates.filter(g => g[0] + S.gshift === q).map(g => `<span class="gt">${esc(T("gate"))}: ${esc(L(g[1]))}</span>`).join("");
      const fi = fsel === q ? `<span class="fi">&#9670; ${esc(T("first_income"))} (${esc(T(S.scen))})</span>` : "";
      grid += `<div class="qc${ph ? " ph-" + ph + "-b" : ""}${txt ? "" : " mt"}"><span class="pt">${ph ? esc(T("phase_" + ph)) : "&nbsp;"}</span><span class="qn">Q${k + 1}</span>${txt ? LC(p.q[i]) : "&nbsp;"}${gates}${fi}</div>`;
    }
  });
  grid += "</div>";
  const before = [], after = [];
  p.q.forEach((g, i) => { const q = i + off; if (q < 0) before.push([i, g]); if (q > 15) after.push([i, g]); });
  const orig = i => ql(i);
  const mv = (arr, lab) => arr.length ? `<div class="moved"><h4>${esc(lab)}</h4><ul class="clean">${arr.map(([i, g]) => `<li><span class="muted">${esc(T("goal"))} ${esc(orig(i))}:</span> ${LC(g)}</li>`).join("")}</ul></div>` : "";
  return `<div class="two"><div class="card"><h3>${esc(T("now"))}</h3><p>${LC(p.now)}</p></div><div class="card"><h3>${esc(T("route"))}</h3><p>${LC(p.path)}</p><p class="small muted">${esc(pathName(p.pathway))}</p></div></div>
  <div class="tlbox"><div class="tlbar">${legend()}<div class="ctl noprint"><button type="button" class="btn sm" data-act="shift" data-slug="${p.slug}" data-d="-1">&#9664; ${esc(T("earlier"))}</button><button type="button" class="btn sm" data-act="shift" data-slug="${p.slug}" data-d="1">${esc(T("later"))} &#9654;</button><button type="button" class="btn sm" data-act="drawer" data-slug="${p.slug}">${esc(T("edit_phase"))}</button></div></div><div class="tlscroll"><div class="tl">${tlHead()}${tlRow(p, { noEdit: true })}</div></div></div>
  <h3 class="sec">${esc(T("quarter_goals"))}</h3>${grid}${mv(before, T("goal_earlier"))}${mv(after, T("goal_after"))}
  <div class="two sec"><div class="card"><h3>${esc(T("inventor_asks"))}</h3><ul class="clean">${p.asks.map(a => `<li>${LC(a)}</li>`).join("")}</ul></div><div class="card"><h3>${esc(T("kpi_count"))}</h3><p>${LC(p.kpi)}</p></div></div>`;
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
  return `<h3>${esc(T("income_binus"))} (${esc(T("rp_juta"))})</h3>${tbl}${notes.map(n => `<p class="note">${esc(n)}</p>`).join("")}
  <div class="sec"><div class="tlbar"><h3 style="margin:0">${esc(T("edit_assumptions"))}: ${esc(T(sc))}${S.rev[p.slug] ? `<span class="edited">${esc(T("edited"))}</span>` : ""}</h3>${S.rev[p.slug] ? `<button type="button" class="btn sm noprint" data-act="revreset" data-slug="${p.slug}">${esc(T("reset_product"))}</button>` : ""}</div><p class="note" style="margin-bottom:10px">${esc(T("rev_help"))}</p>${ed}</div>
  <div class="two sec"><div class="card"><h3>${esc(T("assumptions"))}</h3><ul class="clean">${p.assume.map(a => `<li>${LC(a)}</li>`).join("")}${st.length ? `<li>${esc(T("real_assume"))}</li>` : ""}</ul>${S.rev[p.slug] ? `<p class="note">${esc(T("assume_edited"))}</p>` : ""}</div><div class="card"><h3>${esc(T("kpi_count"))}</h3><p>${LC(p.kpi)}</p></div></div>${sroi}`;
}
function partnersTab(p) {
  const st = { comm: "st_comm", fail: "st_fail", res: "st_res", pat: "st_pat", prog: "st_prog" };
  return `<div class="tw"><table><thead><tr><th>${esc(T("role"))}</th><th>${esc(T("who"))}</th><th>${esc(T("why_them"))}</th></tr></thead><tbody>${p.partners.map(r => `<tr><td><b>${LC(r[0])}</b></td><td>${LC(r[1])}</td><td>${LC(r[2])}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">${esc(T("cand_note"))}</p>
  <h3 class="sec">${esc(T("comparables"))}</h3><p class="note" style="margin-bottom:10px">${esc(T("comp_intro"))}</p>
  <div class="comps">${p.comps.map(c => `<div class="comp"><span class="st st-${c.status}">${esc(T(st[c.status]))}</span><h3>${esc(L(c.name))}</h3><p>${LC(c.what)}</p><p><span class="muted">${esc(T("lesson"))}:</span> ${LC(c.lesson)}</p>${c.opp ? (/^Benchmark/.test(c.opp.en) ? `<p class="small muted">${LC(c.opp)}</p>` : `<div class="opp"><b>${esc(T("opportunity"))}</b>${LC(c.opp)}</div>`) : ""}</div>`).join("")}</div>`;
}
function resourcesTab(p) {
  const fs = fundSum(p), ls = lines(p);
  const yrs = Y.concat([2031]);
  const stOpts = sel => ["planned", "submitted", "awarded", "rejected"].map(s => `<option value="${s}"${s === sel ? " selected" : ""}>${esc(T("f_" + s))}</option>`).join("");
  const scOpts = sel => schemes().map(s => `<option value="${s.id}"${s.id === sel ? " selected" : ""}>${esc(L(s.name))}</option>`).join("");
  const rows = ls.map((l, i) => `<tr><td><select class="inp" id="fl-${p.slug}-${i}-s" data-on="fund" data-slug="${p.slug}" data-i="${i}" data-f="s" aria-label="${esc(T("scheme"))}">${scOpts(l.s)}</select></td><td><select class="inp" id="fl-${p.slug}-${i}-y" data-on="fund" data-slug="${p.slug}" data-i="${i}" data-f="y" aria-label="${esc(T("year"))}">${yrs.map(y => `<option${y === +l.y ? " selected" : ""}>${y}</option>`).join("")}</select></td><td class="n"><input class="inp num" type="number" min="0" step="any" id="fl-${p.slug}-${i}-a" value="${l.a}" data-on="fund" data-slug="${p.slug}" data-i="${i}" data-f="a" aria-label="${esc(T("amount"))}"></td><td><select class="inp" id="fl-${p.slug}-${i}-st" data-on="fund" data-slug="${p.slug}" data-i="${i}" data-f="st" aria-label="${esc(T("status_f"))}">${stOpts(l.st)}</select></td><td><button type="button" class="btn sm warn noprint" data-act="funddel" data-slug="${p.slug}" data-i="${i}">${esc(T("remove"))}</button></td></tr>`).join("");
  const mx = Math.max(fs.need[1], fs.aw + fs.pi, 1);
  return `<div class="two"><div class="card"><h3>${esc(T("res_needed"))}</h3><dl class="kv"><dt>${esc(T("cash"))}</dt><dd>${LC(p.res.cash)}</dd><dt>${esc(T("cash_src"))}</dt><dd>${LC(p.res.sources)}</dd><dt>${esc(T("inkind"))}</dt><dd>${LC(p.res.inkind)}</dd><dt>${esc(T("people"))}</dt><dd>${LC(p.res.people)}</dd></dl></div>
  <div class="card"><h3>${esc(T("fund_position"))}</h3><dl class="kv"><dt>${esc(T("need"))}</dt><dd>${rpj(fs.need[0])} - ${rpj(fs.need[1])}</dd><dt>${esc(T("awarded"))}</dt><dd>${rpj(fs.aw)}</dd><dt>${esc(T("pipeline"))}</dt><dd>${rpj(fs.pi)}</dd><dt>${esc(T("unsecured"))}</dt><dd>${fs.uns ? rpj(fs.uns) : esc(T("covered"))}</dd><dt>${esc(T("gap"))}</dt><dd><b style="color:${fs.gap ? "var(--bad)" : "var(--good)"}">${fs.gap ? rpj(fs.gap) : esc(T("covered"))}</b></dd></dl>
  <div class="bar-need" role="img" aria-label="${esc(T("awarded") + " " + rpj(fs.aw) + ", " + T("pipeline") + " " + rpj(fs.pi))}"><i class="aw" style="width:${fs.aw / mx * 100}%"></i><i class="pi" style="left:${fs.aw / mx * 100}%;width:${fs.pi / mx * 100}%"></i></div><p class="note">${esc(T("bar_legend"))}</p></div></div>
  <h3 class="sec">${esc(T("funding_plan"))}</h3>
  <div class="tw"><table><thead><tr><th>${esc(T("scheme"))}</th><th>${esc(T("year"))}</th><th class="n">${esc(T("amount"))}</th><th>${esc(T("status_f"))}</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="muted">${esc(T("no_lines"))}</td></tr>`}</tbody></table></div>
  <div class="btnrow noprint"><button type="button" class="btn sm" data-act="fundadd" data-slug="${p.slug}">${esc(T("add_line"))}</button>${S.fund[p.slug] ? `<button type="button" class="btn sm" data-act="fundreset" data-slug="${p.slug}">${esc(T("reset_product"))}</button>` : ""}<a class="btn sm" href="#/funding">${esc(T("see_schemes"))}</a></div>
  <h3 class="sec">${esc(T("helix"))}</h3><div class="helix4">${["binus", "gov", "industry", "community"].map(k => `<div><b>${esc(T(k))}</b>${LC(p.helix[k])}</div>`).join("")}</div>`;
}
function risksTab(p) {
  const sw = k => `<div><h4>${esc(T(k))}</h4><ul class="clean">${p.swot[k].map(x => `<li>${LC(x)}</li>`).join("")}</ul></div>`;
  return `<div class="swot">${sw("pros")}${sw("cons")}${sw("opps")}${sw("threats")}</div>
  <h3 class="sec">${esc(T("checks"))}</h3><div class="tw"><table><thead><tr><th>${esc(T("when"))}</th><th>${esc(T("pass_if"))}</th><th>${esc(T("if_not"))}</th></tr></thead><tbody>${p.gl.map(g => `<tr><td style="white-space:nowrap"><b>${LC(g[0])}</b></td><td>${LC(g[1])}</td><td>${LC(g[2])}</td></tr>`).join("")}</tbody></table></div>
  <p class="note">${esc(T("gate_note"))}</p>`;
}
function linksTab(p) {
  const ls = links(p);
  return `<h3>${esc(T("links"))}</h3>${ls.length ? `<ul class="linklist">${ls.map((l, i) => `<li><span><b>${esc(L(l.label))}</b><br><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url)}</a></span><button type="button" class="btn sm warn noprint" data-act="linkdel" data-slug="${p.slug}" data-i="${i}">${esc(T("remove"))}</button></li>`).join("")}</ul>` : `<p class="muted">${esc(T("no_links"))}</p>`}
  <div class="addrow noprint"><input class="inp" id="nl-label" placeholder="${esc(T("link_label"))}" aria-label="${esc(T("link_label"))}"><input class="inp" id="nl-url" type="url" placeholder="https://" aria-label="${esc(T("link_url"))}"><button type="button" class="btn sm primary" data-act="linkadd" data-slug="${p.slug}">${esc(T("add_link"))}</button></div>
  <h3 class="sec">${esc(T("share_h"))}</h3><p class="small muted">${esc(T("share_help"))}</p><div class="btnrow noprint">${PTABS.map(([k, lab]) => `<button type="button" class="btn sm" data-act="copylink" data-slug="${p.slug}" data-tab="${k}">${esc(T(lab))}</button>`).join("")}</div>`;
}
VIEWS.products = r => {
  let slug = r.a;
  if (!BY[slug]) slug = (shown()[0] || P[0]).slug;
  const tab = PTABS.some(t => t[0] === r.b) ? r.b : "plan";
  const p = BY[slug];
  const inc = SC.map(s => income(p, s).tot);
  const pr = prio(p), rk = rankMap()[slug];
  const fsel = firstEff(p, S.scen);
  const panels = { plan: planTab, revenue: revenueTab, partners: partnersTab, resources: resourcesTab, risks: risksTab, links: linksTab };
  const list = `<aside class="plist" aria-label="${esc(T("pd_list"))}"><input class="inp" id="pf" type="search" value="${esc(U.pf)}" placeholder="${esc(T("filter_list"))}" aria-label="${esc(T("filter_list"))}" data-in="pf">
   <select class="inp" id="pp" data-on="pp" aria-label="${esc(T("pathway"))}"><option value="">${esc(T("filter_path"))}</option>${D.pathways.map(pw => `<option value="${pw.id}"${U.pp === pw.id ? " selected" : ""}>${esc(L(pw.name))}</option>`).join("")}</select>
   ${S.hidden.length ? `<label class="chk small"><input type="checkbox" id="phid" data-on="phid" ${U.ph ? "checked" : ""}>${esc(T("show_hidden"))}</label>` : ""}
   <ul id="plist-ul">${plistUl(slug)}</ul></aside>`;
  const msel = `<select class="inp plist-sel" id="psel" data-on="psel" aria-label="${esc(T("pd_list"))}">${P.map(x => `<option value="${x.slug}"${x.slug === slug ? " selected" : ""}>${x.id} ${esc(short(x))}${isHidden(x) ? " (" + esc(T("hidden")) + ")" : ""}</option>`).join("")}</select>`;
  const others = SC.filter(s => s !== S.scen).map(s => `${T(s)}: ${ql(firstEff(p, s))}`).join(", ");
  const head = `<div class="ph"><div class="ph-top"><div><p class="small muted" style="margin:0">${p.id} &middot; ${esc(pathName(p.pathway))}${isHidden(p) ? ` &middot; <b style="color:var(--warn)">${esc(T("hidden"))}</b>` : ""}</p><h1>${esc(L(p.name))}</h1><p class="lead">${esc(L(p.lead))}</p></div>
   <div class="btnrow noprint"><button type="button" class="btn sm" data-act="copylink" data-slug="${slug}" data-tab="${tab}">${esc(T("copy_link"))}</button><button type="button" class="btn sm" data-act="print">${esc(T("print"))}</button><button type="button" class="btn sm" data-act="hidetoggle" data-slug="${slug}">${esc(isHidden(p) ? T("unhide_product") : T("hide_product"))}</button></div></div>
   <div class="facts"><div class="fact"><span>${esc(T("first_income"))} (${esc(T(S.scen))})</span><b>${esc(ql(fsel))}</b><small>${esc(others)}</small></div>
   <div class="fact"><span>${esc(T("income_binus"))} 2027-2030 (${esc(T(S.scen))})</span><b>${rpj(inc[SC.indexOf(S.scen)])}</b><small>${esc(T("range"))}: ${num(Math.min(...inc))} - ${num(Math.max(...inc))}</small></div>
   <div class="fact"><span>${esc(T("priority"))}</span><b><span class="qchip q-${pr.q}">${esc(T("q_" + pr.q))}</span> ${isHidden(p) ? "" : "#" + rk}</b><small>${esc(T("doability"))} ${num(pr.d, 1)}, ${esc(T("market"))} ${num(pr.m, 1)}</small></div></div>
   <p class="nextact"><b>${esc(T("next_action"))}:</b> ${LC(p.next)}</p></div>`;
  const tabs = `<nav class="ptabs" role="tablist">${PTABS.map(([k, lab]) => `<a role="tab" href="#/products/${slug}/${k}" aria-selected="${k === tab}">${esc(T(lab))}</a>`).join("")}</nav>`;
  const body = PTABS.map(([k, lab]) => `<section class="tp${k === tab ? " on" : ""}" role="tabpanel" aria-label="${esc(T(lab))}"><h2 class="ptitle">${esc(T(lab))}</h2>${panels[k](p)}</section>`).join("");
  return `<div class="pv">${list}<div>${msel}${head}${tabs}${body}</div></div>`;
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
  <div class="tw"><table><thead><tr><th>${esc(T("product"))}</th><th class="n">${esc(T("need"))}</th><th class="n">${esc(T("awarded"))}</th><th class="n">${esc(T("pipeline"))}</th><th class="n">${esc(T("unsecured"))}</th><th class="n">${esc(T("gap"))}</th><th>${esc(T("position"))}</th><th class="n">${esc(T("lines"))}</th></tr></thead><tbody>${prows}
  <tr><td><b>${esc(T("total"))}</b></td><td class="n"><b>${num(tot.need0)} - ${num(tot.need1)}</b></td><td class="n"><b>${num(tot.aw)}</b></td><td class="n"><b>${num(tot.pi)}</b></td><td class="n"><b>${num(tot.uns)}</b></td><td class="n"><b>${num(tot.gap)}</b></td><td></td><td></td></tr></tbody></table></div>
  <p class="note">${esc(T("rp_juta"))}. ${esc(T("bar_legend"))} ${esc(T("fund_note"))}</p>
  <h2 class="sec">${esc(T("by_scheme_year"))}</h2>
  <div class="tw"><table><thead><tr><th>${esc(T("scheme"))}</th>${yrs.map(y => `<th class="n">${y === 2031 ? "2031+" : y}</th>`).join("")}</tr></thead><tbody>${used.map(s => `<tr><td>${esc(L(s.name))}</td>${yrs.map(y => `<td class="n">${cell(mat[s.id][y])}</td>`).join("")}</tr>`).join("")}<tr><td><b>${esc(T("total"))}</b></td>${coltot.map(c => `<td class="n"><b>${cell(c[1] ? c : null)}</b></td>`).join("")}</tr></tbody></table></div>
  <p class="note">${esc(T("rp_juta"))}. ${esc(T("matrix_note"))}</p>
  <h2 class="sec">${esc(T("schemes_h"))}</h2><p class="note" style="margin-bottom:8px">${esc(T("schemes_help"))}</p>
  <div class="tw"><table><thead><tr><th>${esc(T("name"))}</th><th class="n">${esc(T("max"))}</th><th>${esc(T("tkt"))}</th><th>${esc(T("cycle"))}</th><th>${esc(T("notes"))}</th><th></th></tr></thead><tbody>${scs.map(srow).join("")}</tbody></table></div>
  <div class="btnrow"><button type="button" class="btn sm" data-act="schemeadd">${esc(T("add_scheme"))}</button>${Object.keys(S.schemes).length || S.addSchemes.length ? `<button type="button" class="btn sm" data-act="schemereset">${esc(T("reset_schemes"))}</button>` : ""}</div>
  <h3 class="sec">${esc(T("scheme_sources"))}</h3><ul class="clean small">${D.schemes.map(s => `<li><b>${esc(L(s.name))}</b>: ${LC(s.notes)}</li>`).join("")}</ul>`;
};

/* ---------------- guide ---------------- */
VIEWS.guide = () => {
  const paths = D.pathways.map(pw => `<div class="path"><h3>${esc(L(pw.name))}</h3><p class="who">${esc(L(pw.who))}</p><p class="small">${LC(pw.idea)}</p><ol>${pw.steps.map(s => `<li>${esc(L(s))}</li>`).join("")}</ol><p class="ex">${P.filter(p => p.pathway === pw.id).map(p => `<a href="#/products/${p.slug}">${esc(short(p))}</a>`).join(", ")}</p></div>`).join("");
  return `<div class="vhead"><div><h1>${esc(T("gd_h"))}</h1><p class="lede">${esc(T("gd_intro"))}</p></div></div>
  <h2>${esc(T("gd_pathways"))}</h2><div class="paths">${paths}</div>
  <h2 class="sec">${esc(T("gd_start"))}</h2><ul class="clean">${D.checklist.map(c => `<li>${esc(L(c))}</li>`).join("")}</ul>
  <h2 class="sec">${esc(T("gd_permits"))}</h2><div class="tw"><table><thead><tr><th>${esc(T("type"))}</th><th>${esc(T("required"))}</th><th>${esc(T("applies_to"))}</th></tr></thead><tbody>${D.regulatory.map(r => `<tr><td><b>${esc(L(r.type))}</b></td><td>${LC(r.req)}</td><td>${esc(L(r.applies))}</td></tr>`).join("")}</tbody></table></div>
  <h2 class="sec">${esc(T("gd_helix"))}</h2><div class="tw"><table><tbody>${D.helix.map(h => `<tr><td style="width:180px"><b>${esc(L(h.who))}</b></td><td>${LC(h.role)}</td></tr>`).join("")}</tbody></table></div>`;
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
  lang: b => { S.lang = b.dataset.v; changed(); },
  scen: b => { S.scen = b.dataset.v; changed(); },
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

const ON = {
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

window.addEventListener("hashchange", render);
window.addEventListener("beforeprint", () => { tip.style.display = "none"; });
render();
