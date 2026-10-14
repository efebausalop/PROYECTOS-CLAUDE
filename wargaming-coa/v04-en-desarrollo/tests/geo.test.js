/* Pruebas de contrato de WGGeo (js/geo.js) — §6.4, §8.1. */
'use strict';
module.exports = async (ctx, assert) => {
  ctx.need('WGGeo');
  const G = ctx.Geo;
  const sq = G.rect(0.2, 0.2, 0.6, 0.6);

  ctx.test('hash FNV-1a: uint32 estable entre ejecuciones y contextos', () => {
    assert.equal(G.hash(''), 2166136261);
    assert.equal(G.hash('a'), 0xe40c292c);
    assert.equal(G.hash('op-tryzub'), G.hash('op-tryzub'));
    const other = ctx.fresh().G.WGGeo;
    ['op-tryzub', 'op-marazul', 'PL 4', 'EA "HETMAN"', 'Línea de cabeza de playa'].forEach(s => {
      const h = G.hash(s);
      assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff, s);
      assert.equal(other.hash(s), h, s);
    });
    assert.notEqual(G.hash('op-tryzub'), G.hash('op-marazul'));
  });
  ctx.test('rng mulberry32: determinista, en [0,1), semilla numérica o texto', () => {
    const a = G.rng(42), b = G.rng(42), c = G.rng('op-tryzub'), d = G.rng(G.hash('op-tryzub'));
    for (let i = 0; i < 200; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); assert.equal(c(), d()); }
    assert.notEqual(G.rng(1)(), G.rng(2)());
    // misma secuencia que el generador del motor (WGEngine.mulberry32)
    if (ctx.E && ctx.E.mulberry32) { const e = ctx.E.mulberry32(7), g = G.rng(7); for (let i = 0; i < 20; i++) assert.equal(g(), e()); }
  });
  ctx.test('lerp / clamp / smooth / dist / round', () => {
    assert.equal(G.lerp(2, 4, 0.25), 2.5);
    assert.deepStrictEqual(G.lerp([0, 0], [1, 2], 0.5), [0.5, 1]);
    assert.equal(G.clamp(1.4), 1); assert.equal(G.clamp(-1, 0.02, 0.95), 0.02); assert.equal(G.clamp(0.5, 0, 1), 0.5);
    assert.equal(G.smooth(0), 0); assert.equal(G.smooth(1), 1); assert.equal(G.smooth(0.5), 0.5); assert.near(G.smooth(0.25), 0.15625);
    assert.equal(G.dist([0, 0], [3, 4]), 5);
    assert.equal(G.round(0.123456, 2), 0.12);
  });
  ctx.test('bbox / centroid / area', () => {
    assert.deepStrictEqual(G.bbox([[0.3, 0.1], [0.9, 0.5], [0.5, 0.7]]), [0.3, 0.1, 0.9, 0.7]);
    assert.equal(G.bbox([]), null);
    assert.deepNear(G.centroid(sq), [0.4, 0.4], 1e-12);
    assert.deepNear(G.centroid([[0, 0], [1, 1]]), [0.5, 0.5], 1e-12);
    assert.near(Math.abs(G.area(sq)), 0.16, 1e-12);
  });
  ctx.test('pip: dentro, fuera, cóncavo', () => {
    assert.equal(G.pip([0.4, 0.4], sq), true);
    assert.equal(G.pip([0.7, 0.4], sq), false);
    const L = [[0, 0], [1, 0], [1, 0.4], [0.4, 0.4], [0.4, 1], [0, 1]];
    assert.equal(G.pip([0.2, 0.8], L), true);
    assert.equal(G.pip([0.7, 0.7], L), false);
  });
  ctx.test('hull: envolvente convexa sin puntos interiores', () => {
    const h = G.hull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5], [0.2, 0.7], [1, 0.5]]);
    assert.equal(h.length, 4);
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(p => assert.ok(h.some(q => q[0] === p[0] && q[1] === p[1]), JSON.stringify(p)));
    assert.equal(G.hull([[0, 0], [1, 1]]).length, 2);
  });
  ctx.test('buffer: polígono crece r por cada lado; polilínea = banda con extremos', () => {
    const b = G.buffer(sq, 0.02, true), bb = G.bbox(b);
    assert.deepNear(bb, [0.18, 0.18, 0.62, 0.62], 1e-9);
    sq.forEach(p => assert.ok(G.pip(p, b)));
    assert.ok(!G.pip([0.65, 0.4], b));
    // orientación contraria → mismo resultado
    assert.deepNear(G.bbox(G.buffer(sq.slice().reverse(), 0.02, true)), [0.18, 0.18, 0.62, 0.62], 1e-9);
    const s = G.buffer([[0.1, 0.5], [0.9, 0.5]], 0.05, false), sb = G.bbox(s);
    assert.near(sb[0], 0.05, 1e-9); assert.near(sb[2], 0.95, 1e-9); assert.near(sb[1], 0.45, 1e-9); assert.near(sb[3], 0.55, 1e-9);
    assert.ok(G.pip([0.5, 0.5], s) && G.pip([0.08, 0.5], s) && !G.pip([0.5, 0.6], s));
    const c = G.buffer([[0.5, 0.5]], 0.04);
    assert.equal(c.length, 12); c.forEach(p => assert.near(G.dist(p, [0.5, 0.5]), 0.04, 1e-12));
  });
  ctx.test('rect / circle', () => {
    assert.deepStrictEqual(G.rect(0, 0, 1, 2), [[0, 0], [1, 0], [1, 2], [0, 2]]);
    assert.equal(G.circle([0, 0], 1).length, 12);
    assert.equal(G.circle([0, 0], 1, 8).length, 8);
  });
  ctx.test('polyLen / pointAt (fracción) / project', () => {
    const pl = [[0, 0], [0.3, 0], [0.3, 0.4]];
    assert.near(G.polyLen(pl), 0.7, 1e-12);
    assert.deepNear(G.pointAt(pl, 0), [0, 0], 1e-12);
    assert.deepNear(G.pointAt(pl, 0.5), [0.3, 0.05], 1e-12);
    assert.deepNear(G.pointAt(pl, 1), [0.3, 0.4], 1e-12);
    const pr = G.project(pl, [0.5, 0.2]);
    assert.deepNear(pr.pt, [0.3, 0.2], 1e-12); assert.near(pr.d, 0.2, 1e-12); assert.near(pr.s, 0.5 / 0.7, 1e-12); assert.equal(pr.i, 1);
  });
  ctx.test('nearest: puntos y objetos, con distancia máxima', () => {
    const list = [[0.1, 0.1], { u: 0.5, v: 0.5 }, { pts: G.rect(0.8, 0.8, 0.9, 0.9) }];
    const n = G.nearest([0.52, 0.5], list);
    assert.equal(n.i, 1); assert.near(n.d, 0.02, 1e-12);
    assert.equal(G.nearest([0.85, 0.85], list).i, 2);
    assert.equal(G.nearest([0.3, 0.3], list, 0.05), null);
  });
  ctx.test('segHitsPoly / polysTouch / distToPoly / segInt', () => {
    assert.equal(G.segHitsPoly([0, 0.4], [1, 0.4], sq), true);
    assert.equal(G.segHitsPoly([0, 0.1], [1, 0.1], sq), false);
    assert.equal(G.segHitsPoly([0.3, 0.3], [0.5, 0.5], sq), true, 'segmento interior');
    assert.equal(G.polysTouch(sq, G.rect(0.5, 0.5, 0.9, 0.9)), true);
    assert.equal(G.polysTouch(sq, G.rect(0.3, 0.3, 0.4, 0.4)), true, 'contenido');
    assert.equal(G.polysTouch(sq, G.rect(0.7, 0.7, 0.9, 0.9)), false);
    assert.equal(G.distToPoly([0.4, 0.4], sq), 0);
    assert.near(G.distToPoly([0.7, 0.4], sq), 0.1, 1e-12);
    assert.deepNear(G.segInt([0, 0], [1, 1], [0, 1], [1, 0]), [0.5, 0.5], 1e-12);
    assert.equal(G.segInt([0, 0], [1, 0], [0, 1], [1, 1]), null);
  });
  ctx.test('wavy / blob: sembrados y deterministas', () => {
    const w = G.wavy([0, 0.5], [1, 0.5], 7, 0.008, 12);
    assert.equal(w.length, 13);
    assert.deepStrictEqual(w[0], [0, 0.5]); assert.deepStrictEqual(w[12], [1, 0.5]);
    assert.ok(w.every(p => Math.abs(p[1] - 0.5) <= 0.008 + 1e-12));
    assert.deepStrictEqual(w, G.wavy([0, 0.5], [1, 0.5], 7, 0.008, 12));
    assert.notDeepStrictEqual(w, G.wavy([0, 0.5], [1, 0.5], 8, 0.008, 12));
    const b = G.blob([0.5, 0.5], 0.1, 0.05, 'EA1', 10);
    assert.equal(b.length, 10);
    b.forEach(p => { const r = Math.hypot((p[0] - 0.5) / 0.1, (p[1] - 0.5) / 0.05); assert.ok(r >= 0.82 - 1e-9 && r <= 1.18 + 1e-9); });
    assert.ok(G.pip([0.5, 0.5], b));
    assert.deepStrictEqual(b, G.blob([0.5, 0.5], 0.1, 0.05, 'EA1', 10));
  });
  ctx.test('pathD: recta, cerrada, suavizada y escalada', () => {
    assert.equal(G.pathD([[0, 0], [0.5, 0.25]], false, false), 'M0 0L0.5 0.25');
    assert.equal(G.pathD([[0, 0], [1, 0], [1, 1]], true, false, { sx: 1000, sy: 700 }), 'M0 0L1000 0L1000 700Z');
    const d = G.pathD([[0, 0], [0.5, 0.2], [1, 0]], false, true, { sx: 1000 });
    assert.ok(/^M0 0C/.test(d) && (d.match(/C/g) || []).length === 2 && /1000 0$/.test(d), d);
    assert.equal((G.pathD(sq, true, true).match(/C/g) || []).length, 4);
    assert.equal(G.pathD([], false), '');
  });
  ctx.test('gridRef(.75,.73) === «H6»; esquinas A1 / J7', () => {
    assert.equal(G.gridRef(0.75, 0.73), 'H6');
    assert.equal(G.gridRef(0, 0), 'A1');
    assert.equal(G.gridRef(1, 1), 'J7');
    assert.equal(G.gridRef(0.999, 0.999, 10, 7), 'J7');
  });
};
