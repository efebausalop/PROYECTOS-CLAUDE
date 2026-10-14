/* Pruebas de contrato de WGTime (js/time.js) — §4.1, §4.3, §4.4, §8.1. */
'use strict';
module.exports = async (ctx, assert) => {
  ctx.need('WGTime');
  const T = ctx.T;

  /* ---------- §4.1: tabla verificada (cada fila es una prueba) ---------- */
  const win = (s, t0, t1, extra, opts) => ctx.test(`parse «${s}»${opts ? ' ' + JSON.stringify(opts) : ''} → [${t0}, ${t1}]`, () => {
    const p = T.parse(s, opts);
    assert.equal(p.ok, true, 'ok');
    assert.near(p.t0, t0, 1e-9, 't0'); assert.near(p.t1, t1, 1e-9, 't1');
    Object.keys(extra || {}).forEach(k => assert.equal(p[k], extra[k], k));
    assert.deepStrictEqual(p.warn, []);
  });
  win('D-1 → H (≈45 min)', -24, 0, { session: 45, approx: false, style: 'D' });
  win('H-2 → H', -2, 0, { session: null, style: 'H' });
  win('H → H+12', 0, 12);
  win('H+12 → H+24', 12, 24);
  win('H+24 → H+48', 24, 48);
  win('H+48 → H+96', 48, 96);
  win('H+72 → H+96', 72, 96);
  win('H+96 → H+120', 96, 120);
  win('D-1 → H+6', -24, 6);                       // NAI-1
  win('D-1 → H+24', -24, 24);                     // DP-B5
  win('H+6 → H+30', 6, 30);
  win('H+18 → H+30', 18, 30);
  win('H+36 → H+48', 36, 48);
  win('D+1', 24, 48, { day: true, style: 'D' });
  win('D+2', 48, 72, { day: true });
  win('D+1 → D+2', 24, 72, { day: false });       // inclusiva (por defecto)
  win('D+1 → D+2', 24, 72, {}, { dayEnd: 'inclusive' });
  win('D+1 → D+2', 24, 48, {}, { dayEnd: 'boundary' });
  win('≈ H+48', 46, 50, { approx: true, at: 48 }); // DP-B4
  win('NLT H+10', 9, 10, { nlt: true, at: 10 });
  win('D → D+1', 0, 48);
  win('D+2 → D+5', 48, 144);
  win('D+5 →', 120, 144, { open: true });         // plantilla urbana
  win('H+1:30 → H+4', 1.5, 4);
  win('H → H+4', 0, 4);                           // MAR AZUL
  win('H+4 → H+12', 4, 12);
  ['', 'Phase I 45 min'].forEach(s => ctx.test(`parse «${s}» → ok:false`, () => {
    const p = T.parse(s);
    assert.equal(p.ok, false); assert.equal(p.t0, null); assert.equal(p.t1, null);
  }));
  ctx.test('parse(null/undefined) → ok:false', () => { assert.equal(T.parse(null).ok, false); assert.equal(T.parse().ok, false); });

  /* texto libre (§4.1, filas finales) */
  ctx.test('tokens: «BAIDA breaks clean under X1 obscurant NLT H+10.» → una ficha nlt 10', () => {
    const k = T.tokens('BAIDA breaks clean under X1 obscurant NLT H+10.', { free: true });
    assert.equal(k.length, 1); assert.equal(k[0].kind, 'nlt'); assert.near(k[0].t, 10); assert.equal(k[0].day, false);
    assert.equal('BAIDA breaks clean under X1 obscurant NLT H+10.'.substr(k[0].idx, k[0].len), k[0].raw);
    const p = T.parse('BAIDA breaks clean under X1 obscurant NLT H+10.', { free: true });
    assert.equal(p.ok, true); assert.equal(p.nlt, true); assert.near(p.t0, 9); assert.near(p.t1, 10);
  });
  ctx.test('tokens: «la reserva móvil contraataca la playa principal en H+6.» → una ficha 6', () => {
    const k = T.tokens('la reserva móvil contraataca la playa principal en H+6.', { free: true });
    assert.equal(k.length, 1); assert.equal(k[0].kind, 'point'); assert.near(k[0].t, 6); assert.equal(k[0].raw, 'H+6');
  });
  ctx.test('tokens: «EA HETMAN … DC-B2; DP-B1; D30 Bn» → ninguna ficha', () => {
    assert.equal(T.tokens('EA HETMAN … DC-B2; DP-B1; D30 Bn', { free: true }).length, 0);
    assert.equal(T.parse('EA HETMAN … DC-B2; DP-B1; D30 Bn').ok, false);
    assert.equal(T.parse('EA HETMAN … DC-B2; DP-B1; D30 Bn', { free: true }).ok, false);
  });
  ctx.test('tokens: «durante 2 h (≈3 h serial)» → ninguna ficha', () => {
    assert.equal(T.tokens('durante 2 h (≈3 h serial)', { free: true }).length, 0);
    assert.equal(T.parse('durante 2 h (≈3 h serial)').ok, false);
  });
  ctx.test('tokens: letras D/H distinguen mayúsculas y rechazan palabras (Hill, HQ, BHL DIV)', () => {
    assert.equal(T.tokens('Hill 247 · HQ · BHL DIV · h+2 · d+1', { free: false }).length, 0);
    assert.equal(T.tokens('KOZHUMIAKA disengages D+1 and NET H+66').length, 2);
  });
  ctx.test('tokens: modo libre rechaza H/D sueltas sin prefijo; las acepta con NLT/NET/≈', () => {
    assert.equal(T.tokens('H and D only', { free: true }).length, 0);
    assert.equal(T.tokens('H and D only', { free: false }).length, 2);
    const k = T.tokens('fires NET H, report ≈ H+3', { free: true });
    assert.deepStrictEqual(k.map(x => [x.kind, x.t]), [['net', 0], ['approx', 3]]);
  });
  ctx.test('tokens: días y unidades (D+2 → inicio del día; H+90 min; H+1d; coma decimal)', () => {
    const k = T.tokens('D+2 · H+90 min · H+1d · H+1,5', { free: true });
    assert.deepStrictEqual(k.map(x => x.t), [48, 1.5, 24, 1.5]);
    assert.equal(k[0].day, true);
    assert.near(T.tokens('D+1', { hHour: 6 })[0].t, 18);
  });

  /* otros detalles de parse */
  ctx.test('parse: extremos invertidos se intercambian con aviso «inv»', () => {
    const p = T.parse('H+12 → H+4');
    assert.near(p.t0, 4); assert.near(p.t1, 12); assert.deepStrictEqual(p.warn, ['inv']);
  });
  ctx.test('parse: punto (H+6, H+6 → H+6) = ±.5 h; NET; ≈ en ventanas', () => {
    const a = T.parse('H+6'); assert.equal(a.point, true); assert.near(a.t0, 5.5); assert.near(a.t1, 6.5); assert.near(a.at, 6);
    const b = T.parse('H+6 → H+6'); assert.equal(b.point, true); assert.near(b.t0, 5.5); assert.near(b.t1, 6.5);
    const c = T.parse('NET H+2'); assert.equal(c.net, true); assert.near(c.t0, 2); assert.near(c.t1, 3);
    const d = T.parse('≈ H+46 → H+52'); assert.equal(d.approx, true); assert.near(d.t0, 46); assert.near(d.t1, 52);
    const e = T.parse('H−2 → H+1:15'); assert.near(e.t0, -2); assert.near(e.t1, 1.25);
  });
  ctx.test('parse: hHour desplaza los días (D±n empieza en 24n − hHour)', () => {
    const p = T.parse('D+1', { hHour: 6 }); assert.near(p.t0, 18); assert.near(p.t1, 42);
    const q = T.parse('D-1 → H', { hHour: 6 }); assert.near(q.t0, -30); assert.near(q.t1, 0);
    assert.near(T.dayStart(1, 6), 18); assert.near(T.dayEnd(1, 6), 42);
  });
  ctx.test('parse: sesión en horas «(1,5 h)» = 90 min y no altera la ventana', () => {
    const p = T.parse('H → H+12 (1,5 h)'); assert.equal(p.session, 90); assert.near(p.t1, 12); assert.equal(p.approx, false);
  });
  ctx.test('parse: acepta op.time como opciones', () => {
    const p = T.parse('D+1 → D+2', { dayEnd: 'boundary', hHour: 0, scale: 'auto', stepFrac: null, hPerSec: 4, naiLead: 2 });
    assert.near(p.t1, 48);
  });

  /* ---------- formato ---------- */
  ctx.test('fmt: ejemplos de §4.1', () => {
    assert.equal(T.fmt(0), 'H');
    assert.equal(T.fmt(12), 'H+12');
    assert.equal(T.fmt(-2), 'H-2');
    assert.equal(T.fmt(7.5), 'H+7:30');
    assert.equal(T.fmt(1.2000000000000002), 'H+1:12');
    assert.equal(T.fmt(0, { style: 'D' }), 'D');
    assert.equal(T.fmt(-24, { style: 'D' }), 'D-1');
    assert.equal(T.fmt(48, { style: 'D' }), 'D+2');
    assert.equal(T.fmt(12, { style: 'D' }), 'H+12');
    assert.equal(T.fmt(18, { style: 'D', hHour: 6 }), 'D+1');
    assert.equal(T.fmt(8, { pad: true }), 'H+08');
    assert.equal(T.fmt(4.8, { pad: true }), 'H+04:48');
    assert.equal(T.fmt(null), '');
  });
  ctx.test('fmtSpan: ejemplos de §4.1', () => {
    assert.equal(T.fmtSpan(12, 24), 'H+12 → H+24');
    assert.equal(T.fmtSpan(-24, 0, 'D-1 → H (≈45 min)'), 'D-1 → H (≈45 min)');
    assert.equal(T.fmtSpan(24, 72, 'D+1 → D+2'), 'D+1 → D+2');
    assert.equal(T.fmtSpan(24, 48, 'D+1 → D+2', { dayEnd: 'boundary' }), 'D+1 → D+2');
  });
  ctx.test('fmtSpan: conserva sufijo de sesión y estilo, y vuelve a analizarse igual', () => {
    assert.equal(T.fmtSpan(-24, 6, 'D-1 → H (≈45 min)'), 'D-1 → H+6 (≈45 min)');
    assert.equal(T.fmtSpan(-20, 0, 'D-1 → H'), 'H-20 → H');
    assert.equal(T.fmtSpan(46, 50, '≈ H+48'), '≈ H+48');
    assert.equal(T.fmtSpan(9, 10, 'NLT H+10'), 'NLT H+10');
    assert.equal(T.fmtSpan(24, 48, 'D+1'), 'D+1');
    assert.equal(T.fmtSpan(120, 144, 'D+5 →'), 'D+5 →');
    assert.equal(T.fmtSpan(5.5, 6.5, 'H+6'), 'H+6');
    assert.equal(T.fmtSpan(1.5, 4), 'H+1:30 → H+4');
    const cases = [[-24, 0, 'D-1 → H (≈45 min)'], [24, 72, 'D+1 → D+2'], [0, 48, 'D → D+1'], [48, 144, 'D+2 → D+5'], [120, 144, 'D+5 →'],
      [46, 50, '≈ H+48'], [9, 10, 'NLT H+10'], [7.5, 30, 'H+6 → H+30'], [-2, 0, 'H-2 → H']];
    cases.forEach(([a, b, o]) => {
      const s = T.fmtSpan(a, b, o), p = T.parse(s);
      assert.near(p.t0, a, 1e-6, s); assert.near(p.t1, b, 1e-6, s);
      assert.equal(p.session, T.parse(o).session, s);
    });
  });

  /* ---------- intervalos ---------- */
  ctx.test('overlap / iou', () => {
    assert.equal(T.overlap(-24, 0, -2, 0), 2);
    assert.equal(T.overlap(0, 12, 12, 24), 0);
    assert.near(T.iou(0, 12, 6, 18), 6 / 18);
    assert.equal(T.iou(0, 12, 20, 30), 0);
    assert.equal(T.iou(48, 72, 48, 72), 1);
  });

  /* ---------- §4.3 escala ---------- */
  const TZ = { range: { t0: -24, t1: 120 }, breaks: [-24, -2, 0, 12, 24, 48, 72, 96, 120] };
  ctx.test('scale TRYZUB auto → adaptativa; H-2 → H 4,33 % ± .1; H+24 → H+48 15,0 % ± .1', () => {
    const s = T.scale(TZ.range, 'auto', TZ.breaks);
    assert.equal(s.mode, 'adaptive');
    assert.near((s.x(0) - s.x(-2)) * 100, 4.33, 0.1);
    assert.near((s.x(48) - s.x(24)) * 100, 15.0, 0.1);
    assert.near(s.x(-24), 0); assert.near(s.x(120), 1);
  });
  ctx.test('scale lineal: H-2 → H 1,4 %; H+24 → H+48 16,7 %; t(x) inversa', () => {
    const s = T.scale([-24, 120], 'linear', TZ.breaks);
    assert.equal(s.mode, 'linear');
    assert.near((s.x(0) - s.x(-2)) * 100, 1.39, 0.01);
    assert.near((s.x(48) - s.x(24)) * 100, 16.67, 0.01);
    [-24, -7, 0, 33.3, 120].forEach(t => assert.near(s.t(s.x(t)), t, 1e-9));
  });
  ctx.test('scale adaptativa: monótona e invertible; extrapola fuera del rango', () => {
    const s = T.scale(TZ.range, 'adaptive', TZ.breaks);
    let prev = -Infinity;
    for (let t = -24; t <= 120; t += 0.5) { const x = s.x(t); assert.ok(x > prev); prev = x; assert.near(s.t(x), t, 1e-9); }
    assert.ok(s.x(-30) < 0 && s.x(130) > 1);
  });
  ctx.test('scale auto MAR AZUL (H → H+4 → H+12 → H+24) → lineal', () => {
    assert.equal(T.scale({ t0: 0, t1: 24 }, 'auto', [0, 4, 12, 24]).mode, 'linear');
  });
  ctx.test('scale por fases: igual anchura por fase, huecos del 4 %', () => {
    const s = T.scale([0, 30], 'phase', [], { phases: [[0, 4], [4, 12], [14, 30]] });
    assert.equal(s.mode, 'phase');
    const w = 0.96 / 3;
    assert.near(s.x(4) - s.x(0), w, 1e-9); assert.near(s.x(12) - s.x(4), w, 1e-9);
    assert.near(s.x(14) - s.x(12), 0.04, 1e-9); assert.near(s.x(30) - s.x(14), w, 1e-9);
    assert.near(s.x(2), w / 2, 1e-9);
  });
  ctx.test('scale ticks: mayores en H y en los límites de día; menores ≥ 48 px', () => {
    const s = T.scale(TZ.range, 'auto', TZ.breaks), W = 1200, tk = s.ticks(W / 144);
    const maj = tk.filter(k => k.major).map(k => k.label);
    assert.deepStrictEqual(maj, ['D-1', 'H', 'D+1', 'D+2', 'D+3', 'D+4', 'D+5']);
    const lab = tk.map(k => k.x * W);
    for (let i = 1; i < tk.length; i++) assert.ok(tk[i].t > tk[i - 1].t);
    tk.filter(k => !k.major).forEach(k => { assert.equal(k.label, T.fmt(k.t)); assert.ok(Number.isInteger(k.t)); });
    // cada etiqueta menor queda a ≥ 48 px de cualquier otra etiqueta
    tk.forEach((k, i) => { if (!k.major) tk.forEach((o, j) => { if (i !== j) assert.ok(Math.abs(lab[i] - lab[j]) >= 48 - 1e-6, k.label + ' / ' + o.label); }); });
    assert.ok(lab.every(x => x >= -1e-6 && x <= W + 1e-6));
    assert.ok(tk.length > maj.length, 'hay marcas menores');
    // con una regla ancha el tramo H-2 → H (ensanchado por la escala √) recibe marcas horarias
    assert.ok(s.ticks(2400 / 144).some(k => k.t === -1 || k.t === -2), 'marcas en H-2 → H');
  });

  /* ---------- §4.4 pasos ---------- */
  const span = (w, st, id) => T.stepWindow(w, st, id).map(x => T.fmt(x)).join(' → ');
  ctx.test('steps rojo: TRYZUB BELT 1 «H → H+12»', () => {
    const st = T.steps('red');
    assert.deepStrictEqual(st.map(s => s.id), ['pre', 'act', 'rea', 'cnt', 'arb']);
    assert.deepStrictEqual(st.map(s => [s.f0, s.f1]), [[0, 0.1], [0.1, 0.4], [0.4, 0.7], [0.7, 0.95], [0.95, 1]]);
    const w = T.parse('H → H+12');
    assert.equal(span(w, st, 'pre'), 'H → H+1:12');
    assert.equal(span(w, st, 'act'), 'H+1:12 → H+4:48');
    assert.equal(span(w, st, 'rea'), 'H+4:48 → H+8:24');
    assert.equal(span(w, st, 'cnt'), 'H+8:24 → H+11:24');
    assert.equal(span(w, st, 'arb'), 'H+11:24 → H+12');
    assert.equal(st[2].label, 'Reacción roja');
  });
  ctx.test('steps azul: MAR AZUL BOX A «H → H+4» (sin pre)', () => {
    const st = T.steps('blue');
    assert.deepStrictEqual(st.map(s => s.id), ['act', 'rea', 'cnt', 'arb']);
    const w = [0, 4];
    assert.equal(span(w, st, 'act'), 'H → H+1:24');
    assert.equal(span(w, st, 'rea'), 'H+1:24 → H+2:36');
    assert.equal(span(w, st, 'cnt'), 'H+2:36 → H+3:48');
    assert.equal(span(w, st, 'arb'), 'H+3:48 → H+4');
    assert.equal(T.stepWindow(w, st, 'pre'), null);
  });
  ctx.test('stepAt: f0 ≤ f < f1; τ = t1 → arb; fuera → null', () => {
    const st = T.steps('red'), w = { t0: 0, t1: 12 };
    assert.equal(T.stepAt(w, st, 0), 'pre');
    assert.equal(T.stepAt(w, st, 1.2 + 1e-6), 'act');
    assert.equal(T.stepAt(w, st, 8), 'rea');
    assert.equal(T.stepAt(w, st, 8.4 + 1e-6), 'cnt');
    assert.equal(T.stepAt(w, st, 11.5), 'arb');
    assert.equal(T.stepAt(w, st, 12), 'arb');
    assert.equal(T.stepAt(w, st, 12.5), null);
    assert.equal(T.stepAt(w, st, -0.1), null);
    // clic en un paso: τ = inicio + 1e-6 cae en ese paso
    st.forEach(s => assert.equal(T.stepAt(w, st, T.stepWindow(w, st, s.id)[0] + 1e-6), s.id));
  });
  ctx.test('steps: precedencia de frac (turn.stepFrac › op.time.stepFrac › defecto) y spans', () => {
    const fr = { pre: [0, 0.2], act: [0.2, 0.5], rea: [0.5, 0.7], cnt: [0.7, 0.9], arb: [0.9, 1] };
    const st = T.steps('red', fr);
    assert.deepStrictEqual(st.map(s => s.f1), [0.2, 0.5, 0.7, 0.9, 1]);
    assert.deepStrictEqual(T.steps('red', null).map(s => s.f1), [0.1, 0.4, 0.7, 0.95, 1]);
    assert.deepStrictEqual(T.steps('red', { act: [0, 2] }).map(s => s.f1), [0.1, 0.4, 0.7, 0.95, 1], 'frac no válida → defecto');
    const sp = T.spans([0, 10], st);
    assert.near(sp[1].t0, 2); assert.near(sp[1].t1, 5); assert.equal(sp[1].id, 'act');
    assert.deepStrictEqual(T.steps('blue', fr).map(s => [s.id, s.f0, s.f1]), [['act', 0, 0.5], ['rea', 0.5, 0.7], ['cnt', 0.7, 0.9], ['arb', 0.9, 1]]);
  });

  /* ---------- presupuesto de sesión ---------- */
  ctx.test('sessionBudget TRYZUB = 180 min', () => {
    const b = T.sessionBudget('Phase I 45 min · Belts 60 min · Avenue 60 min (≈3 h serial)');
    assert.equal(b.total, 180);
    assert.deepStrictEqual(b.byMethod, { critical: 45, belt: 60, box: 0, avenue: 60 });
    assert.equal(T.sessionBudget('').total, 0);
    assert.equal(T.sessionBudget('Fajas 1,5 h; Caja 30 min').total, 120);
  });
};
