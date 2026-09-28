// Samengevoegde trades uit de oude TradeJournal mogen niet dubbel tellen.
//
// De merge-functie (FTMO/MT5-workaround, v12.190) zet op de master `mergedFrom` en geeft de
// kinderen `status: "merged-child"` plus `mergedInto`. In de oude journal hield een helper
// `filterMergedChildren()` die kinderen uit élke lijst en uit de analytics. Bij het overzetten
// naar SyncJournal kwamen de vélden mee maar die helper niet — hij stond alleen nog in de comment
// ernaast — en `migrateOldTrade` laat de status ongemoeid. Gevolg: master én kinderen in beeld,
// terwijl de master hun opgetelde P&L al draagt. Gevonden 28-09-2026 via de suite-doorloop.
const { chromium } = require('playwright');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// Eén master van +300, opgebouwd uit drie kinderen van +100. Zonder filter telt de app 600.
const MASTER = { id: 'm1', pair: 'EUR/USD', setup: 'FTMO', date: '2026-09-20', time: '10:00',
  dir: 'long', status: 'closed', pnl: 300, r: 3, entry: 1.1, exit: 1.2, exchange: 'ftmo',
  mergedFrom: ['c1', 'c2', 'c3'], _mergeSource: 'manual' };
const KIND = (n) => ({ id: 'c' + n, pair: 'EUR/USD', setup: 'FTMO', date: '2026-09-20',
  time: '1' + n + ':00', dir: 'long', status: 'merged-child', pnl: 100, r: 1, entry: 1.1, exit: 1.2,
  exchange: 'ftmo', mergedInto: 'm1', _preMergeStatus: 'closed' });
const LOS = { id: 'x1', pair: 'BTC/USDT', setup: 'Range', date: '2026-09-21', time: '09:00',
  dir: 'short', status: 'closed', pnl: -50, r: -0.5, entry: 60000, exit: 60500, exchange: 'blofin' };

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.setViewportSize({ width: 1500, height: 950 });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  ok('boot zonder JS-fouten', errs.length === 0, errs[0]);

  await p.evaluate((d) => {
    T = [{ ...EMPTY_TRADE, ...d.master },
         { ...EMPTY_TRADE, ...d.k1 }, { ...EMPTY_TRADE, ...d.k2 }, { ...EMPTY_TRADE, ...d.k3 },
         { ...EMPTY_TRADE, ...d.los }];
    persist(); clearGFilter(); setFilter('kind', 'alle'); go('trades');
  }, { master: MASTER, k1: KIND(1), k2: KIND(2), k3: KIND(3), los: LOS });
  await p.waitForTimeout(500);

  const r = await p.evaluate(() => ({
    opslag: T.length,
    inBeeld: FT.length,
    ids: FT.map(t => t.id).sort(),
    netto: FT.reduce((s, t) => s + (+t.pnl || 0), 0),
    kinderenNogInOpslag: T.filter(t => t.status === 'merged-child').length,
  }));

  console.log('─── De kinderen tellen niet mee ───');
  ok('alle vijf blijven in de opslag staan', r.opslag === 5, 'gevonden: ' + r.opslag);
  ok('maar er zijn er twee in beeld: master + losse trade', r.inBeeld === 2, JSON.stringify(r.ids));
  ok('de master zit erbij, de kinderen niet', r.ids.join(',') === 'm1,x1', JSON.stringify(r.ids));
  ok('netto = 300 + -50 = 250, niet 550', r.netto === 250, 'netto: ' + r.netto);
  ok('de kinderen zijn niet weggegooid', r.kinderenNogInOpslag === 3, 'over: ' + r.kinderenNogInOpslag);

  console.log('─── Ook niet via een ander filter of scherm ───');
  const elders = await p.evaluate(() => {
    const uit = {};
    setFilter('kind', 'alle'); uit.alle = FT.length;
    go('dashboard'); uit.dashboardNetto = CLOSED.reduce((s, t) => s + (+t.pnl || 0), 0);
    go('analytics'); uit.analytics = FT.filter(t => t.status === 'merged-child').length;
    go('review'); uit.review = FT.filter(t => t.status === 'merged-child').length;
    return uit;
  });
  ok('dashboard rekent met 250', elders.dashboardNetto === 250, 'netto: ' + elders.dashboardNetto);
  ok('geen merged-child in analytics', elders.analytics === 0);
  ok('geen merged-child in review', elders.review === 0);

  console.log('─── Een gewone trade blijft gewoon staan ───');
  ok('de losse trade is niet geraakt', await p.evaluate(() => FT.some(t => t.id === 'x1')));
  ok('geen nieuwe JS-fouten', errs.length === 0, errs[0]);

  console.log(`\n=== Merged-children: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
