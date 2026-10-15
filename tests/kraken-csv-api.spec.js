// Kraken: CSV import and API sync describe the same position with the same id (Denny 17-10-2026).
// Kraken's CSV export writes times in whole seconds ("2026-04-01 10:00:00"), the API in milliseconds
// ("2026-04-01T10:00:00.650Z"). The id is contract + opening time, so without rounding the same position
// came in twice when a CSV import and an API sync covered the same period. Also: while the API is linked,
// the Kraken CSV import is refused (the account-log already brings everything in).
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const KOP = 'uid,dateTime,account,type,symbol,contract,change,new balance,new average entry price,trade price,mark price,funding rate,realized pnl,fee,realized funding,collateral,conversion spread percentage,liquidation fee,position uid,exchange rate,exchange rate from,conversion fee';
// one execution = a position row (asset = contract) and a cash row (asset = usd), as in Kraken's export
const uitvoeringen = [  // [time UTC, ms in the API, old position, new position, price, pnl, fee]
  ['2026-04-01 10:00:00', 650, 0, 0.002, 75000, 0, 0.1],
  ['2026-04-01 11:00:00', 120, 0.002, 0.001, 75500, 0.5, 0.05],
  ['2026-04-01 12:30:00', 999, 0.001, 0, 75600, 0.6, 0.05],
];
let nr = 0;
const csv = [KOP].concat(uitvoeringen.flatMap(([dt, , oud, nieuw, px, pnl, fee]) => [
  [`p${++nr}`, dt, 'flex', 'futures trade', 'pf_xbtusd', 'pf_xbtusd', (nieuw - oud).toFixed(8), nieuw.toFixed(8), nieuw ? '75000' : '', px, px, '', '', '', '', '', '', '', '', '', '', ''].join(','),
  [`c${++nr}`, dt, 'flex', 'futures trade', 'usd', 'pf_xbtusd', (pnl - fee).toFixed(8), '1000', '', px, px, '', pnl ? pnl : '', fee, '', '', '', '', '', '', '', ''].join(','),
])).join('\n');
let id = 100;
const json = uitvoeringen.flatMap(([dt, ms, oud, nieuw, px, pnl, fee]) => { const date = dt.replace(' ', 'T') + '.' + String(ms).padStart(3, '0') + 'Z', ex = 'exec-' + id;
  return [{ id: id++, date, info: 'futures trade', asset: 'usd', contract: 'pf_xbtusd', old_balance: 1000, new_balance: 1000 + pnl - fee, trade_price: px, realized_pnl: pnl, fee, realized_funding: 0, execution: ex, booking_uid: 'c' + id },
          { id: id++, date, info: 'futures trade', asset: 'pf_xbtusd', contract: 'pf_xbtusd', old_balance: oud, new_balance: nieuw, new_average_entry_price: nieuw ? 75000 : null, trade_price: px, execution: ex, booking_uid: 'p' + id }]; });

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} window.__toasts = []; const o = toast; toast = (m, ...a) => { window.__toasts.push(String(m)); return o(m, ...a); }; });
  const zet = (logs) => p.evaluate((logs) => { window.proxyCall = async (q) => q.action === 'open_positions' ? { positions: [] } : q.action === 'account_log' ? { source: 'account_log', logs, _logDebug: { afgekapt: false } } : {}; }, logs);

  console.log('─── Zelfde id via CSV en API ───');
  const ids = await p.evaluate(([csv, json]) => {
    const k = ExchangeAPI.kraken, lines = csv.split('\n'), kop = lines[0].split(',');
    const rows = lines.slice(1).map(l => { const v = l.split(','), r = {}; kop.forEach((h, i) => r[h] = v[i] || ''); return r; });
    const a = k.levenslopenUitAccountLog(k._logRegelsUitCsv(rows)).trades, j = k.levenslopenUitAccountLog(k._logRegelsUitJson(json)).trades;
    return { csv: a.map(t => t.id), api: j.map(t => t.id), apiOpen: j.map(t => t.openTime) };
  }, [csv, json]);
  ok('één positie via beide routes', ids.csv.length === 1 && ids.api.length === 1, JSON.stringify(ids));
  ok('zelfde id (op hele seconden)', ids.csv[0] === ids.api[0], JSON.stringify(ids));
  ok('de exacte tijd (ms) blijft bewaard voor weergave en sortering', /650$/.test(String(ids.apiOpen[0])), JSON.stringify(ids.apiOpen));

  console.log('─── Eerst CSV, daarna de API-koppeling: geen dubbele trade ───');
  await zet(json);
  const r = await p.evaluate(async (csv) => {
    T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = undefined;
    const n1 = sjImportCsvText(csv, 'kraken');
    const t = T.find(x => x.exchange === 'kraken'); if (t) t.notes = 'csv-notitie'; persist();
    CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    await syncExchange('kraken', { quiet: true });
    return { n1, k: T.filter(x => x.exchange === 'kraken').map(x => ({ src: x.srcId, notes: x.notes || '' })) };
  }, csv);
  ok('CSV-import zonder koppeling werkt (1 trade)', r.n1 >= 1, JSON.stringify(r));
  ok('na de API-sync nog steeds 1 Kraken-trade, met de notitie', r.k.length === 1 && r.k[0].notes === 'csv-notitie', JSON.stringify(r.k));

  console.log('─── Weggegooide CSV-trade komt via de API niet terug ───');
  const weg = await p.evaluate(async (csv) => {
    T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = undefined;
    sjImportCsvText(csv, 'kraken'); trashDelete(T.filter(x => x.exchange === 'kraken').map(x => x.id));
    CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    await syncExchange('kraken', { quiet: true });
    return T.filter(x => x.exchange === 'kraken').length;
  }, csv);
  ok('blijft weg', weg === 0, String(weg));

  console.log('─── CSV-import tegengehouden zolang de API gekoppeld is ───');
  const blok = await p.evaluate((csv) => {
    T = []; TRASH = []; CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 }; window.__toasts = [];
    const n = sjImportCsvText(csv, 'kraken');
    return { n, t: T.length, toast: window.__toasts.join(' | ') };
  }, csv);
  ok('niets geimporteerd', blok.n === 0 && blok.t === 0, JSON.stringify(blok));
  ok('melding legt uit waarom en wat te doen', /gekoppeld/i.test(blok.toast) && /automatisch/i.test(blok.toast), blok.toast);
  const andere = await p.evaluate(() => { T = []; CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's' };
    const hl = 'time,coin,dir,px,sz,ntl,fee,closedPnl\n2026-04-01 10:00:00,BTC,Open Long,75000,0.002,150,0.1,0\n2026-04-01 11:00:00,BTC,Close Long,75500,0.002,151,0.1,1';
    try { return sjImportCsvText(hl, 'hyperliquid'); } catch (e) { return 'fout ' + e.message; } });
  ok('andere CSV-imports (Hyperliquid) niet tegengehouden', typeof andere === 'number' && !/gekoppeld/i.test((await p.evaluate(() => window.__toasts.slice(-1)[0] || ''))), String(andere));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Kraken CSV en API: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
