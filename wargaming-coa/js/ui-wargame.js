/* ==========================================================================
   Vistas de EJECUCIÓN
   Confrontación (turno a turno · tarjetas · hoja) · Correlación de fuerzas ·
   Adjudicación · Registros
   ========================================================================== */
(function (global) {
  'use strict';
  const U = global.WGUI, C = global.WGCat, E = global.WGEngine, W = global.WGModel;
  const { esc, short, t, fIn, fNum, fTa, fSel, O, secH, card, pills, pct } = U;

  function gturn(g, id) { g.turns[id] = g.turns[id] || { cr: '', assets: [], dp: '', ccir: '', rem: '', branch: '', res: '', bcp: '', rcp: '', fr: '', ovr: {}, mods: {} }; return g.turns[id]; }
  function steps(o) {
    return o.prep.initiative === 'red'
      ? [['pre', t('Pre-acción roja')], ['act', t('Acción azul')], ['rea', t('Reacción roja')], ['cnt', t('Contrarreacción azul')], ['arb', t('Árbitro')]]
      : [['act', t('Acción azul')], ['rea', t('Reacción roja')], ['cnt', t('Contrarreacción azul')], ['arb', t('Árbitro')]];
  }
  function pairBar(o) {
    return `<div class="g2 tight"><div><label class="fl">BLUE COA</label>${fSel('prep.coa', O.coa(), 'self')}</div><div><label class="fl">RED COA</label>${fSel('prep.acoa', O.ecoa(), 'self')}</div></div>`;
  }
  U.pairBar = pairBar;

  /* =============================== CONFRONTACIÓN =============================== */
  U.R.wargame = function () {
    const o = U.op(), view = o.ui.wgView || 'turn', mf = o.ui.wgM || 'all';
    const on = C.MKEYS.filter(k => o.prep.methods[k]);
    const c = U.coa(), e = U.ecoa();
    let h = secH(t('Confrontación — Acción · Reacción · Contrarreacción'), c && e ? `<b>${esc(c.name)}</b> ${t('frente a')} <b class="red-t">${esc(e.name)}</b>` : '',
      `${pills([['turn', '▶ ' + t('Turno a turno')], ['cards', '▦ ' + t('Tarjetas')], ['sheet', '☰ ' + t('Hoja')]], view, 'uitab', 'wgView')}
       <button class="btn sm" data-a="csv">⬇ CSV</button><button class="btn pri sm" data-a="addturn">＋ ${t('Añadir turno')}</button>`);
    h += `<div class="card"><div class="cb">${pairBar(o)}</div></div>`;
    if (!c || !e) return h + `<p class="warnbox">${t('Defina al menos una COA propia y una COA enemiga en «Datos de planeamiento».')}</p>`;
    h += pills([['all', t('Todos los métodos'), E.activeTurns(o).length]].concat(on.map(k => [k, t(U.METHODS[k].l), o.turns.filter(x => x.m === k).length])), mf, 'uitab', 'wgM');
    if (on.length < 4) h += `<p class="muted small">${t('Active más métodos en Preparación ②.')}</p>`;
    if (mf !== 'all') h += `<p class="hint"><b>${t(U.METHODS[mf].l)}.</b> ${t(U.METHODS[mf].d)}</p>`;
    const g = U.game(true), path = U.pathFor(c, e, g);
    const list = path.turns.filter(T => mf === 'all' || T.t.m === mf);
    if (!list.length) return h + card(t('Sin turnos'), `<p class="muted">${t('No hay turnos para este método. Pulse «Añadir turno».')}</p>`);
    if (view === 'sheet') return h + sheetView(o, c, e, g, list);
    if (view === 'cards') return h + list.map(T => cardView(o, c, e, g, T)).join('');
    return h + turnView(o, c, e, g, path, list);
  };

  /* ---------- turno a turno: tres células ---------- */
  function turnView(o, c, e, g, path, list) {
    let idx = Math.min(o.ui.wgTurn || 0, list.length - 1); if (idx < 0) idx = 0;
    const T = list[idx], tt = T.t, gt = gturn(g, tt.id), st = steps(o);
    let si = Math.min(o.ui.wgStep || 0, st.length - 1); const stepId = st[si][0];
    const ci = o.coas.indexOf(c), ei = o.ecoas.indexOf(e), oi = o.turns.indexOf(tt);
    c.plan[tt.id] = c.plan[tt.id] || { a: '', eng: [] }; e.plan[tt.id] = e.plan[tt.id] || { pre: '', r: '', place: [] };
    const bp = 'coas.' + ci + '.plan.' + tt.id, rp = 'ecoas.' + ei + '.plan.' + tt.id, gp = 'turns.' + tt.id;
    const ce = o.ces.find(x => x.id === tt.ce), cell = o.ui.cell || 'white';
    const mc = E.monteCarlo(o, c, e, U.cfg(), { onlyTurn: tt.id, startStr: T.startStr, game: g, n: Math.min(1000, U.cfg().sim.n), tag: 'turn' });
    const cls = id => (stepId === id ? ' active-step' : '');
    const nav = `<div class="turns">${list.map((x, i) => `<button class="turn-btn" data-a="wgTurn" data-i="${i}" aria-current="${i === idx}"><b>${esc(x.t.label)}</b><span>${esc(x.t.time)}</span>${U.resTag((g.turns[x.t.id] || {}).res || x.suggested || '')}</button>`).join('')}</div>`;
    const bar = `<div class="arcr" role="group" aria-label="${t('Secuencia del turno')}">${st.map((s, i) => `<button data-a="wgStep" data-i="${i}" aria-pressed="${i === si}" class="${i < si ? 'done' : ''}">${i < si ? '✓ ' : ''}${s[1]}</button>`).join('')}</div>`;
    const engCards = T.results.map((r, k) => engCard(o, g, tt, r, mc.engs[0] ? mc.engs[0][k] : null, path.umap)).join('') || `<p class="muted small">${t('La COA no define enfrentamientos en este turno (pestaña «Planes COA / ECOA»).')}</p>`;
    const warns = T.warnings.map(w => `<p class="warnbox">${t('Fuerzas rojas sin oposición en {s}', { s: '<b>' + esc((o.sectors.find(s => s.id === w.sector) || {}).name || w.sector) + '</b>' })}: ${w.units.map(u => esc(U.uname(path.umap[u]) || u)).join(', ')}. ${t('Revise la COA (posible hueco o rama).')}</p>`).join('');
    const strip = side => { const ids = new Set(); T.results.forEach(r => (side === 'B' ? r.x.blue : r.x.red).forEach(b => ids.add(b.u)));
      return [...ids].map(id => { const u = path.umap[id]; if (!u) return ''; const s0 = T.startStr[id], s1 = T.endStr[id];
        return `<div class="ustat">${C.sym(u, 22)}<span class="nm" title="${esc(U.uname(u))}">${esc(U.uname(u))}</span><span class="num">${Math.round(s1 * 100)}%${s1 < s0 - 0.005 ? ` <span class="muted small">(${Math.round(s0 * 100)})</span>` : ''}</span><span class="bar"><i style="width:${Math.max(0, s1 * 100)}%;background:${U.statusColor(s1)}"></i>${side === 'B' ? `<b style="left:${o.ffir}%"></b>` : ''}</span></div>`; }).join('') || `<p class="muted small">${t('Sin unidades en contacto.')}</p>`; };
    const sug = T.suggested;
    return `<div class="card"><div class="cb">${nav}
      <div class="row between"><div><h3>${esc(tt.label)} — ${esc(tt.title)}</h3><p class="muted small">${esc(tt.time)} · ${t(U.METHODS[tt.m].l)}${ce ? ` · <b>${esc(ce.id)}</b> ${esc(ce.title)} <span class="tag info">${esc(ce.dc)}</span>` : ''}${T.counts ? '' : ' · <b>' + t('no encadena bajas') + '</b>'}</p></div>
      <div class="row"><span class="fl nm">${t('Vista')}</span><div class="seg" role="group">${[['white', t('Célula blanca')], ['blue', t('Célula azul')], ['red', t('Célula roja')]].map(v => `<button data-a="uitab" data-k="cell" data-t="${v[0]}" aria-pressed="${cell === v[0]}">${v[1]}</button>`).join('')}</div></div></div>
      ${bar}
      <div class="row between"><span class="muted small">${t('Paso activo')}: <b>${st[si][1]}</b></span><div class="row"><button class="btn sm" data-a="prevStep">${t('Anterior')}</button><button class="btn pri sm" data-a="nextStep" data-n="${list.length}">${si === st.length - 1 ? (idx < list.length - 1 ? t('Cerrar turno y pasar al siguiente') : t('Cerrar turno')) : t('Siguiente paso')}</button></div></div>
      </div></div>${warns}
      <div class="cells">
        <section class="cell blue${cell === 'red' ? ' hidden-cell' : ''}" aria-hidden="${cell === 'red'}">
          <h3>${t('Célula azul')}</h3>
          <div class="${cls('act')}"><label class="fl">${t('Acción')}</label>${fTa(bp + '.a', 6)}</div>
          <div class="${cls('cnt')}"><label class="fl row between"><span>${t('Contrarreacción (HPT, ramas, ajustes)')}</span>${ce && ce.cr ? `<button class="sg" data-a="sug" data-f="cr" data-id="${esc(tt.id)}">✦ ${t('Sugerir')}</button>` : ''}</label>${fTa(gp + '.cr', 6, '', '', 'g')}</div>
          <label class="fl">${t('Medios empleados')}</label><div class="chips">${(gt.assets || []).map((a, k) => { const u = path.umap[a]; return u ? `<span class="chip ${u.side === 'R' ? 'r' : ''}">${esc(short(u.name, 30))}<b data-a="rmasset" data-id="${esc(tt.id)}" data-k="${k}" aria-label="${t('Quitar')}">×</b></span>` : ''; }).join('')}</div>
          <select class="sl" data-ch="addasset" data-id="${esc(tt.id)}" aria-label="${t('Añadir medio')}">${O.units('B').map(x => `<option value="${esc(x[0])}">${x[0] ? esc(x[1]) : '＋ ' + t('añadir medio…')}</option>`).join('')}</select>
        </section>
        <section class="cell white">
          <h3>${t('Célula blanca · Árbitro')}</h3>
          <div class="stack${cls('arb')}">${engCards}</div>
          <p class="small muted">${t('Probabilidades: {n} simulaciones Monte Carlo desde el estado adjudicado al inicio del turno (σ = {s}).', { n: mc.n, s: U.cfg().sim.sigma })}</p>
          <div class="resbox"><div class="row between"><span class="fl nm">${t('Resultado del turno')}</span>${sug ? `<span class="small">${t('Sugerido por el motor')}: ${U.resTag(sug)} ${gt.res !== sug ? `<button class="btn sm" data-a="applySug" data-id="${esc(tt.id)}" data-v="${esc(sug)}">${t('Aplicar')}</button>` : ''}</span>` : ''}</div>
            ${fSel('turns.' + tt.id + '.res', [['', '—']].concat(C.RESULTS.map(x => [x, U.resL(x)])), 'self', '', 'g')}</div>
          <div class="g2 tight"><div><label class="fl">${t('Punto de decisión')}</label>${fSel(gp + '.dp', O.dp(), '', '', 'g')}</div><div><label class="fl">CCIR</label>${fSel(gp + '.ccir', O.ccir(), '', '', 'g')}</div></div>
          <label class="fl">${t('Observaciones / hechos confirmados')}</label>${fTa(gp + '.rem', 3, '', '', 'g')}
          <label class="fl">${t('Ramas y secuelas')}</label>${fTa(gp + '.branch', 2, '', '', 'g')}
          <div class="g2 tight"><div><label class="fl">${t('CP azul ME % (vacío = motor)')}</label>${fNum(gp + '.bcp', 'min="0" max="100" placeholder="' + (T.bcpCalc == null ? '' : Math.round(T.bcpCalc * 100)) + '"', 'g')}</div><div><label class="fl">${t('CP rojo % (vacío = motor)')}</label>${fNum(gp + '.rcp', 'min="0" max="100" placeholder="' + (T.rcpCalc == null ? '' : Math.round(T.rcpCalc * 100)) + '"', 'g')}</div></div>
        </section>
        <section class="cell red${cell === 'blue' ? ' hidden-cell' : ''}" aria-hidden="${cell === 'blue'}">
          <h3>${t('Célula roja')}</h3>
          ${o.prep.initiative === 'red' ? `<div class="${cls('pre')}"><label class="fl">${t('Pre-acción')}</label>${fTa(rp + '.pre', 5)}</div>` : ''}
          <div class="${cls('rea')}"><label class="fl row between"><span>${t('Reacción (contramaniobras, HVT, sorpresa)')}</span>${ce && ce.r && ce.r[e.id] ? `<button class="sg" data-a="sug" data-f="r" data-id="${esc(tt.id)}">✦ ${t('Sugerir')}</button>` : ''}</label>${fTa(rp + '.r', 6)}</div>
          <p class="muted small">${t('Pre-acción y reacción se guardan en la COA enemiga; contrarreacción y decisiones, en esta confrontación.')}</p>
        </section>
      </div>
      <div class="g2"><div>${card(t('Fuerzas propias en contacto tras el turno'), `<div class="strip">${strip('B')}</div>`, 'blue', `<span class="muted small">${t('Línea: FFIR-1 ({n} %)', { n: o.ffir })}</span>`)}</div><div>${card(t('Fuerzas adversarias en contacto tras el turno'), `<div class="strip">${strip('R')}</div>`, 'red')}</div></div>`;
  }

  function engCard(o, g, tt, r, m, umap) {
    const c = r.calc, x = r.x, en = x.eng, gt = gturn(g, tt.id), ov = (gt.ovr && gt.ovr[en.id]) || {};
    const sec = (o.sectors.find(s => s.id === en.sector) || {}).name || en.sector;
    const meets = c.contact && c.rEff >= c.req;
    const mods = Object.assign({}, en.mods || {}, (gt.mods && gt.mods[en.id]) || {});
    const pfx = 'turns.' + tt.id;
    const bar = m && c.contact ? `<div class="pbar" role="img" aria-label="${t('Distribución de resultados')}">${C.RESULTS.filter(z => m.p[z] > 0).map(z => `<span class="res-${U.resCls(z)}" style="flex:${m.p[z]}" title="${esc(U.resL(z))} ${pct(m.p[z])}"></span>`).join('')}</div>
      <div class="legend">${C.RESULTS.filter(z => m.p[z] > 0.005).map(z => `<span><i class="res-${U.resCls(z)}"></i>${esc(U.resL(z))} <b class="num">${pct(m.p[z])}</b></span>`).join('')}</div>` : '';
    return `<div class="adj ${en.me ? 'me' : ''}">
      <div class="row between"><div class="row"><b>${esc(en.label || t('Enfrentamiento'))}</b><span class="tag">${esc(sec)}</span>${en.me ? '<span class="tag info">ME</span>' : ''}</div>${U.resTag(r.adj.outcome, r.adj.manual ? t('árbitro') : '')}</div>
      <div class="small muted">${x.blue.map(b => esc(U.uname(umap[b.u])) + (+b.pct !== 100 && b.pct !== '' && b.pct != null ? ' (' + b.pct + ' %)' : '')).join(', ') || '—'} <b>vs</b> ${x.red.map(b => esc(U.uname(umap[b.u])) + (+b.pct !== 100 && b.pct != null ? ' (' + b.pct + ' %)' : '')).join(', ') || t('sin fuerzas rojas en contacto')}</div>
      ${c.contact ? `<div class="kvs">
        <div class="kv"><span class="k">FE ${t('azul')}</span><span class="v">${c.feB.toFixed(2)}</span></div><div class="kv"><span class="k">FE ${t('rojo')}</span><span class="v">${c.feR.toFixed(2)}</span></div>
        <div class="kv"><span class="k">${t('Modif.')}</span><span class="v">×${c.mod.toFixed(2)}</span></div><div class="kv"><span class="k">${t('Ratio A:R')}</span><span class="v">${E.fmtR(c.rEff)}</span></div>
        <div class="kv"><span class="k">${t('Mínimo')}</span><span class="v">${E.fmtR(c.req)}</span></div><div class="kv"><span class="k">${t('Bajas A / R')}</span><span class="v">${r.adj.lb.toFixed(0)} / ${r.adj.lr.toFixed(0)} %</span></div></div>
        <p class="small">${esc(t(c.taskLabel))}: ${meets ? `<b class="ok-t">✓ ${t('cumple el ratio mínimo de planeamiento')}</b>` : `<b class="bad-t">✗ ${t('no alcanza el ratio mínimo de planeamiento')}</b>`} (${t('margen')} ${c.margin.toFixed(2)}). ${c.brk ? t('Rompe el contacto: bajas propias ×{f}.', { f: U.cfg().brkFactor }) : ''} <span class="muted">BCTP: ${esc(c.pair)}</span></p>${bar}`
        : `<p class="small muted">${t('Sin contacto: no hay fuerzas rojas en el sector o están asignadas a otro enfrentamiento.')}</p>`}
      <details${(ov.bl !== '' && ov.bl != null) || (ov.rl !== '' && ov.rl != null) ? ' open' : ''}><summary class="small">${t('Decisión del árbitro y modificadores')}</summary>
        <div class="g3 tight">${'<div><label class="fl">' + t('Resultado') + '</label>' + fSel(pfx + '.ovr.' + en.id + '.res', [['', t('Calculado') + ' (' + U.resL(c.outcome) + ')']].concat(C.RESULTS.map(z => [z, U.resL(z)])), 'self', '', 'g') + '</div>'}
          <div><label class="fl">${t('Bajas azules %')}</label>${fNum(pfx + '.ovr.' + en.id + '.bl', 'min="0" max="100" placeholder="' + c.lb.toFixed(0) + '"', 'g')}</div>
          <div><label class="fl">${t('Bajas rojas %')}</label>${fNum(pfx + '.ovr.' + en.id + '.rl', 'min="0" max="100" placeholder="' + c.lr.toFixed(0) + '"', 'g')}</div></div>
        <div class="g3 tight">${Object.keys(U.cfg().mods).map(k => { const md = U.cfg().mods[k]; return `<div><label class="fl">${t(md.label)}</label>${fSel(pfx + '.mods.' + en.id + '.' + k, md.opts.map((op_, i) => [i, t(op_[0]) + ' ×' + op_[1]]), 'self', '', 'g')}</div>`; }).join('')}</div>
        <div class="row"><button class="btn sm ghost" data-a="clearOvr" data-id="${esc(tt.id)}" data-e="${esc(en.id)}">${t('Volver al cálculo')}</button><button class="btn sm" data-a="engFR" data-id="${esc(tt.id)}" data-e="${esc(en.id)}">⚖ ${t('Abrir en la calculadora')}</button><button class="btn sm" data-a="engRoll" data-id="${esc(tt.id)}" data-e="${esc(en.id)}">🎲 ${t('Tirada del motor')}</button></div>
      </details></div>`;
  }

  /* ---------- tarjetas (formato wargaming_nato v2) ---------- */
  function cardView(o, c, e, g, T) {
    const tt = T.t, i = o.turns.indexOf(tt), gt = gturn(g, tt.id), ce = o.ces.find(x => x.id === tt.ce);
    const ci = o.coas.indexOf(c), ei = o.ecoas.indexOf(e); c.plan[tt.id] = c.plan[tt.id] || { a: '', eng: [] }; e.plan[tt.id] = e.plan[tt.id] || { pre: '', r: '', place: [] };
    const m = E.unitMap(o), dp = o.reg.dp.find(d => d.id === gt.dp), cc = o.reg.ccir.find(x => x.id === gt.ccir), gp = 'turns.' + tt.id;
    return `<article class="turn" id="turn-${esc(tt.id)}">
      <div class="th"><input class="lb" data-b="turns.${i}.label" value="${esc(tt.label)}" aria-label="${t('Etiqueta')}"><input class="tt" data-b="turns.${i}.title" value="${esc(tt.title)}" aria-label="${t('Título')}"><input class="tm" data-b="turns.${i}.time" value="${esc(tt.time)}" aria-label="${t('Tiempo')}">
        ${fSel('turns.' + i + '.ce', O.ce(), 'self', 'aria-label="' + t('Evento crítico') + '"')}${fSel('turns.' + i + '.m', C.MKEYS.map(k => [k, t(U.METHODS[k].l)]), 'self')}
        <label class="chk inv"><input type="checkbox" data-b="turns.${i}.sim" data-re="self"${tt.sim !== false ? ' checked' : ''}><span>${t('Encadena')}</span></label>
        <button class="tbtn" data-a="mvturn" data-i="${i}" data-d="-1" aria-label="${t('Subir')}">↑</button><button class="tbtn" data-a="mvturn" data-i="${i}" data-d="1" aria-label="${t('Bajar')}">↓</button><button class="tbtn" data-a="delturn" data-i="${i}" aria-label="${t('Eliminar turno')}">✕</button></div>
      ${ce ? `<div class="ceband"><b>${esc(ce.id)}</b> ${esc(ce.title)} · <span class="tag info">${esc(ce.dc)}</span></div>` : ''}
      <div class="arc">
        <div><div class="al A">▲ ${t('Acción — azul')}</div>${fTa('coas.' + ci + '.plan.' + tt.id + '.a', 6)}</div>
        <div><div class="al R">◆ ${t('Reacción — rojo')}${ce && ce.r && ce.r[e.id] ? `<button class="sg" data-a="sug" data-f="r" data-id="${esc(tt.id)}">✦ ${t('Sugerir')}</button>` : ''}</div>${fTa('ecoas.' + ei + '.plan.' + tt.id + '.r', 6)}</div>
        <div><div class="al C">● ${t('Contrarreacción — azul')}${ce && ce.cr ? `<button class="sg" data-a="sug" data-f="cr" data-id="${esc(tt.id)}">✦ ${t('Sugerir')}</button>` : ''}</div>${fTa(gp + '.cr', 6, '', '', 'g')}</div>
      </div>
      <div class="wf">
        <div><span class="fl">${t('Medios empleados')}</span><div class="chips">${(gt.assets || []).map((a, k) => m[a] ? `<span class="chip ${m[a].side === 'R' ? 'r' : ''}">${esc(short(m[a].name, 30))}<b data-a="rmasset" data-id="${esc(tt.id)}" data-k="${k}">×</b></span>` : '').join('')}</div>
          <select class="sl" data-ch="addasset" data-id="${esc(tt.id)}" aria-label="${t('Añadir medio')}">${O.units('B').map(x => `<option value="${esc(x[0])}">${x[0] ? esc(x[1]) : '＋ ' + t('añadir medio…')}</option>`).join('')}</select></div>
        <div><label class="fl">${t('Punto de decisión')}</label>${fSel(gp + '.dp', O.dp(), 'self', '', 'g')}${dp ? `<div class="small muted">${esc(short(dp.trg, 110))}</div>` : ''}</div>
        <div><label class="fl">CCIR</label>${fSel(gp + '.ccir', O.ccir(), 'self', '', 'g')}${cc ? `<div class="small muted">${esc(short(cc.q, 110))}</div>` : ''}</div>
        <div><label class="fl">${t('Observaciones')}</label>${fTa(gp + '.rem', 2, '', '', 'g')}<label class="fl">${t('Rama / secuela')}</label>${fTa(gp + '.branch', 2, '', '', 'g')}</div>
      </div>
      <div class="wr"><span class="fl nm">${t('Resultado')}</span>${fSel(gp + '.res', [['', '—']].concat(C.RESULTS.map(x => [x, U.resL(x)])), 'nav', 'style="width:180px"', 'g')}
        ${T.suggested ? `<span class="small">${t('Motor')}: ${U.resTag(T.suggested)}</span>` : ''}
        <span class="cp b">${t('CP azul ME')} ${fNum(gp + '.bcp', 'min="0" max="100" placeholder="' + (T.bcpCalc == null ? '' : Math.round(T.bcpCalc * 100)) + '"', 'g')}%</span>
        <span class="cp r">${t('CP rojo')} ${fNum(gp + '.rcp', 'min="0" max="100" placeholder="' + (T.rcpCalc == null ? '' : Math.round(T.rcpCalc * 100)) + '"', 'g')}%</span>
        ${gt.fr ? `<span class="frtag">⚖ ${esc(gt.fr)}</span>` : ''}
        <span class="push row"><button class="btn sm" data-a="toTurn" data-id="${esc(tt.id)}">▶ ${t('Abrir turno')}</button><button class="btn sm" data-a="frt" data-id="${esc(tt.id)}">⚖ ${t('Correlación')}</button><button class="btn gold sm" data-a="adjt" data-id="${esc(tt.id)}">🎲 ${t('Adjudicar')}</button></span></div>
    </article>`;
  }

  /* ---------- hoja (APP-28 Anexo D) ---------- */
  function sheetView(o, c, e, g, list) {
    const m = E.unitMap(o);
    return `<section class="card"><div class="tw"><table class="t"><thead><tr><th style="width:90px">${t('Turno')}</th><th>${t('Acción')}</th><th>${t('Reacción')}</th><th>${t('Contrarreacción')}</th><th style="width:140px">${t('Medios')}</th><th style="width:100px">${t('Tiempo')}</th><th style="width:120px">DP</th><th style="width:120px">CCIR</th><th>${t('Observaciones')}</th><th style="width:150px">${t('Resultado')}</th></tr></thead><tbody>` +
      list.map(T => { const tt = T.t, gt = gturn(g, tt.id), ci = o.coas.indexOf(c), ei = o.ecoas.indexOf(e), gp = 'turns.' + tt.id;
        c.plan[tt.id] = c.plan[tt.id] || { a: '', eng: [] }; e.plan[tt.id] = e.plan[tt.id] || { pre: '', r: '', place: [] };
        return `<tr><td><b>${esc(tt.label)}</b><div class="muted small">${t(U.METHODS[tt.m].l)}</div></td><td>${fTa('coas.' + ci + '.plan.' + tt.id + '.a', 5)}</td><td>${fTa('ecoas.' + ei + '.plan.' + tt.id + '.r', 5)}</td><td>${fTa(gp + '.cr', 5, '', '', 'g')}</td>
          <td class="small">${(gt.assets || []).map(a => m[a] ? esc(m[a].name) : '').join('<br>')}</td><td class="small">${esc(tt.time)}</td><td>${fSel(gp + '.dp', O.dp(), '', '', 'g')}</td><td>${fSel(gp + '.ccir', O.ccir(), '', '', 'g')}</td><td>${fTa(gp + '.rem', 5, '', '', 'g')}</td>
          <td>${fSel(gp + '.res', [['', '—']].concat(C.RESULTS.map(x => [x, U.resL(x)])), 'nav', '', 'g')}${T.suggested ? `<div class="small">${t('Motor')}: ${U.resTag(T.suggested)}</div>` : ''}</td></tr>`; }).join('') + '</tbody></table></div></section>';
  }

  /* =============================== CORRELACIÓN DE FUERZAS =============================== */
  function feOf(r) { if (!r.t) return 0; if (r.t === 'Custom F.E.') return +r.fe || 0; return C.FRMAP[r.t] || 0; }
  function frTotals() {
    const fr = U.op().fr;
    const f = fr.f.reduce((a, r) => a + (+r.n || 0) * (+r.s || 0) * feOf(r), 0), e = fr.e.reduce((a, r) => a + (+r.n || 0) * (+r.s || 0) * feOf(r), 0);
    let fa = f, ea = e; const mult = (+fr.terr || 1) * (+fr.prep || 1);
    if (fr.defSide === 'F') fa = f * mult; else if (fr.defSide === 'E') ea = e * mult;
    return { f, e, fa, ea, r: e > 0 ? f / e : 0, ra: ea > 0 ? fa / ea : 0, mult };
  }
  U.frTotals = frTotals;
  function frRows(side) {
    const o = U.op(), arr = o.fr[side], m = E.unitMap(o), L = side === 'f' ? t('Propias') : t('Adversarias');
    const ul = o.orbat.filter(u => u.side === (side === 'f' ? 'B' : 'R') && u.frT);
    return `<div class="tw"><table class="t frt"><thead><tr><th>${t('Unidad / etiqueta')}</th><th style="width:72px">${t('Número')}</th><th style="width:76px">${t('Fuerza')}</th><th>${t('Tipo')}</th><th style="width:66px">F.E.</th><th style="width:66px">${t('Total')}</th><th></th></tr></thead><tbody>` +
      arr.map((r, i) => { const P = 'fr.' + side + '.' + i + '.', fe = feOf(r); return `<tr><td>${fIn(P + 'lbl', t('etiqueta'))}</td><td>${fNum(P + 'n', 'step="0.01"')}</td><td>${fNum(P + 's', 'step="0.05" min="0" max="1"')}</td><td>${U.frSel(P + 't')}</td><td class="num">${r.t === 'Custom F.E.' ? fNum(P + 'fe', 'step="0.01"') : fe}</td><td class="num">${((+r.n || 0) * (+r.s || 0) * fe).toFixed(2)}</td><td><button class="btn ghost sm" data-a="del" data-l="fr.${side}" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`; }).join('') +
      `<tr><td colspan="5" class="num strong">${L} — ${t('equivalente de fuerza')}</td><td class="num strong">${arr.reduce((a, r) => a + (+r.n || 0) * (+r.s || 0) * feOf(r), 0).toFixed(2)}</td><td></td></tr></tbody></table></div>
      <div class="row"><button class="btn pri sm" data-a="add" data-l="fr.${side}">＋ ${t('Fila')}</button><select class="sl" data-ch="frload" data-side="${side}" style="max-width:300px" aria-label="${t('Cargar unidad del ORBAT')}"><option value="">⤓ ${t('Cargar unidad del ORBAT…')}</option>${ul.map(u => `<option value="${esc(u.id)}">${' '.repeat(U.depth(u, m) * 2)}${esc(u.name)} (${u.cp}%)</option>`).join('')}</select></div>`;
  }
  U.R.fr = function () {
    const o = U.op(), fr = o.fr, P = 'fr.', T = frTotals();
    const pm = C.PLAN_M[fr.pm] || C.PLAN_M.Delay, ok = T.r >= pm.need;
    const pair = fr.fM + ' vs ' + fr.eM, has = !!C.DMG[pair], d = has && T.r ? E.dmgAt(pair, T.r) : null, tot = T.f + T.e || 1;
    const g = U.game(false);
    let h = secH(t('Calculadora de correlación de fuerzas'), t('Force Ratio Calculator Matrix v3.0 (CGSC ST 100-3): tipos y equivalentes de fuerza, tabla de daños BCTP y ratios mínimos históricos de planeamiento.'), `<button class="btn sm" data-a="frclear">${t('Vaciar filas')}</button>`);
    h += `<div class="card"><div class="cb g2 tight"><div><label class="fl">${t('Enfrentamiento')}</label>${fIn(P + 'name', t('p. ej. EA1 — BAIDA vs MR BDE 1'))}</div><div><label class="fl">${t('Turno vinculado')}</label>${fSel(P + 'turn', O.turns(), 'self')}</div></div></div>`;
    h += `<div class="g2"><div>` + card(t('Fuerzas propias'), frRows('f'), 'blue') + card(t('Fuerzas adversarias'), frRows('e'), 'red') +
      card(t('Cómo usarla'), `<p class="small">${t('1. Elija el tipo de unidad (OTAN, MARFOR, soviético/ruso o derivado TRYZUB). 2. Indique número y fuerza; menos de una unidad completa → fracciones (1 batería = 0,33 bón). 3. Compare con los ratios mínimos históricos. 4. Elija las misiones propia y enemiga para estimar bajas. Los ratios no indican por sí solos la probabilidad de éxito: compare en el punto de contacto.')}</p>`) +
      `</div><div>` +
      card(t('Resultado'), `<div class="frbig"><div class="n">${E.fmtR(T.r)}</div><div class="l">${t('Propias : adversarias (equivalentes de fuerza)')}</div>
        <div class="hb"><div style="width:${T.e / tot * 100}%" class="hb-r">${T.e.toFixed(1)}</div><div style="width:${T.f / tot * 100}%" class="hb-b">${T.f.toFixed(1)}</div></div></div>
        <div class="g2 tight"><div><label class="fl">${t('Misión propia')}</label>${fSel(P + 'fM', C.MISSIONS, 'self')}</div><div><label class="fl">${t('Misión enemiga')}</label>${fSel(P + 'eM', C.MISSIONS, 'self')}</div></div>
        ${d ? `<div class="g2 tight"><div class="kpi"><b class="blue-t">${Math.round(d.fl)}%</b><span>${t('Bajas propias estimadas')}</span></div><div class="kpi"><b class="red-t">${Math.round(d.el)}%</b><span>${t('Bajas enemigas estimadas')}</span></div></div><p class="small muted">${esc(pair)} · ${t('interpolación logarítmica en la tabla BCTP — orientación aproximada.')}</p>`
          : `<p class="hint">${t('Sin datos de daños para {p}. Elija una combinación ataque/defensa o combate de encuentro.', { p: '<b>' + esc(pair) + '</b>' })}</p>`}
        <label class="fl">${t('Misión propia para el ratio histórico')}</label>${fSel(P + 'pm', Object.keys(C.PLAN_M), 'self')}
        <div class="verd ${ok ? 'ok' : 'bad'}">${ok ? '✓ ' + t('Cumple') : '✗ ' + t('Por debajo de')} ${esc(fr.pm)} (${E.fmtR(pm.need)}) — ${t('actual')} ${E.fmtR(T.r)}</div>`, 'gold') +
      card(t('Multiplicadores de combate opcionales'), `<div class="g3 tight"><div><label class="fl">${t('Defensor')}</label>${fSel(P + 'defSide', [['', t('Ninguno')], ['F', t('Defienden las propias')], ['E', t('Defiende el enemigo')]], 'self')}</div>
        <div><label class="fl">${t('Terreno')}</label>${fSel(P + 'terr', [[1, 'Open ×1.0'], [1.3, 'Restricted ×1.3'], [1.6, 'Canal / obstacle ×1.6'], [1.8, 'Urban ×1.8'], [2.2, 'Urban + fortified ×2.2']], 'self', 'data-num="1"')}</div>
        <div><label class="fl">${t('Preparación')}</label>${fSel(P + 'prep', [[1, 'Hasty ×1.0'], [1.3, 'Occupied 2–6 h ×1.3'], [1.5, 'Prepared 12–24 h ×1.5'], [2, 'Fortified ×2.0']], 'self', 'data-num="1"')}</div></div>
        <p class="small muted">${t('Se aplican sólo al equivalente del defensor; los valores de la matriz siguen siendo la base doctrinal.')}</p>${fr.defSide ? `<p class="strong">${t('Con multiplicadores (×{m} al defensor)', { m: T.mult.toFixed(2) })}: ${E.fmtR(T.ra)}</p>` : ''}`) +
      card(t('Ratios mínimos históricos de planeamiento'), `<table class="t ro"><thead><tr><th>${t('Misión propia')}</th><th>${t('Propias : enemigo')}</th><th>${t('Posición')}</th></tr></thead><tbody>${C.HIST_RATIOS.map(r => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b></td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table>`) +
      card(t('Guardar el enfrentamiento'), `<p class="small muted">${t('Guarda el cálculo en la confrontación activa y anota el ratio y las bajas estimadas en el turno vinculado.')}</p><button class="btn pri" data-a="frsave">💾 ${t('Guardar enfrentamiento')}</button>
        ${g && g.frSaved.length ? `<div class="tw"><table class="t ro"><thead><tr><th>${t('Enfrentamiento')}</th><th>${t('Turno')}</th><th>F:E</th><th>${t('Bajas P / E')}</th><th></th></tr></thead><tbody>${g.frSaved.map((x, i) => `<tr><td class="small">${esc(x.name)}</td><td class="small">${esc(x.tl || '')}</td><td><b>${esc(x.ratio)}</b></td><td class="small">${x.fl != null ? Math.round(x.fl * 100) + '% / ' + Math.round(x.el * 100) + '%' : 'N/A'}</td><td><button class="btn ghost sm" data-a="delSaved" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`).join('')}</tbody></table></div>` : ''}`) +
      `</div></div>`;
    return h;
  };

  /* =============================== ADJUDICACIÓN =============================== */
  let lastRoll = null;
  U.R.adj = function () {
    const o = U.op(), A = o.adj, cst = C.CONTEST[A.contest] || C.CONTEST.equal, g = U.game(true);
    const tt = o.turns.find(x => x.id === A.target), gt = tt ? gturn(g, tt.id) : null;
    const c = U.coa(), e = U.ecoa(), path = c && e ? U.pathFor(c, e, g) : null, T = path && tt ? path.turns.find(x => x.t.id === tt.id) : null;
    let h = secH(t('Adjudicación'), t('Tirada del motor (según la distribución calculada), tirada enfrentada, tirada de probabilidad y dados. Los resultados se escriben en el turno que se adjudica.'));
    h += `<div class="target"><b>🎯 ${t('Adjudicando')}:</b><div style="min-width:260px">${fSel('adj.target', O.turns(), 'self')}</div>
      ${tt ? `<span class="small">${esc(tt.title)}</span>${U.resTag(gt.res || '')}<button class="btn sm" data-a="toTurn" data-id="${esc(tt.id)}">▶ ${t('Ir al turno')}</button>` : `<span class="muted small">${t('Seleccione el turno en el que registrar los resultados.')}</span>`}
      <span class="muted small push">${t('Método')}: ${esc(o.prep.adjMethod)}</span></div>`;
    const engOpts = T ? T.results.filter(r => r.calc.contact).map(r => [r.x.eng.id, r.x.eng.label]) : [];
    const lr = lastRoll && tt && lastRoll.turn === tt.id ? lastRoll : null;
    h += `<div class="g2"><div>` +
      card('🎯 ' + t('Tirada del motor'), T ? (engOpts.length ? `<p class="small muted">${t('Extrae un resultado aleatorio de la misma distribución que usa la simulación (ratio, modificadores e incertidumbre). Útil para un arbitraje analítico y reproducible por el método.')}</p>
        <label class="fl">${t('Enfrentamiento')}</label><select class="sl" id="rollEng">${engOpts.map(x => `<option value="${esc(x[0])}"${(lr ? lr.eng === x[0] : U.pendingRollEng === x[0]) ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>
        <button class="btn pri wide" data-a="roll">🎯 ${t('TIRAR')}</button>
        ${lr ? `<div class="res ${U.resCls(lr.r.outcome)}">${U.resTag(lr.r.outcome)} · ${t('ratio')} ${E.fmtR(lr.r.rEff)} · ${t('bajas A / R')} ${lr.r.lb.toFixed(0)} / ${lr.r.lr.toFixed(0)} %</div><button class="btn gold wide" data-a="applyRoll">✔ ${t('Aplicar al enfrentamiento y al turno')}</button>` : ''}`
        : `<p class="muted small">${t('Este turno no tiene enfrentamientos con contacto.')}</p>`) : `<p class="muted small">${t('Seleccione un turno.')}</p>`, 'gold') +
      card('⚔ ' + t('Tirada enfrentada'), `<label class="fl">${t('Tipo de enfrentamiento')}</label>${fSel('adj.contest', Object.entries(C.CONTEST).map(([k, v]) => [k, v[0] + ` (Blue d${v[1]} vs Red d${v[2]})`]), 'self')}
        <div class="g2 tight"><div><label class="fl">${t('Modificador azul')}</label>${fNum('adj.bmod', 'min="-5" max="5"')}</div><div><label class="fl">${t('Modificador rojo')}</label>${fNum('adj.rmod', 'min="-5" max="5"')}</div></div>
        <button class="btn sm" data-a="frcontest">✦ ${t('Sugerir el tipo a partir de la correlación de fuerzas')}</button>
        <div class="vs"><div><div class="fl blue-t">BLUE d${cst[1]}</div><div class="cd b" id="cdb">—</div></div><div class="strong muted">VS</div><div><div class="fl red-t">RED d${cst[2]}</div><div class="cd r" id="cdr">—</div></div></div>
        <button class="btn pri wide" data-a="contest">⚔ ${t('TIRAR ACCIÓN ENFRENTADA')}</button><div id="cres"></div>`, 'blue') +
      `</div><div>` +
      card('📊 ' + t('Tirada de probabilidad (d10)'), `${pills([['equal', t('Distribución uniforme')], ['weighted', t('Distribución ponderada')]], A.dist || 'equal', 'adjDist')}
        <table class="t ro"><thead><tr><th>DR</th><th>${t('Resultado')}</th><th>${t('Efectos (ejemplo)')}</th></tr></thead><tbody>${C.ADJ[A.dist || 'equal'].map(r => `<tr><td><b>${r[0]}</b></td><td>${U.resTag(r[1])}</td><td class="small">${esc(r[2])}</td></tr>`).join('')}</tbody></table>
        <button class="btn pri wide" data-a="prob">🎲 ${t('TIRAR d10 — PROBABILIDAD')}</button><div id="pres"></div>`, 'gold') +
      card('🎲 ' + t('Dados'), `<div class="dice">${[4, 6, 8, 10, 12, 20, 100].map(n => `<button class="die" data-a="die" data-n="${n}">d${n}</button>`).join('')}</div><div class="dres" id="dres">—</div><div class="small muted" id="dlab">${t('Pulse un dado')}</div>`) +
      card(t('Registro de adjudicación'), g.adjLog.length ? `<div class="tw scroll"><table class="t ro"><thead><tr><th>${t('Hora')}</th><th>${t('Turno')}</th><th>${t('Tirada')}</th><th>${t('Resultado')}</th></tr></thead><tbody>${g.adjLog.slice().reverse().map(l => `<tr><td class="small">${esc(l.at)}</td><td class="small">${esc(l.tl || '—')}</td><td class="small">${esc(l.d)}</td><td>${U.resTag(l.o)}</td></tr>`).join('')}</tbody></table></div><button class="btn ghost sm" data-a="clearlog">${t('Vaciar registro')}</button>` : `<p class="muted small">${t('Sin tiradas registradas.')}</p>`) +
      card(t('Métodos de adjudicación (Wargaming Handbook)'), `<p class="small">${t('Experto: los expertos deciden las consecuencias. Consensuado: los participantes acuerdan las consecuencias. Analítico: tablas, algoritmos y dados (esta herramienta). Se recomienda una mezcla. Las decisiones deben ser rápidas, coherentes y transparentes. Cuidado con las personalidades dominantes; la eficacia de los fuegos indirectos y de las armas propias suele sobrestimarse; no olvide el miedo y la fatiga.')}</p>`) +
      `</div></div>`;
    return h;
  };
  function logAdj(outcome, detail) { const o = U.op(), g = U.game(true), tt = o.turns.find(x => x.id === o.adj.target); g.adjLog.push({ at: new Date().toLocaleTimeString(U.store.lang === 'en' ? 'en-GB' : 'es-ES'), tl: tt ? tt.label : '', d: detail, o: outcome }); U.save(true); }
  function applyBtn(o) { const op = U.op(), tt = op.turns.find(x => x.id === op.adj.target); return tt ? `<button class="btn gold wide" data-a="applyres" data-o="${esc(o)}">✔ ${t('Aplicar «{r}» a {t}', { r: U.resL(o), t: tt.label })}</button>` : ''; }
  const rnd = n => Math.floor(Math.random() * n) + 1;

  /* =============================== REGISTROS =============================== */
  const REG = {
    dp: { t: 'Puntos de decisión', cols: [['id', 'ID', 'in', 80], ['side', 'Bando', 'l:BLUE,RED', 84], ['dec', 'Decisión', 'ta'], ['trg', 'Disparador / indicador', 'ta'], ['nai', 'NAI', 'sel:nai', 130], ['ccir', 'CCIR', 'sel:ccir', 150], ['dc', 'DC', 'in', 90], ['win', 'Ventana', 'in', 110], ['st', 'Estado', 'l:WATCH,TRIGGERED,MISSED,CLOSED', 110]] },
    ccir: { t: 'CCIR — PIR · FFIR · EEFI', cols: [['id', 'ID', 'in', 84], ['type', 'Tipo', 'l:PIR,FFIR,EEFI', 80], ['q', 'Pregunta / requisito', 'ta'], ['feeds', 'Alimenta (DC / decisión)', 'in', 160], ['nai', 'NAI', 'sel:nai', 130], ['st', 'Estado', 'l:OPEN,PARTIAL,ANSWERED', 110]] },
    nai: { t: 'Áreas de interés (NAI)', cols: [['id', 'ID', 'in', 80], ['loc', 'Ubicación', 'in', 180], ['ind', 'Indicador — qué observar', 'ta'], ['ccir', 'CCIR que responde', 'sel:ccir', 150], ['col', 'Medio de obtención', 'in', 180], ['time', 'Tiempo', 'in', 110], ['st', 'Estado', 'l:ACTIVE,TRIGGERED,INACTIVE', 110]] },
    tai: { t: 'Áreas de interés de objetivos (TAI)', cols: [['id', 'ID', 'in', 80], ['loc', 'Ubicación', 'in', 190], ['tgt', 'Objetivo (HPT)', 'sel:hpt', 150], ['means', 'Medios de ataque', 'in'], ['dp', 'DP', 'sel:dp', 140], ['eff', 'Efecto', 'in'], ['st', 'Estado', 'l:PLANNED,ENGAGED,ACHIEVED,FAILED', 110]] },
    hpt: { t: 'Objetivos de alta rentabilidad (HPT)', cols: [['id', 'ID', 'in', 80], ['tgt', 'Objetivo', 'ta'], ['when', 'Cuándo (fase)', 'sel:steps', 160], ['how', 'Cómo (medios)', 'in'], ['eff', 'Efecto', 'l:Destroy,Neutralise,Suppress,Disrupt,Deny,Delay', 110], ['tai', 'TAI', 'sel:tai', 90], ['st', 'Estado', 'l:PLANNED,ENGAGED,ACHIEVED,FAILED', 110]] },
    hvt: { t: 'Objetivos de alto valor (HVT)', cols: [['id', 'ID', 'in', 80], ['tgt', 'Objetivo', 'ta'], ['val', 'Por qué importa al enemigo', 'ta'], ['xs', 'Serie de objetivos', 'in', 90], ['means', 'Medios', 'in'], ['st', 'Estado', 'l:PLANNED,ENGAGED,ACHIEVED,FAILED', 110]] }
  };
  const nid = (p, arr) => { let m = 0; arr.forEach(x => { const r = String(x.id || '').match(/(\d+)$/); if (r) m = Math.max(m, +r[1]); }); return p + (m + 1); };
  const REGNEW = {
    dp: () => ({ id: nid('DP-B', U.op().reg.dp), side: 'BLUE', dec: '', trg: '', nai: '', ccir: '', dc: '', win: '', st: 'WATCH' }),
    ccir: () => ({ id: nid('PIR-', U.op().reg.ccir.filter(c => c.type === 'PIR')), type: 'PIR', q: '', feeds: '', nai: '', st: 'OPEN' }),
    nai: () => ({ id: nid('NAI-', U.op().reg.nai), loc: '', ind: '', ccir: '', col: '', time: '', st: 'ACTIVE' }),
    tai: () => ({ id: nid('TAI-', U.op().reg.tai), loc: '', tgt: '', means: '', dp: '', eff: '', st: 'PLANNED' }),
    hpt: () => ({ id: nid('HPT-', U.op().reg.hpt), tgt: '', when: '', how: '', eff: 'Neutralise', tai: '', st: 'PLANNED' }),
    hvt: () => ({ id: nid('HVT-', U.op().reg.hvt), tgt: '', val: '', xs: '', means: '', st: 'PLANNED' })
  };
  function cell(p, type) {
    if (type === 'in') return fIn(p); if (type === 'ta') return fTa(p, 2);
    if (type.startsWith('sel:')) return fSel(p, O[type.slice(4)]()); if (type.startsWith('l:')) return fSel(p, type.slice(2).split(','));
    return '';
  }
  U.R.reg = function () {
    const o = U.op(), k = o.ui.regTab || 'dp', D = REG[k], arr = o.reg[k];
    let h = secH(t('Registros'), t('Cree, edite o elimine NAI, TAI, HPT, HVT, puntos de decisión y CCIR (PIR / FFIR / EEFI). Todos los desplegables de la herramienta se actualizan desde aquí.'));
    h += pills(Object.keys(REG).map(x => [x, x.toUpperCase(), o.reg[x].length]), k, 'uitab', 'regTab');
    let extra = '';
    if (k === 'ccir') extra = `<button class="btn sm" data-a="addccir" data-t="FFIR">＋ FFIR</button><button class="btn sm" data-a="addccir" data-t="EEFI">＋ EEFI</button>`;
    if (k === 'dp') extra = `<button class="btn sm" data-a="addreddp">＋ ${t('DP enemigo')}</button>`;
    h += card(t(D.t), `<div class="tw"><table class="t"><thead><tr>${D.cols.map(c => `<th${c[3] ? ` style="width:${c[3]}px"` : ''}>${t(c[1])}</th>`).join('')}<th style="width:34px"></th></tr></thead><tbody>` +
      arr.map((row, i) => `<tr>${D.cols.map(c => `<td>${cell('reg.' + k + '.' + i + '.' + c[0], c[2])}</td>`).join('')}<td><button class="btn ghost sm" data-a="del" data-l="reg.${k}" data-i="${i}" aria-label="${t('Eliminar')}">✕</button></td></tr>`).join('') +
      `</tbody></table></div><div class="row"><button class="btn pri sm" data-a="addreg" data-k="${k}">＋ ${t('Añadir')} ${k.toUpperCase()}</button>${extra}</div>`, 'gold');
    if (k === 'dp' || k === 'nai' || k === 'ccir') {
      const g = W.game(o, null, false) || { turns: {} };
      h += card(t('Apoyo a la decisión — referencias cruzadas (DP ← CCIR ← NAI)'), `<div class="tw"><table class="t ro"><thead><tr><th>DP</th><th>${t('Decisión')}</th><th>CCIR</th><th>NAI</th><th>${t('Obtención')}</th><th>${t('Turnos jugados')}</th><th>${t('Estado')}</th></tr></thead><tbody>` +
        o.reg.dp.map(d => { const c = o.reg.ccir.find(x => x.id === d.ccir), n = o.reg.nai.find(x => x.id === d.nai), ts = o.turns.filter(x => (g.turns[x.id] || {}).dp === d.id).map(x => x.label);
          return `<tr><td><b>${esc(d.id)}</b></td><td class="small">${esc(d.dec)}</td><td class="small">${c ? '<b>' + esc(c.id) + '</b> ' + esc(short(c.q, 60)) : `<span class="tag warn">${t('ninguno')}</span>`}</td><td class="small">${n ? '<b>' + esc(n.id) + '</b> ' + esc(n.loc) : `<span class="tag warn">${t('ninguna')}</span>`}</td><td class="small">${n ? esc(n.col) : ''}</td><td class="small">${ts.join(', ') || `<span class="muted">${t('sin jugar')}</span>`}</td><td><span class="tag ${d.st === 'TRIGGERED' ? 'ok' : d.st === 'MISSED' ? 'bad' : 'warn'}">${esc(d.st)}</span></td></tr>`; }).join('') + '</tbody></table></div>');
    }
    return h;
  };

  /* ------------------------------ acciones ------------------------------ */
  U.NEWX = { 'fr.f': () => ({ n: 1, s: 1, t: '', fe: 0, lbl: '' }), 'fr.e': () => ({ n: 1, s: 1, t: '', fe: 0, lbl: '' }) };
  function newTurn(m) { const o = U.op(), k = C.MKEYS.includes(m) ? m : 'critical', n = o.turns.filter(x => x.m === k).length + 1;
    return { id: 't' + Date.now().toString(36), m: k, label: U.METHODS[k].pre + ' ' + (k === 'box' ? String.fromCharCode(64 + n) : n), title: '', time: '', ce: '', sim: true }; }
  function fromTurnEngagement(tid, eid) {
    const o = U.op(), c = U.coa(), e = U.ecoa(), g = U.game(true), path = U.pathFor(c, e, g);
    const T = path.turns.find(x => x.t.id === tid); if (!T) return null;
    return { T, r: T.results.find(x => x.x.eng.id === eid), path };
  }
  Object.assign(U.A, {
    wgTurn: d => { const o = U.op(); o.ui.wgTurn = +d.i; o.ui.wgStep = 0; U.save(); U.render(); },
    wgStep: d => { U.op().ui.wgStep = +d.i; U.save(); U.render(); },
    prevStep: () => { const o = U.op(); if (o.ui.wgStep > 0) o.ui.wgStep--; else if (o.ui.wgTurn > 0) { o.ui.wgTurn--; o.ui.wgStep = steps(o).length - 1; } U.save(); U.render(); },
    nextStep: d => { const o = U.op(), n = steps(o).length; if (o.ui.wgStep < n - 1) o.ui.wgStep++; else if (o.ui.wgTurn < +d.n - 1) { o.ui.wgTurn++; o.ui.wgStep = 0; U.toast(t('Turno cerrado. El siguiente parte del estado adjudicado.')); } else U.toast(t('Último turno cerrado. Revise «Resumen y evaluación».')); U.save(); U.render(); },
    toTurn: d => { const o = U.op(), list = E.activeTurns(o).filter(x => (o.ui.wgM || 'all') === 'all' || x.m === o.ui.wgM); const i = list.findIndex(x => x.id === d.id); o.ui.wgView = 'turn'; o.ui.wgTurn = Math.max(0, i); o.ui.wgStep = 0; if (i < 0) o.ui.wgM = 'all'; U.go('wargame'); },
    addturn: () => { const o = U.op(), x = newTurn(o.ui.wgM); o.prep.methods[x.m] = true; o.turns.push(x); U.save(true); U.render(); U.toast(t('Turno añadido')); },
    mvturn: d => { const o = U.op(), i = +d.i, j = i + (+d.d); if (j < 0 || j >= o.turns.length) return; [o.turns[i], o.turns[j]] = [o.turns[j], o.turns[i]]; U.save(true); U.render(); },
    delturn: d => U.ask(t('¿Eliminar este turno de la operación (en todas las COA y confrontaciones)?'), () => { const o = U.op(), x = o.turns[+d.i]; o.turns.splice(+d.i, 1);
      o.coas.forEach(c => delete c.plan[x.id]); o.ecoas.forEach(c => delete c.plan[x.id]); Object.values(o.games).forEach(g => delete g.turns[x.id]); U.save(true); U.render(); }),
    addasset: (d, el) => { if (!el.value) return; const gt = gturn(U.game(true), d.id); gt.assets = gt.assets || []; if (!gt.assets.includes(el.value)) gt.assets.push(el.value); U.save(true); U.render(); },
    rmasset: d => { gturn(U.game(true), d.id).assets.splice(+d.k, 1); U.save(true); U.render(); },
    sug: d => { const o = U.op(), x = o.turns.find(z => z.id === d.id), ce = o.ces.find(z => z.id === x.ce); if (!ce) { U.toast(t('Asigne antes un evento crítico al turno')); return; }
      const apply = () => {
        if (d.f === 'r') { const e = U.ecoa(); e.plan[x.id] = e.plan[x.id] || { pre: '', r: '', place: [] }; e.plan[x.id].r = ce.r[e.id] || ''; }
        else { const gt = gturn(U.game(true), x.id); gt.cr = ce.cr; if (!gt.dp && ce.dp) gt.dp = ce.dp; if (!gt.ccir && ce.ccir) gt.ccir = ce.ccir; }
        U.save(true); U.render(); U.toast('✦ ' + t('Sugerencia aplicada')); };
      const cur = d.f === 'r' ? ((U.ecoa().plan[x.id] || {}).r || '') : (gturn(U.game(true), x.id).cr || '');
      if (cur.trim()) U.ask(t('¿Sustituir el texto actual por la sugerencia?'), apply); else apply(); },
    applySug: d => { gturn(U.game(true), d.id).res = d.v; U.save(true); U.render(); },
    clearOvr: d => { const gt = gturn(U.game(true), d.id); if (gt.ovr) delete gt.ovr[d.e]; if (gt.mods) delete gt.mods[d.e]; U.save(true); U.render(); },
    engFR: d => { const o = U.op(), x = fromTurnEngagement(d.id, d.e); if (!x || !x.r) return; const um = x.path.umap, row = (b, side) => { const u = um[b.u]; return { n: (+u.frQ || 1) * ((b.pct == null || b.pct === '' ? 100 : +b.pct) / 100), s: +(x.T.startStr[b.u] || 0).toFixed(2), t: u.frT, fe: +u.frFE || 0, lbl: u.name }; };
      o.fr.f = x.r.x.blue.map(b => row(b)); o.fr.e = x.r.x.red.map(b => row(b)); o.fr.name = x.T.t.label + ' — ' + x.r.x.eng.label; o.fr.turn = d.id;
      const task = U.cfg().tasks[x.r.x.eng.task]; if (task) { o.fr.pm = task.plan; const p = (x.r.x.eng.pair || task.pair).split(' vs '); o.fr.fM = p[0]; o.fr.eM = p[1]; }
      U.save(true); U.go('fr'); },
    engRoll: d => { const o = U.op(); o.adj.target = d.id; lastRoll = null; U.pendingRollEng = d.e; U.go('adj'); },
    frt: d => { const o = U.op(), x = o.turns.find(z => z.id === d.id); o.fr.turn = x.id; o.fr.name = x.label + ' — ' + x.title; U.save(true); U.go('fr'); },
    adjt: d => { U.op().adj.target = d.id; U.save(true); U.go('adj'); },
    csv: () => { const o = U.op(), c = U.coa(), e = U.ecoa(), g = U.game(true), m = E.unitMap(o), path = U.pathFor(c, e, g), q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const rows = [['Turn #', 'Method', 'Critical event', 'Action', 'Reaction', 'Counter Action', 'Assets', 'Approximate Time', 'Decision Point', 'CCIR', 'Remarks', 'Branch', 'Result', 'Engine result', 'Blue CP %', 'Red CP %']];
      path.turns.forEach(T => { const x = T.t, gt = g.turns[x.id] || {}; rows.push([x.label, U.METHODS[x.m].l, x.ce, (c.plan[x.id] || {}).a, (e.plan[x.id] || {}).r, gt.cr, (gt.assets || []).map(a => m[a] ? m[a].name : '').join(' / '), x.time, gt.dp, gt.ccir, gt.rem, gt.branch, gt.res, T.suggested, gt.bcp !== '' && gt.bcp != null ? gt.bcp : (T.bcpCalc == null ? '' : Math.round(T.bcpCalc * 100)), gt.rcp !== '' && gt.rcp != null ? gt.rcp : (T.rcpCalc == null ? '' : Math.round(T.rcpCalc * 100))]); });
      U.dl(U.fileName(o.meta.title) + '_' + c.id + '_vs_' + e.id + '_worksheet.csv', '﻿sep=;\n' + rows.map(r => r.map(q).join(';')).join('\n'), 'text/csv;charset=utf-8'); U.toast(t('Hoja de trabajo exportada (se abre en Excel)')); },
    /* correlación */
    frload: (d, el) => { const o = U.op(), u = o.orbat.find(x => x.id === el.value); if (u) { o.fr[d.side].push({ n: +u.frQ || 1, s: (+u.cp || 0) / 100, t: u.frT, fe: +u.frFE || 0, lbl: u.name }); U.save(true); U.render(); } },
    frclear: () => U.ask(t('¿Vaciar todas las filas propias y adversarias?'), () => { const o = U.op(); o.fr.f = []; o.fr.e = []; U.save(true); U.render(); }),
    frsave: () => { const o = U.op(), T = frTotals(), pair = o.fr.fM + ' vs ' + o.fr.eM, dm = C.DMG[pair] && T.r ? E.dmgAt(pair, T.r) : null, tt = o.turns.find(x => x.id === o.fr.turn), pm = C.PLAN_M[o.fr.pm], g = U.game(true);
      const rec = { name: o.fr.name || t('Enfrentamiento'), turn: o.fr.turn, tl: tt ? tt.label : '', ratio: E.fmtR(T.r), fl: dm ? dm.fl / 100 : null, el: dm ? dm.el / 100 : null, pm: o.fr.pm, verdict: pm ? T.r >= pm.need : null };
      g.frSaved.push(rec); if (tt) gturn(g, tt.id).fr = 'F:E ' + rec.ratio + (dm ? ' · est. F ' + Math.round(dm.fl) + '% / E ' + Math.round(dm.el) + '%' : '');
      U.save(true); U.render(); U.toast(t('Enfrentamiento guardado')); },
    delSaved: d => { U.game(true).frSaved.splice(+d.i, 1); U.save(true); U.render(); },
    /* adjudicación */
    adjDist: d => { U.op().adj.dist = d.t; U.save(); U.render(); },
    roll: () => { const o = U.op(), sel = document.getElementById('rollEng'); if (!sel) return; const tid = o.adj.target, x = fromTurnEngagement(tid, sel.value); if (!x || !x.r) return;
      const gt = gturn(U.game(true), tid); const r = E.rollEngagement(o, U.coa(), U.ecoa(), U.cfg(), tid, sel.value, x.T.startStr, gt.mods && gt.mods[sel.value]);
      lastRoll = { turn: tid, eng: sel.value, r }; logAdj(r.outcome, t('Motor') + ': ' + x.r.x.eng.label + ' ' + E.fmtR(r.rEff)); U.render(); },
    applyRoll: () => { if (!lastRoll || !lastRoll.r) return; const gt = gturn(U.game(true), lastRoll.turn); gt.ovr = gt.ovr || {}; gt.ovr[lastRoll.eng] = { res: lastRoll.r.outcome, bl: +lastRoll.r.lb.toFixed(1), rl: +lastRoll.r.lr.toFixed(1) };
      U.save(true); const path = U.pathFor(U.coa(), U.ecoa(), U.game(true)); const T = path.turns.find(x => x.t.id === lastRoll.turn); if (T && T.suggested) gt.res = T.suggested; lastRoll = null; U.save(true); U.render(); U.toast(t('Tirada aplicada al enfrentamiento')); },
    die: d => { const n = +d.n, r = rnd(n), el = document.getElementById('dres'); el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll'); el.textContent = r; document.getElementById('dlab').textContent = 'd' + n + ' = ' + r; },
    prob: () => { const o = U.op(), r = rnd(10), tb = C.ADJ[o.adj.dist || 'equal']; let row = tb[tb.length - 1]; tb.forEach(x => { const [lo, hi] = x[0].split('–').map(Number); if (r >= lo && r <= (hi || lo)) row = x; });
      logAdj(row[1], 'd10 (' + (o.adj.dist || 'equal') + ') = ' + r); document.getElementById('pres').innerHTML = `<div class="res ${U.resCls(row[1])}">${r} → ${U.resTag(row[1])}<div class="small">${esc(row[2])}</div></div>${applyBtn(row[1])}`; U.renderNav(); },
    contest: () => { const o = U.op(), cst = C.CONTEST[o.adj.contest] || C.CONTEST.equal, b = rnd(cst[1]), r = rnd(cst[2]), bm = +o.adj.bmod || 0, rm = +o.adj.rmod || 0, B = b + bm, Rr = r + rm, dlt = B - Rr;
      document.getElementById('cdb').textContent = b + (bm ? (bm > 0 ? '+' : '') + bm : ''); document.getElementById('cdr').textContent = r + (rm ? (rm > 0 ? '+' : '') + rm : '');
      const out = dlt >= 5 ? 'DECISIVE SUCCESS' : dlt >= 2 ? 'SUCCESS' : dlt === 1 ? 'PARTIAL SUCCESS' : dlt === 0 ? 'NEUTRAL' : dlt >= -4 ? 'FAILURE' : 'DECISIVE FAILURE';
      logAdj(out, cst[0] + ': Blue ' + B + ' vs Red ' + Rr);
      document.getElementById('cres').innerHTML = `<div class="res ${dlt > 0 ? 'ok' : dlt < 0 ? 'bad' : 'warn'}">${dlt > 0 ? '🔵 ' + t('GANA AZUL') : dlt < 0 ? '🔴 ' + t('GANA ROJO') : '⚖ ' + t('EMPATE — repetir o decide el árbitro')} (${B} vs ${Rr}, ${t('margen')} ${dlt > 0 ? '+' : ''}${dlt})<div class="small">${t('Resultado sugerido para el turno')}: ${U.resTag(out)}</div></div>${applyBtn(out)}`; U.renderNav(); },
    applyres: d => { const o = U.op(), tt = o.turns.find(x => x.id === o.adj.target); if (!tt) { U.toast(t('Seleccione el turno que se adjudica')); return; } gturn(U.game(true), tt.id).res = d.o; U.save(true); U.render(); U.toast(tt.label + ' → ' + U.resL(d.o)); },
    frcontest: () => { const T = frTotals(); if (!T.r) { U.toast(t('Aún no hay correlación de fuerzas calculada')); return; } const o = U.op(), r = T.r; o.adj.contest = r >= 3 ? 'b-signif' : r >= 1.5 ? 'b-unequal' : r > 1 / 1.5 ? 'equal' : r > 1 / 3 ? 'r-unequal' : 'r-signif'; U.save(true); U.render(); U.toast(E.fmtR(r) + ' → ' + C.CONTEST[o.adj.contest][0]); },
    clearlog: () => U.ask(t('¿Vaciar el registro de adjudicación?'), () => { U.game(true).adjLog = []; U.save(true); U.render(); }),
    /* registros */
    addreg: d => { U.op().reg[d.k].push(REGNEW[d.k]()); U.save(true); U.render(); },
    addccir: d => { const o = U.op(); o.reg.ccir.push({ id: nid(d.t + '-', o.reg.ccir.filter(c => c.type === d.t)), type: d.t, q: '', feeds: '', nai: '', st: 'OPEN' }); U.save(true); U.render(); },
    addreddp: () => { const o = U.op(); o.reg.dp.push({ id: nid('DP-', o.reg.dp.filter(x => /^DP-\d+$/.test(x.id))), side: 'RED', dec: '', trg: '', nai: '', ccir: '', dc: '—', win: '', st: 'WATCH' }); U.save(true); U.render(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
