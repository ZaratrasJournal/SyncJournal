// Hyperliquid CSV in the format of Zaratras' real export, next to a connected wallet (B3, v1.18.1).
// The real export writes the date WITHOUT leading zeros ("8-4-2026 - 08:30:57", the exporter's screen time)
// and prices with many decimals (71358.8152173913). tests/fixtures-csv/hyperliquid-fills.csv only has
// "12-09-2026", so this spec covers the other form:
//   - the row is read (date, time, pair, direction, prices)
//   - CSV then sync, and sync then CSV: one row, the API row, with its stop-loss
//   - nothing counts twice in the P&L
//
// Draai: node tests/hl-csv-zonder-nul.spec.js
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

// April = CEST (UTC+2): screen time 08:30:57 in Amsterdam = 06:30:57 UTC
const ENTRY = 71358.8152173913, EXIT = 72000.5, SZ = 0.0092, FEE_O = 0.2954, FEE_C = 0.2981;
const GROSS = (EXIT - ENTRY) * SZ;
const CSV = ['time,coin,dir,px,sz,ntl,fee,closedPnl',
  `8-4-2026 - 08:30:57,BTC,Open Long,${ENTRY},${SZ},${(ENTRY * SZ).toFixed(2)},${FEE_O},-${FEE_O}`,
  `8-4-2026 - 14:02:11,BTC,Close Long,${EXIT},${SZ},${(EXIT * SZ).toFixed(2)},${FEE_C},${(GROSS - FEE_C).toFixed(6)}`,
  // a second position, single-digit day and month, only in the CSV
  `3-5-2026 - 09:05:00,ETH,Open Short,3100.123456789,0.5,1550.06,0.62,-0.62`,
  `3-5-2026 - 11:40:30,ETH,Close Short,3050.5,0.5,1525.25,0.61,24.20`].join('\n');
const T0 = Date.UTC(2026, 3, 8, 6, 30, 57, 412), T1 = Date.UTC(2026, 3, 8, 12, 2, 11, 87);
const API = [
  { coin: 'BTC', px: String(ENTRY), sz: String(SZ), side: 'B', dir: 'Open Long', startPosition: '0', closedPnl: '0', fee: String(FEE_O), tid: 9101, oid: 9201, time: T0, feeToken: 'USDC' },
  { coin: 'BTC', px: String(EXIT), sz: String(SZ), side: 'A', dir: 'Close Long', startPosition: String(SZ), closedPnl: String(GROSS), fee: String(FEE_C), tid: 9102, oid: 9203, time: T1, feeToken: 'USDC' }];
// the stop-loss bracket, placed 5 s after the entry, cancelled when the position closed by hand
const ORDERS = [{ order: { coin: 'BTC', side: 'A', orderType: 'Stop Market', triggerPx: '70100', sz: String(SZ), origSz: String(SZ), oid: 9202, timestamp: T0 + 5000, isTrigger: true, reduceOnly: true, isPositionTpsl: false }, status: 'canceled', statusTimestamp: T1 }];
const API_PNL = GROSS - FEE_O - FEE_C;

function server([api, orders]) {
  T = []; TRASH = [];
  ExchangeAPI.hyperliquid._post = async body => {
    if (body.type === 'userFillsByTime') return api.filter(f => f.time >= (+body.startTime || 0) && (body.endTime == null || f.time <= +body.endTime));
    if (body.type === 'historicalOrders') return orders;
    if (body.type === 'clearinghouseState') return { marginSummary: { accountValue: '100' }, assetPositions: [] };
    if (body.type === 'spotClearinghouseState') return { balances: [] };
    return [];
  };
  CONNS.hyperliquid = { connected: true, wallet: '0x' + '1'.repeat(40), lastSync: 0, syncFrom: '2026-04-01' };
  persistConns();
}
const rijen = p => p.evaluate(() => T.filter(t => t.exchange === 'hyperliquid').map(t => ({ pair: t.pair, dir: t.dir, date: t.date, time: t.time,
  entry: +t.entry, exit: +t.exit, pnl: +t.pnl, stop: +t.stop || 0, gesynct: isGesynct(t), status: t.status })));
const btc = r => r.filter(x => x.pair === 'BTC/USDC');
const som = r => r.reduce((s, x) => s + x.pnl, 0);

(async () => {
  const b = await chromium.launch(); const alleFouten = [];
  const open = async () => { const o = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam' }); await o.p.evaluate(() => setFilter('kind', 'alle')); return o; };
  const sync = p => p.evaluate(() => syncExchange('hyperliquid', { quiet: true }));
  const csv = p => p.evaluate(t => sjImportCsvText(t, 'hyperliquid'), CSV);

  console.log('─── lezen: datum zonder voorloopnul ───');
  { const { ctx, p, errs } = await open();
    await p.evaluate(() => { T = []; TRASH = []; });
    ok('CSV leest 2 trades in', await csv(p) === 2);
    const r = await rijen(p), x = btc(r)[0] || {}, e = r.find(y => y.pair === 'ETH/USDC') || {};
    ok('8-4-2026 → 2026-04-08, 08:30 (tijd van het scherm)', x.date === '2026-04-08' && x.time === '08:30', JSON.stringify(x));
    ok('3-5-2026 (dag én maand één cijfer) → 2026-05-03, short', e.date === '2026-05-03' && e.dir === 'short', JSON.stringify(e));
    ok('long, instap met alle decimalen, uitstap 72000.5', x.dir === 'long' && Math.abs(x.entry - ENTRY) < 1e-6 && x.exit === EXIT, JSON.stringify(x));
    ok('netto P&L van de CSV = bruto − beide fees', Math.abs(x.pnl - API_PNL) < 1e-3, JSON.stringify(x));
    alleFouten.push(...errs); await ctx.close(); }

  for (const [naam, eerst] of [['CSV na de API', 'api'], ['API na de CSV', 'csv']]) {
    console.log(`─── ${naam} ───`);
    const { ctx, p, errs } = await open();
    await p.evaluate(server, [API, ORDERS]);
    let n;
    if (eerst === 'api') { await sync(p); n = await csv(p); } else { await csv(p); await sync(p); }
    const r = await rijen(p), x = btc(r);
    if (eerst === 'api') ok(`${naam}: de CSV voegt alleen de ETH-positie toe`, n === 1, 'n=' + n);
    ok(`${naam}: de BTC-positie staat er één keer, als rij van de koppeling`, x.length === 1 && x[0].gesynct, JSON.stringify(x));
    ok(`${naam}: de API-rij houdt zijn stop-loss 70.100`, x.length === 1 && x[0].stop === 70100, JSON.stringify(x));
    ok(`${naam}: niets dubbel in de P&L (API-trade + ETH uit de CSV)`, Math.abs(som(r) - (API_PNL + r.filter(y => y.pair === 'ETH/USDC').reduce((s, y) => s + y.pnl, 0))) < 1e-6 && r.length === 2, JSON.stringify(r));
    ok(`${naam}: nog een sync en nog een import veranderen niets`, (await sync(p)) !== -1 && (await csv(p)) === 0 && (await rijen(p)).length === 2);
    alleFouten.push(...errs); await ctx.close();
  }

  ok('geen JS-fouten', alleFouten.length === 0, [...new Set(alleFouten)].slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n=== Hyperliquid-CSV zonder voorloopnul + API: ${pass}/${pass + fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
