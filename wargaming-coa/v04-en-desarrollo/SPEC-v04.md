# COA Wargaming Tool v0.4 «MESA» — Final implementation specification

Repository: `/home/user/PROYECTOS-CLAUDE/wargaming-coa` (static multi-file web app, no build step, vanilla JS with globals; opened as `index.html` locally **and** published as a claude.ai artifact).
Base: v0.3 (commit `dc851dc`). This document is the only design reference that implementers read besides the code. Wherever it quotes an existing function, line numbers refer to `dc851dc`.

Language rule for this document: prose and code in English; **every UI string is given in Spanish** (the source language of the app, `t()` keys) and its English translation is registered by the module that uses it (§8.3).

---

## 0. Decisions, scope and glossary

### 0.1 Decision summary

| # | Decision | Origin |
|---|---|---|
| D1 | **Four modes** around one persistent map: ① PLANO · ② SUPERPOSICIÓN · ③ CONFRONTACIÓN (sub-steps Método → Acotación y turnos → Jugar) · ④ CONCLUSIONES. Each mode shows **one panel, one question, one gold primary button** and a «Qué decide aquí / Qué falta» status. The COA pair is chosen once, in a header chip. | MESA modes + TABLERO guided rule |
| D2 | The map (`#stage`) and the time ruler are **mounted once** outside `#main` and never rebuilt by `U.render`; `U.render` delegates to `U.shell.render()`, which redraws panels and pushes new state objects to the two renderers. Data edits without `data-re` trigger a throttled soft refresh. | MESA |
| D3 | All 13 v0.3 sections (`U.NAV`) remain reachable, unchanged, in a **«Formularios»** sheet (legacy `#side` + `#main` + `#assist`), with deep links from every inspector. «Vista clásica v0.3» (`store.flow = false`) restores the v0.3 layout exactly. | MESA + TABLERO |
| D4 | **Strings stay canonical.** Times (`turn.time`, `phase.t`, `nai.time`, `dp.win`) and locations (`cm`, `nai.loc`, `tai.loc`, eng labels) are parsed; numbers and geometry are derived and memoised, never persisted. Only user decisions (overrides, keyframes, bounds) are stored. Drags rewrite the strings. | all three |
| D5 | Geometry is stored **normalised**: points/polygons in board space `[u,v] ∈ [0,1]²`, linear features as a **depth value `p`** in the doctrinal frame (p = depth along the attacker axis, q = lateral). One line drag cascades to every feature anchored to that line. | MESA + EJE/TABLERO |
| D6 | Line depth order from a **weighted precedence graph** (turn/phase/CE/NAI/TAI/plan texts, `A → B`, `A to B`, `A – B`; co-location `A / B` by union-find; `op.cm` order only as tie-break), even spacing p ∈ [.10,.90]. | MESA |
| D7 | Contact line **FLOT(t)** built from line pairs in turn titles and phase texts, running maximum; its inverse links **space ↔ time** for belts and avenues (lock icon to unlink). Box and critical-event bounds are event-timed. | MESA + TABLERO |
| D8 | Sync-matrix evolution is visible **out of the box**: empty `game.sync` cells are filled with lighter **auto actions** (fires from TAI→DP / HPT→phase / `mods.fires`; engineers from `mods.obst` / `delibDef` / `gapX`; intel from NAI windows; C2 from DP windows; personnel from engine losses; manoeuvre from engagements). They disappear as soon as the cell has text. | TABLERO + EJE |
| D9 | Steps inside a turn are **sequential, non-overlapping** sub-windows (red initiative: pre .00–.10, act .10–.40, rea .40–.70, cnt .70–.95, arb .95–1.00; blue initiative without pre: act .00–.35, rea .35–.65, cnt .65–.95, arb .95–1.00). The arb band is a *reading band* showing the state at `t1`. Labelled «convención de lectura», editable per op and per turn, two-way synced with `op.ui.wgStep`. Every engagement defaults to the **act** step (CATK included); `eng.step = 'cnt'` moves it. | MESA, fixed by judges |
| D10 | Lens classification **in / inf / edge / ctx / out**, «Fuera de la acotación: N enfrentamientos» chip, flank-threat markers, mandatory red hatching for unopposed red forces. The engine still adjudicates every planned engagement. | MESA + judges |
| D11 | Turn generation (Manual · Por fases · Por acciones clave · Por geometría) cuts **the chosen method's bound** and labels with that method's prefix. Preview = diff (mantener / actualizar / ya cubierto / nuevo / sin correspondencia) + overlap policy + **chain preview** + one-step undo. | MESA + TABLERO + EJE |
| D12 | Engine integrity: new split turns get **seeded plans for every COA and ECOA** plus a **loss share `turn.ls`** (default 1, bit-identical v0.3 results). Cross-method overlaps of > 1 h with chained turns get `sim:false` («no encadena bajas») by default. New turns are inserted chronologically; chain-order ≠ time-order and overlapping chained turns raise alerts, never silent re-sorting. | EJE + judges |
| D13 | Background images live in **their own localStorage key** `wgcoa.v3.img.<…>`, downscaled ≤ 1600 px JPEG q .72 (retries), inlined on export, extracted on import. The 350 ms debounced main save never re-serialises them. | TABLERO |
| D14 | Store envelope unchanged: localStorage key `wgcoa.v3`, `store.v === 3`, `op.v` stays `3`; the new block versions itself with `op.geo.v = 1`. | judges |
| D15 | Visual identity «Mesa de planeamiento con calcos» (MESA tokens), marginalia, APP-6 colours, inline-SVG icons; reduced-motion honoured. | MESA |
| D16 | MVP scope cut: calibration, radial task menu, multi-level undo/redo, feTurbulence texture, measuring tool, AI geo-placement, multi-snap bottom sheet → **v0.4.1**. Phone uses a simple fixed stack (map · always-visible scrubber strip · tabbed panel). | judges |

### 0.2 Out of scope for v0.4 (planned v0.4.1)

Two-point map calibration and scale bar in km; radial «Tarea» menu on units; multi-level undo/redo (v0.4 has single-level undo for the last geometry edit and the last turn-generation apply); grease texture filter; measuring tool; `WGAI.geo` «✦ Situar con IA»; snap-point bottom sheet; SVG/PNG export of the timeline (v0.4 exports the map SVG only); notes layer.

### 0.3 Glossary

| Term | Meaning |
|---|---|
| τ (tau) | Cursor time, real hours relative to H (H = 0; D±n = day n, §4.1). Stored in `op.ui.tau`. |
| board, `[u,v]` | Map sheet coordinates, `u` → right, `v` → down, both ∈ [0,1]. SVG user units: `x = 1000·u`, `y = H·v`, `H = 1000/aspect`. |
| p, q | Doctrinal frame: `p` depth along the attacker axis (0 = attacker start edge, 1 = attacker's final objective / defender rear), `q` lateral (0 = north edge for E/W axes, west edge for N/S axes). Mapped to `[u,v]` by `op.geo.axis` (§4.7). |
| attacker / defender | The side whose axis defines `p` (`axis.att`). TRYZUB: red attacks from the east. MAR AZUL: blue attacks from the west (sea). |
| FLOT(t) | Planned contact line depth `p` as a monotone function of time (§4.10). Labelled «Línea de contacto (prevista)». |
| CM | Control measure: a string of `op.cm` (e.g. `"PL 4"`, `"EA1"`). Its geometric feature has `ref = 'cm:' + string`. |
| Feature | Drawable geometry object (§6.3). |
| Action | Anything that happens in a time window and (usually) a place: engagement, red placement, plan text, sync cell, NAI, TAI, DP, HPT, CE (§4.17). |
| Bound («acotación») | Space × time window that a wargame method plays (§4.20). |
| Lens | The bound applied to the map and ruler (mask, classes) while a method or a turn is open. |
| Chained turns | `E.activeTurns(op)` with `sim !== false`, in `op.turns` array order — exactly what `E.runPath` uses to carry losses forward. |
| Acetate («calco») | Map layer group (base, cm, red, blue, isr, sync, method, adj). |

---

## 1. Goals and user journey

### 1.1 Goals (traceable to the user request)

| Goal | User sentence | Delivered by |
|---|---|---|
| G1 Simpler for the human mind | «mucho más sencilla de manejar para la mente humana» | 4 modes, one question and one gold button per screen, the pair chosen once, forms only for the selected object, plain-language HUD sentences, fixed colour semantics. |
| G2 Visually evolved | «visualmente mucho más evolucionada en cuanto a entorno gráfico» | Map-centred planning table with acetates, APP-6, marginalia, animated time, dark «Mesa nocturna». |
| G3 COA on the map | «contemple sobre plano la COA» | ① PLANO «Plan completo»: the COA sketch with numbered axes per turn and time labels, auto-derived from the plan. |
| G4 Sync-matrix evolution visible per method and per moment of the turn | «ver la evolución de las acciones que contempla la synchromatrix … en cada momento del turno» | Function lanes on the ruler + function glyphs on the map, both driven by τ; step bands inside each turn; auto actions when cells are empty. |
| G5 Overlay | «se superponen y se ven las líneas temporales, los NAIs y las COAs roja y azul» | ② SUPERPOSICIÓN: both COAs at τ, NAIs/TAIs/DPs by time state, contact line, lanes. |
| G6 Method bounds terrain/time and builds turns | «se elige el método … el sistema acota … mostrando las acciones … estableciendo turnos (manual o en base a las fases o acciones clave)» | ③ CONFRONTACIÓN: method cards with recommendation → automatic bound (map mask + ruler window, linked through FLOT) → in-bound actions list → turn generation Manual / Por fases / Por acciones clave / Por geometría → play turns step by step on the map. |

### 1.2 Interaction rules (apply to every screen)

1. **One question, one decision, one gold button** («CTA»). The CTA is always the last element of the mode panel, sticky at its bottom; when disabled it shows the reason in one line (e.g. «Elija una COA enemiga»).
2. **«Qué decide aquí»** (one sentence) and **«Qué falta»** (≤ 5 checklist rows, each clickable to fix it) at the top of every mode panel, computed by `U.FS[mode]()` (§6.6).
3. Nothing has to be drawn or typed before seeing a result: geometry, times, bounds and turns are proposed; the user corrects.
4. Fixed colour semantics everywhere (map, ruler, HUD, forms): blue = own, red = enemy, amber = now/contact, purple = ISR (NAI/TAI), gold = decision (DP) and main effort, method colours for bounds. Results keep the v0.3 `res-*` classes.
5. Forms only for the selected object (right «Detalle» drawer). Full forms live in «Formularios».
6. Derived things are labelled as such: map watermark «ESQUEMA — NO A ESCALA», «trayectoria automática», `auto` badges, dotted outline + «?» for low-confidence features, «convención de lectura» on the step bar.
7. Every drag has a non-drag alternative (select / number input) for phones and accessibility.

### 1.3 Global layout and navigation

```
┌ header #top (48 px; phone 44) ───────────────────────────────────────────────────────────┐
│ [WG] #opSel(title)  │ #modes ① PLANO ② SUPERPOSICIÓN ③ CONFRONTACIÓN ④ CONCLUSIONES │ #pair │ ES/EN │ ⋯ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
┌ #app.sh-app ─────────────────────────────────────────────────────────────────────────────┐
│ #dl  mode panel  │ #stage  (persistent)                               │ #dr  Detalle      │
│ (340 px)         │  #map (WGMap)   #hud (Situación a τ)   #stools     │ (360 px, only     │
│ Qué decide aquí  │                                                    │  when something   │
│ Qué falta        │                                                    │  is selected)     │
│ … content …      ├────────────────────────────────────────────────────┤                   │
│ [CTA gold]       │ #db  time ruler: #tl (WGTimeline, persistent) + #dbx (matrix, full only) │
└──────────────────┴────────────────────────────────────────────────────┴───────────────────┘
#forms (overlay sheet, hidden by default): [sh-forms-bar «Formularios · <sección> · ✕ Volver al plano»] #side #main #assist
#modal, #toast (unchanged)
```

**Header** (`#top`, dark chrome):
- `WG` logo; `#opSel` styled as the title (operation selector, unchanged id); `#opTitle` and `#opTag` stay in the DOM (visually hidden in shell mode) because `renderHeader()` writes them.
- `#modes`: four buttons `data-a="shMode" data-t="plano|superposicion|confrontacion|conclusiones"`, numbered ①–④, label + badge (`data-testid="mode-<id>"`):
  - ① «PLANO» badge: readiness `U.prepReadiness().pct` + «%», or «N por revisar» when the layout review list is non-empty.
  - ② «SUPERPOSICIÓN» badge: «COA 1 × ECOA-1».
  - ③ «CONFRONTACIÓN» badge: «k/N» adjudicated active turns (same count as v0.3 nav badge).
  - ④ «CONCLUSIONES» badge: «FACDS k/5».
- `#pair` chip (`data-testid="pair"`): «AZUL» `fSel('prep.coa', O.coa(), 'self')` × «ROJO» `fSel('prep.acoa', O.ecoa(), 'self')`; a ghost toggle «Comparar con…» (select of the other ECOAs, `op.ui.cmpEcoa`). This is the **only** place the pair is chosen in the new UI.
- ES / EN segmented buttons (existing `data-a="lang"`).
- `⋯` menu (`data-a="shMenu"`, popover `#shMenu`): «Exportar operación (.json)» (`exportOp`), «Exportar copia completa» (`exportAll`), «Importar…» (`importOpen` + existing `#imp`), «Exportar plano (.svg)» (`msExportSvg`), «Imprimir DSO» (`msPrintDso`), «Formularios» (`shForms`), «Rol activo» (existing `#roleSel` moved here), «Tema: Automático · Día · Noche» (`shTheme`), «Asistente de IA» (`go` → `ai`), «Vista clásica v0.3» (`shClassic`), «Datos y método» (`go` → `data`). `#asBtn` and `#printBtn` remain inside the menu (referenced by `renderHeader`). `#saveState` stays visible at the right of the header (dot + time).

**Mode panel** `#dl` (left, 340 px; collapsible to a 44 px rail with the mode number and the CTA icon): rendered from `U.P[mode + '.l']`.

**Stage** `#stage`: `#map` (WGMap root), `#hud` (top-right overlay, collapsible, `U.P.hud`), `#stools` (bottom-right: «＋», «−», «Ajustar» (fit), «Capas» popover, «Lectura: Instante | Plan completo» segmented). The map is never re-created.

**Detail drawer** `#dr` (right, 360 px): opens when something is selected on the map, the ruler or a list; content from `U.P.detail(sel)`; «✕» closes and clears the selection. On tablet it overlays the map; on phone it becomes the «Detalle» tab.

**Time ruler** `#db` (bottom): three heights, `op.ui.drawers.b`: `strip` (64 px: controls + scale + phase and turn ribbons + cursor), `lanes` (260 px: all lanes, §5.2), `full` (70 vh: lanes + editable synchronisation matrix `#dbx`, `U.P.matrix`). A tape handle «▲/▼» cycles the heights.

**Formularios** sheet `#forms`: full-height overlay listing the v0.3 sections (unchanged `U.renderNav()` in `#side`), rendering `U.R[store.sec]()` into `#main`, and the existing assistant in `#assist`. Opened from `⋯`, from any «Editar en formulario» link, and by every legacy `U.go(id)` call. Bar: «Formularios · <section label> · ✕ Volver al plano».

### 1.4 The four modes

#### ① PLANO — «¿Dónde y con qué?» (`plano`)

- **Qué decide aquí**: «Compruebe la COA sobre el plano y corrija el esquema si hace falta.»
- **Map preset**: read mode «Plan completo» (static COA sketch: every turn's blue graphics at once with sequence badges ①②③ in chained order and a mono time label at each arrow tail, e.g. «H → H+12»; units at their start positions); layers base, cm, blue, isr (light); red off (toggle «Mostrar la ECOA»).
- **Ruler preset**: `strip`.
- **Panel content** (top to bottom):
  1. Banner (`data-testid="layout-banner"`): «Esquema generado automáticamente a partir de {n} medidas de control · {a} situadas · {b} por confirmar · {c} sin situar» + button «Revisar» (scrolls to item 4).
  2. COA card: name, statement (3 lines), «{k}/{N} turnos con plan» or amber «sin plan por turnos» (e.g. TRYZUB COA 2) with «✦ Interpretar con IA» (`aiOpen` k=`coaPlan`) and «Editar plan» (forms `plans`).
  3. ECOA card (same, red) with MLCOA/MDCOA tag and likelihood; «Mostrar la ECOA en el plano» checkbox (`op.ui.layers.plano.red`).
  4. «Revisar ubicación» list (`data-testid="review-list"`): low-confidence (`conf < .5`) and unresolved items. Each row: name, reason («sin menciones», «ubicación deducida de 1 texto»), «Situar en…» (two selects: sector + line/CM, writes an override, §4.14), «Confirmar» (sets `conf = 1` via override `{ok:true}`), «Ir» (fly to).
  5. «Editar plano» toggle (`data-a="msEdit"`, `data-testid="edit-toggle"`). When on: tool row «Seleccionar/mover · Línea · Área · Punto · NAI» (`msTool`), «Fondo: Esquema | Imagen…» (`msBgUpload`, `msBgClear`, opacity slider `op.geo.bg.op`), «El atacante viene del: E ▾» (axis override, `msAxis`), «Restablecer todo el esquema» (`msResetAll`, asks confirmation), «Deshacer» (`msUndo`, single level).
  6. Links row «Formularios: Datos · ORBAT · Planes · Registros · IA».
  7. First-run card (TRYZUB only, until `store.coach.demo`): «▶ Ver el ejemplo animado (20 s)» (`shDemo`, §1.5).
- **Qué falta** rows: «Elija la COA azul y la roja» (blocking); «Sin medidas de control: añádalas en Datos o dibújelas en «Editar plano»» (when `op.cm` is empty); «La COA azul no tiene enfrentamientos por turno» (→ `plans`); «La ECOA no tiene despliegue por turno» (→ `plans`); «{n} elementos por confirmar en el esquema» (info); «Fuerzas sin posición inicial: {n}» (info → `prep`).
- **CTA**: «Continuar: Superposición →» (`shMode` t=superposicion); disabled without COA or ECOA.
- **Advanced**: everything non-spatial (HHQ order, steps 1–3, estimates, CPG, criteria, ORBAT paste import) stays in Formularios.

#### ② SUPERPOSICIÓN — «¿Qué pasa en cada momento?» (`superposicion`)

- **Qué decide aquí**: «Mueva el cursor de tiempo y lea qué hacen la COA azul y la roja en cada momento.»
- **Map preset**: «Instante»; layers base, cm (+ contact line), red, blue, isr, sync, adj. Optional ghost ECOA (hollow magenta frames). «Niebla» available when the active role is the blue cell.
- **Ruler preset**: `lanes` (260 px) with Fases, Turnos, Enemigo, Maniobra (per sector), Inteligencia (NAI), Decisión (DP), Funciones (collapsed group, 9 rows), Potencia.
- **HUD** «Situación a H+08» (§4.18) top-right; phone ticker.
- **Panel content**:
  1. «Lectura» (`data-testid="reading"`): the full Situation (header + sections Azul / Rojo / Contrarreacción / Vigilancia y decisión / Funciones / Potencia / Alertas). Every line is a link (`msSel`) that selects and flies to its object.
  2. Layer chips: «Azul · Rojo · NAI/TAI · DP · Funciones · Contactos · Línea de contacto» (`msLayer`), and per-function toggles inside «Funciones ▸».
  3. «Comparar con ECOA-2 (fantasma)» (same as the pair chip ghost), «Niebla (célula azul)» (`msFog`, visible only when `U.roleCell() === 'blue'` or the cell selector is blue).
  4. «Acciones activas ahora» (compact list, ≤ 12, time chips; tapping selects).
- **Qué falta**: «{k}/{N} turnos con tiempo reconocido» (→ turn detail with parse chip); «Sin NAI: dibuje un área para crear una NAI» (MAR AZUL; → ① edit tool NAI); «{n} DP sin ventana»; «Matriz de sincronización: {a} celdas con texto · {b} automáticas» (info → ruler `full`).
- **CTA**: «Continuar: elegir método →» (`shMode` t=confrontacion).

#### ③ CONFRONTACIÓN — «¿Qué ocurre si…?» (`confrontacion`)

Stepper at the top of the panel: «1 Método · 2 Acotación y turnos · 3 Jugar» (`op.ui.lens.sub` = `metodo|acotacion|jugar`, `data-a="lnSub"`).

**3a Método**
- Qué decide aquí: «Elija cómo se va a jugar: el sistema acota el terreno y el tiempo.»
- Up to five cards (`data-testid="method-<m>"`), each: method glyph, Spanish name, the doctrinal sentence (`U.METHODS[m].d`), the system verdict ribbon («Recomendado» / «Adecuado» / «Poco adecuado») with its reasons (§4.22), the number of existing turns, and a mini preview: hovering/tapping a card draws its auto bound on the map (mask + outline) and on the ruler.
  - «Eventos críticos», «Fajas», «Caja», «Avenida en profundidad».
  - «Secuencia combinada (actual)» — shown when two or more methods already have active turns (TRYZUB): plays `E.activeTurns(op)` as in v0.3, each turn with its own method lens.
- Choosing a card sets `op.prep.mActive = m` (UI lens only; **`prep.methods` is not changed silently**). If the chosen method is disabled in `prep.methods`, the card shows «Método desactivado en Preparación» + button «Activar» (`lnActivate`, explicit).
- CTA: «Acotar con «{método}» →».

**3b Acotación y turnos**
- Qué decide aquí: «Ajuste la acotación y cree los turnos que se van a jugar.»
- Map: bound outline in the method colour with handles, mask outside (§5.4). Ruler: window shaded outside `[t0,t1]`, bracket handles.
- Panel:
  1. Summary (`data-testid="bound-summary"`): «Acotación: PL 1 → PL 3 · H → H+24 · {n} acciones dentro (Azul {b} · Rojo {r} · NAI {i} · DP {d} · Funciones {f}) · {o} fuera». Chips «Fuera de la acotación: {k} enfrentamiento(s) ({sectores})», «Amenaza de flanco: {k}», «Entradas: KOZHUMIAKA entra H+60 (O)».
  2. Controls per method (all with select/number alternatives to the handles):
     - Fajas: «Desde [línea ▾]  Hasta [línea ▾]», «Sectores» chips, time «H [ ] → H [ ]» (read-only while linked), lock «Vincular terreno y tiempo» (`lnLink`).
     - Avenida: «Avenida [AA Z11 ▾]», «Desde / Hasta» lines, «Anchura» slider (0.4–1.0 × sector width), lock.
     - Caja: chips of the box CMs with «×», «＋ Añadir elemento ▾» (candidate list with scores), time inputs (event-timed; lock off by default).
     - Eventos críticos: CE checklist (writes `prep.ceSel`) and DP checklist (writes `prep.dpSel`), time read-only (union).
     - «Restablecer automático» (`lnBoundReset`).
  3. «Acciones dentro de la acotación» grouped list (Enfrentamientos · Unidades · NAI · DP · Celdas de sincronización), each with its class badge (dentro / influencia / borde / contexto).
  4. «Turnos» segmented control (`data-testid="gen-mode"`): «Manual · Por fases · Por acciones clave · Por geometría» (`lnGenMode`). Selecting a mode immediately shows the **inline preview** (§4.24): ghost bars on the ruler, ghost bounds on the map, diff rows with checkboxes, orphan choices, overlap policy, chain preview, notes (e.g. MAR AZUL: «Sin eventos críticos ni DP: se proponen a partir del esfuerzo principal y de las fases. Defina eventos críticos y DP.»).
  5. Existing turns of this bound (chips sorted by time, method colour, result tag).
- CTA: if the preview has changes: «Aplicar {n} cambios» (`lnGenApply`); else «Jugar «{label}» →» (opens the first non-adjudicated turn of the bound, `lnTurnOpen`). Disabled reason: «La acotación no contiene turnos».

**3c Jugar**
- Qué decide aquí: «Juegue el turno paso a paso: acción, reacción, contrarreacción y árbitro.»
- Turn chips (sorted by time, method colour, result tag, «no encadena» notch when `sim:false`).
- Step bar over the map and mirrored on the ruler: «Pre-acción roja · Acción azul · Reacción roja · Contrarreacción azul · Árbitro» (no pre with blue initiative), each with its sub-window («Acción azul · H+1:12 → H+4:48»). Tooltip: «Convención de lectura: los pasos se representan sobre la ventana del turno».
- Header line: «{label} — {title} · {time} · {method} · {CE} {DC}» + method reading rule (§5.4) + «⏱ 45 min» when the time string carries a session budget.
- Worksheet for the **current step only** (§5.4 table) in the panel; «Ver las tres células» opens the classic v0.3 turn view in Formularios at this turn.
- Map: contact markers → adjudication callouts (§5.4); DP prompt in cnt; arb shows outcomes, losses, strength rings.
- CTA: «Siguiente paso» → … → «Cerrar turno y pasar al siguiente» → after the last turn «Ir a Conclusiones →». When the turn has no result at arb: the CTA first proposes «Aceptar resultado del motor: {res}» (`lnAcceptEngine`).

#### ④ CONCLUSIONES — «¿Qué COA y por qué?» (`conclusiones`)

- Qué decide aquí: «Revise los resultados y complete la evaluación de la COA.»
- Map preset «DSO»: lines, EAs, OBJs, NAIs and TAIs with window labels, DPs with window labels and state, turn outcome flags at each main-effort anchor; units off.
- Ruler preset `lanes` filtered to Turnos, Decisión, Inteligencia, Resultado/Potencia (the DSM view).
- Panel: KPI row (from `U.record()`: «Turnos adjudicados», «Turnos con éxito», «Coincidencia árbitro / motor», «DP activados», «CCIR respondidos»); DSM table «DP · Decisión · NAI · CCIR · Ventana · Estado · Comprobación» with the checks of §4.19; FACDS summary (k/5) with link; links «Resumen y evaluación completo» (forms `results`), «Análisis estadístico» (forms `stats`).
- CTA: «Exportar…» (popover: JSON, CSV de la hoja de trabajo (`csv`), plano SVG (`msExportSvg`), Imprimir DSO (`msPrintDso`)).

### 1.5 First run and coach marks

- A fresh store (no `wgcoa.v3` key) opens TRYZUB in ① PLANO, «Plan completo», with the first-run card. Existing v0.3 stores open in ① with a one-time toast «Nueva interfaz v0.4 · la vista clásica está en ⋯» (`store.coach.v04`).
- «▶ Ver el ejemplo animado (20 s)» (`shDemo`): switches to ②, sets τ = range.t0 (H−24), plays at 1.6 h/s, stops at H+8 (BELT 1, reacción roja) and shows one coach bubble anchored to EA1: «Pulse una flecha, una NAI o un DP para ver qué ocurre». Sets `store.coach.demo = true`.
- Three dismissable coach marks (`store.coach.tips`): on the banner («Esquema generado a partir de sus medidas de control: arrastre o use «Situar en…» para corregir»), on the ruler («Arrastre el cursor o pulse ▶ para ver la evolución»), on ③ («Elija un método para acotar el terreno y el tiempo»).

### 1.6 Formularios and deep links

`U.shell.openForms(sec, opts)` (§6.6) maps:

| From | Opens | opts applied before render |
|---|---|---|
| Unit detail «Editar en formulario» | `orbat` | `op.ui.selU = unitId` |
| Engagement / turn plan | `plans` | `op.ui.planTurn = tid` |
| Turn «Ver las tres células» | `wargame` | `op.ui.wgView='turn'`, `op.ui.wgM='all'`, `op.ui.wgTurn = index of tid in E.activeTurns(op)`, `op.ui.wgStep = step index` |
| NAI / TAI / DP / HPT / CCIR | `reg` | `op.ui.regTab = 'nai'|'tai'|'dp'|'hpt'|'ccir'` |
| Phase / sectors / CM list | `inputs` | `op.ui.inTab = 'op'` |
| Positions | `prep` | — |
| Sync matrix (table view) | `results` | — |

### 1.7 Phone (≤ 760 px; target 390 × 844)

- Viewport-locked grid (`height: 100dvh`, page never scrolls, never scrolls horizontally): header 44 px (logo, mode icons ①–④ with 2-letter labels, `#pair` collapsed to «C1×E1 ▾», `⋯`) / `#stage` 46 dvh / scrubber strip 56 px (always visible: ▶, τ readout «H+08 · Reacción roja», cursor track) / tabbed panel `1fr` with internal scroll: tabs «Paso» (mode panel), «Ahora» (reading; ③: worksheet), «Detalle», «Bandas» (lanes with internal horizontal scroll).
- HUD becomes a one-line ticker over the map: «H+08 · BELT 1 · Reacción roja · DP-B1 abierto».
- Touch: tap = select, long-press 350 ms = drag (units, handles, vertices), one finger on empty map = pan, two fingers = pinch zoom; all targets ≥ 44 px; handles 24 px drawn with 44 px hit areas.
- Every drag has an alternative: «Situar en…» selects, «Desde/Hasta» line selects, numeric H± inputs, «＋ Turno aquí».

### 1.8 Keyboard (ignored while focus is in an input, textarea or select)

`1`–`4` modes · `Space` play/pause · `←`/`→` −/+1 h (`Shift` ±6 h) · `Alt+←/→` previous/next event edge (turn, step, DP, NAI) · `[`/`]` previous/next turn (③) · `,`/`.` previous/next step (③ 3c) · `L` layers popover · `F` fit · `E` edit toggle (①) · `Esc` clear selection / close popover / close forms · `Ctrl+Z` single-level undo (geometry edit or last apply) · `?` shortcut help.

### 1.9 Roles and cells (roles.js unchanged)

- `U.roleCell()` = `'red'` → map hides the blue acetate, blue lanes and blue texts; worksheet shows red fields only.
- `'blue'` → red texts hidden until the reaction step; with «Niebla» on, red units visible only inside active NAI windows or in contact, otherwise a hollow «última posición conocida» diamond with a time tag (§4.16).
- Staff roles (`cell: 'staff'`) see their function lane highlighted and the `U.rolePanel(o, g, tt)` box in cnt/arb of 3c; input goes to `game.sync[fn][tid]` and appears immediately as a bar and a glyph.
- White cell / no role: everything.

---

## 2. Visual identity

### 2.1 Concept — «Mesa de planeamiento con calcos»

A map sheet lies on a dark olive planning table; everything the staff adds lives on transparent acetates; the time ruler is a drafting scale along the bottom edge; amber «grease pencil» marks *now*. Flat paper, 1 px ink rules, 4 px corners, military marginalia. **No** gradients, glass blur, pastel blobs or emoji in the new chrome (v0.3 emoji stay inside Formularios).

### 2.2 Design tokens (`css/shell.css`, owner: shell agent)

Use exactly this three-block pattern (same as `app.css`). Every new CSS file uses only these tokens.

```css
:root {
  /* table, sheet and terrain (light «Mesa de día») */
  --table:#2A322D; --paper:#EEEADF; --paper-2:#E3DDCE; --margin:#D9D1BE; --grid:#C8BEA6;
  --contour:#CBBD9C; --veg:#D2DBBF; --water:#B5CFD6; --water-ink:#3E7282; --urban:#D7CBBD; --road:#B8AD96;
  /* control-measure ink */
  --cm:#1B1F1D; --cm-2:#4E5550;
  /* chrome: header, rails, mode bar */
  --chrome:#1E2622; --chrome-2:#28332D; --chrome-line:#3A4740; --chrome-ink:#E3E8E0; --chrome-mute:#9AA79E;
  /* panels and text */
  --sheet:#FAF8F2; --sheet-2:#F1EEE5; --sheet-line:#DAD3C3; --ink:#1B211E; --ink-2:#4A5550; --ink-3:#78827C;
  /* sides (APP-6) */
  --friend:#1F5FA8; --friend-fill:#80E0FF; --friend-wash:rgba(31,95,168,.08);
  --hostile:#BF1E2E; --hostile-fill:#FF8080; --hostile-wash:rgba(191,30,46,.08); --mdcoa:#A3156B;
  /* now, selection, ISR, decision */
  --contact:#D97A00; --sel:#0B8F8F;
  --nai:#5E3F8F; --nai-wash:rgba(94,63,143,.10); --tai:#A44A1F; --dp:#B88A00; --dp-fill:#F4D35E;
  /* methods */
  --m-critical:#4A5560; --m-belt:#0F6E6E; --m-box:#9C4A1A; --m-avenue:#34418F;
  /* misc */
  --mask:rgba(22,26,24,.55); --tape:#E7DCAD; --halo:#EEEADF;
  /* legacy remap so Formularios inherits the new look (app.css keeps the originals) */
  --navy:var(--chrome); --navy-2:var(--chrome-2); --navy-ink:var(--chrome-ink); --navy-mute:var(--chrome-mute);
  --bg:#EFEDE6; --card:var(--sheet); --surface-2:var(--sheet-2); --line:var(--sheet-line);
  --r:4px; --fs-xs:11px; --fs-s:12.5px; --fs:13.5px; --fs-l:15px;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --table:#070A08; --paper:#141917; --paper-2:#19201C; --margin:#0F1311; --grid:#26302A;
  --contour:#2C352F; --veg:#19251F; --water:#10242A; --water-ink:#5FA3B5; --urban:#22262A; --road:#343B36;
  --cm:#D9DED6; --cm-2:#9EA8A1;
  --chrome:#0B0F0D; --chrome-2:#131916; --chrome-line:#222B26; --chrome-ink:#D7DED6; --chrome-mute:#7E8B83;
  --sheet:#161C19; --sheet-2:#1C2420; --sheet-line:#29332D; --ink:#E1E6DE; --ink-2:#AEB8B0; --ink-3:#7F8A83;
  --friend:#6CB1FF; --friend-wash:rgba(108,177,255,.10); --hostile:#FF6B6B; --hostile-wash:rgba(255,107,107,.10); --mdcoa:#F07AC0;
  --contact:#FFB13D; --sel:#3FD0D0;
  --nai:#B9A2E8; --nai-wash:rgba(185,162,232,.12); --tai:#E58A5C; --dp:#F2C94C; --dp-fill:#5C4A12;
  --m-critical:#A9B4C0; --m-belt:#45C2C2; --m-box:#E08A55; --m-avenue:#8E9BFF;
  --mask:rgba(0,0,0,.62); --tape:#5A5236; --halo:#141917; --bg:#0F1311;
  color-scheme:dark;
} }
:root[data-theme="dark"] { /* identical copy of the dark block above */ }
body { background: var(--bg); }           /* explicit background, both themes */
body.sh-on { background: var(--table); }  /* shell mode */
```

APP-6 fills `--friend-fill #80E0FF` / `--hostile-fill #FF8080` stay standard in both themes (`WGCat.sym` hard-codes them); in dark mode symbols get a 1 px `--halo` outline (`paint-order: stroke`) so frames read on dark paper.

Theme control: `store.theme ∈ 'auto'|'light'|'dark'`; boot and `shTheme` set `document.documentElement.dataset.theme` (`removeAttribute('data-theme')` for `auto`).

### 2.3 Typography (Google Fonts already loaded in `index.html`; no new requests)

| Use | Font | Size / style |
|---|---|---|
| Map lettering (PL/EA/OBJ labels, sector watermarks), mode bar, headings, primary buttons | Barlow Condensed 600/700 | uppercase, letter-spacing .05em; map labels 11–12 px **constant on screen**; sector watermark 28 px at 12 % opacity |
| UI text | IBM Plex Sans 400/500/600 | 13.5 px body, 12.5 px small, 11 px micro |
| Every time, ratio, grid reference, ID | IBM Plex Mono 400/600 | `font-variant-numeric: tabular-nums`; «H+08», «1 : 1.20», «H6», «NAI-4» |

### 2.4 Layout grid

| Width | Grid | Notes |
|---|---|---|
| ≥ 1280 px | `grid-template-columns: 340px minmax(0,1fr) auto; grid-template-rows: minmax(0,1fr) auto;` (`#dl` / `#stage`+`#db` / `#dr` 360 px when open) | header 48 px; whole app `height: calc(100dvh - 48px)` |
| 1100–1279 | `#dl` 300 px; `#dr` 340 px | |
| 760–1099 (tablet) | `#dl` 300 px docked (collapsible to 44 px rail); `#dr` overlays the stage from the right (`position:absolute`, shadow-less, 1 px rule) | |
| ≤ 759 (phone) | single column `44px 46dvh 56px 1fr` (header / stage / strip / tabbed panel) | §1.7 |

The sheet sits on `--table` inside a 1 px `--cm` frame with a 24-unit margin band for marginalia. Panels are paper sheets (`--sheet`) docked to the edges with a 12 × 28 px `--tape` tab as collapse handle. Gutters 12 px desktop, 16 px phone side gutters.

### 2.5 Component language (`sh-` classes, shell.css)

- **Mode panel** `.sh-panel`: heading (Barlow 20 px), «Qué decide aquí» line (`--ink-2`), «Qué falta» list `.sh-todo` (rows with ✓ / • / ! glyph; clickable), content, sticky footer `.sh-cta` with one gold button `.sh-btn.gold` (condensed uppercase, e.g. «CONTINUAR: SUPERPOSICIÓN →») + reason line `.sh-why`.
- **Buttons**: one gold primary per panel; secondary outlined `.sh-btn`; tertiary as text links `.sh-link`.
- **Time chips** `.sh-time`: mono, 1 px border, 4 px radius, dot for the current step.
- **Step bar** `.ln-steps`: flat segments tinted red / blue / red / blue / paper-gold; current filled, finished ticked «✓».
- **Method badge**: 3 px left bar in the method colour; method glyphs (critical = row of three diamonds, belt = stacked bands, box = square with corner ticks, avenue = chevron in a corridor).
- **Acetate row** (layers popover): 28 px diagonally hatched swatch in the layer tint, eye toggle, label.
- **Map callouts**: leader line + square box with 1 px ink border (overlay-annotation style, not speech bubbles), `--sheet` fill at 96 %.
- **Status**: thin 3 px left bars (ok / warn / bad / info), not filled boxes. `auto` badge: dotted border, `--ink-3`.
- **Parse chip** `.sh-parse` next to every time input (§6.7.6): «✓ H+12 → H+24 · 12 h» (ok), «≈ H+46 → H+50» (approx), «⚠ no reconocido» (bad) with tooltip of the rule used.

### 2.6 Icons

`U.ic(name, size=16)` (ui-shell.js) returns an inline-SVG stroke icon (`stroke: currentColor; stroke-width:1.5; fill:none`, viewBox 0 0 16 16). Required set: `eye, eye-off, layers, play, pause, step-back, step-fwd, skip-back, skip-fwd, pencil, polygon, line, point, nai, hand, fit, plus, minus, upload, reset, undo, lock, unlock, target, flag, burst, obstacle, supply, cross, scales, megaphone, house, umbrella, shield, chevrons, diamond, star, clock, warn, check, close, menu, sun, moon, auto`. Function glyphs on the map use the same drawings at 18 px (`WGMap.GLYPH[fn]`): c2 flag, intel eye, man chevrons, fires burst, eng obstacle zig-zag, info megaphone, cimic house, sust supply crate, pers medical cross, prot umbrella (or shield), legal scales.

### 2.7 Map cartography

| Element | Style |
|---|---|
| Paper | `--paper`; lateral sectors alternate `--paper` / `--paper-2`; sector id watermark (Barlow 700, 28 px screen, 12 % `--cm`) |
| Relief (schematic) | 3 seeded relief centres + every `hill` CM, each 3 concentric smoothed closed curves (radius noise ±18 %), `--contour` 1 px, 60 % opacity; toggle «Relieve» |
| Vegetation | 4–6 seeded blobs, `--veg` fill, no stroke, avoiding features (≥ .04 from any feature) |
| Water | sea polygon `--water` + coastline `--water-ink` 1.4 px (amphibious); river/canal sinuous polyline `--water` 6 px under a `--water-ink` 1 px edge, through crossing points |
| Urban | rounded rects with 45° hatching `--urban`/`--cm-2` at 30 % |
| Roads | avenue centrelines `--road` 2 px |
| Sector boundary | dash-dot `--cm-2` 1 px (`stroke-dasharray: 10 3 2 3`) |
| Phase line / LD / BHL / beachhead line | `--cm` 1.6 px; BHL long dash `12 4`; beachhead line double (two 1 px strokes 3 px apart); boxed label «PL 4» at both ends (Barlow 600, 11 px, 1 px border, `--paper` fill) |
| Red line | `--hostile` 1.4 px dashed `8 4`, label «RL 2» |
| EA | closed irregular line `--cm` 1.4 px, 4 % fill, label «EA1» |
| BP | «U» glyph opening toward the attacker, `--friend` 1.6 px (defender BP) |
| OBJ | closed line `--cm` 2 px, label «OBJ ALFA» |
| Area (AMA, assembly) | rounded rectangle `--cm-2` dotted 1 px |
| Hill | triangle ▲ + spot height text («247») |
| Crossing | double bar across the river, label |
| Beach | coast segment 4 px `--dp-fill` at 60 % + label «PLAYA VERDE» |
| LZ / ZD | circle with «H» or «ZD» |
| Off-board | edge marker: arrow pointing out of the sheet + label («Corps depth») |
| NAI | `--nai` 1.4 px dashed `6 4`, `--nai-wash` fill; active = solid + slow pulse; TRIGGERED = `--dp` outline; out of window / INACTIVE = 12 % ghost |
| TAI | `--tai` solid 1.4 px + crosshair at centroid; shown during its DP window |
| DP | gold diamond (`--dp`, 14 px) at the centroid of its NAI (or at the main-effort anchor when it has no NAI), progress ring = elapsed fraction of the window |
| HPT | crosshair on the target unit during cnt |
| Units | APP-6 symbol 28 px (screen), 1 px `--halo` outline, strength ring (arc coloured by `cfg.statusBands`, FFIR tick for blue), main effort gold halo, label (quoted call sign or `U.uname`, ≤ 14 chars) |
| Blue graphics | `--friend`: axis of advance = outlined arrow (fill 15 %), block = T-bar, delay = arrow with «R», screen = line with «S», withdraw = arrow with «W», CATK = curved dashed arrow «CATK», gap crossing = arrow across the river, air assault = dashed axis with rotor glyph, amphibious = axis from the sea with wave ticks, fix = zig-zag arrow «F» |
| Red graphics | `--hostile`: hollow axes of advance from each red cluster toward the contact line; penetration arrow when unopposed |
| Contact line | `--contact` 3 px, label «Línea de contacto (prevista) H+08» |
| Contact marker | crossed swords in a gold ring, ratio badge mono («1 : 1.20»), coloured by the outcome class of `U.resCls` (DECISIVE SUCCESS / SUCCESS → ok, PARTIAL SUCCESS / NEUTRAL → warn, FAILURE / DECISIVE FAILURE → bad); outcome chip after arb |
| Mask outside the bound | `--mask`, 2 px edge in the method colour; tiers .30 / .62 in turn view; critical events soft .35 |
| Marginalia | classification banner (`meta.classification`) top and bottom centre; grid letters A–J on top/bottom, numbers 1–7 left/right; north arrow + «ESQUEMA — NO A ESCALA» bottom-left; title block bottom-right: operation · «COA 1 × ECOA-1» · «SITUACIÓN A H+08» · method/turn/step |

All strokes `vector-effect: non-scaling-stroke`; labels use `paint-order: stroke` with a 3 px `--halo` stroke.

### 2.8 Motion

- τ playback on `requestAnimationFrame`; units glide by interpolation (no CSS transitions on positions).
- Step change by click: τ jumps; arrows of the new step draw on in 400 ms (`stroke-dashoffset`); contact markers pop once (scale .6 → 1, 180 ms).
- Open DP: ring fills continuously; diamond «breathes» (opacity .7 ↔ 1, 1.6 s). Active NAI pulse 2 s.
- Lens open: mask fades in 250 ms; viewBox tween 350 ms ease-in-out. Drawers slide 200 ms.
- `prefers-reduced-motion: reduce`: no tweening, no pulsing, no draw-on; jumps only; demo plays by steps.

---

## 3. Data model

### 3.1 Principles

1. Every new field is optional; `W.ensure(op)` fills defaults; v0.3 code ignores unknown keys.
2. Canonical strings are never replaced by numbers. Numeric fields are stored only when a string is unparseable (`turn.t0/t1`, `phase.t0/t1`, `nai.t0/t1`, `dp.t0/t1`) or for user overrides.
3. Derived data (Geom, Scene, Actions, Tracks, Lanes, MapState, TimelineState, Bounds) is **never persisted**; memoised in memory by content hash.
4. User geometry is normalised (`[u,v]` or doctrinal `p/q`), never pixels.
5. Keyframes and arrows are per COA / ECOA (no leaking between COAs).

### 3.2 `op.geo` (new)

```js
op.geo = {
  v: 1,
  axis: null,                     // null = auto (§4.7) | { att: 'R'|'B', from: 'E'|'W'|'N'|'S' }
  aspect: null,                   // null = 10/7 (1000×700) | number (= image w/h when an image is set)
  bg: { kind: 'schematic', relief: true, grid: true, seed: null },   // seed null = WGGeo.hash(op.id)
  //  | { kind: 'image', key: 'wgcoa.v3.img.op-tryzub', w: 1600, h: 1120, bytes: 312000, name: 'carta.jpg',
  //      op: 0.85, wash: 0.06, relief: false, grid: true }
  lines: {                        // depth overrides of linear features (cascade, §4.14)
    // 'cm:PL 4': { p: 0.68 }
  },
  ovr: {                          // overrides of auto features, keyed by ref
    // 'cm:EA1':  { pts: [[0.74,0.70],[0.77,0.69], …] }   area/line shape in [u,v]
    // 'cm:BP2':  { p: 0.33, q: 0.70 }                    point in doctrinal frame
    // 'cm:Hill 247 (PL4 anchor)': { ok: true }            confirmed as is (conf → 1)
    // 'cm:BP3':  { hidden: true }
    // 'sec:Z12': { q0: 0.06, q1: 0.40 }                   lateral sector band
    // 'nai:NAI-3': { pts: [...] }
  },
  add: [                          // user-drawn features
    // { id: 'usr:k3f9a', kind: 'nai'|'tai'|'line'|'ea'|'bp'|'obj'|'area'|'hill'|'crossing'|'lz'|'urban'|'water'|'note',
    //   ref: 'nai:NAI-7' | 'cm:EA PINE' | 'usr:k3f9a', name: 'EA PINE', pts: [[u,v],…], closed: true, side: 'N' }
  ],
  tracks: {                       // user keyframes per COA / ECOA id
    // 'COA-1':  { 'b-kozh': [ { t: 14, cm: 'BP1' }, { t: 23, u: 0.70, v: 0.47 } ] },
    // 'ECOA-1': { 'r-tkb-1': [ { t: 30, u: 0.52, v: 0.80 } ] }
  }
};
```

Rules: `ovr` keys must be refs of existing auto features; refs that no longer exist are kept and listed as «Ajustes huérfanos» (detail of the layout review) with «Borrar». A user-drawn NAI also creates the register row (§5.1.8). A user-drawn CM appends its name to `op.cm` so all v0.3 selects see it; its geometry is `add[]` with `ref = 'cm:' + name`.

### 3.3 `op.time` (new)

```js
op.time = {
  dayEnd: 'inclusive',   // 'inclusive': a D token used as an end = end of that day ('D+1 → D+2' = [24,72])
                         // 'boundary' : day tokens are day starts            ('D+1 → D+2' = [24,48])
  hHour: 0,              // hour of day of H on D (0–23); D±n starts at 24·n − hHour
  scale: 'auto',         // 'auto'|'linear'|'adaptive'|'phase' (ruler)
  stepFrac: null,        // null = defaults §4.4 | { pre:[0,.1], act:[.1,.4], rea:[.4,.7], cnt:[.7,.95], arb:[.95,1] }
  hPerSec: 4,            // playback speed: 1 | 4 | 12 (h of operation per second) | 'steps'
  naiLead: 2             // hours an NAI should be open before its DP window (DSM check)
};
```

The ruler legend always shows the convention: «H = {hHour}:00 del día D · D+n hasta el fin del día» (or «D+n = inicio del día» for boundary).

### 3.4 `op.turns[i]` additions

```js
{ id, m, label, title, time, ce, sim,            // existing; time stays canonical
  bound: {                                       // optional: user-adjusted lens of this turn
    kind: 'belt'|'seg'|'box'|'ce'|'time',
    from: 'PL 1', to: 'PL 2',                    // belt / seg: CM names (preferred, follow geometry edits)
    band: [0.20, 0.30],                          // belt / seg: depth band when no line names apply
    route: 'av:Z11', w: 0.6,                     // seg: avenue and corridor width factor
    refs: ['Canal crossings (south)', 'Hill 247 (PL4 anchor)'],  // box: CM names
    poly: null,                                  // box: [[u,v]…] only when hand-edited
    link: true                                   // space↔time link (§4.20)
  },
  gen: 'manual'|'phase'|'key'|'geo',             // how it was generated (absent = v0.3 / hand-made)
  ls: 0.5,                                       // loss share 0..1 (absent = 1) — engine §4.25
  seed: { from: 't4', at: '2026-10-14T12:00' },  // plan copied from this turn
  stepFrac: null,                                // per-turn override of op.time.stepFrac
  t0: null, t1: null                             // numbers ONLY when `time` is unparseable
}
```

### 3.5 Engagement and placement additions

```js
coa.plan[tid].eng[k]   += { cm: 'EA1', step: 'act'|'cnt', t0: null, t1: null }  // anchor override, step, numeric window override
ecoa.plan[tid].place[k] += { cm: 'EA1' }                                          // anchor override
```

### 3.6 `op.prep` additions

```js
op.prep.mActive = '';       // '' | 'critical'|'belt'|'box'|'avenue'|'combined' — lens chosen in ③ (UI only)
op.prep.bounds = {          // only what the user changed; missing key → automatic (§4.20)
  belt:     { from: 'PL 1', to: 'PL 3', sectors: [], t0: null, t1: null, link: true },
  avenue:   { route: 'av:Z11', from: 'PL 3', to: 'PL 5', w: 0.6, t0: null, t1: null, link: true },
  box:      { refs: ['Canal crossings (south)', 'Hill 247 (PL4 anchor)'], poly: null, t0: 48, t1: 96, link: false },
  critical: { t0: null, t1: null }      // the CE / DP sets stay in prep.ceSel / prep.dpSel (existing)
};
```

### 3.7 `game` additions (per COA × ECOA pair)

```js
game.syncGeo = { fires: { t3: { at: 'tai:TAI-1', f: [0.10, 0.95] } } };   // anchor ref and window fraction of a sync cell
```

### 3.8 `op.ui` additions

```js
op.ui += {
  tau: null,                                       // number | null (= start of the first chained turn)
  read: { plano: 'plan', superposicion: 'instant', confrontacion: 'instant', conclusiones: 'plan' },
  layers: {
    plano:          { base:1, cm:1, red:0, blue:1, isr:1, sync:0, adj:0, method:0, relief:1, grid:1 },
    superposicion:  { base:1, cm:1, red:1, blue:1, isr:1, sync:1, adj:1, method:0, relief:1, grid:1 },
    confrontacion:  { base:1, cm:1, red:1, blue:1, isr:1, sync:1, adj:1, method:1, relief:1, grid:1 },
    conclusiones:   { base:1, cm:1, red:0, blue:0, isr:1, sync:0, adj:1, method:0, relief:1, grid:1 }
  },
  fnOn: { c2:1, intel:1, man:1, fires:1, eng:1, info:1, cimic:1, sust:1, pers:1, prot:1, legal:1 },
  fog: false, cmpEcoa: '', ech: 'battalion',       // 'company'|'battalion'|'brigade'
  edit: false, tool: 'select',                     // ① edit mode and tool
  sel: '',                                         // selected ref (§6.3 ref grammar)
  drawers: { l: 1, r: 0, b: 'strip' },
  lens: { sub: 'metodo', turnId: '', step: '', gen: '' },   // ③ sub-step, open turn, step, generator mode
  showAll: false                                   // lens: show 'out' items at 8 %
};
```

### 3.9 `store` additions (ui-core)

```js
store.flow  = true;            // false = «Vista clásica v0.3»
store.mode  = 'plano';         // 'plano'|'superposicion'|'confrontacion'|'conclusiones'
store.forms = false;           // Formularios sheet open (store.sec keeps the legacy section)
store.theme = 'auto';          // 'auto'|'light'|'dark'
store.coach = { v04: false, demo: false, tips: {} };
// unchanged: store.v === 3, ops, cur, cfg, lang, assist, sec, role, ai
```

### 3.10 Background images (`js/bgimage.js`, `WGBg`)

- Upload: `<input type="file" accept="image/jpeg,image/png,image/webp">` → `FileReader` → `Image` → canvas downscale to long side ≤ 1600 px → `toDataURL('image/jpeg', .72)`; if `data.length > 900 000` retry 1280 px / q .6, then 1024 px / q .5; still too big → refuse with «La imagen es demasiado grande incluso reducida».
- Storage key: `wgcoa.v3.img.<opId>` (suffix `-<base36>` if taken by another op). The op only stores `{kind:'image', key, w, h, bytes, name, op, wash}`.
- Budget: sum of all `wgcoa.v3.img.*` lengths ≤ 2 600 000 chars, and estimated total localStorage (`JSON.stringify(store).length + images`) ≤ 4 500 000; otherwise refuse with «Reduzca la imagen o quítela de otra operación».
- `QuotaExceededError` → keep in memory (`WGBg.mem[key]`) for the session, toast «⚠ La imagen no se ha podido guardar en el navegador: exporte la operación para conservarla».
- Export (`exportOp`, `exportAll`): `WGBg.inline(clone)` sets `clone.geo.bg.data`. Import (`importText`): after `W.ensure`, `WGBg.extract(op)` moves `bg.data` into a fresh key and deletes it from the op.
- Boot: `WGBg.gc(store)` removes `wgcoa.v3.img.*` keys not referenced by any op (handles deleted operations without touching ui-inputs.js).
- Aspect: on image set, `op.geo.aspect = w/h`; all features are normalised so they stay aligned in relative terms; the user drags them onto the real terrain. Removing the image restores `aspect = null`.
- CSP: the image is a `data:` URL inside an SVG `<image href>`; if a host blocks it, the schematic remains and the upload button shows «Este visor no permite imágenes de fondo».

### 3.11 `js/model.js` changes (exact)

In `newGame()` add `syncGeo: {}` to the returned object. In `ensure(op)`, before `return op;`, add:

```js
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
op.geo = Object.assign({ v: 1, axis: null, aspect: null, bg: null, lines: {}, ovr: {}, add: [], tracks: {} }, isObj(op.geo) ? op.geo : {});
if (!isObj(op.geo.bg) || !op.geo.bg.kind) op.geo.bg = { kind: 'schematic', relief: true, grid: true, seed: null };
['lines', 'ovr', 'tracks'].forEach(k => { if (!isObj(op.geo[k])) op.geo[k] = {}; });
if (!Array.isArray(op.geo.add)) op.geo.add = [];
op.time = Object.assign({ dayEnd: 'inclusive', hHour: 0, scale: 'auto', stepFrac: null, hPerSec: 4, naiLead: 2 }, isObj(op.time) ? op.time : {});
if (!isObj(op.prep.bounds)) op.prep.bounds = {};
if (op.prep.mActive == null) op.prep.mActive = '';
Object.keys(op.games).forEach(k => { if (!isObj(op.games[k].syncGeo)) op.games[k].syncGeo = {}; });
const L0 = { base: 1, cm: 1, red: 1, blue: 1, isr: 1, sync: 1, adj: 1, method: 0, relief: 1, grid: 1 };
const LP = { plano: { red: 0, sync: 0, adj: 0 }, superposicion: {}, confrontacion: { method: 1 }, conclusiones: { red: 0, blue: 0, sync: 0 } };
const ui = op.ui; ui.layers = isObj(ui.layers) ? ui.layers : {};
Object.keys(LP).forEach(m => { ui.layers[m] = Object.assign({}, L0, LP[m], isObj(ui.layers[m]) ? ui.layers[m] : {}); });
ui.read = Object.assign({ plano: 'plan', superposicion: 'instant', confrontacion: 'instant', conclusiones: 'plan' }, isObj(ui.read) ? ui.read : {});
ui.fnOn = Object.assign({ c2: 1, intel: 1, man: 1, fires: 1, eng: 1, info: 1, cimic: 1, sust: 1, pers: 1, prot: 1, legal: 1 }, isObj(ui.fnOn) ? ui.fnOn : {});
ui.drawers = Object.assign({ l: 1, r: 0, b: 'strip' }, isObj(ui.drawers) ? ui.drawers : {});
ui.lens = Object.assign({ sub: 'metodo', turnId: '', step: '', gen: '' }, isObj(ui.lens) ? ui.lens : {});
['tau'].forEach(k => { if (ui[k] === undefined) ui[k] = null; });
if (ui.fog == null) ui.fog = false; if (ui.cmpEcoa == null) ui.cmpEcoa = ''; if (!ui.ech) ui.ech = 'battalion';
if (ui.edit == null) ui.edit = false; if (!ui.tool) ui.tool = 'select'; if (ui.sel == null) ui.sel = ''; if (ui.showAll == null) ui.showAll = false;
```

`op.v` stays `3` (the existing `op.v = 3` line is kept). `blankOp()` inherits everything through `ensure()`. `migrateV2` needs no change.

### 3.12 Compatibility and migration

| Case | Behaviour |
|---|---|
| v0.3 store / op opened in v0.4 | `ensure()` fills defaults; geometry, times, actions and bounds are derived; TRYZUB and MAR AZUL need **no data change**. |
| v0.4 op opened in v0.3 | Extra keys are ignored and kept (v0.3 `ensure` uses `Object.assign`); turns keep valid time strings; seeded plans are ordinary eng/place rows; `turn.ls` is ignored by the v0.3 engine (losses then count fully — documented in README). |
| wargaming_nato v2 JSON | unchanged path `migrateV2 → ensure`. |
| AI «doc» import | produces ops without geometry: fully automatic. |
| Store envelope | key `wgcoa.v3`, `store.v === 3` (required by `load()` and `importText`). New store fields defaulted in `load()` (§6.7.1). |

Round-trip test (§8.1): export a v0.4 op, run it through a copy of the **v0.3** `ensure` (from `dc851dc`), re-run v0.4 `ensure`: all v0.4 fields preserved, `E.runPath` results identical when `ls` is absent.

### 3.13 Size budgets

| Item | Budget |
|---|---|
| TRYZUB op JSON (v0.3) | 105 047 chars (measured) |
| v0.4 additions without image | `ovr`+`lines` ≤ 60 × 120 B; `add` ≤ 30 × 300 B; tracks ≤ 2 layers × 40 units × 8 kf × 45 B; syncGeo < 2 KB → **< 50 KB / op** |
| Image | ≤ 900 000 chars per image (JPEG ≤ 1600 px q .72), ≤ 2 600 000 chars all images, separate keys |
| Total localStorage | ≤ 4 500 000 chars estimated before accepting an image |

---

## 4. Algorithms (pure modules; every function deterministic and node-testable)

Notation: `clamp(x,a,b)`, `lerp(a,b,s)`, `smooth(x) = x²(3−2x)`, `overlap(a,b) = max(0, min(a1,b1) − max(a0,b0))`, `iou(a,b) = overlap / (max(a1,b1) − min(a0,b0))`. `s_def = +1` (the defender side is always increasing `p`). `norm(s)` = NFD, strip diacritics and quotes `“”"«»'`, uppercase, collapse whitespace.

### 4.1 Time parsing — `WGTime.parse(str, opts)` (js/time.js)

`opts = { dayEnd: op.time.dayEnd ('inclusive'), hHour: op.time.hHour (0) }`.

1. **Session budget** — `/\(\s*[≈~]?\s*(\d+(?:[.,]\d+)?)\s*(min|h)\s*\)/i` → `session` minutes (h × 60); remove the match. «(≈45 min)» is wargame session time, never operational time.
2. **Tokens** — scan with
   `/(≈|~|aprox\.?\s*|NLT\s*|NET\s*)?([DH])(?:\s*([+\-−–])\s*(\d+(?:[.,]\d+)?)(?::(\d{2}))?(?:\s*(h|min|d)(?![A-Za-zÀ-ÿ]))?)?/g`
   (letters `D`/`H` are **case-sensitive**; do not use look-behind — check in code instead):
   - reject if the character before the letter matches `[A-Za-z0-9À-ÿ]`;
   - when there is no sign part, reject if the character after the letter matches `[A-Za-z0-9À-ÿ]` (rejects «HETMAN», «DC-B2», «DP-B1», «D30», «Hill», «HQ»);
   - free-text mode (`opts.free`) also rejects bare `H`/`D` without sign and without a NLT/NET/≈ prefix.
   - Value: `H±n[:mm][unit]` → hours (`min` → n/60, `d` → 24n, `:mm` adds mm/60); bare `H` → 0. `D±n` → day index `n` (bare `D` → 0). Comma decimals allowed.
3. **Day arithmetic** — `dayStart(n) = 24n − hHour`, `dayEnd(n) = dayStart(n) + 24`.
4. **Assembly** (`approx` = the string contains `≈`, `~` or `aprox`):
   - ≥ 2 tokens: `a` = first, `b` = last. `t0 = a.day ? dayStart(a) : a.v`; `t1 = b.day ? (dayEnd==='inclusive' ? dayEnd(b) : dayStart(b)) : b.v`. If `t1 < t0`: swap, `warn.push('inv')`. If `t1 === t0`: point (±.5 h).
   - 1 token followed by a trailing arrow (`/(→|->|=>)\s*$/`): `[start, start+24]`, `open: true`.
   - 1 day token: `[dayStart, dayEnd]`, `day: true`.
   - 1 H token: `NLT` → `[v−1, v]` (`nlt`); `NET` → `[v, v+1]` (`net`); approx → `[v−2, v+2]`; else point `[v−.5, v+.5]` with `at = v`.
   - 0 tokens → `{ ok: false }`.
5. Output `{ ok, t0, t1, at?, point, approx, day, open, nlt, net, session, style: 'H'|'D', raw, warn: [] }` (`style = 'D'` when the first token is a day token).

Verified table (`tests/time.test.js` must contain every row):

| Input | Result |
|---|---|
| `D-1 → H (≈45 min)` | `[-24, 0]`, session 45 |
| `H-2 → H` | `[-2, 0]` |
| `H → H+12` / `H+12 → H+24` / `H+24 → H+48` | `[0,12]` / `[12,24]` / `[24,48]` |
| `H+48 → H+96` / `H+72 → H+96` / `H+96 → H+120` | `[48,96]` / `[72,96]` / `[96,120]` |
| `D-1 → H+6` (NAI-1) / `D-1 → H+24` (DP-B5) | `[-24,6]` / `[-24,24]` |
| `H+6 → H+30` / `H+18 → H+30` / `H+36 → H+48` | `[6,30]` / `[18,30]` / `[36,48]` |
| `D+1` / `D+2` | `[24,48]` day / `[48,72]` day |
| `D+1 → D+2` | `[24,72]` (inclusive) · `[24,48]` (boundary) |
| `≈ H+48` (DP-B4) | `[46,50]` approx, at 48 |
| `NLT H+10` | `[9,10]` nlt |
| `D → D+1` / `D+2 → D+5` / `D+5 →` (urban template) | `[0,48]` / `[48,144]` / `[120,144]` open |
| `H+1:30 → H+4` | `[1.5,4]` |
| `H → H+4` / `H+4 → H+12` (MAR AZUL) | `[0,4]` / `[4,12]` |
| `''`, `Phase I 45 min` | `ok:false` |
| free text «BAIDA breaks clean under X1 obscurant NLT H+10.» | one token nlt 10 |
| free text «la reserva móvil contraataca la playa principal en H+6.» | one token 6 |
| free text «EA HETMAN … DC-B2; DP-B1; D30 Bn», «durante 2 h (≈3 h serial)» | no tokens |

Because of `dayEnd: 'inclusive'` the urban template's consecutive phases would overlap, so the derive agent changes the template strings (§6.7.9) to `'D'`, `'D+1'`, `'D+2 → D+4'`, `'D+5 →'` (and its turns accordingly). When two consecutive phases overlap by ≥ 12 h the phase parse chip warns «Se solapa {h} h con la fase anterior — ¿quería «D+n» como inicio de día? (convención en ⋯ › Tiempo)».

**Formatting**
- `fmt(h, {style})`: `0 → 'H'`; `12 → 'H+12'`; `-2 → 'H-2'` (ASCII hyphen, as in the data); `7.5 → 'H+7:30'` (rounded to the minute); style `'D'` and `h + hHour` a multiple of 24 → `'D'`, `'D-1'`, `'D+2'`.
- `fmtSpan(t0, t1, orig)`: `fmt(t0) + ' → ' + fmt(t1)`, keeping D style for an endpoint when the original endpoint was a D token and the new value is a day boundary (inclusive: an end `t1` is printed `D+n` when `t1 = dayEnd(n)`); re-appends the original session suffix «(≈45 min)»; prefixes `≈ ` for approximate points. `fmtSpan(-24, 0, 'D-1 → H (≈45 min)') === 'D-1 → H (≈45 min)'`; `fmtSpan(24, 72, 'D+1 → D+2') === 'D+1 → D+2'`.
- `tokens(text, {free:true})` → `[{ t, kind: 'point'|'nlt'|'net'|'approx', day, idx, len, raw }]`.

### 4.2 Windows and inheritance — `WGScene.windows(op)` (js/scene.js)

Returns `W = { turn:{}, phase:{}, ce:{}, nai:{}, dp:{}, tai:{}, hpt:{}, range, breaks, warn:[] }`, each entry `{ t0, t1, src, approx, session, ok }`.

| Item | Rule (first that applies) |
|---|---|
| phase | `parse(t)` → `t0/t1` numbers if set → gap between parsed neighbours (`[prev.t1, next.t0]`) → `prev.t1 + [0,12]` → `[0,12]` |
| turn | `parse(time)` → `t0/t1` numbers → its CE's window → its CE's phase window → previous turn (array order) `t1 + [0,12]` |
| CE | among turns with `turn.ce === ce.id`, the one with the highest IoU with `ce.step`'s phase window → if no phase, the shortest referencing turn → the phase window → untimed (`warn`) |
| NAI | `parse(time)` → union of the windows of turns whose title or plan texts mention one of its loc CMs → range |
| DP | `parse(win)` → window of a CE with `ce.dp === id` → window of a turn whose `game.turns[tid].dp === id` (any game) → untimed |
| TAI | its DP's window → its HPT's `when` phase window → untimed |
| HPT | `when` phase window |
| engagement | `eng.t0/t1` numbers → its step window (act, or cnt when `eng.step === 'cnt'`) |
| red placement | movement window `pre.t0 → rea.t1` with red initiative, `rea` with blue initiative |
| plan text | `coa.plan[tid].a` → act; `ecoa.plan[tid].pre` → pre (blue initiative: act); `ecoa.plan[tid].r` → rea; `game.turns[tid].cr` → cnt; `rem`, `branch`, `res` → arb |
| sync cell `(fn, tid)` | `game.syncGeo[fn][tid].f` fractions → free-text time tokens in the cell clipped to the turn (one token → `[tok, tok + min(3, .25·d)]`) → function default steps: intel pre+act · fires act→cnt · eng act · man act→cnt · pers cnt→arb · legal cnt · c2, info, cimic, sust, prot whole turn |

TRYZUB CE windows (verified): CE1 `[-24,0]` (t1), CE2 `[0,12]` (t3), CE3 `[12,24]` (t4), CE4 `[24,48]` (t6), CE5 `[48,72]` (t7, not t5), CE6 `[72,96]` (t8), CE7 `[96,120]` (t9).

**Range** `[min t0, max t1]` over phases, turns, NAIs and DPs with `ok`; fallback `[0,24]`. TRYZUB `[-24,120]`; MAR AZUL `[0,24]`. The ruler pads 3 % on each side for display only.
**Breaks** sorted unique `t0/t1` of phases and turns. TRYZUB `[-24,-2,0,12,24,48,72,96,120]`.

### 4.3 Time scale — `WGTime.scale(range, mode, breaks)`

Returns `{ mode, x(t) → 0..1, t(x), ticks(pxPerH) }`.
- `linear`: `x = (t − r0)/(r1 − r0)`.
- `adaptive` (√): elementary intervals `d_k` between consecutive breaks (plus range padding as first/last intervals); width `w_k = √d_k / Σ√d_j`, linear inside each interval. TRYZUB: `H-2 → H` grows from 1.4 % to 4.3 % of the ruler, `H+24 → H+48` goes from 16.7 % to 15.0 %.
- `phase`: equal width per phase (gaps between phases 4 % each), linear inside.
- `auto` = `adaptive` when `max d / min d > 6`, else `linear`. A badge «√» and the toggle «Escala: adaptativa | lineal | por fases» (`op.time.scale`) make it visible.
- Ticks: majors at day boundaries (`dayStart(n)`, labelled `D-1`, `D`, `D+1` …) and at H; minors every 1, 3, 6 or 12 h, the first that keeps ≥ 48 px between labels; mono 10 px labels («H+12»).

### 4.4 Steps inside a turn — `WGTime.steps(initiative, frac?)`, `stepAt`, `stepWindow`

Default fractions (sequential, non-overlapping):

| Initiative | pre | act | rea | cnt | arb |
|---|---|---|---|---|---|
| red | 0 – .10 | .10 – .40 | .40 – .70 | .70 – .95 | .95 – 1 |
| blue | — | 0 – .35 | .35 – .65 | .65 – .95 | .95 – 1 |

`frac` precedence: `turn.stepFrac` › `op.time.stepFrac` › default. `stepWindow(win, id) = [t0 + f0·d, t0 + f1·d]`. `stepAt(win, steps, τ)`: `f = (τ − t0)/d`; the step with `f0 ≤ f < f1`; `f ≥ 1` (τ = t1) → `arb`; τ outside the window → `null`. The **arb band** is a reading band: positions are held at their `t1` values and strengths animate to `endStr` (§4.16). Label «Árbitro (situación a H+12)».

| Turn | pre | act | rea | cnt | arb |
|---|---|---|---|---|---|
| TRYZUB BELT 1 `H → H+12` | H → H+1:12 | H+1:12 → H+4:48 | H+4:48 → H+8:24 | H+8:24 → H+11:24 | H+11:24 → H+12 |
| MAR AZUL BOX A `H → H+4` | — | H → H+1:24 | H+1:24 → H+2:36 | H+2:36 → H+3:48 | H+3:48 → H+4 |

Two-way sync: when a turn is open in ③, `op.ui.wgStep = U.wgSteps(o).findIndex(s => s[0] === stepAt(...))` and `op.ui.wgTurn = E.activeTurns(o).findIndex(t => t.id === tid)` (with `op.ui.wgM = 'all'`); clicking a step sets τ to `stepWindow(...)[0] + 1e-6`.

### 4.5 Chained sequence and chain alerts — `WGScene.chain(op, W)`

`chained = E.activeTurns(op).filter(t => t.sim !== false)` in array order (exactly the `runPath` order). Alerts (`{ k, v, refs, cls }`):
- `orden` (warn): a chained turn starts before the previous chained turn → «La cadena de bajas no sigue el orden cronológico: {a} va antes que {b}».
- `solape` (warn): two chained turns overlap > 1 h → «{a} y {b} se solapan {h} h y ambos encadenan bajas». TRYZUB: KEY EVENT 1 `[-24,0]` ⊃ KEY EVENT 2 `[-2,0]` → 2 h.
- `sinPlan` (info): chained turn without engagements for the active COA → «{l}: la COA no tiene enfrentamientos».
- `metodoOff` (info, ③ only): turns whose method is disabled → «{n} turnos de «{m}» no se juegan (método desactivado en Preparación)».

TRYZUB t5 (BOX A, `sim:false`) sits before t6 in the array but does not chain, so no `orden` alert.

### 4.6 Gazetteer, classification and mention matching — `WGLayout.gazetteer(op)` (js/layout.js)

**Classification** of each `op.cm` string (first match wins; case-insensitive unless noted):

| Kind | Pattern |
|---|---|
| sector alias (not drawn) | `^<sectorId>\b` followed only by an optional parenthetical (e.g. «Z11 (south corridor)») or exact sector name |
| `redline` | `^Red Line\|^L[ií]nea roja\|^RL ?\d` |
| `line` (sub `bhl`, `beachline`, `pl`) | `^(PL\|LC\|LD\|LOA\|FEBA\|FLOT\|BHL\|RFL\|FSCL\|CFL)\b\|^PL ?\d\|^L[ií]nea\b\|^Line\b`; sub `beachline` if `/cabeza de (playa\|puente)\|beachhead\|bridgehead/` |
| `ea` | `^(EA\|AE\|KZ)\b\|^EA ?\d\|zona de enfrentamiento\|kill zone\|[aá]rea de destrucci` |
| `bp` | `^(BP\|PB)\b\|^BP ?\d\|^Posici[oó]n de combate` |
| `obj` | `^OBJ\b\|^Objetivo\b` (sub `airfield` if `/aer[oó]dromo\|airfield/`) |
| `area` | `^(AMA\|ZAA\|AA\|ZR\|PAA)\b\|^AMA ?\d\|Assembly\|Zona de reuni` |
| `lz` | `\b(ZD\|LZ\|DZ\|HLZ)\b\|zona de (desembarco\|aterrizaje)` |
| `beach` | `playa\|beach` |
| `hill` | `\b(hill\|cota\|monte\|altura\|colina)\b` |
| `crossing` | `canal\|crossing\|paso de\|puente\|bridge\|vado` |
| `urban` | `\b(hub\|ciudad\|town\|urban\|localidad\|aer[oó]dromo\|airfield)\b` |
| `offboard` | `depth\|profundidad\|rear\|retaguardia\|reconstitution\|reserva` |
| `note` | anything else (listed under «Sin situar» until placed) |

**Aliases** per CM (all `norm`ed, length ≥ 2): the full string; the string without parentheticals; the same without spaces («PL 1» → «PL1», «EA "HETMAN"» → «EAHETMAN»); for prefixes PL/EA/BP/AMA/OBJ/RL both «X n» and «Xn»; «BHL» for «BHL DIV»; «RL n» for «Red Line n»; «HILL 247» for «Hill 247 (PL4 anchor)»; the rest after «LÍNEA DE» («CABEZA DE PLAYA»); the rest after «PLAYA» («VERDE», «AMBAR»); the rest after «OBJ» («ALFA»); for urban names every proper token ≥ 5 letters («KRAMATORSK», «DRUZHKIVKA»). Ambiguous aliases (e.g. «CANAL CROSSINGS» → south and north) map to all candidates; a sector hint (engagement sector, «(south)/(north)», «southern/northern», «sur/norte») selects one, otherwise the evidence weight is split.
**Generic words** (weak mentions, weight × .5, all CMs of the kind): `playas?|beaches?` → beach; `cabeza de playa` → beachline; `EAs?` alone → none.
**Matcher**: one alternation regex built from all aliases, longest first, `\s*` allowed between letter/digit runs, boundaries `(^|[^A-Z0-9])` and `(?![A-Z0-9])` on the `norm`ed text, so «EA1» never matches «EA10». `match(text) → [{ refs, kind, idx, len, key, generic }]`.
**Units**: `WGLayout.unitIndex(op).match(text) → [unitId]` from quoted call signs («BAIDA», «KOZHUMIAKA», «KOTYHOROSHKO», «DOVBUSH», «SIRKO»), names that are unique in the ORBAT, and «XII ARMD BDE»-style prefixes before the first parenthesis.
**Pairs**: `pairs(text) → [{ a, b, kind: 'pair'|'same' }]` between consecutive line/redline mentions whose separator (in the `norm`ed text) matches `^\s*(→|->|=>|TO|A|HASTA|–|-)\s*$` (pair) or `^\s*\/\s*$` (same). «BHL to PL1», «PL1 → PL2», «screens BHL–PL1», «Red Line 2 / PL YELLOW».
**Implicit CMs**: lines and EAs found in phase/turn texts but missing from `op.cm` are listed in the review panel with «Añadir a medidas de control» (appends to `op.cm`).

### 4.7 Operation kind, axis and frame — `WGLayout.opKind(op)`, `WGLayout.axis(op)`

`opKind`: `op.opType` if non-empty (template key). Otherwise, over **all** COAs' engagements, FE-weighted (`E.unitFE(u) · pct`): any `amphAslt`, or any CM/sector matching `/playa|beach/i` → `'amph'`; any `gapX` → `'gap'`; `airAslt` → `'airAslt'`; `urbanAtk` → `'urban'`; offensive share (`hastyAtk, delibAtk, meeting`) ≥ .5 → `'attack'`; retrograde share (`delay, screen, withdraw`) ≥ .30 → `'delay'`; else `'defence'`. TRYZUB → `'delay'` (retrograde .32, offensive 0); MAR AZUL → `'amph'`.

`axis`: `op.geo.axis` if set → template hint (`WGTemplates.LIST[op.opType].axis`) → auto: `att = 'B'` if `opKind ∈ {amph, gap, airAslt, urban, attack}` (offensive share incl. amphAslt/gapX/airAslt/urbanAtk ≥ .5), else `'R'`; `from = att === 'B' ? 'W' : 'E'` (own side on the west by convention; amphibious = sea on the west). TRYZUB → `{att:'R', from:'E'}`; MAR AZUL → `{att:'B', from:'W'}`. The axis is pair-independent (all COAs are used) so the geometry does not jump when the pair changes.

**Frame** (`q` runs north-first for E/W axes and west-first for N/S axes):

| from | `[u,v]` | inverse |
|---|---|---|
| E | `u = 1 − p`, `v = q` | `p = 1 − u`, `q = v` |
| W | `u = p`, `v = q` | `p = u`, `q = v` |
| N | `u = q`, `v = p` | `p = v`, `q = u` |
| S | `u = q`, `v = 1 − p` | `p = 1 − v`, `q = u` |

### 4.8 Sectors — `WGLayout.layout(op, gz)`

- Role: `depth` if the sector name matches `/interior|objetivo|\bOBJ\b|retaguard|rear|reserv|profundidad|depth|cabeza de (playa|puente)|bridgehead|airhead|kill|destrucci|seguridad|security|cobertura|covering/i`; otherwise `lateral`. Depth sectors matching `/seguridad|security|cobertura|covering/` have `depthRole 'front'` (placed **before** the lateral sectors, `p ∈ [0, .25]`); all other depth sectors are `depthRole 'rear'`.
- Lateral order: north-first (E/W axes) by hints (`north|norte|\(N\)|\bN\b` first, `south|sur|\(S\)|\bS\b` last), otherwise array order. For N/S axes: west-first (`west|oeste|\(W\)|\(O\)`).
- Lateral bands: `n` lateral sectors split `q ∈ [.06,.94]` with gutters `.04`: width `w = (.88 − .04(n−1))/n`, `q0_i = .06 + i(w + .04)`, `q1_i = q0_i + w`, centreline `qc_i = (q0_i + q1_i)/2`. Tiles for drawing extend to the gutter midpoints and the sheet edges.
- Depth extent: lateral sectors `p ∈ [p_front, p_split]` (`p_front = .25` when a front sector exists, else 0), rear depth sectors share `[p_split, 1]` in array order (equal split), front sectors share `[0, p_front]`, all depth sectors at full lateral width `[.06,.94]`; with no lateral sector at all, depth sectors split `[0,1]` equally in array order. `p_split` = depth of a `beachline` CM if any → the minimum anchor depth of engagements in depth sectors → `.45`. Without depth sectors lateral sectors span `[0,1]`.
- Boundaries are drawn wavy (seeded, amplitude .008, 12 segments). Overrides `ovr['sec:<id>'] = { q0, q1 }`.

TRYZUB: Z12 `q [.06,.48]` (centre .27, top), Z11 `q [.52,.94]` (centre .73), both `p [0,1]`. MAR AZUL: V `q [.06,.48]`, A `q [.52,.94]` for `p [0,.40]`; I `q [.06,.94]` for `p [.40,1]`.

### 4.9 Depth of linear features — precedence graph

1. Nodes: friendly lines (`line` kind) in `op.cm` order.
2. Edges `a → b` (a shallower than b):
   - weight 2 from `pairs()` in turn titles, phase `n` + `d` + `dc`, CE titles, NAI `loc`, TAI `loc`, engagement labels;
   - weight 1 from `pairs()` in COA statements and plan texts (`a`, `r`, `cr`);
   - weight 1 between consecutive lines in `op.cm` order.
   - `same` pairs merge nodes (union-find); merged lines get identical depth.
3. Kahn topological sort; among ready nodes pick the lowest `op.cm` index; on a cycle drop the lightest remaining edge (ties: the latest added).
4. Even spread: `p_i = .10 + .80·i/(n−1)` (n ≥ 2); n = 1: `.40` for `beachline`, `.45` otherwise.
5. Overrides `op.geo.lines[ref].p` replace the computed depth (cascade §4.14).
6. Red lines: own chain by number. A red line merged by `same` with a friendly line takes its depth (TRYZUB Red Line 2 = PL YELLOW = .40). A red line used as the `prep.positions.loc` of attacker-side units gets `FLOT(range.t0) − .05` (clamp ≥ .02) (TRYZUB Red Line 1 = .05). Others: linear inter/extrapolation by number from anchored red lines (≥ 2) or anchor ± mean friendly spacing (1 anchor); clamp `[.02, .95]` (TRYZUB Red Line 3 = .75, `conf .3`).

TRYZUB result (verified): BHL DIV .10 · PL 1 .20 · PL 2 .30 · PL YELLOW .40 · PL 3 .50 · PL PURPLE .60 · PL 4 .70 · PL GREEN .80 · PL 5 .90. MAR AZUL: Línea de cabeza de playa .40.

### 4.10 Contact line FLOT(t)

1. Points: every turn whose title has pairs → `(t0, p(first a))`, `(t1, p(last b))`; every phase whose `n`/`d` has pairs → same with the phase window; every phase whose `dc` or `n` names a CM `X` with a known depth → `(t1, p(X))` (generic «playas» → coast). The final objective named in the last phase's `dc` gets `p = .85` and adds `(t1, .85)`. Amphibious: beaches and the coast are at `p_coast = .10` before FLOT is computed.
2. If no point has `t ≤ range.t0`, add `(range.t0, .04)`.
3. Sort by `t`, running maximum on `p` (monotone), merge equal `t` (keep max).
4. `at(t)`: linear between points, flat outside. `inv(p)`: smallest `t` with `at(t) ≥ p` (linear inverse).
5. Display per sector at τ: `p_s = FLOT(τ)`; if an engagement of the current turn in sector `s` is between its act start and arb, `p_s = .5·FLOT(τ) + .5·p_anchor` (shows local CATK bulges); drawn as a sinuous polyline across the sector's band; label «Línea de contacto (prevista) {fmt(τ)}».

TRYZUB (verified): `(-24,.10) (0,.20) (12,.30) (24,.50) (48,.60) (72,.70) (96,.80) (120,.90)`. MAR AZUL (verified): `(0,.04) (4,.10) (12,.40) (24,.85)`.

### 4.11 Placement of point and area CMs

**Evidence** `{ p, w, sector, src }` for each mention of a CM (weights split among ambiguous candidates):

| Source | p of the evidence | w |
|---|---|---|
| turn title | turn band mid (`(p(a)+p(b))/2` of its pair) or `FLOT(window mid)` | 3 |
| engagement label | same turn band mid; `sector = eng.sector` | 2 |
| plan text `a` / ECOA `r` / `pre` / game `cr` | turn band mid | 1 |
| CE title | window mid of the CE's turn band | 1 |
| NAI `loc` | `FLOT(NAI window mid)` | 1 |
| TAI `loc` | `FLOT(DP window mid)` | 1 |
| DP `dec` + `trg` | `FLOT(DP window mid)` | 1 |
| `prep.positions` | (sector of the unit's first engagement) | 0 (lateral only) |

Rules, in order:
1. Depth = **weighted median** of the evidence `p`.
2. Parenthetical anchor «(<line> anchor)» → `p = p(line) + .02` (TRYZUB Hill 247 = .72).
3. Destination verbs («withdraw(s|al)? … to X», «repliega(n)? a X», «move to X», «into X» after a retrograde verb) add evidence `p(band end) + .05` with weight 2.
4. BP co-mentioned with an EA in the same sentence → `p = max(median, p(EA) + .04)`, lateral of the EA.
5. Crossings that share a base name («Canal crossings (south/north)») share the merged median of the unique sources; if within .02 of a line, nudge `+.025` (TRYZUB canal = .625).
6. A CM sharing a significant token with a depth sector name («ZD interior» ↔ «Interior / OBJ ALFA») is clamped into that sector's `p` range; if its median falls outside, use the middle of the free span between the sector start and the next feature (MAR AZUL ZD interior = .625).
7. CMs that define FLOT points keep that depth (MAR AZUL OBJ ALFA = .85).
8. Off-board: `offboard` CMs where only attacker units are positioned («Corps depth») → attacker edge marker (`p = .01`); words `rear|retaguardia|reconstitution` → defender edge (`p = .99`). Drawn as edge markers, not areas.
9. No evidence → numbered series interpolation between same-kind neighbours (BP3 between BP2 and BP4); still nothing → «Sin situar» tray (drawn nowhere until placed).

**Lateral** (first that applies): weighted majority `sector` of engagement evidence → sector of the units named in the same sentence (unit index → the unit's majority engagement sector; TRYZUB EA5 via KOZHUMIAKA → Z11) → explicit qualifier («(south)», «(north)», «southern», «sur», «norte») → name contained in a sector name («Playa VERDE» ⊂ «Playa VERDE (N)») → alternation of a numbered series whose siblings alternate → spanning (centre `q = .5`, width of all lateral sectors) for kinds `ea`/`urban` with evidence in ≥ 2 sectors or none. Point `q` = sector centreline.
**Collisions**: (a) point kinds (`bp, hill, crossing, lz, urban`) in the same sector with `|Δp| < .03` → shift the later one (by `op.cm` index) laterally by `±.08` alternating, staying inside the sector band; (b) two area features of the same kind whose lateral extents overlap and whose depth extents overlap → move the later one deeper (toward the defender) by the depth overlap + .01, clamped ≤ .97 (TRYZUB EA «HETMAN» .85 → .95). Points may lie inside areas (Hill 247 inside EA5).
**Confidence** `conf = min(1, Σw / 4)`; anchored (rules 2, 7), grammar-defined (§4.12 #1, e.g. AMA 1 / AMA 2 from TAI-1 / TAI-2) or overridden features `conf = 1`; extrapolated red lines `conf .3`; `conf < .5` → dotted outline, «?» badge, «Revisar ubicación» list.
**Shapes** (in `p,q`, then mapped): `ea` closed seeded blob, half-depth `.045`, half-width `.30 × sector width`, 10 vertices; `bp` U glyph `.03` opening toward the attacker; `obj` blob radius `.05`; `area` rectangle from its TAI grammar if any (§4.12), else `.08 × .15`; `hill` triangle `.025` + spot height parsed from digits; `crossing` point on the river; `lz` circle `.02`; `urban` rounded rect `.06 × .08`; `beach` coast segment of `.7 ×` sector width at the sector centre, on the coastline.
**Water**: crossings with a common base form one river: sinuous polyline (seeded ±.012) across the full lateral extent at their depth, passing through each crossing point. Amphibious: sea polygon `p ∈ [0, .10)` with a sinuous coastline at `p = .10`.

### 4.12 Location strings → geometry — `WGLayout.resolveLoc(geom, str)`

Grammar (first match wins; `—`, `–`, `-` accepted as dashes; arrows `→ -> to a hasta`):

| # | Pattern | Geometry | Example |
|---|---|---|---|
| 1 | `<CM> — <sector>, <A> <arrow> <B>` | rectangle `sector band × [p(A), p(B)]`; also defines `<CM>`'s geometry if it is an `area` without other evidence | TAI-1 «AMA 1 — Z11, BHL → PL3» → Z11 × [.10,.50]; TAI-2 «AMA 2 — Z12, PL1 → PL3» → Z12 × [.20,.50] |
| 2 | `<sector> — <A> <arrow> <B>` | `sector band × [p(A), p(B)]` | NAI-1 «Z11 — BHL to PL1» → u [.80,.90], v [.52,.94] |
| 3 | `<A> / <B>` (lines) | strip `±.015` around the common depth across all lateral sectors (or `A`'s sector) | NAI-3 «Red Line 2 / PL YELLOW» → u [.585,.615] |
| 4 | `(Approach to\|Aproximación a\|Acceso a) <CM>` | wedge on the attacker side: `p ∈ [p(CM) − .08, p(CM) − .01]` over the CM's lateral extent | NAI-6 → p [.87,.94] (EA «HETMAN» at .95) over v [.24,.76] |
| 5 | `<X>n – <X>m` (numbered series) | hull of the series members' shapes | TAI-4 «EA4 – EA7» |
| 6 | `<CM>` (whole string or first mention) | the CM's shape buffered `.02` (areas) or a circle `r .04` (points) | NAI-4 «EA1», NAI-5 / TAI-3 «Canal crossings (south)» |
| 7 | `<sector>` | sector polygon | — |
| 8 | otherwise | `{ ok: false }` → «Sin situar» list, «?» marker at the sheet edge | — |

Returns `{ ok, pts, closed, refs, how, sector? }`. NAI/TAI features have `ref = 'nai:<id>'` / `'tai:<id>'`, overridable like any feature.

### 4.13 Avenues of approach and terrain

- One route per lateral sector: centreline `q = qc` from `p = 0` to `p_split` (or 1), then, if depth sectors exist, to the deepest `obj` in that direction (or `(1, qc)`); width `.6 ×` sector width. `id = 'av:<sectorId>'`, label «AA <short>» where `<short>` is the beach name without «Playa» if the sector contains a beach («AA VERDE»), else the sector id («AA Z11»).
- **Dominant route** = argmax over lateral sectors of `Σ_ECOAs (lik/100)·Σ_chained turns red FE placed in the sector + .5·Σ_COAs blue main-effort FE`. TRYZUB → `av:Z11` (red share 72 %); MAR AZUL → `av:V` (red share among lateral sectors 76 %).
- Terrain (pure, part of Geom so it is testable): `sea`, `coast`, `rivers`, `urban`, `roads` (= route centrelines), `relief` (3 seeded centres + hills), `veg` (seeded blobs avoiding features). Seed `op.geo.bg.seed ?? WGGeo.hash(op.id)`.

### 4.14 Merge order, overrides and cascade — `WGLayout.geometry(op)` (memoised)

1. classify + gazetteer → axis → sectors (+ `ovr['sec:*']`).
2. Line depths (§4.9) → apply `op.geo.lines` overrides.
3. Coast/beaches → FLOT (§4.10, uses overridden line depths).
4. Point/area CMs (§4.11) from evidence → **dependents follow lines automatically** because every evidence `p` is recomputed from the (overridden) line depths: dragging PL 4 moves Hill 247 «(PL4 anchor)», the bands of NAI/TAI built from PL lines, belts and segments.
5. NAI/TAI geometry (§4.12), routes, terrain.
6. Apply `op.geo.ovr[ref]`: `{p,q}` or `{pts}` fix the feature (no longer follows), `{ok:true}` sets `conf = 1`, `{hidden:true}` hides.
7. Append `op.geo.add` features.
8. Mark orphans (ovr/lines keys without a matching auto feature).

**Mutators** (only these write `op.geo`; all in js/layout.js so tests cover them):
`setLineDepth(op, ref, p)`, `setFeature(op, ref, patch)` (`{p,q}` | `{pts}` | `{ok}` | `{hidden}`), `resetFeature(op, ref)` (delete `lines[ref]` and `ovr[ref]`), `resetAll(op)` (empties `lines`, `ovr`; keeps `add`, `tracks`), `addFeature(op, f) → ref`, `removeFeature(op, ref)`, `setAxis(op, axis|null)`, `setSector(op, id, q0, q1)`. The UI keeps a single-level undo snapshot of `op.geo` (minus tracks) before each mutator call.

### 4.15 Anchors of engagements and placements — `WGLayout.anchor(geom, text, ctx)`

`ctx = { sector, task, side, tid, tWin }`. For engagement `eng` of turn `tid`:
1. `eng.cm` → that CM.
2. Retrograde tasks (`delay`, `withdraw`, `screen`): the **last line** mentioned in the label («Delay to PL YELLOW» → PL YELLOW; «Delay PL YELLOW → PL3» → PL 3).
3. Otherwise the first mentioned CM by kind preference `ea > bp > obj > hill > crossing > beach > lz > urban > line > area`, skipping a beach/sector-alias CM whose name designates the engagement's own sector when another CM is present («Defensa de la cabeza de playa VERDE» → the beachhead line, not the beach).
4. Point = the CM's point/centroid; for lines, the line ∩ sector centreline; for spanning areas, the area point nearest the sector centreline.
5. Fallback: sector centreline at `FLOT(arrival time)`.

Side offsets around an anchor `A` (in `p`): the **attacker side** of the axis sits at `p_A − .035`, the **defender side** at `p_A + .03` — except when the side's own task is attack-like (`hastyAtk, delibAtk, amphAslt, gapX, airAslt, urbanAtk, catk, meeting`), in which case it sits **at** `p_A` (red placements have no task of their own: they always use the side offset). Several units of one side at one anchor fan out in rows of three: unit `k` (0-based, plan order) is in row `r = ⌊k/3⌋` at `+.03·r` toward its own side in depth, and laterally at `(j − (n_r − 1)/2)·.045` with `j = k mod 3` and `n_r = min(3, n − 3r)` (a single unit stays on the anchor; two units at ∓.0225). Lateral hints in the label or position task («from the SOUTH», «in the south») bias `q` by `±.15 ×` sector width toward that edge.

Red placements attach to the engagement chosen by **`E.buildEngagements`** (the `vs` list, else the first engagement of the sector without `vs`, else the first of the sector) so every map contact is an engine contact; placements without an engagement in their sector are **unopposed** (engine warning) and anchor at the sector centreline at `FLOT(rea end)` with a penetration arrow.

### 4.16 Unit tracks and interpolation — `WGScene.tracks(...)`

**Drawn units** («actores»): units in the active COA plans and ECOA placements (all turns), `prep.positions`, and `game.turns[*].assets`, aggregated by echelon `op.ui.ech` (default battalion: a company is drawn as its battalion ancestor; brigades placed whole stay brigades; `brigade` aggregates battalions into their brigade with FE-weighted strength). TRYZUB COA 1 × ECOA-1 ≈ 10–14 blue and ≈ 25 red counters, not 240.

**Keyframes** per unit: `K = [{ t, p, q, dep, src: 'start'|'plan'|'user', cm, tid }]` in doctrinal coordinates.
1. **Start** at `range.t0`: `prep.positions.loc` → CM anchor (line → line ∩ the unit's start sector centreline, sector alias → attacker units at `FLOT(t0) − .06`, defender units at `FLOT(t0) + .06`); start sector = sector of the unit's first chained engagement / placement. No own position → nearest positioned ancestor, siblings fanned `.03` laterally. Still nothing → **first-appearance origin**: attacker-side units start at `p = .03` (the sea for amphibious) on their first sector centreline; defender-side units start already at their first arrival position (they are in place).
2. **Plan** keyframes over the chained turns (`sim !== false`, method active), plus the open lens turn even when `sim:false` (then the chained turns overlapping it are skipped, so positions never contradict):
   - blue engagement: arrival `t =` end of its step (act, or cnt with `eng.step === 'cnt'`), departure `dep =` start of that step; position from §4.15.
   - red placement: arrival = end of rea; departure = start of pre (red initiative) or start of rea (blue initiative).
   - a unit engaged (or placed) in several engagements of the same turn takes the position of the one with the highest `pct` (ties: main effort, then plan order).
   - `game.turns[tid].assets` not in any engagement: arrival at the end of cnt, `.06` on the own side of the turn's main-effort anchor (behind the main-effort units).
3. **User** keyframes `op.geo.tracks[layerId][unitId]` (`layerId` = COA id for blue, ECOA id for red), `{t, u, v}` (converted to p,q) or `{t, cm}` (anchor of the CM in the unit's sector); within ±.5 h of a plan keyframe the user keyframe replaces it.

**Interpolation** at τ: find `K_i.t ≤ τ < K_{i+1}.t`; if `τ < K_{i+1}.dep` hold `K_i`; else `s = smooth((τ − dep)/(t_{i+1} − dep))`, `P = lerp(P_i, P_{i+1}, s)` in `(p,q)` (sectors are straight bands, so this follows the avenue); before the first keyframe: hold the first (units appear at their start); after the last: hold. `moving = 0 < s < 1`, `heading` = direction of the segment.

**Strength** from `E.runPath` (the cached `U.pathFor` result): for a chained turn `T`, `str = startStr` before T's rea start, `endStr` from T's arb start, linear in between; `sim:false` turns modify strength only while open in the lens. `ffir = side B && str < op.ffir/100`.

**Fog** (`WGScene.at(scene, τ, {view})`): `view 'red'` → blue units `hidden` unless in contact (an engagement between rea start and arb end with that unit). `view 'blue'` + `fog` → red units `live` inside an active NAI polygon or in contact; otherwise `last` (hollow diamond at the last live position, tag «H+04») or `hidden` if never seen.

Verified walk-through (TRYZUB COA 1, BAIDA, red initiative):

| τ | Keyframe | p (u = 1 − p) | sector |
|---|---|---|---|
| H−24 | start «PL 1» + defender offset | .23 (u .77) | Z11 |
| H−14:24 | t1 screen, no CM → FLOT(−14.4) = .14 → +.03 | .17 | Z11 |
| H−1:12 | t2 «Set on PL1» (AMA 1 skipped: line preferred over area) | .23 | Z11 |
| H+4:48 | t3 «EA1 — fix the lead echelon» (EA1 .25) | .28 (u .72) | Z11 |
| H+16:48 | t4 CATK into EA1 (attack-like → at the anchor) | .25 | Z11 |
| H+33:36 | t6 delay → PL PURPLE | .63 (u .37) | Z11 |
| H+57:36 | t7 «Feint IVO EA3» | .68 | Z11 |
| H+81:36 | t8 «Block at PL4 — hill 247» (hill preferred) | .75 | Z11 |
| H+105:36 | t9 CATK into EA7 | .85 (u .15) | Z11 |

Red r-b1-1 (ECOA-1): start = ancestor r-b1 «Z11 (south corridor)» → `p .04` (u .96); t3 arrives at EA1 − .035 = `.215` (u .785) at H+8:24 (end of rea). MAR AZUL 1.º BIM: first appearance at sea `p .03`, sector V (v .27); arrives on Playa VERDE `p .10` at H+1:24 (end of act, blue initiative); m3 reaches OBJ ALFA `p .85` at H+16:12; Bn Inf 1 (mr-1, defender side) is in place at `p .13` from H.



### 4.17 Visual actions and lanes — `WGScene.actions(scene)`, `WGScene.lanes(scene)`

Every Action is one record (contract §6.3). Id grammar: `eng:<tid>:<engId>`, `place:<ecoaId>:<tid>:<sector>`, `txt:a|pre|r|cr:<tid>`, `sync:<fn>:<tid>`, `auto:<fn>:<tid>:<k>`, `nai:<id>`, `tai:<id>`, `dp:<id>`, `hpt:<id>:<tid>`, `ce:<id>`, `phase:<id>`, `turn:<id>`.

| Source | side · fn | window | anchor / geometry | notes |
|---|---|---|---|---|
| COA engagement (all active turns, `sim:false` included) | B · man | step window (act / cnt) | §4.15 | `units`, `task`, `me`, `res` (`T.results[k].adj.outcome`), `ratio = E.fmtR(calc.rEff)`, `req = E.fmtR(calc.req)`, `margin`, `path = 'coas.<ci>.plan.<tid>.eng.<k>'` |
| ECOA placement, grouped by (turn, sector) | R · man | movement window | mean of the red arrival points | label «Z11 · 4 uds · MR BDE 1», `units`; unopposed groups flagged `unopposed:true` |
| Plan texts `a` / `pre` / `r` / game `cr` | B/R/R/B · man | act / pre / rea / cnt | first CM mentioned, else the turn's main-effort anchor | label = first sentence ≤ 90 chars; `path` (`coas.<ci>.plan.<tid>.a`, `ecoas.<ei>.plan.<tid>.pre|r`, `turns.<tid>.cr` scope g) |
| Sync cell with text | B · fn | §4.2 | `syncGeo.at` → first CM / NAI / TAI / HPT / unit mentioned → per-function fallback: fires/eng/intel/man = main-effort anchor; c2 = position of the main-effort unit's parent HQ (else ME anchor); sust = own-rear end of the dominant route; pers = ME anchor; info/cimic/prot = ME anchor; legal = none (time-only) | `path = 'sync.<fn>.<tid>'`, scope g |
| **Auto** (cell empty) fires | B · fires | (a) TAI: its DP window ∩ turn; (b) HPT: `when` phase ∩ turn; (c) engagement with `mods.fires ≥ 2`: act start → cnt end; (d) `eng.hpt`: cnt | (a) TAI centroid; (b) the HPT's TAI centroid, else the `eng.hpt` unit at cnt; (c) anchor; (d) crosshair on the HPT unit | `auto:true`; label «TAI-1 · HPT-1 (auto)», «Fuegos sobre EA1 (auto)» |
| **Auto** eng | B · eng | act | anchor of engagements with `mods.obst ≥ 1` or task `delibDef`; `gapX` engagements → crossing | label «Obstáculos en {cm} (auto)» |
| **Auto** intel | B · intel | NAI window ∩ turn ∩ (pre ∪ act) | NAI centroid | label «Vigilancia NAI-4 (auto)» |
| **Auto** c2 | B · c2 | DP window ∩ turn | DP location | label «Decisión DP-B1 (auto)» |
| **Auto** pers | B · pers | cnt → arb | anchor of engagements with `adj.lb ≥ 10` | label «Bajas A {lb} % (auto)» |
| NAI | N · intel | §4.2 | `resolveLoc(nai.loc)` | `state` from `reg.nai[i].st`: ACTIVE / TRIGGERED / INACTIVE |
| TAI | B · fires | its DP window | `resolveLoc(tai.loc)` | |
| DP | side of `dp.side` · c2 | `parse(win)` | centroid of its NAI, else the main-effort anchor of the turn or CE that references it (never filtered out spatially) | `state` from `reg.dp[i].st` |
| HPT | B · fires | cnt of turns inside its `when` phase | target unit position | |
| CE, phase, turn | N | windows | — | used by lanes and bounds |

Auto actions are replaced as soon as `game.sync[fn][tid].trim()` is non-empty (then the text action is used; if it has no recognisable place it inherits the auto anchor). `op.ui.fnOn[fn] = 0` hides a function on map and ruler.

**Lanes** (ruler rows, top to bottom; `Lane = { id, kind, label, side?, fn?, rows: [[Item]], spark? }`):

| id | label | content |
|---|---|---|
| `phase` | «Fases» | phase bars, alternating tint, DC chip |
| `turn` | «Turnos» | all turns, method colour, inactive methods hatched, `sim:false` notch, result end cap (`game.turns[tid].res` › engine `suggested`), overlapping turns stacked in sub-rows (greedy interval colouring: TRYZUB BOX A sits under SEGMENT 2–3) |
| `enemy` | «Enemigo» | ECOA `pre`/`r` text bars on pre/rea windows; red DPs as red diamonds + window whiskers |
| `man` | «Maniobra» | one sub-row per sector; engagement bars on their step windows; main effort outlined gold; outcome cap; red placement bars (thin, red) under the blue bar of the same sector |
| `intel` | «Inteligencia» | NAI bars (hatched purple), `sync.intel` text bars, auto intel bars (dotted) |
| `dp` | «Decisión» | blue DPs: diamond at `t0` + bar to `t1`, state colour; TAI bars (brown, thin) |
| `fn` (group «Funciones», collapsible, collapsed = heat strip of non-empty functions per turn) | one row per function in `U.FUNCS` order except `intel` and `man`: «Mando y control», «Fuegos», «Ingenieros», «Información», «CIMIC», «Sostenimiento», «Personal», «Protección», «Asesoría jurídica» | text bars (solid), auto bars (dotted, «auto»), empty (fn, turn) slots as dotted «＋» placeholders (click → `cellEdit`) |
| `cp` | «Potencia» | sparkline: blue main-effort CP and red CP per chained turn from `runPath` (`startStr` at t0, `endStr` at t1), FFIR dashed line |

All 11 `U.FUNCS` rows are covered (man → Maniobra, intel → Inteligencia, 9 in Funciones). `Item = { id, t0, t1, point, approx, label, cls, state, ref: { type, id, tid?, fn? }, auto?, handles? }`; approximate items get feathered ends; unparsed ones are hatched with «?».

### 4.18 Reading «Situación a τ» — `WGScene.situation(scene, snap, { t, resL })`

`t` and `resL` are injected (`U.t`, `U.resL`) so the module stays i18n-free; the module registers its EN strings (§8.3). Output:

```js
Situation = {
  τ, head: { time: 'H+08', phase: 'STEP II-S1 · DISRUPT & DELAY', dc: 'DC-B2', turn: 'BELT 1', title: 'PL1 → PL2 — Break-in and EA1 (Step II-S1)', step: 'Reacción roja', method: 'Fajas' },
  blue: [Line], red: [Line], cr: [Line], isr: [Line], fn: [Line], cp: { b: 0.87, r: 0.61, ffir: false }, alerts: [Line]
}
Line = { text, ref, cls: ''|'ok'|'warn'|'bad'|'auto' }
```

Sentence templates (Spanish keys; `{v}` = verb by task, singular/plural by number of call signs):
- Azul, one per blue engagement of the current turn whose step has started: before rea «{u} {v} {cm}»; from rea on «{u} {v} {cm} — {r} (mín {req}) → {res}» (`{res}` + « · árbitro» when `adj.manual`). `{u}` = call signs joined « + »; `{cm}` = anchor CM name or sector name.
- Rojo: from pre (red initiative) the first sentence of `ecoa.plan[tid].pre`; from rea the first sentence of `r`; plus per sector «{n} uds. en contacto en {s} · {fe} FE».
- Contrarreacción (cnt, arb): first sentence of `game.turns[tid].cr`; «HPT: {unidad}» when `eng.hpt`.
- Vigilancia y decisión: active NAIs «{id} ({loc}) · {ind}»; open DPs «{id} «{dec}» · faltan {h}» (mono countdown); next DP opening within 12 h «Próximo: {id} en {h}».
- Funciones: one line per function with a text or auto action active at τ («Fuegos (auto): TAI-1 · HPT-1»).
- Potencia: «CP azul (ME) {b} % · CP rojo {r} %» (mean `str(τ)` of the current turn's main-effort blue units / of red units in contact); «FFIR-1 rebasado: {unidad} {v} %».
- Alertas: «{e}: ratio {r} por debajo del mínimo de planeamiento ({m})», FFIR breach, «Fuerzas rojas sin oposición en {s}», flank threat (lens), chain `orden` / `solape` alerts touching the current turn.

Task verbs (singular / plural): delay «retarda / retardan» · screen «cubre / cubren» · hastyDef «fija / fijan» · delibDef «bloquea / bloquean» · catk «contraataca / contraatacan» · hastyAtk, delibAtk «ataca / atacan» · amphAslt «asalta / asaltan» · gapX «cruza / cruzan» · airAslt «asalto aéreo en» (both) · urbanAtk «ataca en zona urbana / atacan en zona urbana» · withdraw «se repliega / se repliegan» · meeting «combate de encuentro en» (both). Prepositions: retrograde tasks use «hacia {cm}», all others «en {cm}».

Expected (TRYZUB, COA 1 × ECOA-1, τ = H+08, engine numbers from `E.runPath`, verified):
- head: «H+08 · STEP II-S1 · DISRUPT & DELAY (DC-B2) · BELT 1 PL1 → PL2 — Break-in and EA1 (Step II-S1) · Reacción roja · Fajas»
- Azul: «BAIDA + KOZHUMIAKA fijan en EA1 — 1 : 1.20 (mín 1 : 2.50) → Éxito decisivo»; «DOVBUSH retarda hacia PL YELLOW — 1 : 2.77 (mín 1 : 6.00) → Éxito decisivo»
- Rojo: «MR BDE 1 attacks with two battalions forward on company frontages; its organic tank battalion (41 MBT) is committed into EA1.» + «4 uds. en contacto en Z11 · …», «3 uds. en contacto en Z12 · …»
- Vigilancia: NAI-2, NAI-3, NAI-4 active (NAI-1 closed at H+6); DP-B1 «Commit KOZHUMIAKA CATK into EA1» · faltan 4 h; DP-B5 · faltan 16 h; «Próximo: DP-B2 en 10 h».

### 4.19 Decision-support checks (DSM) — `WGScene.checks(scene)`

For each DP with window `D = [d0,d1]` and NAI window `N = [n0,n1]` (`lead = op.time.naiLead`):

| Check | Rule | Level · text |
|---|---|---|
| sin NAI | `!dp.nai` | warn «{dp} sin NAI que lo active» |
| tardía | `n0 > d0` | warn «NAI tardía: {nai} abre {h} h después de abrirse la ventana de {dp}» |
| sin margen | `d0 − lead < n0 ≤ d0` | info «{nai} no se abre antes de la ventana de {dp} (margen < {lead} h)» |
| cierra antes | `n1 ≤ d0` | warn «La {nai} se cierra antes de que se abra la ventana de {dp}» |
| cobertura parcial | not «cierra antes» and `overlap(N,D)/|D| < .5` | info «{nai} cubre sólo el {pct} % de la ventana de {dp}» |
| CCIR | `ccir.nai && ccir.nai !== dp.nai` | info «El CCIR {c} se responde en {n1}, pero {dp} vigila {n2}» |
| sin ventana | DP untimed | warn «{dp} sin ventana de decisión reconocible» |

An NAI that merely stays open after its DP closes is **not** flagged. TRYZUB expected (verified): warn DP-B4 (sin NAI), DP-B6 (NAI-5 se cierra antes), DP-2 (NAI-6 tardía 24 h); info DP-B5 (sin margen; CCIR PIR-1 → NAI-1 vs NAI-2), DP-1 (cobertura 25 %; PIR-5 → NAI-2 vs NAI-3), DP-3 (cobertura 13 %; PIR-5 → NAI-2 vs NAI-3). DP-B1, DP-B2, DP-B3, DP-B7 pass. On the map, selecting a DP draws gold leader lines DP → NAI centroid → (inspector) CCIR chip → the turn bars that name it (`game.turns[tid].dp`, `ce.dp`).

### 4.20 Method bounds — `WGBound` (js/bound.js)

`Bound = { id, m, kind: 'belt'|'seg'|'box'|'ce'|'all', label, poly, band, from, to, sectors, route, w, refs, ces, t0, t1, link, soft, src: 'auto'|'user'|'turn', why: [] }`. `poly` is always materialised for spatial kinds (`[[u,v]…]`, or an array of polygons for spotlights) so the classifier is uniform.

**Protected lines** = lines used as an endpoint of a `pair` in turn titles, phase `n`/`d` or CE titles. TRYZUB: BHL DIV, PL 1, PL 2, PL 3, PL PURPLE, PL 4, PL GREEN, PL 5 (PL YELLOW is not protected). MAR AZUL: none.

**Space ↔ time link** (`link: true` by default for belt and avenue, `false` for box and critical): changing `[p0,p1]` sets `[t0,t1] = [FLOT.inv(p0), FLOT.inv(p1)]`; changing `[t0,t1]` sets `[p0,p1] = [FLOT(t0), FLOT(t1)]` snapped to the nearest line within .02. Lock icon «Vincular terreno y tiempo» unlinks.

**Belt («Fajas»)** — bands across the whole AO, perpendicular to the enemy axis.
- Candidates: with ≥ 2 protected lines, intervals between consecutive protected lines (other lines become interior lines); else with ≥ 2 lines, all lines merged greedily (narrowest pair first) until count ≤ `clamp(round(rangeHours/12), 3, 8)`; else depth markers `[FLOT(range.t0), coast, lines…, final objective]`.
- Spatial: all lateral sectors (or `sectors` chosen) clipped to `[p(A), p(B)]`, extended into depth sectors where they overlap.
- Temporal: `FLOT.inv` of the band, or the turn time when the belt matches an existing turn.
- Auto bound: if belt turns exist, the union of their title bands and windows; otherwise first → last candidate.
- TRYZUB candidates: BHL→PL1 `[-24,0]`, PL1→PL2 `[0,12]`, PL2→PL3 `[12,24]` (PL YELLOW interior, crossed at H+18), PL3→PL PURPLE `[24,48]`, PURPLE→PL4 `[48,72]`, PL4→GREEN `[72,96]`, GREEN→PL5 `[96,120]`. Auto bound: PL 1 → PL 3, `[0,24]` (t3 ∪ t4).
- MAR AZUL candidates (markers .04 / coast .10 / beachhead .40 / OBJ ALFA .85): `[0,4]`, `[4,12]`, `[12,24]`.

**Avenue in depth («Avenida en profundidad»)** — one avenue, segment by segment.
- Route: `prep.bounds.avenue.route` → majority sector of the main-effort engagements of existing avenue turns → dominant route. Segments cut at protected lines (else all lines) and at `obj` CMs on the centreline.
- Spatial: corridor buffer of the centreline, half-width `w/2` (`w = .6 ×` sector width, slider .4–1.0), between `p0` and `p1`, continuing into depth sectors toward the objective. Temporal: `FLOT.inv` or the turn time.
- Auto bound: span of the existing avenue turns (TRYZUB PL 3 → PL 5 `[24,120]`; MAR AZUL m3 has no pair → `[FLOT(12), FLOT(24)] = [.40,.85]`, `[12,24]`).
- TRYZUB segments PL3→PURPLE `[24,48]`, PURPLE→PL4 `[48,72]`, PL4→GREEN `[72,96]`, GREEN→PL5 `[96,120]` = t6–t9. In SEGMENT 3 the Z12 engagement «Canalise to EA4 · KOTYHOROSHKO BP4» lies outside the corridor → chip «Fuera de la acotación: 1 enfrentamiento (Z12)»; red units in Z12 within .08 of the corridor edge → flank-threat ⚠ on the northern edge.

**Box («Caja»)** — an isolated critical area.
- Candidates: CMs of kinds `ea, obj, crossing, beach, hill, lz, urban` scored `S = 3·nCE + 2·nDP + 2·nNAI + 2·nTAI + 2·[main-effort anchor] + nMentions` (nCE = CE titles mentioning it; nDP = DPs mentioning it in `dec`/`trg` or whose NAI resolves to it; nNAI / nTAI = NAI / TAI locs resolving to it; main-effort anchor counted once; nMentions = all mentions).
- Polygon: axis-aligned rectangle in `(p,q)` around the box refs plus CMs co-mentioned in the same turn title (point kinds and line ∩ sector intersections count as points; beaches, EAs and areas by their shapes), padded .05, minimum .12 × .12.
- Window: the box turn time; else the union of the windows of main-effort engagements, DPs and CEs anchored inside; else `FLOT.inv` of its depth range. `link:false`.
- Auto bound: refs from existing box turn titles (TRYZUB BOX A «Canal crossings and hill 247 — the PL4 anchor» → Canal crossings (south) (sector hint Z11 from t5's engagement), Hill 247 (PL4 anchor), PL 4 ∩ Z11 → `p [.575,.77]`, `q [.67,.79]` → `u [.23,.425]`, `v [.67,.79]`, `[48,96]`); else the top candidate. MAR AZUL BOX A «Asalto a las playas» → both beaches (generic «playas») → `u [.04,.16]`, `v [.07,.93]`, `[0,4]`.
- Box reading rule: only forces inside are played; units outside are context, units entering during the window get **edge tokens** with ETA and entry side («KOZHUMIAKA entra H+60 (O)»).
- TRYZUB top candidates: EA1, Hill 247, Canal crossings (south), EA7, EA «HETMAN» (all `S ≥ 6`).

**Critical events («Eventos críticos»)** — a sequence of essential tasks.
- `ces = prep.ceSel` (all CEs when empty), window = union of their CE windows (§4.2). Spatial: spotlights (circles `r .06`) around the anchors of each CE's actions (its turns' engagements, its DP's NAI, its CCIR's NAI), soft mask .35; classification is time-only (`S = true`).
- TRYZUB: CE1…CE7, `[-24,120]`. MAR AZUL: no CEs → the method card says «Sin eventos críticos definidos» and the bound falls back to the main-effort engagements' windows with the nudge «Defina eventos críticos y DP».

**Combined («Secuencia combinada (actual)»)**: `kind 'all'`, no method mask; turns = `E.activeTurns(op)`; each opened turn uses `forTurn`.

**`forTurn(scene, turn)`**: `turn.bound` override → by method: belt = band from the title pair (else `[FLOT(t0), FLOT(t1)]`) across all lateral sectors; avenue = route corridor between the title pair depths; box = rectangle around the title refs (no refs → bbox of the turn's engagement anchors padded .05); critical = spotlights of the turn's action anchors. Window = the turn window.

### 4.21 Which actions are shown — `WGBound.classify(scene, action, bound)`, `filter(scene, bound)`

- `T` (time): `overlap([a0,a1],[b0,b1]) > 0`; points ±.5 h, approximate ±2 h.
- `S` (space): no `poly` (time-only bound), or the action has no geometry (DP without NAI, legal cell, «Sin ubicación»), or any of `a.at`, `a.pts` (lines sampled every .01), or the positions of `a.units` at the middle of the time overlap lies inside `poly` (point-in-polygon).
- `inf` (influence): `¬S ∧ T ∧ a.target` inside (fires on a TAI inside, an NAI covering the bound, a CATK whose anchor is inside).
- `edge`: `¬S ∧ T ∧` red side `∧` distance(a.at or unit positions, poly) < .08 (flank threat).
- `ctx`: `S ∧ ¬T`.  `in`: `S ∧ T`.  `out`: otherwise.

| Class | Map opacity | Ruler | Marker |
|---|---|---|---|
| in | 100 % | normal | — |
| inf | 60 % | normal | arrow into the bound |
| edge | 50 % | normal | ⚠ on the bound edge |
| ctx | 20 % | dimmed | time chip |
| out | hidden (8 % with «Mostrar todo», `op.ui.showAll`) | collapsed behind «＋N fuera» | — |

`filter` returns `{ cls: {actionId: class}, counts: { in: {B, R, nai, dp, sync}, inf, edge, ctx, out }, outsideEngs: [{tid, engId, sector}], entries: [{unit, side, t, at, dir}], flank: [{unit, at}] }`. Unopposed red groups (engine warnings) are **always** drawn with red hatching on their sector and «!» regardless of class. The engine still adjudicates every planned engagement; the lens only visualises and warns.

### 4.22 Method recommendation — `WGBound.recommend(scene)`

| Method | Score |
|---|---|
| belt | +2 per protected-line pair (cap 6); +2 if `opKind ∈ {delay, defence}`; +1 if ≥ 3 phases |
| avenue | +3 if the dominant route holds ≥ 60 % of the lateral red FE or of the blue main-effort FE; +1 per existing avenue turn (cap 3); +1 if ≥ 4 lines in depth |
| box | +2 per candidate with `S ≥ 6` (cap 4); +2 if `opKind ∈ {amph, gap, urban, airAslt}`; +1 if box turns exist |
| critical | +2 if ≥ 3 CEs have a DP; +1 if ≥ 3 CEs; +2 if the session budget parsed from `prep.timeline` is < 180 min |

Levels: «Recomendado» = top score if ≥ 5 and ≥ second + 2; «Adecuado» ≥ 4; «Poco adecuado» < 4. Reasons are listed on the card; **nothing is auto-selected**. The «Secuencia combinada» card is «Adecuado» with «Mantiene la secuencia actual de {n} turnos».
Expected: TRYZUB belt 9 «Recomendado» (7 protected pairs → 6, delay +2, 7 phases +1), avenue 7, box 5, critical 3 (budget «≈3 h serial» = 180 min). MAR AZUL box 7 «Recomendado» (Playa VERDE, Playa ÁMBAR, OBJ ALFA ≥ 6 → 4, amph +2, BOX A +1), avenue 4, belt 1, critical 0.

### 4.23 Turn generation — `WGBound.propose(scene, { m, mode, bound, opts })`

Always inside the **chosen method's bound**; labels use the method prefix (`KEY EVENT n`, `BELT n`, `SEGMENT n`, `BOX A/B/…`, next free number or letter). `TurnDraft = { key, m, label, title, time, t0, t1, ce, sim: true, gen, bound, seed?, ls?, src: [{type, id}] }`, `time = WGTime.fmtSpan(t0, t1)`.

- **Manual** (`gen 'manual'`): no automatic drafts. Brush on the «Turnos» lane → popover (method = current lens, label, title default «{bound label} — {main CM inside}», CE select) → one draft. «＋ Turno aquí» → `[τ, τ + min(12, phaseEnd − τ)]`. Dragging the edges or body of an existing turn bar retimes it (rewrites `turn.time` via `fmtSpan`, keeping «(≈45 min)»; the previous string is kept as the single-level «Deshacer» snapshot).
- **Por fases** (`gen 'phase'`): one draft per phase with `overlap(phase, bound) ≥ max(1 h, .25·|phase|)`; window = phase ∩ bound; title = `phase.n`; `ce` = the CE with `ce.step === phase.id`; spatial bound = method bound restricted to the FLOT band of the window (belt/avenue) or the method bound (box/critical).
- **Por acciones clave** (`gen 'key'`), inside the bound window `B`:
  1. Events and weights: selected CEs 3 (window §4.2); selected DPs blue 2 / red 1 (`dp.win`); main-effort engagements 1 (their turn window); phases 1. Events longer than 1.5 × |B| are ignored.
  2. CE clusters are seeded first. A DP with `ce.dp === dp.id`, or any event with ≥ 50 % of its own window inside a CE cluster, **attaches** to the cluster with the largest overlap without widening it.
  3. Remaining events merge when IoU ≥ .4, or when one of them is a point/approximate event and the gap < `max(1 h, .03·|B|)`; windows that merely touch do not merge.
  4. Keep clusters with weight ≥ 2; trim overlaps at the midpoint; minimum length `max(1 h, .02·|B|)`; while count > `opts.maxTurns` (8) merge the adjacent pair with the smallest gap.
  5. Title = label of the heaviest member (CE title › «DP-x · decision» › main-effort engagement label › phase name); `ce` = the CE of the cluster.
  6. No CE and no DP inside → note «Sin eventos críticos ni DP: se proponen a partir del esfuerzo principal y de las fases. Defina eventos críticos y DP.»
- **Por geometría** (`gen 'geo'`): belt → one draft per belt candidate inside the bound (option «Sólo líneas protegidas», default on; off = all lines); avenue → one per segment; box → one draft = the box (or one per selected candidate); critical → one per CE. Title «PL1 → PL2 — EA1» (lines + highest-S CM inside).

Verified outcomes:

| Scenario · method · mode | Drafts | Diff (§4.24) |
|---|---|---|
| TRYZUB · critical · key (whole range) | KE1 `[-24,0]` CE1 (+DP-B5, ME t2, phase I), `[0,12]` CE2 (+DP-B1), `[12,24]` CE3 (+DP-B2), `[24,48]` CE4 (+DP-B3, DP-1, DP-3), `[48,72]` CE5 (+DP-B4, DP-2), `[72,96]` CE6 (+DP-B6), `[96,120]` CE7 (+DP-B7) | KE1 = t1 «mantener»; the other six «ya cubierto por BELT 1 / BELT 2 / SEGMENT 1…4»; t2 «sin correspondencia» → default «Conservar» (covered by the kept t1) |
| TRYZUB · belt · geo (protected) / phase / key | `[0,12]`, `[12,24]` | t3, t4 «mantener» |
| TRYZUB · belt · geo (all lines) | `[0,12]`, `[12,18]` PL2→PL YELLOW, `[18,24]` PL YELLOW→PL3 | t3 «mantener»; two «nuevo · plan copiado de BELT 2 (ls 0,50)»; t4 «sin correspondencia» → default «Sustituir» |
| TRYZUB · avenue · geo / phase | `[24,48]`, `[48,72]`, `[72,96]`, `[96,120]` | t6–t9 «mantener» |
| TRYZUB · box · key (BOX A `[48,96]`) | `[48,72]` CE5, `[72,96]` CE6 | both «ya cubierto por SEGMENT 2 / SEGMENT 3» (unchecked); t5 → «Conservar». Forcing them makes them `sim:false` «no encadena bajas (solapa con SEGMENT 2)» |
| MAR AZUL · box · phase | `[0,4]` FASE I | m1 «mantener» |
| MAR AZUL · critical · key | `[0,4]`, `[4,12]`, `[12,24]` + note «Sin eventos críticos ni DP…» | `[4,12]` = m2 «mantener»; the others «ya cubierto por BOX A / SEGMENT 1» |
| MAR AZUL · belt · geo | `[0,4]`, `[4,12]`, `[12,24]` | all «ya cubierto»; note «Active «Fajas» en Preparación para jugarlas» |

### 4.24 Diff, overlap policy, apply, seeding and undo — `WGBound.diff`, `apply`, `undo`, `chain`

`diff(op, scene, drafts, m)` → `{ rows, orphans, overlaps, chain, notes }`:
1. **Rows** — for each draft the existing turn with the best IoU:
   - IoU ≥ .6, same method → `keep` (same time string and bound) or `update` (keeps id, label and title unless «Renombrar» is ticked; rewrites `time`, `bound`, `gen`);
   - IoU ≥ .6 with an **active** turn of another method → `covered` («ya cubierto por {label}», unchecked; «Forzar» turns it into `new`);
   - else `new` (checked).
2. **Orphans** — existing turns of method `m` that match no draft and overlap the bound window. `cover` = Σ overlap with checked `new` drafts / own duration. Default `replace` («Sustituir») when `cover ≥ .6` (their plans are seeded into those drafts); otherwise `keep` («Conservar»). Options «Conservar · No encadenar (`sim:false`) · Eliminar».
3. **Seeding** of every `new` draft: source = the existing turn (any method, orphans included) with the largest overlap if overlap ≥ .5·|draft|. For **every COA and every ECOA**: deep copy `coa.plan[src].eng` (new ids `<engId>-<newTid>`, keeping `a`) and `ecoa.plan[src]` (`pre`, `r`, `place`). `draft.ls = round2(overlap(draft, src)/|src|)`, `draft.seed = { from: src.id }`. Row text «plan copiado de {label} (ls 0,50) — revise los enfrentamientos». No source → «sin plan: defina los enfrentamientos (Planes) o use ✦ IA».
4. **Overlaps** — `new`/`update` drafts overlapping chained turns of other active methods by > 1 h. Policy radio (`choices.overlap`): `nochain` (default: `draft.sim = false`, badge «no encadena bajas (solapa con {label})»), `disable` («Desactivar «{método}» en Preparación» — explicit change of `prep.methods`), `keep` (warn «doble cómputo de bajas»).
5. **Chain preview** — simulate the resulting `op.turns` and `prep.methods`, list `E.activeTurns` with `sim`, method, window and §4.5 issues. Also «Se activará el método «{m}»» when `prep.methods[m]` is false.

`apply(op, scene, diff, choices)`:
1. Undo snapshot (in memory, one level): `op.turns`, `op.prep.methods`, `op.prep.bounds`, every `coa.plan`, every `ecoa.plan`, every `games[k].turns`.
2. Orphans: `remove` = v0.3 `delturn` cleanup (delete the turn, its plans in all COAs / ECOAs and `games[*].turns[id]`); `nochain` = `sim:false`.
3. Kept/updated rows: rewrite `time` with `WGTime.fmtSpan(t0, t1, old.time)` (keeps «(≈45 min)»), set `bound`, `gen`.
4. New rows: `id = 't' + Date.now().toString(36) + k`; `{ m, label, title, time, ce, sim, gen, bound, ls?, seed? }`; **inserted chronologically** (before the first turn whose window starts later); `choices.sort === 'all'` stably sorts every turn by `t0` and toasts «Se ha cambiado el orden de encadenamiento».
5. Seed plans; `prep.methods[m] = true` (announced in the preview).
6. Return `{ added, updated, removed, undo }`; toast «{a} turnos creados · {u} actualizados · {r} sustituidos · Deshacer» (`lnGenUndo`). `U.ask` confirmation first when anything is removed.

### 4.25 Engine change — loss share `turn.ls` (js/engine.js; owner: bound agent)

```js
function lossShare(t) { const v = t && t.ls; return (v == null || v === '' || isNaN(+v)) ? 1 : Math.max(0, Math.min(1, +v)); }
// runPath, inside activeTurns(op).forEach((t, i) => { … }):
const ls = lossShare(t);
const adj = { outcome: c.outcome, lb: ls === 1 ? c.lb : c.lb * ls, lr: ls === 1 ? c.lr : c.lr * ls, manual: false };
// (arbiter overrides ov.bl / ov.rl are NOT scaled; ratio, margin and outcome are untouched)
// monteCarlo, inside built.forEach((b, ti) => { … }):
const ls = lossShare(turns[ti]);
res.forEach((r, xi) => { if (ls !== 1) { r.lb *= ls; r.lr *= ls; } /* …existing body… */ });
// export: WGEngine.lossShare = lossShare
```

Regression test (`tests/engine-ls.test.js`): `runPath` and `monteCarlo` outputs for every TRYZUB and MAR AZUL pair are **deep-equal** to the golden outputs produced by the `dc851dc` engine (`git show dc851dc:js/engine.js`) when no turn has `ls`; with `ls = .5` on t3, every `T.results[k].adj.lb/lr` of t3 is exactly half of `calc.lb/lr`, ratios and outcomes are unchanged, and later turns start from the correspondingly higher strengths.

---

## 5. Rendering

### 5.1 Map renderer — `WGMap` (js/map.js + css/map.css, prefix `mp-`)

The map is a pure renderer: it never reads `op`, never calls `U.*`, never mutates state. It receives a `MapState` (§6.3) and emits hooks.

#### 5.1.1 DOM

```html
<div class="mp-root" tabindex="0" data-testid="map">
  <svg class="mp-svg" viewBox="x y w h" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plano · …">
    <defs><!-- unit <symbol>s, hatch/urban patterns, arrowhead markers, mask --></defs>
    <g data-layer="sheet">  paper rect, sector tiles + watermarks             (static)
    <g data-layer="base">   image | sea, veg, relief, rivers, urban, roads     (static)
    <g data-layer="cm">     boundaries, lines, EAs, BPs, OBJ, areas, hills, crossings, beaches, LZ, off-board  (static)
    <g data-layer="flot">   contact line per sector                            (dynamic)
    <g data-layer="isr">    NAI / TAI shapes (classes patched), leader links   (static shapes, dynamic classes)
    <g data-layer="red">    red graphics, red units, ghost ECOA                 (dynamic)
    <g data-layer="blue">   blue graphics, blue units                          (dynamic)
    <g data-layer="sync">   function glyphs                                     (dynamic)
    <g data-layer="dps">    DP diamonds + rings, HPT crosshairs                 (dynamic)
    <g data-layer="method"> mask (evenodd path), bound outlines, handles, edge tokens, flank ⚠ (dynamic)
    <g data-layer="adj">    unopposed hatching, contact markers, outcome chips, penetration notches, callouts (dynamic)
    <g data-layer="edit">   vertex handles, drawing preview                     (dynamic)
    <g data-layer="marg">   classification banners, grid letters, north arrow, «ESQUEMA — NO A ESCALA», title block (static, title text patched)
  </svg>
</div>
```

Board: sheet `[0,1000] × [0,H]`, `H = 1000/aspect` (default 700); `x = 1000u`, `y = Hv`; marginalia band of 28 units around the sheet; «fit all» viewBox = `[-28, -30, 1056, H + 60]`.

#### 5.1.2 Update model

- `update(state)` diffs against the previous state. Static layers are re-rendered (`innerHTML`) **only** when `state.hash.base` or `state.hash.cm` change. Theme changes need no re-render (all colours are CSS variables).
- Dynamic items are **keyed by `id`** (Map id → element). New ids are created, missing ids removed, existing ones get only changed attributes (`transform`, `d`, `class`, text). No `innerHTML` on dynamic groups during playback.
- Unit symbols: one `<symbol id="s-<side>-<type>-<ech>" viewBox="0 0 60 62">` per distinct key, built once from `WGCat.sym({side,type,ech}, 60)` by extracting the inner markup (`/<svg[^>]*>([\s\S]*)<\/svg>/`; catalog.js is not changed). A unit is `<g class="mp-u side-B me sel moving ffir last" data-ref="unit:<id>" transform="translate(x,y) scale(s)"><use href="#s-…" x="-30" y="-31" width="60" height="62"/><path class="mp-ring"/><text class="mp-ulbl"/></g>`, `s = 28 px × upp / 60`.
- Screen-constant sizes: on every view change set `svg.style.setProperty('--upp', viewBox.w / clientWidth)`; CSS `text { font-size: calc(var(--upp) * 11px) }`; unit/glyph transforms recomputed for ≤ 60 items; strokes `vector-effect: non-scaling-stroke`.
- Classes from the lens (`cls` field): `mp-in`, `mp-inf`, `mp-edge`, `mp-ctx`, `mp-out` (opacity table §4.21), `mp-auto` (dotted), `mp-lowconf` (dotted outline + «?»), `mp-ghost` (hollow magenta frames), `mp-sel` (`--sel` 3 px halo), `mp-active` (NAI pulse), `mp-open` (DP breathing).
- Below zoom 1.6, units of one side within .05 of each other collapse into the first one with a count badge «×3» (`badge`).

#### 5.1.3 Graphics construction (map.js helpers, exported for tests)

`WGMap.path(pts, closed, smooth)` (Catmull-Rom → cubic), `WGMap.arrow(pts, width, headLen)` (outlined axis polygon), `WGMap.tbar(at, dir, len)`, `WGMap.uglyph(at, dir)`, `WGMap.waves(pts)`, `WGMap.arc(cx, cy, r, frac)`, `WGMap.symbol(unit, size)` (standalone SVG string, for lists and the detail drawer), `WGMap.graphic(kind, pts, side, label)` (SVG string for one tactical graphic). Graphic kinds: `axis, catk, delay, screen, block, bp, withdraw, gap, airAslt, amph, fix, meeting, penetration`. Axis width by echelon: battalion 14, brigade 22, division 30 units; head 1.8 × width; main-effort gold halo.

#### 5.1.4 View, pan and zoom

- `k = 1000 / viewBox.w`, `k ∈ [0.9, 12]`. Wheel: factor 1.15 per notch about the cursor. One-pointer drag on empty map: pan. Two pointers: pinch zoom about the midpoint. Double-click / double-tap: ×2 at the point. Keys (map focused): arrows pan 10 %, `+`/`-` zoom, `F` fit.
- `fit(target, anim)`: target = `'all'` | bbox `[u0,v0,u1,v1]` | polygon; pads 8 %, preserves the container aspect, tweens 350 ms ease-in-out (`requestAnimationFrame`; instant with reduced motion). Selecting an item or opening a lens flies to it.
- `touch-action: none` on the svg only; the page never scrolls through the map.

#### 5.1.5 Selection and hover

Clickable elements carry `data-ref` (grammar §6.3). Click/tap (≤ 8 px movement, < 350 ms) → `hooks.select(ref, {shift})`; empty map → `hooks.select(null)`. Desktop hover → `hooks.hover(ref)` and a native `<title>` tooltip. Selection halo from `state.sel`.

#### 5.1.6 Editing interactions (only when `state.edit` or a bound with handles is present)

| Gesture | Effect (hook) |
|---|---|
| Tool «Seleccionar/mover» + tap a feature | vertex handles appear (12 px; 24 px visual / 44 px hit on touch); point features get one handle |
| Drag a vertex / point handle | `dragFeature(ref, {pts} | {u,v}, phase)`; lines (`line`, `redline`) are **constrained along the depth axis**: `dragLine(ref, p, phase)` |
| Midpoint «＋» handle | inserts a vertex (`dragFeature` with new pts) |
| `Delete` / long-press on a vertex | removes it (min 2 for lines, 3 for areas) |
| Drag a unit (mouse with edit on; long-press 350 ms on touch) | `dragUnit(id, {u,v}, phase, snapRef)`; snaps to the nearest CM within 18 px (`snapRef`), Alt disables snapping |
| Tool «Línea / Área / Punto / NAI» | click to add vertices, double-click or «✓» to finish, `Esc` cancels → `drawDone(kind, pts)` |
| Bound handles (③ 3b) | `dragHandle(boundId, handleId, {u,v}, phase)`; handle ids: `p0`, `p1` (band edges, constrained along depth), `c0…c3` (box corners), `move` (body), `w` (corridor width) |

Phases are `'start'|'move'|'end'`; the UI applies the mutation on `'end'` (and previews on `'move'` by updating its own state and calling `update`).

#### 5.1.7 Marginalia and export

Grid letters A–J over the sheet width, numbers 1–7 over its height (`WGGeo.gridRef(u,v)` → «H6»); banners from `state.marg.classif`; title block lines from `state.title`. `toSVGString()` serialises the current SVG with CSS variables resolved to computed colours (for «Exportar plano (.svg)» and the DSO print).

#### 5.1.8 What the UI does with the hooks (ui-mesa)

| Hook | Mutation (always through a mutator, then `U.save()` and `U.shell.soft()`) |
|---|---|
| `dragLine(ref, p, 'end')` | `WGLayout.setLineDepth(op, ref, p)`; toast «PL 4 → profundidad 0,68 · arrastra a los elementos anclados» |
| `dragFeature(ref, …, 'end')` | `WGLayout.setFeature(op, ref, {pts} | {p,q})` |
| `dragUnit(id, uv, 'end', snapRef)` | keyframe at τ in `op.geo.tracks[layerId][id]` (`{t:τ, cm}` when snapped, else `{t:τ, u, v}`); layer = active COA id for blue, active ECOA id for red; toast «BAIDA → EA1 @ H+06». At τ = range.t0 with a snap: writes `prep.positions` (`{u, loc: cm, task}`, existing row updated) instead |
| `drawDone('nai', pts)` | new `reg.nai` row `{ id: next 'NAI-n', loc: nearest CM name, ind: '', ccir: '', col: '', time: fmtSpan(current turn window), st: 'ACTIVE' }` + `op.geo.add` feature `ref 'nai:<id>'`; detail drawer opens on it |
| `drawDone('line'|'area'|'point', pts)` | small form «Tipo · Nombre» (kinds of §4.6; name from unplaced `op.cm` strings or a new name appended to `op.cm`) → `addFeature` |
| `dragHandle(boundId, h, uv, 'end')` | `WGBound.set(op, m, patch)` (method bound) or `turn.bound = patch` (open turn); linked bounds recompute time |
| `select(ref)` | `op.ui.sel = ref`, open `#dr` with `U.P.detail(ref)`, highlight on the ruler, `focus` |

#### 5.1.9 Read modes and presets (MapState built by ui-mesa)

| Read mode | Used in | What is drawn |
|---|---|---|
| `instant` («Instante») | ②, ③, optional in ① | units at τ (`tracks.at`), tactical graphics of the current turn (blue graphics from each unit's previous keyframe to its target; red axes toward the contact line), NAI/TAI/DP by state at τ, glyphs active at τ, contacts from rea, contact line at τ; title «SITUACIÓN A H+08 · {turno} · {paso}» |
| `plan` («Plan completo») | ① default | for each chained turn `n` (array order): blue graphics from each unit's keyframe before the turn to its arrival in the turn, with `seq = n` and `time = turn.time`; `sim:false` turns dashed without number; units at their start keyframes; red axes per turn only when the red layer is on; NAIs and DPs with window labels; no contacts, no contact line, no glyphs; title «PLAN COMPLETO · {COA}» |
| `dso` | ④ | `plan` restricted to cm + isr + dps, plus at each main-effort anchor of each chained turn a flag coloured by the turn result (`game.turns[tid].res` › engine suggestion) with its label; DP leader lines on selection; title «DSO · {COA} × {ECOA}» |

### 5.2 Timeline renderer — `WGTimeline` (js/timeline.js + css/timeline.css, prefix `tr-`)

Pure renderer of a `TimelineState` (§6.3), emitting hooks.

#### 5.2.1 DOM

```html
<div class="tr-root h-strip|h-lanes|h-full" data-testid="ruler">
  <div class="tr-bar">
    <button data-tr="prevEv">⏮</button><button data-tr="prevStep">◀</button><button data-tr="play" data-testid="play">▶/❚❚</button>
    <button data-tr="nextStep">▶</button><button data-tr="nextEv">⏭</button>
    <select data-tr="speed"><option>1 h/s</option><option selected>4 h/s</option><option>12 h/s</option><option value="steps">por pasos</option></select>
    <label><input type="checkbox" data-tr="dpPause"> Pausar en DP</label>
    <output class="tr-read" data-testid="tau-readout">H+08 · BELT 1 · Reacción roja</output>
    <button data-tr="scale">√ adaptativa</button><button data-tr="height">▲</button>
  </div>
  <div class="tr-body">
    <div class="tr-labels"><!-- lane labels, sticky left, 120 px (phone 56 px icons) --></div>
    <div class="tr-scroll"><svg class="tr-svg"><!-- axis, step bands, shading, lanes, items, ghost drafts --></svg>
      <div class="tr-cursor" role="slider" tabindex="0" aria-valuemin aria-valuemax aria-valuenow aria-valuetext="H+08 · BELT 1 · Reacción roja"><span class="tr-knob"></span></div>
    </div>
  </div>
  <div class="tr-legend">H = 00:00 del día D · D+n hasta el fin del día · √ escala adaptativa · pasos: convención de lectura</div>
</div>
```

- Heights: `strip` 64 px (bar + axis + phase and turn ribbons); `lanes` 260 px (vertical scroll inside when more); `full` 70 vh (the shell adds `#dbx`, the editable matrix, under the lanes).
- Layout: axis 22 px; rows 16 px; lane gap 4 px; sub-rows stacked. Phone: label column 56 px with icons; lanes scroll horizontally **inside** `.tr-scroll`.
- Items: `rect rx=2`; label inside when wide enough (≥ 40 px), else `<title>`; main effort outlined `--dp`; auto dotted; approximate feathered ends; unparsed hatched with «?»; DPs = diamond at `t0` + whisker to `t1`; points = diamonds.
- Window shading: outside `state.window` dimmed (`--mask` at 35 %); `state.steps` drawn as bands under the axis with the current step filled; `state.ghosts` drafts as dashed outlines in the method colour.
- The cursor is an absolutely positioned div (cheap to move): amber 2 px line + knob, aria slider.

#### 5.2.2 Interactions

| Gesture | Hook |
|---|---|
| drag the knob or the axis; click the axis | `tau(τ, 'move'|'end')`; snapping to .5 h and to item edges within 6 px (Shift disables) |
| keyboard on the cursor | `←/→` ±1 h, `Shift` ±6 h, `Home`/`End` window edges |
| click an item | `select(ref)` |
| drag on the «Turnos» lane when `state.brush` | `brush(t0, t1)` (manual turn creation) |
| drag the edges / body of items with `handles` | `retime(ref, t0, t1, phase)` |
| click a «＋» slot | `cellEdit(fn, tid)` |
| wheel / pinch on the body | `zoom({t0, t1})` |
| bar buttons | `play(on)`, `speed(v)`, `step(±1)`, `event(±1)`, `dpPause(on)`, `scale(mode)`, `height(h)` |

The playback clock lives in ui-mesa (one rAF loop); the timeline only reflects `state.playing`.

### 5.3 Linking map, ruler, panels and data

```
op data ──► U.mesa.scene()  (memo: WGLayout.geometry + WGScene.build + E.runPath via U.pathFor)
        ──► U.lens.bound()  (WGBound.get / forTurn, memo)
τ ──────► WGScene.at(scene, τ, {view, fog}) = Snapshot
Snapshot ─► U.mesa.mapState(snap) ─► U.lens.decorateMap(ms) ─► WGMap.update(ms)
Scene ────► U.mesa.timelineState() ─► U.lens.decorateTimeline(ts) ─► WGTimeline.update(ts)
Snapshot ─► WGScene.situation(...) ─► #hud (≤ 10 Hz while playing) and the ② reading (on pause / step change)
```

- **Full sync** `U.mesa.sync()` — on `U.shell.render()`, mode change, lens change, selection change, soft refresh: rebuild both states.
- **Frame** `U.mesa.frame()` — on τ change (scrub, playback, step jump): `WGScene.at` + dynamic MapState parts (static hashes unchanged so static layers are skipped) + `WGTimeline.setTau(τ)` + HUD (throttled). Budget §5.5.
- **Bus** (`U.bus`, ui-shell): `tau {τ, src}`, `sel {ref}`, `data {reason}`, `mode {mode}`, `lens {turnId|null, m}`, `step {turnId, step}`. ui-lens listens to `tau` to keep `op.ui.wgStep` in sync; ui-mesa listens to `data`, `lens`, `mode`.
- **Soft refresh** `U.shell.soft(reason)` (throttled 150 ms): called by `bind()` for data-b edits without `data-re` on paths `coas|ecoas|turns|reg|phases|cm|sectors|ces|geo|time|sync|prep|syncGeo` (and scope `g`). It re-syncs map, ruler, HUD and the mode badges, **not** the panel that holds the focused field.
- **τ persistence**: τ changes only memory during drag and playback; `U.save()` on pointer-up, pause, step change and mode change.
- **Playback**: `Δτ = hPerSec · dt`; «por pasos» jumps to each step start every 2.5 s (1 s pause at arb). An open turn clamps playback to its window and stops at arb. «Pausar en DP» stops when a DP window opens (orange flash on the diamond).

### 5.4 Turn view (③ 3c) — what the lens draws

Opening a turn (`U.lens.open(tid)`): `op.ui.lens.turnId = tid`, τ = `t0 + 1e-6`, bound = `WGBound.forTurn`, map flies to `bbox(bound) + 8 %`, ruler zooms to `[t0 − .1d, t1 + .1d]` with outside shading and step bands, playback clamps to the window. Per-turn Monte Carlo (`E.monteCarlo(o, c, e, cfg, { onlyTurn: tid, startStr: T.startStr, game: g, n: Math.min(1000, cfg.sim.n), tag: 'turn' })`) runs **once**, deferred (`setTimeout 0`), cached by `(pair, tid, hash(game.turns[tid]), U.keyOf(o))`; never on scrub.

**Mask tiers**: the turn area unmasked; the rest of the method bound `--mask` at .30; outside the method bound .62 (critical events: soft .35 spotlights).

**Reading rule** (header line, by method): Fajas «Faja: todas las funciones dentro de la faja» · Caja «Caja: sólo las fuerzas dentro de la caja · entradas: {tokens}» · Avenida «Avenida {AA} · segmento {i} de {n}» · Eventos críticos «Evento crítico {CE} · {título}» · Combinada «Secuencia combinada · {método del turno}».

| Step | Map emphasis (only actions classed in / inf / edge) | Panel field (only this one) |
|---|---|---|
| Pre-acción roja | red units at their start positions, red pre-placement arrows; NAIs inside pulse («qué ve el S2»); red pre text in the HUD | `ecoas.<ei>.plan.<tid>.pre` (`fTa`) |
| Acción azul | blue units glide to their anchors, tactical graphics draw on; fires / engineer / intel glyphs of the act window; main-effort halo | `coas.<ci>.plan.<tid>.a` + compact engagement list (units, task, sector, ME, «ver en el plano», «Editar en formulario») |
| Reacción roja | red units glide into contact, red axes; contact markers with the ratio of the start-of-turn state; red DPs in the window light up | `ecoas.<ei>.plan.<tid>.r` + «✦ Sugerir» (from `ce.r[ecoaId]`, existing `sug` action) + «✦ IA» (`aiTurn`) |
| Contrarreacción azul | engagements with `eng.step === 'cnt'` commit; HPT crosshair on `eng.hpt` (TRYZUB t3: r-b1-tk); fires bursts from cr/auto; DP prompt «DP-B1: ¿comprometer el CATK?» when a blue DP window overlaps the step → «Activado» / «No» write `reg.dp[i].st = 'TRIGGERED'` / keep and `game.turns[tid].dp` | `turns.<tid>.cr` (scope g) + «✦ Sugerir» (`ce.cr`) + assets chips (existing `addasset`/`rmasset`) + DP / CCIR selects (`turns.<tid>.dp`, `.ccir`) + `U.rolePanel(o, g, tt)` for staff roles |
| Árbitro | contact markers expand into callouts; strength rings animate start → end; below-FFIR and destroyed (< 20 %) markers; the ruler turn bar gets its result cap | engine summary per engagement + «Resultado del turno» select `turns.<tid>.res` + «Sugerido por el motor: {res} · Aplicar» (`lnAcceptEngine` = v0.3 `applySug`) + `rem`, `branch`, `bcp`, `rcp` |

**Adjudication callout** (leader line from the contact marker; content from `T.results[k]` of `U.pathFor` and the turn Monte Carlo): engagement label and sector; FE azul vs FE rojo and «× modificadores»; «Ratio {r} · mínimo {req} ✓/✗»; «Bajas A / R {lb} / {lr} %»; Monte Carlo outcome bar in the v0.3 `pbar` colours; outcome tag (engine, or «árbitro» when an override exists). Buttons: «Aceptar resultado del motor» (`turns.<tid>.res = T.suggested`), «Tirada del motor» (`E.rollEngagement` → «Aplicar» writes `game.turns[tid].ovr[engId] = {res, bl, rl}` like v0.3 `applyRoll`), «Imponer…» (selects bound to `turns.<tid>.ovr.<engId>.res|bl|rl` and `turns.<tid>.mods.<engId>.<k>`, scope g), «Abrir en la calculadora» (existing `engFR`). Every field is an existing game path, so the classic views show the same data.

**Penetration cue**: when a defensive main-effort engagement (`delay`, `screen`, `hastyDef`, `delibDef`) is adjudicated NEUTRAL or worse, draw a red notch past its anchor line and pre-focus the branch field with «¿Rama? Registre la rama o secuela».

**Unopposed red forces** (engine warnings) are drawn on every step from rea on: red hatching on the sector, «!» and «Fuerzas rojas sin oposición en {sector}: {unidades}».

**Closing** «Cerrar turno y pasar al siguiente» (`lnTurnClose`): proposes the engine suggestion when `res` is empty; opens the next turn of the same lens in chronological order (combined: next active turn); toast «El siguiente turno parte del estado adjudicado»; after the last turn the CTA becomes «Ir a Conclusiones →».

**Session clock**: «⏱ {n} min» from the turn string suffix, or the method budget from `prep.timeline` (`WGTime.sessionBudget`: «Belts 60 min» / 2 belt turns = 30 min each) with the time elapsed since the turn was opened (memory only), amber past the budget.

### 5.5 Performance budget (TRYZUB, mid-range laptop / recent phone ×3)

| Operation | Budget | Means |
|---|---|---|
| `WGLayout.geometry` + `WGScene.build` (cold) | ≤ 40 ms (phone ≤ 120 ms) | memo by content hash (FNV-1a over a stable JSON of the relevant parts) |
| Frame (τ change) | ≤ 4 ms for ≤ 60 units, ≤ 150 actions | `at()` = binary search per unit + interpolation; keyed patching; no `innerHTML`; no layout reads inside the loop except one `clientWidth` per view change |
| Ruler `setTau` | ≤ 1 ms | cursor div transform + active-class toggles |
| Panel render (`U.shell.render`) | ≤ 25 ms | string templates, one `innerHTML` per drawer, scroll positions preserved |
| Monte Carlo per turn | only on turn open, `n ≤ 1000`, deferred, cached | never on scrub |
| Memory | map and ruler mounted once; no listener leaks across renders | delegated listeners on `#dl`, `#dr`, `#dbx` |

No `backdrop-filter`; no SVG filters on phones; one rAF loop at most.

---

## 6. Module plan for parallel implementation

### 6.1 Files, owners and dependencies

One owner per file. «Existing» files may only be edited by their owner and only as listed in §6.7.

| Agent | Files (new unless marked) | Depends on (contract only) | Can start |
|---|---|---|---|
| **A** time-geo | `js/time.js` (WGTime), `js/geo.js` (WGGeo), `tests/run.js`, `tests/fixtures/make.js` (+ generated `tryzub.op.json`, `marazul.op.json`, `golden-v03.json`, and browser copies `*.fx.js`), `tests/time.test.js`, `tests/geo.test.js` | — | immediately |
| **B** layout | `js/layout.js` (WGLayout), **existing** `js/templates.js` (hints §6.7.9), `tests/layout.test.js` | WGTime, WGGeo, WGEngine.unitFE/unitMap | immediately (against A's signatures) |
| **C** scene | `js/scene.js` (WGScene), `tests/scene.test.js` | WGTime, WGGeo, WGLayout (Geom contract), WGEngine | immediately (Geom fixture §7) |
| **D** bound | `js/bound.js` (WGBound), **existing** `js/engine.js` (§4.25 only), `tests/bound.test.js`, `tests/engine-ls.test.js` | WGTime, WGGeo, WGLayout, WGScene contracts | immediately (Scene fixture) |
| **E** map | `js/map.js` (WGMap), `css/map.css`, `tests/fixtures/mapstate.tryzub.h08.fx.js`, `mapstate.marazul.h02.fx.js`, `dev/map.html` | WGCat.sym, WGGeo (helpers) | immediately (MapState fixture from §7) |
| **F** timeline | `js/timeline.js` (WGTimeline), `css/timeline.css`, `tests/fixtures/timelinestate.tryzub.fx.js`, `dev/timeline.html` | WGTime.scale | immediately (TimelineState fixture) |
| **G** shell | `js/ui-shell.js`, `css/shell.css`, `js/bgimage.js` (WGBg), **existing** `index.html`, `js/ui-core.js`, `js/model.js`, `js/ui-wargame.js` (exports), `js/ui-results.js` (exports), `README.md`, `tests/model.test.js`, `tests/i18n.test.js` | U.P / U.FS / U.bus contracts | immediately |
| **H** mesa | `js/ui-mesa.js`, `css/mesa.css` | everything above (contracts), `dev/stubs.js` until real modules land | after G's skeleton (day 1), with stubs |
| **I** lens | `js/ui-lens.js`, `css/lens.css` | WGBound, WGScene, U.mesa API | after G's skeleton (day 1), with stubs |
| **J** QA / integration | `tests/e2e/*.spec.js`, `tests/e2e/playwright.config.js`, `tests/package.json`, `dev/stubs.js` (shared stub file, see §6.8) | the running app | stubs day 0; e2e when H and I land |

Untouched: `js/catalog.js`, `js/ui-inputs.js`, `js/roles.js`, `js/ai.js`, `js/i18n.js`, `js/scenarios/*`.
All new files: one IIFE `(function (global) { 'use strict'; … })(typeof window !== 'undefined' ? window : globalThis);`, exactly one global each (`WGTime`, `WGGeo`, `WGLayout`, `WGScene`, `WGBound`, `WGMap`, `WGTimeline`, `WGBg`; UI modules attach to `WGUI`). Pure modules (A–D) must not touch `document`, `window.localStorage`, `WGUI`.

### 6.2 Load order (`index.html`)

```html
<link rel="stylesheet" href="css/app.css">
<link rel="stylesheet" href="css/shell.css">
<link rel="stylesheet" href="css/map.css">
<link rel="stylesheet" href="css/timeline.css">
<link rel="stylesheet" href="css/mesa.css">
<link rel="stylesheet" href="css/lens.css">
…
<script src="js/i18n.js"></script>            <!-- moved first: every module may Object.assign(WGI18N.en, …) -->
<script src="js/catalog.js"></script>
<script src="js/engine.js"></script>
<script src="js/time.js"></script>
<script src="js/geo.js"></script>
<script src="js/model.js"></script>
<script src="js/scenarios/tryzub-v2seed.js"></script>
<script src="js/scenarios/tryzub.js"></script>
<script src="js/scenarios/marazul.js"></script>
<script src="js/templates.js"></script>
<script src="js/layout.js"></script>
<script src="js/scene.js"></script>
<script src="js/bound.js"></script>
<script src="js/ui-core.js"></script>
<script src="js/ui-inputs.js"></script>
<script src="js/ui-wargame.js"></script>
<script src="js/ui-results.js"></script>
<script src="js/roles.js"></script>
<script src="js/bgimage.js"></script>
<script src="js/map.js"></script>
<script src="js/timeline.js"></script>
<script src="js/ui-shell.js"></script>
<script src="js/ui-mesa.js"></script>
<script src="js/ui-lens.js"></script>
<script src="js/ai.js"></script>             <!-- stays last: wraps U.boot -->
<script>WGUI.boot();</script>
```

`U.FUNCS` (roles.js) and `U.prepReadiness` (ui-inputs.js) are read lazily at render time.

### 6.3 Frozen contracts

**Ref grammar** (selection, `data-ref`, lens classes): `unit:<id>` · `cm:<cm string>` · `sec:<id>` · `av:<sectorId>` · `nai:<id>` · `tai:<id>` · `dp:<id>` · `hpt:<id>` · `eng:<tid>:<engId>` · `place:<ecoaId>:<tid>:<sector>` · `txt:a|pre|r|cr:<tid>` · `sync:<fn>:<tid>` · `auto:<fn>:<tid>:<k>` · `turn:<id>` · `phase:<id>` · `ce:<id>` · `bound:<m>` · `usr:<id>`.

```js
// ---------- WGLayout ----------
Feature = { id, ref, kind, sub, name, label, pts: [[u,v]], closed, side: 'B'|'R'|'N', p, q, sector, conf, src: 'auto'|'user', implicit, orphan, evidence }
Sector  = { id, name, role: 'lateral'|'depth', depthRole: 'front'|'rear'|null, q0, q1, qc, p0, p1, tile: [[u,v]], tint: 0|1 }
Route   = { id: 'av:Z11', sector, label: 'AA Z11', pts: [[u,v]], ptsPQ: [[p,q]], width, dominant }
Geom = {
  v: 1, hash, aspect, H,
  axis: { att, from, auto, why }, frame: { pq2uv(p,q) → [u,v], uv2pq(u,v) → [p,q] }, opKind,
  sectors: [Sector], depth: { [ref]: p }, protectedLines: [ref], linesByDepth: [ref],
  features: [Feature], byRef: { [ref]: Feature },
  routes: [Route], dominant: 'av:Z11',
  flot: { pts: [[t,p]], at(t) → p, inv(p) → t },
  terrain: { sea: [[u,v]]|null, coast: [[u,v]]|null, rivers: [[[u,v]]], urban: [[[u,v]]], roads: [[[u,v]]], relief: [[[u,v]]], veg: [[[u,v]]] },
  review: [{ ref, name, why, conf }], unresolved: [{ text, src }], orphans: [ref], implicit: [{ name, kind, src }],
  gz: { list, match(text) → [{ refs, kind, idx, len, key, generic }] }, units: { match(text) → [unitId] }
}
// ---------- WGScene ----------
Windows  = { turn: {[tid]: Win}, phase: {}, ce: {}, nai: {}, dp: {}, tai: {}, hpt: {}, range: { t0, t1 }, breaks: [t], warn: [] }
Win      = { t0, t1, src, approx, session, ok }
StepSpan = { id: 'pre'|'act'|'rea'|'cnt'|'arb', label, f0, f1, t0, t1 }
Action = { id, src: 'eng'|'place'|'txt'|'sync'|'auto'|'nai'|'tai'|'dp'|'hpt'|'ce'|'phase'|'turn',
  side: 'B'|'R'|'N', fn, tid, step, t0, t1, point, approx, label, text, units: [id], refs: [ref], sector,
  at: [u,v]|null, pts: [[u,v]]|null, closed, target: [u,v]|null, me, task, res, ratio, req, margin,
  path, scope: ''|'g', auto, unopposed, state, conf }
Lane = { id, kind, label, side, fn, rows: [[Item]], spark: { b: [[t,v]], r: [[t,v]], ffir } | null, collapsed }
Item = { id, t0, t1, point, approx, label, cls, state, ref: { type, id, tid, fn }, auto, handles }
Tracks = { units: { B: [id], R: [id] }, keys(id) → [KF], at(id, τ) → UnitPos|null }
KF      = { t, p, q, dep, src: 'start'|'plan'|'user', cm, tid }
UnitPos = { id, side, u, v, p, q, moving, heading, str, ffir, me, cm, known: 'live'|'last'|'hidden', lastT }
Scene = { hash, op, coa, ecoa, ghost, game, cfg, path, geom, win: Windows, steps: { [tid]: [StepSpan] },
  chained: [tid], chainAlerts: [Alert], actions: [Action], byId: { [id]: Action }, tracks: Tracks, ghostTracks,
  lanes: [Lane], checks: [Check], meAnchor: { [tid]: [u,v] } }
Snapshot = { τ, phase, turn, step, stepWin, units: [UnitPos], contacts: [Contact], nai: [{ id, state }], dp: [{ id, state, frac, left }],
  active: [actionId], flot: [[[u,v]]], alerts: [Alert] }
Contact  = { id: 'eng:<tid>:<engId>', u, v, ratio, req, margin: 'ok'|'warn'|'bad', outcome, manual, me, lb, lr, shown: 'ratio'|'outcome' }
Situation = §4.18;  Alert = Check = { k, text?, v, refs, cls }
// ---------- WGBound ----------
Bound = §4.20;  TurnDraft = §4.23;
Diff = { rows: [{ draft, action: 'keep'|'update'|'covered'|'new', match, by, iou, checked, note }],
         orphans: [{ tid, cover, def: 'keep'|'replace', choice }], overlaps: [{ key, tid, m, hours }],
         chain: [ChainRow], notes: [{ k, v }] }
ChainRow = { tid, label, m, t0, t1, sim, issues: ['orden'|'solape'|'sinPlan'] }
// ---------- WGMap ----------
MapState = {
  v: 1, aspect, hash: { base, cm },
  bg: { kind: 'schematic', relief, grid } | { kind: 'image', data, op, wash },
  terrain,                                   // Geom.terrain
  sectors: [{ id, label, tile, tint }], boundaries: [{ id, pts }],
  features: [{ id, ref, kind, sub, name, label, pts, closed, side, conf, cls }],
  flot: { lines: [[[u,v]]], label } | null,
  units: [{ id, ref, side, unit: { side, type, ech }, label, u, v, str, ffir, me, sel, ghost, moving, known, lastT, cls, badge }],
  graphics: [{ id, ref, kind, side, pts, label, cls, seq, time }],
  isr: [{ id, ref, kind: 'nai'|'tai', pts, closed: true, label, state, cls }],
  dps: [{ id, ref, u, v, label, side, state: 'before'|'open'|'after'|'triggered'|'missed', frac, txt, cls }],
  hpts: [{ id, ref, u, v, label }],
  glyphs: [{ id, ref, fn, u, v, label, cls, auto }],
  contacts: [Contact & { ref, cls }],
  callouts: [{ id, ref, u, v, html }],
  links: [{ id, pts, cls }],                 // DSO leader lines
  unopposed: [{ id, sector, pts, label }],   // red hatching
  edges: [{ id, u, v, label, side, kind: 'entry'|'flank' }],
  mask: null | { holes: [[[u,v]]], tiers: [{ pts, alpha }], alpha, color: 'method-belt' },
  bounds: [{ id, kind, pts, method, label, cls, handles: [{ id, u, v, axis: 'p'|'free' }] }],
  layers: { base, cm, red, blue, isr, sync, adj, method, relief, grid }, fnOn,
  sel, edit, tool, draft: { kind, pts } | null,
  title: { line1, line2 }, marg: { classif, scale: 'ESQUEMA — NO A ESCALA' }
}
// ---------- WGTimeline ----------
TimelineState = { v: 1, range: { t0, t1 }, scale: { mode, breaks }, tau, playing, speed, dpPause,
  window: { t0, t1 } | null, steps: [StepSpan] | null, lanes: [Lane], height: 'strip'|'lanes'|'full',
  sel, ghosts: [{ t0, t1, label, cls }], brush: bool, readout: 'H+08 · BELT 1 · Reacción roja',
  legend: { conv, scaleBadge } }
```

### 6.4 Pure module APIs

**js/time.js — `WGTime`** (agent A)
```
parse(str, opts?) → ParseResult                       // §4.1
tokens(text, { free }?) → [Token]
fmt(h, { style, hHour }?) → string                    // 'H+12', 'H+7:30', 'D-1'
fmtSpan(t0, t1, orig?, opts?) → string                // 'H+12 → H+24', keeps suffix and D style
overlap(a0, a1, b0, b1) → hours; iou(a0, a1, b0, b1) → 0..1
scale(range, mode, breaks) → { mode, x(t), t(x), ticks(pxPerH) → [{ t, label, major }] }
steps(initiative, frac?) → [StepSpan without t0/t1]
stepWindow(win, steps, id) → [t0, t1];  stepAt(win, steps, τ) → id|null
sessionBudget(text) → { total, byMethod: { critical, belt, box, avenue } } (minutes)   // 'Phase I 45 min · Belts 60 min · Avenue 60 min (≈3 h serial)' → total 180
```
**js/geo.js — `WGGeo`** (agent A)
```
hash(str) → uint32 (FNV-1a);  rng(seed) → () → [0,1)  (mulberry32)
lerp, clamp, smooth, dist(a, b), bbox(pts) → [u0,v0,u1,v1], centroid(pts), pip(pt, poly), hull(pts)
rect(u0, v0, u1, v1) → pts;  buffer(pts, r, closed) → poly;  circle(c, r, n=12) → poly
polyLen(pl), pointAt(pl, s), project(pl, pt) → { s, d, pt }, nearest(pt, list, maxD)
segHitsPoly(a, b, poly), polysTouch(a, b), distToPoly(pt, poly)
wavy(a, b, seed, amp, n) → pts;  blob(center, rx, ry, seed, n) → pts
pathD(pts, closed, smooth) → svg 'd'
gridRef(u, v, cols=10, rows=7) → 'H6'
```
**js/layout.js — `WGLayout`** (agent B)
```
classify(name) → { kind, sub }
gazetteer(op) → gz;  unitIndex(op) → { match(text) → [unitId] }
opKind(op) → string;  axis(op) → { att, from, auto, why };  frame(axis) → { pq2uv, uv2pq }
pairs(gz, text) → [{ a, b, kind }]
geometry(op) → Geom                                       // memo by hash
resolveLoc(geom, str, ctx?) → { ok, pts, closed, refs, how, sector }
anchor(geom, text, ctx) → { u, v, p, q, ref, how, conf }  // §4.15, ctx { sector, task, side, cm, tWin }
offset(geom, anchor, side, task, k, n) → { u, v, p, q }    // §4.15 side offsets and fan-out
// mutators (write op.geo / op.cm only)
setLineDepth(op, ref, p); setFeature(op, ref, patch); resetFeature(op, ref); resetAll(op)
addFeature(op, f) → ref; removeFeature(op, ref); setAxis(op, axis|null); setSector(op, id, q0, q1)
```
**js/scene.js — `WGScene`** (agent C)
```
windows(op) → Windows
stepsOf(op, turn, win) → [StepSpan]
chain(op, win) → { chained: [tid], alerts: [Alert] }
build(op, coa, ecoa, game, cfg, path, opts?) → Scene     // opts { ghostEcoa, ghostPath, ech }; memo by hash
at(scene, τ, opts?) → Snapshot                           // opts { view: 'white'|'blue'|'red', fog, lensTurnId }
situation(scene, snap, { t, resL }) → Situation
checks(scene) → [Check]                                  // §4.19
cpAt(scene, τ) → { b, r }
```
**js/bound.js — `WGBound`** (agent D)
```
METHODS = { critical: { pre: 'KEY EVENT', color: 'm-critical' }, belt: { pre: 'BELT', color: 'm-belt' },
            box: { pre: 'BOX', letters: true, color: 'm-box' }, avenue: { pre: 'SEGMENT', color: 'm-avenue' } }
recommend(scene) → [{ m, score, level: 'rec'|'ok'|'low', why: [{ k, v }] }]
candidates(scene, m) → [Bound]
auto(scene, m) → Bound;  get(op, scene, m) → Bound;  set(op, m, patch);  reset(op, m)
link(scene, bound, changed: 'space'|'time') → Bound
forTurn(scene, turn) → Bound
classify(scene, action, bound) → 'in'|'inf'|'edge'|'ctx'|'out'
filter(scene, bound) → { cls, counts, outsideEngs, entries, flank }
propose(scene, { m, mode, bound, opts }) → { drafts: [TurnDraft], notes }
diff(op, scene, drafts, m) → Diff
apply(op, scene, diff, choices) → { added, updated, removed, undo }
undo(op, snapshot)
chain(op) → [ChainRow]
```

### 6.5 View module APIs

**js/map.js — `WGMap`** (agent E)
```
mount(el, hooks) → inst
  hooks = { select(ref, ev), hover(ref), dragUnit(id, uv, phase, snapRef), dragFeature(ref, geo, phase),
            dragLine(ref, p, phase), dragHandle(boundId, handleId, uv, phase), drawDone(kind, pts), view({ x, y, w, h, k }) }
inst.update(state: MapState)            // diffing renderer §5.1.2
inst.fit(target: 'all'|bbox|poly, anim = true)
inst.zoomBy(f, at?: [u,v]);  inst.getView() → { x, y, w, h, k }
inst.toSVGString() → string;  inst.destroy()
WGMap.GLYPH = { c2, intel, man, fires, eng, info, cimic, sust, pers, prot, legal }   // inner SVG markup
WGMap.symbol(unit, size) → string;  WGMap.graphic(kind, pts, side, label) → string
WGMap.path / arrow / tbar / uglyph / waves / arc                                   // helpers §5.1.3
```
**js/timeline.js — `WGTimeline`** (agent F)
```
mount(el, hooks) → inst
  hooks = { tau(τ, phase), select(ref), brush(t0, t1), retime(ref, t0, t1, phase), cellEdit(fn, tid),
            play(on), speed(v), step(dir), event(dir), dpPause(on), scale(mode), height(h), zoom({ t0, t1 }) }
inst.update(state: TimelineState);  inst.setTau(τ, readout);  inst.setPlaying(on);  inst.destroy()
```

### 6.6 UI modules (WGUI pattern: string-render functions, `data-a` actions, `data-b` bindings)

**Registries created by ui-shell.js** (other modules only add entries):
- `U.P` panels: `U.P[key] = (ctx) → html`. Keys and owners: `plano.l`, `superposicion.l`, `conclusiones.l`, `detail`, `matrix`, `hud`, `ticker`, `layers` → **mesa**; `confrontacion.l`, `detail.lens` (used by `detail` for refs `bound:*`, `turn:*` while in ③) → **lens**.
- `U.PA[key] = () → void` after-render hooks (same keys).
- `U.FS[mode] = () → { decide, missing: [{ text, cls, a?, data? }], cta: { label, a, data, disabled, why } }` — mesa: `plano`, `superposicion`, `conclusiones`; lens: `confrontacion`.
- `U.bus = { on(ev, fn), off(ev, fn), emit(ev, payload) }`.
- `U.ic(name, size)` icons (§2.6).

**`U.shell`** (agent G, js/ui-shell.js)
```
active() → store.flow !== false
boot()                       // called by ui-core boot right after load(): theme, body classes, mount #stage once via U.mesa.mount()
render()                     // header extras (#modes badges, #pair, menu), #dl ← U.P[mode+'.l'], #dr ← U.P.detail(sel) if open,
                             // #dbx ← U.P.matrix() if ruler 'full', #hud ← U.P.hud(); forms open → U.renderLegacy() inside #forms;
                             // then U.mesa.sync(); then U.PA hooks; preserves scrollTop of #dl/#dr/#dbx/#forms body
soft(reason)                 // throttled 150 ms: U.mesa.sync({ soft: true }), #hud, #modes badges; never rebuilds the focused panel
mode(id)                     // store.mode = id; ruler preset (plano 'strip', superposicion / confrontacion / conclusiones 'lanes'; a user change
                             // persists until the next mode switch); U.bus.emit('mode'); save; render
openForms(sec, opts?)        // opts per §1.6; store.sec = sec; store.forms = true; save; render
closeForms()
drawer(name: 'l'|'r'|'b', state)
toast(msg, actionLabel?, actionFn?)   // toast with an action link («Deshacer»)
```
Actions (`U.A`): `shMode` (d.t), `shForms` (d.t section, optional), `shFormsClose`, `shMenu`, `shTheme` (d.t auto|light|dark), `shClassic` (store.flow = false), `shFlow` (store.flow = true; button in the classic header), `shDrawer` (d.k, d.t), `shPanel` (collapse #dl), `shTab` (phone tab d.t), `shDemo`, `shCoach` (d.k dismiss), `shHelp`.
Also: delegated keyboard dispatcher (§1.8; numbers → `shMode`, others call `U.mesa`/`U.lens` APIs), **parse chips** (§6.7.6), `U.renderLegacy` wrapper scroll handling, «Qué decide aquí / Qué falta / CTA» frame rendering from `U.FS[mode]()`, Formularios bar, phone tab bar.

**`U.mesa`** (agent H, js/ui-mesa.js)
```
mount()                      // once: WGMap.mount(#map, hooks), WGTimeline.mount(#tl, hooks)
scene() → Scene              // WGScene.build(op, U.coa(), U.ecoa(), U.game(true), U.cfg(), U.pathFor(...), { ghostEcoa, ghostPath, ech })
geom() → Geom
sync(opts?)                  // full MapState + TimelineState for current mode/lens/τ/selection
frame()                      // τ-only update (§5.3)
setTau(τ, src)               // clamp to range (or open turn window), op.ui.tau, frame(), U.bus.emit('tau')
play(on), speed(v), stepBy(dir), eventBy(dir)
select(ref), focus(ref, { fly: true })
mapState(snap) → MapState;  timelineState() → TimelineState
undoGeo()                    // single-level geometry undo
```
Actions: `msTau` (d.t number), `msPlay`, `msSpeed` (d.v), `msStep` (d.d ±1), `msEvent` (d.d), `msDpPause`, `msRead` (d.t instant|plan), `msLayer` (d.k), `msFn` (d.k), `msFog`, `msGhost` (d.t ecoaId|''), `msEch` (d.t), `msEdit`, `msTool` (d.t), `msSel` (d.ref), `msFocus` (d.ref), `msFit`, `msZoom` (d.d), `msBgUpload` (opens file input `#bgFile`; change handler `data-ch="msBgFile"`), `msBgClear`, `msBgOp` (d.v), `msAxis` (d.t E|W|N|S|auto), `msResetFeat` (d.ref), `msResetAll`, `msUndo`, `msConfirm` (d.ref), `msPlaceAt` (`data-ch`, sector + CM selects), `msAddCm` (d.name), `msKfDel` (d.layer, d.u, d.i), `msCellAnchor` (d.fn, d.tid, `data-ch` select), `msCellWin` (d.fn, d.tid, f0/f1), `msDpMark` (d.id, d.st TRIGGERED|MISSED|WATCH), `msExportSvg`, `msPrintDso`, `msScale` (d.t), `msHeight` (d.t).
Panels: §1.4 ①, ② and ④ content; `detail` dispatcher by ref type (unit, cm/feature, eng, place, nai/tai/dp/hpt, sync/auto, turn, phase) with «Editar en formulario» deep links (§1.6); `matrix` = functions × turns (sorted by time) grid of `fTa('sync.<fn>.<tid>', 2, '', '', 'g')` with an «auto» preview chip per empty cell and an «📍 anclar» select (`syncGeo`); `hud`/`ticker` from `WGScene.situation`; `layers` popover.

**`U.lens`** (agent I, js/ui-lens.js)
```
active() → !!op.ui.lens.turnId;  method() → op.prep.mActive;  sub() → op.ui.lens.sub
bound() → Bound|null          // method bound (3a preview, 3b) or forTurn (3c); memo
filterNow() → filter result   // WGBound.filter for the current bound, memo
open(tid), close(), step(id), next(), prev(), closeTurn()
preview(m)                    // hover/tap preview of a method's auto bound
decorateMap(ms, scene, snap) → ms      // mask, bounds+handles, classes, edges, flank, callouts, step emphasis, unopposed
decorateTimeline(ts, scene) → ts       // window, steps, ghosts (drafts), brush flag, readout
callout(engRef) → html
onTau(τ)                      // keeps op.ui.wgStep/wgTurn in sync (§4.4); subscribed to U.bus 'tau'
```
Actions: `lnSub` (d.t), `lnMethod` (d.m incl. `combined`), `lnPreview` (d.m), `lnActivate` (d.m — explicit `prep.methods[m] = true`), `lnBound` (`data-ch` handler for the bound controls: d.k from|to|route|w|t0|t1|sectors), `lnBoundReset`, `lnLink`, `lnBoxAdd` (`data-ch`), `lnBoxDel` (d.ref), `lnGenMode` (d.t manual|phase|key|geo), `lnGenOpt` (d.k, `data-ch`), `lnGenRow` (d.i toggle), `lnGenForce` (d.i), `lnGenOrphan` (d.tid, d.t keep|nochain|remove), `lnGenOverlap` (d.t nochain|disable|keep), `lnGenApply`, `lnGenUndo`, `lnTurnAdd` («＋ Turno aquí»), `lnTurnOpen` (d.id), `lnTurnClose`, `lnStep` (d.t), `lnStepNext`, `lnStepPrev`, `lnAcceptEngine` (d.id), `lnRoll` (d.id, d.e), `lnRollApply`, `lnDp` (d.id, d.st), `lnShowAll`, `lnOpenFromClassic` (d.id: closes forms, mode ③, opens the turn).

**`data-testid`** (required, for §8.2): `mode-plano`, `mode-superposicion`, `mode-confrontacion`, `mode-conclusiones`, `pair`, `panel`, `cta`, `todo`, `layout-banner`, `review-list`, `edit-toggle`, `map`, `hud`, `ruler`, `play`, `tau-readout`, `reading`, `method-critical|belt|box|avenue|combined`, `bound-summary`, `gen-mode`, `gen-preview`, `gen-apply`, `chain-preview`, `turn-chip-<tid>`, `step-<id>`, `worksheet`, `callout-<engId>`, `detail`, `forms`, `forms-close`, `matrix`, `dsm`, `theme`, `menu`. Map elements expose `data-ref`; units also `data-u="<unitId>"` and `data-x/data-y` (SVG user units: `x = 1000·u`, `y = H·v`, rounded to 0.1) for position assertions.

### 6.7 Changes to existing files (exact)

#### 6.7.1 js/ui-core.js (agent G)

1. `freshStore()` (line 14): add `flow: true, mode: 'plano', forms: false, theme: 'auto', coach: { v04: true, demo: false, tips: {} }`.
2. `load()` (line 18), after `o.cfg = mergeCfg(o.cfg);`: `if (o.flow == null) o.flow = true; if (!o.mode) o.mode = 'plano'; o.forms = false; if (!o.theme) o.theme = 'auto'; o.coach = Object.assign({ v04: false, demo: false, tips: {} }, o.coach || {});`
3. `keyOf` (line 131): unchanged formula (turn objects already include `ls`, `bound`, `sim`), **exported**: add `keyOf` to the `Object.assign(U, {…})` list (line 297).
4. `U.renderNav` (line 164): first line `const side = $('side'); if (!side) return;` and use `side.innerHTML`.
5. `U.go` (line 179): `U.go = function (id) { store.sec = id; if (U.shell && U.shell.active()) { U.shell.openForms(id); return; } U.render(); window.scrollTo(0, 0); save(); };`
6. `U.render` (line 195):
   ```js
   function renderLegacy() { const y = window.scrollY; const f = U.R[store.sec] || U.R.inputs; $('main').innerHTML = f(); window.scrollTo(0, y); U.renderNav(); U.renderAssist(); if (U.after[store.sec]) U.after[store.sec](); }
   U.renderLegacy = renderLegacy;
   U.render = function () { fid = 0; const o = op(); W.ensure(o); renderHeader();
     if (U.shell && U.shell.active()) { U.shell.render(); return; }
     renderLegacy(); };
   ```
7. `bind()` (line 232), after `save();`: keep the existing `data-re` branch; add `else if (U.shell && U.shell.active() && (scope === 'g' || /^(coas|ecoas|turns|reg|phases|cm|sectors|ces|geo|time|prep)\b/.test(el.dataset.b))) U.shell.soft('bind');`
8. `exportOp` / `exportAll` (lines 269–270): serialise `global.WGBg ? WGBg.inline(W.clone(op())) : op()` and, for the full copy, `Object.assign({}, store, { ops: store.ops.map(x => global.WGBg ? WGBg.inline(W.clone(x)) : x) })`.
9. `importText` (line 279): inside `list.forEach`, after the id de-duplication: `if (global.WGBg) WGBg.extract(x);`.
10. `U.boot` (line 301): right after `store = load();` call `if (U.shell && U.shell.boot) U.shell.boot();` (before `U.render()`).
11. `renderHeader()` must keep working with the moved elements: `#opTitle`, `#opTag`, `#opSel`, `#asBtn`, `#assist`, `#printBtn` (optional) and `[data-lang]` stay in the DOM (§6.7.2).

#### 6.7.2 index.html (agent G) — body

```html
<body>
<header id="top">
  <div class="logo" aria-hidden="true">WG</div>
  <div class="ttl"><b id="opTitle">COA Wargaming</b><span><span data-i18n="Paso 4 · Análisis de líneas de acción">Paso 4 · Análisis de líneas de acción</span> · <span id="opTag"></span></span></div>
  <select id="opSel" aria-label="Operación activa"></select>
  <nav id="modes" class="sh-modes" aria-label="Modos"></nav>
  <div id="pair" class="sh-pair" data-testid="pair"></div>
  <div class="hdr">
    <div class="seg" role="group" aria-label="Idioma"><button class="tbtn" data-a="lang" data-lang="es">ES</button><button class="tbtn" data-a="lang" data-lang="en">EN</button></div>
    <button class="tbtn" data-a="shMenu" data-testid="menu" aria-haspopup="true" aria-label="Menú">⋯</button>
    <span id="saveState">—</span>
  </div>
  <div id="shMenu" class="sh-menu" hidden>
    <button data-a="exportOp">…</button> <button data-a="exportAll">…</button> <button data-a="importOpen">…</button>
    <input type="file" id="imp" accept=".json,application/json" hidden>
    <button data-a="msExportSvg">…</button> <button data-a="msPrintDso">…</button> <button data-a="shForms">…</button>
    <label>…<select id="roleSel" aria-label="Rol activo"></select></label>
    <div class="seg" data-testid="theme">…shTheme auto/light/dark…</div>
    <button class="tbtn" id="asBtn" data-a="assist">…</button> <button class="tbtn" id="printBtn" data-a="print" hidden>…</button>
    <button data-a="go" data-t="ai">…</button> <button data-a="go" data-t="data">…</button> <button data-a="shClassic">…</button>
  </div>
</header>
<div id="app" class="sh-app">
  <aside id="dl" class="sh-dl" data-testid="panel"></aside>
  <section id="stage" class="sh-stage">
    <div id="map"></div><div id="hud" class="sh-hud" data-testid="hud"></div><div id="stools" class="sh-stools"></div>
  </section>
  <section id="db" class="sh-db"><div id="tl"></div><div id="dbx" data-testid="matrix"></div></section>
  <aside id="dr" class="sh-dr" data-testid="detail" hidden></aside>
  <nav id="tabs" class="sh-tabs" hidden></nav>                       <!-- phone tab bar -->
  <div id="forms" class="sh-forms" data-testid="forms" hidden>
    <div class="sh-forms-bar"></div>
    <div class="sh-forms-body"><nav id="side" aria-label="Fases del proceso"></nav><main id="main"></main><aside id="assist" aria-label="Asistente"></aside></div>
  </div>
</div>
<input type="file" id="bgFile" accept="image/jpeg,image/png,image/webp" data-ch="msBgFile" hidden>
<div class="modal" id="modal" hidden><div class="box" id="mbox" role="dialog" aria-modal="true"></div></div>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
<!-- scripts: §6.2 -->
</body>
```

In classic mode (`store.flow === false`, `body.classic`), CSS hides `#modes`, `#pair`, `#dl`, `#stage`, `#db`, `#dr`, `#tabs`, shows `#forms` as the normal v0.3 grid (`#side | #main | #assist`) without the bar, and the `⋯` menu shows «Volver a la vista nueva» (`shFlow`). The legacy header buttons stay reachable in the menu.

#### 6.7.3 js/model.js (agent G)

§3.11 exactly (`newGame` + `ensure` additions). No other change.

#### 6.7.4 js/engine.js (agent D)

§4.25 exactly (`lossShare`, two insertions, export). No other change.

#### 6.7.5 js/ui-wargame.js and js/ui-results.js (agent G; exports only)

- ui-wargame.js, before the closing `})(…)`: `U.engCard = engCard; U.gturn = gturn; U.wgSteps = steps;`. In `turnView` (line 63, the header row with label and title) add, after the method/CE text: `${U.A.lnOpenFromClassic ? `<button class="btn sm" data-a="lnOpenFromClassic" data-id="${esc(tt.id)}">◎ ${t('Ver en el plano')}</button>` : ''}`.
- ui-results.js, after `U.after.results = wireCharts;` (line 127): `Object.assign(U, { record, observations, lineChart, wireCharts });`.

#### 6.7.6 Parse chips (agent G, no edits to ui-inputs.js / ui-wargame.js)

After every `U.renderLegacy()` and every panel render, `U.shell` decorates inputs whose `data-b` matches `^phases\.\d+\.t$`, `^turns\.\d+\.time$`, `^reg\.nai\.\d+\.time$`, `^reg\.dp\.\d+\.win$`: inserts `<span class="sh-parse">` after the input with `WGTime.parse(value, op.time)` (§2.5), and updates it on `input` events (delegated listener).

#### 6.7.7 Theme (agent G)

`U.shell.boot()` and `shTheme` apply `store.theme` to `document.documentElement` (§2.2) and set `body.sh-on` / `body.classic`.

#### 6.7.8 README.md (agent G)

New «Novedades de la v0.4» section: the four modes, the derived map («esquema, no a escala»), the time conventions (H, D inclusive, session minutes, steps as a reading convention), turn generation and `ls`, images and storage, the classic view, compatibility (v0.4 → v0.3: `ls` ignored).

#### 6.7.9 js/templates.js (agent B)

Add to each `LIST` entry `axis` and `cm`, and in `apply()` copy `op.cm = (P.cm || []).slice()`. Rewrite a few titles/phase texts so belts and segments can be cut (line pairs). Required content:

| key | axis | cm | text changes |
|---|---|---|---|
| blank | — | [] | — |
| delibAtk | `{att:'B', from:'W'}` | `LD`, `PL ALFA`, `Cinturón de obstáculos`, `PL BRAVO`, `OBJ ÁGUILA`, `LOA` | SEGMENT 1 «Aproximación: LD → PL ALFA»; BOX A «Ruptura del cinturón de obstáculos en PL ALFA»; KE1 «Asalto: PL BRAVO → OBJ ÁGUILA»; KE2 «Contraataque enemigo y consolidación en la LOA» |
| areaDef | `{att:'R', from:'E'}` | `FLOT`, `PL ALFA`, `EA NORTE`, `EA SUR`, `PL BRAVO`, `BP 1`, `BP 2`, `PL CHARLIE` | BELT 1 «Zona de seguridad: FLOT → PL ALFA»; BELT 2 «Zona principal: PL ALFA → PL BRAVO (EA NORTE / EA SUR)» |
| mobDef | `{att:'R', from:'E'}` | `PL ALFA`, `PL BRAVO`, `EA DESTRUCCIÓN`, `BP RESERVA` | BELT 1 «Fijación: PL ALFA → PL BRAVO» |
| delay | `{att:'R', from:'E'}` | `PL ALFA`, `PL BRAVO`, `PL CHARLIE`, `BP 1`, `BP 2` | BELT 1 «Retardo de PL ALFA a PL BRAVO»; BELT 2 «Retardo de PL BRAVO a PL CHARLIE» |
| gap | `{att:'B', from:'W'}` | `LD`, `Punto de paso 1`, `Punto de paso 2`, `Línea de cabeza de puente`, `OBJ RUPTURA` | phase F2 dc «Línea de cabeza de puente» |
| amph | `{att:'B', from:'W'}` | `Playa 1`, `Playa 2`, `Línea de cabeza de playa`, `ZD 1`, `OBJ FUERZA` | phase F2 dc «Cabeza de playa mantenida»; F3 dc «OBJ FUERZA» |
| urban | `{att:'B', from:'W'}` | `Cordón exterior`, `PL ALFA`, `PL BRAVO`, `OBJ CENTRO` | phases and turns times «D», «D+1», «D+2 → D+4», «D+5 →» (§4.1) |
| airAslt | `{att:'B', from:'W'}` | `LZ 1`, `LZ 2`, `Línea de cabeza aérea`, `PL ENLACE` | — |
| mtc | `{att:'B', from:'W'}` | `LD`, `PL ALFA`, `PL BRAVO`, `PL CHARLIE` | SEGMENT 1 «Avance: LD → PL ALFA» |

Also add the classification kind `obstacle` (`/obst[aá]culo|cintur[oó]n|campo de minas|minefield/` → drawn as an obstacle belt line) and the depth roles: sector names matching `/seguridad|security|cobertura|covering/` are `depthRole: 'front'` (placed before the lateral sectors, `p ∈ [0, .25]`), other depth sectors are `rear` (§4.8).

### 6.8 Stubs, fixtures and development harness

- `tests/run.js` (A): loads files into a `vm` context with a `window` shim in `index.html` order (only the pure ones + catalog, engine, model, scenarios, templates), runs every `tests/*.test.js` (each exports `async (ctx, assert) => {}`), prints a summary, exits non-zero on failure. `node tests/run.js [pattern]`.
- `tests/fixtures/make.js` (A): builds TRYZUB and MAR AZUL with the scenario builders and writes `tryzub.op.json`, `marazul.op.json`, `golden-v03.json` (`E.runPath` and `E.monteCarlo` results for every pair, from `git show dc851dc:js/engine.js`), plus browser copies `*.fx.js` (`window.FX = window.FX || {}; FX.tryzubOp = …`).
- `dev/stubs.js` (J, day 0; never loaded by `index.html`): defines `WGLayout`, `WGScene`, `WGBound` **only if undefined**, returning the §7 fixtures for TRYZUB/MAR AZUL (static Geom, a Scene with the §7 actions and tracks as piecewise keyframes, a Bound per method) so H and I can build the UI before C/D finish. `dev/app.html` = `index.html` + `dev/stubs.js` before `ui-shell.js`.
- `dev/map.html` (E) and `dev/timeline.html` (F): standalone harnesses that mount the renderer with the fixture state, a τ slider and theme/phone toggles.
- Each agent's definition of done: its node tests pass; the harness (or the app) shows no console errors on TRYZUB and MAR AZUL at 390 × 844 and 1440 × 900 in light and dark; `tests/i18n.test.js` passes for its strings.

### 6.9 Schedule and integration order

1. **Day 0** — A publishes `WGTime`/`WGGeo` signatures (stubs returning nothing) and `tests/run.js` + fixtures; G lands the shell skeleton (index.html, registries, `U.shell.render` with empty panels, model.js ensure, ui-core patches) so the app boots in the new layout with an empty stage; J lands `dev/stubs.js`. E and F build against their fixtures.
2. **Day 1–3** — B, C, D implement against the contracts (C uses the Geom fixture, D the Scene fixture); H and I implement panels against stubs; E and F finish renderers.
3. **Integration** — replace stubs by real modules in this order: time/geo → layout → scene → bound → map/timeline mount (H) → lens (I). After each step `node tests/run.js` and the Playwright smoke suite.
4. **QA** (J) — full §8.2 suite at 390 × 844, 768 × 1024, 1440 × 900, light/dark, ES/EN; published-artifact check (CSP: no network requests except Google Fonts).

---

## 7. Scenario geometry — expected auto-derivation (test oracle and view fixtures)

Values below come from running the §4 rules on the shipped scenario data (prototype verified for parse, line order, FLOT, evidence medians, CE windows, key events, engine numbers). Tests use the tolerances given; the map and timeline fixtures (agents E, F) use these coordinates verbatim. Board `[u,v]`, `x = 1000u`, `y = 700v`.

### 7.1 Operation TRYZUB

**Frame**: `opKind 'delay'`, axis `{att:'R', from:'E'}` (red attacks westward), `u = 1 − p`, `v = q`. Range `[-24,120]`, breaks `[-24,-2,0,12,24,48,72,96,120]`, scale auto → adaptive.

**Sectors**: Z12 «north corridor» `q [.06,.48]`, centre .27 (top half); Z11 «south corridor (SIRKO main effort)» `q [.52,.94]`, centre .73 (bottom half); both `p [0,1]`. «Z11 (south corridor)», «Z12 (north corridor)» are sector aliases (not drawn).

**Lines** (tolerance 0 — exact):

| CM | kind | p | u | protected |
|---|---|---|---|---|
| BHL DIV | line/bhl | .10 | .90 | ✓ |
| PL 1 | line | .20 | .80 | ✓ |
| PL 2 | line | .30 | .70 | ✓ |
| PL YELLOW | line | .40 | .60 | — |
| PL 3 | line | .50 | .50 | ✓ |
| PL PURPLE | line | .60 | .40 | ✓ |
| PL 4 | line | .70 | .30 | ✓ |
| PL GREEN | line | .80 | .20 | ✓ |
| PL 5 | line | .90 | .10 | ✓ |
| Red Line 1 | redline | .05 | .95 | (attacker start: r-b3, r-dag positions) |
| Red Line 2 | redline | .40 | .60 | (= PL YELLOW via NAI-3 «Red Line 2 / PL YELLOW») |
| Red Line 3 | redline | .75 | .25 | (extrapolated, conf .3 → review list) |

**FLOT**: `(-24,.10) (0,.20) (12,.30) (24,.50) (48,.60) (72,.70) (96,.80) (120,.90)`; FLOT(8) = .2667; FLOT⁻¹(.40) = 18.

**Point and area CMs** (tolerance ±.03 in p; sector exact):

| CM | kind | p | sector | `[u,v]` centre | main evidence |
|---|---|---|---|---|---|
| EA1 | ea | .25 | Z11 | [.75,.73] | t3 title, t3/t4 engagements, CE2, NAI-4, DP-B1 (13 mentions) |
| EA2 | ea | .65 | Z12 | [.35,.27] | t7 title + «KOTYHOROSHKO feint IVO EA2» (Z12) |
| EA3 | ea | .65 | Z11 | [.35,.73] | t7 «Feint IVO EA3» (Z11) |
| EA4 | ea | .75 | Z12 | [.25,.27] | t8 «Canalise to EA4» (Z12) |
| EA5 | ea | .75 | Z11 | [.25,.73] | t8 text, DP-B6; lateral via KOZHUMIAKA |
| EA6 | ea | .85 | Z12 | [.15,.27] | t9 |
| EA7 | ea | .85 | Z11 | [.15,.73] | t9 title, CE7, DP-B7 |
| EA «HETMAN» | ea (spanning) | .95 | both | [.05,.50] | t9 r, NAI-6, DP-B7; pushed deeper than EA6/EA7 (same-kind overlap rule: shift the later one deeper by the overlap + .01) |
| BP1 | bp | .29 | Z11 | [.71,.73] | «counterattacks from BP1 into EA1» (co-mention EA1 → p(EA1)+.04) |
| BP2 | bp | .20 | Z12 | [.80,.27] | «withdraws … to BP2» (destination +.05), loading area; lateral via KOTYHOROSHKO |
| BP3 | bp | .55 | Z11 | [.45,.73] | «BPT CATK from BP3» (conf .25 → review) |
| BP4 | bp | .79 | Z12 | [.21,.27] | «Canalise to EA4 · KOTYHOROSHKO BP4» (co-mention EA4) |
| BP5 | bp | .79 | Z11 | [.21,.73] | «from BP5 into EA5» (co-mention EA5) |
| AMA 1 | area | .10–.50 | Z11 | rect u [.50,.90] × v [.52,.94] | TAI-1 grammar #1 |
| AMA 2 | area | .20–.50 | Z12 | rect u [.50,.80] × v [.06,.48] | TAI-2 grammar #1 |
| Hill 247 (PL4 anchor) | hill | .72 | Z11 | [.28,.73] | parenthetical anchor PL 4 + .02 |
| Canal crossings (south) | crossing | .625 | Z11 | [.375,.73] | merged canal evidence (t5, NAI-5, TAI-3), nudged off PL PURPLE |
| Canal crossings (north) | crossing | .625 | Z12 | [.375,.27] | shares the canal; «(north)» qualifier |
| (canal river) | water | .625 | all | polyline u ≈ .375, v 0 → 1, through both crossings | §4.11 water |
| Kramatorsk–Druzhkivka hub | urban | .65 | spanning | [.35,.50] | t7 r, NAI-6 «IVO Kramatorsk», DP-2 (alias KRAMATORSK) |
| Corps depth | offboard | — | — | attacker edge marker [.99,.50] | r-d14, r-ib21 positions |
| Rear / reconstitution area | offboard | — | — | defender edge marker [.01,.50] | word «rear» |

**NAI / TAI geometry** (§4.12): NAI-1 rect u [.80,.90] × v [.52,.94]; NAI-2 rect u [.80,.90] × v [.06,.48]; NAI-3 strip u [.585,.615] × v [.06,.94]; NAI-4 = EA1 shape buffered .02; NAI-5 circle r .04 at [.375,.73]; NAI-6 wedge u [.06,.13] × v [.24,.76]; TAI-1 = AMA 1 rect; TAI-2 = AMA 2 rect; TAI-3 = circle at the south crossing; TAI-4 = hull of EA4–EA7 (u ≈ [.105,.295]).
**DP positions**: DP-B1 @ NAI-4 [.75,.73]; DP-B2 @ NAI-3 [.60,.50]; DP-B3 and DP-B6 @ NAI-5 (fanned .02); DP-B4 (no NAI) @ EA3 [.35,.73] (main-effort anchor of t7, CE5's turn); DP-B5 @ NAI-2 [.85,.27]; DP-B7 @ NAI-6 [.095,.50]; red DP-1, DP-3 @ NAI-3; DP-2 @ NAI-6 (red diamonds).
**Routes**: `av:Z12` «AA Z12» v .27; `av:Z11` «AA Z11» v .73 (**dominant**, red share 72 %); width .252 (= .6 × .42).
**Windows**: CE windows §4.2; NAI-1 `[-24,6]`, NAI-2 `[-24,24]`, NAI-3 `[6,30]`, NAI-4 `[0,24]`, NAI-5 `[24,72]`, NAI-6 `[72,120]`; DP-B1 `[6,12]`, DP-B2 `[18,30]`, DP-B3 `[36,48]`, DP-B4 `[46,50]` approx, DP-B5 `[-24,24]`, DP-B6 `[72,96]`, DP-B7 `[96,120]`, DP-1 `[24,48]`, DP-2 `[48,72]`, DP-3 `[24,72]`.
**Chain**: `chained = [t1,t2,t3,t4,t6,t7,t8,t9]` (t5 BOX A `sim:false`); alert `solape` KEY EVENT 1 / KEY EVENT 2 (2 h).
**Bounds**: belt auto PL 1 → PL 3 `[0,24]`; avenue auto `av:Z11` PL 3 → PL 5 `[24,120]`; box auto BOX A u [.23,.425] × v [.67,.79] `[48,96]`; critical CE1–CE7 `[-24,120]`. Recommendation belt 9 (Recomendado), avenue 7, box 5, critical 3.

**Engine numbers** (from `E.runPath`, COA 1 × ECOA-1, no overrides; exact):

| Turn | Engagement | Ratio | Min | Outcome | Losses A/R % |
|---|---|---|---|---|---|
| t3 BELT 1 | tz-e5 Z11 «EA1 — fix the lead echelon (DC-B2)» (ME) | 1 : 1.20 | 1 : 2.50 | DECISIVE SUCCESS | 8 / 35 |
| t3 | tz-e6 Z12 «Delay to PL YELLOW» | 1 : 2.77 | 1 : 6.00 | DECISIVE SUCCESS | 14 / 16 |
| t4 BELT 2 | tz-e7 Z11 «KOZHUMIAKA CATK into EA1 (DC-B3)» (ME) | 1.30 : 1 | 1.00 : 1 | SUCCESS | 15 / 21 |
| t9 SEGMENT 4 | tz-e17 Z11 «KOZHUMIAKA CATK into EA7 (DC-B7)» (ME) | 1 : 1.46 | 1.00 : 1 | NEUTRAL | 23 / 15 |

Turn suggestions: t1 DS, t2 DS, t3 DS (bcpCalc .87, rcpCalc .61), t4 S, t5 DS (non-chaining), t6 DS, t7 DS, t8 DS, t9 NEUTRAL (penetration cue applies to t9 only if the ME task were defensive — it is `catk`, so no cue). Game records (seeded from v2): t3 res SUCCESS, etc.

**Snapshot fixture `mapstate.tryzub.h08`** (τ = 8, ② SUPERPOSICIÓN, COA 1 × ECOA-1, white cell). Step `rea` of t3. Units (board, ±.01):

| Unit | side | `[u,v]` | note |
|---|---|---|---|
| b-baida BAIDA | B | [.72,.7075] | ME halo; t3 cluster k0/2 |
| b-kozh KOZHUMIAKA | B | [.72,.7525] | t3 cluster k1/2 |
| b-dovbush DOVBUSH | B | [.57,.27] | at PL YELLOW + .03 (arrived H+4:48) |
| b-kotyh KOTYHOROSHKO | B | [.74,.73] | t2 asset position (ME anchor PL1∩Z11 + .06) |
| b-xii XII ARMD BDE | B | [.37,.793] | start PL PURPLE + «in the south» bias |
| r-b1-1 / r-b1-2 / r-b1-tk | R | ≈ [.786, .685 / .73 / .775] | arriving at EA1 − .035 (s ≈ .99) |
| r-b1-at | R | ≈ [.816,.73] | second row (−.03 in p) |
| r-b2-1 / r-b2-2 / r-b2-tk | R | ≈ [.636, .225 / .27 / .315] | Z12, PL YELLOW − .035 |
| r-tkb-1 / -2 / -3 | R | [.96, .70 / .73 / .76] | start (ancestor «Z11 (south corridor)»), not yet engaged |
| r-d14, r-ib21 | R | off-board badge at [.99,.50] | «Corps depth» |

Contacts: `eng:t3:tz-e5` at EA1 ∩ Z11 [.75,.73] ratio «1 : 1.20» class ok (DECISIVE SUCCESS); `eng:t3:tz-e6` at PL YELLOW ∩ Z12 [.60,.27] «1 : 2.77» ok. Contact line: Z11 at p .2583 (u .742), Z12 at p .3333 (u .667). Active NAIs: NAI-2, NAI-3, NAI-4. DPs: DP-B1 open (frac .33, «faltan 4 h»), DP-B5 open (frac .67), others before/after. Glyphs: fires auto at EA1 (t3 `mods.fires = 2` → act start H+1:12 → cnt end H+11:24) and at TAI-1 / AMA 1 (DP-B1 window), intel auto at NAI-3 and NAI-4 only during pre+act (not at τ = 8), c2 auto at DP-B1 and DP-B5. Title block «COA 1 — Delay in successive positions… × ECOA-1 — Early penetration (MLCOA) · SITUACIÓN A H+08 · BELT 1 · Reacción roja».

### 7.2 Ejercicio MAR AZUL

**Frame**: `opKind 'amph'` (amphAslt engagements, «Playa» CMs), axis `{att:'B', from:'W'}`, `u = p`, `v = q`. Range `[0,24]`, breaks `[0,4,12,24]` (max/min = 3 → linear).

**Sectors**: V «Playa VERDE (N)» `q [.06,.48]`, A «Playa ÁMBAR (S)» `q [.52,.94]`, both `p [0,.40]`; I «Interior / OBJ ALFA» depth (rear) `p [.40,1]`, `q [.06,.94]`.

| CM | kind | p | sector | `[u,v]` |
|---|---|---|---|---|
| (sea / coastline) | water | `[0,.10)` / .10 | — | sea polygon u < .10 |
| Playa VERDE | beach | .10 | V | segment on the coast centred [.10,.27], length .294 |
| Playa ÁMBAR | beach | .10 | A | [.10,.73] |
| Línea de cabeza de playa | line/beachline | .40 | V + A | u .40, v [.06,.94] (single line → .40) |
| ZD interior | lz | .625 | I | [.625,.50] (clamped into I, free-span middle) |
| OBJ ALFA (aeródromo) | obj (airfield) | .85 | I | [.85,.50] (final objective of FASE III dc) |

FLOT `(0,.04) (4,.10) (12,.40) (24,.85)`. Routes: `av:V` «AA VERDE» (**dominant**, 76 % of lateral red FE) continuing through I to OBJ ALFA; `av:A` «AA ÁMBAR». NAIs / TAIs / DPs / CEs: none (② shows «Sin NAI: dibuje un área para crear una NAI»; ④ DSM empty with «Defina DP y NAI en Registros»).
Chain `[m1, m2, m3]` (no alerts). Bounds: box auto (BOX A «Asalto a las playas») u [.04,.16] × v [.07,.93] `[0,4]`; avenue auto `av:V` `p [.40,.85]` `[12,24]`; belt candidates `[0,4]`, `[4,12]`, `[12,24]`; critical: none (fallback to ME windows). Recommendation box 7 (Recomendado), avenue 4, belt 1, critical 0.

**Engine numbers** (COA 1 × ECOA-1, exact): m1 «Asalto a VERDE» (ME) 3.77 : 1 (min 3.00 : 1) SUCCESS, losses 11 / 54 %; «Asalto a ÁMBAR» 2.34 : 1 (min 3.00 : 1) NEUTRAL, 18 / 24 % (alert «ratio por debajo del mínimo»; contact class warn); m2 «Defensa de la cabeza de playa VERDE» (ME) 1.01 : 1 (min 1 : 2.50) DECISIVE SUCCESS; «Consolidación ÁMBAR» 2.01 : 1 DS; m3 «Ataque al OBJ ALFA» (ME) 2.26 : 1 (min 2.50 : 1) PARTIAL SUCCESS. Turn suggestions m1 SUCCESS, m2 DS, m3 PS.

**Tracks** (blue initiative): 1.º BIM (mb-1) appears at sea `p .03`, V (`q .2475`, cluster k0/2 with ½ Grupo Acorazado at `q .2925`), arrives on Playa VERDE `p .10` at H+1:24; 2.º BIM (mb-2) same in A (`q .73`); Bn Inf 1 (mr-1) in place at `[.13,.27]`, Bn Inf 2 (mr-2) at `[.13,.73]` from H. m2: anchor = beachhead line ∩ V (`p .40`; «VERDE» treated as sector qualifier) → blue (attacker side, defensive task) at `.365`, red Bn Carros + Bn Inf 3 at `.43`. m3: Grupo Acorazado, 1.º and 3.º BIM reach OBJ ALFA `p .85` at H+16:12; red (mr-tk, mr-3, mr-at) at `.88`.

**Snapshot fixture `mapstate.marazul.h02`** (τ = 2, rea of m1): blue mb-1 [.10,.2475], mb-ga [.10,.2925], mb-2 [.10,.73]; red mr-1 [.13,.27], mr-2 [.13,.73]; contacts `eng:m1:ma-e1` [.10,.27] «3.77 : 1» ok, `eng:m1:ma-e2` [.10,.73] «2.34 : 1» warn; blue graphics: amphibious axes from the sea onto both beaches (wave ticks), ME halo on VERDE; HUD «H+02 · FASE I · MOVIMIENTO BUQUE-COSTA (Playas aseguradas) · BOX A · Reacción roja · Caja».

---

## 8. Acceptance tests and i18n

### 8.1 Node contract tests (`node tests/run.js`)

| File | Must assert |
|---|---|
| `time.test.js` | every row of the §4.1 table; `fmt`/`fmtSpan` examples; `tokens` free-text rows; adaptive scale: TRYZUB `H-2 → H` width 4.33 % ± .1, `H+24 → H+48` 15.0 % ± .1; step tables of §4.4; `sessionBudget('Phase I 45 min · Belts 60 min · Avenue 60 min (≈3 h serial)').total === 180` |
| `geo.test.js` | `hash` stable across runs; `pip`, `buffer`, `bbox`, `hull` basics; `gridRef(.75,.73) === 'H6'` |
| `layout.test.js` | classification table of §7.1 (35 CMs) and §7.2; axis and opKind; sectors; line depths (exact); red lines; FLOT points (exact); every §7 CM row within tolerance; NAI/TAI geometry; dominant routes; cascade: `setLineDepth(op,'cm:PL 4',.68)` → Hill 247 p .70 and NAI/TAI bands built from PL lines move; `resetFeature` restores; orphans listed after renaming a CM; `geometry(op)` returns the same object for an unchanged op (memo) |
| `scene.test.js` | §4.2 windows (incl. CE table); chain and `solape` alert; ≥ 1 auto fires action in t3 for TRYZUB and none once `game.sync.fires.t3` has text; lanes contain all 11 `U.FUNCS` keys; BAIDA keyframe table (§4.16) ± .01; r-b1-1 at H+8:24; MAR AZUL tracks; `situation` at H+08 contains the two Azul sentences of §4.18; `checks` = §4.19 list |
| `bound.test.js` | protected lines; belt / segment / box / critical bounds of §7; link (PL 3 → PL PURPLE ⇒ `[0,48]`); classify examples (SEGMENT 3 Z12 engagement = `out` with `outsideEngs.length === 1`; DP-B4 never `out` spatially); recommend scores; every row of the §4.23 table; `apply` + `undo` restores deep-equal state; chronological insertion; `ls` 0.5 and seeded plans for every COA/ECOA; overlap policy `nochain` sets `sim:false` |
| `engine-ls.test.js` | golden equality with `dc851dc` when no `ls`; `ls = .5` halves calculated losses, ratios and outcomes unchanged, overrides not scaled |
| `model.test.js` | `ensure` idempotent; all defaults of §3.11; a v0.4 op passed through the **v0.3** `ensure` (from `dc851dc`) and back keeps every v0.4 field; `op.v === 3`; store envelope `v === 3` |
| `i18n.test.js` | load all files; for every new file, every literal in `t('…')`, `U.t('…')`, `t("…")` and every `k:` key returned by pure modules has an entry in `WGI18N.en` |

### 8.2 Playwright behaviours (`tests/e2e`, served by `python3 -m http.server` from the repo root; fresh context = empty localStorage unless stated)

**Boot and navigation**
1. Fresh load: header shows four modes, ① active, `pair` reads COA 1 × ECOA-1; ≥ 30 `[data-ref^="cm:"]` map elements; no console errors; `document.documentElement.scrollWidth <= innerWidth` at 390 and 1440.
2. ① banner contains «35 medidas de control»; the review list is non-empty (Red Line 3, BP3).
3. ② (click or key `2`): panel heading «SUPERPOSICIÓN», ruler in `lanes` height, red units `[data-u^="r-"]` visible.
4. The `#map` svg element is the same object before and after: mode switches, opening/closing Formularios, a `data-re` edit (set a JS expando on it and check it survives).
5. ⋯ › Formularios opens `forms` with the v0.3 navigation (13 sections of `U.NAV`); «Confrontación» renders the classic turn view; `forms-close` returns to the previous mode.
6. ⋯ › Vista clásica v0.3 shows `#side` with the v0.3 layout; «Volver a la vista nueva» restores the shell.
7. Changing RED to ECOA-2 in `pair` updates red units at τ (r-b3-1 appears in Z11, `data-y > 350`) without recreating the map.

**Time**
8. Setting τ = 8 (`msTau` via keyboard or cursor): `tau-readout` = «H+08 · BELT 1 · Reacción roja».
9. `→` increases τ by 1 h, `Shift+→` by 6 h; BAIDA's `data-x` changes between H−1 and H+5.
10. `play` advances τ; `Space` pauses; with «Pausar en DP» on and τ = H+2, playback stops at τ = 6 (DP-B1 opens) ± .25.
11. Formularios › Datos de planeamiento shows a parse chip «✓ D-1 → H · 24 h» next to phase I's time and «⚠ no reconocido» after typing «mañana».

**Map content (TRYZUB, ②, τ = H+08)**
12. EA1 feature centre within .03 of `[.75,.73]`; BAIDA `data-x/1000` within .03 of .72 and `data-y/700 > .5`.
13. Two contact markers with badges «1 : 1.20» and «1 : 2.77».
14. NAI-4 has class `mp-active`, NAI-1 does not; DP-B1 has state `open` and text «faltan 4 h».
15. `hud` contains «BAIDA + KOZHUMIAKA fijan en EA1» and «1 : 1.20 (mín 1 : 2.50)».
16. At τ = H+02 at least one `.mp-auto` fires glyph exists; the Funciones lane shows dotted auto bars.
17. Ruler `full`: typing «Fuego masivo sobre AMA 1» into the `sync.fires.t3` cell keeps focus in the textarea, the auto bar for (fires, t3) becomes a solid bar within 500 ms, and the HUD «Funciones» line shows the text.
18. Role «Jefe de la célula roja»: no `[data-u^="b-"]` visible outside contact; role «Célula azul» + «Niebla»: red units outside active NAIs show as hollow «última posición conocida» (class `last`) or hidden.
19. ① «Plan completo»: blue graphics carry sequence badges 1…8 (chained turns) and time labels «H → H+12».

**Editing**
20. ① Editar plano: drag PL 4 (or set its depth in `detail` to 0,68): `op.geo.lines['cm:PL 4'].p === .68` after reload; Hill 247 moved by the same Δu; «Restablecer automático» restores both.
21. MAR AZUL ① tool NAI: drawing a polygon creates `reg.nai[0].id === 'NAI-1'` with `time` = the current turn window string and opens its detail.
22. Uploading a 2400 × 1600 JPEG: stored under a `wgcoa.v3.img.` key ≤ 900 000 chars; `localStorage['wgcoa.v3']` contains no `data:image`; «Exportar operación» JSON contains `geo.bg.data`; «Quitar fondo» restores the schematic and deletes the key.
23. Dragging BAIDA at τ = H+06 onto EA3 writes `op.geo.tracks['COA-1']['b-baida']` `{t: 6, cm: 'EA3'}` and shows the toast «BAIDA → EA3 @ H+06».

**Method and bound (③)**
24. TRYZUB 3a: the `method-belt` card shows «Recomendado»; `method-combined` exists. MAR AZUL: `method-box` shows «Recomendado».
25. Choosing Fajas: `bound-summary` contains «PL 1 → PL 3» and «H → H+24»; a mask path exists; `op.prep.methods` unchanged; `op.prep.mActive === 'belt'`.
26. Setting «Hasta» = PL PURPLE with the link on: summary «H → H+48»; unlinking and typing H+30 keeps PL PURPLE.
27. Opening SEGMENT 3 (avenue): chip «Fuera de la acotación: 1 enfrentamiento (Z12)».

**Turn generation**
28. Fajas · Por geometría: two rows «mantener», `gen-apply` absent/disabled, CTA «Jugar «BELT 1» →».
29. Unticking «Sólo líneas protegidas»: three drafts (1 mantener, 2 nuevo «ls 0,50»), BELT 2 «Sustituir»; Apply (confirm) → `op.turns.length === 10`, the two new turns sit between t3 and t6 in the array, have `ls === .5`, seeded engagements for COA-1 and seeded placements for ECOA-1 and ECOA-2; t4 removed; toast «Deshacer» restores 9 turns deep-equal.
30. `chain-preview` shows «KEY EVENT 1 y KEY EVENT 2 se solapan 2 h».
31. Eventos críticos · Por acciones clave: seven rows, one «mantener», six «ya cubierto por …».
32. MAR AZUL Eventos críticos · Por acciones clave: note «Sin eventos críticos ni DP…».
33. Caja · Por acciones clave (TRYZUB): rows «ya cubierto por SEGMENT 2» / «SEGMENT 3»; «Forzar» shows «no encadena bajas (solapa con SEGMENT 2)».
34. After any apply + undo, `U.pathFor` suggestions per turn equal the initial ones.

**Play (③ 3c)**
35. Opening BELT 1: five `step-*` buttons; clicking «Reacción roja» sets the readout to «H+04:48» and `op.ui.wgStep === 2`; Formularios › Confrontación shows that step pressed.
36. At «Árbitro», `callout-tz-e5` contains «1 : 1.20», «8 / 35 %» and a Monte Carlo bar; `E.monteCarlo` ran once (spy) and not again while scrubbing within the turn.
37. «Aceptar resultado del motor» writes `games['COA-1|ECOA-1'].turns.t3.res === 'DECISIVE SUCCESS'`.
38. At «Contrarreacción azul» the DP-B1 prompt appears; «Activado» sets `reg.dp` DP-B1 `st === 'TRIGGERED'`.
39. «Cerrar turno y pasar al siguiente» opens BELT 2; on the last turn of the lens the CTA reads «Ir a Conclusiones →».

**Conclusions, export, platform**
40. ④ `dsm` lists DP-B4 «sin NAI», DP-B6 «se cierra antes», DP-2 «tardía».
41. «Exportar plano (.svg)» triggers a download whose content starts with `<svg`.
42. 390 × 844, all four modes: no horizontal page scroll; the scrubber strip and the tab bar are visible; sampled buttons ≥ 44 × 44 px.
43. Theme «Noche»: `getComputedStyle(body).backgroundColor` = rgb(7, 10, 8); map paper = `--paper` dark; «Día» and «Automático» work.
44. EN: mode labels «MAP · OVERLAY · WARGAME · CONCLUSIONS»; HUD «Situation at H+08»; no Spanish strings from the §8.3 key list remain.
45. `emulateMedia({ reducedMotion: 'reduce' })`: `.mp-active` has no running animation; the demo plays by steps.
46. Network: during the whole suite no request goes to hosts other than `fonts.googleapis.com` / `fonts.gstatic.com`.
47. localStorage throwing (stubbed): the app renders, `#saveState` shows «Almacenamiento bloqueado — use Exportar».
48. A v0.3 store (fixture exported from `dc851dc`) loads, opens ① with the toast «Nueva interfaz v0.4 · la vista clásica está en ⋯», and its results equal v0.3.
49. File mode: `index.html` opened via `file://` boots without errors (no fetch of local files).

### 8.3 i18n rules

1. Spanish is the source language. Every UI string goes through `U.t('<exact Spanish text>', vars)`; placeholders `{x}`; plurals as separate keys («{n} turno», «{n} turnos»).
2. English goes in `WGI18N.en`, registered **by the module that uses the string**, at the end of the file: `if (global.WGI18N) Object.assign(global.WGI18N.en, { … });`. `js/i18n.js` is not edited (it now loads first).
3. Pure modules that build sentences (`WGScene.situation`, `WGBound.recommend/propose/diff`, `WGScene.checks`) receive `t` by injection or return `{k, v}` pairs; they still register their EN strings.
4. Never translate data: CM names, unit names, labels, scenario texts, IDs (NAI-4, DP-B1, PIR-3), NATO abbreviations (PL, EA, BP, OBJ, NAI, TAI, DP, HPT, CCIR, FLOT, ME, FE, BHL, LD), time formats («H+12», «D+1»), ratios.
5. Mode labels: «PLANO» → «MAP», «SUPERPOSICIÓN» → «OVERLAY», «CONFRONTACIÓN» → «WARGAME», «CONCLUSIONES» → «CONCLUSIONS».
6. Core vocabulary (all modules use these exact keys):

| Español (key) | English |
|---|---|
| Qué decide aquí | What you decide here |
| Qué falta | Still missing |
| Continuar: Superposición → | Continue: Overlay → |
| Continuar: elegir método → | Continue: choose a method → |
| Acotar con «{m}» → | Bound with «{m}» → |
| Aplicar {n} cambios | Apply {n} changes |
| Jugar «{l}» → | Play «{l}» → |
| Siguiente paso | Next step |
| Cerrar turno y pasar al siguiente | Close turn and go to the next |
| Ir a Conclusiones → | Go to Conclusions → |
| Situación a {t} | Situation at {t} |
| Línea de contacto (prevista) {t} | Line of contact (planned) {t} |
| ESQUEMA — NO A ESCALA | SKETCH — NOT TO SCALE |
| Esquema generado automáticamente a partir de {n} medidas de control · {a} situadas · {b} por confirmar · {c} sin situar | Sketch generated automatically from {n} control measures · {a} placed · {b} to confirm · {c} unplaced |
| Revisar ubicación | Review location |
| Situar en… | Place at… |
| Restablecer automático | Reset to automatic |
| Editar plano | Edit map |
| Plan completo | Full plan |
| Instante | Instant |
| Formularios | Forms |
| Editar en formulario | Edit in form |
| Vista clásica v0.3 | Classic view v0.3 |
| Volver a la vista nueva | Back to the new view |
| Acotación | Bound |
| Vincular terreno y tiempo | Link ground and time |
| Fuera de la acotación: {n} enfrentamiento(s) ({s}) | Outside the bound: {n} engagement(s) ({s}) |
| Amenaza de flanco | Flank threat |
| Manual · Por fases · Por acciones clave · Por geometría | Manual · By phases · By key actions · By geometry |
| mantener | keep |
| actualizar | update |
| ya cubierto por {l} | already covered by {l} |
| nuevo | new |
| sin correspondencia | no match |
| Sustituir · Conservar · No encadenar · Eliminar | Replace · Keep · Do not chain · Delete |
| no encadena bajas (solapa con {l}) | does not chain losses (overlaps {l}) |
| plan copiado de {l} (ls {v}) | plan copied from {l} (ls {v}) |
| Secuencia combinada (actual) | Combined sequence (current) |
| Recomendado · Adecuado · Poco adecuado | Recommended · Suitable · Less suitable |
| Convención de lectura | Reading convention |
| Aceptar resultado del motor | Accept engine result |
| Pausar en DP | Pause at DP |
| faltan {h} | {h} left |
| Próximo: {id} en {h} | Next: {id} in {h} |
| Niebla (célula azul) | Fog (blue cell) |
| última posición conocida | last known position |
| auto | auto |
| Exportar plano (.svg) | Export map (.svg) |
| Imprimir DSO | Print DSO |
| Tema: Automático · Día · Noche | Theme: Automatic · Day · Night |
| ▶ Ver el ejemplo animado (20 s) | ▶ Watch the animated example (20 s) |
| Nueva interfaz v0.4 · la vista clásica está en ⋯ | New v0.4 interface · the classic view is under ⋯ |

7. `tests/i18n.test.js` (§8.1) fails the build on a missing key; QA (J) checks the EN screens of §8.2-44 visually.
