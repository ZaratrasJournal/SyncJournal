// Kraken: one order filled in several executions is one step, not several TPs (member + Denny, 18-10-2026).
// Kraken's account-log has no order id (docs "Get account log": only `execution`). Executions of one order
// carry the exact same timestamp; in Denny's history 417 executions fall on 251 timestamps, never mixing
// buy and sell. Same contract, same millisecond, same side = one step (qty summed, price weighted).
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

let id = 1;
// one execution = a cash row and a position row, as /api/history/v3/account-log returns them
const exec = (date, oud, nieuw, px, pnl = 0, fee = 0.01) => { const ex = 'exec-' + id;
  return [{ id: id++, date, info: 'futures trade', asset: 'usd', contract: 'pf_xbtusd', old_balance: 1000, new_balance: 1000 + pnl - fee, trade_price: px, realized_pnl: pnl, fee, realized_funding: 0, execution: ex, booking_uid: 'c' + id },
          { id: id++, date, info: 'futures trade', asset: 'pf_xbtusd', contract: 'pf_xbtusd', old_balance: oud, new_balance: nieuw, new_average_entry_price: nieuw ? 81489 : null, trade_price: px, execution: ex, booking_uid: 'p' + id }]; };
// Denny's short of 14-10: TP1 (0.0046) filled as 0.0021 + 0.0025 at 13:53:44.001, the rest closed at 15:05:30
const short = [
  ...exec('2026-10-14T18:12:52.768Z', 0, -0.0092, 81489),
  ...exec('2026-10-15T13:53:44.001Z', -0.0092, -0.0071, 80001, 3.12),
  ...exec('2026-10-15T13:53:44.001Z', -0.0071, -0.0046, 80001, 3.72),
  ...exec('2026-10-15T15:05:30.730Z', -0.0046, 0, 82154, -3.06),
];
// a stop that sweeps three price levels in one go (24-03 07:49:19.000), and two orders one ms apart
const sweep = [
  ...exec('2026-03-24T07:37:14.997Z', 0, -0.0307, 70804),
  ...exec('2026-03-24T07:49:19.000Z', -0.0307, -0.0302, 70938, -0.07),
  ...exec('2026-03-24T07:49:19.000Z', -0.0302, -0.0085, 70947, -2.98),
  ...exec('2026-03-24T07:49:19.001Z', -0.0085, 0, 70948, -1.21),
];

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'networkidle' });
  const bouw = rows => p.evaluate(rows => { const k = ExchangeAPI.kraken, t = k.levenslopenUitAccountLog(k._logRegelsUitJson(rows)).trades[0];
    return { tps: t.tpLevels.map(x => ({ price: +x.price, pct: +x.pct })), stappen: perOrder(t.fills).filter(g => g.af).map(g => ({ qty: +g.qty, price: +g.price, n: g.fills.length })), pnl: +t.pnl, exit: +t.exit, n: t.fills.length }; }, rows);

  console.log('─── Eén order in meerdere uitvoeringen ───');
  const s = await bouw(short);
  ok('TP1 in twee stukken op dezelfde milliseconde is één TP: 2 afbouwstappen in plaats van 3', s.tps.length === 2 && s.stappen.length === 2, JSON.stringify(s.tps));
  ok('alle uitvoeringen blijven zichtbaar: 4 fills, TP1 bestaat uit 2', s.n === 4 && s.stappen[0].n === 2, JSON.stringify(s));
  ok('TP1 = 50% op 80.001, de rest 50% op 82.154', s.tps[0].pct === 50 && s.tps[0].price === 80001 && s.tps[1].pct === 50 && s.tps[1].price === 82154, JSON.stringify(s.tps));
  ok('P&L blijft gelijk (3,12 + 3,72 − 3,06 − fees)', Math.abs(s.pnl - (3.12 + 3.72 - 3.06 - 0.04)) < 1e-6, String(s.pnl));

  console.log('─── Een order die door het orderboek gaat ───');
  const w = await bouw(sweep);
  ok('drie prijsniveaus in dezelfde seconde: één stap met de gewogen prijs', w.stappen.length === 1
    && Math.abs(w.stappen[0].price - (70938 * 0.0005 + 70947 * 0.0217 + 70948 * 0.0085) / 0.0307) < 1e-6, JSON.stringify(w.stappen));
  ok('zonder order-id: dezelfde seconde, dezelfde kant is één stap (ook 1 ms later)', w.stappen.length === 1 && Math.abs(w.stappen[0].qty - 0.0307) < 1e-9, JSON.stringify(w.stappen));

  console.log('─── Met order-id\'s uit Kraken (Worker v23) ───');
  const metOrders = (rows, orders) => p.evaluate(([rows, orders]) => { const k = ExchangeAPI.kraken, t = k.levenslopenUitAccountLog(k._logRegelsUitJson(rows, new Map(orders))).trades[0];
    return { stappen: perOrder(t.fills).filter(g => g.af).map(g => ({ qty: +g.qty, price: +g.price })), tps: t.tpLevels.length }; }, [rows, orders]);
  const execVan = rows => rows.filter(r => r.asset !== 'usd').map(r => r.execution);
  // two TP orders triggered in the same second (both .000): two steps, even though the time is equal
  const tweeTps = [...exec('2026-10-15T10:00:00.100Z', 0, -0.0092, 81489), ...exec('2026-10-15T13:53:44.000Z', -0.0092, -0.0046, 80001, 3), ...exec('2026-10-15T13:53:44.000Z', -0.0046, 0, 80000, 3)];
  const [e0, e1, e2] = execVan(tweeTps);
  let m = await metOrders(tweeTps, [[e0, 'o-entry'], [e1, 'o-tp1'], [e2, 'o-tp2']]);
  ok('twee TP-orders in dezelfde seconde blijven twee TP\'s', m.stappen.length === 2 && m.tps === 2, JSON.stringify(m));
  // one limit order filled in pieces over several seconds (Denny's ETH entry of 18-11-2025 had three ms)
  const limit = [...exec('2026-10-15T10:00:00.543Z', 0, -0.004, 81000), ...exec('2026-10-15T10:00:03.629Z', -0.004, -0.0092, 81000), ...exec('2026-10-15T12:00:00.000Z', -0.0092, 0, 80000, 9)];
  const [l0, l1, l2] = execVan(limit);
  m = await metOrders(limit, [[l0, 'o-limit'], [l1, 'o-limit'], [l2, 'o-close']]);
  const opening = await p.evaluate(([rows, orders]) => { const k = ExchangeAPI.kraken; return perOrder(k.levenslopenUitAccountLog(k._logRegelsUitJson(rows, new Map(orders))).trades[0].fills).filter(g => !g.af).length; }, [limit, [[l0, 'o-limit'], [l1, 'o-limit'], [l2, 'o-close']]]);
  ok('één limit-order in stukjes over meerdere seconden is één instap', opening === 1, String(opening));

  console.log('─── Stappentabel: alle uitvoeringen, met een haak per order ───');
  const tab = await p.evaluate((rows) => { const k = ExchangeAPI.kraken, tj = k.levenslopenUitAccountLog(k._logRegelsUitJson(rows)).trades[0];
    const t = { ...sjFromTj(tj), id: 1 }; t.fills.filter(isAfbouw).forEach(f => { f.soort = 'tp'; });   // what the sync sets from the trigger history
    const div = document.createElement('div'); div.innerHTML = execTable(t);
    const trs = [...div.querySelectorAll('tbody tr')].filter(tr => !tr.classList.contains('exday') && !tr.classList.contains('exnew'));
    const zonder = { ...t, fills: t.fills.map(f => { const g = { ...f }; delete g.ordId; return g; }) }; const div2 = document.createElement('div'); div2.innerHTML = execTable(zonder);
    return { rijen: trs.length, labels: [...div.querySelectorAll('.extp')].map(e => e.textContent), haak: trs.map(tr => tr.className), kop: div.querySelector('.exhead').textContent.replace(/\s+/g, ' '),
      zonderLabels: div2.querySelectorAll('.extp').length, zonderKop: div2.querySelector('.exhead').textContent.replace(/\s+/g, ' ') }; }, short);
  ok('alle 4 uitvoeringen staan in de tabel', tab.rijen === 4, JSON.stringify(tab));
  ok('labels TP1 en TP2, elk één keer', tab.labels.join(',') === 'TP1,TP2', JSON.stringify(tab.labels));
  ok('haak om de twee regels van TP1 (begin en eind), niet om losse regels', /exg-s/.test(tab.haak[1]) && /exg-e/.test(tab.haak[2]) && !/exg/.test(tab.haak[0]) && !/exg/.test(tab.haak[3]), JSON.stringify(tab.haak));
  ok('kop telt per order: 1 instap · 2 afbouwstappen (3 uitvoeringen)', /1 instap · 2 afbouwstappen \(3 uitvoeringen\)/.test(tab.kop), tab.kop);
  ok('zonder order-kenmerk (andere exchanges): geen labels, kop zoals altijd', tab.zonderLabels === 0 && /1 instap · 3 afbouwstappen/.test(tab.zonderKop) && !/uitvoeringen/.test(tab.zonderKop), tab.zonderKop);

  console.log('─── Hoe ging elke afbouw: TP, SL of met de hand (F5) ───');
  // a hit stop or TP is an OrderTriggerActivated at the same moment as its execution; triggerSide (Kraken docs)
  // tells which: closing a long, Below = stop and Above = take-profit; closing a short the other way round
  const trig = (soort, iso, dir, prijs, kant) => ({ uid: 'tr' + iso + soort, timestamp: Date.parse(iso), event: { ['OrderTrigger' + soort]: { order: { uid: 'o' + prijs, tradeable: 'PF_XBTUSD', direction: dir, quantity: '0.001', orderType: 'Market', reduceOnly: true,
    triggerOptions: { triggerPrice: String(prijs), triggerSide: kant, triggerSignal: 'MarkPrice' } }, reason: soort === 'Placed' ? 'new_user_order' : undefined } } });
  const soorten = (rows, elements) => p.evaluate(async ([rows, elements]) => {
    T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1, syncFrom: '2025-01-01' };
    window.proxyCall = async q => q.action === 'open_positions' ? { positions: [] } : q.action === 'account_log' ? { source: 'account_log', logs: rows, _logDebug: { afgekapt: false } }
      : q.action === 'triggers' ? { source: 'triggers', elements } : q.action === 'executions' ? { source: 'executions', elements: [] } : {};
    await syncExchange('kraken', { quiet: true });
    const t = T.find(x => x.exchange === 'kraken'); const div = document.createElement('div'); div.innerHTML = execTable(t);
    return { soort: (t.tps || []).map(x => x.soort || ''), labels: tpLabels(t.tps, t), tabel: [...div.querySelectorAll('.extp')].map(e => e.textContent), lijn: tradeTimeline(t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), pres: revTps(t).map(x => x.n) };
  }, [rows, elements]);
  let sr = await soorten(short, [trig('Placed', '2026-10-14T18:12:52.768Z', 'Buy', 82235, 'Above'), trig('Placed', '2026-10-15T13:33:53Z', 'Buy', 80000, 'Below'), trig('Activated', '2026-10-15T13:53:44.000Z', 'Buy', 80000, 'Below')]);
  // Denny 18-10: a close by hand in profit is a take-profit too (TP n ✋); by hand at a loss it is Close ✋
  ok('short 14-10: TP1 geraakt, daarna met de hand dicht met verlies → TP1, Close ✋', sr.soort.join(',') === 'tp,hand' && sr.labels.join(',') === 'TP1,Close ✋', JSON.stringify(sr));
  ok('… ook zo in de stappentabel, de tijdlijn en de presentatie', sr.tabel.join(',') === 'TP1,Close ✋' && /TP1/.test(sr.lijn) && /Close ✋/.test(sr.lijn) && sr.pres.join(',') === 'TP1,Close ✋', JSON.stringify(sr));
  const slLong = [...exec('2026-10-16T11:19:36.369Z', 0, 0.0069, 82600), ...exec('2026-10-16T13:31:35.000Z', 0.0069, 0, 81680, -6.35)];
  sr = await soorten(slLong, [trig('Placed', '2026-10-16T11:19:36.369Z', 'Sell', 81700, 'Below'), trig('Activated', '2026-10-16T13:31:35.000Z', 'Sell', 81700, 'Below')]);
  ok('long 16-10: stop geraakt → SL (geen TP1)', sr.soort.join(',') === 'sl' && sr.labels.join(',') === 'SL' && /SL/.test(sr.lijn), JSON.stringify(sr));
  const tweeTpSl = [...exec('2026-10-15T09:00:00.100Z', 0, -0.009, 81000), ...exec('2026-10-15T10:00:00.000Z', -0.009, -0.006, 80500, 1.5), ...exec('2026-10-15T11:00:00.000Z', -0.006, -0.003, 80200, 2.4), ...exec('2026-10-15T12:00:00.000Z', -0.003, 0, 81000, 0)];
  sr = await soorten(tweeTpSl, [trig('Activated', '2026-10-15T10:00:00.000Z', 'Buy', 80500, 'Below'), trig('Activated', '2026-10-15T11:00:00.000Z', 'Buy', 80200, 'Below'), trig('Activated', '2026-10-15T12:00:00.000Z', 'Buy', 81000, 'Above')]);
  ok('twee TP\'s en dan de stop (naar break-even) → TP1, TP2, SL', sr.labels.join(',') === 'TP1,TP2,SL' && sr.tabel.join(',') === 'TP1,TP2,SL', JSON.stringify(sr));
  // 19-11-2025: TP1 and TP2 by trigger, then twice by hand in profit (short 91.383 → 89.555 and 90.721)
  const handWinst = [...exec('2025-11-19T15:23:12.038Z', 0, -0.0106, 91383), ...exec('2025-11-19T15:53:41.507Z', -0.0106, -0.0081, 90016, 3.4), ...exec('2025-11-19T16:36:36.507Z', -0.0081, -0.0061, 89437, 3.9),
    ...exec('2025-11-19T20:55:48.066Z', -0.0061, -0.0036, 89555, 4.6), ...exec('2025-11-19T21:22:31.907Z', -0.0036, 0, 90721, 2.4)];
  sr = await soorten(handWinst, [trig('Activated', '2025-11-19T15:53:41.507Z', 'Buy', 90016, 'Below'), trig('Activated', '2025-11-19T16:36:36.507Z', 'Buy', 89437, 'Below')]);
  ok('19-11: twee TP-orders en twee keer met de hand winst genomen → TP1, TP2, TP3 ✋, TP4 ✋', sr.labels.join(',') === 'TP1,TP2,TP3 ✋,TP4 ✋' && sr.tabel.join(',') === 'TP1,TP2,TP3 ✋,TP4 ✋', JSON.stringify(sr));
  ok('… en de laatste (met de hand, in winst) staat in de tijdlijn', /TP4 ✋/.test(sr.lijn), sr.lijn);
  const zonder = await p.evaluate(() => tpLabels([{ price: 1 }, { price: 2 }, { price: 3 }]).join(','));
  ok('zonder die informatie (andere exchanges): TP1, TP2, TP3 zoals altijd', zonder === 'TP1,TP2,TP3', zonder);

  // review v1.11: OKX and Blofin pass ordId but no soort; a stop or liquidation must not become "TP n"
  const okx = await p.evaluate(() => { const t = { id: 5, exchange: 'okx', dir: 'long', entry: 100, status: 'closed', pnl: -5,
      fills: fillTimeline([{ ts: 1, side: 'buy', qty: 1, price: 100, ordId: 'a' }, { ts: 2, side: 'sell', qty: 0.5, price: 95, ordId: 'b' }, { ts: 3, side: 'sell', qty: 0.5, price: 90, ordId: 'c', liq: true }], { mult: 1 }) };
    const div = document.createElement('div'); div.innerHTML = execTable(t); return div.querySelectorAll('.extp').length; });
  ok('OKX/Blofin (order-nummer, geen soort): geen TP-labels in de stappentabel, zoals vóór v1.11', okx === 0, String(okx));

  console.log('─── Lopende positie: niet-gerealiseerde P&L ───');
  // Kraken docs "Get open positions": unrealizedPnl (camelCase) on every open position
  const upl = await p.evaluate(async () => {
    T = []; CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1 };
    window.proxyCall = async q => q.action === 'open_positions' ? { result: 'success', openPositions: [], positions: [{ side: 'long', symbol: 'PF_XBTUSD', price: 80975, size: 0.004, unrealizedPnl: 12.34, unrealizedFunding: -0.0073 }] } : {};
    await syncOpenTrades('kraken', { quiet: true });
    const o = T.find(t => t.exchange === 'kraken' && t.status === 'open'); return o && o.unrealizedPnl;
  });
  ok('open Kraken-positie toont de lopende P&L van Kraken (12,34)', upl === 12.34, String(upl));

  console.log('─── In de sync ───');
  const sync = (rows, executions, prep) => p.evaluate(async ([rows, executions, prep]) => {
    window.__vragen = [];
    window.proxyCall = async q => { window.__vragen.push({ a: q.action, s: q.startTime });
      if (q.action === 'open_positions') return { positions: [] };
      if (q.action === 'account_log') return { source: 'account_log', logs: rows.filter(l => Date.parse(l.date) >= (+q.startTime || 0)), _logDebug: { afgekapt: false } };
      if (q.action === 'executions') return executions === 'v22' ? { source: 'position_updates', elements: [] } : { source: 'executions', elements: executions, _execDebug: {} };
      if (q.action === 'triggers') return { source: 'triggers', elements: [] };
      return {}; };
    if (prep) new Function(prep)();
    const res = await syncExchange('kraken', { quiet: true });
    const t = T.find(x => x.exchange === 'kraken');
    return { res, tps: t ? (t.tps || []).length : -1, steps: t ? (t.fills || []).length : -1, vragen: window.__vragen, conn: { execOud: CONNS.kraken.execOud, stappen: CONNS.kraken.stappen } };
  }, [rows, executions, prep || '']);
  const el = (ex, order, ts) => ({ uid: 'ev' + ex, timestamp: ts, event: { execution: { execution: { uid: ex, order: { uid: order, tradeable: 'PF_XBTUSD' }, timestamp: ts, quantity: '0', price: '0' } } } });
  const vers = "T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1, syncFrom: '2026-10-01' };";
  let r = await sync(tweeTps, [el(e0, 'o-entry', 1), el(e1, 'o-tp1', 2), el(e2, 'o-tp2', 3)], vers);
  ok('sync met Worker v23: twee TP\'s in dezelfde seconde blijven twee TP\'s', r.res !== -1 && r.tps === 2, JSON.stringify(r));
  ok('één executions-verzoek, vanaf de oudste regel', r.vragen.filter(v => v.a === 'executions').length === 1 && r.vragen.find(v => v.a === 'executions').s <= Date.parse('2026-10-15T10:00:00.100Z'), JSON.stringify(r.vragen));
  r = await sync(tweeTps, 'v22', vers);
  ok('Worker v22: sync slaagt, stappen per seconde (één TP)', r.res !== -1 && r.tps === 1 && +r.conn.execOud > 0, JSON.stringify(r));
  r = await sync(tweeTps, 'v22');
  ok('… en de volgende sync vraagt het een dag niet', !r.vragen.some(v => v.a === 'executions'), JSON.stringify(r.vragen));

  console.log('─── Bestaande trades: één keer opnieuw ophalen ───');
  // a trade imported before this change, with every execution as a TP; the connection already synced (log:1)
  r = await sync(short, [], vers + "CONNS.kraken = { ...CONNS.kraken, log: 1, logVanaf: Date.parse('2026-10-01'), lastSync: Date.now() };");
  ok('de eerste sync haalt de historie opnieuw op vanaf de startdatum', (r.vragen.find(v => v.a === 'account_log') || {}).s <= Date.parse('2026-10-14T18:12:52Z') && r.tps === 2, JSON.stringify(r));
  ok('… en onthoudt dat (stappen = huidige versie)', r.conn.stappen === 2, JSON.stringify(r.conn));
  r = await sync(short, []);
  ok('daarna weer gewoon vanaf de vorige sync', (r.vragen.find(v => v.a === 'account_log') || {}).s > Date.parse('2026-10-16'), JSON.stringify(r.vragen));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Kraken stappen: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
