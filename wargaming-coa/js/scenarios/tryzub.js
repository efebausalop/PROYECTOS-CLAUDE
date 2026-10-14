/* ==========================================================================
   OPERATION TRYZUB — escenario v3
   Base: semilla de wargaming_nato v2 (sin cambios, convertida con migrateV2).
   Añadido en v3 (marcado en la propia app):
   - Plan de enfrentamientos de la COA 1 por turno (unidades del ORBAT, tarea,
     sector, HPT, modificadores) — a partir de la acción azul de cada turno.
   - Despliegue de ECOA-1 y ECOA-2 por turno — a partir de las reacciones de
     cada turno (ECOA-1) y de la biblioteca de eventos críticos (ECOA-2).
   - El turno BOX A (H+48 → H+96) se solapa con los segmentos del método
     avenida: se evalúa pero no encadena bajas en la simulación.
   ========================================================================== */
(function (global) {
  'use strict';
  const M = (terrain, obst, fires, surprise, morale, isr) => ({ terrain, obst, fires, surprise, morale, isr });
  const NEU = () => M(1, 0, 1, 1, 1, 1);
  let n = 0;
  const E = (sector, label, task, units, o) => Object.assign({ id: 'tz-e' + (++n), sector, label, task, me: false, brk: undefined, hpt: '', vs: [], pair: '', units: units.map(u => (Array.isArray(u) ? { u: u[0], pct: u[1] } : { u, pct: 100 })), mods: NEU() }, o || {});
  const P = (sector, ids) => ids.map(u => (Array.isArray(u) ? { u: u[0], sector, pct: u[1] } : { u, sector, pct: 100 }));

  const B1 = ['r-b1-1', 'r-b1-2', 'r-b1-3', 'r-b1-tk', 'r-b1-at'];
  const B2 = ['r-b2-1', 'r-b2-2', 'r-b2-3', 'r-b2-tk'];
  const B3 = ['r-b3-1', 'r-b3-2', 'r-b3-3', 'r-b3-tk'];
  const TKB = ['r-tkb-1', 'r-tkb-2', 'r-tkb-3'];

  function build() {
    const V = global.WG_TRYZUB_V2, W = global.WGModel;
    const op = W.migrateV2(V.SEED, {
      STEPS: V.STEPS, CM: V.CM, tag: 'OP TRYZUB / POLAR STAR', unit: 'X ASSAULT BDE “SIRKO” / OTG “MAMAI” / OSG “HETMAN”',
      sectors: [{ id: 'Z11', name: 'Z11 — south corridor (SIRKO main effort)' }, { id: 'Z12', name: 'Z12 — north corridor' }]
    });
    op.id = 'op-tryzub';
    op.meta.title = 'Operation TRYZUB — COA Analysis (Step 4)';
    n = 0;
    const coa = op.coas.find(c => c.id === 'COA-1');
    const eng = {
      t1: [E('Z11', 'Guard the first line · BRC II rearward passage', 'screen', ['b-kotyh', ['b-baida', 50]], { hpt: 'r-b1-rec' }),
           E('Z12', 'Northern sector security', 'screen', [['b-dovbush', 50]])],
      t2: [E('Z11', 'Set on PL1 · AMA 1 on the march column', 'hastyDef', ['b-baida'], { brk: true, me: true, mods: M(1, 1, 2, 1, 1, 1) }),
           E('Z12', 'DOVBUSH set on PL1', 'delay', ['b-dovbush'])],
      t3: [E('Z11', 'EA1 — fix the lead echelon (DC-B2)', 'hastyDef', ['b-baida', 'b-kozh'], { me: true, brk: true, hpt: 'r-b1-tk', mods: M(1, 1, 2, 1, 1, 1) }),
           E('Z12', 'Delay to PL YELLOW', 'delay', [['b-dovbush', 70]])],
      t4: [E('Z11', 'KOZHUMIAKA CATK into EA1 (DC-B3)', 'catk', ['b-kozh', 'b-baida'], { me: true, hpt: 'r-b1-3', mods: M(1, 0, 2, 1, 1, 1) }),
           E('Z12', 'Delay PL YELLOW → PL3', 'delay', [['b-dovbush', 70]])],
      t5: [E('Z11', 'PL4 anchor — hill 247 and the canal (OB-4)', 'delibDef', ['b-baida'], { me: true, hpt: 'r-b1-tk', mods: M(2, 2, 1, 1, 1, 1) })],
      t6: [E('Z11', 'Contain IVO PL3 and withdraw to PL PURPLE', 'delay', [['b-baida', 70], ['b-kozh', 50]], { vs: B1 }),
           E('Z11', 'XII ARMD BDE CATK from the SOUTH (DC-B4)', 'catk', ['b-xii'], { me: true, hpt: 'r-tkb-1', vs: TKB.concat(['r-ib21']), mods: M(1, 0, 2, 2, 1, 1) }),
           E('Z12', 'DOVBUSH contains and withdraws', 'delay', [['b-dovbush', 70]])],
      t7: [E('Z11', 'Feint IVO EA3 · support by fire', 'delay', [['b-kozh', 70], ['b-baida', 50]], { me: true }),
           E('Z12', 'KOTYHOROSHKO feint IVO EA2', 'delay', ['b-kotyh'])],
      t8: [E('Z11', 'Block at PL4 — hill 247 (DC-B6)', 'delibDef', ['b-baida', 'b-kozh'], { me: true, hpt: 'r-tkb-2', mods: M(2, 2, 2, 1, 1, 1) }),
           E('Z12', 'Canalise to EA4 · KOTYHOROSHKO BP4', 'delibDef', ['b-dovbush', ['b-kotyh', 70]], { mods: M(1, 1, 1, 1, 1, 1) })],
      t9: [E('Z11', 'KOZHUMIAKA CATK into EA7 (DC-B7)', 'catk', ['b-kozh', 'b-baida'], { me: true, mods: M(1, 0, 2, 2, 1, 1) }),
           E('Z12', 'DOVBUSH canalises to EA6 · flank protection', 'hastyDef', ['b-dovbush', ['b-kotyh', 50]])]
    };
    Object.keys(eng).forEach(t => { coa.plan[t] = coa.plan[t] || { a: '' }; coa.plan[t].eng = eng[t]; });

    const e1 = op.ecoas.find(e => e.id === 'ECOA-1'), e2 = op.ecoas.find(e => e.id === 'ECOA-2');
    const place1 = {
      t1: P('Z11', ['r-b1-rec', ['r-b1-1', 30]]).concat(P('Z12', ['r-b2-rec'])),
      t2: P('Z11', ['r-b1-1', 'r-b1-2']).concat(P('Z12', ['r-b2-1'])),
      t3: P('Z11', ['r-b1-1', 'r-b1-2', 'r-b1-tk', 'r-b1-at']).concat(P('Z12', ['r-b2-1', 'r-b2-2', 'r-b2-tk'])),
      t4: P('Z11', ['r-b1-3', 'r-b1-tk', ['r-b1-at', 50]]).concat(P('Z12', ['r-b2-1', 'r-b2-2', 'r-b2-3', 'r-b2-tk'])),
      t5: P('Z11', ['r-b1-1', 'r-b1-2', 'r-b1-tk']),
      t6: P('Z11', B1.concat(TKB)).concat(P('Z12', B2.concat(['r-b3-1', 'r-b3-2']))),
      t7: P('Z11', ['r-b1-1', 'r-b1-3', 'r-tkb-1', 'r-tkb-2']).concat(P('Z12', ['r-b3-1', 'r-b3-2', 'r-b3-3'])),
      t8: P('Z11', ['r-b1-1', 'r-b1-2', 'r-b1-3', 'r-b1-tk'].concat(TKB)).concat(P('Z12', B3)),
      t9: P('Z11', ['r-b1-3', 'r-tkb-1', 'r-tkb-2', 'r-tkb-3']).concat(P('Z12', ['r-b3-1', 'r-b3-2']))
    };
    const place2 = {
      t1: P('Z11', ['r-b3-1', 'r-b3-2', 'r-b3-rec']).concat(P('Z12', ['r-b2-1', 'r-b2-2'])),
      t2: P('Z11', ['r-b3-1', 'r-b3-2', 'r-b3-3']).concat(P('Z12', ['r-b2-1', 'r-b2-2', 'r-b2-3'])),
      t3: P('Z11', B3).concat(P('Z12', ['r-b2-1', 'r-b2-2', 'r-b2-tk'])),
      t4: P('Z11', B1.concat(TKB)).concat(P('Z12', B2)),
      t5: P('Z11', B1.concat(['r-tkb-1'])),
      t6: P('Z11', B1.concat(TKB).concat(['r-ib21'])).concat(P('Z12', B2)),
      t7: P('Z11', B1.concat(TKB)).concat(P('Z12', ['r-b2-1', 'r-b2-2'])),
      t8: P('Z11', B1.concat(TKB).concat([['r-d14', 30]])).concat(P('Z12', B2)),
      t9: P('Z11', TKB.concat([['r-d14', 50]])).concat(P('Z12', ['r-b2-1', 'r-b2-2']))
    };
    op.turns.forEach(t => {
      e1.plan[t.id] = e1.plan[t.id] || { pre: '', r: '' }; e1.plan[t.id].place = place1[t.id] || [];
      const ce = op.ces.find(c => c.id === t.ce);
      e2.plan[t.id] = { pre: '', r: ce ? (ce.r['ECOA-2'] || '') : '', place: place2[t.id] || [] };
    });
    const t5 = op.turns.find(t => t.id === 't5'); if (t5) t5.sim = false;
    op.coas.find(c => c.id === 'COA-2').plan = {};
    op.ui.planTurn = 't3';
    return op;
  }

  global.WGScenarios = global.WGScenarios || {};
  global.WGScenarios.tryzub = { name: 'Operation TRYZUB (EUMAM-UA · SIRKO)', build };
})(typeof window !== 'undefined' ? window : globalThis);
