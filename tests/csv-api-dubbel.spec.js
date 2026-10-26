// B3: does the same position count twice when it comes in through a CSV import AND through the API sync?
// The shared import (importTjClosed) dedupes on the source id only, and a CSV row has another id than the
// same trade through the API. Per exchange with an API link, on the synthetic exports of tests/fixtures-csv/
// and an API answer for the same position (the adapter's own network call replaced, its own mapping kept):
//   A. CSV first, then the sync: one row, the API row; notes, labels, screenshots and playbook of the CSV
//      row move with it, and the CSV row does not end up in the bin.
//   B. the sync first, then the CSV: the CSV row for that position is skipped.
// In both the other CSV trades (not in the API answer) stays, and a position that only looks alike (same
// prices and size, opened a day later) is not merged.
// Kraken needs no matching: CSV and API build the same id (see kraken-csv-api.spec.js), and while Kraken is
// linked the CSV import is refused. MEXC (link stopped) and FTMO (CSV only) have no API to double with.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const csv = f => fs.readFileSync(path.join(__dirname, 'fixtures-csv', f), 'utf8');
const ms = s => Date.parse(s);
const DAG = 864e5;

// API answers for the BTC long of each synthetic CSV (Amsterdam is UTC+2 in September). Times differ from
// the CSV by under a second: the API counts milliseconds, the exports whole seconds or minutes.
const blofinRec = (extra) => ({ positionId: '8001', instId: 'BTC-USDT', positionSide: 'net', marginMode: 'cross', leverage: '10',
  createTime: String(ms('2026-09-01T08:00:00.350Z')), updateTime: String(ms('2026-09-01T10:00:00.120Z')),
  openAveragePrice: '60000', closeAveragePrice: '61250', closePositions: '10', maxPositions: '10', realizedPnl: '11.78', fee: '-0.72', ...extra });
const okxRec = (extra) => ({ posId: '5550001', instId: 'BTC-USDT-SWAP', posSide: 'long', mgnMode: 'cross', lever: '10', type: '2',
  cTime: String(ms('2026-09-05T08:00:00.412Z')), uTime: String(ms('2026-09-05T11:00:00.873Z')),
  openAvgPx: '60000', closeAvgPx: '61000', closeTotalPos: '2', openMaxPos: '2', realizedPnl: '19.3', fee: '-0.6', fundingFee: '-0.1', ...extra });
const hlFills = (shift) => [
  ['2026-09-01T08:00:00.123Z', 'B', 'Open Long', '0', 60000, 0.01, 0.27, 0, 101],
  ['2026-09-01T09:30:00.456Z', 'A', 'Close Long', '0.01', 61000, 0.005, 0.14, 5, 102],
  ['2026-09-01T10:00:00.789Z', 'A', 'Close Long', '0.005', 61500, 0.005, 0.14, 7.5, 103],
].map(([t, side, dir, start, px, sz, fee, pnl, n]) => ({ coin: 'BTC', side, dir, startPosition: start, px: String(px), sz: String(sz), fee: String(fee), feeToken: 'USDC',
  closedPnl: String(pnl), time: ms(t) + (shift || 0), tid: 900000 + n + (shift ? 50 : 0), oid: 700000 + n + (shift ? 50 : 0), hash: '0x' + String(n).padStart(64, '0'), crossed: true }));

// the Kraken account log of kraken-accountlog.csv as the API gives it (JSON, milliseconds)
const krUitv = [ // [ISO time, contract, old, new, price, pnl, fee]
  ['2026-09-10T10:00:00.650Z', 'pf_xbtusd', 0, 0.002, 75000, 0, 0.1], ['2026-09-10T11:00:00.120Z', 'pf_xbtusd', 0.002, 0.001, 75500, 0.5, 0.05],
  ['2026-09-10T12:30:00.999Z', 'pf_xbtusd', 0.001, 0, 75600, 0.6, 0.05], ['2026-09-11T08:00:00.300Z', 'pf_ethusd', 0, -0.3, 2500, 0, 0.15],
  ['2026-09-11T09:45:00.050Z', 'pf_ethusd', -0.3, 0, 2450, 15, 0.15]];
let kid = 100, saldo = 1000;
const krLogs = krUitv.flatMap(([date, c, oud, nieuw, px, pnl, fee]) => { const ex = 'exec-' + kid, voor = saldo; saldo += pnl - fee;
  return [{ id: kid++, date, info: 'futures trade', asset: 'usd', contract: c, old_balance: voor, new_balance: saldo, trade_price: px, realized_pnl: pnl, fee, realized_funding: 0, execution: ex, booking_uid: 'c' + kid },
          { id: kid++, date, info: 'futures trade', asset: c, contract: c, old_balance: oud, new_balance: nieuw, new_average_entry_price: nieuw ? (c === 'pf_xbtusd' ? 75000 : 2500) : null, trade_price: px, execution: ex, booking_uid: 'p' + kid }]; });

const CONN = { connected: true, apiKey: 'test-key', apiSecret: 'test-secret', passphrase: 'test-pass', wallet: '0x' + '1'.repeat(40), syncFrom: '2026-08-01' };
const EXCH = {
  blofin: { file: 'blofin-orderhistorie.csv', n: 2, pair: 'BTC/USDT', ander: 'ETH/USDT', api: [blofinRec()], lijkt: [blofinRec({ positionId: '8002', createTime: String(ms('2026-09-01T08:00:00.350Z') + DAG), updateTime: String(ms('2026-09-01T10:00:00.120Z') + DAG) })] },
  okx: { file: 'okx-positiehistorie.csv', n: 3, pair: 'BTC/USDT', ander: 'ETH/USDT', api: [okxRec()], lijkt: [okxRec({ posId: '5550002', cTime: String(ms('2026-09-05T08:00:00.412Z') + DAG), uTime: String(ms('2026-09-05T11:00:00.873Z') + DAG) })] },
  hyperliquid: { file: 'hyperliquid-fills.csv', n: 2, pair: 'BTC/USDC', ander: 'ETH/USDC', api: hlFills(0), lijkt: hlFills(DAG) },
};

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b, { timezoneId: 'Europe/Amsterdam' });
  // Each adapter keeps its own mapping; only its network call is replaced.
  const zetApi = (ex, antwoord) => p.evaluate(([ex, a, conn]) => {
    if (ex === 'blofin') { const ad = ExchangeAPI.blofin; ad._ctvCache = { 'BTC-USDT': 0.001, 'ETH-USDT': 0.1 }; ad._ctvCacheTs = Date.now();
      ad._direct = async (_k, _s, _p, pad) => ({ code: '0', data: /positions-history/.test(pad) ? a : [] }); }
    if (ex === 'hyperliquid') ExchangeAPI.hyperliquid._post = async (q) => q.type === 'userFillsByTime' ? a.filter(f => f.time >= (q.startTime || 0) && f.time <= (q.endTime || Infinity))
      : q.type === 'clearinghouseState' ? { assetPositions: [], marginSummary: { accountValue: '1000' } } : [];
    window.proxyCall = async (q) => q.action === 'trades' && ex === 'okx' ? { trades: a } : q.action === 'account_log' ? { source: 'account_log', logs: a, _logDebug: { afgekapt: false } }
      : q.action === 'open_positions' ? { positions: [] } : q.action === 'test' ? { success: true, balance: '1000' } : {};
  }, [ex, antwoord, CONN]);
  const reset = () => p.evaluate(() => { T = []; TRASH = []; CONNS = {}; persist(); persistTrash(); persistConns(); });
  const koppel = (ex) => p.evaluate(([ex, c]) => { CONNS[ex] = { ...c }; persistConns(); }, [ex, CONN]);
  const sync = (ex) => p.evaluate(async (ex) => syncExchange(ex, { quiet: true }), ex);
  const importeer = (text) => p.evaluate((t) => sjImportCsvText(t, ''), text);
  // your own input on the CSV row of this pair
  const invullen = (pair) => p.evaluate((pair) => { const t = T.find(x => x.pair === pair); Object.assign(t, { notes: 'mijn notitie bij de CSV-rij', tags: ['fomo'],
    screenshots: [{ id: 's1', data: 'data:image/png;base64,iVBORw0KGgo=' }], setup: 'Breakout', rating: 4 }); persist(); }, pair);
  const stand = (ex, pair) => p.evaluate(([ex, pair]) => ({ rows: T.filter(t => t.exchange === ex && t.pair === pair).map(t => ({ src: String(t.srcId || ''), notes: t.notes, tags: t.tags,
    shots: (t.screenshots || []).length, setup: t.setup, rating: t.rating, pnl: t.pnl })), n: T.filter(t => t.exchange === ex).length,
    bak: TRASH.filter(t => /(^|_)csv_/.test(String(t.srcId || ''))).length }), [ex, pair]);
  const isCsv = s => /(^|_)csv_/.test(s);

  for (const [ex, v] of Object.entries(EXCH)) {
    console.log(`─── ${ex}: eerst CSV, dan de API ───`);
    await reset(); ok(`${ex}: CSV geeft ${v.n} trades`, await importeer(csv(v.file)) === v.n);
    await invullen(v.pair); await zetApi(ex, v.api); await koppel(ex); await sync(ex);
    let s = await stand(ex, v.pair);
    ok(`${ex}: dezelfde positie staat één keer in je journal`, s.rows.length === 1, JSON.stringify(s.rows.map(r => r.src)));
    ok(`${ex}: de API-rij wint`, s.rows.length === 1 && !isCsv(s.rows[0].src), s.rows.map(r => r.src).join(' | '));
    const r = s.rows.find(x => !isCsv(x.src)) || {};
    ok(`${ex}: notitie, label, screenshot, playbook en rating gaan mee`, r.notes === 'mijn notitie bij de CSV-rij' && (r.tags || []).includes('fomo') && r.shots === 1 && r.setup === 'Breakout' && r.rating === 4, JSON.stringify(r));
    ok(`${ex}: de CSV-rij zit niet in de prullenbak`, s.bak === 0, 'bak=' + s.bak);
    ok(`${ex}: de andere CSV-trades blijven (${v.n} trades)`, s.n === v.n, 'n=' + s.n);
    ok(`${ex}: dezelfde CSV opnieuw → 0 nieuw`, await importeer(csv(v.file)) === 0 && (await stand(ex, v.pair)).rows.length === 1);

    console.log(`─── ${ex}: eerst de API, dan de CSV ───`);
    await reset(); await zetApi(ex, v.api); await koppel(ex); await sync(ex);
    ok(`${ex}: de sync geeft 1 trade`, (await stand(ex, v.pair)).n === 1);
    const n = await importeer(csv(v.file)); s = await stand(ex, v.pair);
    ok(`${ex}: de CSV voegt alleen de andere trades toe`, n === v.n - 1 && s.n === v.n, 'nieuw=' + n + ' n=' + s.n);
    ok(`${ex}: dezelfde positie één keer, de API-rij`, s.rows.length === 1 && !isCsv(s.rows[0].src), JSON.stringify(s.rows.map(x => x.src)));

    console.log(`─── ${ex}: lijkt erop, maar een dag later ───`);
    await reset(); await importeer(csv(v.file)); await zetApi(ex, v.lijkt); await koppel(ex); await sync(ex);
    s = await stand(ex, v.pair);
    ok(`${ex}: zelfde prijzen en grootte, een dag later geopend → twee trades`, s.rows.length === 2, JSON.stringify(s.rows.map(x => x.src)));
  }

  console.log('─── okx: export in een andere tijdzone ───');
  // the same file with its times in UTC (as an OKX profile set to UTC writes them): two hours earlier than local
  const okxUtc = csv('okx-positiehistorie.csv').replace(/2026-09-0(\d) (\d\d):/g, (_, d, u) => `2026-09-0${d} ${String(+u - 2).padStart(2, '0')}:`);
  await reset(); await importeer(okxUtc); await zetApi('okx', [okxRec()]); await koppel('okx'); await sync('okx');
  ok('okx: tijden in UTC → toch één rij, de API-rij', (await stand('okx', 'BTC/USDT')).rows.map(r => isCsv(r.src)).join() === 'false');
  // opening matches but the closing is an hour later: not the same position
  await reset(); await importeer(csv('okx-positiehistorie.csv')); await zetApi('okx', [okxRec({ uTime: String(ms('2026-09-05T12:00:00.873Z')) })]); await koppel('okx'); await sync('okx');
  ok('okx: opening gelijk, sluiting een uur anders → twee rijen', (await stand('okx', 'BTC/USDT')).rows.length === 2);

  console.log('─── kraken: zelfde id via CSV en API ───');
  await reset(); ok('kraken: CSV geeft 2 trades', await importeer(csv('kraken-accountlog.csv')) === 2);
  await invullen('BTC/USD'); await zetApi('kraken', krLogs); await koppel('kraken'); await sync('kraken');
  let k = await stand('kraken', 'BTC/USD');
  ok('kraken: na de sync nog steeds 2 trades, je notitie staat er', k.n === 2 && k.rows.length === 1 && k.rows[0].notes === 'mijn notitie bij de CSV-rij', JSON.stringify(k));
  await reset(); await zetApi('kraken', krLogs); await koppel('kraken'); await sync('kraken');
  ok('kraken: gekoppeld → CSV-import geweigerd, geen dubbele', await importeer(csv('kraken-accountlog.csv')) === 0 && (await stand('kraken', 'BTC/USD')).n === 2);

  ok('geen JS-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== CSV én API, dubbel? ${pass}/${pass + fail} ===`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
