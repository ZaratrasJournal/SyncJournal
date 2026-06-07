// Regressie: Dashboard "Account waarde (live)" moet de exchange capital-tracker meetellen.
// Bug (Denny 2026-06-07): een handmatige storting op een EXCHANGE-tracker verscheen wel in
// Settings + TopBar, maar niet in het Dashboard-totaal. Manual-account-storting werkte wel.
// Fix v12.228: Dashboard + TopBar delen nu computeTotalBalance().
//
// Run: npx playwright test tests/dashboard-balance.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// Tracker-only exchange (geen apiKey → geen live fetch) + manueel account.
// Verwacht totaal = $1.000 (mexc tracker) + $2.000 (Reserve) = $3.000,00.
const FIXTURE = {
  // Eén closed trade (pnl 0) zodat het Dashboard de portfolio-header rendert i.p.v. de lege-staat.
  trades: [{ id: 'tr1', source: 'mexc', pair: 'BTC/USDT', direction: 'long', entry: '67000', exit: '67000', positionSize: '100', pnl: '0', fees: '0', status: 'closed', date: '2026-06-02' }],
  config: { defaultQuote: 'USDT', theme: 'sync', exchanges: {
    mexc: { transactions: [{ id: 't1', type: 'deposit', amount: '1000', date: '2026-06-01', note: 'seed' }] }
  }},
  accounts: [
    { id: 'a1', name: 'Reserve', label: '', transactions: [{ id: 't2', type: 'deposit', amount: '2000', date: '2026-06-01', note: 'seed' }] }
  ],
};

test('Dashboard-totaal telt exchange capital-tracker mee', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seedLocalStorage, FIXTURE);
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Account waarde/i.test(document.body.innerText), { timeout: 15_000 });
  await page.waitForTimeout(800); // settle fetchBalances (skip: geen apiKey) + render

  expect(errors, 'Geen JS-errors').toHaveLength(0);

  const body = await page.evaluate(() => document.body.innerText);
  // Totaal: 1000 + 2000 = 3000
  expect(body, 'Dashboard-totaal moet $3.000,00 tonen (tracker + account)').toContain('$3.000,00');
  // Breakdown-regels: exchange-tracker zichtbaar als eigen regel + manueel account
  expect(body, 'mexc-tracker als regel ($1.000,00)').toContain('$1.000,00');
  expect(body, 'Reserve-account als regel ($2.000,00)').toContain('$2.000,00');
});
