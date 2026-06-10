// Regressie: een wallet-only exchange (Hyperliquid) moet als bron-optie verschijnen in de
// trade-form account/exchange-selector. Bug (Denny 2026-06-09): de selector voegde alleen
// exchanges met een apiKey toe → Hyperliquid (walletAddress, géén apiKey) toonde "Handmatig".
// Fix v12.230: gate op apiKey || walletAddress.
//
// Run: npx playwright test tests/walletonly-source.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const trade = { id: 'hl1', source: 'hyperliquid', pair: 'BTC/USDC', direction: 'short',
  entry: '62826', exit: '62375', positionSize: '10.68', positionSizeAsset: '0.00017',
  pnl: '0.07', fees: '0', status: 'closed', date: '2026-06-07', time: '11:00',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], links: [], layers: [] };

test('wallet-only exchange (Hyperliquid) verschijnt als bron in trade-form', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Vang de publieke HL info-endpoint af met een lege respons (geen echte netwerk-call, geen rejection).
  await page.route('**/api.hyperliquid.xyz/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(seedLocalStorage, {
    trades: [trade],
    config: { defaultQuote: 'USDC', theme: 'sync', exchanges: { hyperliquid: { walletAddress: '0x' + '1'.repeat(40) } } },
  });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15_000 });

  // Open het trade-formulier via "+ Trade" (sourceOptions wordt uit config.exchanges gebouwd,
  // onafhankelijk van de specifieke trade — dus de nieuwe-trade-form test dezelfde logica).
  await page.evaluate(() => { const btn = [...document.querySelectorAll('button')].find(b => /\+\s*Trade/.test(b.textContent)); btn && btn.click(); });
  await page.waitForFunction(() => /ACCOUNT\s*\/\s*EXCHANGE/i.test(document.body.innerText), { timeout: 10_000 });

  expect(errors, 'geen JS-errors').toHaveLength(0);

  // De account/exchange-selector moet een "Hyperliquid"-knop bevatten (niet alleen Handmatig).
  const info = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean);
    return {
      hasHyperliquidBtn: btns.some(t => /^Hyperliquid$/.test(t)),
      hasHandmatigBtn: btns.some(t => /Handmatig/.test(t)),
      shortBtns: btns.filter(t => t.length < 24),
    };
  });
  console.log('source-opties:', JSON.stringify(info.shortBtns));
  expect(info.hasHandmatigBtn, 'selector moet renderen (Handmatig aanwezig)').toBe(true);
  expect(info.hasHyperliquidBtn, 'Hyperliquid moet als bron-optie staan, niet alleen Handmatig').toBe(true);
});
