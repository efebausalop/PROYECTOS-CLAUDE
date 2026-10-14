#!/usr/bin/env node
/* ==========================================================================
   Banco de pruebas de contrato (node, sin dependencias) — v0.4 «MESA»
   --------------------------------------------------------------------------
   node tests/run.js [patrón] [-g subpatrón] [-v] [--dir carpeta]
   - Carga los módulos puros en el orden de index.html (§6.2) dentro de un
     contexto vm con un «window» simulado: i18n, catalog, engine, time, geo,
     model, escenarios, templates y —si existen— layout, scene, bound.
   - Ejecuta cada tests/*.test.js (module.exports = async (ctx, assert) => {})
     en un contexto nuevo. patrón filtra por nombre de fichero (subcadena o
     expresión regular); -g filtra las subpruebas ctx.test(nombre, fn).
   - Sale con código ≠ 0 si falla alguna prueba o si un módulo existente no
     carga. Los módulos que aún no existen no son un fallo: ctx.need('WGLayout')
     omite la prueba.
   También se usa como biblioteca (tests/fixtures/make.js): makeContext, ORDER.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeAssert = require('assert');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE_REV = 'dc851dc';

/* Orden de carga de index.html (§6.2), sólo módulos puros y datos. */
const ORDER = [
  'js/i18n.js', 'js/catalog.js', 'js/engine.js', 'js/time.js', 'js/geo.js', 'js/model.js',
  'js/scenarios/tryzub-v2seed.js', 'js/scenarios/tryzub.js', 'js/scenarios/marazul.js', 'js/templates.js',
  'js/layout.js', 'js/scene.js', 'js/bound.js'
];
/* Ficheros de v0.3 (dc851dc) para el contexto de referencia ctx.v03(). */
const ORDER_V03 = ['js/catalog.js', 'js/engine.js', 'js/model.js', 'js/scenarios/tryzub-v2seed.js', 'js/scenarios/tryzub.js',
  'js/scenarios/marazul.js', 'js/templates.js', 'js/i18n.js'];
const GLOBALS = { T: 'WGTime', Geo: 'WGGeo', E: 'WGEngine', W: 'WGModel', SC: 'WGScenarios', Cat: 'WGCat', Tpl: 'WGTemplates',
  L: 'WGLayout', S: 'WGScene', B: 'WGBound', I18N: 'WGI18N' };

/* ------------------------------ git (sólo lectura) ------------------------------ */
let gitPrefix = null;
function gitShow(rev, rel) {
  try {
    if (gitPrefix == null) gitPrefix = cp.execFileSync('git', ['rev-parse', '--show-prefix'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return cp.execFileSync('git', ['show', rev + ':' + gitPrefix + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

/* ------------------------------ contexto vm ------------------------------ */
/* opts: { files: [rel], source: rel → string|null (por defecto, disco), label } */
function makeContext(opts) {
  opts = opts || {};
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate, queueMicrotask,
    structuredClone, TextEncoder, TextDecoder, URL, performance,
    navigator: { language: 'es', userAgent: 'node' }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext('var window = globalThis; var self = globalThis;', context);
  const G = vm.runInContext('globalThis', context);
  const loaded = [], missing = [], errors = [];
  const source = opts.source || (rel => { const f = path.join(ROOT, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; });
  function load(rel) {
    const src = source(rel);
    if (src == null) { missing.push(rel); return null; }
    try { vm.runInContext(src, context, { filename: (opts.label ? opts.label + ':' : '') + rel }); loaded.push(rel); return null; }
    catch (e) { errors.push({ file: rel, error: e }); return e; }
  }
  (opts.files || ORDER).forEach(load);
  return { context, G, loaded, missing, errors, load };
}

/* ------------------------------ aserciones ------------------------------ */
/* Copia profunda al reino principal: deepStrictEqual compara prototipos y los
   objetos creados dentro del contexto vm tienen otro Object.prototype. */
function local(x, seen) {
  if (x === null || typeof x !== 'object') return x;
  seen = seen || new Map();
  if (seen.has(x)) return seen.get(x);
  const tag = Object.prototype.toString.call(x);
  if (Array.isArray(x)) { const a = []; seen.set(x, a); for (let i = 0; i < x.length; i++) a[i] = local(x[i], seen); return a; }
  if (tag === '[object Map]') { const m = new Map(); seen.set(x, m); x.forEach((v, k) => m.set(local(k, seen), local(v, seen))); return m; }
  if (tag === '[object Set]') { const s = new Set(); seen.set(x, s); x.forEach(v => s.add(local(v, seen))); return s; }
  if (tag === '[object Date]') return new Date(x.getTime());
  const o = {}; seen.set(x, o);
  Object.keys(x).forEach(k => { o[k] = local(x[k], seen); });
  return o;
}
const norm = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
function fmtV(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
function near(a, b, tol) { return Math.abs(+a - +b) <= (tol == null ? 1e-9 : tol); }

function makeAssert() {
  const A = function (v, msg) { return nodeAssert.ok(v, msg); };
  Object.keys(nodeAssert.strict).forEach(k => { if (typeof nodeAssert.strict[k] === 'function') A[k] = nodeAssert.strict[k]; });
  ['deepEqual', 'deepStrictEqual'].forEach(k => { A[k] = (a, b, m) => nodeAssert.deepStrictEqual(local(a), local(b), m); });
  ['notDeepEqual', 'notDeepStrictEqual'].forEach(k => { A[k] = (a, b, m) => nodeAssert.notDeepStrictEqual(local(a), local(b), m); });
  /* |a − b| ≤ tol */
  A.near = (a, b, tol, msg) => {
    if (!(typeof a === 'number' && near(a, b, tol))) throw new nodeAssert.AssertionError({ message: (msg ? msg + ': ' : '') + `expected ${fmtV(a)} ≈ ${fmtV(b)} (± ${tol == null ? 1e-9 : tol})`, actual: a, expected: b, operator: 'near' });
  };
  /* arrays/objetos numéricos componente a componente */
  A.deepNear = (a, b, tol, msg) => {
    const walk = (x, y, p) => {
      if (typeof y === 'number') { if (!(typeof x === 'number' && near(x, y, tol))) throw new nodeAssert.AssertionError({ message: (msg ? msg + ': ' : '') + `at ${p || '·'} expected ${fmtV(x)} ≈ ${fmtV(y)} (± ${tol == null ? 1e-9 : tol})`, actual: a, expected: b, operator: 'deepNear' }); return; }
      if (y && typeof y === 'object') {
        if (!x || typeof x !== 'object') throw new nodeAssert.AssertionError({ message: (msg ? msg + ': ' : '') + `at ${p || '·'} expected an object/array, got ${fmtV(x)}`, actual: a, expected: b, operator: 'deepNear' });
        Object.keys(y).forEach(k => walk(x[k], y[k], p + '.' + k));
        if (Array.isArray(y) && x.length !== y.length) throw new nodeAssert.AssertionError({ message: (msg ? msg + ': ' : '') + `at ${p || '·'} length ${x.length} ≠ ${y.length}`, actual: a, expected: b, operator: 'deepNear' });
        return;
      }
      nodeAssert.strictEqual(x, y, (msg ? msg + ': ' : '') + 'at ' + (p || '·'));
    };
    walk(local(a), local(b), '');
  };
  return A;
}

class Skip extends Error { constructor(m) { super(m); this.skip = true; } }

/* ------------------------------ contexto de prueba ------------------------------ */
/* contexto nuevo con el código de dc851dc (las fuentes de git se leen una vez por proceso) */
let v03src = null;
function v03Context() {
  if (!v03src) { v03src = {}; ORDER_V03.forEach(rel => { v03src[rel] = gitShow(BASE_REV, rel); }); }
  if (ORDER_V03.some(rel => v03src[rel] == null && rel !== 'js/i18n.js')) return null;
  return makeContext({ files: ORDER_V03, source: rel => v03src[rel], label: BASE_REV });
}

function makeCtx(file, opt, state) {
  const C = makeContext();
  const ctx = {
    root: ROOT, file, base: BASE_REV,
    context: C.context, G: C.G, win: C.G, loaded: C.loaded, missing: C.missing, loadErrors: C.errors,
    /* ejecuta otro fichero (ruta relativa a la raíz) en este contexto; devuelve el error o null */
    load: rel => C.load(rel),
    /* omite la prueba (o la subprueba en curso) si falta algún global */
    need: (...names) => {
      names.forEach(n => {
        if (C.G[n] == null) {
          const err = C.errors.find(e => GLOBALS_FILE[n] && e.file === GLOBALS_FILE[n]);
          if (err) throw new Error(n + ' no carga: ' + (err.error && err.error.message));
          throw new Skip(n + ' no disponible todavía');
        }
      });
    },
    skip: reason => { throw new Skip(reason || 'omitida'); },
    /* subprueba con nombre; se puede esperar (await) o no */
    test: (name, fn) => {
      const full = path.basename(file) + ' › ' + name;
      if (opt.grep && !opt.grep.test(full)) { state.filtered++; return Promise.resolve(); }
      const p = (async () => {
        try { await fn(); state.pass++; if (opt.verbose) console.log('    ✓ ' + name); }
        catch (e) {
          if (e && e.skip) { state.skip++; if (opt.verbose) console.log('    – ' + name + ' (' + e.message + ')'); return; }
          state.fail++; state.failures.push({ name: full, error: e });
        }
      })();
      state.pending.push(p);
      return p;
    },
    /* operación recién construida con los constructores de escenario: 'tryzub' | 'marazul' */
    op: name => { ctx.need('WGScenarios', 'WGModel'); const sc = C.G.WGScenarios[name]; if (!sc) throw new Error('escenario desconocido: ' + name); return sc.build(); },
    cfg: () => { ctx.need('WGEngine', 'WGModel'); return C.G.WGModel.clone(C.G.WGEngine.DEFAULT_CONFIG); },
    /* fixture JSON fresco: 'tryzub.op' | 'marazul.op' | 'golden-v03' (null si falta) */
    fx: name => { const f = path.join(ROOT, 'tests', 'fixtures', name.replace(/\.json$/, '') + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; },
    /* fixture como objeto del contexto vm (mismo reino que los módulos) */
    fxIn: name => { const f = path.join(ROOT, 'tests', 'fixtures', name.replace(/\.json$/, '') + '.json'); return fs.existsSync(f) ? C.G.JSON.parse(fs.readFileSync(f, 'utf8')) : null; },
    norm, local, near,
    /* contexto aislado nuevo con los mismos ficheros */
    fresh: o => makeContext(o),
    /* contexto con el código de v0.3 (dc851dc) leído con git show; null si git no está disponible */
    v03: () => v03Context(),
    gitShow
  };
  Object.keys(GLOBALS).forEach(k => Object.defineProperty(ctx, k, { get: () => C.G[GLOBALS[k]], enumerable: true }));
  return ctx;
}
const GLOBALS_FILE = { WGTime: 'js/time.js', WGGeo: 'js/geo.js', WGEngine: 'js/engine.js', WGModel: 'js/model.js', WGScenarios: 'js/scenarios/tryzub.js',
  WGCat: 'js/catalog.js', WGTemplates: 'js/templates.js', WGLayout: 'js/layout.js', WGScene: 'js/scene.js', WGBound: 'js/bound.js', WGI18N: 'js/i18n.js' };

/* ------------------------------ ejecución ------------------------------ */
function parseArgs(argv) {
  const o = { pattern: null, grep: null, verbose: false, dir: path.join(ROOT, 'tests') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-g' || a === '--grep') o.grep = toRx(argv[++i]);
    else if (a === '--dir') o.dir = path.resolve(argv[++i]);
    else if (a === '-v' || a === '--verbose') o.verbose = true;
    else if (!o.pattern) o.pattern = toRx(a);
  }
  return o;
}
function toRx(s) { if (s == null) return null; try { return new RegExp(s, 'i'); } catch (e) { return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); } }

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const dir = opt.dir;
  const files = fs.readdirSync(dir).filter(f => /\.test\.js$/.test(f)).sort().filter(f => !opt.pattern || opt.pattern.test(f));
  const tot = { pass: 0, fail: 0, skip: 0, files: 0 }, fails = [];
  const t0 = Date.now();
  // errores de carga de módulos existentes: un solo aviso global
  const probe = makeContext();
  probe.errors.forEach(e => fails.push({ name: 'carga ' + e.file, error: e.error }));
  if (opt.verbose && probe.missing.length) console.log('  (módulos aún no presentes: ' + probe.missing.join(', ') + ')');
  for (const f of files) {
    const state = { pass: 0, fail: 0, skip: 0, filtered: 0, failures: [], pending: [] };
    const full = path.join(dir, f);
    let top = null, skipped = null;
    const ft = Date.now();
    try {
      delete require.cache[require.resolve(full)];
      const fn = require(full);
      const run = typeof fn === 'function' ? fn : fn && typeof fn.default === 'function' ? fn.default : null;
      if (!run) throw new Error('el fichero no exporta una función async (ctx, assert)');
      const ctx = makeCtx(full, opt, state);
      await run(ctx, makeAssert());
      await Promise.all(state.pending);
    } catch (e) {
      await Promise.all(state.pending).catch(() => {});
      if (e && e.skip) skipped = e.message; else top = e;
    }
    tot.files++;
    const n = state.pass + state.fail;
    if (top) { state.fail++; state.failures.push({ name: f, error: top }); }
    tot.pass += state.pass; tot.fail += state.fail; tot.skip += state.skip + (skipped ? 1 : 0);
    fails.push(...state.failures);
    const mark = state.fail ? '✗' : skipped ? '–' : '✓';
    console.log(`${mark} ${f}  ${state.pass}/${n + (top ? 1 : 0)} ok` + (state.skip ? `, ${state.skip} omitidas` : '') + (skipped ? `  (omitido: ${skipped})` : '') + `  ${Date.now() - ft} ms`);
  }
  if (fails.length) {
    console.log('\nFallos:');
    fails.forEach(x => {
      const e = x.error || {};
      const msg = (e.stack || String(e)).split('\n').filter(l => !/node:internal|tests[\\/]run\.js/.test(l)).slice(0, 8).join('\n      ');
      console.log('  ✗ ' + x.name + '\n      ' + msg);
    });
  }
  const failed = tot.fail + probe.errors.length;
  console.log(`\n${tot.files} ficheros · ${tot.pass} correctas · ${tot.fail} fallidas · ${tot.skip} omitidas` + (probe.errors.length ? ` · ${probe.errors.length} módulos no cargan` : '') + ` · ${Date.now() - t0} ms`);
  if (!files.length) console.log('(ninguna prueba coincide' + (opt.pattern ? ' con ' + opt.pattern : '') + ')');
  process.exitCode = failed ? 1 : 0;
}

module.exports = { ROOT, BASE_REV, ORDER, ORDER_V03, makeContext, gitShow, local, norm, makeAssert };
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
