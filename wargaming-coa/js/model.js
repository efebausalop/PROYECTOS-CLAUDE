/* ==========================================================================
   Modelo de datos v3 y migración desde wargaming_nato v2
   --------------------------------------------------------------------------
   Una operación (op) contiene:
   - meta, phases (fases), sectors (corredores / fajas), cm (medidas de control)
   - inputs (orden superior, pasos 1–3, estimaciones, CPG, criterios)
   - coas  [{id,name,stmt, plan:{turnId:{a, eng:[enfrentamiento]}}}]
   - ecoas [{id,name,tag,lik,text,bySector, plan:{turnId:{pre, r, place:[{u,sector,pct}]}}}]
   - orbat, ces (eventos críticos), prep, turns (esqueleto común de turnos)
   - games {"COA|ECOA": registro de la confrontación de esa pareja}
   - reg (NAI, TAI, HPT, HVT, DP, CCIR), fr, adj, evalx, ui
   ========================================================================== */
(function (global) {
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));

  function newGame() {
    return { turns: {}, adjLog: [], frSaved: [], sync: {}, outputs: { refined: false, sync: false, dso: false, assump: false, est: false, brief: false, refinedText: '' },
      facds: {}, strengths: '', weaknesses: '', conclusions: '' };
  }

  function blankOp(name) {
    const id = 'op-' + Date.now().toString(36);
    return ensure({
      id, v: 3,
      meta: { title: name || 'Nueva operación', classification: 'SIN CLASIFICAR — USO DIDÁCTICO', unit: '', tag: '', syndicate: '', date: '' },
      phases: [{ id: 'P1', n: 'FASE 1', t: 'H → H+12', me: '', dc: 'DC-1', otg: '', d: '' }],
      sectors: [{ id: 'S1', name: 'Sector 1' }],
      cm: [],
      inputs: { hhq: { order: '', purpose: '', key: '', endstate: '', tasks: '', newTasks: '', newInfo: '', thirdParty: '' },
        s13: { mission: '', intent: '', specified: '', implied: '', essential: '', constraints: '', restraints: '', deductions: '' },
        est: [], cpg: '', criteria: [] },
      coas: [{ id: 'COA-1', name: 'COA 1', stmt: '', plan: {} }],
      ecoas: [{ id: 'ECOA-1', name: 'ECOA 1 (MLCOA)', tag: 'MLCOA', lik: 60, text: '', bySector: {}, plan: {} }],
      orbat: [], ces: [],
      prep: { coa: 'COA-1', acoa: 'ECOA-1', technique: 'Manual wargame (map / board and counters)', initiative: 'red',
        methods: { critical: true, belt: false, box: false, avenue: false }, ceSel: [], dpSel: [],
        recording: 'War Game Worksheet (APP-28 Annex D) + Synchronisation matrix',
        adjMethod: 'Mixed — Analytical (tables, force ratios, dice) + Expert (arbiter)', timeline: '', positions: [], assumptions: [], notes: '' },
      turns: [{ id: 't1', m: 'critical', label: 'KEY EVENT 1', title: '', time: '', ce: '', sim: true }],
      games: {},
      reg: { nai: [], tai: [], hpt: [], hvt: [], dp: [], ccir: [] },
      fr: { name: '', turn: '', fM: 'Hasty Defense', eM: 'Deliberate Attack', f: [], e: [], defSide: '', terr: 1, prep: 1, pm: 'Delay', saved: [] },
      adj: { target: '', dist: 'equal', contest: 'equal', bmod: 0, rmod: 0 },
      evalx: {}, ffir: 70, dcLine: 60
    });
  }

  /* Rellena campos que falten (operaciones importadas o antiguas). */
  function ensure(op) {
    op.v = 3;
    op.meta = Object.assign({ title: 'Operación', classification: '', unit: '', tag: '', syndicate: '', date: '' }, op.meta || {});
    op.phases = op.phases || []; op.sectors = op.sectors || []; op.cm = op.cm || [];
    op.inputs = op.inputs || {}; op.inputs.hhq = op.inputs.hhq || {}; op.inputs.s13 = op.inputs.s13 || {};
    op.inputs.est = op.inputs.est || []; op.inputs.criteria = op.inputs.criteria || []; if (op.inputs.cpg == null) op.inputs.cpg = '';
    op.coas = op.coas || []; op.ecoas = op.ecoas || [];
    op.coas.forEach(c => { c.plan = c.plan || {}; });
    op.ecoas.forEach(e => { e.plan = e.plan || {}; e.bySector = e.bySector || {}; if (e.lik == null) e.lik = 0; if (e.tag == null) e.tag = ''; });
    op.orbat = op.orbat || []; op.ces = op.ces || [];
    op.ces.forEach(c => { if (!c.r || typeof c.r !== 'object') c.r = {}; });
    op.prep = Object.assign({ coa: '', acoa: '', technique: '', initiative: 'red', methods: { critical: true, belt: true, box: true, avenue: true }, ceSel: [], dpSel: [], recording: '', adjMethod: '', timeline: '', positions: [], assumptions: [], notes: '' }, op.prep || {});
    op.turns = op.turns || []; op.turns.forEach(t => { if (t.sim == null) t.sim = true; });
    op.games = op.games || {};
    Object.keys(op.games).forEach(k => { op.games[k] = Object.assign(newGame(), op.games[k]); });
    op.reg = Object.assign({ nai: [], tai: [], hpt: [], hvt: [], dp: [], ccir: [] }, op.reg || {});
    op.fr = Object.assign({ name: '', turn: '', fM: 'Hasty Defense', eM: 'Deliberate Attack', f: [], e: [], defSide: '', terr: 1, prep: 1, pm: 'Delay' }, op.fr || {});
    op.adj = Object.assign({ target: '', dist: 'equal', contest: 'equal', bmod: 0, rmod: 0 }, op.adj || {});
    op.roles = Object.assign({ people: {}, chk: {}, present: {} }, op.roles || {}); if (op.opType == null) op.opType = '';
    op.evalx = op.evalx || {}; if (op.ffir == null) op.ffir = 70; if (op.dcLine == null) op.dcLine = 60;
    op.ui = Object.assign({ open: {}, orbSide: 'ALL', wgView: 'turn', wgM: 'all', inTab: 'op', regTab: 'dp', step: 0, q: '', selU: '', planTurn: '', wgTurn: 0, wgStep: 0, cell: 'white', statPair: '' }, op.ui || {});
    if (!op.coas.find(c => c.id === op.prep.coa)) op.prep.coa = op.coas[0] ? op.coas[0].id : '';
    if (!op.ecoas.find(c => c.id === op.prep.acoa)) op.prep.acoa = op.ecoas[0] ? op.ecoas[0].id : '';
    return op;
  }

  function gameKey(op) { return op.prep.coa + '|' + op.prep.acoa; }
  function game(op, key, create) {
    key = key || gameKey(op);
    if (!op.games[key] && create !== false) op.games[key] = newGame();
    return op.games[key];
  }

  /* -------------------------- migración v2 → v3 --------------------------
     S2: estado de wargaming_nato v2 (semilla o copia JSON exportada).
     extra: { STEPS, CM, sectors, classification, tag } — datos de escenario
     que en v2 eran constantes del programa. */
  function migrateV2(S2, extra) {
    extra = extra || {};
    const s = clone(S2);
    const turnsV2 = s.turns || [];
    const coa0 = (s.prep && s.prep.coa) || 'COA-1', acoa0 = (s.prep && s.prep.acoa) || 'ECOA-1';
    const sectors = extra.sectors || [{ id: 'Z11', name: 'Z11 — south corridor' }, { id: 'Z12', name: 'Z12 — north corridor' }];
    const ecoas = (s.inputs.ecoa || []).map((e, i) => ({
      id: e.id, name: e.name, text: e.text || '',
      tag: /MDCOA/i.test(e.name) ? 'MDCOA' : /MLCOA/i.test(e.name) ? 'MLCOA' : (i === 0 ? 'MLCOA' : ''),
      lik: i === 0 ? 60 : (i === 1 ? 40 : 0),
      bySector: { Z11: e.z11 || '', Z12: e.z12 || '' }, plan: {}
    }));
    const ecoaIdx = {}; ecoas.forEach((e, i) => { ecoaIdx[e.id] = i; });
    const ces = (s.ces || []).map(c => {
      const r = {};
      ecoas.forEach((e, i) => { r[e.id] = i === 0 ? (c.r1 || '') : i === 1 ? (c.r2 || '') : ''; });
      return { id: c.id, title: c.title, step: c.step, dc: c.dc, dp: c.dp, ccir: c.ccir, r, cr: c.cr || '' };
    });
    const coas = (s.inputs.s13.coas || []).map(c => ({ id: c.id, name: c.name, stmt: c.stmt || '', plan: {} }));
    const g = newGame();
    turnsV2.forEach(t => {
      const coa = coas.find(c => c.id === coa0); if (coa) coa.plan[t.id] = { a: t.a || '', eng: [] };
      const ec = ecoas.find(e => e.id === acoa0); if (ec) ec.plan[t.id] = { pre: '', r: t.r || '', place: [] };
      g.turns[t.id] = { cr: t.cr || '', assets: t.assets || [], dp: t.dp || '', ccir: t.ccir || '', rem: t.rem || '', branch: t.branch || '',
        res: t.res || '', bcp: t.bcp == null ? '' : t.bcp, rcp: t.rcp == null ? '' : t.rcp, fr: t.fr || '', ovr: {}, mods: {} };
    });
    g.adjLog = (s.adj && s.adj.log) || []; g.frSaved = (s.fr && s.fr.saved) || [];
    g.outputs = Object.assign(g.outputs, s.outputs || {});
    const inputs = { hhq: s.inputs.hhq, s13: Object.assign({}, s.inputs.s13), est: s.inputs.est || [], cpg: s.inputs.cpg || '', criteria: s.inputs.criteria || [] };
    delete inputs.s13.coas;
    const op = {
      id: 'op-' + Date.now().toString(36), v: 3,
      meta: { title: (s.meta && s.meta.title) || 'Operation', classification: extra.classification || 'NATO UNCLASSIFIED // FOR TRAINING USE ONLY',
        unit: extra.unit || '', tag: extra.tag || '', syndicate: (s.meta && s.meta.syndicate) || '', date: (s.meta && s.meta.date) || '' },
      phases: clone(extra.STEPS || []), sectors, cm: clone(extra.CM || []),
      inputs, coas, ecoas, orbat: s.orbat || [], ces,
      prep: Object.assign({}, s.prep, { initiative: 'red' }),
      turns: turnsV2.map(t => ({ id: t.id, m: t.m, label: t.label, title: t.title, time: t.time, ce: t.ce, sim: true })),
      games: {}, reg: s.reg, fr: Object.assign({}, s.fr), adj: Object.assign({}, s.adj), evalx: s.evalx || {}, ffir: 70, dcLine: 60,
      ui: { open: (s.ui && s.ui.open) || {}, selU: (s.ui && s.ui.selU) || '' }
    };
    delete op.fr.saved; delete op.adj.log;
    op.games[coa0 + '|' + acoa0] = g;
    return ensure(op);
  }
  function isV2(o) { return o && o.v === 2 && Array.isArray(o.turns) && o.inputs && o.inputs.s13; }

  global.WGModel = { clone, newGame, blankOp, ensure, gameKey, game, migrateV2, isV2 };
})(typeof window !== 'undefined' ? window : globalThis);
