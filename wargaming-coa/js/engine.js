/* ==========================================================================
   Motor de adjudicación empírica — v3
   --------------------------------------------------------------------------
   1. Potencia de combate de cada unidad del ORBAT en Equivalentes de Fuerza:
      FE(tipo, Force Ratio Calculator Matrix / CGSC ST 100-3) × cantidad ×
      potencia actual (% CP) × % empeñado en el enfrentamiento.
   2. Comparación en el punto de contacto (sector a sector), con modificadores
      situacionales (terreno, sorpresa, fuegos, moral, ISR/C2/GE).
   3. Lectura frente a los ratios mínimos históricos de planeamiento.
   4. Bajas por interpolación logarítmica en la tabla de daños BCTP, según la
      combinación misión propia / misión enemiga. Romper el contacto a tiempo
      reduce las bajas propias. Las bajas rojas se concentran en el HPT.
   5. Incertidumbre: Monte Carlo con ruido log-normal y semilla fija.
   ========================================================================== */
(function (global) {
  'use strict';
  const C = global.WGCat;

  const OUT = ['DECISIVE SUCCESS', 'SUCCESS', 'PARTIAL SUCCESS', 'NEUTRAL', 'FAILURE', 'DECISIVE FAILURE'];
  const NC = 'NO CONTACT';
  const RANK = { 'DECISIVE SUCCESS': 0, 'SUCCESS': 1, 'PARTIAL SUCCESS': 2, 'NEUTRAL': 3, 'FAILURE': 4, 'DECISIVE FAILURE': 5, 'NO CONTACT': -1 };

  const DEFAULT_CONFIG = {
    tasks: {
      delay:    { label: 'Retardar',                        plan: 'Delay',                         req: 1 / 6,   pair: 'Deliberate Defense vs Deliberate Attack', brk: true },
      screen:   { label: 'Cubrir / vigilar',                plan: 'Delay',                         req: 1 / 6,   pair: 'Deliberate Defense vs Deliberate Attack', brk: true },
      hastyDef: { label: 'Defensa precipitada / fijar',     plan: 'Defend (hasty)',                req: 1 / 2.5, pair: 'Deliberate Defense vs Deliberate Attack', brk: false },
      delibDef: { label: 'Defensa preparada / bloquear',    plan: 'Defend (prepared / fortified)', req: 1 / 3,   pair: 'Deliberate Defense vs Deliberate Attack', brk: false },
      catk:     { label: 'Contraataque (flanco)',           plan: 'Counterattack (flank)',         req: 1,       pair: 'Hasty Attack vs Hasty Defense',           brk: false },
      hastyAtk: { label: 'Ataque precipitado',              plan: 'Attack (hasty)',                req: 2.5,     pair: 'Hasty Attack vs Hasty Defense',           brk: false },
      delibAtk: { label: 'Ataque deliberado',               plan: 'Attack (prepared / fortified)', req: 3,       pair: 'Deliberate Attack vs Deliberate Defense', brk: false },
      amphAslt: { label: 'Asalto anfibio',                  plan: 'Attack (prepared / fortified)', req: 3,       pair: 'Deliberate Attack vs Deliberate Defense', brk: false },
      meeting:  { label: 'Combate de encuentro',            plan: 'Attack (hasty)',                req: 1,       pair: 'Meeting Engagement vs Meeting Engagement', brk: false },
      gapX:     { label: 'Paso de curso de agua (asalto)',  plan: 'Attack (prepared / fortified)', req: 3,       pair: 'Deliberate Attack vs Deliberate Defense', brk: false },
      airAslt:  { label: 'Asalto aéreo / helitransportado', plan: 'Attack (hasty)',                req: 2.5,     pair: 'Hasty Attack vs Hasty Defense',           brk: false },
      urbanAtk: { label: 'Ataque en zona urbana',           plan: 'Attack (prepared / fortified)', req: 4,       pair: 'Deliberate Attack vs Deliberate Defense', brk: false },
      withdraw: { label: 'Repliegue / ruptura del contacto', plan: 'Delay',                        req: 1 / 6,   pair: 'Deliberate Defense vs Deliberate Attack', brk: true }
    },
    mods: {
      terrain:  { label: 'Terreno (para Azul)',          opts: [['Desfavorable', 0.8], ['Neutral', 1], ['Favorable', 1.2], ['Muy favorable', 1.4]], def: 1 },
      obst:     { label: 'Obstáculos / preparación',     opts: [['Ninguno', 1], ['Sumarios', 1.1], ['Cinturón completo', 1.25]], def: 0 },
      fires:    { label: 'Fuegos / apoyo aéreo-naval',   opts: [['Inferior', 0.85], ['Paridad', 1], ['Superior', 1.15], ['Muy superior', 1.3]], def: 1 },
      surprise: { label: 'Sorpresa',                     opts: [['Sorpresa roja', 0.7], ['Ninguna', 1], ['Sorpresa azul', 1.3]], def: 1 },
      morale:   { label: 'Moral / logística',            opts: [['Degradada', 0.85], ['Normal', 1], ['Alta', 1.1]], def: 1 },
      isr:      { label: 'ISR / C2 / GE',                opts: [['Ciego / perturbado', 0.9], ['Normal', 1], ['Superioridad', 1.1]], def: 1 }
    },
    /* margen = ratio efectivo ÷ ratio mínimo de planeamiento */
    thresholds: { ds: 1.5, s: 1.0, ps: 0.8, n: 0.6, f: 0.4 },
    sim: { n: 2000, sigma: 0.30, sigmaLoss: 0.25, seed: 20251014 },
    brkFactor: 0.5,
    hptWeight: 4,
    statusBands: { green: 75, amber: 50 },
    score: { wSuccess: 0.5, wCP: 0.3, wFFIR: 0.2 }
  };

  /* ------------------------------ utilidades ------------------------------ */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function quantile(s, q) { if (!s.length) return 0; const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); }
  function summ(arr) { const s = arr.slice().sort((a, b) => a - b); const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1); return { mean, p10: quantile(s, 0.1), p50: quantile(s, 0.5), p90: quantile(s, 0.9) }; }
  function fmtR(r) {
    if (!isFinite(r) || r <= 0) return '—';
    return r >= 1 ? (Math.round(r * 100) / 100).toFixed(2) + ' : 1' : '1 : ' + (Math.round(100 / r) / 100).toFixed(2);
  }
  const pctOf = p => (p == null || p === '' ? 100 : +p) / 100;

  /* Interpolación logarítmica en la tabla BCTP (pares [bajas propias, bajas enemigas]). */
  function dmgAt(pairKey, r) {
    const arr = C.DMG[pairKey] || C.DMG['Deliberate Defense vs Deliberate Attack'];
    const bp = C.DMG_BP, n = bp.length;
    const f = i => +arr[i * 2], e = i => +arr[i * 2 + 1];
    if (!(r > bp[0])) return { fl: f(0) * 100, el: e(0) * 100 };
    if (r >= bp[n - 1]) return { fl: f(n - 1) * 100, el: e(n - 1) * 100 };
    const lr = Math.log(r);
    for (let i = 0; i < n - 1; i++) {
      const a = Math.log(bp[i]), b = Math.log(bp[i + 1]);
      if (lr >= a && lr <= b) { const t = (lr - a) / (b - a); return { fl: (f(i) + t * (f(i + 1) - f(i))) * 100, el: (e(i) + t * (e(i + 1) - e(i))) * 100 }; }
    }
    return { fl: f(n - 1) * 100, el: e(n - 1) * 100 };
  }

  function unitFE(u) {
    if (!u || !u.frT) return 0;
    const base = u.frT === 'Custom F.E.' ? (+u.frFE || 0) : (C.FRMAP[u.frT] || 0);
    return base * (u.frQ == null || u.frQ === '' ? 1 : +u.frQ);
  }
  function unitMap(op) { const m = {}; op.orbat.forEach(u => { m[u.id] = u; }); return m; }
  function initialStr(op) { const s = {}; op.orbat.forEach(u => { s[u.id] = (u.cp === '' || u.cp == null ? 100 : +u.cp) / 100; }); return s; }

  function outcomeOf(cfg, m) {
    const t = cfg.thresholds;
    if (m >= t.ds) return OUT[0]; if (m >= t.s) return OUT[1]; if (m >= t.ps) return OUT[2];
    if (m >= t.n) return OUT[3]; if (m >= t.f) return OUT[4]; return OUT[5];
  }
  function modFactor(cfg, mods) {
    let f = 1; const detail = {};
    Object.keys(cfg.mods).forEach(k => {
      const m = cfg.mods[k];
      const idx = mods && mods[k] != null && mods[k] !== '' ? +mods[k] : m.def;
      const opt = m.opts[Math.max(0, Math.min(m.opts.length - 1, idx))];
      detail[k] = { idx, label: opt[0], v: +opt[1] }; f *= +opt[1];
    });
    return { f, detail };
  }

  function activeTurns(op) { return op.turns.filter(t => op.prep.methods[t.m]); }
  function simTurns(op) { return activeTurns(op).filter(t => t.sim !== false); }

  /* Empareja los enfrentamientos de la COA con el despliegue de la ECOA en un turno. */
  function buildEngagements(op, coa, ecoa, turnId) {
    const bp = (coa && coa.plan && coa.plan[turnId]) || {};
    const rp = (ecoa && ecoa.plan && ecoa.plan[turnId]) || {};
    const engs = (bp.eng || []).map(e => ({ eng: e, blue: (e.units || []).filter(x => x.u), red: [] }));
    const warnings = [], bySec = {};
    (rp.place || []).forEach(p => { if (p.u) (bySec[p.sector] = bySec[p.sector] || []).push(p); });
    Object.keys(bySec).forEach(sec => {
      const inSec = engs.filter(x => x.eng.sector === sec);
      if (!inSec.length) { warnings.push({ sector: sec, units: bySec[sec].map(p => p.u) }); return; }
      bySec[sec].forEach(p => {
        let tg = inSec.find(x => (x.eng.vs || []).indexOf(p.u) >= 0);
        if (!tg) tg = inSec.find(x => !(x.eng.vs || []).length) || inSec[0];
        tg.red.push({ u: p.u, pct: p.pct == null || p.pct === '' ? 100 : +p.pct });
      });
    });
    return { engs, warnings };
  }

  function evalEngagement(cfg, umap, str, x, modsOv, noise) {
    const e = x.eng, task = cfg.tasks[e.task] ? e.task : 'hastyDef', T = cfg.tasks[task];
    let feB = 0, feR = 0;
    x.blue.forEach(b => { const u = umap[b.u]; if (u) feB += unitFE(u) * (str[b.u] || 0) * pctOf(b.pct); });
    x.red.forEach(b => { const u = umap[b.u]; if (u) feR += unitFE(u) * (str[b.u] || 0) * pctOf(b.pct); });
    const mf = modFactor(cfg, Object.assign({}, e.mods || {}, modsOv || {}));
    const pair = e.pair || T.pair;
    const res = { task, taskLabel: T.label, plan: T.plan, req: +T.req, pair, feB, feR, mod: mf.f, modDetail: mf.detail };
    if (feR <= 0) return Object.assign(res, { contact: false, r: Infinity, rEff: Infinity, margin: Infinity, outcome: NC, lb: 0, lr: 0 });
    if (feB <= 0) return Object.assign(res, { contact: true, r: 0, rEff: 0, margin: 0, outcome: OUT[5], lb: 0, lr: 0, unopposed: true });
    const r = feB / feR;
    let rEff = r * mf.f;
    if (noise) rEff *= Math.exp(cfg.sim.sigma * noise.z);
    const margin = rEff / (+T.req || 1);
    const L = dmgAt(pair, rEff);
    const brk = e.brk == null ? T.brk : !!e.brk;
    let lb = L.fl * (brk ? cfg.brkFactor : 1), lr = L.el;
    if (noise) {
      const s = cfg.sim.sigmaLoss, c = s * s / 2;
      lb *= Math.exp(s * noise.zl - c); lr *= Math.exp(s * noise.zl2 - c);
    }
    lb = Math.min(95, Math.max(0, lb)); lr = Math.min(95, Math.max(0, lr));
    return Object.assign(res, { contact: true, r, rEff, margin, outcome: outcomeOf(cfg, margin), lb, lr, brk });
  }

  function applyLosses(cfg, umap, str, x, lb, lr) {
    const out = {};
    x.blue.forEach(b => {
      const before = str[b.u] || 0, after = Math.max(0, before * (1 - (lb / 100) * pctOf(b.pct)));
      out[b.u] = (out[b.u] || 0) + (before - after); str[b.u] = after;
    });
    let feR = 0, wsum = 0;
    const ws = x.red.map(b => {
      const fe = unitFE(umap[b.u]) * (str[b.u] || 0) * pctOf(b.pct); feR += fe;
      const w = fe * (x.eng.hpt && x.eng.hpt === b.u ? cfg.hptWeight : 1); wsum += w;
      return { b, fe, w };
    });
    const lost = feR * lr / 100;
    ws.forEach(o => {
      const fe1 = unitFE(umap[o.b.u]); if (!fe1 || wsum <= 0) return;
      const feLost = Math.min(o.fe, lost * o.w / wsum), before = str[o.b.u] || 0;
      const after = Math.max(0, before - feLost / fe1);
      out[o.b.u] = (out[o.b.u] || 0) + (before - after); str[o.b.u] = after;
    });
    return out;
  }

  function worstME(results) {
    const pool0 = results.filter(o => o.adj.outcome !== NC);
    const me = pool0.filter(o => o.x.eng.me), pool = me.length ? me : pool0;
    if (!pool.length) return '';
    return pool.reduce((w, o) => (RANK[o.adj.outcome] > RANK[w] ? o.adj.outcome : w), pool[0].adj.outcome);
  }

  /* Camino adjudicado: cálculo determinista + decisiones del árbitro guardadas en game.
     Los turnos con sim === false se evalúan pero no cambian el estado de las fuerzas. */
  function runPath(op, coa, ecoa, cfg, game) {
    const umap = unitMap(op), str = initialStr(op);
    const turns = [], steps = [{ label: '0', id: null, str: Object.assign({}, str) }];
    activeTurns(op).forEach((t, i) => {
      const built = buildEngagements(op, coa, ecoa, t.id);
      const gt = game && game.turns && game.turns[t.id];
      const startStr = Object.assign({}, str);
      const results = built.engs.map(x => {
        const c = evalEngagement(cfg, umap, str, x, gt && gt.mods && gt.mods[x.eng.id]);
        const ov = gt && gt.ovr && gt.ovr[x.eng.id];
        const adj = { outcome: c.outcome, lb: c.lb, lr: c.lr, manual: false };
        if (ov) {
          if (ov.res) { adj.outcome = ov.res; adj.manual = true; }
          if (ov.bl !== '' && ov.bl != null && !isNaN(+ov.bl)) { adj.lb = +ov.bl; adj.manual = true; }
          if (ov.rl !== '' && ov.rl != null && !isNaN(+ov.rl)) { adj.lr = +ov.rl; adj.manual = true; }
        }
        return { x, calc: c, adj };
      });
      const counts = t.sim !== false;
      const target = counts ? str : Object.assign({}, str);
      results.forEach(o => { o.applied = applyLosses(cfg, umap, target, o.x, o.adj.lb, o.adj.lr); });
      const endStr = Object.assign({}, target);
      const blueIds = new Set(), meIds = new Set(), redIds = new Set();
      results.forEach(o => { o.x.blue.forEach(b => { blueIds.add(b.u); if (o.x.eng.me) meIds.add(b.u); }); o.x.red.forEach(b => redIds.add(b.u)); });
      const avg = ids => { const a = [...ids]; return a.length ? a.reduce((acc, id) => acc + (endStr[id] || 0), 0) / a.length : null; };
      turns.push({ t, index: i, counts, results, warnings: built.warnings, startStr, endStr, suggested: worstME(results),
        bcpCalc: avg(meIds.size ? meIds : blueIds), rcpCalc: avg(redIds) });
      if (counts) steps.push({ label: t.label, id: t.id, str: Object.assign({}, str) });
    });
    return { turns, steps, umap };
  }

  /* Monte Carlo de la secuencia completa (o de un turno desde un estado dado). */
  function monteCarlo(op, coa, ecoa, cfg, opts) {
    opts = opts || {};
    const n = opts.n || cfg.sim.n;
    const rng = mulberry32(((+cfg.sim.seed) >>> 0) ^ hashStr(coa.id + '|' + ecoa.id + '|' + (opts.tag || '')));
    const umap = unitMap(op);
    const turns = opts.onlyTurn ? op.turns.filter(t => t.id === opts.onlyTurn) : simTurns(op);
    const built = turns.map(t => buildEngagements(op, coa, ecoa, t.id));
    const game = opts.game;
    const st = built.map(b => b.engs.map(() => ({ out: {}, lb: [], lr: [], r: [] })));
    const engagedB = new Set(), engagedR = new Set();
    built.forEach(b => b.engs.forEach(x => { x.blue.forEach(u => engagedB.add(u.u)); x.red.forEach(u => engagedR.add(u.u)); }));
    const endS = {}; [...engagedB, ...engagedR].forEach(id => { endS[id] = []; });
    const ffir = (+op.ffir || 70) / 100;
    let ok = 0, dcAll = 0, breach = 0; const uBreach = {}; engagedB.forEach(id => { uBreach[id] = 0; });
    const nEng = built.reduce((a, b) => a + b.engs.length, 0);
    for (let k = 0; k < n; k++) {
      const str = opts.startStr ? Object.assign({}, opts.startStr) : initialStr(op);
      let good = true, dc = true;
      built.forEach((b, ti) => {
        const gt = game && game.turns && game.turns[turns[ti].id];
        const res = b.engs.map(x => evalEngagement(cfg, umap, str, x, gt && gt.mods && gt.mods[x.eng.id], { z: gauss(rng), zl: gauss(rng), zl2: gauss(rng) }));
        res.forEach((r, xi) => {
          const s = st[ti][xi]; s.out[r.outcome] = (s.out[r.outcome] || 0) + 1;
          if (r.contact) { s.lb.push(r.lb); s.lr.push(r.lr); if (isFinite(r.rEff)) s.r.push(r.rEff); }
          const rk = RANK[r.outcome], me = b.engs[xi].eng.me;
          // Éxito de la COA: ningún fracaso y el esfuerzo principal al menos en éxito parcial.
          // Todas las DC: además, cada esfuerzo principal alcanza éxito o éxito decisivo.
          if (rk >= 4) { good = false; dc = false; }
          if (me && rk >= 3) good = false;
          if (me && rk >= 2) dc = false;
          applyLosses(cfg, umap, str, b.engs[xi], r.lb, r.lr);
        });
      });
      if (good) ok++; if (dc) dcAll++;
      let br = false;
      engagedB.forEach(id => { endS[id].push(str[id]); if (str[id] < ffir) { br = true; uBreach[id]++; } });
      engagedR.forEach(id => endS[id].push(str[id]));
      if (br) breach++;
    }
    const engs = built.map((b, ti) => b.engs.map((x, xi) => {
      const s = st[ti][xi], p = {}; Object.keys(s.out).forEach(k => { p[k] = s.out[k] / n; });
      return { turnId: turns[ti].id, engId: x.eng.id, p, lb: summ(s.lb), lr: summ(s.lr), r: summ(s.r) };
    }));
    const end = {}; Object.keys(endS).forEach(id => { end[id] = summ(endS[id]); });
    const pUnit = {}; engagedB.forEach(id => { pUnit[id] = uBreach[id] / n; });
    const avg = ids => ids.length ? ids.reduce((a, id) => a + end[id].mean, 0) / ids.length : 1;
    const bl = [...engagedB], rl = [...engagedR];
    const meanB = avg(bl), meanR = avg(rl);
    const pS = ok / n, pDC = dcAll / n, pF = breach / n, w = cfg.score;
    const score = 100 * (w.wSuccess * pS + w.wCP * meanB + w.wFFIR * (1 - pF)) / ((+w.wSuccess + +w.wCP + +w.wFFIR) || 1);
    return { n, turns: turns.map(t => t.id), engs, end, pSuccess: pS, pDC, pFFIR: pF, pUnit, meanBlueCP: meanB, meanRedCP: meanR, score, engagedBlue: bl, engagedRed: rl, hasPlan: nEng > 0 };
  }

  function analyseAll(op, cfg) {
    const out = {};
    op.coas.forEach(c => op.ecoas.forEach(e => { out[c.id + '|' + e.id] = monteCarlo(op, c, e, cfg); }));
    return out;
  }

  /* Una tirada aleatoria (no sembrada) de un enfrentamiento — pestaña Adjudicación. */
  function rollEngagement(op, coa, ecoa, cfg, turnId, engId, startStr, mods) {
    const x = buildEngagements(op, coa, ecoa, turnId).engs.find(z => z.eng.id === engId);
    if (!x) return null;
    const rnd = Math.random;
    return evalEngagement(cfg, unitMap(op), Object.assign({}, startStr), x, mods, { z: gauss(rnd), zl: gauss(rnd), zl2: gauss(rnd) });
  }

  global.WGEngine = { OUT, NC, RANK, DEFAULT_CONFIG, fmtR, dmgAt, unitFE, unitMap, initialStr, outcomeOf, modFactor,
    activeTurns, simTurns, buildEngagements, evalEngagement, applyLosses, runPath, monteCarlo, analyseAll, rollEngagement, mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
