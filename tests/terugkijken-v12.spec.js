// Migration v12: every connection looks back 30 days once (member Jarne, 25-10-2026).
//
// Before v1.17.1 a reconnect kept the old lastSync, so trades that closed before it never came in. The fix
// (koppel-opnieuw.spec.js) works on the next connect; this one-time step repairs journals that already
// missed trades: it moves lastSync back, so the next sync looks back at least 30 days, but not before the
// "sync from" date. It never moves lastSync forward: an earlier step may have set it further back on purpose.
// Not for a connection with CSV trades of the last 30 days: the import dedupes on the source id only, and a
// CSV row has another id than the same trade through the API, so that would double trades (backlog B3).
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const DAG = 864e5;

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  await p.evaluate(async (DAG) => {
    const nu = Date.now(), gisteren = nu - DAG;
    const tr = (id, ex, srcId, dagen) => ({ ...EMPTY_TRADE, id, exchange: ex, srcId, status: 'closed', kind: 'live', pair: 'BTC/USDT', dir: 'long',
      date: new Date(nu - dagen * DAG).toISOString().slice(0, 10), openTime: String(nu - dagen * DAG), closeTime: String(nu - dagen * DAG + 36e5), entry: 1, exit: 2, pnl: 1 });
    T = [
      tr(1, 'okx', 'okx_open_1_2', 1),                 // API trade: no reason to hold back
      tr(2, 'kraken', 'kraken_csv_abc', 5),            // CSV trade of 5 days ago: Kraken keeps its lastSync
      tr(3, 'blofin', 'blofin_csv_def', 60),           // CSV trade, but older than 30 days: Blofin looks back
    ];
    await persist();
    CONNS = {
      okx: { connected: true, hint: 'a', apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: gisteren },
      kraken: { connected: true, hint: 'b', apiKey: 'k', apiSecret: 's', lastSync: gisteren },
      blofin: { connected: true, hint: 'c', apiKey: 'k', apiSecret: 's', passphrase: 'p', lastSync: gisteren, syncFrom: '2026-09-01' },
      // a "sync from" date 10 days ago: the look-back stops there
      okx_kort: { connected: true, hint: 'd', apiKey: 'k', apiSecret: 's', lastSync: gisteren, syncFrom: new Date(nu - 10 * DAG).toISOString().slice(0, 10) },
      // already set further back by an earlier step (v5, old-journal import): stays
      ver: { connected: true, hint: 'e', apiKey: 'k', apiSecret: 's', lastSync: nu - 90 * DAG },
      hyperliquid: { connected: false, wallet: '0xabc', lastSync: gisteren },
    };
    persistConns();
    DB.save('schema', 11);
  }, DAG);
  await H.reload(p);
  const r = await p.evaluate(() => ({ schema: DB.load('schema', 0), v: SCHEMA_VERSION, c: JSON.parse(JSON.stringify(DB.load('conns', {}))), n: T.length, nu: Date.now() }));
  const rond = (x, y) => Math.abs(x - y) < 5 * 60e3;   // within five minutes (the test itself takes a few seconds)
  const grens = r.nu - 30 * DAG + 36e5;                  // lastSync that makes the sync ask from 30 days back

  ok('het schema staat op de huidige versie (12 of hoger)', r.schema === r.v && r.v >= 12, r.schema + ' / ' + r.v);
  ok('OKX (alleen API-trades): vorige sync 30 dagen teruggezet', r.c.okx && r.c.okx.connected && rond(r.c.okx.lastSync, grens), JSON.stringify(r.c.okx));
  ok('Kraken (CSV-trade van 5 dagen geleden): vorige sync blijft, geen dubbele trades', r.c.kraken && r.c.kraken.lastSync > 0, JSON.stringify(r.c.kraken));
  ok('Blofin (CSV-trade van 60 dagen geleden): ook 30 dagen terug; zijn "sync vanaf" ligt verder terug', r.c.blofin && rond(r.c.blofin.lastSync, grens) && r.c.blofin.syncFrom === '2026-09-01', JSON.stringify(r.c.blofin));
  ok('"sync vanaf" 10 dagen geleden: niet verder terug dan die datum', r.c.okx_kort && rond(r.c.okx_kort.lastSync, +new Date(r.c.okx_kort.syncFrom) + 36e5), JSON.stringify(r.c.okx_kort));
  ok('stond al verder terug (eerdere stap): blijft staan, nooit vooruit', r.c.ver && rond(r.c.ver.lastSync, r.nu - 90 * DAG), JSON.stringify(r.c.ver));
  ok('een losgekoppelde koppeling blijft zoals hij is', r.c.hyperliquid && r.c.hyperliquid.lastSync > 0 && !r.c.hyperliquid.connected);
  ok('de sleutels blijven staan', r.c.okx.apiKey === 'k' && r.c.kraken.apiKey === 'k' && r.c.blofin.apiKey === 'k');
  ok('de trades blijven staan', r.n === 3, String(r.n));

  // the next OKX sync really asks from 30 days back
  const venster = await p.evaluate(async () => {
    let start = null; const ad = ExchangeAPI.okx;
    ad.fetchTrades = async (k, s, pp, st) => { start = st; return []; }; ad.fetchOpenPositions = async () => []; ad.fetchFills = async () => [];
    window.refreshBalance = async () => {}; window.fxSync = async () => {};
    await syncExchange('okx', { quiet: true }); return start;
  });
  const nu = await p.evaluate(() => Date.now());
  ok('de volgende OKX-sync vraagt vanaf 30 dagen terug', venster && Math.abs(venster - (nu - 30 * DAG)) < 2 * 36e5, new Date(venster || 0).toISOString());

  await H.reload(p);
  ok('eenmalig: na nog een keer laden blijft de nieuwe lastSync staan', await p.evaluate(() => +((DB.load('conns', {}).okx || {}).lastSync || 0) > 0));
  ok('geen JS-fouten', errs.length === 0, errs[0]);
  console.log(`\n=== Terugkijken (migratie v12): ${pass}/${pass + fail} ===`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + (e && e.stack || e)); process.exit(1); });
