// Regressietest voor React error #310 in TradeList (v12.236).
// Bug: de paginatie-`useEffect` (v12.234) stond NA de early-return `if(!trades.length)`,
// waardoor het hook-aantal verschilde tussen lege en gevulde trades-state → "Rendered
// more hooks than during the previous render" (gemeld via Discord 2026-06-18, na uren
// inactieve tab). Fix: alle hooks vóór de early-return.
//
// We rijden de ECHTE in-mount overgang aan: gevuld → (datumfilter naar verre toekomst) →
// filteredTrades leeg → TradeList early-return → filter wissen → weer gevuld. Vóór de fix
// gooide die overgang #310/#300; nu mag er GEEN hook-error in de console/als pageerror zijn.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.split(path.sep).join('/');

const mkTrade = (i, pnl) => ({
  id: 'tl_' + i, date: '2026-06-1' + i, time: '10:00', pair: 'BTC/USDT', direction: 'long',
  entry: '60000', exit: '61000', positionSize: '3000', positionSizeAsset: '0.05',
  pnl: String(pnl), fees: '0.5', leverage: '10', source: 'manual', status: 'closed',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
  rating: 0, screenshot: null, notes: '', links: [], layers: [], tpLevels: [],
});

function attachErrorCollector(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}
const hookErrors = errs => errs.filter(e => /error #310|error #300|Rendered (more|fewer) hooks|Minified React error/i.test(e));

async function gotoTrades(page) {
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 15000 });
  await page.locator('.tj-tab', { hasText: 'Trades' }).first().click();
  await page.waitForTimeout(600);
}

test('TradeList rendert gevulde trades-state zonder hook-error', async ({ page }) => {
  const errors = attachErrorCollector(page);
  await page.addInitScript(seedLocalStorage, { trades: [mkTrade(1, 500), mkTrade(2, -200)] });
  await gotoTrades(page);
  await expect(page.getByText('BTC/USDT').first()).toBeVisible();
  expect(hookErrors(errors)).toEqual([]);
});

test('overgang gevuld → leeg → gevuld via datumfilter zonder hook-error #310/#300', async ({ page }) => {
  const errors = attachErrorCollector(page);
  await page.addInitScript(seedLocalStorage, { trades: [mkTrade(1, 500), mkTrade(2, -200), mkTrade(3, 300)] });
  await gotoTrades(page);

  const dateFrom = page.getByLabel('Filter datum vanaf');
  await expect(dateFrom).toBeVisible();

  // gevuld → leeg: filter alles weg (verre toekomst) → filteredTrades=[] → TradeList early-return.
  await dateFrom.fill('2099-01-01');
  await page.waitForTimeout(500);
  await expect(page.getByText(/Geen trades gevonden/i)).toBeVisible();
  expect(hookErrors(errors)).toEqual([]);

  // leeg → gevuld: filter wissen → trades weer zichtbaar.
  await dateFrom.fill('');
  await page.waitForTimeout(500);
  await expect(page.getByText('BTC/USDT').first()).toBeVisible();
  expect(hookErrors(errors)).toEqual([]);
});
