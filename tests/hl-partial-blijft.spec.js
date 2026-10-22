// Hyperliquid: a partly closed position stays one partial row, sync after sync (Denny 22-10-2026).
//
// His short of 22-10 (0.00949 @ 81.621, TP 0.00341 @ 80.936 at 18:53) showed as a plain open row: no booked
// +$2.34, no R. Cause: Hyperliquid's own entry for the open position (81620.9) differs from the fill average
// (81621), so syncOpenTrades did not see the partial row as the same position, marked it stale and
// finalizeStaleOpens removed it. Once the TP was more than an hour before the last sync, the window
// (lastSync − 1 h) no longer held it and the partial row never came back. Same pattern as Kraken (v1.13).
const { chromium } = require('playwright'); const path = require('path');
const hl = require('./helpers/hl-wallet');
let pass = 0, fail = 0; const ok = (n, c, e) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (e ? ' → ' + e : ''))); };
const bij = (a, b, tol = 1e-3) => Math.abs(+a - b) <= tol;

const WALLET = '0x' + 'd'.repeat(40);
const ms = s => Date.parse(s);
const fill = (t, dir, side, sz, px, start, pnl, fee, tid) => ({ coin: 'BTC', dir, side, px: String(px), sz: String(sz), startPosition: String(start),
  closedPnl: String(pnl), fee: String(fee), time: ms(t), tid, hash: '0x' + tid, oid: tid, crossed: true, feeToken: 'USDC' });
// an earlier BTC trade, closed: finalizeStaleOpens found it as a "sibling" of the vanished row
const VORIGE = [fill('2026-10-20T08:00:00Z', 'Open Long', 'B', 0.001, 80000, 0, 0, 0.03, 21), fill('2026-10-20T10:00:00Z', 'Close Long', 'A', 0.001, 80500, 0.001, 0.5, 0.03, 22)];
const OPEN = fill('2026-10-22T14:07:01Z', 'Open Short', 'A', 0.00949, 81621, 0, 0, 0.43, 31);              // 16:07
const TP = fill('2026-10-22T16:53:05Z', 'Close Short', 'B', 0.00341, 80936, -0.00949, 2.33585, 0.12, 32);   // 18:53
const GEBOEKT = 2.33585 - 0.43 - 0.12;
const ACC = { wallet: WALLET, fills: [...VORIGE, OPEN, TP], entryPx: { BTC: '81620.9' },
  clearinghouseState: { marginSummary: { accountValue: '300' }, assetPositions: [] }, spotClearinghouseState: { balances: [] } };

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const klok = { nu: ms('2026-10-22T13:00:00Z') };
  await hl.speelAf(p, ACC, klok);
  const naar = async nu => { klok.nu = nu; await p.clock.setFixedTime(new Date(nu)); };
  await naar(klok.nu);
  await p.goto('file:///' + path.resolve('work/syncjournal.html').split(path.sep).join('/'), { waitUntil: 'load' }); await p.waitForTimeout(600);
  await p.evaluate(async () => { localStorage.clear(); try { await IDB.clearAll(); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { try { hideWelcome(); } catch (e) {} });
  const sync = () => p.evaluate(async w => { CONNS.hyperliquid = { ...(CONNS.hyperliquid || {}), connected: true, wallet: w, hint: w.slice(-4), syncFrom: '2026-10-15' }; persistConns();
    return syncExchange('hyperliquid', { quiet: true }); }, WALLET);
  const rijen = () => p.evaluate(() => T.filter(t => t.exchange === 'hyperliquid').map(t => ({ id: t.id, src: t.srcId, status: t.status, qty: +t.qtyAsset, real: +t.realizedPnl || 0,
    notes: t.notes || '', stale: !!t._stale, ph: !!t.placeholder, r: tradeROrNull(t), stappen: (t.fills || []).length })));

  console.log('─── 22-10 13:00: de vorige trade is binnen, nog geen short ───');
  await sync();
  console.log('─── 16:30: de short loopt ───');
  await naar(ms('2026-10-22T14:30:00Z')); await sync();
  await p.evaluate(() => { const t = T.find(x => x.exchange === 'hyperliquid' && x.status === 'open'); if (t) { t.notes = 'mijn short'; t.stop = 82300; } persist(); });
  for (const [label, iso] of [['19:00, na de TP', '2026-10-22T17:00:00Z'], ['19:15', '2026-10-22T17:15:00Z'], ['19:30', '2026-10-22T17:30:00Z'], ['20:30, TP ruim een uur geleden', '2026-10-22T18:30:00Z'], ['22:20', '2026-10-22T20:20:00Z']]) {
    await naar(ms(iso)); await sync();
    const t = await rijen(), lopend = t.filter(x => x.status !== 'closed'), r = lopend[0] || {};
    ok(`${label}: één rij, partial, volle grootte 0,00949, geboekt ${GEBOEKT.toFixed(2)}`, lopend.length === 1 && r.status === 'partial' && bij(r.qty, 0.00949, 1e-9) && bij(r.real, GEBOEKT) && !r.stale && !r.ph,
      JSON.stringify(lopend));
    ok(`${label}: je notitie staat erop, de vorige trade houdt de zijne`, r.notes === 'mijn short' && t.filter(x => x.status === 'closed').every(x => x.notes === ''), JSON.stringify(t.map(x => [x.status, x.notes])));
  }
  const r1 = (await rijen()).find(x => x.status === 'partial') || {};
  ok('de partial heeft een R (stop 82.300)', r1.r != null && r1.r > 0, JSON.stringify(r1));

  console.log('─── Zoals in je export van 22:21: alleen nog de open placeholder ───');
  await p.evaluate(async () => {
    const vorige = T.filter(x => x.exchange === 'hyperliquid' && x.status === 'closed');
    T = [...vorige, { ...EMPTY_TRADE, id: 105, exchange: 'hyperliquid', kind: 'live', srcId: 'hyperliquid_open_BTC', status: 'open', placeholder: true, pair: 'BTC/USDC', dir: 'short',
      positionId: 'BTC', date: '2026-10-22', time: '16:07', openTime: String(Date.parse('2026-10-22T14:07:01Z')), entry: 81620.9, size: '496.26', qtyAsset: 0.00608, stop: 82300, stopBron: 'hyperliquid', notes: 'mijn short' }];
    persist(); CONNS.hyperliquid = { ...CONNS.hyperliquid, lastSync: Date.parse('2026-10-22T20:20:18Z') }; persistConns(); });
  await naar(ms('2026-10-22T20:35:00Z')); await sync();
  const h = (await rijen()).filter(x => x.status !== 'closed');
  ok('na de update: de volgende sync maakt er weer één partial-rij van, met de TP en je notitie', h.length === 1 && h[0].status === 'partial' && bij(h[0].real, GEBOEKT) && h[0].stappen === 2 && h[0].notes === 'mijn short',
    JSON.stringify(h));

  ok('geen JS-fouten', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n=== HL partial blijft: ${pass}/${pass + fail} ===`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ crash: ' + String(e).split('\n')[0]); process.exit(1); });
