/* ==========================================================================
   Vistas de ENTRADAS y PREPARACIÓN
   1 Datos de planeamiento · 2 ORBAT · 3 Preparación · 4 Planes COA / ECOA
   ========================================================================== */
(function (global) {
  'use strict';
  const U = global.WGUI, C = global.WGCat, E = global.WGEngine, W = global.WGModel, SC = global.WGScenarios;
  const { esc, short, t, fIn, fNum, fTa, fSel, fChk, O, secH, card, pills } = U;

  /* =============================== 1 · DATOS DE PLANEAMIENTO =============================== */
  U.R.inputs = function () {
    const o = U.op(), tab = o.ui.inTab || 'op', st = Math.min(o.ui.step || 0, Math.max(0, o.phases.length - 1));
    const tabs = [['op', t('Operación y escenario')], ['hhq', t('Orden superior')], ['s13', t('Pasos 1–3 y COA propias')], ['est', t('Estimaciones')], ['cpg', t('CPG y criterios')], ['ecoa', t('COA enemigas (IPOE)')]];
    let h = secH(t('Datos de planeamiento'), t('Todo lo que el EM aporta al Paso 4: escenario, orden superior, productos de los pasos 1–3, estimaciones actualizadas, guía del comandante y COA enemigas.'));
    if (o.phases.length) {
      h += card(t('Fases de la operación') + ` <span class="muted small">(${t('pulse una fase')})</span>`,
        `<div class="tl">${o.phases.map((s, i) => `<button class="tls ${i === st ? 'on' : ''}" data-a="uitab" data-k="step" data-t="${i}"><span class="a">${esc(s.t)}</span><span class="b">${esc(s.n)}</span><span class="c">ME ${esc(s.me)} · ${esc(s.dc)}</span></button>`).join('')}</div>
         <p class="hint">${esc(o.phases[st].n)} (${esc(o.phases[st].t)}) — ${esc(o.phases[st].d)} ${o.phases[st].dc ? `<span class="tag info">${esc(o.phases[st].dc)}</span>` : ''} ${o.phases[st].otg ? `<span class="tag info">${esc(o.phases[st].otg)}</span>` : ''}</p>`, 'gold');
    }
    h += pills(tabs, tab, 'uitab', 'inTab');
    const P = 'inputs.';
    if (tab === 'op') h += viewOp(o);
    else if (tab === 'hhq') {
      h += `<div class="g2"><div>` + card(t('Orden superior, nuevas tareas o misión prevista por el comandante'),
        `<label class="fl">${t('Orden recibida')}</label>${fTa(P + 'hhq.order', 2)}
         <label class="fl">${t('Propósito del escalón superior')}</label>${fTa(P + 'hhq.purpose', 4)}
         <label class="fl">${t('Clave del éxito')}</label>${fTa(P + 'hhq.key', 3)}
         <label class="fl">${t('Estado final deseado')}</label>${fTa(P + 'hhq.endstate', 4)}
         <label class="fl">${t('Cometido asignado')}</label>${fTa(P + 'hhq.tasks', 3)}`, 'blue') + `</div><div>` +
        card(t('Nuevas tareas / misión prevista'), fTa(P + 'hhq.newTasks', 4, t('FRAGO, nuevas tareas o misiones previstas…')), 'gold') +
        card(t('Nueva información del escalón superior, unidades adyacentes y agregadas'), `${fTa(P + 'hhq.newInfo', 7)}<label class="fl">${t('Información de terceros')}</label>${fTa(P + 'hhq.thirdParty', 3, t('Nación anfitriona, autoridades civiles, otras agencias…'))}`) + `</div></div>`;
    } else if (tab === 's13') {
      h += `<div class="g2"><div>` +
        card(t('Misión e intención del comandante (pasos 2 y 3)'), `<label class="fl">${t('Misión')}</label>${fTa(P + 's13.mission', 3)}<label class="fl">${t('Intención del comandante')}</label>${fTa(P + 's13.intent', 6)}`, 'blue') +
        card(t('Cometidos'), `<label class="fl">${t('Especificados')}</label>${fTa(P + 's13.specified', 4)}<label class="fl">${t('Implícitos')}</label>${fTa(P + 's13.implied', 4)}<label class="fl">${t('Esenciales')}</label>${fTa(P + 's13.essential', 3)}`) +
        `</div><div>` +
        card(t('Limitaciones'), `<label class="fl">${t('Obligaciones (debe hacer)')}</label>${fTa(P + 's13.constraints', 4)}<label class="fl">${t('Prohibiciones (no debe hacer)')}</label>${fTa(P + 's13.restraints', 4)}`, 'red') +
        card(t('Deducciones clave'), fTa(P + 's13.deductions', 5)) +
        card(t('COA propias a analizar (producto del paso 3)'),
          o.coas.map((c, i) => `<div class="itembox"><div class="row nowrap"><input class="in idf" data-b="coas.${i}.id" data-re="self" value="${esc(c.id)}" aria-label="ID">${fIn('coas.' + i + '.name', t('Nombre de la COA'))}<button class="btn ghost sm" data-a="delCoa" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></div>${fTa('coas.' + i + '.stmt', 3, t('Enunciado de la COA…'))}</div>`).join('') +
          `<div class="row"><button class="btn pri sm" data-a="addCoa">＋ ${t('Añadir COA')}</button><button class="btn sm" data-a="dupCoa">⧉ ${t('Duplicar COA seleccionada con su plan')}</button></div>`, 'gold') +
        `</div></div>`;
    } else if (tab === 'est') {
      const cnt = s => o.inputs.est.filter(e => e.status === s).length;
      h += card(t('Estimaciones de EM actualizadas — sostenibilidad de la COA por función'),
        `<div class="pills"><span class="tag ok">${t('Sostenible')} ${cnt('Supportable')}</span><span class="tag warn">${t('Con riesgo')} ${cnt('Supportable with risk')}</span><span class="tag bad">${t('No sostenible')} ${o.inputs.est.filter(e => /^Not/.test(e.status)).length}</span></div>
         <div class="tw"><table class="t"><thead><tr><th style="width:180px">${t('Función / célula')}</th><th style="width:230px">${t('Valoración')}</th><th>${t('Deducción clave (cuantificada)')}</th><th></th></tr></thead><tbody>` +
        o.inputs.est.map((e, i) => `<tr><td>${fIn(P + 'est.' + i + '.fn')}</td><td>${fSel(P + 'est.' + i + '.status', ['Supportable', 'Supportable with risk', 'Not supportable without resupply', 'Not supportable'])}</td><td>${fTa(P + 'est.' + i + '.text', 3)}</td><td><button class="btn ghost sm" data-a="del" data-l="inputs.est" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`).join('') +
        `</tbody></table></div><button class="btn pri sm" data-a="add" data-l="inputs.est">＋ ${t('Añadir estimación')}</button>`, 'blue');
    } else if (tab === 'cpg') {
      const tw = o.inputs.criteria.reduce((a, c) => a + (+c.w || 0), 0);
      h += `<div class="g2"><div>` + card(t('Guía de planeamiento del comandante para la confrontación'), fTa(P + 'cpg', 12), 'gold') + `</div><div>` +
        card(t('Criterios de evaluación / selección de COA'),
          `<div class="tw"><table class="t"><thead><tr><th style="width:62px">ID</th><th style="width:150px">${t('Criterio')}</th><th style="width:70px">${t('Peso')}</th><th>${t('Pregunta que debe responder la confrontación')}</th><th></th></tr></thead><tbody>` +
          o.inputs.criteria.map((c, i) => `<tr><td>${fIn(P + 'criteria.' + i + '.id')}</td><td>${fIn(P + 'criteria.' + i + '.name')}</td><td>${fNum(P + 'criteria.' + i + '.w', 'min="0" max="10"')}</td><td>${fTa(P + 'criteria.' + i + '.q', 2)}</td><td><button class="btn ghost sm" data-a="del" data-l="inputs.criteria" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`).join('') +
          `</tbody></table></div><div class="row"><button class="btn pri sm" data-a="add" data-l="inputs.criteria">＋ ${t('Añadir criterio')}</button><span class="muted small">${t('Peso total')}: <b>${tw}</b>. ${t('Los criterios se puntúan en «Resumen y evaluación».')}</span></div>`, 'blue') + `</div></div>`;
    } else {
      const likeSum = o.ecoas.reduce((a, c) => a + (+c.lik || 0), 0);
      h += (likeSum !== 100 && o.ecoas.length ? `<p class="warnbox">${t('Las probabilidades de las COA enemigas suman {n} %. En la ponderación se normalizan a 100 %.', { n: likeSum })}</p>` : '') +
        `<div class="g2">` + o.ecoas.map((c, i) => card(`<input class="in idf" data-b="ecoas.${i}.id" data-re="self" value="${esc(c.id)}" aria-label="ID"> ${esc(c.name)}`,
          `<label class="fl">${t('Nombre')}</label>${fIn('ecoas.' + i + '.name')}
           <div class="g2 tight"><div><label class="fl">${t('Clasificación IPOE')}</label>${fSel('ecoas.' + i + '.tag', [['MLCOA', t('MLCOA — más probable')], ['MDCOA', t('MDCOA — más peligrosa')], ['', t('Otra')]], 'self')}</div><div><label class="fl">${t('Probabilidad estimada (%)')}</label>${fNum('ecoas.' + i + '.lik', 'min="0" max="100" step="5"')}</div></div>
           <label class="fl">${t('Descripción')}</label>${fTa('ecoas.' + i + '.text', 5)}
           <div class="g2 tight">${o.sectors.map(s => `<div><label class="fl">${esc(s.name)}</label>${fTa('ecoas.' + i + '.bySector.' + s.id, 3)}</div>`).join('')}</div>`,
          'red', `<button class="btn ghost sm" data-a="delEcoa" data-i="${i}" aria-label="${t('Eliminar')}">✕</button>`)).join('') + `</div>` +
        `<div class="row"><button class="btn pri sm" data-a="addEcoa">＋ ${t('Añadir COA enemiga')}</button><span class="muted small">${t('El despliegue por turnos de cada COA enemiga se define en «Planes COA / ECOA».')}</span></div>` +
        card(t('Puntos de decisión enemigos (del registro de DP)'),
          `<div class="tw"><table class="t ro"><thead><tr><th>DP</th><th>${t('Decisión enemiga')}</th><th>${t('Indicador')}</th><th>NAI</th><th>CCIR</th></tr></thead><tbody>${o.reg.dp.filter(d => d.side === 'RED').map(d => `<tr><td><b>${esc(d.id)}</b></td><td>${esc(d.dec)}</td><td>${esc(d.trg)}</td><td>${esc(d.nai)}</td><td>${esc(d.ccir)}</td></tr>`).join('') || `<tr><td colspan="5" class="muted">${t('Sin DP enemigos registrados.')}</td></tr>`}</tbody></table></div>`, 'red');
    }
    return h;
  };

  function viewOp(o) {
    const examples = Object.keys(SC).map(k => `<button class="btn sm" data-a="loadEx" data-k="${k}">⤓ ${esc(SC[k].name)}</button>`).join('');
    return `<div class="g2"><div>` +
      card(t('Operaciones'), `<p class="muted small">${t('Puede trabajar con varias operaciones; cada una guarda sus COA, ECOA, ORBAT y confrontaciones. Se conservan en este navegador: exporte el JSON para compartirlas.')}</p>
        <div class="row"><button class="btn pri sm" data-a="newOp">＋ ${t('Nueva operación en blanco')}</button><button class="btn sm" data-a="dupOp">⧉ ${t('Duplicar')}</button><button class="btn sm danger" data-a="delOp">✕ ${t('Eliminar')}</button></div>
        <label class="fl">${t('Cargar escenario de ejemplo')}</label><div class="row">${examples}</div>
        <label class="fl">${t('Importar / exportar')}</label><div class="row"><button class="btn sm" data-a="importOpen">⬆ ${t('Importar JSON (v3 o copia de wargaming_nato v2)')}</button><button class="btn sm" data-a="exportOp">⬇ ${t('Exportar esta operación')}</button><button class="btn sm" data-a="exportAll">⬇ ${t('Copia completa')}</button></div>`, 'gold') +
      card(t('Identificación'), `<label class="fl">${t('Título')}</label>${fIn('meta.title', '', '', '', 'self')}
        <div class="g2 tight"><div><label class="fl">${t('Clasificación')}</label>${fIn('meta.classification')}</div><div><label class="fl">${t('Etiqueta corta')}</label>${fIn('meta.tag')}</div></div>
        <label class="fl">${t('Unidad que planea')}</label>${fIn('meta.unit')}
        <div class="g2 tight"><div><label class="fl">${t('Sindicato / equipo')}</label>${fIn('meta.syndicate')}</div><div><label class="fl">${t('Fecha')}</label>${fIn('meta.date')}</div></div>
        <div class="g2 tight"><div><label class="fl">${t('Umbral FFIR-1 (% potencia de combate)')}</label>${fNum('ffir', 'min="0" max="100"')}</div><div><label class="fl">${t('Línea de referencia de la DC (%)')}</label>${fNum('dcLine', 'min="0" max="100"')}</div></div>`) +
      `</div><div>` +
      card(t('Sectores / corredores / fajas'), `<p class="muted small">${t('El cálculo compara fuerzas en el punto de contacto: cada COA y cada ECOA sitúan sus unidades por sector.')}</p>
        <div class="tw"><table class="t"><thead><tr><th style="width:90px">${t('Código')}</th><th>${t('Nombre')}</th><th></th></tr></thead><tbody>${o.sectors.map((s, i) => `<tr><td>${fIn('sectors.' + i + '.id', '', '', '', 'self')}</td><td>${fIn('sectors.' + i + '.name', '', '', '', 'self')}</td><td><button class="btn ghost sm" data-a="del" data-l="sectors" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`).join('')}</tbody></table></div>
        <button class="btn pri sm" data-a="add" data-l="sectors">＋ ${t('Añadir sector')}</button>`, 'blue') +
      card(t('Fases de la operación'), `<div class="tw"><table class="t"><thead><tr><th style="width:70px">ID</th><th>${t('Fase')}</th><th style="width:110px">${t('Tiempo')}</th><th style="width:110px">ME</th><th style="width:90px">DC</th><th></th></tr></thead><tbody>${o.phases.map((s, i) => `<tr><td>${fIn('phases.' + i + '.id')}</td><td>${fIn('phases.' + i + '.n')}${fTa('phases.' + i + '.d', 2)}</td><td>${fIn('phases.' + i + '.t')}</td><td>${fIn('phases.' + i + '.me')}</td><td>${fIn('phases.' + i + '.dc')}</td><td><button class="btn ghost sm" data-a="del" data-l="phases" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`).join('')}</tbody></table></div>
        <button class="btn pri sm" data-a="add" data-l="phases">＋ ${t('Añadir fase')}</button>`) +
      card(t('Medidas de control (una por línea)'), `<textarea class="ta" rows="6" data-ch="cmText" aria-label="${t('Medidas de control')}">${esc(o.cm.join('\n'))}</textarea>`) +
      `</div></div>`;
  }

  /* =============================== 2 · ORBAT =============================== */
  U.R.orbat = function () {
    const o = U.op(), m = E.unitMap(o), side = o.ui.orbSide || 'ALL', q = (o.ui.q || '').toLowerCase();
    const kids = {}; o.orbat.forEach(u => { (kids[u.p && m[u.p] ? u.p : 'ROOT'] = kids[u.p && m[u.p] ? u.p : 'ROOT'] || []).push(u); });
    let show = null;
    if (q) { show = new Set(); o.orbat.forEach(u => { if ((u.name + ' ' + u.equip + ' ' + u.role).toLowerCase().includes(q)) { let x = u; while (x) { show.add(x.id); x = m[x.p]; } } }); }
    const rows = [];
    (function walk(pid, d) {
      (kids[pid] || []).forEach(u => {
        if (side !== 'ALL' && u.side !== side) return;
        if (show && !show.has(u.id)) return;
        const has = (kids[u.id] || []).length, open = q ? true : !!o.ui.open[u.id];
        const cp = +u.cp || 0, col = U.statusColor(cp / 100), fe = E.unitFE(u);
        rows.push(`<div class="row-u ${o.ui.selU === u.id ? 'sel' : ''}" style="padding-left:${8 + d * 16}px" data-a="selu" data-id="${esc(u.id)}" role="treeitem" aria-expanded="${has ? open : ''}">
          <span class="tg" data-a="tog" data-id="${esc(u.id)}">${has ? (open ? '▾' : '▸') : ''}</span>${C.sym(u, 32)}
          <div class="mn"><div class="nm">${esc(u.name)}</div><div class="eq">${esc(C.ECHL[u.ech] || '')}${u.pers ? ' · ' + esc(u.pers) + ' pers' : ''}${u.equip ? ' · ' + esc(u.equip) : ''}</div></div>
          ${fe ? `<span class="fe">${fe.toFixed(2)} FE</span>` : ''}<span class="cpb"><i style="width:${cp}%;background:${col}"></i></span><span class="pct" style="color:${col}">${cp}%</span></div>`);
        if (has && open) walk(u.id, d + 1);
      });
    })('ROOT', 0);
    const u = m[o.ui.selU];
    let ed = `<p class="muted">${t('Seleccione una unidad del árbol para editarla.')}</p>`;
    if (u) {
      const i = o.orbat.indexOf(u), P = 'orbat.' + i + '.', fe = E.unitFE(u);
      ed = `<div class="row nowrap">${C.sym(u, 60)}<div><div class="strong">${esc(u.name)}</div><div class="muted small">${u.side === 'B' ? t('PROPIA') : t('ADVERSARIA')} · ${esc(C.ECHL[u.ech] || '')}</div></div></div>
        <label class="fl">${t('Designación')}</label>${fIn(P + 'name', '', '', '', 'self')}
        <div class="g2 tight"><div><label class="fl">${t('Bando')}</label>${fSel(P + 'side', [['B', t('Propio (azul)')], ['R', t('Adversario (rojo)')]], 'self')}</div><div><label class="fl">${t('Escalón')}</label>${fSel(P + 'ech', C.ECHO.map(e => [e, C.ECHL[e]]), 'self')}</div></div>
        <label class="fl">${t('Función (icono APP-6)')}</label>${fSel(P + 'type', C.TYPES, 'self')}
        <div class="g2 tight"><div><label class="fl">${t('Personal')}</label>${fIn(P + 'pers')}</div><div><label class="fl">${t('Ubicación')}</label>${fSel(P + 'loc', O.cm())}</div></div>
        <label class="fl">${t('Material / dotación')}</label>${fTa(P + 'equip', 2)}
        <label class="fl">${t('Papel / cometido')}</label>${fTa(P + 'role', 2)}
        <label class="fl">${t('Potencia de combate inicial (% de la plantilla)')}</label>
        <div class="row nowrap"><input type="range" min="0" max="100" step="5" data-b="${P}cp" data-num="1" data-re="self" value="${+u.cp || 0}" aria-label="CP %">${fNum(P + 'cp', 'min="0" max="100" style="width:80px"')}</div>
        <label class="fl">${t('Tipo para la correlación de fuerzas (Force Ratio Calculator Matrix)')}</label>${frSel(P + 'frT')}
        <div class="g2 tight"><div><label class="fl">${t('Cantidad (fracción del tipo)')}</label>${fNum(P + 'frQ', 'step="0.01"')}</div><div><label class="fl">${u.frT === 'Custom F.E.' ? t('F.E. personalizado') : t('F.E. resultante')}</label>${u.frT === 'Custom F.E.' ? fNum(P + 'frFE', 'step="0.01"') : `<div class="in ro">${fe ? fe.toFixed(2) : '—'}</div>`}</div></div>
        <p class="muted small">${esc(C.FR_BASIS[u.frT] || '')}${u.note ? ' ' + esc(u.note) : ''}</p>
        <label class="fl">${t('Unidad superior')}</label>${fSel(P + 'p', [['', '— ' + t('nivel superior') + ' —'], ...O.units().slice(1).filter(x => x[0] !== u.id)], 'self')}
        <div class="row"><button class="btn pri sm" data-a="uadd" data-id="${esc(u.id)}">＋ ${t('Subordinada')}</button><button class="btn sm" data-a="udup" data-id="${esc(u.id)}">⧉ ${t('Duplicar')}</button><button class="btn sm" data-a="ufr" data-id="${esc(u.id)}">⚖ ${t('A correlación de fuerzas')}</button><button class="btn sm danger" data-a="udel" data-id="${esc(u.id)}">✕ ${t('Eliminar')}</button></div>`;
    }
    const cnt = s => { const r = o.orbat.filter(x => x.side === s); return `${r.filter(x => x.ech === 'company').length} ${t('cías')} · ${r.filter(x => x.ech === 'battalion').length} ${t('bones')} · ${r.length} ${t('unidades')}`; };
    let h = secH(t('ORBAT — orden de batalla hasta compañía'), t('Simbología APP-6, editable. La potencia de combate y el tipo de F.E. alimentan el motor de cálculo, la correlación de fuerzas y la confrontación.'),
      `<button class="btn sm" data-a="orbx" data-v="1">${t('Desplegar todo')}</button><button class="btn sm" data-a="orbx" data-v="0">${t('Plegar todo')}</button><button class="btn pri sm" data-a="uadd" data-id="">＋ ${t('Unidad de nivel superior')}</button>`);
    h += `<div class="row">${pills([['ALL', t('Ambos bandos')], ['B', t('Propias')], ['R', t('Adversarias')]], side, 'uitab', 'orbSide')}
      <input class="in" style="max-width:280px" placeholder="🔎 ${t('Buscar unidad, material, cometido…')}" value="${esc(o.ui.q || '')}" data-b="ui.q" data-live="orbq" aria-label="${t('Buscar')}">
      <span class="muted small">${t('Azul')}: ${cnt('B')} · ${t('Rojo')}: ${cnt('R')}</span></div>`;
    h += `<div class="orb"><section class="card"><div class="tree" role="tree">${rows.join('') || `<p class="cb muted">${t('Ninguna unidad coincide.')}</p>`}</div></section>
      <div>${card(t('Editor de unidad'), ed, 'gold')}${card(t('Leyenda APP-6'), `<div class="legend6">${C.TYPES.map(x => `<div>${C.sym({ side: 'B', type: x[0], ech: '' }, 24)}<span>${esc(x[1])}</span></div>`).join('')}</div>`)}</div></div>`;
    return h;
  };
  function frSel(p) {
    const v = U.getP(U.op(), p);
    return `<select class="sl" data-b="${p}" data-re="self"><option value="">— ${t('seleccione tipo')} —</option>` +
      C.FR_CAT.map(g => `<optgroup label="${esc(g.g)}">` + g.items.map(i => `<option value="${esc(i[0])}"${i[0] === v ? ' selected' : ''}>${esc(i[0])}${i[0] === 'Custom F.E.' ? '' : ' — ' + i[1]}</option>`).join('') + '</optgroup>').join('') + '</select>';
  }
  U.frSel = frSel;
  U.live.orbq = () => { U.render(); const s = document.querySelector('[data-b="ui.q"]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } };

  /* =============================== 3 · PREPARACIÓN =============================== */
  U.prepReadiness = function () {
    const o = U.op(), p = o.prep, m = E.unitMap(o);
    const pos = p.positions.filter(x => x.u), sides = new Set(pos.map(x => (m[x.u] || {}).side));
    const planned = o.coas.some(c => Object.values(c.plan || {}).some(x => (x.eng || []).length)) && o.ecoas.some(e => Object.values(e.plan || {}).some(x => (x.place || []).length));
    const items = [
      [t('COA propia y COA adversaria seleccionadas'), !!(p.coa && p.acoa)],
      [t('Técnica de análisis seleccionada'), !!p.technique],
      [t('Al menos un método seleccionado'), C.MKEYS.some(k => p.methods[k])],
      [t('Eventos críticos seleccionados (≥ 3)'), p.ceSel.length >= 3],
      [t('Puntos de decisión seleccionados (≥ 1)'), p.dpSel.length >= 1],
      [t('Método de registro y de adjudicación definidos'), !!(p.recording && p.adjMethod)],
      [t('Fuerzas propias Y adversarias posicionadas'), sides.has('B') && sides.has('R')],
      [t('Supuestos enumerados'), p.assumptions.length >= 1],
      [t('CCIR enumerados (≥ 1 PIR y 1 FFIR)'), o.reg.ccir.some(c => c.type === 'PIR') && o.reg.ccir.some(c => c.type === 'FFIR')],
      [t('Enfrentamientos y despliegues definidos (Planes COA / ECOA)'), planned]
    ];
    return { items, pct: Math.round(items.filter(i => i[1]).length / items.length * 100) };
  };
  U.R.prep = function () {
    const o = U.op(), p = o.prep, P = 'prep.', rd = U.prepReadiness(), m = E.unitMap(o);
    const ac = o.ecoas.find(e => e.id === p.acoa);
    let h = secH(t('Preparación'), t('APP-28(B) Anexo D — para cada COA: técnica y COA adversaria, eventos críticos y DP, método, forma de registrar, posición de las fuerzas, supuestos y CCIR.'));
    h += card(`${t('Disposición para la confrontación')} — <b style="color:${rd.pct >= 100 ? 'var(--ok)' : 'var(--warn)'}">${rd.pct}%</b>`,
      `<div class="bar"><i style="width:${rd.pct}%"></i></div><div class="g3 tight">${rd.items.map(i => `<div class="small">${i[1] ? '<span class="tag ok">✓</span>' : '<span class="tag warn">…</span>'} ${esc(i[0])}</div>`).join('')}</div>`, 'gold');
    h += `<div class="g2"><div>` + card('① ' + t('Técnica de análisis y COA adversaria'),
      `<div class="g2 tight"><div><label class="fl">${t('COA propia a analizar')}</label>${fSel(P + 'coa', O.coa(), 'self')}</div><div><label class="fl">${t('COA adversaria (ACOA)')}</label>${fSel(P + 'acoa', O.ecoa(), 'self')}</div></div>
       <div class="g2 tight"><div><label class="fl">${t('Técnica de análisis')}</label>${fSel(P + 'technique', ['Manual wargame (map / board and counters)', 'Computer-assisted wargame', 'Sketch-note / whiteboard wargame', 'Terrain model (ROC-drill style)'])}</div>
       <div><label class="fl">${t('Iniciativa (quién abre cada turno)')}</label>${fSel(P + 'initiative', [['red', t('Rojo — pre-acción roja')], ['blue', t('Azul — acción azul')]], 'self')}</div></div>
       ${ac ? `<p class="hint"><b>${esc(ac.name)}.</b> ${esc(ac.text)}</p>` : ''}
       <p class="hint gold">${t('Guía: confronte primero contra la COA enemiga más probable; pruebe la más peligrosa como rama en los DP enemigos. La matriz de «Análisis estadístico» confronta todas las parejas.')}</p>`, 'blue') +
      `</div><div>` + card('② ' + t('Método (técnicas de confrontación)'),
      `<div class="mgrid">${C.MKEYS.map(k => { const M = U.METHODS[k], n = o.turns.filter(x => x.m === k).length;
        return `<label class="mcard ${p.methods[k] ? 'on' : ''}"><span class="row nowrap"><input type="checkbox" data-b="${P}methods.${k}" data-re="self"${p.methods[k] ? ' checked' : ''}><b>${t(M.l)}</b><span class="tag info">${n} ${t('turnos')}</span></span><span class="small muted">${t(M.d)}</span></label>`; }).join('')}</div>`, 'blue') +
      `</div></div>`;
    h += `<div class="g2"><div>` + card('③ ' + t('Eventos críticos'),
      `<div class="tw"><table class="t"><thead><tr><th style="width:30px"></th><th style="width:60px">ID</th><th>${t('Evento crítico')}</th><th style="width:140px">${t('Fase')}</th><th style="width:80px">DC</th><th></th></tr></thead><tbody>` +
      o.ces.map((c, i) => `<tr><td><input type="checkbox" data-ch="togsel" data-l="prep.ceSel" data-v="${esc(c.id)}"${p.ceSel.includes(c.id) ? ' checked' : ''} aria-label="${esc(c.id)}"></td><td><b>${esc(c.id)}</b></td><td>${fIn('ces.' + i + '.title')}</td><td>${fSel('ces.' + i + '.step', O.steps())}</td><td>${fIn('ces.' + i + '.dc')}</td><td><button class="btn ghost sm" data-a="del" data-l="ces" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`).join('') +
      `</tbody></table></div><button class="btn pri sm" data-a="add" data-l="ces">＋ ${t('Añadir evento crítico')}</button>`, 'gold') +
      `</div><div>` + card('③ ' + t('Puntos de decisión a analizar'),
      `<div class="scroll">${o.reg.dp.map(d => `<label class="chk"><input type="checkbox" data-ch="togsel" data-l="prep.dpSel" data-v="${esc(d.id)}"${p.dpSel.includes(d.id) ? ' checked' : ''}><span><b>${esc(d.id)}</b> <span class="tag ${d.side === 'RED' ? 'bad' : 'info'}">${esc(d.side)}</span> ${esc(d.dec)}<br><span class="muted small">${t('Indicador')}: ${esc(d.trg)}</span></span></label>`).join('') || `<p class="muted small">${t('Sin DP. Añádalos en «Registros».')}</p>`}</div>`, 'gold') +
      `</div></div>`;
    h += card('④ ' + t('Forma de registrar y presentar los resultados'),
      `<div class="g3 tight"><div><label class="fl">${t('Registro / presentación')}</label>${fSel(P + 'recording', ['War Game Worksheet (APP-28 Annex D) + Synchronisation matrix', 'War Game Worksheet only', 'Synchronisation matrix only', 'Sketch notes + DSO / DSOM'])}</div>
       <div><label class="fl">${t('Método de adjudicación (Wargaming Handbook)')}</label>${fSel(P + 'adjMethod', ['Mixed — Analytical (tables, force ratios, dice) + Expert (arbiter)', 'Expert assessment (arbiter decides)', 'Consensual assessment (participants agree)', 'Analytical assessment (tables, algorithms, dice)'])}</div>
       <div><label class="fl">${t('Plan de tiempos')}</label>${fIn(P + 'timeline')}</div></div>`, 'blue');
    const big = new Set(o.orbat.filter(u => C.ECHO.indexOf(u.ech) >= 5).map(u => u.id)); p.positions.forEach(x => x.u && big.add(x.u));
    const ul = O.units().filter(x => !x[0] || big.has(x[0]));
    h += card('⑤ ' + t('Relación y posición de todas las fuerzas propias y adversarias relevantes'),
      `<div class="tw"><table class="t"><thead><tr><th style="width:36px"></th><th style="width:320px">${t('Unidad (del ORBAT)')}</th><th style="width:210px">${t('Ubicación inicial')}</th><th>${t('Cometido / actitud al inicio')}</th><th style="width:60px">CP %</th><th></th></tr></thead><tbody>` +
      p.positions.map((x, i) => { const u = m[x.u]; return `<tr><td>${u ? C.sym(u, 26) : ''}</td><td>${fSel(P + 'positions.' + i + '.u', ul, 'self')}</td><td>${fSel(P + 'positions.' + i + '.loc', O.cm())}</td><td>${fIn(P + 'positions.' + i + '.task')}</td><td class="num">${u ? u.cp + '%' : ''}</td><td><button class="btn ghost sm" data-a="del" data-l="prep.positions" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`; }).join('') +
      `</tbody></table></div><div class="row"><button class="btn pri sm" data-a="add" data-l="prep.positions">＋ ${t('Añadir fuerza')}</button><button class="btn sm" data-a="posall">⤓ ${t('Añadir las unidades empleadas en los planes')}</button></div>`, 'gold');
    h += `<div class="g2"><div>` + card('⑥ ' + t('Supuestos (comprobar y actualizar durante la confrontación)'),
      `<div class="tw"><table class="t"><thead><tr><th style="width:50px">ID</th><th>${t('Supuesto')}</th><th>${t('Si falla…')}</th><th style="width:118px">${t('Estado')}</th><th></th></tr></thead><tbody>` +
      p.assumptions.map((a, i) => `<tr><td>${fIn(P + 'assumptions.' + i + '.id')}</td><td>${fTa(P + 'assumptions.' + i + '.text', 2)}</td><td>${fTa(P + 'assumptions.' + i + '.fail', 2)}</td><td>${fSel(P + 'assumptions.' + i + '.status', ['UNTESTED', 'VALID', 'INVALID'], 'nav')}</td><td><button class="btn ghost sm" data-a="del" data-l="prep.assumptions" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`).join('') +
      `</tbody></table></div><button class="btn pri sm" data-a="add" data-l="prep.assumptions">＋ ${t('Añadir supuesto')}</button>`, 'gold') +
      `</div><div>` + card('⑥ CCIR (PIR · FFIR · EEFI)',
      `<div class="tw"><table class="t ro"><thead><tr><th>ID</th><th>${t('Pregunta')}</th><th>NAI</th><th>${t('Estado')}</th></tr></thead><tbody>${o.reg.ccir.map(c => `<tr><td><span class="tag ${c.type === 'PIR' ? 'info' : c.type === 'FFIR' ? 'ok' : 'warn'}">${esc(c.id)}</span></td><td class="small">${esc(c.q)}</td><td class="small">${esc(c.nai)}</td><td class="small">${esc(c.st)}</td></tr>`).join('')}</tbody></table></div>
       <button class="btn sm" data-a="go" data-t="reg">${t('Editar CCIR en Registros')} →</button>`) + `</div></div>`;
    h += card(t('Notas de preparación'), fTa(P + 'notes', 3, t('Reglas de juego, papeles (células azul y roja, árbitro, registradores), orientación del plano, tiempos…')));
    return h;
  };

  /* =============================== 4 · PLANES COA / ECOA =============================== */
  U.R.plans = function () {
    const o = U.op(), cfg = U.cfg();
    if (!o.turns.length) return secH(t('Planes COA / ECOA por turno'), '') + card(t('Sin turnos'), `<p class="muted">${t('Añada turnos en «Confrontación».')}</p>`);
    let tid = o.ui.planTurn; if (!o.turns.find(x => x.id === tid)) tid = o.ui.planTurn = o.turns[0].id;
    const turn = o.turns.find(x => x.id === tid), ti = o.turns.indexOf(turn);
    const c = U.coa(), e = U.ecoa(), ci = o.coas.indexOf(c), ei = o.ecoas.indexOf(e);
    let h = secH(t('Planes COA / ECOA por turno'), t('Para cada turno: la COA propia define sus enfrentamientos (unidades, tarea, sector, HPT, modificadores) y la COA enemiga su despliegue por sector. El motor los empareja automáticamente en la confrontación y en la matriz estadística.'));
    h += `<div class="card"><div class="cb"><div class="g2 tight"><div><label class="fl">BLUE COA</label>${fSel('prep.coa', O.coa(), 'self')}</div><div><label class="fl">RED COA</label>${fSel('prep.acoa', O.ecoa(), 'self')}</div></div>
      <label class="fl">${t('Turno')}</label><div class="turns">${o.turns.map(x => { const nE = c && c.plan[x.id] ? (c.plan[x.id].eng || []).length : 0, nP = e && e.plan[x.id] ? (e.plan[x.id].place || []).length : 0;
        return `<button class="turn-btn ${o.prep.methods[x.m] ? '' : 'off'}" data-a="uitab" data-k="planTurn" data-t="${esc(x.id)}" aria-current="${x.id === tid}"><b>${esc(x.label)}</b><span>${esc(x.time)}</span><span class="small">${nE} ${t('enf.')} · ${nP} ${t('uds. rojas')}</span></button>`; }).join('')}</div>
      <p class="small muted">${esc(turn.title)}${o.prep.methods[turn.m] ? '' : ' · <b>' + t('método desactivado en Preparación') + '</b>'}${turn.sim === false ? ' · <b>' + t('no encadena bajas en la simulación') + '</b>' : ''}</p></div></div>`;
    if (!c || !e) return h + `<p class="warnbox">${t('Defina al menos una COA propia y una COA enemiga en «Datos de planeamiento».')}</p>`;
    c.plan[tid] = c.plan[tid] || { a: '', eng: [] }; c.plan[tid].eng = c.plan[tid].eng || [];
    e.plan[tid] = e.plan[tid] || { pre: '', r: '', place: [] }; e.plan[tid].place = e.plan[tid].place || [];
    const bp = 'coas.' + ci + '.plan.' + tid, rp = 'ecoas.' + ei + '.plan.' + tid;
    const taskOpts = Object.keys(cfg.tasks).map(k => [k, t(cfg.tasks[k].label) + ' (' + E.fmtR(cfg.tasks[k].req) + ')']);
    const pairOpts = [['', t('Por defecto de la tarea')]].concat(Object.keys(C.DMG).map(k => [k, k]));
    const redOpts = [['', '— ' + t('ninguno') + ' —']].concat(O.fight('R').slice(1));
    const blueF = O.fight('B');
    const blue = card(`<span class="side-b">BLUE</span> ${esc(c.name)}`,
      `<label class="fl">${t('Acción azul (unidades y posiciones · cometido y propósito · movimiento · fuegos · sostenimiento)')}</label>${fTa(bp + '.a', 4)}
       ${c.plan[tid].eng.map((x, xi) => { const xb = bp + '.eng.' + xi; return `<div class="eng ${x.me ? 'me' : ''}">
         <div class="row between"><b>${t('Enfrentamiento')} ${xi + 1}</b><div class="row">${fChk(xb + '.me', t('Esfuerzo principal'), 'self')}<label class="chk"><input type="checkbox" data-b="${xb}.brk" data-re="self"${(x.brk == null ? cfg.tasks[x.task] && cfg.tasks[x.task].brk : x.brk) ? ' checked' : ''}><span>${t('Rompe el contacto a tiempo')}</span></label><button class="btn ghost sm" data-a="delEng" data-p="${bp}.eng" data-i="${xi}">${t('Quitar')}</button></div></div>
         <div class="g4 tight"><div><label class="fl">${t('Denominación')}</label>${fIn(xb + '.label')}</div><div><label class="fl">${t('Sector')}</label>${fSel(xb + '.sector', O.sectors(), 'self')}</div><div><label class="fl">${t('Tarea (ratio mínimo)')}</label>${fSel(xb + '.task', taskOpts, 'self')}</div><div><label class="fl">${t('HPT (concentración de bajas)')}</label>${fSel(xb + '.hpt', redOpts, 'self')}</div></div>
         <div class="g2 tight"><div><span class="fl">${t('Unidades azules empeñadas (% empeñado)')}</span>
           ${(x.units || []).map((uu, k) => `<div class="urow">${fSel(xb + '.units.' + k + '.u', blueF, 'self')}${fNum(xb + '.units.' + k + '.pct', 'min="0" max="100" step="5" aria-label="%"')}<button class="btn ghost sm" data-a="delRow" data-p="${xb}.units" data-i="${k}" aria-label="${t('Quitar')}">✕</button></div>`).join('')}
           <button class="btn sm" data-a="addRow" data-p="${xb}.units" data-kind="unit">＋ ${t('Unidad')}</button></div>
           <div>${vsPicker(o, tid, x, xb)}</div></div>
         <details><summary class="small">${t('Modificadores y tabla de bajas')}: ${esc(modSummary(x.mods))}</summary>
           <div class="g3 tight">${Object.keys(cfg.mods).map(k => { const md = cfg.mods[k]; return `<div><label class="fl">${t(md.label)}</label>${fSel(xb + '.mods.' + k, md.opts.map((op_, i) => [i, t(op_[0]) + ' ×' + op_[1]]), 'self')}</div>`; }).join('')}
           <div><label class="fl">${t('Combinación de misiones (tabla BCTP)')}</label>${fSel(xb + '.pair', pairOpts, 'self')}</div></div></details>
       </div>`; }).join('')}
       <div class="row"><button class="btn pri sm" data-a="addEng" data-p="${bp}.eng">＋ ${t('Añadir enfrentamiento')}</button>${ti > 0 ? `<button class="btn sm" data-a="copyPrev" data-side="coa" data-from="${esc(o.turns[ti - 1].id)}">⧉ ${t('Copiar del turno anterior')}</button>` : ''}</div>`, 'blue');
    const red = card(`<span class="side-r">RED</span> ${esc(e.name)}`,
      `<div class="g2 tight"><div><label class="fl">${t('Pre-acción roja')}</label>${fTa(rp + '.pre', 3)}</div><div><label class="fl">${t('Reacción roja')}</label>${fTa(rp + '.r', 3)}</div></div>
       <span class="fl">${t('Despliegue rojo en contacto (unidad · sector · % empeñado)')}</span>
       ${e.plan[tid].place.map((pp, k) => `<div class="urow place">${fSel(rp + '.place.' + k + '.u', O.fight('R'), 'self')}${fSel(rp + '.place.' + k + '.sector', O.sectors(), 'self')}${fNum(rp + '.place.' + k + '.pct', 'min="0" max="100" step="5" aria-label="%"')}<button class="btn ghost sm" data-a="delRow" data-p="${rp}.place" data-i="${k}" aria-label="${t('Quitar')}">✕</button></div>`).join('')}
       <div class="row"><button class="btn pri sm" data-a="addRow" data-p="${rp}.place" data-kind="place">＋ ${t('Unidad')}</button>${ti > 0 ? `<button class="btn sm" data-a="copyPrev" data-side="ecoa" data-from="${esc(o.turns[ti - 1].id)}">⧉ ${t('Copiar del turno anterior')}</button>` : ''}</div>`, 'red');
    h += `<div class="g2">${blue}${red}</div>`;
    const path = U.pathFor(c, e, W.game(o, null, false));
    const T = path && path.turns.find(x => x.t.id === tid);
    h += card(t('Vista previa del cálculo para este turno') + ` <span class="muted small">(${t('con las bajas acumuladas de los turnos anteriores')})</span>`, T ? previewTable(T, path.umap) : `<p class="muted small">${t('El método de este turno está desactivado: actívelo en Preparación para incluirlo en el cálculo.')}</p>`, 'gold');
    return h;
  };
  /* «Frente a»: sólo unidades rojas que alguna COA enemiga despliega en ese sector y turno. */
  function vsPicker(o, tid, x, xb) {
    const um = E.unitMap(o), ids = new Set(x.vs || []);
    o.ecoas.forEach(e => (((e.plan || {})[tid] || {}).place || []).forEach(p => { if (p.u && p.sector === x.sector) ids.add(p.u); }));
    const list = [...ids].filter(id => um[id]);
    return `<details${(x.vs || []).length ? ' open' : ''}><summary class="fl">${t('Frente a (opcional; si no, resto del sector)')} · ${(x.vs || []).length}</summary>
      <div class="chips">${list.map(id => `<label class="chip-c"><input type="checkbox" data-ch="vs" data-p="${xb}.vs" data-u="${esc(id)}"${(x.vs || []).indexOf(id) >= 0 ? ' checked' : ''}>${esc(short(U.uname(um[id]), 30))}</label>`).join('') || `<span class="muted small">${t('Ninguna COA enemiga despliega unidades en este sector y turno.')}</span>`}</div></details>`;
  }
  function modSummary(mods) {
    const m = E.modFactor(U.cfg(), mods);
    const parts = Object.keys(m.detail).filter(k => m.detail[k].v !== 1).map(k => t(m.detail[k].label));
    return (parts.length ? parts.join(' · ') : t('neutros')) + ' (×' + m.f.toFixed(2) + ')';
  }
  U.modSummary = modSummary;
  function previewTable(T, umap) {
    const rows = T.results.map(r => { const cl = r.calc; return `<tr><td>${esc(r.x.eng.label)}${r.x.eng.me ? ' <span class="tag info">ME</span>' : ''}<br><span class="muted small">${r.x.blue.map(b => esc(U.uname(umap[b.u]))).join(', ')} <b>vs</b> ${r.x.red.map(b => esc(U.uname(umap[b.u]))).join(', ') || t('sin fuerzas rojas')}</span></td><td class="num">${cl.feB.toFixed(2)}</td><td class="num">${cl.feR.toFixed(2)}</td><td class="num">×${cl.mod.toFixed(2)}</td><td class="num"><b>${E.fmtR(cl.rEff)}</b></td><td class="num">${E.fmtR(cl.req)}</td><td>${U.resTag(cl.outcome)}</td><td class="num">${cl.lb.toFixed(0)} / ${cl.lr.toFixed(0)} %</td></tr>`; }).join('');
    const warns = T.warnings.map(w => `<p class="warnbox">${t('Fuerzas rojas sin oposición en {s}', { s: '<b>' + esc(w.sector) + '</b>' })}: ${w.units.map(u => esc(U.uname(umap[u]) || u)).join(', ')}</p>`).join('');
    return warns + `<div class="tw"><table class="t ro"><thead><tr><th>${t('Enfrentamiento')}</th><th class="num">FE ${t('azul')}</th><th class="num">FE ${t('rojo')}</th><th class="num">${t('Modif.')}</th><th class="num">${t('Ratio A:R')}</th><th class="num">${t('Mínimo')}</th><th>${t('Lectura')}</th><th class="num">${t('Bajas A / R')}</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="muted">${t('Sin enfrentamientos.')}</td></tr>`}</tbody></table></div>`;
  }
  U.previewTable = previewTable;

  /* ------------------------------ acciones ------------------------------ */
  const NEW = {
    'inputs.est': () => ({ fn: t('Nueva estimación'), status: 'Supportable with risk', text: '' }),
    'inputs.criteria': () => ({ id: 'C' + (U.op().inputs.criteria.length + 1), name: t('Nuevo criterio'), w: 1, q: '' }),
    'ces': () => ({ id: 'CE' + (U.op().ces.reduce((a, c) => Math.max(a, +(String(c.id).replace(/\D/g, '')) || 0), 0) + 1), title: t('Nuevo evento crítico'), step: '', dc: '', dp: '', ccir: '', r: {}, cr: '' }),
    'prep.positions': () => ({ u: '', loc: '', task: '' }),
    'prep.assumptions': () => ({ id: 'A' + (U.op().prep.assumptions.length + 1), text: '', fail: '', status: 'UNTESTED' }),
    'sectors': () => ({ id: 'S' + (U.op().sectors.length + 1), name: t('Sector') + ' ' + (U.op().sectors.length + 1) }),
    'phases': () => ({ id: 'P' + (U.op().phases.length + 1), n: t('FASE') + ' ' + (U.op().phases.length + 1), t: '', me: '', dc: '', otg: '', d: '' })
  };
  U.NEW = NEW;
  const nid = (p, arr) => { let m = 0; arr.forEach(x => { const r = String(x.id || '').match(/(\d+)$/); if (r) m = Math.max(m, +r[1]); }); return p + (m + 1); };
  Object.assign(U.A, {
    add: d => { const arr = U.getP(U.op(), d.l); arr.push(NEW[d.l] ? NEW[d.l]() : (U.NEWX && U.NEWX[d.l] ? U.NEWX[d.l]() : {})); U.save(true); U.render(); },
    del: d => U.ask(t('¿Eliminar este elemento?'), () => { U.getP(U.op(), d.l).splice(+d.i, 1); U.save(true); U.render(); }),
    newOp: () => { const o = W.blankOp(t('Nueva operación')); U.store.ops.push(o); U.store.cur = o.id; U.save(true); U.render(); U.toast(t('Operación creada')); },
    dupOp: () => { const o = W.clone(U.op()); o.id = 'op-' + Date.now().toString(36); o.meta.title += ' (' + t('copia') + ')'; U.store.ops.push(o); U.store.cur = o.id; U.save(true); U.render(); U.toast(t('Operación duplicada')); },
    delOp: () => U.ask(t('¿Eliminar la operación «{n}» de este navegador? Exporte antes una copia si la necesita.', { n: U.op().meta.title }), () => { U.store.ops = U.store.ops.filter(x => x.id !== U.op().id); if (!U.store.ops.length) U.store.ops.push(W.blankOp()); U.store.cur = U.store.ops[0].id; U.save(true); U.render(); U.toast(t('Operación eliminada')); }),
    loadEx: d => { const o = SC[d.k].build(); o.id = o.id + '-' + Date.now().toString(36); U.store.ops.push(o); U.store.cur = o.id; U.save(true); U.render(); U.toast(t('Escenario cargado: {n}', { n: SC[d.k].name })); },
    addCoa: () => { const o = U.op(); const id = nid('COA-', o.coas); o.coas.push({ id, name: 'COA ' + id.replace('COA-', ''), stmt: '', plan: {} }); U.save(true); U.render(); },
    dupCoa: () => { const o = U.op(), src = U.coa(); if (!src) return; const c = W.clone(src); c.id = nid('COA-', o.coas); c.name = src.name + ' (' + t('copia') + ')'; Object.values(c.plan).forEach(p => (p.eng || []).forEach(x => { x.id = 'e' + Math.random().toString(36).slice(2, 8); })); o.coas.push(c); o.prep.coa = c.id; U.save(true); U.render(); U.toast(t('COA duplicada con su plan')); },
    delCoa: d => U.ask(t('¿Eliminar esta COA y sus confrontaciones?'), () => { const o = U.op(), c = o.coas[+d.i]; o.coas.splice(+d.i, 1); Object.keys(o.games).forEach(k => { if (k.split('|')[0] === c.id) delete o.games[k]; }); W.ensure(o); U.save(true); U.render(); }),
    addEcoa: () => { const o = U.op(); const id = nid('ECOA-', o.ecoas); o.ecoas.push({ id, name: 'ECOA ' + id.replace('ECOA-', ''), tag: '', lik: 0, text: '', bySector: {}, plan: {} }); U.save(true); U.render(); },
    delEcoa: d => U.ask(t('¿Eliminar esta COA enemiga y sus confrontaciones?'), () => { const o = U.op(), c = o.ecoas[+d.i]; o.ecoas.splice(+d.i, 1); Object.keys(o.games).forEach(k => { if (k.split('|')[1] === c.id) delete o.games[k]; }); W.ensure(o); U.save(true); U.render(); }),
    cmText: (d, el) => { U.op().cm = el.value.split('\n').map(s => s.trim()).filter(Boolean); U.save(); },
    togsel: (d, el) => { const arr = U.getP(U.op(), d.l), i = arr.indexOf(d.v); if (el.checked && i < 0) arr.push(d.v); if (!el.checked && i >= 0) arr.splice(i, 1); U.save(true); U.render(); },
    vs: (d, el) => { const o = U.op(); const arr = U.getP(o, d.p) || []; const i = arr.indexOf(d.u); if (el.checked && i < 0) arr.push(d.u); if (!el.checked && i >= 0) arr.splice(i, 1); U.setP(o, d.p, arr); U.save(true); U.render(); },
    /* ORBAT */
    selu: d => { U.op().ui.selU = d.id; U.save(); U.render(); },
    tog: (d, el, ev) => { ev.stopPropagation(); const o = U.op(); o.ui.open[d.id] = o.ui.open[d.id] ? 0 : 1; U.save(); U.render(); },
    orbx: d => { const o = U.op(); o.ui.open = {}; if (d.v === '1') o.orbat.forEach(u => { o.ui.open[u.id] = 1; }); else o.orbat.filter(u => !u.p).forEach(u => { o.ui.open[u.id] = 1; }); U.save(); U.render(); },
    uadd: d => { const o = U.op(), m = E.unitMap(o), p = m[d.id], ei = p ? Math.max(0, C.ECHO.indexOf(p.ech) - 1) : 5;
      const nu = { id: 'u' + Date.now().toString(36), p: p ? p.id : null, side: p ? p.side : 'B', name: t('Nueva unidad'), type: p ? p.type : 'infantry', ech: C.ECHO[ei], pers: '', equip: '', role: '', frT: '', frQ: 1, frFE: 0, cp: 100, loc: '' };
      o.orbat.splice(p ? o.orbat.indexOf(p) + 1 : o.orbat.length, 0, nu); if (p) o.ui.open[p.id] = 1; o.ui.selU = nu.id; U.save(true); U.render(); },
    udup: d => { const o = U.op(), u = o.orbat.find(x => x.id === d.id), c = W.clone(u); c.id = 'u' + Date.now().toString(36); c.name += ' (' + t('copia') + ')'; o.orbat.splice(o.orbat.indexOf(u) + 1, 0, c); o.ui.selU = c.id; U.save(true); U.render(); },
    udel: d => { const o = U.op(), del = new Set([d.id]); let ch = true; while (ch) { ch = false; o.orbat.forEach(u => { if (u.p && del.has(u.p) && !del.has(u.id)) { del.add(u.id); ch = true; } }); }
      U.ask(t('¿Eliminar {n} unidad(es), incluidas las subordinadas?', { n: del.size }), () => {
        o.orbat = o.orbat.filter(u => !del.has(u.id)); o.prep.positions.forEach(p => { if (del.has(p.u)) p.u = ''; });
        o.coas.forEach(c => Object.values(c.plan).forEach(p => (p.eng || []).forEach(x => { x.units = (x.units || []).filter(z => !del.has(z.u)); })));
        o.ecoas.forEach(c => Object.values(c.plan).forEach(p => { p.place = (p.place || []).filter(z => !del.has(z.u)); }));
        Object.values(o.games).forEach(g => Object.values(g.turns).forEach(x => { x.assets = (x.assets || []).filter(a => !del.has(a)); }));
        o.ui.selU = ''; U.save(true); U.render(); }); },
    ufr: d => { const o = U.op(), u = o.orbat.find(x => x.id === d.id); if (!u.frT) { U.toast(t('Asigne antes un tipo de correlación de fuerzas a la unidad')); return; } o.fr[u.side === 'B' ? 'f' : 'e'].push({ n: +u.frQ || 1, s: (+u.cp || 0) / 100, t: u.frT, fe: +u.frFE || 0, lbl: u.name }); U.save(true); U.toast(t('Añadida a la calculadora')); U.go('fr'); },
    posall: () => { const o = U.op(), ids = new Set(); o.coas.forEach(c => Object.values(c.plan).forEach(p => (p.eng || []).forEach(x => (x.units || []).forEach(z => z.u && ids.add(z.u))))); o.ecoas.forEach(c => Object.values(c.plan).forEach(p => (p.place || []).forEach(z => z.u && ids.add(z.u))));
      ids.forEach(id => { if (!o.prep.positions.some(p => p.u === id)) o.prep.positions.push({ u: id, loc: '', task: '' }); }); U.save(true); U.render(); },
    /* PLANES */
    addEng: d => { const o = U.op(), arr = U.getP(o, d.p) || []; arr.push({ id: 'e' + Date.now().toString(36), sector: (o.sectors[0] || {}).id || '', label: t('Enfrentamiento'), task: 'hastyDef', me: false, hpt: '', vs: [], pair: '', units: [{ u: '', pct: 100 }], mods: {} }); U.setP(o, d.p, arr); U.save(true); U.render(); },
    delEng: d => U.ask(t('¿Quitar este enfrentamiento?'), () => { U.getP(U.op(), d.p).splice(+d.i, 1); U.save(true); U.render(); }),
    addRow: d => { const o = U.op(), arr = U.getP(o, d.p) || []; arr.push(d.kind === 'place' ? { u: '', sector: (o.sectors[0] || {}).id || '', pct: 100 } : { u: '', pct: 100 }); U.setP(o, d.p, arr); U.save(true); U.render(); },
    delRow: d => { U.getP(U.op(), d.p).splice(+d.i, 1); U.save(true); U.render(); },
    copyPrev: d => { const o = U.op(), tid = o.ui.planTurn;
      if (d.side === 'coa') { const c = U.coa(); const src = (c.plan[d.from] || {}).eng || []; c.plan[tid].eng = W.clone(src).map(x => Object.assign(x, { id: 'e' + Math.random().toString(36).slice(2, 8) })); }
      else { const e = U.ecoa(); e.plan[tid].place = W.clone((e.plan[d.from] || {}).place || []); }
      U.save(true); U.render(); U.toast(t('Copiado del turno anterior')); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
