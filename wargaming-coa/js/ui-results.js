/* ==========================================================================
   Vistas de RESULTADOS
   Resumen y evaluación · Análisis estadístico · Datos y método · Asistente
   ========================================================================== */
(function (global) {
  'use strict';
  const U = global.WGUI, C = global.WGCat, E = global.WGEngine, W = global.WGModel;
  const { esc, short, t, fIn, fNum, fTa, fSel, fChk, O, secH, card, pills, pct } = U;
  const DMG0 = JSON.parse(JSON.stringify(C.DMG));
  function applyDmg() { const d = U.cfg().dmg; Object.keys(DMG0).forEach(k => { C.DMG[k] = (d && d[k]) ? d[k].slice() : DMG0[k].slice(); }); }
  U.applyDmg = applyDmg;

  /* ---------- registro de turnos de la pareja activa ---------- */
  function record() {
    const o = U.op(), c = U.coa(), e = U.ecoa(); if (!c || !e) return null;
    const g = U.game(true), path = U.pathFor(c, e, g);
    const rows = path.turns.map(T => { const gt = g.turns[T.t.id] || {};
      const bcp = gt.bcp !== '' && gt.bcp != null ? +gt.bcp : (T.bcpCalc == null ? null : Math.round(T.bcpCalc * 100));
      const rcp = gt.rcp !== '' && gt.rcp != null ? +gt.rcp : (T.rcpCalc == null ? null : Math.round(T.rcpCalc * 100));
      return { T, t: T.t, gt, res: gt.res || '', sug: T.suggested, bcp, rcp, manualCP: gt.bcp !== '' && gt.bcp != null }; });
    return { o, c, e, g, path, rows };
  }

  function observations(rec) {
    const out = [], o = rec.o;
    rec.rows.forEach(r => {
      if (/FAILURE/.test(r.res)) out.push(['bad', t('{l} terminó en {r}. Revise la COA en este evento{b}.', { l: r.t.label, r: U.resL(r.res), b: r.gt.branch ? ' — ' + t('rama') + ': ' + r.gt.branch : '' })]);
      if (r.bcp != null && r.bcp < o.ffir) out.push(['warn', t('{l}: potencia del esfuerzo principal azul {v} % — por debajo de FFIR-1 ({f} %).', { l: r.t.label, v: r.bcp, f: o.ffir })]);
      if (r.res && r.sug && E.RANK[r.res] < E.RANK[r.sug] - 1) out.push(['info', t('{l}: el árbitro registró {r}, más favorable que la lectura del motor ({s}). Justifique la diferencia.', { l: r.t.label, r: U.resL(r.res), s: U.resL(r.sug) })]);
      r.T.results.forEach(x => { if (x.calc.contact && x.calc.rEff < x.calc.req) out.push(['warn', t('{l} · {e}: ratio {r} por debajo del mínimo de planeamiento ({m}).', { l: r.t.label, e: x.x.eng.label, r: E.fmtR(x.calc.rEff), m: E.fmtR(x.calc.req) })]); });
      r.T.warnings.forEach(w => out.push(['warn', t('{l}: fuerzas rojas sin oposición en el sector {s}.', { l: r.t.label, s: w.sector })]));
    });
    const last = rec.rows[rec.rows.length - 1];
    if (last && last.rcp != null && last.rcp <= 40) out.push(['ok', t('Adversario desgastado al {v} % al final — condiciones favorables para la acción decisiva.', { v: last.rcp })]);
    o.prep.assumptions.filter(a => a.status === 'INVALID').forEach(a => out.push(['bad', t('Supuesto {i} INVÁLIDO — {f}', { i: a.id, f: a.fail })]));
    const un = o.prep.assumptions.filter(a => a.status === 'UNTESTED').length; if (un) out.push(['info', t('{n} supuesto(s) sin comprobar — confírmelos o conviértalos en CCIR.', { n: un })]);
    o.reg.dp.filter(d => o.prep.dpSel.includes(d.id) && !rec.rows.some(r => r.gt.dp === d.id)).forEach(d => out.push(['warn', t('{d} seleccionado pero no jugado en ningún turno.', { d: d.id })]));
    o.reg.dp.filter(d => d.st === 'MISSED').forEach(d => out.push(['bad', t('{d} PERDIDO — revise la NAI/CCIR que debía activarlo.', { d: d.id })]));
    o.inputs.est.filter(x => /^Not/.test(x.status)).forEach(x => out.push(['warn', t('{f}: no sostenible — requiere rama, petición al escalón superior o refinamiento.', { f: x.fn })]));
    if (!out.length) out.push(['ok', t('No se detectan problemas críticos en la confrontación registrada.')]);
    return out;
  }

  /* ---------- gráfico de líneas (potencia de combate) ---------- */
  function lineChart(series, labels, opts) {
    opts = opts || {};
    const Wd = 720, H = 250, L = 40, R = opts.right == null ? 130 : opts.right, T0 = 14, B = 34, n = labels.length;
    if (!n) return '';
    const x = i => L + (n === 1 ? (Wd - L - R) / 2 : i * (Wd - L - R) / (n - 1)), y = v => T0 + (1 - v) * (H - T0 - B);
    let g = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(v => { g += `<line x1="${L}" x2="${Wd - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${v * 100}</text>`; });
    labels.forEach((l, i) => { g += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" class="axis">${esc(short(l, 12))}</text>`; });
    (opts.refs || []).forEach(rf => { g += `<line x1="${L}" x2="${Wd - R}" y1="${y(rf.v)}" y2="${y(rf.v)}" class="ref ${rf.cls}"/><text x="${Wd - R + 4}" y="${y(rf.v) + 4}" class="axis ${rf.cls}">${esc(rf.l)}</text>`; });
    const ends = [];
    series.forEach((s, k) => {
      const col = 'var(--s' + ((k % 8) + 1) + ')';
      if (s.band) { const up = s.band.map((b, i) => x(i) + ',' + y(b[1])).join(' '), lo = s.band.map((b, i) => x(i) + ',' + y(b[0])).reverse().join(' '); g += `<polygon points="${up} ${lo}" fill="${col}" opacity=".14"/>`; }
      g += `<polyline points="${s.v.map((v, i) => v == null ? '' : x(i) + ',' + y(v)).join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
      s.v.forEach((v, i) => { if (v != null) g += `<circle cx="${x(i)}" cy="${y(v)}" r="${i === n - 1 ? 4 : 2.5}" fill="${col}" stroke="var(--card)" stroke-width="1.5"/>`; });
      const lv = s.v[n - 1]; if (lv != null) ends.push({ y: y(lv), l: s.l, col });
    });
    ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
    if (R > 20) ends.forEach(e2 => { g += `<rect x="${Wd - R + 2}" y="${e2.y - 2}" width="6" height="3" fill="${e2.col}"/><text x="${Wd - R + 12}" y="${e2.y + 4}" class="axis lbl">${esc(short(e2.l, 18))}</text>`; });
    labels.forEach((l, i) => { const w = (Wd - L - R) / Math.max(1, n - 1); g += `<rect class="hit" data-i="${i}" x="${x(i) - w / 2}" y="${T0}" width="${w}" height="${H - T0 - B}" fill="transparent"/>`; });
    const id = 'ch' + Math.random().toString(36).slice(2, 7);
    U.chartData = U.chartData || {}; U.chartData[id] = { series, labels };
    return `<div class="chart" id="${id}"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(opts.aria || '')}">${g}</svg><div class="tip" hidden></div></div>`;
  }
  function wireCharts() {
    document.querySelectorAll('.chart').forEach(el => {
      const d = U.chartData && U.chartData[el.id]; if (!d) return; const tip = el.querySelector('.tip');
      el.querySelectorAll('.hit').forEach(r => {
        r.addEventListener('mousemove', ev => { const i = +r.dataset.i; tip.innerHTML = `<b>${esc(d.labels[i])}</b><br>` + d.series.map(s => `${esc(s.l)}: ${s.v[i] == null ? '—' : Math.round(s.v[i] * 100) + ' %'}`).join('<br>'); const b = el.getBoundingClientRect(); tip.style.left = (ev.clientX - b.left) + 'px'; tip.style.top = (ev.clientY - b.top) + 'px'; tip.hidden = false; });
        r.addEventListener('mouseleave', () => { tip.hidden = true; });
      });
    });
  }

  /* =============================== RESUMEN Y EVALUACIÓN =============================== */
  U.R.results = function () {
    const rec = record(); if (!rec) return secH(t('Resumen y evaluación'), '') + `<p class="warnbox">${t('Defina al menos una COA propia y una COA enemiga.')}</p>`;
    const { o, c, e, g, rows } = rec;
    const adj = rows.filter(r => r.res), succ = adj.filter(r => /SUCCESS/.test(r.res)).length;
    const dps = o.reg.dp.filter(d => o.prep.dpSel.includes(d.id)), dpT = dps.filter(d => d.st === 'TRIGGERED').length;
    const ans = o.reg.ccir.filter(x => x.st === 'ANSWERED').length;
    const score = adj.length ? adj.reduce((a, r) => a + (C.RSCORE[r.res] || 0), 0) / adj.length : 0;
    const agree = adj.filter(r => r.sug && E.RANK[r.res] === E.RANK[r.sug]).length;
    let h = secH(t('Resumen y evaluación'), t('Se compila a partir de la hoja de trabajo, los registros, el motor y la adjudicación. Puntúe cada COA frente a los criterios del comandante y marque los productos del Paso 4.'),
      `<button class="btn sm" data-a="csv">⬇ CSV</button><button class="btn sm" data-a="exportOp">⬇ JSON</button>`);
    h += `<div class="card"><div class="cb">${U.pairBar(o)}</div></div>`;
    h += `<div class="kpis"><div class="kpi"><b>${adj.length}/${rows.length}</b><span>${t('Turnos adjudicados')}</span></div>
      <div class="kpi"><b class="${succ >= adj.length / 2 ? 'ok-t' : 'bad-t'}">${adj.length ? Math.round(succ / adj.length * 100) : 0}%</b><span>${t('Turnos con éxito')}</span></div>
      <div class="kpi"><b>${adj.length ? Math.round(agree / adj.length * 100) : 0}%</b><span>${t('Coincidencia árbitro / motor')}</span></div>
      <div class="kpi"><b>${dpT}/${dps.length}</b><span>${t('DP activados')}</span></div>
      <div class="kpi"><b>${ans}/${o.reg.ccir.length}</b><span>${t('CCIR respondidos')}</span></div></div>`;
    const labels = [t('Inicio')].concat(rows.map(r => r.t.label));
    const bcpS = [1].concat(rows.map(r => r.bcp == null ? null : r.bcp / 100)), rcpS = [1].concat(rows.map(r => r.rcp == null ? null : r.rcp / 100));
    h += `<div class="g2"><div>` + card(t('Potencia de combate a lo largo de la confrontación'), lineChart([{ l: t('CP azul (ME)'), v: bcpS }, { l: t('CP rojo'), v: rcpS, dash: true }], labels, { refs: [{ v: o.ffir / 100, l: 'FFIR-1', cls: 'warn' }, { v: o.dcLine / 100, l: 'DC', cls: 'bad' }], aria: t('Potencia de combate por turno') }) + `<p class="small muted">${t('Valores registrados por el árbitro o, si están vacíos, calculados por el motor.')}</p>`, 'blue') + `</div><div>` +
      card(t('Observaciones automáticas'), `<div class="scroll">${observations(rec).map(x => `<div class="tip-i ${x[0]}">${esc(x[1])}</div>`).join('')}</div><p class="small muted">${t('Puntuación media por turno')}: <b>${score.toFixed(2)}</b> (−2 … +2)</p>`, 'gold') + `</div></div>`;
    h += card(t('Registro de la confrontación'), `<div class="tw"><table class="t ro"><thead><tr><th>${t('Turno')}</th><th>${t('Tiempo')}</th><th>${t('Evento / DC')}</th><th>${t('Acción azul')}</th><th>${t('Reacción roja')}</th><th>${t('Contrarreacción')}</th><th>DP</th><th>CCIR</th><th>${t('Resultado')}</th><th>${t('Motor')}</th><th>CP A/R</th></tr></thead><tbody>` +
      rows.map(r => { const ce = o.ces.find(x => x.id === r.t.ce); return `<tr><td><b>${esc(r.t.label)}</b><div class="muted small">${t(U.METHODS[r.t.m].l)}</div></td><td class="small">${esc(r.t.time)}</td><td class="small">${ce ? esc(ce.id) + ' · ' + esc(ce.dc) : ''}</td><td class="small">${esc(short((c.plan[r.t.id] || {}).a, 160))}</td><td class="small">${esc(short((e.plan[r.t.id] || {}).r, 160))}</td><td class="small">${esc(short(r.gt.cr, 160))}</td><td class="small">${esc(r.gt.dp)}</td><td class="small">${esc(r.gt.ccir)}</td><td>${U.resTag(r.res)}</td><td>${U.resTag(r.sug)}</td><td class="small num"><b class="blue-t">${r.bcp == null ? '—' : r.bcp}</b>/<b class="red-t">${r.rcp == null ? '—' : r.rcp}</b></td></tr>`; }).join('') + '</tbody></table></div>');
    const FN = U.FUNCS.map(f => [f[0], t(f[1])]);
    h += card(t('Matriz de sincronización (funciones × turnos)'), `<div class="tw"><table class="t sync"><thead><tr><th>${t('Función')}</th>${rows.map(r => `<th>${esc(r.t.label)}<div class="muted small">${esc(r.t.time)}</div></th>`).join('')}</tr></thead><tbody>
      <tr class="enemy"><th scope="row">${t('Enemigo (esperado)')}</th>${rows.map(r => `<td class="small">${esc(short(((e.plan[r.t.id] || {}).pre || (e.plan[r.t.id] || {}).r || ''), 180))}</td>`).join('')}</tr>
      ${FN.map(f => `<tr><th scope="row">${f[1]}</th>${rows.map(r => `<td>${fTa('sync.' + f[0] + '.' + r.t.id, 2, '', '', 'g')}</td>`).join('')}</tr>`).join('')}
      <tr><th scope="row">${t('Puntos de decisión')}</th>${rows.map(r => `<td class="small">${esc(r.gt.dp)}</td>`).join('')}</tr></tbody></table></div>`, 'blue');
    const crit = o.inputs.criteria, sc = [['', '—'], ['2', '++'], ['1', '+'], ['0', '0'], ['-1', '−'], ['-2', '−−']];
    o.coas.forEach(x => { o.evalx[x.id] = o.evalx[x.id] || {}; crit.forEach(k => { o.evalx[x.id][k.id] = o.evalx[x.id][k.id] || { s: '', n: '' }; }); });
    const tot = x => crit.reduce((a, k) => a + (+o.evalx[x.id][k.id].s || 0) * (+k.w || 0), 0);
    h += card(t('Evaluación frente a los criterios de selección del comandante'), crit.length ? `<div class="tw"><table class="t"><thead><tr><th style="width:190px">${t('Criterio (peso)')}</th>${o.coas.map(x => `<th>${esc(x.name)}</th>`).join('')}</tr></thead><tbody>` +
      crit.map(k => `<tr><td><b>${esc(k.name)}</b> <span class="tag info">×${esc(k.w)}</span><div class="small muted">${esc(k.q)}</div></td>${o.coas.map(x => `<td><div class="row nowrap"><div style="width:72px">${fSel('evalx.' + x.id + '.' + k.id + '.s', sc, 'self')}</div>${fTa('evalx.' + x.id + '.' + k.id + '.n', 2, t('Ventajas / inconvenientes / riesgos…'))}</div></td>`).join('')}</tr>`).join('') +
      `<tr><td class="strong">${t('Total ponderado')}</td>${o.coas.map(x => `<td class="strong big ${tot(x) >= 0 ? 'ok-t' : 'bad-t'}">${tot(x)}</td>`).join('')}</tr></tbody></table></div>` : `<p class="muted small">${t('Defina los criterios en «Datos de planeamiento → CPG y criterios».')}</p>`, 'gold');
    const br = rows.filter(r => r.gt.branch);
    h += `<div class="g2"><div>` + card(t('Ramas y secuelas identificadas'), br.length ? `<table class="t ro"><tbody>${br.map(r => `<tr><td style="width:110px"><b>${esc(r.t.label)}</b></td><td class="small">${esc(r.gt.branch)}</td></tr>`).join('')}</tbody></table>` : `<p class="muted small">${t('Ninguna registrada.')}</p>`) +
      card(t('Supuestos actualizados'), `<table class="t ro"><tbody>${o.prep.assumptions.map(a => `<tr><td style="width:44px"><b>${esc(a.id)}</b></td><td class="small">${esc(a.text)}</td><td><span class="tag ${a.status === 'VALID' ? 'ok' : a.status === 'INVALID' ? 'bad' : 'warn'}">${esc(a.status)}</span></td></tr>`).join('') || `<tr><td class="muted small">${t('Sin supuestos.')}</td></tr>`}</tbody></table>`) +
      `</div><div>` + card(t('CCIR y puntos de decisión actualizados'), `<table class="t ro"><tbody>${o.reg.ccir.map(x => `<tr><td style="width:70px"><b>${esc(x.id)}</b></td><td class="small">${esc(short(x.q, 90))}</td><td><span class="tag ${x.st === 'ANSWERED' ? 'ok' : x.st === 'PARTIAL' ? 'warn' : 'info'}">${esc(x.st)}</span></td></tr>`).join('')}${dps.map(d => `<tr><td><b>${esc(d.id)}</b></td><td class="small">${esc(short(d.dec, 90))}</td><td><span class="tag ${d.st === 'TRIGGERED' ? 'ok' : d.st === 'MISSED' ? 'bad' : 'warn'}">${esc(d.st)}</span></td></tr>`).join('')}</tbody></table>`) +
      card(t('Enfrentamientos guardados (correlación de fuerzas)'), g.frSaved.length ? `<table class="t ro"><thead><tr><th>${t('Enfrentamiento')}</th><th>F:E</th><th>${t('Bajas P/E')}</th></tr></thead><tbody>${g.frSaved.map(x => `<tr><td class="small">${esc(x.name)}</td><td><b>${esc(x.ratio)}</b></td><td class="small">${x.fl != null ? Math.round(x.fl * 100) + '% / ' + Math.round(x.el * 100) + '%' : 'N/A'}</td></tr>`).join('')}</tbody></table>` : `<p class="muted small">${t('Ninguno guardado.')}</p>`) + `</div></div>`;
    const f = g.facds || {};
    const frow = (k, l) => `<b>${l}</b>${fSel('facds.' + k + '.v', [['', '— ' + t('sin evaluar') + ' —'], ['SI', '✓ ' + t('Sí')], ['COND', '✓ ' + t('Con refinamientos')], ['NO', '✗ No']], 'self', '', 'g')}${fIn('facds.' + k + '.t', t('Justificación'), '', 'g')}`;
    h += card(t('Viabilidad (FACDS) y conclusiones de la confrontación') + (global.WGAI ? ` <button class="btn sm" data-a="aiOpen" data-k="concl">✦ ${t('Borrador con IA')}</button>` : ''), `<div class="facds">${frow('F', t('Factible'))}${frow('A', t('Aceptable'))}${frow('C', t('Completa'))}${frow('D', t('Distinguible'))}${frow('S', t('Adecuada'))}</div>
      <div class="g2 tight"><div><label class="fl">${t('Fortalezas')}</label>${fTa('strengths', 4, '', '', 'g')}</div><div><label class="fl">${t('Debilidades')}</label>${fTa('weaknesses', 4, '', '', 'g')}</div></div>
      <label class="fl">${t('Conclusión para el comandante')}</label>${fTa('conclusions', 3, '', '', 'g')}`, 'gold');
    const OUT = [['refined', t('COA refinada')], ['sync', t('Matriz de sincronización')], ['dso', t('Superposición / matriz de apoyo a la decisión (DSO / DSOM)')], ['assump', t('Supuestos y CCIR actualizados')], ['est', t('Estimaciones de EM actualizadas')], ['brief', t('Exposición del análisis de COA (opcional)')]];
    h += card(t('Productos del Paso 4'), `<div class="g3 tight">${OUT.map(x => fChk('outputs.' + x[0], x[1], 'nav', 'g')).join('')}</div><label class="fl">${t('Enunciado de la COA refinada')}</label>${fTa('outputs.refinedText', 4, t('Cambios en la organización operativa, tiempos, DP y medidas de control resultantes de la confrontación…'), '', 'g')}`, 'blue');
    return h;
  };
  U.after.results = wireCharts;

  /* =============================== ANÁLISIS ESTADÍSTICO =============================== */
  function heat(p) { return p >= 0.7 ? 'h-ok' : p >= 0.4 ? 'h-warn' : 'h-bad'; }
  U.R.stats = function () {
    const o = U.op(), cfg = U.cfg();
    if (!o.coas.length || !o.ecoas.length) return secH(t('Análisis estadístico'), '') + `<p class="warnbox">${t('Defina al menos una COA propia y una COA enemiga.')}</p>`;
    const A = U.analysis(), likeSum = o.ecoas.reduce((a, x) => a + (+x.lik || 0), 0) || 1;
    let pair = o.ui.statPair; if (!A[pair]) pair = o.ui.statPair = o.prep.coa + '|' + o.prep.acoa; if (!A[pair]) pair = Object.keys(A)[0];
    let h = secH(t('Análisis estadístico'), t('Cada pareja COA–ECOA se simula {n} veces encadenando los turnos activos (semilla {s}: resultados reproducibles). P(éxito): ningún enfrentamiento en fracaso y el esfuerzo principal al menos en éxito parcial. Todas las DC: además, cada esfuerzo principal logra éxito o éxito decisivo.', { n: cfg.sim.n, s: cfg.sim.seed }));
    h += card(t('Matriz COA × COA enemiga'), `<p class="hint">${t('Doctrina: cada COA se confronta de forma independiente frente a la COA enemiga. Esta matriz es un insumo para el Paso 5 (comparación de COA); no sustituye al juicio del comandante.')}</p>
      <div class="tw"><table class="t matrix"><thead><tr><th>BLUE \\ RED</th>${o.ecoas.map(x => `<th>${esc(x.name)}<br><span class="tag bad">${esc(x.tag || '—')}</span> <span class="num">${+x.lik || 0} %</span></th>`).join('')}<th>${t('Ponderado por probabilidad')}</th><th>${t('Peor caso')}</th></tr></thead><tbody>` +
      o.coas.map(c => { let wS = 0, wCP = 0, worst = null;
        const cells = o.ecoas.map(e => { const k = c.id + '|' + e.id, a = A[k], w = (+e.lik || 0) / likeSum;
          if (!a.hasPlan) return `<td><button class="mcell h-off" data-a="statPair" data-k="${esc(k)}" aria-current="${pair === k}"><span class="small">${t('Sin plan de enfrentamientos')}</span></button></td>`;
          wS += a.pSuccess * w; wCP += a.meanBlueCP * w; if (!worst || a.pSuccess < worst.a.pSuccess) worst = { a, e };
          return `<td><button class="mcell ${heat(a.pSuccess)}" data-a="statPair" data-k="${esc(k)}" aria-current="${pair === k}"><span class="big num">${pct(a.pSuccess)}</span><span class="small">P(${t('éxito')}) · ${t('todas las DC')} ${pct(a.pDC)}</span><span class="small muted">CP ${t('azul')} ${pct(a.meanBlueCP)} · FFIR ${pct(a.pFFIR)}</span></button></td>`; }).join('');
        return `<tr><th scope="row" class="rowh">${esc(c.name)}</th>${cells}<td class="num"><b class="big">${worst ? pct(wS) : '—'}</b><br><span class="small muted">CP ${worst ? pct(wCP) : '—'}</span></td><td class="num"><b class="big">${worst ? pct(worst.a.pSuccess) : '—'}</b><br><span class="small muted">${worst ? t('frente a') + ' ' + esc(worst.e.tag || worst.e.name) : ''}</span></td></tr>`; }).join('') +
      `</tbody></table></div><div class="legend"><span><i class="h-ok"></i>P ≥ 70 %</span><span><i class="h-warn"></i>40–69 %</span><span><i class="h-bad"></i>&lt; 40 %</span></div>`, 'gold');
    const [bId, rId] = pair.split('|'), c = o.coas.find(x => x.id === bId), e = o.ecoas.find(x => x.id === rId), a = A[pair];
    if (!a.hasPlan) return h + card(esc(c.name) + ' — ' + esc(e.name), `<p class="muted">${t('Esta COA no tiene enfrentamientos definidos. Complete su plan en «Planes COA / ECOA».')}</p>`);
    const path = E.runPath(o, c, e, cfg), um = path.umap;
    const engRows = a.turns.map((tid, ti) => { const T = path.turns.find(x => x.t.id === tid); if (!T) return '';
      return T.results.map((r, xi) => { const m = a.engs[ti][xi], pOk = (m.p['DECISIVE SUCCESS'] || 0) + (m.p.SUCCESS || 0);
        return `<tr><td class="num">${esc(T.t.label)}</td><td>${esc(r.x.eng.label)}${r.x.eng.me ? ' <span class="tag info">ME</span>' : ''}<br><span class="small muted">${esc(t(r.calc.taskLabel))}</span></td><td class="num">${r.calc.contact ? E.fmtR(r.calc.rEff) : '—'}</td><td class="num">${E.fmtR(r.calc.req)}</td>
          <td style="min-width:160px">${r.calc.contact ? `<div class="pbar">${C.RESULTS.filter(z => m.p[z] > 0).map(z => `<span class="res-${U.resCls(z)}" style="flex:${m.p[z]}" title="${esc(U.resL(z))} ${pct(m.p[z])}"></span>`).join('')}</div>` : `<span class="muted small">${t('Sin contacto')}</span>`}</td>
          <td class="num">${r.calc.contact ? pct(pOk) : '—'}</td><td class="num">${r.calc.contact ? m.lb.mean.toFixed(0) + ' % <span class="muted small">[' + m.lb.p10.toFixed(0) + '–' + m.lb.p90.toFixed(0) + ']</span>' : '—'}</td><td class="num">${r.calc.contact ? m.lr.mean.toFixed(0) + ' %' : '—'}</td></tr>`; }).join(''); }).join('');
    const labels = path.steps.map((s, i) => i === 0 ? t('Inicio') : s.label);
    const ser = side => (side === 'B' ? a.engagedBlue : a.engagedRed).slice(0, 8).map(id => ({ l: U.uname(um[id]) || id, v: path.steps.map(s => s.str[id]) }));
    const endRows = side => (side === 'B' ? a.engagedBlue : a.engagedRed).map(id => { const u = um[id], x = a.end[id]; return `<tr><td>${C.sym(u, 22)} ${esc(U.uname(u))}</td><td class="num" style="color:${U.statusColor(x.mean)}">${pct(x.mean)}</td><td class="num">${pct(x.p10)} – ${pct(x.p90)}</td>${side === 'B' ? `<td class="num">${pct(a.pUnit[id])}</td>` : ''}</tr>`; }).join('');
    h += card(`${esc(c.name)} <span class="muted">${t('frente a')}</span> ${esc(e.name)}`, `<div class="kpis">
        <div class="kpi"><b>${pct(a.pSuccess)}</b><span>P(${t('éxito de la COA')})</span></div><div class="kpi"><b>${pct(a.pDC)}</b><span>P(${t('todas las DC')})</span></div>
        <div class="kpi"><b class="${a.pFFIR > 0.5 ? 'bad-t' : ''}">${pct(a.pFFIR)}</b><span>P(${t('alguna unidad < FFIR-1')})</span></div><div class="kpi"><b>${pct(a.meanBlueCP)}</b><span>${t('CP final media azul')}</span></div>
        <div class="kpi"><b>${pct(a.meanRedCP)}</b><span>${t('CP final media roja')}</span></div><div class="kpi"><b>${a.score.toFixed(0)}</b><span>${t('Índice compuesto')}</span></div></div>
      <div class="tw"><table class="t ro"><thead><tr><th>${t('Turno')}</th><th>${t('Enfrentamiento')}</th><th class="num">${t('Ratio A:R')}</th><th class="num">${t('Mínimo')}</th><th>${t('Distribución de resultados')}</th><th class="num">P(≥ ${t('éxito')})</th><th class="num">${t('Bajas azules [P10–P90]')}</th><th class="num">${t('Bajas rojas')}</th></tr></thead><tbody>${engRows}</tbody></table></div>
      <div class="legend">${C.RESULTS.map(z => `<span><i class="res-${U.resCls(z)}"></i>${esc(U.resL(z))}</span>`).join('')}</div>
      <div class="g2"><div><h4 class="blue-t">${t('Potencia de combate propia (camino esperado)')}</h4>${lineChart(ser('B'), labels, { refs: [{ v: o.ffir / 100, l: 'FFIR-1', cls: 'warn' }], aria: t('Potencia de combate propia') })}</div><div><h4 class="red-t">${t('Potencia de combate adversaria')}</h4>${lineChart(ser('R'), labels, { aria: t('Potencia de combate adversaria') })}</div></div>
      <div class="g2"><div class="tw"><table class="t ro"><thead><tr><th>${t('Unidad propia')}</th><th class="num">${t('CP final media')}</th><th class="num">P10 – P90</th><th class="num">P(&lt; FFIR)</th></tr></thead><tbody>${endRows('B')}</tbody></table></div>
      <div class="tw"><table class="t ro"><thead><tr><th>${t('Unidad adversaria')}</th><th class="num">${t('CP final media')}</th><th class="num">P10 – P90</th></tr></thead><tbody>${endRows('R')}</tbody></table></div></div>
      <p class="small muted">${t('Índice compuesto')} = ${cfg.score.wSuccess}·P(${t('éxito')}) + ${cfg.score.wCP}·CP + ${cfg.score.wFFIR}·(1 − P FFIR). ${t('Los gráficos muestran el camino esperado (sin incertidumbre), sin decisiones del árbitro; el camino adjudicado está en «Resumen y evaluación».')}</p>`, 'blue');
    return h;
  };
  U.after.stats = wireCharts;

  /* =============================== DATOS Y MÉTODO =============================== */
  U.R.data = function () {
    const c = U.cfg();
    const dmgT = k => { const arr = C.DMG[k]; return `<tr><th scope="row" class="small">${esc(k)}</th>${C.DMG_BP.map((b, i) => `<td><input type="number" class="in num xs" step="0.05" min="0" max="1" data-ch="dmg" data-k="${esc(k)}" data-i="${i * 2}" value="${arr[i * 2]}" aria-label="F ${b}"><input type="number" class="in num xs" step="0.05" min="0" max="1" data-ch="dmg" data-k="${esc(k)}" data-i="${i * 2 + 1}" value="${arr[i * 2 + 1]}" aria-label="E ${b}"></td>`).join('')}</tr>`; };
    let h = secH(t('Datos y método'), t('Todos los parámetros del motor son editables para calibrarlo con los datos de la escuela o del escenario. Afectan a todas las operaciones.'), `<button class="btn" data-a="resetCfg">${t('Restaurar valores por defecto')}</button>`);
    h += card(t('Cómo calcula la herramienta'), `<ol class="method">
      <li><b>${t('Potencia de combate')}</b>: ${t('Σ F.E. del tipo (Force Ratio Calculator Matrix, CGSC ST 100-3) × cantidad × potencia actual × % empeñado. Se compara sector a sector, en el punto de contacto.')}</li>
      <li><b>${t('Modificadores')}</b>: ${t('terreno, obstáculos, fuegos y apoyo aéreo-naval, sorpresa, moral y logística, ISR/C2/GE multiplican la potencia azul. Cuente los fuegos como modificador o añada las unidades de artillería al enfrentamiento, no ambas cosas.')}</li>
      <li><b>${t('Lectura doctrinal')}</b>: ${t('margen = ratio efectivo ÷ ratio mínimo histórico de la tarea (FM 5-0 / FM 6-0). Éxito decisivo ≥ {a} · Éxito ≥ {b} · Parcial ≥ {c} · Neutral ≥ {d} · Fracaso ≥ {e} · Fracaso decisivo por debajo.', { a: c.thresholds.ds, b: c.thresholds.s, c: c.thresholds.ps, d: c.thresholds.n, e: c.thresholds.f })}</li>
      <li><b>${t('Bajas')}</b>: ${t('interpolación logarítmica en la tabla de daños BCTP según la combinación de misiones; romper el contacto a tiempo multiplica las bajas propias por {b}; las bajas rojas se reparten por F.E. con peso ×{h} sobre el HPT.', { b: c.brkFactor, h: c.hptWeight })}</li>
      <li><b>${t('Incertidumbre')}</b>: ${t('Monte Carlo con ruido log-normal sobre el ratio (σ = {s}) y sobre las bajas (σ = {l}); {n} iteraciones encadenando los turnos activos; semilla fija.', { s: c.sim.sigma, l: c.sim.sigmaLoss, n: c.sim.n })}</li>
      <li><b>${t('Regla del árbitro')}</b>: ${t('los ratios dicen lo que es posible, no lo que ocurrirá. La célula blanca puede imponer resultado, bajas y modificadores; el turno siguiente parte del estado adjudicado.')}</li></ol>`, 'gold');
    h += `<div class="g2"><div>` + card(t('Tareas y ratios mínimos de planeamiento'), `<div class="tw"><table class="t"><thead><tr><th>${t('Tarea')}</th><th class="num">${t('Ratio mínimo A:R')}</th><th>${t('Combinación BCTP por defecto')}</th><th>${t('Rompe contacto')}</th></tr></thead><tbody>` +
      Object.keys(c.tasks).map(k => { const x = c.tasks[k]; return `<tr><td>${esc(t(x.label))}</td><td style="width:120px">${fNum('tasks.' + k + '.req', 'step="0.01"', 'cfg')}<span class="small muted">${E.fmtR(x.req)}</span></td><td>${fSel('tasks.' + k + '.pair', Object.keys(C.DMG), 'self', '', 'cfg')}</td><td class="center"><input type="checkbox" data-s="cfg" data-b="tasks.${k}.brk" data-re="self"${x.brk ? ' checked' : ''} aria-label="${t('Rompe contacto')}"></td></tr>`; }).join('') +
      `</tbody></table></div><p class="small muted">${t('Introduzca el ratio como número decimal (1:6 = 0,1667; 3:1 = 3).')}</p>`) + `</div><div>` +
      card(t('Simulación y umbrales'), `<div class="g3 tight">
        ${[['sim.n', 'Iteraciones', 100], ['sim.sigma', 'σ ratio (log)', 0.05], ['sim.sigmaLoss', 'σ bajas (log)', 0.05], ['sim.seed', 'Semilla', 1], ['thresholds.ds', 'Umbral éxito decisivo', 0.05], ['thresholds.s', 'Umbral éxito', 0.05], ['thresholds.ps', 'Umbral éxito parcial', 0.05], ['thresholds.n', 'Umbral neutral', 0.05], ['thresholds.f', 'Umbral fracaso', 0.05], ['brkFactor', 'Factor romper contacto', 0.05], ['hptWeight', 'Peso del HPT', 0.5], ['statusBands.green', 'Banda verde ≥ %', 1], ['statusBands.amber', 'Banda ámbar ≥ %', 1], ['score.wSuccess', 'Peso P(éxito)', 0.05], ['score.wCP', 'Peso CP final', 0.05], ['score.wFFIR', 'Peso 1 − P(FFIR)', 0.05]].map(x => `<div><label class="fl">${t(x[1])}</label>${fNum(x[0], 'step="' + x[2] + '"', 'cfg')}</div>`).join('')}</div>`) + `</div></div>`;
    h += card(t('Modificadores de combate'), `<div class="g3 tight">${Object.keys(c.mods).map(k => { const m = c.mods[k]; return `<div><h4>${esc(t(m.label))}</h4><table class="t"><tbody>${m.opts.map((op_, i) => `<tr><td>${esc(t(op_[0]))}</td><td style="width:90px">${fNum('mods.' + k + '.opts.' + i + '.1', 'step="0.05"', 'cfg')}</td></tr>`).join('')}</tbody></table></div>`; }).join('')}</div>`);
    h += card(t('Tabla de daños BCTP (bajas propias / enemigas por ratio F:E)'), `<div class="tw"><table class="t dmg"><thead><tr><th>${t('Misión propia vs misión enemiga')}</th>${C.DMG_BP.map(b => `<th class="num">${E.fmtR(b)}</th>`).join('')}</tr></thead><tbody>${Object.keys(C.DMG).map(dmgT).join('')}</tbody></table></div><p class="small muted">${t('Cada celda: fracción de bajas propias (arriba) y enemigas (abajo). Fuente: BCTP brief 9/6/95, slide 47 (Force Ratio Calculator Matrix).')}</p>`);
    h += card(t('Referencias'), `<ul class="refs small"><li>AJP-5(A) / COPD — ${t('Análisis de líneas de acción')}. APP-28(B) Tactical Planning for Land Forces, Annex D — War Gaming.</li>
      <li>EUMAM Wargaming Guidance · TRYZUB Wargaming Products · TRYZUB Wargame Example SIRKO.</li>
      <li>CGSC ST 100-3 Battle Book / Force Ratio Calculator Matrix v3.0 — ${t('equivalentes de fuerza y tabla de daños BCTP')}.</li>
      <li>FM 5-0 / FM 6-0 — ${t('ratios mínimos históricos de planeamiento')}.</li><li>US Army CALL «How to Master Wargaming» · UK MoD DCDC «Wargaming Handbook».</li></ul>`);
    return h;
  };

  /* =============================== ASISTENTE =============================== */
  const CTX = {
    inputs: 'Compruebe que la intención superior, los productos de los pasos 1–3 y las estimaciones están actualizados. Toda estimación «no sostenible» debe convertirse en rama o petición al escalón superior.',
    orbat: 'Desglose las unidades hasta compañía. La potencia de combate (%) es el estado inicial y, con el tipo de F.E., alimenta el motor y la calculadora.',
    prep: 'Busque el 100 % de disposición antes del primer turno. Los eventos críticos deben corresponder a las condiciones decisivas de la COA.',
    plans: 'Defina para cada turno los enfrentamientos de la COA y el despliegue enemigo por sector. La vista previa muestra al momento ratio, mínimo y lectura.',
    wargame: 'Acción → reacción → contrarreacción → árbitro. Use «Sugerir» para las reacciones de la COA enemiga, la tirada del motor o los dados para el resultado, y registre DP, CCIR y ramas en cada turno.',
    fr: 'Use fracciones para unidades incompletas (1 batería ≈ 0,33 bón). Compare en el punto de contacto, no brigada contra división.',
    adj: 'Seleccione primero el turno: los resultados se escriben en él. Adecue el tipo de tirada a la ventaja táctica.',
    reg: 'Todo DP necesita un CCIR y una NAI que lo respondan a tiempo. Todo HPT necesita una TAI, un medio y un DP.',
    results: 'Puntúe cada COA frente a los criterios con evidencias de los turnos y marque los productos según se generan.',
    stats: 'Compare la robustez de cada COA frente a todas las COA enemigas: probabilidad ponderada y peor caso (MDCOA).',
    data: 'Calibre los parámetros con la célula de inteligencia antes de usar los resultados en clase.'
  };
  function assistItems() {
    const o = U.op(), it = [], g = W.game(o, null, false) || { turns: {} }, c = U.coa(), e = U.ecoa();
    const dpIds = new Set(o.reg.dp.map(d => d.id)), ccIds = new Set(o.reg.ccir.map(x => x.id));
    U.prepReadiness().items.filter(i => !i[1]).forEach(i => it.push(['warn', 'prep', t('Preparación') + ': ' + i[0] + '.']));
    if (e && e.tag === 'MDCOA') it.push(['info', 'wargame', t('COA enemiga más peligrosa seleccionada: confronte también la más probable y compare en «Análisis estadístico».')]);
    if (c && e) {
      const path = U.pathFor(c, e, g);
      path.turns.forEach(T => { const gt = g.turns[T.t.id] || {};
        if (!gt.res) it.push(['warn', 'wargame', t('{l}: sin adjudicar.', { l: T.t.label })]);
        if (!gt.dp) it.push(['info', 'wargame', t('{l}: sin punto de decisión vinculado.', { l: T.t.label })]); else if (!dpIds.has(gt.dp)) it.push(['bad', 'wargame', t('{l}: {d} ya no existe en el registro de DP.', { l: T.t.label, d: gt.dp })]);
        if (gt.ccir && !ccIds.has(gt.ccir)) it.push(['bad', 'wargame', t('{l}: {d} ya no existe.', { l: T.t.label, d: gt.ccir })]);
        if (!T.results.length) it.push(['info', 'plans', t('{l}: la COA no tiene enfrentamientos en este turno.', { l: T.t.label })]);
        T.warnings.forEach(w => it.push(['warn', 'plans', t('{l}: fuerzas rojas sin oposición en {s}.', { l: T.t.label, s: w.sector })]));
        T.results.forEach(r => { if (r.calc.contact && r.calc.rEff < r.calc.req && r.x.eng.me) it.push(['warn', 'plans', t('{l}: el esfuerzo principal ({e}) no alcanza el ratio mínimo ({r} frente a {m}).', { l: T.t.label, e: r.x.eng.label, r: E.fmtR(r.calc.rEff), m: E.fmtR(r.calc.req) })]); });
        if (T.bcpCalc != null && T.bcpCalc * 100 < o.ffir) it.push(['warn', 'wargame', t('{l}: potencia azul calculada {v} % — FFIR-1.', { l: T.t.label, v: Math.round(T.bcpCalc * 100) })]);
      });
    }
    o.prep.assumptions.filter(a => a.status === 'INVALID').forEach(a => it.push(['bad', 'prep', a.id + ' ' + t('INVÁLIDO') + ' → ' + a.fail]));
    o.inputs.est.filter(x => /^Not/.test(x.status)).forEach(x => it.push(['warn', 'inputs', x.fn + ': ' + x.status + '.']));
    o.reg.ccir.filter(x => x.type === 'PIR' && !x.nai).forEach(x => it.push(['warn', 'reg', t('{i} sin NAI que lo responda.', { i: x.id })]));
    o.reg.dp.filter(d => !d.ccir).forEach(d => it.push(['warn', 'reg', t('{i} sin CCIR vinculado.', { i: d.id })]));
    o.reg.hpt.filter(x => !x.tai).forEach(x => it.push(['info', 'reg', t('{i} sin TAI.', { i: x.id })]));
    o.orbat.filter(u => !u.frT && u.ech === 'battalion' && !o.orbat.some(x => x.p === u.id && x.frT) && ['infantry', 'mech', 'motorized', 'armor', 'amphibious'].includes(u.type)).slice(0, 4).forEach(u => it.push(['info', 'orbat', t('{n}: sin tipo de F.E.; no contará en el cálculo.', { n: u.name })]));
    return it;
  }
  U.renderAssist = function () {
    const a = document.getElementById('assist'); if (!a || !U.store.assist) { if (a) a.innerHTML = ''; return; }
    const items = assistItems(), cur = U.store.sec, pr = U.prepReadiness().pct;
    const o = U.op(), g = W.game(o, null, false) || { turns: {} }, act = E.activeTurns(o), adj = act.filter(x => (g.turns[x.id] || {}).res).length;
    const here = items.filter(i => i[1] === cur), other = items.filter(i => i[1] !== cur), ord = { bad: 0, warn: 1, info: 2, ok: 3 }, srt = x => x.sort((p, q) => ord[p[0]] - ord[q[0]]);
    a.innerHTML = `<div class="ah"><b>✦ ${t('Asistente de confrontación')}</b><div>${t('Comprobaciones doctrinales y sugerencias (reglas, sin conexión)')}</div></div>
      <div class="gauge"><div class="row between small"><b>${t('Preparación')}</b><span>${pr}%</span></div><div class="bar"><i style="width:${pr}%"></i></div>
      <div class="row between small"><b>${t('Turnos adjudicados')}</b><span>${adj}/${act.length}</span></div><div class="bar"><i style="width:${act.length ? adj / act.length * 100 : 0}%;background:var(--blue)"></i></div></div>
      <div class="tip-i info"><b>${t('En esta página')}:</b> ${t(CTX[cur] || '')}</div>
      ${srt(here).slice(0, 12).map(i => `<button class="tip-i ${i[0]}" data-a="go" data-t="${i[1]}">${esc(i[2])}</button>`).join('')}
      ${other.length ? `<div class="grp">${t('En otras páginas')} (${other.length})</div>` + srt(other).slice(0, 14).map(i => `<button class="tip-i ${i[0]}" data-a="go" data-t="${i[1]}">${esc(i[2])}<small>→ ${esc(t((U.NAV.find(n => n.id === i[1]) || {}).l || ''))}</small></button>`).join('') : ''}
      ${!items.length ? `<div class="tip-i ok">${t('Todas las comprobaciones superadas.')}</div>` : ''}`;
  };

  Object.assign(U.A, {
    statPair: d => { U.op().ui.statPair = d.k; U.save(); U.render(); },
    resetCfg: () => U.ask(t('¿Restaurar todos los parámetros del motor a sus valores por defecto?'), () => { U.store.cfg = W.clone(E.DEFAULT_CONFIG); applyDmg(); U.save(true); U.render(); U.toast(t('Valores por defecto restaurados')); }),
    dmg: (d, el) => { const cfg = U.cfg(); cfg.dmg = cfg.dmg || JSON.parse(JSON.stringify(C.DMG)); const v = parseFloat(el.value); if (isNaN(v)) return; cfg.dmg[d.k][+d.i] = v; applyDmg(); U.save(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
