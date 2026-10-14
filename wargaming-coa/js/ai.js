/* ==========================================================================
   Asistente de IA (Claude) para alimentar y apoyar la confrontación
   --------------------------------------------------------------------------
   Proveedores, por orden en modo automático:
   1. «sample» del visor de artefactos de claude.ai (sin clave; pide consentimiento).
   2. API de Anthropic con clave propia (sólo en uso local; la clave se guarda
      en este navegador y nunca se exporta).
   3. Manual: la app genera el prompt, el usuario lo pega en Claude y pega aquí
      la respuesta JSON. Funciona siempre.
   Toda propuesta se valida contra el ORBAT, los sectores, los turnos y el
   catálogo de tareas, y se muestra para revisión antes de aplicarla.
   ========================================================================== */
(function (global) {
  'use strict';
  const U = global.WGUI, E = global.WGEngine, W = global.WGModel, C = global.WGCat, TP = global.WGTemplates;
  const { esc, t, secH, card, short } = U;
  const KEY = 'wgcoa.apikey', MODEL = 'claude-opus-5-5';
  const AI = global.WGAI = { sample: null, probed: false, cur: null };

  /* ------------------------------ proveedor ------------------------------ */
  const st = () => { const s = U.store; s.ai = Object.assign({ mode: 'auto', model: MODEL }, s.ai || {}); return s.ai; };
  function getKey() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); return true; } catch (e) { return false; } }
  AI.mode = function () {
    const m = st().mode;
    if (m === 'sample') return AI.sample ? 'sample' : 'manual';
    if (m === 'api') return getKey() ? 'api' : 'manual';
    if (m === 'manual') return 'manual';
    return AI.sample ? 'sample' : getKey() ? 'api' : 'manual';
  };
  AI.modeLabel = m => ({ sample: t('Claude en claude.ai (sin clave)'), api: t('API de Anthropic (clave propia)'), manual: t('Manual (copiar y pegar en Claude)') })[m] || m;
  AI.probe = async function () {
    try { if (global.claude && typeof global.claude.use === 'function') AI.sample = (await global.claude.use('sample')) || null; } catch (e) { AI.sample = null; }
    AI.probed = true;
    if (U.store && (U.store.sec === 'ai')) U.render();
  };

  async function run(p, opts) {
    const mode = AI.mode();
    if (mode === 'sample') {
      try { return await AI.sample.json(p.system + '\n\n' + p.user, { modelTier: 'complex', onText: opts.onText, signal: opts.signal, cache: false }); }
      catch (e) { if (e && /not_granted|sampling_disabled|capability_disabled|capability_removed|not_declared/.test(e.code || '')) AI.sample = null; throw e; }
    }
    if (mode === 'api') return parseJSON(await apiCall(p, opts));
    throw { code: 'manual' };
  }
  async function apiCall(p, opts) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: opts.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': getKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: st().model || MODEL, max_tokens: 32000, stream: true, thinking: { type: 'adaptive' }, system: p.system, messages: [{ role: 'user', content: p.user }] })
    });
    if (!res.ok) { let m = ''; try { const j = await res.json(); m = j.error && j.error.message; } catch (e) { /* sin cuerpo */ } throw { code: 'http_' + res.status, message: m || res.statusText }; }
    const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', text = '', stop = '';
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const ev = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = ev.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
        if (!data) continue;
        let j; try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') { text += j.delta.text; if (opts.onText) opts.onText({ text }); }
        else if (j.type === 'content_block_start' && j.content_block && j.content_block.type === 'thinking' && opts.onText) opts.onText({ text: text || t('Pensando…') });
        else if (j.type === 'message_delta' && j.delta && j.delta.stop_reason) stop = j.delta.stop_reason;
        else if (j.type === 'error') throw { code: 'api_error', message: j.error && j.error.message };
      }
    }
    if (stop === 'max_tokens') throw { code: 'truncated', text };
    if (stop === 'refusal') throw { code: 'refused', text };
    return text;
  }
  function parseJSON(s) {
    s = String(s || '').trim();
    const f = s.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) s = f[1];
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw { code: 'invalid_json', text: s };
    const body = s.slice(a, b + 1);
    try { return JSON.parse(body); } catch (e) {
      try { return JSON.parse(body.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { throw { code: 'invalid_json', text: s }; }
    }
  }
  AI.parseJSON = parseJSON;
  function errMsg(e) {
    const c = (e && e.code) || '';
    const M = { not_granted: t('Permiso denegado en el visor. Use el modo manual o una clave de API.'), sampling_disabled: t('La IA no está habilitada en este visor. Use el modo manual.'),
      rate_limited: t('Límite de uso alcanzado. Espere unos minutos.'), prompt_too_large: t('El texto es demasiado largo. Divídalo en partes.'), invalid_json: t('La respuesta no es un JSON válido. Revise el texto o vuelva a intentarlo.'),
      truncated: t('La respuesta se cortó por longitud. Pida menos contenido (p. ej. sin ORBAT) o divida el documento.'), refused: t('La IA no ha respondido a esta petición.'), cancelled: t('Cancelado.'),
      http_401: t('Clave de API no válida.'), http_429: t('Límite de uso de la API alcanzado.'), http_529: t('API sobrecargada. Vuelva a intentarlo.') };
    return M[c] || ((e && e.message) ? String(e.message) : t('Error de conexión con la IA.') + (c ? ' (' + c + ')' : ''));
  }

  /* ------------------------------ contexto ------------------------------ */
  const L = () => (U.store.lang === 'en' ? 'English' : 'español');
  const r2 = x => Math.round(x * 100) / 100;
  function catalog(o) {
    const cfg = U.cfg();
    return {
      tasks: Object.keys(cfg.tasks).map(k => ({ key: k, label: cfg.tasks[k].label, minRatio: E.fmtR(cfg.tasks[k].req), breaksContact: !!cfg.tasks[k].brk })),
      modifiers: Object.keys(cfg.mods).map(k => ({ key: k, label: cfg.mods[k].label, options: cfg.mods[k].opts.map((x, i) => i + '=' + x[0] + ' ×' + x[1]), default: cfg.mods[k].def })),
      sectors: o.sectors.map(s => ({ id: s.id, name: s.name })),
      turns: o.turns.map(x => ({ id: x.id, method: x.m, label: x.label, title: x.title, time: x.time, criticalEvent: (o.ces.find(c => c.id === x.ce) || {}).title || '', active: !!o.prep.methods[x.m] }))
    };
  }
  function forces(o, side) {
    const um = E.unitMap(o);
    return o.orbat.filter(u => u.side === side && E.unitFE(u) > 0).map(u => ({ id: u.id, name: U.uname(u), ech: u.ech, type: u.type, parent: (um[u.p] || {}).name || '', fe: r2(E.unitFE(u)), cp: +u.cp || 0, role: short(u.role, 80) }));
  }
  function opSummary(o) {
    const s = o.inputs.s13, h = o.inputs.hhq;
    return { title: o.meta.title, unit: o.meta.unit, operationType: o.opType || '', mission: s.mission, intent: s.intent, essentialTasks: s.essential, constraints: s.constraints, restraints: s.restraints,
      hhqPurpose: h.purpose, endstate: h.endstate, cpg: short(o.inputs.cpg, 1500), phases: o.phases.map(p => ({ id: p.id, n: p.n, t: p.t, me: p.me, dc: p.dc, d: p.d })),
      coas: o.coas.map(c => ({ id: c.id, name: c.name, stmt: c.stmt })), ecoas: o.ecoas.map(e => ({ id: e.id, name: e.name, tag: e.tag, likelihood: e.lik, text: e.text, bySector: e.bySector })) };
  }
  const SYS = () => `Eres un oficial de Estado Mayor experto en planeamiento táctico terrestre OTAN (AJP-5(A), APP-28(B) Anexo D War Gaming, FM 5-0, FM 3-90) que apoya el Paso 4 (análisis y confrontación de COA) en una academia militar.
Reglas de salida:
- Responde SOLO con un objeto JSON válido, sin texto antes ni después y sin comentarios.
- Redacta los textos en ${L()}, con terminología militar OTAN, frases breves y concretas.
- No inventes unidades, sectores ni turnos: usa EXACTAMENTE los identificadores (id) que se te dan. Si el texto menciona algo que no existe, indícalo en "notes".
- Si falta información, deja la cadena vacía y anota el supuesto en "notes" en lugar de inventarlo.
Reglas del motor de cálculo (aprendidas de las operaciones TRYZUB y MAR AZUL):
- Un enfrentamiento (engagement) = unidades azules frente a unidades rojas en el MISMO sector y turno (punto de contacto). El motor suma equivalentes de fuerza (FE) × potencia × % empeñado y compara con el ratio mínimo de la tarea.
- "task" es la tarea AZUL del enfrentamiento (atacar, defender, retardar…), elegida del catálogo por su clave.
- Usa "pct" (0–100) para empeños parciales (p. ej. una compañía de un batallón = 33). Una unidad no debe superar el 100 % sumando todos los enfrentamientos de un mismo turno.
- "me": true sólo en el esfuerzo principal (normalmente uno por turno). "brk": true si la tarea prevé romper el contacto (retardo, cobertura, repliegue).
- "hpt": id de la unidad roja que los fuegos azules priorizan en ese enfrentamiento (o "").
- Los fuegos se cuentan UNA sola vez: o con el modificador "fires" o incluyendo la unidad de artillería en el enfrentamiento, nunca de las dos formas. Prefiere el modificador salvo que la artillería se asigne directamente.
- Modificadores: índice de la opción (entero). Usa el valor por defecto salvo que el plan justifique otro (terreno favorable, cinturón de obstáculos, sorpresa, superioridad ISR/GE…).
- El despliegue rojo (place) sitúa cada unidad roja en el sector donde combate. Una unidad roja en un sector sin enfrentamiento azul queda «sin oposición» (es una amenaza que el plan debe cubrir). Las reservas no empeñadas no se despliegan.
- "vs" (opcional) fija contra qué unidades rojas combate un enfrentamiento cuando hay varios en el mismo sector.`;

  /* ------------------------------ resolución de referencias ------------------------------ */
  function resolver(o) {
    const byId = {}, byName = {};
    o.orbat.forEach(u => { byId[u.id] = u; byName[String(u.name).toLowerCase()] = u; byName[String(U.uname(u)).toLowerCase()] = u; });
    const sec = {}; o.sectors.forEach(s => { sec[s.id] = s.id; sec[String(s.name).toLowerCase()] = s.id; });
    return {
      unit(ref, side) { if (ref == null || ref === '') return null; const u = byId[ref] || byName[String(ref).toLowerCase()]; return u && (!side || u.side === side) ? u.id : null; },
      sector(ref) { if (ref == null) return null; return sec[ref] || sec[String(ref).toLowerCase()] || null; }
    };
  }
  const clampPct = v => { const n = parseFloat(v); return isNaN(n) ? 100 : Math.max(0, Math.min(100, Math.round(n))); };
  function cleanEng(o, R, x, warn, tl) {
    const cfg = U.cfg();
    const sector = R.sector(x.sector) || (o.sectors[0] || {}).id || '';
    if (!R.sector(x.sector)) warn.push(tl + ': ' + t('sector «{s}» desconocido → {d}', { s: x.sector, d: sector }));
    let task = x.task; if (!cfg.tasks[task]) { const k = Object.keys(cfg.tasks).find(k2 => cfg.tasks[k2].label.toLowerCase() === String(task || '').toLowerCase()); if (!k) warn.push(tl + ': ' + t('tarea «{s}» desconocida → defensa precipitada', { s: task })); task = k || 'hastyDef'; }
    const units = []; (x.units || []).forEach(z => { const id = R.unit(z.u != null ? z.u : z, 'B'); if (id) units.push({ u: id, pct: clampPct(z.pct) }); else warn.push(tl + ': ' + t('unidad azul «{s}» no está en el ORBAT (o no tiene F.E.)', { s: z.u || z })); });
    const mods = {}; Object.keys(cfg.mods).forEach(k => { const v = x.mods && x.mods[k]; const n = parseInt(v, 10); mods[k] = !isNaN(n) && n >= 0 && n < cfg.mods[k].opts.length ? n : cfg.mods[k].def; });
    const hpt = R.unit(x.hpt, 'R') || '';
    const vs = (x.vs || []).map(v => R.unit(v, 'R')).filter(Boolean);
    const e = { id: 'e' + Math.random().toString(36).slice(2, 9), sector, label: String(x.label || t('Enfrentamiento')).slice(0, 80), task, me: !!x.me, hpt, vs, pair: '', units, mods };
    if (x.brk != null) e.brk = !!x.brk;
    return e;
  }
  function cleanCoaPlan(o, plan, warn) {
    const R = resolver(o), out = {};
    Object.keys(plan || {}).forEach(tid => {
      const tt = o.turns.find(x => x.id === tid || x.label === tid); if (!tt) { warn.push(t('Turno «{s}» desconocido: se ignora', { s: tid })); return; }
      const p = plan[tid] || {};
      out[tt.id] = { a: String(p.a || ''), eng: (p.eng || []).map((x, i) => cleanEng(o, R, x, warn, tt.label + ' #' + (i + 1))).filter(x => x.units.length || (warn.push(tt.label + ': ' + t('enfrentamiento sin unidades válidas, descartado')), false)) };
    });
    return out;
  }
  function cleanEcoaPlan(o, plan, warn) {
    const R = resolver(o), out = {};
    Object.keys(plan || {}).forEach(tid => {
      const tt = o.turns.find(x => x.id === tid || x.label === tid); if (!tt) { warn.push(t('Turno «{s}» desconocido: se ignora', { s: tid })); return; }
      const p = plan[tid] || {}, place = [];
      (p.place || []).forEach(z => { const id = R.unit(z.u, 'R'), sec = R.sector(z.sector); if (!id) warn.push(tt.label + ': ' + t('unidad roja «{s}» no está en el ORBAT (o no tiene F.E.)', { s: z.u })); else if (!sec) warn.push(tt.label + ': ' + t('sector «{s}» desconocido', { s: z.sector })); else place.push({ u: id, sector: sec, pct: clampPct(z.pct) }); });
      out[tt.id] = { pre: String(p.pre || ''), r: String(p.r || ''), place };
    });
    return out;
  }
  function planSummary(o, plan, red) {
    const um = E.unitMap(o);
    return Object.keys(plan).map(tid => { const tt = o.turns.find(x => x.id === tid), p = plan[tid];
      return `<div class="aip"><b>${esc(tt.label)}</b> <span class="muted small">${esc(tt.title)}</span><div class="small">${esc(red ? (p.r || p.pre) : p.a)}</div>` +
        (red ? `<div class="small muted">${p.place.map(z => esc(U.uname(um[z.u])) + ' → ' + esc(z.sector) + (z.pct !== 100 ? ' (' + z.pct + ' %)' : '')).join(' · ') || '—'}</div>`
          : p.eng.map(x => `<div class="small">• ${x.me ? '<b>ME</b> ' : ''}${esc(x.label)} · ${esc(x.sector)} · ${esc(t(U.cfg().tasks[x.task].label))}: ${x.units.map(z => esc(U.uname(um[z.u])) + (z.pct !== 100 ? ' ' + z.pct + '%' : '')).join(', ')}${x.hpt ? ' · HPT ' + esc(U.uname(um[x.hpt])) : ''}</div>`).join('')) + '</div>';
    }).join('');
  }

  /* ------------------------------ tareas ------------------------------ */
  const ENUMS = () => ({ echelons: C.ECHO, unitTypes: C.TYPES.map(x => x[0]), forceRatioTypes: Object.keys(C.FRMAP), estimateStatus: ['Supportable', 'Supportable with risk', 'Not supportable without resupply', 'Not supportable'],
    methods: C.MKEYS, ecoaTag: ['MLCOA', 'MDCOA', ''], operationTypes: Object.keys(TP.LIST) });
  const TASKS = {
    doc: {
      title: 'Importar un documento de planeamiento', input: true, file: true,
      desc: 'Pegue o cargue la orden, el CONOPS, el IPOE, las COA o el guion de la confrontación (.txt, .md, .docx, .pdf). La IA rellena los campos de la operación; usted elige qué aplicar.',
      build(o, inp) {
        return { system: SYS(), user: `Extrae del DOCUMENTO todos los datos de planeamiento que puedas para una herramienta de confrontación de COA (Paso 4). Devuelve este JSON (omite las claves sin información):
{"opType":"una de operationTypes","meta":{"title":"","unit":"","tag":"","classification":"","date":""},
"phases":[{"id":"F1","n":"FASE I · …","t":"H → H+12","me":"unidad esfuerzo principal","dc":"condición decisiva","d":"descripción"}],
"sectors":[{"id":"código corto","name":"nombre"}],"cm":["medidas de control (fases, líneas, objetivos, EA…)"],
"hhq":{"order":"","purpose":"","key":"","endstate":"","tasks":"","newTasks":"","newInfo":"","thirdParty":""},
"s13":{"mission":"","intent":"","specified":"","implied":"","essential":"","constraints":"","restraints":"","deductions":""},
"est":[{"fn":"función","status":"uno de estimateStatus","text":"deducción cuantificada"}],
"cpg":"guía del comandante para la confrontación","criteria":[{"id":"C1","name":"","w":1,"q":"pregunta"}],
"coas":[{"id":"COA-1","name":"","stmt":"enunciado completo (quién, qué, cuándo, dónde, cómo, para qué; esfuerzo principal, reserva)"}],
"ecoas":[{"id":"ECOA-1","name":"","tag":"MLCOA|MDCOA|","lik":60,"text":"","bySector":{"<sectorId>":"actuación en ese sector"}}],
"orbat":[{"id":"id único corto","p":"id de la superior o null","side":"B|R","name":"","ech":"uno de echelons","type":"uno de unitTypes","pers":"","equip":"","role":"","frT":"uno de forceRatioTypes o 'Custom F.E.'","frQ":1,"frFE":0,"cp":100}],
"methods":{"critical":true,"belt":false,"box":false,"avenue":false},
"turns":[{"id":"t1","m":"uno de methods","label":"KEY EVENT 1 | BELT 1 | BOX A | SEGMENT 1","title":"","time":"H → H+4","ce":"CE1"}],
"ces":[{"id":"CE1","title":"","dc":"","r":{"<ecoaId>":"reacción roja esperada"},"cr":"contrarreacción azul"}],
"reg":{"dp":[{"id":"DP-B1","side":"BLUE|RED","dec":"","trg":"","nai":"","ccir":"","dc":"","win":""}],"ccir":[{"id":"PIR-1","type":"PIR|FFIR|EEFI","q":"","feeds":"","nai":""}],"nai":[{"id":"NAI-1","loc":"","ind":"","ccir":"","col":"","time":""}],"tai":[{"id":"TAI-1","loc":"","tgt":"HPT-1","means":"","dp":"","eff":""}],"hpt":[{"id":"HPT-1","tgt":"","when":"","how":"","eff":"Destroy|Neutralise|Suppress|Disrupt|Deny|Delay","tai":""}],"hvt":[{"id":"HVT-1","tgt":"","val":"","xs":"","means":""}]},
"assumptions":[{"id":"A1","text":"","fail":"consecuencia si falla"}],
"notes":["dudas, supuestos e información que falta"]}
Criterios: ORBAT hasta batallón o compañía, ambos bandos; asigna a cada unidad de maniobra o de fuegos el tipo de Force Ratio Calculator Matrix más parecido (frT) o 'Custom F.E.' con frFE estimado y explícalo en "notes". Los turnos deben seguir la lógica de la operación (eventos críticos, fajas, cajas o avenidas). No resumas en exceso las COA: conserva unidades, tareas y secuencia.
Enumeraciones: ${JSON.stringify(ENUMS())}
Operación actual (para no duplicar): ${JSON.stringify({ title: o.meta.title, sectors: o.sectors, turns: o.turns.map(x => x.id + ' ' + x.label) })}
DOCUMENTO:
"""
${inp}
"""` };
      },
      validate: (o, j) => docItems(o, j)
    },
    coaPlan: {
      title: 'Interpretar la COA propia por turnos', input: true, optional: true,
      desc: 'La IA traduce el enunciado de la COA (y el texto que añada) en la acción azul y los enfrentamientos de cada turno, con unidades del ORBAT, tareas, sectores, HPT y modificadores.',
      build(o, inp, prm) {
        const c = o.coas.find(x => x.id === prm.coa) || U.coa(), ec = U.ecoa();
        return { system: SYS(), user: `Interpreta la COA AZUL "${c.id}" y define su plan por turno. Devuelve:
{"plan":{"<turnId>":{"a":"acción azul del turno (unidades y posiciones, cometido y propósito, movimiento, fuegos, sostenimiento)","eng":[{"sector":"<sectorId>","label":"denominación","task":"<clave de tarea>","me":true,"brk":false,"hpt":"<id rojo o ''>","units":[{"u":"<id azul>","pct":100}],"vs":[],"mods":{"terrain":1,"obst":0,"fires":1,"surprise":1,"morale":1,"isr":1}}]}},"notes":[""]}
Incluye todos los turnos activos. Sitúa los enfrentamientos donde la COA ENEMIGA de referencia despliega sus fuerzas para que haya punto de contacto.
COA AZUL: ${JSON.stringify({ id: c.id, name: c.name, stmt: c.stmt, existingPlanActions: Object.fromEntries(Object.entries(c.plan || {}).map(([k, v]) => [k, v.a || ''])) })}
Texto adicional del usuario: ${inp || '(ninguno)'}
Operación: ${JSON.stringify(opSummary(o))}
Catálogo: ${JSON.stringify(catalog(o))}
Despliegue rojo de referencia (${ec ? ec.id : '—'}): ${JSON.stringify(ec ? Object.fromEntries(Object.entries(ec.plan || {}).map(([k, v]) => [k, (v.place || []).map(p => p.u + '@' + p.sector + ':' + p.pct)])) : {})}
Fuerzas AZULES con F.E.: ${JSON.stringify(forces(o, 'B'))}
Fuerzas ROJAS con F.E.: ${JSON.stringify(forces(o, 'R'))}` };
      },
      validate(o, j, prm) {
        const warn = [], plan = cleanCoaPlan(o, j.plan, warn), c = o.coas.find(x => x.id === prm.coa) || U.coa();
        return { warn, notes: j.notes, items: [{ k: 'plan', l: t('Plan por turnos de {c}', { c: c.name }), n: Object.keys(plan).length, html: planSummary(o, plan, false), on: true,
          apply: () => { Object.keys(plan).forEach(k => { c.plan[k] = plan[k]; }); } }] };
      }
    },
    ecoaPlan: {
      title: 'Interpretar la COA enemiga por turnos', input: true, optional: true,
      desc: 'La IA traduce la COA enemiga del IPOE en la pre-acción, la reacción y el despliegue por sector de cada turno, con unidades rojas del ORBAT.',
      build(o, inp, prm) {
        const e = o.ecoas.find(x => x.id === prm.ecoa) || U.ecoa(), c = U.coa();
        return { system: SYS(), user: `Interpreta la COA ROJA "${e.id}" (producto del IPOE) y define, para cada turno, cómo actúa el adversario. Devuelve:
{"plan":{"<turnId>":{"pre":"pre-acción roja","r":"reacción roja","place":[{"u":"<id rojo>","sector":"<sectorId>","pct":100}]}},"bySector":{"<sectorId>":"resumen de su actuación en el sector"},"notes":[""]}
Juega al adversario de forma realista según su doctrina y capacidades; empeña la reserva cuando su COA lo prevé.
COA ROJA: ${JSON.stringify({ id: e.id, name: e.name, tag: e.tag, text: e.text, bySector: e.bySector })}
Texto adicional del usuario: ${inp || '(ninguno)'}
Operación: ${JSON.stringify(opSummary(o))}
Catálogo: ${JSON.stringify(catalog(o))}
Plan azul de referencia (${c ? c.id : '—'}): ${JSON.stringify(c ? Object.fromEntries(Object.entries(c.plan || {}).map(([k, v]) => [k, (v.eng || []).map(x => x.sector + ':' + x.label)])) : {})}
Fuerzas ROJAS con F.E.: ${JSON.stringify(forces(o, 'R'))}` };
      },
      validate(o, j, prm) {
        const warn = [], plan = cleanEcoaPlan(o, j.plan, warn), e = o.ecoas.find(x => x.id === prm.ecoa) || U.ecoa();
        const items = [{ k: 'plan', l: t('Despliegue por turnos de {c}', { c: e.name }), n: Object.keys(plan).length, html: planSummary(o, plan, true), on: true, apply: () => { Object.keys(plan).forEach(k => { e.plan[k] = plan[k]; }); } }];
        if (j.bySector && typeof j.bySector === 'object') items.push({ k: 'bySector', l: t('Actuación por sector'), n: Object.keys(j.bySector).length, html: Object.keys(j.bySector).map(k => `<div class="small"><b>${esc(k)}</b>: ${esc(j.bySector[k])}</div>`).join(''), on: true,
          apply: () => { const R = resolver(o); Object.keys(j.bySector).forEach(k => { const s = R.sector(k); if (s) e.bySector[s] = String(j.bySector[k]); }); } });
        return { warn, notes: j.notes, items };
      }
    },
    coaDraft: {
      title: 'Redactar una nueva COA propia', input: true,
      desc: 'Describa la idea de maniobra (o deje que la IA la proponga a partir de la misión, la intención y las COA enemigas). Se crea una COA nueva con su enunciado y su plan por turnos.',
      build(o, inp) {
        return { system: SYS(), user: `Propón una COA AZUL nueva, distinguible de las existentes, que cumpla la misión y la intención y que sea factible con las fuerzas disponibles. Devuelve:
{"coa":{"name":"COA n — idea en pocas palabras","stmt":"enunciado completo: propósito, esfuerzo principal, esfuerzos de apoyo, reserva, fuegos, fases, condición final","plan":{"<turnId>":{"a":"","eng":[{"sector":"","label":"","task":"","me":true,"hpt":"","units":[{"u":"","pct":100}],"mods":{}}]}}},"notes":["riesgos y supuestos"]}
Idea del usuario: ${inp || '(proponla tú)'}
Operación: ${JSON.stringify(opSummary(o))}
Catálogo: ${JSON.stringify(catalog(o))}
Despliegue rojo de la MLCOA/MDCOA: ${JSON.stringify(o.ecoas.map(e => ({ id: e.id, tag: e.tag, plan: Object.fromEntries(Object.entries(e.plan || {}).map(([k, v]) => [k, (v.place || []).map(p => p.u + '@' + p.sector)])) })))}
Fuerzas AZULES con F.E.: ${JSON.stringify(forces(o, 'B'))}
Fuerzas ROJAS con F.E.: ${JSON.stringify(forces(o, 'R'))}` };
      },
      validate(o, j) {
        const warn = [], c = j.coa || {}, plan = cleanCoaPlan(o, c.plan, warn);
        const id = nid('COA-', o.coas);
        return { warn, notes: j.notes, items: [{ k: 'coa', l: t('Nueva COA') + ': ' + (c.name || id), n: Object.keys(plan).length, on: true, html: `<p class="small">${esc(c.stmt || '')}</p>` + planSummary(o, plan, false),
          apply: () => { o.coas.push({ id, name: c.name || id, stmt: c.stmt || '', plan }); o.prep.coa = id; } }] };
      }
    },
    ecoaDraft: {
      title: 'Redactar una nueva COA enemiga', input: true,
      desc: 'Describa la amenaza (IPOE: capacidades, doctrina, objetivos) o deje que la IA proponga la más probable o la más peligrosa. Se crea una ECOA nueva con su despliegue por turnos.',
      build(o, inp) {
        return { system: SYS(), user: `Propón una COA ROJA nueva coherente con el IPOE y distinta de las existentes (indica si es MLCOA o MDCOA). Devuelve:
{"ecoa":{"name":"","tag":"MLCOA|MDCOA|","lik":30,"text":"descripción: objetivo, esfuerzo principal, reserva, fuegos, DP enemigos","bySector":{"<sectorId>":""},"plan":{"<turnId>":{"pre":"","r":"","place":[{"u":"","sector":"","pct":100}]}}},"notes":[""]}
Indicaciones del usuario: ${inp || '(proponla tú; prioriza la más peligrosa si no existe)'}
Operación: ${JSON.stringify(opSummary(o))}
Catálogo: ${JSON.stringify(catalog(o))}
Fuerzas ROJAS con F.E.: ${JSON.stringify(forces(o, 'R'))}` };
      },
      validate(o, j) {
        const warn = [], e = j.ecoa || {}, plan = cleanEcoaPlan(o, e.plan, warn), id = nid('ECOA-', o.ecoas), R = resolver(o), bs = {};
        Object.keys(e.bySector || {}).forEach(k => { const s = R.sector(k); if (s) bs[s] = String(e.bySector[k]); });
        return { warn, notes: j.notes, items: [{ k: 'ecoa', l: t('Nueva COA enemiga') + ': ' + (e.name || id), n: Object.keys(plan).length, on: true, html: `<p class="small"><span class="tag bad">${esc(e.tag || '')}</span> ${esc(e.text || '')}</p>` + planSummary(o, plan, true),
          apply: () => { o.ecoas.push({ id, name: e.name || id, tag: ['MLCOA', 'MDCOA'].includes(e.tag) ? e.tag : '', lik: Math.max(0, Math.min(100, +e.lik || 0)), text: e.text || '', bySector: bs, plan }); } }] };
      }
    },
    turn: {
      title: 'Asistir el turno con IA', input: true, optional: true,
      desc: 'La IA juega los papeles del turno: reacción de la célula roja, contrarreacción azul, justificación del árbitro, ramas y aportación de cada función de EM. Usted elige qué incorporar.',
      build(o, inp, prm) {
        const c = U.coa(), e = U.ecoa(), g = U.game(true), path = U.pathFor(c, e, g), T = path.turns.find(x => x.t.id === prm.tid) || path.turns[0], tt = T.t, um = path.umap;
        const ce = o.ces.find(x => x.id === tt.ce), gt = g.turns[tt.id] || {};
        const prev = path.turns.filter(x => x.index < T.index).map(x => ({ turn: x.t.label, result: (g.turns[x.t.id] || {}).res || x.suggested, cr: short((g.turns[x.t.id] || {}).cr, 200) }));
        const engs = T.results.map(r => ({ label: r.x.eng.label, sector: r.x.eng.sector, task: r.calc.taskLabel, me: !!r.x.eng.me, blue: r.x.blue.map(b => U.uname(um[b.u]) + ' ' + Math.round((T.startStr[b.u] || 0) * 100) + '%'), red: r.x.red.map(b => U.uname(um[b.u]) + ' ' + Math.round((T.startStr[b.u] || 0) * 100) + '%'),
          ratio: E.fmtR(r.calc.rEff), required: E.fmtR(r.calc.req), engineOutcome: r.adj.outcome, blueLoss: Math.round(r.adj.lb) + '%', redLoss: Math.round(r.adj.lr) + '%' }));
        const act = U.role();
        return { system: SYS(), user: `Apoya la confrontación del turno ${tt.label} (${tt.title}, ${tt.time}) de la pareja ${c.name} frente a ${e.name}. Desempeña los papeles de la secuencia acción · reacción · contrarreacción y del EM. Devuelve:
{"red":{"pre":"pre-acción roja","r":"reacción roja: contramaniobras, empleo de reserva, HVT protegidos, sorpresa"},"blue":{"cr":"contrarreacción azul: empleo de reserva, ataque al HPT, ajustes, ramas"},
"white":{"rem":"justificación del árbitro: por qué el resultado es razonable, qué hipótesis se comprueban y riesgos","branch":"ramas y secuelas identificadas","dp":"<id de DP o ''>","ccir":"<id de CCIR o ''>"},
"sync":{${U.FUNCS.map(f => `"${f[0]}":"${f[1]}"`).join(',')}},"notes":[""]}
En "sync", para cada función, una o dos frases concretas sobre lo que debe hacer o vigilar en este turno (cantidades, tiempos, lugares). ${act ? 'Rol activo del usuario: ' + act.l + ' — da más detalle a su parte.' : ''}
Indicaciones del usuario: ${inp || '(ninguna)'}
Evento crítico: ${JSON.stringify(ce ? { id: ce.id, title: ce.title, dc: ce.dc, expectedRed: ce.r ? ce.r[e.id] : '', expectedCR: ce.cr } : null)}
Acción azul: ${JSON.stringify((c.plan[tt.id] || {}).a || '')}
Plan rojo del turno: ${JSON.stringify({ pre: (e.plan[tt.id] || {}).pre || '', r: (e.plan[tt.id] || {}).r || '' })}
Registrado ya en el turno: ${JSON.stringify({ cr: gt.cr || '', rem: gt.rem || '', branch: gt.branch || '', res: gt.res || '' })}
Cálculo del motor (FE, ratio en el punto de contacto, resultado y bajas): ${JSON.stringify(engs)}
Fuerzas rojas sin oposición: ${JSON.stringify(T.warnings.map(w => ({ sector: w.sector, units: w.units.map(u => U.uname(um[u])) })))}
Turnos anteriores: ${JSON.stringify(prev)}
DP disponibles: ${JSON.stringify(o.reg.dp.map(d => d.id + ' ' + short(d.dec, 60)))}
CCIR disponibles: ${JSON.stringify(o.reg.ccir.map(d => d.id + ' ' + short(d.q, 60)))}
Operación: ${JSON.stringify({ mission: o.inputs.s13.mission, intent: o.inputs.s13.intent, ffir: o.ffir + '%' })}` };
      },
      validate(o, j, prm) {
        const c = U.coa(), e = U.ecoa(), g = U.game(true), tid = prm.tid, ci = o.coas.indexOf(c), ei = o.ecoas.indexOf(e);
        e.plan[tid] = e.plan[tid] || { pre: '', r: '', place: [] }; g.turns[tid] = g.turns[tid] || { cr: '', assets: [], dp: '', ccir: '', rem: '', branch: '', res: '', bcp: '', rcp: '', fr: '', ovr: {}, mods: {} };
        const gt = g.turns[tid], items = [], warn = [];
        const add = (k, l, v, cur, set) => { if (!v) return; items.push({ k, l, n: '', on: !String(cur || '').trim(), html: `<p class="small">${esc(v)}</p>${String(cur || '').trim() ? `<p class="small muted">${t('Actual')}: ${esc(short(cur, 200))}</p>` : ''}`, apply: set }); };
        const R = j.red || {}, B = j.blue || {}, Wt = j.white || {};
        add('pre', t('Pre-acción roja'), R.pre, e.plan[tid].pre, () => { e.plan[tid].pre = R.pre; });
        add('r', t('Reacción roja'), R.r, e.plan[tid].r, () => { e.plan[tid].r = R.r; });
        add('cr', t('Contrarreacción azul'), B.cr, gt.cr, () => { gt.cr = B.cr; });
        add('rem', t('Justificación del árbitro'), Wt.rem, gt.rem, () => { gt.rem = Wt.rem; });
        add('branch', t('Ramas y secuelas'), Wt.branch, gt.branch, () => { gt.branch = Wt.branch; });
        if (Wt.dp && o.reg.dp.find(d => d.id === Wt.dp)) add('dp', t('Punto de decisión'), Wt.dp, gt.dp, () => { gt.dp = Wt.dp; });
        if (Wt.ccir && o.reg.ccir.find(d => d.id === Wt.ccir)) add('ccir', 'CCIR', Wt.ccir, gt.ccir, () => { gt.ccir = Wt.ccir; });
        const S = j.sync || {}; g.sync = g.sync || {};
        U.FUNCS.forEach(f => { const cur = (g.sync[f[0]] || {})[tid]; add('s-' + f[0], t(f[1]), S[f[0]], cur, () => { g.sync[f[0]] = g.sync[f[0]] || {}; g.sync[f[0]][tid] = S[f[0]]; }); });
        void ci; void ei;
        return { warn, notes: j.notes, items };
      }
    },
    concl: {
      title: 'Borrador de conclusiones de la confrontación', input: true, optional: true,
      desc: 'Con el registro de todos los turnos, la IA propone la evaluación FACDS, fortalezas, debilidades, la conclusión para el comandante y el enunciado de la COA refinada.',
      build(o, inp) {
        const c = U.coa(), e = U.ecoa(), g = U.game(true), path = U.pathFor(c, e, g), A = U.analysis();
        const rec = path.turns.map(T => { const gt = g.turns[T.t.id] || {}; return { turn: T.t.label, title: T.t.title, blue: short((c.plan[T.t.id] || {}).a, 300), red: short((e.plan[T.t.id] || {}).r, 300), cr: short(gt.cr, 300), result: gt.res || T.suggested, engine: T.suggested, bcp: T.bcpCalc == null ? null : Math.round(T.bcpCalc * 100), rcp: T.rcpCalc == null ? null : Math.round(T.rcpCalc * 100), dp: gt.dp, branch: short(gt.branch, 200), rem: short(gt.rem, 200) }; });
        const cell = A && A[c.id + '|' + e.id];
        return { system: SYS(), user: `Redacta las conclusiones de la confrontación de ${c.name} frente a ${e.name}. Devuelve:
{"facds":{"F":{"v":"SI|COND|NO","t":"justificación"},"A":{"v":"","t":""},"C":{"v":"","t":""},"D":{"v":"","t":""},"S":{"v":"","t":""}},"strengths":"","weaknesses":"","conclusions":"conclusión para el comandante (riesgo, condiciones, recomendación)","refinedText":"enunciado de la COA refinada con los cambios de organización operativa, tiempos, DP y medidas de control","notes":[""]}
F = factible, A = aceptable (riesgo/coste), C = completa, D = distinguible, S = adecuada (cumple misión e intención).
Indicaciones del usuario: ${inp || '(ninguna)'}
Registro: ${JSON.stringify(rec)}
Estadística Monte Carlo de la pareja: ${JSON.stringify(cell ? { pSuccess: Math.round(cell.pSuccess * 100) + '%', pAllDC: Math.round(cell.pDC * 100) + '%', meanBlueCP: Math.round(cell.meanBlueCP * 100) + '%', meanRedCP: Math.round(cell.meanRedCP * 100) + '%', pFFIRbreach: Math.round(cell.pFFIR * 100) + '%' } : null)}
Supuestos: ${JSON.stringify(o.prep.assumptions.map(a => a.id + ' ' + a.text + ' [' + a.status + ']'))}
Operación: ${JSON.stringify({ mission: o.inputs.s13.mission, intent: o.inputs.s13.intent, coa: c.stmt, criteria: o.inputs.criteria.map(k => k.name + ' (' + k.w + ')') })}` };
      },
      validate(o, j) {
        const g = U.game(true), items = [];
        const add = (k, l, v, cur, set) => { if (!v) return; items.push({ k, l, n: '', on: !String(cur || '').trim(), html: `<p class="small">${esc(v)}</p>`, apply: set }); };
        const F = j.facds || {}, lab = { F: t('Factible'), A: t('Aceptable'), C: t('Completa'), D: t('Distinguible'), S: t('Adecuada') };
        Object.keys(lab).forEach(k => { const x = F[k]; if (!x) return; const v = ['SI', 'COND', 'NO'].includes(x.v) ? x.v : ''; add('f' + k, 'FACDS · ' + lab[k] + (v ? ' — ' + v : ''), x.t || v, ((g.facds || {})[k] || {}).t, () => { g.facds = g.facds || {}; g.facds[k] = { v, t: x.t || '' }; }); });
        add('str', t('Fortalezas'), j.strengths, g.strengths, () => { g.strengths = j.strengths; });
        add('wea', t('Debilidades'), j.weaknesses, g.weaknesses, () => { g.weaknesses = j.weaknesses; });
        add('con', t('Conclusión para el comandante'), j.conclusions, g.conclusions, () => { g.conclusions = j.conclusions; });
        add('ref', t('Enunciado de la COA refinada'), j.refinedText, g.outputs.refinedText, () => { g.outputs.refinedText = j.refinedText; });
        return { warn: [], notes: j.notes, items };
      }
    }
  };
  AI.TASKS = TASKS;
  const nid = (p, arr) => { let m = 0; arr.forEach(x => { const r = String(x.id || '').match(/(\d+)$/); if (r) m = Math.max(m, +r[1]); }); return p + (m + 1); };

  /* Documento → secciones aplicables (sustituyen a las actuales). */
  function docItems(o, j) {
    const warn = [], items = [], arr = x => (Array.isArray(x) ? x : []);
    const it = (k, l, n, html, apply, on) => items.push({ k, l, n, html, apply, on: on !== false });
    const li = (xs, f) => `<ul class="small rl">${xs.slice(0, 12).map(x => `<li>${esc(f(x))}</li>`).join('')}${xs.length > 12 ? `<li class="muted">… +${xs.length - 12}</li>` : ''}</ul>`;
    if (j.meta) it('meta', t('Identificación'), '', li(Object.keys(j.meta).filter(k => j.meta[k]), k => k + ': ' + j.meta[k]), () => { Object.keys(j.meta).forEach(k => { if (j.meta[k]) o.meta[k] = String(j.meta[k]); }); });
    if (j.opType && TP.LIST[j.opType]) it('opType', t('Tipo de operación'), '', `<p class="small">${esc(t(TP.LIST[j.opType].l))}</p>`, () => { o.opType = j.opType; });
    if (arr(j.sectors).length) it('sectors', t('Sectores / corredores / fajas'), j.sectors.length, li(j.sectors, s => s.id + ' — ' + s.name), () => { o.sectors = j.sectors.map((s, i) => ({ id: String(s.id || 'S' + (i + 1)), name: String(s.name || s.id) })); });
    if (arr(j.phases).length) it('phases', t('Fases de la operación'), j.phases.length, li(j.phases, p => (p.n || p.id) + ' · ' + (p.t || '')), () => { o.phases = j.phases.map((p, i) => ({ id: String(p.id || 'F' + (i + 1)), n: p.n || '', t: p.t || '', me: p.me || '', dc: p.dc || '', otg: '', d: p.d || '' })); });
    if (arr(j.cm).length) it('cm', t('Medidas de control'), j.cm.length, li(j.cm, x => x), () => { o.cm = j.cm.map(String); });
    if (j.hhq) it('hhq', t('Orden superior'), '', li(Object.keys(j.hhq).filter(k => j.hhq[k]), k => k + ': ' + short(j.hhq[k], 120)), () => { Object.keys(j.hhq).forEach(k => { if (j.hhq[k]) o.inputs.hhq[k] = String(j.hhq[k]); }); });
    if (j.s13) it('s13', t('Pasos 1–3 (misión, intención, cometidos, limitaciones)'), '', li(Object.keys(j.s13).filter(k => j.s13[k]), k => k + ': ' + short(j.s13[k], 120)), () => { Object.keys(j.s13).forEach(k => { if (j.s13[k]) o.inputs.s13[k] = String(j.s13[k]); }); });
    if (arr(j.est).length) it('est', t('Estimaciones'), j.est.length, li(j.est, x => x.fn + ' — ' + x.status), () => { o.inputs.est = j.est.map(x => ({ fn: x.fn || '', status: ENUMS().estimateStatus.includes(x.status) ? x.status : 'Supportable with risk', text: x.text || '' })); });
    if (j.cpg || arr(j.criteria).length) it('cpg', t('CPG y criterios'), arr(j.criteria).length, `<p class="small">${esc(short(j.cpg, 300))}</p>` + li(arr(j.criteria), x => x.name + ' (' + x.w + ')'), () => { if (j.cpg) o.inputs.cpg = String(j.cpg); if (arr(j.criteria).length) o.inputs.criteria = j.criteria.map((x, i) => ({ id: x.id || 'C' + (i + 1), name: x.name || '', w: +x.w || 1, q: x.q || '' })); });
    if (arr(j.orbat).length) {
      const ids = new Set(), types = new Set(C.TYPES.map(x => x[0]));
      const units = j.orbat.map((u, i) => { let id = String(u.id || 'u' + i); while (ids.has(id)) id += '_'; ids.add(id);
        const frT = C.FRMAP[u.frT] != null ? u.frT : (u.frT ? (warn.push(t('{n}: tipo F.E. «{s}» fuera de catálogo', { n: u.name, s: u.frT })), '') : '');
        return { id, p: u.p || null, side: u.side === 'R' ? 'R' : 'B', name: String(u.name || id), type: types.has(u.type) ? u.type : 'infantry', ech: C.ECHO.includes(u.ech) ? u.ech : 'battalion', pers: String(u.pers || ''), equip: String(u.equip || ''), role: String(u.role || ''), frT, frQ: +u.frQ || 1, frFE: +u.frFE || 0, cp: u.cp == null ? 100 : Math.max(0, Math.min(100, +u.cp || 0)), loc: '' }; });
      units.forEach(u => { if (u.p && !ids.has(u.p)) u.p = null; });
      const fe = units.filter(u => u.frT).length;
      it('orbat', t('ORBAT'), units.length, `<p class="small">${t('Azul')}: ${units.filter(u => u.side === 'B').length} · ${t('Rojo')}: ${units.filter(u => u.side === 'R').length} · ${t('con F.E.')}: ${fe}</p>` + li(units, u => (u.side === 'R' ? '◆ ' : '▪ ') + u.name + (u.frT ? ' [' + u.frT + ']' : '')),
        () => { o.orbat = units; o.ui.open = {}; o.orbat.filter(u => !u.p).forEach(u => { o.ui.open[u.id] = 1; }); o.coas.forEach(c => { c.plan = {}; }); o.ecoas.forEach(e => { e.plan = {}; }); o.games = {}; o.prep.positions = []; });
      if (o.coas.some(c => Object.keys(c.plan || {}).length)) warn.push(t('Sustituir el ORBAT borra los planes por turno y las confrontaciones actuales (sus unidades dejan de existir).'));
    }
    if (arr(j.coas).length) it('coas', t('COA propias'), j.coas.length, li(j.coas, c => c.name + ': ' + short(c.stmt, 120)), () => { o.coas = j.coas.map((c, i) => ({ id: String(c.id || 'COA-' + (i + 1)), name: c.name || 'COA ' + (i + 1), stmt: c.stmt || '', plan: {} })); o.games = {}; });
    if (arr(j.ecoas).length) it('ecoas', t('COA enemigas (IPOE)'), j.ecoas.length, li(j.ecoas, e => (e.tag ? e.tag + ' · ' : '') + e.name + ' (' + (e.lik || 0) + ' %)'), () => { o.ecoas = j.ecoas.map((e, i) => ({ id: String(e.id || 'ECOA-' + (i + 1)), name: e.name || 'ECOA ' + (i + 1), tag: ['MLCOA', 'MDCOA'].includes(e.tag) ? e.tag : '', lik: +e.lik || 0, text: e.text || '', bySector: e.bySector || {}, plan: {} })); o.games = {}; });
    if (arr(j.turns).length) it('turns', t('Turnos y métodos'), j.turns.length, li(j.turns, x => x.label + ' — ' + x.title + ' (' + (x.time || '') + ')'), () => {
      o.turns = j.turns.map((x, i) => ({ id: String(x.id || 't' + (i + 1)), m: C.MKEYS.includes(x.m) ? x.m : 'critical', label: x.label || 'KEY EVENT ' + (i + 1), title: x.title || '', time: x.time || '', ce: x.ce || '', sim: true }));
      if (j.methods) C.MKEYS.forEach(k => { o.prep.methods[k] = !!j.methods[k]; }); o.turns.forEach(x => { o.prep.methods[x.m] = true; }); o.ui.planTurn = o.turns[0].id; o.ui.wgTurn = 0; });
    if (arr(j.ces).length) it('ces', t('Eventos críticos'), j.ces.length, li(j.ces, c => c.id + ' · ' + c.title), () => { o.ces = j.ces.map((c, i) => ({ id: String(c.id || 'CE' + (i + 1)), title: c.title || '', step: '', dc: c.dc || '', dp: '', ccir: '', r: c.r || {}, cr: c.cr || '' })); o.prep.ceSel = o.ces.map(c => c.id); });
    if (j.reg) Object.keys(U.REG).forEach(k => { const xs = arr(j.reg[k]); if (!xs.length) return;
      it('reg-' + k, t(U.REG[k].t), xs.length, li(xs, x => x.id + ' · ' + short(x.dec || x.q || x.loc || x.tgt || '', 90)), () => { o.reg[k] = xs.map(x => { const r = {}; U.REG[k].cols.forEach(c => { r[c[0]] = x[c[0]] != null ? String(x[c[0]]) : ''; }); if (!r.st) { const l = U.REG[k].cols.find(c => c[0] === 'st'); if (l) r.st = l[2].slice(2).split(',')[0]; } return r; }); }); });
    if (arr(j.assumptions).length) it('as', t('Supuestos'), j.assumptions.length, li(j.assumptions, a => a.id + ' · ' + a.text), () => { o.prep.assumptions = j.assumptions.map((a, i) => ({ id: a.id || 'A' + (i + 1), text: a.text || '', fail: a.fail || '', status: 'UNTESTED' })); });
    return { warn, notes: j.notes, items };
  }

  /* ------------------------------ modal ------------------------------ */
  function open(task, prm) {
    AI.cur = { task, prm: prm || {}, stage: 'input', input: (AI.cur && AI.cur.task === task && AI.cur.input) || '', text: '', res: null, err: '', paste: '', target: 'cur' };
    draw();
  }
  AI.open = open;
  function box(html) { const m = U.$('modal'), b = U.$('mbox'); b.className = 'box wide'; b.innerHTML = html; m.hidden = false; m.classList.add('on'); }
  function close() { if (AI.cur && AI.cur.ctl) AI.cur.ctl.abort(); AI.cur = null; U.$('mbox').className = 'box'; U.closeModal(); }
  function draw() {
    const A = AI.cur; if (!A) return; const T = TASKS[A.task], mode = AI.mode();
    let h = `<div class="mb"><div class="row between"><h3>✦ ${esc(t(T.title))}</h3><button class="btn ghost sm" data-a="aiClose" aria-label="${t('Cerrar')}">✕</button></div>`;
    if (A.stage === 'input') {
      h += `<p class="small muted">${esc(t(T.desc))}</p>`;
      if (T.input) h += `<textarea class="ta" rows="${A.task === 'doc' ? 12 : 4}" data-live="aiIn" placeholder="${esc(T.optional ? t('Indicaciones opcionales…') : t('Texto…'))}">${esc(A.input)}</textarea>`;
      if (T.file) h += `<div class="row"><label class="btn sm">⬆ ${t('Cargar archivo')}<input type="file" hidden data-ch="aiFile" accept=".txt,.md,.csv,.json,.html,.htm,.docx,.pdf"></label><span class="small muted">${A.input ? A.input.length.toLocaleString() + ' ' + t('caracteres') : ''}</span></div>
        <div class="row"><label class="chk"><input type="radio" name="aitg" data-ch="aiTarget" value="cur"${A.target === 'cur' ? ' checked' : ''}><span>${t('Aplicar a la operación activa')}</span></label><label class="chk"><input type="radio" name="aitg" data-ch="aiTarget" value="new"${A.target === 'new' ? ' checked' : ''}><span>${t('Crear una operación nueva')}</span></label></div>`;
      h += `<p class="small">${t('Proveedor')}: <b>${esc(AI.modeLabel(mode))}</b> · <a href="#" data-a="aiCfg">${t('cambiar')}</a></p>
        <div class="row end"><button class="btn" data-a="aiManual">${t('Modo manual')}</button>${mode !== 'manual' ? `<button class="btn pri" data-a="aiGo">✦ ${t('Generar')}</button>` : ''}</div>`;
    } else if (A.stage === 'run') {
      h += `<p class="small muted">${t('Generando con {p}… La respuesta se valida antes de aplicarse.', { p: AI.modeLabel(mode) })}</p><pre class="aiout">${esc(A.text.slice(-1800) || t('Pensando…'))}</pre><div class="row end"><button class="btn" data-a="aiStop">${t('Cancelar')}</button></div>`;
    } else if (A.stage === 'manual') {
      h += `<p class="small">${t('1. Copie este prompt y péguelo en Claude (claude.ai). 2. Pegue abajo la respuesta JSON completa. 3. Pulse «Procesar».')}</p>
        <textarea class="ta mono" rows="6" readonly id="aiPrompt">${esc(A.prompt)}</textarea><div class="row"><button class="btn sm" data-a="aiCopy">⧉ ${t('Copiar prompt')}</button><span class="small muted">${A.prompt.length.toLocaleString()} ${t('caracteres')}</span></div>
        <textarea class="ta mono" rows="6" data-live="aiPaste" placeholder="${t('Pegue aquí la respuesta JSON…')}">${esc(A.paste)}</textarea>
        <div class="row end"><button class="btn" data-a="aiBack">${t('Volver')}</button><button class="btn pri" data-a="aiParse">${t('Procesar')}</button></div>`;
    } else if (A.stage === 'preview') {
      const R = A.res;
      h += `<p class="small muted">${t('Revise la propuesta. Sólo se aplica lo marcado; lo no marcado no cambia.')}</p>`;
      if (R.warn.length) h += `<details class="warnbox"><summary>${t('{n} avisos de validación', { n: R.warn.length })}</summary><ul class="small rl">${R.warn.slice(0, 40).map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>`;
      if (R.notes && R.notes.length) h += `<details open class="hint"><summary class="small"><b>${t('Notas de la IA')}</b></summary><ul class="small rl">${[].concat(R.notes).filter(Boolean).map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>`;
      h += R.items.length ? `<div class="aiitems">${R.items.map((x, i) => `<details class="aiit"><summary><label class="chk" onclick="event.stopPropagation()"><input type="checkbox" data-ch="aiItem" data-i="${i}"${x.on ? ' checked' : ''}><span><b>${esc(x.l)}</b>${x.n !== '' ? ` <span class="tag info">${x.n}</span>` : ''}</span></label></summary><div class="aibody">${x.html}</div></details>`).join('')}</div>`
        : `<p class="warnbox">${t('La respuesta no contiene nada aplicable.')}</p>`;
      h += `<div class="row end"><button class="btn" data-a="aiBack">${t('Volver')}</button><button class="btn pri" data-a="aiApply"${R.items.length ? '' : ' disabled'}>✔ ${t('Aplicar lo marcado')}</button></div>`;
    } else if (A.stage === 'error') {
      h += `<p class="warnbox">${esc(A.err)}</p>${A.text ? `<details><summary class="small">${t('Respuesta recibida')}</summary><pre class="aiout">${esc(A.text.slice(0, 4000))}</pre></details>` : ''}<div class="row end"><button class="btn" data-a="aiBack">${t('Volver')}</button><button class="btn" data-a="aiManual">${t('Modo manual')}</button></div>`;
    }
    box(h + '</div>');
  }
  function prompt() { const A = AI.cur, T = TASKS[A.task]; const o = A.target === 'new' && A.task === 'doc' ? W.blankOp('') : U.op(); return T.build(o, A.input, A.prm); }
  function finish(j) {
    const A = AI.cur, T = TASKS[A.task];
    if (A.task === 'doc' && A.target === 'new') { const o = W.blankOp(t('Operación importada')); TP.apply(o, (j && TP.LIST[j.opType]) ? j.opType : 'blank'); A.newOp = o; }
    A.res = T.validate(A.newOp || U.op(), j || {}, A.prm); A.stage = 'preview'; draw();
  }
  async function go() {
    const A = AI.cur; A.stage = 'run'; A.text = ''; draw();
    A.ctl = new AbortController();
    let p; try { p = prompt(); } catch (e) { A.stage = 'error'; A.err = t('No se pudo preparar la petición: {m}', { m: e.message || e }); draw(); return; }
    let last = 0;
    try {
      const j = await run(p, { signal: A.ctl.signal, onText: u => { if (!AI.cur) return; A.text = u.text || ''; const now = Date.now(); if (now - last > 250) { last = now; const pre = document.querySelector('#mbox .aiout'); if (pre) { pre.textContent = A.text.slice(-1800); pre.scrollTop = pre.scrollHeight; } } } });
      if (AI.cur !== A) return; finish(j);
    } catch (e) {
      if (AI.cur !== A) return;
      if (e && e.code === 'manual') { toManual(); return; }
      A.stage = 'error'; A.err = errMsg(e); if (e && e.text) A.text = e.text; draw();
    }
  }
  function toManual() { const A = AI.cur; let p; try { p = prompt(); } catch (e) { A.stage = 'error'; A.err = String(e.message || e); draw(); return; } A.prompt = p.system + '\n\n' + p.user; A.stage = 'manual'; draw(); }

  /* Lectura de archivos: texto directo; .docx con mammoth.js y .pdf con pdf.js (cdnjs, carga bajo demanda). */
  function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector('script[src="' + src + '"]')) { res(); return; } const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('script')); document.head.appendChild(s); }); }
  async function readFile(f) {
    const n = f.name.toLowerCase();
    if (n.endsWith('.docx')) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.9.1/mammoth.browser.min.js');
      const r = await global.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() }); return r.value;
    }
    if (n.endsWith('.pdf')) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      const lib = global.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise; let out = '';
      for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const c = await pg.getTextContent(); out += c.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n\n'; }
      return out;
    }
    const txt = await f.text();
    return /\.html?$/.test(n) ? (new DOMParser().parseFromString(txt, 'text/html').body.innerText || txt) : txt;
  }
  AI.readFile = readFile;

  U.live.aiIn = el => { if (AI.cur) AI.cur.input = el.value; };
  U.live.aiPaste = el => { if (AI.cur) AI.cur.paste = el.value; };
  Object.assign(U.A, {
    aiOpen: d => open(d.k, { coa: d.coa, ecoa: d.ecoa, tid: d.id }),
    aiTurn: d => open('turn', { tid: d.id }),
    aiClose: () => close(),
    aiGo: () => { if (TASKS[AI.cur.task].input && !TASKS[AI.cur.task].optional && !AI.cur.input.trim() && AI.cur.task === 'doc') { U.toast(t('Pegue o cargue antes el documento')); return; } go(); },
    aiStop: () => { if (AI.cur && AI.cur.ctl) AI.cur.ctl.abort(); if (AI.cur) { AI.cur.stage = 'input'; draw(); } },
    aiManual: () => { if (AI.cur.task === 'doc' && !AI.cur.input.trim()) { U.toast(t('Pegue o cargue antes el documento')); return; } toManual(); },
    aiBack: () => { AI.cur.stage = 'input'; draw(); },
    aiCopy: () => { const ta = U.$('aiPrompt'); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => U.toast(t('Prompt copiado')), () => { if (!ok) U.toast(t('Seleccione el texto y cópielo con Ctrl+C')); }); else U.toast(ok ? t('Prompt copiado') : t('Seleccione el texto y cópielo con Ctrl+C')); },
    aiParse: () => { const A = AI.cur; try { finish(parseJSON(A.paste)); } catch (e) { A.stage = 'error'; A.err = errMsg(e); A.text = A.paste; draw(); } },
    aiItem: (d, el) => { AI.cur.res.items[+d.i].on = el.checked; },
    aiTarget: (d, el) => { AI.cur.target = el.value; },
    aiFile: async (d, el) => { const f = el.files && el.files[0]; if (!f) return; U.toast(t('Leyendo {n}…', { n: f.name }));
      try { const txt = await readFile(f); AI.cur.input = txt; draw(); U.toast(t('{n} caracteres cargados', { n: txt.length.toLocaleString() })); } catch (e) { U.toast(t('No se pudo leer el archivo. Copie y pegue el texto.')); } },
    aiApply: () => {
      const A = AI.cur, sel = A.res.items.filter(x => x.on);
      if (A.newOp) { U.store.ops.push(A.newOp); U.store.cur = A.newOp.id; }
      const o = U.op();
      sel.forEach(x => { try { x.apply(); } catch (e) { console.error(e); } });
      W.ensure(o); U.save(true); close(); U.render();
      U.toast(t('{n} elementos aplicados', { n: sel.length }));
    },
    aiCfg: () => { close(); U.go('ai'); },
    aiMode: (d, el) => { st().mode = el.value; U.save(true); U.render(); },
    aiKeySave: () => { const v = (U.$('aiKey') || {}).value || ''; if (setKey(v.trim())) U.toast(v.trim() ? t('Clave guardada en este navegador') : t('Clave borrada')); else U.toast(t('Almacenamiento bloqueado: la clave no se puede guardar')); U.render(); },
    aiKeyDel: () => { setKey(''); U.toast(t('Clave borrada')); U.render(); },
    aiBatch: async () => {
      /* Interpreta todas las COA y ECOA en cadena; aplica automáticamente y resume los avisos. */
      if (AI.mode() === 'manual') { U.toast(t('La interpretación en cadena necesita un proveedor automático. En modo manual, interprete cada COA por separado.')); return; }
      const o = U.op(), jobs = o.ecoas.map(e => ['ecoaPlan', { ecoa: e.id }, e.name]).concat(o.coas.map(c => ['coaPlan', { coa: c.id }, c.name]));
      const log = []; let i = 0;
      AI.cur = { task: 'coaPlan', prm: {}, stage: 'run', text: '', input: '', ctl: new AbortController() };
      for (const [k, prm, name] of jobs) {
        if (!AI.cur) break; i++;
        AI.cur.text = t('({i}/{n}) Interpretando {c}…', { i, n: jobs.length, c: name }); draw();
        try {
          const j = await run(TASKS[k].build(o, '', prm), { signal: AI.cur.ctl.signal, onText: u => { const pre = document.querySelector('#mbox .aiout'); if (pre) pre.textContent = '(' + i + '/' + jobs.length + ') ' + name + '\n' + String(u.text || '').slice(-1500); } });
          const r = TASKS[k].validate(o, j, prm); r.items.forEach(x => x.apply()); log.push('✓ ' + name + (r.warn.length ? ' — ' + t('{n} avisos', { n: r.warn.length }) : ''));
          r.warn.slice(0, 6).forEach(w => log.push('   · ' + w));
        } catch (e) { log.push('✗ ' + name + ' — ' + errMsg(e)); if (e && /cancelled|not_granted|rate_limited|http_401/.test(e.code || '')) break; }
      }
      W.ensure(o); U.save(true);
      if (AI.cur) { AI.cur.stage = 'error'; AI.cur.err = t('Interpretación terminada. Revise los planes en «Planes COA / ECOA».'); AI.cur.text = log.join('\n'); draw(); }
      U.render();
    }
  });

  /* =============================== SECCIÓN «IA» =============================== */
  U.R.ai = function () {
    const o = U.op(), s = st(), mode = AI.mode(), key = getKey(), local = window.self === window.top;
    let h = secH(t('Alimentar el planeamiento con IA'), t('Claude lee sus documentos, interpreta las COA y ECOA y apoya cada papel de la confrontación. Todo lo que propone se valida y se revisa antes de aplicarse; el cálculo de resultados sigue siendo el del motor empírico.'));
    h += `<div class="g2"><div>` + card(t('Proveedor de IA'),
      `<label class="fl">${t('Modo')}</label><select class="sl" data-ch="aiMode">${[['auto', t('Automático')], ['sample', AI.modeLabel('sample')], ['api', AI.modeLabel('api')], ['manual', AI.modeLabel('manual')]].map(x => `<option value="${x[0]}"${s.mode === x[0] ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>
       <p class="small">${t('En uso')}: <b>${esc(AI.modeLabel(mode))}</b></p>
       <ul class="small rl"><li>${AI.sample ? '<span class="tag ok">✓</span>' : '<span class="tag">—</span>'} ${t('Claude en claude.ai: disponible al abrir la app como artefacto publicado; pide permiso la primera vez.')}</li>
       <li>${key ? '<span class="tag ok">✓</span>' : '<span class="tag">—</span>'} ${t('API de Anthropic: para uso local (index.html). La clave se guarda sólo en este navegador y no se exporta.')}${local ? '' : ' <b>' + t('No disponible dentro del visor de artefactos.') + '</b>'}</li>
       <li><span class="tag ok">✓</span> ${t('Manual: siempre disponible. Copie el prompt en Claude y pegue la respuesta.')}</li></ul>
       ${local ? `<label class="fl">${t('Clave de API de Anthropic')}</label><div class="row nowrap"><input class="in" type="password" id="aiKey" autocomplete="off" placeholder="${key ? '••••••••' + esc(key.slice(-4)) : 'sk-ant-…'}"><button class="btn sm" data-a="aiKeySave">${t('Guardar')}</button>${key ? `<button class="btn sm danger" data-a="aiKeyDel">${t('Borrar')}</button>` : ''}</div>
       <label class="fl">${t('Modelo')}</label><input class="in" data-b="ai.model" data-s="st" value="${esc(s.model || MODEL)}">` : ''}
       <p class="small muted">${t('El contenido de la operación se envía a Claude para generar cada propuesta. No incluya información clasificada.')}</p>`, 'gold') +
      `</div><div>` + card(t('Desde un documento'),
      `<p class="small">${t('Orden de operaciones, CONOPS, IPOE, COA o guion de confrontación: la IA rellena operación, fases, sectores, orden superior, pasos 1–3, estimaciones, CPG y criterios, COA, ECOA, ORBAT, turnos, eventos críticos, registros y supuestos.')}</p>
       <button class="btn pri" data-a="aiOpen" data-k="doc">✦ ${t('Importar un documento')}</button>
       <p class="small muted">${t('Después, interprete los planes por turno de cada COA y ECOA (abajo).')}</p>`, 'blue') +
      card(t('Redactar con IA'), `<div class="row"><button class="btn" data-a="aiOpen" data-k="coaDraft">✦ ${t('Nueva COA propia')}</button><button class="btn" data-a="aiOpen" data-k="ecoaDraft">✦ ${t('Nueva COA enemiga')}</button><button class="btn" data-a="aiOpen" data-k="concl">✦ ${t('Conclusiones de la pareja activa')}</button></div>`) +
      `</div></div>`;
    const planned = p => Object.values(p || {}).filter(x => (x.eng || x.place || []).length).length;
    h += card(t('Interpretar COA y ECOA por turnos'),
      `<div class="tw"><table class="t ro"><thead><tr><th>${t('Línea de acción')}</th><th>${t('Texto')}</th><th class="num">${t('Turnos con plan')}</th><th></th></tr></thead><tbody>` +
      o.coas.map(c => `<tr><td><span class="side-b">BLUE</span> <b>${esc(c.name)}</b></td><td class="small">${esc(short(c.stmt, 140)) || '<span class="muted">' + t('sin enunciado') + '</span>'}</td><td class="num">${planned(c.plan)}/${o.turns.length}</td><td><button class="btn sm" data-a="aiOpen" data-k="coaPlan" data-coa="${esc(c.id)}">✦ ${t('Interpretar')}</button></td></tr>`).join('') +
      o.ecoas.map(e => `<tr><td><span class="side-r">RED</span> <b>${esc(e.name)}</b></td><td class="small">${esc(short(e.text, 140)) || '<span class="muted">' + t('sin descripción') + '</span>'}</td><td class="num">${planned(e.plan)}/${o.turns.length}</td><td><button class="btn sm" data-a="aiOpen" data-k="ecoaPlan" data-ecoa="${esc(e.id)}">✦ ${t('Interpretar')}</button></td></tr>`).join('') +
      `</tbody></table></div><div class="row"><button class="btn pri sm" data-a="aiBatch">✦ ${t('Interpretar todas en cadena')}</button><span class="small muted">${t('Primero las ECOA y después las COA, para que los enfrentamientos azules coincidan con el despliegue rojo.')}</span></div>`, 'gold');
    h += card(t('En la confrontación'), `<p class="small">${t('En cada turno, «Proponer con IA» juega la reacción roja, la contrarreacción azul, la justificación del árbitro y la aportación de cada función de EM según el rol activo. El resultado numérico lo sigue calculando el motor (Monte Carlo) y lo adjudica el árbitro.')}</p><button class="btn sm" data-a="go" data-t="wargame">→ ${t('Confrontación')}</button>`);
    return h;
  };

  /* Inicio: detecta el proveedor del visor sin bloquear la carga. */
  const boot0 = U.boot;
  U.boot = function () { boot0(); st(); AI.probe(); };
})(typeof window !== 'undefined' ? window : globalThis);
