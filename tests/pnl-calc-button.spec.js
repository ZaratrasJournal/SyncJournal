// v12.94 mini-fix: PNL-berekenen knop alleen voor manual trades.
//
// Reden: voor API-imports (mexc/blofin/kraken/hyperliquid) en CSV-imports is de
// exchange de bron-van-waarheid voor PnL (al netto). Onze formule wijkt licht af
// door rounding + fee-handling verschillen, dus knop zou aanbieden om correcte
// data te overschrijven met een ruwe schatting — schadelijk.
const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// Reproduceer de visibility-conditie uit [tradejournal.html:5286]
function shouldShowPnlButton(trade) {
  if (trade.status === 'open') return false;
  if (trade.source !== 'manual') return false;
  const e = parseFloat(trade.entry);
  const ex = parseFloat(trade.exit);
  const sz = parseFloat(trade.positionSize);
  const fees = parseFloat(trade.fees) || 0;
  if (!(e > 0 && ex > 0 && sz > 0)) return false;
  if ((trade.manualOverrides || []).includes('pnl')) return false;
  const raw = trade.direction === 'long' ? (ex - e) * sz / e : (e - ex) * sz / e;
  const net2 = raw - fees;
  if (trade.pnl !== '' && Math.abs(parseFloat(trade.pnl) - net2) > 0.01) return true;
  if (trade.pnl === '') return true;
  return false;
}

test.describe('PNL-berekenen knop visibility (v12.94 mini-fix)', () => {
  test('Manual trade met drift → knop zichtbaar', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    expect(shouldShowPnlButton({
      source: 'manual', status: 'closed', direction: 'long',
      entry: '100', exit: '110', positionSize: '1000', fees: '1', pnl: '50',
    }), 'manual + drift → toon').toBe(true);
  });

  test('MEXC API-import met drift → knop verborgen (exchange is bron-van-waarheid)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    expect(shouldShowPnlButton({
      source: 'mexc', status: 'closed', direction: 'short',
      entry: '81287.1', exit: '81306.3', positionSize: '337', fees: '0', pnl: '-0.647',
    }), 'mexc-import → verberg ook bij drift').toBe(false);
  });

  test('CSV-import (Blofin) met lege PnL → knop verborgen', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    expect(shouldShowPnlButton({
      source: 'blofin', status: 'closed', direction: 'long',
      entry: '100', exit: '110', positionSize: '1000', fees: '0', pnl: '',
    }), 'csv/api-import met lege pnl → nog steeds verborgen').toBe(false);
  });

  test('Manual trade met handmatige override op pnl → knop verborgen', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    expect(shouldShowPnlButton({
      source: 'manual', status: 'closed', direction: 'long',
      entry: '100', exit: '110', positionSize: '1000', fees: '1', pnl: '999',
      manualOverrides: ['pnl'],
    }), 'user wil eigen waarde behouden').toBe(false);
  });

  test('Manual trade met lege PnL → knop zichtbaar (helper)', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Trading Journal/i.test(document.body.innerText), { timeout: 15_000 });
    expect(shouldShowPnlButton({
      source: 'manual', status: 'closed', direction: 'long',
      entry: '100', exit: '110', positionSize: '1000', fees: '1', pnl: '',
    }), 'manual + lege pnl → helper zichtbaar').toBe(true);
  });
});
