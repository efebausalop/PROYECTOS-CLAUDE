#!/usr/bin/env node
/* ==========================================================================
   Generador de fixtures — v0.4 «MESA»
   --------------------------------------------------------------------------
   node tests/fixtures/make.js
   - tryzub.op.json / marazul.op.json: operaciones construidas con los
     constructores de escenario del árbol de trabajo (W.ensure incluido).
   - golden-v03.json: salidas de E.runPath y E.monteCarlo de v0.3 para cada
     pareja COA × ECOA de TRYZUB y MAR AZUL, calculadas con el código de
     dc851dc (git show dc851dc:js/…; catalog, engine, model, escenarios).
       ops.<op>.pairs['COA-1|ECOA-1'] = {
         game,        // la pareja tiene registro en op.games (se pasa a runPath)
         runPath,     // E.runPath(op, coa, ecoa, cfg, op.games[key])        (= U.pathFor)
         monteCarlo,  // E.monteCarlo(op, coa, ecoa, cfg)                     (= E.analyseAll)
         mcTurn       // { tid: E.monteCarlo(op, coa, ecoa, cfg, { onlyTurn: tid, startStr: T.startStr,
                      //        game, n: min(1000, cfg.sim.n), tag: 'turn' }) }  (= vista de turno)
       }
     cfg = E.DEFAULT_CONFIG de dc851dc (también en golden.cfg). Todo pasa por
     JSON (Infinity/NaN → null, undefined desaparece): compare con
     JSON.parse(JSON.stringify(x)) (ctx.norm en tests/run.js).
   - Copias para el navegador *.fx.js: window.FX = window.FX || {}; FX.tryzubOp = …
     (FX.tryzubOp, FX.marazulOp, FX.goldenV03).
   La salida es determinista (sin marcas de tiempo).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('../run.js');

const OUT = __dirname;
const rel = f => path.relative(R.ROOT, path.join(OUT, f));

function writeJSON(name, obj, pretty) {
  const txt = JSON.stringify(obj, null, pretty ? 1 : 0) + '\n';
  fs.writeFileSync(path.join(OUT, name + '.json'), txt);
  return txt.length;
}
function writeFX(name, key, obj) {
  const txt = '/* Generado por tests/fixtures/make.js — no editar. */\nwindow.FX = window.FX || {};\nFX.' + key + ' = ' + JSON.stringify(obj) + ';\n';
  fs.writeFileSync(path.join(OUT, name + '.fx.js'), txt);
  return txt.length;
}
const kb = n => (n / 1024).toFixed(0) + ' KB';

function main() {
  let bad = 0;
  /* 1. operaciones del árbol de trabajo */
  const cur = R.makeContext({ label: 'work' });
  cur.errors.forEach(e => { console.error('✗ ' + e.file + ': ' + e.error.message); });
  const SC = cur.G.WGScenarios;
  if (!SC || !SC.tryzub || !SC.marazul) { console.error('✗ no se pueden construir los escenarios'); process.exitCode = 1; return; }
  [['tryzub', 'tryzubOp'], ['marazul', 'marazulOp']].forEach(([n, key]) => {
    const op = JSON.parse(JSON.stringify(SC[n].build()));
    const a = writeJSON(n + '.op', op, true), b = writeFX(n + '.op', key, op);
    console.log('✓ ' + rel(n + '.op.json') + ' (' + kb(a) + ') · ' + rel(n + '.op.fx.js') + ' (' + kb(b) + ')');
  });

  /* 2. golden de v0.3 con el código de dc851dc */
  const files = R.ORDER_V03.filter(f => f !== 'js/i18n.js'), src = {};
  files.forEach(f => { src[f] = R.gitShow(R.BASE_REV, f); });
  const miss = files.filter(f => src[f] == null);
  if (miss.length) {
    console.warn('⚠ git show ' + R.BASE_REV + ' no disponible (' + miss.join(', ') + '): golden-v03.json no se regenera');
    return;
  }
  const old = R.makeContext({ files, source: f => src[f], label: R.BASE_REV });
  if (old.errors.length) { old.errors.forEach(e => console.error('✗ ' + R.BASE_REV + ':' + e.file + ': ' + e.error.message)); process.exitCode = 1; return; }
  const E = old.G.WGEngine, W = old.G.WGModel, SC0 = old.G.WGScenarios;
  const cfg = W.clone(E.DEFAULT_CONFIG);
  const golden = {
    v: 1, base: R.BASE_REV,
    note: 'E.runPath / E.monteCarlo de v0.3 (dc851dc) por pareja; ver tests/fixtures/make.js',
    cfg: JSON.parse(JSON.stringify(cfg)), ops: {}
  };
  ['tryzub', 'marazul'].forEach(n => {
    const op = SC0[n].build(), pairs = {};
    op.coas.forEach(c => op.ecoas.forEach(e => {
      const key = c.id + '|' + e.id, game = op.games[key];
      const rp = E.runPath(op, c, e, cfg, game);
      const mc = E.monteCarlo(op, c, e, cfg);
      const mcTurn = {};
      rp.turns.forEach(T => {
        mcTurn[T.t.id] = E.monteCarlo(op, c, e, cfg, { onlyTurn: T.t.id, startStr: T.startStr, game, n: Math.min(1000, cfg.sim.n), tag: 'turn' });
      });
      pairs[key] = JSON.parse(JSON.stringify({ game: !!game, runPath: rp, monteCarlo: mc, mcTurn }));
    }));
    golden.ops[n] = { id: op.id, coas: op.coas.map(c => c.id), ecoas: op.ecoas.map(e => e.id),
      turns: E.activeTurns(op).map(t => t.id), pairs };
  });
  const a = writeJSON('golden-v03', golden, false), b = writeFX('golden-v03', 'goldenV03', golden);
  console.log('✓ ' + rel('golden-v03.json') + ' (' + kb(a) + ') · ' + rel('golden-v03.fx.js') + ' (' + kb(b) + ')');

  /* 3. comprobación: el motor del árbol de trabajo reproduce el golden (sin turn.ls) */
  if (cur.G.WGEngine && cur.G.WGModel) {
    const E1 = cur.G.WGEngine, cfg1 = cur.G.WGModel.clone(E1.DEFAULT_CONFIG);
    ['tryzub', 'marazul'].forEach(n => {
      const op = SC[n].build();
      op.coas.forEach(c => op.ecoas.forEach(e => {
        const key = c.id + '|' + e.id, g = golden.ops[n].pairs[key];
        const same = JSON.stringify(R.norm(E1.runPath(op, c, e, cfg1, op.games[key]))) === JSON.stringify(g.runPath) &&
          JSON.stringify(R.norm(E1.monteCarlo(op, c, e, cfg1))) === JSON.stringify(g.monteCarlo);
        if (!same) { bad++; console.warn('⚠ ' + n + ' ' + key + ': el motor actual difiere de ' + R.BASE_REV); }
      }));
    });
    if (!bad) console.log('✓ el motor actual reproduce el golden de ' + R.BASE_REV);
  }
}

main();
