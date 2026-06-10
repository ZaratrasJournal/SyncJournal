// Verwijder-modal: keuze om trades te behouden ('Handmatig') of óók te verwijderen (definitief).
// Denny 2026-06-10: "helemaal weg als ik het account verwijder, misschien met een warning".
// Run: npx playwright test tests/account-delete-modal.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');
const URL = 'file:///' + path.resolve(__dirname, '../work/tradejournal.html').replace(/\\/g, '/');

const tr = (id, source) => ({ id, source, pair: 'BTC/USDT', direction: 'long', entry: '100', exit: '110', pnl: '10', fees: '0', status: 'closed', date: '2026-06-02', time: '10:00', setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], links: [], layers: [] });
const seed = {
  trades: [tr('d1', 'acc_day'), tr('d2', 'acc_day'), tr('d3', 'acc_day'), tr('k1', 'acc_keep'), tr('k2', 'acc_keep')],
  accounts: [
    { id: 'acc_day', type: 'manual', label: 'Daytrade', name: 'Daytrade', transactions: [{ id: 'x1', type: 'deposit', amount: '5000' }] },
    { id: 'acc_keep', type: 'manual', label: 'Swing', name: 'Swing', transactions: [{ id: 'x2', type: 'deposit', amount: '3000' }] },
  ],
  config: { defaultQuote: 'USDT', theme: 'sync', exchanges: {}, accountsSchema: 2 },
};

async function openDeleteModal(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
  await page.evaluate(() => { const t = [...document.querySelectorAll('.tj-tab')].find(x => /Instellingen/.test(x.textContent)); t && t.click(); });
  await page.waitForFunction(() => /\+\s*Account toevoegen/.test(document.body.innerText), { timeout: 10_000 });
  await page.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => d.textContent.trim().startsWith('Daytrade') && d.querySelector('div')); el && el.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Account verwijderen/.test(x.textContent)); b && b.click(); });
  await page.waitForFunction(() => /gekoppelde trade/.test(document.body.innerText), { timeout: 5000 });
}

test('verwijder-modal: trades óók verwijderen (definitief)', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seedLocalStorage, seed);
  await openDeleteModal(page);
  await page.screenshot({ path: 'tests/screenshots/_del-modal.png' });
  // kies "Trades óók verwijderen" + bevestig
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Trades óók verwijderen/.test(x.textContent)); b && b.click(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Verwijder account \+/.test(x.textContent.trim())); b && b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const t = [...document.querySelectorAll('.tj-tab')].find(x => /Dashboard/.test(x.textContent)); t && t.click(); });
  await page.waitForTimeout(500);
  // 3 acc_day trades weg → 2 over; Daytrade-account weg
  const n = await page.evaluate(() => { const m = document.body.innerText.match(/Gerealiseerde winst[^·]*·\s*(\d+)\s*trade/); return m ? +m[1] : -1; });
  expect(errors).toHaveLength(0);
  expect(n, 'nog 2 trades over (3 verwijderd)').toBe(2);
});

test('verwijder-modal: trades behouden → Handmatig', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seedLocalStorage, seed);
  await openDeleteModal(page);
  // default = behouden; bevestig direct
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Verwijder account$/.test(x.textContent.trim())); b && b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const t = [...document.querySelectorAll('.tj-tab')].find(x => /Dashboard/.test(x.textContent)); t && t.click(); });
  await page.waitForTimeout(500);
  // alle 5 trades blijven; account weg, PnL als "Handmatig / losse trades"
  const n = await page.evaluate(() => { const m = document.body.innerText.match(/Gerealiseerde winst[^·]*·\s*(\d+)\s*trade/); return m ? +m[1] : -1; });
  expect(errors).toHaveLength(0);
  expect(n, 'alle 5 trades blijven').toBe(5);
});
