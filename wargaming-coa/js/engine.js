/* ==========================================================================
   Motor de adjudicación — COA Wargaming (Paso 4 · APP-28(B) Anexo D)
   --------------------------------------------------------------------------
   Método:
   1. Potencia de combate en Equivalentes de Fuerza (FE), al estilo de la
      Force Ratio Calculator Matrix (CGSC ST 100-3): FE × fuerza actual × % empeñado.
   2. Comparación en el punto de contacto (sector a sector, nunca brigada contra
      división), corregida por modificadores de combate.
   3. Lectura frente a los ratios mínimos históricos de planeamiento (FM 5-0 / FM 6-0).
   4. Bajas interpoladas (escala logarítmica) en las tablas BCTP del ejemplo TRYZUB.
      Romper el contacto a tiempo ≈ mitad de bajas (regla del árbitro).
   5. Incertidumbre: simulación Monte Carlo con ruido log-normal sobre el ratio
      y sobre las bajas, con semilla fija (resultados reproducibles).
   ========================================================================== */
(function (global) {
  'use strict';

  const OUTCOMES = [
    { id: 'DEC', label: 'Éxito decisivo', short: 'Decisivo' },
    { id: 'EXI', label: 'Éxito', short: 'Éxito' },
    { id: 'PAR', label: 'Éxito parcial', short: 'Parcial' },
    { id: 'FRA', label: 'Fracaso', short: 'Fracaso' }
  ];
  const NOCONTACT = { id: 'SC', label: 'Sin contacto', short: 'Sin contacto' };

  /* Configuración por defecto: todos los valores son editables en la pestaña Datos. */
  const DEFAULT_CONFIG = {
    tasks: {
      delay:     { label: 'Retardar',                    req: 1 / 6,  table: 'def',   brk: true  },
      screen:    { label: 'Cubrir / vigilar',            req: 1 / 6,  table: 'def',   brk: true  },
      hastyDef:  { label: 'Defensa precipitada / fijar', req: 1 / 2.5, table: 'def',  brk: false },
      delibDef:  { label: 'Defensa preparada / bloquear',req: 1 / 3,  table: 'def',   brk: false },
      catk:      { label: 'Contraataque (flanco)',       req: 1,      table: 'hasty', brk: false },
      hastyAtk:  { label: 'Ataque precipitado',          req: 2.5,    table: 'hasty', brk: false },
      delibAtk:  { label: 'Ataque deliberado',           req: 3,      table: 'atk',   brk: false },
      amphAslt:  { label: 'Asalto anfibio',              req: 3,      table: 'atk',   brk: false }
    },
    /* Tablas BCTP (Force Ratio Calculator) — ratio Azul:Rojo → % bajas Azul / Rojo */
    lossTables: {
      def:   { label: 'Defensa deliberada vs ataque deliberado', x: [0.25, 1 / 3, 0.5, 1, 2], f: [60, 30, 20, 15, 10], e: [10, 15, 20, 40, 65] },
      hasty: { label: 'Ataque precipitado vs defensa precipitada (contraataque)', x: [0.25, 1 / 3, 0.5, 1, 2], f: [60, 40, 30, 15, 15], e: [10, 10, 15, 15, 30] }
    },
    mods: {
      terrain:  { label: 'Terreno (para Azul)', opts: [['Desfavorable', 0.8], ['Neutral', 1], ['Favorable', 1.2], ['Muy favorable', 1.4]], def: 1 },
      obst:     { label: 'Obstáculos / preparación', opts: [['Ninguno', 1], ['Sumarios', 1.1], ['Cinturón completo', 1.25]], def: 0 },
      fires:    { label: 'Fuegos / apoyo aéreo-naval', opts: [['Inferior', 0.85], ['Paridad', 1], ['Superior', 1.15], ['Muy superior', 1.3]], def: 1 },
      surprise: { label: 'Sorpresa', opts: [['Sorpresa roja', 0.7], ['Ninguna', 1], ['Sorpresa azul', 1.3]], def: 1 },
      morale:   { label: 'Moral / logística', opts: [['Degradada', 0.85], ['Normal', 1], ['Alta', 1.1]], def: 1 },
      isr:      { label: 'ISR / C2 / GE', opts: [['Ciego / perturbado', 0.9], ['Normal', 1], ['Superioridad', 1.1]], def: 1 }
    },
    thresholds: { dec: 1.5, exi: 1.0, par: 0.7 }, // margen = ratio efectivo / ratio requerido
    sim: { n: 2000, sigma: 0.30, sigmaLoss: 0.25, seed: 20251014 },
    brkFactor: 0.5,     // bajas al romper el contacto a tiempo
    hptWeight: 4,       // concentración de bajas rojas sobre el HPT designado
    statusBands: { green: 75, amber: 50 },
    score: { wSuccess: 0.5, wCP: 0.3, wFFIR: 0.2 }
  };

  /* --------------------------- utilidades numéricas ------------------------ */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function interpLog(xs, ys, x) {
    if (!(x > 0)) return ys[0];
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    const lx = Math.log(x);
    for (let i = 0; i < xs.length - 1; i++) {
      const a = Math.log(xs[i]), b = Math.log(xs[i + 1]);
      if (lx >= a && lx <= b) {
        const t = (lx - a) / (b - a);
        return ys[i] + t * (ys[i + 1] - ys[i]);
      }
    }
    return ys[ys.length - 1];
  }
  function quantile(sorted, q) {
    if (!sorted.length) return 0;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function fmtRatio(r) {
    if (!isFinite(r) || r <= 0) return '—';
    return r >= 1 ? (Math.round(r * 10) / 10) + ' : 1' : '1 : ' + (Math.round(10 / r) / 10);
  }

  /* --------------------------- modelo de enfrentamiento --------------------- */
  function unitMap(op) {
    const m = {};
    op.units.blue.forEach(u => { m[u.id] = Object.assign({ side: 'blue' }, u); });
    op.units.red.forEach(u => { m[u.id] = Object.assign({ side: 'red' }, u); });
    return m;
  }
  function initialStrengths(op) {
    const s = {};
    op.units.blue.concat(op.units.red).forEach(u => { s[u.id] = (u.str == null ? 100 : u.str) / 100; });
    return s;
  }

  /* Empareja los enfrentamientos de la COA azul con el despliegue de la COA roja
     para un evento. Devuelve [{eng, blue:[{u,pct}], red:[{u,pct}]}] y avisos. */
  function buildEngagements(op, blue, red, evId) {
    const bPlan = (blue.plan && blue.plan[evId]) || { engagements: [] };
    const rPlan = (red.plan && red.plan[evId]) || { placement: [] };
    const engs = (bPlan.engagements || []).map(e => ({ eng: e, blue: (e.units || []).filter(x => x.u), red: [] }));
    const warnings = [];
    const bySector = {};
    (rPlan.placement || []).forEach(p => { if (p.u) (bySector[p.sector] = bySector[p.sector] || []).push(p); });
    Object.keys(bySector).forEach(sec => {
      const inSec = engs.filter(x => x.eng.sector === sec);
      if (!inSec.length) {
        const names = bySector[sec].map(p => p.u);
        warnings.push({ sector: sec, units: names });
        return;
      }
      bySector[sec].forEach(p => {
        let target = inSec.find(x => (x.eng.vs || []).indexOf(p.u) >= 0);
        if (!target) target = inSec.find(x => !(x.eng.vs || []).length) || inSec[0];
        target.red.push({ u: p.u, pct: p.pct == null ? 100 : p.pct });
      });
    });
    return { engs, warnings };
  }

  function modFactor(cfg, mods) {
    let f = 1;
    const detail = {};
    Object.keys(cfg.mods).forEach(k => {
      const m = cfg.mods[k];
      const idx = mods && mods[k] != null ? mods[k] : m.def;
      const opt = m.opts[Math.max(0, Math.min(m.opts.length - 1, idx))];
      detail[k] = { idx, label: opt[0], v: opt[1] };
      f *= opt[1];
    });
    return { f, detail };
  }

  function lossesAt(cfg, task, r) {
    const t = cfg.tasks[task] || cfg.tasks.hastyDef;
    let lb, lr;
    if (t.table === 'atk') {
      // Azul ataca una defensa preparada: se lee la tabla de defensa desde el lado rojo.
      const tb = cfg.lossTables.def, inv = 1 / r;
      lb = interpLog(tb.x, tb.e, inv);
      lr = interpLog(tb.x, tb.f, inv);
    } else {
      const tb = cfg.lossTables[t.table] || cfg.lossTables.def;
      lb = interpLog(tb.x, tb.f, r);
      lr = interpLog(tb.x, tb.e, r);
    }
    return { lb, lr };
  }

  function outcomeOf(cfg, margin) {
    const th = cfg.thresholds;
    if (margin >= th.dec) return 'DEC';
    if (margin >= th.exi) return 'EXI';
    if (margin >= th.par) return 'PAR';
    return 'FRA';
  }

  /* Evalúa un enfrentamiento con las fuerzas actuales.
     noise = {z, zl} para Monte Carlo; sin noise → valor determinista (mediana). */
  function evalEngagement(cfg, umap, str, x, modsOverride, noise) {
    const e = x.eng;
    const task = cfg.tasks[e.task] ? e.task : 'hastyDef';
    const t = cfg.tasks[task];
    let feB = 0, feR = 0;
    x.blue.forEach(b => { const u = umap[b.u]; if (u) feB += (+u.fe || 0) * (str[b.u] || 0) * (b.pct == null ? 1 : b.pct / 100); });
    x.red.forEach(b => { const u = umap[b.u]; if (u) feR += (+u.fe || 0) * (str[b.u] || 0) * (b.pct == null ? 1 : b.pct / 100); });
    const mf = modFactor(cfg, Object.assign({}, e.mods || {}, modsOverride || {}));
    const res = { task, taskLabel: t.label, req: t.req, feB, feR, mod: mf.f, modDetail: mf.detail };
    if (feR <= 0 || feB <= 0) {
      Object.assign(res, { contact: false, r: feR <= 0 ? Infinity : 0, rEff: feR <= 0 ? Infinity : 0, margin: feR <= 0 ? Infinity : 0, outcome: feR <= 0 ? 'SC' : 'FRA', lb: 0, lr: 0 });
      if (feB <= 0 && feR > 0) { res.lb = 0; res.lr = 0; }
      return res;
    }
    const r = feB / feR;
    let rEff = r * mf.f;
    if (noise) rEff *= Math.exp(cfg.sim.sigma * noise.z);
    const margin = rEff / t.req;
    const L = lossesAt(cfg, task, rEff);
    const brk = e.brk == null ? t.brk : e.brk;
    let lb = L.lb * (brk ? cfg.brkFactor : 1), lr = L.lr;
    if (noise) {
      lb *= Math.exp(cfg.sim.sigmaLoss * noise.zl - cfg.sim.sigmaLoss * cfg.sim.sigmaLoss / 2);
      lr *= Math.exp(cfg.sim.sigmaLoss * noise.zl2 - cfg.sim.sigmaLoss * cfg.sim.sigmaLoss / 2);
    }
    lb = Math.min(95, Math.max(0, lb)); lr = Math.min(95, Math.max(0, lr));
    Object.assign(res, { contact: true, r, rEff, margin, outcome: outcomeOf(cfg, margin), lb, lr, brk });
    return res;
  }

  /* Aplica bajas (en %) a las unidades empeñadas. Rojo: reparto ponderado por FE
     con concentración sobre el HPT designado en la COA azul. */
  function applyLosses(cfg, umap, str, x, lb, lr) {
    const out = {};
    x.blue.forEach(b => {
      const pct = b.pct == null ? 1 : b.pct / 100;
      const before = str[b.u] || 0;
      const after = Math.max(0, before * (1 - (lb / 100) * pct));
      out[b.u] = (out[b.u] || 0) + (before - after);
      str[b.u] = after;
    });
    let feR = 0, wsum = 0;
    const ws = x.red.map(b => {
      const u = umap[b.u]; const pct = b.pct == null ? 1 : b.pct / 100;
      const fe = (+(u && u.fe) || 0) * (str[b.u] || 0) * pct;
      feR += fe;
      const w = fe * (x.eng.hpt && x.eng.hpt === b.u ? cfg.hptWeight : 1);
      wsum += w;
      return { b, fe, w };
    });
    const lost = feR * lr / 100;
    ws.forEach(o => {
      const u = umap[o.b.u]; if (!u || !(+u.fe) || wsum <= 0) return;
      const feLost = Math.min(o.fe, lost * o.w / wsum);
      const before = str[o.b.u] || 0;
      const after = Math.max(0, before - feLost / (+u.fe));
      out[o.b.u] = (out[o.b.u] || 0) + (before - after);
      str[o.b.u] = after;
    });
    return out;
  }

  /* ---------------------- recorrido completo de una confrontación ----------- */
  /* Camino determinista (con decisiones del árbitro si se pasan en session). */
  function runPath(op, blue, red, cfg, session) {
    const umap = unitMap(op);
    const str = initialStrengths(op);
    const steps = [{ label: 'Inicio', str: Object.assign({}, str) }];
    const turns = [];
    op.events.forEach((ev, i) => {
      const built = buildEngagements(op, blue, red, ev.id);
      const turnS = session && session.turns && session.turns[ev.id];
      const startStr = Object.assign({}, str);
      const results = built.engs.map(x => {
        const ovMods = turnS && turnS.mods && turnS.mods[x.eng.id];
        const r = evalEngagement(cfg, umap, str, x, ovMods);
        const ov = turnS && turnS.ovr && turnS.ovr[x.eng.id];
        const adj = { outcome: r.outcome, lb: r.lb, lr: r.lr, manual: false };
        if (ov) {
          if (ov.res) { adj.outcome = ov.res; adj.manual = true; }
          if (ov.bl !== '' && ov.bl != null && !isNaN(+ov.bl)) { adj.lb = +ov.bl; adj.manual = true; }
          if (ov.rl !== '' && ov.rl != null && !isNaN(+ov.rl)) { adj.lr = +ov.rl; adj.manual = true; }
        }
        return { x, calc: r, adj };
      });
      // Las bajas se aplican tras evaluar todos los enfrentamientos del turno (simultaneidad).
      results.forEach(o => { o.applied = applyLosses(cfg, umap, str, o.x, o.adj.lb, o.adj.lr); });
      turns.push({ ev, index: i, results, warnings: built.warnings, startStr, endStr: Object.assign({}, str) });
      steps.push({ label: 'T' + (i + 1), str: Object.assign({}, str) });
    });
    return { turns, steps, umap };
  }

  /* Monte Carlo de la secuencia completa. fromTurn/startStr permiten simular
     sólo un turno a partir del estado adjudicado. */
  function monteCarlo(op, blue, red, cfg, opts) {
    opts = opts || {};
    const n = opts.n || cfg.sim.n;
    const rng = mulberry32((cfg.sim.seed >>> 0) ^ hashStr(blue.id + '|' + red.id + '|' + (opts.tag || '')));
    const umap = unitMap(op);
    const events = opts.onlyEvent ? op.events.filter(e => e.id === opts.onlyEvent) : op.events;
    const built = events.map(ev => buildEngagements(op, blue, red, ev.id));
    const session = opts.session;
    const engStats = built.map(b => b.engs.map(() => ({ out: { DEC: 0, EXI: 0, PAR: 0, FRA: 0, SC: 0 }, lb: [], lr: [], r: [] })));
    const blueIds = op.units.blue.map(u => u.id), redIds = op.units.red.map(u => u.id);
    const endStr = {}; blueIds.concat(redIds).forEach(id => { endStr[id] = []; });
    const ffir = (op.ffir || 70) / 100;
    let success = 0, allDC = 0, ffirBreach = 0;
    const engagedBlue = new Set();
    built.forEach(b => b.engs.forEach(x => x.blue.forEach(u => engagedBlue.add(u.u))));
    const unitBreach = {}; blueIds.forEach(id => { unitBreach[id] = 0; });

    for (let k = 0; k < n; k++) {
      const str = opts.startStr ? Object.assign({}, opts.startStr) : initialStrengths(op);
      let ok = true, dc = true;
      built.forEach((b, ei) => {
        const ev = events[ei];
        const turnS = session && session.turns && session.turns[ev.id];
        const res = b.engs.map(x => {
          const ovMods = turnS && turnS.mods && turnS.mods[x.eng.id];
          return evalEngagement(cfg, umap, str, x, ovMods, { z: gauss(rng), zl: gauss(rng), zl2: gauss(rng) });
        });
        res.forEach((r, xi) => {
          const st = engStats[ei][xi];
          st.out[r.outcome] = (st.out[r.outcome] || 0) + 1;
          st.lb.push(r.lb); st.lr.push(r.lr); if (isFinite(r.rEff)) st.r.push(r.rEff);
          // Éxito de la COA: ningún fracaso y el esfuerzo principal al menos parcial.
          // Todas las DC: además, cada esfuerzo principal alcanza Éxito o Decisivo.
          if (r.outcome === 'FRA') { ok = false; dc = false; }
          if (b.engs[xi].eng.me && r.outcome === 'PAR') dc = false;
          applyLosses(cfg, umap, str, b.engs[xi], r.lb, r.lr);
        });
      });
      if (ok) success++;
      if (dc) allDC++;
      let breach = false;
      blueIds.forEach(id => {
        endStr[id].push(str[id]);
        if (engagedBlue.has(id) && str[id] < ffir) { breach = true; unitBreach[id]++; }
      });
      redIds.forEach(id => endStr[id].push(str[id]));
      if (breach) ffirBreach++;
    }
    const summ = arr => { const s = arr.slice().sort((a, b) => a - b); const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1); return { mean, p10: quantile(s, 0.1), p50: quantile(s, 0.5), p90: quantile(s, 0.9) }; };
    const engs = built.map((b, ei) => b.engs.map((x, xi) => {
      const st = engStats[ei][xi];
      const p = {}; Object.keys(st.out).forEach(k => { p[k] = st.out[k] / n; });
      return { evId: events[ei].id, engId: x.eng.id, p, lb: summ(st.lb), lr: summ(st.lr), r: summ(st.r) };
    }));
    const end = {}; Object.keys(endStr).forEach(id => { end[id] = summ(endStr[id]); });
    const pUnitBreach = {}; blueIds.forEach(id => { pUnitBreach[id] = unitBreach[id] / n; });
    const engagedList = blueIds.filter(id => engagedBlue.has(id));
    const meanBlueCP = engagedList.length ? engagedList.reduce((a, id) => a + end[id].mean, 0) / engagedList.length : 1;
    const redIdsEngaged = new Set(); built.forEach(b => b.engs.forEach(x => x.red.forEach(u => redIdsEngaged.add(u.u))));
    const redList = redIds.filter(id => redIdsEngaged.has(id));
    const meanRedCP = redList.length ? redList.reduce((a, id) => a + end[id].mean, 0) / redList.length : 1;
    const pSuccess = success / n, pDC = allDC / n, pFFIR = ffirBreach / n;
    const w = cfg.score;
    const score = 100 * (w.wSuccess * pSuccess + w.wCP * meanBlueCP + w.wFFIR * (1 - pFFIR)) / (w.wSuccess + w.wCP + w.wFFIR || 1);
    return { n, engs, end, pSuccess, pDC, pFFIR, pUnitBreach, meanBlueCP, meanRedCP, score, engagedBlue: engagedList };
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* Matriz COA × OCOA completa */
  function analyseAll(op, cfg) {
    const out = {};
    op.blueCOAs.forEach(b => {
      op.redCOAs.forEach(r => {
        out[b.id + '|' + r.id] = monteCarlo(op, b, r, cfg);
      });
    });
    return out;
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  global.WGEngine = {
    OUTCOMES, NOCONTACT, DEFAULT_CONFIG, fmtRatio, interpLog, lossesAt, outcomeOf,
    buildEngagements, evalEngagement, runPath, monteCarlo, analyseAll, unitMap,
    initialStrengths, modFactor, deepClone, mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
