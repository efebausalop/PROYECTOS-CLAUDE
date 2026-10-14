/* =====================================================================
   Catálogos doctrinales y de referencia (procedentes de wargaming_nato v2)
   - Force Ratio Calculator Matrix v3.0 (CGSC ST 100-3): tipos y FE
   - Tabla de daños BCTP (brief 9/6/95, slide 47)
   - Ratios mínimos históricos de planeamiento
   ===================================================================== */
(function (global) {
'use strict';
/* ---------- FORCE RATIO CATALOGUE (Force Ratio Calculator Matrix) ---------- */
const FR_CAT = [
 {g:'US / NATO pattern (CGSC ST 100-3)', items:[
  ['Infantry Bn (M113)',0.71],['Infantry Bn (M2)',1],['Infantry Bn (Light)',0.48],['Infantry Bn (Airborne/Air Assault)',0.7],
  ['Seperate Brigade (Armored)',5.3],['Seperate Brigade (Mech)',4.7],['Seperate Brigade (Light)',3.1],
  ['Armor Bn (M1A1)',1.19],['Armor Bn (M1A2)',1.3],['Armored Cav Regiment',7.6],['Armored Cav Squadron',2.2],
  ['Regimental Aviation Squadron',0.91],['Cav Troop (Ground)',0.5],['105(T) Bn (M102)',0.8],['105(T) Bn (M119)',0.8],
  ['155(SP) Bn (M109A5)',1],['155(SP) Bn (M109A6)(Paladin)',1.5],['155(T) Bn (M198)',0.8],['MLRS Bn',4.5],
  ['ATACMS Bn (B2)',7.5],['ATACMS Bn (B1)',8.8],['Div Cav Squadron (AASLT, Abn, Lt Div)',0.7],['Div Cav Squadron (Heavy Div)',3.8],
  ['Atk Helo Bn (24xOH58D)',2.1],['Atk Helo Bn (24xAH64)',4.5],['ADA Bn (Avenger)',0.21],['Patriot Bn',0.59]]},
 {g:'MARFOR (CGSC ST 100-3)', items:[
  ['Infantry Bn',0.8],['Tank Co',0.3],['LAV Co',0.2],['AAV Co',0.2],['FA Bn',1.5],['AH-1 Co',1],['MEF (Fwd)',5.6]]},
 {g:'Soviet / Russian pattern (CGSC ST 100-3)', items:[
  ['Infantry Bn (BTR-50 / 60)',0.29],['Infantry Bn (BTR-70 / 80)',0.36],['Infantry Bn (BMP-1 / 2)',0.51],['Infantry Bn (BMP-3)',0.65],
  ['Infantry Bn (Light / Air Assault)',0.35],['Infantry Bn (Airborne)',0.5],['Recon Bn',0.2],['AT Bn',0.45],['AT Bn (AT Bde / Div)',0.45],
  ['AT Bn (IMIBn / AT Regt)',0.5],['Tank Bn (MIB 40xT55)',0.77],['Tank Bn (MIB 40xT62)',0.77],['Tank Bn (MIB 40xT64 / T72)',0.89],
  ['Tank Bn (MIB 40xT80)',1],['Tank Bn (TR 31xT55 / T62)',0.6],['Tank Bn (TR 31xT64 / T72)',0.69],['Tank Bn (TR 31xT80)',0.78],
  ['Indep Tank Bn (51xT55)',0.98],['Indep Tank Bn (51xT62)',0.98],['Indep Tank Bn (51xT64 / T72)',1.13],['Indep Tank Bn (51xT80)',1.28],
  ['2A36 Bn',0.75],['2A65 Bn',0.75],['2S1 Bn',0.9],['2S3 Bn',1.05],['2S4 Bn',0.45],['2S5 Bn',1.13],['2S7 Bn',1.28],['2S9 Bn',0.6],
  ['2S19 / 23 Bn',1.35],['9A52 Bn',3.6],['BM 21 Bn',3.15],['BM 21V Bn',1.04],['9P140 Bm',3.6],['BM 24 Bn',3.6],['D20 Bn',0.77],
  ['D30 Bn',0.63],['FROG Bn',0.22],['M46 Bn',0.78],['M240 Bn',0.4],['SCUD Bn',0.8],['SCUD-B Bn',0.4],['SS-21 Bn',0.6],['9A51 Bn',3.78],
  ['Hind- D Bn',3.33],['HOKUM / HAVOK Bn',5.53],['Hind-E Bn',4.17],['SA-4 Bn',0.46],['SA-6 / 8 Bn',0.11],['SA-11 / 12 Bn',0.54],
  ['SA-17 Bn',0.76],['S-60 Bn',0.34]]},
 {g:'TRYZUB derived — planning values (instructor may adjust)', items:[
  ['PIR Mech Aslt Bn (YPR-765/BMP-1)',0.71],['PIR Assault Inf Bn (dismounted)',0.48],['PIR Tank Bn (31xT-72M1R/T-90A)',0.69],
  ['FPV Strike Coy (80 sorties/day)',0.15],['RED UAS Coy (Orlan-10/Lancet-3)',0.15],['Custom F.E.',0]]}
];
const FR_BASIS = {
 'PIR Mech Aslt Bn (YPR-765/BMP-1)':'= Infantry Bn (M113) — YPR-765 is an M113 derivative',
 'PIR Assault Inf Bn (dismounted)':'= Infantry Bn (Light) — no organic IFV',
 'PIR Tank Bn (31xT-72M1R/T-90A)':'= Tank Bn (TR 31xT64 / T72)',
 'FPV Strike Coy (80 sorties/day)':'PLANNING FACTOR — not in ST 100-3',
 'RED UAS Coy (Orlan-10/Lancet-3)':'PLANNING FACTOR — not in ST 100-3',
 'Custom F.E.':'Enter the value manually'
};
const MISSIONS = ['Meeting Engagement','Hasty Attack','Deliberate Attack','Hasty Defense','Deliberate Defense'];
/* Damage Table (BCTP brief 9/6/95, slide 47). Breakpoints F:E = .25 .33 .5 1 2 3 4 ; pairs [friendly loss, enemy loss] */
const DMG_BP = [0.25,0.33,0.5,1,2,3,4];
const DMG = {
 'Deliberate Attack vs Deliberate Defense':[0.6,0.1,0.3,0.15,0.2,0.2,0.4,0.15,0.2,0.2,0.15,0.3,0.1,0.6],
 'Deliberate Attack vs Hasty Defense':[0.85,0.05,0.6,0.05,0.5,0.1,0.25,0.25,0.1,0.5,0.05,0.6,0.05,0.85],
 'Deliberate Defense vs Deliberate Attack':[0.6,0.1,0.3,0.15,0.2,0.2,0.15,0.4,0.1,0.65,0.1,0.3,0.1,0.6],
 'Deliberate Defense vs Hasty Attack':[0.5,0.2,0.4,0.25,0.3,0.25,0.25,0.5,0.1,0.5,0.1,0.35,0.2,0.5],
 'Hasty Attack vs Deliberate Defense':[0.5,0.2,0.35,0.1,0.5,0.1,0.5,0.25,0.25,0.3,0.25,0.4,0.2,0.5],
 'Hasty Attack vs Hasty Defense':[0.6,0.1,0.4,0.1,0.3,0.15,0.15,0.15,0.15,0.3,0.1,0.5,0.1,0.6],
 'Hasty Defense vs Deliberate Attack':[0.85,0.05,0.6,0.05,0.5,0.1,0.25,0.25,0.1,0.5,0.15,0.5,0.05,0.85],
 'Hasty Defense vs Hasty Attack':[0.6,0.1,0.5,0.1,0.3,0.15,0.15,0.15,0.15,0.3,0.1,0.4,0.1,0.6],
 'Meeting Engagement vs Meeting Engagement':[0.85,0.5,0.6,0.1,0.35,0.15,0.1,0.1,0.15,0.35,0.1,0.6,0.5,0.85]
};
const HIST_RATIOS = [
 ['Delay','1 : 6',''],['Defend','1 : 3','Prepared or fortified'],['Defend','1 : 2.5','Hasty'],
 ['Attack','3 : 1','Prepared or fortified'],['Attack','2.5 : 1','Hasty'],['Counterattack','1 : 1','Flank']];

const PLAN_M = {
  'Delay': { need: 1 / 6 }, 'Defend (prepared / fortified)': { need: 1 / 3 }, 'Defend (hasty)': { need: 1 / 2.5 },
  'Attack (prepared / fortified)': { need: 3 }, 'Attack (hasty)': { need: 2.5 }, 'Counterattack (flank)': { need: 1 }
};

const TYPES = [['infantry','Infantry / Assault'],['mech','Mechanised infantry'],['motorized','Motorised / wheeled infantry'],['armor','Armour / Tank'],['recon','Reconnaissance'],['artillery','Field artillery'],['mlrs','Rocket artillery (MLRS)'],['mortar','Mortar'],['antitank','Anti-tank'],['airdefence','Air defence'],['engineer','Engineer'],['uas','Unmanned aircraft (UAS / FPV)'],['ew','Electronic warfare'],['signal','Signal'],['hq','Headquarters / C2'],['supply','Supply / CSS'],['maint','Maintenance'],['medical','Medical'],['transport','Transport'],['cbrn','CBRN'],['mp','Military police'],['amphibious','Amphibious / Marine infantry']];
const ECHO = ['team','squad','section','platoon','company','battalion','regiment','brigade','division','corps','army'];
const ECHL = {team:'Team',squad:'Squad',section:'Section',platoon:'Platoon',company:'Company / Battery',battalion:'Battalion',regiment:'Regiment / Group',brigade:'Brigade',division:'Division',corps:'Corps',army:'Army'};
const ECHM = {team:'Ø',squad:'●',section:'●●',platoon:'●●●',company:'I',battalion:'II',regiment:'III',brigade:'X',division:'XX',corps:'XXX',army:'XXXX'};
const MKEYS = ['critical','belt','box','avenue'];
const RESULTS = ['DECISIVE SUCCESS','SUCCESS','PARTIAL SUCCESS','NEUTRAL','FAILURE','DECISIVE FAILURE'];
const RSCORE = {'DECISIVE SUCCESS':2,'SUCCESS':1,'PARTIAL SUCCESS':0.5,'NEUTRAL':0,'FAILURE':-1,'DECISIVE FAILURE':-2};
const ADJ = {
  equal: [['1–2','DECISIVE FAILURE','No effect on target; weapon malfunction; position detected.'],['3–4','FAILURE','Missed target; no effect on the enemy.'],['5–6','NEUTRAL','Minor damage or loss; situation unchanged.'],['7–8','PARTIAL SUCCESS','Moderate damage or losses inflicted.'],['9–10','SUCCESS','Heavy damage or losses inflicted; position remains undetected.']],
  weighted: [['1–3','DECISIVE FAILURE','Losses taken by the acting side; no loss to target.'],['4–7','FAILURE','Missed target; no effect.'],['8','NEUTRAL','Inconclusive exchange (8 is not assigned in the source tool).'],['9–10','PARTIAL SUCCESS','Moderate damage or losses inflicted.']]
};
const CONTEST = {
  'equal':    ['Equal contest', 10, 10],
  'b-unequal':['Blue advantage — unequal', 10, 8],
  'b-signif': ['Blue advantage — significant', 10, 6],
  'r-unequal':['Red advantage — unequal', 8, 10],
  'r-signif': ['Red advantage — significant', 6, 10]
};

/* ---------- símbolo APP-6 (de wargaming_nato v2, ampliado con anfibio) ---------- */
function sym(u, w){
  w = w || 40; const h = Math.round(w * 1.0);
  const hos = u.side === 'R';
  const fillc = hos ? '#FF8080' : '#80E0FF';
  const frame = hos ? `<polygon points="30,12 58,36 30,60 2,36" fill="${fillc}" stroke="#000" stroke-width="2"/>`
                    : `<rect x="5" y="20" width="50" height="32" fill="${fillc}" stroke="#000" stroke-width="2"/>`;
  const b = hos ? {x1:16,y1:26,x2:44,y2:46} : {x1:5,y1:20,x2:55,y2:52};
  const cx = 30, cy = 36, W = b.x2 - b.x1, H = b.y2 - b.y1;
  const L = (a,c,d,e) => `<line x1="${a}" y1="${c}" x2="${d}" y2="${e}"/>`;
  const X = hos ? L(b.x1+3,b.y1+3,b.x2-3,b.y2-3) + L(b.x1+3,b.y2-3,b.x2-3,b.y1+3) : L(b.x1,b.y1,b.x2,b.y2) + L(b.x1,b.y2,b.x2,b.y1);
  const T = (t, s) => `<text x="${cx}" y="${cy + (s||9)/3}" text-anchor="middle" font-size="${s||9}" font-weight="800" fill="#000" stroke="none">${t}</text>`;
  const I = {
    infantry: X,
    mech: X + `<ellipse cx="${cx}" cy="${cy}" rx="${W*0.3}" ry="${H*0.27}" fill="${fillc}"/>`,
    motorized: X + L(cx, b.y1 + (hos?2:0), cx, b.y2 - (hos?2:0)),
    armor: `<ellipse cx="${cx}" cy="${cy}" rx="${W*0.34}" ry="${H*0.3}"/>`,
    recon: hos ? L(b.x1+3,b.y2-3,b.x2-3,b.y1+3) : L(b.x1,b.y2,b.x2,b.y1),
    artillery: `<circle cx="${cx}" cy="${cy}" r="${H*0.17}" fill="#000"/>`,
    mlrs: `<circle cx="${cx}" cy="${cy+3}" r="${H*0.14}" fill="#000"/><polyline points="${cx-7},${cy-3} ${cx},${cy-9} ${cx+7},${cy-3}"/>`,
    mortar: `<circle cx="${cx}" cy="${cy+6}" r="3"/>` + L(cx, cy+3, cx, cy-8) + `<polyline points="${cx-4},${cy-4} ${cx},${cy-9} ${cx+4},${cy-4}"/>`,
    antitank: `<polyline points="${b.x1+(hos?5:2)},${b.y2-(hos?2:0)} ${cx},${b.y1+(hos?2:2)} ${b.x2-(hos?5:2)},${b.y2-(hos?2:0)}"/>`,
    airdefence: `<path d="M${b.x1+4} ${b.y2-(hos?1:0)} Q ${cx} ${b.y1+(hos?-4:0)} ${b.x2-4} ${b.y2-(hos?1:0)}"/>`,
    engineer: `<path d="M${cx-11} ${cy+5} V${cy-4} H${cx+11} V${cy+5} M${cx} ${cy-4} V${cy+5}"/>`,
    uas: `<polyline points="${cx-12},${cy-5} ${cx},${cy+3} ${cx+12},${cy-5}"/><polyline points="${cx-6},${cy-5} ${cx},${cy-1} ${cx+6},${cy-5}"/>`,
    ew: T('EW', 10),
    signal: `<polyline points="${b.x1+(hos?4:6)},${b.y1+(hos?4:3)} ${cx-2},${cy+3} ${cx+2},${cy-3} ${b.x2-(hos?4:6)},${b.y2-(hos?4:3)}"/>`,
    hq: T('HQ', 10),
    supply: L(b.x1 + (hos?4:0), b.y2 - (hos?5:7), b.x2 - (hos?4:0), b.y2 - (hos?5:7)),
    maint: `<path d="M${cx-10} ${cy} H${cx+10} M${cx-10} ${cy-4} A4 4 0 0 0 ${cx-10} ${cy+4} M${cx+10} ${cy-4} A4 4 0 0 1 ${cx+10} ${cy+4}"/>`,
    medical: L(cx, cy-8, cx, cy+8) + L(cx-8, cy, cx+8, cy),
    transport: `<circle cx="${cx}" cy="${cy}" r="7"/>` + L(cx-7,cy,cx+7,cy) + L(cx,cy-7,cx,cy+7),
    cbrn: T('CBRN', 7.5),
    mp: T('MP', 10),
    amphibious: X + `<path d="M${cx-12} ${b.y2-(hos?6:5)} q4 -4 8 0 t8 0 t8 0" />`
  };
  const ech = ECHM[u.ech] || '';
  return `<svg class="sym" width="${w}" height="${h}" viewBox="0 0 60 62" aria-hidden="true">${frame}<g stroke="#000" stroke-width="2" fill="none">${I[u.type] || ''}</g><text x="30" y="${hos ? 10 : 16}" text-anchor="middle" font-size="${ech.length > 2 ? 8 : 10}" font-weight="800" fill="#000">${ech}</text></svg>`;
}

const FRMAP = {}; FR_CAT.forEach(g => g.items.forEach(i => { FRMAP[i[0]] = i[1]; }));

global.WGCat = { FR_CAT, FR_BASIS, FRMAP, MISSIONS, DMG_BP, DMG, HIST_RATIOS, PLAN_M, TYPES, ECHO, ECHL, ECHM, MKEYS, RESULTS, RSCORE, ADJ, CONTEST, sym };
})(typeof window !== 'undefined' ? window : globalThis);
