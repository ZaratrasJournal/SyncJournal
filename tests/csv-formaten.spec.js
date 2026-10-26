// T1: the CSV import for every supported format, on SYNTHETIC exports in tests/fixtures-csv/ (made-up
// numbers, no account ids or wallets, but the real column names and structure the parsers expect).
// Unlike csv-import.spec.js, which reads the real exports in the gitignored tests/_fixtures/, this one
// always runs, also on CI. Per format: number of trades, exchange, direction, entry/exit, P&L, fees and
// times; reading the same file again adds nothing.
// Times: the journal runs in Europe/Amsterdam (CEST in September, UTC+2). Blofin and Kraken write UTC,
// so 08:00 in the file is 10:00 in the journal; the other formats are taken as written.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const DIR = path.join(__dirname, 'fixtures-csv');
const ms = s => String(Date.parse(s));   // ISO with zone → the ms string the parsers store

// file → expected trades, in the order the journal gets them
const VERWACHT = {
  'blofin-orderhistorie.csv': { ex: 'blofin', trades: [
    { pair: 'BTC/USDT', dir: 'long', entry: 60000, exit: 61250, pnl: 11.78, fees: 0.72, date: '2026-09-01', time: '10:00', qty: 0.01, tps: 2, open: ms('2026-09-01T08:00:00Z'), close: '' },
    { pair: 'ETH/USDT', dir: 'short', entry: 2500, exit: 2450, pnl: 9.4, fees: 0.6, date: '2026-09-02', time: '16:00', qty: 0.2, tps: 1, open: ms('2026-09-02T14:00:00Z'), close: '' }] },
  'okx-positiehistorie.csv': { ex: 'okx', trades: [
    { pair: 'SOL/USDT', dir: 'long', entry: 150, exit: 148, pnl: -20.3, fees: 0.3, date: '2026-09-07', time: '11:00', qty: 10, open: '2026-09-07 11:00:00', close: '2026-09-07 15:00:00' },
    // "Closed position" 3 is in contracts: the size comes from P&L / price move (0.3 ETH)
    { pair: 'ETH/USDT', dir: 'short', entry: 2500, exit: 2450, pnl: 14.6, fees: 0.4, date: '2026-09-06', time: '08:00', qty: 0.3, open: '2026-09-06 08:00:00', close: '2026-09-06 09:30:00' },
    { pair: 'BTC/USDT', dir: 'long', entry: 60000, exit: 61000, pnl: 19.3, fees: 0.7, date: '2026-09-05', time: '10:00', qty: 0.02, open: '2026-09-05 10:00:00', close: '2026-09-05 13:00:00' }] },
  'kraken-accountlog.csv': { ex: 'kraken', trades: [
    { pair: 'BTC/USD', dir: 'long', entry: 75000, exit: 75550, pnl: 0.9, fees: 0.2, date: '2026-09-10', time: '12:00', qty: 0.002, tps: 2, open: ms('2026-09-10T10:00:00Z'), close: ms('2026-09-10T12:30:00Z') },
    { pair: 'ETH/USD', dir: 'short', entry: 2500, exit: 2450, pnl: 14.7, fees: 0.3, date: '2026-09-11', time: '10:00', qty: 0.3, tps: 1, open: ms('2026-09-11T08:00:00Z'), close: ms('2026-09-11T09:45:00Z') }] },
  'hyperliquid-fills.csv': { ex: 'hyperliquid', trades: [
    { pair: 'BTC/USDC', dir: 'long', entry: 60000, exit: 61250, pnl: 11.95, fees: 0.55, date: '2026-09-01', time: '10:00', qty: 0.01, tps: 2, open: ms('2026-09-01T10:00:00+02:00'), close: ms('2026-09-01T12:00:00+02:00') },
    { pair: 'ETH/USDC', dir: 'short', entry: 2500, exit: 2450, pnl: 9.55, fees: 0.45, date: '2026-09-02', time: '16:00', qty: 0.2, tps: 1, open: ms('2026-09-02T16:00:00+02:00'), close: ms('2026-09-02T18:00:00+02:00') }] },
  // the order export only has the closing orders with a P&L: no entry price
  'mexc-futures-orders.csv': { ex: 'mexc', trades: [
    { pair: 'BTC/USDT', dir: 'long', entry: 0, exit: 61000, pnl: 10.5, fees: 0.31, date: '2026-09-03', time: '14:00', qty: 0.01 },
    { pair: 'ETH/USDT', dir: 'short', entry: 0, exit: 2450, pnl: 9.9, fees: 0.1, date: '2026-09-04', time: '12:00', qty: 0.2 }] },
  'mexc-posities.csv': { ex: 'mexc', trades: [
    { pair: 'BTC/USDT', dir: 'long', entry: 60000, exit: 61000, pnl: 9.89, fees: 0.61, date: '2026-09-03', time: '10:00', open: '2026-09-03 10:00:00', close: '2026-09-03 14:00:00' },
    { pair: 'ETH/USDT', dir: 'short', entry: 2500, exit: 2450, pnl: -0.5, fees: 0.2, date: '2026-09-04', time: '09:00', open: '2026-09-04 09:00:00', close: '2026-09-04 12:00:00' }] },
  // MT5 profit is gross: net = profit + swap + commission; the balance row is not a trade
  'ftmo-metrix.csv': { ex: 'ftmo', trades: [
    { pair: 'EUR/USD', dir: 'long', entry: 1.1, exit: 1.105, pnl: 741.3, fees: 8.7, date: '2026-09-08', time: '09:15', qty: 1.5, open: '2026-09-08 09:15:00', close: '2026-09-08 11:45:00' },
    { pair: 'US30', dir: 'short', entry: 42000, exit: 42050, pnl: -27.5, fees: 2.5, date: '2026-09-09', time: '14:00', qty: 0.5, open: '2026-09-09 14:00:00', close: '2026-09-09 15:30:00' }] },
};
const gelijk = (a, b) => Math.abs((+a || 0) - (+b || 0)) < 1e-6;

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam' });
  ok('elk formaat heeft een fixture', Object.keys(VERWACHT).every(f => fs.existsSync(path.join(DIR, f))), Object.keys(VERWACHT).filter(f => !fs.existsSync(path.join(DIR, f))).join(', '));
  for (const [f, v] of Object.entries(VERWACHT)) {
    console.log(`─── ${f} ───`);
    const text = fs.readFileSync(path.join(DIR, f), 'utf8');
    const r = await p.evaluate(t => {
      T = []; TRASH = []; CONNS = {}; persist(); persistTrash(); persistConns();
      const n = sjImportCsvText(t, '');
      const rows = T.map(x => ({ exchange: x.exchange, pair: x.pair, dir: x.dir, entry: x.entry, exit: x.exit, pnl: x.pnl, fees: x.fees, date: x.date, time: x.time,
        qty: x.qtyAsset, open: x.openTime, close: x.closeTime, status: x.status, tps: (x.tps || []).length, srcId: x.srcId }));
      return { n, rows, opnieuw: sjImportCsvText(t, ''), na: T.length };
    }, text);
    ok(`${v.ex}: ${v.trades.length} trades`, r.n === v.trades.length && r.rows.length === v.trades.length, 'n=' + r.n + ' rows=' + r.rows.length);
    ok(`${v.ex}: alle trades op exchange ${v.ex}, gesloten, met een bron-id`, r.rows.every(x => x.exchange === v.ex && x.status === 'closed' && x.srcId), JSON.stringify(r.rows.map(x => [x.exchange, x.status])));
    v.trades.forEach((w, i) => {
      const x = r.rows[i] || {}, naam = `${v.ex} #${i + 1} ${w.pair} ${w.dir}`;
      ok(`${naam}: pair en richting`, x.pair === w.pair && x.dir === w.dir, x.pair + ' ' + x.dir);
      ok(`${naam}: entry ${w.entry} / exit ${w.exit}`, gelijk(x.entry, w.entry) && gelijk(x.exit, w.exit), x.entry + ' / ' + x.exit);
      ok(`${naam}: P&L ${w.pnl}, fees ${w.fees}`, gelijk(x.pnl, w.pnl) && gelijk(x.fees, w.fees), x.pnl + ', ' + x.fees);
      ok(`${naam}: geopend ${w.date} ${w.time}`, x.date === w.date && x.time === w.time, x.date + ' ' + x.time);
      if ('qty' in w) ok(`${naam}: hoeveelheid ${w.qty}`, gelijk(x.qty, w.qty), String(x.qty));
      if ('open' in w) ok(`${naam}: open- en sluittijd`, x.open === w.open && x.close === w.close, x.open + ' → ' + x.close);
      if ('tps' in w) ok(`${naam}: ${w.tps} afbouwstap(pen)`, x.tps === w.tps, String(x.tps));
    });
    ok(`${v.ex}: hetzelfde bestand opnieuw → 0 nieuw`, r.opnieuw === 0 && r.na === v.trades.length, 'opnieuw=' + r.opnieuw + ' na=' + r.na);
  }
  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== CSV-formaten: ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
