// v12.110 logic-test voor type-agnostische classifyTrust drempels.
// Repliceert de helper-logica om mock-trades door te rekenen.

// v12.111: trades zonder R-data (geen hindsightExit/pnl) tellen mee voor stage-progressie
// maar NIET voor avgR. Bewezen vereist sample + R-data + edge.
// Input: arrays per type. Elke entry kan een nummer zijn (= R-waarde) of null (= geen R-data).
function classifyTrustSim({real=[],paper=[],backtest=[],missed=[]}) {
  const all = [...real, ...paper, ...backtest, ...missed];
  const total = all.length;
  const withR = all.filter(r => typeof r === 'number' && !isNaN(r));
  const totalAvgR = withR.length > 0 ? withR.reduce((s,r)=>s+r,0) / withR.length : 0;
  const haveEdgeData = withR.length > 0;
  if (total >= 5 && withR.length >= 5 && totalAvgR > 0.3) return { stage: 'Bewezen', total, totalAvgR, haveEdgeData, nWithR: withR.length };
  if (total >= 4) return { stage: 'Tradeable', total, totalAvgR, haveEdgeData, nWithR: withR.length };
  if (total >= 2) return { stage: 'Validated', total, totalAvgR, haveEdgeData, nWithR: withR.length };
  if (total >= 1) return { stage: 'Theorized', total, totalAvgR, haveEdgeData, nWithR: withR.length };
  return { stage: 'Idea', total: 0, totalAvgR: 0, haveEdgeData: false, nWithR: 0 };
}

const tests = [];
const t = (name, fn) => tests.push({ name, fn });

t('Geen trades → Idea', () => {
  const r = classifyTrustSim({});
  if (r.stage !== 'Idea') throw new Error(`stage: ${r.stage}`);
});

t('1 backtest → Theorized', () => {
  const r = classifyTrustSim({ backtest: [1.5] });
  if (r.stage !== 'Theorized') throw new Error(`stage: ${r.stage}`);
});

t('2 trades (mix paper+missed) → Validated', () => {
  const r = classifyTrustSim({ paper: [1.0], missed: [0.5] });
  if (r.stage !== 'Validated') throw new Error(`stage: ${r.stage}`);
});

t('4 backtest → Tradeable', () => {
  const r = classifyTrustSim({ backtest: [1.0,1.5,2.0,0.5] });
  if (r.stage !== 'Tradeable') throw new Error(`stage: ${r.stage} (avgR=${r.totalAvgR.toFixed(2)})`);
});

t('Bewezen: 5 backtest met avgR > 0.3', () => {
  const r = classifyTrustSim({ backtest: [1.0,1.5,2.0,0.5,1.2] });
  if (r.stage !== 'Bewezen') throw new Error(`stage: ${r.stage} (total=${r.total}, avgR=${r.totalAvgR.toFixed(2)})`);
});

t('NIET Bewezen: 5 trades maar avgR < 0.3 → Tradeable', () => {
  const r = classifyTrustSim({ backtest: [0.1,0.2,-0.1,0.0,0.3] });
  // avg = 0.5/5 = 0.1
  if (r.stage !== 'Tradeable') throw new Error(`stage: ${r.stage} (avgR=${r.totalAvgR.toFixed(2)})`);
});

t('Bewezen: mix van real/paper/backtest/missed, totaal 5+ met edge', () => {
  const r = classifyTrustSim({ real: [2.0], paper: [1.5], backtest: [1.0, 0.8], missed: [1.2] });
  if (r.stage !== 'Bewezen') throw new Error(`stage: ${r.stage} (total=${r.total}, avgR=${r.totalAvgR.toFixed(2)})`);
  if (r.total !== 5) throw new Error(`total: ${r.total}`);
});

t("Denny's case: 10 BT met goede avgR → Bewezen", () => {
  const r = classifyTrustSim({ backtest: [1,1,1,1,1,1,1,1,1,1] });
  if (r.stage !== 'Bewezen') throw new Error(`stage: ${r.stage}`);
  if (r.total !== 10) throw new Error(`total: ${r.total}`);
});

t("Denny's case: 10 BT met avgR < 0.3 → Tradeable (sample groot, edge zwak)", () => {
  const r = classifyTrustSim({ backtest: [0.1,0.2,0.0,-0.1,0.3,0.2,0.1,0.0,0.2,0.0] });
  // avg = 1.0/10 = 0.1
  if (r.stage !== 'Tradeable') throw new Error(`stage: ${r.stage} (avgR=${r.totalAvgR.toFixed(2)})`);
});

t('Aggregate avgR werkt over types (weighted)', () => {
  // 2 real bij +2R, 3 backtest bij 0R → avg = (2*2 + 3*0) / 5 = 0.8
  const r = classifyTrustSim({ real: [2,2], backtest: [0,0,0] });
  if (Math.abs(r.totalAvgR - 0.8) > 0.001) throw new Error(`avgR: ${r.totalAvgR}`);
  if (r.stage !== 'Bewezen') throw new Error(`stage: ${r.stage} — moet Bewezen zijn (5 trades, avg 0.8R > 0.3R)`);
});

t("v12.111 — 10 BT trades zonder hindsightExit → Tradeable (count telt, avgR onbekend)", () => {
  // Denny's situatie: 10 BT trades ingevuld, maar geen hindsightExit nog
  const r = classifyTrustSim({ backtest: [null,null,null,null,null,null,null,null,null,null] });
  if (r.stage !== 'Tradeable') throw new Error(`stage: ${r.stage} (total=${r.total})`);
  if (r.total !== 10) throw new Error(`total: ${r.total}`);
  if (r.haveEdgeData) throw new Error('haveEdgeData moet false zijn — geen R-data');
  if (r.nWithR !== 0) throw new Error(`nWithR: ${r.nWithR}`);
});

t('v12.111 — Mix: 8 BT zonder hindsight, 2 met +2R → Tradeable, avg uit subset 2.0R', () => {
  const r = classifyTrustSim({ backtest: [null,null,null,null,null,null,null,null,2,2] });
  if (r.stage !== 'Tradeable') throw new Error(`stage: ${r.stage}`);
  if (r.total !== 10) throw new Error(`total: ${r.total}`);
  if (r.nWithR !== 2) throw new Error(`nWithR: ${r.nWithR}`);
  if (Math.abs(r.totalAvgR - 2.0) > 0.001) throw new Error(`avgR: ${r.totalAvgR}`);
  // Tradeable, niet Bewezen — want avgR is high maar uit zwakke subset (2/10)
});

t('v12.111 — 5 BT zonder hindsight → Tradeable (count = 5, geen edge-data)', () => {
  const r = classifyTrustSim({ backtest: [null,null,null,null,null] });
  if (r.stage !== 'Tradeable') throw new Error(`stage: ${r.stage}`);
  // total = 5 maar haveEdgeData = false → niet Bewezen
});

let passed = 0, failed = 0;
for (const x of tests) {
  try { x.fn(); console.log(`✓ ${x.name}`); passed++; }
  catch (e) { console.error(`✗ ${x.name}: ${e.message}`); failed++; }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
