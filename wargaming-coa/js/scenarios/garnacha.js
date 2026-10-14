/* ==========================================================================
   OPERATION GARNACHA — escenario v3
   Fuente: WARGAME SCRIPT — OPERATION GARNACHA (EIMGAF), guion de 6 turnos de
   eventos clave: MECH DIV “CABERNET” / BRIGADE “MERLOT” vs 13th MECH INF DIV.
   - Las potencias de combate del guion (escala 1–500 de la app v1) se cargan
     como F.E. personalizado = CP/100, de modo que los ratios reproducen los del
     guion (p. ej. T2: 1,08:1).
   - La confrontación COA 1 × ECOA 1 trae los resultados, notas, ramas,
     matriz de sincronización y conclusiones del guion.
   - ECOA 2 (empeño temprano de la reserva) sólo aparece esbozada en el guion;
     su despliegue por turnos es una interpretación marcada como tal.
   - La fuerza de contraataque del Cuerpo “TEMPRANILLO” no tiene valor en el
     guion: se estima (F.E. 2,5) y se indica en la unidad.
   ========================================================================== */
(function (global) {
  'use strict';
  const M = (terrain, obst, fires, surprise, morale, isr) => ({ terrain, obst, fires, surprise, morale, isr });
  const NEU = () => M(1, 0, 1, 1, 1, 1);
  let n = 0;
  const E = (sector, label, task, units, o) => Object.assign({ id: 'gn-e' + (++n), sector, label, task, me: false, hpt: '', vs: [], pair: '', units: units.map(u => (Array.isArray(u) ? { u: u[0], pct: u[1] } : { u, pct: 100 })), mods: NEU() }, o || {});
  const P = (sector, ids) => ids.map(u => (Array.isArray(u) ? { u: u[0], sector, pct: u[1] } : { u, sector, pct: 100 }));
  const U = (id, side, name, type, ech, cp, role, fe) => ({ id, p: null, side, name, type, ech, pers: '', equip: '', role, frT: 'Custom F.E.', frQ: 1, frFE: fe, cp: 100, loc: '', note: cp ? 'Script CP ' + cp : '' });

  function build() {
    const W = global.WGModel;
    const op = W.blankOp('Operation GARNACHA — COA Analysis');
    n = 0;
    Object.assign(op, {
      id: 'op-garnacha',
      meta: { title: 'Operation GARNACHA — COA Analysis', classification: 'UNCLASSIFIED', unit: 'MECH DIV “CABERNET” / BRIGADE “MERLOT”', tag: 'OP GARNACHA', syndicate: '', date: '' },
      phases: [
        { id: 'P1', n: 'PHASE 1 · COVERING FORCE', t: 'D-1 → H', me: 'MOSCATEL', dc: 'OCOA confirmed', otg: '', d: 'TG MOSCATEL forward of PL1 as covering force; ISR competition.' },
        { id: 'P2S1', n: 'PHASE 2 STP 1 · DELAY PL1→PL2', t: 'H → H+12', me: 'MOSCATEL', dc: 'Delay past H+6', otg: '', d: 'Battle at EA1; TG TINTO limited CATK in PURPLE.' },
        { id: 'P2S2', n: 'PHASE 2 STP 2 · CATK & WITHDRAWAL', t: 'H+12 → H+24', me: 'BLANCO', dc: 'All TGs on PL2', otg: '', d: 'TG BLANCO decisive CATK; withdrawal to PL2.' },
        { id: 'P3S1', n: 'PHASE 3 STP 1 · DELAY PL2/PL3', t: 'H+24 → H+48', me: 'BLANCO', dc: 'Passage of lines forced', otg: '', d: 'Exploit the enemy internal passage of lines (key to success).' },
        { id: 'P3S2', n: 'PHASE 3 STP 2 · AREA DEFENCE PL3/PL4', t: 'H+48 → H+72', me: 'TINTO', dc: 'PL3 held', otg: '', d: 'Attrition battle; DP 3 watch.' },
        { id: 'P4', n: 'PHASE 4 · PL4 / CORPS C-ATK', t: 'H+72 → H+120', me: 'BLANCO', dc: 'End state', otg: '', d: 'Area defence on PL4; Corps “TEMPRANILLO” C-ATK.' }
      ],
      sectors: [{ id: 'Y', name: 'YELLOW — northern corridor (Z11)' }, { id: 'P', name: 'PURPLE — central / Bakhmut corridor (Z12)' }, { id: 'G', name: 'GREEN — southern corridor' }],
      cm: ['PL1', 'PL2', 'PL3', 'PL4', 'EA1', 'EA2', 'EA3', 'EA4', 'EA5', 'EA6', 'EA7', 'EA "TEMPRANILLO"', 'Red Line 1', 'Red Line 2', 'Red Line 3', 'Bakhmut bridge complex'],
      ffir: 70
    });
    op.inputs.hhq = { order: 'CONOPS MECH DIV “CABERNET” / BRIGADE “MERLOT” (FRIENDLY FORCES 26 / ENEMY 26).', purpose: 'Canalize and block the enemy 13th Mech Div in the Bakhmut sector to allow the counterattack of the “TEMPRANILLO” Army Corps reaction force.', key: '', endstate: '', tasks: 'FROM D-1, MECH DIV "CABERNET" WILL CANALIZE AND BLOCK THE ENEMY\'S 13TH MECH DIV IN THE BAKHMUT SECTOR IN ORDER TO ALLOW THE C-ATK OF THE "TEMPRANILLO" ARMY CORPS\' REACTION FORCE.', newTasks: '', newInfo: '', thirdParty: '' };
    op.inputs.s13 = { mission: 'FROM D-DAY, "MERLOT" WILL DISRUPT, CANALIZE AND BLOCK THE ATTACK OF THE 13TH ENEMY DIVISION IN ORDER TO ALLOW THE SUBSEQUENT REACTION FORCE\'S COUNTERATTACK ON ARMOURED DIV 14.',
      intent: 'As division main effort, canalize the enemy to an EA in front of PL4 to allow the Corps counterattack. Through a combination of offense and defense, disrupt and defeat successively the enemy front lines, forcing passages of lines and premature use of reserves before PL4. KEY TO SUCCESS: cause the 13th Div an internal passage of lines at PL3. END STATE: "MERLOT" in area defense at PL4; 13th Div stopped and worn down; 14th Tank Div approaching but unable to exploit.',
      specified: '', implied: '', essential: '', constraints: '', restraints: '', deductions: '' };
    op.inputs.criteria = [{ id: 'C1', name: 'Key to success', w: 3, q: 'Is the enemy forced into an internal passage of lines at PL2/PL3?' }, { id: 'C2', name: 'Combat power', w: 2, q: 'Does MERLOT reach PL4 able to fight (TGs ≥ 70 %)?' }, { id: 'C3', name: 'Flexibility', w: 2, q: 'Are branches A–D covered by reserves and DPs?' }];

    op.orbat = [
      U('g-mosc', 'B', 'TG MOSCATEL', 'infantry', 'battalion', 80, 'Covering force fwd of PL1; delay; withdraw through TG TINTO', 0.8),
      U('g-tinto', 'B', 'TG TINTO', 'infantry', 'battalion', 100, 'SE1 — Defense PL1 PURPLE; CATK; delay to PL3', 1.0),
      U('g-rosado', 'B', 'TG ROSADO', 'infantry', 'battalion', 95, 'SE2 — Defense PL1 GREEN; cover TINTO flank; delay', 0.95),
      U('g-blanco', 'B', 'TG BLANCO', 'armor', 'battalion', 130, 'RESERVE — CATKs at key moments; main shock force', 1.3),
      U('g-fires', 'B', 'FIRES (AMA 1/2)', 'artillery', 'battalion', 85, 'DS all TGs; 18 AFTs/h; priority by phase (counted as modifier)', 0),
      U('g-ew', 'B', 'EW BN', 'ew', 'company', 30, 'Electronic warfare; counter-drone; disrupt enemy C2', 0),
      U('g-rsv1', 'B', 'DIV RSV 1', 'infantry', 'brigade', 120, 'Division reserve 1 — commit to GREEN if DP 1 met', 1.2),
      U('g-rsv2', 'B', 'DIV RSV 2', 'armor', 'brigade', 110, 'Division reserve 2 — commit to PURPLE / C-ATK link-up', 1.1),
      U('g-corps', 'B', 'CORPS C-ATK “TEMPRANILLO”', 'armor', 'corps', 0, 'Corps reaction force — flank C-ATK (F.E. estimated: not given in the script)', 2.5),
      U('g-131', 'R', '13-1 BMP BDE', 'mech', 'brigade', 110, 'ME — lead attack Z11 YELLOW; BMP-1; drone swarm (SHAHED-136)', 1.1),
      U('g-132', 'R', '13-2 BTR BDE', 'motorized', 'brigade', 95, 'SE — attack Z12 PURPLE; BTR; FORPOST ISR', 0.95),
      U('g-133', 'R', '13-3 BTR BDE', 'motorized', 'brigade', 90, 'SE — flank pressure GREEN; 2nd line exploitation', 0.9),
      U('g-tkb', 'R', 'TANK BDE (TACOM)', 'armor', 'brigade', 140, 'Reserve / exploitation — commit when breakthrough; HPT 1', 1.4),
      U('g-arty', 'R', 'ARTY GRP', 'artillery', 'battalion', 85, 'GS; MLRS + artillery; counter-battery (counted as modifier)', 0),
      U('g-recon', 'R', 'RECON BN', 'recon', 'company', 35, 'ORLAN-10, FORPOST — locate MERLOT positions; HVT tracking', 0.35),
      U('g-eng', 'R', 'ENGINEER BN', 'engineer', 'battalion', 40, 'Breaching support; mobility corridors for passage of lines', 0),
      U('g-at', 'R', 'AT BN', 'antitank', 'battalion', 45, 'Anti-tank; cover flanks; attrit TG BLANCO', 0.45),
      U('g-14', 'R', '14th ARMD DIV', 'armor', 'division', 200, 'EXPLOITATION — forward passage through 13th Div at RL3; HVT 2', 2.0)
    ];

    op.turns = [
      { id: 'g1', m: 'critical', label: 'KEY EVENT 1', title: 'Covering force deployment — TG MOSCATEL forward / ISR competition', time: 'D-1 → H', ce: 'GCE1', sim: true },
      { id: 'g2', m: 'critical', label: 'KEY EVENT 2', title: 'Battle at EA1 / delay PL1 — 13th Div 1st line attack', time: 'H → H+12', ce: 'GCE2', sim: true },
      { id: 'g3', m: 'critical', label: 'KEY EVENT 3', title: 'TG BLANCO CATK / withdrawal to PL2', time: 'H+12 → H+24', ce: 'GCE3', sim: true },
      { id: 'g4', m: 'critical', label: 'KEY EVENT 4', title: 'Exploit enemy passage of lines at PL2/PL3 (key to success)', time: 'H+24 → H+48', ce: 'GCE4', sim: true },
      { id: 'g5', m: 'critical', label: 'KEY EVENT 5', title: 'Area defence PL3/PL4 — attrition battle', time: 'H+48 → H+72', ce: 'GCE5', sim: true },
      { id: 'g6', m: 'critical', label: 'KEY EVENT 6', title: 'Area defence PL4 / decisive Corps C-ATK “TEMPRANILLO”', time: 'H+72 → H+120', ce: 'GCE6', sim: true }
    ];
    op.ces = [
      { id: 'GCE1', title: 'Covering force deployment', step: 'P1', dc: 'OCOA confirmed NLT H-2', dp: 'DP 1', ccir: '', r: {}, cr: '' },
      { id: 'GCE2', title: 'Battle at EA1 — PL1 contact', step: 'P2S1', dc: '≥ 20 % losses on 13-1 BMP', dp: 'DP 2', ccir: '', r: {}, cr: '' },
      { id: 'GCE3', title: 'TG BLANCO CATK / withdrawal to PL2', step: 'P2S2', dc: 'All TGs on PL2 < 30 % losses', dp: 'DP 2', ccir: '', r: {}, cr: '' },
      { id: 'GCE4', title: 'Exploit enemy passage of lines at PL2/PL3', step: 'P3S1', dc: 'Passage of lines forced prematurely', dp: '', ccir: '', r: {}, cr: '' },
      { id: 'GCE5', title: 'Area defence PL3/PL4', step: 'P3S2', dc: 'PL3 held NLT H+72', dp: 'DP 3', ccir: '', r: {}, cr: '' },
      { id: 'GCE6', title: 'PL4 / Corps C-ATK', step: 'P4', dc: 'End state achieved', dp: 'DP 3', ccir: '', r: {}, cr: '' }
    ];
    op.prep = Object.assign(op.prep, { coa: 'COA-1', acoa: 'ECOA-1', initiative: 'blue', methods: { critical: true, belt: false, box: false, avenue: false }, ceSel: op.ces.map(c => c.id), dpSel: ['DP 1', 'DP 2', 'DP 3'], timeline: '6 key events · ≈ 3 h' });

    const A = {
      g1: 'TG MOSCATEL deploys forward of PL1 as covering force in YELLOW; 3 OPs on NAI 1 and NAI 2. TG TINTO occupies PL1 PURPLE (EA1 preparation); TG ROSADO occupies PL1 GREEN; TG BLANCO in reserve behind PL2. FIRES (AMA 1) south of PL2, priority MOSCATEL. EW BN jams ORLAN-10 / FORPOST. MOP/MOE: confirm OCOA NLT H-2; MOSCATEL > 70 % CP.',
      g2: 'TG MOSCATEL active defence at EA1 (YELLOW), fires on HPT 1 as it enters the kill zone; leap-frog to PL2 on order. TG TINTO active defence PL1 PURPLE with 1-coy CATK against 13-2 BTR lead (≥ 2 h delay). TG ROSADO holds PL1 GREEN. TG BLANCO in reserve (DP 2 watch). AMA 1 priority TINTO / MOSCATEL; 1 counter-battery mission.',
      g3: 'TG BLANCO CATK with 2 tank coys from concealed positions against the attrited 13-1 BMP lead bn — surprise; halt the enemy 4 h. MOSCATEL withdraws through TINTO to PL2; TINTO 1-coy CATK in PURPLE then PL2; ROSADO covers the flank and displaces to PL2. AMA 1 shifts to PURPLE/GREEN; AMA 2 established south of PL3.',
      g4: 'Provoke and exploit the enemy internal passage of lines. TG BLANCO CATK against the Tank Bde crossing through 13-1 BMP (HPT 2); TG MOSCATEL CATK into the passage gap in YELLOW; TINTO holds PL2 PURPLE; ROSADO holds GREEN; DIV RSV 1 commits to GREEN. AMA 1/2 maximum effort (×6 to BLANCO).',
      g5: 'MERLOT transitions to area defence PL3/PL4. TINTO + MOSCATEL PL3 PURPLE (EA2); ROSADO + DIV RSV 1 PL3–PL4 GREEN (EA3); TG BLANCO reserve south of PL4 ready to CATK into EA2/EA3; DIV RSV 2 behind PL4 for the Corps link-up. AMA 2 dual priority; ADA priority vs LANCET-3.',
      g6: 'MERLOT holds PL4 as the anvil (TINTO + MOSCATEL in YELLOW/PURPLE, ROSADO + DIV RSV 1 in GREEN). TG BLANCO final CATK in EA4; DIV RSV 2 links up with the Corps C-ATK “TEMPRANILLO” from the flank against 14th Armd Div during its forward passage. 18 AFTs on EA “TEMPRANILLO”.'
    };
    const R1 = {
      g1: '13th Div completes assembly south of Red Line 1 and advances to PL1. RECON BN ORLAN-10 swarm over YELLOW/PURPLE; 13-1 BMP forms up as ME in Z11 (2 bns fwd); SHAHED-136 against MERLOT logistics; 13-2 BTR to Z12; ARTY GRP preparation fires and counter-battery vs AMA 1.',
      g2: '13-1 BMP deliberate attack in YELLOW through EA1 — lead mech bn suppresses MOSCATEL, LANCET-3 on AFVs, tank bn enters the kill zone NLT H+3 (HPT 1). 13-2 BTR advances in PURPLE (2 bns fwd); 13-3 BTR probes GREEN. MLRS on the suspected BLANCO position. OCOA 2 indicator: partial reserve requested.',
      g3: '13-1 BMP pursues in YELLOW and is surprised by BLANCO. 13th Div starts the internal passage of lines (2nd-line BTR bdes). Tank Bde (DP 2 TRIGGERED) partially commits in YELLOW. MLRS interdicts PL1–PL2 withdrawal routes; SHAHED-136 on the TINTO column.',
      g4: 'INTERNAL PASSAGE OF LINES — maximum vulnerability. 2nd-line BTR bdes thread through degraded 13-1 BMP and 13-2 BTR; Tank Bde assumes the lead in YELLOW; ARTY GRP relocates (TAI 1); 13-3 BTR steps forward in GREEN (OCOA 2 partially activated).',
      g5: '13th Div consolidates at PL2/PL3. 6 h MLRS preparation on PL3; SHAHED/LANCET campaign against BLANCO; Tank Bde (resupplied to 70 %) assaults PL3 in YELLOW; 13-3 BTR flanking attempt in GREEN; 14th Armd Div approaching RL2 (HVT 2).',
      g6: '13th Div remnants (~40 %) assault PL4 in YELLOW and PURPLE. 14th Armd Div begins its forward passage of lines through 13th Div — two divisions intermixed, limited command bandwidth. Maximum MLRS and drone effort on PL4; CAS requested.'
    };
    const CR = {
      g1: 'EW BN degrades ORLAN-10: 60 % of PL1 positions concealed. Counter-battery disrupts ARTY GRP (–15 % for 4 h). NAI 1: 13-1 BMP advancing in YELLOW with full brigade → OCOA 1 confirmed. DP 1 NOT met (2 axes). BLANCO displacement recommended.',
      g2: 'HPT 1 engaged: tank bn loses 2 coy equivalents (–30 % 13-1 BMP). TINTO CATK halts the 13-2 BTR lead bn for 2 h. MOSCATEL leap-frog, 60 % integrity. DP 2 watch: Tank Bde assembly west of PL1. MLRS strike on reserve area — BLANCO already displaced.',
      g3: 'BLANCO achieves SURPRISE: 13-1 BMP front bn halted 4 h (–40 %). DP 2 TRIGGERED: withdrawal to PL3 planning; DIV RSV 2 alerted. MOSCATEL on PL2 at 60 % (DEGRADED); TINTO at 75 %. Passage-of-lines vulnerability window identified NLT H+30.',
      g4: 'HPT 2: BLANCO CATK strikes the Tank Bde in the passage (–25 %). TAI 1 counter-battery on the ARTY GRP column (–20 %). MOSCATEL CATK — 13-1 BMP combat ineffective. DIV RSV 1 stops 13-3 BTR. Passage of lines halted 6+ h — KEY SUCCESS INDICATOR ACHIEVED.',
      g5: 'BLANCO CATK into EA2 halts the Tank Bde. DIV RSV 1 stops 13-3 BTR in GREEN. TINTO holds PL3. SHORAD degrades LANCET-3 by 40 %. AMA 2 strike on 13th Div HQ (HVT 1) — 4 h C2 degradation. DP 3 nearly met: recommend Corps C-ATK NLT H+72.',
      g6: 'Corps C-ATK “TEMPRANILLO” achieves decisive surprise on the 14th Armd Div flank during its forward passage. BLANCO final CATK in EA4 halts the lead brigade. HVT 2 struck: 14th Armd Div C2 disrupted 8 h. MERLOT holds PL4. END STATE ACHIEVED.'
    };
    const ENG = {
      g1: [E('Y', 'Covering force fwd of PL1', 'screen', ['g-mosc'], { hpt: 'g-recon', mods: M(1, 0, 2, 1, 1, 2) }),
           E('P', 'TINTO occupies PL1 PURPLE', 'delibDef', ['g-tinto'])],
      g2: [E('Y', 'EA1 active defence — HPT 1', 'hastyDef', ['g-mosc'], { me: true, brk: true, hpt: 'g-131', mods: M(2, 0, 1, 1, 1, 1) }),
           E('P', 'TINTO active defence + 1-coy CATK', 'hastyDef', ['g-tinto'], { mods: M(2, 0, 1, 1, 1, 1) }),
           E('G', 'ROSADO holds PL1 GREEN', 'hastyDef', ['g-rosado'])],
      g3: [E('Y', 'TG BLANCO CATK — surprise', 'catk', ['g-blanco'], { me: true, hpt: 'g-131', vs: ['g-131'], mods: M(1, 0, 1, 2, 1, 1) }),
           E('Y', 'MOSCATEL withdrawal to PL2', 'delay', ['g-mosc'], { vs: ['g-tkb'] }),
           E('P', 'TINTO CATK and withdrawal to PL2', 'delay', ['g-tinto']),
           E('G', 'ROSADO covers flank, displaces to PL2', 'delay', ['g-rosado'])],
      g4: [E('Y', 'BLANCO CATK on Tank Bde in passage — HPT 2', 'catk', ['g-blanco'], { me: true, hpt: 'g-tkb', vs: ['g-tkb'], mods: M(1, 0, 3, 2, 1, 1) }),
           E('Y', 'MOSCATEL CATK into the passage gap', 'catk', ['g-mosc'], { vs: ['g-131'] }),
           E('P', 'TINTO holds PL2 PURPLE', 'hastyDef', ['g-tinto']),
           E('G', 'ROSADO + DIV RSV 1 hold GREEN', 'hastyDef', ['g-rosado', 'g-rsv1'])],
      g5: [E('Y', 'BLANCO CATK into EA2 vs Tank Bde', 'catk', ['g-blanco'], { me: true, hpt: 'g-tkb', mods: M(1, 0, 2, 1, 1, 1) }),
           E('P', 'TINTO + MOSCATEL area defence PL3', 'delibDef', ['g-tinto', 'g-mosc'], { mods: M(2, 1, 0, 1, 1, 1) }),
           E('G', 'ROSADO + DIV RSV 1 area defence', 'delibDef', ['g-rosado', 'g-rsv1'], { mods: M(1, 1, 1, 1, 1, 1) })],
      g6: [E('Y', 'MERLOT holds PL4 as the anvil', 'delibDef', ['g-tinto', 'g-mosc'], { vs: ['g-131', 'g-132'], mods: M(2, 1, 2, 1, 1, 1) }),
           E('Y', 'Corps C-ATK + BLANCO + DIV RSV 2 (flank)', 'catk', ['g-corps', 'g-blanco', 'g-rsv2'], { me: true, hpt: 'g-14', vs: ['g-14', 'g-tkb'], mods: M(1, 0, 3, 2, 1, 1) }),
           E('G', 'ROSADO + DIV RSV 1 hold PL4 GREEN', 'delibDef', ['g-rosado', 'g-rsv1'], { mods: M(1, 1, 1, 1, 1, 1) })]
    };
    const PL1 = {
      g1: P('Y', ['g-recon', ['g-131', 30]]).concat(P('P', [['g-132', 20]])),
      g2: P('Y', ['g-131']).concat(P('P', ['g-132'])).concat(P('G', [['g-133', 50]])),
      g3: P('Y', ['g-131', ['g-tkb', 30]]).concat(P('P', ['g-132'])).concat(P('G', [['g-133', 50]])),
      g4: P('Y', ['g-tkb', ['g-131', 50]]).concat(P('P', [['g-132', 60]])).concat(P('G', ['g-133'])),
      g5: P('Y', [['g-tkb', 70]]).concat(P('P', [['g-132', 50]])).concat(P('G', ['g-133', 'g-at'])),
      g6: P('Y', [['g-131', 40], ['g-132', 40], 'g-tkb', ['g-14', 60]]).concat(P('G', [['g-133', 60]]))
    };
    const PL2 = {
      g1: PL1.g1,
      g2: P('Y', ['g-131', ['g-tkb', 50]]).concat(P('P', ['g-132'])).concat(P('G', [['g-133', 50]])),
      g3: P('Y', ['g-131', 'g-tkb']).concat(P('P', ['g-132'])).concat(P('G', ['g-133'])),
      g4: P('Y', ['g-tkb', 'g-131']).concat(P('P', ['g-132'])).concat(P('G', ['g-133', 'g-at'])),
      g5: P('Y', ['g-tkb', ['g-14', 30]]).concat(P('P', ['g-132'])).concat(P('G', ['g-133', 'g-at'])),
      g6: PL1.g6
    };
    const coa = op.coas[0];
    Object.assign(coa, { id: 'COA-1', name: 'COA 1 — “MERLOT” delay in depth / canalize 13th Div to EA “TEMPRANILLO”', stmt: 'Delay in depth PL1→PL4 combining defence and successive CATKs by TG BLANCO; force the 13th Div into a premature internal passage of lines at PL2/PL3; area defence on PL4 as the anvil for the Corps C-ATK “TEMPRANILLO”.' });
    op.ecoas = [
      { id: 'ECOA-1', name: 'ECOA 1 — 13th MID attack PL1→RL3 (ME YELLOW)', tag: 'MLCOA', lik: 65, text: '13-1 BMP Bde as ME in YELLOW (Z11); 13-2 BTR as SE in PURPLE (Z12); reserves echeloned. Phase 1: 1st-line brigades breach at PL1, reach Red Line 2 and conduct an internal passage of lines. Phase 2: 14th Armd Div forward passage to seize Kharkiv.', bySector: {}, plan: {} },
      { id: 'ECOA-2', name: 'ECOA 2 — Early commitment of the reserve', tag: 'MDCOA', lik: 35, text: 'Commits the reserve earlier to reinforce the ME if MERLOT defence is stronger than expected. (Turn-by-turn deployment interpreted for the app — not detailed in the script.)', bySector: {}, plan: {} }
    ];
    op.turns.forEach(t => {
      coa.plan[t.id] = { a: A[t.id], eng: ENG[t.id] };
      op.ecoas[0].plan[t.id] = { pre: '', r: R1[t.id], place: PL1[t.id] };
      op.ecoas[1].plan[t.id] = { pre: '', r: t.id === 'g2' ? '13th Div Cdr commits the Tank Bde early behind 13-1 BMP in YELLOW to restore momentum after HPT 1 attrition.' : '', place: PL2[t.id] };
    });
    const ces = op.ces; ces.forEach(c => { const t = op.turns.find(x => x.ce === c.id); c.r = { 'ECOA-1': R1[t.id], 'ECOA-2': op.ecoas[1].plan[t.id].r }; c.cr = CR[t.id]; });

    op.reg = {
      nai: [
        { id: 'NAI 1', loc: 'PL1 crossing points (YELLOW/PURPLE)', ind: 'If 13-1 BMP crosses PL1 in YELLOW with more than 2 bns → OCOA 1 confirmed', ccir: '', col: 'TG MOSCATEL OPs', time: 'D-1 → H+6', st: 'ACTIVE' },
        { id: 'NAI 2', loc: 'Z11 / Z12 mobility corridors', ind: 'ORLAN-10 activity over Z11 indicates Tank Bde preparation to commit in YELLOW', ccir: '', col: 'OPs · UAS', time: 'H → H+30', st: 'ACTIVE' },
        { id: 'NAI 3', loc: 'Bakhmut bridge complex', ind: 'Engineer preparation of bridges = intent to pass heavy armour (Tank Bde / 14th Armd Div). Triggers DP 2 watch', ccir: '', col: 'UAS', time: 'H+12 → H+72', st: 'ACTIVE' }
      ],
      tai: [{ id: 'TAI 1', loc: 'Enemy ARTY positions south of PL2', tgt: '', means: 'AMA 1 counter-battery', dp: '', eff: 'When ARTY GRP relocates north of Red Line 1 → fires priority mission', st: 'PLANNED' }],
      hpt: [
        { id: 'HPT 1', tgt: 'TANK BDE leading battalion entering the EA1 kill zone (> 1 coy in kill zone)', when: 'P2S1', how: 'TG BLANCO + AMA', eff: 'Neutralise', tai: '', st: 'PLANNED' },
        { id: 'HPT 2', tgt: '14th ARMD DIV leading elements at the passage of lines IVO PL2', when: 'P3S1', how: 'Maximum fires; CATK trigger', eff: 'Neutralise', tai: '', st: 'PLANNED' }
      ],
      hvt: [
        { id: 'HVT 1', tgt: '13th Div HQ (mobile)', val: 'Coordinates the 3-brigade attack and the passage-of-lines timing', xs: '', means: 'AMA 2', st: 'PLANNED' },
        { id: 'HVT 2', tgt: '14th Armd Div HQ / leading bde', val: 'Delay its commitment by disrupting the approach march', xs: '', means: 'AMA 2', st: 'PLANNED' }
      ],
      dp: [
        { id: 'DP 1', side: 'BLUE', dec: 'Commit DIV RSV 1 to the GREEN axis', trg: 'Enemy advances on 3+ axes with more than battalion strength each (refinement: 2+ axes)', nai: 'NAI 1', ccir: '', dc: '', win: 'NLT H+4', st: 'WATCH' },
        { id: 'DP 2', side: 'BLUE', dec: 'Begin withdrawal planning to PL3; alert DIV RSV 2 for CATK', trg: 'Tank Bde (TACOM) commits before PL2', nai: 'NAI 2', ccir: '', dc: '', win: 'NLT H+18', st: 'WATCH' },
        { id: 'DP 3', side: 'BLUE', dec: 'Authorize Corps C-ATK “TEMPRANILLO”', trg: '13th Div reaches PL4 with 14th Armd Div approaching', nai: 'NAI 3', ccir: '', dc: '', win: 'NLT H+72', st: 'WATCH' }
      ],
      ccir: [
        { id: 'PIR-1', type: 'PIR', q: 'Which corridor carries the 13th Div main effort?', feeds: 'DP 1', nai: 'NAI 1', st: 'OPEN' },
        { id: 'PIR-2', type: 'PIR', q: 'When does the Tank Bde commit, and where does the passage of lines take place?', feeds: 'DP 2', nai: 'NAI 2', st: 'OPEN' },
        { id: 'PIR-3', type: 'PIR', q: 'Is the 14th Armd Div approaching RL2 / PL4?', feeds: 'DP 3', nai: 'NAI 3', st: 'OPEN' },
        { id: 'FFIR-1', type: 'FFIR', q: 'Combat power of any TG below 70 %.', feeds: 'DP 2 / DP 3', nai: '', st: 'OPEN' }
      ]
    };
    op.reg.dp.forEach((d, i) => { d.ccir = ['PIR-1', 'PIR-2', 'PIR-3'][i]; });

    const g = W.game(op, 'COA-1|ECOA-1');
    const RES = { g1: ['PARTIAL SUCCESS', 'DP 1', 'PIR-1', 'Covering force deployed; enemy recon partially successful. OCOA 1 confirmed. Logistics disruption: –5 % sustainment modifier to Turn 2. Losses: Blue 5 %, Red 10 %.', 'If enemy recon breaks through and identifies all PL1 positions → expedite MOSCATEL withdrawal; TINTO hasty positions 500 m east of PL1.'],
      g2: ['PARTIAL SUCCESS', 'DP 2', 'PIR-2', 'Blue delays but cannot prevent the advance toward PL2 NLT H+12. HPT 1 engaged (13-1 BMP → 77). MOSCATEL DEGRADED. CoF 1.08:1 (terrain ×1.2). Losses: Blue 15 %, Red 25 %.', 'A: if OCOA 2 activates → re-evaluate DP 1 (DIV RSV 1 to GREEN). B: if MOSCATEL collapses early → BLANCO CATK at H+4 instead of H+12.'],
      g3: ['SUCCESS', 'DP 2', 'PIR-2', 'Withdrawal to PL2 complete with acceptable losses. DP 2 confirmed: Tank Bde in YELLOW. CoF 2.25:1 (BLANCO ×1.3 surprise). BLANCO 117, TINTO 85, MOSCATEL 48; 13-1 BMP 66, Tank Bde 119. Losses: Blue 15 %, Red 30 %.', 'Sequel: exploit the passage of lines at PL2/PL3 in Turn 4. Branch: if MOSCATEL withdrawal fails (> 40 % losses) → DIV RSV 1 to YELLOW.'],
      g4: ['SUCCESS', '', 'PIR-2', 'KEY SUCCESS ACHIEVED — enemy passage of lines disrupted at PL2/PL3. CoF 1.65:1. Tank Bde 105, ARTY GRP 68, BLANCO 99, DIV RSV 1 114. Losses: Blue 10 %, Red 35 %.', 'Risk: if the Tank Bde crosses PL3 with > 2 bns → accelerate Phase 4. Sequel: area defence PL3/PL4; DIV RSV 2 alerted.'],
      g5: ['PARTIAL SUCCESS', 'DP 3', 'PIR-3', 'PL3 held but MERLOT significantly attrited. CoF 1.45:1. TINTO 63, MOSCATEL 34 (ATTRITED), BLANCO 79, Tank Bde 68; 13-1 BMP effectively destroyed. Losses: Blue 20 %, Red 30 %.', 'Critical: if SHORAD fails and drone attrition > 30 % on BLANCO → commit DIV RSV 2 early.'],
      g6: ['DECISIVE SUCCESS', 'DP 3', 'PIR-3', 'MISSION ACCOMPLISHED. CoF 2.58:1 (Corps C-ATK ×1.3 surprise). 13th Div ~55 % losses (combat ineffective), 14th Armd Div ~35 % (mission halted). Losses: Blue 15 %, Red 40 %.', 'Sequel — Corps C-ATK once 13th Div reaches PL4 and 14th Armd Div attempts passage; DIV RSV 2 link-up NLT H+72.'] };
    op.turns.forEach(t => { const r = RES[t.id]; g.turns[t.id] = { cr: CR[t.id], assets: [], dp: r[1], ccir: r[2], rem: r[3], branch: r[4], res: r[0], bcp: '', rcp: '', fr: '', ovr: {}, mods: {} }; });
    g.sync = {
      c2: { g1: 'BDE HQ fwd of PL2; MOSCATEL comms net; NAI reporting chain active', g2: 'BDE HQ at PL2; 3 TG nets synchronized; DP 2 watch active', g3: 'BLANCO direct comms to BDE; withdrawal comms TINTO/ROSADO', g4: 'BDE HQ PL3; coordination DIV RSV 1; C2 for passage-of-lines exploitation', g5: 'BDE HQ PL4 fwd; Corps “TEMPRANILLO” comms link active; DP 3 reporting', g6: 'Corps C-ATK synchronized; EA “TEMPRANILLO” all nets' },
      man: { g1: 'MOSCATEL fwd of PL1; TINTO/ROSADO occupy PL1; BLANCO reserve', g2: 'MOSCATEL active defence EA1; TINTO CATK ×1 coy PURPLE; ROSADO holds GREEN', g3: 'BLANCO CATK EA1 (decisive); MOSCATEL withdrawal to PL2', g4: 'All TGs PL2; BLANCO CATK vs Tank Bde in passage; DIV RSV 1 to GREEN', g5: 'TINTO/MOSCATEL PL3 def; BLANCO CATK EA2; ROSADO/DIV RSV 1 GREEN', g6: 'All TGs PL4 area defence; BLANCO CATK EA4; Corps C-ATK from flank' },
      intel: { g1: 'MOSCATEL OPs on NAI 1/2; EW BN jamming ORLAN-10; OCOA confirm NLT H-2', g2: 'NAI 1 confirmed OCOA 1; HPT 1 tracking; DP 2 watch', g3: 'Tank Bde confirmation (NAI 2); HVT 1 location; passage window track', g4: 'TAI 1 ARTY GRP reposition; HVT 1 strike; 14th Armd Div track', g5: '14th Armd Div RL2 confirmation; HVT 2 active; DP 3 assessment', g6: '14th Armd Div passage start = HPT 2 final; HVT 2 strike' },
      fires: { g1: 'AMA 1 S of PL2; priority MOSCATEL ×6; counter-battery plan', g2: 'AMA 1 priority TINTO ×2, MOSCATEL ×2; 1 CB mission', g3: 'AMA 1: PURPLE ×2, GREEN ×1; Tank Bde assembly ×1; AMA 2 at PL3', g4: 'AMA 1+2 MAX EFFORT during passage; BLANCO ×6; TAI 1', g5: 'AMA 2 dual priority ROSADO/TINTO; HVT 1 strike', g6: '18 AFTs EA “TEMPRANILLO”; HVT 2 strike' },
      sust: { g1: 'LOGBASE S of PL3; SHAHED-136 threat — ADA cover', g2: 'CASEVAC TINTO/MOSCATEL; ammo resupply BLANCO reserve', g3: 'MOSCATEL CASEVAC during withdrawal; BLANCO ammo post-CATK', g4: 'DIV RSV 1 train follows; BLANCO maintenance after 3rd CATK', g5: 'MERLOT at 60–70 % CP; LOGPACs to all TGs at PL3', g6: 'Hold till C-ATK complete; LOGBASE protects the C-ATK lifeline' },
      prot: { g1: 'EW jamming; OPSEC; MOSCATEL OP security; BLANCO displacement', g2: 'SHORAD limited; counter-LANCET-3 TTPs', g3: 'BLANCO OPSEC; ADA cover withdrawal routes', g4: 'Request Div SHORAD; LANCET-3 cover for BLANCO', g5: 'SHORAD activated; SHAHED/LANCET partially intercepted', g6: 'Full SHORAD/ADA PL4; C-ATK route deconfliction' }
    };
    g.facds = { F: { v: 'SI', t: 'End state achieved in 6 turns (H+120).' }, A: { v: 'COND', t: 'Acceptable with the ADA/SHORAD refinement; MOSCATEL ends ATTRITED.' }, C: { v: 'SI', t: '' }, D: { v: 'SI', t: '' }, S: { v: 'SI', t: 'Corps C-ATK enabled and executed; enemy CoG stopped at EA “TEMPRANILLO”.' } };
    g.strengths = 'Canalized 13th Mech Inf Div to EA “TEMPRANILLO”.\nForced premature internal passage of lines at PL2/PL3.\nPreserved sufficient combat power for the Corps C-ATK.';
    g.weaknesses = 'LANCET-3 / SHAHED-136 threat to TG BLANCO in every CATK.\nTG MOSCATEL attrited below 40 % by Turn 5.\nThree CATKs in six turns exhaust BLANCO baseline load.';
    g.outputs.refinedText = '• ADA/SHORAD in MERLOT task organization from Phase 2.\n• Advance the BLANCO CATK window by 2 h to H+10 if MOSCATEL is degraded early.\n• Authorize the HVT 1 strike NLT Turn 3.\n• Revise DP 1: 2+ axes with > battalion strength.\n• Dedicated LOGPAC to BLANCO after each CATK.';
    g.conclusions = 'COA 1 (“MERLOT” delay in depth) is VIABLE. End state achieved in 6 turns (H+120).';
    op.ui.planTurn = 'g2';
    return op;
  }

  global.WGScenarios = global.WGScenarios || {};
  global.WGScenarios.garnacha = { name: 'Operation GARNACHA (MERLOT · guion EIMGAF)', build };
})(typeof window !== 'undefined' ? window : globalThis);
