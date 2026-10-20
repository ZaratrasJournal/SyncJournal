// Kraken: a TP hit while the position still runs is visible right away (Denny 20-10-2026).
// His long of 16-10 (0.0025 @ 80.975) closed 0.0015 at 83.202 on 20-10; the journal kept showing a plain open row
// without steps or TP, because the account-log only turned fully closed positions into trades. Like Hyperliquid
// (hl-deels-dicht): one row with status partial, the full size, the booked P&L apart, the steps and one TP per order.
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };

const Z = s => Date.parse(s + 'Z');
let lid = 100;
// one execution in the account-log = a cash row and a position row
const uitvoering = (iso, oud, nieuw, px, pnl, fee) => { const date = iso + 'Z', ex = 'exec-' + lid;
  return [{ id: lid++, date, info: 'futures trade', asset: 'usd', contract: 'pf_xbtusd', old_balance: 1000, new_balance: 1000 + pnl - fee, trade_price: px, realized_pnl: pnl, fee, realized_funding: 0, execution: ex, booking_uid: 'c' + lid },
          { id: lid++, date, info: 'futures trade', asset: 'pf_xbtusd', contract: 'pf_xbtusd', old_balance: oud, new_balance: nieuw, new_average_entry_price: nieuw ? 80975 : null, trade_price: px, execution: ex, booking_uid: 'p' + lid }]; };
const OPEN = uitvoering('2026-10-16T17:15:52', 0, 0.0025, 80975, 0, 0.1);
const TP1 = uitvoering('2026-10-20T14:15:04', 0.0025, 0.001, 83202, 3.34, 0.06);
const REST = uitvoering('2026-10-21T09:00:00', 0.001, 0, 84000, 3.025, 0.04);
const SL = [{ uid: 'e1', timestamp: Z('2026-10-16T17:16:10'), event: { OrderTriggerPlaced: { order: { uid: 't1', tradeable: 'PF_XBTUSD', direction: 'Sell', quantity: '0.0025', orderType: 'stop', reduceOnly: true, timestamp: Z('2026-10-16T17:16:10'),
  triggerOptions: { triggerPrice: '79314', triggerSide: 'Below', triggerSignal: 'MarkPrice' } }, reason: 'new_user_order' } } }];

(async () => {
  const url = 'file:///' + path.resolve('work/syncjournal.html').replace(/\\/g, '/');
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.evaluate(() => { try { hideWelcome() } catch (e) {} });

  // positie: what /openpositions says now (null = flat)
  const sync = (logs, positie, prep) => p.evaluate(async ([logs, positie, SL, prep]) => {
    window.proxyCall = async (q) => {
      if (q.action === 'open_positions') return { positions: positie ? [positie] : [] };
      if (q.action === 'account_log') return { source: 'account_log', logs, _logDebug: { afgekapt: false } };
      if (q.action === 'triggers') return { source: 'triggers', elements: SL, _trigDebug: {} };
      if (q.action === 'executions') return { source: 'executions', elements: [], _execDebug: {} };
      return {}; };
    if (prep) new Function(prep)();
    const res = await syncExchange('kraken', { quiet: true });
    const k = T.filter(t => t.exchange === 'kraken');
    return { res, rijen: k.map(t => ({ id: t.id, status: t.status, qty: +t.qtyAsset, entry: +t.entry, realized: +t.realizedPnl || 0, pnl: +t.pnl, unreal: +t.unrealizedPnl || 0,
      stop: t.stop, bron: t.stopBron, notes: t.notes, tps: (t.tps || []).map(x => [x.price, x.hit]), labels: tpLabels(t.tps, t), stappen: (t.fills || []).length, placeholder: !!t.placeholder })) };
  }, [logs, positie, SL, prep || '']);
  const vers = "T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = { connected: true, apiKey: 'k', apiSecret: 's', evt: 1, syncFrom: '2026-10-01' };";
  const RUST = { symbol: 'PF_XBTUSD', side: 'long', size: 0.001, price: 80975, unrealizedPnl: 1.2, fillTime: '1970-01-01T00:00:00.000Z' };

  console.log('─── Eerste sync na de geraakte TP ───');
  let r = await sync([...OPEN, ...TP1], RUST, vers);
  let k = r.rijen[0] || {};
  ok('één rij voor de positie, geen open rest ernaast', r.rijen.length === 1, JSON.stringify(r.rijen));
  ok('status partial, volle grootte 0,0025, entry 80.975', k.status === 'partial' && Math.abs(k.qty - 0.0025) < 1e-9 && k.entry === 80975, JSON.stringify(k));
  ok('geboekt: 3,34 − fees 0,16 = 3,18', Math.abs(k.realized - 3.18) < 1e-6, JSON.stringify(k));
  ok('het geboekte deel telt mee in je totalen (3,18), zoals bij Hyperliquid', await p.evaluate(() => Math.abs(geboekt(T.find(t => t.exchange === 'kraken')) - 3.18) < 1e-6));
  ok('de geraakte TP op 83.202 staat erbij (TP1)', k.tps.length === 1 && k.tps[0][0] === 83202 && k.tps[0][1] === true && /^TP1/.test(k.labels[0]), JSON.stringify(k));
  ok('de stappen: instap en afbouw', k.stappen === 2, JSON.stringify(k));
  ok('stop 79.314 van Kraken', +k.stop === 79314 && k.bron === 'kraken', JSON.stringify(k));
  ok('lopende P&L van de rest (1,20) blijft zichtbaar', Math.abs(k.unreal - 1.2) < 1e-9, JSON.stringify(k));

  console.log('─── Zoals bij Denny: de open rij stond er al, met je eigen notitie ───');
  r = await sync(OPEN, { ...RUST, size: 0.0025, unrealizedPnl: 4.18 }, vers);
  ok('vóór de TP: één open rij', r.rijen.length === 1 && r.rijen[0].status === 'open', JSON.stringify(r.rijen));
  await p.evaluate(() => { const t = T.find(x => x.exchange === 'kraken'); t.notes = 'retest van de range-low'; persist(); });
  r = await sync([...OPEN, ...TP1], RUST, "CONNS.kraken = { ...CONNS.kraken, lastSync: Date.parse('2026-10-20T10:00:00Z') };");
  k = r.rijen[0] || {};
  ok('na de TP: nog steeds één rij, nu partial, met je notitie', r.rijen.length === 1 && k.status === 'partial' && k.notes === 'retest van de range-low', JSON.stringify(r.rijen));
  ok('… met de TP op 83.202', k.tps.length === 1 && k.tps[0][0] === 83202, JSON.stringify(k));
  const id = k.id;

  console.log('─── De rest gaat dicht ───');
  r = await sync([...OPEN, ...TP1, ...REST], null, "CONNS.kraken = { ...CONNS.kraken, lastSync: Date.parse('2026-10-21T08:00:00Z') };");
  k = r.rijen[0] || {};
  ok('dezelfde rij wordt gesloten, geen kopie', r.rijen.length === 1 && k.id === id && k.status === 'closed', JSON.stringify(r.rijen));
  ok('twee TP\'s: 83.202 en 84.000, P&L 6,365 − 0,20 fees', k.tps.length === 2 && k.tps[1][0] === 84000 && Math.abs(k.pnl - 6.165) < 1e-6, JSON.stringify(k));
  ok('je notitie staat er nog', k.notes === 'retest van de range-low', JSON.stringify(k));

  console.log('─── Zonder afbouw blijft het zoals het was ───');
  r = await sync(OPEN, { ...RUST, size: 0.0025 }, vers);
  ok('alleen de instap: één open rij (de placeholder), geen partial', r.rijen.length === 1 && r.rijen[0].status === 'open', JSON.stringify(r.rijen));
  ok('… die laat zien hoe de positie liep: de instap als stap, zoals bij OKX', r.rijen[0].stappen === 1, JSON.stringify(r.rijen));
  const tabel = await p.evaluate(async () => { STATE.revSel = T.find(t => t.exchange === 'kraken').id; go('review'); await new Promise(r => setTimeout(r, 300));
    const m = document.getElementById('main').textContent; return /Zo is deze positie gelopen\s*1 instap/.test(m.replace(/\s+/g, ' ')); });
  ok('… met het blok "Zo is deze positie gelopen · 1 instap" in de review', tabel);

  console.log('─── Review: twee instappen, een eerdere trade op BTC, meerdere syncs (C1) ───');
  // Kraken's /openpositions price is the average of what is open now, ours the average of all entries: they differ
  const VORIGE = [...uitvoering('2026-10-10T08:00:00', 0, 0.002, 79000, 0, 0.1), ...uitvoering('2026-10-10T12:00:00', 0.002, 0, 80000, 2, 0.1)];
  const TWEE = [...uitvoering('2026-10-16T17:15:52', 0, 0.0015, 80975, 0, 0.06), ...uitvoering('2026-10-16T18:00:00', 0.0015, 0.0025, 81018, 0, 0.04)];
  const TP_B = uitvoering('2026-10-20T14:15:04', 0.0025, 0.001, 83202, 3.32, 0.06);
  const BIJ = uitvoering('2026-10-20T15:00:00', 0.001, 0.002, 82000, 0, 0.05);
  const DICHT = uitvoering('2026-10-21T09:00:00', 0.002, 0, 84000, 5.5, 0.08);
  const rest = (size, price) => ({ symbol: 'PF_XBTUSD', side: 'long', size, price, unrealizedPnl: 2.5, fillTime: '1970-01-01T00:00:00.000Z' });
  const sinds = iso => `CONNS.kraken = { ...CONNS.kraken, lastSync: Date.parse('${iso}') };`;
  r = await sync([...VORIGE, ...TWEE], rest(0.0025, 80992.33333333), vers);
  await p.evaluate(() => { const t = T.find(x => x.exchange === 'kraken' && x.status === 'open'); t.notes = 'mijn notitie'; persist(); });
  const deze = 'kraken_pos_PF_XBTUSD_' + (Math.floor(Z('2026-10-16T17:15:52') / 1000) * 1000);
  const stand = () => p.evaluate((deze) => ({ rijen: T.filter(t => t.exchange === 'kraken').map(t => ({ src: t.srcId, status: t.status, notes: t.notes || '', stale: !!t._stale, unreal: +t.unrealizedPnl || 0 })),
    weg: DB.load('kraken_weg', []), prul: TRASH.filter(t => t.exchange === 'kraken').length }), deze);
  const goed = (s, status) => s.rijen.length === 2 && s.rijen.filter(x => x.src === deze && x.status === status && x.notes === 'mijn notitie' && !x.stale).length === 1;
  let s;
  for (const [i, logs, pos, prep] of [[1, [...VORIGE, ...TWEE, ...TP_B], rest(0.001, 80992.33333333), sinds('2026-10-20T10:00:00Z')],
    [2, [...VORIGE, ...TWEE, ...TP_B], rest(0.001, 80992.33333333), sinds('2026-10-20T14:30:00Z')],
    [3, [...VORIGE, ...TWEE, ...TP_B, ...BIJ], rest(0.002, 81496.1), sinds('2026-10-20T14:40:00Z')],
    [4, [...VORIGE, ...TWEE, ...TP_B, ...BIJ], rest(0.002, 81496.1), sinds('2026-10-20T15:10:00Z')]]) {
    await sync(logs, pos, prep); s = await stand();
    ok(`sync ${i}: één partial-rij voor de positie, met je notitie, naast de vorige trade; niets in de prullenbak`, goed(s, 'partial') && !s.prul, JSON.stringify(s));
  }
  ok('… met de lopende P&L van nu (2,50)', s.rijen.some(x => x.src === deze && Math.abs(x.unreal - 2.5) < 1e-9), JSON.stringify(s));
  await sync([...VORIGE, ...TWEE, ...TP_B, ...BIJ, ...DICHT], null, sinds('2026-10-21T08:00:00Z')); s = await stand();
  ok('dicht: dezelfde rij gesloten, met je notitie; niets weggegooid of onthouden als weg', goed(s, 'closed') && !s.weg.length && !s.prul, JSON.stringify(s));
  ok('de vorige trade houdt zijn eigen (lege) notitie', s.rijen.some(x => x.src !== deze && x.notes === ''), JSON.stringify(s));

  console.log('─── Review: je geplande TP\'s blijven staan (I1) ───');
  r = await sync(OPEN, { ...RUST, size: 0.0025 }, vers);
  await p.evaluate(() => { const t = T.find(x => x.exchange === 'kraken'); t.tps = [{ price: 85000, pct: 30, r: '', hit: false, ts: 0 }, { price: 88000, pct: 30, r: '', hit: false, ts: 0 }]; persist(); });
  const tps = async prep => { await sync([...OPEN, ...TP1], RUST, prep); return p.evaluate(() => T.find(x => x.exchange === 'kraken').tps.map(x => [x.price, x.hit, x.soort || ''])); };
  let tp = await tps(sinds('2026-10-20T10:00:00Z'));
  const verwacht = x => x.length === 3 && x.some(([pr, h, so]) => pr === 83202 && h && so === 'hand') && x.filter(([pr, h, so]) => (pr === 85000 || pr === 88000) && !h && !so).length === 2;
  ok('na de TP: 83.202 geraakt (hand), 85.000 en 88.000 nog gepland, zonder soort', verwacht(tp), JSON.stringify(tp));
  tp = await tps(sinds('2026-10-20T14:30:00Z'));
  ok('… en na nog een sync staan ze er nog', verwacht(tp), JSON.stringify(tp));

  console.log('─── Review: een oudere CSV zet een gesloten trade niet terug (I2) ───');
  const KOP = 'uid,dateTime,account,type,symbol,contract,change,new balance,new average entry price,trade price,mark price,funding rate,realized pnl,fee,realized funding,collateral,conversion spread percentage,liquidation fee,position uid,exchange rate,exchange rate from,conversion fee';
  let nr = 0;
  const alsCsv = rows => [KOP].concat(rows.filter(x => x.asset !== 'usd').map(x => { const c = rows.find(y => y.execution === x.execution && y.asset === 'usd'), dt = x.date.slice(0, 19).replace('T', ' ');
    return [[`p${++nr}`, dt, 'flex', 'futures trade', 'pf_xbtusd', 'pf_xbtusd', (x.new_balance - x.old_balance).toFixed(8), (+x.new_balance).toFixed(8), x.new_balance ? '80975' : '', x.trade_price, x.trade_price, '', '', '', '', '', '', '', '', '', '', ''].join(','),
      [`c${++nr}`, dt, 'flex', 'futures trade', 'usd', 'pf_xbtusd', (c.realized_pnl - c.fee).toFixed(8), '1000', '', x.trade_price, x.trade_price, '', c.realized_pnl || '', c.fee, '', '', '', '', '', '', '', ''].join(',')].join('\n'); })).join('\n');
  const csv = await p.evaluate(async ([heel, half]) => { T = []; TRASH = []; DB.save('kraken_weg', []); CONNS.kraken = undefined;
    sjImportCsvText(heel, 'kraken'); const voor = T.filter(t => t.exchange === 'kraken').map(t => t.status);
    sjImportCsvText(half, 'kraken'); return { voor, na: T.filter(t => t.exchange === 'kraken').map(t => [t.status, +t.pnl]) }; }, [alsCsv([...OPEN, ...TP1, ...REST]), alsCsv([...OPEN, ...TP1])]);
  ok('CSV met de hele positie, daarna een oudere CSV van halverwege: blijft gesloten met zijn P&L', csv.voor.join() === 'closed' && csv.na.length === 1 && csv.na[0][0] === 'closed' && csv.na[0][1] > 6, JSON.stringify(csv));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== Kraken deels dicht: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
