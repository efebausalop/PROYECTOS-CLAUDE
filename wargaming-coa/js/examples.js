/* ==========================================================================
   Escenarios de ejemplo
   - OPERATION TRYZUB: datos de "TRYZUB Wargaming Products", "Wargaming Guidance"
     y "Wargame Example SIRKO" (EUMAM-UA). FE de la sección 3.1 del ejemplo SIRKO.
     COA 2 y el despliegue detallado de OCOA 2 son ilustrativos (no figuran en la
     documentación) y se marcan como tales.
   - EJERCICIO MAR AZUL: escenario anfibio ficticio y didáctico; FE orientativos.
   ========================================================================== */
(function (global) {
  'use strict';

  const M = (terrain, obst, fires, surprise, morale, isr) => ({ terrain, obst, fires, surprise, morale, isr });
  const NEU = () => M(1, 0, 1, 1, 1, 1);

  function tryzub() {
    return {
      id: 'op-tryzub',
      name: 'OPERATION TRYZUB',
      classification: 'NATO UNCLASSIFIED // FOR TRAINING USE ONLY',
      unit: 'X Assault Bde “SIRKO” / OTG “MAMAI” / OSG “HETMAN”',
      mission: 'Desde D-1, la X Brigada de Asalto “SIRKO” desorganiza y retarda a la 13 MECH DIV en el corredor de movilidad SUR desde PL1 hasta PL4 y, a continuación, defiende PL4 y PL GREEN, para entregar a la 14 ARMD DIV en EA “HETMAN” fijada y expuesta.',
      intent: 'Cambiar los 68 km de profundidad entre la BHL y PL5 por el tempo del enemigo, forzando a la 13 MECH DIV a un paso de líneas interno prematuro y a empeñar su reserva divisionaria antes de PL4. Clave: llegar a PL4 en condiciones de librar una defensa de zona. Nada delante de PL4 merece un combate decisivo.',
      endState: 'Brigada anclada en PL4 y PL GREEN con el cinturón de obstáculos completo; primer escalón de la 13 MECH DIV culminado; 14 ARMD DIV empeñada en EA “HETMAN”.',
      initiative: 'red',
      ffir: 70,
      techniques: ['key', 'belt', 'avenue'],
      criteria: [
        'Esfuerzo principal: ¿está BAIDA organizado para fijar en EA1 y bloquear en PL4 con la cota 247 como ancla?',
        'Sorpresa: ¿las fintas en EA2/EA3 y las voladuras reservadas en el canal engañan sobre la posición principal?',
        'Flexibilidad: ¿están cubiertas las ramas del relevo en PL1, en EA1 y en el contraataque de KOZHUMIAKA?',
        'Credibilidad de combate: todo batallón ≥ 70 % en PL4 (FFIR-1), con ratios corregidos por frente (Anexo C).'
      ],
      sectors: [
        { id: 'N', name: 'Corredor NORTE (Z12)' },
        { id: 'S', name: 'Corredor SUR (Z11)' }
      ],
      events: [
        { id: 'e1', name: 'Contacto en ambos corredores — fijar al enemigo en EA1', time: 'H → H+12', space: 'PL1 → PL2', technique: 'key', dc: 'DC-B2 — enemigo detenido en EA1' },
        { id: 'e2', name: 'Contraataque en EA1 mientras el norte resiste', time: 'H+12 → H+24', space: 'PL2 → PL YELLOW', technique: 'belt', dc: 'DC-B3 — paso de líneas interno prematuro' },
        { id: 'e3', name: 'Reserva enemiga empeñada antes de PL4', time: 'H+24 → H+48', space: 'PL3 → PL4', technique: 'avenue', dc: 'DC-B4 — XII ARMD BDE cruza PL PURPLE' }
      ],
      units: {
        blue: [
          { id: 'b-baida', name: 'BAIDA', type: 'Bn Mecanizado (BMP)', fe: 0.51, str: 100 },
          { id: 'b-dovbush', name: 'DOVBUSH', type: 'Bn Mecanizado (BMP)', fe: 0.51, str: 100 },
          { id: 'b-koty', name: 'KOTYHOROSHKO', type: 'Bn Asalto (ligero)', fe: 0.35, str: 100 },
          { id: 'b-kozh', name: 'KOZHUMIAKA', type: 'Bn Carros (31 × T-64/T-72)', fe: 0.69, str: 100 },
          { id: 'b-xii', name: 'XII ARMD BDE (OTG)', type: 'Bda Acorazada (3 bn carros + 1 bn mec)', fe: 2.58, str: 100 }
        ],
        red: [
          { id: 'r3-1', name: 'MR BDE 3 · 1 Bn', type: 'Bn MR (BTR-80)', fe: 0.36, str: 100 },
          { id: 'r3-2', name: 'MR BDE 3 · 2 Bn', type: 'Bn MR (BTR-80)', fe: 0.36, str: 100 },
          { id: 'r3-3', name: 'MR BDE 3 · 3 Bn', type: 'Bn MR (BTR-80)', fe: 0.36, str: 100 },
          { id: 'r3-tk', name: 'MR BDE 3 · Bn Carros', type: 'Bn Carros (31 MBT)', fe: 0.69, str: 100 },
          { id: 'r1-1', name: 'MR BDE 1 · 1 Bn', type: 'Bn MR (BMP-1/2)', fe: 0.51, str: 100 },
          { id: 'r1-2', name: 'MR BDE 1 · 2 Bn', type: 'Bn MR (BMP-1/2)', fe: 0.51, str: 100 },
          { id: 'r1-3', name: 'MR BDE 1 · 3 Bn', type: 'Bn MR (BMP-1/2)', fe: 0.51, str: 100 },
          { id: 'r1-tk', name: 'MR BDE 1 · Bn Carros', type: 'Bn Carros (41 × T-72B3)', fe: 0.89, str: 100 },
          { id: 'r1-at', name: 'MR BDE 1 · Bn C/C', type: 'Bn C/C (Kornet-T · 2S25)', fe: 0.45, str: 100 },
          { id: 'r-tkbde', name: 'Tank Bde (reserva div.)', type: 'Bda Carros (≈120 MBT)', fe: 2.67, str: 100 }
        ]
      },
      blueCOAs: [
        {
          id: 'coa1', name: 'COA 1 — Retardo en profundidad y defensa en PL4',
          statement: 'Esfuerzo principal SUR. BAIDA fija en EA1 · KOZHUMIAKA contraataca durante el paso de líneas enemigo · DOVBUSH retarda en el norte · KOTYHOROSHKO en reserva · XII ARMD BDE (OTG) contraataca desde el sur antes de PL4.',
          plan: {
            e1: {
              action: 'SUR: BAIDA fija en EA1 — Cía A adelantada, ATGM en los huecos, AMA 1 en prioridad. NORTE: DOVBUSH retarda desde PL1; el grupo de obstáculos OB-2 cierra la ruta lateral entre corredores; AMA 2 en apoyo. KOZHUMIAKA en BP1.',
              engagements: [
                { id: 'c1e1s', sector: 'S', label: 'EA1 — fijar al primer escalón', task: 'hastyDef', me: true, brk: true, hpt: 'r1-tk', vs: [], units: [{ u: 'b-baida', pct: 100 }, { u: 'b-kozh', pct: 100 }], mods: NEU() },
                { id: 'c1e1n', sector: 'N', label: 'Retardo PL1 → PL2', task: 'delay', me: false, brk: true, hpt: '', vs: [], units: [{ u: 'b-dovbush', pct: 100 }], mods: NEU() }
              ]
            },
            e2: {
              action: 'DP 2 — el segundo batallón entra en NAI 2: KOZHUMIAKA contraataca desde BP1 en EA1; BAIDA apoya por el fuego y mantiene el hombro norte de EA1 con OB-2. NORTE: DOVBUSH retarda hasta PL YELLOW.',
              engagements: [
                { id: 'c1e2s', sector: 'S', label: 'Contraataque de KOZHUMIAKA en EA1', task: 'catk', me: true, brk: false, hpt: 'r1-3', vs: [], units: [{ u: 'b-kozh', pct: 100 }, { u: 'b-baida', pct: 100 }], mods: NEU() },
                { id: 'c1e2n', sector: 'N', label: 'Retardo PL2 → PL YELLOW', task: 'delay', me: false, brk: true, hpt: '', vs: [], units: [{ u: 'b-dovbush', pct: 100 }], mods: NEU() }
              ]
            },
            e3: {
              action: 'DP 3 — DOVBUSH al 70 % y camiones OTG disponibles: KOTYHOROSHKO ocupa BP2 en el norte. SUR: BAIDA y KOZHUMIAKA contienen en PL3 y se repliegan a la orden a PL PURPLE. DP 4: XII ARMD BDE contraataca desde el sur sobre el flanco de la Tank Bde.',
              engagements: [
                { id: 'c1e3s1', sector: 'S', label: 'Contención PL3 → PL PURPLE', task: 'delay', me: false, brk: true, hpt: 'r1-tk', vs: ['r1-1', 'r1-2', 'r1-3', 'r1-tk', 'r1-at'], units: [{ u: 'b-baida', pct: 100 }, { u: 'b-kozh', pct: 100 }], mods: NEU() },
                { id: 'c1e3s2', sector: 'S', label: 'Contraataque XII ARMD BDE (flanco)', task: 'catk', me: true, brk: false, hpt: 'r-tkbde', vs: ['r-tkbde'], units: [{ u: 'b-xii', pct: 100 }], mods: M(1, 0, 1, 2, 1, 1) },
                { id: 'c1e3n', sector: 'N', label: 'Defensa de PL3 (DOVBUSH + KOTYHOROSHKO)', task: 'hastyDef', me: false, brk: false, hpt: '', vs: [], units: [{ u: 'b-dovbush', pct: 100 }, { u: 'b-koty', pct: 100 }], mods: NEU() }
              ]
            }
          }
        },
        {
          id: 'coa2', name: 'COA 2 — Defensa adelantada en PL1 (ilustrativa)',
          statement: 'ILUSTRATIVA (no figura en la documentación; sirve para practicar la comparación). La brigada defiende en PL1 con tres batallones en línea y KOZHUMIAKA como reserva local. Sin apoyo de XII ARMD BDE, que permanece como reserva OTG.',
          plan: {
            e1: {
              action: 'SUR: BAIDA y KOTYHOROSHKO defienden PL1 sobre el cinturón de obstáculos. NORTE: DOVBUSH defiende PL1. KOZHUMIAKA en BP1 como reserva local.',
              engagements: [
                { id: 'c2e1s', sector: 'S', label: 'Defensa de PL1 sur', task: 'delibDef', me: true, brk: false, hpt: 'r1-tk', vs: [], units: [{ u: 'b-baida', pct: 100 }, { u: 'b-koty', pct: 100 }], mods: M(1, 1, 1, 1, 1, 1) },
                { id: 'c2e1n', sector: 'N', label: 'Defensa de PL1 norte', task: 'delibDef', me: false, brk: false, hpt: '', vs: [], units: [{ u: 'b-dovbush', pct: 100 }], mods: M(1, 1, 1, 1, 1, 1) }
              ]
            },
            e2: {
              action: 'SUR: KOZHUMIAKA contraataca la penetración local; BAIDA y KOTYHOROSHKO mantienen PL1. NORTE: DOVBUSH mantiene PL1.',
              engagements: [
                { id: 'c2e2s', sector: 'S', label: 'Mantener PL1 + contraataque local', task: 'delibDef', me: true, brk: false, hpt: 'r1-tk', vs: [], units: [{ u: 'b-baida', pct: 100 }, { u: 'b-koty', pct: 100 }, { u: 'b-kozh', pct: 100 }], mods: M(1, 1, 1, 1, 1, 1) },
                { id: 'c2e2n', sector: 'N', label: 'Mantener PL1 norte', task: 'delibDef', me: false, brk: false, hpt: '', vs: [], units: [{ u: 'b-dovbush', pct: 100 }], mods: M(1, 1, 1, 1, 1, 1) }
              ]
            },
            e3: {
              action: 'La brigada intenta mantener la línea; repliegue no planeado a PL2/PL3 si se rompe el frente.',
              engagements: [
                { id: 'c2e3s', sector: 'S', label: 'Defensa frente a la reserva divisionaria', task: 'hastyDef', me: true, brk: false, hpt: 'r-tkbde', vs: [], units: [{ u: 'b-baida', pct: 100 }, { u: 'b-koty', pct: 100 }, { u: 'b-kozh', pct: 100 }], mods: NEU() },
                { id: 'c2e3n', sector: 'N', label: 'Defensa norte', task: 'hastyDef', me: false, brk: false, hpt: '', vs: [], units: [{ u: 'b-dovbush', pct: 100 }], mods: NEU() }
              ]
            }
          }
        }
      ],
      redCOAs: [
        {
          id: 'ocoa1', name: 'OCOA 1 — Dos brigadas en línea, penetración temprana en el SUR', tag: 'MLCOA', likelihood: 60,
          statement: '13 MECH DIV ataca con DOS BRIGADAS EN LÍNEA: MR BDE 3 (BTR · 3.030 · 31 MBT) en el corredor NORTE y MR BDE 1 (BMP · 3.525 · 41 MBT) en el SUR como esfuerzo principal. Tank Bde (≈120 MBT) como reserva divisionaria detrás del sur.',
          plan: {
            e1: {
              pre: 'Ambas brigadas atacan en H tras una preparación corta. NORTE: MR BDE 3 con dos batallones BTR adelantados. SUR: MR BDE 1 con dos batallones BMP adelantados y su batallón de carros listo para la ruptura. La Tank Bde avanza detrás del sur.',
              reaction: 'SUR: el batallón de carros se empeña en EA1. NORTE: MR BDE 3 presiona y rebasa a la compañía adelantada de DOVBUSH.',
              placement: [
                { u: 'r3-1', sector: 'N', pct: 100 }, { u: 'r3-2', sector: 'N', pct: 100 }, { u: 'r3-3', sector: 'N', pct: 100 }, { u: 'r3-tk', sector: 'N', pct: 100 },
                { u: 'r1-1', sector: 'S', pct: 100 }, { u: 'r1-2', sector: 'S', pct: 100 }, { u: 'r1-3', sector: 'S', pct: 100 }, { u: 'r1-tk', sector: 'S', pct: 100 }, { u: 'r1-at', sector: 'S', pct: 100 }
              ]
            },
            e2: {
              pre: 'SUR: detenida, MR BDE 1 pasa su segundo batallón a través del primero para recuperar el tempo. NORTE: MR BDE 3 ataca PL2; una compañía tantea hacia el sur por la ruta lateral.',
              reaction: 'Bn C/C (Kornet-T) y UAS Lancet contra KOZHUMIAKA. La compañía de tanteo de MR BDE 3 golpea el hombro norte de EA1.',
              placement: [
                { u: 'r3-1', sector: 'N', pct: 100 }, { u: 'r3-2', sector: 'N', pct: 100 }, { u: 'r3-3', sector: 'N', pct: 100 }, { u: 'r3-tk', sector: 'N', pct: 100 },
                { u: 'r1-3', sector: 'S', pct: 100 }, { u: 'r1-tk', sector: 'S', pct: 100 }
              ]
            },
            e3: {
              pre: 'SUR: se empeña la reserva divisionaria — la Tank Bde — para relanzar el ataque. NORTE: MR BDE 3 ataca PL3.',
              reaction: 'La Tank Bde cruza PL3 en el sur (NAI 3). Los ingenieros enemigos adelantan medios de paso hacia el canal.',
              placement: [
                { u: 'r3-1', sector: 'N', pct: 100 }, { u: 'r3-2', sector: 'N', pct: 100 }, { u: 'r3-3', sector: 'N', pct: 100 }, { u: 'r3-tk', sector: 'N', pct: 100 },
                { u: 'r1-1', sector: 'S', pct: 100 }, { u: 'r1-2', sector: 'S', pct: 100 }, { u: 'r1-3', sector: 'S', pct: 100 }, { u: 'r1-tk', sector: 'S', pct: 100 }, { u: 'r1-at', sector: 'S', pct: 100 },
                { u: 'r-tkbde', sector: 'S', pct: 100 }
              ]
            }
          }
        },
        {
          id: 'ocoa2', name: 'OCOA 2 — Fijar y golpear', tag: 'MDCOA', likelihood: 40,
          statement: 'MR BDE 3 (BTR) ataca primero en un frente amplio para fijar; MR BDE 1 y la Tank Bde se empeñan juntas más tarde como fuerza de golpe divisionaria. (El despliegue por turnos es una interpretación ilustrativa de la rama 4 de los productos TRYZUB: 1,54:1 en personal y 6,2:1 en blindados.)',
          plan: {
            e1: {
              pre: 'MR BDE 3 ataca en frente amplio en ambos corredores para fijar a SIRKO. MR BDE 1 y la Tank Bde permanecen fuera de contacto.',
              reaction: 'MR BDE 3 busca huecos en PL1; los UAS buscan la posición de KOZHUMIAKA.',
              placement: [
                { u: 'r3-1', sector: 'N', pct: 100 }, { u: 'r3-tk', sector: 'N', pct: 50 },
                { u: 'r3-2', sector: 'S', pct: 100 }, { u: 'r3-3', sector: 'S', pct: 100 }, { u: 'r3-tk', sector: 'S', pct: 50 }
              ]
            },
            e2: {
              pre: 'MR BDE 3 mantiene la presión. La cabeza de la fuerza de golpe (MR BDE 1) entra en contacto en el sur.',
              reaction: 'La vanguardia de MR BDE 1 busca rebasar EA1 por el sur.',
              placement: [
                { u: 'r3-1', sector: 'N', pct: 100 }, { u: 'r3-tk', sector: 'N', pct: 50 },
                { u: 'r3-2', sector: 'S', pct: 100 }, { u: 'r3-3', sector: 'S', pct: 100 }, { u: 'r3-tk', sector: 'S', pct: 50 },
                { u: 'r1-1', sector: 'S', pct: 100 }, { u: 'r1-2', sector: 'S', pct: 100 }
              ]
            },
            e3: {
              pre: 'Golpe divisionario: MR BDE 1 completa y Tank Bde juntas en el corredor SUR.',
              reaction: 'Esfuerzo de ingenieros sobre el canal; la Tank Bde explota hacia PL4.',
              placement: [
                { u: 'r3-1', sector: 'N', pct: 100 }, { u: 'r3-2', sector: 'N', pct: 100 }, { u: 'r3-tk', sector: 'N', pct: 100 },
                { u: 'r1-1', sector: 'S', pct: 100 }, { u: 'r1-2', sector: 'S', pct: 100 }, { u: 'r1-3', sector: 'S', pct: 100 }, { u: 'r1-tk', sector: 'S', pct: 100 }, { u: 'r1-at', sector: 'S', pct: 100 },
                { u: 'r-tkbde', sector: 'S', pct: 100 }
              ]
            }
          }
        }
      ],
      sessions: {
        'coa1|ocoa1': {
          turns: {
            e1: {
              counter: 'DP 1 — carros vistos en NAI 1 (sur): el Cte. de Bda confirma el SUR como esfuerzo principal enemigo y mantiene la prioridad de AMA 1. HPT 1: fuegos masivos y ATGM sobre los carros dentro de EA1. NORTE: DOVBUSH rompe el contacto hacia PL2 bajo humos.',
              notes: 'SUR 1 : 2,4, sin combate decisivo → BAIDA 85 %, Bn carros enemigo 40 %. ÉXITO — enemigo detenido en EA1. NORTE 1 : 3,5 → DOVBUSH 80 %, alcanza PL2 cuatro horas antes. PARCIAL — el norte se adelanta al sur.',
              assets: 'AMA 1, AMA 2, OB-2, ATGM', dp: 'DP 1', ccir: 'PIR-1, PIR-3',
              branch: 'Rama 1: carros vistos en el NORTE → prioridad AMA al norte, KOZHUMIAKA a una BP norte. Problema: el hueco en PL2 expone el flanco norte de KOZHUMIAKA.',
              ovr: { c1e1s: { res: 'EXI', bl: '', rl: '' }, c1e1n: { res: 'PAR', bl: '', rl: '' } }, mods: {}
            },
            e2: {
              counter: 'HPT 2: fuegos máximos sobre el paso de líneas; GE contra los enlaces UAS. KOZHUMIAKA golpea y se retira detrás de PL3. La compañía de tanteo es detenida por OB-2 y el fuego de BAIDA.',
              notes: 'SUR 1,3 : 1 en la ventana del paso → KOZHUMIAKA 80 % (6 MBT perdidos), batallón en paso 50 %. ÉXITO DECISIVO (DC-B3). NORTE 1 : 3,7 → DOVBUSH 70 % en PL YELLOW. FFIR-1 ALCANZADO.',
              assets: 'AMA 1 + XV/2, Cía GE', dp: 'DP 2', ccir: 'PIR-2, FFIR-1',
              branch: 'Rama 2: contraataque envuelto desde el norte → KOTYHOROSHKO refuerza, los carros rompen antes. Refinamiento: AD puntual con los carros.',
              ovr: { c1e2s: { res: 'DEC', bl: '', rl: '' } }, mods: {}
            },
            e3: {
              counter: 'DP 4 — la brigada solicita, la OTG ordena: XII ARMD BDE contraataca desde el sur sobre el flanco de la Tank Bde. HPT 3: medios de paso batidos. RD-1 ejecutada por el Cte. de Bda cuando XII ARMD BDE está libre.',
              notes: 'SUR 1,3 : 1 en el flanco → Tank Bde 60 %, empeñada antes de PL4 (DC-B4). BAIDA 75 %. NORTE 1 : 1,8 en PL3 → la línea resiste, DOVBUSH 65 %. ÉXITO — la brigada se ancla en PL4 y la cota 247.',
              assets: 'XII ARMD BDE, Bn Ingenieros', dp: 'DP 3, DP 4', ccir: 'FFIR-3, PIR-6',
              branch: 'Riesgo crítico: fratricidio en el paso con XII ARMD BDE. DOVBUSH por debajo de FFIR-1 → refinamiento necesario.',
              ovr: {}, mods: {}
            }
          },
          sync: {
            c2: { e1: 'DP 1 — esfuerzo principal confirmado', e2: 'DP 2 — empeñar KOZHUMIAKA', e3: 'DP 3 — KOTYHOROSHKO al norte · DP 4 — solicitar XII ARMD BDE' },
            intel: { e1: 'NAI 1 / NAI 4 — ¿dónde está el Bn carros?', e2: 'NAI 2 — inicio del paso de líneas', e3: 'NAI 3 — Tank Bde cruzando PL3' },
            man: { e1: 'BAIDA fija en EA1; DOVBUSH retarda', e2: 'CATK KOZHUMIAKA; BAIDA mantiene el hombro', e3: 'Repliegue a PL PURPLE; CATK XII ARMD BDE' },
            fires: { e1: 'Prioridad AMA 1 · HPT 1', e2: 'AMA 1 + XV/2 · HPT 2', e3: 'HPT 3 medios de paso · desplazamiento CFSL' },
            info: { e1: 'Tráfico civil fuera de la MSR', e2: 'Evacuación del bloque urbano', e3: 'Pasos del canal cerrados a civiles' },
            cimic: { e1: '', e2: '', e3: '' },
            sust: { e1: 'Munición a BP2 y BP4', e2: 'Recuperación de pérdidas de KOZHUMIAKA tras PL3', e3: 'Camiones OTG con KOTYHOROSHKO (FFIR-3)' },
            prot: { e1: 'Humos sobre rutas de repliegue', e2: 'GE contra UAS; AD puntual con los carros', e3: 'Puntos de contacto con XII ARMD BDE' }
          },
          dsm: [
            { dp: 'DP 1', where: 'NAI 1 (S) · NAI 4 (N)', trigger: 'Bn carros enemigo identificado', decision: 'Prioridad de fuegos y BP de KOZHUMIAKA — sur (plan) o norte (rama 1)', who: 'Cte. Bda', latest: 'H+4' },
            { dp: 'DP 2', where: 'NAI 2 — borde este de EA1', trigger: 'El 2.º Bn MR inicia el paso de líneas', decision: 'Empeñar KOZHUMIAKA en EA1', who: 'Cte. Bda', latest: 'H+18' },
            { dp: 'DP 3', where: 'Sector DOVBUSH', trigger: 'DOVBUSH < 70 % (FFIR-1) y camiones disponibles (FFIR-3)', decision: 'KOTYHOROSHKO a BP2 (norte)', who: 'Cte. Bda', latest: 'H+24' },
            { dp: 'DP 4', where: 'NAI 3 — PL3 sur', trigger: 'La Tank Bde enemiga cruza PL3', decision: 'Solicitar CATK de XII ARMD BDE; RD-1 cuando esté libre', who: 'Cte. Bda → Cte. OTG', latest: 'H+36' }
          ],
          facds: {
            F: { v: 'SI', t: 'La munición, no los tubos, es el límite.' },
            A: { v: 'COND', t: 'Aceptable con los refinamientos 1–2; si no, DOVBUSH termina por debajo del 70 %.' },
            C: { v: 'SI', t: 'Quién, qué, cuándo, dónde y para qué respondidos en cada turno.' },
            D: { v: 'SI', t: 'Retardo en profundidad con contraataques, no una defensa adelantada.' },
            S: { v: 'SI', t: 'La reserva enemiga se gasta antes de PL4; la 14 ARMD DIV llega a EA “HETMAN”.' }
          },
          strengths: 'Todos los enfrentamientos del sur cumplen su ratio de planeamiento.\nLa ventana de contraataque en EA1 es real y decisiva.\nXII ARMD BDE convierte 1 : 4,8 en 1,3 : 1 en el flanco.\nLa cota 247 y el canal anclan PL4.',
          weaknesses: 'El retardo norte (1 : 3,5) se adelanta al sur.\nDOVBUSH cae por debajo del 70 % — FFIR-1.\nLa reserva sólo se mueve en camiones OTG.\nLos UAS Lancet amenazan a los carros en cada contraataque.',
          refinements: '1. Reubicar un grupo de obstáculos de OB-3 (sur) al corredor norte en PL2.\n2. Adelantar DP 3: KOTYHOROSHKO al norte cuando DOVBUSH llegue al 75 %; camiones preposicionados.\n3. Asignación fija de una batería a AMA 2 aun con prioridad sur.\n4. AD puntual y EMCON con KOZHUMIAKA.\n5. Puntos de contacto, señales de reconocimiento y desplazamiento de la CFSL para el paso de XII ARMD BDE.',
          conclusions: 'La COA 1 es viable y se recomienda para decisión, con los refinamientos 1–2. Siguiente: confrontar la COA 2 frente a la misma OCOA y pasar al Paso 5 — comparación de COA.'
        }
      }
    };
  }

  function marAzul() {
    return {
      id: 'op-marazul',
      name: 'EJERCICIO MAR AZUL (ficticio)',
      classification: 'SIN CLASIFICAR — USO DIDÁCTICO',
      unit: 'Brigada de Infantería de Marina (BRIMAR) / Fuerza Anfibia',
      mission: 'La BRIMAR, O/O día D, conduce un asalto anfibio sobre la costa de ISLA NORTE para conquistar el OBJ ALFA (aeródromo) y permitir el desembarco de la fuerza de seguimiento.',
      intent: 'Propósito: aeródromo operativo para la fuerza de seguimiento. Método: asalto simultáneo con fuego naval masivo, aislamiento de la reserva móvil enemiga y explotación rápida al OBJ ALFA. Estado final: cabeza de playa consolidada y OBJ ALFA en nuestro poder antes de D+1.',
      endState: 'Cabeza de playa consolidada; OBJ ALFA conquistado; reserva móvil enemiga neutralizada.',
      initiative: 'blue',
      ffir: 70,
      techniques: ['box', 'key', 'avenue'],
      criteria: [
        'Velocidad de acumulación en tierra frente a la reserva móvil enemiga.',
        'Riesgo en el movimiento buque-costa.',
        'Flexibilidad ante el desplazamiento de la reserva enemiga.',
        'Combat power: ningún BIM por debajo del 70 % al llegar al OBJ ALFA.'
      ],
      sectors: [
        { id: 'V', name: 'Playa VERDE (N)' },
        { id: 'A', name: 'Playa ÁMBAR (S)' },
        { id: 'I', name: 'Interior / OBJ ALFA' }
      ],
      events: [
        { id: 'm1', name: 'Asalto a las playas (H-Hour)', time: 'H → H+4', space: 'Playas VERDE y ÁMBAR', technique: 'box', dc: 'Playas aseguradas' },
        { id: 'm2', name: 'Contraataque de la reserva móvil enemiga', time: 'H+4 → H+12', space: 'Línea de cabeza de playa', technique: 'key', dc: 'Cabeza de playa mantenida' },
        { id: 'm3', name: 'Explotación al OBJ ALFA', time: 'H+12 → H+24', space: 'Eje VERDE → OBJ ALFA', technique: 'avenue', dc: 'OBJ ALFA conquistado' }
      ],
      units: {
        blue: [
          { id: 'mb-1', name: '1.º BIM (AAV)', type: 'Bn IM sobre anfibios', fe: 0.45, str: 100 },
          { id: 'mb-2', name: '2.º BIM (AAV)', type: 'Bn IM sobre anfibios', fe: 0.45, str: 100 },
          { id: 'mb-3', name: '3.º BIM (helitransportado)', type: 'Bn IM ligero', fe: 0.35, str: 100 },
          { id: 'mb-ga', name: 'Grupo Acorazado', type: 'Cías carros + cadenas', fe: 0.55, str: 100 }
        ],
        red: [
          { id: 'mr-1', name: 'Bn Inf 1 (VERDE)', type: 'Bn Inf mecanizado', fe: 0.40, str: 100 },
          { id: 'mr-2', name: 'Bn Inf 2 (ÁMBAR)', type: 'Bn Inf mecanizado', fe: 0.40, str: 100 },
          { id: 'mr-3', name: 'Bn Inf 3 (reserva)', type: 'Bn Inf motorizado', fe: 0.36, str: 100 },
          { id: 'mr-tk', name: 'Bn Carros (reserva móvil)', type: 'Bn Carros', fe: 0.69, str: 100 },
          { id: 'mr-at', name: 'Cía C/C', type: 'Cía C/C', fe: 0.15, str: 100 }
        ]
      },
      blueCOAs: [
        {
          id: 'mcoa1', name: 'COA 1 — Asalto por dos playas',
          statement: '1.º BIM en VERDE y 2.º BIM en ÁMBAR simultáneamente con fuego naval masivo; Grupo Acorazado en segunda oleada por VERDE; 3.º BIM en reserva a bordo.',
          plan: {
            m1: { action: '1.º BIM asalta VERDE; 2.º BIM asalta ÁMBAR. Fuego naval y apoyo aéreo cercano sobre las defensas de playa.',
              engagements: [
                { id: 'a1v', sector: 'V', label: 'Asalto a VERDE', task: 'amphAslt', me: true, brk: false, hpt: '', vs: [], units: [{ u: 'mb-1', pct: 100 }, { u: 'mb-ga', pct: 50 }], mods: M(0, 0, 3, 1, 1, 1) },
                { id: 'a1a', sector: 'A', label: 'Asalto a ÁMBAR', task: 'amphAslt', me: false, brk: false, hpt: '', vs: [], units: [{ u: 'mb-2', pct: 100 }], mods: M(0, 0, 3, 1, 1, 1) }
              ] },
            m2: { action: 'Grupo Acorazado desembarca por VERDE; 1.º BIM defiende la línea de cabeza de playa; 2.º BIM consolida ÁMBAR.',
              engagements: [
                { id: 'a2v', sector: 'V', label: 'Defensa de la cabeza de playa VERDE', task: 'hastyDef', me: true, brk: false, hpt: 'mr-tk', vs: [], units: [{ u: 'mb-1', pct: 100 }, { u: 'mb-ga', pct: 100 }], mods: M(1, 0, 2, 1, 1, 1) },
                { id: 'a2a', sector: 'A', label: 'Consolidación ÁMBAR', task: 'hastyDef', me: false, brk: false, hpt: '', vs: [], units: [{ u: 'mb-2', pct: 100 }], mods: M(1, 0, 2, 1, 1, 1) }
              ] },
            m3: { action: 'Grupo Acorazado y 1.º BIM explotan hacia el OBJ ALFA; 3.º BIM desembarca como reserva.',
              engagements: [
                { id: 'a3i', sector: 'I', label: 'Ataque al OBJ ALFA', task: 'hastyAtk', me: true, brk: false, hpt: 'mr-tk', vs: [], units: [{ u: 'mb-1', pct: 100 }, { u: 'mb-ga', pct: 100 }, { u: 'mb-3', pct: 100 }], mods: M(1, 0, 3, 1, 1, 1) }
              ] }
          }
        },
        {
          id: 'mcoa2', name: 'COA 2 — Una playa + asalto helitransportado',
          statement: '1.º y 2.º BIM concentrados en VERDE; 3.º BIM helitransportado sobre la zona de desembarco interior para aislar la reserva móvil; Grupo Acorazado en segunda oleada.',
          plan: {
            m1: { action: 'Masa sobre VERDE con dos BIM. 3.º BIM helitransportado a la ZD interior para cortar el eje de la reserva.',
              engagements: [
                { id: 'b1v', sector: 'V', label: 'Asalto concentrado a VERDE', task: 'amphAslt', me: true, brk: false, hpt: '', vs: [], units: [{ u: 'mb-1', pct: 100 }, { u: 'mb-2', pct: 100 }], mods: M(0, 0, 3, 1, 1, 1) },
                { id: 'b1i', sector: 'I', label: 'Asalto helitransportado — bloqueo', task: 'hastyDef', me: false, brk: false, hpt: 'mr-tk', vs: [], units: [{ u: 'mb-3', pct: 100 }], mods: M(1, 0, 1, 2, 1, 1) }
              ] },
            m2: { action: 'Grupo Acorazado desembarca por VERDE y enlaza con el 3.º BIM; ÁMBAR sólo vigilada por fuego naval.',
              engagements: [
                { id: 'b2v', sector: 'V', label: 'Expansión de la cabeza de playa', task: 'hastyDef', me: true, brk: false, hpt: '', vs: [], units: [{ u: 'mb-1', pct: 100 }, { u: 'mb-2', pct: 100 }], mods: M(1, 0, 2, 1, 1, 1) },
                { id: 'b2i', sector: 'I', label: 'Bloqueo de la reserva móvil', task: 'hastyDef', me: false, brk: false, hpt: 'mr-tk', vs: [], units: [{ u: 'mb-3', pct: 100 }, { u: 'mb-ga', pct: 100 }], mods: M(1, 0, 2, 1, 1, 1) }
              ] },
            m3: { action: 'Ataque convergente al OBJ ALFA desde VERDE y desde la ZD.',
              engagements: [
                { id: 'b3i', sector: 'I', label: 'Ataque convergente al OBJ ALFA', task: 'hastyAtk', me: true, brk: false, hpt: '', vs: [], units: [{ u: 'mb-1', pct: 100 }, { u: 'mb-2', pct: 100 }, { u: 'mb-3', pct: 100 }, { u: 'mb-ga', pct: 100 }], mods: M(1, 0, 3, 2, 1, 1) }
              ] }
          }
        }
      ],
      redCOAs: [
        {
          id: 'mocoa1', name: 'OCOA 1 — Defensa en la playa', tag: 'MLCOA', likelihood: 65,
          statement: 'Defensa adelantada sobre ambas playas con un batallón en cada una; la reserva móvil contraataca la playa principal en H+6.',
          plan: {
            m1: { pre: '', reaction: 'Fuego desde posiciones preparadas en la playa; minado en la línea de agua.', placement: [{ u: 'mr-1', sector: 'V', pct: 50 }, { u: 'mr-2', sector: 'A', pct: 50 }] },
            m2: { pre: '', reaction: 'Bn Carros y Bn Inf 3 contraatacan VERDE.', placement: [{ u: 'mr-tk', sector: 'V', pct: 100 }, { u: 'mr-3', sector: 'V', pct: 100 }, { u: 'mr-2', sector: 'A', pct: 60 }] },
            m3: { pre: '', reaction: 'Restos de la brigada defienden el aeródromo.', placement: [{ u: 'mr-tk', sector: 'I', pct: 100 }, { u: 'mr-3', sector: 'I', pct: 60 }, { u: 'mr-at', sector: 'I', pct: 100 }] }
          }
        },
        {
          id: 'mocoa2', name: 'OCOA 2 — Defensa en profundidad con reserva móvil', tag: 'MDCOA', likelihood: 35,
          statement: 'Pantalla ligera en la playa; defensa principal en el interior; la reserva móvil se reserva para el momento de máxima vulnerabilidad (desembarco de la segunda oleada).',
          plan: {
            m1: { pre: '', reaction: 'Pantalla en playas y repliegue a la línea principal.', placement: [{ u: 'mr-1', sector: 'V', pct: 25 }, { u: 'mr-2', sector: 'A', pct: 25 }] },
            m2: { pre: '', reaction: 'La reserva móvil avanza por el eje interior y golpea la segunda oleada en VERDE.', placement: [{ u: 'mr-tk', sector: 'I', pct: 100 }, { u: 'mr-3', sector: 'V', pct: 100 }, { u: 'mr-at', sector: 'V', pct: 100 }] },
            m3: { pre: '', reaction: 'Defensa preparada del aeródromo.', placement: [{ u: 'mr-1', sector: 'I', pct: 100 }, { u: 'mr-2', sector: 'I', pct: 100 }, { u: 'mr-at', sector: 'I', pct: 100 }, { u: 'mr-tk', sector: 'I', pct: 60 }] }
          }
        }
      ],
      sessions: {}
    };
  }

  function blank() {
    const id = 'op-' + Date.now().toString(36);
    return {
      id, name: 'Nueva operación', classification: 'SIN CLASIFICAR — USO DIDÁCTICO', unit: '', mission: '', intent: '', endState: '',
      initiative: 'blue', ffir: 70, techniques: ['key'], criteria: [],
      sectors: [{ id: 'S1', name: 'Sector 1' }],
      events: [{ id: 'ev1', name: 'Evento crítico 1', time: 'H → H+6', space: '', technique: 'key', dc: '' }],
      units: { blue: [], red: [] }, blueCOAs: [], redCOAs: [], sessions: {}
    };
  }

  /* Biblioteca de Equivalentes de Fuerza (FE). Origen indicado en cada fila. */
  const FE_LIBRARY = [
    { type: 'Bn Mecanizado (BMP)', fe: 0.51, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Bn MR (BMP-1/2)', fe: 0.51, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Bn MR (BTR-80)', fe: 0.36, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Bn Asalto / Inf ligera', fe: 0.35, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Bn Carros (31 MBT T-64/T-72)', fe: 0.69, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Bn Carros (41 × T-72B3)', fe: 0.89, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Bn C/C (Kornet-T · 2S25)', fe: 0.45, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Bda Acorazada (3 bn carros + 1 bn mec)', fe: 2.58, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Bda Carros (≈120 MBT)', fe: 2.67, src: 'TRYZUB / SIRKO §3.1' },
    { type: 'Cía Mecanizada (BMP)', fe: 0.17, src: 'Derivado (Bn ÷ 3)' },
    { type: 'Cía Carros (≈10–14 MBT)', fe: 0.23, src: 'Derivado (Bn ÷ 3)' },
    { type: 'Bn IM sobre anfibios', fe: 0.45, src: 'Orientativo — calibrar' },
    { type: 'Bn Inf motorizado', fe: 0.36, src: 'Orientativo — calibrar' }
  ];

  global.WGExamples = { tryzub, marAzul, blank, FE_LIBRARY };
})(typeof window !== 'undefined' ? window : globalThis);
