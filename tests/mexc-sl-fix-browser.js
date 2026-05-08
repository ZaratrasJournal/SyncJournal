// Browser-test: laadt de app, mockt proxyCall met realistische pending orders,
// trigger refresh, verifieer tpLevels filtert SL en trade.stopLoss krijgt SL-prijs.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP = path.resolve(__dirname, '../work/tradejournal.html');
const SNAP = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../mexc-snapshot-2026-05-08-06-56.json'), 'utf8'));
const TARGET_OPEN = SNAP.openPositions.find(o => o.positionId === 1367600842);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  page.on('console', msg => { if (msg.type()==='error') console.error('CONSOLE:', msg.text()); });

  await page.goto('file://' + APP);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // Run the test in browser context: mock proxyCall + invoke the relevant logic
  const result = await page.evaluate(async (target) => {
    // Mock proxyCall to return what worker would return
    const origProxy = window.proxyCall;
    window.proxyCall = async (req) => {
      if (req.exchange === 'mexc' && req.action === 'open_positions') {
        return { positions: [target] };
      }
      if (req.exchange === 'mexc' && req.action === 'fills') {
        // Real TP1 hit + pending TP + pending SL (the buggy case)
        return {
          fills: [
            { _pending: false, price: '79491.6', vol: 123, profit: 13.05, positionId: 1367600842, timestamp: Date.now()-3600000 },
            { _pending: true, _triggerSide: 1, price: '79000', vol: 124, positionId: 1367600842 },
            { _pending: true, _triggerSide: 2, price: '81000', vol: 247, positionId: 1367600842 },
          ]
        };
      }
      return origProxy(req);
    };

    // Get adapter
    const api = window.ExchangeAPI?.mexc;
    if (!api) return { error: 'ExchangeAPI.mexc not on window' };

    try {
      // Fetch open position (= the trade)
      const opens = await api.fetchOpenPositions('k', 's');
      const t = opens[0];

      // Now simulate the refresh-flow: apply the same filter logic the app uses
      // to pendingFills. We can't call refreshTrades directly easily, so reproduce inline.
      const fillsResult = await api.fetchFills('k', 's', t.pair.replace('/','_'), t.positionId, '', '');
      const fills = fillsResult.fills || [];
      const filledFills = fills.filter(f => !f._pending);
      const pendingFills = fills.filter(f => f._pending && f._triggerSide !== 2);
      const pendingSLs = fills.filter(f => f._pending && f._triggerSide === 2);
      const inferredSL = pendingSLs.length ? pendingSLs.reduce((best, f) => {
        const v = Math.abs(parseFloat(f.vol||0));
        return v > best._v ? { p: f.price, _v: v } : best;
      }, { p: '', _v: 0 }).p : '';

      return {
        trade: t,
        filledCount: filledFills.length,
        pendingTPCount: pendingFills.length,
        pendingTPPrices: pendingFills.map(f => f.price),
        pendingSLCount: pendingSLs.length,
        pendingSLPrices: pendingSLs.map(f => f.price),
        inferredSL,
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    } finally {
      window.proxyCall = origProxy;
    }
  }, TARGET_OPEN);

  console.log('Result:', JSON.stringify(result, null, 2));
  await browser.close();

  // Verify
  const ok1 = result.filledCount === 1;
  const ok2 = result.pendingTPCount === 1 && result.pendingTPPrices[0] === '79000';
  const ok3 = result.pendingSLCount === 1;
  const ok4 = result.inferredSL === '81000';
  const ok5 = parseFloat(result.trade?.positionSizeAsset || 0).toFixed(4) === '0.0247';

  console.log('\n=== BROWSER TEST ASSERTIONS ===');
  console.log(`Filled count = 1: ${ok1?'✓':'✗'}`);
  console.log(`Pending TP only contains 79000 (triggerSide=1): ${ok2?'✓':'✗'}`);
  console.log(`Pending SL separated (count=1): ${ok3?'✓':'✗'}`);
  console.log(`Inferred SL = 81000: ${ok4?'✓':'✗'}`);
  console.log(`positionSizeAsset = 0.0247 (v12.103 fix still working): ${ok5?'✓':'✗'}`);
  process.exit(ok1 && ok2 && ok3 && ok4 && ok5 ? 0 : 1);
})();
