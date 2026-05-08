// Edge-case test: trade met handmatig ingestelde stopLoss mag NIET overschreven worden
const { chromium } = require('playwright');
const path = require('path');

const APP = path.resolve(__dirname, '../work/tradejournal.html');

const TRADE_WITH_MANUAL_SL = [{
  id: 'mexc_open_x', positionId: 'x', pair: 'BTC/USDT', direction: 'short',
  entry: '80552.7',
  stopLoss: '82000',  // user-entered SL — anders dan de pending order zou suggereren
  manualOverrides: ['stopLoss'],  // expliciete marker
  positionSize: '1989.65', positionSizeAsset: '0.0247',
  status: 'open', source: 'mexc', pnl: '', fees: '0', leverage: '30',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
  rating: 0, screenshot: null, notes: '', links: [], layers: [],
  tpLevels: [
    { id: 'tp_a', price: '79491.6', pct: '50', status: 'hit', actualPrice: '79491.6' },
    // SL-row (looks-like-SL): price > entry voor short
    { id: 'tp_b', price: '81000', pct: '100', status: 'open', actualPrice: '' },
  ],
}];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  await page.addInitScript((trades) => {
    localStorage.setItem('tj_trades', JSON.stringify(trades));
    localStorage.setItem('tj_welcomed', '1');
  }, TRADE_WITH_MANUAL_SL);

  await page.goto('file://' + APP);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
    return trades[0];
  });

  await browser.close();

  console.log('Post-migration:');
  console.log(JSON.stringify({ stopLoss: result?.stopLoss, tpLevels: result?.tpLevels?.length, _slHealed: result?._slHealed }, null, 2));

  const ok1 = result?.stopLoss === '82000'; // bewaard
  const ok2 = (result?.tpLevels || []).length === 1; // SL-row alsnog uit tpLevels gehaald
  const ok3 = result?._slHealed === true; // markeerd

  console.log('\n=== ASSERTIONS ===');
  console.log(`Manual stopLoss "82000" preserved: ${ok1?'✓':'✗'}`);
  console.log(`SL-row removed from tpLevels: ${ok2?'✓':'✗'}`);
  console.log(`_slHealed marker set: ${ok3?'✓':'✗'}`);
  process.exit(ok1 && ok2 && ok3 ? 0 : 1);
})();
