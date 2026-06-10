// Regressie: master-detail mag NIET crashen bij een manual account (geen ExchangeAPI-adapter).
// Bug 2026-06-10: ExchangeAPI[ex].name met ex="manual" → undefined.name → React-crash.
// Fix: exchange-detail alleen bij ExchangeAPI[ex]; apart manual-detail anders.
//
// Run: npx playwright test tests/multi-account-detail.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');
const URL = 'file:///' + path.resolve(__dirname, '../work/tradejournal.html').replace(/\\/g, '/');
const acc = (id, type, label) => ({ id, type, label, name: label, transactions: [{ id: 't' + id, type: 'deposit', amount: '10000' }] });

test('master-detail crasht niet bij manual/ftmo/hyperliquid accounts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api.hyperliquid.xyz/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  // manual account FIRST → default selectie = manual (de crash-trigger)
  await page.addInitScript(seedLocalStorage, {
    config: { defaultQuote: 'USDT', theme: 'sync', exchanges: {}, accountsSchema: 2 },
    accounts: [acc('a1', 'manual', 'Swing'), acc('a2', 'ftmo', 'Challenge 100k'), acc('a3', 'hyperliquid', 'Main')],
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
  await page.evaluate(() => { const t = [...document.querySelectorAll('.tj-tab')].find(x => /Instellingen/.test(x.textContent)); t && t.click(); });
  await page.waitForFunction(() => /\+\s*Account toevoegen/.test(document.body.innerText), { timeout: 10_000 });
  await page.waitForTimeout(300);

  // klik door alle drie de account-types
  for (const lbl of ['Challenge 100k', 'Main', 'Swing']) {
    await page.evaluate((l) => { const el = [...document.querySelectorAll('div')].find(d => d.textContent.trim().startsWith(l) && d.querySelector('div')); el && el.click(); }, lbl);
    await page.waitForTimeout(250);
  }

  expect(errors, 'geen React-crash bij manual/ftmo/hyperliquid detail').toHaveLength(0);
  // manual-detail toont "Handmatig — geen koppeling"
  const body = await page.evaluate(() => document.body.innerText);
  expect(body).toMatch(/Handmatig — geen koppeling/);
});
