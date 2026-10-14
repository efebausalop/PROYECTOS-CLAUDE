/* ==========================================================================
   EJERCICIO MAR AZUL — escenario anfibio ficticio y didáctico.
   F.E. orientativos (MARFOR, CGSC ST 100-3: Infantry Bn 0,8; Tank Co 0,3;
   AAV Co 0,2) ajustados a la entidad de cada unidad. Calibrar antes de usar.
   ========================================================================== */
(function (global) {
  'use strict';
  const M = (terrain, obst, fires, surprise, morale, isr) => ({ terrain, obst, fires, surprise, morale, isr });
  let n = 0;
  const E = (sector, label, task, units, o) => Object.assign({ id: 'ma-e' + (++n), sector, label, task, me: false, hpt: '', vs: [], pair: '', units: units.map(u => (Array.isArray(u) ? { u: u[0], pct: u[1] } : { u, pct: 100 })), mods: M(1, 0, 1, 1, 1, 1) }, o || {});
  const P = (sector, ids) => ids.map(u => (Array.isArray(u) ? { u: u[0], sector, pct: u[1] } : { u, sector, pct: 100 }));
  const U = (id, side, name, type, ech, frT, frQ, frFE, role) => ({ id, p: null, side, name, type, ech, pers: '', equip: '', role, frT, frQ, frFE: frFE || 0, cp: 100, loc: '' });

  function build() {
    const W = global.WGModel;
    const op = W.blankOp('Ejercicio MAR AZUL (ficticio)');
    n = 0;
    Object.assign(op, {
      id: 'op-marazul',
      meta: { title: 'Ejercicio MAR AZUL (ficticio)', classification: 'SIN CLASIFICAR — USO DIDÁCTICO', unit: 'Brigada de Infantería de Marina (BRIMAR)', tag: 'EJ MAR AZUL', syndicate: '', date: '' },
      phases: [
        { id: 'F1', n: 'FASE I · MOVIMIENTO BUQUE-COSTA', t: 'H → H+4', me: '1.º BIM', dc: 'Playas aseguradas', otg: '', d: 'Asalto a las playas con fuego naval de apoyo.' },
        { id: 'F2', n: 'FASE II · CABEZA DE PLAYA', t: 'H+4 → H+12', me: 'Grupo Acorazado', dc: 'Cabeza de playa mantenida', otg: '', d: 'Rechazo del contraataque de la reserva móvil.' },
        { id: 'F3', n: 'FASE III · EXPLOTACIÓN', t: 'H+12 → H+24', me: '1.º BIM', dc: 'OBJ ALFA', otg: '', d: 'Explotación al aeródromo.' }
      ],
      sectors: [{ id: 'V', name: 'Playa VERDE (N)' }, { id: 'A', name: 'Playa ÁMBAR (S)' }, { id: 'I', name: 'Interior / OBJ ALFA' }],
      cm: ['Playa VERDE', 'Playa ÁMBAR', 'Línea de cabeza de playa', 'ZD interior', 'OBJ ALFA (aeródromo)'],
      ffir: 70
    });
    op.inputs.s13.mission = 'La BRIMAR, O/O día D, conduce un asalto anfibio sobre la costa de ISLA NORTE para conquistar el OBJ ALFA (aeródromo) y permitir el desembarco de la fuerza de seguimiento.';
    op.inputs.s13.intent = 'Propósito: aeródromo operativo para la fuerza de seguimiento. Método: asalto con fuego naval masivo, aislamiento de la reserva móvil y explotación rápida. Estado final: cabeza de playa consolidada y OBJ ALFA en nuestro poder antes de D+1.';
    op.orbat = [
      U('mb-1', 'B', '1.º BIM (AAV)', 'amphibious', 'battalion', 'Custom F.E.', 1, 0.45, 'Asalto a playa VERDE'),
      U('mb-2', 'B', '2.º BIM (AAV)', 'amphibious', 'battalion', 'Custom F.E.', 1, 0.45, 'Asalto a playa ÁMBAR'),
      U('mb-3', 'B', '3.º BIM (helitransportado)', 'infantry', 'battalion', 'Custom F.E.', 1, 0.35, 'Reserva / asalto helitransportado'),
      U('mb-ga', 'B', 'Grupo Acorazado', 'armor', 'battalion', 'Custom F.E.', 1, 0.55, 'Segunda oleada'),
      U('mr-1', 'R', 'Bn Inf 1 (VERDE)', 'mech', 'battalion', 'Custom F.E.', 1, 0.40, 'Defensa de playa VERDE'),
      U('mr-2', 'R', 'Bn Inf 2 (ÁMBAR)', 'mech', 'battalion', 'Custom F.E.', 1, 0.40, 'Defensa de playa ÁMBAR'),
      U('mr-3', 'R', 'Bn Inf 3 (reserva)', 'motorized', 'battalion', 'Infantry Bn (BTR-70 / 80)', 1, 0, 'Reserva'),
      U('mr-tk', 'R', 'Bn Carros (reserva móvil)', 'armor', 'battalion', 'Tank Bn (TR 31xT64 / T72)', 1, 0, 'Reserva móvil'),
      U('mr-at', 'R', 'Cía C/C', 'antitank', 'company', 'AT Bn', 0.33, 0, 'Defensa contracarro')
    ];
    op.turns = [
      { id: 'm1', m: 'box', label: 'BOX A', title: 'Asalto a las playas (H-Hour)', time: 'H → H+4', ce: '', sim: true },
      { id: 'm2', m: 'critical', label: 'KEY EVENT 1', title: 'Contraataque de la reserva móvil enemiga', time: 'H+4 → H+12', ce: '', sim: true },
      { id: 'm3', m: 'avenue', label: 'SEGMENT 1', title: 'Explotación al OBJ ALFA', time: 'H+12 → H+24', ce: '', sim: true }
    ];
    op.prep = Object.assign(op.prep, { coa: 'COA-1', acoa: 'ECOA-1', initiative: 'blue', methods: { critical: true, belt: false, box: true, avenue: true } });
    op.coas = [
      { id: 'COA-1', name: 'COA 1 — Asalto por dos playas', stmt: '1.º BIM en VERDE y 2.º BIM en ÁMBAR con fuego naval masivo; Grupo Acorazado en segunda oleada por VERDE; 3.º BIM en reserva a bordo.', plan: {
        m1: { a: '1.º BIM (con media unidad del Grupo Acorazado) asalta VERDE; 2.º BIM asalta ÁMBAR. Fuego naval y apoyo aéreo cercano sobre las defensas de playa.', eng: [
          E('V', 'Asalto a VERDE', 'amphAslt', ['mb-1', ['mb-ga', 50]], { me: true, mods: M(0, 0, 3, 1, 1, 1) }),
          E('A', 'Asalto a ÁMBAR', 'amphAslt', ['mb-2'], { mods: M(0, 0, 3, 1, 1, 1) })] },
        m2: { a: 'Grupo Acorazado desembarca por VERDE; 1.º BIM defiende la línea de cabeza de playa; 2.º BIM consolida ÁMBAR.', eng: [
          E('V', 'Defensa de la cabeza de playa VERDE', 'hastyDef', ['mb-1', 'mb-ga'], { me: true, hpt: 'mr-tk', mods: M(1, 0, 2, 1, 1, 1) }),
          E('A', 'Consolidación ÁMBAR', 'hastyDef', ['mb-2'], { mods: M(1, 0, 2, 1, 1, 1) })] },
        m3: { a: 'Grupo Acorazado y 1.º BIM explotan hacia el OBJ ALFA; 3.º BIM desembarca como reserva.', eng: [
          E('I', 'Ataque al OBJ ALFA', 'hastyAtk', ['mb-1', 'mb-ga', 'mb-3'], { me: true, hpt: 'mr-tk', mods: M(1, 0, 3, 1, 1, 1) })] } } },
      { id: 'COA-2', name: 'COA 2 — Una playa + asalto helitransportado', stmt: '1.º y 2.º BIM concentrados en VERDE; 3.º BIM helitransportado a la ZD interior para aislar la reserva móvil; Grupo Acorazado en segunda oleada.', plan: {
        m1: { a: 'Masa sobre VERDE con dos BIM. 3.º BIM helitransportado a la ZD interior para cortar el eje de la reserva.', eng: [
          E('V', 'Asalto concentrado a VERDE', 'amphAslt', ['mb-1', 'mb-2'], { me: true, mods: M(0, 0, 3, 1, 1, 1) }),
          E('I', 'Asalto helitransportado — bloqueo', 'hastyDef', ['mb-3'], { hpt: 'mr-tk', mods: M(1, 0, 1, 2, 1, 1) })] },
        m2: { a: 'Grupo Acorazado desembarca por VERDE y enlaza con el 3.º BIM; ÁMBAR sólo vigilada por fuego naval.', eng: [
          E('V', 'Expansión de la cabeza de playa', 'hastyDef', ['mb-1', 'mb-2'], { me: true, mods: M(1, 0, 2, 1, 1, 1) }),
          E('I', 'Bloqueo de la reserva móvil', 'hastyDef', ['mb-3', 'mb-ga'], { hpt: 'mr-tk', mods: M(1, 0, 2, 1, 1, 1) })] },
        m3: { a: 'Ataque convergente al OBJ ALFA desde VERDE y desde la ZD.', eng: [
          E('I', 'Ataque convergente al OBJ ALFA', 'hastyAtk', ['mb-1', 'mb-2', 'mb-3', 'mb-ga'], { me: true, mods: M(1, 0, 3, 2, 1, 1) })] } } }
    ];
    op.ecoas = [
      { id: 'ECOA-1', name: 'ECOA 1 — Defensa en la playa', tag: 'MLCOA', lik: 65, text: 'Defensa adelantada sobre ambas playas con un batallón en cada una; la reserva móvil contraataca la playa principal en H+6.', bySector: {}, plan: {
        m1: { pre: '', r: 'Fuego desde posiciones preparadas en la playa; minado en la línea de agua.', place: P('V', [['mr-1', 50]]).concat(P('A', [['mr-2', 50]])) },
        m2: { pre: '', r: 'Bn Carros y Bn Inf 3 contraatacan VERDE.', place: P('V', ['mr-tk', 'mr-3']).concat(P('A', [['mr-2', 60]])) },
        m3: { pre: '', r: 'Restos de la brigada defienden el aeródromo.', place: P('I', ['mr-tk', ['mr-3', 60], 'mr-at']) } } },
      { id: 'ECOA-2', name: 'ECOA 2 — Defensa en profundidad con reserva móvil', tag: 'MDCOA', lik: 35, text: 'Pantalla ligera en la playa; defensa principal en el interior; la reserva móvil golpea en el momento de máxima vulnerabilidad (segunda oleada).', bySector: {}, plan: {
        m1: { pre: '', r: 'Pantalla en playas y repliegue a la línea principal.', place: P('V', [['mr-1', 25]]).concat(P('A', [['mr-2', 25]])) },
        m2: { pre: '', r: 'La reserva móvil avanza por el eje interior y golpea la segunda oleada en VERDE.', place: P('I', ['mr-tk']).concat(P('V', ['mr-3', 'mr-at'])) },
        m3: { pre: '', r: 'Defensa preparada del aeródromo.', place: P('I', ['mr-1', 'mr-2', 'mr-at', ['mr-tk', 60]]) } } }
    ];
    op.ui.planTurn = 'm1';
    return op;
  }

  global.WGScenarios = global.WGScenarios || {};
  global.WGScenarios.marazul = { name: 'Ejercicio MAR AZUL (anfibio, ficticio)', build };
})(typeof window !== 'undefined' ? window : globalThis);
