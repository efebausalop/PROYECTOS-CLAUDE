/* ==========================================================================
   Tiempo operacional — v0.4 «MESA» (módulo puro, sin DOM)
   --------------------------------------------------------------------------
   1. parse(): las cadenas canónicas de tiempo («D-1 → H (≈45 min)», «H+12 →
      H+24», «≈ H+48», «NLT H+10», «D+5 →») → ventana numérica en horas
      reales relativas a H (H = 0). Las cadenas nunca se reescriben salvo
      con fmtSpan() (que conserva el estilo D y el sufijo de sesión).
   2. tokens(): menciones de tiempo dentro de texto libre (celdas de la
      matriz, reacciones, planes).
   3. scale(): escala de la regla de tiempo (lineal, adaptativa √, por fases).
   4. steps() / stepWindow() / stepAt(): pasos secuenciales dentro de un
      turno (convención de lectura, §4.4).
   5. sessionBudget(): minutos de sesión de juego por método.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------ utilidades ------------------------------ */
  const EPS = 1e-9;
  const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
  const num = s => parseFloat(String(s).replace(',', '.'));
  const isWord = ch => !!ch && /[A-Za-z0-9À-ÿ]/.test(ch);
  const optsOf = o => ({ dayEnd: o && o.dayEnd === 'boundary' ? 'boundary' : 'inclusive', hHour: o && isFinite(+o.hHour) ? +o.hHour : 0, free: !!(o && o.free) });
  const dayStart = (n, hHour) => 24 * n - (+hHour || 0);
  const dayEnd = (n, hHour) => dayStart(n, hHour) + 24;
  const win2 = w => (Array.isArray(w) ? [+w[0], +w[1]] : w ? [+w.t0, +w.t1] : [NaN, NaN]);

  /* Presupuesto de sesión «(≈45 min)»: tiempo de juego, nunca tiempo operacional. */
  const RX_SESSION = /\(\s*[≈~]?\s*(\d+(?:[.,]\d+)?)\s*(min|h)\s*\)/i;
  /* Fichas de tiempo. Las letras D/H distinguen mayúsculas; los límites de
     palabra se comprueban en código (sin look-behind). */
  const RX_TOKEN = /(≈\s*|~\s*|aprox\.?\s*|NLT\s*|NET\s*)?([DH])(?:\s*([+\-−–])\s*(\d+(?:[.,]\d+)?)(?::(\d{2}))?(?:\s*(h|min|d)(?![A-Za-zÀ-ÿ]))?)?/g;
  const RX_ARROW_END = /(→|->|=>)\s*$/;
  const RX_APPROX = /≈|~|aprox/i;

  function session(raw) {
    const m = RX_SESSION.exec(raw);
    if (!m) return { min: null, raw: '', idx: -1, len: 0 };
    const v = num(m[1]);
    return { min: /^h$/i.test(m[2]) ? v * 60 : v, raw: m[0], idx: m.index, len: m[0].length };
  }

  /* Recorre el texto y devuelve las fichas válidas con su valor. */
  function scan(text, o) {
    const out = [];
    RX_TOKEN.lastIndex = 0;
    let m;
    while ((m = RX_TOKEN.exec(text))) {
      if (!m[0]) { RX_TOKEN.lastIndex++; continue; }
      const pre = m[1] || '', letter = m[2], signed = m[3] != null;
      const li = m.index + pre.length;
      const before = text.charAt(pre ? m.index - 1 : li - 1);
      if (isWord(before)) continue;
      if (!signed && isWord(text.charAt(li + 1))) continue;
      const kind = /^NLT/.test(pre) ? 'nlt' : /^NET/.test(pre) ? 'net' : pre ? 'approx' : 'point';
      if (o.free && !signed && kind === 'point') continue;
      const sg = signed && m[3] !== '+' ? -1 : 1;
      let v = signed ? num(m[4]) : 0;
      if (letter === 'D') {
        out.push({ day: true, n: sg * v, v: sg * v, kind, idx: m.index, len: m[0].length, raw: m[0] });
      } else {
        if (m[5]) v += (+m[5]) / 60;
        if (m[6] === 'min') v = v / 60; else if (m[6] === 'd') v = v * 24;
        out.push({ day: false, n: null, v: sg * v, kind, idx: m.index, len: m[0].length, raw: m[0] });
      }
    }
    return out;
  }

  /* ------------------------------ análisis ------------------------------ */
  function parse(str, opts) {
    const o = optsOf(opts), raw = str == null ? '' : String(str);
    const ss = session(raw);
    // se borra el sufijo de sesión conservando las posiciones del texto
    const s = ss.idx >= 0 ? raw.slice(0, ss.idx) + ' '.repeat(ss.len) + raw.slice(ss.idx + ss.len) : raw;
    const toks = scan(s, o);
    const res = { ok: false, t0: null, t1: null, point: false, approx: false, day: false, open: false, nlt: false, net: false,
      session: ss.min, sessRaw: ss.raw, style: 'H', raw, warn: [], n: toks.length };
    if (!toks.length) return res;
    const hh = o.hHour, incl = o.dayEnd === 'inclusive';
    const a = toks[0], b = toks[toks.length - 1];
    res.ok = true; res.approx = RX_APPROX.test(s); res.style = a.day ? 'D' : 'H';
    const startOf = k => (k.day ? dayStart(k.n, hh) : k.v);
    if (toks.length >= 2) {
      let t0 = startOf(a), t1 = b.day ? (incl ? dayEnd(b.n, hh) : dayStart(b.n, hh)) : b.v;
      if (t1 < t0) { const x = t0; t0 = t1; t1 = x; res.warn.push('inv'); }
      if (near(t0, t1, EPS)) { res.point = true; res.at = t0; t1 = t0 + 0.5; t0 = t0 - 0.5; }
      res.t0 = t0; res.t1 = t1;
      return res;
    }
    if (RX_ARROW_END.test(s)) { const t0 = startOf(a); res.t0 = t0; res.t1 = t0 + 24; res.open = true; res.day = a.day; return res; }
    if (a.day) { res.t0 = dayStart(a.n, hh); res.t1 = dayEnd(a.n, hh); res.day = true; return res; }
    const v = a.v; res.at = v;
    if (a.kind === 'nlt') { res.t0 = v - 1; res.t1 = v; res.nlt = true; }
    else if (a.kind === 'net') { res.t0 = v; res.t1 = v + 1; res.net = true; }
    else if (res.approx) { res.t0 = v - 2; res.t1 = v + 2; }
    else { res.t0 = v - 0.5; res.t1 = v + 0.5; res.point = true; }
    return res;
  }

  /* Fichas en texto libre: [{ t, kind, day, idx, len, raw }] (t en horas; día → su inicio). */
  function tokens(text, opts) {
    const o = optsOf(Object.assign({ free: true }, opts || {}));
    if (opts && opts.free === false) o.free = false;
    return scan(text == null ? '' : String(text), o).map(k => ({
      t: k.day ? dayStart(k.n, o.hHour) : k.v, kind: k.kind, day: k.day, idx: k.idx, len: k.len, raw: k.raw }));
  }

  /* ------------------------------ formato ------------------------------ */
  function fmtDay(n) { n = Math.round(n); return n === 0 ? 'D' : 'D' + (n > 0 ? '+' : '-') + Math.abs(n); }
  const isDayBound = (h, hh) => near(((h + hh) / 24) - Math.round((h + hh) / 24), 0, 1e-7);

  /* 0 → 'H'; 12 → 'H+12'; -2 → 'H-2'; 7.5 → 'H+7:30'; estilo 'D' en límites de día → 'D+1'.
     opts.pad → horas con dos cifras ('H+08', 'H+04:48') para lecturas del cursor. */
  function fmt(h, opts) {
    if (h == null || !isFinite(+h)) return '';
    h = +h;
    const o = opts || {}, hh = isFinite(+o.hHour) ? +o.hHour : 0;
    if (o.style === 'D' && isDayBound(h, hh)) return fmtDay((h + hh) / 24);
    const m = Math.round(h * 60);
    if (m === 0) return 'H';
    const a = Math.abs(m), hr = Math.floor(a / 60), mm = a % 60;
    return 'H' + (m < 0 ? '-' : '+') + (o.pad && hr < 10 ? '0' : '') + hr + (mm ? ':' + (mm < 10 ? '0' : '') + mm : '');
  }

  /* 'H+12 → H+24'; conserva el estilo D de cada extremo original cuando el
     nuevo valor cae en un límite de día, el sufijo «(≈45 min)» y el «≈ ». */
  function fmtSpan(t0, t1, orig, opts) {
    if (t0 == null || t1 == null || !isFinite(+t0) || !isFinite(+t1)) return '';
    t0 = +t0; t1 = +t1; if (t1 < t0) { const x = t0; t0 = t1; t1 = x; }
    const o = optsOf(opts), hh = o.hHour, incl = o.dayEnd === 'inclusive';
    const P = orig ? parse(orig, o) : null;
    const toks = P && P.ok ? scan(P.raw.replace(RX_SESSION, m => ' '.repeat(m.length)), o) : [];
    const sess = P && P.sessRaw ? ' ' + P.sessRaw : '';
    const forceD = opts && opts.style === 'D';
    const a = toks[0], b = toks[toks.length - 1], d = t1 - t0;
    if (toks.length === 1) {
      if (P.nlt && near(d, 1)) return 'NLT ' + fmt(t1) + sess;
      if (P.net && near(d, 1)) return 'NET ' + fmt(t0) + sess;
      if (P.open && near(d, 24)) return (a.day && isDayBound(t0, hh) ? fmtDay((t0 + hh) / 24) : fmt(t0)) + ' →' + sess;
      if (P.day && near(d, 24) && isDayBound(t0, hh)) return fmtDay((t0 + hh) / 24) + sess;
      if (P.approx && !P.day && near(d, 4)) return '≈ ' + fmt((t0 + t1) / 2) + sess;
      if (P.point && near(d, 1)) return fmt((t0 + t1) / 2) + sess;
    }
    const sD = (a ? a.day : forceD) && isDayBound(t0, hh);
    const eD = (b ? b.day : forceD) && isDayBound(t1, hh);
    const start = sD ? fmtDay((t0 + hh) / 24) : fmt(t0);
    const end = eD ? fmtDay((t1 + hh) / 24 - (incl ? 1 : 0)) : fmt(t1);
    // un extremo D inclusivo que no avanza (D+1 → D+1) se escribe como día único
    if (sD && eD && start === end && incl) return start + sess;
    return (P && P.approx ? '≈ ' : '') + start + ' → ' + end + sess;
  }

  /* ------------------------------ intervalos ------------------------------ */
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
  function iou(a0, a1, b0, b1) {
    const u = Math.max(a1, b1) - Math.min(a0, b0);
    if (!(u > EPS)) return near(a0, b0) && near(a1, b1) ? 1 : 0;
    return overlap(a0, a1, b0, b1) / u;
  }

  /* ------------------------------ escala de la regla ------------------------------ */
  /* range {t0,t1} | [t0,t1]; mode 'auto'|'linear'|'adaptive'|'phase'; breaks [t];
     opts { hHour, phases: [{t0,t1}|[t0,t1]], gap (.04) }. */
  function scale(range, mode, breaks, opts) {
    const o = opts || {}, hh = isFinite(+o.hHour) ? +o.hHour : 0;
    let [r0, r1] = win2(range);
    if (!isFinite(r0)) r0 = 0;
    if (!isFinite(r1) || !(r1 > r0)) r1 = r0 + 24;
    const req = mode || 'auto';
    const pts = [r0, r1].concat((breaks || []).map(Number).filter(b => isFinite(b) && b > r0 + EPS && b < r1 - EPS))
      .sort((x, y) => x - y).filter((x, i, a) => i === 0 || x - a[i - 1] > EPS);
    const d = []; for (let i = 1; i < pts.length; i++) d.push(pts[i] - pts[i - 1]);
    let m = req;
    if (m === 'auto') m = d.length > 1 && Math.max.apply(null, d) / Math.min.apply(null, d) > 6 ? 'adaptive' : 'linear';
    let segs = [];
    if (m === 'adaptive') {
      const w = d.map(Math.sqrt), sw = w.reduce((x, y) => x + y, 0) || 1;
      let x = 0; d.forEach((_, i) => { const x1 = x + w[i] / sw; segs.push({ t0: pts[i], t1: pts[i + 1], x0: x, x1, kind: 'int' }); x = x1; });
    } else if (m === 'phase') {
      const ph = (o.phases && o.phases.length ? o.phases.map(win2) : d.map((_, i) => [pts[i], pts[i + 1]]))
        .filter(p => isFinite(p[0]) && isFinite(p[1]) && p[1] > p[0]).sort((x, y) => x[0] - y[0]);
      const raw = []; let cur = r0;
      ph.forEach(p => {
        const s = Math.max(p[0], cur), e = Math.min(p[1], r1);
        if (e <= s + EPS) return;
        if (s > cur + EPS) raw.push({ t0: cur, t1: s, kind: 'gap' });
        raw.push({ t0: s, t1: e, kind: 'phase' }); cur = e;
      });
      if (cur < r1 - EPS) raw.push({ t0: cur, t1: r1, kind: 'gap' });
      const nP = raw.filter(z => z.kind === 'phase').length, nG = raw.length - nP;
      if (!nP) m = 'linear';
      else {
        const gw = nG ? Math.min(o.gap != null ? +o.gap : 0.04, 0.4 / nG) : 0, pw = (1 - gw * nG) / nP;
        let x = 0; raw.forEach(z => { const x1 = x + (z.kind === 'phase' ? pw : gw); segs.push(Object.assign(z, { x0: x, x1 })); x = x1; });
      }
    }
    if (!segs.length) { m = 'linear'; segs = [{ t0: r0, t1: r1, x0: 0, x1: 1, kind: 'int' }]; }
    const last = segs[segs.length - 1];
    last.x1 = 1;
    const segT = t => { if (t <= segs[0].t0) return segs[0]; for (let i = 0; i < segs.length; i++) if (t <= segs[i].t1) return segs[i]; return last; };
    const segX = x => { if (x <= segs[0].x0) return segs[0]; for (let i = 0; i < segs.length; i++) if (x <= segs[i].x1) return segs[i]; return last; };
    const x = t => { const g = segT(t); return g.x0 + (t - g.t0) * (g.x1 - g.x0) / ((g.t1 - g.t0) || 1); };
    const tOf = xx => { const g = segX(xx); return g.t0 + (xx - g.x0) * (g.t1 - g.t0) / ((g.x1 - g.x0) || 1); };
    /* marcas: mayores en H y en cada inicio de día (D-1, D, D+1…); menores cada 1, 3, 6 o 12 h,
       el primer paso que deja ≥ minPx (48) px entre etiquetas en cada tramo de la escala */
    function ticks(pxPerH, minPx) {
      const W = (pxPerH > 0 ? +pxPerH : 1000 / (r1 - r0)) * (r1 - r0), gap = minPx > 0 ? +minPx : 48;
      const key = t => Math.round(t * 600), seen = new Set(), maj = [], cand = [];
      const add = (list, tk) => { const k = key(tk.t); if (seen.has(k)) return; seen.add(k); tk.x = x(tk.t); list.push(tk); };
      if (0 >= r0 - EPS && 0 <= r1 + EPS) add(maj, { t: 0, label: 'H', major: true, day: isDayBound(0, hh) ? fmtDay(hh / 24) : '' });
      for (let n = Math.ceil((r0 + hh) / 24 - EPS); dayStart(n, hh) <= r1 + EPS; n++) add(maj, { t: dayStart(n, hh), label: fmtDay(n), major: true, day: fmtDay(n) });
      segs.forEach(g => {
        const lp = (g.x1 - g.x0) * W / ((g.t1 - g.t0) || 1), st = [1, 3, 6, 12].find(z => z * lp >= gap - EPS);
        if (!st) return;
        for (let k = Math.ceil(g.t0 / st - EPS); k * st <= g.t1 + EPS; k++) add(cand, { t: k * st, label: fmt(k * st), major: false });
      });
      maj.sort((p, q) => p.t - q.t); cand.sort((p, q) => p.t - q.t);
      const out = maj.slice(), kept = maj.map(k => k.x * W);
      cand.forEach(tk => { const px = tk.x * W; if (kept.every(z => Math.abs(z - px) >= gap - 1e-6)) { kept.push(px); out.push(tk); } });
      return out.sort((p, q) => p.t - q.t);
    }
    return { mode: m, req, range: [r0, r1], segs: segs.map(g => ({ t0: g.t0, t1: g.t1, x0: g.x0, x1: g.x1, kind: g.kind })), x, t: tOf, ticks };
  }

  /* ------------------------------ pasos del turno ------------------------------ */
  const STEP_LABEL = { pre: 'Pre-acción roja', act: 'Acción azul', rea: 'Reacción roja', cnt: 'Contrarreacción azul', arb: 'Árbitro' };
  const DEF_FRAC = {
    red: { pre: [0, 0.10], act: [0.10, 0.40], rea: [0.40, 0.70], cnt: [0.70, 0.95], arb: [0.95, 1] },
    blue: { act: [0, 0.35], rea: [0.35, 0.65], cnt: [0.65, 0.95], arb: [0.95, 1] }
  };
  const okFr = f => Array.isArray(f) && f.length === 2 && isFinite(+f[0]) && isFinite(+f[1]) && +f[0] >= 0 && +f[1] <= 1 && +f[1] > +f[0];
  /* initiative 'red'|'blue' (o 'R'|'B'); frac = turn.stepFrac › op.time.stepFrac › null (por defecto). */
  function steps(initiative, frac) {
    const side = /^(b|blue|azul)/i.test(String(initiative || '')) ? 'blue' : 'red';
    const def = DEF_FRAC[side], ids = Object.keys(def);
    const use = frac && typeof frac === 'object' && ids.every(id => okFr(frac[id])) ? frac : null;
    return ids.map((id, i) => {
      let f = use ? use[id].map(Number) : def[id].slice();
      // iniciativa azul con fracciones de iniciativa roja: la pre-acción se integra en la acción azul
      if (use && side === 'blue' && i === 0 && okFr(use.pre)) f = [+use.pre[0], f[1]];
      return { id, label: STEP_LABEL[id], f0: f[0], f1: f[1] };
    });
  }
  function stepWindow(win, st, id) {
    const [t0, t1] = win2(win), s = (st || []).find(z => z.id === id);
    if (!s || !isFinite(t0) || !isFinite(t1)) return null;
    const d = t1 - t0;
    return [t0 + s.f0 * d, t0 + s.f1 * d];
  }
  function stepAt(win, st, tau) {
    const [t0, t1] = win2(win);
    if (!st || !st.length || !isFinite(t0) || !isFinite(t1) || tau == null || !isFinite(+tau)) return null;
    if (tau < t0 - EPS || tau > t1 + EPS) return null;
    const d = t1 - t0, f = d > EPS ? (tau - t0) / d : 1;
    if (f >= 1 - 1e-12) { const arb = st.find(z => z.id === 'arb'); return (arb || st[st.length - 1]).id; }
    const hit = st.find(z => z.f0 <= f + 1e-12 && f < z.f1 - 1e-12);
    if (hit) return hit.id;
    const prev = st.filter(z => z.f0 <= f).pop();
    return (prev || st[0]).id;
  }
  /* StepSpan con t0/t1 para una ventana. */
  function spans(win, st) { return (st || []).map(s => { const w = stepWindow(win, [s], s.id); return Object.assign({}, s, { t0: w[0], t1: w[1] }); }); }

  /* ------------------------------ presupuesto de sesión ------------------------------ */
  /* 'Phase I 45 min · Belts 60 min · Avenue 60 min (≈3 h serial)' → { total: 180, byMethod: { critical: 45, belt: 60, box: 0, avenue: 60 } }
     El total declarado entre paréntesis («≈3 h serial») prevalece sobre la suma de las partes (165). */
  const M_RX = [
    ['critical', /key\s*events?|eventos?\s*cr[ií]tic|critical|cr[ií]tic/i],
    ['belt', /belts?|fajas?|cintur/i],
    ['box', /\bbox(es)?\b|cajas?/i],
    ['avenue', /avenues?|avenidas?|segments?|segmentos?/i],
    ['critical', /\b(phase|fase)\b/i]       // una fase sin método explícito se juega por eventos críticos
  ];
  function sessionBudget(text) {
    const byMethod = { critical: 0, belt: 0, box: 0, avenue: 0 }, items = [];
    let sum = 0, paren = 0;
    String(text || '').split(/[·;\n|]+/).forEach(seg => {
      const pm = seg.match(/\(([^)]*)\)/g) || [];
      pm.forEach(p => { const z = p.match(/(\d+(?:[.,]\d+)?)\s*(min|h)\b/i); if (z) paren = num(z[1]) * (/^h$/i.test(z[2]) ? 60 : 1); });
      const s = seg.replace(/\([^)]*\)/g, ' ');
      const z = s.match(/(\d+(?:[.,]\d+)?)\s*(min|h)\b/i);
      if (!z) return;
      const min = num(z[1]) * (/^h$/i.test(z[2]) ? 60 : 1), hit = M_RX.find(r => r[1].test(s)), m = hit ? hit[0] : '';
      if (m) byMethod[m] += min;
      sum += min; items.push({ label: s.replace(z[0], '').trim(), min, m });
    });
    return { total: paren || sum, sum, byMethod, items };
  }

  global.WGTime = { parse, tokens, fmt, fmtSpan, fmtDay, overlap, iou, scale, steps, stepWindow, stepAt, spans, sessionBudget,
    dayStart, dayEnd, STEP_LABEL, DEF_FRAC };

  if (global.WGI18N) Object.assign(global.WGI18N.en, {
    'Pre-acción roja': global.WGI18N.en['Pre-acción roja'] || 'Red pre-action',
    'Acción azul': global.WGI18N.en['Acción azul'] || 'Blue action',
    'Reacción roja': global.WGI18N.en['Reacción roja'] || 'Red reaction',
    'Contrarreacción azul': global.WGI18N.en['Contrarreacción azul'] || 'Blue counter-action',
    'Árbitro': global.WGI18N.en['Árbitro'] || 'Arbiter'
  });
})(typeof window !== 'undefined' ? window : globalThis);
