// Reproductie: R:R-analyse explodeert bij FTMO merged trades omdat buildMergePreview de SL
// het DICHTST bij entry kiest (Math.max voor long) — terwijl traders na TP1 hun SL naar
// break-even trailen. risk = |entry-SL| wordt dan ~0 → realizedRR = (exit-entry)/risk → 50-80R.
// (bug-melding Denny 2026-06-09, Analytics R:R-widget)
//
// Run: node tests/merged-rr-repro.js

// 4 partial exits van ÉÉN long-positie, entry 2500. SL getrailed naar break-even na TP1.
const children = [
  { direction:'long', entry:'2500', exit:'2510', stopLoss:'2480',   positionSizeAsset:'0.01', positionSize:'', status:'closed', pnl:'10' },
  { direction:'long', entry:'2500', exit:'2515', stopLoss:'2499',   positionSizeAsset:'0.01', positionSize:'', status:'closed', pnl:'15' },
  { direction:'long', entry:'2500', exit:'2520', stopLoss:'2499.5', positionSizeAsset:'0.01', positionSize:'', status:'closed', pnl:'20' },
  { direction:'long', entry:'2500', exit:'2524', stopLoss:'2499.8', positionSizeAsset:'0.01', positionSize:'', status:'closed', pnl:'24' },
];

const effSize = c => parseFloat(c.positionSize) || parseFloat(c.positionSizeAsset) || 0;
const totalSize = children.reduce((s,c)=>s+effSize(c),0);
const wEntry = children.reduce((s,c)=>s+((parseFloat(c.entry)||0)*effSize(c)),0)/totalSize;
const closedChildren = children.filter(c=>c.status==='closed'&&c.exit&&parseFloat(c.exit)>0);
const closedSize = closedChildren.reduce((s,c)=>s+effSize(c),0);
const wExit = closedChildren.reduce((s,c)=>s+((parseFloat(c.exit)||0)*effSize(c)),0)/closedSize;
const dir = children[0].direction;
const sls = children.map(c=>parseFloat(c.stopLoss)).filter(v=>isFinite(v)&&v>0);

// R:R-widget berekening (work/tradejournal.html:12492-12495)
const realizedRR = (sl) => { const risk=Math.abs(wEntry-sl); return (dir==='long'?wExit-wEntry:wEntry-wExit)/risk; };

// OUD: Math.max voor long = SL dichtst bij entry (break-even) → mini-risk
const slOld = dir==='long'?Math.max(...sls):Math.min(...sls);
// NIEUW: initiële/breedste stop = werkelijk genomen risico
const slNew = dir==='long'?Math.min(...sls):Math.max(...sls);

console.log('wEntry =', wEntry, '· wExit =', wExit.toFixed(2));
console.log('OUD  SL =', slOld, '→ risk', Math.abs(wEntry-slOld), '→ realizedRR =', realizedRR(slOld).toFixed(2)+'R');
console.log('NIEUW SL =', slNew, '→ risk', Math.abs(wEntry-slNew), '→ realizedRR =', realizedRR(slNew).toFixed(2)+'R');

let ok = true;
if (realizedRR(slOld) < 20) { console.error('\nFAIL: oude SL-keuze zou een absurde R moeten geven'); ok=false; }
if (realizedRR(slNew) > 5) { console.error('\nFAIL: nieuwe SL-keuze moet een normale R geven'); ok=false; }
if (!ok) process.exit(1);
console.log('\n✅ Bug gereproduceerd: trailing-SL + Math.max → mini-risk → R explodeert. Initiële (breedste) SL herstelt een normale R.');
