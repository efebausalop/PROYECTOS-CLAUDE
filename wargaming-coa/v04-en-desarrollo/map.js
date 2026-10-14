/* ==========================================================================
   WGMap — renderizador del plano «Mesa de planeamiento con calcos» (v0.4 MESA)
   Renderizador puro: recibe un MapState (§6.3) y emite ganchos (hooks). Nunca
   lee la operación ni WGUI y nunca muta datos.
   - Capas estáticas (sheet, base, cm, marg): innerHTML sólo cuando cambian
     hash.base / hash.cm (o el aspecto). Capas dinámicas: elementos indexados por
     id; sólo se parchean los atributos que cambian (sin innerHTML de grupo).
   - Tamaño constante en pantalla: grupos .mp-sc con translate(x,y) scale(upp)
     (upp = unidades SVG por píxel). Trazos con vector-effect: non-scaling-stroke.
   - Colores sólo por variables CSS (css/map.css): el tema no exige re-render.
   - Tablero: x = 1000·u, y = H·v, H = 1000 / aspect; banda de marginalia 28/30.
   Extensiones opcionales del MapState (si faltan hay valores por defecto):
   axis {att, from} · bands {green, amber} · ffirT (0..1) · showAll ·
   features[].dir / graphics[].dir [dx,dy] · graphics[].ech|w|me ·
   contacts[].label|outLabel · units[].title.
   ========================================================================== */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const HAS_DOM = typeof document !== 'undefined' && typeof document.createElementNS === 'function';
  const MX = 28, MY = 30, KMAX = 12;
  const LAYERS = ['sheet', 'base', 'cm', 'flot', 'isr', 'red', 'blue', 'sync', 'dps', 'method', 'adj', 'edit', 'marg'];
  const TOGGLE = ['base', 'cm', 'isr', 'red', 'blue', 'sync', 'adj', 'method', 'relief', 'grid'];
  const DRAW = { line: 2, area: 3, nai: 3, point: 1 };
  const ECHW = { team: 8, squad: 8, section: 8, platoon: 8, company: 10, battalion: 14, regiment: 18, brigade: 22, division: 30, corps: 36, army: 40 };
  const LETTER = { delay: 'R', withdraw: 'W', screen: 'S', fix: 'F', catk: 'CATK' };
  const POINTK = { bp: 1, hill: 1, crossing: 1, lz: 1, note: 1, offboard: 1 };
  const LINEK = { line: 1, redline: 1, obstacle: 1 };
  const ZORD = { area: 0, urban: 1, water: 1, nai: 2, tai: 2, ea: 3, obj: 4, beach: 5, obstacle: 6, line: 7, redline: 8, bp: 9, hill: 9, crossing: 9, lz: 9, note: 10, offboard: 10 };
  const CLSK = { in: 1, inf: 1, edge: 1, ctx: 1, out: 1, auto: 1, lowconf: 1, ghost: 1, sel: 1, active: 1, open: 1, dashed: 1, nochain: 1 };
  const FONT_H = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';
  const FONT_M = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
  const RES_ES = { 'DECISIVE SUCCESS': 'Éxito decisivo', 'SUCCESS': 'Éxito', 'PARTIAL SUCCESS': 'Éxito parcial', 'NEUTRAL': 'Neutral', 'FAILURE': 'Fracaso', 'DECISIVE FAILURE': 'Fracaso decisivo', 'NO CONTACT': 'Sin contacto' };

  /* ------------------------------ utilidades ------------------------------ */
  const F = x => { const r = Math.round(x * 100) / 100; return String(Object.is(r, -0) ? 0 : r); };
  const r1 = x => Math.round(x * 10) / 10;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const addv = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const unit = d => { const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
  const perp = d => [-d[1], d[0]];
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const isNum = x => typeof x === 'number' && isFinite(x);
  const okPt = p => Array.isArray(p) && isNum(p[0]) && isNum(p[1]);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const short = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const xyS = p => F(p[0]) + ' ' + F(p[1]);
  const clsN = c => !c ? '' : ' ' + String(c).split(/\s+/).filter(Boolean).map(x => (CLSK[x] ? 'mp-' + x : x)).join(' ');
  const deg = d => Math.atan2(d[1], d[0]) * 180 / Math.PI;
  function polyLen(pl) { let s = 0; for (let i = 1; i < pl.length; i++) s += dist(pl[i - 1], pl[i]); return s; }
  function bbox(P) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    P.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; });
    return [x0, y0, x1, y1];
  }
  function areaS(P) { let a = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function mean(P) { let x = 0, y = 0; P.forEach(p => { x += p[0]; y += p[1]; }); return P.length ? [x / P.length, y / P.length] : [0, 0]; }
  function centroid(P) {
    if (P.length < 3) return mean(P);
    const A = areaS(P); if (Math.abs(A) < 1e-9) return mean(P);
    let cx = 0, cy = 0;
    for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n], f = p[0] * q[1] - q[0] * p[1]; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; }
    return [cx / (6 * A), cy / (6 * A)];
  }
  /* punto a distancia s a lo largo de la polilínea, con su dirección */
  function pointAt(pl, s) {
    if (pl.length < 2) return { pt: pl[0] || [0, 0], dir: [1, 0], i: 0 };
    let acc = 0;
    for (let i = 1; i < pl.length; i++) {
      const L = dist(pl[i - 1], pl[i]);
      if (acc + L >= s || i === pl.length - 1) {
        const k = L > 0 ? clamp((s - acc) / L, 0, 1) : 0;
        return { pt: [pl[i - 1][0] + (pl[i][0] - pl[i - 1][0]) * k, pl[i - 1][1] + (pl[i][1] - pl[i - 1][1]) * k], dir: unit(sub(pl[i], pl[i - 1])), i };
      }
      acc += L;
    }
    return { pt: pl[pl.length - 1], dir: [1, 0], i: pl.length - 1 };
  }
  function cutTo(pl, s) {
    const out = [pl[0]]; let acc = 0;
    for (let i = 1; i < pl.length; i++) {
      const L = dist(pl[i - 1], pl[i]);
      if (acc + L >= s) { const k = L > 0 ? (s - acc) / L : 0; out.push([pl[i - 1][0] + (pl[i][0] - pl[i - 1][0]) * k, pl[i - 1][1] + (pl[i][1] - pl[i - 1][1]) * k]); return out; }
      out.push(pl[i]); acc += L;
    }
    return out;
  }
  /* punto más cercano de una polilínea (o polígono cerrado) */
  function nearestOn(pt, pl, closed) {
    let best = { pt: pl[0], d: pl.length ? dist(pt, pl[0]) : Infinity, dir: [1, 0] };
    const n = pl.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = pl[i], b = pl[(i + 1) % n], ab = sub(b, a), L2 = ab[0] * ab[0] + ab[1] * ab[1];
      const k = L2 > 0 ? clamp(((pt[0] - a[0]) * ab[0] + (pt[1] - a[1]) * ab[1]) / L2, 0, 1) : 0;
      const q = [a[0] + ab[0] * k, a[1] + ab[1] * k], d = dist(pt, q);
      if (d < best.d) best = { pt: q, d, dir: unit(ab) };
    }
    return best;
  }
  const dedupe = P => P.filter((p, i) => i === 0 || dist(p, P[i - 1]) > 1e-6);

  /* ------------------------------ ayudantes gráficos (exportados) ------------------------------
     Todas las coordenadas en unidades SVG [x, y]. */
  /* trazado 'd'; smooth = Catmull-Rom → cúbicas */
  function path(pts, closed, smooth) {
    pts = (pts || []).filter(okPt);
    const n = pts.length; if (!n) return '';
    if (n === 1) return 'M' + xyS(pts[0]);
    if (!smooth || n < 3) return 'M' + pts.map(xyS).join('L') + (closed ? 'Z' : '');
    const at = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    let d = 'M' + xyS(pts[0]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      d += 'C' + xyS([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + ' ' + xyS([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + ' ' + xyS(p2);
    }
    return d + (closed ? 'Z' : '');
  }
  /* muestreo de la curva Catmull-Rom (k puntos por tramo) */
  function crSample(pts, closed, k) {
    const n = pts.length; if (n < 3) return pts.slice();
    k = k || 8;
    const at = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    const out = [pts[0].slice()], m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      for (let j = 1; j <= k; j++) {
        const t = j / k, a = (1 - t) * (1 - t) * (1 - t), b = 3 * (1 - t) * (1 - t) * t, c = 3 * (1 - t) * t * t, d = t * t * t;
        out.push([a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0], a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1]]);
      }
    }
    return out;
  }
  /* polígono de esquinas redondeadas (radio r) */
  function roundPoly(P, r) {
    const n = P.length; if (n < 3) return path(P, true, false);
    let d = '';
    for (let i = 0; i < n; i++) {
      const p = P[i], a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
      const ra = Math.min(r, dist(p, a) / 2), rb = Math.min(r, dist(p, b) / 2);
      const pa = addv(p, mul(unit(sub(a, p)), ra)), pb = addv(p, mul(unit(sub(b, p)), rb));
      d += (i ? 'L' : 'M') + xyS(pa) + 'Q' + xyS(p) + ' ' + xyS(pb);
    }
    return d + 'Z';
  }
  /* eje de avance contorneado: anchura w, punta 1,8·w de ancho y headLen de largo */
  function arrowPts(pts, width, headLen) {
    const w = width || 14, sw = w / 2, hw = w * 0.9;
    let c = dedupe((pts || []).filter(okPt));
    if (c.length < 2) return [];
    if (c.length > 2) c = dedupe(crSample(c, false, 10));
    const L = polyLen(c); if (L < 1e-6) return [];
    const hl = Math.min(headLen || w * 1.5, L * 0.6);
    const shaft = cutTo(c, L - hl), tip = c[c.length - 1], end = shaft[shaft.length - 1];
    const hd = unit(sub(tip, end)), hn = perp(hd);
    const left = [], right = [];
    for (let i = 0; i < shaft.length; i++) {
      let nv;
      if (i === shaft.length - 1) nv = hn;
      else if (i === 0) nv = perp(unit(sub(shaft[1], shaft[0])));
      else { const n1 = perp(unit(sub(shaft[i], shaft[i - 1]))), n2 = perp(unit(sub(shaft[i + 1], shaft[i]))); nv = unit(addv(n1, n2)); const cs = nv[0] * n1[0] + nv[1] * n1[1]; if (cs > 0.4) nv = mul(nv, 1 / cs); }
      left.push(addv(shaft[i], mul(nv, sw))); right.push(addv(shaft[i], mul(nv, -sw)));
    }
    return left.concat([addv(end, mul(hn, hw)), tip, addv(end, mul(hn, -hw))], right.reverse());
  }
  function arrow(pts, width, headLen) { const P = arrowPts(pts, width, headLen); return P.length ? path(P, true, false) : ''; }
  /* punta abierta (chevron) en tip con dirección dir */
  function chevron(tip, dir, hl) { const d = unit(dir), n = perp(d), b = addv(tip, mul(d, -hl)); return 'M' + xyS(addv(b, mul(n, hl * 0.55))) + 'L' + xyS(tip) + 'L' + xyS(addv(b, mul(n, -hl * 0.55))); }
  /* T (bloqueo): barra perpendicular a dir en at, con mástil hacia atrás */
  function tbar(at, dir, len) {
    len = len || 30; const d = unit(dir || [1, 0]), n = perp(d), h = len / 2;
    return 'M' + xyS(addv(at, mul(n, h))) + 'L' + xyS(addv(at, mul(n, -h))) + 'M' + xyS(at) + 'L' + xyS(addv(at, mul(d, -len * 0.7)));
  }
  /* «U» de posición de combate abierta hacia dir (tamaño = semiancho) */
  function uglyph(at, dir, size) {
    const s = size || 15, d = unit(dir || [1, 0]), n = perp(d), P = [addv(addv(at, mul(d, s)), mul(n, s))];
    for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + Math.PI * i / 8, c = Math.cos(a), sn = Math.sin(a); P.push(addv(at, addv(mul(d, c * s), mul(n, sn * s)))); }
    P.push(addv(addv(at, mul(d, s)), mul(n, -s)));
    return path(P, false, false);
  }
  /* ondas a lo largo de una polilínea (amplitud amp, longitud de onda wl) */
  function waves(pts, amp, wl) {
    const P = dedupe((pts || []).filter(okPt)); if (P.length < 2) return '';
    amp = amp || 3; wl = wl || 10;
    const L = polyLen(P), n = Math.max(2, Math.round(L / (wl / 2))), Q = [];
    for (let i = 0; i <= n; i++) { const a = pointAt(P, L * i / n), o = i === 0 || i === n ? 0 : (i % 2 ? amp : -amp); Q.push(addv(a.pt, mul(perp(a.dir), o))); }
    return path(Q, false, true);
  }
  /* zig-zag de la primera fracción frac de la polilínea */
  function zigzag(pts, amp, step, frac) {
    const P = dedupe(pts), L = polyLen(P), Lz = L * (frac || 0.75), n = Math.max(2, Math.round(Lz / (step || 10))), Q = [];
    for (let i = 0; i <= n; i++) { const a = pointAt(P, Lz * i / n), o = i === 0 ? 0 : (i % 2 ? amp : -amp); Q.push(addv(a.pt, mul(perp(a.dir), o))); }
    return Q.concat(cutTo(P.slice().reverse(), L - Lz).reverse().slice(1));
  }
  /* arco desde las 12 en sentido horario, fracción frac de la circunferencia */
  function arc(cx, cy, r, frac) {
    if (!isNum(frac) || frac <= 0) return '';
    if (frac >= 0.9999) return 'M' + F(cx) + ' ' + F(cy - r) + 'A' + F(r) + ' ' + F(r) + ' 0 1 1 ' + F(cx) + ' ' + F(cy + r) + 'A' + F(r) + ' ' + F(r) + ' 0 1 1 ' + F(cx) + ' ' + F(cy - r);
    const a = -Math.PI / 2 + 2 * Math.PI * frac;
    return 'M' + F(cx) + ' ' + F(cy - r) + 'A' + F(r) + ' ' + F(r) + ' 0 ' + (frac > 0.5 ? 1 : 0) + ' 1 ' + F(cx + r * Math.cos(a)) + ' ' + F(cy + r * Math.sin(a));
  }
  /* dientes de obstáculo a un lado de la línea */
  function teeth(P, size) {
    const L = polyLen(P), s = size || 12; let d = '';
    for (let x = s / 2; x + s <= L; x += s * 1.6) { const a = pointAt(P, x), b = pointAt(P, x + s), m = pointAt(P, x + s / 2); const tip = addv(m.pt, mul(perp(m.dir), s * 0.7)); d += 'M' + xyS(a.pt) + 'L' + xyS(tip) + 'L' + xyS(b.pt); }
    return d;
  }

  /* ------------------------------ glifos de función (16×16, trazo currentColor) ------------------------------ */
  const GLYPH = {
    c2: '<path d="M4 14.5V2"/><path d="M4 2.5h8.5l-2.2 2.8 2.2 2.8H4"/>',
    intel: '<path d="M1.5 8s2.4-4.6 6.5-4.6S14.5 8 14.5 8s-2.4 4.6-6.5 4.6S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2.1"/>',
    man: '<path d="M2.5 3.5L7 8l-4.5 4.5M8 3.5L12.5 8 8 12.5"/>',
    fires: '<path d="M8 1.2v3.2M8 11.6v3.2M1.2 8h3.2M11.6 8h3.2M3.2 3.2l2.3 2.3M10.5 10.5l2.3 2.3M3.2 12.8l2.3-2.3M10.5 5.5l2.3-2.3"/><circle cx="8" cy="8" r="1.7"/>',
    eng: '<path d="M1.2 11.5L3.6 4.5 6 11.5 8.4 4.5 10.8 11.5 13.2 4.5 14.8 9"/>',
    info: '<path d="M2 6.3v3.4h2.2l5.3 3.3V3L4.2 6.3z"/><path d="M11.8 5.6a3 3 0 010 4.8M13.4 4a5.2 5.2 0 010 8"/>',
    cimic: '<path d="M1.8 7.6L8 2.5l6.2 5.1"/><path d="M3.6 6.3v7.2h8.8V6.3"/><path d="M6.6 13.5V10h2.8v3.5"/>',
    sust: '<path d="M2 5l6-2.8L14 5v6.2L8 14 2 11.2z"/><path d="M2 5l6 2.8L14 5M8 7.8V14"/>',
    pers: '<path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z"/>',
    prot: '<path d="M8 1.8l5.6 2v4.1c0 3.4-2.4 5.6-5.6 6.4-3.2-.8-5.6-3-5.6-6.4V3.8z"/>',
    legal: '<path d="M8 2v11.5M4.6 14h6.8M2.6 4.2h10.8"/><path d="M2.6 4.2L1 8.2h3.2zM13.4 4.2L11.8 8.2H15z"/>'
  };

  /* ------------------------------ símbolos de unidad ------------------------------ */
  function symKey(u, ghost) { return ('s-' + (u.side === 'R' ? 'R' : 'B') + '-' + (u.type || 'x') + '-' + (u.ech || 'x') + (ghost ? '-g' : '')).replace(/[^\w-]/g, '_'); }
  function symInner(u, ghost) {
    let inner = '';
    if (global.WGCat && typeof global.WGCat.sym === 'function') {
      const m = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(global.WGCat.sym({ side: u.side === 'R' ? 'R' : 'B', type: u.type || '', ech: u.ech || '' }, 60) || '');
      if (m) inner = m[1];
    }
    if (!inner) inner = u.side === 'R' ? '<polygon points="30,12 58,36 30,60 2,36" fill="#FF8080" stroke="#000" stroke-width="2"/>' : '<rect x="5" y="20" width="50" height="32" fill="#80E0FF" stroke="#000" stroke-width="2"/>';
    if (ghost) inner = inner.replace(/fill="#(FF8080|80E0FF)"/gi, 'fill="none"').replace(/stroke="#000"/g, 'stroke="currentColor"').replace(/fill="#000"/g, 'fill="currentColor"');
    return inner;
  }
  /* símbolo autónomo para listas y el cajón de detalle */
  function symbol(u, size) {
    u = u || {}; size = size || 28;
    if (global.WGCat && typeof global.WGCat.sym === 'function') return global.WGCat.sym({ side: u.side === 'R' ? 'R' : 'B', type: u.type || '', ech: u.ech || '' }, size).replace('class="sym"', 'class="sym mp-sym"');
    return `<svg class="sym mp-sym" width="${size}" height="${size}" viewBox="0 0 60 62" aria-hidden="true">${symInner(u)}</svg>`;
  }

  /* ------------------------------ medida de textos ------------------------------ */
  let mctx = null;
  function textW(s, px, weight, fam, ls) {
    s = String(s == null ? '' : s);
    let w = 0;
    if (HAS_DOM) {
      try { if (!mctx) mctx = document.createElement('canvas').getContext('2d'); } catch (e) { mctx = null; }
      if (mctx) { mctx.font = (weight || 400) + ' ' + px + 'px ' + (fam || FONT_H); w = mctx.measureText(s).width; }
    }
    if (!w) w = s.length * px * (fam === FONT_M ? 0.6 : 0.5);
    return w + (ls ? s.length * px * ls : 0);
  }

  /* ------------------------------ gráficos tácticos ------------------------------ */
  const scG = (x, y, inner, cls, extra) => `<g class="mp-sc${cls ? ' ' + cls : ''}" data-sx="${F(x)}" data-sy="${F(y)}"${extra || ''}>${inner}</g>`;
  /* marcado interior de un gráfico; P en unidades SVG; o = { w, me, seq, time, label, dir, sc } */
  function graphicInner(kind, P, side, o) {
    o = o || {};
    P = dedupe((P || []).filter(okPt));
    if (!P.length) return '';
    const w = o.w || 14, sc = o.sc !== false;
    const lab = (pt, inner, cls) => (sc ? scG(pt[0], pt[1], inner, cls) : `<g class="${cls || ''}" transform="translate(${xyS(pt)})">${inner}</g>`);
    const letter = (pt, txt) => lab(pt, `<text class="mp-glt" text-anchor="middle" dominant-baseline="central">${esc(txt)}</text>`, 'mp-gl-l');
    const L = P.length > 1 ? polyLen(P) : 0;
    const mid = () => (P.length > 1 ? pointAt(P.length > 2 ? crSample(P, false, 8) : P, L / 2) : { pt: P[0], dir: [1, 0] });
    const lastDir = P.length > 1 ? unit(sub(P[P.length - 1], P[P.length - 2])) : (o.dir ? unit(o.dir) : [1, 0]);
    let s = '', don = true, lt = LETTER[kind] || '';
    const outline = (pts, cls) => { const A = arrow(pts, w, w * 1.5); if (!A) return ''; return (o.me ? `<path class="mp-gme" d="${A}"/>` : '') + `<path class="mp-gout${cls ? ' ' + cls : ''}" d="${A}"/>`; };
    const line = (pts, cls) => { const d = path(pts, false, pts.length > 2); return (o.me ? `<path class="mp-gme mp-gmel" d="${d}"/>` : '') + `<path class="mp-gln${cls ? ' ' + cls : ''}" d="${d}"/>`; };
    switch (kind) {
      case 'catk': {
        let C = P;
        if (P.length === 2) { const m = mul(addv(P[0], P[1]), 0.5), n = perp(unit(sub(P[1], P[0]))); C = [P[0], addv(m, mul(n, L * 0.22)), P[1]]; }
        s += outline(C, 'mp-dash'); don = false;
        const md = pointAt(crSample(C, false, 8), polyLen(crSample(C, false, 8)) / 2);
        s += letter(md.pt, 'CATK');
        lt = '';
        break;
      }
      case 'delay': case 'withdraw': {
        const tip = P[P.length - 1];
        s += line(P) + `<path class="mp-gln" d="${chevron(tip, lastDir, Math.max(10, w * 0.9))}"/>`;
        break;
      }
      case 'screen': {
        const a = P[0], b = P[P.length - 1], da = unit(sub(P[Math.min(1, P.length - 1)], a)), db = lastDir;
        s += line(P) + `<path class="mp-gln" d="${chevron(a, mul(da, -1), 8)}${chevron(b, db, 8)}"/>`;
        break;
      }
      case 'fix': {
        const Z = P.length > 1 ? zigzag(P, Math.max(4, w * 0.35), Math.max(8, w * 0.6), 0.7) : P;
        s += line(Z) + `<path class="mp-gln" d="${chevron(P[P.length - 1], lastDir, Math.max(10, w * 0.9))}"/>`;
        break;
      }
      case 'block': {
        const at = P[P.length - 1], bar = Math.max(30, w * 2.6);
        s += (P.length > 1 ? line(P) : '') + `<path class="mp-gln mp-gbar" d="${tbar(at, lastDir, bar).split('M').slice(0, 2).join('M')}"/>`;
        don = P.length > 1;
        break;
      }
      case 'bp': {
        const at = P[P.length - 1], dir = o.dir ? unit(o.dir) : (P.length > 1 ? mul(lastDir, -1) : [1, 0]);
        s += (P.length > 1 ? line(P.slice(0, -1).concat([addv(at, mul(dir, -15))]), 'mp-thin') : '') + `<path class="mp-gln mp-gbp" d="${uglyph(at, dir, Math.max(15, w))}"/>`;
        don = false;
        break;
      }
      case 'gap': {
        s += outline(P);
        const md = mid(), n = perp(md.dir), h = w * 0.9 + 4, half = Math.max(10, w * 0.8);
        const bar = side => { const c = addv(md.pt, mul(n, side * h)), a = addv(c, mul(md.dir, -half)), b = addv(c, mul(md.dir, half)), fl = mul(n, side * 4); return 'M' + xyS(addv(a, mul(md.dir, -4)) .map((v, i) => v + fl[i])) + 'L' + xyS(a) + 'L' + xyS(b) + 'L' + xyS(addv(b, mul(md.dir, 4)).map((v, i) => v + fl[i])); };
        s += `<path class="mp-gln" d="${bar(1)}${bar(-1)}"/>`;
        break;
      }
      case 'airAslt': {
        s += outline(P, 'mp-dash'); don = false;
        const t0 = P[0];
        s += lab(t0, '<circle class="mp-rotor" r="5"/><path class="mp-rotor" d="M-11 -4L11 4M-11 4L11 -4"/>', 'mp-gl-r');
        break;
      }
      case 'amph': {
        s += outline(P);
        const C = P.length > 2 ? crSample(P, false, 8) : P, Lc = polyLen(C);
        s += `<path class="mp-gwave" d="${waves(cutTo(C, Lc * 0.4), Math.max(2.5, w * 0.22), Math.max(8, w * 0.7))}"/>`;
        break;
      }
      case 'penetration': {
        const A = arrowPts(P, Math.max(6, w * 0.6), Math.max(14, w * 1.6));
        if (A.length) s += `<path class="mp-gpen" d="${path(A, true, false)}"/>`;
        don = false;
        break;
      }
      case 'meeting': default: {
        s += P.length > 1 ? outline(P) : `<circle class="mp-gln" cx="${F(P[0][0])}" cy="${F(P[0][1])}" r="${F(w * 0.6)}"/>`;
        break;
      }
    }
    if (lt && P.length > 1) s += letter(mid().pt, lt);
    else if (!lt && o.label && P.length > 1 && kind !== 'catk') s += lab(mid().pt, `<text class="mp-glbl" text-anchor="middle" dominant-baseline="central">${esc(short(o.label, 22))}</text>`, 'mp-gl-n');
    const tail = P[0];
    if (o.seq != null && o.seq !== '') s += lab(tail, `<circle class="mp-seqc" r="8.5"/><text class="mp-seqt" text-anchor="middle" dominant-baseline="central">${esc(o.seq)}</text>`, 'mp-gl-s');
    if (o.time) s += lab(tail, `<text class="mp-gtime" y="${o.seq != null && o.seq !== '' ? 20 : 12}" text-anchor="middle" dominant-baseline="central">${esc(o.time)}</text>`, 'mp-gl-t');
    return { s, don };
  }
  /* gráfico autónomo (P en unidades SVG) */
  function graphic(kind, pts, side, label, opts) {
    const o = Object.assign({ sc: false, label }, opts || {});
    const g = graphicInner(kind || 'axis', pts, side, o);
    return `<g class="mp-g k-${esc(kind || 'axis')} side-${side === 'R' ? 'R' : 'B'}${o.me ? ' me' : ''}">${g.s || ''}</g>`;
  }

  /* ------------------------------ traducción ------------------------------ */
  function mkT(hooks) {
    return function t(s, vars) {
      let out = s;
      if (hooks && typeof hooks.t === 'function') { try { out = hooks.t(s, vars); if (out != null) return out; } catch (e) { out = s; } }
      const lang = HAS_DOM && document.documentElement ? document.documentElement.lang : 'es';
      if (lang === 'en' && global.WGI18N && global.WGI18N.en && global.WGI18N.en[s]) out = global.WGI18N.en[s];
      if (vars) Object.keys(vars).forEach(k => { out = out.split('{' + k + '}').join(vars[k]); });
      return out;
    };
  }
  function resL(code) {
    if (!code) return '';
    const lang = HAS_DOM && document.documentElement ? document.documentElement.lang : 'es';
    return lang === 'en' ? code.charAt(0) + code.slice(1).toLowerCase() : (RES_ES[code] || code);
  }

  /* ========================================================================
     mount(el, hooks) → inst
     ======================================================================== */
  let uid = 0;
  function mount(el, hooks) {
    if (!HAS_DOM || !el) return null;
    hooks = hooks || {};
    const t = mkT(hooks);
    const ID = 'mp' + (++uid);
    const raf = global.requestAnimationFrame ? f => global.requestAnimationFrame(f) : f => setTimeout(f, 16);
    const caf = global.cancelAnimationFrame ? h => global.cancelAnimationFrame(h) : h => clearTimeout(h);
    const now = () => (global.performance && performance.now ? performance.now() : Date.now());
    const reduced = () => !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const coarse = !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
    function call(name) {
      const f = hooks && hooks[name]; if (typeof f !== 'function') return undefined;
      try { return f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (err) { if (global.console) console.error('WGMap hook ' + name, err); }
      return undefined;
    }

    /* ---------- DOM ---------- */
    const root = document.createElement('div');
    root.className = 'mp-root' + (coarse ? ' mp-coarse' : '');
    root.tabIndex = 0;
    root.setAttribute('data-testid', 'map');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'mp-svg');
    svg.setAttribute('xmlns', NS);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('Plano'));
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    const L = {};
    LAYERS.forEach(k => { const g = document.createElementNS(NS, 'g'); g.setAttribute('data-layer', k); svg.appendChild(g); L[k] = g; });
    const ovl = document.createElement('div');
    ovl.className = 'mp-ovl';
    root.appendChild(svg); root.appendChild(ovl);
    el.appendChild(root);
    defs.innerHTML = `<pattern id="${ID}-urb" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><line class="mp-hl-urb" x1="0" y1="0" x2="0" y2="7"/></pattern>`
      + `<pattern id="${ID}-red" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)"><line class="mp-hl-red" x1="0" y1="0" x2="0" y2="9"/></pattern>`
      + `<clipPath id="${ID}-clip"><rect class="mp-cliprect" x="0" y="0" width="1000" height="700"/></clipPath>`;
    const symDone = new Set();
    function ensureSym(u, ghost) {
      const k = symKey(u, ghost);
      if (!symDone.has(k)) {
        symDone.add(k);
        const g = document.createElementNS(NS, 'g');
        g.innerHTML = `<symbol id="${k}" viewBox="0 0 60 62">${symInner(u, ghost)}</symbol>`;
        while (g.firstChild) defs.appendChild(g.firstChild);
      }
      return k;
    }

    /* ---------- estado ---------- */
    let S = null, H = 700, first = true, destroyed = false;
    let view = { x: -MX, y: -MY, w: 1000 + 2 * MX, h: 700 + 2 * MY };
    let cw = 0, ch = 0, upp = 1, lastUpp = -1, needFit = true;
    const keys = { base: null, cm: null, marg: null, title: null };
    const K = { flot: new Map(), isr: new Map(), graphics: new Map(), units: new Map(), glyphs: new Map(), dps: new Map(), hpts: new Map(),
      mask: new Map(), bounds: new Map(), edges: new Map(), unopposed: new Map(), contacts: new Map(), links: new Map(), callouts: new Map(), coLines: new Map() };
    const featEls = new Map();
    let scList = [], scDirty = true, selEls = [], selKey = null, editSig = null, declSig = '';
    let axisFrom = 'E', att = 'R';
    let draft = null, rubber = null, previews = [], dragEndAt = 0;

    /* ---------- marco doctrinal ---------- */
    const xy = p => [p[0] * 1000, p[1] * H];
    const toUV = q => [Math.round(q[0] / 1000 * 1e4) / 1e4, Math.round(q[1] / H * 1e4) / 1e4];
    /* vector (pantalla) hacia el borde del atacante */
    function attV() { return axisFrom === 'W' ? [-1, 0] : axisFrom === 'N' ? [0, -1] : axisFrom === 'S' ? [0, 1] : [1, 0]; }
    /* dirección de profundidad creciente (p ↑) en unidades SVG */
    function depthV() { return mul(attV(), -1); }
    function uv2p(u, v) { return axisFrom === 'W' ? u : axisFrom === 'N' ? v : axisFrom === 'S' ? 1 - v : 1 - u; }
    function inferAxis(st) {
      const f = (st.features || []).find(x => LINEK[x.kind] && isNum(x.p) && x.pts && x.pts.length > 1);
      if (!f) return null;
      const m = mean(f.pts);
      const c = [['E', Math.abs(m[0] - (1 - f.p))], ['W', Math.abs(m[0] - f.p)], ['N', Math.abs(m[1] - f.p)], ['S', Math.abs(m[1] - (1 - f.p))]].sort((a, b) => a[1] - b[1]);
      return c[0][1] < 0.05 ? c[0][0] : null;
    }
    /* lado de la etiqueta de unidad: hacia la retaguardia propia */
    function rearV(side) { const a = attV(); return side === att ? a : mul(a, -1); }

    /* ---------- utilidades DOM ---------- */
    function setA(e, k, v) {
      const c = e._a || (e._a = {});
      if (v == null || v === false) { if (c[k] != null) { e.removeAttribute(k); c[k] = null; } return; }
      v = String(v);
      if (c[k] !== v) { e.setAttribute(k, v); c[k] = v; if (k === 'class') selKey = null; }
    }
    function placeEl(e) {
      if (e._sx == null) { e._sx = +e.getAttribute('data-sx') || 0; e._sy = +e.getAttribute('data-sy') || 0; }
      const tr = 'translate(' + F(e._sx + (e._ox || 0) * upp) + ' ' + F(e._sy + (e._oy || 0) * upp) + ') scale(' + upp.toFixed(4) + ')';
      if (e._t !== tr) { e.setAttribute('transform', tr); e._t = tr; }
    }
    function placeAll() {
      if (scDirty) { scList = Array.prototype.slice.call(svg.querySelectorAll('.mp-sc')); scDirty = false; }
      for (let i = 0; i < scList.length; i++) placeEl(scList[i]);
    }

    /* ======================= capas estáticas ======================= */
    function bleed(P) { /* empuja fuera de la hoja los vértices del borde (suavizado + recorte) */
      return P.map(p => [p[0] <= 1 ? p[0] - 40 : p[0] >= 999 ? p[0] + 40 : p[0], p[1] <= 1 ? p[1] - 40 : p[1] >= H - 1 ? p[1] + 40 : p[1]]);
    }
    function renderSheet() {
      const secs = S.sectors || [];
      let tiles = '', wm = '';
      secs.forEach(s => {
        if (!s.tile || s.tile.length < 3) return;
        const P = s.tile.filter(okPt).map(xy);
        tiles += `<path class="mp-tile t${s.tint ? 1 : 0}" d="${path(P, true, false)}"/>`;
        const c = centroid(P);
        wm += scG(c[0], c[1], `<text class="mp-wm" text-anchor="middle" dominant-baseline="central">${esc(s.label || s.id || '')}</text>`, 'mp-wmg');
      });
      L.sheet.innerHTML = `<rect class="mp-band" x="${-MX}" y="${-MY}" width="${1000 + 2 * MX}" height="${F(H + 2 * MY)}"/><rect class="mp-paper" x="0" y="0" width="1000" height="${F(H)}"/>${tiles}${wm}`;
      const cr = defs.querySelector('.mp-cliprect'); if (cr) cr.setAttribute('height', F(H));
    }
    function renderBase() {
      const T = S.terrain || {}, bg = S.bg || {};
      let s = '', tr = '';
      const img = bg.kind === 'image' && bg.data;
      root.classList.toggle('mp-img', !!img); root.classList.remove('mp-imgfail');
      if (img) {
        s += `<image class="mp-bgimg" href="${esc(bg.data)}" x="0" y="0" width="1000" height="${F(H)}" preserveAspectRatio="none" opacity="${isNum(bg.op) ? bg.op : 0.85}"/>`;
        if (isNum(bg.wash) && bg.wash > 0) s += `<rect class="mp-wash" x="0" y="0" width="1000" height="${F(H)}" fill-opacity="${bg.wash}"/>`;
      }
      (T.veg || []).forEach(p => { if (p && p.length > 2) tr += `<path class="mp-veg" d="${path(p.filter(okPt).map(xy), true, true)}"/>`; });
      tr += '<g class="mp-relief">' + (T.relief || []).map(p => (p && p.length > 2 ? `<path class="mp-rel" d="${path(p.filter(okPt).map(xy), true, true)}"/>` : '')).join('') + '</g>';
      if (T.sea && T.sea.length > 2) tr += `<path class="mp-sea" d="${path(bleed(T.sea.filter(okPt).map(xy)), true, true)}"/>`;
      if (T.coast && T.coast.length > 1) tr += `<path class="mp-coast" d="${path(bleed(T.coast.filter(okPt).map(xy)), false, true)}"/>`;
      (T.rivers || []).forEach(p => { if (p && p.length > 1) { const d = path(bleed(p.filter(okPt).map(xy)), false, true); tr += `<path class="mp-river-e" d="${d}"/><path class="mp-river" d="${d}"/>`; } });
      (T.urban || []).forEach(p => { if (p && p.length > 2) { const d = roundPoly(p.filter(okPt).map(xy), 5); tr += `<path class="mp-urb" d="${d}"/><path class="mp-urbh" d="${d}" fill="url(#${ID}-urb)"/>`; } });
      (T.roads || []).forEach(p => { if (p && p.length > 1) tr += `<path class="mp-road" d="${path(p.filter(okPt).map(xy), false, true)}"/>`; });
      let gd = '';
      for (let i = 1; i < 10; i++) gd += 'M' + (i * 100) + ' 0V' + F(H);
      for (let j = 1; j < 7; j++) gd += 'M0 ' + F(H * j / 7) + 'H1000';
      L.base.innerHTML = s + `<g class="mp-terrain" clip-path="url(#${ID}-clip)">${tr}</g><path class="mp-gridl" d="${gd}"/>`;
      const im = L.base.querySelector('image');
      if (im) im.addEventListener('error', () => root.classList.add('mp-imgfail'));
    }

    /* etiqueta en caja (constante en pantalla) */
    function boxLabel(text, cls, mono) {
      const fam = mono ? FONT_M : FONT_H, px = mono ? 10 : 11, wt = mono ? 600 : 600;
      const w = Math.ceil(textW(text, px, wt, fam, mono ? 0 : 0.05)) + 10;
      return `<rect class="mp-lbox${cls ? ' ' + cls : ''}" x="${F(-w / 2)}" y="-8" width="${w}" height="16" rx="1.5"/><text class="${mono ? 'mp-lt mp-mono' : 'mp-lt'}" text-anchor="middle" dominant-baseline="central" y="0.5">${esc(text)}</text>`;
    }
    const qBadge = (x, y) => `<g class="mp-q" transform="translate(${F(x)} ${F(y)})"><circle r="6.5"/><text text-anchor="middle" dominant-baseline="central" y="0.5">?</text></g>`;
    function riverDirAt(c) {
      let best = null;
      ((S.terrain && S.terrain.rivers) || []).forEach(r => { if (!r || r.length < 2) return; const n = nearestOn(c, r.filter(okPt).map(xy), false); if (!best || n.d < best.d) best = n; });
      return best && best.d < 120 ? best.dir : perp(attV());
    }
    function featMarkup(f, ctx) {
      const P = (f.pts || []).filter(okPt).map(xy);
      if (!P.length) return '';
      const kind = f.kind || 'note', sb = f.sub || '', side = f.side || 'N';
      const name = String(f.label || f.name || f.ref || '');
      const low = (isNum(f.conf) && f.conf < 0.5) || /(^|\s)(mp-)?lowconf(\s|$)/.test(f.cls || '');
      const A = attV();
      let body = '', lbl = '';
      const hitStroke = d => `<path class="mp-hit" d="${d}"/>`;
      if (LINEK[kind] || (kind === 'water' && f.closed === false)) {
        const d = path(P, false, P.length > 2);
        if (kind === 'water') body = `<path class="mp-river-e mp-fs" d="${d}"/><path class="mp-river" d="${d}"/>`;
        else body = sb === 'beachline' ? `<path class="mp-fh" d="${d}"/><path class="mp-fs mp-dbl" d="${d}"/><path class="mp-dbl-i" d="${d}"/>` : `<path class="mp-fh" d="${d}"/><path class="mp-fs" d="${d}"/>`;
        if (kind === 'obstacle') body += `<path class="mp-teeth" d="${teeth(P.length > 2 ? crSample(P, false, 6) : P)}"/>`;
        body += hitStroke(d);
        if (P.length > 1 && kind !== 'water') {
          const txt = short(name.toUpperCase(), 24);
          const ends = [[P[0], unit(sub(P[1], P[0]))], [P[P.length - 1], unit(sub(P[P.length - 2], P[P.length - 1]))]];
          ends.forEach((en, i) => {
            const key = Math.round(en[0][0] / 8) + ',' + Math.round(en[0][1] / 8), k = ctx.ends[key] = (ctx.ends[key] || 0) + 1;
            const off = mul(en[1], 17 + 19 * (k - 1)), alt = mul(en[1], 19);
            const inner = `<g transform="translate(${xyS(off)})"><g class="mp-altw" style="--ax:${F(alt[0])};--ay:${F(alt[1])}">${boxLabel(txt, kind === 'redline' ? 'red' : '')}${low && i === 0 ? qBadge(textW(txt, 11, 600, FONT_H, 0.05) / 2 + 13, 0) : ''}</g></g>`;
            lbl += scG(en[0][0], en[0][1], inner, 'mp-llb' + (ctx.alt[f.id] ? ' mp-alt' : ''));
          });
        }
      } else if (kind === 'bp') {
        let d, c;
        if (P.length >= 3) { d = path(P, false, true); c = mean(P); } else { c = P[0]; d = uglyph(c, f.dir ? unit(f.dir) : A, 15); }
        body = `<path class="mp-fh" d="${d}"/><path class="mp-fs" d="${d}"/>` + hitStroke(d);
        const lo = mul(A, -24);
        lbl = scG(c[0], c[1], `<text class="mp-flb mp-flb-bp" x="${F(lo[0])}" y="${F(lo[1])}" text-anchor="middle" dominant-baseline="central">${esc(short(name, 16))}</text>${low ? qBadge(lo[0] + 18, lo[1]) : ''}`, 'mp-p2');
      } else if (kind === 'hill') {
        const c = centroid(P), spot = (name.match(/\d{2,4}/) || [''])[0];
        lbl = scG(c[0], c[1], `<circle class="mp-hitc" r="10"/><path class="mp-hilltri" d="M0 -5.5L5.2 3.6H-5.2Z"/>${spot ? `<text class="mp-spot mp-mono" x="8" y="0.5" dominant-baseline="central">${esc(spot)}</text>` : ''}${low ? qBadge(-12, -6) : ''}`, 'mp-pt');
      } else if (kind === 'crossing') {
        const c = centroid(P), cd = perp(riverDirAt(c)), an = deg(cd);
        lbl = scG(c[0], c[1], `<circle class="mp-hitc" r="12"/><g transform="rotate(${F(an)})"><path class="mp-xbar" d="M-8 -3.6H8M-8 3.6H8M-8 -3.6l-3.2 -3.2M8 -3.6l3.2 -3.2M-8 3.6l-3.2 3.2M8 3.6l3.2 3.2"/></g><text class="mp-flb mp-flb-sm mp-p2" y="17" text-anchor="middle" dominant-baseline="central">${esc(short(name, 26))}</text>${low ? qBadge(14, -8) : ''}`, 'mp-pt');
      } else if (kind === 'lz') {
        const c = centroid(P), b = bbox(P), r = P.length >= 3 ? Math.max(8, Math.max(b[2] - b[0], b[3] - b[1]) / 2) : 20;
        body = `<circle class="mp-fh" cx="${F(c[0])}" cy="${F(c[1])}" r="${F(r)}"/><circle class="mp-fs mp-fhit" cx="${F(c[0])}" cy="${F(c[1])}" r="${F(r)}"/>`;
        lbl = scG(c[0], c[1], `<text class="mp-lzt" text-anchor="middle" dominant-baseline="central" y="0.5">${/\b(ZD|DZ)\b/i.test(name) ? 'ZD' : 'H'}</text>`, 'mp-pt')
          + scG(c[0], c[1] + r, `<text class="mp-flb mp-flb-sm" y="11" text-anchor="middle" dominant-baseline="central">${esc(short(name, 24))}</text>${low ? qBadge(0, 24) : ''}`, 'mp-p2');
      } else if (kind === 'beach') {
        const d = path(P, false, P.length > 2);
        body = `<path class="mp-fh" d="${d}"/><path class="mp-beach mp-fs" d="${d}"/>` + hitStroke(d);
        const m = P.length > 1 ? pointAt(P, polyLen(P) / 2).pt : P[0], o = mul(A, 10), anc = A[0] > 0.5 ? 'start' : A[0] < -0.5 ? 'end' : 'middle';
        lbl = scG(m[0], m[1], `<text class="mp-flb mp-flb-beach" x="${F(o[0])}" y="${F(o[1] + (anc === 'middle' ? 10 * Math.sign(A[1] || 1) : 0))}" text-anchor="${anc}" dominant-baseline="central">${esc(short(name.toUpperCase(), 22))}</text>${low ? qBadge(o[0], o[1] - 14) : ''}`, '');
      } else if (kind === 'offboard') {
        const c = P[0], u = c[0] / 1000, v = c[1] / H;
        const dd = [[u, [-1, 0]], [1 - u, [1, 0]], [v, [0, -1]], [1 - v, [0, 1]]].sort((a, b) => a[0] - b[0])[0][1];
        const lo = mul(dd, -20), anc = dd[0] > 0.5 ? 'end' : dd[0] < -0.5 ? 'start' : 'middle';
        lbl = scG(c[0], c[1], `<circle class="mp-hitc" r="12"/><g transform="rotate(${F(deg(dd))})"><path class="mp-offa" d="M-13 0H5M-1 -6L7 0L-1 6"/></g><text class="mp-flb mp-flb-off" x="${F(lo[0])}" y="${F(lo[1] + (anc === 'middle' ? -dd[1] * 4 : 0))}" text-anchor="${anc}" dominant-baseline="central">${esc(short(name.toUpperCase(), 26))}</text>`, 'mp-pt');
      } else if (P.length >= 3 && f.closed !== false) {
        const smooth = (kind === 'ea' || kind === 'obj' || kind === 'water' || kind === 'nai' || kind === 'tai') && P.length >= 5;
        const d = smooth ? path(P, true, true) : roundPoly(P, kind === 'area' || kind === 'urban' ? 7 : 3);
        const big = Math.abs(areaS(P)) > 0.04 * 1000 * H;
        if (kind === 'urban') body += `<path class="mp-urb" d="${d}"/><path class="mp-urbh" d="${d}" fill="url(#${ID}-urb)"/>`;
        if (kind === 'water') body += `<path class="mp-sea" d="${d}"/>`;
        body += `<path class="mp-fh" d="${d}"/><path class="mp-fs${big ? '' : ' mp-fhit'}" d="${d}"/>` + (big ? hitStroke(d) : '');
        const c = centroid(P);
        if (kind === 'obj' && sb === 'airfield') lbl += scG(c[0], c[1], '<path class="mp-rwy" d="M-11 6L11 -6M-9 9.5L13 -2.5"/>', 'mp-pt');
        const lc = kind === 'obj' ? 'mp-flb-obj' : kind === 'ea' ? 'mp-flb-ea' : kind === 'urban' ? 'mp-flb-urb mp-p2' : kind === 'area' ? 'mp-flb-ar mp-p2' : 'mp-flb-ar';
        const ly = kind === 'obj' && sb === 'airfield' ? 17 : 0;
        const txt = kind === 'ea' || kind === 'obj' ? name.toUpperCase() : (kind === 'urban' ? name.toUpperCase() : name);
        lbl += scG(c[0], c[1], `<text class="mp-flb ${lc}" y="${ly}" text-anchor="middle" dominant-baseline="central">${esc(short(txt, 26))}</text>${low ? qBadge(textW(short(txt, 26), 12, 600, FONT_H, 0.05) / 2 + 10, ly) : ''}`, '');
      } else if (P.length >= 2) {
        const d = path(P, false, P.length > 2);
        body = `<path class="mp-fh" d="${d}"/><path class="mp-fs" d="${d}"/>` + hitStroke(d);
        const m = pointAt(P, polyLen(P) / 2).pt;
        lbl = scG(m[0], m[1], `<text class="mp-flb mp-flb-ar" y="-10" text-anchor="middle" dominant-baseline="central">${esc(short(name, 26))}</text>`, 'mp-p2');
      } else {
        const c = P[0];
        lbl = scG(c[0], c[1], `<circle class="mp-hitc" r="10"/><rect class="mp-note" x="-3.5" y="-3.5" width="7" height="7"/><text class="mp-flb mp-flb-sm" x="8" y="0.5" dominant-baseline="central">${esc(short(name, 26))}</text>${low ? qBadge(-12, 0) : ''}`, 'mp-pt');
      }
      return `<g class="${featBase(f, low)}${clsN(f.cls)}" data-ref="${esc(f.ref || f.id)}" data-key="${esc(f.id)}"><title>${esc(f.name || f.label || f.ref || '')}${low ? ' (?)' : ''}</title>${body}${lbl}</g>`;
    }
    const featBase = (f, low) => 'mp-f k-' + (f.kind || 'note') + (f.sub ? ' s-' + f.sub : '') + ' side-' + (f.side || 'N') + (low ? ' mp-lowconf' : '');
    function renderCm() {
      let s = '';
      (S.boundaries || []).forEach(b => { if (b && b.pts && b.pts.length > 1) s += `<path class="mp-bnd" d="${path(b.pts.filter(okPt).map(xy), false, b.pts.length > 2)}"/>`; });
      const feats = (S.features || []).filter(f => f && f.pts && f.pts.length && !f.hidden);
      const ctx = { ends: {}, alt: {} };
      const lines = feats.filter(f => LINEK[f.kind] && f.pts.length > 1);
      const ax = axisFrom === 'N' || axisFrom === 'S' ? 1 : 0;
      lines.slice().sort((a, b) => mean(a.pts)[ax] - mean(b.pts)[ax]).forEach((f, i) => { ctx.alt[f.id] = i % 2 === 1; });
      feats.slice().sort((a, b) => (ZORD[a.kind] == null ? 8 : ZORD[a.kind]) - (ZORD[b.kind] == null ? 8 : ZORD[b.kind])).forEach(f => { s += featMarkup(f, ctx); });
      L.cm.innerHTML = s;
      featEls.clear();
      Array.prototype.forEach.call(L.cm.querySelectorAll('.mp-f'), g => { featEls.set(g.getAttribute('data-key'), { el: g, cls: null }); });
      feats.forEach(f => { const e = featEls.get(String(f.id)); if (e) e.cls = f.cls || ''; });
    }
    function patchFeatureCls(feats) {
      (feats || []).forEach(f => {
        const e = featEls.get(String(f.id)); if (!e) return;
        const c = f.cls || '';
        if (e.cls !== c) { const low = (isNum(f.conf) && f.conf < 0.5) || /(^|\s)(mp-)?lowconf(\s|$)/.test(c); e.el.setAttribute('class', featBase(f, low) + clsN(c)); e.cls = c; selKey = null; }
      });
    }
    function renderMarg() {
      const m = S.marg || {};
      let s = `<rect class="mp-neat" x="0" y="0" width="1000" height="${F(H)}"/><rect class="mp-frame" x="${-MX}" y="${-MY}" width="${1000 + 2 * MX}" height="${F(H + 2 * MY)}"/>`;
      let g = '';
      for (let i = 0; i < 10; i++) { const L0 = String.fromCharCode(65 + i), x = i * 100 + 50; g += scG(x, -MY / 2, `<text class="mp-gridt" text-anchor="middle" dominant-baseline="central">${L0}</text>`, 'mp-grl') + scG(x, H + MY / 2, `<text class="mp-gridt" text-anchor="middle" dominant-baseline="central">${L0}</text>`, 'mp-grl'); }
      for (let j = 0; j < 7; j++) { const y = H * (j + 0.5) / 7; g += scG(-MX / 2, y, `<text class="mp-gridt" text-anchor="middle" dominant-baseline="central">${j + 1}</text>`, 'mp-grl') + scG(1000 + MX / 2, y, `<text class="mp-gridt" text-anchor="middle" dominant-baseline="central">${j + 1}</text>`, 'mp-grl'); }
      s += `<g class="mp-gridg">${g}</g>`;
      if (m.classif) {
        const tx = short(String(m.classif).toUpperCase(), 80), w = textW(tx, 10, 700, FONT_H, 0.08) + 14;
        const ban = `<rect class="mp-banr" x="${F(-w / 2)}" y="-7" width="${F(w)}" height="14"/><text class="mp-ban" text-anchor="middle" dominant-baseline="central" y="0.5">${esc(tx)}</text>`;
        s += scG(500, -MY / 2, ban, 'mp-bang') + scG(500, H + MY / 2, ban, 'mp-bang');
      }
      const sc = m.scale || t('ESQUEMA — NO A ESCALA');
      s += scG(0, H, `<g transform="translate(14 -14)"><g class="mp-north"><path class="mp-na" d="M0 -30L6 -12L0 -15L-6 -12Z"/><path class="mp-nb" d="M0 -15L6 -12L0 -30Z"/><text class="mp-nt" y="-36" text-anchor="middle">N</text></g><text class="mp-scale" x="14" y="-16">${esc(sc)}</text></g>`, 'mp-nblk');
      s += `<g class="mp-tbw"></g>`;
      L.marg.innerHTML = s;
      keys.title = null;
    }
    function patchTitle(ti) {
      ti = ti || {};
      const k = (ti.line1 || '') + '\u0001' + (ti.line2 || '');
      if (k === keys.title) return;
      keys.title = k;
      const wrap = L.marg.querySelector('.mp-tbw'); if (!wrap) return;
      const l1 = short(ti.line1 || '', 90), l2 = short(ti.line2 || '', 90);
      if (!l1 && !l2) { wrap.innerHTML = ''; scDirty = true; return; }
      const w = Math.min(460, Math.ceil(Math.max(textW(l1.toUpperCase(), 11.5, 600, FONT_H, 0.04), textW(l2, 10.5, 600, FONT_M))) + 20);
      const h = l1 && l2 ? 40 : 24;
      const tr = (s, px, fam, ls) => { let x = s; while (x.length > 4 && textW(x, px, 600, fam, ls) > w - 20) x = x.slice(0, -2); return x === s ? s : x.slice(0, -1) + '…'; };
      wrap.innerHTML = scG(1000, H, `<g transform="translate(${F(-w - 10)} ${F(-h - 10)})"><rect class="mp-tb" width="${w}" height="${h}"/><rect class="mp-tbbar" width="3" height="${h}"/>`
        + (l1 ? `<text class="mp-tb1" x="11" y="${l2 ? 14 : 12}" dominant-baseline="central">${esc(tr(l1.toUpperCase(), 11.5, FONT_H, 0.04))}</text>` : '')
        + (l2 ? `<text class="mp-tb2 mp-mono" x="11" y="${l1 ? 29 : 12}" dominant-baseline="central">${esc(tr(l2, 10.5, FONT_M, 0))}</text>` : '') + '</g>', 'mp-tblock');
      scDirty = true;
    }

    /* ======================= capas dinámicas (indexadas) ======================= */
    /* opt = { key, sig, build(it, e) → inner, attrs(it, e) → {}, pos(it) → [x,y]|null, patch(e, it), pop } */
    function sync(reg, group, items, opt) {
      const seen = new Set();
      (items || []).forEach((it, i) => {
        if (!it) return;
        const id = String(opt.key ? opt.key(it) : (it.id != null ? it.id : i));
        if (seen.has(id)) return;
        if (opt.skip && opt.skip(it)) return;
        seen.add(id);
        let e = reg.get(id), created = false;
        if (!e) { e = { id, el: document.createElementNS(NS, opt.tag || 'g'), sig: null }; group.appendChild(e.el); reg.set(id, e); created = true; }
        const sig = opt.sig(it);
        if (e.sig !== sig) {
          e.el.innerHTML = opt.build(it, e); e.sig = sig; e.parts = null; scDirty = true; selKey = null;
          if (opt.pop && !first && created && !reduced()) {
            const pp = e.el.querySelector('.mp-pop');
            if (pp) {
              const dash = /mp-(nochain|dashed)/.test(String(it.cls || '')) || /nochain|dashed/.test(String(it.cls || ''));
              const dn = pp.classList.contains('mp-don') && !dash ? Array.prototype.filter.call(pp.querySelectorAll('.mp-gout, .mp-gln'), x => !x.classList.contains('mp-dash')) : [];
              dn.forEach(x => x.setAttribute('pathLength', '1'));
              pp.classList.add('mp-new');
              setTimeout(() => { pp.classList.remove('mp-new'); dn.forEach(x => x.removeAttribute('pathLength')); }, 520);
            }
          }
        }
        e.item = it;
        const at = opt.attrs(it, e); Object.keys(at).forEach(k => setA(e.el, k, at[k]));
        const p = opt.pos ? opt.pos(it) : null;
        if (p) { e.el._sx = p[0]; e.el._sy = p[1]; e.x = p[0]; e.y = p[1]; if (!e.el.classList.contains('mp-sc')) e.el.classList.add('mp-sc'); placeEl(e.el); }
        if (opt.patch) opt.patch(e, it);
      });
      reg.forEach((e, id) => { if (!seen.has(id)) { e.el.remove(); reg.delete(id); scDirty = true; selKey = null; } });
    }
    const jp = P => JSON.stringify((P || []).map(p => (okPt(p) ? [Math.round(p[0] * 1e4), Math.round(p[1] * 1e4)] : null)));
    const uvPos = it => (isNum(it.u) && isNum(it.v) ? [it.u * 1000, it.v * H] : null);
    function stateCls(st) {
      st = String(st || '').toLowerCase();
      return /^(active|open|on-active)$/.test(st) ? ' mp-active' : st === 'triggered' ? ' mp-trig' : /^(inactive|before|after|off|out|closed|missed)$/.test(st) ? ' mp-dim' : '';
    }

    /* línea de contacto */
    function syncFlot(fl) {
      const lines = fl && Array.isArray(fl.lines) ? fl.lines.filter(l => l && l.filter(okPt).length > 1) : [];
      sync(K.flot, L.flot, lines.length ? [{ id: 'flot', lines, label: fl.label || '' }] : [], {
        sig: it => it.lines.length + '|' + it.label,
        build: it => it.lines.map(() => '<path class="mp-flh"/><path class="mp-fl"/>').join('') + (it.label ? scG(0, 0, `<g class="mp-fllw"><rect class="mp-lbox mp-flbox" x="0" y="-8" width="10" height="16" rx="1.5"/><text class="mp-lt mp-fllt" dominant-baseline="central" y="0.5">${esc(it.label)}</text></g>`, 'mp-flg') : ''),
        attrs: () => ({ class: 'mp-flot' }),
        patch: (e, it) => {
          if (!e.parts) {
            e.parts = { h: e.el.querySelectorAll('.mp-flh'), m: e.el.querySelectorAll('.mp-fl'), g: e.el.querySelector('.mp-flg') };
            if (e.parts.g) { const A = attV(), tw = textW(it.label, 11, 600, FONT_H, 0.05) + 10, gw = e.parts.g.querySelector('.mp-fllw'), r = gw.querySelector('rect'), tx = gw.querySelector('text');
              const right = A[0] >= 0; r.setAttribute('width', F(tw)); r.setAttribute('x', right ? '0' : F(-tw)); tx.setAttribute('x', right ? '5' : F(-tw + 5)); gw.setAttribute('transform', `translate(${right ? 9 : -9} 0)`); }
          }
          it.lines.forEach((l, i) => { const d = path(l.filter(okPt).map(xy), false, true); setA(e.parts.h[i], 'd', d); setA(e.parts.m[i], 'd', d); });
          if (e.parts.g) { const P = it.lines[0].filter(okPt).map(xy), m = pointAt(P, polyLen(P) * 0.42).pt; e.parts.g._sx = m[0]; e.parts.g._sy = m[1]; placeEl(e.parts.g); }
        }
      });
    }
    /* NAI / TAI */
    function syncIsr(items) {
      sync(K.isr, L.isr, (items || []).filter(it => it && it.pts && it.pts.length > 2), {
        sig: it => [it.kind, it.label, jp(it.pts)].join('|'),
        build: it => {
          const P = it.pts.filter(okPt).map(xy), d = P.length >= 8 ? path(P, true, true) : roundPoly(P, 2), b = bbox(P);
          let s = `<title>${esc(it.label || it.id)}</title><path class="mp-isrf" d="${d}"/><path class="mp-hit" d="${d}"/>`;
          const lt = String(it.label || it.id), lw = Math.ceil(textW(lt, 10, 600, FONT_M)) + 10;
          s += scG(b[0], b[1], `<g transform="translate(${F(lw / 2 + 4)} 12)">${boxLabel(lt, 'mp-isrb', true)}</g>`, 'mp-isrl');
          if (it.kind === 'tai') { const c = centroid(P); s += scG(c[0], c[1], '<circle class="mp-tx" r="6"/><path class="mp-tx" d="M-11 0H-3M3 0H11M0 -11V-3M0 3V11"/>', 'mp-txg'); }
          return s;
        },
        attrs: it => ({ class: 'mp-isr k-' + (it.kind === 'tai' ? 'tai' : 'nai') + ' st-' + String(it.state || 'none').toLowerCase() + stateCls(it.state) + clsN(it.cls), 'data-ref': it.ref || ((it.kind === 'tai' ? 'tai:' : 'nai:') + it.id), 'data-state': it.state || null })
      });
    }
    /* gráficos tácticos */
    function syncGraphics(items) {
      const byS = { B: [], R: [] };
      (items || []).forEach(g => { if (g && g.pts && g.pts.length) byS[g.side === 'R' ? 'R' : 'B'].push(g); });
      ['B', 'R'].forEach(sd => {
        const reg = sd === 'R' ? K.graphics : (K.graphicsB || (K.graphicsB = new Map()));
        const grp = sd === 'R' ? L.red : L.blue;
        let gl = grp.querySelector(':scope > .mp-gwrap');
        if (!gl) { gl = document.createElementNS(NS, 'g'); gl.setAttribute('class', 'mp-gwrap'); grp.insertBefore(gl, grp.firstChild); }
        sync(reg, gl, byS[sd], {
          sig: g => JSON.stringify([g.kind, jp(g.pts), g.label, g.seq, g.time, g.ech, g.w, g.me, g.dir]),
          build: g => { const r = graphicInner(g.kind || 'axis', g.pts.filter(okPt).map(xy), sd, { w: g.w || ECHW[g.ech] || 14, me: g.me, seq: g.seq, time: g.time, label: g.label, dir: g.dir, sc: true }); return `<title>${esc(g.label || g.ref || g.id)}${g.time ? ' · ' + esc(g.time) : ''}</title><g class="mp-pop${r.don ? ' mp-don' : ''}">${r.s}</g>`; },
          attrs: g => ({ class: 'mp-g k-' + (g.kind || 'axis') + ' side-' + sd + (g.me ? ' me' : '') + clsN(g.cls), 'data-ref': g.ref || null }),
          pop: true
        });
      });
    }
    /* unidades */
    const SHP = { B: 'M-11.67 -7.47H11.67V7.47H-11.67Z', R: 'M0 -11.2L13.07 0L0 11.2L-13.07 0Z' };
    const SHPS = { B: 'M-15.5 -11.3H15.5V11.3H-15.5Z', R: 'M0 -16L18.5 0L0 16L-18.5 0Z' };
    function unitBuild(it) {
      const side = it.side === 'R' ? 'R' : 'B', u = Object.assign({ type: '', ech: '' }, it.unit || {}, { side });
      const rv = rearV(side), horiz = Math.abs(rv[0]) >= Math.abs(rv[1]);
      const lx = horiz ? rv[0] * 19 : 0, ly = horiz ? 0 : rv[1] * 25, anc = horiz ? (rv[0] > 0 ? 'start' : 'end') : 'middle';
      const lab = esc(short(it.label || it.id, 14));
      let s = `<title>${esc(it.title || it.label || it.id)}</title>`;
      if (it.known === 'last') {
        s += `<path class="mp-usel" d="${SHPS[side]}"/><path class="mp-ulast" d="M0 -10L10 0L0 10L-10 0Z"/><text class="mp-uq" text-anchor="middle" dominant-baseline="central" y="0.5">?</text>`
          + `<text class="mp-ulbl mp-mono" x="${F(lx)}" y="${F(ly)}" text-anchor="${anc}" dominant-baseline="central">${esc(it.lastT || '')}</text>`;
      } else {
        const key = ensureSym(u, !!it.ghost);
        s += `<path class="mp-usel" d="${SHPS[side]}"/>` + (it.me ? `<path class="mp-ume" d="${SHP[side]}"/>` : '') + `<path class="mp-uhalo" d="${SHP[side]}"/>`
          + `<use class="mp-usym" href="#${key}" x="-14" y="-16.8" width="28" height="28.93"/>`
          + `<circle class="mp-rtrack" r="15.5"/><path class="mp-ring"/>`
          + `<text class="mp-ulbl" x="${F(lx)}" y="${F(ly)}" text-anchor="${anc}" dominant-baseline="central">${lab}</text>`;
      }
      s += '<g class="mp-ubadge" transform="translate(13 -13)"><circle r="7.5"/><text class="mp-mono" text-anchor="middle" dominant-baseline="central" y="0.5"></text></g>';
      return s;
    }
    function syncUnits(items) {
      const byS = { B: [], R: [] };
      (items || []).forEach(u => { if (u && isNum(u.u) && isNum(u.v) && u.known !== 'hidden') byS[u.side === 'R' ? 'R' : 'B'].push(u); });
      const bands = Object.assign({ green: 75, amber: 50 }, S.bands || {});
      ['B', 'R'].forEach(sd => {
        const reg = sd === 'R' ? K.units : (K.unitsB || (K.unitsB = new Map()));
        const grp = sd === 'R' ? L.red : L.blue;
        let gl = grp.querySelector(':scope > .mp-uwrap');
        if (!gl) { gl = document.createElementNS(NS, 'g'); gl.setAttribute('class', 'mp-uwrap'); grp.appendChild(gl); }
        sync(reg, gl, byS[sd], {
          key: u => u.id,
          sig: u => JSON.stringify([u.unit && u.unit.type, u.unit && u.unit.ech, u.label, u.me, u.ghost, u.known, u.lastT, u.title, axisFrom, att]),
          build: unitBuild,
          attrs: u => ({ 'data-ref': u.ref || ('unit:' + u.id), 'data-u': u.id, 'data-x': r1(u.u * 1000), 'data-y': r1(u.v * H) }),
          pos: u => ((G && G.mode === 'drag' && G.dk === 'unit' && G.uid === u.id) ? null : [u.u * 1000, u.v * H]),
          patch: (e, u) => {
            e.base = 'mp-u mp-sc side-' + sd + (u.me ? ' me' : '') + (u.sel ? ' sel' : '') + (u.moving ? ' moving' : '') + (u.ffir ? ' ffir' : '') + (u.known === 'last' ? ' last' : '') + (u.ghost ? ' ghost' : '') + clsN(u.cls);
            if (!e.parts) e.parts = { ring: e.el.querySelector('.mp-ring'), track: e.el.querySelector('.mp-rtrack'), bt: e.el.querySelector('.mp-ubadge text') };
            const sv = isNum(u.str) ? clamp(u.str, 0, 1) : null;
            if (e.parts.ring) {
              const show = sv != null && sv < 0.995;
              setA(e.parts.ring, 'd', show ? arc(0, 0, 15.5, Math.max(0.002, sv)) : '');
              setA(e.parts.ring, 'class', 'mp-ring ' + (u.ffir ? 'b-bad' : sv == null ? '' : sv * 100 >= bands.green ? 'b-ok' : sv * 100 >= bands.amber ? 'b-warn' : 'b-bad'));
              setA(e.parts.track, 'class', show ? 'mp-rtrack' : 'mp-rtrack mp-none');
            }
            e.badge = u.badge != null && u.badge !== '' ? (isNum(u.badge) ? '×' + u.badge : String(u.badge)) : '';
          }
        });
      });
    }
    /* agrupa unidades solapadas (k < 1,6) y fija clase y distintivo */
    function collapse() {
      const k = 1000 / view.w;
      [K.unitsB, K.units].forEach(reg => {
        if (!reg) return;
        const heads = [];
        reg.forEach(e => {
          if (e.x == null) { e.col = false; e.cnt = 1; return; }
          let h = null;
          if (!(e.item && (e.item.sel || e.item.known === 'last'))) {
            for (let i = 0; i < heads.length; i++) { const d = dist([e.x, e.y], [heads[i].x, heads[i].y]) / upp; if (d < 6 || (k < 1.6 && d < 30)) { h = heads[i]; break; } }
          }
          if (h) { e.col = true; h.cnt++; } else { e.col = false; e.cnt = 1; heads.push(e); }
        });
        reg.forEach(e => {
          setA(e.el, 'class', (e.base || 'mp-u mp-sc') + (e.col ? ' mp-col' : ''));
          if (e.parts && e.parts.bt) { const b = e.cnt > 1 ? '×' + e.cnt : (e.badge || ''); if (e.parts.bt.textContent !== b) e.parts.bt.textContent = b; setA(e.el.querySelector('.mp-ubadge'), 'class', 'mp-ubadge' + (b ? ' on' : '')); }
        });
      });
    }
    /* glifos de función */
    function syncGlyphs(items) {
      const on = S.fnOn || {};
      sync(K.glyphs, L.sync, (items || []).filter(g => g && isNum(g.u) && isNum(g.v)), {
        sig: g => [g.fn, g.label, g.auto ? 1 : 0].join('|'),
        build: g => `<title>${esc(g.label || g.fn)}</title><line class="mp-lead" x1="0" y1="0" x2="0" y2="0"/><g class="mp-glw"><circle class="mp-glp" r="11"/><g class="mp-gly" transform="translate(-8 -8)">${GLYPH[g.fn] || GLYPH.man}</g></g>`,
        attrs: g => ({ class: 'mp-glyph fn-' + (g.fn || 'x') + (g.auto ? ' mp-auto' : '') + (on[g.fn] === 0 || on[g.fn] === false ? ' mp-fnoff' : '') + clsN(g.cls), 'data-ref': g.ref || null }),
        pos: uvPos
      });
    }
    /* DP */
    function syncDps(items) {
      sync(K.dps, L.dps, (items || []).filter(d => d && isNum(d.u) && isNum(d.v)), {
        sig: d => [d.side, d.label, d.state].join('|'),
        build: d => {
          const st = String(d.state || 'before');
          return `<title>${esc(d.label || d.id)}${d.txt ? ' · ' + esc(d.txt) : ''}</title><line class="mp-lead" x1="0" y1="0" x2="0" y2="0"/><g class="mp-dpw"><circle class="mp-hitc" r="12"/><circle class="mp-dptrack" r="10.5"/><path class="mp-dpring"/><path class="mp-dpd" d="M0 -7.5L7.5 0L0 7.5L-7.5 0Z"/>`
            + (st === 'triggered' ? '<path class="mp-dpck" d="M-3.2 0.2L-0.8 2.6L3.4 -2.4"/>' : st === 'missed' ? '<path class="mp-dpck" d="M-2.6 -2.6L2.6 2.6M2.6 -2.6L-2.6 2.6"/>' : '')
            + `<text class="mp-dpl mp-mono" x="14" y="-3" dominant-baseline="central">${esc(d.label || d.id)}</text><text class="mp-dpt mp-mono" x="14" y="9" dominant-baseline="central"></text></g>`;
        },
        attrs: d => ({ class: 'mp-dp side-' + (d.side === 'R' ? 'R' : 'B') + ' st-' + String(d.state || 'before') + (d.state === 'open' ? ' mp-open' : '') + clsN(d.cls), 'data-ref': d.ref || ('dp:' + d.id), 'data-state': d.state || 'before' }),
        pos: uvPos,
        patch: (e, d) => {
          if (!e.parts) e.parts = { ring: e.el.querySelector('.mp-dpring'), txt: e.el.querySelector('.mp-dpt') };
          setA(e.parts.ring, 'd', d.state === 'open' && isNum(d.frac) ? arc(0, 0, 10.5, clamp(d.frac, 0.004, 1)) : '');
          const tx = d.txt || ''; if (e.parts.txt.textContent !== tx) e.parts.txt.textContent = tx;
        }
      });
    }
    function syncHpts(items) {
      sync(K.hpts, L.dps, (items || []).filter(h => h && isNum(h.u) && isNum(h.v)), {
        sig: h => h.label || h.id,
        build: h => `<title>${esc(h.label || h.id)}</title><line class="mp-lead" x1="0" y1="0" x2="0" y2="0"/><g><circle class="mp-hpt" r="12"/><path class="mp-hpt" d="M-18 0H-6M6 0H18M0 -18V-6M0 6V18"/><text class="mp-hptl mp-mono" y="26" text-anchor="middle" dominant-baseline="central">${esc(h.label || h.id)}</text></g>`,
        attrs: h => ({ class: 'mp-hptg' + clsN(h.cls), 'data-ref': h.ref || ('hpt:' + h.id) }),
        pos: uvPos
      });
    }
    /* contactos */
    function syncContacts(items) {
      sync(K.contacts, L.adj, (items || []).filter(c => c && isNum(c.u) && isNum(c.v)), {
        sig: c => [c.ratio, c.req, c.margin, c.outcome, c.shown, c.me, c.manual, c.label, c.outLabel].join('|'),
        build: c => {
          const out = c.shown === 'outcome' && c.outcome, txt = out ? (c.outLabel || resL(c.outcome)) + (c.manual ? ' · ' + t('árbitro') : '') : (c.ratio || '');
          const w = Math.ceil(textW(txt, 10, 600, FONT_M)) + 10;
          const tl = [c.label, c.ratio && (t('Ratio') + ' ' + c.ratio + (c.req ? ' (' + t('mín') + ' ' + c.req + ')' : '')), c.outcome && resL(c.outcome), (isNum(c.lb) || isNum(c.lr)) && (t('Bajas A / R') + ' ' + (isNum(c.lb) ? Math.round(c.lb) : '—') + ' / ' + (isNum(c.lr) ? Math.round(c.lr) : '—') + ' %')].filter(Boolean).join(' · ');
          return `<title>${esc(tl)}</title><line class="mp-lead" x1="0" y1="0" x2="0" y2="0"/><g class="mp-pop"><circle class="mp-ctr" r="13"/><path class="mp-sw" d="M-6.5 6.5L6.5 -6.5M6.5 6.5L-6.5 -6.5M-6 1.8L-1.8 6M6 1.8L1.8 6"/>`
            + (txt ? `<g transform="translate(0 23)"><rect class="mp-ctb" x="${F(-w / 2)}" y="-8" width="${w}" height="16" rx="2"/><text class="mp-ctt mp-mono" text-anchor="middle" dominant-baseline="central" y="0.5">${esc(txt)}</text></g>` : '') + '</g>';
        },
        attrs: c => ({ class: 'mp-ct m-' + (c.margin || 'none') + (c.me ? ' me' : '') + (c.shown === 'outcome' ? ' out' : '') + clsN(c.cls), 'data-ref': c.ref || c.id, 'data-margin': c.margin || null }),
        pos: uvPos, pop: true
      });
    }
    function syncLinks(items) {
      sync(K.links, L.adj, (items || []).filter(l => l && l.pts && l.pts.length > 1), {
        tag: 'path',
        sig: l => jp(l.pts),
        build: () => '',
        attrs: l => ({ class: 'mp-link' + clsN(l.cls), d: path(l.pts.filter(okPt).map(xy), false, false) })
      });
    }
    function syncUnop(items) {
      sync(K.unopposed, L.adj, (items || []).filter(u => u && u.pts && u.pts.length > 2), {
        sig: u => jp(u.pts) + '|' + (u.label || ''),
        build: u => {
          const P = u.pts.filter(okPt).map(xy), c = centroid(P), d = path(P, true, false), lw = u.label ? textW(u.label, 11, 600, FONT_H, 0.03) + 12 : 0;
          return `<title>${esc(u.label || '')}</title><path class="mp-unop" d="${d}" fill="url(#${ID}-red)"/><path class="mp-unope" d="${d}"/>`
            + scG(c[0], c[1], `<circle class="mp-unopc" r="9"/><text class="mp-unopx" text-anchor="middle" dominant-baseline="central" y="0.5">!</text>${u.label ? `<g transform="translate(14 0)"><rect class="mp-lbox red" x="0" y="-8" width="${F(lw)}" height="16" rx="1.5"/><text class="mp-lt mp-red" x="6" dominant-baseline="central" y="0.5">${esc(u.label)}</text></g>` : ''}`, 'mp-unopl');
        },
        attrs: u => ({ class: 'mp-unopg', 'data-ref': u.ref || null })
      });
    }
    function syncEdges(items) {
      sync(K.edges, L.method, (items || []).filter(x => x && isNum(x.u) && isNum(x.v)), {
        sig: x => [x.kind, x.label, x.side].join('|'),
        build: x => {
          const lw = x.label ? textW(x.label, 10, 600, FONT_M) + 12 : 0;
          const ic = x.kind === 'flank' ? '<path class="mp-flk" d="M0 -9L9 7H-9Z"/><text class="mp-flkx" text-anchor="middle" dominant-baseline="central" y="2">!</text>' : '<circle class="mp-entc" r="8"/><path class="mp-enta" d="M-4 0H4M1 -3L4 0L1 3"/>';
          return `<title>${esc(x.label || '')}</title><line class="mp-lead" x1="0" y1="0" x2="0" y2="0"/><g>${ic}${x.label ? `<g transform="translate(13 0)"><rect class="mp-lbox mp-edgeb" x="0" y="-8" width="${F(lw)}" height="16" rx="1.5"/><text class="mp-lt mp-mono mp-edget" x="6" dominant-baseline="central" y="0.5">${esc(x.label)}</text></g>` : ''}</g>`;
        },
        attrs: x => ({ class: 'mp-etok k-' + (x.kind || 'entry') + ' side-' + (x.side === 'B' ? 'B' : 'R'), 'data-ref': x.ref || null }),
        pos: uvPos
      });
    }
    /* máscara fuera de la acotación */
    const mcol = c => { c = String(c || 'belt').replace(/^method-/, '').replace(/^m-/, ''); return /^(critical|belt|box|avenue)$/.test(c) ? c : 'belt'; };
    const rings = pts => { if (!pts || !pts.length) return []; return okPt(pts[0]) ? [pts] : pts.filter(r => r && r.length > 2 && okPt(r[0])); };
    function syncMask(m) {
      sync(K.mask, L.method, m ? [Object.assign({ id: 'mask' }, m)] : [], {
        sig: x => JSON.stringify([(x.holes || []).map(jp), (x.tiers || []).map(ti => [ti.alpha, rings(ti.pts).map(jp)]), x.alpha, x.color, H]),
        build: x => {
          const op = a => F(Math.min(1, (isNum(a) ? a : 0.55) / 0.55));
          const holes = (x.holes || []).reduce((acc, h) => acc.concat(rings(h)), []);
          let s = `<path class="mp-mask mp-fadein" fill-rule="evenodd" style="opacity:${op(x.alpha)}" d="M0 0H1000V${F(H)}H0Z${holes.map(h => path(h.filter(okPt).map(xy), true, false)).join('')}"/>`;
          (x.tiers || []).forEach(ti => { const R = rings(ti.pts); if (R.length) s += `<path class="mp-mask mp-fadein" fill-rule="evenodd" style="opacity:${op(ti.alpha)}" d="${R.map(r => path(r.filter(okPt).map(xy), true, false)).join('')}"/>`; });
          holes.forEach(h => { s += `<path class="mp-maske" d="${path(h.filter(okPt).map(xy), true, false)}"/>`; });
          return s;
        },
        attrs: x => ({ class: 'mp-maskg m-' + mcol(x.color) })
      });
    }
    /* contornos de acotación y asas */
    function handleMk(h, extra, kind) {
      const big = coarse ? 12 : 6, hit = coarse ? 22 : 11;
      const vis = kind === 'p' ? `<rect class="mp-hv" x="${-big}" y="${-big}" width="${2 * big}" height="${2 * big}" rx="${F(big / 2)}"/><path class="mp-ha" d="M${F(-big * 0.55)} 0H${F(big * 0.55)}M${F(-big * 0.2)} ${F(-big * 0.35)}L${F(-big * 0.55)} 0L${F(-big * 0.2)} ${F(big * 0.35)}M${F(big * 0.2)} ${F(-big * 0.35)}L${F(big * 0.55)} 0L${F(big * 0.2)} ${F(big * 0.35)}"/>`
        : kind === 'm' ? `<circle class="mp-hv mp-hm" r="${F(big * 0.75)}"/><path class="mp-ha" d="M${F(-big * 0.4)} 0H${F(big * 0.4)}M0 ${F(-big * 0.4)}V${F(big * 0.4)}"/>`
          : kind === 'move' ? `<circle class="mp-hv" r="${big}"/><path class="mp-ha" d="M${F(-big * 0.6)} 0H${F(big * 0.6)}M0 ${F(-big * 0.6)}V${F(big * 0.6)}"/>`
            : `<rect class="mp-hv" x="${-big}" y="${-big}" width="${2 * big}" height="${2 * big}" rx="1.5"/>`;
      return scG(h[0], h[1], `<g${h[2] != null ? ` transform="rotate(${F(h[2])})"` : ''}>${vis}</g><circle class="mp-hhit" r="${hit}"/>`, 'mp-h', extra);
    }
    function syncBounds(items) {
      sync(K.bounds, L.method, (items || []).filter(b => b && b.pts && b.pts.length), {
        sig: b => JSON.stringify([rings(b.pts).map(jp), b.label, b.method, (b.handles || []).map(h => [h.id, Math.round((h.u || 0) * 1e4), Math.round((h.v || 0) * 1e4), h.axis]), coarse]),
        build: b => {
          const R = rings(b.pts).map(r => r.filter(okPt).map(xy));
          let s = R.map(r => `<path class="mp-bd" d="${path(r, true, false)}"/>`).join('');
          if (b.label && R.length) {
            const bb = bbox([].concat.apply([], R)), w = textW(b.label, 11, 600, FONT_H, 0.05) + 12;
            s += scG(bb[0], bb[1], `<g transform="translate(0 -9)"><rect class="mp-bdt" x="0" y="-8" width="${F(w)}" height="16" rx="1.5"/><text class="mp-bdtt" x="6" dominant-baseline="central" y="0.5">${esc(b.label)}</text></g>`, 'mp-bdl');
          }
          const dv = depthV();
          (b.handles || []).forEach(h => {
            if (!isNum(h.u) || !isNum(h.v)) return;
            const kind = h.id === 'move' ? 'move' : (h.axis === 'p' || h.axis === 'q') ? 'p' : 'free';
            const ang = h.axis === 'p' ? deg(dv) : h.axis === 'q' ? deg(perp(dv)) : null;
            s += handleMk([h.u * 1000, h.v * H, ang], ` data-h="b" data-b="${esc(b.id)}" data-hid="${esc(h.id)}" data-axis="${esc(h.axis || 'free')}"`, kind);
          });
          return s;
        },
        attrs: b => ({ class: 'mp-bound m-' + mcol(b.method) + clsN(b.cls), 'data-ref': b.ref || ('bound:' + (b.method || b.id)) })
      });
    }
    /* llamadas HTML (sobre el SVG) */
    function syncCallouts(items) {
      const seen = new Set();
      (items || []).forEach(c => {
        if (!c || !isNum(c.u) || !isNum(c.v)) return;
        const id = String(c.id || c.ref); seen.add(id);
        let e = K.callouts.get(id);
        if (!e) {
          const d = document.createElement('div'); d.className = 'mp-co';
          const m = /^eng:[^:]*:(.+)$/.exec(c.ref || c.id || ''); if (m) d.setAttribute('data-testid', 'callout-' + m[1]);
          ovl.appendChild(d);
          const ln = document.createElementNS(NS, 'path'); ln.setAttribute('class', 'mp-coline'); L.adj.appendChild(ln);
          e = { el: d, ln, html: null }; K.callouts.set(id, e);
        }
        if (e.html !== c.html) { e.el.innerHTML = c.html || ''; e.html = c.html; }
        if (c.ref) e.el.setAttribute('data-ref', c.ref);
        e.x = c.u * 1000; e.y = c.v * H;
      });
      K.callouts.forEach((e, id) => { if (!seen.has(id)) { e.el.remove(); e.ln.remove(); K.callouts.delete(id); } });
    }
    function placeCallouts() {
      if (!K.callouts.size || !cw) return;
      K.callouts.forEach(e => {
        const sx = (e.x - view.x) / upp, sy = (e.y - view.y) / upp;
        const w = e.el.offsetWidth || 220, h = e.el.offsetHeight || 80;
        let left = sx + 26, top = sy - 26 - h;
        if (left + w > cw - 6) left = sx - 26 - w;
        if (left < 6) left = Math.max(6, Math.min(cw - w - 6, sx - w / 2));
        if (top < 6) top = sy + 26;
        if (top + h > ch - 6) top = Math.max(6, ch - h - 6);
        e.el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
        const cx = clamp(sx, left, left + w), cy = clamp(sy, top, top + h);
        e.ln.setAttribute('d', 'M' + xyS([e.x, e.y]) + 'L' + xyS([view.x + cx * upp, view.y + cy * upp]));
      });
    }
    /* separación en pantalla de marcadores puntuales que coinciden */
    const CANDS = [[0, 0], [24, -18], [-24, -18], [24, 18], [-24, 18], [0, -30], [0, 30], [46, 0], [-46, 0], [40, -32], [-40, -32]];
    function declutter(force) {
      const sig = upp.toFixed(4) + '|' + [K.contacts, K.hpts, K.dps, K.glyphs, K.edges].map(r => { let s = ''; r.forEach(e => { s += e.id + ':' + (e.x | 0) + ',' + (e.y | 0) + (e.el.classList.contains('mp-fnoff') ? 'x' : '') + ';'; }); return s; }).join('/');
      if (!force && sig === declSig) return;
      declSig = sig;
      const placed = [];
      [[K.contacts, 15], [K.hpts, 13], [K.dps, 11], [K.glyphs, 12], [K.edges, 10]].forEach(([reg, rad]) => reg.forEach(e => {
        if (e.x == null) return;
        let best = CANDS[0];
        if (!e.el.classList.contains('mp-fnoff')) {
          for (let i = 0; i < CANDS.length; i++) {
            const c = CANDS[i], x = e.x + c[0] * upp, y = e.y + c[1] * upp;
            if (!placed.some(p => Math.hypot(p[0] - x, p[1] - y) < (p[2] + rad) * upp)) { best = c; break; }
          }
          placed.push([e.x + best[0] * upp, e.y + best[1] * upp, rad]);
        }
        e.el._ox = best[0]; e.el._oy = best[1]; placeEl(e.el);
        const ld = e.el.querySelector(':scope > .mp-lead');
        if (ld) { setA(ld, 'x1', -best[0]); setA(ld, 'y1', -best[1]); setA(ld, 'class', best[0] || best[1] ? 'mp-lead on' : 'mp-lead'); }
      }));
    }

    /* ======================= edición ======================= */
    const drawing = () => !!(S && S.edit && DRAW[S.tool]);
    function selFeature() {
      if (!S || !S.edit || (S.tool || 'select') !== 'select' || !S.sel) return null;
      return (S.features || []).find(x => (x.ref || x.id) === S.sel && x.pts && x.pts.length) || (S.isr || []).find(x => (x.ref || x.id) === S.sel && x.pts && x.pts.length) || null;
    }
    let editG = null, draftG = null;
    function renderEdit() {
      if (!editG) { editG = document.createElementNS(NS, 'g'); editG.setAttribute('class', 'mp-eh'); draftG = document.createElementNS(NS, 'g'); draftG.setAttribute('class', 'mp-draft'); L.edit.appendChild(editG); L.edit.appendChild(draftG); }
      const f = selFeature();
      const sig = f ? JSON.stringify([f.ref || f.id, f.kind, jp(f.pts), coarse, axisFrom]) : '';
      if (sig !== editSig) {
        editSig = sig;
        let s = '';
        if (f) {
          const ref = esc(f.ref || f.id), P = f.pts.filter(okPt).map(xy);
          if (LINEK[f.kind]) { const m = pointAt(P, polyLen(P) / 2).pt; s += handleMk([m[0], m[1], deg(depthV())], ` data-h="ln" data-fref="${ref}"`, 'p'); }
          else if (POINTK[f.kind] || P.length === 1) { const c = f.kind === 'bp' && P.length >= 3 ? mean(P) : centroid(P); s += handleMk([c[0], c[1]], ` data-h="pt" data-fref="${ref}"`, 'move'); }
          else {
            const closed = f.closed !== false && P.length >= 3 && f.kind !== 'beach';
            const n = P.length, m = closed ? n : n - 1;
            for (let i = 0; i < m; i++) { const a = P[i], b = P[(i + 1) % n]; s += handleMk([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ` data-h="m" data-fref="${ref}" data-i="${i + 1}"`, 'm'); }
            P.forEach((p, i) => { s += handleMk([p[0], p[1]], ` data-h="v" data-fref="${ref}" data-i="${i}"`, 'v'); });
          }
        }
        editG.innerHTML = s; scDirty = true;
      }
      if (!drawing() && draft) { draft = null; rubber = null; }
      renderDraft();
    }
    function renderDraft() {
      const on = drawing();
      let s = '';
      if (on && draft && draft.pts.length) {
        const P = draft.pts.concat(rubber ? [rubber] : []), closed = draft.kind !== 'line' && P.length > 2;
        s += `<path class="mp-dr${draft.kind === 'nai' ? ' nai' : ''}" d="${path(P, closed, false)}"/>`;
        draft.pts.forEach(p => { s += scG(p[0], p[1], '<circle class="mp-drv" r="4"/>', ''); });
      }
      draftG.innerHTML = s;
      if (s) { Array.prototype.forEach.call(draftG.querySelectorAll('.mp-sc'), placeEl); }
      drawBar(on);
    }
    let barEl = null;
    function drawBar(on) {
      if (!on) { if (barEl) { barEl.remove(); barEl = null; } return; }
      if (!barEl) {
        barEl = document.createElement('div'); barEl.className = 'mp-drawbar';
        barEl.innerHTML = `<span class="mp-drh"></span><button type="button" class="mp-drb ok" data-mp="ok">✓ ${esc(t('Terminar'))}</button><button type="button" class="mp-drb" data-mp="cancel">✕ ${esc(t('Cancelar'))}</button>`;
        ovl.appendChild(barEl);
      }
      const n = draft ? draft.pts.length : 0, need = DRAW[S.tool] || 2;
      const h = S.tool === 'point' ? t('Pulse en el plano para situar el punto') : n ? t('{n} vértices · doble clic o ✓ para terminar · Esc cancela', { n }) : t('Pulse en el plano para añadir vértices');
      const hs = barEl.querySelector('.mp-drh'); if (hs.textContent !== h) hs.textContent = h;
      barEl.querySelector('.ok').disabled = n < need;
      barEl.querySelector('.ok').hidden = S.tool === 'point';
      barEl.querySelectorAll('.mp-drb')[1].hidden = !n;
    }
    function addVertex(q) {
      if (!draft || draft.kind !== S.tool) draft = { kind: S.tool, pts: [] };
      draft.pts.push(q);
      if (S.tool === 'point') { finishDraw(); return; }
      renderDraft();
    }
    function finishDraw() {
      if (!draft) return;
      let P = dedupe(draft.pts).filter((p, i, a) => i === 0 || dist(p, a[i - 1]) > 3 * upp);
      const need = DRAW[draft.kind] || 2;
      if (P.length < need) { renderDraft(); return; }
      const kind = draft.kind; draft = null; rubber = null; renderDraft();
      call('drawDone', kind, P.map(toUV));
    }
    function cancelDraw() { draft = null; rubber = null; renderDraft(); }

    /* ======================= vista ======================= */
    const wMin = () => 1000 / KMAX;
    function fitAll() { return fitBox([-MX, -MY, 1000 + MX, H + MY], 0); }
    function wMax() { const fa = fitAll(); return Math.max(fa.w, 1000 / 0.9); }
    function fitBox(b, pad) {
      const W = cw || 1000, Hc = ch || 700, ar = W / Hc;
      let bw = Math.max(b[2] - b[0], 1), bh = Math.max(b[3] - b[1], 1);
      bw *= 1 + 2 * (pad || 0); bh *= 1 + 2 * (pad || 0);
      if (bw < wMin()) bw = wMin();
      let w = bw, h = bw / ar; if (h < bh) { h = bh; w = bh * ar; }
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    }
    function targetBox(target) {
      if (!target || target === 'all') return null;
      if (Array.isArray(target) && target.length === 4 && target.every(isNum)) return [target[0] * 1000, target[1] * H, target[2] * 1000, target[3] * H];
      const pts = []; const walk = a => { if (okPt(a)) pts.push(a); else if (Array.isArray(a)) a.forEach(walk); }; walk(target);
      if (!pts.length) return null;
      const b = bbox(pts); return [b[0] * 1000, b[1] * H, b[2] * 1000, b[3] * H];
    }
    function clampView() {
      const W = cw || 1000, Hc = ch || 700;
      view.w = clamp(view.w, wMin(), wMax()); view.h = view.w * Hc / W;
      const cx = clamp(view.x + view.w / 2, -MX, 1000 + MX), cy = clamp(view.y + view.h / 2, -MY, H + MY);
      view.x = cx - view.w / 2; view.y = cy - view.h / 2;
    }
    let vRaf = 0;
    function applyView() {
      svg.setAttribute('viewBox', F(view.x) + ' ' + F(view.y) + ' ' + F(view.w) + ' ' + F(view.h));
      upp = cw ? view.w / cw : 1;
      svg.style.setProperty('--upp', upp.toFixed(4));
      if (Math.abs(upp - lastUpp) > 1e-7 || scDirty) {
        lastUpp = upp;
        root.classList.toggle('mp-lo', upp > 1.6);
        placeAll(); collapse(); declutter();
        Array.prototype.forEach.call(L.edit.querySelectorAll('.mp-sc'), placeEl);
      }
      placeCallouts();
      if (!vRaf) vRaf = raf(() => { vRaf = 0; if (!destroyed) call('view', getView()); });
    }
    let tw = 0;
    function cancelTween() { if (tw) { caf(tw); tw = 0; } }
    function tweenTo(v, anim) {
      cancelTween();
      if (!anim || reduced() || !cw) { view = v; clampView(); applyView(); return; }
      const a = Object.assign({}, view), t0 = now(), ms = 350;
      const step = () => {
        const s = Math.min(1, (now() - t0) / ms), e = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
        view = { x: a.x + (v.x - a.x) * e, y: a.y + (v.y - a.y) * e, w: a.w + (v.w - a.w) * e, h: a.h + (v.h - a.h) * e };
        applyView();
        tw = s < 1 ? raf(step) : 0;
        if (!tw) { view = v; clampView(); applyView(); }
      };
      tw = raf(step);
    }
    function fit(target, anim) {
      const b = targetBox(target);
      const v = b ? fitBox(b, 0.08) : fitAll();
      if (!cw) { view = v; needFit = !b; applyView(); return; }
      needFit = false;
      tweenTo(v, anim !== false);
    }
    function zoomAt(f, q, anim) {
      const w = clamp(view.w / f, wMin(), wMax()), k = w / view.w;
      const v = { x: q[0] - (q[0] - view.x) * k, y: q[1] - (q[1] - view.y) * k, w, h: w * (ch || 700) / (cw || 1000) };
      if (anim) tweenTo(v, true); else { cancelTween(); view = v; clampView(); applyView(); }
    }
    function zoomBy(f, at) { const q = at && okPt(at) ? [at[0] * 1000, at[1] * H] : [view.x + view.w / 2, view.y + view.h / 2]; zoomAt(f || 1, q, true); }
    function getView() { return { x: view.x, y: view.y, w: view.w, h: view.h, k: 1000 / view.w }; }
    function resize() {
      const r = root.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const c0 = [view.x + view.w / 2, view.y + view.h / 2], pw = cw;
      cw = r.width; ch = r.height;
      root.classList.toggle('mp-narrow', cw < 560);
      if (needFit || !pw) { view = fitAll(); needFit = false; }
      else { view.h = view.w * ch / cw; view.x = c0[0] - view.w / 2; view.y = c0[1] - view.h / 2; }
      clampView(); lastUpp = -1; applyView();
    }

    /* ======================= puntero ======================= */
    const ptrs = new Map();
    let G = null, pinch = null, lastTap = null, hoverRef, rect = null, lastVertex = null;
    const pxOf = e => { const r = rect || svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const toUser = px => [view.x + px[0] * upp, view.y + px[1] * upp];
    function hitOf(target) {
      if (!target || !target.closest) return { type: 'empty' };
      const h = target.closest('[data-h]');
      if (h && svg.contains(h)) return { type: 'handle', el: h, h: h.getAttribute('data-h'), fref: h.getAttribute('data-fref'), i: +h.getAttribute('data-i'), bid: h.getAttribute('data-b'), hid: h.getAttribute('data-hid'), axis: h.getAttribute('data-axis') };
      const r = target.closest('[data-ref]');
      if (r && svg.contains(r)) return { type: r.classList.contains('mp-u') ? 'unit' : 'ref', el: r, ref: r.getAttribute('data-ref'), uid: r.getAttribute('data-u') };
      return { type: 'empty' };
    }
    function dragKind(hit) {
      if (!S) return null;
      if (hit.type === 'handle') return hit.h === 'b' ? 'bound' : hit.h === 'ln' ? 'line' : hit.h === 'pt' ? 'pt' : hit.h === 'm' ? 'mid' : 'vertex';
      if (drawing()) return null;
      if (hit.type === 'unit' && S.edit) { const u = (S.units || []).find(x => x.id === hit.uid); if (u && !u.ghost && u.known !== 'last') return 'unit'; }
      if (hit.type === 'ref' && S.edit && (S.tool || 'select') === 'select' && hit.ref === S.sel) {
        const f = (S.features || []).find(x => (x.ref || x.id) === hit.ref);
        if (f && LINEK[f.kind]) return 'line';
        if (f && (POINTK[f.kind] || (f.pts && f.pts.length === 1))) return 'pt';
      }
      return null;
    }
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelTween();
      if (document.activeElement !== root && !root.contains(document.activeElement)) { try { root.focus({ preventScroll: true }); } catch (_) { /* sin foco */ } }
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* puntero sin captura */ }
      rect = svg.getBoundingClientRect();
      const px = pxOf(e);
      ptrs.set(e.pointerId, px);
      if (ptrs.size === 2) {
        if (G) { clearTimeout(G.lp); if (G.mode === 'drag') endDrag(G, G.px, e); }
        G = null;
        const pp = Array.from(ptrs.values());
        pinch = { d0: dist(pp[0], pp[1]) || 1, m0: mul(addv(pp[0], pp[1]), 0.5), v0: Object.assign({}, view), u0: upp };
        return;
      }
      if (ptrs.size > 2) return;
      const hit = hitOf(e.target);
      G = { id: e.pointerId, px0: px, px, t0: now(), hit, mode: 'pending', touch: e.pointerType === 'touch', dk: dragKind(hit) };
      if (G.dk && G.touch) { const g = G; g.lp = setTimeout(() => { if (G === g && g.mode === 'pending') { startDrag(g); g.lpOnly = true; } }, 350); }
      if (e.pointerType !== 'mouse') e.preventDefault();
    }
    function onMove(e) {
      if (!ptrs.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const r = (e.target && e.target.closest) ? e.target.closest('[data-ref]') : null, ref = r && svg.contains(r) ? r.getAttribute('data-ref') : null;
          if (ref !== hoverRef) { hoverRef = ref; call('hover', ref); }
          if (drawing() && draft && draft.pts.length) { rect = svg.getBoundingClientRect(); rubber = toUser(pxOf(e)); renderDraft(); }
        }
        return;
      }
      const px = pxOf(e);
      ptrs.set(e.pointerId, px);
      if (pinch && ptrs.size >= 2) {
        const pp = Array.from(ptrs.values()), d = dist(pp[0], pp[1]) || 1, m = mul(addv(pp[0], pp[1]), 0.5);
        const v0 = pinch.v0, an = [v0.x + pinch.m0[0] * pinch.u0, v0.y + pinch.m0[1] * pinch.u0];
        const w = clamp(v0.w * pinch.d0 / d, wMin(), wMax()), nu = w / cw;
        view = { x: an[0] - m[0] * nu, y: an[1] - m[1] * nu, w, h: w * ch / cw }; clampView(); applyView();
        return;
      }
      if (!G || e.pointerId !== G.id) return;
      const d = dist(px, G.px0);
      if (G.mode === 'pending' && d > (G.dk && !G.touch ? 3 : 8)) {
        clearTimeout(G.lp);
        if (G.dk && !G.touch) startDrag(G);
        else { G.mode = 'pan'; G.pp = G.px0; root.classList.add('mp-panning'); }
      }
      if (G.mode === 'pan') { view.x -= (px[0] - G.pp[0]) * upp; view.y -= (px[1] - G.pp[1]) * upp; G.pp = px; clampView(); applyView(); }
      else if (G.mode === 'drag') { G.moved = G.moved || d > 8; dragMove(G, px, e); }
      G.px = px;
    }
    function onUp(e) {
      const had = ptrs.has(e.pointerId);
      ptrs.delete(e.pointerId);
      try { svg.releasePointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
      if (pinch) { if (ptrs.size < 2) pinch = null; G = null; return; }
      if (!had || !G || e.pointerId !== G.id) return;
      clearTimeout(G.lp);
      const px = pxOf(e);
      root.classList.remove('mp-panning');
      if (G.mode === 'drag') {
        if (G.lpOnly && !G.moved && G.dk === 'vertex') { cancelDragPreview(G); removeVertex(G.fref, G.i); }
        else endDrag(G, px, e);
      } else if (G.mode === 'pending' && e.type !== 'pointercancel') {
        if (dist(px, G.px0) <= 8 && (!G.touch || now() - G.t0 < 350)) tap(G, px, e);
      }
      G = null;
    }
    function tap(g, px, e) {
      const q = toUser(px), tm = now();
      const dbl = lastTap && tm - lastTap.t < 320 && dist(px, lastTap.px) < 12;
      lastTap = dbl ? null : { t: tm, px };
      if (g.hit.type === 'handle') { if (g.hit.h === 'v') lastVertex = { ref: g.hit.fref, i: g.hit.i }; return; }
      if (drawing()) { if (dbl && S.tool !== 'point') finishDraw(); else addVertex(q); return; }
      if (dbl) { zoomAt(2, q, true); return; }
      const uv = toUV(q);
      call('select', g.hit.ref || null, { shift: !!e.shiftKey, alt: !!e.altKey, ctrl: !!(e.ctrlKey || e.metaKey), u: uv[0], v: uv[1] });
    }
    function onWheel(e) {
      e.preventDefault(); cancelTween();
      rect = svg.getBoundingClientRect();
      let dy = e.deltaY; if (e.deltaMode === 1) dy *= 33; else if (e.deltaMode === 2) dy *= 400;
      dy = clamp(dy, -300, 300);
      zoomAt(Math.pow(1.15, -dy / 100), toUser(pxOf(e)), false);
    }

    /* ---------- arrastres ---------- */
    function featByRef(ref) { return (S.features || []).find(x => (x.ref || x.id) === ref) || (S.isr || []).find(x => (x.ref || x.id) === ref) || null; }
    function featElByRef(ref) { let el = null; featEls.forEach(e => { if (!el && e.el.getAttribute('data-ref') === ref) el = e.el; }); if (!el) K.isr.forEach(e => { if (!el && e.el.getAttribute('data-ref') === ref) el = e.el; }); return el; }
    function snapAt(q) {
      let best = null;
      (S.features || []).forEach(f => {
        if (!f.pts || !f.pts.length || f.hidden) return;
        const P = f.pts.filter(okPt).map(xy);
        let c;
        if (LINEK[f.kind]) c = nearestOn(q, P, false).pt;
        else if (f.kind === 'offboard') return;
        else c = f.kind === 'bp' && P.length >= 3 ? mean(P) : P.length >= 3 ? centroid(P) : P[0];
        const d = dist(q, c) / upp;
        if (d <= 18 && (!best || d < best.d)) best = { d, pt: c, ref: f.ref || f.id };
      });
      return best;
    }
    function setSnapHl(ref) {
      if (G && G.snapEl) { G.snapEl.classList.remove('mp-snap'); G.snapEl = null; }
      if (ref && G) { const el = featElByRef(ref); if (el) { el.classList.add('mp-snap'); G.snapEl = el; } }
    }
    function startDrag(g) {
      g.mode = 'drag'; root.classList.add('mp-dragging');
      const q = toUser(g.px), h = g.hit;
      if (g.dk === 'unit') {
        const u = (S.units || []).find(x => x.id === h.uid); if (!u) { g.mode = 'none'; return; }
        g.uid = u.id; g.uel = h.el; g.grab = sub([u.u * 1000, u.v * H], toUser(g.px0)); g.last = [u.u * 1000, u.v * H];
        call('dragUnit', u.id, { u: u.u, v: u.v }, 'start', null);
      } else if (g.dk === 'line') {
        g.fref = h.fref || h.ref; g.start = toUser(g.px0); g.fel = featElByRef(g.fref);
        const f = featByRef(g.fref); const m = f ? mean(f.pts) : toUV(g.start);
        g.p0 = isNum(f && f.p) ? f.p : uv2p(m[0], m[1]); g.p = g.p0;
        call('dragLine', g.fref, g.p0, 'start');
      } else if (g.dk === 'pt') {
        g.fref = h.fref || h.ref; g.start = toUser(g.px0); g.fel = featElByRef(g.fref);
        const f = featByRef(g.fref), P = f ? f.pts.filter(okPt).map(xy) : [g.start];
        g.c0 = f && f.kind === 'bp' && P.length >= 3 ? mean(P) : P.length >= 3 ? centroid(P) : P[0]; g.c = g.c0;
        call('dragFeature', g.fref, { u: g.c0[0] / 1000, v: g.c0[1] / H }, 'start');
      } else if (g.dk === 'vertex' || g.dk === 'mid') {
        const f = featByRef(h.fref); if (!f) { g.mode = 'none'; return; }
        g.fref = h.fref; g.fel = featElByRef(h.fref); g.pts = f.pts.filter(okPt).map(xy); g.i = h.i;
        if (g.dk === 'mid') { g.pts.splice(h.i, 0, q); g.dk = 'vertex'; }
        g.grab = sub(g.pts[g.i], toUser(g.px0)); g.hel = h.el; lastVertex = { ref: g.fref, i: g.i };
        call('dragFeature', g.fref, { pts: g.pts.map(toUV) }, 'start');
      } else if (g.dk === 'bound') {
        g.bid = h.bid; g.hid = h.hid; g.axis = h.axis; g.h0 = [h.el._sx, h.el._sy]; g.start = toUser(g.px0);
        call('dragHandle', g.bid, g.hid, { u: g.h0[0] / 1000, v: g.h0[1] / H }, 'start');
      }
    }
    function constrain(d, axis) {
      if (axis === 'p') { const D = depthV(); const k = d[0] * D[0] + d[1] * D[1]; return mul(D, k); }
      if (axis === 'q') { const D = perp(depthV()); const k = d[0] * D[0] + d[1] * D[1]; return mul(D, k); }
      return d;
    }
    function clampSheet(q) { return [clamp(q[0], 0, 1000), clamp(q[1], 0, H)]; }
    function preview(el, attr, val) {
      if (!el) return;
      if (!previews.some(p => p.el === el && p.attr === attr)) previews.push({ el, attr, orig: el.getAttribute(attr) });
      if (val == null) el.removeAttribute(attr); else el.setAttribute(attr, val);
    }
    function dragMove(g, px, e) {
      const q = toUser(px);
      if (g.dk === 'unit') {
        let p = clampSheet(addv(q, g.grab)), snap = null;
        if (!e.altKey) { snap = snapAt(p); if (snap) p = snap.pt; }
        g.last = p; g.snap = snap ? snap.ref : null; setSnapHl(g.snap);
        const ue = (K.unitsB && K.unitsB.get(g.uid)) || K.units.get(g.uid);
        if (ue) { ue.el._sx = p[0]; ue.el._sy = p[1]; ue.x = p[0]; ue.y = p[1]; placeEl(ue.el); }
        call('dragUnit', g.uid, { u: p[0] / 1000, v: p[1] / H }, 'move', g.snap);
      } else if (g.dk === 'line') {
        const dd = constrain(sub(q, g.start), 'p'), D = depthV(), scale = Math.abs(D[0]) ? 1000 : H;
        g.p = clamp(g.p0 + (dd[0] * D[0] + dd[1] * D[1]) / scale, 0.01, 0.99);
        const real = mul(D, (g.p - g.p0) * scale);
        preview(g.fel, 'transform', `translate(${xyS(real)})`);
        call('dragLine', g.fref, Math.round(g.p * 1e4) / 1e4, 'move');
      } else if (g.dk === 'pt') {
        g.c = clampSheet(addv(g.c0, sub(q, g.start)));
        preview(g.fel, 'transform', `translate(${xyS(sub(g.c, g.c0))})`);
        const hel = editG.querySelector('[data-h="pt"]'); if (hel) { hel._sx = g.c[0]; hel._sy = g.c[1]; placeEl(hel); }
        call('dragFeature', g.fref, { u: g.c[0] / 1000, v: g.c[1] / H }, 'move');
      } else if (g.dk === 'vertex') {
        g.pts[g.i] = clampSheet(addv(q, g.grab));
        if (g.fel) {
          const f = featByRef(g.fref), closed = f && f.closed !== false && g.pts.length >= 3 && !LINEK[f.kind] && f.kind !== 'beach';
          const smooth = f && (f.kind === 'ea' || f.kind === 'obj' || f.kind === 'water' || f.kind === 'nai' || f.kind === 'tai') && g.pts.length >= 5;
          const d = closed ? (smooth ? path(g.pts, true, true) : roundPoly(g.pts, f.kind === 'area' || f.kind === 'urban' ? 7 : 3)) : path(g.pts, false, g.pts.length > 2);
          Array.prototype.forEach.call(g.fel.querySelectorAll('.mp-fs, .mp-fh, .mp-hit, .mp-isrf, .mp-urb, .mp-urbh, .mp-sea, .mp-dbl-i, .mp-river'), p => { if (p.tagName.toLowerCase() === 'path') preview(p, 'd', d); });
        }
        const hel = editG.querySelector(`[data-h="v"][data-i="${g.i}"]`);
        if (hel && g.hel && g.hel.getAttribute('data-h') === 'v') { hel._sx = g.pts[g.i][0]; hel._sy = g.pts[g.i][1]; placeEl(hel); }
        call('dragFeature', g.fref, { pts: g.pts.map(toUV) }, 'move');
      } else if (g.dk === 'bound') {
        const p = clampSheet(addv(g.h0, constrain(sub(q, g.start), g.axis)));
        const sel = `[data-h="b"][data-b="${cssEsc(g.bid)}"][data-hid="${cssEsc(g.hid)}"]`, hel = L.method.querySelector(sel);
        if (hel) { hel._sx = p[0]; hel._sy = p[1]; placeEl(hel); }
        g.last = p;
        call('dragHandle', g.bid, g.hid, { u: p[0] / 1000, v: p[1] / H }, 'move');
      }
    }
    const cssEsc = s => (global.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&'));
    function endDrag(g) {
      root.classList.remove('mp-dragging');
      setSnapHl(null);
      dragEndAt = now();
      if (g.dk === 'unit' && g.last) call('dragUnit', g.uid, { u: Math.round(g.last[0] / 1000 * 1e4) / 1e4, v: Math.round(g.last[1] / H * 1e4) / 1e4 }, 'end', g.snap || null);
      else if (g.dk === 'line') call('dragLine', g.fref, Math.round(g.p * 1e4) / 1e4, 'end');
      else if (g.dk === 'pt') call('dragFeature', g.fref, { u: Math.round(g.c[0] / 1000 * 1e4) / 1e4, v: Math.round(g.c[1] / H * 1e4) / 1e4 }, 'end');
      else if (g.dk === 'vertex' && g.pts) call('dragFeature', g.fref, { pts: g.pts.map(toUV) }, 'end');
      else if (g.dk === 'bound') { const p = g.last || g.h0; call('dragHandle', g.bid, g.hid, { u: Math.round(p[0] / 1000 * 1e4) / 1e4, v: Math.round(p[1] / H * 1e4) / 1e4 }, 'end'); }
      g.mode = 'done';
    }
    function cancelDragPreview(g) { root.classList.remove('mp-dragging'); restorePreviews(); g.mode = 'done'; }
    function restorePreviews() { previews.forEach(p => { if (p.orig == null) p.el.removeAttribute(p.attr); else p.el.setAttribute(p.attr, p.orig); }); previews = []; }
    function removeVertex(ref, i) {
      const f = featByRef(ref); if (!f || !f.pts) return;
      const min = LINEK[f.kind] || f.kind === 'beach' || f.closed === false ? 2 : 3;
      if (f.pts.length <= min) return;
      const pts = f.pts.filter((p, k) => k !== i);
      lastVertex = null;
      call('dragFeature', ref, { pts }, 'end');
    }

    /* ---------- teclado ---------- */
    function onKey(e) {
      if (e.target !== root && !svg.contains(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key; let used = true;
      const panBy = (fx, fy) => { cancelTween(); view.x += view.w * fx; view.y += view.h * fy; clampView(); applyView(); };
      if (drawing() && k === 'Escape' && draft) cancelDraw();
      else if (drawing() && k === 'Enter') finishDraw();
      else if (drawing() && k === 'Backspace' && draft && draft.pts.length) { draft.pts.pop(); renderDraft(); }
      else if ((k === 'Delete' || k === 'Backspace') && lastVertex && S && S.edit) removeVertex(lastVertex.ref, lastVertex.i);
      else if (k === 'ArrowLeft') panBy(-0.1, 0);
      else if (k === 'ArrowRight') panBy(0.1, 0);
      else if (k === 'ArrowUp') panBy(0, -0.1);
      else if (k === 'ArrowDown') panBy(0, 0.1);
      else if (k === '+' || k === '=') zoomBy(1.5);
      else if (k === '-' || k === '_') zoomBy(1 / 1.5);
      else if (k === 'f' || k === 'F') fit('all', true);
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    }
    function onOvlClick(e) {
      const b = e.target.closest && e.target.closest('[data-mp]'); if (!b) return;
      e.stopPropagation();
      if (b.getAttribute('data-mp') === 'ok') finishDraw(); else cancelDraw();
      try { root.focus({ preventScroll: true }); } catch (_) { /* sin foco */ }
    }
    const onCtx = e => { if (G || root.classList.contains('mp-dragging')) e.preventDefault(); };
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size && hoverRef) { hoverRef = null; call('hover', null); } });
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('contextmenu', onCtx);
    root.addEventListener('keydown', onKey);
    ovl.addEventListener('click', onOvlClick);
    let ro = null;
    if (global.ResizeObserver) { ro = new ResizeObserver(() => resize()); ro.observe(root); } else global.addEventListener('resize', resize);
    const onFonts = () => { if (destroyed || !S) return; keys.cm = keys.marg = keys.base = null; K.isr.forEach(e => { e.sig = null; }); K.contacts.forEach(e => { e.sig = null; }); K.edges.forEach(e => { e.sig = null; }); K.bounds.forEach(e => { e.sig = null; }); K.flot.forEach(e => { e.sig = null; }); update(S); };
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed && S) setTimeout(onFonts, 0); }); } catch (_) { /* sin API de fuentes */ }

    /* ---------- selección ---------- */
    function applySel() {
      const ref = (S && S.sel) || '';
      if (selKey === ref) return;
      selKey = ref;
      selEls.forEach(x => x.classList.remove('mp-sel'));
      selEls = ref ? Array.prototype.slice.call(svg.querySelectorAll('[data-ref="' + cssEsc(ref) + '"]')) : [];
      selEls.forEach(x => x.classList.add('mp-sel'));
    }

    /* ======================= update ======================= */
    function hkey(st, part) {
      const h = st.hash && st.hash[part];
      if (h != null && h !== '') return String(h);
      return part === 'base' ? JSON.stringify([st.terrain, st.sectors, st.bg && [st.bg.kind, st.bg.op, st.bg.wash, (st.bg.data || '').length]]) : JSON.stringify([st.features, st.boundaries]);
    }
    function update(st) {
      if (!st || destroyed) return;
      S = st;
      const asp = isNum(st.aspect) && st.aspect > 0 ? st.aspect : 10 / 7, nH = 1000 / asp, hCh = Math.abs(nH - H) > 1e-6;
      H = nH;
      const af = (st.axis && st.axis.from) || inferAxis(st) || 'E';
      const aa = (st.axis && st.axis.att) || (af === 'W' ? 'B' : 'R');
      const axCh = af !== axisFrom || aa !== att; axisFrom = af; att = aa;
      const kb = hkey(st, 'base') + '|' + F(H), kc = hkey(st, 'cm') + '|' + F(H) + '|' + axisFrom;
      const km = JSON.stringify([st.marg && st.marg.classif, st.marg && st.marg.scale, F(H)]);
      let rebuilt = false;
      if (kb !== keys.base || hCh) { renderSheet(); renderBase(); keys.base = kb; rebuilt = true; }
      if (kc !== keys.cm || hCh) { renderCm(); keys.cm = kc; rebuilt = true; }
      if (km !== keys.marg || hCh) { renderMarg(); keys.marg = km; rebuilt = true; }
      if (rebuilt) { scDirty = true; selKey = null; editSig = null; previews = []; }
      else if (previews.length && !G && now() - dragEndAt > 600) restorePreviews();
      patchTitle(st.title);
      patchFeatureCls(st.features);
      const ly = st.layers || {};
      TOGGLE.forEach(k => svg.classList.toggle('mp-off-' + k, ly[k] === 0 || ly[k] === false));
      root.classList.toggle('mp-showall', !!st.showAll);
      root.classList.toggle('mp-editing', !!st.edit);
      root.classList.toggle('mp-drawing', drawing());
      if (axCh) { K.unitsB && K.unitsB.forEach(e => { e.sig = null; }); K.units.forEach(e => { e.sig = null; }); }
      syncFlot(st.flot); syncIsr(st.isr); syncGraphics(st.graphics); syncUnits(st.units);
      syncGlyphs(st.glyphs); syncDps(st.dps); syncHpts(st.hpts);
      syncMask(st.mask); syncBounds(st.bounds); syncEdges(st.edges);
      syncUnop(st.unopposed); syncContacts(st.contacts); syncLinks(st.links); syncCallouts(st.callouts);
      renderEdit();
      if (first || hCh) { first = false; if (cw) { view = fitAll(); needFit = false; } clampView(); lastUpp = -1; applyView(); }
      else { if (scDirty) placeAll(); collapse(); declutter(); placeCallouts(); }
      applySel();
      const ti = st.title || {};
      setA(svg, 'aria-label', [t('Plano'), ti.line1, ti.line2].filter(Boolean).join(' · '));
    }

    /* ======================= exportación ======================= */
    const PROPS = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity',
      'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order', 'vector-effect', 'color', 'visibility'];
    const DEF = { 'fill-opacity': '1', 'fill-rule': 'nonzero', 'stroke-opacity': '1', 'stroke-dasharray': 'none', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', opacity: '1', 'font-style': 'normal', 'letter-spacing': 'normal', 'text-anchor': 'start', 'dominant-baseline': 'auto', 'paint-order': 'normal', 'vector-effect': 'none', visibility: 'visible' };
    function toSVGString() {
      const W = 1600, VW = 1000 + 2 * MX, VH = H + 2 * MY, eu = VW / W;
      const clone = svg.cloneNode(true);
      const src = [svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*'))), dst = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*')));
      const kill = [];
      for (let i = 0; i < src.length; i++) {
        const s = src[i], d = dst[i];
        if (!d || kill.some(k => k.contains(d))) continue;
        if (s.getAttribute && s.getAttribute('data-layer') === 'edit') { kill.push(d); continue; }
        const inDefs = s.closest && s.closest('defs');
        let cs; try { cs = getComputedStyle(s); } catch (_) { cs = null; }
        if (!cs) continue;
        if (!inDefs && cs.display === 'none') { kill.push(d); continue; }
        let st = '';
        PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v && v !== DEF[p] && !(p === 'color' && s.tagName.toLowerCase() !== 'use')) st += p + ':' + v + ';'; });
        if (st) d.setAttribute('style', st);
        if (s._sx != null && s.classList && s.classList.contains('mp-sc')) d.setAttribute('transform', 'translate(' + F(s._sx + (s._ox || 0) * eu) + ' ' + F(s._sy + (s._oy || 0) * eu) + ') scale(' + eu.toFixed(4) + ')');
      }
      kill.forEach(n => n.remove());
      clone.setAttribute('xmlns', NS);
      clone.setAttribute('viewBox', `${-MX} ${-MY} ${VW} ${F(VH)}`);
      clone.setAttribute('width', String(W));
      clone.setAttribute('height', String(Math.round(VH / eu)));
      clone.removeAttribute('style');
      return new XMLSerializer().serializeToString(clone);
    }

    function destroy() {
      destroyed = true; cancelTween();
      if (vRaf) caf(vRaf);
      if (ro) ro.disconnect(); else global.removeEventListener('resize', resize);
      root.remove();
      K.callouts.clear();
    }

    resize();
    return { el: root, svg, update, fit, zoomBy, getView, toSVGString, destroy, get state() { return S; } };
  }

  global.WGMap = { mount, GLYPH, symbol, graphic, path, arrow, tbar, uglyph, waves, arc, chevron, roundPoly, crSample };

  if (global.WGI18N) Object.assign(global.WGI18N.en, {
    'Plano': 'Map',
    'ESQUEMA — NO A ESCALA': 'SKETCH — NOT TO SCALE',
    'Terminar': 'Finish',
    'Cancelar': 'Cancel',
    'Pulse en el plano para situar el punto': 'Tap the map to place the point',
    'Pulse en el plano para añadir vértices': 'Tap the map to add vertices',
    '{n} vértices · doble clic o ✓ para terminar · Esc cancela': '{n} vertices · double-click or ✓ to finish · Esc cancels',
    'árbitro': 'arbiter',
    'Ratio': 'Ratio',
    'mín': 'min',
    'Bajas A / R': 'Losses B / R'
  });
})(typeof window !== 'undefined' ? window : globalThis);
