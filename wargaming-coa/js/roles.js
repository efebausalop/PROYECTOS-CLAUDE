/* ==========================================================================
   Roles de la confrontación (APP-28(B) Anexo D · FM 5-0 · Wargaming Handbook)
   --------------------------------------------------------------------------
   - Catálogo de participantes con responsabilidades y listas de comprobación.
   - «Rol activo» en la cabecera: filtra la vista de la confrontación (aislamiento
     de las células azul y roja) y destaca la aportación de cada función.
   - Aportación por función y turno: se guarda en la matriz de sincronización
     de la pareja COA × ECOA (game.sync[función][turno]).
   ========================================================================== */
(function (global) {
  'use strict';
  const U = global.WGUI;
  const { esc, t, fTa, fIn, fChk, secH, card } = U;

  /* Funciones de la matriz de sincronización (fila · etiqueta). */
  U.FUNCS = [['c2', 'Mando y control'], ['intel', 'Inteligencia'], ['man', 'Maniobra'], ['fires', 'Fuegos'], ['eng', 'Ingenieros (movilidad / contramovilidad)'],
    ['info', 'Información'], ['cimic', 'CIMIC'], ['sust', 'Sostenimiento'], ['pers', 'Personal (bajas y reemplazos)'], ['prot', 'Protección de la fuerza'], ['legal', 'Asesoría jurídica (ROE / DIH)']];

  /* cell: white = ve las tres células · blue / red = aislamiento de célula · staff = célula azul + su función. */
  const ROLES = [
    { k: 'cmd', l: 'Comandante', cell: 'white', go: ['results', 'stats'],
      resp: ['Aprueba la guía de planeamiento para la confrontación y los criterios de selección.', 'Asiste a los eventos críticos y DP clave; decide ramas y secuelas.', 'Recibe la exposición de resultados y elige o refina la COA.'],
      prep: ['Guía para la confrontación difundida', 'Criterios de evaluación ponderados', 'COA enemigas de referencia aprobadas (MLCOA / MDCOA)'],
      turn: ['¿Se cumple mi intención en este turno?', '¿Necesito una decisión (DP) o una rama?', '¿Acepto el riesgo resultante?'] },
    { k: 'dir', l: 'Director de la confrontación (JEM / 2.º jefe)', cell: 'white', go: ['prep', 'wargame', 'roles'],
      resp: ['Dirige la sesión: método, técnica, reglas del juego y plan de tiempos.', 'Mantiene la disciplina: objetividad, no defender una COA, registrar todo.', 'Decide cuándo cerrar el turno y pasar al siguiente; arbitra las discrepancias de procedimiento.'],
      prep: ['Preparación al 100 % (sección Preparación)', 'Papeles asignados y presentes', 'Plano, superposiciones y fichas listos', 'Plan de tiempos difundido'],
      turn: ['¿Se ha seguido la secuencia acción · reacción · contrarreacción?', '¿Quedan registrados resultado, DP, CCIR y ramas?', '¿Vamos dentro del plan de tiempos?'] },
    { k: 'arb', l: 'Árbitro (célula blanca)', cell: 'white', go: ['wargame', 'adj', 'fr'],
      resp: ['Adjudica cada enfrentamiento con tablas, correlación de fuerzas, dados y juicio experto.', 'Impone resultado, bajas y modificadores cuando el motor no refleja la situación.', 'Justifica cada adjudicación y señala riesgos e hipótesis no comprobadas.'],
      prep: ['Método de adjudicación definido', 'Parámetros del motor revisados (Datos y método)', 'Tablas de daños y ratios aceptados por ambas células'],
      turn: ['¿Es la correlación en el punto de contacto suficiente para la tarea?', '¿Qué modificadores (terreno, sorpresa, fuegos, moral, ISR) son justos?', '¿Coincide mi juicio con el motor? Si no, ¿por qué?'] },
    { k: 'rec', l: 'Registrador', cell: 'white', go: ['wargame', 'results'],
      resp: ['Registra cada turno en la hoja de confrontación (War Game Worksheet).', 'Mantiene la matriz de sincronización y la superposición / matriz de apoyo a la decisión.', 'Anota supuestos comprobados, CCIR respondidos y ramas identificadas.'],
      prep: ['Hoja de registro preparada', 'Matriz de sincronización con turnos y funciones'],
      turn: ['¿Están completos acción, reacción, contrarreacción y resultado?', '¿Se ha anotado el DP y el CCIR del turno?', '¿Hay aportaciones de todas las funciones?'] },
    { k: 's3', l: 'Jefe de la célula azul (S3 / G3 · Operaciones)', cell: 'blue', fn: 'man', go: ['plans', 'wargame'],
      resp: ['Plantea la acción azul: unidades, cometidos, movimiento, fuegos y sostenimiento.', 'Formula la contrarreacción: empleo de la reserva, ataque al HPT, ramas.', 'Mantiene la COA en conformidad con la intención; propone su refinamiento.'],
      prep: ['Enfrentamientos de cada COA definidos por turno (Planes)', 'Esfuerzo principal y reserva identificados', 'Medidas de control preparadas'],
      turn: ['¿Qué hace cada unidad, dónde y con qué propósito?', '¿Dónde está el esfuerzo principal y qué ratio alcanza?', '¿Cuándo y dónde empeño la reserva?'] },
    { k: 's2', l: 'Jefe de la célula roja (S2 / G2 · Inteligencia)', cell: 'red', fn: 'intel', go: ['inputs', 'plans', 'reg'],
      resp: ['Juega al adversario según su doctrina, capacidades y la COA enemiga del IPOE, con el máximo realismo y libre albedrío.', 'Dirige la pre-acción y la reacción roja; propone contramaniobras y sorpresas.', 'Actualiza PIR, NAI, HVT y los DP enemigos; evalúa el efecto sobre el adversario.'],
      prep: ['COA enemigas con despliegue por turno', 'DP enemigos registrados', 'PIR y NAI vinculados'],
      turn: ['¿Cómo reacciona el comandante enemigo ante la acción azul?', '¿Qué HVT protege y dónde está su reserva?', '¿Qué indicador lo revela (NAI / PIR)?'] },
    { k: 'fso', l: 'Coordinador de fuegos (FSCOORD / JFSE)', cell: 'staff', fn: 'fires', go: ['reg', 'wargame'],
      resp: ['Sincroniza los fuegos indirectos, aéreos y navales con la maniobra.', 'Mantiene HPT, TAI y la matriz de ataque a objetivos (decidir · detectar · atacar · evaluar).', 'Evalúa el consumo de munición y la disponibilidad de medios.'],
      prep: ['HPT y TAI registrados', 'Medidas de coordinación de fuegos preparadas'],
      turn: ['¿Qué HPT se ataca en este turno y con qué medio?', '¿Qué efecto se consigue (destruir, neutralizar, suprimir)?', '¿Hay riesgo de fratricidio o de daños colaterales?'] },
    { k: 'eng', l: 'Ingenieros', cell: 'staff', fn: 'eng', go: ['wargame'],
      resp: ['Analiza movilidad, contramovilidad y supervivencia en cada turno.', 'Planea rupturas de obstáculos, pasos de cursos de agua y obstáculos propios.', 'Estima tiempos y medios de ingenieros necesarios.'],
      prep: ['Obstáculos enemigos y propios en la superposición', 'Medios de ingenieros asignados'],
      turn: ['¿Qué obstáculos afectan a la maniobra?', '¿Qué medios de ruptura o de paso hacen falta y cuánto tardan?', '¿Qué obstáculos propios apoyan la defensa?'] },
    { k: 's1', l: 'Personal (S1 / G1)', cell: 'staff', fn: 'pers', go: ['wargame', 'results'],
      resp: ['Estima bajas por turno y su efecto sobre la potencia de combate.', 'Planea reemplazos, evacuación sanitaria y prisioneros.', 'Señala cuándo una unidad cae por debajo del umbral FFIR.'],
      prep: ['Tasas de bajas aceptadas', 'Plan de evacuación sanitaria'],
      turn: ['¿Cuántas bajas y en qué unidades?', '¿Puede la cadena sanitaria evacuarlas a tiempo (regla 10-1-2)?', '¿Hace falta reconstituir alguna unidad?'] },
    { k: 's4', l: 'Logística (S4 / G4)', cell: 'staff', fn: 'sust', go: ['inputs', 'wargame'],
      resp: ['Comprueba la sostenibilidad de la COA: consumos de munición, combustible y repuestos.', 'Sitúa los puntos de abastecimiento y los itinerarios logísticos.', 'Actualiza la estimación logística y señala los puntos de culminación.'],
      prep: ['Estimación logística actualizada', 'Itinerarios y puntos de abastecimiento'],
      turn: ['¿Qué consume este turno y queda suficiente?', '¿Están los itinerarios logísticos amenazados?', '¿Se acerca algún punto de culminación?'] },
    { k: 's6', l: 'Sistemas de información y telecomunicaciones (S6 / G6)', cell: 'staff', fn: 'c2', go: ['wargame'],
      resp: ['Asegura el mando y control: enlaces, plan PACE y relés.', 'Evalúa el efecto de la guerra electrónica enemiga.', 'Planea el despliegue de los puestos de mando.'],
      prep: ['Plan PACE', 'Despliegue de PC por fases'],
      turn: ['¿Mantienen enlace las unidades en contacto?', '¿Qué efecto tiene la GE enemiga?', '¿Hay que desplazar algún PC?'] },
    { k: 's9', l: 'CIMIC (S9 / G9)', cell: 'staff', fn: 'cimic', go: ['wargame'],
      resp: ['Evalúa el efecto de la operación sobre la población y las infraestructuras civiles.', 'Planea el control de desplazados y la coordinación con autoridades y organizaciones.', 'Señala restricciones civiles que afectan a la maniobra.'],
      prep: ['Población, desplazados e infraestructuras críticas identificados'],
      turn: ['¿Afecta este turno a la población o a infraestructuras críticas?', '¿Hay movimientos de desplazados en los itinerarios?', '¿Qué coordinación civil hace falta?'] },
    { k: 'io', l: 'Información (Info Ops / PSYOPS / Comunicación)', cell: 'staff', fn: 'info', go: ['wargame'],
      resp: ['Integra las actividades de información con la maniobra.', 'Anticipa la narrativa enemiga y sus efectos sobre la población y la fuerza.', 'Protege los EEFI y la seguridad de las operaciones.'],
      prep: ['Mensajes clave y públicos objetivo', 'EEFI definidos'],
      turn: ['¿Qué actividad de información apoya este turno?', '¿Qué narrativa enemiga cabe esperar?', '¿Se compromete algún EEFI?'] },
    { k: 'prot', l: 'Protección (DAA · NBQ · Policía Militar)', cell: 'staff', fn: 'prot', go: ['wargame'],
      resp: ['Evalúa las amenazas aéreas, UAS, NBQ y a la retaguardia.', 'Prioriza la defensa antiaérea y la protección de activos críticos.', 'Planea la seguridad de itinerarios y el control de movimientos.'],
      prep: ['Lista de activos críticos y defendidos', 'Amenaza aérea y UAS evaluada'],
      turn: ['¿Qué activos críticos están amenazados en este turno?', '¿Está cubierta la amenaza aérea y UAS?', '¿Hay riesgo NBQ o en la retaguardia?'] },
    { k: 'legal', l: 'Asesor jurídico (LEGAD)', cell: 'staff', fn: 'legal', go: ['wargame'],
      resp: ['Verifica la conformidad con las ROE y el Derecho Internacional Humanitario.', 'Asesora sobre objetivos protegidos, distinción y proporcionalidad.', 'Señala las solicitudes de ROE adicionales.'],
      prep: ['ROE en vigor y solicitudes previstas'],
      turn: ['¿Es lícito el ataque a los objetivos de este turno?', '¿Hay riesgo de daños colaterales desproporcionados?', '¿Hace falta solicitar ROE adicionales?'] }
  ];
  U.ROLES = ROLES;
  const byK = {}; ROLES.forEach(r => { byK[r.k] = r; });
  U.role = () => byK[U.store.role] || null;
  /* Célula impuesta por el rol activo (null = sin restricción). */
  U.roleCell = () => { const r = U.role(); if (!r) return null; return r.cell === 'red' ? 'red' : r.cell === 'white' ? null : 'blue'; };
  U.fnLabel = k => { const f = U.FUNCS.find(x => x[0] === k); return f ? t(f[1]) : k; };

  function ensureRoles(o) {
    o.roles = o.roles || {}; o.roles.people = o.roles.people || {}; o.roles.chk = o.roles.chk || {}; o.roles.present = o.roles.present || {};
    return o.roles;
  }

  /* Selector de rol de la cabecera. */
  U.renderRoleSel = function () {
    const s = document.getElementById('roleSel'); if (!s) return;
    s.innerHTML = `<option value="">${esc(t('Rol: todos'))}</option>` + ROLES.map(r => `<option value="${r.k}"${U.store.role === r.k ? ' selected' : ''}>${esc(t(r.l))}</option>`).join('');
    s.title = t('Rol activo: adapta la confrontación a la célula y función de quien la usa');
    s.setAttribute('aria-label', s.title);
  };
  document.addEventListener('change', e => {
    if (e.target.id !== 'roleSel') return;
    U.store.role = e.target.value; U.save(true); U.render();
    const r = U.role(); U.toast(r ? t('Rol activo: {r}', { r: t(r.l) }) : t('Vista completa'));
  });

  /* =============================== ROLES Y PARTICIPANTES =============================== */
  U.R.roles = function () {
    const o = U.op(), R = ensureRoles(o), act = U.role();
    let h = secH(t('Roles y participantes'), t('Organización de la confrontación: quién hace qué, qué ve cada célula y qué aporta cada función en cada turno. Elija su rol en la cabecera para adaptar las vistas.'));
    h += card(t('Organización de la sesión'),
      `<div class="tw"><table class="t"><thead><tr><th style="width:36px"></th><th>${t('Rol')}</th><th style="width:120px">${t('Célula')}</th><th style="width:260px">${t('Empleo y nombre')}</th><th style="width:150px">${t('Función en la matriz')}</th><th style="width:110px"></th></tr></thead><tbody>` +
      ROLES.map(r => `<tr class="${act && act.k === r.k ? 'sel' : ''}"><td><input type="checkbox" data-b="roles.present.${r.k}"${R.present[r.k] ? ' checked' : ''} aria-label="${t('Presente')}"></td><td><b>${esc(t(r.l))}</b></td>
        <td>${cellTag(r.cell)}</td><td>${fIn('roles.people.' + r.k, t('p. ej. Cte. García'))}</td><td class="small">${r.fn ? esc(U.fnLabel(r.fn)) : '—'}</td>
        <td><button class="btn sm ${act && act.k === r.k ? 'gold' : ''}" data-a="setRole" data-k="${r.k}">${act && act.k === r.k ? '✓ ' + t('Activo') : t('Usar este rol')}</button></td></tr>`).join('') +
      `</tbody></table></div><p class="small muted">${t('Marque los presentes. Las células azul y roja trabajan aisladas: con el rol de una célula sólo se ve su parte de la confrontación y la del árbitro.')}</p>`, 'gold');
    const list = act ? [act] : ROLES;
    h += `<div class="g2">` + list.map(r => {
      const ck = R.chk[r.k] = R.chk[r.k] || {};
      return card(`${esc(t(r.l))} ${cellTag(r.cell)}`,
        `<label class="fl">${t('Responsabilidades')}</label><ul class="small rl">${r.resp.map(x => `<li>${esc(t(x))}</li>`).join('')}</ul>
         <label class="fl">${t('Antes de empezar')}</label>${r.prep.map((x, i) => fChk('roles.chk.' + r.k + '.' + i, esc(t(x)), '')).join('')}
         <label class="fl">${t('En cada turno se pregunta')}</label><ul class="small rl">${r.turn.map(x => `<li>${esc(t(x))}</li>`).join('')}</ul>
         <div class="row">${r.go.map(s => `<button class="btn sm" data-a="go" data-t="${s}">→ ${esc(t((U.NAV.find(n => n.id === s) || {}).l || s))}</button>`).join('')}</div>`,
        r.cell === 'red' ? 'red' : r.cell === 'blue' || r.cell === 'staff' ? 'blue' : 'gold');
    }).join('') + `</div>`;
    if (act) h += `<p class="row"><button class="btn sm" data-a="setRole" data-k="">${t('Ver todos los roles')}</button></p>`;
    return h;
  };
  function cellTag(c) { return c === 'red' ? `<span class="tag bad">${t('Célula roja')}</span>` : c === 'blue' ? `<span class="tag info">${t('Célula azul')}</span>` : c === 'staff' ? `<span class="tag info">${t('EM · célula azul')}</span>` : `<span class="tag">${t('Célula blanca')}</span>`; }

  /* Aportación de las funciones de EM en el turno (se guarda en la matriz de sincronización). */
  U.rolePanel = function (o, g, tt) {
    const act = U.role();
    if (act && act.cell === 'red') return '';
    const staff = ROLES.filter(r => r.fn && r.k !== 's2');
    const show = act && act.fn ? staff.filter(r => r.k === act.k) : staff;
    const done = staff.filter(r => (((g.sync || {})[r.fn] || {})[tt.id] || '').trim()).length;
    const body = show.map(r => {
      const v = ((g.sync || {})[r.fn] || {})[tt.id] || '', open = (act && act.k === r.k) || !!v.trim();
      return `<details class="rolep"${open ? ' open' : ''}><summary><b>${esc(t(r.l))}</b> ${v.trim() ? '<span class="tag ok">✓</span>' : ''} <span class="muted small">${esc(R1(r))}</span></summary>
        <ul class="small rl">${r.turn.map(x => `<li>${esc(t(x))}</li>`).join('')}</ul>${fTa('sync.' + r.fn + '.' + tt.id, 2, t('Aportación de la función en este turno…'), '', 'g')}</details>`;
    }).join('');
    return card(t('Aportaciones de las funciones de EM en este turno') + ` <span class="muted small">(${done}/${staff.length})</span>`,
      body + `<p class="small muted">${t('Se recogen en la matriz de sincronización de «Resumen y evaluación».')}</p>`, 'blue',
      global.WGAI ? `<button class="btn sm" data-a="aiTurn" data-id="${esc(tt.id)}">✦ ${t('Proponer con IA')}</button>` : '');
  };
  function R1(r) { const p = (U.op().roles || {}).people || {}; return p[r.k] ? '· ' + p[r.k] : ''; }

  Object.assign(U.A, {
    setRole: d => { U.store.role = d.k || ''; U.save(true); U.render(); const r = U.role(); U.toast(r ? t('Rol activo: {r}', { r: t(r.l) }) : t('Vista completa')); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
