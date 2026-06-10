// Regressie: BALANS (top-bar) mag een OPEN positie/order NIET bovenop de live-accountwaarde tellen,
// en top-bar moet exact gelijk zijn aan de Dashboard "Account waarde" (gedeelde computeTotalBalance).
// Sebas 2026-06-10 (v12.229): livebar $30,05 = accountwaarde $15,14 + open order $14,90 (dubbeltelling).
//
// Run: npx playwright test tests/balance-no-open-doublecount.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');
const URL = 'file:///' + path.resolve(__dirname, '../work/tradejournal.html').replace(/\\/g, '/');

const openTrade = { id: 'hl1_open_BTC', source: 'hl1', pair: 'BTC/USDC', direction: 'long', entry: '62100', exit: '', pnl: '', positionSize: '0.00024', status: 'open', date: '2026-06-10', time: '18:30', setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [], links: [], layers: [] };

test('open positie/order telt NIET dubbel; BALANS == Account waarde', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Mock Hyperliquid: accountValue $15,14, geen spot. (Een open order verandert dit niet.)
  await page.route('**/api.hyperliquid.xyz/**', route => {
    const body = route.request().postData() || '';
    if (body.includes('spotClearinghouseState')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balances: [] }) });
    if (body.includes('clearinghouseState')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ marginSummary: { accountValue: '15.14' }, assetPositions: [], withdrawable: '15.14' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.addInitScript(seedLocalStorage, {
    trades: [openTrade], // open positie aanwezig — mag balans niet beïnvloeden
    accounts: [{ id: 'hl1', type: 'hyperliquid', label: 'Main', walletAddress: '0x1111111111111111111111111111111111111111', transactions: [] }],
    config: { defaultQuote: 'USDT', theme: 'sync', exchanges: {}, accountsSchema: 2 },
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Account waarde/i.test(document.body.innerText), { timeout: 15_000 });
  // wacht tot de live-balans is opgehaald (BALANS toont een bedrag, niet meer leeg)
  await page.waitForFunction(() => /BALANS\s*\$1[45]/.test(document.body.innerText.replace(/ /g, ' ')), { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1200);

  expect(errors, 'geen JS-errors').toHaveLength(0);
  const body = await page.evaluate(() => document.body.innerText.replace(/ /g, ' '));
  // BALANS top-bar
  const balMatch = body.match(/BALANS\s*\$([\d.,]+)/);
  // Dashboard "Account waarde (live)"
  const accMatch = body.match(/Account waarde \(live\)[^$]*\$([\d.,]+)/i);
  console.log('BALANS:', balMatch && balMatch[1], '| Account waarde:', accMatch && accMatch[1]);
  expect(balMatch, 'BALANS gevonden').toBeTruthy();
  // geen dubbeltelling: ~15,14 (niet ~30)
  expect(body, 'geen $30 (dubbeltelling open order)').not.toMatch(/BALANS\s*\$30/);
  expect(balMatch[1]).toMatch(/^15[.,]1/);
  // top-bar == dashboard
  if (accMatch) expect(balMatch[1], 'BALANS == Account waarde').toBe(accMatch[1]);
});
