/* ==========================================================================
   Plantillas de operaciones terrestres de nivel táctico (brigada / batallón)
   --------------------------------------------------------------------------
   Cada plantilla prepara el esqueleto de una confrontación: fases, sectores,
   métodos de confrontación, turnos, eventos críticos, criterios de selección,
   CCIR y supuestos tipo. Los contenidos son guías de partida (APP-28(B),
   FM 3-90, ATP 3-90.4, ATP 3-06): el EM los sustituye por los de su plan.
   ========================================================================== */
(function (global) {
  'use strict';
  const T = (m, label, title, time, ce) => ({ m, label, title, time, ce: ce || '' });
  const CE = (id, title, dc) => ({ id, title, step: '', dc: dc || '', dp: '', ccir: '', r: {}, cr: '' });
  const CRIT = [
    { id: 'C1', name: 'Masa en el punto decisivo', w: 3, q: '¿Consigue la COA la correlación de fuerzas mínima en el punto de contacto del esfuerzo principal?' },
    { id: 'C2', name: 'Riesgo / bajas', w: 3, q: '¿Se mantiene la potencia del esfuerzo principal por encima del umbral FFIR?' },
    { id: 'C3', name: 'Tiempo / ritmo', w: 2, q: '¿Se alcanzan las condiciones decisivas dentro de la ventana prevista?' },
    { id: 'C4', name: 'Flexibilidad', w: 2, q: '¿Dispone el comandante de reserva y de ramas frente a la COA enemiga más peligrosa?' },
    { id: 'C5', name: 'Simplicidad / C2', w: 1, q: '¿Es la COA sencilla de mandar y sincronizar?' }
  ];
  const CCIR = (pir1, pir2, eefi) => [
    { id: 'PIR-1', type: 'PIR', q: pir1, feeds: '', nai: '', st: 'OPEN' },
    { id: 'PIR-2', type: 'PIR', q: pir2, feeds: '', nai: '', st: 'OPEN' },
    { id: 'FFIR-1', type: 'FFIR', q: 'Potencia de combate del esfuerzo principal por debajo del umbral FFIR.', feeds: '', nai: '', st: 'OPEN' },
    { id: 'EEFI-1', type: 'EEFI', q: eefi, feeds: '', nai: '', st: 'OPEN' }
  ];
  const AS = (a1, a2) => [
    { id: 'A1', text: a1, fail: '', status: 'UNTESTED' },
    { id: 'A2', text: a2, fail: '', status: 'UNTESTED' }
  ];
  const M = (critical, belt, box, avenue) => ({ critical: !!critical, belt: !!belt, box: !!box, avenue: !!avenue });

  const LIST = {
    blank: { l: 'En blanco', d: 'Sin estructura previa. Para un planeamiento propio o para importarlo de un documento con la IA.',
      methods: M(1, 0, 0, 0), sectors: [['S1', 'Sector 1']], phases: [['F1', 'FASE 1', 'H → H+12', '']],
      turns: [T('critical', 'KEY EVENT 1', 'Evento crítico 1', 'H → H+12', 'CE1')], ces: [CE('CE1', 'Evento crítico 1')], tasks: ['hastyDef', 'hastyAtk'] },
    delibAtk: { l: 'Ataque deliberado', d: 'Aproximación, ruptura de obstáculos, asalto al objetivo y consolidación frente a una defensa preparada.',
      methods: M(1, 0, 1, 1), sectors: [['N', 'Eje NORTE'], ['S', 'Eje SUR'], ['OBJ', 'Objetivo']],
      phases: [['F1', 'FASE I · APROXIMACIÓN', 'H-6 → H', 'Avance hasta la LD/LC'], ['F2', 'FASE II · RUPTURA', 'H → H+3', 'Brecha en el cinturón de obstáculos'], ['F3', 'FASE III · ASALTO', 'H+3 → H+8', 'Conquista del objetivo'], ['F4', 'FASE IV · CONSOLIDACIÓN', 'H+8 → H+12', 'Reorganización y rechazo del contraataque']],
      turns: [T('avenue', 'SEGMENT 1', 'Aproximación hasta la LD/LC', 'H-6 → H'), T('box', 'BOX A', 'Ruptura del cinturón de obstáculos', 'H → H+3', 'CE1'), T('critical', 'KEY EVENT 1', 'Asalto al objetivo', 'H+3 → H+8', 'CE2'), T('critical', 'KEY EVENT 2', 'Contraataque enemigo y consolidación', 'H+8 → H+12', 'CE3')],
      ces: [CE('CE1', 'Ruptura del obstáculo', 'Brecha abierta'), CE('CE2', 'Asalto al objetivo', 'OBJ conquistado'), CE('CE3', 'Rechazo del contraataque enemigo', 'OBJ consolidado')],
      ccir: CCIR('¿Dónde y cuándo se empeña la reserva enemiga?', '¿Composición y profundidad del cinturón de obstáculos?', 'Eje del esfuerzo principal y punto de ruptura.'),
      as: AS('El enemigo defiende en posiciones preparadas con un cinturón de obstáculos completo.', 'Se dispone de superioridad de fuegos durante la ruptura.'), tasks: ['delibAtk', 'hastyAtk', 'hastyDef'] },
    areaDef: { l: 'Defensa de zona', d: 'Zona de seguridad, combate en las zonas de enfrentamiento (EA) de la zona principal y contraataque de la reserva.',
      methods: M(1, 1, 0, 0), sectors: [['SA', 'Zona de seguridad'], ['EA1', 'EA NORTE'], ['EA2', 'EA SUR']],
      phases: [['F1', 'FASE I · ZONA DE SEGURIDAD', 'H → H+6', 'Cobertura y desgaste'], ['F2', 'FASE II · ZONA PRINCIPAL', 'H+6 → H+18', 'Destrucción en las EA'], ['F3', 'FASE III · CONTRAATAQUE', 'H+18 → H+24', 'Restablecimiento']],
      turns: [T('belt', 'BELT 1', 'Combate en la zona de seguridad', 'H → H+6'), T('belt', 'BELT 2', 'Combate en las EA de la zona principal', 'H+6 → H+18', 'CE1'), T('critical', 'KEY EVENT 1', 'Penetración enemiga y empeño de la reserva', 'H+12 → H+18', 'CE2'), T('critical', 'KEY EVENT 2', 'Contraataque y restablecimiento del FEBA', 'H+18 → H+24', 'CE3')],
      ces: [CE('CE1', 'Destrucción del primer escalón en las EA', 'Primer escalón detenido'), CE('CE2', 'Empeño de la reserva', 'Penetración contenida'), CE('CE3', 'Contraataque', 'FEBA restablecido')],
      ccir: CCIR('¿Por qué avenida se empeña el esfuerzo principal enemigo?', '¿Cuándo se empeña su segundo escalón?', 'Posición y composición de la reserva propia.'),
      as: AS('El enemigo ataca con su esfuerzo principal por la avenida NORTE.', 'Hay tiempo suficiente para preparar posiciones y obstáculos.'), tasks: ['delibDef', 'hastyDef', 'screen', 'catk'] },
    mobDef: { l: 'Defensa móvil', d: 'Una fuerza de fijación canaliza al enemigo y una fuerza de golpe lo destruye en un área de destrucción.',
      methods: M(1, 1, 1, 0), sectors: [['FIX', 'Zona de fijación'], ['KZ', 'Área de destrucción'], ['RES', 'Retaguardia / reserva']],
      phases: [['F1', 'FASE I · CANALIZACIÓN', 'H → H+8', 'Fijación del enemigo'], ['F2', 'FASE II · GOLPE', 'H+8 → H+14', 'Destrucción en el área de destrucción'], ['F3', 'FASE III · EXPLOTACIÓN', 'H+14 → H+20', 'Restablecimiento']],
      turns: [T('belt', 'BELT 1', 'Fijación y canalización', 'H → H+8', 'CE1'), T('box', 'BOX A', 'Golpe en el área de destrucción', 'H+8 → H+14', 'CE2'), T('critical', 'KEY EVENT 1', 'Reacción del segundo escalón enemigo', 'H+14 → H+20', 'CE3')],
      ces: [CE('CE1', 'El enemigo entra en el área de destrucción', 'Enemigo canalizado'), CE('CE2', 'Golpe de la fuerza de choque', 'Enemigo destruido'), CE('CE3', 'Segundo escalón enemigo', 'Zona restablecida')],
      ccir: CCIR('¿Entra el esfuerzo principal enemigo en el área de destrucción?', '¿Dónde está el segundo escalón enemigo?', 'Situación de la fuerza de golpe.'),
      as: AS('La fuerza de fijación puede canalizar al enemigo sin quedar fijada.', 'La fuerza de golpe llega a tiempo al área de destrucción.'), tasks: ['delibDef', 'catk', 'hastyAtk'] },
    delay: { l: 'Acción retardadora', d: 'Retardo por líneas sucesivas, intercambiando terreno por tiempo sin quedar decisivamente empeñado.',
      methods: M(1, 1, 0, 0), sectors: [['N', 'Faja NORTE'], ['S', 'Faja SUR']],
      phases: [['F1', 'FASE I · PL ALFA', 'H → H+8', 'Retardo en la primera línea'], ['F2', 'FASE II · PL BRAVO', 'H+8 → H+16', 'Retardo en la segunda línea'], ['F3', 'FASE III · RELEVO', 'H+16 → H+24', 'Paso de escalón y entrega']],
      turns: [T('belt', 'BELT 1', 'Retardo en PL ALFA', 'H → H+8'), T('belt', 'BELT 2', 'Retardo en PL BRAVO', 'H+8 → H+16', 'CE1'), T('critical', 'KEY EVENT 1', 'Ruptura del contacto y paso de escalón', 'H+16 → H+24', 'CE2')],
      ces: [CE('CE1', 'Mantener PL BRAVO hasta H+16', 'Tiempo ganado'), CE('CE2', 'Ruptura del contacto y paso de escalón', 'Fuerza intacta')],
      ccir: CCIR('¿Intenta el enemigo envolver las posiciones de retardo?', '¿Ritmo de avance enemigo por faja?', 'Itinerarios de repliegue.'),
      as: AS('El enemigo no puede envolver por los flancos.', 'Los itinerarios de repliegue permanecen expeditos.'), tasks: ['delay', 'withdraw', 'screen', 'hastyDef'] },
    gap: { l: 'Paso de curso de agua', d: 'Paso de río disputado: asalto, cabeza de puente inicial, ampliación y ruptura.',
      methods: M(1, 0, 1, 0), sectors: [['XS1', 'Punto de paso 1'], ['XS2', 'Punto de paso 2'], ['BH', 'Cabeza de puente']],
      phases: [['F1', 'FASE I · ASALTO', 'H → H+4', 'Asalto a la orilla opuesta'], ['F2', 'FASE II · CABEZA DE PUENTE', 'H+4 → H+12', 'Línea de cabeza de puente'], ['F3', 'FASE III · RUPTURA', 'H+12 → H+24', 'Ruptura y continuación']],
      turns: [T('box', 'BOX A', 'Asalto en los puntos de paso', 'H → H+4', 'CE1'), T('critical', 'KEY EVENT 1', 'Contraataque contra la cabeza de puente', 'H+4 → H+12', 'CE2'), T('critical', 'KEY EVENT 2', 'Ruptura desde la cabeza de puente', 'H+12 → H+24', 'CE3')],
      ces: [CE('CE1', 'Asalto a la orilla opuesta', 'Orilla lejana asegurada'), CE('CE2', 'Rechazo del contraataque', 'Cabeza de puente mantenida'), CE('CE3', 'Ruptura', 'Continuación del ataque')],
      ccir: CCIR('¿Defiende el enemigo en la orilla o en profundidad?', '¿Dónde está su reserva móvil?', 'Puntos de paso elegidos.'),
      as: AS('Los puntos de paso permiten el tendido de puentes en menos de 4 horas.', 'Se mantiene la superioridad aérea local sobre los puntos de paso.'), tasks: ['gapX', 'hastyDef', 'hastyAtk'] },
    amph: { l: 'Asalto anfibio (componente terrestre)', d: 'Movimiento buque-costa, cabeza de playa, rechazo del contraataque y explotación hacia el objetivo de la fuerza.',
      methods: M(1, 0, 1, 1), sectors: [['B1', 'Playa 1'], ['B2', 'Playa 2'], ['INT', 'Interior / objetivo']],
      phases: [['F1', 'FASE I · BUQUE-COSTA', 'H → H+4', 'Asalto a las playas'], ['F2', 'FASE II · CABEZA DE PLAYA', 'H+4 → H+12', 'Línea de cabeza de playa'], ['F3', 'FASE III · EXPLOTACIÓN', 'H+12 → H+24', 'Objetivo de la fuerza']],
      turns: [T('box', 'BOX A', 'Asalto a las playas (Hora H)', 'H → H+4', 'CE1'), T('critical', 'KEY EVENT 1', 'Contraataque de la reserva móvil', 'H+4 → H+12', 'CE2'), T('avenue', 'SEGMENT 1', 'Explotación hacia el objetivo de la fuerza', 'H+12 → H+24', 'CE3')],
      ces: [CE('CE1', 'Asalto a las playas', 'Playas aseguradas'), CE('CE2', 'Rechazo del contraataque', 'Cabeza de playa mantenida'), CE('CE3', 'Conquista del objetivo de la fuerza', 'Objetivo asegurado')],
      ccir: CCIR('¿Defiende el enemigo en la línea de agua o en profundidad?', '¿Cuándo y por dónde contraataca su reserva móvil?', 'Playas y Hora H.'),
      as: AS('Se dispone de fuego naval de apoyo y de apoyo aéreo cercano hasta H+12.', 'El estado de la mar permite el movimiento buque-costa.'), tasks: ['amphAslt', 'hastyDef', 'hastyAtk', 'airAslt'] },
    urban: { l: 'Operación en zona urbana', d: 'Aislamiento, entrada (pie en la localidad), limpieza por sectores y transición.',
      methods: M(1, 0, 1, 0), sectors: [['ISO', 'Cordón exterior'], ['U1', 'Sector urbano 1'], ['U2', 'Sector urbano 2']],
      phases: [['F1', 'FASE I · AISLAMIENTO', 'D → D+1', 'Aislamiento de la localidad'], ['F2', 'FASE II · ENTRADA', 'D+1 → D+2', 'Pie en la localidad'], ['F3', 'FASE III · LIMPIEZA', 'D+2 → D+5', 'Limpieza por sectores'], ['F4', 'FASE IV · TRANSICIÓN', 'D+5 →', 'Estabilización']],
      turns: [T('critical', 'KEY EVENT 1', 'Aislamiento de la localidad', 'D → D+1', 'CE1'), T('box', 'BOX A', 'Entrada y pie en la localidad', 'D+1 → D+2', 'CE2'), T('box', 'BOX B', 'Limpieza del sector urbano', 'D+2 → D+5', 'CE3')],
      ces: [CE('CE1', 'Aislamiento completo', 'Localidad aislada'), CE('CE2', 'Pie en la localidad', 'Cabeza urbana asegurada'), CE('CE3', 'Limpieza', 'Sectores asegurados')],
      ccir: CCIR('¿Dónde están los puntos fuertes y los itinerarios subterráneos?', '¿Situación y movimientos de la población civil?', 'Puntos de entrada.'),
      as: AS('La población civil puede ser evacuada o protegida durante la entrada.', 'Las ROE permiten el empleo de fuegos indirectos en la periferia.'), tasks: ['urbanAtk', 'delibAtk', 'hastyDef', 'screen'] },
    airAslt: { l: 'Asalto aéreo', d: 'Cobertura de la ruta, asalto a las zonas de aterrizaje, defensa de la cabeza aérea y enlace con la fuerza terrestre.',
      methods: M(1, 0, 1, 1), sectors: [['LZ', 'Zonas de aterrizaje'], ['AH', 'Cabeza aérea'], ['LNK', 'Eje de enlace']],
      phases: [['F1', 'FASE I · ASALTO', 'H → H+3', 'Asalto a las LZ'], ['F2', 'FASE II · CABEZA AÉREA', 'H+3 → H+18', 'Defensa de la cabeza aérea'], ['F3', 'FASE III · ENLACE', 'H+18 → H+24', 'Enlace con la fuerza terrestre']],
      turns: [T('box', 'BOX A', 'Asalto a las zonas de aterrizaje', 'H → H+3', 'CE1'), T('critical', 'KEY EVENT 1', 'Contraataque enemigo contra la cabeza aérea', 'H+3 → H+18', 'CE2'), T('avenue', 'SEGMENT 1', 'Enlace con la fuerza terrestre', 'H+18 → H+24', 'CE3')],
      ces: [CE('CE1', 'Asalto a las LZ', 'LZ aseguradas'), CE('CE2', 'Defensa de la cabeza aérea', 'Cabeza aérea mantenida'), CE('CE3', 'Enlace', 'Enlace efectuado')],
      ccir: CCIR('¿Defensa antiaérea enemiga en la ruta y en las LZ?', '¿Tiempo de reacción de la reserva enemiga?', 'Rutas y LZ.'),
      as: AS('La supresión de la defensa antiaérea enemiga se completa antes de H.', 'La fuerza terrestre enlaza antes de H+24.'), tasks: ['airAslt', 'hastyDef', 'delibDef'] },
    mtc: { l: 'Movimiento para el contacto', d: 'Avance con vanguardia, combate de encuentro y ataque precipitado o rebase.',
      methods: M(1, 0, 0, 1), sectors: [['AX1', 'Eje 1'], ['AX2', 'Eje 2']],
      phases: [['F1', 'FASE I · AVANCE', 'H → H+6', 'Avance hasta el contacto'], ['F2', 'FASE II · ENCUENTRO', 'H+6 → H+10', 'Combate de encuentro'], ['F3', 'FASE III · ATAQUE', 'H+10 → H+16', 'Ataque precipitado o rebase']],
      turns: [T('avenue', 'SEGMENT 1', 'Avance de la vanguardia', 'H → H+6'), T('critical', 'KEY EVENT 1', 'Combate de encuentro', 'H+6 → H+10', 'CE1'), T('critical', 'KEY EVENT 2', 'Ataque precipitado o rebase', 'H+10 → H+16', 'CE2')],
      ces: [CE('CE1', 'Combate de encuentro', 'Iniciativa mantenida'), CE('CE2', 'Ataque precipitado', 'Enemigo destruido o rebasado')],
      ccir: CCIR('¿Dónde se produce el primer contacto?', '¿Entidad de la fuerza enemiga en contacto?', 'Eje principal.'),
      as: AS('El enemigo está en movimiento y no ha preparado posiciones.', 'La vanguardia puede fijar al enemigo hasta la llegada del grueso.'), tasks: ['meeting', 'hastyAtk', 'screen'] }
  };

  /* Aplica la plantilla sobre una operación en blanco. */
  function apply(op, key, name) {
    const P = LIST[key] || LIST.blank;
    op.opType = key;
    op.meta.title = name || P.l;
    op.sectors = P.sectors.map(s => ({ id: s[0], name: s[1] }));
    op.phases = P.phases.map(p => ({ id: p[0], n: p[1], t: p[2], me: '', dc: '', otg: '', d: p[3] }));
    op.turns = P.turns.map((x, i) => Object.assign({ id: 't' + (i + 1), sim: true }, x));
    op.ces = JSON.parse(JSON.stringify(P.ces || []));
    op.prep.methods = Object.assign({}, P.methods);
    op.prep.ceSel = op.ces.map(c => c.id);
    op.prep.assumptions = JSON.parse(JSON.stringify(P.as || []));
    op.inputs.criteria = key === 'blank' ? [] : JSON.parse(JSON.stringify(CRIT));
    if (P.ccir) op.reg.ccir = JSON.parse(JSON.stringify(P.ccir));
    op.ecoas = [
      { id: 'ECOA-1', name: 'ECOA 1 (MLCOA)', tag: 'MLCOA', lik: 60, text: '', bySector: {}, plan: {} },
      { id: 'ECOA-2', name: 'ECOA 2 (MDCOA)', tag: 'MDCOA', lik: 40, text: '', bySector: {}, plan: {} }
    ];
    op.coas = [{ id: 'COA-1', name: 'COA 1', stmt: '', plan: {} }, { id: 'COA-2', name: 'COA 2', stmt: '', plan: {} }];
    op.prep.coa = 'COA-1'; op.prep.acoa = 'ECOA-1';
    op.ui.planTurn = op.turns[0] ? op.turns[0].id : '';
    return op;
  }

  /* ORBAT por texto: CSV / TSV / «;». Con cabecera, por nombre de columna;
     sin cabecera: id · bando · nombre · escalón · tipo · superior · F.E. o tipo F.E. · CP % · cometido. */
  const HDR = { id: 'id', side: 'side', bando: 'side', name: 'name', nombre: 'name', designacion: 'name', ech: 'ech', escalon: 'ech', echelon: 'ech',
    type: 'type', tipo: 'type', funcion: 'type', p: 'p', parent: 'p', superior: 'p', fe: 'fe', 'f.e.': 'fe', frt: 'frT', tipofe: 'frT', 'tipo_fe': 'frT',
    qty: 'frQ', cantidad: 'frQ', frq: 'frQ', cp: 'cp', potencia: 'cp', pers: 'pers', personal: 'pers', equip: 'equip', material: 'equip', role: 'role', cometido: 'role', loc: 'loc', ubicacion: 'loc' };
  const ORDER = ['id', 'side', 'name', 'ech', 'type', 'p', 'fe', 'cp', 'role'];
  const ECH_ALIAS = { equipo: 'team', escuadra: 'squad', pelotón: 'platoon', peloton: 'platoon', seccion: 'platoon', sección: 'platoon', compañía: 'company', compania: 'company', cia: 'company', 'cía': 'company', batería: 'company', bateria: 'company', escuadrón: 'company', escuadron: 'company',
    batallón: 'battalion', batallon: 'battalion', bon: 'battalion', bn: 'battalion', grupo: 'regiment', regimiento: 'regiment', rgto: 'regiment', brigada: 'brigade', bde: 'brigade', bda: 'brigade', división: 'division', division: 'division', div: 'division', cuerpo: 'corps', ejército: 'army', coy: 'company', btn: 'battalion' };
  function parseOrbat(text, C) {
    const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(s => s && !/^#/.test(s));
    if (!lines.length) return { units: [], warn: [] };
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
    let cols = ORDER, start = 0;
    const first = lines[0].split(sep).map(norm);
    if (first.filter(h => HDR[h]).length >= 2) { cols = first.map(h => HDR[h] || ''); start = 1; }
    const types = new Set(C.TYPES.map(x => x[0])), warn = [], units = [];
    for (let i = start; i < lines.length; i++) {
      const v = lines[i].split(sep).map(s => s.trim()), r = {};
      cols.forEach((k, j) => { if (k && v[j] != null && v[j] !== '') r[k] = v[j]; });
      if (!r.name && !r.id) continue;
      const side = /^(r|red|rojo|roja|e|enemy|enemigo|op|opfor|adversario)/i.test(r.side || '') ? 'R' : 'B';
      let ech = String(r.ech || 'battalion').toLowerCase(); ech = ECH_ALIAS[ech] || ech; if (C.ECHO.indexOf(ech) < 0) { warn.push((r.name || r.id) + ': escalón «' + r.ech + '» → battalion'); ech = 'battalion'; }
      let type = String(r.type || 'infantry').toLowerCase(); if (!types.has(type)) { warn.push((r.name || r.id) + ': tipo «' + r.type + '» → infantry'); type = 'infantry'; }
      const u = { id: r.id || ('u' + i + '-' + Math.random().toString(36).slice(2, 6)), p: r.p || null, side, name: r.name || r.id, type, ech, pers: r.pers || '', equip: r.equip || '', role: r.role || '', frT: '', frQ: r.frQ ? parseFloat(String(r.frQ).replace(',', '.')) || 1 : 1, frFE: 0, cp: r.cp ? Math.max(0, Math.min(100, parseFloat(r.cp) || 100)) : 100, loc: r.loc || '' };
      const fe = r.fe != null ? String(r.fe) : (r.frT || '');
      if (fe) { const n = parseFloat(fe.replace(',', '.')); if (!isNaN(n) && /^[\d.,\s]+$/.test(fe)) { u.frT = 'Custom F.E.'; u.frFE = n; } else if (C.FRMAP[fe] != null) u.frT = fe; else warn.push(u.name + ': tipo F.E. «' + fe + '» no está en el catálogo'); }
      if (r.frT && C.FRMAP[r.frT] != null) u.frT = r.frT;
      units.push(u);
    }
    const ids = new Set(units.map(u => u.id)), byName = {}; units.forEach(u => { byName[u.name.toLowerCase()] = u.id; });
    units.forEach(u => { if (u.p && !ids.has(u.p)) { const k = byName[String(u.p).toLowerCase()]; if (k) u.p = k; else { warn.push(u.name + ': superior «' + u.p + '» no encontrada'); u.p = null; } } });
    return { units, warn };
  }

  global.WGTemplates = { LIST, apply, parseOrbat };
})(typeof window !== 'undefined' ? window : globalThis);
