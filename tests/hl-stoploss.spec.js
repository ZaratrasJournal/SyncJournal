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

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== HL stop-loss: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
