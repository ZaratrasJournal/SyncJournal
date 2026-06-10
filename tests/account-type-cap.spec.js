// Cap-beleid: hyperliquid/ftmo/manual mogen meerdere; mexc/blofin/kraken max 1 (voorlopig).
// In de toevoeg-dropdown is een al-toegevoegde gecapte exchange 'disabled — al toegevoegd'.
// Run: npx playwright test tests/account-type-cap.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');
const URL = 'file:///' + path.resolve(__dirname, '../work/tradejournal.html').replace(/\\/g, '/');

test('gecapte exchange (MEXC) disabled in dropdown; multi-types blijven beschikbaar', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api.hyperliquid.xyz/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(seedLocalStorage, {
    config: { defaultQuote: 'USDT', theme: 'sync', exchanges: {}, accountsSchema: 2 },
    accounts: [
      { id: 'm1', type: 'mexc', label: 'MEXC main', apiKey: 'k', apiSecret: 's', transactions: [] },
      { id: 'h1', type: 'hyperliquid', label: 'HL main', walletAddress: '0x' + '1'.repeat(40), transactions: [] },
    ],
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });
  await page.evaluate(() => { const t = [...document.querySelectorAll('.tj-tab')].find(x => /Instellingen/.test(x.textContent)); t && t.click(); });
  await page.waitForFunction(() => /\+\s*Account toevoegen/.test(document.body.innerText), { timeout: 10_000 });
  // open de toevoeg-modal
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /\+\s*Account toevoegen/.test(x.textContent)); b && b.click(); });
  await page.waitForFunction(() => [...document.querySelectorAll('select option')].some(o => o.value === 'mexc'), { timeout: 5000 });

  const opts = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'mexc'));
    return [...sel.options].reduce((m, o) => (m[o.value] = o.disabled, m), {});
  });
  expect(errors).toHaveLength(0);
  // MEXC al aanwezig → disabled (hard-cap 1)
  expect(opts.mexc, 'MEXC disabled (al 1)').toBe(true);
  // Hyperliquid al aanwezig maar multi → blijft beschikbaar
  expect(opts.hyperliquid, 'Hyperliquid blijft beschikbaar (multi)').toBe(false);
  // ftmo/manual altijd beschikbaar; blofin/kraken nog niet aanwezig → beschikbaar
  expect(opts.ftmo).toBe(false);
  expect(opts.manual).toBe(false);
  expect(opts.blofin, 'Blofin nog niet aanwezig → beschikbaar').toBe(false);
});
