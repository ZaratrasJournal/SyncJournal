// v12.234: Trades-tabel paginatie (variant A uit demos/trades-paginatie-demo.html).
// Rendert 100 rijen per pagina; zoeken/filteren/stats blijven over de volledige set.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

const mkTrades = (n) => Array.from({ length: n }, (_, i) => ({
  id: 't' + i, date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
  time: '10:00', pair: i % 3 === 0 ? 'ETH/USDT' : 'BTC/USDT', direction: i % 2 ? 'short' : 'long',
  entry: '100', exit: '110', stopLoss: '95', positionSize: '1000', pnl: i % 2 ? '-5' : '10', fees: '0',
  status: 'closed', source: 'manual',
  setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
  tpLevels: [], layers: [], links: [], screenshots: [], notes: '', rating: 0,
}));

test('paginatie: 100 rijen initieel, Toon meer +100, Toon alles, zoeken reset + filtert alles', async ({ page }) => {
  await page.addInitScript(seedLocalStorage, {
    trades: mkTrades(250),
    config: { defaultQuote: 'USDT', exchanges: {}, theme: 'sync', accountsSchema: 2 },
  });
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 30_000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { location.hash = '#/trades'; });
  await page.waitForTimeout(1500);

  // Alleen de trades-tabel tellen (herkenbaar aan de R-mult kolomheader) — andere
  // widgets kunnen ook tables met tbody-rijen hebben.
  // Telt alleen echte trade-rijen — de app voegt uitklapbare .trade-detail-row's toe.
  const rowCount = () => page.evaluate(() => {
    const tbl = [...document.querySelectorAll('table')].find(t => /R-mult/i.test(t.querySelector('thead')?.innerText || ''));
    return tbl ? tbl.querySelectorAll('tbody tr:not(.trade-detail-row)').length : -1;
  });

  // Initieel: 100 rijen, stats over ALLE 250
  expect(await rowCount()).toBe(100);
  let body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  expect(body).toContain('250 trades');           // header stat-line telt alles
  expect(body).toContain('100 getoond');
  expect(body).toMatch(/Toon meer \(100 van 150 resterend\)/);

  // Toon meer → 200
  await page.getByText(/^Toon meer/).click();
  await page.waitForTimeout(400);
  expect(await rowCount()).toBe(200);

  // Toon alles → 250, knoppen weg
  await page.getByText(/^Toon alles/).click();
  await page.waitForTimeout(600);
  expect(await rowCount()).toBe(250);
  body = await page.evaluate(() => document.body.innerText);
  expect(body).not.toMatch(/Toon meer/);

  // Zoeken: filtert over de VOLLEDIGE set (84 ETH-trades) en reset naar pagina 1
  await page.fill('input.search-bar', 'ETH');
  await page.waitForTimeout(600);
  body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  expect(body).toMatch(/84 van 250 trades/);
  expect(await rowCount()).toBe(84); // < PAGE_SIZE → alles zichtbaar, geen knop
});
