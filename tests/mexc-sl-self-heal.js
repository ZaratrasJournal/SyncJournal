// Self-heal test: bestaande trade in localStorage met SL als TP-rij wordt
// auto-gecorrigeerd bij volgende app-load via normalizeTrade.
const { chromium } = require('playwright');
const path = require('path');

const APP = path.resolve(__dirname, '../work/tradejournal.html');

// Buggy trade-state (zoals het er nu in localStorage zou kunnen staan voor Denny)
const BUGGY_TRADES = [
  {
    id: 'mexc_open_1367600842',
    positionId: '1367600842',
    pair: 'BTC/USDT',
    direction: 'short',
    entry: '80552.7',
    stopLoss: '',     // leeg
    positionSize: '1989.65',
    positionSizeAsset: '0.0247',
    status: 'open',
    source: 'mexc',
    pnl: '',
    fees: '0',
    leverage: '30',
    setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
    rating: 0, screenshot: null, notes: '', links: [], layers: [], manualOverrides: [],
    tpLevels: [
      // TP1 (correct): hit fill below entry for short
      { id: 'tp_x_0', price: '79491.6', pct: '50', status: 'hit', actualPrice: '79491.6' },
      // TP2 (BUG: this is the SL at 81000 above entry — should not be a TP)
      { id: 'tp_x_1_pending', price: '81000', pct: '100', status: 'open', actualPrice: '', _pending: true },
    ],
  }
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  await page.addInitScript((trades) => {
    localStorage.setItem('tj_trades', JSON.stringify(trades));
    localStorage.setItem('tj_welcomed', '1');
  }, BUGGY_TRADES);

  await page.goto('file://' + APP);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // give app time to migrate + persist

  // Read the post-migration state from localStorage
  const result = await page.evaluate(() => {
    const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
    return trades[0] || null;
  });

  await browser.close();

  console.log('Post-migration trade:');
  console.log(JSON.stringify({
    stopLoss: result?.stopLoss,
    tpLevels: result?.tpLevels,
    _slHealed: result?._slHealed,
  }, null, 2));

  const ok1 = result?.stopLoss === '81000';
  const ok2 = (result?.tpLevels || []).length === 1;
  const ok3 = (result?.tpLevels || []).every(tp => parseFloat(tp.price) < 80552.7);
  const ok4 = result?._slHealed === true;

  console.log('\n=== SELF-HEAL ASSERTIONS ===');
  console.log(`stopLoss = "81000" (was ""): ${ok1 ? '✓' : '✗'}`);
  console.log(`tpLevels reduced to 1 (was 2): ${ok2 ? '✓' : '✗'}`);
  console.log(`Remaining TPs are below entry (= valid TPs for short): ${ok3 ? '✓' : '✗'}`);
  console.log(`_slHealed marker set: ${ok4 ? '✓' : '✗'}`);
  process.exit(ok1 && ok2 && ok3 && ok4 ? 0 : 1);
})();
