// Fase 3 (review/journal-audit): integriteit & edge-cases — datums/tijdzones + import-validatie.
//
// Kernbugs die deze spec vastlegt (allemaal gevonden in de fase-3 audit):
//  1. "Vandaag" werd berekend via new Date().toISOString() = UTC-dag → tussen 00:00 en
//     01:00/02:00 lokale tijd wees alles (EMPTY_TRADE.date, FilterBar-pills, dag-stats)
//     naar GISTEREN.
//  2. Kalendercellen bouwden hun datum-key via new Date(jaar,maand,dag).toISOString()
//     → voor elke tijdzone oost van UTC structureel één dag verschoven (PnL onder het
//     verkeerde dagnummer, "vandaag"-highlight op morgen).
//  3. ts2date (UTC) en ts2time (lokaal) waren een inconsistent paar: een exchange-fill om
//     23:30Z kreeg date=gisteren met time=01:30.
//  4. Backup-import spreidde rommel-items ([1,"x",null]) over EMPTY_TRADE → lege trades.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_PATH = path.resolve(__dirname, '../work/tradejournal.html');
const FILE_URL = 'file:///' + APP_PATH.replace(/\\/g, '/');

// 00:30 lokale tijd (Europe/Amsterdam op deze machine) op 11 juni 2026.
// In UTC is het dan nog 10 juni (22:30Z) — precies het window waarin de oude code faalde.
const MIDNIGHT_LOCAL = new Date(2026, 5, 11, 0, 30, 0);

test('na middernacht: localDateISO = vandaag, EMPTY_TRADE/kalender/ts2date consistent', async ({ page }) => {
  await page.clock.install({ time: MIDNIGHT_LOCAL });
  await page.addInitScript(() => localStorage.setItem('tj_welcomed', '1'));
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof localDateISO === 'function' && typeof EMPTY_TRADE === 'object', { timeout: 30_000 });

  const r = await page.evaluate(() => ({
    utcToday: new Date().toISOString().split('T')[0],     // de oude (foute) berekening
    localToday: localDateISO(),                            // de nieuwe
    emptyTradeDate: EMPTY_TRADE.date,
    localTime: localTimeHM(),
    // kalendercel "11 juni 2026" — moet key 2026-06-11 dragen (was: 2026-06-10)
    calendarCellKey: localDateISO(new Date(2026, 5, 11)),
    // exchange-fill om 22:30Z = 00:30 lokaal → date en time moeten hetzelfde moment beschrijven
    fillDate: ts2date(Date.UTC(2026, 5, 10, 22, 30)),
    fillTime: ts2time(Date.UTC(2026, 5, 10, 22, 30)),
  }));

  // Sanity dat de klok-mock het bedoelde window raakt: UTC zegt nog "gisteren"
  expect(r.utcToday).toBe('2026-06-10');
  // ...maar alles wat de user ziet moet 11 juni zijn:
  expect(r.localToday).toBe('2026-06-11');
  expect(r.emptyTradeDate).toBe('2026-06-11');
  expect(r.localTime).toBe('00:30');
  expect(r.calendarCellKey).toBe('2026-06-11');
  expect(r.fillDate).toBe('2026-06-11');
  expect(r.fillTime).toBe('00:30');
});

test('sanitizeBackupTrades: filtert rommel, houdt trade-achtige objecten', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tj_welcomed', '1'));
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof sanitizeBackupTrades === 'function', { timeout: 30_000 });
  const r = await page.evaluate(() => {
    const mixed = sanitizeBackupTrades([1, 'x', null, [], { id: 'a' }, { pair: 'BTC/USDT' }, { foo: 'bar' }]);
    const nonArr = sanitizeBackupTrades({ id: 'a' });
    return { kept: mixed.trades.length, skipped: mixed.skipped, nonArrKept: nonArr.trades.length };
  });
  expect(r.kept).toBe(2);       // {id:'a'} + {pair:'BTC/USDT'}; {foo:'bar'} heeft geen trade-veld
  expect(r.skipped).toBe(5);
  expect(r.nonArrKept).toBe(0);
});

test('backup-import met rommel-array: niets geïmporteerd + duidelijke fout', async ({ page }) => {
  // Seed 3 echte trades; daarna een .json met [1,2,3] importeren via Instellingen → backup-input.
  const seedTrades = [1, 2, 3].map(i => ({
    id: 't' + i, date: '2026-06-0' + i, time: '10:00', pair: 'BTC/USDT', direction: 'long',
    entry: '100', exit: '110', positionSize: '1000', pnl: '10', fees: '0', status: 'closed', source: 'manual',
    setupTags: [], confirmationTags: [], timeframeTags: [], emotionTags: [], mistakeTags: [], customTags: [],
    tpLevels: [], layers: [], links: [], screenshots: [], notes: '', rating: 0,
  }));
  await page.addInitScript((trades) => {
    localStorage.setItem('tj_trades', JSON.stringify(trades));
    localStorage.setItem('tj_welcomed', '1');
    localStorage.setItem('tj_config', JSON.stringify({ defaultQuote: 'USDT', exchanges: {}, theme: 'sync', accountsSchema: 2 }));
  }, seedTrades);
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Dashboard/i.test(document.body.innerText), { timeout: 30_000 });
  await page.waitForTimeout(2500); // trades-load + effects settle

  // Backup-input zit op de Accounts/Instellingen-pagina
  await page.evaluate(() => { location.hash = '#/accounts'; });
  await page.waitForTimeout(1200);

  // Garbage-bestand
  const tmp = path.join(os.tmpdir(), 'tj-garbage-backup.json');
  fs.writeFileSync(tmp, JSON.stringify([1, 2, 3, 'niet-een-trade', null]));

  // Het backup-input (display:none) accepteert setInputFiles ook zonder klik
  const input = page.locator('input[type="file"][accept=".json"]').first();
  await input.setInputFiles(tmp);
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => {
    const trades = JSON.parse(localStorage.getItem('tj_trades') || '[]');
    return { n: trades.length, ids: trades.map(t => t.id).sort() };
  });
  expect(after.n).toBe(3);                            // niets bijgekomen
  expect(after.ids).toEqual(['t1', 't2', 't3']);      // en niets vervangen
  fs.unlinkSync(tmp);
});
