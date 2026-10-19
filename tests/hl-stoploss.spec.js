// Hyperliquid: stop-loss, take-profits and how each close went (F8, plan docs/plan-hyperliquid-stoploss-2026-10-17.md).
// Synthetic fills and orders in Hyperliquid's own format (userFills, historicalOrders).
const { chromium } = require('playwright'); const path = require('path');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const Z = s => Date.parse(s + 'Z');
// a fill as userFills returns it
const fill = (iso, dir, sz, px, oid, closedPnl = 0, startPosition = 0, tid) => ({ coin: 'BTC', px: String(px), sz: String(sz), side: /Open Long|Close Short/.test(dir) ? 'B' : 'A',
  time: Z(iso), startPosition: String(startPosition), dir, closedPnl: String(closedPnl), hash: 'h', oid, crossed: true, fee: '0.01', tid: tid || Z(iso) + oid, feeToken: 'USDC' });

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'networkidle' });
  const bouw = fills => p.evaluate(fills => { const h = ExchangeAPI.hyperliquid; const t = h._reconstructTrades(fills.map(f => h._naarFill(f)), 'hl')[0];
    return { pnl: +t.pnl, fees: +t.fees, steps: t.fills.length, ordIds: t.fills.map(f => f.ordId || ''), afGroepen: perOrder(t.fills).filter(g => g.af).map(g => g.fills.length) }; }, fills);

  console.log('─── Task 2: elke stap met het order-nummer ───');
  // long 0.002 @ 80000; a TP limit order (oid 2) filled in two pieces at 10:00 and 10:05; the rest closed by order 3
  const long = [fill('2026-10-15T09:00:00', 'Open Long', 0.002, 80000, 1),
    fill('2026-10-15T10:00:00', 'Close Long', 0.001, 81000, 2, 1, 0.002), fill('2026-10-15T10:05:00', 'Close Long', 0.0005, 81000, 2, 0.5, 0.001),
    fill('2026-10-15T11:00:00', 'Close Long', 0.0005, 79000, 3, -0.5, 0.0005)];
  const r = await bouw(long);
  ok('elke stap draagt het oid als ordId', r.ordIds.join(',') === '1,2,2,3', JSON.stringify(r.ordIds));
  ok('de TP-order in twee stukken is één groep (2 + 1 afbouw-orders)', r.afGroepen.join(',') === '2,1', JSON.stringify(r.afGroepen));
  ok('P&L en fees zoals altijd: Σ closedPnl − Σ fee', Math.abs(r.pnl - (1 + 0.5 - 0.5 - 0.04)) < 1e-9 && Math.abs(r.fees - 0.04) < 1e-9, JSON.stringify(r));
  // sub-fills on the same ms stay one step (as Hyperliquid's CSV export does), now with their oid
  const sub = [fill('2026-10-15T09:00:00', 'Open Long', 0.001, 80000, 7, 0, 0, 't1'), fill('2026-10-15T09:00:00', 'Open Long', 0.001, 80010, 7, 0, 0.001, 't2'),
    fill('2026-10-15T10:00:00', 'Close Long', 0.002, 81000, 8, 2, 0.002)];
  const s = await bouw(sub);
  ok('sub-fills op dezelfde ms blijven één stap (gelijk aan de CSV-export), met het oid', s.steps === 2 && s.ordIds.join(',') === '7,8', JSON.stringify(s));

  console.log('─── Task 3: welke order is de SL of een TP van welke trade ───');
  const ord = (oid, ts, side, type, px, sz, status, statusTs) => ({ order: { coin: 'BTC', side, orderType: type, triggerPx: String(px), sz: String(sz), origSz: String(sz), oid, timestamp: ts, isTrigger: true, reduceOnly: true, isPositionTpsl: false }, status, statusTimestamp: statusTs || ts });
  const LONG = { positionId: 'BTC', direction: 'long', entry: '81073', openTime: String(Z('2026-10-15T19:00:00')), closeTime: '', positionSizeAsset: '0.00391' };
  const sl = (orders, L = LONG) => p.evaluate(([orders, L]) => { const h = ExchangeAPI.hyperliquid; return h._slTpVoorTrade(L, h._orderRegels(orders)); }, [orders, L]);
  ok('SL 79.440 (sell-stop onder entry)', (await sl([ord(1, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'open')])).stop === 79440);
  ok('TP aan de winstkant is geen SL', (await sl([ord(2, Z('2026-10-15T19:05:00'), 'A', 'Take Profit Market', 83179, 0.00132, 'open')])).stop === null);
  ok('stop aan de kopende kant (instap-stop) is geen SL', (await sl([ord(3, Z('2026-10-15T19:05:00'), 'B', 'Stop Market', 79440, 0.00391, 'open')])).stop === null);
  let q = await sl([ord(4, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'canceled', Z('2026-10-16T10:00:00')), ord(5, Z('2026-10-16T10:00:00'), 'A', 'Stop Market', 81073, 0.00391, 'open')]);
  ok('verschoven naar break-even: 79.440 blijft, verschoven, verloop 2', q.stop === 79440 && q.verschoven === true && q.stopVerloop.length === 2, JSON.stringify(q));
  ok('alleen een stop in winst: geen oorspronkelijke SL', (await sl([ord(6, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 82000, 0.00391, 'open')])).stop === null);
  ok('bracket 30 s vóór instap telt', (await sl([ord(7, Z('2026-10-15T18:59:30'), 'A', 'Stop Market', 79440, 0.00391, 'open')])).stop === 79440);
  // the previous position's reduce-only stop is cancelled when that position closes (reduceOnlyCanceled, before this opening)
  ok('stop van de vorige positie (geannuleerd vóór de instap) telt niet', (await sl([ord(8, Z('2026-10-15T18:55:00'), 'A', 'Stop Market', 79440, 0.00391, 'reduceOnlyCanceled', Z('2026-10-15T18:58:00'))])).stop === null);
  // Denny's running long: a limit entry with its SL placed 15-10 19:05, filled 16-10 17:13 (22 h later), SL still open
  ok('limit-instap met SL erbij, 22 uur vóór de fill geplaatst en nog actief: telt', (await sl([ord(14, Z('2026-10-14T21:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'open')])).stop === 79440);
  ok('… ook als hij later geraakt werd (actief bij de opening)', (await sl([ord(15, Z('2026-10-14T21:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'triggered', Z('2026-10-16T01:00:00'))], { ...LONG, closeTime: String(Z('2026-10-16T01:00:01')) })).stop === 79440);
  q = await sl([ord(9, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79000, 0.002, 'open'), ord(10, Z('2026-10-15T19:05:20'), 'A', 'Stop Market', 80000, 0.002, 'open')]);
  ok('twee deel-stops in dezelfde minuut: gewogen 79.500', q.stop === 79500, JSON.stringify(q));
  q = await sl([ord(11, Z('2026-10-16T17:54:00'), 'A', 'Take Profit Market', 83179, 0.00132, 'triggered', Z('2026-10-16T20:00:00')), ord(12, Z('2026-10-16T17:54:00'), 'A', 'Take Profit Market', 85232, 0.00148, 'open')]);
  ok('TP\'s: 83.179 geraakt, 85.232 open, met %', q.tps.length === 2 && q.tps[0].status === 'geraakt' && q.tps[1].status === 'open' && Math.round(q.tps[0].pct) === 34, JSON.stringify(q.tps));
  // measured on Denny's recording: a hit order ends with a 'filled' row that has triggerPx 0.0 and isTrigger false
  const geraakt = [ord(13, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'open'), ord(13, Z('2026-10-15T19:05:00'), 'A', 'Stop Market', 79440, 0.00391, 'triggered', Z('2026-10-16T01:00:00')),
    { order: { coin: 'BTC', side: 'A', orderType: 'Stop Market', triggerPx: '0.0', sz: '0.0', origSz: '0.00391', oid: 13, timestamp: Z('2026-10-16T01:00:01'), isTrigger: false, reduceOnly: true, triggerCondition: 'Triggered' }, status: 'filled', statusTimestamp: Z('2026-10-16T01:00:01') }];
  q = await sl(geraakt, { ...LONG, closeTime: String(Z('2026-10-16T01:00:01')) });
  ok('geraakte stop (laatste regel "filled" met prijs 0.0): stop 79.440', q.stop === 79440, JSON.stringify(q));
  // flip: a short closes and a long opens at 10:00; a buy-stop at 09:30 belongs to the short, a sell-stop at 10:00:10 to the long
  const SHORT = { positionId: 'BTC', direction: 'short', entry: '81500', openTime: String(Z('2026-10-15T09:00:00')), closeTime: String(Z('2026-10-15T10:00:00')), positionSizeAsset: '0.002' };
  const NA = { positionId: 'BTC', direction: 'long', entry: '81400', openTime: String(Z('2026-10-15T10:00:00')), closeTime: '', positionSizeAsset: '0.002' };
  const flip = [ord(20, Z('2026-10-15T09:30:00'), 'B', 'Stop Market', 82000, 0.002, 'canceled', Z('2026-10-15T10:00:00')), ord(21, Z('2026-10-15T10:00:10'), 'A', 'Stop Market', 80900, 0.002, 'open')];
  ok('omkering: de short houdt zijn buy-stop 82.000', (await sl(flip, SHORT)).stop === 82000);
  ok('omkering: de nieuwe long krijgt de sell-stop 80.900', (await sl(flip, NA)).stop === 80900);

  console.log('─── Task 4: hoe ging elke afbouw — TP, SL of Close ───');
  // long 0.003 @ 80000: TP1 (trigger order 31) and TP2 (32) hit, then the stop (33) moved to break-even and hit
  const tpsl = [fill('2026-10-15T09:00:00', 'Open Long', 0.003, 80000, 30),
    fill('2026-10-15T10:00:00', 'Close Long', 0.001, 81000, 31, 1, 0.003), fill('2026-10-15T11:00:00', 'Close Long', 0.001, 82000, 32, 2, 0.002),
    fill('2026-10-15T12:00:00', 'Close Long', 0.001, 80000, 33, 0, 0.001)];
  const orders = [ord(31, Z('2026-10-15T09:00:05'), 'A', 'Take Profit Market', 81000, 0.001, 'triggered', Z('2026-10-15T10:00:00')),
    ord(32, Z('2026-10-15T09:00:05'), 'A', 'Take Profit Market', 82000, 0.001, 'triggered', Z('2026-10-15T11:00:00')),
    ord(35, Z('2026-10-15T09:00:05'), 'A', 'Stop Market', 79000, 0.001, 'canceled', Z('2026-10-15T11:30:00')),   // the original stop, moved to break-even:
    ord(33, Z('2026-10-15T11:30:00'), 'A', 'Stop Market', 80000, 0.001, 'triggered', Z('2026-10-15T12:00:00'))];
  const labels = (fills, orders) => p.evaluate(([fills, orders]) => { const h = ExchangeAPI.hyperliquid, t = h._reconstructTrades(fills.map(f => h._naarFill(f)), 'hl')[0];
    const soort = h._afbouwSoort(t, h._orderRegels(orders)); const g = perOrder(t.fills.filter(isAfbouw));
    return { soort: g.map(soort), labels: tpLabels(g.map(x => ({ soort: soort(x), price: x.price })), t), tps: (t.tpLevels || []).length }; }, [fills, orders]);
  let lb = await labels(tpsl, orders);
  ok('TP1 en TP2 geraakt, dan de stop op break-even → TP1, TP2, SL', lb.labels.join(',') === 'TP1,TP2,SL', JSON.stringify(lb));
  ok('een TP-niveau per afbouw-order (3)', lb.tps === 3, JSON.stringify(lb));
  lb = await labels(tpsl, orders.slice(0, 2));
  ok('zonder stop-order: de laatste sluiting met de hand, op entry → Close ✋', lb.labels.join(',') === 'TP1,TP2,Close ✋', JSON.stringify(lb));
  const handWinst = [tpsl[0], tpsl[1], tpsl[2], fill('2026-10-15T12:00:00', 'Close Long', 0.001, 83000, 33, 3, 0.001)];
  lb = await labels(handWinst, orders.slice(0, 2));
  ok('met de hand in winst → TP3 ✋', lb.labels.join(',') === 'TP1,TP2,TP3 ✋', JSON.stringify(lb));

  console.log('─── Task 5: in de sync — de exchange wint ───');
  // the TP/TP/stop long from Task 4, through the real syncExchange with a fake Hyperliquid API
  const sync = (fills, orders, prep) => p.evaluate(async ([fills, orders, prep]) => {
    T = []; TRASH = []; CONNS.hyperliquid = { connected: true, wallet: '0x' + '1'.repeat(40), syncFrom: '2026-10-01' }; window.__hl = [];
    ExchangeAPI.hyperliquid._post = async body => { window.__hl.push(body.type);
      if (body.type === 'userFillsByTime') return fills.filter(f => f.time >= (+body.startTime || 0) && (body.endTime == null || f.time <= +body.endTime));
      if (body.type === 'historicalOrders') { if (orders === 'fout') throw new Error('Hyperliquid HTTP 429 op historicalOrders'); return orders; }
      if (body.type === 'clearinghouseState') return { marginSummary: { accountValue: '100' }, assetPositions: [] };
      if (body.type === 'spotClearinghouseState') return { balances: [] };
      if (body.type === 'frontendOpenOrders') return [];
      return []; };
    if (prep) new Function(prep)();
    const res = await syncExchange('hyperliquid', { quiet: true });
    const t = T.find(x => x.exchange === 'hyperliquid');
    return { res, n: T.filter(x => x.exchange === 'hyperliquid').length, stop: t && t.stop, bron: t && t.stopBron, labels: t ? tpLabels(t.tps, t) : [], vragen: window.__hl.filter(x => x === 'historicalOrders').length };
  }, [fills, orders, prep || '']);
  let y = await sync(tpsl, orders);
  ok('nieuwe trade: oorspronkelijke stop 79.000 van Hyperliquid, labels TP1, TP2, SL', y.n === 1 && y.stop === 79000 && y.bron === 'hyperliquid' && y.labels.join(',') === 'TP1,TP2,SL', JSON.stringify(y));
  ok('één historicalOrders-aanroep per sync', y.vragen === 1, JSON.stringify(y));
  const fillsMetHand = [tpsl[0], tpsl[1], tpsl[2], fill('2026-10-15T12:00:00', 'Close Long', 0.001, 79500, 34, -0.5, 0.001)];
  y = await sync(fillsMetHand, orders.slice(0, 2).concat(ord(33, Z('2026-10-15T09:00:05'), 'A', 'Stop Market', 79000, 0.001, 'reduceOnlyCanceled', Z('2026-10-15T12:00:00'))));
  ok('stop 79.000 (stop-order, niet geraakt) en met de hand met verlies gesloten → TP1, TP2, Close ✋', y.stop === 79000 && y.labels.join(',') === 'TP1,TP2,Close ✋', JSON.stringify(y));
  // the same trade, a stop typed by hand before: Hyperliquid's stop wins (Denny 18-10-2026, as Kraken)
  const opnieuw = await p.evaluate(async () => { const t = T.find(x => x.exchange === 'hyperliquid'); t.stop = 78000; delete t.stopBron; CONNS.hyperliquid.lastSync = Date.now() - 864e5 * 5;
    await syncExchange('hyperliquid', { quiet: true }); return { stop: t.stop, bron: t.stopBron, n: T.filter(x => x.exchange === 'hyperliquid').length }; });
  ok('een eerder getypte stop maakt plaats voor die van Hyperliquid', opnieuw.n === 1 && opnieuw.stop === 79000 && opnieuw.bron === 'hyperliquid', JSON.stringify(opnieuw));
  y = await sync(tpsl, 'fout');
  ok('historicalOrders faalt (429): trades komen binnen, zonder stop, labels TP1–TP3 zoals vroeger', y.res !== -1 && y.n === 1 && !(y.stop > 0) && y.labels.join(',') === 'TP1,TP2,TP3', JSON.stringify(y));
  // a trade older than the order history (Hyperliquid keeps the last 2000 orders): no invented "Close"
  y = await sync(tpsl, [ord(99, Z('2026-10-15T13:00:00'), 'A', 'Stop Market', 70000, 0.001, 'open')]);
  ok('trade van vóór de order-historie: geen verzonnen labels (TP1–TP3 zoals vroeger)', y.labels.join(',') === 'TP1,TP2,TP3', JSON.stringify(y));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== HL stop-loss: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
