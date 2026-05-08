// v12.105 idempotent test: simulate user-flow waarbij na een eerdere (gefaalde) heal
// een SL-row alsnog opnieuw in tpLevels verschijnt (door refresh-cyclus o.i.d.).
// Verifieer dat de heal bij elke reload weer doet wat 'ie moet doen.
const { chromium } = require('playwright');
const path = require('path');

const APP = path.resolve(__dirname, '../work/tradejournal.html');

// Scenario 1: Trade met SL-as-TP-rij, geen _slHealed marker (vers buggy)
const FRESH_BUGGY = [{
  id: 'mexc_open_1367600842', positionId: '1367600842', pair: 'BTC/USDT', direction: 'short',
  entry: '80552.7', stopLoss: '',
  positionSize: '1989.65', positionSizeAsset: '0.0247',
  status: 'open', source: 'mexc', pnl: '', fees: '0', leverage: '30',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
  rating: 0, screenshot: null, notes: '', links: [], layers: [], manualOverrides: [],
  tpLevels: [
    { id: 'tp_a', price: '79491.6', pct: '33.2', status: 'hit', actualPrice: '79491.6' },
    { id: 'tp_b', price: '81000', pct: '100', status: 'open', actualPrice: '', _pending: true },
  ],
}];

// Scenario 2: Trade met OUDE _slHealed=true marker EN een nieuwe SL-row die alsnog is toegevoegd
// (= simuleert een refresh-cyclus die de SL-row weer terug zette ondanks v12.104 marker).
const POST_HEAL_REINTRODUCED = [{
  id: 'mexc_open_99', positionId: '99', pair: 'BTC/USDT', direction: 'short',
  entry: '80552.7', stopLoss: '81000', _slHealed: true,
  positionSize: '1989.65', positionSizeAsset: '0.0247',
  status: 'open', source: 'mexc', pnl: '', fees: '0', leverage: '30',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
  rating: 0, screenshot: null, notes: '', links: [], layers: [], manualOverrides: [],
  tpLevels: [
    { id: 'tp_c', price: '79491.6', pct: '33.2', status: 'hit', actualPrice: '79491.6' },
    // SL-row terug toegevoegd na heal — moet OPNIEUW gehealed worden in v12.105
    { id: 'tp_d', price: '81000', pct: '100', status: 'open', actualPrice: '', _pending: true },
  ],
}];

async function runTest(name, seedTrades, expectations) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', err => console.error(`[${name}] PAGE ERROR:`, err.message));

  await page.addInitScript((t) => {
    localStorage.setItem('tj_trades', JSON.stringify(t));
    localStorage.setItem('tj_welcomed', '1');
  }, seedTrades);

  await page.goto('file://' + APP);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
    return trades[0];
  });

  await browser.close();

  console.log(`\n--- ${name} ---`);
  console.log('Post-load state:', JSON.stringify({
    stopLoss: result?.stopLoss,
    tpLevels_count: (result?.tpLevels||[]).length,
    tpLevels_prices: (result?.tpLevels||[]).map(tp => tp.price+(tp.status==='hit'?' (hit)':'')),
    _slHealed: result?._slHealed,
  }, null, 2));

  const passed = Object.entries(expectations).every(([k, v]) => {
    const got = (() => {
      if (k === 'stopLoss') return result?.stopLoss;
      if (k === 'tpCount') return (result?.tpLevels||[]).length;
      if (k === 'noSLinTPs') return (result?.tpLevels||[]).every(tp => parseFloat(tp.price) < 80552.7);
      if (k === 'noMarker') return !result?._slHealed;
    })();
    const ok = got === v;
    console.log(`  ${k}: ${got} ${ok ? '✓' : `✗ (expected ${v})`}`);
    return ok;
  });

  return passed;
}

(async () => {
  const r1 = await runTest('Scenario 1: Fresh buggy', FRESH_BUGGY, {
    stopLoss: '81000', tpCount: 1, noSLinTPs: true, noMarker: true,
  });
  const r2 = await runTest('Scenario 2: Post-heal SL re-introduced (idempotent test)', POST_HEAL_REINTRODUCED, {
    stopLoss: '81000', tpCount: 1, noSLinTPs: true, noMarker: true,
  });

  console.log(`\n=== TOTAL: ${r1 && r2 ? '✓ PASSED' : '✗ FAILED'} ===`);
  process.exit(r1 && r2 ? 0 : 1);
})();
