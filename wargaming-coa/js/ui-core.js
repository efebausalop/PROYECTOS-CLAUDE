/* ==========================================================================
   COA Wargaming Tool v3 — núcleo de la interfaz
   Estado, persistencia, idioma, campos enlazados, navegación y eventos.
   Las vistas están en ui-inputs.js, ui-wargame.js y ui-results.js.
   ========================================================================== */
(function (global) {
  'use strict';
  const C = global.WGCat, E = global.WGEngine, W = global.WGModel, SC = global.WGScenarios;
  const LS = 'wgcoa.v3';
  const U = global.WGUI = { R: {}, A: {} };

  /* ------------------------------ estado ------------------------------ */
  let store = null;
  function freshStore() {
    const ops = [SC.tryzub.build(), SC.garnacha.build(), SC.marazul.build()];
    return { v: 3, ops, cur: ops[0].id, cfg: W.clone(E.DEFAULT_CONFIG), lang: 'es', assist: true, sec: 'inputs' };
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) { const o = JSON.parse(raw); if (o && o.v === 3 && Array.isArray(o.ops) && o.ops.length) { o.ops.forEach(W.ensure); o.cfg = mergeCfg(o.cfg); return o; } }
    } catch (e) { /* almacenamiento no disponible */ }
    return freshStore();
  }
  function mergeCfg(c) {
    const d = W.clone(E.DEFAULT_CONFIG); if (!c) return d;
    ['thresholds', 'sim', 'statusBands', 'score'].forEach(k => { d[k] = Object.assign(d[k], c[k] || {}); });
    if (c.tasks) Object.keys(d.tasks).forEach(k => { if (c.tasks[k]) d.tasks[k] = Object.assign(d.tasks[k], c.tasks[k]); });
    if (c.mods) Object.keys(d.mods).forEach(k => { if (c.mods[k]) d.mods[k] = c.mods[k]; });
    ['brkFactor', 'hptWeight'].forEach(k => { if (c[k] != null) d[k] = c[k]; });
    if (c.dmg) d.dmg = c.dmg;
    return d;
  }
  let saveT = null, storageOK = true;
  function save(now) { clearTimeout(saveT); saveT = setTimeout(doSave, now ? 0 : 350); }
  function doSave() {
    try { localStorage.setItem(LS, JSON.stringify(store)); storageOK = true; setSS('✓ ' + t('Guardado') + ' ' + new Date().toLocaleTimeString(store.lang === 'en' ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit' })); }
    catch (e) { storageOK = false; setSS('⚠ ' + t('Almacenamiento bloqueado — use Exportar'), true); }
    U.renderNav(); U.renderAssist();
  }
  function setSS(txt, err) { const e = $('saveState'); if (e) { e.textContent = txt; e.className = err ? 'err' : ''; } }

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const pct = (x, d) => (x == null || isNaN(x) ? '—' : (x * 100).toFixed(d || 0) + ' %');
  function op() { return store.ops.find(o => o.id === store.cur) || store.ops[0]; }
  function cfg() { return store.cfg; }
  function game(create) { return W.game(op(), null, create); }
  function coa() { const o = op(); return o.coas.find(c => c.id === o.prep.coa); }
  function ecoa() { const o = op(); return o.ecoas.find(c => c.id === o.prep.acoa); }

  /* ------------------------------ idioma ------------------------------ */
  function t(s, vars) {
    let out = (store && store.lang === 'en' && global.WGI18N && global.WGI18N.en[s]) || s;
    if (vars) Object.keys(vars).forEach(k => { out = out.split('{' + k + '}').join(vars[k]); });
    return out;
  }
  const RES_ES = { 'DECISIVE SUCCESS': 'Éxito decisivo', 'SUCCESS': 'Éxito', 'PARTIAL SUCCESS': 'Éxito parcial', 'NEUTRAL': 'Neutral', 'FAILURE': 'Fracaso', 'DECISIVE FAILURE': 'Fracaso decisivo', 'NO CONTACT': 'Sin contacto' };
  function resL(code) { if (!code) return '—'; return store.lang === 'en' ? code.charAt(0) + code.slice(1).toLowerCase() : (RES_ES[code] || code); }
  function resCls(code) { return !code ? '' : /DECISIVE SUCCESS/.test(code) ? 'dec' : /^SUCCESS/.test(code) ? 'ok' : /PARTIAL|NEUTRAL/.test(code) ? 'warn' : /FAIL/.test(code) ? 'bad' : 'nc'; }
  function resTag(code, extra) { return `<span class="tag res-${resCls(code)}">${esc(resL(code))}${extra ? ' · ' + esc(extra) : ''}</span>`; }

  /* ------------------------------ rutas ------------------------------ */
  function getP(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
  function setP(o, p, v) { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; }
  function rootOf(scope) { if (scope === 'g') return game(true); if (scope === 'cfg') return cfg(); if (scope === 'st') return store; return op(); }

  /* --------------------------- campos enlazados ---------------------------
     data-b = ruta; data-s = ámbito (op por defecto · g = confrontación activa ·
     cfg = parámetros del motor · st = preferencias); data-re = re-render. */
  let fid = 0;
  function attrs(p, scope, re, extra) { return `data-b="${p}"${scope ? ` data-s="${scope}"` : ''}${re ? ` data-re="${re}"` : ''} ${extra || ''}`; }
  function val(p, scope) { return getP(rootOf(scope), p); }
  function fIn(p, ph, extra, scope, re) { return `<input class="in" id="f${++fid}" ${attrs(p, scope, re, extra)} value="${esc(val(p, scope))}" placeholder="${esc(ph || '')}">`; }
  function fNum(p, extra, scope, re) { const v = val(p, scope); return `<input type="number" class="in num" id="f${++fid}" ${attrs(p, scope, re || 'self', extra)} data-num="1" value="${esc(v == null ? '' : v)}">`; }
  function fTa(p, rows, ph, extra, scope) { return `<textarea class="ta" id="f${++fid}" ${attrs(p, scope, '', extra)} rows="${rows || 3}" placeholder="${esc(ph || '')}">${esc(val(p, scope))}</textarea>`; }
  function fSel(p, opts, re, extra, scope) {
    const v = val(p, scope);
    return `<select class="sl ${statusCls(v)}" id="f${++fid}" ${attrs(p, scope, re, extra)}>` +
      opts.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}"${String(k) === String(v == null ? '' : v) ? ' selected' : ''}>${esc(l)}</option>`; }).join('') + '</select>';
  }
  function fChk(p, label, re, scope) { return `<label class="chk"><input type="checkbox" id="f${++fid}" ${attrs(p, scope, re)}${val(p, scope) ? ' checked' : ''}><span>${label}</span></label>`; }
  function statusCls(v) {
    if (/^(TRIGGERED|ANSWERED|VALID|ACHIEVED|Supportable|SUCCESS|DECISIVE SUCCESS|SI)$/.test(v)) return 'st-ok';
    if (/^(WATCH|ACTIVE|OPEN|UNTESTED|PLANNED|PARTIAL|PARTIAL SUCCESS|Supportable with risk|ENGAGED|NEUTRAL|COND)$/.test(v)) return 'st-warn';
    if (/^(MISSED|INVALID|FAILED|FAILURE|DECISIVE FAILURE|Not supportable.*|NO)$/.test(v)) return 'st-bad';
    if (/^(CLOSED|INACTIVE)$/.test(v)) return 'st-off';
    return '';
  }

  /* ------------------------------ opciones ------------------------------ */
  const O = {
    dp: () => [['', '— DP —'], ...op().reg.dp.map(d => [d.id, d.id + ' · ' + short(d.dec, 44)])],
    ccir: () => [['', '— CCIR —'], ...op().reg.ccir.map(c => [c.id, c.id + ' · ' + short(c.q, 44)])],
    nai: () => [['', '—'], ...op().reg.nai.map(n => [n.id, n.id + ' · ' + short(n.loc, 30)])],
    hpt: () => [['', '—'], ...op().reg.hpt.map(n => [n.id, n.id + ' · ' + short(n.tgt, 30)])],
    tai: () => [['', '—'], ...op().reg.tai.map(n => [n.id, n.id])],
    ce: () => [['', '— ' + t('evento crítico') + ' —'], ...op().ces.map(c => [c.id, c.id + ' · ' + short(c.title, 46)])],
    steps: () => [['', '—'], ...op().phases.map(s => [s.id, s.n])],
    coa: () => op().coas.map(c => [c.id, c.name]),
    ecoa: () => op().ecoas.map(c => [c.id, (c.tag ? c.tag + ' · ' : '') + c.name]),
    cm: () => [['', '— ' + t('ubicación') + ' —'], ...op().cm.map(c => [c, c])],
    sectors: () => op().sectors.map(s => [s.id, s.name]),
    turns: () => [['', '— ' + t('sin turno') + ' —'], ...op().turns.map(x => [x.id, x.label + ' · ' + short(x.title, 42)])],
    units: side => { const m = E.unitMap(op()); return [['', '— ' + t('unidad') + ' —'], ...op().orbat.filter(u => !side || u.side === side).map(u => [u.id, '  '.repeat(depth(u, m)) + (u.side === 'R' ? '◆ ' : '▪ ') + u.name + (E.unitFE(u) ? '  [' + E.unitFE(u).toFixed(2) + ' FE]' : '')])]; },
    fight: side => [['', '— ' + t('unidad') + ' —'], ...op().orbat.filter(u => u.side === side && E.unitFE(u) > 0).map(u => [u.id, uname(u) + '  [' + E.unitFE(u).toFixed(2) + ' FE]'])]
  };
  /* Nombre visible: añade la unidad superior cuando el nombre se repite (p. ej. «1st MR Bn (BMP) · MR BDE 1»). */
  let unameCache = { k: null, v: {} };
  function uname(u) {
    if (!u) return '';
    const o = op(), k = o.id + ':' + o.orbat.length;
    if (unameCache.k !== k) {
      const cnt = {}, m = {}; o.orbat.forEach(x => { cnt[x.name] = (cnt[x.name] || 0) + 1; m[x.id] = x; });
      const v = {}; o.orbat.forEach(x => { const p = m[x.p]; v[x.id] = cnt[x.name] > 1 && p ? x.name + ' · ' + p.name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ') : x.name; });
      unameCache = { k, v };
    }
    return unameCache.v[u.id] || u.name;
  }
  function depth(u, m) { let d = 0, p = u.p; while (p && m[p] && d < 12) { d++; p = m[p].p; } return d; }
  const METHODS = {
    critical: { l: 'Eventos críticos', pre: 'KEY EVENT', d: 'Se centra en los eventos críticos que deciden la operación, jugados en secuencia (secuencia de tareas esenciales). Adecuado con poco tiempo y eventos decisivos claros.' },
    belt: { l: 'Fajas', pre: 'BELT', d: 'Divide la zona en fajas a lo ancho, perpendiculares al eje enemigo. Cada faja es un turno con todas las funciones de combate. Útil en terreno compartimentado y operaciones por fases (pasos de río, asaltos aéreos o anfibios).' },
    box: { l: 'Caja', pre: 'BOX', d: 'Análisis detallado de un área crítica (una EA, un punto de paso, una playa, un terreno clave). Aísla el área y juega sólo las fuerzas que actúan en ella.' },
    avenue: { l: 'Avenida en profundidad', pre: 'SEGMENT', d: 'Juega una avenida de aproximación de principio a fin, segmento a segmento. Adecuado para una avenida dominante y para pasos de escalón en profundidad.' }
  };

  /* --------------------------- cálculo con caché --------------------------- */
  const cache = { path: {}, mc: {}, all: {} };
  function keyOf(o, extra) { return JSON.stringify([o.orbat.map(u => [u.id, u.cp, u.frT, u.frQ, u.frFE]), o.turns, o.prep.methods, o.coas, o.ecoas, o.ffir, cfg(), extra || '']); }
  function pathFor(c, e, g) {
    const o = op(); if (!c || !e) return null;
    const k = keyOf(o, [c.id, e.id, g ? JSON.stringify(g.turns) : '']);
    if (cache.path.k !== k) cache.path = { k, v: E.runPath(o, c, e, cfg(), g) };
    return cache.path.v;
  }
  function analysis() {
    const o = op(), k = keyOf(o, 'all');
    if (cache.all.k !== k) cache.all = { k, v: E.analyseAll(o, cfg()) };
    return cache.all.v;
  }

  /* ------------------------------ navegación ------------------------------ */
  const NAV = [
    { g: 'Entradas' },
    { id: 'inputs', ic: '1', l: 'Datos de planeamiento' },
    { id: 'orbat', ic: '2', l: 'ORBAT (hasta compañía)' },
    { g: 'Preparación' },
    { id: 'prep', ic: '3', l: 'Preparación' },
    { id: 'plans', ic: '4', l: 'Planes COA / ECOA' },
    { g: 'Ejecución' },
    { id: 'wargame', ic: '⚔', l: 'Confrontación' },
    { id: 'fr', ic: '⚖', l: 'Correlación de fuerzas' },
    { id: 'adj', ic: '🎲', l: 'Adjudicación' },
    { id: 'reg', ic: '◎', l: 'Registros' },
    { g: 'Resultados' },
    { id: 'results', ic: '∑', l: 'Resumen y evaluación' },
    { id: 'stats', ic: '%', l: 'Análisis estadístico' },
    { id: 'data', ic: 'ƒ', l: 'Datos y método' }
  ];
  U.renderNav = function () {
    const o = op(), act = E.activeTurns(o), g = W.game(o, null, false) || { turns: {} };
    const adj = act.filter(x => g.turns[x.id] && g.turns[x.id].res).length, pr = U.prepReadiness ? U.prepReadiness().pct : 0;
    const regN = Object.values(o.reg).reduce((a, x) => a + x.length, 0);
    const bd = {
      inputs: `<span class="bd">${o.coas.length}×${o.ecoas.length}</span>`, orbat: `<span class="bd">${o.orbat.length}</span>`,
      prep: `<span class="bd ${pr >= 100 ? 'ok' : pr >= 60 ? '' : 'warn'}">${pr}%</span>`,
      wargame: `<span class="bd ${adj === act.length && act.length ? 'ok' : ''}">${adj}/${act.length}</span>`,
      reg: `<span class="bd">${regN}</span>`
    };
    $('side').innerHTML = NAV.map(n => n.g ? `<div class="grp">${t(n.g)}</div>` :
      `<button class="nav ${store.sec === n.id ? 'on' : ''}" data-a="go" data-t="${n.id}" title="${esc(t(n.l))}"><span class="ic">${n.ic}</span><span class="l">${t(n.l)}</span>${bd[n.id] || ''}</button>`).join('') +
      `<div class="foot">${t('APP-28(B) Anexo D · AJP-5(A). Se guarda en este navegador; use Exportar para conservar o compartir.')}</div>`;
  };
  U.go = function (id) { store.sec = id; U.render(); window.scrollTo(0, 0); save(); };

  function renderHeader() {
    const o = op();
    $('opTitle').textContent = o.meta.title;
    $('opTag').textContent = o.meta.tag || o.meta.classification || '';
    $('opSel').innerHTML = store.ops.map(x => `<option value="${esc(x.id)}"${x.id === o.id ? ' selected' : ''}>${esc(x.meta.title)}</option>`).join('');
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === store.lang ? 'true' : 'false'));
    document.documentElement.lang = store.lang;
    $('asBtn').classList.toggle('on', !!store.assist);
    $('assist').classList.toggle('on', !!store.assist);
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
    const pr = $('printBtn'); if (pr) pr.hidden = !(window.self === window.top);
  }
  U.render = function () {
    fid = 0;
    const o = op(); W.ensure(o);
    renderHeader();
    const y = window.scrollY;
    const f = U.R[store.sec] || U.R.inputs;
    $('main').innerHTML = f();
    window.scrollTo(0, y);
    U.renderNav(); U.renderAssist();
    if (U.after[store.sec]) U.after[store.sec]();
  };
  U.after = {};
  U.rerender = U.render;

  /* ------------------------------ avisos ------------------------------ */
  function toast(msg) { const e = $('toast'); e.textContent = msg; e.hidden = false; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => { e.classList.remove('on'); e.hidden = true; }, 2400); }
  let pendingConfirm = null;
  /* Confirmación dentro de la página (el visor de artefactos no admite confirm()). */
  function ask(msg, yes) {
    pendingConfirm = yes;
    const m = $('modal'); $('mbox').innerHTML = `<div class="mb"><p>${esc(msg)}</p><div class="row end"><button class="btn" data-a="mclose">${t('Cancelar')}</button><button class="btn danger" data-a="myes">${t('Confirmar')}</button></div></div>`;
    m.hidden = false; m.classList.add('on'); const b = m.querySelector('[data-a="myes"]'); if (b) b.focus();
  }
  function closeModal() { const m = $('modal'); m.classList.remove('on'); m.hidden = true; pendingConfirm = null; }

  /* ------------------------------ helpers de vista ------------------------------ */
  function secH(title, sub, act) { return `<div class="sech"><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="act">${act || ''}</div></div>`; }
  function card(title, body, cls, right) { return `<section class="card ${cls || ''}"><header class="ch"><h3>${title}</h3>${right ? `<div class="r">${right}</div>` : ''}</header><div class="cb">${body}</div></section>`; }
  function pills(items, cur, act, key) { return `<div class="pills" role="tablist">${items.map(x => `<button class="pill ${cur === x[0] ? 'on' : ''}" role="tab" aria-selected="${cur === x[0]}" data-a="${act}" data-k="${key || ''}" data-t="${esc(x[0])}">${x[1]}${x[2] != null ? `<span class="n">${x[2]}</span>` : ''}</button>`).join('')}</div>`; }
  function statusColor(s) { const b = cfg().statusBands; return s * 100 >= b.green ? 'var(--ok)' : s * 100 >= b.amber ? 'var(--warn)' : 'var(--bad)'; }

  /* ------------------------------ eventos ------------------------------ */
  function coerce(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.dataset.num) return el.value === '' ? '' : parseFloat(el.value);
    return el.value;
  }
  function bind(el, final) {
    const scope = el.dataset.s, v = coerce(el);
    if (scope === 'cfg' && el.dataset.num && v === '') return;
    setP(rootOf(scope), el.dataset.b, v);
    if (el.tagName === 'SELECT') el.className = 'sl ' + statusCls(v);
    if (el.dataset.b === 'meta.title' && !scope) { $('opTitle').textContent = el.value; }
    save();
    if (final && el.dataset.re) { if (el.dataset.re === 'self' || el.dataset.re === '1') U.render(); else if (el.dataset.re === 'nav') U.renderNav(); }
  }
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset && el.dataset.b && el.tagName !== 'SELECT' && el.type !== 'checkbox') bind(el, false);
    if (el.dataset && el.dataset.live && U.live[el.dataset.live]) U.live[el.dataset.live](el);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'opSel') { store.cur = el.value; save(); U.render(); return; }
    if (el.dataset && el.dataset.ch && U.A[el.dataset.ch]) { U.A[el.dataset.ch](el.dataset, el, e); return; }
    if (el.dataset && el.dataset.b) bind(el, true);
  });
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    if (el.tagName === 'A') e.preventDefault();
    const f = U.A[el.dataset.a]; if (f) f(el.dataset, el, e);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  U.live = {};

  /* ------------------------------ acciones comunes ------------------------------ */
  Object.assign(U.A, {
    go: d => U.go(d.t),
    lang: d => { store.lang = d.lang; save(true); U.render(); },
    assist: () => { store.assist = !store.assist; save(); U.render(); },
    mclose: () => closeModal(),
    myes: () => { const f = pendingConfirm; closeModal(); if (f) f(); },
    uitab: d => { op().ui[d.k] = d.t; save(); U.render(); },
    print: () => window.print(),
    exportOp: () => { const o = op(); dl(fileName(o.meta.title) + '.json', JSON.stringify(o, null, 1), 'application/json'); toast(t('Operación exportada')); },
    exportAll: () => { dl('wargaming_backup_' + stamp() + '.json', JSON.stringify(store, null, 1), 'application/json'); toast(t('Copia completa exportada')); },
    importOpen: () => $('imp').click()
  });
  function fileName(s) { return String(s || 'operacion').replace(/[^\w\-]+/g, '_').slice(0, 60); }
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
  function dl(name, data, type) {
    try { const b = new Blob([data], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 300); }
    catch (e) { toast(t('La descarga no está disponible en este visor.')); }
  }
  function importText(txt) {
    let o;
    try { o = JSON.parse(txt); } catch (e) { toast(t('El archivo no es un JSON válido.')); return; }
    const list = [];
    if (o && o.v === 3 && Array.isArray(o.ops)) o.ops.forEach(x => list.push(x));
    else if (W.isV2(o)) { const V = global.WG_TRYZUB_V2; list.push(W.migrateV2(o, { STEPS: V.STEPS, CM: V.CM, tag: 'OP TRYZUB (v2)' })); }
    else if (o && o.orbat && o.turns) list.push(o);
    if (!list.length) { toast(t('No se reconoce el formato. Use un JSON exportado por esta herramienta o por wargaming_nato v2.')); return; }
    list.forEach(x => { W.ensure(x); if (store.ops.find(y => y.id === x.id)) x.id = x.id + '-' + Math.random().toString(36).slice(2, 6); store.ops.push(x); store.cur = x.id; });
    save(true); U.render(); toast(list.length === 1 ? t('Operación importada') : t('{n} operaciones importadas', { n: list.length }));
  }
  document.addEventListener('change', e => {
    if (e.target.id !== 'imp') return;
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { importText(r.result); e.target.value = ''; }; r.readAsText(f);
  });

  /* ------------------------------ arranque ------------------------------ */
  Object.assign(U, { $, esc, short, pct, t, resL, resCls, resTag, getP, setP, rootOf, fIn, fNum, fTa, fSel, fChk, statusCls, O, METHODS, NAV,
    secH, card, pills, statusColor, toast, ask, closeModal, save, op, cfg, game, coa, ecoa, pathFor, analysis, dl, stamp, fileName, importText, depth, uname,
    freshStore, mergeCfg, storageOK: () => storageOK });
  Object.defineProperty(U, 'store', { get: () => store, set: v => { store = v; } });
  U.boot = function () {
    store = load();
    if (window.innerWidth < 980) store.assist = false;
    if (U.applyDmg) U.applyDmg();
    U.render();
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); setSS('✓ ' + t('Autoguardado activo')); } catch (e) { setSS('⚠ ' + t('Almacenamiento bloqueado — use Exportar'), true); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
