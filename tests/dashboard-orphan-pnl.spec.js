// Regressie: na een verwijderd account blijven z'n trades (source=dood id) meetellen in het
// Dashboard-totaal, maar zonder regel → totaal ≠ zichtbare accounts (bug Denny 2026-06-10).
// Fix: toon een "Handmatig / losse trades"-regel voor orphan-PnL zodat totaal == zichtbaar.
//
// Run: npx playwright test tests/dashboard-orphan-pnl.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');
const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const tr = (id, source, pnl) => ({ id, source, pair: 'BTC/USDT', direction: 'long', entry: '100', exit: '110', pnl, fees: '0', status: 'closed', date: '2026-06-02', time: '10:00', setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], links: [], layers: [] });

test('orphan-trades (verwijderd account) tonen als losse regel → totaal klopt', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seedLocalStorage, {
    trades: [tr('t1', 'acc_live', '100'), tr('t2', 'acc_deleted', '50')], // t2 = orphan (account weg)
    accounts: [{ id: 'acc_live', type: 'manual', label: 'Scalp', name: 'Scalp', transactions: [{ id: 'd1', type: 'deposit', amount: '1000' }] }],
    config: { defaultQuote: 'USDT', theme: 'sync', exchanges: {}, accountsSchema: 2 },
  });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Account waarde/i.test(document.body.innerText), { timeout: 15_000 });
  await page.waitForTimeout(500);

  expect(errors, 'geen JS-errors').toHaveLength(0);
  const body = await page.evaluate(() => document.body.innerText);
  // Scalp: 1000 cap + 100 pnl = 1100 ; orphan t2 = 50 ; totaal = 1150
  expect(body, 'totaal $1.150,00').toContain('$1.150,00');
  expect(body, 'Scalp-regel $1.100,00').toContain('$1.100,00');
  expect(body, 'orphan-regel zichtbaar').toMatch(/Handmatig \/ losse trades/);
  expect(body, 'orphan-bedrag $50,00').toContain('$50,00');
});
