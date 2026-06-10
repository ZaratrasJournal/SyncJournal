// Regressie: R:R-analyse mag niet exploderen bij FTMO merged trades.
// Bug (Denny 2026-06-09): master kreeg de getrailde/break-even SL (tightste) → risk≈0 →
// realizedRR 50-86R. Fix v12.230: master krijgt de breedste (initiële) SL + migratie heelt
// bestaande masters. Deze test seedt een master met de FOUTE tighte SL + children met
// gevarieerde SLs, en verifieert dat de migratie 'm heelt → R:R-widget toont een normale R.
//
// Run: npx playwright test tests/merged-rr.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const base = { pair: 'XAU/USD', direction: 'long', source: 'ftmo', leverage: '1', fees: '0',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], links: [], layers: [], rating: 0, screenshot: null, notes: '' };

// 4 children van één long-positie, SL getrailed naar break-even (2480 → 2499.8).
const children = [
  { ...base, id: 'c1', status: 'merged-child', mergedInto: 'm1', entry: '2500', exit: '2510', stopLoss: '2480',   positionSizeAsset: '0.01', positionSize: '', pnl: '10', date: '2026-06-01', time: '10:00' },
  { ...base, id: 'c2', status: 'merged-child', mergedInto: 'm1', entry: '2500', exit: '2515', stopLoss: '2499',   positionSizeAsset: '0.01', positionSize: '', pnl: '15', date: '2026-06-01', time: '10:01' },
  { ...base, id: 'c3', status: 'merged-child', mergedInto: 'm1', entry: '2500', exit: '2520', stopLoss: '2499.5', positionSizeAsset: '0.01', positionSize: '', pnl: '20', date: '2026-06-01', time: '10:02' },
  { ...base, id: 'c4', status: 'merged-child', mergedInto: 'm1', entry: '2500', exit: '2524', stopLoss: '2499.8', positionSizeAsset: '0.01', positionSize: '', pnl: '24', date: '2026-06-01', time: '10:03' },
];
// Master met de FOUTE (tighte) SL die de oude buildMergePreview opsloeg.
const master = { ...base, id: 'm1', status: 'closed', mergedFrom: ['c1','c2','c3','c4'], entry: '2500', exit: '2517.25', stopLoss: '2499.8', positionSizeAsset: '0.04', positionSize: '', pnl: '69', date: '2026-06-01', time: '10:00', setupTags: ['MSB'] };
// Eén normale trade zodat de R:R-widget rendert (vereist ≥2 trades met entry+SL).
const normal = { ...base, id: 'n1', source: 'manual', status: 'closed', entry: '100', exit: '110', stopLoss: '95', positionSizeAsset: '1', positionSize: '100', pnl: '10', date: '2026-06-02', time: '09:00' };

// Leest een trade uit IndexedDB (morani_trades_v1 / store "trades").
async function readTradeSL(page, id) {
  return await page.evaluate((tid) => new Promise((res) => {
    const req = indexedDB.open('morani_trades_v1', 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('trades', 'readonly');
      const g = tx.objectStore('trades').get(tid);
      g.onsuccess = () => res(g.result ? g.result.stopLoss : null);
      g.onerror = () => res(null);
    };
    req.onerror = () => res(null);
  }), id);
}

test('migratie heelt master-SL naar de breedste (initiële) stop', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seedLocalStorage, { trades: [master, ...children, normal], config: { defaultQuote: 'USDT', theme: 'sync', exchanges: {} } });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

  // Wacht tot de migratie de master-SL heeft geheeld (2499.8 → 2480) en naar IDB is weggeschreven.
  await expect.poll(async () => await readTradeSL(page, 'm1'), { timeout: 10_000, message: 'master.stopLoss moet healen naar 2480' })
    .toBe('2480');

  expect(errors, 'geen JS-errors').toHaveLength(0);

  // Sanity: met de geheelde SL is realizedRR = (2517.25-2500)/|2500-2480| = 0.86R (was 86R met SL 2499.8).
  const e = 2500, ex = 2517.25, sl = 2480;
  const realizedRR = (ex - e) / Math.abs(e - sl);
  expect(realizedRR).toBeLessThan(5);
});
