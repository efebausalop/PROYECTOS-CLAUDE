/* ==========================================================================
   Geometría del plano — v0.4 «MESA» (módulo puro, sin DOM)
   --------------------------------------------------------------------------
   Utilidades en coordenadas normalizadas de la hoja [u,v] ∈ [0,1]²
   (u → derecha, v → abajo). Sin escala real: el plano es un esquema.
   - hash FNV-1a y generador sembrado mulberry32 (relieve, vegetación, ríos).
   - Polígonos: caja, centroide, punto en polígono, envolvente convexa,
     zona de influencia (buffer), círculo, distancia, contacto.
   - Polilíneas: longitud, punto a una fracción, proyección.
   - Trazos «a mano» sembrados (wavy, blob) y cadena 'd' de SVG.
   - Referencia de cuadrícula de la marginalia («H6»).
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------ números ------------------------------ */
  const EPS = 1e-12;
  function hash(str) {
    const s = String(str == null ? '' : str);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = (typeof seed === 'number' && isFinite(seed) ? seed : hash(seed)) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => Math.max(a == null ? 0 : a, Math.min(b == null ? 1 : b, x));
  /* lerp de números o de puntos [u,v] */
  const lerp = (a, b, s) => (Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * s) : a + (b - a) * s);
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const round = (x, d) => { const k = Math.pow(10, d == null ? 4 : d); return Math.round(x * k) / k; };

  /* ------------------------------ polígonos ------------------------------ */
  function bbox(pts) {
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    (pts || []).forEach(p => { if (p[0] < u0) u0 = p[0]; if (p[0] > u1) u1 = p[0]; if (p[1] < v0) v0 = p[1]; if (p[1] > v1) v1 = p[1]; });
    return isFinite(u0) ? [u0, v0, u1, v1] : null;
  }
  /* área con signo (fórmula del lazo) */
  function area(pts) {
    let s = 0; const n = (pts || []).length;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  function centroid(pts) {
    const n = (pts || []).length;
    if (!n) return null;
    const A = n >= 3 ? area(pts) : 0;
    if (Math.abs(A) > 1e-12) {
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], f = a[0] * b[1] - b[0] * a[1]; cx += (a[0] + b[0]) * f; cy += (a[1] + b[1]) * f; }
      return [cx / (6 * A), cy / (6 * A)];
    }
    let su = 0, sv = 0; pts.forEach(p => { su += p[0]; sv += p[1]; });
    return [su / n, sv / n];
  }
  /* punto en polígono (rayo par-impar) */
  function pip(pt, poly) {
    let c = false; const n = (poly || []).length, x = pt[0], y = pt[1];
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  /* envolvente convexa (cadena monótona de Andrew), sin repetir el primer punto */
  function hull(pts) {
    const p = (pts || []).map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .filter((q, i, a) => i === 0 || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1]);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    p.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  function circle(c, r, n) {
    n = n || 12; const out = [];
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    return out;
  }
  function arcPts(c, r, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    return out;
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const unit = d => { const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
  /* desplazamiento de una cadena de puntos a distancia r (lado izquierdo de la marcha),
     uniones a inglete limitadas a 2r (biselado si el ángulo es muy agudo) */
  function offsetChain(pts, r, closed) {
    const n = pts.length, out = [];
    const nrm = (a, b) => { const d = unit(sub(b, a)); return [-d[1], d[0]]; };
    for (let i = 0; i < n; i++) {
      const prev = closed ? pts[(i - 1 + n) % n] : pts[i - 1], next = closed ? pts[(i + 1) % n] : pts[i + 1], p = pts[i];
      const n1 = prev ? nrm(prev, p) : null, n2 = next ? nrm(p, next) : null;
      if (!n1 || !n2) { const k = n1 || n2; out.push([p[0] + k[0] * r, p[1] + k[1] * r]); continue; }
      const m = unit([n1[0] + n2[0], n1[1] + n2[1]]), cos = m[0] * n1[0] + m[1] * n1[1];
      if (cos > 0.5) out.push([p[0] + m[0] * r / cos, p[1] + m[1] * r / cos]);
      else {
        // esquina muy aguda: unión redondeada (arco corto de n1 a n2)
        const a1 = Math.atan2(n1[1], n1[0]); let da = Math.atan2(n2[1], n2[0]) - a1;
        while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        for (let k = 0; k <= 4; k++) { const a = a1 + da * k / 4; out.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]); }
      }
    }
    return out;
  }
  /* zona de influencia: polígono cerrado → contorno exterior; polilínea → «salchicha» con extremos redondos */
  function buffer(pts, r, closed) {
    pts = (pts || []).filter((p, i, a) => i === 0 || dist(p, a[i - 1]) > EPS);
    if (!pts.length) return [];
    r = +r || 0;
    if (pts.length === 1) return circle(pts[0], Math.abs(r), 12);
    if (closed && pts.length >= 3) {
      // área con signo > 0: el interior queda a la izquierda de la marcha → se desplaza a la derecha (r < 0 = hacia dentro)
      const s = area(pts) > 0 ? -1 : 1;
      return offsetChain(pts, s * r, true);
    }
    const L = offsetChain(pts, r, false), R = offsetChain(pts.slice().reverse(), r, false);
    const a = pts[0], b = pts[pts.length - 1];
    const dE = unit(sub(b, pts[pts.length - 2])), dS = unit(sub(pts[1], a));
    const angE = Math.atan2(dE[1], dE[0]), angS = Math.atan2(dS[1], dS[0]);
    // tapa final: de la izquierda (ang + π/2) a la derecha (ang − π/2) pasando por delante
    const capE = arcPts(b, r, angE + Math.PI / 2, angE - Math.PI / 2, 6).slice(1, -1);
    const capS = arcPts(a, r, angS - Math.PI / 2, angS - 3 * Math.PI / 2, 6).slice(1, -1);
    return L.concat(capE, R, capS);
  }

  /* ------------------------------ polilíneas ------------------------------ */
  function polyLen(pl) { let s = 0; for (let i = 1; i < (pl || []).length; i++) s += dist(pl[i - 1], pl[i]); return s; }
  /* punto a la fracción s ∈ [0,1] de la longitud */
  function pointAt(pl, s) {
    if (!pl || !pl.length) return null;
    if (pl.length === 1) return pl[0].slice();
    const L = polyLen(pl), target = clamp(s, 0, 1) * L;
    let acc = 0;
    for (let i = 1; i < pl.length; i++) {
      const d = dist(pl[i - 1], pl[i]);
      if (acc + d >= target - EPS) { const k = d > EPS ? (target - acc) / d : 0; return lerp(pl[i - 1], pl[i], k); }
      acc += d;
    }
    return pl[pl.length - 1].slice();
  }
  function closestOnSeg(p, a, b) {
    const d = sub(b, a), l2 = d[0] * d[0] + d[1] * d[1];
    const k = l2 > EPS ? clamp(((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / l2, 0, 1) : 0;
    return { k, pt: [a[0] + d[0] * k, a[1] + d[1] * k] };
  }
  /* proyección sobre la polilínea: s = fracción de longitud, d = distancia, pt = punto, i = tramo */
  function project(pl, pt) {
    if (!pl || !pl.length) return null;
    if (pl.length === 1) return { s: 0, d: dist(pl[0], pt), pt: pl[0].slice(), i: 0 };
    const L = polyLen(pl);
    let best = null, acc = 0;
    for (let i = 1; i < pl.length; i++) {
      const sl = dist(pl[i - 1], pl[i]), c = closestOnSeg(pt, pl[i - 1], pl[i]), d = dist(c.pt, pt);
      if (!best || d < best.d - EPS) best = { s: L > EPS ? (acc + c.k * sl) / L : 0, d, pt: c.pt, i: i - 1 };
      acc += sl;
    }
    return best;
  }
  /* elemento más cercano: [u,v] | {u,v} | {at:[u,v]} | {pts} (centroide); null si supera maxD */
  function ptOf(x) {
    if (!x) return null;
    if (Array.isArray(x)) return x.length >= 2 && typeof x[0] === 'number' ? x : null;
    if (typeof x.u === 'number' && typeof x.v === 'number') return [x.u, x.v];
    if (Array.isArray(x.at)) return x.at;
    if (Array.isArray(x.pts) && x.pts.length) return centroid(x.pts);
    return null;
  }
  function nearest(pt, list, maxD) {
    let best = null;
    (list || []).forEach((it, i) => { const q = ptOf(it); if (!q) return; const d = dist(pt, q); if (!best || d < best.d) best = { item: it, i, d, pt: q }; });
    if (best && maxD != null && best.d > maxD) return null;
    return best;
  }

  /* ------------------------------ intersecciones ------------------------------ */
  function segInt(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c), den = r[0] * s[1] - r[1] * s[0];
    const qp = sub(c, a);
    if (Math.abs(den) < EPS) {
      // colineales: se solapan si alguna proyección cae dentro
      if (Math.abs(qp[0] * r[1] - qp[1] * r[0]) > EPS) return null;
      const on = (p, x, y) => Math.min(x[0], y[0]) - EPS <= p[0] && p[0] <= Math.max(x[0], y[0]) + EPS && Math.min(x[1], y[1]) - EPS <= p[1] && p[1] <= Math.max(x[1], y[1]) + EPS;
      if (on(c, a, b)) return c.slice(); if (on(d, a, b)) return d.slice(); if (on(a, c, d)) return a.slice();
      return null;
    }
    const t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den;
    if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
    return [a[0] + t * r[0], a[1] + t * r[1]];
  }
  const edges = poly => (poly || []).map((p, i) => [p, poly[(i + 1) % poly.length]]);
  function segHitsPoly(a, b, poly) {
    if (!poly || poly.length < 3) return false;
    if (pip(a, poly) || pip(b, poly)) return true;
    return edges(poly).some(e => !!segInt(a, b, e[0], e[1]));
  }
  function polysTouch(a, b) {
    if (!a || !b || !a.length || !b.length) return false;
    if (b.length >= 3 && pip(a[0], b)) return true;
    if (a.length >= 3 && pip(b[0], a)) return true;
    const ea = edges(a), eb = edges(b);
    return ea.some(x => eb.some(y => !!segInt(x[0], x[1], y[0], y[1])));
  }
  function distToPoly(pt, poly) {
    if (!poly || !poly.length) return Infinity;
    if (poly.length >= 3 && pip(pt, poly)) return 0;
    if (poly.length === 1) return dist(pt, poly[0]);
    return Math.min.apply(null, edges(poly).map(e => dist(pt, closestOnSeg(pt, e[0], e[1]).pt)));
  }

  /* ------------------------------ trazos sembrados ------------------------------ */
  /* línea sinuosa de a a b: n tramos, desplazamiento perpendicular ±amp con extremos fijos */
  function wavy(a, b, seed, amp, n) {
    n = Math.max(1, n || 12); amp = amp == null ? 0.008 : amp;
    const R = rng(seed), d = sub(b, a), L = Math.hypot(d[0], d[1]) || 1, nx = -d[1] / L, ny = d[0] / L;
    const out = [a.slice()];
    let prev = 0;
    for (let i = 1; i < n; i++) {
      const k = i / n, env = Math.sin(Math.PI * k), o = (prev * 0.45 + (R() * 2 - 1) * 0.55) * amp * (0.35 + 0.65 * env);
      prev = o / (amp || 1);
      out.push([a[0] + d[0] * k + nx * o, a[1] + d[1] * k + ny * o]);
    }
    out.push(b.slice());
    return out;
  }
  /* mancha cerrada irregular: n vértices, radio con ruido ±jit (por defecto 18 %) */
  function blob(center, rx, ry, seed, n, jit) {
    n = Math.max(3, n || 10); jit = jit == null ? 0.18 : jit; ry = ry == null ? rx : ry;
    const R = rng(seed), ph = R() * Math.PI * 2, out = [];
    for (let i = 0; i < n; i++) {
      const a = ph + 2 * Math.PI * i / n, k = 1 + (R() * 2 - 1) * jit;
      out.push([center[0] + Math.cos(a) * rx * k, center[1] + Math.sin(a) * ry * k]);
    }
    return out;
  }

  /* ------------------------------ SVG ------------------------------ */
  /* cadena 'd': smooth = Catmull-Rom → cúbicas. o = { sx, sy, prec } escala a unidades SVG
     (p. ej. { sx: 1000, sy: 1000 / aspect }); prec por defecto 1 decimal si sx ≥ 100, si no 4. */
  function pathD(pts, closed, smoothIt, o) {
    pts = pts || []; o = o || {};
    if (!pts.length) return '';
    const sx = o.sx || 1, sy = o.sy || sx, pr = o.prec != null ? o.prec : (sx >= 100 ? 1 : 4);
    const f = v => { const r = round(v, pr); return String(Object.is(r, -0) ? 0 : r); };
    const P = pts.map(p => [p[0] * sx, p[1] * sy]), n = P.length, xy = p => f(p[0]) + ' ' + f(p[1]);
    if (!smoothIt || n < 3) return 'M' + P.map(xy).join('L') + (closed ? 'Z' : '');
    const at = i => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
    let d = 'M' + xy(P[0]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + xy(c1) + ' ' + xy(c2) + ' ' + xy(p2);
    }
    return d + (closed ? 'Z' : '');
  }

  /* referencia de cuadrícula: columnas A–J, filas 1–7 */
  function gridRef(u, v, cols, rows) {
    cols = cols || 10; rows = rows || 7;
    const c = Math.max(0, Math.min(cols - 1, Math.floor(u * cols))), r = Math.max(0, Math.min(rows - 1, Math.floor(v * rows)));
    return String.fromCharCode(65 + c) + (r + 1);
  }

  global.WGGeo = { hash, rng, lerp, clamp, smooth, dist, round, bbox, area, centroid, pip, hull, rect, buffer, circle,
    polyLen, pointAt, project, nearest, segInt, segHitsPoly, polysTouch, distToPoly, wavy, blob, pathD, gridRef };
})(typeof window !== 'undefined' ? window : globalThis);
