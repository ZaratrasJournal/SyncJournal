// Reconnecting an exchange starts the sync window fresh (member Jarne, 25-10-2026).
//
// Jarne had OKX connected before and connected again with the key of his sub-account. connectEx kept the
// old connection's lastSync, so the first sync asked only for trades since that old sync: his two closed
// trades of 15 and 20 October never came in, only the open position (fetched without a window). On a
// fresh journal (work.syncjournal.nl) all three came in. The same kept a new "sync from" date unused.
// Now a (re)connect drops lastSync: the first sync goes back 30 days, or to the "sync from" date.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const DAG = 864e5;

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  // A fake OKX: records the window the sync asks for and answers with two closed trades of 10 and 6 days ago.
  await p.evaluate((DAG) => {
    const nu = Date.now();
    window.__vensters = [];
    const ad = ExchangeAPI.okx;
    ad.fetchTrades = async (k, s, pp, startTime) => {
      window.__vensters.push(startTime);
      return [10, 6].map(d => ({ id: 'okx_test_' + d, exchange: 'okx', source: 'okx', status: 'closed', pair: 'BTC/USDC', dir: 'long',
        date: new Date(nu - d * DAG).toISOString().slice(0, 10), time: '10:00', entry: 80000, exit: 81000, pnl: 4, fees: 0.1,
        openTime: String(nu - d * DAG), closeTime: String(nu - d * DAG + 36e5), positionSizeAsset: '0.002' }))
        .filter(t => +t.closeTime >= startTime);
    };
    ad.fetchOpenPositions = async () => [];
    ad.fetchFills = async () => [];
    window.refreshBalance = async () => {}; window.fxSync = async () => {};
    // an earlier connection (another key) that last synced two days ago
    CONNS.okx = { connected: true, hint: 'oude', apiKey: 'oude-sleutel', apiSecret: 'x', passphrase: 'y', lastSync: nu - 2 * DAG };
    persistConns(); T = []; persist();
  }, DAG);
  const koppel = async (sleutel, vanaf) => p.evaluate(async ({ sleutel, vanaf }) => {
    STATE.connOpen = 'okx'; go('instellingen'); setSetTab('accounts');
    const zet = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; return !!el; };
    const velden = zet('ck_okx', sleutel) && zet('cs_okx', 'geheim') && zet('cp_okx', 'pass');
    zet('cf_okx', vanaf || '');
    connectEx('okx');
    for (let i = 0; i < 50 && !window.__vensters.length; i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    return velden;
  }, { sleutel, vanaf });

  console.log('─── Opnieuw koppelen met een andere sleutel ───');
  ok('het koppelformulier is er', await koppel('nieuwe-sleutel'));
  const nu = await p.evaluate(() => Date.now());
  const v1 = await p.evaluate(() => window.__vensters[0]);
  ok('de eerste sync gaat 30 dagen terug, niet vanaf de oude sync', v1 && Math.abs(v1 - (nu - 30 * DAG)) < 2 * 36e5, new Date(v1).toISOString());
  ok('beide gesloten trades komen binnen', await p.evaluate(() => T.filter(t => t.exchange === 'okx' && t.status === 'closed').length) === 2,
    await p.evaluate(() => T.map(t => t.srcId).join()));

  console.log('─── Een gewone sync daarna: alleen sinds de vorige sync ───');
  const vorige = await p.evaluate(() => +CONNS.okx.lastSync);
  await p.evaluate(async () => { window.__vensters = []; await syncExchange('okx', { quiet: true }); });
  const v2 = await p.evaluate(() => window.__vensters[0]);
  ok('vanaf de vorige sync min een uur', vorige > 0 && v2 === vorige - 36e5, new Date(v2 || 0).toISOString());
  ok('geen dubbele trades', await p.evaluate(() => T.filter(t => t.exchange === 'okx').length) === 2);

  console.log('─── Opnieuw koppelen met een "sync vanaf"-datum ───');
  await p.evaluate(() => { window.__vensters = []; });
  await koppel('weer-een-sleutel', '2026-09-01');
  const v3 = await p.evaluate(() => window.__vensters[0]);
  ok('de eerste sync begint bij de gekozen datum', v3 === +new Date('2026-09-01'), new Date(v3 || 0).toISOString());
  ok('nog steeds geen dubbele trades', await p.evaluate(() => T.filter(t => t.exchange === 'okx').length) === 2);

  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Opnieuw koppelen: ${pass}/${pass + fail} ===`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + (e && e.stack || e)); process.exit(1); });
