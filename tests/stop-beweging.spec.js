// Backlog F5: how the stop moved (break-even, tighter, wider) and how the trade closed (stop, TP, by hand, liquidation).
// Built only on what the adapters already keep (Kraken's trigger chain, Hyperliquid's and OKX's stopVerloop, the kind
// on each close step): no new API calls. The adapters store stopLaatst (the last stop before the close); the movement
// and the exit reason come from shared pure helpers without exchange assumptions. Synthetic trades only.
const { chromium } = require('playwright');
const H = require('./helpers/dov-page');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const Z = s => Date.parse(s + 'Z');

(async () => {
  const b = await chromium.launch(); const { p, errs } = await H.openJournal(b);
  const has = await p.evaluate(() => typeof stopBewegingVan === 'function' && typeof exitRedenOf === 'function');
  ok('gedeelde helpers stopBewegingVan en exitRedenOf bestaan', has);
  if (!has) { console.log(`\n=== Stopbeweging: ${pass}/${pass + fail} ===`); await b.close(); process.exit(1); }

  console.log('─── Beweging (pure helper) ───');
  const bw = await p.evaluate(() => [
    stopBewegingVan('long', 80000, 79000, 79000), stopBewegingVan('long', 80000, 79000, 80040), stopBewegingVan('long', 80000, 79000, 79500),
    stopBewegingVan('long', 80000, 79000, 81000), stopBewegingVan('long', 80000, 79000, 78500),
    stopBewegingVan('short', 80000, 81000, 80000), stopBewegingVan('short', 80000, 81000, 80500), stopBewegingVan('short', 80000, 81000, 79000),
    stopBewegingVan('short', 80000, 81000, 81800), stopBewegingVan('long', 80000, 79000, ''), stopBewegingVan('long', 0, 79000, 79500)]);
  ok('long: gelijk → geen, binnen 0,1% van de entry → be, dichterbij → strakker', bw[0] === 'geen' && bw[1] === 'be' && bw[2] === 'strakker', JSON.stringify(bw));
  ok('long: voorbij de entry de winst in (trailing) → strakker, verder weg → ruimer', bw[3] === 'strakker' && bw[4] === 'ruimer', JSON.stringify(bw));
  ok('short gespiegeld: be, strakker, trailing strakker, ruimer', bw[5] === 'be' && bw[6] === 'strakker' && bw[7] === 'strakker' && bw[8] === 'ruimer', JSON.stringify(bw));
  ok('zonder laatste stop of entry: onbekend (null), niet "geen"', bw[9] === null && bw[10] === null, JSON.stringify(bw));

  console.log('─── Exit-reden (pure helper, uit de soort op de afbouwstappen) ───');
  const ex = await p.evaluate(() => {
    const c = (extra) => ({ ...EMPTY_TRADE, status: 'closed', ...extra });
    return [
      exitRedenOf(c({ fills: [{ kind: 'open', ts: 1 }, { kind: 'close', ts: 2, soort: 'tp' }, { kind: 'close', ts: 3, soort: 'sl' }] })),
      exitRedenOf(c({ fills: [{ kind: 'open', ts: 1 }, { kind: 'close', ts: 3, soort: 'hand' }, { kind: 'close', ts: 2, soort: 'tp' }] })),
      exitRedenOf(c({ fills: [{ kind: 'liq', ts: 2, soort: 'liq' }] })),
      exitRedenOf(c({ tps: [{ price: 1, hit: true, soort: 'tp' }, { price: 2, hit: true, soort: 'tp' }, { price: 3, hit: false }] })),
      exitRedenOf(c({ fills: [{ kind: 'close', ts: 2 }] })),
      exitRedenOf({ ...EMPTY_TRADE, status: 'open', fills: [{ kind: 'close', ts: 2, soort: 'tp' }] })];
  });
  ok('laatste afbouw op de stop → stop; TP eerst, dan met de hand → hand (volgorde op tijd)', ex[0] === 'stop' && ex[1] === 'hand', JSON.stringify(ex));
  ok('liquidatie → liquidatie; zonder stappen: de geraakte TP-niveaus → tp', ex[2] === 'liquidatie' && ex[3] === 'tp', JSON.stringify(ex));
  ok('geen soort bekend → null; een lopende trade heeft geen exit-reden', ex[4] === null && ex[5] === null, JSON.stringify(ex));

  console.log('─── Kraken: de laatste stop uit de trigger-keten ───');
  const plaats = (ts, prijs) => ({ uid: 'e' + ts, timestamp: ts, event: { OrderTriggerPlaced: { order: { uid: 't' + ts, tradeable: 'PF_XBTUSD', direction: 'Buy', quantity: '0.0092', orderType: 'stop', reduceOnly: true, timestamp: ts, triggerOptions: { triggerPrice: String(prijs), triggerSide: 'Above', triggerSignal: 'MarkPrice' } }, reason: 'new_user_order' } } });
  const wijzig = (ts, oud, nieuw) => ({ uid: 'w' + ts, timestamp: ts, event: { OrderTriggerUpdated: { oldOrderTrigger: { tradeable: 'PF_XBTUSD', direction: 'Buy', triggerOptions: { triggerPrice: String(oud) }, orderType: 'stop' }, newOrderTrigger: { tradeable: 'PF_XBTUSD', direction: 'Buy', triggerOptions: { triggerPrice: String(nieuw) }, orderType: 'stop' }, reason: 'edited_by_user' } } });
  const SHORT = { positionId: 'PF_XBTUSD', direction: 'short', entry: '81489', openTime: String(Z('2026-10-14T18:12:52')), closeTime: String(Z('2026-10-15T15:05:30')) };
  const kr = await p.evaluate(([els, L]) => { const k = ExchangeAPI.kraken; return k._stopVoorLevensloop(L, k._triggerRegels(els)); },
    [[plaats(Z('2026-10-14T18:13:30'), 82235), wijzig(Z('2026-10-14T20:00:00'), 82235, 81489)], SHORT]);
  ok('Kraken: stop 82.235, naar 81.489 verzet → laatst 81.489', kr.stop === 82235 && kr.verschoven === true && kr.laatst === 81489, JSON.stringify(kr));
  const krNiet = await p.evaluate(([els, L]) => { const k = ExchangeAPI.kraken; return k._stopVoorLevensloop(L, k._triggerRegels(els)); }, [[plaats(Z('2026-10-14T18:13:30'), 82235)], SHORT]);
  ok('Kraken: niet verzet → laatst = de stop', krNiet.laatst === 82235, JSON.stringify(krNiet));
  const krT = await p.evaluate(() => { const k = ExchangeAPI.kraken;
    T = [{ ...EMPTY_TRADE, id: 1, exchange: 'kraken', srcId: 'kraken_pos_X', status: 'closed', dir: 'short', entry: 81489, pair: 'BTC/USD', openTime: '1', closeTime: '2' }];
    k._log = { levenslopen: [], weg: new Set(), stops: new Map([['kraken_pos_X', { stop: 82235, verschoven: true, laatst: 81489 }]]) };
    k.afterImport([]); const t = T[0]; return { stop: +t.stop, bron: t.stopBron, laatst: +t.stopLaatst, bw: stopBewegingOf(t) }; });
  ok('Kraken afterImport: stopLaatst opgeslagen, beweging be', krT.stop === 82235 && krT.bron === 'kraken' && krT.laatst === 81489 && krT.bw === 'be', JSON.stringify(krT));

  console.log('─── Hyperliquid: de laatste stop uit stopVerloop ───');
  const ord = (oid, ts, px, status, statusTs) => ({ order: { coin: 'BTC', side: 'A', orderType: 'Stop Market', triggerPx: String(px), sz: '0.00391', origSz: '0.00391', oid, timestamp: ts, isTrigger: true, reduceOnly: true, isPositionTpsl: false }, status, statusTimestamp: statusTs || ts });
  const hl = await p.evaluate(([orders]) => { const h = ExchangeAPI.hyperliquid;
    T = [{ ...EMPTY_TRADE, id: 2, exchange: 'hyperliquid', status: 'closed', dir: 'long', entry: 81073, pair: 'BTC/USDC', positionId: 'BTC', qtyAsset: 0.00391,
      openTime: String(Date.parse('2026-10-15T19:00:00Z')), closeTime: String(Date.parse('2026-10-17T19:00:00Z')), fills: [], tps: [] }];
    h._orders = { regels: h._orderRegels(orders), kinderen: new Map(), vanaf: 0 }; h._stopsInvullen();
    const t = T[0]; return { stop: +t.stop, laatst: +t.stopLaatst, bw: stopBewegingOf(t) }; },
    [[ord(4, Z('2026-10-15T19:05:00'), 79440, 'canceled', Z('2026-10-16T10:00:00')), ord(5, Z('2026-10-16T10:00:00'), 78000, 'canceled', Z('2026-10-17T19:00:00'))]]);
  ok('Hyperliquid: 79.440 → 78.000 (verder weg) → laatst 78.000, ruimer', hl.stop === 79440 && hl.laatst === 78000 && hl.bw === 'ruimer', JSON.stringify(hl));

  console.log('─── OKX: de laatste stop uit stopVerloop ───');
  const OPEN = Z('2026-10-05T04:16:16'), DICHT = Z('2026-10-08T18:53:27');
  const algo = (id, cTime, px, uTime) => ({ algoId: String(id), instId: 'BTC-USD_UM_XPERP-310404', ordType: 'conditional', side: 'buy', posSide: 'net', sz: '24', closeFraction: '', reduceOnly: 'true',
    slTriggerPx: String(px), tpTriggerPx: '', state: 'canceled', actualSide: '', cTime: String(cTime), uTime: String(uTime), triggerTime: '', ordIdList: [] });
  const okx = await p.evaluate(([rows, open, dicht]) => { const o = ExchangeAPI.okx;
    T = [{ ...EMPTY_TRADE, id: 3, exchange: 'okx', status: 'closed', dir: 'short', entry: 85840, qtyAsset: 0.0024, pair: 'BTC/USDC', openTime: String(open), closeTime: String(dicht), fills: [], tps: [] }];
    o._regels = o._algoRegels({ source: 'algos', history: rows, pending: [] }); o._dekking = 0; o.afterImport([]);
    const t = T[0]; return { stop: +t.stop, laatst: +t.stopLaatst, bw: stopBewegingOf(t) }; },
    [[algo(1, OPEN + 30e3, 87000, OPEN + 36e5), algo(2, OPEN + 36e5 + 1, 84000, DICHT)], OPEN, DICHT]);
  ok('OKX: 87.000 → 84.000 (de winst in) → laatst 84.000, strakker', okx.stop === 87000 && okx.laatst === 84000 && okx.bw === 'strakker', JSON.stringify(okx));

  console.log('─── In het trade-detail en het formulier ───');
  const beeld = await p.evaluate(() => {
    T = [{ ...EMPTY_TRADE, id: 9, exchange: 'kraken', kind: 'live', status: 'closed', pair: 'BTC/USD', dir: 'short', date: '2026-10-14', time: '20:12', entry: 81489, exit: 80000, stop: 82235,
      stopBron: 'kraken', stopVerschoven: true, stopLaatst: 81489, size: '750', pnl: 10, fills: [{ kind: 'open', ts: 1, qty: 1, price: 81489 }, { kind: 'close', ts: 2, qty: 1, price: 81489, soort: 'sl' }] }];
    persist(); const d = tradeHoverDetail(T[0]); openForm(9); const lbl = document.querySelector('label[for="f_stop"]').innerText; closeForm();
    return { d: d.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), lbl }; });
  ok('detail: "Stop later … naar break-even"', /Stop later\s*naar break-even/.test(beeld.d), beeld.d.slice(0, 300));
  ok('detail: "Gesloten via … stop-loss"', /Gesloten via\s*stop-loss/.test(beeld.d), beeld.d.slice(0, 300));
  ok('formulier: "(van Kraken Futures, later naar break-even)" in plaats van alleen "later verschoven"', /later naar break-even/.test(beeld.lbl) && !/later verschoven/.test(beeld.lbl), beeld.lbl);
  const ruim = await p.evaluate(() => { T[0].stopLaatst = 83000; openForm(9); const l = document.querySelector('label[for="f_stop"]').innerText; return { l, d: tradeHoverDetail(T[0]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }; });
  ok('verder weg: waarschuwing in formulier en detail', /later verder weg ⚠/.test(ruim.l) && /verder weg ⚠/.test(ruim.d), JSON.stringify(ruim).slice(0, 300));
  const oud = await p.evaluate(() => { delete T[0].stopLaatst; openForm(9); return document.querySelector('label[for="f_stop"]').innerText; });
  ok('zonder stopLaatst (van vóór deze versie): "later verschoven" blijft', /later verschoven/.test(oud), oud);

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`\n=== Stopbeweging: ${pass}/${pass + fail} ===`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
