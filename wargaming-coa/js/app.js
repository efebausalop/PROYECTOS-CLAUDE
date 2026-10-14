/* ==========================================================================
   COA Wargaming — interfaz
   Pestañas: 1 Operación · 2 Fuerzas · 3 Líneas de acción · 4 Confrontación
             5 Productos · 6 Resultados · 7 Datos y método
   ========================================================================== */
(function () {
  'use strict';
  const E = window.WGEngine, X = window.WGExamples;
  const STORE_KEY = 'wgcoa.v1';

  /* ------------------------------ estado ------------------------------ */
  let store = load() || { ops: [X.tryzub(), X.marAzul()], cur: 'op-tryzub', cfg: E.deepClone(E.DEFAULT_CONFIG) };
  if (!store.cfg) store.cfg = E.deepClone(E.DEFAULT_CONFIG);
  const ui = { tab: 'op', coaSide: 'blue', selBlue: null, selRed: null, wgBlue: null, wgRed: null, wgTurn: 0, wgStep: 0, view: 'white', resPair: null, confirm: null, toast: null, showJson: false };
  readHash();

  function load() { try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  let saveT = null;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* almacenamiento no disponible */ } }, 250); }
  function op() { return store.ops.find(o => o.id === store.cur) || store.ops[0]; }
  function cfg() { return store.cfg; }
  function uid(p) { return (p || 'id') + '-' + Math.random().toString(36).slice(2, 8); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 0 : d) + ' %'; }
  function readHash() { const h = (location.hash || '').slice(1); if (['op', 'oob', 'coa', 'wg', 'prod', 'res', 'data'].indexOf(h) >= 0) ui.tab = h; }

  function ensureSel() {
    const o = op();
    if (!o.blueCOAs.find(c => c.id === ui.selBlue)) ui.selBlue = o.blueCOAs[0] && o.blueCOAs[0].id;
    if (!o.redCOAs.find(c => c.id === ui.selRed)) ui.selRed = o.redCOAs[0] && o.redCOAs[0].id;
    if (!o.blueCOAs.find(c => c.id === ui.wgBlue)) ui.wgBlue = o.blueCOAs[0] && o.blueCOAs[0].id;
    if (!o.redCOAs.find(c => c.id === ui.wgRed)) ui.wgRed = o.redCOAs[0] && o.redCOAs[0].id;
    if (ui.wgTurn >= o.events.length) ui.wgTurn = 0;
  }
  function session(o, b, r, create) {
    const k = b + '|' + r;
    o.sessions = o.sessions || {};
    if (!o.sessions[k] && create) o.sessions[k] = { turns: {}, sync: {}, dsm: [], facds: {}, strengths: '', weaknesses: '', refinements: '', conclusions: '' };
    return o.sessions[k];
  }

  /* --------------------------- acceso por ruta --------------------------- */
  function getPath(obj, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj); }
  function setPath(obj, path, val) {
    const ks = path.split('.'); let a = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; }
    a[ks[ks.length - 1]] = val;
  }
  function rootFor(scope) {
    if (scope === 'cfg') return cfg();
    if (scope === 'sess') { const o = op(); return session(o, ui.wgBlue, ui.wgRed, true); }
    return op();
  }

  /* --------------------------- constantes UI --------------------------- */
  const TECH = {
    key: { label: 'Eventos clave / secuencia de tareas esenciales', short: 'Eventos clave', d: 'Se confrontan los eventos críticos de la operación (H-Hour, relevo, asalto al objetivo). Rápido y centrado. Recomendado en las primeras sesiones.' },
    belt: { label: 'Fajas (belt)', short: 'Fajas', d: 'El área se divide en fajas a lo ancho de la zona. Eficaz en terreno compartimentado y en operaciones por fases (pasos de curso de agua, asaltos aéreos, desembarcos anfibios).' },
    avenue: { label: 'Avenida en profundidad', short: 'Avenida', d: 'Se confronta una avenida de aproximación cada vez, empezando por el esfuerzo principal. Adecuado para COA ofensivas o defensa en terreno canalizado.' },
    box: { label: 'Caja (box)', short: 'Caja', d: 'Análisis detallado de un área crítica aislada: una playa de desembarco, un punto de paso, el objetivo de una incursión. Útil con poco tiempo.' }
  };
  const FUNCS = [['enemy', 'Enemigo (esperado)'], ['c2', 'Mando y control'], ['intel', 'Inteligencia'], ['man', 'Maniobra'], ['fires', 'Fuegos'], ['info', 'Información'], ['cimic', 'CIMIC'], ['sust', 'Sostenimiento'], ['prot', 'Protección de la fuerza']];
  const OUT = { DEC: 'Éxito decisivo', EXI: 'Éxito', PAR: 'Éxito parcial', FRA: 'Fracaso', SC: 'Sin contacto' };
  const SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];

  function unitSym(type, side) {
    const t = (type || '').toLowerCase();
    let g = '';
    const X_ = '<line x1="0" y1="0" x2="26" y2="17" stroke="currentColor" stroke-width="1.6"/><line x1="26" y1="0" x2="0" y2="17" stroke="currentColor" stroke-width="1.6"/>';
    const O_ = '<ellipse cx="13" cy="8.5" rx="8" ry="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/>';
    if (/carro|tank|acoraz|armd|mbt/.test(t)) g = O_;
    else if (/mec|bmp|btr|mr /.test(t) || /^bn mr/.test(t)) g = X_ + O_;
    else if (/c\/c|at |kornet|antic/.test(t)) g = '<polyline points="3,15 13,2 23,15" fill="none" stroke="currentColor" stroke-width="1.6"/>';
    else if (/art|mlrs|aama/.test(t)) g = '<circle cx="13" cy="8.5" r="3" fill="currentColor"/>';
    else if (/anfib|im /.test(t) || /\bim\b/.test(t)) g = X_ + '<path d="M4 13 q3 -3 6 0 t6 0 t6 0" fill="none" stroke="currentColor" stroke-width="1.4"/>';
    else if (/recce|recon|explor/.test(t)) g = '<line x1="0" y1="17" x2="26" y2="0" stroke="currentColor" stroke-width="1.6"/>';
    else g = X_;
    return '<span class="unit-sym ' + side + '" aria-hidden="true"><svg viewBox="0 0 26 17" preserveAspectRatio="none">' + g + '</svg></span>';
  }
  function statusColor(s) { const b = cfg().statusBands; return s * 100 >= b.green ? 'var(--ok)' : s * 100 >= b.amber ? 'var(--warn)' : 'var(--bad)'; }
  function outChip(o, manual) { return '<span class="chip out-' + o + '">' + esc(OUT[o] || o) + (manual ? ' · árbitro' : '') + '</span>'; }

  /* ------------------------------ render raíz ------------------------------ */
  const app = document.getElementById('app');
  function render() {
    ensureSel();
    const o = op();
    document.getElementById('opName').textContent = o.name;
    document.getElementById('classif').textContent = o.classification || '';
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === ui.tab ? 'true' : 'false'));
    const scrollY = window.scrollY;
    const views = { op: vOperacion, oob: vFuerzas, coa: vCOAs, wg: vWargame, prod: vProductos, res: vResultados, data: vDatos };
    app.innerHTML = (views[ui.tab] || vOperacion)(o);
    const t = document.getElementById('toast');
    t.hidden = !ui.toast; t.textContent = ui.toast || '';
    window.scrollTo(0, scrollY);
    afterRender();
  }
  function toast(msg) { ui.toast = msg; const t = document.getElementById('toast'); t.hidden = false; t.textContent = msg; clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast = null; t.hidden = true; }, 2600); }

  /* helpers de formulario */
  function fIn(label, path, val, opts) {
    opts = opts || {};
    const sc = opts.scope ? ' data-scope="' + opts.scope + '"' : '';
    const type = opts.type || 'text';
    const id = 'f-' + (opts.scope || 'op') + '-' + path.replace(/\./g, '-');
    const ctl = opts.area
      ? '<textarea id="' + id + '" data-b="' + path + '"' + sc + ' rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.ph || '') + '">' + esc(val) + '</textarea>'
      : '<input id="' + id + '" type="' + type + '" data-b="' + path + '"' + sc + (type === 'number' ? ' data-t="num" step="' + (opts.step || 'any') + '"' : '') + ' value="' + esc(val) + '" placeholder="' + esc(opts.ph || '') + '">';
    return label == null ? ctl : '<label class="f" for="' + id + '"><span>' + esc(label) + '</span>' + ctl + '</label>';
  }
  function fSel(label, path, val, options, opts) {
    opts = opts || {};
    const sc = opts.scope ? ' data-scope="' + opts.scope + '"' : '';
    const id = 'f-' + (opts.scope || 'op') + '-' + path.replace(/\./g, '-');
    const ctl = '<select id="' + id + '" data-b="' + path + '"' + sc + (opts.num ? ' data-t="num"' : '') + ' data-rr="1">' +
      options.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    return label == null ? ctl : '<label class="f" for="' + id + '"><span>' + esc(label) + '</span>' + ctl + '</label>';
  }

  /* =============================== 1 · OPERACIÓN =============================== */
  function vOperacion(o) {
    const opsOpts = store.ops.map(x => '<option value="' + esc(x.id) + '"' + (x.id === o.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
    const confirmDel = ui.confirm === 'delop'
      ? '<span class="confirm">¿Eliminar «' + esc(o.name) + '»? <button class="btn sm danger" data-act="delOpYes">Eliminar</button><button class="btn sm" data-act="cancel">Cancelar</button></span>'
      : '<button class="btn danger" data-act="delOp">Eliminar</button>';
    return `
    <section class="view">
      <div class="view-head">
        <div class="stack"><span class="eyebrow">Paso 4 · Análisis de líneas de acción</span><h2>Operación y método de confrontación</h2>
        <p class="muted">Defina la operación, los sectores y los eventos críticos que se van a confrontar. Las COA azules y rojas se cargan en la pestaña 3; la confrontación turno a turno, en la 4.</p></div>
      </div>
      <div class="panel">
        <header><h3>Operaciones guardadas</h3><span class="muted small">Se guardan en este navegador. Exporte en JSON para compartir con otras células o equipos.</span></header>
        <div class="row">
          <label class="f" for="opSel" style="min-width:min(100%,320px)"><span>Operación activa</span><select id="opSel" data-act-change="selOp">${opsOpts}</select></label>
          <button class="btn" data-act="newOp">Nueva operación</button>
          <button class="btn" data-act="loadTryzub">Cargar ejemplo Op TRYZUB</button>
          <button class="btn" data-act="loadMarAzul">Cargar ejemplo anfibio</button>
          <button class="btn" data-act="dupOp">Duplicar</button>
          ${confirmDel}
        </div>
        <div class="row">
          <label class="btn" for="importFile">Importar JSON…</label><input id="importFile" type="file" accept=".json,application/json" hidden>
          <button class="btn" data-act="exportOp">Exportar JSON</button>
          <button class="btn ghost" data-act="toggleJson">${ui.showJson ? 'Ocultar' : 'Ver'} JSON para copiar</button>
        </div>
        ${ui.showJson ? '<div class="stack"><textarea id="jsonOut" rows="8" class="mono small" readonly>' + esc(JSON.stringify(o, null, 1)) + '</textarea><div class="row"><button class="btn sm" data-act="copyJson">Copiar</button><span class="muted small">También puede pegar aquí un JSON y pulsar «Importar desde texto».</span></div><textarea id="jsonIn" rows="3" class="mono small" placeholder="Pegue aquí el JSON de una operación"></textarea><div><button class="btn sm" data-act="importText">Importar desde texto</button></div></div>' : ''}
      </div>
      <div class="grid2">
        <div class="panel">
          <header><h3>Escenario</h3></header>
          ${fIn('Nombre de la operación', 'name', o.name)}
          ${fIn('Clasificación', 'classification', o.classification)}
          ${fIn('Unidad que planea', 'unit', o.unit)}
          ${fIn('Misión (quién, qué, cuándo, dónde, para qué)', 'mission', o.mission, { area: true, rows: 3 })}
          ${fIn('Intención del comandante (propósito, método, estado final)', 'intent', o.intent, { area: true, rows: 3 })}
          ${fIn('Estado final', 'endState', o.endState, { area: true, rows: 2 })}
        </div>
        <div class="stack" style="gap:16px">
          <div class="panel">
            <header><h3>Método de confrontación</h3></header>
            <p class="muted small">Seleccione una o varias técnicas (APP-28(B) Anexo D). Combinarlas está recomendado; cada evento crítico indica la técnica con la que se juega.</p>
            <div class="stack">${Object.keys(TECH).map(k => `<label class="row" style="align-items:flex-start;gap:8px" for="tech-${k}"><input id="tech-${k}" type="checkbox" data-act-change="tech" data-k="${k}"${(o.techniques || []).indexOf(k) >= 0 ? ' checked' : ''}><span><b>${TECH[k].label}</b><br><span class="muted small">${TECH[k].d}</span></span></label>`).join('')}</div>
            <div class="grid2" style="gap:10px">
              ${fSel('Iniciativa (abre cada turno)', 'initiative', o.initiative, [['red', 'Rojo — pre-acción roja'], ['blue', 'Azul — acción azul']])}
              ${fIn('Umbral FFIR-1 (% potencia de combate)', 'ffir', o.ffir, { type: 'number', step: 1 })}
            </div>
          </div>
          <div class="panel">
            <header><h3>Criterios de evaluación del comandante</h3></header>
            <textarea id="crit" rows="5" data-act-input="criteria" placeholder="Un criterio por línea">${esc((o.criteria || []).join('\n'))}</textarea>
          </div>
        </div>
      </div>
      <div class="grid2">
        <div class="panel">
          <header><h3>Sectores / ejes / fajas</h3><button class="btn sm" data-act="addSector">Añadir sector</button></header>
          <p class="muted small">El enfrentamiento se calcula en el punto de contacto: cada COA azul y roja sitúa sus unidades por sector.</p>
          <div class="tbl-wrap"><table class="tbl-edit"><thead><tr><th>Código</th><th>Nombre</th><th></th></tr></thead><tbody>
          ${o.sectors.map((s, i) => `<tr><td style="width:90px">${fIn(null, 'sectors.' + i + '.id', s.id)}</td><td>${fIn(null, 'sectors.' + i + '.name', s.name)}</td><td style="width:40px"><button class="btn sm ghost danger" data-act="delSector" data-i="${i}" aria-label="Eliminar sector">✕</button></td></tr>`).join('')}
          </tbody></table></div>
        </div>
        <div class="panel">
          <header><h3>Eventos críticos (turnos)</h3><button class="btn sm" data-act="addEvent">Añadir evento</button></header>
          <p class="muted small">Cada evento es un turno de Acción–Reacción–Contrarreacción. Indique la técnica y la condición decisiva (DC) que debe alcanzarse.</p>
          <div class="tbl-wrap"><table class="tbl-edit"><thead><tr><th>#</th><th>Evento</th><th>Tiempo</th><th>Espacio</th><th>Técnica</th><th>DC</th><th></th></tr></thead><tbody>
          ${o.events.map((ev, i) => `<tr><td class="mono">${i + 1}</td><td style="min-width:200px">${fIn(null, 'events.' + i + '.name', ev.name)}</td><td style="min-width:100px">${fIn(null, 'events.' + i + '.time', ev.time)}</td><td style="min-width:110px">${fIn(null, 'events.' + i + '.space', ev.space)}</td><td style="min-width:120px">${fSel(null, 'events.' + i + '.technique', ev.technique, Object.keys(TECH).map(k => [k, TECH[k].short]))}</td><td style="min-width:150px">${fIn(null, 'events.' + i + '.dc', ev.dc)}</td><td style="white-space:nowrap"><button class="btn sm ghost" data-act="mvEvent" data-i="${i}" data-d="-1" aria-label="Subir">↑</button><button class="btn sm ghost" data-act="mvEvent" data-i="${i}" data-d="1" aria-label="Bajar">↓</button><button class="btn sm ghost danger" data-act="delEvent" data-i="${i}" aria-label="Eliminar evento">✕</button></td></tr>`).join('')}
          </tbody></table></div>
        </div>
      </div>
    </section>`;
  }

  /* =============================== 2 · FUERZAS =============================== */
  function vFuerzas(o) {
    const side = (s, title) => `
      <div class="panel">
        <header><h3 style="color:var(--${s})">${title}</h3><button class="btn sm" data-act="addUnit" data-side="${s}">Añadir unidad</button></header>
        <div class="tbl-wrap"><table class="tbl-edit"><thead><tr><th></th><th>Designación</th><th>Tipo</th><th class="num">FE</th><th class="num">Fuerza %</th><th></th></tr></thead><tbody>
        ${o.units[s].map((u, i) => `<tr><td style="width:36px;vertical-align:middle">${unitSym(u.type, s)}</td><td style="min-width:150px">${fIn(null, 'units.' + s + '.' + i + '.name', u.name)}</td><td style="min-width:170px"><input id="ut-${s}-${i}" list="feLib" data-b="units.${s}.${i}.type" data-fe-lib="1" value="${esc(u.type)}"></td><td style="width:86px">${fIn(null, 'units.' + s + '.' + i + '.fe', u.fe, { type: 'number', step: 0.01 })}</td><td style="width:86px">${fIn(null, 'units.' + s + '.' + i + '.str', u.str, { type: 'number', step: 1 })}</td><td style="width:40px"><button class="btn sm ghost danger" data-act="delUnit" data-side="${s}" data-i="${i}" aria-label="Eliminar unidad">✕</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin unidades. Añada la primera.</td></tr>'}
        </tbody></table></div>
        <p class="muted small">FE total: <b class="mono">${o.units[s].reduce((a, u) => a + (+u.fe || 0) * (u.str == null ? 1 : u.str / 100), 0).toFixed(2)}</b> · Fuerza % = potencia inicial respecto a plantilla (100 = completa).</p>
      </div>`;
    return `
    <section class="view">
      <div class="view-head"><div class="stack"><span class="eyebrow">Orden de batalla</span><h2>Fuerzas propias y adversarias</h2>
      <p class="muted">Cada unidad se cuenta en Equivalentes de Fuerza (FE), como en la Force Ratio Calculator Matrix (CGSC ST 100-3). Elija un tipo de la biblioteca para rellenar el FE o introdúzcalo a mano. Los fuegos se cuentan aparte y entran como modificador.</p></div></div>
      <datalist id="feLib">${X.FE_LIBRARY.map(l => '<option value="' + esc(l.type) + '">' + l.fe + ' FE · ' + esc(l.src) + '</option>').join('')}</datalist>
      <div class="grid2">${side('blue', 'Fuerzas propias (BLUE)')}${side('red', 'Adversario (RED)')}</div>
      <div class="panel">
        <header><h3>Biblioteca de equivalentes de fuerza</h3><span class="muted small">Referencia; los valores marcados «orientativo» deben calibrarse con la célula de inteligencia.</span></header>
        <div class="tbl-wrap"><table><thead><tr><th>Tipo</th><th class="num">FE</th><th>Origen</th></tr></thead><tbody>
        ${X.FE_LIBRARY.map(l => `<tr><td>${esc(l.type)}</td><td class="num mono">${l.fe.toFixed(2)}</td><td class="muted">${esc(l.src)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
    </section>`;
  }

  /* =============================== 3 · COAs =============================== */
  function vCOAs(o) {
    const list = (side) => {
      const arr = side === 'blue' ? o.blueCOAs : o.redCOAs;
      const sel = side === 'blue' ? ui.selBlue : ui.selRed;
      return `<div class="coa-list">${arr.map(c => `<button class="coa-item ${side}" data-act="selCoa" data-side="${side}" data-id="${esc(c.id)}" aria-current="${ui.coaSide === side && sel === c.id}"><span class="t">${esc(c.name)}</span>${side === 'red' ? `<span class="row" style="gap:6px">${c.tag ? '<span class="chip red">' + esc(c.tag) + '</span>' : ''}<span class="muted small mono">${+c.likelihood || 0} %</span></span>` : ''}</button>`).join('') || '<p class="muted small">Ninguna todavía.</p>'}</div>
      <button class="btn sm" data-act="addCoa" data-side="${side}">Añadir ${side === 'blue' ? 'COA azul' : 'OCOA roja'}</button>`;
    };
    const editor = ui.coaSide === 'blue' ? blueEditor(o) : redEditor(o);
    const likeSum = o.redCOAs.reduce((a, c) => a + (+c.likelihood || 0), 0);
    return `
    <section class="view">
      <div class="view-head"><div class="stack"><span class="eyebrow">Paso 3 → Paso 4</span><h2>Líneas de acción</h2>
      <p class="muted">BLUE COA: el plan propio por evento, con los enfrentamientos, la tarea táctica y los modificadores previstos. RED COA (OCOA del IPOE): despliegue y acciones del adversario por evento. La confrontación empareja ambas por sector.</p></div></div>
      <div class="coa-layout">
        <div class="stack" style="gap:16px;align-content:start">
          <div class="panel"><header><h3 style="color:var(--blue)">BLUE COA</h3></header>${list('blue')}</div>
          <div class="panel"><header><h3 style="color:var(--red)">RED COA (IPOE)</h3></header>${list('red')}
            ${likeSum !== 100 && o.redCOAs.length ? '<p class="warnbox small">Las probabilidades de las OCOA suman ' + likeSum + ' %. Para la ponderación se normalizan a 100 %.</p>' : ''}</div>
        </div>
        <div style="min-width:0">${editor}</div>
      </div>
    </section>`;
  }

  function blueEditor(o) {
    const ci = o.blueCOAs.findIndex(c => c.id === ui.selBlue);
    if (ci < 0) return '<div class="panel"><p class="muted">Añada una COA azul para empezar.</p></div>';
    const c = o.blueCOAs[ci], base = 'blueCOAs.' + ci;
    const secOpts = o.sectors.map(s => [s.id, s.name]);
    const taskOpts = Object.keys(cfg().tasks).map(k => [k, cfg().tasks[k].label + ' (' + E.fmtRatio(cfg().tasks[k].req) + ')']);
    const blueOpts = [['', '— unidad —']].concat(o.units.blue.map(u => [u.id, u.name]));
    const redOpts = [['', '— ninguno —']].concat(o.units.red.map(u => [u.id, u.name]));
    const confirmDel = ui.confirm === 'delcoa' ? '<span class="confirm">¿Eliminar esta COA? <button class="btn sm danger" data-act="delCoaYes" data-side="blue">Eliminar</button><button class="btn sm" data-act="cancel">Cancelar</button></span>' : '<button class="btn sm danger" data-act="delCoa">Eliminar</button>';
    return `<div class="panel">
      <header><h3 style="color:var(--blue)">${esc(c.name)}</h3><div class="row"><button class="btn sm" data-act="dupCoa" data-side="blue">Duplicar</button>${confirmDel}</div></header>
      ${fIn('Nombre', base + '.name', c.name)}
      ${fIn('Enunciado de la COA', base + '.statement', c.statement, { area: true, rows: 3 })}
      ${o.events.map((ev, ei) => {
        c.plan = c.plan || {};
        const p = c.plan[ev.id] || (c.plan[ev.id] = { action: '', engagements: [] });
        const pb = base + '.plan.' + ev.id;
        return `<div class="ev-block">
          <div class="ev-title"><span class="idx">T${ei + 1}</span><h4>${esc(ev.name)}</h4><span class="chip line">${esc(TECH[ev.technique] ? TECH[ev.technique].short : '')}</span><span class="muted small">${esc(ev.time)} · ${esc(ev.space)}</span></div>
          ${fIn('Acción azul (unidades y posiciones · tarea y propósito · movimiento · fuegos · sostenimiento)', pb + '.action', p.action, { area: true, rows: 2 })}
          ${(p.engagements || []).map((e, xi) => {
            const eb = pb + '.engagements.' + xi;
            return `<div class="eng${e.me ? ' me' : ''}">
              <div class="row" style="justify-content:space-between"><b>Enfrentamiento ${xi + 1}</b><div class="row"><label class="row small" for="me-${ev.id}-${xi}"><input id="me-${ev.id}-${xi}" type="checkbox" data-b="${eb}.me" data-t="bool" data-rr="1"${e.me ? ' checked' : ''}> Esfuerzo principal</label><label class="row small" for="brk-${ev.id}-${xi}"><input id="brk-${ev.id}-${xi}" type="checkbox" data-b="${eb}.brk" data-t="bool"${e.brk ? ' checked' : ''}> Rompe el contacto a tiempo</label><button class="btn sm ghost danger" data-act="delEng" data-ci="${ci}" data-ev="${ev.id}" data-i="${xi}">Quitar</button></div></div>
              <div class="eng-grid">
                ${fIn('Denominación', eb + '.label', e.label)}
                ${fSel('Sector', eb + '.sector', e.sector, secOpts)}
                ${fSel('Tarea (ratio mínimo)', eb + '.task', e.task, taskOpts)}
                ${fSel('HPT (concentración de fuegos)', eb + '.hpt', e.hpt || '', redOpts)}
              </div>
              <div class="grid2" style="gap:10px">
                <div class="stack"><span class="eyebrow">Unidades azules empeñadas (% empeñado)</span>
                  <div class="unit-rows">${(e.units || []).map((u, ui_) => `<div class="unit-row">${fSel(null, eb + '.units.' + ui_ + '.u', u.u, blueOpts)}${fIn(null, eb + '.units.' + ui_ + '.pct', u.pct, { type: 'number', step: 5 })}<button class="btn sm ghost danger" data-act="delEngUnit" data-path="${eb}.units" data-i="${ui_}" aria-label="Quitar unidad">✕</button></div>`).join('')}</div>
                  <div><button class="btn sm" data-act="addEngUnit" data-path="${eb}.units">Añadir unidad</button></div>
                </div>
                <div class="stack"><span class="eyebrow">Frente a (opcional — si no, resto del sector)</span>
                  <div class="row" style="gap:4px 10px">${o.units.red.map(r => `<label class="row small" style="gap:4px" for="vs-${ev.id}-${xi}-${r.id}"><input id="vs-${ev.id}-${xi}-${r.id}" type="checkbox" data-act-change="vs" data-path="${eb}.vs" data-u="${esc(r.id)}"${(e.vs || []).indexOf(r.id) >= 0 ? ' checked' : ''}>${esc(r.name)}</label>`).join('')}</div>
                </div>
              </div>
              <details><summary class="small muted">Modificadores previstos: ${esc(modSummary(e.mods))}</summary>
                <div class="eng-grid" style="margin-top:8px">${Object.keys(cfg().mods).map(k => { const m = cfg().mods[k]; return fSel(m.label, eb + '.mods.' + k, e.mods && e.mods[k] != null ? e.mods[k] : m.def, m.opts.map((op_, i) => [i, op_[0] + ' ×' + op_[1]]), { num: true }); }).join('')}</div>
              </details>
            </div>`;
          }).join('')}
          <div><button class="btn sm" data-act="addEng" data-ci="${ci}" data-ev="${ev.id}">Añadir enfrentamiento</button></div>
        </div>`;
      }).join('')}
    </div>`;
  }
  function modSummary(mods) {
    const m = E.modFactor(cfg(), mods);
    const parts = Object.keys(m.detail).filter(k => m.detail[k].v !== 1).map(k => m.detail[k].label);
    return (parts.length ? parts.join(' · ') : 'neutros') + ' (×' + m.f.toFixed(2) + ')';
  }

  function redEditor(o) {
    const ci = o.redCOAs.findIndex(c => c.id === ui.selRed);
    if (ci < 0) return '<div class="panel"><p class="muted">Añada una OCOA roja para empezar.</p></div>';
    const c = o.redCOAs[ci], base = 'redCOAs.' + ci;
    const secOpts = o.sectors.map(s => [s.id, s.name]);
    const redOpts = [['', '— unidad —']].concat(o.units.red.map(u => [u.id, u.name]));
    const confirmDel = ui.confirm === 'delcoa' ? '<span class="confirm">¿Eliminar esta OCOA? <button class="btn sm danger" data-act="delCoaYes" data-side="red">Eliminar</button><button class="btn sm" data-act="cancel">Cancelar</button></span>' : '<button class="btn sm danger" data-act="delCoa">Eliminar</button>';
    return `<div class="panel">
      <header><h3 style="color:var(--red)">${esc(c.name)}</h3><div class="row"><button class="btn sm" data-act="dupCoa" data-side="red">Duplicar</button>${confirmDel}</div></header>
      ${fIn('Nombre', base + '.name', c.name)}
      <div class="eng-grid">
        ${fSel('Clasificación IPOE', base + '.tag', c.tag || '', [['MLCOA', 'MLCOA — más probable'], ['MDCOA', 'MDCOA — más peligrosa'], ['', 'Otra']])}
        ${fIn('Probabilidad estimada (%)', base + '.likelihood', c.likelihood, { type: 'number', step: 5 })}
      </div>
      ${fIn('Enunciado de la OCOA', base + '.statement', c.statement, { area: true, rows: 3 })}
      ${o.events.map((ev, ei) => {
        c.plan = c.plan || {};
        const p = c.plan[ev.id] || (c.plan[ev.id] = { pre: '', reaction: '', placement: [] });
        const pb = base + '.plan.' + ev.id;
        return `<div class="ev-block">
          <div class="ev-title"><span class="idx">T${ei + 1}</span><h4>${esc(ev.name)}</h4><span class="muted small">${esc(ev.time)} · ${esc(ev.space)}</span></div>
          <div class="grid2" style="gap:10px">
            ${fIn('Pre-acción roja (si Rojo tiene la iniciativa)', pb + '.pre', p.pre, { area: true, rows: 2 })}
            ${fIn('Reacción roja', pb + '.reaction', p.reaction, { area: true, rows: 2 })}
          </div>
          <div class="stack"><span class="eyebrow">Despliegue rojo en contacto (unidad · sector · % empeñado)</span>
            <div class="unit-rows">${(p.placement || []).map((u, k) => `<div class="unit-row place">${fSel(null, pb + '.placement.' + k + '.u', u.u, redOpts)}${fSel(null, pb + '.placement.' + k + '.sector', u.sector, secOpts)}${fIn(null, pb + '.placement.' + k + '.pct', u.pct, { type: 'number', step: 5 })}<button class="btn sm ghost danger" data-act="delPlace" data-path="${pb}.placement" data-i="${k}" aria-label="Quitar">✕</button></div>`).join('')}</div>
            <div class="row"><button class="btn sm" data-act="addPlace" data-path="${pb}.placement">Añadir unidad</button>${ei > 0 ? `<button class="btn sm ghost" data-act="copyPlace" data-ci="${ci}" data-ev="${ev.id}" data-prev="${o.events[ei - 1].id}">Copiar despliegue del T${ei}</button>` : ''}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  /* =============================== 4 · CONFRONTACIÓN =============================== */
  function pairSelectors(o) {
    return `<label class="f" for="wgB"><span>BLUE COA</span><select id="wgB" data-act-change="wgBlue">${o.blueCOAs.map(c => '<option value="' + esc(c.id) + '"' + (c.id === ui.wgBlue ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('')}</select></label>
      <label class="f" for="wgR"><span>RED COA</span><select id="wgR" data-act-change="wgRed">${o.redCOAs.map(c => '<option value="' + esc(c.id) + '"' + (c.id === ui.wgRed ? ' selected' : '') + '>' + esc((c.tag ? c.tag + ' · ' : '') + c.name) + '</option>').join('')}</select></label>`;
  }
  function steps(o) {
    return o.initiative === 'red'
      ? [['pre', 'Pre-acción roja'], ['act', 'Acción azul'], ['rea', 'Reacción roja'], ['cnt', 'Contrarreacción azul'], ['arb', 'Árbitro']]
      : [['act', 'Acción azul'], ['rea', 'Reacción roja'], ['cnt', 'Contrarreacción azul'], ['arb', 'Árbitro']];
  }

  function vWargame(o) {
    if (!o.blueCOAs.length || !o.redCOAs.length || !o.events.length) return '<section class="view"><div class="panel"><h3>Faltan datos</h3><p class="muted">Necesita al menos un evento crítico, una COA azul y una OCOA roja.</p></div></section>';
    const blue = o.blueCOAs.find(c => c.id === ui.wgBlue), red = o.redCOAs.find(c => c.id === ui.wgRed);
    const bi = o.blueCOAs.indexOf(blue), ri = o.redCOAs.indexOf(red);
    const sess = session(o, blue.id, red.id, false) || { turns: {} };
    const path = E.runPath(o, blue, red, cfg(), sess);
    const T = path.turns[ui.wgTurn], ev = T.ev;
    const st = steps(o); if (ui.wgStep >= st.length) ui.wgStep = st.length - 1;
    const stepId = st[ui.wgStep][0];
    const turnS = (sess.turns && sess.turns[ev.id]) || {};
    const tp = 'turns.' + ev.id;
    const mc = E.monteCarlo(o, blue, red, cfg(), { onlyEvent: ev.id, startStr: T.startStr, session: sess, n: Math.min(1000, cfg().sim.n), tag: 'turn' });
    const hideBlue = ui.view === 'red', hideRed = ui.view === 'blue';
    const bp = 'blueCOAs.' + bi + '.plan.' + ev.id, rp = 'redCOAs.' + ri + '.plan.' + ev.id;
    const bPlan = (blue.plan && blue.plan[ev.id]) || {}, rPlan = (red.plan && red.plan[ev.id]) || {};
    const umap = path.umap;

    const engCards = T.results.map((o_, k) => {
      const c = o_.calc, x = o_.x, e = x.eng, m = mc.engs[0] ? mc.engs[0][k] : null;
      const ov = (turnS.ovr && turnS.ovr[e.id]) || {};
      const meets = c.contact && c.rEff >= c.req;
      const sec = (o.sectors.find(s => s.id === e.sector) || {}).name || e.sector;
      const pbar = m ? '<div class="pbar" role="img" aria-label="Probabilidades">' + ['DEC', 'EXI', 'PAR', 'FRA', 'SC'].filter(z => m.p[z] > 0).map(z => '<span class="' + z + '" style="flex:' + m.p[z] + '" title="' + OUT[z] + ' ' + pct(m.p[z]) + '"></span>').join('') + '</div><div class="legend">' + ['DEC', 'EXI', 'PAR', 'FRA'].map(z => '<span><i class="pbar-i" style="background:var(' + ({ DEC: '--dec', EXI: '--ok', PAR: '--warn', FRA: '--bad' })[z] + ')"></i>' + OUT[z] + ' <b class="mono">' + pct(m.p[z] || 0) + '</b></span>').join('') + '</div>' : '';
      const mods = turnS.mods && turnS.mods[e.id] ? turnS.mods[e.id] : (e.mods || {});
      return `<div class="adj${e.me ? ' me' : ''}">
        <div class="adj-head"><div class="row" style="gap:6px"><b>${esc(e.label || 'Enfrentamiento')}</b><span class="chip line">${esc(sec)}</span>${e.me ? '<span class="chip blue">ME</span>' : ''}</div>${outChip(o_.adj.outcome, o_.adj.manual)}</div>
        <div class="small muted">${x.blue.map(b => esc((umap[b.u] || {}).name) + (b.pct != null && b.pct !== 100 ? ' (' + b.pct + ' %)' : '')).join(', ') || '—'} <b>vs</b> ${x.red.map(b => esc((umap[b.u] || {}).name) + (b.pct != null && b.pct !== 100 ? ' (' + b.pct + ' %)' : '')).join(', ') || 'sin fuerzas rojas en contacto'}</div>
        ${c.contact ? `<div class="ratio-line">
          <div class="kv"><span class="k">FE azul</span><span class="v">${c.feB.toFixed(2)}</span></div>
          <div class="kv"><span class="k">FE rojo</span><span class="v">${c.feR.toFixed(2)}</span></div>
          <div class="kv"><span class="k">Modif.</span><span class="v">×${c.mod.toFixed(2)}</span></div>
          <div class="kv"><span class="k">Ratio A:R</span><span class="v">${E.fmtRatio(c.rEff)}</span></div>
          <div class="kv"><span class="k">Mínimo</span><span class="v">${E.fmtRatio(c.req)}</span></div>
          <div class="kv"><span class="k">Bajas A / R</span><span class="v">${c.lb.toFixed(0)} / ${c.lr.toFixed(0)} %</span></div>
        </div>
        <p class="small">${esc(c.taskLabel)}: ${meets ? '<b style="color:var(--ok)">✓ cumple el ratio mínimo de planeamiento</b>' : '<b style="color:var(--bad)">✗ no alcanza el ratio mínimo de planeamiento</b>'} (margen ${c.margin.toFixed(2)}).${c.brk ? ' Rompe el contacto: bajas azules ×' + cfg().brkFactor + '.' : ''}</p>
        ${pbar}` : '<p class="small muted">Sin contacto en este turno: no hay fuerzas rojas en el sector o están asignadas a otro enfrentamiento.</p>'}
        <details${(ov.bl !== '' && ov.bl != null) || (ov.rl !== '' && ov.rl != null) ? ' open' : ''}><summary class="small">Decisión del árbitro y modificadores</summary>
          <div class="eng-grid" style="margin-top:8px">
            ${fSel('Resultado', tp + '.ovr.' + e.id + '.res', ov.res || '', [['', 'Calculado (' + (OUT[c.outcome] || '') + ')'], ['DEC', OUT.DEC], ['EXI', OUT.EXI], ['PAR', OUT.PAR], ['FRA', OUT.FRA]], { scope: 'sess' })}
            ${fIn('Bajas azules %', tp + '.ovr.' + e.id + '.bl', ov.bl == null ? '' : ov.bl, { scope: 'sess', type: 'number', step: 1, ph: c.lb.toFixed(0) })}
            ${fIn('Bajas rojas %', tp + '.ovr.' + e.id + '.rl', ov.rl == null ? '' : ov.rl, { scope: 'sess', type: 'number', step: 1, ph: c.lr.toFixed(0) })}
          </div>
          <div class="eng-grid" style="margin-top:8px">${Object.keys(cfg().mods).map(k => { const md = cfg().mods[k]; return fSel(md.label, tp + '.mods.' + e.id + '.' + k, mods[k] != null ? mods[k] : md.def, md.opts.map((op_, i) => [i, op_[0] + ' ×' + op_[1]]), { scope: 'sess', num: true }); }).join('')}</div>
          <div class="row"><button class="btn sm ghost" data-act="clearOvr" data-ev="${ev.id}" data-e="${esc(e.id)}">Volver al cálculo</button></div>
        </details>
      </div>`;
    }).join('') || '<p class="muted small">La COA azul no define enfrentamientos para este evento.</p>';

    const warns = T.warnings.map(w => '<p class="warnbox">Fuerzas rojas sin oposición en <b>' + esc((o.sectors.find(s => s.id === w.sector) || {}).name || w.sector) + '</b>: ' + w.units.map(u => esc((umap[u] || {}).name || u)).join(', ') + '. Revise la COA azul (posible hueco o rama).</p>').join('');

    const strip = (side) => o.units[side].filter(u => true).map(u => {
      const s0 = T.startStr[u.id], s1 = T.endStr[u.id];
      return `<div class="ustat">${unitSym(u.type, side)}<span class="nm" title="${esc(u.name)}">${esc(u.name)}</span><span class="mono">${Math.round(s1 * 100)}%${s1 < s0 - 0.005 ? ' <span class="muted small">(' + Math.round(s0 * 100) + ')</span>' : ''}</span><span class="bar"><i style="width:${Math.max(0, s1 * 100)}%;background:${statusColor(s1)}"></i>${side === 'blue' ? '<b style="left:' + (o.ffir || 70) + '%"></b>' : ''}</span></div>`;
    }).join('');

    const cls = (id) => stepId === id ? ' active-step' : '';
    return `
    <section class="view">
      <div class="view-head"><div class="stack"><span class="eyebrow">Acción → Reacción → Contrarreacción → Árbitro</span><h2>Confrontación</h2></div>
        <div class="row"><span class="eyebrow">Vista</span><div class="seg" role="group" aria-label="Vista de célula">${[['white', 'Célula blanca'], ['blue', 'Célula azul'], ['red', 'Célula roja']].map(v => '<button data-act="view" data-v="' + v[0] + '" aria-pressed="' + (ui.view === v[0]) + '">' + v[1] + '</button>').join('')}</div></div>
      </div>
      <div class="panel">
        <div class="wg-bar">${pairSelectors(o)}</div>
        <div class="turns" role="tablist" aria-label="Turnos">${o.events.map((e, i) => { const r = path.turns[i].results; const rank = ['SC', 'DEC', 'EXI', 'PAR', 'FRA']; const worst = r.reduce((w, z) => rank.indexOf(z.adj.outcome) > rank.indexOf(w) ? z.adj.outcome : w, 'SC'); return `<button class="turn-btn" data-act="turn" data-i="${i}" aria-current="${i === ui.wgTurn}"><b>T${i + 1} · ${esc(TECH[e.technique] ? TECH[e.technique].short : '')}</b><span>${esc(e.time)}</span><span class="chip out-${worst}" style="justify-self:start;margin-top:3px">${OUT[worst]}</span></button>`; }).join('')}</div>
        <div class="stack" style="gap:4px"><h3>T${ui.wgTurn + 1} — ${esc(ev.name)}</h3><p class="muted small">${esc(ev.time)} · ${esc(ev.space)} · Técnica: ${esc(TECH[ev.technique] ? TECH[ev.technique].label : '')}${ev.dc ? ' · <b>' + esc(ev.dc) + '</b>' : ''}</p></div>
        <div class="arcr" role="group" aria-label="Secuencia del turno">${st.map((s, i) => '<button data-act="step" data-i="' + i + '" aria-pressed="' + (i === ui.wgStep) + '" class="' + (i < ui.wgStep ? 'done' : '') + '">' + (i < ui.wgStep ? '✓ ' : '') + s[1] + '</button>').join('')}</div>
        <div class="row" style="justify-content:space-between"><span class="muted small">Paso activo: <b>${st[ui.wgStep][1]}</b></span><div class="row"><button class="btn sm" data-act="prevStep">Anterior</button><button class="btn sm primary" data-act="nextStep">${ui.wgStep === st.length - 1 ? (ui.wgTurn < o.events.length - 1 ? 'Cerrar turno y pasar al siguiente' : 'Cerrar turno') : 'Siguiente paso'}</button></div></div>
      </div>
      ${warns}
      <div class="cells">
        <div class="cell blue${hideBlue ? ' hidden-cell' : ''}">
          <h3>Célula azul</h3>
          <div class="${cls('act')}">${fIn('Acción', bp + '.action', bPlan.action || '', { area: true, rows: 5 })}</div>
          <div class="${cls('cnt')}">${fIn('Contrarreacción (HPT, ramas, ajustes)', tp + '.counter', turnS.counter || '', { area: true, rows: 5, scope: 'sess' })}</div>
          ${fIn('Medios empleados', tp + '.assets', turnS.assets || '', { scope: 'sess' })}
        </div>
        <div class="cell white">
          <h3>Célula blanca · Árbitro</h3>
          <div class="stack${cls('arb')}">${engCards}</div>
          <p class="small muted">Probabilidades: ${mc.n} simulaciones Monte Carlo desde el estado adjudicado del turno (σ = ${cfg().sim.sigma}).</p>
          ${fIn('Notas del árbitro / hechos confirmados', tp + '.notes', turnS.notes || '', { area: true, rows: 3, scope: 'sess' })}
          <div class="grid2" style="gap:8px">${fIn('Punto de decisión', tp + '.dp', turnS.dp || '', { scope: 'sess' })}${fIn('CCIR (PIR / FFIR)', tp + '.ccir', turnS.ccir || '', { scope: 'sess' })}</div>
          ${fIn('Ramas, secuelas y observaciones', tp + '.branch', turnS.branch || '', { area: true, rows: 2, scope: 'sess' })}
        </div>
        <div class="cell red${hideRed ? ' hidden-cell' : ''}">
          <h3>Célula roja</h3>
          ${o.initiative === 'red' ? '<div class="' + cls('pre') + '">' + fIn('Pre-acción', rp + '.pre', rPlan.pre || '', { area: true, rows: 5 }) + '</div>' : ''}
          <div class="${cls('rea')}">${fIn('Reacción (contramaniobras, HVT, sorpresa)', rp + '.reaction', rPlan.reaction || '', { area: true, rows: 5 })}</div>
          <p class="muted small">Pre-acción y reacción se guardan en la OCOA (pestaña 3). Contrarreacción, decisiones y notas se guardan en esta confrontación.</p>
        </div>
      </div>
      <div class="grid2">
        <div class="panel"><header><h4 style="color:var(--blue)">Estado de las fuerzas propias tras T${ui.wgTurn + 1}</h4><span class="muted small">Línea vertical: FFIR-1 (${o.ffir || 70} %)</span></header><div class="strip">${strip('blue')}</div></div>
        <div class="panel"><header><h4 style="color:var(--red)">Estado del adversario tras T${ui.wgTurn + 1}</h4></header><div class="strip">${strip('red')}</div></div>
      </div>
    </section>`;
  }

  /* =============================== 5 · PRODUCTOS =============================== */
  function vProductos(o) {
    if (!o.blueCOAs.length || !o.redCOAs.length) return '<section class="view"><div class="panel"><p class="muted">Necesita al menos una COA azul y una OCOA roja.</p></div></section>';
    const blue = o.blueCOAs.find(c => c.id === ui.wgBlue), red = o.redCOAs.find(c => c.id === ui.wgRed);
    const sess = session(o, blue.id, red.id, false) || { turns: {}, sync: {}, dsm: [] };
    const path = E.runPath(o, blue, red, cfg(), sess);
    const rows = path.turns.map((T, i) => {
      const ev = T.ev, t = (sess.turns && sess.turns[ev.id]) || {}, bp = (blue.plan && blue.plan[ev.id]) || {}, rp = (red.plan && red.plan[ev.id]) || {};
      const res = T.results.map(r => esc(r.x.eng.label) + ': <b>' + OUT[r.adj.outcome] + '</b>' + (r.calc.contact ? ' (' + E.fmtRatio(r.calc.rEff) + ')' : '')).join('<br>');
      return `<tr><td class="mono">${i + 1}</td><td>${esc(ev.name)}</td><td>${esc(bp.action)}</td><td>${esc([rp.pre, rp.reaction].filter(Boolean).join(' — '))}</td><td>${esc(t.counter)}</td><td>${esc(t.assets)}</td><td class="mono">${esc(ev.time)}</td><td>${esc(t.dp)}</td><td>${esc(t.ccir)}</td><td>${res}${t.branch ? '<br><span class="muted">' + esc(t.branch) + '</span>' : ''}</td></tr>`;
    }).join('');
    const sync = sess.sync || {};
    const syncRows = FUNCS.map(([k, label]) => `<tr><th class="rowh" scope="row" style="white-space:normal">${label}</th>${o.events.map(ev => k === 'enemy'
      ? '<td class="small">' + esc(((red.plan && red.plan[ev.id]) || {}).pre || ((red.plan && red.plan[ev.id]) || {}).reaction || '') + '</td>'
      : '<td>' + fIn(null, 'sync.' + k + '.' + ev.id, (sync[k] && sync[k][ev.id]) || '', { scope: 'sess', area: true, rows: 2 }) + '</td>').join('')}</tr>`).join('');
    const dsm = sess.dsm || [];
    return `
    <section class="view">
      <div class="view-head"><div class="stack"><span class="eyebrow">APP-28(B) Anexo D</span><h2>Productos de la confrontación</h2><p class="muted">Hoja de trabajo, matriz de sincronización y matriz de apoyo a la decisión de la pareja seleccionada.</p></div></div>
      <div class="panel"><div class="wg-bar">${pairSelectors(o)}</div></div>
      <div class="panel">
        <header><h3>Hoja de trabajo (war game worksheet)</h3><span class="muted small">Se genera a partir de las COA y de la confrontación.</span></header>
        <div class="tbl-wrap"><table><thead><tr><th>Turno</th><th>Evento</th><th>Acción</th><th>Reacción</th><th>Contrarreacción</th><th>Medios</th><th>Tiempo</th><th>DP</th><th>CCIR</th><th>Resultado / observaciones</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>
      <div class="panel">
        <header><h3>Matriz de sincronización</h3><span class="muted small">Funciones conjuntas × turnos. La fila del enemigo procede de la OCOA.</span></header>
        <div class="tbl-wrap"><table class="tbl-edit"><thead><tr><th>Función</th>${o.events.map((ev, i) => '<th style="min-width:180px">T' + (i + 1) + ' · ' + esc(ev.time) + '</th>').join('')}</tr></thead><tbody>${syncRows}</tbody></table></div>
      </div>
      <div class="panel">
        <header><h3>Matriz de apoyo a la decisión (DSM)</h3><button class="btn sm" data-act="addDsm">Añadir punto de decisión</button></header>
        <div class="tbl-wrap"><table class="tbl-edit"><thead><tr><th>DP</th><th>Dónde (NAI/TAI)</th><th>Indicador (disparador)</th><th>Decisión</th><th>Quién</th><th>NLT</th><th></th></tr></thead><tbody>
        ${dsm.map((d, i) => `<tr>${['dp', 'where', 'trigger', 'decision', 'who', 'latest'].map(k => '<td style="min-width:' + (k === 'decision' || k === 'trigger' ? 200 : 90) + 'px">' + fIn(null, 'dsm.' + i + '.' + k, d[k] || '', { scope: 'sess' }) + '</td>').join('')}<td><button class="btn sm ghost danger" data-act="delDsm" data-i="${i}" aria-label="Eliminar">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sin puntos de decisión registrados.</td></tr>'}
        </tbody></table></div>
      </div>
    </section>`;
  }

  /* =============================== 6 · RESULTADOS =============================== */
  let resCache = { key: null, data: null };
  function analysis(o) {
    const key = JSON.stringify([o.units, o.events, o.blueCOAs, o.redCOAs, o.ffir, cfg()]);
    if (resCache.key !== key) resCache = { key, data: E.analyseAll(o, cfg()) };
    return resCache.data;
  }
  function heat(p) {
    // escala de estado: verde ≥ 0,7 · ámbar ≥ 0,4 · rojo < 0,4
    return p >= 0.7 ? 'var(--ok-soft)' : p >= 0.4 ? 'var(--warn-soft)' : 'var(--bad-soft)';
  }
  function vResultados(o) {
    if (!o.blueCOAs.length || !o.redCOAs.length) return '<section class="view"><div class="panel"><p class="muted">Necesita al menos una COA azul y una OCOA roja.</p></div></section>';
    const A = analysis(o);
    if (!ui.resPair || !A[ui.resPair]) ui.resPair = ui.wgBlue + '|' + ui.wgRed;
    const likeSum = o.redCOAs.reduce((a, c) => a + (+c.likelihood || 0), 0) || 1;
    const matrix = `<div class="tbl-wrap"><table class="matrix"><thead><tr><th class="rowh">BLUE COA \\ RED COA</th>${o.redCOAs.map(r => '<th>' + esc(r.name) + '<br><span class="chip red">' + esc(r.tag || '—') + '</span> <span class="mono">' + (+r.likelihood || 0) + ' %</span></th>').join('')}<th>Ponderado por probabilidad</th><th>Peor caso</th></tr></thead><tbody>
      ${o.blueCOAs.map(b => {
        let wS = 0, wCP = 0, worst = null;
        const cells = o.redCOAs.map(r => {
          const k = b.id + '|' + r.id, a = A[k], w = (+r.likelihood || 0) / likeSum;
          wS += a.pSuccess * w; wCP += a.meanBlueCP * w;
          if (!worst || a.pSuccess < worst.a.pSuccess) worst = { a, r };
          return `<td><div class="mcell" data-act="resPair" data-k="${esc(k)}" aria-current="${ui.resPair === k}" style="background:${heat(a.pSuccess)}" title="Ver detalle"><span class="big">${pct(a.pSuccess)}</span><span class="small">P(éxito) · todas las DC ${pct(a.pDC)}</span><span class="small muted">CP azul ${pct(a.meanBlueCP)} · FFIR ${pct(a.pFFIR)}</span></div></td>`;
        }).join('');
        return `<tr><th class="rowh" scope="row" style="white-space:normal;max-width:260px">${esc(b.name)}</th>${cells}<td><span class="mono" style="font-size:1.1rem;font-weight:600">${pct(wS)}</span><br><span class="small muted">CP ${pct(wCP)}</span></td><td><span class="mono" style="font-size:1.1rem;font-weight:600">${pct(worst.a.pSuccess)}</span><br><span class="small muted">frente a ${esc(worst.r.tag || worst.r.name)}</span></td></tr>`;
      }).join('')}
      </tbody></table></div>`;

    const [bId, rId] = ui.resPair.split('|');
    const blue = o.blueCOAs.find(c => c.id === bId), red = o.redCOAs.find(c => c.id === rId);
    const a = A[ui.resPair];
    const path = E.runPath(o, blue, red, cfg());
    const sess = session(o, bId, rId, false);
    const adjPath = sess ? E.runPath(o, blue, red, cfg(), sess) : null;
    const umap = path.umap;
    let k = 0;
    const engRows = path.turns.map((T, ti) => T.results.map((r, xi) => {
      const m = a.engs[ti][xi];
      const pOk = (m.p.DEC || 0) + (m.p.EXI || 0);
      return `<tr><td class="mono">T${ti + 1}</td><td>${esc(r.x.eng.label)}${r.x.eng.me ? ' <span class="chip blue">ME</span>' : ''}<br><span class="muted small">${esc(cfg().tasks[r.calc.task].label)}</span></td><td class="num mono">${r.calc.contact ? E.fmtRatio(r.calc.rEff) : '—'}</td><td class="num mono">${E.fmtRatio(r.calc.req)}</td><td style="min-width:150px">${r.calc.contact ? '<div class="pbar">' + ['DEC', 'EXI', 'PAR', 'FRA'].filter(z => m.p[z] > 0).map(z => '<span class="' + z + '" style="flex:' + m.p[z] + '" title="' + OUT[z] + ' ' + pct(m.p[z]) + '"></span>').join('') + '</div>' : '<span class="muted small">Sin contacto</span>'}</td><td class="num mono">${r.calc.contact ? pct(pOk) : '—'}</td><td class="num mono">${r.calc.contact ? m.lb.mean.toFixed(0) + ' % <span class="muted small">[' + m.lb.p10.toFixed(0) + '–' + m.lb.p90.toFixed(0) + ']</span>' : '—'}</td><td class="num mono">${r.calc.contact ? m.lr.mean.toFixed(0) + ' %' : '—'}</td></tr>`;
    }).join('')).join('');

    const endRows = (side) => o.units[side].map(u => {
      const e = a.end[u.id], adj = adjPath ? adjPath.steps[adjPath.steps.length - 1].str[u.id] : null;
      return `<tr><td>${unitSym(u.type, side)} ${esc(u.name)}</td><td class="num mono" style="color:${statusColor(e.mean)}">${pct(e.mean)}</td><td class="num mono">${pct(e.p10)} – ${pct(e.p90)}</td>${side === 'blue' ? '<td class="num mono">' + (a.engagedBlue.indexOf(u.id) >= 0 ? pct(a.pUnitBreach[u.id]) : '—') + '</td>' : ''}<td class="num mono">${adj == null ? '—' : pct(adj)}</td></tr>`;
    }).join('');

    const f = (sess && sess.facds) || {};
    const facdsRow = (key, label) => `<b>${label}</b>${fSel(null, 'facds.' + key + '.v', (f[key] || {}).v || '', [['', '— sin evaluar —'], ['SI', '✓ Sí'], ['COND', '✓ Con refinamientos'], ['NO', '✗ No']], { scope: 'sessR' })}${fIn(null, 'facds.' + key + '.t', (f[key] || {}).t || '', { scope: 'sessR', ph: 'Justificación' })}`;
    const sR = sess || {};

    return `
    <section class="view">
      <div class="view-head"><div class="stack"><span class="eyebrow">Resultados empíricos · AAR</span><h2>Resultados y viabilidad</h2>
        <p class="muted">Cada pareja COA–OCOA se simula ${cfg().sim.n} veces encadenando todos los turnos (semilla ${cfg().sim.seed}, resultados reproducibles). P(éxito): ningún enfrentamiento en fracaso y el esfuerzo principal al menos parcial. Todas las DC: además, cada esfuerzo principal logra éxito o éxito decisivo.</p></div></div>
      <div class="panel">
        <header><h3>Matriz COA × OCOA</h3><span class="muted small">Seleccione una celda para ver el detalle.</span></header>
        <p class="infobox">Doctrina: cada COA se confronta de forma independiente frente a la OCOA. Esta matriz es un insumo para el Paso 5 (comparación de COA), no sustituye al juicio del comandante.</p>
        ${matrix}
        <div class="legend"><span><i style="background:var(--ok-soft);border:1px solid var(--ok)"></i>P(éxito) ≥ 70 %</span><span><i style="background:var(--warn-soft);border:1px solid var(--warn)"></i>40–69 %</span><span><i style="background:var(--bad-soft);border:1px solid var(--bad)"></i>&lt; 40 %</span></div>
      </div>
      <div class="panel">
        <header><h3>${esc(blue.name)} <span class="muted">frente a</span> ${esc(red.name)}</h3></header>
        <div class="tiles">
          <div class="tile"><span class="k">P(éxito de la COA)</span><span class="v">${pct(a.pSuccess)}</span></div>
          <div class="tile"><span class="k">P(todas las DC)</span><span class="v">${pct(a.pDC)}</span></div>
          <div class="tile"><span class="k">P(algún Bn &lt; FFIR-1 ${o.ffir || 70} %)</span><span class="v" style="color:${a.pFFIR > 0.5 ? 'var(--bad)' : 'var(--ink)'}">${pct(a.pFFIR)}</span></div>
          <div class="tile"><span class="k">CP media final azul (empeñadas)</span><span class="v">${pct(a.meanBlueCP)}</span></div>
          <div class="tile"><span class="k">CP media final roja (empeñadas)</span><span class="v">${pct(a.meanRedCP)}</span></div>
          <div class="tile"><span class="k">Índice compuesto</span><span class="v">${a.score.toFixed(0)}</span><span class="k">${cfg().score.wSuccess}·P(éxito) + ${cfg().score.wCP}·CP + ${cfg().score.wFFIR}·(1−P FFIR)</span></div>
        </div>
        <div class="tbl-wrap"><table><thead><tr><th>Turno</th><th>Enfrentamiento</th><th class="num">Ratio A:R</th><th class="num">Mínimo</th><th>Distribución de resultados</th><th class="num">P(≥ éxito)</th><th class="num">Bajas azules [P10–P90]</th><th class="num">Bajas rojas</th></tr></thead><tbody>${engRows}</tbody></table></div>
        <div class="legend">${['DEC', 'EXI', 'PAR', 'FRA'].map(z => '<span><i style="background:var(' + ({ DEC: '--dec', EXI: '--ok', PAR: '--warn', FRA: '--bad' })[z] + ')"></i>' + OUT[z] + '</span>').join('')}</div>
        <div class="grid2">
          <div class="stack"><h4 style="color:var(--blue)">Potencia de combate propia por turno (camino esperado)</h4><div class="chart-box" id="chartBlue"></div></div>
          <div class="stack"><h4 style="color:var(--red)">Potencia de combate adversaria por turno</h4><div class="chart-box" id="chartRed"></div></div>
        </div>
        <div class="grid2">
          <div class="tbl-wrap"><table><thead><tr><th>Unidad propia</th><th class="num">CP final media</th><th class="num">P10 – P90</th><th class="num">P(&lt; FFIR)</th><th class="num">Adjudicado</th></tr></thead><tbody>${endRows('blue')}</tbody></table></div>
          <div class="tbl-wrap"><table><thead><tr><th>Unidad adversaria</th><th class="num">CP final media</th><th class="num">P10 – P90</th><th class="num">Adjudicado</th></tr></thead><tbody>${endRows('red')}</tbody></table></div>
        </div>
        <p class="muted small">«Adjudicado» es el resultado de la confrontación conducida en la pestaña 4, con las decisiones del árbitro.</p>
      </div>
      <div class="panel">
        <header><h3>Evaluación de viabilidad (FACDS) y conclusiones</h3><span class="muted small">Se guardan con la pareja seleccionada.</span></header>
        <div class="facds">${facdsRow('F', 'Factible')}${facdsRow('A', 'Aceptable')}${facdsRow('C', 'Completa')}${facdsRow('D', 'Distinguible')}${facdsRow('S', 'Adecuada')}</div>
        <div class="grid2">${fIn('Fortalezas', 'strengths', sR.strengths || '', { scope: 'sessR', area: true, rows: 4 })}${fIn('Debilidades', 'weaknesses', sR.weaknesses || '', { scope: 'sessR', area: true, rows: 4 })}</div>
        ${fIn('Refinamientos a la COA', 'refinements', sR.refinements || '', { scope: 'sessR', area: true, rows: 4 })}
        ${fIn('Conclusión para el comandante', 'conclusions', sR.conclusions || '', { scope: 'sessR', area: true, rows: 3 })}
      </div>
    </section>`;
  }

  /* gráfico de líneas: potencia de combate por turno */
  function lineChart(el, o, side, path) {
    if (!el) return;
    const units = o.units[side];
    const W = 560, H = 250, L = 40, R = 120, Tp = 12, B = 30;
    const n = path.steps.length;
    const xs = i => L + (n === 1 ? 0 : i * (W - L - R) / (n - 1));
    const ys = v => Tp + (1 - v) * (H - Tp - B);
    let g = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(v => { g += `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${ys(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)" font-family="var(--f-mono)">${v * 100}</text>`; });
    path.steps.forEach((s, i) => { g += `<text x="${xs(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--ink-2)" font-family="var(--f-mono)">${s.label}</text>`; });
    if (side === 'blue') { const f = (o.ffir || 70) / 100; g += `<line x1="${L}" x2="${W - R}" y1="${ys(f)}" y2="${ys(f)}" stroke="var(--bad)" stroke-dasharray="4 3" stroke-width="1.2"/><text x="${W - R + 4}" y="${ys(f) + 4}" font-size="10" fill="var(--bad)">FFIR-1</text>`; }
    const shown = units.slice(0, 8);
    const ends = [];
    shown.forEach((u, k) => {
      const col = 'var(' + SERIES[k] + ')';
      const pts = path.steps.map((s, i) => xs(i) + ',' + ys(s.str[u.id]));
      g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`;
      path.steps.forEach((s, i) => { g += `<circle cx="${xs(i)}" cy="${ys(s.str[u.id])}" r="${i === n - 1 ? 4 : 2.5}" fill="${col}" stroke="var(--surface)" stroke-width="1.5"/>`; });
      ends.push({ y: ys(path.steps[n - 1].str[u.id]), name: u.name, col });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
    ends.forEach(e => { g += `<text x="${W - R + 8}" y="${e.y + 4}" font-size="11" fill="var(--ink-2)">${esc(e.name.length > 16 ? e.name.slice(0, 15) + '…' : e.name)}</text><rect x="${W - R + 1}" y="${e.y - 1}" width="5" height="3" fill="${e.col}"/>`; });
    // capa de lectura
    path.steps.forEach((s, i) => { const w = (W - L - R) / Math.max(1, n - 1); g += `<rect class="hit" data-i="${i}" x="${xs(i) - w / 2}" y="${Tp}" width="${w}" height="${H - Tp - B}" fill="transparent"/>`; });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Potencia de combate por turno">${g}</svg><div class="tip" hidden></div>`;
    const tip = el.querySelector('.tip');
    el.querySelectorAll('.hit').forEach(r => {
      r.addEventListener('mousemove', ev => {
        const i = +r.dataset.i, s = path.steps[i];
        tip.innerHTML = '<b>' + s.label + '</b><br>' + shown.map(u => esc(u.name) + ': ' + Math.round(s.str[u.id] * 100) + ' %').join('<br>');
        const box = el.getBoundingClientRect();
        tip.style.left = (ev.clientX - box.left) + 'px'; tip.style.top = (ev.clientY - box.top) + 'px'; tip.hidden = false;
      });
      r.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
  }

  /* =============================== 7 · DATOS =============================== */
  function vDatos(o) {
    const c = cfg();
    const confirmReset = ui.confirm === 'resetcfg' ? '<span class="confirm">¿Restaurar todos los valores por defecto? <button class="btn sm danger" data-act="resetCfgYes">Restaurar</button><button class="btn sm" data-act="cancel">Cancelar</button></span>' : '<button class="btn" data-act="resetCfg">Restaurar valores por defecto</button>';
    const lt = (k) => { const t = c.lossTables[k]; return `<div class="stack"><h4>${esc(t.label)}</h4><div class="tbl-wrap"><table class="tbl-edit"><thead><tr><th>Ratio A:R</th>${t.x.map(x => '<th class="num">' + E.fmtRatio(x) + '</th>').join('')}</tr></thead><tbody>
      <tr><th scope="row">Bajas azules %</th>${t.f.map((v, i) => '<td>' + fIn(null, 'lossTables.' + k + '.f.' + i, v, { scope: 'cfg', type: 'number', step: 1 }) + '</td>').join('')}</tr>
      <tr><th scope="row">Bajas rojas %</th>${t.e.map((v, i) => '<td>' + fIn(null, 'lossTables.' + k + '.e.' + i, v, { scope: 'cfg', type: 'number', step: 1 }) + '</td>').join('')}</tr></tbody></table></div></div>`; };
    return `
    <section class="view">
      <div class="view-head"><div class="stack"><span class="eyebrow">Fundamento de los cálculos</span><h2>Datos y método</h2>
      <p class="muted">Todos los parámetros son editables para calibrar el modelo con los datos de la escuela o del escenario. Los cambios afectan a todas las operaciones.</p></div>${confirmReset}</div>
      <div class="panel">
        <header><h3>Cómo calcula la herramienta</h3></header>
        <ol class="stack" style="padding-left:20px;margin:0;max-width:90ch">
          <li><b>Potencia de combate</b> de cada bando en el punto de contacto: Σ FE × fuerza actual × % empeñado (Force Ratio Calculator Matrix, CGSC ST 100-3). Se compara sector a sector, nunca brigada contra división.</li>
          <li><b>Modificadores</b> (terreno, obstáculos, fuegos, sorpresa, moral, ISR/C2/GE) multiplican la potencia azul. Los fuegos se cuentan aparte y entran aquí, como indica el Anexo C de TRYZUB.</li>
          <li><b>Lectura doctrinal</b>: el ratio efectivo se compara con el ratio mínimo histórico de planeamiento de la tarea (FM 5-0 / FM 6-0). Margen = ratio efectivo ÷ ratio mínimo. Decisivo ≥ ${c.thresholds.dec} · Éxito ≥ ${c.thresholds.exi} · Parcial ≥ ${c.thresholds.par} · Fracaso &lt; ${c.thresholds.par}.</li>
          <li><b>Bajas</b> interpoladas en escala logarítmica en las tablas BCTP. Si la tarea es ofensiva contra una defensa preparada, la tabla de defensa se lee desde el lado rojo. Romper el contacto a tiempo multiplica las bajas azules por ${c.brkFactor}. Las bajas rojas se reparten por FE, con peso ×${c.hptWeight} sobre el HPT designado.</li>
          <li><b>Incertidumbre</b>: Monte Carlo con ruido log-normal sobre el ratio (σ = ${c.sim.sigma}) y sobre las bajas (σ = ${c.sim.sigmaLoss}); ${c.sim.n} iteraciones encadenando los turnos; semilla fija para que el resultado sea reproducible en el aula.</li>
          <li><b>Regla del árbitro</b>: los ratios dicen lo que es posible, no lo que ocurrirá. La célula blanca puede imponer resultado y bajas en cada enfrentamiento; el turno siguiente parte del estado adjudicado.</li>
        </ol>
      </div>
      <div class="grid2">
        <div class="panel">
          <header><h3>Tareas y ratios mínimos de planeamiento</h3></header>
          <div class="tbl-wrap"><table class="tbl-edit"><thead><tr><th>Tarea</th><th class="num">Ratio A:R mínimo</th><th>Tabla de bajas</th><th>Rompe contacto</th></tr></thead><tbody>
          ${Object.keys(c.tasks).map(k => { const t = c.tasks[k]; return `<tr><td>${fIn(null, 'tasks.' + k + '.label', t.label, { scope: 'cfg' })}</td><td style="width:110px">${fIn(null, 'tasks.' + k + '.req', +t.req.toFixed(4), { scope: 'cfg', type: 'number', step: 0.01 })}<span class="muted small">${E.fmtRatio(t.req)}</span></td><td>${fSel(null, 'tasks.' + k + '.table', t.table, [['def', 'Defensa'], ['hasty', 'Precipitado'], ['atk', 'Ataque (inversa)']], { scope: 'cfg' })}</td><td style="text-align:center"><input id="brk-cfg-${k}" type="checkbox" data-scope="cfg" data-b="tasks.${k}.brk" data-t="bool"${t.brk ? ' checked' : ''} aria-label="Rompe contacto por defecto"></td></tr>`; }).join('')}
          </tbody></table></div>
          <p class="muted small">Fuente: ratios mínimos históricos de planeamiento (FM 5-0 / FM 6-0): retardo 1:6, defensa preparada 1:3, defensa precipitada 1:2,5, contraataque de flanco 1:1, ataque precipitado 2,5:1, ataque contra posición preparada 3:1. Introduzca el ratio como número decimal (1:6 = 0,1667).</p>
        </div>
        <div class="panel">
          <header><h3>Simulación y umbrales</h3></header>
          <div class="eng-grid">
            ${fIn('Iteraciones', 'sim.n', c.sim.n, { scope: 'cfg', type: 'number', step: 100 })}
            ${fIn('σ ratio (log)', 'sim.sigma', c.sim.sigma, { scope: 'cfg', type: 'number', step: 0.05 })}
            ${fIn('σ bajas (log)', 'sim.sigmaLoss', c.sim.sigmaLoss, { scope: 'cfg', type: 'number', step: 0.05 })}
            ${fIn('Semilla', 'sim.seed', c.sim.seed, { scope: 'cfg', type: 'number', step: 1 })}
            ${fIn('Umbral decisivo', 'thresholds.dec', c.thresholds.dec, { scope: 'cfg', type: 'number', step: 0.05 })}
            ${fIn('Umbral éxito', 'thresholds.exi', c.thresholds.exi, { scope: 'cfg', type: 'number', step: 0.05 })}
            ${fIn('Umbral parcial', 'thresholds.par', c.thresholds.par, { scope: 'cfg', type: 'number', step: 0.05 })}
            ${fIn('Factor romper contacto', 'brkFactor', c.brkFactor, { scope: 'cfg', type: 'number', step: 0.05 })}
            ${fIn('Peso HPT', 'hptWeight', c.hptWeight, { scope: 'cfg', type: 'number', step: 0.5 })}
            ${fIn('Banda verde ≥ %', 'statusBands.green', c.statusBands.green, { scope: 'cfg', type: 'number', step: 1 })}
            ${fIn('Banda ámbar ≥ %', 'statusBands.amber', c.statusBands.amber, { scope: 'cfg', type: 'number', step: 1 })}
          </div>
          <h4>Índice compuesto (pesos)</h4>
          <div class="eng-grid">
            ${fIn('P(éxito)', 'score.wSuccess', c.score.wSuccess, { scope: 'cfg', type: 'number', step: 0.05 })}
            ${fIn('CP final azul', 'score.wCP', c.score.wCP, { scope: 'cfg', type: 'number', step: 0.05 })}
            ${fIn('1 − P(FFIR)', 'score.wFFIR', c.score.wFFIR, { scope: 'cfg', type: 'number', step: 0.05 })}
          </div>
        </div>
      </div>
      <div class="panel"><header><h3>Tablas de bajas (BCTP · Force Ratio Calculator)</h3><span class="muted small">Bajas para un combate hasta la decisión durante el turno.</span></header><div class="grid2">${lt('def')}${lt('hasty')}</div></div>
      <div class="panel"><header><h3>Modificadores de combate</h3></header>
        <div class="grid3">${Object.keys(c.mods).map(k => { const m = c.mods[k]; return `<div class="stack"><h4>${esc(m.label)}</h4><div class="tbl-wrap"><table class="tbl-edit"><tbody>${m.opts.map((op_, i) => '<tr><td>' + fIn(null, 'mods.' + k + '.opts.' + i + '.0', op_[0], { scope: 'cfg' }) + '</td><td style="width:90px">' + fIn(null, 'mods.' + k + '.opts.' + i + '.1', op_[1], { scope: 'cfg', type: 'number', step: 0.05 }) + '</td></tr>').join('')}</tbody></table></div></div>`; }).join('')}</div>
      </div>
      <div class="panel"><header><h3>Referencias</h3></header>
        <ul class="small" style="margin:0;padding-left:20px;display:grid;gap:4px">
          <li>AJP-5(A) / COPD — Análisis de líneas de acción. APP-28(B) Tactical Planning for Land Forces, Anexo D — War Gaming.</li>
          <li>EUMAM Wargaming Guidance · TRYZUB Wargaming Products · TRYZUB Wargame Example SIRKO.</li>
          <li>CGSC ST 100-3 Battle Book / Force Ratio Calculator Matrix — equivalentes de fuerza y tablas de bajas BCTP.</li>
          <li>FM 5-0 / FM 6-0 — ratios mínimos históricos de planeamiento.</li>
          <li>US Army CALL «How to Master Wargaming» · UK MoD DCDC «Wargaming Handbook».</li>
        </ul>
      </div>
    </section>`;
  }

  /* ------------------------------ post-render ------------------------------ */
  function afterRender() {
    if (ui.tab === 'res') {
      const o = op();
      const [bId, rId] = (ui.resPair || '').split('|');
      const blue = o.blueCOAs.find(c => c.id === bId), red = o.redCOAs.find(c => c.id === rId);
      if (blue && red) {
        const path = E.runPath(o, blue, red, cfg());
        lineChart(document.getElementById('chartBlue'), o, 'blue', path);
        lineChart(document.getElementById('chartRed'), o, 'red', path);
      }
    }
    const imp = document.getElementById('importFile');
    if (imp) imp.addEventListener('change', ev => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => importJson(rd.result);
      rd.readAsText(f);
    });
  }

  function importJson(txt) {
    try {
      const d = JSON.parse(txt);
      const list = Array.isArray(d) ? d : (d.ops ? d.ops : [d]);
      let n = 0;
      list.forEach(o => {
        if (!o || !o.units || !o.events) return;
        o.blueCOAs = o.blueCOAs || []; o.redCOAs = o.redCOAs || []; o.sectors = o.sectors || []; o.sessions = o.sessions || {};
        if (store.ops.find(x => x.id === o.id)) o.id = o.id + '-' + Math.random().toString(36).slice(2, 5);
        store.ops.push(o); store.cur = o.id; n++;
      });
      if (!n) throw new Error('sin operaciones');
      save(); render(); toast(n === 1 ? 'Operación importada' : n + ' operaciones importadas');
    } catch (e) { toast('No se pudo importar: el archivo no es un JSON de operación válido.'); }
  }

  /* ------------------------------ eventos ------------------------------ */
  function coerce(el) {
    const t = el.dataset.t;
    if (t === 'bool') return el.checked;
    if (t === 'num') return el.value === '' ? '' : +el.value;
    return el.value;
  }
  function onBind(el, final) {
    const scope = el.dataset.scope;
    let root;
    if (scope === 'sessR') { const [b, r] = (ui.resPair || '').split('|'); root = session(op(), b, r, true); }
    else root = rootFor(scope);
    let v = coerce(el);
    if (scope === 'cfg' && el.dataset.t === 'num' && v === '') return;
    setPath(root, el.dataset.b, v);
    if (el.dataset.feLib) {
      const lib = X.FE_LIBRARY.find(l => l.type === el.value);
      if (lib) { const p = el.dataset.b.replace(/\.type$/, '.fe'); setPath(op(), p, lib.fe); final = true; }
    }
    if (el.dataset.b === 'name' && !scope) document.getElementById('opName').textContent = el.value;
    if (el.dataset.b === 'classification' && !scope) document.getElementById('classif').textContent = el.value;
    save();
    if (final || el.dataset.rr) render();
  }
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.b && el.tagName !== 'SELECT' && el.type !== 'checkbox') onBind(el, false);
    if (el.dataset.actInput === 'criteria') { op().criteria = el.value.split('\n').map(s => s.trim()).filter(Boolean); save(); }
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.b) {
      // números y textos: re-render al confirmar para recalcular
      const recalc = el.tagName === 'SELECT' || el.type === 'checkbox' || el.dataset.t === 'num' || el.dataset.feLib || /\.(name|label|id)$/.test(el.dataset.b);
      onBind(el, recalc);
      return;
    }
    const a = el.dataset.actChange;
    const o = op();
    if (a === 'selOp') { store.cur = el.value; ui.selBlue = ui.selRed = ui.wgBlue = ui.wgRed = ui.resPair = null; ui.wgTurn = 0; save(); render(); }
    else if (a === 'tech') { const k = el.dataset.k; o.techniques = o.techniques || []; const i = o.techniques.indexOf(k); if (el.checked && i < 0) o.techniques.push(k); if (!el.checked && i >= 0) o.techniques.splice(i, 1); save(); }
    else if (a === 'vs') { const arr = getPath(o, el.dataset.path) || []; const i = arr.indexOf(el.dataset.u); if (el.checked && i < 0) arr.push(el.dataset.u); if (!el.checked && i >= 0) arr.splice(i, 1); setPath(o, el.dataset.path, arr); save(); }
    else if (a === 'wgBlue') { ui.wgBlue = el.value; ui.resPair = ui.wgBlue + '|' + ui.wgRed; render(); }
    else if (a === 'wgRed') { ui.wgRed = el.value; ui.resPair = ui.wgBlue + '|' + ui.wgRed; render(); }
  });

  document.addEventListener('click', ev => {
    const tabBtn = ev.target.closest('.tab');
    if (tabBtn) { ui.tab = tabBtn.dataset.tab; ui.confirm = null; try { history.replaceState(null, '', '#' + ui.tab); } catch (e) { /* sin historial */ } window.scrollTo(0, 0); render(); return; }
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act, o = op(), d = b.dataset;
    const actions = {
      cancel: () => { ui.confirm = null; },
      newOp: () => { const n = X.blank(); store.ops.push(n); store.cur = n.id; toast('Operación creada'); },
      loadTryzub: () => { const n = X.tryzub(); n.id = 'op-tryzub-' + Date.now().toString(36); store.ops.push(n); store.cur = n.id; toast('Ejemplo Op TRYZUB cargado'); },
      loadMarAzul: () => { const n = X.marAzul(); n.id = 'op-marazul-' + Date.now().toString(36); store.ops.push(n); store.cur = n.id; toast('Ejemplo anfibio cargado'); },
      dupOp: () => { const n = E.deepClone(o); n.id = uid('op'); n.name = o.name + ' (copia)'; store.ops.push(n); store.cur = n.id; toast('Operación duplicada'); },
      delOp: () => { ui.confirm = 'delop'; },
      delOpYes: () => { store.ops = store.ops.filter(x => x.id !== o.id); if (!store.ops.length) store.ops.push(X.blank()); store.cur = store.ops[0].id; ui.confirm = null; toast('Operación eliminada'); },
      exportOp: () => {
        try {
          const blob = new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob); const lk = document.createElement('a');
          lk.href = url; lk.download = (o.name || 'operacion').replace(/[^\w\-]+/g, '_') + '.json'; document.body.appendChild(lk); lk.click(); lk.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) { /* descarga no disponible */ }
        ui.showJson = true; toast('JSON generado. Si la descarga no se inicia, cópielo desde el cuadro.');
      },
      toggleJson: () => { ui.showJson = !ui.showJson; },
      copyJson: () => { const t = document.getElementById('jsonOut'); if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(() => toast('JSON copiado'), () => { t.select(); toast('Seleccionado: pulse Ctrl+C'); }); else { t.select(); } return false; },
      importText: () => { const t = document.getElementById('jsonIn'); if (t && t.value.trim()) importJson(t.value); return false; },
      addSector: () => { o.sectors.push({ id: 'S' + (o.sectors.length + 1), name: 'Sector ' + (o.sectors.length + 1) }); },
      delSector: () => { o.sectors.splice(+d.i, 1); },
      addEvent: () => { o.events.push({ id: uid('ev'), name: 'Evento crítico ' + (o.events.length + 1), time: '', space: '', technique: (o.techniques || ['key'])[0] || 'key', dc: '' }); },
      delEvent: () => { o.events.splice(+d.i, 1); },
      mvEvent: () => { const i = +d.i, j = i + (+d.d); if (j < 0 || j >= o.events.length) return; const t = o.events[i]; o.events[i] = o.events[j]; o.events[j] = t; },
      addUnit: () => { o.units[d.side].push({ id: uid(d.side === 'blue' ? 'b' : 'r'), name: d.side === 'blue' ? 'Nueva unidad' : 'Unidad enemiga', type: '', fe: 0.5, str: 100 }); },
      delUnit: () => { o.units[d.side].splice(+d.i, 1); },
      selCoa: () => { ui.coaSide = d.side; ui.confirm = null; if (d.side === 'blue') ui.selBlue = d.id; else ui.selRed = d.id; },
      addCoa: () => {
        const c = d.side === 'blue' ? { id: uid('coa'), name: 'COA ' + (o.blueCOAs.length + 1), statement: '', plan: {} } : { id: uid('ocoa'), name: 'OCOA ' + (o.redCOAs.length + 1), statement: '', tag: '', likelihood: 0, plan: {} };
        (d.side === 'blue' ? o.blueCOAs : o.redCOAs).push(c); ui.coaSide = d.side; if (d.side === 'blue') ui.selBlue = c.id; else ui.selRed = c.id;
      },
      dupCoa: () => {
        const arr = d.side === 'blue' ? o.blueCOAs : o.redCOAs, src = arr.find(c => c.id === (d.side === 'blue' ? ui.selBlue : ui.selRed)); if (!src) return;
        const c = E.deepClone(src); c.id = uid(d.side === 'blue' ? 'coa' : 'ocoa'); c.name = src.name + ' (copia)';
        if (c.plan) Object.keys(c.plan).forEach(k => (c.plan[k].engagements || []).forEach(e => { e.id = uid('eng'); }));
        arr.push(c); if (d.side === 'blue') ui.selBlue = c.id; else ui.selRed = c.id;
      },
      delCoa: () => { ui.confirm = 'delcoa'; },
      delCoaYes: () => { if (d.side === 'blue') o.blueCOAs = o.blueCOAs.filter(c => c.id !== ui.selBlue); else o.redCOAs = o.redCOAs.filter(c => c.id !== ui.selRed); ui.confirm = null; },
      addEng: () => { const c = o.blueCOAs[+d.ci]; c.plan[d.ev] = c.plan[d.ev] || { action: '', engagements: [] }; c.plan[d.ev].engagements.push({ id: uid('eng'), sector: (o.sectors[0] || {}).id, label: 'Enfrentamiento', task: 'hastyDef', me: false, brk: false, hpt: '', vs: [], units: [{ u: '', pct: 100 }], mods: {} }); },
      delEng: () => { o.blueCOAs[+d.ci].plan[d.ev].engagements.splice(+d.i, 1); },
      addEngUnit: () => { const arr = getPath(o, d.path) || []; arr.push({ u: '', pct: 100 }); setPath(o, d.path, arr); },
      delEngUnit: () => { getPath(o, d.path).splice(+d.i, 1); },
      addPlace: () => { const arr = getPath(o, d.path) || []; arr.push({ u: '', sector: (o.sectors[0] || {}).id, pct: 100 }); setPath(o, d.path, arr); },
      delPlace: () => { getPath(o, d.path).splice(+d.i, 1); },
      copyPlace: () => { const c = o.redCOAs[+d.ci]; c.plan[d.ev] = c.plan[d.ev] || { pre: '', reaction: '', placement: [] }; c.plan[d.ev].placement = E.deepClone(((c.plan[d.prev] || {}).placement) || []); toast('Despliegue copiado'); },
      view: () => { ui.view = d.v; },
      turn: () => { ui.wgTurn = +d.i; ui.wgStep = 0; },
      step: () => { ui.wgStep = +d.i; },
      prevStep: () => { if (ui.wgStep > 0) ui.wgStep--; else if (ui.wgTurn > 0) { ui.wgTurn--; ui.wgStep = steps(o).length - 1; } },
      nextStep: () => { const n = steps(o).length; if (ui.wgStep < n - 1) ui.wgStep++; else if (ui.wgTurn < o.events.length - 1) { ui.wgTurn++; ui.wgStep = 0; toast('Turno cerrado. T' + (ui.wgTurn + 1) + ' parte del estado adjudicado.'); } else toast('Último turno cerrado. Revise Productos y Resultados.'); },
      clearOvr: () => { const s = session(o, ui.wgBlue, ui.wgRed, true); const t = s.turns[d.ev]; if (t) { if (t.ovr) delete t.ovr[d.e]; if (t.mods) delete t.mods[d.e]; } },
      addDsm: () => { const s = session(o, ui.wgBlue, ui.wgRed, true); s.dsm = s.dsm || []; s.dsm.push({ dp: 'DP ' + (s.dsm.length + 1) }); },
      delDsm: () => { const s = session(o, ui.wgBlue, ui.wgRed, true); s.dsm.splice(+d.i, 1); },
      resPair: () => { ui.resPair = d.k; const [b_, r_] = d.k.split('|'); ui.wgBlue = b_; ui.wgRed = r_; },
      resetCfg: () => { ui.confirm = 'resetcfg'; },
      resetCfgYes: () => { store.cfg = E.deepClone(E.DEFAULT_CONFIG); ui.confirm = null; toast('Valores por defecto restaurados'); }
    };
    if (actions[a]) { const r = actions[a](); if (r === false) return; save(); render(); }
  });
  window.addEventListener('hashchange', () => { readHash(); render(); });

  render();
})();
