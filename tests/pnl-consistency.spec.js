// Borging voor backlog-item "Trades-pagina toont andere PnL/WR dan Dashboard"
// (pro-trader review 2026-05-02 §2.2: -$11,43/WR 27% vs -€8,37/WR 33,3%).
// Geverifieerd 2026-06-11: na de audit (alle PnL via netPnl, gedeelde aggregaat-helpers)
// tonen beide schermen identieke cijfers in dezelfde valuta. Deze spec houdt dat zo.
//
// Bewuste semantiek (gedocumenteerd):
//  - Trades-header "N trades" = aantal LIJST-rijen (incl. open/partial); Dashboard
//    "N trades" = closed-count. Dat zijn verschillende labels, geen cijfer-bug.
//  - PARTIAL-trades hebben pnl="" en tellen in BEIDE stats niet mee als win/loss;
//    hun realizedPnl verschijnt pas na volledige sluiting in de aggregaten.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { seedLocalStorage } = require('./helpers/seed');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/blofin-partial-state.json'), 'utf8'));

test('Dashboard en Trades-pagina tonen identieke PnL + winrate in dezelfde valuta', async ({ page }) => {
  await page.addInitScript(seedLocalStorage, FIXTURE);
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 30_000 });
  await page.waitForTimeout(3500); // trades-load + partial-detectie settle

  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(1200);
  const dash = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const dashPnl = (dash.match(/NETTO PNL ([−\-+]?\$[−\-+]?[\d.,]+)/i) || [])[1];
  const dashWr = (dash.match(/WINRATE ([\d.,]+)%/i) || [])[1];

  await page.evaluate(() => { location.hash = '#/trades'; });
  await page.waitForTimeout(1500);
  const tr = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const m = tr.match(/\d+ trades\|([−\-+]?\$[−\-+]?[\d.,]+)\|WR: ([\d.,]+)%/);

  expect(dashPnl, 'Dashboard NETTO PNL gevonden').toBeTruthy();
  expect(m, 'Trades-header stat-line gevonden').toBeTruthy();
  // Zelfde valuta-symbool ($) en zelfde bedrag/percentage
  expect(m[1]).toBe(dashPnl);
  expect(m[2]).toBe(dashWr);
});
