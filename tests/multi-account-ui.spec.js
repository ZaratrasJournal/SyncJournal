// E2E: meerdere accounts van hetzelfde type toevoegen via de unified AccountsHub-UI.
// Settings → Accounts → "+ Account toevoegen" → type-dropdown + label. FTMO-first.
//
// Run: npx playwright test tests/multi-account-ui.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');
const URL = 'file:///' + path.resolve(__dirname, '../work/tradejournal.html').replace(/\\/g, '/');

async function addAccount(page, label) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /\+\s*Account toevoegen/.test(x.textContent)); b && b.click(); });
  await page.waitForTimeout(200);
  await page.evaluate((lbl) => {
    const inp = [...document.querySelectorAll('input')].find(i => /Challenge 200k/.test(i.placeholder || ''));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, lbl); inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, label);
  await page.waitForTimeout(120);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Account toevoegen'); b && b.click(); });
  await page.waitForTimeout(250);
}

test('twee FTMO-accounts toevoegen via de UI', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(seedLocalStorage, { config: { defaultQuote: 'USDT', theme: 'sync', exchanges: {} }, accounts: [] });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

  await page.evaluate(() => { const t = [...document.querySelectorAll('.tj-tab')].find(x => /Instellingen/.test(x.textContent)); t && t.click(); });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /\+\s*Account toevoegen/.test(b.textContent)), { timeout: 10_000 });

  await addAccount(page, 'Challenge 100k'); // FTMO is default type
  await addAccount(page, 'Funded 50k');

  expect(errors, 'geen JS-errors').toHaveLength(0);

  const accts = await page.evaluate(() => JSON.parse(localStorage.getItem('tj_accounts') || '[]'));
  const ftmo = accts.filter(a => a.type === 'ftmo');
  expect(ftmo.length, 'twee FTMO-accounts').toBe(2);
  expect(ftmo.map(a => a.label).sort(), 'labels').toEqual(['Challenge 100k', 'Funded 50k']);
  // opake, unieke ids
  expect(new Set(ftmo.map(a => a.id)).size, 'unieke account-ids').toBe(2);
  ftmo.forEach(a => expect(a.id, 'opake acc_-id').toMatch(/^acc_/));
});
